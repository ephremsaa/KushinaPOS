const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planLimits');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

// Guarded by tenant authentication and plan feature 'loyalty'
router.use(authenticate, requireTenant, requirePlanFeature('loyalty'));

// Helper: Calculate customer tier
function computeTier(points) {
  if (points >= 1000) return 'Platinum';
  if (points >= 500) return 'Gold';
  if (points >= 200) return 'Silver';
  return 'Bronze';
}

// ── GET /api/loyalty/customers ────────────────────────────────
router.get('/customers', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const q = req.query.q ? String(req.query.q).trim() : '';

  try {
    let query = `
      SELECT id, name, phone, email, points, stamps, tier, total_spent, total_visits, notes, created_at 
      FROM customers 
      WHERE restaurant_id = $1
    `;
    const params = [restaurantId];

    if (q) {
      query += ` AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY total_spent DESC, created_at DESC LIMIT 100`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('List loyalty customers error:', err);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// ── POST /api/loyalty/customers ───────────────────────────────
router.post('/customers', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const name = String(req.body.name || '').trim().slice(0, 100);
  const phone = String(req.body.phone || '').trim().replace(/[\s-]/g, '').slice(0, 20);
  const email = req.body.email ? String(req.body.email).trim().toLowerCase().slice(0, 100) : null;
  const notes = req.body.notes ? String(req.body.notes).trim().slice(0, 300) : null;

  if (!name) return res.status(400).json({ error: 'Customer name is required' });
  if (!phone || phone.length < 9) return res.status(400).json({ error: 'Valid phone number is required' });

  try {
    // Check if customer already exists for this restaurant
    const existing = await db.query(
      `SELECT id, name, phone, points, tier FROM customers WHERE restaurant_id = $1 AND phone = $2`,
      [restaurantId, phone]
    );

    if (existing.rows[0]) {
      // Update name/email if provided
      const updated = await db.query(
        `UPDATE customers 
         SET name = $1, email = COALESCE($2, email), notes = COALESCE($3, notes), updated_at = NOW() 
         WHERE id = $4 AND restaurant_id = $5 
         RETURNING *`,
        [name, email, notes, existing.rows[0].id, restaurantId]
      );
      return res.json(updated.rows[0]);
    }

    const { rows } = await db.query(
      `INSERT INTO customers (restaurant_id, name, phone, email, notes, points, stamps, tier, total_spent, total_visits)
       VALUES ($1, $2, $3, $4, $5, 0, 0, 'Bronze', 0, 0)
       RETURNING *`,
      [restaurantId, name, phone, email, notes]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer record' });
  }
});

// ── GET /api/loyalty/settings ─────────────────────────────────
// Fetch loyalty configuration for the restaurant (Owner only)
router.get('/settings', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  try {
    const { rows } = await db.query(
      `SELECT loyalty_enabled, loyalty_program_type, loyalty_points_per_100_etb,
              loyalty_point_val_etb, loyalty_min_redeem_points, loyalty_max_bill_share_percent,
              loyalty_expiry_months, loyalty_stamp_target
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Get loyalty settings error:', err);
    res.status(500).json({ error: 'Failed to fetch loyalty settings' });
  }
});

// ── PATCH /api/loyalty/settings ────────────────────────────────
// Update loyalty configuration (Owner only)
router.patch('/settings', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const role = req.user.role === 'restaurant_owner' ? 'owner' : (req.user.staffRole || req.user.role);
  if (role !== 'owner' && role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only restaurant owners can modify loyalty program settings' });
  }

  const {
    loyalty_enabled,
    loyalty_program_type,
    loyalty_points_per_100_etb,
    loyalty_point_val_etb,
    loyalty_min_redeem_points,
    loyalty_max_bill_share_percent,
    loyalty_expiry_months,
    loyalty_stamp_target
  } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE restaurants
       SET loyalty_enabled = COALESCE($1, loyalty_enabled),
           loyalty_program_type = COALESCE($2, loyalty_program_type),
           loyalty_points_per_100_etb = COALESCE($3, loyalty_points_per_100_etb),
           loyalty_point_val_etb = COALESCE($4, loyalty_point_val_etb),
           loyalty_min_redeem_points = COALESCE($5, loyalty_min_redeem_points),
           loyalty_max_bill_share_percent = COALESCE($6, loyalty_max_bill_share_percent),
           loyalty_expiry_months = COALESCE($7, loyalty_expiry_months),
           loyalty_stamp_target = COALESCE($8, loyalty_stamp_target),
           updated_at = NOW()
       WHERE id = $9
       RETURNING loyalty_enabled, loyalty_program_type, loyalty_points_per_100_etb,
                 loyalty_point_val_etb, loyalty_min_redeem_points, loyalty_max_bill_share_percent,
                 loyalty_expiry_months, loyalty_stamp_target`,
      [
        loyalty_enabled !== undefined ? Boolean(loyalty_enabled) : null,
        loyalty_program_type ? String(loyalty_program_type) : null,
        loyalty_points_per_100_etb !== undefined ? Number(loyalty_points_per_100_etb) : null,
        loyalty_point_val_etb !== undefined ? Number(loyalty_point_val_etb) : null,
        loyalty_min_redeem_points !== undefined ? parseInt(loyalty_min_redeem_points, 10) : null,
        loyalty_max_bill_share_percent !== undefined ? Number(loyalty_max_bill_share_percent) : null,
        loyalty_expiry_months !== undefined ? (loyalty_expiry_months === null ? null : parseInt(loyalty_expiry_months, 10)) : null,
        loyalty_stamp_target !== undefined ? parseInt(loyalty_stamp_target, 10) : null,
        restaurantId
      ]
    );

    await logAudit(null, {
      restaurantId,
      actorUserId: req.user.userId || req.user.id,
      action: 'loyalty_settings_updated',
      targetType: 'restaurant',
      metadata: rows[0]
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('Update loyalty settings error:', err);
    res.status(500).json({ error: 'Failed to update loyalty settings' });
  }
});

// ── GET /api/loyalty/transactions ─────────────────────────────
// Fetch recent loyalty transactions for the restaurant
router.get('/transactions', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const { limit = 50 } = req.query;

  try {
    const { rows } = await db.query(
      `SELECT lt.*, c.name as customer_name, c.phone as customer_phone, s.name as staff_name
       FROM loyalty_transactions lt
       JOIN customers c ON c.id = lt.customer_id
       LEFT JOIN staff s ON s.id = lt.staff_id
       WHERE lt.restaurant_id = $1
       ORDER BY lt.created_at DESC
       LIMIT $2`,
      [restaurantId, Math.min(100, parseInt(limit, 10) || 50)]
    );

    res.json(rows);
  } catch (err) {
    console.error('List loyalty transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch loyalty transactions' });
  }
});

// ── POST /api/loyalty/customers/:id/adjust-points ────────────
router.post('/customers/:id/adjust-points', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const customerId = req.params.id;
  const delta = parseInt(req.body.points_delta, 10);
  const reason = String(req.body.reason || 'Manual adjustment').trim().slice(0, 150);

  if (isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: 'Valid non-zero integer points_delta is required' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const custRes = await client.query(
      `SELECT id, name, phone, points FROM customers WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [customerId, restaurantId]
    );

    if (!custRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = custRes.rows[0];
    const newPoints = customer.points + delta;

    if (newPoints < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Insufficient points balance. Current: ${customer.points}, Requested deduction: ${Math.abs(delta)}`
      });
    }

    const newTier = computeTier(newPoints);

    const updateRes = await client.query(
      `UPDATE customers 
       SET points = $1, tier = $2, updated_at = NOW() 
       WHERE id = $3 AND restaurant_id = $4 
       RETURNING id, name, phone, points, tier`,
      [newPoints, newTier, customerId, restaurantId]
    );

    // Record ledger entry
    await client.query(
      `INSERT INTO loyalty_transactions
        (restaurant_id, customer_id, order_id, type, points, balance_after, staff_id, note, created_at)
       VALUES ($1, $2, NULL, 'adjust', $3, $4, $5, $6, NOW())`,
      [
        restaurantId,
        customerId,
        delta,
        newPoints,
        req.user.userId || req.user.id,
        reason
      ]
    );

    // Record audit log for point alteration
    await logAudit(client, {
      restaurantId,
      actorUserId: req.user.userId || req.user.id,
      actorEmail: req.user.email,
      action: 'loyalty_points_adjust',
      targetType: 'customer',
      targetId: customerId,
      metadata: {
        customer_phone: customer.phone,
        previous_points: customer.points,
        points_delta: delta,
        new_points: newPoints,
        reason
      }
    });

    await client.query('COMMIT');
    res.json(updateRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Adjust points error:', err);
    res.status(500).json({ error: 'Failed to adjust customer points' });
  } finally {
    client.release();
  }
});

module.exports = router;
