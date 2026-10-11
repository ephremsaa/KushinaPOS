const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planLimits');
const { validateWebhookUrl } = require('../utils/ssrfValidator');
const { deliverWebhookPayload } = require('../jobs/webhookDispatcher');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

const ALLOWED_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.paid',
  'payment.confirmed'
];

// All webhook management routes require authentication, tenant context, owner role, and plan feature 'api_access'
router.use(authenticate, requireTenant, requireOwner, requirePlanFeature('api_access'));

// ── GET /api/webhook-endpoints ──────────────────────────────────
router.get('/', async (req, res) => {
  const restaurantId = req.user.restaurantId;

  try {
    const { rows } = await db.query(
      `SELECT id, name, url, secret, events, is_active, failure_count, 
              max_failures, auto_disabled_at, last_delivered_at, created_at, updated_at
       FROM webhooks
       WHERE restaurant_id = $1
       ORDER BY created_at DESC`,
      [restaurantId]
    );

    res.json(rows);
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({ error: 'Failed to load webhooks' });
  }
});

// ── POST /api/webhook-endpoints ─────────────────────────────────
router.post('/', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const name = String(req.body.name || 'Webhook Endpoint').trim().slice(0, 80);
  const rawUrl = String(req.body.url || '').trim();
  const rawEvents = Array.isArray(req.body.events) ? req.body.events : ['order.created', 'order.paid'];

  if (!rawUrl) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }

  // SSRF and protocol validation
  const ssrfCheck = await validateWebhookUrl(rawUrl);
  if (!ssrfCheck.isValid) {
    return res.status(400).json({
      error: `Invalid webhook URL: ${ssrfCheck.reason}`,
      code: 'SSRF_VALIDATION_FAILED'
    });
  }

  // Events validation
  const validEvents = rawEvents.filter(e => ALLOWED_EVENTS.includes(e));
  if (validEvents.length === 0) {
    return res.status(400).json({
      error: `At least one valid event is required. Allowed events: ${ALLOWED_EVENTS.join(', ')}`
    });
  }

  // Generate per-webhook signing secret: whsec_...
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  try {
    const { rows } = await db.query(
      `INSERT INTO webhooks (restaurant_id, name, url, secret, events, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [restaurantId, name, rawUrl, secret, validEvents]
    );

    const webhook = rows[0];

    // Audit log
    await logAudit(db, {
      restaurant_id: restaurantId,
      actor_user_id: req.user.userId || req.user.id,
      actor_email: req.user.email,
      action: 'webhook_create',
      target_type: 'webhook',
      target_id: webhook.id,
      metadata: { name, url: rawUrl, events: validEvents }
    });

    res.status(201).json(webhook);
  } catch (err) {
    console.error('Create webhook error:', err);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// ── PATCH /api/webhook-endpoints/:id ────────────────────────────
router.patch('/:id', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const webhookId = req.params.id;
  const { name, url, events: rawEvents, is_active } = req.body;

  try {
    const { rows: existing } = await db.query(
      `SELECT * FROM webhooks WHERE id = $1 AND restaurant_id = $2`,
      [webhookId, restaurantId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updates = [];
    const params = [webhookId, restaurantId];

    if (name !== undefined) {
      params.push(String(name).trim().slice(0, 80));
      updates.push(`name = $${params.length}`);
    }

    if (url !== undefined) {
      const trimmedUrl = String(url).trim();
      const ssrfCheck = await validateWebhookUrl(trimmedUrl);
      if (!ssrfCheck.isValid) {
        return res.status(400).json({
          error: `Invalid webhook URL: ${ssrfCheck.reason}`,
          code: 'SSRF_VALIDATION_FAILED'
        });
      }
      params.push(trimmedUrl);
      updates.push(`url = $${params.length}`);
    }

    if (rawEvents !== undefined) {
      const validEvents = Array.isArray(rawEvents) ? rawEvents.filter(e => ALLOWED_EVENTS.includes(e)) : [];
      if (validEvents.length === 0) {
        return res.status(400).json({ error: 'At least one event must be selected' });
      }
      params.push(validEvents);
      updates.push(`events = $${params.length}`);
    }

    if (is_active !== undefined) {
      const activeBool = Boolean(is_active);
      params.push(activeBool);
      updates.push(`is_active = $${params.length}`);
      if (activeBool) {
        // If re-enabling, reset failure count and auto_disabled timestamp
        updates.push(`failure_count = 0, auto_disabled_at = NULL`);
      }
    }

    if (updates.length === 0) {
      return res.json(existing[0]);
    }

    updates.push('updated_at = NOW()');

    const { rows } = await db.query(
      `UPDATE webhooks 
       SET ${updates.join(', ')} 
       WHERE id = $1 AND restaurant_id = $2 
       RETURNING *`,
      params
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Update webhook error:', err);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// ── POST /api/webhook-endpoints/:id/rotate-secret ───────────────
router.post('/:id/rotate-secret', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const webhookId = req.params.id;

  try {
    const newSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const { rows } = await db.query(
      `UPDATE webhooks 
       SET secret = $1, updated_at = NOW() 
       WHERE id = $2 AND restaurant_id = $3 
       RETURNING id, name, url, secret, events, is_active, updated_at`,
      [newSecret, webhookId, restaurantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Audit log
    await logAudit(db, {
      restaurant_id: restaurantId,
      actor_user_id: req.user.userId || req.user.id,
      actor_email: req.user.email,
      action: 'webhook_rotate_secret',
      target_type: 'webhook',
      target_id: webhookId,
      metadata: { webhook_name: rows[0].name }
    });

    res.json({
      webhook: rows[0],
      message: 'Signing secret rotated successfully. Update your signature verification code.'
    });
  } catch (err) {
    console.error('Rotate webhook secret error:', err);
    res.status(500).json({ error: 'Failed to rotate secret' });
  }
});

// ── POST /api/webhook-endpoints/:id/test ────────────────────────
router.post('/:id/test', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const webhookId = req.params.id;

  try {
    const { rows: whRows } = await db.query(
      `SELECT * FROM webhooks WHERE id = $1 AND restaurant_id = $2`,
      [webhookId, restaurantId]
    );

    if (whRows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const wh = whRows[0];

    // Create a mock test payload
    const testPayload = {
      event: 'order.created',
      data: {
        order_id: crypto.randomUUID(),
        order_number: 101,
        total: 450.00,
        status: 'pending',
        items: [
          { name: 'Special Tibs', qty: 2, price: 200.00 },
          { name: 'Traditional Coffee', qty: 1, price: 50.00 }
        ],
        is_test_ping: true,
        created_at: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    const { rows: delRows } = await db.query(
      `INSERT INTO webhook_deliveries 
        (webhook_id, restaurant_id, event, payload, status, attempts, max_attempts)
       VALUES ($1, $2, 'order.created', $3, 'retrying', 1, 3)
       RETURNING id`,
      [wh.id, restaurantId, JSON.stringify(testPayload)]
    );

    const deliveryId = delRows[0].id;

    // Execute delivery synchronously to give immediate feedback to user
    const success = await deliverWebhookPayload(deliveryId);

    // Fetch the updated delivery result
    const { rows: resultRows } = await db.query(
      `SELECT * FROM webhook_deliveries WHERE id = $1`,
      [deliveryId]
    );

    const delivery = resultRows[0];

    res.json({
      success,
      delivery,
      message: success 
        ? 'Test event delivered successfully with HTTP ' + delivery.status_code 
        : 'Test event delivery failed: ' + (delivery.error_message || 'HTTP ' + delivery.status_code)
    });
  } catch (err) {
    console.error('Test webhook error:', err);
    res.status(500).json({ error: 'Failed to send test webhook delivery' });
  }
});

// ── DELETE /api/webhook-endpoints/:id ───────────────────────────
router.delete('/:id', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const webhookId = req.params.id;

  try {
    const { rows } = await db.query(
      `DELETE FROM webhooks WHERE id = $1 AND restaurant_id = $2 RETURNING id, name, url`,
      [webhookId, restaurantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await logAudit(db, {
      restaurant_id: restaurantId,
      actor_user_id: req.user.userId || req.user.id,
      actor_email: req.user.email,
      action: 'webhook_delete',
      target_type: 'webhook',
      target_id: webhookId,
      metadata: { name: rows[0].name, url: rows[0].url }
    });

    res.json({ message: 'Webhook endpoint deleted successfully' });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// ── GET /api/webhook-endpoints/:id/deliveries ───────────────────
router.get('/:id/deliveries', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const webhookId = req.params.id;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  try {
    const { rows } = await db.query(
      `SELECT id, webhook_id, event, status_code, status, attempts, max_attempts,
              next_retry_at, error_message, duration_ms, payload, response_body, created_at, updated_at
       FROM webhook_deliveries
       WHERE webhook_id = $1 AND restaurant_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [webhookId, restaurantId, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Failed to load delivery logs' });
  }
});

// ── POST /api/webhook-endpoints/deliveries/:deliveryId/retry ────
router.post('/deliveries/:deliveryId/retry', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const deliveryId = req.params.deliveryId;

  try {
    const { rows } = await db.query(
      `SELECT d.*, w.is_active 
       FROM webhook_deliveries d
       JOIN webhooks w ON w.id = d.webhook_id
       WHERE d.id = $1 AND d.restaurant_id = $2`,
      [deliveryId, restaurantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Delivery log not found' });
    }

    const success = await deliverWebhookPayload(deliveryId);

    const { rows: updatedRows } = await db.query(
      `SELECT * FROM webhook_deliveries WHERE id = $1`,
      [deliveryId]
    );

    res.json({
      success,
      delivery: updatedRows[0],
      message: success ? 'Retry delivered successfully' : 'Retry delivery failed'
    });
  } catch (err) {
    console.error('Retry delivery error:', err);
    res.status(500).json({ error: 'Failed to retry delivery' });
  }
});

module.exports = router;
