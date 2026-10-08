const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// Multer setup — save to server/uploads/payment-proofs/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/payment-proofs')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ── GET /api/billing/subscription ────────────────────────────
router.get('/subscription', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_annual,
              sp.max_staff, sp.max_pos_terminals, sp.features
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.restaurant_id=$1
       ORDER BY s.created_at DESC LIMIT 1`,
      [tid(req)]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── GET /api/billing/usage ────────────────────────────────────
// Returns current plan + live usage meters
router.get('/usage', async (req, res) => {
  try {
    // Get subscription + plan
    const subRes = await db.query(
      `SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_annual,
              sp.max_staff, sp.max_pos_terminals, sp.features
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.restaurant_id=$1
       ORDER BY s.created_at DESC LIMIT 1`,
      [tid(req)]
    );
    const sub = subRes.rows[0] || null;

    // Active staff count
    const staffRes = await db.query(
      'SELECT COUNT(*) FROM staff WHERE restaurant_id=$1 AND is_active=true',
      [tid(req)]
    );
    const staff_count = parseInt(staffRes.rows[0].count, 10);

    // Restaurant payment_failed state
    const restRes = await db.query(
      'SELECT payment_failed, payment_failed_reason, grace_period_ends_at FROM restaurants WHERE id=$1',
      [tid(req)]
    );
    const rest = restRes.rows[0] || {};

    res.json({
      subscription: sub,
      usage: {
        staff_count,
        // branches: 1  (multi-branch not yet implemented)
      },
      payment_failed: rest.payment_failed || false,
      payment_failed_reason: rest.payment_failed_reason || null,
      grace_period_ends_at: rest.grace_period_ends_at || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// ── GET /api/billing/proofs ───────────────────────────────────
router.get('/proofs', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM payment_proofs WHERE restaurant_id=$1 ORDER BY submitted_at DESC`,
      [tid(req)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── POST /api/billing/proofs ──────────────────────────────────
router.post('/proofs', requireOwner, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Screenshot image is required' });
  const { amount, payment_method = 'telebirr', note, subscription_id, reference_number } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  const screenshotUrl = `/uploads/payment-proofs/${req.file.filename}`;

  try {
    const subResult = await db.query(
      'SELECT id FROM subscriptions WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tid(req)]
    );
    const subId = subscription_id || subResult.rows[0]?.id || null;

    const { rows } = await db.query(
      `INSERT INTO payment_proofs
         (restaurant_id, subscription_id, amount, currency, payment_method, reference_number, screenshot_url, note, status)
       VALUES ($1,$2,$3,'ETB',$4,$5,$6,$7,'pending') RETURNING *`,
      [tid(req), subId, amount, payment_method, reference_number || null, screenshotUrl, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit payment proof' });
  }
});

// ── POST /api/billing/subscribe ───────────────────────────────
// Creates the FIRST subscription for a restaurant that has none.
// Idempotent: if a subscription already exists, returns it unchanged.
router.post('/subscribe', requireOwner, async (req, res) => {
  const { plan_id, billing_cycle = 'monthly' } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' });

  try {
    // Verify plan exists and is active
    const planRes = await db.query(
      'SELECT * FROM subscription_plans WHERE id=$1 AND is_active=true',
      [plan_id]
    );
    if (!planRes.rows[0]) return res.status(404).json({ error: 'Plan not found' });

    // Idempotency: if a subscription already exists, just return it
    const existing = await db.query(
      'SELECT s.*, sp.name as plan_name FROM subscriptions s JOIN subscription_plans sp ON sp.id=s.plan_id WHERE s.restaurant_id=$1 ORDER BY s.created_at DESC LIMIT 1',
      [tid(req)]
    );
    if (existing.rows[0]) return res.json(existing.rows[0]);

    // Calculate trial end (14 days)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Calculate period end based on billing cycle
    const periodEnd = new Date(trialEndsAt);
    if (billing_cycle === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const { rows } = await db.query(
      `INSERT INTO subscriptions
         (restaurant_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
       VALUES ($1, $2, 'trial', $3, NOW(), $4)
       RETURNING *`,
      [tid(req), plan_id, billing_cycle, periodEnd]
    );

    res.status(201).json({ ...rows[0], plan_name: planRes.rows[0].name });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// ── GET /api/billing/plans ────────────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM subscription_plans WHERE is_active=true ORDER BY price_monthly'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── POST /api/billing/upgrade ─────────────────────────────────
// Change plan immediately — restaurant must then submit new payment proof
router.post('/upgrade', requireOwner, async (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' });

  try {
    // Verify plan exists
    const planRes = await db.query('SELECT * FROM subscription_plans WHERE id=$1 AND is_active=true', [plan_id]);
    if (!planRes.rows[0]) return res.status(404).json({ error: 'Plan not found' });

    // Get current subscription
    const subRes = await db.query(
      'SELECT id FROM subscriptions WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tid(req)]
    );
    if (!subRes.rows[0]) return res.status(404).json({ error: 'No subscription found' });

    const { rows } = await db.query(
      `UPDATE subscriptions SET plan_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [plan_id, subRes.rows[0].id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

// ── POST /api/billing/cancel ──────────────────────────────────
// Cancel at end of billing period (safe default)
router.post('/cancel', requireOwner, async (req, res) => {
  const { reason = '', immediate = false } = req.body;
  try {
    const subRes = await db.query(
      'SELECT id, current_period_end FROM subscriptions WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tid(req)]
    );
    if (!subRes.rows[0]) return res.status(404).json({ error: 'No subscription found' });

    const updates = immediate
      ? `status='cancelled', cancel_at_period_end=true, cancelled_at=NOW(), cancellation_reason=$2, updated_at=NOW()`
      : `cancel_at_period_end=true, cancellation_reason=$2, updated_at=NOW()`;

    const { rows } = await db.query(
      `UPDATE subscriptions SET ${updates} WHERE id=$1 RETURNING *`,
      [subRes.rows[0].id, reason]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ── POST /api/billing/reactivate ─────────────────────────────
// Clear cancel_at_period_end if still within active period
router.post('/reactivate', requireOwner, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE subscriptions SET cancel_at_period_end=false, cancellation_reason=NULL, updated_at=NOW()
       WHERE restaurant_id=$1 AND status != 'cancelled'
       RETURNING *`,
      [tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No active subscription to reactivate' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reactivate' });
  }
});

module.exports = router;
