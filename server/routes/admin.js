const express = require('express');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [restaurants, pendingProofs, subs, plans, renewals] = await Promise.all([
      db.query('SELECT id, name, status, created_at FROM restaurants ORDER BY created_at DESC'),
      db.query("SELECT COUNT(*) FROM payment_proofs WHERE status = 'pending'"),
      db.query(`SELECT sp.name as plan_name, sp.price_monthly, s.status, s.restaurant_id, s.current_period_end 
                FROM subscriptions s
                JOIN subscription_plans sp ON sp.id = s.plan_id
                WHERE s.status IN ('active', 'trial')`),
      db.query('SELECT name FROM subscription_plans WHERE is_active=true'),
      db.query(`SELECT COUNT(*) FROM subscriptions WHERE status='active' AND current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'`)
    ]);

    const all = restaurants.rows;
    const activeSubs = subs.rows.filter(s => s.status === 'active');
    const mrr = activeSubs.reduce((acc, sub) => acc + Number(sub.price_monthly), 0);

    const planBreakdown = activeSubs.reduce((acc, sub) => {
      acc[sub.plan_name] = (acc[sub.plan_name] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total:           all.length,
      active:          all.filter(r => r.status === 'active').length,
      pending:         all.filter(r => r.status === 'pending').length,
      suspended:       all.filter(r => r.status === 'suspended').length,
      pendingPayments: parseInt(pendingProofs.rows[0].count, 10),
      mrr:             mrr,
      recent:          all.slice(0, 5),
      planBreakdown,
      upcomingRenewals: parseInt(renewals.rows[0].count, 10),
      // Simple churn mock: suspended / total
      churnRate:       all.length ? (all.filter(r => r.status === 'suspended').length / all.length) * 100 : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/admin/restaurants ────────────────────────────────
router.get('/restaurants', async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT r.*, sp.name as plan_name
      FROM restaurants r
      LEFT JOIN subscriptions s ON s.restaurant_id = r.id
        AND s.status IN ('active','trial')
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      ORDER BY r.created_at DESC`;
    const params = [];
    if (status && status !== 'all') {
      query = `
        SELECT r.*, sp.name as plan_name
        FROM restaurants r
        LEFT JOIN subscriptions s ON s.restaurant_id = r.id
          AND s.status IN ('active','trial')
        LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
        WHERE r.status = $1
        ORDER BY r.created_at DESC`;
      params.push(status);
    }
    const { rows } = await db.query(query, params);
    res.json(rows.map(r => { const { password_hash, ...rest } = r; return rest; }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// ── GET /api/admin/restaurants/pending ───────────────────────
router.get('/restaurants/pending', async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM restaurants WHERE status = 'pending' ORDER BY created_at ASC"
    );
    res.json(rows.map(r => { const { password_hash, ...rest } = r; return rest; }));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── PATCH /api/admin/restaurants/:id/approve ─────────────────
router.patch('/restaurants/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    await db.query(
      `UPDATE restaurants SET status='active', approved_by=$1, approved_at=NOW(), trial_ends_at=$2, updated_at=NOW() WHERE id=$3`,
      [req.user.userId, trialEnd.toISOString(), id]
    );

    // Create trial subscription with first plan
    const plans = await db.query('SELECT id FROM subscription_plans WHERE is_active=true ORDER BY price_monthly ASC LIMIT 1');
    if (plans.rows.length > 0) {
      await db.query(
        `INSERT INTO subscriptions (restaurant_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
         VALUES ($1,$2,'trial','monthly',NOW(),$3)
         ON CONFLICT DO NOTHING`,
        [id, plans.rows[0].id, trialEnd.toISOString()]
      );
    }

    await auditLog(req.user, 'restaurant_approved', 'restaurant', id, {});
    res.json({ message: 'Approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// ── PATCH /api/admin/restaurants/:id/reject ──────────────────
router.patch('/restaurants/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
  try {
    const { rows } = await db.query(
      `UPDATE restaurants SET status='rejected', rejection_reason=$1, approved_by=$2, approved_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING email, name`,
      [reason, req.user.userId, id]
    );
    await auditLog(req.user, 'restaurant_rejected', 'restaurant', id, { reason });
    
    // Simulate Email Dispatch
    if (rows[0]) {
      console.log(`\n[EMAIL DISPATCH SIMULATION]
To: ${rows[0].email}
Subject: Application Rejected - kushinaPOS
Hi ${rows[0].name},
Unfortunately, your application to join kushinaPOS has been rejected.
Reason: ${reason}
`);
    }

    res.json({ message: 'Rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// ── PATCH /api/admin/restaurants/:id/suspend ─────────────────
router.patch('/restaurants/:id/suspend', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { rows } = await db.query('SELECT status FROM restaurants WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    
    const newStatus = rows[0].status === 'suspended' ? 'active' : 'suspended';
    if (newStatus === 'suspended' && !reason) return res.status(400).json({ error: 'Reason required for suspension' });

    await db.query('UPDATE restaurants SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, id]);
    await auditLog(req.user, newStatus === 'suspended' ? 'restaurant_suspended' : 'restaurant_reactivated', 'restaurant', id, { reason: reason || null });
    res.json({ status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── GET /api/admin/payments ───────────────────────────────────
router.get('/payments', async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    const { rows } = await db.query(
      `SELECT pp.*, r.name as restaurant_name, r.email as restaurant_email
       FROM payment_proofs pp
       JOIN restaurants r ON r.id = pp.restaurant_id
       WHERE pp.status = $1
       ORDER BY pp.submitted_at DESC`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── PATCH /api/admin/payments/:id/approve ────────────────────
router.patch('/payments/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const proofRes = await db.query('SELECT * FROM payment_proofs WHERE id=$1', [id]);
    if (!proofRes.rows[0]) return res.status(404).json({ error: 'Not found' });
    const proof = proofRes.rows[0];

    // Mark proof approved
    await db.query(
      `UPDATE payment_proofs SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2`,
      [req.user.userId, id]
    );

    // Clear payment_failed flag on the restaurant
    await db.query(
      `UPDATE restaurants SET payment_failed=false, payment_failed_reason=NULL, grace_period_ends_at=NULL, updated_at=NOW() WHERE id=$1`,
      [proof.restaurant_id]
    );

    // Extend subscription
    if (proof.subscription_id) {
      const subRes = await db.query('SELECT * FROM subscriptions WHERE id=$1', [proof.subscription_id]);
      if (subRes.rows[0]) {
        const sub = subRes.rows[0];
        const newEnd = new Date();
        if (sub.billing_cycle === 'annual') newEnd.setFullYear(newEnd.getFullYear() + 1);
        else newEnd.setMonth(newEnd.getMonth() + 1);

        await db.query(
          `UPDATE subscriptions SET status='active', current_period_start=NOW(), current_period_end=$1, cancel_at_period_end=false, updated_at=NOW() WHERE id=$2`,
          [newEnd.toISOString(), sub.id]
        );
        await db.query("UPDATE restaurants SET status='active', updated_at=NOW() WHERE id=$1", [proof.restaurant_id]);
      }
    }

    await auditLog(req.user, 'payment_approved', 'payment_proof', id, { amount: proof.amount });
    res.json({ message: 'Approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// ── PATCH /api/admin/payments/:id/reject ─────────────────────
router.patch('/payments/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required' });
  try {
    const proofRes = await db.query('SELECT restaurant_id FROM payment_proofs WHERE id=$1', [id]);
    if (!proofRes.rows[0]) return res.status(404).json({ error: 'Not found' });
    const { restaurant_id } = proofRes.rows[0];

    await db.query(
      `UPDATE payment_proofs SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2 WHERE id=$3`,
      [req.user.userId, reason, id]
    );

    // Set payment_failed on restaurant so tenant sees a persistent warning banner
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7-day grace
    await db.query(
      `UPDATE restaurants SET payment_failed=true, payment_failed_reason=$1, grace_period_ends_at=$2, updated_at=NOW() WHERE id=$3`,
      [reason, gracePeriodEnd.toISOString(), restaurant_id]
    );

    // Trigger payment_failed alert to tenant owner
    const { notify } = require('../utils/notifyService');
    await notify({
      restaurant_id,
      type: 'payment_failed',
      title: '🚨 Payment Failure: Verification Rejected',
      message: `Your payment proof was rejected by platform admin. Reason: "${reason}". 7-day grace period active.`,
      target_role: 'owner',
      metadata: { reason, grace_period_ends_at: gracePeriodEnd.toISOString() }
    });

    await auditLog(req.user, 'payment_rejected', 'payment_proof', id, { reason });
    res.json({ message: 'Rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── GET /api/admin/audit-logs ─────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── PLANS CRUD ────────────────────────────────────────────────
router.get('/plans', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM subscription_plans ORDER BY price_monthly');
  res.json(rows);
});

router.post('/plans', async (req, res) => {
  const { name, price_monthly, price_annual, max_staff, max_pos_terminals, features } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO subscription_plans (name, price_monthly, price_annual, max_staff, max_pos_terminals, features)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, price_monthly, price_annual, max_staff, max_pos_terminals, JSON.stringify(features || {})]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

router.patch('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price_monthly, price_annual, max_staff, max_pos_terminals, features } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE subscription_plans SET name=$1, price_monthly=$2, price_annual=$3, max_staff=$4, max_pos_terminals=$5, features=$6
       WHERE id=$7 RETURNING *`,
      [name, price_monthly, price_annual, max_staff, max_pos_terminals, JSON.stringify(features || {}), id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ── POST /api/admin/restaurants/:id/impersonate ────────────────
router.post('/restaurants/:id/impersonate', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM restaurants WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Restaurant not found' });
    const restaurant = rows[0];

    const token = jwt.sign({
      userId: restaurant.id,
      email: restaurant.email,
      role: 'restaurant_owner',
      restaurantId: restaurant.id,
      impersonator_admin_id: req.user.userId
    }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await auditLog(req.user, 'tenant_impersonated', 'restaurant', id, { target_email: restaurant.email });
    
    res.json({ token, user: { id: restaurant.id, email: restaurant.email, name: restaurant.name, role: 'restaurant_owner' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to impersonate' });
  }
});

// ── Helper ──────────────────────────────────────────────────
async function auditLog(user, action, targetType, targetId, metadata) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_admin_id, actor_email, action, target_type, target_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [user.userId, user.email, action, targetType, targetId, JSON.stringify(metadata)]
    );
  } catch (e) { /* non-fatal */ }
}

module.exports = router;
