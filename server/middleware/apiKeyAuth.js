const crypto = require('crypto');
const db = require('../config/db');
const { authenticate } = require('./auth');
const { getRestaurantPlanFeatures } = require('./planLimits');

/**
 * Hash raw API key using SHA-256
 */
function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generates a new API key pair: raw key (given to user once) and hash for database.
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `kpos_live_${randomBytes}`;
  const keyPrefix = rawKey.slice(0, 14); // "kpos_live_xxxx"
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Middleware: Authenticates an external API client using an API Key.
 * Key can be provided via `x-api-key` header or `Authorization: Bearer kpos_live_...`
 */
async function authenticateApiKey(req, res, next) {
  let rawKey = req.headers['x-api-key'];

  const authHeader = req.headers.authorization;
  if (!rawKey && authHeader && authHeader.startsWith('Bearer kpos_')) {
    rawKey = authHeader.slice(7).trim();
  }

  if (!rawKey) {
    return res.status(401).json({ error: 'Missing API key. Provide via x-api-key header or Bearer token.' });
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const keyRes = await db.query(
      `SELECT k.id, k.restaurant_id, k.name, k.permissions, k.is_active, r.status as restaurant_status
       FROM api_keys k
       JOIN restaurants r ON r.id = k.restaurant_id
       WHERE k.key_hash = $1`,
      [keyHash]
    );

    if (!keyRes.rows[0]) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    const key = keyRes.rows[0];

    if (!key.is_active) {
      return res.status(401).json({ error: 'This API key has been deactivated' });
    }

    if (key.restaurant_status !== 'active') {
      return res.status(403).json({ error: 'Restaurant account is suspended or inactive' });
    }

    // Verify the restaurant's plan includes API access
    const { features, planName } = await getRestaurantPlanFeatures(key.restaurant_id);
    if (!features.api_access) {
      return res.status(403).json({
        error: `API access is not available on your restaurant's current plan (${planName}). Please upgrade to Enterprise.`,
        code: 'PLAN_FEATURE_LOCKED'
      });
    }

    // Touch last_used_at non-blocking
    db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]).catch(() => {});

    // Attach credentials
    req.user = {
      role: 'api_client',
      restaurantId: key.restaurant_id,
      keyId: key.id,
      keyName: key.name,
      permissions: typeof key.permissions === 'string' ? JSON.parse(key.permissions) : key.permissions
    };

    next();
  } catch (err) {
    console.error('API key auth error:', err);
    res.status(500).json({ error: 'Internal security authentication error' });
  }
}

/**
 * Flexible middleware: Accepts either standard JWT bearer OR API Key.
 */
function authenticateApiKeyOrBearer(req, res, next) {
  const hasApiKey = req.headers['x-api-key'] || (req.headers.authorization && req.headers.authorization.startsWith('Bearer kpos_'));
  if (hasApiKey) {
    return authenticateApiKey(req, res, next);
  }
  return authenticate(req, res, next);
}

module.exports = {
  hashApiKey,
  generateApiKey,
  authenticateApiKey,
  authenticateApiKeyOrBearer
};
