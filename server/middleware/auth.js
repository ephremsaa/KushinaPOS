const jwt = require('jsonwebtoken');

/**
 * Verifies Bearer JWT and attaches decoded payload to req.user
 * Payload: { userId, email, role, restaurantId, staffRole }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
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
