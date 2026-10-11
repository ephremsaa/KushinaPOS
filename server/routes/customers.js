const express = require('express');
const { Parser } = require('json2csv');
const db = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const { verifyManagerPin } = require('../utils/pinHelper');
const { recordLoyaltyTransaction } = require('../utils/loyaltyLedger');
const { logAudit } = require('../utils/auditLogger');
const { sendMessage, checkDailyMarketingLimit } = require('../utils/messagingService');

const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// Helper: Normalize Ethiopian phone number (+251...)
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('09') && digits.length === 10) return '+251' + digits.slice(1);
  if (digits.startsWith('07') && digits.length === 10) return '+251' + digits.slice(1);
  if (digits.startsWith('9') && digits.length === 9) return '+251' + digits;
  if (digits.startsWith('7') && digits.length === 9) return '+251' + digits;
  if (digits.startsWith('251') && digits.length === 12) return '+' + digits;
  if (digits.length >= 9 && digits.length <= 15) return '+' + digits;
  return null;
}

// ── GET /api/customers ─────────────────────────────────────────
// List, search, filter segments, and sort customers
router.get('/', async (req, res) => {
  const {
    q = '',
    segment = 'all', // 'all' | 'new' | 'regular' | 'inactive_30d' | 'consented'
    sort = 'spend_desc', // 'spend_desc' | 'visit_desc' | 'name_asc' | 'points_desc'
    limit = 100,
    offset = 0
  } = req.query;

  try {
    const rId = tid(req);
    let whereClause = `WHERE restaurant_id = $1 AND is_anonymized = false`;
    const params = [rId];

    if (q) {
      whereClause += ` AND (name ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
      params.push(`%${q.trim()}%`);
    }

    if (segment === 'new') {
      whereClause += ` AND created_at >= NOW() - interval '30 days' AND order_count <= 1`;
    } else if (segment === 'regular') {
      whereClause += ` AND (order_count >= 3 OR total_visits >= 3)`;
    } else if (segment === 'inactive_30d') {
      whereClause += ` AND (last_visit_at < NOW() - interval '30 days' OR (last_visit_at IS NULL AND created_at < NOW() - interval '30 days'))`;
    } else if (segment === 'consented') {
      whereClause += ` AND marketing_consent = true`;
    }

    let orderBy = 'total_spent DESC, created_at DESC';
    if (sort === 'visit_desc') orderBy = 'last_visit_at DESC NULLS LAST, created_at DESC';
    if (sort === 'name_asc') orderBy = 'name ASC';
    if (sort === 'points_desc') orderBy = 'points DESC, total_spent DESC';

    const countQuery = `SELECT COUNT(*) as total FROM customers ${whereClause}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const totalCount = parseInt(countRows[0]?.total || 0, 10);

    const dataQuery = `
      SELECT id, name, phone, email, birthday, notes, points, stamps, tier, 
             total_spent, total_visits, order_count, marketing_consent, 
             last_visit_at, created_at, updated_at
      FROM customers
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(Math.min(200, parseInt(limit, 10) || 50), Math.max(0, parseInt(offset, 10) || 0));

    const { rows: customers } = await db.query(dataQuery, params);

    // Segment summary counts for tabs
    const { rows: segmentCounts } = await db.query(`
      SELECT
        COUNT(*) as total_all,
        COUNT(CASE WHEN created_at >= NOW() - interval '30 days' AND order_count <= 1 THEN 1 END) as total_new,
        COUNT(CASE WHEN order_count >= 3 OR total_visits >= 3 THEN 1 END) as total_regular,
        COUNT(CASE WHEN last_visit_at < NOW() - interval '30 days' OR (last_visit_at IS NULL AND created_at < NOW() - interval '30 days') THEN 1 END) as total_inactive,
        COUNT(CASE WHEN marketing_consent = true THEN 1 END) as total_consented
      FROM customers
      WHERE restaurant_id = $1 AND is_anonymized = false
    `, [rId]);

    res.json({
      customers,
      total: totalCount,
      segments: {
        all: parseInt(segmentCounts[0]?.total_all || 0, 10),
        new: parseInt(segmentCounts[0]?.total_new || 0, 10),
        regular: parseInt(segmentCounts[0]?.total_regular || 0, 10),
        inactive_30d: parseInt(segmentCounts[0]?.total_inactive || 0, 10),
        consented: parseInt(segmentCounts[0]?.total_consented || 0, 10)
      }
    });
  } catch (err) {
    console.error('List customers error:', err);
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

// ── GET /api/customers/export ──────────────────────────────────
// Export customer database to CSV (Owner and Manager only)
router.get('/export', async (req, res) => {
  const role = req.user.role === 'restaurant_owner' ? 'owner' : (req.user.staffRole || req.user.role);
  if (!['owner', 'manager', 'platform_admin'].includes(role)) {
    return res.status(403).json({ error: 'Exporting customer data is restricted to owners and managers.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT name, phone, email, birthday, points, stamps, tier, total_spent, 
              order_count, total_visits, marketing_consent, last_visit_at, created_at, notes
       FROM customers 
       WHERE restaurant_id = $1 AND is_anonymized = false 
       ORDER BY total_spent DESC`,
      [tid(req)]
    );

    const parser = new Parser({
      fields: [
        'name', 'phone', 'email', 'birthday', 'points', 'stamps', 'tier',
        'total_spent', 'order_count', 'marketing_consent', 'last_visit_at', 'created_at', 'notes'
      ]
    });
    const csv = parser.parse(rows);

    await logAudit(null, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'customer_database_exported_csv',
      targetType: 'customer',
      metadata: { rowCount: rows.length }
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`customers_${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('Customer export error:', err);
    res.status(500).json({ error: 'Failed to export customer CSV' });
  }
});

// ── GET /api/customers/:id ─────────────────────────────────────
// Detailed customer profile, order history, and loyalty ledger
router.get('/:id', async (req, res) => {
  try {
    const { rows: custRows } = await db.query(
      `SELECT * FROM customers WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, tid(req)]
    );

    if (!custRows[0]) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = custRows[0];

    // Order history
    const { rows: orders } = await db.query(
      `SELECT id, local_id, order_type, order_source, status, subtotal, total, 
              payment_status, payment_method, loyalty_points_redeemed, loyalty_discount, 
              created_at
       FROM orders 
       WHERE customer_id = $1 AND restaurant_id = $2 
       ORDER BY created_at DESC LIMIT 30`,
      [customer.id, tid(req)]
    );

    // Loyalty ledger transactions
    const { rows: loyaltyHistory } = await db.query(
      `SELECT lt.*, s.name as staff_name 
       FROM loyalty_transactions lt
       LEFT JOIN staff s ON s.id = lt.staff_id
       WHERE lt.customer_id = $1 AND lt.restaurant_id = $2 
       ORDER BY lt.created_at DESC LIMIT 50`,
      [customer.id, tid(req)]
    );

    res.json({
      customer,
      orders,
      loyalty_history: loyaltyHistory
    });
  } catch (err) {
    console.error('Get customer details error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer details' });
  }
});

