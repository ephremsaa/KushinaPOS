const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { instantiateAdapter } = require('../adapters');
const { decryptCredentials } = require('../utils/paymentCrypto');
const { logAudit } = require('../utils/auditLogger');
const { awardPointsForPaidOrder } = require('../utils/loyaltyLedger');

const router = express.Router();

/**
 * Unified Payment Webhook Endpoint
 * Handles automated callbacks from Telebirr, CBE Birr, Chapa, and Sandbox
 * Ensures idempotency, cryptographic verification, and amount/currency validation.
 */
router.post('/payments/:provider', async (req, res) => {
  const { provider } = req.params;
  const signature = req.headers['x-chapa-signature'] ||
                    req.headers['x-signature'] ||
                    req.headers['signature'] ||
                    req.body?.signature;

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const payload = req.body || {};

  // Extract or compute a deterministic event ID
  const eventId = req.headers['x-event-id'] ||
                  payload.eventId ||
                  payload.event_id ||
                  payload.id ||
                  payload.tx_ref ||
                  payload.transactionNo ||
                  payload.reference ||
                  crypto.createHash('sha256').update(rawBody).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Idempotency check: if event already processed, answer immediately 200 OK
    const { rows: existingLogs } = await client.query(
      `SELECT id, status FROM payment_webhook_logs WHERE provider = $1 AND event_id = $2`,
      [provider, String(eventId)]
    );

    if (existingLogs.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json({ status: 'already_processed', message: 'Webhook already handled' });
    }

    // 2. Locate payment in DB by reference or provider reference
    const candidateRef = payload.reference ||
                         payload.outTradeNo ||
                         payload.tx_ref ||
                         payload.billReference ||
                         payload.providerReference;

    const { rows: payRows } = await client.query(
      `SELECT p.*, r.id as rest_id
       FROM payments p
       JOIN restaurants r ON r.id = p.restaurant_id
       WHERE (LOWER(TRIM(p.reference)) = LOWER(TRIM($1)) OR p.provider_reference = $1)
       LIMIT 1 FOR UPDATE`,
      [candidateRef]
    );

    if (payRows.length === 0) {
      // Log unrecognized reference and respond 200 to acknowledge delivery
      await client.query(
        `INSERT INTO payment_webhook_logs (provider, event_id, reference, payload, status, error_message)
         VALUES ($1, $2, $3, $4, 'ignored', 'Payment reference not found')`,
        [provider, String(eventId), candidateRef || null, JSON.stringify(payload)]
      );
      await client.query('COMMIT');
      return res.status(200).json({ status: 'ignored', message: 'Payment not found' });
    }

    const payment = payRows[0];

    // 3. Retrieve restaurant provider configuration to verify signature
    const { rows: configRows } = await client.query(
      `SELECT * FROM restaurant_payment_configs WHERE restaurant_id = $1 AND provider = $2`,
      [payment.restaurant_id, provider]
    );

    const config = configRows[0] || {};
    const decryptedCreds = config.encrypted_credentials
      ? decryptCredentials(config.encrypted_credentials)
      : {};

    const adapter = instantiateAdapter(provider, decryptedCreds, config.is_sandbox ?? true);

    // 4. Validate webhook signature & payload via Adapter
    const webhookResult = await adapter.handleWebhook(req, rawBody, signature);

    if (!webhookResult.verified) {
      await client.query(
        `INSERT INTO payment_webhook_logs (provider, event_id, reference, payload, status, error_message)
         VALUES ($1, $2, $3, $4, 'failed', 'Invalid webhook signature')`,
        [provider, String(eventId), candidateRef || null, JSON.stringify(payload)]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // 5. Amount & Currency match validation against verified order payment
    const expectedAmount = Number(payment.amount);
    const receivedAmount = Number(webhookResult.amount);

    if (Math.abs(expectedAmount - receivedAmount) > 0.05 || webhookResult.currency !== 'ETB') {
      await client.query(
        `INSERT INTO payment_webhook_logs (provider, event_id, reference, payload, status, error_message)
         VALUES ($1, $2, $3, $4, 'failed', 'Amount or currency mismatch')`,
        [provider, String(eventId), candidateRef || null, JSON.stringify(payload)]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Amount or currency mismatch' });
    }

    // 6. State Machine transition
    const newStatus = webhookResult.status === 'paid' ? 'confirmed' : 'failed';

    await client.query(
      `UPDATE payments
       SET status = $1,
           confirmed_at = CASE WHEN $1 = 'confirmed' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2`,
      [newStatus, payment.id]
    );

    // 7. If paid, update linked order and award loyalty
    if (newStatus === 'confirmed' && payment.order_id) {
      const { rows: oRows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [payment.order_id, payment.restaurant_id]
      );

      if (oRows.length > 0) {
        const order = oRows[0];
        const { rows: sumRows } = await client.query(
          `SELECT COALESCE(SUM(amount), 0) as total_confirmed
           FROM payments WHERE order_id = $1 AND status = 'confirmed'`,
          [order.id]
        );
        const totalConfirmed = Number(sumRows[0]?.total_confirmed || 0);

        if (totalConfirmed >= Number(order.total) - 0.05) {
          await client.query(
            `UPDATE orders 
             SET payment_status = 'paid',
                 is_payment_confirmed = true,
                 status = CASE WHEN status NOT IN ('cancelled') THEN 'served' ELSE status END,
                 updated_at = NOW()
             WHERE id = $1`,
            [order.id]
          );

          if (order.customer_id) {
            await awardPointsForPaidOrder(client, {
              restaurantId: payment.restaurant_id,
              orderId: order.id,
              customerId: order.customer_id,
              total: order.total,
              staffId: null,
            });
          }
        }
      }
    }

    // 8. Record successful webhook log
    await client.query(
      `INSERT INTO payment_webhook_logs (provider, event_id, reference, payload, status)
       VALUES ($1, $2, $3, $4, 'processed')`,
      [provider, String(eventId), candidateRef || null, JSON.stringify(payload)]
    );

    // 9. Audit log
    await logAudit(client, {
      restaurantId: payment.restaurant_id,
      action: 'payment_webhook_processed',
      targetType: 'payment',
      targetId: payment.id,
      metadata: {
        provider,
        eventId,
        amount: receivedAmount,
        status: newStatus,
      },
    });

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  } finally {
    client.release();
  }
});

module.exports = router;
