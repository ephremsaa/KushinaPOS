const rateLimit = require('express-rate-limit');

/**
 * Standard Auth Limiter (for owner/admin email+password login)
 * 10 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP address. Please try again in 15 minutes.'
  }
});

/**
 * Staff PIN Login Limiter
 * 20 attempts per 15 minutes per IP + restaurant slug combination
 * (Accommodates busy shared restaurant tablets)
 */
const staffLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const slug = req.body?.slug ? String(req.body.slug).toLowerCase().trim() : 'general';
    return `${req.ip}_${slug}`;
  },
  message: {
    error: 'Too many invalid PIN attempts for this restaurant terminal. Please try again in 15 minutes.'
  }
});

/**
 * Bootstrap Admin Creation Limiter
 * 5 attempts per 15 minutes per IP
 */
const bootstrapAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many admin creation attempts. Please try again later.'
  }
});

module.exports = {
  authLimiter,
  staffLoginLimiter,
  bootstrapAdminLimiter
};
