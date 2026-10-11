const crypto = require('crypto');
const db = require('../config/db');
const { getRestaurantPlanFeatures } = require('./planLimits');

// Sliding window in-memory rate limiter per API key ID: keyId -> Array of timestamps (ms)
const rateLimitBuckets = new Map();

/**
 * Hash raw API key using SHA-256
 */
function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generate a new random API key
 */
function generateV1ApiKey() {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `kpos_live_${randomBytes}`;
  const keyPrefix = rawKey.slice(0, 14); // "kpos_live_3f8a"
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Check if incoming client IP matches the allowlist
 */
function isIpAllowed(clientIp, allowlist) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true;
  // Normalize IPv6 mapped IPv4
  const cleanIp = clientIp.replace(/^::ffff:/, '');
  return allowlist.some(allowed => {
    const cleanAllowed = String(allowed).trim().replace(/^::ffff:/, '');
    if (cleanAllowed === cleanIp) return true;
    if (cleanAllowed === '*' || cleanAllowed === '0.0.0.0/0') return true;
    // Basic CIDR or wildcard support
    if (cleanAllowed.endsWith('/*') || cleanAllowed.endsWith('/24')) {
      const prefix = cleanAllowed.split('.')[0] + '.' + cleanAllowed.split('.')[1] + '.' + cleanAllowed.split('.')[2];
      return cleanIp.startsWith(prefix);
    }
    return false;
  });
}

/**
 * Rate limit check: returns { allowed, limit, remaining, resetSeconds }
 */
function checkRateLimit(keyId, limit = 60) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const windowStart = now - windowMs;

  let timestamps = rateLimitBuckets.get(keyId) || [];
  // Filter out timestamps older than 60s
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateLimitBuckets.set(keyId, timestamps);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
      resetTimestamp: Math.ceil((oldest + windowMs) / 1000)
    };
  }

  timestamps.push(now);
  rateLimitBuckets.set(keyId, timestamps);
  const remaining = Math.max(0, limit - timestamps.length);
  const resetSeconds = Math.ceil((timestamps[0] + windowMs - now) / 1000);

  return {
    allowed: true,
    limit,
    remaining,
    resetSeconds,
    resetTimestamp: Math.ceil((now + windowMs) / 1000)
  };
}

/**
 * Authenticates requests to /api/v1/ endpoints
 */
async function authenticateApiV1(req, res, next) {
  // Generate unified request ID
  const requestId = req.headers['x-request-id'] || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // 1. Extract Bearer token or x-api-key header
  let rawKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  if (!rawKey && authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  }

  if (!rawKey) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key. Provide via Authorization: Bearer <key> or x-api-key header.'
      },
      request_id: requestId
    });
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const { rows } = await db.query(
      `SELECT k.id, k.restaurant_id, k.name, k.scopes, k.permissions, k.is_active, 
              k.is_suspended_by_admin, k.expires_at, k.ip_allowlist, k.rate_limit_per_minute,
              r.status as restaurant_status, r.name as restaurant_name
       FROM api_keys k
       JOIN restaurants r ON r.id = k.restaurant_id
       WHERE k.key_hash = $1`,
      [keyHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid or does not exist.'
        },
        request_id: requestId
      });
    }

    const key = rows[0];

    // Check active
    if (!key.is_active) {
      return res.status(401).json({
        error: {
          code: 'KEY_REVOKED',
          message: 'This API key has been revoked or deactivated.'
        },
        request_id: requestId
      });
    }

    // Check admin suspension
    if (key.is_suspended_by_admin) {
      return res.status(403).json({
        error: {
          code: 'KEY_SUSPENDED',
          message: 'This API key has been suspended by the platform administrator.'
        },
        request_id: requestId
      });
    }

    // Check expiration
    if (key.expires_at && new Date() > new Date(key.expires_at)) {
      return res.status(401).json({
        error: {
          code: 'KEY_EXPIRED',
          message: `This API key expired on ${new Date(key.expires_at).toISOString()}.`
        },
        request_id: requestId
      });
    }

    // Check restaurant status
    if (key.restaurant_status !== 'active') {
      return res.status(403).json({
        error: {
          code: 'RESTAURANT_INACTIVE',
          message: 'The restaurant account associated with this API key is inactive or suspended.'
        },
        request_id: requestId
      });
    }

    // Check IP allowlist
    const clientIp = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket.remoteAddress || '';

    const allowlist = Array.isArray(key.ip_allowlist)
      ? key.ip_allowlist
      : (typeof key.ip_allowlist === 'string' ? JSON.parse(key.ip_allowlist) : []);

    if (!isIpAllowed(clientIp, allowlist)) {
      return res.status(403).json({
        error: {
          code: 'IP_FORBIDDEN',
          message: `Client IP ${clientIp} is not authorized by this API key's allowlist.`
        },
        request_id: requestId
      });
    }

    // Check plan feature 'api_access'
    const { features, planName } = await getRestaurantPlanFeatures(key.restaurant_id);
    if (!features.api_access) {
      return res.status(403).json({
        error: {
          code: 'PLAN_FEATURE_LOCKED',
          message: `API access is not available on current plan (${planName}). Please upgrade to Enterprise.`
        },
        request_id: requestId
      });
    }

    // Rate Limiting
    const limit = key.rate_limit_per_minute || 60;
    const rl = checkRateLimit(key.id, limit);

    res.setHeader('X-RateLimit-Limit', String(rl.limit));
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.resetTimestamp));

    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.resetSeconds));
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit of ${limit} requests per minute exceeded. Retry in ${rl.resetSeconds} seconds.`
        },
        request_id: requestId
      });
    }

    // Touch last_used_at & request_count non-blocking
    db.query(
      `UPDATE api_keys 
       SET last_used_at = NOW(), request_count = request_count + 1 
       WHERE id = $1`,
      [key.id]
    ).catch(() => {});

    // Normalize scopes
    let scopes = [];
    if (Array.isArray(key.scopes)) {
      scopes = key.scopes;
    } else if (typeof key.scopes === 'string') {
      try { scopes = JSON.parse(key.scopes); } catch {}
    } else if (Array.isArray(key.permissions)) {
      scopes = key.permissions;
    }

    // Attach verified tenant context
    req.tenantId = key.restaurant_id;
    req.apiKey = {
      id: key.id,
      name: key.name,
      scopes,
      restaurantId: key.restaurant_id,
      restaurantName: key.restaurant_name
    };
    req.user = {
      role: 'api_client',
      restaurantId: key.restaurant_id,
      keyId: key.id
    };

    next();
  } catch (err) {
    console.error('API v1 Auth Error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Security authentication failure'
      },
      request_id: requestId
    });
  }
}

/**
 * Scope checking middleware for API v1
 */
function requireScope(requiredScope) {
  return (req, res, next) => {
    const scopes = req.apiKey?.scopes || [];
    const hasScope = scopes.includes(requiredScope) || scopes.includes('*') || scopes.includes('admin');

    if (!hasScope) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `This endpoint requires scope '${requiredScope}'. Your API key possesses: [${scopes.join(', ')}]`
        },
        request_id: req.requestId
      });
    }

    next();
  };
}

module.exports = {
  authenticateApiV1,
  requireScope,
  generateV1ApiKey,
  hashApiKey,
  rateLimitBuckets,
};