// ── POST /api/customers ────────────────────────────────────────
// Create or quick-create customer
router.post('/', async (req, res) => {
  const {
    name,
    phone,
    email,
    birthday,
    notes,
    marketing_consent = false
  } = req.body;

  const trimmedName = String(name || '').trim().slice(0, 100);
  const normalized = normalizePhone(phone);

  if (!trimmedName) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!normalized) {
    return res.status(400).json({ error: 'Valid Ethiopian phone number (+251...) is required' });
  }

  const cleanEmail = email ? String(email).trim().toLowerCase().slice(0, 100) : null;
  const cleanBirthday = birthday ? String(birthday).trim().slice(0, 10) : null;
  const cleanNotes = notes ? String(notes).trim().slice(0, 500) : null;

  try {
    const existing = await db.query(
      `SELECT * FROM customers WHERE restaurant_id = $1 AND phone = $2`,
      [tid(req), normalized]
    );

    if (existing.rows[0]) {
      const updated = await db.query(
        `UPDATE customers 
         SET name = $1, 
             email = COALESCE($2, email), 
             birthday = COALESCE($3, birthday),
             notes = COALESCE($4, notes),
             marketing_consent = COALESCE($5, marketing_consent),
             updated_at = NOW() 
         WHERE id = $6 AND restaurant_id = $7 
         RETURNING *`,
        [trimmedName, cleanEmail, cleanBirthday, cleanNotes, marketing_consent === true, existing.rows[0].id, tid(req)]
      );
      return res.json({ message: 'Customer updated successfully', customer: updated.rows[0], ...updated.rows[0] });
    }

    const { rows } = await db.query(
      `INSERT INTO customers 
        (restaurant_id, name, phone, email, birthday, notes, marketing_consent, points, stamps, tier, total_spent, total_visits, order_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 'Bronze', 0, 0, 0)
       RETURNING *`,
      [tid(req), trimmedName, normalized, cleanEmail, cleanBirthday, cleanNotes, marketing_consent === true]
    );

    res.status(201).json({ message: 'Customer created successfully', customer: rows[0], ...rows[0] });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer record' });
  }
});

