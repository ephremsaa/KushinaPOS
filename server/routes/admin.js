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

    // Generate sequential invoice number
    const { rows: seqRes } = await db.query("SELECT nextval('subscription_invoice_seq') as seq");
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(seqRes[0]?.seq || '1001').padStart(5, '0')}`;

    // Update unified payments table
    await db.query(
      `UPDATE payments 
       SET status='confirmed', confirmed_by=$1, confirmed_at=NOW(), invoice_number=$2, updated_at=NOW()
       WHERE (subscription_id=$3 AND status='pending') OR id=$4`,
      [req.user.userId, invoiceNumber, proof.subscription_id, id]
    );

    // Extend subscription
    let newEnd = new Date();
    if (proof.subscription_id) {
      const subRes = await db.query('SELECT * FROM subscriptions WHERE id=$1', [proof.subscription_id]);
      if (subRes.rows[0]) {
        const sub = subRes.rows[0];
        if (sub.billing_cycle === 'annual') newEnd.setFullYear(newEnd.getFullYear() + 1);
        else newEnd.setMonth(newEnd.getMonth() + 1);

        await db.query(
          `UPDATE subscriptions SET status='active', current_period_start=NOW(), current_period_end=$1, cancel_at_period_end=false, updated_at=NOW() WHERE id=$2`,
          [newEnd.toISOString(), sub.id]
        );
        await db.query("UPDATE restaurants SET status='active', updated_at=NOW() WHERE id=$1", [proof.restaurant_id]);
        const { invalidatePlanCache } = require('../middleware/planLimits');
        invalidatePlanCache(proof.restaurant_id);
      }
    }

    // Send owner notification with invoice number
    const { notify } = require('../utils/notifyService');
    await notify({
      restaurant_id: proof.restaurant_id,
      type: 'billing',
      title: '🎉 Subscription Payment Approved',
      message: `Your payment of ${proof.amount} ETB has been confirmed! Invoice #${invoiceNumber}. Subscription active until ${newEnd.toLocaleDateString()}.`,
      target_role: 'owner',
      metadata: { invoice_number: invoiceNumber, amount: proof.amount, subscription_id: proof.subscription_id }
    });

    await auditLog(req.user, 'payment_approved', 'payment_proof', id, { amount: proof.amount, invoice_number: invoiceNumber });
    res.json({ message: 'Approved', invoice_number: invoiceNumber });
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

    await db.query(
      `UPDATE payments 
       SET status='rejected', rejected_reason=$1, updated_at=NOW()
       WHERE id=$2 OR (restaurant_id=$3 AND status='pending' AND created_at >= NOW() - INTERVAL '7 days')`,
      [reason, id, restaurant_id]
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

// ── GET /api/admin/leads ──────────────────────────────────────
router.get('/leads', async (req, res) => {
  const { status, search } = req.query;
  try {
    let whereClauses = [];
    let params = [];

    if (status && status !== 'all') {
      params.push(status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (search && String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      whereClauses.push(`(
        name ILIKE $${params.length} 
        OR business_name ILIKE $${params.length} 
        OR phone ILIKE $${params.length} 
        OR COALESCE(email, '') ILIKE $${params.length}
        OR COALESCE(notes, '') ILIKE $${params.length}
      )`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
      SELECT * FROM leads
      ${whereSQL}
      ORDER BY created_at DESC
    `;

    const [leadsRes, countsRes] = await Promise.all([
      db.query(query, params),
      db.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'new')::int as new,
          COUNT(*) FILTER (WHERE status = 'contacted')::int as contacted,
          COUNT(*) FILTER (WHERE status = 'demo booked')::int as demo_booked,
          COUNT(*) FILTER (WHERE status = 'won')::int as won,
          COUNT(*) FILTER (WHERE status = 'lost')::int as lost
        FROM leads
      `)
    ]);

    res.json({
      leads: leadsRes.rows,
      counts: countsRes.rows[0] || {
        total: 0,
        new: 0,
        contacted: 0,
        demo_booked: 0,
        won: 0,
        lost: 0
      }
    });
  } catch (err) {
    console.error('Fetch leads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// ── PATCH /api/admin/leads/:id/status ─────────────────────────
router.patch('/leads/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'contacted', 'demo booked', 'won', 'lost'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const { rows } = await db.query(
      `UPDATE leads 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await auditLog(req.user, 'lead_status_updated', 'lead', id, { new_status: status });

    res.json(rows[0]);
  } catch (err) {
    console.error('Update lead status error:', err);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// ── PATCH /api/admin/leads/:id/notes ──────────────────────────
router.patch('/leads/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE leads 
       SET notes = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [notes, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await auditLog(req.user, 'lead_notes_updated', 'lead', id, { notes_length: notes?.length });

    res.json(rows[0]);
  } catch (err) {
    console.error('Update lead notes error:', err);
    res.status(500).json({ error: 'Failed to update lead notes' });
  }
});

// ── GET /api/admin/leads/export ───────────────────────────────
router.get('/leads/export', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM leads ORDER BY created_at DESC');

    const headers = [
      'ID', 'Name', 'Business Name', 'Phone', 'Email', 'Branches', 
      'Interest', 'Preferred Contact Time', 'Source Page', 'Language', 
      'Status', 'Notes', 'Created At'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(',')];
    for (const lead of rows) {
      csvLines.push([
        escapeCsv(lead.id),
        escapeCsv(lead.name),
        escapeCsv(lead.business_name),
        escapeCsv(lead.phone),
        escapeCsv(lead.email || ''),
        escapeCsv(lead.branches || '1'),
        escapeCsv(lead.interest || ''),
        escapeCsv(lead.preferred_contact_time || ''),
        escapeCsv(lead.source_page || '/'),
        escapeCsv(lead.language || 'en'),
        escapeCsv(lead.status),
        escapeCsv(lead.notes || ''),
        escapeCsv(lead.created_at)
      ].join(','));
    }

    const csvContent = csvLines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kushina_leads_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (err) {
    console.error('Export leads error:', err);
    res.status(500).json({ error: 'Failed to export leads' });
  }
});

// ── Platform Admin Developer & API Oversight Endpoints ───────────

// 1. GET /api/admin/developer-usage - Summary per restaurant
router.get('/developer-usage', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.id as restaurant_id, r.name as restaurant_name, r.status as restaurant_status,
             sp.name as plan_name,
             COUNT(DISTINCT k.id) as total_keys,
             COUNT(DISTINCT CASE WHEN k.is_active AND NOT k.is_suspended_by_admin THEN k.id END) as active_keys,
             COUNT(DISTINCT CASE WHEN k.is_suspended_by_admin THEN k.id END) as suspended_keys,
             COALESCE(SUM(k.request_count), 0) as total_requests,
             MAX(k.last_used_at) as last_api_activity,
             COUNT(DISTINCT w.id) as total_webhooks,
             COUNT(DISTINCT CASE WHEN w.is_active THEN w.id END) as active_webhooks,
             COUNT(DISTINCT CASE WHEN w.auto_disabled_at IS NOT NULL THEN w.id END) as disabled_webhooks,
             COUNT(DISTINCT CASE WHEN wd.status = 'failed' THEN wd.id END) as failed_deliveries
      FROM restaurants r
      LEFT JOIN subscriptions s ON s.restaurant_id = r.id AND s.status IN ('active', 'trial')
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN api_keys k ON k.restaurant_id = r.id
      LEFT JOIN webhooks w ON w.restaurant_id = r.id
      LEFT JOIN webhook_deliveries wd ON wd.restaurant_id = r.id AND wd.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY r.id, r.name, r.status, sp.name
      ORDER BY total_requests DESC, r.name ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Admin developer usage error:', err);
    res.status(500).json({ error: 'Failed to retrieve developer usage' });
  }
});

// 2. GET /api/admin/developer-keys - All API keys across all restaurants
router.get('/developer-keys', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT k.id, k.restaurant_id, r.name as restaurant_name,
             k.name as key_name, k.key_prefix, k.scopes, k.permissions,
             k.is_active, k.is_suspended_by_admin, k.expires_at, k.ip_allowlist,
             k.rate_limit_per_minute, k.request_count, k.last_used_at, k.created_at
      FROM api_keys k
      JOIN restaurants r ON r.id = k.restaurant_id
      ORDER BY k.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Admin developer keys error:', err);
    res.status(500).json({ error: 'Failed to retrieve API keys' });
  }
});

// 3. PATCH /api/admin/developer-keys/:id/suspend - Suspend or reinstate key
router.patch('/developer-keys/:id/suspend', async (req, res) => {
  const keyId = req.params.id;
  const { suspended = true, reason = '' } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE api_keys 
       SET is_suspended_by_admin = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, name, key_prefix, restaurant_id, is_suspended_by_admin`,
      [Boolean(suspended), keyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const key = rows[0];

    await auditLog(
      req.user,
      suspended ? 'api_key_admin_suspended' : 'api_key_admin_reinstated',
      'api_key',
      keyId,
      { restaurant_id: key.restaurant_id, key_name: key.name, reason }
    );

    res.json({
      message: suspended ? 'API key suspended by admin' : 'API key reinstated',
      key
    });
  } catch (err) {
    console.error('Admin key suspend error:', err);
    res.status(500).json({ error: 'Failed to update key suspension status' });
  }
});

// 4. GET /api/admin/developer-webhooks/failures - Failed delivery logs
router.get('/developer-webhooks/failures', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT wd.id, wd.webhook_id, wd.restaurant_id, r.name as restaurant_name,
             w.name as webhook_name, w.url, wd.event, wd.status_code, wd.status,
             wd.attempts, wd.max_attempts, wd.error_message, wd.response_body,
             wd.duration_ms, wd.created_at, wd.updated_at
      FROM webhook_deliveries wd
      JOIN restaurants r ON r.id = wd.restaurant_id
      JOIN webhooks w ON w.id = wd.webhook_id
      WHERE wd.status IN ('failed', 'retrying')
      ORDER BY wd.updated_at DESC
      LIMIT 100
    `);

    res.json(rows);
  } catch (err) {
    console.error('Admin webhook failures error:', err);
    res.status(500).json({ error: 'Failed to retrieve webhook failure logs' });
  }
});

// 5. GET /api/admin/developer-integrations/requests - Integration lead requests
router.get('/developer-integrations/requests', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM integration_requests ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Admin integration requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve integration requests' });
  }
});

// 6. PATCH /api/admin/developer-integrations/requests/:id/status
router.patch('/developer-integrations/requests/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['new', 'contacted', 'planned', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { rows } = await db.query(
      `UPDATE integration_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update integration status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
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
