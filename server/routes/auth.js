const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const router = express.Router();

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

// ── POST /api/auth/register ──────────────────────────────────
// Restaurant owner registers their restaurant
router.post('/register', async (req, res) => {
  const { name, email, password, phone, city, cuisine_type, tax_id, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  try {
    // Check duplicate email
    const exists = await db.query('SELECT id FROM restaurants WHERE email = $1', [cleanEmail]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    let baseSlug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (!baseSlug) baseSlug = 'restaurant';
    let slug = baseSlug;
    let counter = 1;
    let isUnique = false;
    while (!isUnique) {
      const slugCheck = await db.query('SELECT id FROM restaurants WHERE slug = $1', [slug]);
      if (slugCheck.rows.length === 0) isUnique = true;
      else { slug = `${baseSlug}-${counter}`; counter++; }
    }

    const password_hash = await bcrypt.hash(cleanPassword, 12);
    const { rows } = await db.query(
      `INSERT INTO restaurants (name, email, password_hash, phone, city, cuisine_type, tax_id, address, slug, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *`,
      [name.trim(), cleanEmail, password_hash, phone?.trim() || null, city?.trim() || null, cuisine_type?.trim() || null, tax_id?.trim() || null, address?.trim() || null, slug]
    );
    const restaurant = rows[0];

    const token = signToken({
      userId: restaurant.id,
      email: restaurant.email,
      role: 'restaurant_owner',
      restaurantId: restaurant.id,
    });

    res.status(201).json({ token, user: sanitizeRestaurant(restaurant) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  try {
    // Try platform admin first
    const adminResult = await db.query('SELECT * FROM platform_admins WHERE LOWER(email) = $1', [cleanEmail]);
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      if (admin.password_hash) {
        const valid = await bcrypt.compare(cleanPassword, admin.password_hash);
        if (valid) {
          const token = signToken({ userId: admin.id, email: admin.email, role: 'platform_admin' });
          return res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: 'platform_admin' } });
        }
      }
    }

    // Try restaurant owner
    const restResult = await db.query('SELECT * FROM restaurants WHERE LOWER(email) = $1', [cleanEmail]);
    if (restResult.rows.length > 0) {
      const restaurant = restResult.rows[0];
      if (restaurant.password_hash) {
        const valid = await bcrypt.compare(cleanPassword, restaurant.password_hash);
        if (valid) {
          const token = signToken({
            userId: restaurant.id,
            email: restaurant.email,
            role: 'restaurant_owner',
            restaurantId: restaurant.id,
          });
          return res.json({ token, user: { ...sanitizeRestaurant(restaurant), role: 'restaurant_owner' } });
        }
      }
    }

    return res.status(401).json({ error: 'Invalid credentials. Please check your email and password.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/staff-login ───────────────────────────────
router.post('/staff-login', async (req, res) => {
  const { slug, pin } = req.body;
  if (!slug || !pin) return res.status(400).json({ error: 'slug and pin required' });

  try {
    const restResult = await db.query('SELECT * FROM restaurants WHERE slug = $1', [slug]);
    if (restResult.rows.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
    const restaurant = restResult.rows[0];

    const staffResult = await db.query(
      'SELECT s.* FROM staff s WHERE s.restaurant_id = $1 AND s.is_active = true AND s.pin_hash IS NOT NULL',
      [restaurant.id]
    );

    let validStaff = null;
    for (const staff of staffResult.rows) {
      const valid = await bcrypt.compare(String(pin), staff.pin_hash);
      if (valid) {
        validStaff = staff;
        break;
      }
    }

    if (!validStaff) return res.status(401).json({ error: 'Invalid PIN' });

    const token = signToken({
      userId: validStaff.id,
      email: validStaff.email,
      role: 'staff',
      restaurantId: validStaff.restaurant_id,
      staffRole: validStaff.role,
    });

    return res.json({
      token,
      user: {
        id: validStaff.id, email: validStaff.email, name: validStaff.name,
        role: 'staff', staffRole: validStaff.role,
        restaurantId: validStaff.restaurant_id, restaurantStatus: restaurant.status,
        restaurant: sanitizeRestaurant(restaurant)
      }
    });

  } catch (err) {
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Staff login failed' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
const { authenticate } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res) => {
  try {
    const { userId, role } = req.user;

    if (role === 'platform_admin') {
      const { rows } = await db.query('SELECT id, email, name FROM platform_admins WHERE id = $1', [userId]);
      if (!rows[0]) return res.status(404).json({ error: 'Admin not found' });
      return res.json({ ...rows[0], role: 'platform_admin' });
    }

    if (role === 'restaurant_owner') {
      const { rows } = await db.query('SELECT * FROM restaurants WHERE id = $1', [userId]);
      if (!rows[0]) return res.status(404).json({ error: 'Restaurant not found' });
      // Check whether a subscription record exists for this tenant
      const subCheck = await db.query(
        "SELECT id FROM subscriptions WHERE restaurant_id = $1 LIMIT 1",
        [userId]
      );
      return res.json({
        ...sanitizeRestaurant(rows[0]),
        role: 'restaurant_owner',
        has_subscription: subCheck.rows.length > 0,
      });
    }

    if (role === 'staff') {
      const { rows } = await db.query(
        `SELECT s.*, 
          r.name as r_name, r.status as r_status, r.tax_rate as r_tax_rate, 
          r.theme_color as r_theme_color, r.background_color as r_background_color, r.logo_url as r_logo_url, 
          r.receipt_footer as r_receipt_footer, r.address as r_address, 
          r.city as r_city, r.phone as r_phone, r.cuisine_type as r_cuisine_type 
         FROM staff s 
         JOIN restaurants r ON r.id = s.restaurant_id 
         WHERE s.id = $1`,
        [userId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Staff not found' });
      const s = rows[0];
      return res.json({
        id: s.id, email: s.email, name: s.name, role: 'staff', staffRole: s.role,
        restaurantId: s.restaurant_id, restaurantName: s.r_name,
        restaurantStatus: s.r_status,
        restaurant: {
          id: s.restaurant_id,
          name: s.r_name,
          status: s.r_status,
          tax_rate: s.r_tax_rate,
          theme_color: s.r_theme_color,
          background_color: s.r_background_color,
          logo_url: s.r_logo_url,
          receipt_footer: s.r_receipt_footer,
          address: s.r_address,
          city: s.r_city,
          phone: s.r_phone,
          cuisine_type: s.r_cuisine_type
        }
      });
    }

    res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── POST /api/auth/admin/create ──────────────────────────────
// One-time route to create the first platform admin
router.post('/admin/create', async (req, res) => {
  const { name, email, password, secret } = req.body;
  // Simple bootstrap secret to prevent abuse
  if (secret !== (process.env.ADMIN_BOOTSTRAP_SECRET || 'kushina-bootstrap-2024')) {
    return res.status(403).json({ error: 'Invalid bootstrap secret' });
  }
  try {
    const exists = await db.query('SELECT id FROM platform_admins WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Admin already exists' });

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO platform_admins (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email.toLowerCase(), password_hash, name]
    );
    res.status(201).json({ message: 'Admin created', admin: rows[0] });
  } catch (err) {
    console.error('Admin create error:', err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

function sanitizeRestaurant(r) {
  const { password_hash, ...rest } = r;
  return rest;
}

module.exports = router;