// ── PATCH /api/customers/:id ───────────────────────────────────
// Update customer profile
router.patch('/:id', async (req, res) => {
  const { name, email, birthday, notes, marketing_consent } = req.body;

  try {
    const sets = [];
    const params = [req.params.id, tid(req)];

    if (name !== undefined) {
      sets.push(`name = $${params.length + 1}`);
      params.push(String(name).trim().slice(0, 100));
    }
    if (email !== undefined) {
      sets.push(`email = $${params.length + 1}`);
      params.push(email ? String(email).trim().toLowerCase().slice(0, 100) : null);
    }
    if (birthday !== undefined) {
      sets.push(`birthday = $${params.length + 1}`);
      params.push(birthday ? String(birthday).trim().slice(0, 10) : null);
    }
    if (notes !== undefined) {
      sets.push(`notes = $${params.length + 1}`);
      params.push(notes ? String(notes).trim().slice(0, 500) : null);
    }
    if (marketing_consent !== undefined) {
      sets.push(`marketing_consent = $${params.length + 1}`);
      params.push(marketing_consent === true);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    sets.push('updated_at = NOW()');

    const { rows } = await db.query(
      `UPDATE customers SET ${sets.join(', ')} WHERE id = $1 AND restaurant_id = $2 RETURNING *`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer updated successfully', customer: rows[0], ...rows[0] });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// ── POST /api/customers/:id/adjust-points ──────────────────────
// Manual points adjustment (requires manager PIN and reason)
router.post('/:id/adjust-points', async (req, res) => {
  const { points_delta, points, reason, manager_pin } = req.body;
  const rawPoints = points_delta !== undefined ? points_delta : points;
  const delta = parseInt(rawPoints, 10);

  if (isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: 'Valid non-zero integer points_delta is required' });
  }

  const cleanReason = String(reason || '').trim().slice(0, 200);
  if (!cleanReason) {
    return res.status(400).json({ error: 'A reason is required for manual loyalty adjustments' });
  }

  // Manager PIN check: required for all manual points adjustments
  if (!manager_pin) {
    return res.status(403).json({ error: 'Manager PIN is required for manual points adjustment' });
  }
  const pinCheck = await verifyManagerPin(tid(req), manager_pin);
  if (!pinCheck.authorized) {
    return res.status(403).json({ error: 'Invalid Manager PIN' });
  }
  const verifiedStaffId = pinCheck.staff?.id || req.user.userId || req.user.id;
  const isVerifiedStaffUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verifiedStaffId);
  const staffIdForTx = isVerifiedStaffUuid ? verifiedStaffId : null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const result = await recordLoyaltyTransaction(client, {
      restaurantId: tid(req),
      customerId: req.params.id,
      orderId: null,
      type: 'adjust',
      points: delta,
      staffId: staffIdForTx,
      note: cleanReason
    });

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: staffIdForTx,
      action: 'customer_loyalty_adjust',
      targetType: 'customer',
      targetId: req.params.id,
      metadata: {
        points_delta: delta,
        previous_balance: result.previousBalance,
        new_balance: result.newBalance,
        reason: cleanReason
      }
    });

    await client.query('COMMIT');
    res.json({
      message: 'Points adjusted successfully',
      previous_balance: result.previousBalance,
      new_balance: result.newBalance,
      tier: result.tier,
      transaction: result.transaction
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Adjust points error:', err);
    res.status(err.message?.includes('cannot go below 0') ? 400 : 500).json({
      error: err.message || 'Failed to adjust customer points'
    });
  } finally {
    client.release();
  }
});

// ── Anonymize customer data (Privacy Compliance - Owner/Manager) ──
const handleAnonymize = async (req, res) => {
  const role = req.user.role === 'restaurant_owner' ? 'owner' : (req.user.staffRole || req.user.role);
  if (!['owner', 'manager', 'platform_admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners and managers can anonymize customer data' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: custRows } = await client.query(
      `SELECT id, name, phone FROM customers WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, tid(req)]
    );

    if (!custRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query(
      `UPDATE customers 
       SET name = 'Anonymized Customer',
           phone = NULL,
           email = NULL,
           birthday = NULL,
           notes = NULL,
           marketing_consent = FALSE,
           is_anonymized = TRUE,
           updated_at = NOW() 
       WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, tid(req)]
    );

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'customer_anonymized_privacy',
      targetType: 'customer',
      targetId: req.params.id
    });

    await client.query('COMMIT');
    res.json({ message: 'Customer successfully anonymized in compliance with privacy regulations.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Anonymize customer error:', err);
    res.status(500).json({ error: 'Failed to anonymize customer' });
  } finally {
    client.release();
  }
};
router.post('/:id/anonymize', handleAnonymize);
router.patch('/:id/anonymize', handleAnonymize);

