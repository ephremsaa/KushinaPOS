const express = require('express');
const pool = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const { verifyManagerPin } = require('../utils/pinHelper');
const { logAudit } = require('../utils/auditLogger');
const { awardPointsForPaidOrder, reversePointsForOrder } = require('../utils/loyaltyLedger');
const { encryptCredentials, decryptCredentials, maskCredentials } = require('../utils/paymentCrypto');
const { getPaymentAdapter, instantiateAdapter } = require('../adapters');
const { expireStalePendingPayments } = require('../jobs/paymentExpiryJob');
const { createUploadMiddleware } = require('../utils/uploadHelper');
const { dispatchWebhookEvent } = require('../jobs/webhookDispatcher');

const router = express.Router();
const uploadProof = createUploadMiddleware({ fieldName: 'proof', folder: 'payment-proofs', isPrivate: true, allowPdf: true });

function tid(req) {
  return req.user.restaurantId || req.user.userId;
}

function getStaffRole(req) {
  if (req.user.role === 'restaurant_owner') return 'owner';
  if (req.user.role === 'platform_admin') return 'admin';
  return req.user.staffRole || 'cashier';
}

// ── Upload payment proof photo ─────────────────────────────────
router.post('/upload-proof', authenticate, requireTenant, uploadProof, (req, res) => {
  if (!req.file || !req.file.url) {
    return res.status(400).json({ error: 'No proof file uploaded' });
  }
  res.json({ proof_url: req.file.url });
});

