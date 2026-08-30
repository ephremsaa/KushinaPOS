const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner, requireManager } = require('../middleware/auth');
const { verifyManagerPin, isPinUniqueForRestaurant } = require('../utils/pinHelper');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// ── GET /api/staff ────────────────────────────────────────────
// Managers can view staff too (not just owners)
router.get('/', requireManager, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, role, is_active, pin_hash IS NOT NULL as has_pin,
              created_at, deactivated_at, deactivation_note
       FROM staff
       WHERE restaurant_id=$1
       ORDER BY
         CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'cashier' THEN 2
                   WHEN 'kitchen' THEN 3 WHEN 'waiter' THEN 4 ELSE 5 END,
         name`,
      [tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/staff ───────────────────────────────────────────
router.post('/', requireOwner, async (req, res) => {
  const { name, email, phone, role = 'cashier', password, pin } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    // Check PIN uniqueness within this restaurant if provided
    if (pin) {
      const isUnique = await isPinUniqueForRestaurant(tid(req), pin);
      if (!isUnique) {
        return res.status(400).json({ error: 'PIN is already in use by another active staff member at this restaurant' });
      }
    }

    const password_hash = password ? await bcrypt.hash(password, 12) : null;
    const pin_hash = pin ? await bcrypt.hash(String(pin), 10) : null;
    const { rows } = await db.query(
      `INSERT INTO staff (restaurant_id, name, full_name, email, phone, role, password_hash, pin_hash)
       VALUES ($1,$2,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, email, phone, role, is_active, created_at`,
      [tid(req), name, email.toLowerCase(), phone || null, role, password_hash, pin_hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Staff with this email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── PATCH /api/staff/:id ──────────────────────────────────────
router.patch('/:id', requireOwner, async (req, res) => {
  const { role, is_active, password, pin, name, email, phone, deactivation_note } = req.body;
  try {
    // Check PIN uniqueness if updating PIN
    if (pin) {
      const isUnique = await isPinUniqueForRestaurant(tid(req), pin, req.params.id);
      if (!isUnique) {
        return res.status(400).json({ error: 'PIN is already in use by another active staff member at this restaurant' });
      }
    }

    const password_hash = password ? await bcrypt.hash(password, 12) : undefined;
    const pin_hash      = pin !== undefined ? (pin ? await bcrypt.hash(String(pin), 10) : null) : undefined;

    // Build dynamic SET clause
    let sets = ['updated_at = NOW()'];
    const params = [];
    let i = 1;
    if (name     !== undefined) { 
      sets.push(`name = $${i++}`); params.push(name); 
      sets.push(`full_name = $${i++}`); params.push(name); 
    }
    if (email    !== undefined) { sets.push(`email = $${i++}`);    params.push(email.toLowerCase()); }
    if (phone    !== undefined) { sets.push(`phone = $${i++}`);    params.push(phone); }
    if (role     !== undefined) { sets.push(`role = $${i++}`);     params.push(role); }
    if (is_active !== undefined) {
      sets.push(`is_active = $${i++}`);
      params.push(is_active);
      if (!is_active) {
        sets.push(`deactivated_at = NOW()`);
        if (deactivation_note) { sets.push(`deactivation_note = $${i++}`); params.push(deactivation_note); }
      } else {
        sets.push(`deactivated_at = NULL`);
        sets.push(`deactivation_note = NULL`);
      }
    }
    if (password_hash !== undefined) { sets.push(`password_hash = $${i++}`); params.push(password_hash); }
    if (pin_hash      !== undefined) { sets.push(`pin_hash = $${i++}`);       params.push(pin_hash); }

    params.push(req.params.id, tid(req));
    const { rows } = await db.query(
      `UPDATE staff SET ${sets.join(', ')} WHERE id=$${i++} AND restaurant_id=$${i++}
       RETURNING id, name, email, phone, role, is_active, created_at, deactivated_at`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/staff/verify-pin ────────────────────────────────
// Used for manager-PIN flow for sensitive actions.
// Any logged-in staff can call this; returns { authorized: true/false, staff_id, staff_name, role }
router.post('/verify-pin', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'pin required' });
  try {
    const { authorized, staff } = await verifyManagerPin(tid(req), pin);
    if (authorized && staff) {
      return res.json({ authorized: true, staff_id: staff.id, staff_name: staff.name, role: staff.role });
    }
    res.json({ authorized: false });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── DELETE /api/staff/:id ─────────────────────────────────────
// Soft-delete recommended; hard-delete only allowed by owner and never for owners
router.delete('/:id', requireOwner, async (req, res) => {
  const { rows } = await db.query('SELECT role FROM staff WHERE id=$1 AND restaurant_id=$2', [req.params.id, tid(req)]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (rows[0].role === 'owner') return res.status(403).json({ error: 'Cannot delete owner' });
  // Soft delete: just deactivate rather than hard-delete to preserve audit trail
  await db.query(
    `UPDATE staff SET is_active=FALSE, deactivated_at=NOW() WHERE id=$1 AND restaurant_id=$2`,
    [req.params.id, tid(req)]
  );
  res.json({ message: 'Deactivated' });
});

// ── GET /api/staff/:id/shifts ─────────────────────────────────
router.get('/:id/shifts', requireManager, async (req, res) => {
  const { limit = 30, date_from, date_to } = req.query;
  try {
    let query = `SELECT * FROM staff_shifts WHERE staff_id=$1 AND restaurant_id=$2`;
    const params = [req.params.id, tid(req)];
    let pi = 3;
    if (date_from) { query += ` AND clocked_in_at >= $${pi++}`; params.push(date_from); }
    if (date_to)   { query += ` AND clocked_in_at <= $${pi++}`; params.push(date_to + 'T23:59:59Z'); }
    query += ` ORDER BY clocked_in_at DESC LIMIT $${pi}`;
    params.push(parseInt(limit));
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/staff/shifts/all ─────────────────────────────────
// All shifts for this restaurant — for timesheet report
router.get('/shifts/all', requireManager, async (req, res) => {
  const { date_from, date_to } = req.query;
  try {
    let query = `SELECT ss.*, s.name as staff_name, s.role
                 FROM staff_shifts ss JOIN staff s ON s.id = ss.staff_id
                 WHERE ss.restaurant_id=$1`;
    const params = [tid(req)];
    let pi = 2;
    if (date_from) { query += ` AND ss.clocked_in_at >= $${pi++}`; params.push(date_from); }
    if (date_to)   { query += ` AND ss.clocked_in_at <= $${pi++}`; params.push(date_to + 'T23:59:59Z'); }
    query += ` ORDER BY ss.clocked_in_at DESC LIMIT 500`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/staff/:id/clock-in ─────────────────────────────
router.post('/:id/clock-in', requireManager, async (req, res) => {
  try {
    // Check if already clocked in (open shift)
    const { rows: open } = await db.query(
      `SELECT id FROM staff_shifts WHERE staff_id=$1 AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1`,
      [req.params.id]
    );
    if (open.length > 0) return res.status(409).json({ error: 'Already clocked in' });

    const { rows } = await db.query(
      `INSERT INTO staff_shifts (restaurant_id, staff_id) VALUES ($1,$2) RETURNING *`,
      [tid(req), req.params.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/staff/:id/clock-out ────────────────────────────
router.post('/:id/clock-out', requireManager, async (req, res) => {
  const { notes } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE staff_shifts SET clocked_out_at=NOW(), notes=$1
       WHERE staff_id=$2 AND clocked_out_at IS NULL
       RETURNING *`,
      [notes || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No open shift found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/staff/active-now ─────────────────────────────────
// Who is currently clocked in
router.get('/active-now', requireManager, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ss.*, s.name as staff_name, s.role
       FROM staff_shifts ss JOIN staff s ON s.id = ss.staff_id
       WHERE ss.restaurant_id=$1 AND ss.clocked_out_at IS NULL
       ORDER BY ss.clocked_in_at`,
      [tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
