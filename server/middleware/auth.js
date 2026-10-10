const jwt = require('jsonwebtoken');

const db = require('../config/db');

// Cache for restaurant and staff status: { [id]: { status, expiresAt } }
const statusCache = new Map();

async function checkStatusWithCache(type, id) {
  const now = Date.now();
  const cacheKey = `${type}_${id}`;
  const cached = statusCache.get(cacheKey);
  
  if (cached && cached.expiresAt > now) {
    return cached.status;
  }

  let status = null;
  if (type === 'restaurant') {
    const { rows } = await db.query("SELECT status FROM restaurants WHERE id = $1", [id]);
    status = rows.length > 0 ? rows[0].status : null;
  } else if (type === 'staff') {
    const { rows } = await db.query("SELECT is_active FROM staff WHERE id = $1", [id]);
    status = rows.length > 0 ? rows[0].is_active : false;
  }

  statusCache.set(cacheKey, { status, expiresAt: now + 60000 }); // 60 seconds
  return status;
}

/**
 * Verifies Bearer JWT and attaches decoded payload to req.user
 * Payload: { userId, email, role, restaurantId, staffRole }
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Check tenant status
    if (decoded.role === 'restaurant_owner' || decoded.role === 'staff') {
      const restStatus = await checkStatusWithCache('restaurant', decoded.restaurantId);
      if (restStatus !== 'active') {
        return res.status(403).json({ code: 'RESTAURANT_SUSPENDED', error: 'Restaurant is suspended or inactive' });
      }
    }
    
    // Check staff active status
    if (decoded.role === 'staff') {
      const isActive = await checkStatusWithCache('staff', decoded.userId);
      if (!isActive) {
        return res.status(403).json({ code: 'STAFF_DISABLED', error: 'Staff account disabled' });
      }
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Require platform_admin role */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}

/** Require restaurant_owner or manager role */
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'restaurant_owner' && req.user.staffRole !== 'owner' && req.user.staffRole !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: owner/manager only' });
  }
  next();
}

/** Allow any authenticated tenant user (any staff role) */
function requireTenant(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'restaurant_owner' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

const requireManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'restaurant_owner' && !['owner', 'manager'].includes(req.user.staffRole)) {
    return res.status(403).json({ error: 'Requires manager privileges' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireOwner, requireTenant, requireManager };