// ── GET /api/payments ──────────────────────────────────────────
// List payments with optional filters (status, method, order_id, date range)
router.get('/', authenticate, requireTenant, async (req, res) => {
  const { status, method, order_id, till_session_id, search, limit = 50, offset = 0 } = req.query;
  try {
    let query = `
      SELECT p.*,
             o.local_id as order_local_id,
             o.total as order_total,
             o.table_id,
             s.name as cashier_name,
             m.name as confirmed_by_name
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      LEFT JOIN staff s ON s.id = p.created_by
      LEFT JOIN staff m ON m.id = p.confirmed_by
      WHERE p.restaurant_id = $1
    `;
    const params = [tid(req)];
    let pIdx = 2;

    if (status) {
      query += ` AND p.status = $${pIdx++}`;
      params.push(status);
    }
    if (method) {
      query += ` AND p.method = $${pIdx++}`;
      params.push(method);
    }
    if (order_id) {
      query += ` AND p.order_id = $${pIdx++}`;
      params.push(order_id);
    }
    if (till_session_id) {
      query += ` AND p.till_session_id = $${pIdx++}`;
      params.push(till_session_id);
    }
    if (search && search.trim()) {
      query += ` AND (LOWER(p.reference) LIKE $${pIdx} OR LOWER(COALESCE(o.local_id::text, '')) LIKE $${pIdx})`;
      params.push(`%${search.trim().toLowerCase()}%`);
      pIdx++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// ── GET /api/payments/to-confirm ───────────────────────────────
// Dedicated list of pending mobile-money / bank transfer payments for dashboard
router.get('/to-confirm', authenticate, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              o.local_id as order_local_id,
              o.total as order_total,
              o.table_id,
              s.name as cashier_name
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       LEFT JOIN staff s ON s.id = p.created_by
       WHERE p.restaurant_id = $1
         AND p.status = 'pending'
         AND p.method IN ('telebirr', 'cbe_birr', 'bank_transfer')
       ORDER BY p.created_at ASC`,
      [tid(req)]
    );

    const totalUnconfirmed = rows.reduce((sum, p) => sum + Number(p.amount), 0);

    res.json({
      count: rows.length,
      total_unconfirmed: Math.round(totalUnconfirmed * 100) / 100,
      payments: rows,
    });
  } catch (err) {
    console.error('Error fetching unconfirmed payments:', err);
    res.status(500).json({ error: 'Failed to fetch unconfirmed payments' });
  }
});

// ── POST /api/payments ─────────────────────────────────────────
// Cashier or staff records a payment entry (cash, mobile-money, card, etc.)
router.post('/', authenticate, requireTenant, async (req, res) => {
  const {
    order_id,
    method,
    amount,
    reference,
    proof_url,
    notes,
    provider,
    provider_reference,
  } = req.body;

  if (!method || !amount) {
    return res.status(400).json({ error: 'method and amount are required' });
  }

  const numAmount = Math.round(Number(amount) * 100) / 100;
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'amount must be greater than 0' });
  }

  const validMethods = ['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card', 'loyalty'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: `Invalid payment method: ${method}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Reference uniqueness check (case-insensitive, trimmed per restaurant)
    if (reference && reference.trim()) {
      const cleanRef = reference.trim();
      const { rows: dupCheck } = await client.query(
        `SELECT p.id, p.order_id, o.local_id as order_local_id
         FROM payments p
         LEFT JOIN orders o ON o.id = p.order_id
         WHERE p.restaurant_id = $1
           AND LOWER(TRIM(p.reference)) = LOWER($2)
           AND p.status NOT IN ('rejected', 'failed')
         LIMIT 1`,
        [tid(req), cleanRef]
      );

      if (dupCheck.length > 0) {
        await client.query('ROLLBACK');
        const existing = dupCheck[0];
        const orderName = existing.order_local_id ? `#${existing.order_local_id}` : (existing.order_id || 'another transaction');
        return res.status(400).json({
          error: `Payment reference '${cleanRef}' has already been used on Order ${orderName}`,
        });
      }
    }

    // 2. Fetch order if order_id provided
    let order = null;
    if (order_id) {
      const { rows: oRows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [order_id, tid(req)]
      );
      if (oRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }
      order = oRows[0];
      if (order.payment_status === 'paid') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Order is already fully paid' });
      }
    }

    // 3. Resolve active cashier till session
    const actorId = req.user.userId || req.user.id;
    let tillSessionId = null;
    if (req.user.role === 'staff') {
      const { rows: tillRows } = await client.query(
        `SELECT id FROM cash_drawer_sessions WHERE restaurant_id = $1 AND staff_id = $2 AND status = 'open' LIMIT 1`,
        [tid(req), actorId]
      );
      if (tillRows.length > 0) {
        tillSessionId = tillRows[0].id;
      }
    }

    // 4. Initial status: Cash and Loyalty are confirmed immediately.
    // Mobile-money and bank transfer default to pending.
    // Cards with slip reference can be confirmed immediately or pending.
    const isAutoConfirmed = ['cash', 'loyalty', 'card'].includes(method);
    const initialStatus = isAutoConfirmed ? 'confirmed' : 'pending';
    const confirmedBy = isAutoConfirmed ? (req.user.role === 'staff' ? actorId : null) : null;
    const confirmedAt = isAutoConfirmed ? new Date() : null;

    // 5. Insert payment record
    const { rows: payRows } = await client.query(
      `INSERT INTO payments 
        (restaurant_id, order_id, till_session_id, created_by, method, amount, currency, reference,
         proof_url, status, confirmed_by, confirmed_at, provider, provider_reference, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'ETB', $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        tid(req),
        order_id || null,
        tillSessionId,
        req.user.role === 'staff' ? actorId : null,
        method,
        numAmount,
        reference ? reference.trim() : null,
        proof_url || null,
        initialStatus,
        confirmedBy,
        confirmedAt,
        provider || null,
        provider_reference || null,
        JSON.stringify({ notes: notes || null }),
      ]
    );

    const payment = payRows[0];

    // If cash confirmed, update till session expected cash
    if (method === 'cash' && tillSessionId && isAutoConfirmed) {
      await client.query(
        `UPDATE cash_drawer_sessions SET expected_cash = expected_cash + $1 WHERE id = $2`,
        [numAmount, tillSessionId]
      );
    }

    // 6. Check if order is fully paid with confirmed payments
    let orderPaid = false;
    let totalConfirmed = 0;
    if (order) {
      const { rows: sumRows } = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total_confirmed
         FROM payments
         WHERE order_id = $1 AND status = 'confirmed'`,
        [order.id]
      );
      totalConfirmed = Number(sumRows[0]?.total_confirmed || 0);
      const orderTotal = Number(order.total);

      if (totalConfirmed >= orderTotal - 0.05) {
        orderPaid = true;
        await client.query(
          `UPDATE orders
           SET payment_status = 'paid',
               is_payment_confirmed = true,
               payment_method = CASE WHEN $1 = $2 THEN $3 ELSE 'split' END,
               updated_at = NOW()
           WHERE id = $4`,
          [totalConfirmed, numAmount, method, order.id]
        );

        // Award loyalty points if customer linked
        if (order.customer_id) {
          await awardPointsForPaidOrder(client, {
            restaurantId: tid(req),
            orderId: order.id,
            customerId: order.customer_id,
            total: order.total,
            staffId: req.user.role === 'staff' ? actorId : null,
          });
        }
      } else if (totalConfirmed > 0) {
        // Order remains in pending payment_status until full amount is covered
      }
    }

    await client.query('COMMIT');

    // Dispatch webhook events
    if (isAutoConfirmed) {
      dispatchWebhookEvent(tid(req), 'payment.confirmed', {
        payment_id: payment.id,
        order_id: payment.order_id,
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference,
        confirmed_at: payment.confirmed_at
      }).catch(() => {});
    }
    if (orderPaid && order) {
      dispatchWebhookEvent(tid(req), 'order.paid', {
        order_id: order.id,
        order_number: order.local_id,
        total: order.total,
        payment_method: payment.method,
        paid_at: new Date().toISOString()
      }).catch(() => {});
    }

    res.status(201).json({
      payment,
      order_paid: orderPaid,
      total_confirmed: totalConfirmed,
      remaining_due: order ? Math.max(0, Number(order.total) - totalConfirmed) : 0,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating payment:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/payments/:id/confirm ────────────────────────────
router.patch('/:id/confirm', authenticate, requireTenant, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: payRows } = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, tid(req)]
    );

    if (payRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payRows[0];
    if (payment.status === 'confirmed' || payment.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment already confirmed' });
    }

    // Cashiers cannot confirm their own entries
    const actorId = req.user.userId || req.user.id;
    if (payment.created_by && payment.created_by === actorId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Cashiers cannot confirm their own payment entries. A manager or owner must confirm.',
      });
    }

    const role = getStaffRole(req);
    if (!['owner', 'manager', 'admin'].includes(role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only managers or owners can confirm payments' });
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE payments 
       SET status = 'confirmed',
           confirmed_by = $1,
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.role === 'staff' ? actorId : null, payment.id]
    );
    const updatedPayment = updatedRows[0];

    // Audit log
    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.role === 'staff' ? actorId : null,
      action: 'payment_confirmed',
      targetType: 'payment',
      targetId: payment.id,
      metadata: {
        order_id: payment.order_id,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        created_by: payment.created_by,
      },
    });

    // Re-check order paid status
    let orderPaid = false;
    if (payment.order_id) {
      const { rows: oRows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [payment.order_id, tid(req)]
      );
      if (oRows.length > 0) {
        const order = oRows[0];
        const { rows: sumRows } = await client.query(
          `SELECT COALESCE(SUM(amount), 0) as total_confirmed
           FROM payments
           WHERE order_id = $1 AND status = 'confirmed'`,
          [order.id]
        );
        const totalConfirmed = Number(sumRows[0]?.total_confirmed || 0);

        if (totalConfirmed >= Number(order.total) - 0.05) {
          orderPaid = true;
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
              restaurantId: tid(req),
              orderId: order.id,
              customerId: order.customer_id,
              total: order.total,
              staffId: req.user.role === 'staff' ? actorId : null,
            });
          }
        }
      }
    }

    await client.query('COMMIT');

    // Dispatch webhook events
    dispatchWebhookEvent(tid(req), 'payment.confirmed', {
      payment_id: updatedPayment.id,
      order_id: updatedPayment.order_id,
      method: updatedPayment.method,
      amount: updatedPayment.amount,
      reference: updatedPayment.reference,
      confirmed_at: updatedPayment.confirmed_at
    }).catch(() => {});

    if (orderPaid && payment.order_id) {
      dispatchWebhookEvent(tid(req), 'order.paid', {
        order_id: payment.order_id,
        total: updatedPayment.amount,
        paid_at: new Date().toISOString()
      }).catch(() => {});
    }

    res.json({
      payment: updatedPayment,
      order_paid: orderPaid,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming payment:', err);
    res.status(500).json({ error: 'Failed to confirm payment' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/payments/:id/reject ─────────────────────────────
// Manager or owner rejects a pending payment with mandatory reason
router.patch('/:id/reject', authenticate, requireTenant, async (req, res) => {
  const role = getStaffRole(req);
  if (!['owner', 'manager', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only managers or owners can reject payments' });
  }

  const { rejected_reason } = req.body;
  if (!rejected_reason || !rejected_reason.trim()) {
    return res.status(400).json({ error: 'rejection reason is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: payRows } = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, tid(req)]
    );
    if (payRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payRows[0];
    const actorId = req.user.userId || req.user.id;

    const { rows: updatedRows } = await client.query(
      `UPDATE payments 
       SET status = 'rejected',
           rejected_reason = $1,
           confirmed_by = $2,
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [rejected_reason.trim(), req.user.role === 'staff' ? actorId : null, payment.id]
    );

    // Audit log
    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.role === 'staff' ? actorId : null,
      action: 'payment_rejected',
      targetType: 'payment',
      targetId: payment.id,
      metadata: {
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        reason: rejected_reason.trim(),
      },
    });

    await client.query('COMMIT');
    res.json(updatedRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error rejecting payment:', err);
    res.status(500).json({ error: 'Failed to reject payment' });
  } finally {
    client.release();
  }
});

// ── POST /api/payments/:id/refund ──────────────────────────────
// Refunds a confirmed payment: creates negative payment linked to original,
// requires manager PIN and reason, restores stock, and reverses loyalty points.
router.post('/:id/refund', authenticate, requireTenant, async (req, res) => {
  const { manager_pin, reason, amount } = req.body;
  if (!manager_pin) return res.status(400).json({ error: 'manager_pin required' });
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'refund reason required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify manager PIN
    const { authorized, staff: managerStaff } = await verifyManagerPin(tid(req), manager_pin, client);
    if (!authorized) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Invalid manager PIN' });
    }

    // 2. Lock original payment
    const { rows: payRows } = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, tid(req)]
    );
    if (payRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const original = payRows[0];
    if (original.status !== 'confirmed' && original.status !== 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only confirmed or paid payments can be refunded' });
    }

    const refundAmount = amount ? Math.min(Number(amount), Number(original.amount)) : Number(original.amount);
    const negativeAmount = -Math.abs(refundAmount);

    // 3. Create negative payment linked to original
    const { rows: refundRows } = await client.query(
      `INSERT INTO payments
        (restaurant_id, order_id, till_session_id, created_by, method, amount, currency, reference,
         status, confirmed_by, confirmed_at, original_payment_id, rejected_reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'ETB', $7, 'refunded', $8, NOW(), $9, $10, $11)
       RETURNING *`,
      [
        tid(req),
        original.order_id,
        original.till_session_id,
        managerStaff ? managerStaff.id : null,
        original.method,
        negativeAmount,
        `REFUND-${original.reference || original.id.slice(0, 8)}`,
        managerStaff ? managerStaff.id : null,
        original.id,
        reason.trim(),
        JSON.stringify({ original_payment_id: original.id, reason: reason.trim() }),
      ]
    );

    // 4. Mark original payment refunded
    await client.query(
      `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
      [original.id]
    );

    // 5. If cash, adjust active till session
    if (original.method === 'cash' && original.till_session_id) {
      await client.query(
        `UPDATE cash_drawer_sessions SET expected_cash = expected_cash - $1 WHERE id = $2`,
        [refundAmount, original.till_session_id]
      );
    }

    // 6. Handle linked order: restore stock and reverse loyalty points
    if (original.order_id) {
      const { rows: oRows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [original.order_id, tid(req)]
      );
      if (oRows.length > 0) {
        const order = oRows[0];
        await client.query(
          `UPDATE orders SET payment_status = 'refunded', status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [order.id]
        );

        // Restock items
        const { rows: items } = await client.query(
          "SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1 AND menu_item_id IS NOT NULL",
          [order.id]
        );
        for (const item of items) {
          const { rows: ingredients } = await client.query(
            "SELECT inventory_item_id, quantity_required FROM menu_item_ingredients WHERE menu_item_id = $1",
            [item.menu_item_id]
          );
          for (const ing of ingredients) {
            const totalNeeded = Number(ing.quantity_required) * Number(item.quantity);
            await client.query(
              "UPDATE inventory_items SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2",
              [totalNeeded, ing.inventory_item_id]
            );
            await client.query(
              `INSERT INTO inventory_transactions (restaurant_id, item_id, type, quantity_delta, note)
               VALUES ($1, $2, 'restock', $3, $4)`,
              [tid(req), ing.inventory_item_id, totalNeeded, `Refund Order ${order.local_id || order.id}`]
            );
          }
        }

        // Reverse loyalty points
        await reversePointsForOrder(client, {
          restaurantId: tid(req),
          orderId: order.id,
          staffId: managerStaff ? managerStaff.id : null,
          reason: `Refund: ${reason}`,
        });
      }
    }

    // 7. Audit log
    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: managerStaff ? managerStaff.id : null,
      action: 'payment_refunded',
      targetType: 'payment',
      targetId: original.id,
      metadata: {
        refund_amount: refundAmount,
        original_payment_id: original.id,
        reason: reason.trim(),
        approved_by: managerStaff ? managerStaff.name : 'Manager',
      },
    });

    await client.query('COMMIT');
    res.json({
      message: 'Payment refunded successfully',
      refund: refundRows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error refunding payment:', err);
    res.status(500).json({ error: err.message || 'Failed to refund payment' });
  } finally {
    client.release();
  }
});

// ── GET /api/payments/reconciliation ───────────────────────────
// Manager statement reconciliation view: filter and match mobile money against statements
router.get('/reconciliation', authenticate, requireTenant, async (req, res) => {
  const { matched, method, startDate, endDate } = req.query;
  try {
    let query = `
      SELECT p.*,
             o.local_id as order_local_id,
             s.name as cashier_name,
             matcher.name as matched_by_name
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      LEFT JOIN staff s ON s.id = p.created_by
      LEFT JOIN staff matcher ON matcher.id = p.matched_by
      WHERE p.restaurant_id = $1
        AND p.method IN ('telebirr', 'cbe_birr', 'bank_transfer')
        AND p.status IN ('confirmed', 'paid')
    `;
    const params = [tid(req)];
    let pIdx = 2;

    if (matched !== undefined) {
      query += ` AND p.is_matched_with_statement = $${pIdx++}`;
      params.push(matched === 'true');
    }
    if (method) {
      query += ` AND p.method = $${pIdx++}`;
      params.push(method);
    }
    if (startDate) {
      query += ` AND p.created_at >= $${pIdx++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND p.created_at <= $${pIdx++}`;
      params.push(endDate);
    }

    query += ` ORDER BY p.created_at DESC`;

    const { rows } = await pool.query(query, params);

    const totalAmount = rows.reduce((s, p) => s + Number(p.amount), 0);
    const matchedAmount = rows.filter(p => p.is_matched_with_statement).reduce((s, p) => s + Number(p.amount), 0);
    const unmatchedAmount = totalAmount - matchedAmount;

    res.json({
      total_amount: Math.round(totalAmount * 100) / 100,
      matched_amount: Math.round(matchedAmount * 100) / 100,
      unmatched_amount: Math.round(unmatchedAmount * 100) / 100,
      payments: rows,
    });
  } catch (err) {
    console.error('Error fetching reconciliation:', err);
    res.status(500).json({ error: 'Failed to fetch reconciliation data' });
  }
});

// ── PATCH /api/payments/:id/match ──────────────────────────────
// Manager marks payment as "matched with statement"
router.patch('/:id/match', authenticate, requireTenant, async (req, res) => {
  const role = getStaffRole(req);
  if (!['owner', 'manager', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only managers or owners can reconcile statements' });
  }

  const { matched = true } = req.body;
  const actorId = req.user.userId || req.user.id;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);
  const matchedStaffId = (req.user.role === 'staff' && isUuid) ? actorId : null;

  try {
    const { rows } = await pool.query(
      `UPDATE payments
       SET is_matched_with_statement = $1,
           matched_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           matched_by = CASE WHEN $1 THEN $2::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3 AND restaurant_id = $4
       RETURNING *`,
      [Boolean(matched), matchedStaffId, req.params.id, tid(req)]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating statement match:', err);
    res.status(500).json({ error: 'Failed to update statement match' });
  }
});

// ── GET /api/payments/providers/config ─────────────────────────
// Returns provider gateway configs (credentials are masked)
router.get('/providers/config', authenticate, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, provider, is_enabled, is_sandbox, encrypted_credentials, webhook_secret, updated_at
       FROM restaurant_payment_configs WHERE restaurant_id = $1`,
      [tid(req)]
    );

    const configs = rows.map(r => ({
      id: r.id,
      provider: r.provider,
      is_enabled: r.is_enabled,
      is_sandbox: r.is_sandbox,
      credentials: r.encrypted_credentials ? maskCredentials(decryptCredentials(r.encrypted_credentials)) : {},
      webhook_secret: r.webhook_secret ? '••••••••' : null,
      updated_at: r.updated_at,
    }));

    res.json(configs);
  } catch (err) {
    console.error('Error fetching provider configs:', err);
    res.status(500).json({ error: 'Failed to fetch gateway configs' });
  }
});

// ── PUT /api/payments/providers/:provider ──────────────────────
// Store encrypted provider credentials and feature flag per restaurant
router.put('/providers/:provider', authenticate, requireTenant, async (req, res) => {
  const role = getStaffRole(req);
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Only restaurant owners can configure payment gateways' });
  }

  const { provider } = req.params;
  const { is_enabled, is_sandbox = true, credentials, webhook_secret } = req.body;

  const validProviders = ['telebirr', 'cbe_birr', 'chapa', 'mock_sandbox'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: `Invalid provider: ${provider}` });
  }

  try {
    let encryptedCredentials = null;
    if (credentials && typeof credentials === 'object') {
      encryptedCredentials = encryptCredentials(credentials);
    }

    const { rows } = await pool.query(
      `INSERT INTO restaurant_payment_configs
        (restaurant_id, provider, is_enabled, is_sandbox, encrypted_credentials, webhook_secret, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (restaurant_id, provider) DO UPDATE
       SET is_enabled = EXCLUDED.is_enabled,
           is_sandbox = EXCLUDED.is_sandbox,
           encrypted_credentials = COALESCE(EXCLUDED.encrypted_credentials, restaurant_payment_configs.encrypted_credentials),
           webhook_secret = COALESCE(EXCLUDED.webhook_secret, restaurant_payment_configs.webhook_secret),
           updated_at = NOW()
       RETURNING id, provider, is_enabled, is_sandbox, updated_at`,
      [
        tid(req),
        provider,
        Boolean(is_enabled),
        Boolean(is_sandbox),
        encryptedCredentials,
        webhook_secret || null,
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating provider config:', err);
    res.status(500).json({ error: 'Failed to update provider configuration' });
  }
});

// ── POST /api/payments/providers/:provider/test ────────────────
// Test connection to payment provider
router.post('/providers/:provider/test', authenticate, requireTenant, async (req, res) => {
  const { provider } = req.params;
  const { credentials, is_sandbox = true } = req.body;

  try {
    let credsToTest = credentials;
    let sandboxMode = is_sandbox;

    if (!credsToTest) {
      const { rows } = await pool.query(
        `SELECT encrypted_credentials, is_sandbox FROM restaurant_payment_configs WHERE restaurant_id = $1 AND provider = $2`,
        [tid(req), provider]
      );
      if (rows.length > 0 && rows[0].encrypted_credentials) {
        credsToTest = decryptCredentials(rows[0].encrypted_credentials);
        sandboxMode = rows[0].is_sandbox;
      }
    }

    const adapter = instantiateAdapter(provider, credsToTest || {}, sandboxMode);
    const result = await adapter.testConnection();
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Connection test failed' });
  }
});

// ── POST /api/payments/expire-stale ────────────────────────────
// Triggers expiration of pending payments stuck > 15 minutes
router.post('/expire-stale', authenticate, requireTenant, async (req, res) => {
  try {
    const result = await expireStalePendingPayments();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to expire stale payments' });
  }
});

module.exports = router;