// ── DELETE /api/customers/:id ──────────────────────────────────
// Privacy: Delete customer record (Owner only)
router.delete('/:id', async (req, res) => {
  const role = req.user.role === 'restaurant_owner' ? 'owner' : (req.user.staffRole || req.user.role);
  if (role !== 'owner' && role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only the restaurant owner can permanently delete customer records' });
  }

  try {
    const { rowCount } = await db.query(
      `DELETE FROM customers WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, tid(req)]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Customer not found' });

    await logAudit(null, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'customer_deleted_permanent',
      targetType: 'customer',
      targetId: req.params.id
    });

    res.json({ message: 'Customer record deleted permanently' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ── Marketing campaign handlers ────────────────────────────────
const handleCampaign = async (req, res) => {
  const { title, channel = 'manual', segment = 'all', message, message_text } = req.body;
  const rawText = message_text || message;
  const cleanTitle = String(title || '').trim().slice(0, 100);
  const cleanMsg = String(rawText || '').trim().slice(0, 500);

  if (!cleanTitle) return res.status(400).json({ error: 'Campaign title is required' });
  if (!cleanMsg) return res.status(400).json({ error: 'Message text is required' });

  try {
    // 1. Check daily marketing limit
    const limitInfo = await checkDailyMarketingLimit(tid(req));
    if (limitInfo.isLimitReached) {
      return res.status(429).json({
        error: `Daily marketing limit reached (${limitInfo.sentToday}/${limitInfo.limit} messages sent today). Please try again tomorrow.`
      });
    }

    // 2. Fetch consented recipients
    let whereClause = `WHERE restaurant_id = $1 AND marketing_consent = true AND is_anonymized = false`;
    if (segment === 'regular') whereClause += ` AND (order_count >= 3 OR total_visits >= 3)`;
    if (segment === 'inactive_30d') whereClause += ` AND (last_visit_at < NOW() - interval '30 days')`;

    const { rows: recipients } = await db.query(
      `SELECT id, name, phone FROM customers ${whereClause} LIMIT $2`,
      [tid(req), limitInfo.remaining]
    );

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'No consented customers found in the selected segment. Only customers with marketing consent enabled can be messaged.'
      });
    }

    // 3. Prepare messages through provider-neutral interface
    const processedMessages = await Promise.all(
      recipients.slice(0, 20).map(r => sendMessage(channel, r.phone, cleanMsg))
    );

    const actorUserId = req.user.userId || req.user.id;
    const isActorUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorUserId);

    // 4. Log campaign
    const { rows: campRows } = await db.query(
      `INSERT INTO marketing_campaigns 
        (restaurant_id, title, channel, target_segment, recipient_count, message_text, sent_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        tid(req),
        cleanTitle,
        channel,
        segment,
        recipients.length,
        cleanMsg,
        (req.user.role === 'staff' && isActorUuid) ? actorUserId : null
      ]
    );

    await logAudit(null, {
      restaurantId: tid(req),
      actorUserId: isActorUuid ? actorUserId : null,
      action: 'marketing_campaign_created',
      targetType: 'campaign',
      targetId: campRows[0].id,
      metadata: { recipient_count: recipients.length, channel, segment }
    });

    const dispatches = recipients.map(r => ({ customer_id: r.id, id: r.id, name: r.name, phone: r.phone }));

    res.status(200).json({
      message: 'Campaign dispatched successfully',
      campaign: campRows[0],
      recipient_count: recipients.length,
      sample_preview: processedMessages,
      dispatches,
      recipients: dispatches
    });
  } catch (err) {
    console.error('Marketing campaign error:', err);
    res.status(500).json({ error: 'Failed to process marketing campaign' });
  }
};

const handleGetCampaigns = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, s.name as staff_name 
       FROM marketing_campaigns c
       LEFT JOIN staff s ON s.id = c.sent_by
       WHERE c.restaurant_id = $1 
       ORDER BY c.created_at DESC LIMIT 30`,
      [tid(req)]
    );
    const limitInfo = await checkDailyMarketingLimit(tid(req));
    res.json({ campaigns: rows, limitInfo });
  } catch (err) {
    console.error('List marketing campaigns error:', err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
};

router.post('/marketing/campaign', handleCampaign);
router.post('/marketing/campaigns', handleCampaign);
router.post('/campaigns', handleCampaign);
router.get('/marketing/campaigns', handleGetCampaigns);
router.get('/campaigns', handleGetCampaigns);

module.exports = { router, normalizePhone };
