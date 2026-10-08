const rateLimit = require('express-rate-limit');

/**
 * Standard Auth Limiter (for owner/admin email+password login)
 * 5 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP address. Please try again in 15 minutes.'
  }
});

/**
 * Staff PIN Login Limiter
 * 8 attempts per 10 minutes per IP + restaurant slug combination
 * (Protects 4-digit PIN keyspace on shared terminals)
 */
const staffLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const slug = req.body?.slug ? String(req.body.slug).toLowerCase().trim() : 'general';
    return `${req.ip}_${slug}`;
  },
  message: {
    error: 'Too many invalid PIN attempts for this terminal. Please wait 10 minutes before trying again.'
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

/**
 * Manager PIN Verification Limiter (for sensitive actions like voids & overrides)
 * 5 attempts per 10 minutes per IP + restaurant
 */
const verifyPinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const restaurantId = req.user?.restaurantId || 'general';
    return `${req.ip}_${restaurantId}`;
  },
  message: {
    error: 'Too many failed manager PIN verification attempts. Please wait 10 minutes before retrying.'
  }
});

/**
 * Registration Limiter
 * 5 registration attempts per hour per IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many restaurant registration attempts from this IP address. Please try again later.'
  }
});

module.exports = {
  authLimiter,
  staffLoginLimiter,
  bootstrapAdminLimiter,
  verifyPinLimiter,
  registerLimiter
};
