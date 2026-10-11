const express = require('express');
const db = require('../config/db');
const { getSafeTz } = require('../utils/tzHelper');
const { authenticate, requireTenant } = require('../middleware/auth');
const { verifyManagerPin } = require('../utils/pinHelper');
const { computeOrderTotals } = require('../utils/orderPricing');
const { logAudit } = require('../utils/auditLogger');
const { recordLoyaltyTransaction, awardPointsForPaidOrder, reversePointsForOrder } = require('../utils/loyaltyLedger');
const { normalizePhone } = require('./customers');
const { dispatchWebhookEvent } = require('../jobs/webhookDispatcher');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// Helper: Verify discount limits
async function verifyDiscountLimit(req, client, discount, managerPin) {
  if (!discount || !discount.type || !discount.value) return;
  const val = Number(discount.value) || 0;
  if (val <= 0) return;

  const role = req.user.role === 'platform_admin' ? 'admin' : (req.user.staffRole || 'owner');
  if (role === 'admin' || role === 'owner' || role === 'manager') return; // allowed

  // Cashier limits: max 10% or max 100 fixed
  const isOverLimit = (discount.type === 'percentage' && val > 10) || (discount.type === 'fixed' && val > 100);
  if (!isOverLimit) return;

  // Need manager approval
  if (!managerPin) {
    throw new Error('Manager PIN required for this discount amount');
  }

  const managerId = await verifyManagerPin(tid(req), managerPin);
  if (!managerId) {
    throw new Error('Invalid Manager PIN');
  }

  // Write to audit log
  await client.query(
    `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, metadata)
     VALUES ($1, $2, 'manager_discount_approval', 'order', $3)`,
    [
      tid(req), 
      managerId, 
      JSON.stringify({ 
        cashier_id: req.user.userId || req.user.id, 
        discount_type: discount.type, 
        discount_value: val 
      })
    ]
  );
}

// ── GET /api/orders ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const {
    status, order_type, date_from, date_to,
    staff_id, table_id, search,
    limit = 200, offset = 0,
    include_cancelled = 'false'
  } = req.query;

  try {
    let query = `
      SELECT o.*,
        t.label as table_label,
        s.name as staff_name,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'menu_item_name', oi.menu_item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'modifier_choices', oi.modifier_choices,
            'notes', oi.notes,
            'status', oi.status
          ) ORDER BY oi.created_at
        ) FILTER (WHERE oi.id IS NOT NULL) as order_items
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN staff s ON s.id = o.staff_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.restaurant_id = $1`;
    const params = [tid(req)];

    // Status filter
    if (status === 'active') {
      query += ` AND o.status IN ('new','preparing','ready')`;
    } else if (status && status !== 'all') {
      query += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    } else if (include_cancelled !== 'true') {
      // Default: exclude cancelled unless explicitly requested
      query += ` AND o.status != 'cancelled'`;
    }

    // Order type filter
    if (order_type && order_type !== 'all') {
      query += ` AND o.order_type = $${params.length + 1}`;
      params.push(order_type);
    }

    // Staff filter (Waiters can ONLY see their own orders unless specifically requested, but we enforce it here)
    if (req.user.staffRole === 'waiter') {
      query += ` AND o.staff_id = $${params.length + 1}`;
      params.push(req.user.staffId);
    } else if (staff_id) {
      query += ` AND o.staff_id = $${params.length + 1}`;
      params.push(staff_id);
    }

    // Table filter
    if (table_id) {
      query += ` AND o.table_id = $${params.length + 1}`;
      params.push(table_id);
    }

    // Date range (today by default when date_from is provided)
    if (date_from) {
      query += ` AND o.created_at >= $${params.length + 1}`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND o.created_at <= $${params.length + 1}`;
      params.push(date_to);
    }

    // Customer / table search
    if (search) {
      query += ` AND (o.customer_name ILIKE $${params.length + 1} OR t.label ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY o.id, t.label, s.name ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(query, params);
    res.json(rows.map(r => ({ ...r, order_items: r.order_items || [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET /api/orders/history ────────────────────────────
// Cashier-specific history scoped to their active till session or today
router.get('/history', async (req, res) => {
  const { date_from } = req.query; // optional override
  try {
    let query = `
      SELECT o.*,
        t.label as table_label,
        s.name as staff_name,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_name', oi.menu_item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price
          ) ORDER BY oi.created_at
        ) FILTER (WHERE oi.id IS NOT NULL) as order_items
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN staff s ON s.id = o.staff_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.restaurant_id = $1 
        AND o.status IN ('served', 'cancelled')
        AND o.payment_status IN ('paid', 'refunded')
    `;
    const params = [tid(req)];
    
    if (req.user.role === 'staff') {
      if (req.user.staffRole === 'cashier') {
        query += ` AND o.paid_by_staff_id = $2`;
        params.push(req.user.userId || req.user.id);
      } else if (req.user.staffRole === 'waiter') {
        query += ` AND o.staff_id = $2`;
        params.push(req.user.userId || req.user.id);
      }
    }

    let pi = params.length + 1;
    const tz = await getSafeTz(tid(req));
    if (date_from) {
      query += ` AND o.created_at >= $${pi++}`;
      params.push(date_from);
    } else {
      query += ` AND o.created_at >= (NOW() AT TIME ZONE '${tz}')::date`;
    }

    query += ` GROUP BY o.id, t.label, s.name ORDER BY o.created_at DESC LIMIT 50`;
    
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ── GET /api/orders/stale?minutes=45 ────────────────────────────
// Orders that are still open past N minutes (manager alert)
router.get('/stale', async (req, res) => {
  const { minutes = 45 } = req.query;
  try {
    const { rows } = await db.query(
      `SELECT o.*, t.label as table_label, s.name as staff_name
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN staff s ON s.id = o.staff_id
       WHERE o.restaurant_id = $1
         AND o.status IN ('new', 'preparing')
         AND o.created_at <= NOW() - ($2 || ' minutes')::interval
       ORDER BY o.created_at ASC`,
      [tid(req), parseInt(minutes)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/orders/kitchen ───────────────────────────────────
// Optimised for KDS — only new/preparing
router.get('/kitchen', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*,
        t.label as table_label,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_name', oi.menu_item_name,
            'quantity', oi.quantity,
            'notes', oi.notes,
            'modifier_choices', oi.modifier_choices,
            'status', oi.status
          ) ORDER BY oi.created_at
        ) FILTER (WHERE oi.id IS NOT NULL) as order_items
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 AND o.status IN ('new','preparing')
       GROUP BY o.id, t.label
       ORDER BY o.created_at ASC`,
      [tid(req)]
    );
    res.json(rows.map(r => ({ ...r, order_items: r.order_items || [] })));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/orders/open?table_id=:id ────────────────────────
// Returns the currently open (unpaid) order for a table, if any
router.get('/open', async (req, res) => {
  const { table_id } = req.query;
  if (!table_id) return res.status(400).json({ error: 'table_id required' });
  try {
    const { rows } = await db.query(
      `SELECT o.*,
        t.label as table_label,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'menu_item_name', oi.menu_item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'modifier_choices', oi.modifier_choices,
            'notes', oi.notes,
            'status', oi.status
          ) ORDER BY oi.created_at
        ) FILTER (WHERE oi.id IS NOT NULL) as order_items
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = $1
         AND o.table_id = $2
         AND o.status IN ('new', 'preparing', 'ready')
         AND o.payment_status = 'pending'
       GROUP BY o.id, t.label
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [tid(req), table_id]
    );
    if (!rows[0]) return res.json(null);
    res.json({ ...rows[0], order_items: rows[0].order_items || [] });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/orders/:id/items ────────────────────────────────
// Append new items to an existing open order (e.g. 2nd round of drinks)
router.post('/:id/items', async (req, res) => {
  const { items, discount, manager_pin } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Verify order belongs to this restaurant
    const { rows: orderRows } = await client.query(
      "SELECT id FROM orders WHERE id=$1 AND restaurant_id=$2 AND payment_status='pending'",
      [req.params.id, tid(req)]
    );
    if (!orderRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found or already paid' }); }

    await verifyDiscountLimit(req, client, discount, manager_pin);

    // Compute prices securely on server
    const { subtotal, taxAmount, total, validatedItems } = await computeOrderTotals(client, tid(req), items, discount);

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, modifier_choices, notes, status, station)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
        [req.params.id, item.menu_item_id, item.menu_item_name, item.quantity, item.unit_price, JSON.stringify(item.modifier_choices), item.notes, item.station]
      );
    }

    // Add new subtotals to existing order
    await client.query(
      `UPDATE orders 
       SET subtotal = subtotal + $1, 
           tax_amount = tax_amount + $2, 
           total = total + $3, 
           updated_at = NOW() 
       WHERE id = $4`,
      [subtotal, taxAmount, total, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Items added' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add items error:', err);
    res.status(400).json({ error: err.message || 'Failed to add items' });
  } finally {
    client.release();
  }
});

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    table_id,
    order_type,
    customer_name,
    customer_phone,
    delivery_address,
    notes,
    local_id,
    items,
    discount,
    manager_pin,
    customer_id,
    points_to_redeem
  } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await verifyDiscountLimit(req, client, discount, manager_pin);

    let effectiveCustomerId = customer_id || null;
    let normPhone = customer_phone ? normalizePhone(customer_phone) : null;
    if (!effectiveCustomerId && normPhone) {
      const custLookup = await client.query(
        `SELECT id FROM customers WHERE restaurant_id = $1 AND phone = $2 LIMIT 1`,
        [tid(req), normPhone]
      );
      if (custLookup.rows[0]) {
        effectiveCustomerId = custLookup.rows[0].id;
      } else {
        const newCust = await client.query(
          `INSERT INTO customers (restaurant_id, name, phone, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (restaurant_id, phone) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [tid(req), customer_name || 'Customer', normPhone]
        );
        effectiveCustomerId = newCust.rows[0]?.id || null;
      }
    }

    const {
      subtotal,
      discountAmount,
      loyaltyDiscount,
      pointsRedeemed,
      taxAmount,
      deliveryFee,
      total,
      validatedItems
    } = await computeOrderTotals(client, tid(req), items, discount, {
      orderType: order_type,
      customerId: effectiveCustomerId,
      pointsToRedeem: points_to_redeem
    });

    // Insert order with ON CONFLICT trick to detect existing
    const { rows } = await client.query(
      `INSERT INTO orders
        (restaurant_id, table_id, staff_id, order_type, status, subtotal, tax_amount, discount_amount, loyalty_points_redeemed, loyalty_discount, delivery_fee, delivery_address, total, customer_name, customer_phone, notes, local_id, synced_at, customer_id)
       VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17)
       ON CONFLICT (restaurant_id, local_id) DO UPDATE SET updated_at=NOW()
       RETURNING (xmax = 0) AS inserted, *`,
      [
        tid(req),
        table_id || null,
        req.user.role === 'staff' ? (req.user.userId || req.user.id) : null,
        order_type || 'dine_in',
        subtotal,
        taxAmount,
        discountAmount,
        pointsRedeemed || 0,
        loyaltyDiscount || 0,
        deliveryFee || 0,
        delivery_address || null,
        total,
        customer_name || null,
        normPhone || customer_phone || null,
        notes || null,
        local_id || null,
        effectiveCustomerId || null
      ]
    );
    const order = rows[0];

    // If order already existed (offline sync), don't insert items again!
    if (!order.inserted) {
      await client.query('COMMIT');
      return res.status(201).json(order);
    }

    // Insert items
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, modifier_choices, notes, status, station)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
        [order.id, item.menu_item_id, item.menu_item_name, item.quantity, item.unit_price, JSON.stringify(item.modifier_choices), item.notes, item.station]
      );
    }

    // If loyalty points redeemed, deduct points via ledger and log audit
    if (pointsRedeemed > 0 && effectiveCustomerId) {
      await recordLoyaltyTransaction(client, {
        restaurantId: tid(req),
        customerId: effectiveCustomerId,
        orderId: order.id,
        type: 'redeem',
        points: -pointsRedeemed,
        staffId: req.user.role === 'staff' ? (req.user.userId || req.user.id) : null,
        note: `Redeemed at checkout (${loyaltyDiscount} ETB discount)`
      });
      await logAudit(client, {
        restaurant_id: tid(req),
        actor_user_id: req.user.userId || req.user.id,
        action: 'loyalty_points_redeemed',
        target_type: 'customer',
        target_id: effectiveCustomerId,
        metadata: { points_redeemed: pointsRedeemed, loyalty_discount: loyaltyDiscount, order_id: order.id }
      });
    }

    // Mark table occupied
    if (table_id && order_type === 'dine_in') {
      await client.query("UPDATE tables SET status='occupied', updated_at=NOW() WHERE id=$1 AND restaurant_id=$2", [table_id, tid(req)]);
    }

    await client.query('COMMIT');

    // Trigger notification for takeaway/delivery orders
    if (order_type === 'takeaway' || order_type === 'delivery') {
      const { notify } = require('../utils/notifyService');
      await notify({
        restaurant_id: tid(req),
        type: 'new_online_order',
        title: `🛍️ New ${order_type === 'delivery' ? 'Delivery' : 'Takeaway'} Order Received`,
        message: `Order #${order.local_id || order.id.slice(0, 8)} placed for ${customer_name || 'Guest'} (${total} ETB).`,
        target_role: 'all',
        metadata: { order_id: order.id, order_type, total }
      });
    }

    // Dispatch order.created webhook
    dispatchWebhookEvent(tid(req), 'order.created', {
      order_id: order.id,
      order_number: order.local_id,
      total: order.total,
      status: order.status,
      order_type,
      created_at: order.created_at
    }).catch(() => {});

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id ────────────────────────────────────
// Update customer, table, or notes on an open order
router.patch('/:id', async (req, res) => {
  const { customer_id, customer_name, customer_phone, table_id, notes } = req.body;
  try {
    const fields = [];
    const params = [req.params.id, tid(req)];
    if (customer_id !== undefined) {
      params.push(customer_id);
      fields.push(`customer_id = $${params.length}`);
    }
    if (customer_name !== undefined) {
      params.push(customer_name);
      fields.push(`customer_name = $${params.length}`);
    }
    if (customer_phone !== undefined) {
      params.push(customer_phone ? normalizePhone(customer_phone) || customer_phone : null);
      fields.push(`customer_phone = $${params.length}`);
    }
    if (table_id !== undefined) {
      params.push(table_id);
      fields.push(`table_id = $${params.length}`);
    }
    if (notes !== undefined) {
      params.push(notes);
      fields.push(`notes = $${params.length}`);
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    fields.push('updated_at = NOW()');
    const { rows } = await db.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $1 AND restaurant_id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ── PATCH /api/orders/:id/status ─────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status, reason, manager_pin } = req.body;
  const valid = ['new','preparing','ready','served','cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  if (req.user.staffRole === 'kitchen') {
    return res.status(403).json({ error: 'Kitchen role may only use /api/kitchen routes' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query('SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE', [req.params.id, tid(req)]);
    if (!orderRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    
    const order = orderRows[0];

    // refuse to cancel or serve a paid order (use the refund flow instead)
    if (order.payment_status === 'paid' && (status === 'cancelled' || status === 'served')) {
      await client.query('ROLLBACK'); 
      return res.status(400).json({ error: 'Cannot cancel or mark a paid order as served. Use refund flow instead.' });
    }

    let managerId = null;
    if (status === 'cancelled') {
      if (!reason) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Reason required to cancel' }); }

      const role = req.user.role === 'platform_admin' ? 'admin' : (req.user.staffRole || 'owner');
      const isOwnerOrManager = ['admin', 'owner', 'manager'].includes(role);
      const isOwningWaiter = role === 'waiter' && order.staff_id === (req.user.userId || req.user.id);
      
      if (!isOwnerOrManager && !isOwningWaiter) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Only owners, managers, or the original waiter can cancel this order' });
      }

      if (!manager_pin) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'manager_pin required to cancel' });
      }

      managerId = await verifyManagerPin(tid(req), manager_pin);
      if (!managerId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Invalid Manager PIN' });
      }
    }

    const updateQuery = status === 'cancelled' && reason
      ? "UPDATE orders SET status=$1, notes=COALESCE(notes||' | Cancelled: '||$4, 'Cancelled: '||$4), updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *"
      : "UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *";
    const updateParams = status === 'cancelled' && reason
      ? [status, req.params.id, tid(req), reason]
      : [status, req.params.id, tid(req)];

    const { rows: updated } = await client.query(updateQuery, updateParams);

    // Free table if served or cancelled
    if ((status === 'served' || status === 'cancelled') && updated[0].table_id) {
       const { rows: openOrders } = await client.query(
         "SELECT id FROM orders WHERE table_id=$1 AND restaurant_id=$2 AND status NOT IN ('served', 'cancelled') AND id != $3",
         [updated[0].table_id, tid(req), req.params.id]
       );
       if (openOrders.length === 0) {
         await client.query("UPDATE tables SET status='available', updated_at=NOW() WHERE id=$1", [updated[0].table_id]);
       }
    }

    if (status === 'cancelled') {
      const staffActor = req.user.role === 'staff' ? (req.user.userId || req.user.id) : null;
      await reversePointsForOrder(client, {
        restaurantId: tid(req),
        orderId: req.params.id,
        staffId: staffActor,
        reason: reason || 'Order cancelled'
      });
      await client.query(
        `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'order_cancel', 'order', $3, $4)`,
        [tid(req), req.user.userId || req.user.id, req.params.id, JSON.stringify({ reason, approved_by: managerId })]
      );
    }

    await client.query('COMMIT');

    // Dispatch order.status_changed webhook
    dispatchWebhookEvent(tid(req), 'order.status_changed', {
      order_id: updated[0].id,
      previous_status: order.status,
      new_status: status,
      reason: reason || null,
      updated_at: updated[0].updated_at
    }).catch(() => {});

    res.json(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed' });
  } finally {
    client.release();
  }
});


// ── PATCH /api/orders/:id/pay ────────────────────────────────
router.patch('/:id/pay', async (req, res) => {
  let {
    payment_method,
    tip_amount = 0,
    amount_tendered = null,
    table_next_status = 'available',
    payment_reference,
    proof_url,
    split_payments = [],
    customer_id,
    points_to_redeem = 0
  } = req.body;
  
  tip_amount = Number(tip_amount) || 0;
  if (tip_amount < 0) return res.status(400).json({ error: 'Tip amount must be >= 0' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query('SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE', [req.params.id, tid(req)]);
    if (!orderRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderRows[0];
    if (order.payment_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order already paid or refunded' });
    }

    if (tip_amount > Number(order.subtotal)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tip amount cannot exceed 100% of subtotal' });
    }

    // Resolve customer and loyalty redemption at checkout
    let targetCustomerId = customer_id || order.customer_id;
    let redeemedPoints = Number(points_to_redeem) || 0;
    let loyaltyDiscount = 0;

    if (targetCustomerId) {
      const { rows: custCheck } = await client.query(
        `SELECT id, name, phone, points FROM customers WHERE id = $1 AND restaurant_id = $2`,
        [targetCustomerId, tid(req)]
      );
      if (!custCheck[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Customer not found' });
      }

      if (redeemedPoints > 0) {
        const { rows: restRows } = await client.query(
          `SELECT loyalty_enabled, loyalty_min_redeem_points, loyalty_point_val_etb, loyalty_max_bill_share_percent 
           FROM restaurants WHERE id = $1`,
          [tid(req)]
        );
        const rConf = restRows[0];
        if (!rConf || !rConf.loyalty_enabled) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Loyalty program is not enabled for this restaurant' });
        }

        const availablePoints = Number(custCheck[0].points) || 0;
        if (availablePoints < redeemedPoints) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Customer has only ${availablePoints} points available` });
        }

        const minRedeem = Number(rConf.loyalty_min_redeem_points) || 50;
        if (redeemedPoints < minRedeem) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Minimum redemption threshold is ${minRedeem} points` });
        }

        const pointVal = Number(rConf.loyalty_point_val_etb) || 1.0;
        loyaltyDiscount = Math.round(redeemedPoints * pointVal * 100) / 100;
        const maxSharePct = Number(rConf.loyalty_max_bill_share_percent) || 50;
        const maxAllowedDiscount = Math.round(Number(order.subtotal) * (maxSharePct / 100) * 100) / 100;

        if (loyaltyDiscount > maxAllowedDiscount) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Redemption exceeds max allowed bill share (${maxSharePct}% / ${maxAllowedDiscount} ETB)` });
        }
      }
    } else if (redeemedPoints > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer is required to redeem loyalty points' });
    }

    const payableTotal = Math.max(0, Number(order.total) - loyaltyDiscount);
    const totalDueWithTip = payableTotal + tip_amount;

    let isMobileMoney = false;
    let actualMethod = payment_method;
    
    if (Array.isArray(split_payments) && split_payments.length > 0) {
      let totalSplit = 0;
      for (const p of split_payments) {
        if (!p.method || !p.amount || Number(p.amount) <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid split payment entry' });
        }
        totalSplit += Number(p.amount);
      }
      if (Math.abs(totalSplit - totalDueWithTip) > 0.05) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Split payments must sum exactly to order total (${totalDueWithTip})` });
      }
      actualMethod = 'split';
      isMobileMoney = split_payments.some(p => ['telebirr', 'cbe_birr', 'bank_transfer'].includes(p.method));
    } else {
      if (!['cash', 'card', 'telebirr', 'cbe_birr', 'bank_transfer', 'other'].includes(payment_method)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid payment method' });
      }
      isMobileMoney = ['telebirr', 'cbe_birr', 'bank_transfer'].includes(payment_method);
    }

    // Enforce reference uniqueness across the restaurant
    const refsToCheck = [];
    if (payment_reference && payment_reference.trim()) refsToCheck.push(payment_reference.trim());
    if (Array.isArray(split_payments)) {
      split_payments.forEach(p => { if (p.reference && p.reference.trim()) refsToCheck.push(p.reference.trim()); });
    }
    for (const ref of refsToCheck) {
      const { rows: dupCheck } = await client.query(
        `SELECT p.id, p.order_id, o.local_id as order_local_id
         FROM payments p
         LEFT JOIN orders o ON o.id = p.order_id
         WHERE p.restaurant_id = $1
           AND LOWER(TRIM(p.reference)) = LOWER($2)
           AND p.status NOT IN ('rejected', 'failed')
         LIMIT 1`,
        [tid(req), ref]
      );
      if (dupCheck.length > 0) {
        await client.query('ROLLBACK');
        const existing = dupCheck[0];
        const orderName = existing.order_local_id ? `#${existing.order_local_id}` : (existing.order_id || 'another transaction');
        return res.status(400).json({
          error: `Payment reference '${ref}' has already been used on Order ${orderName}`,
        });
      }
    }

    if (actualMethod === 'cash' && amount_tendered !== null) {
      if (Number(amount_tendered) < totalDueWithTip) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Amount tendered is less than total' });
      }
    }
    const change_due = (actualMethod === 'cash' && amount_tendered !== null) ? Number(amount_tendered) - totalDueWithTip : 0;

    const actorUserId = req.user.userId || req.user.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorUserId);
    const staffActorId = req.user.role === 'staff' && isUuid ? actorUserId : null;

    let tillSessionId = null;
    if (staffActorId) {
      const { rows: sessionRows } = await client.query(
        `SELECT id FROM cash_drawer_sessions WHERE restaurant_id=$1 AND staff_id=$2 AND status='open' LIMIT 1`,
        [tid(req), staffActorId]
      );
      if (sessionRows.length > 0) {
        tillSessionId = sessionRows[0].id;
      }
    }

    const isConfirmed = !isMobileMoney;
    
    // Check stock before paying/serving! Block if below zero.
    const { rows: items } = await client.query(
      "SELECT menu_item_id, quantity, menu_item_name FROM order_items WHERE order_id = $1 AND menu_item_id IS NOT NULL AND status != 'cancelled'",
      [req.params.id]
    );
    
    for (const item of items) {
      const { rows: ingredients } = await client.query(
        "SELECT i.id, i.name, i.quantity as current_qty, m.quantity_required FROM menu_item_ingredients m JOIN inventory_items i ON i.id = m.inventory_item_id WHERE m.menu_item_id = $1",
        [item.menu_item_id]
      );
      for (const ing of ingredients) {
        const totalNeeded = Number(ing.quantity_required) * Number(item.quantity);
        if (Number(ing.current_qty) - totalNeeded < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Insufficient stock for ${ing.name} (needed for ${item.menu_item_name}). Required: ${totalNeeded}, Available: ${ing.current_qty}` });
        }
      }
    }

    if (redeemedPoints > 0 && targetCustomerId) {
      await recordLoyaltyTransaction(client, {
        restaurantId: tid(req),
        customerId: targetCustomerId,
        orderId: order.id,
        type: 'redeem',
        points: -redeemedPoints,
        staffId: staffActorId,
        note: `Redeemed at checkout (${loyaltyDiscount} ETB discount)`
      });

      await logAudit(client, {
        restaurantId: tid(req),
        actorUserId: isUuid ? actorUserId : null,
        action: 'loyalty_points_redeemed_checkout',
        targetType: 'customer',
        targetId: targetCustomerId,
        metadata: { orderId: order.id, pointsRedeemed: redeemedPoints, discount: loyaltyDiscount }
      });
    }

    const { rows } = await client.query(
      `UPDATE orders 
       SET payment_status='paid', payment_method=$1, 
           tip_amount=$2,
           total = $3,
           loyalty_points_redeemed = COALESCE(loyalty_points_redeemed, 0) + $4,
           loyalty_discount = COALESCE(loyalty_discount, 0) + $5,
           customer_id = COALESCE($6, customer_id),
           till_session_id=$7,
           payment_reference=$8,
           is_payment_confirmed=$9,
           split_payments=$10,
           paid_by_staff_id=$11,
           status = CASE WHEN status NOT IN ('cancelled') THEN 'served' ELSE status END,
           updated_at=NOW() 
       WHERE id=$12 AND restaurant_id=$13 AND payment_status='pending'
       RETURNING *`,
      [
        actualMethod,
        tip_amount,
        totalDueWithTip,
        redeemedPoints,
        loyaltyDiscount,
        targetCustomerId || null,
        tillSessionId,
        payment_reference || null,
        isConfirmed,
        JSON.stringify(split_payments),
        staffActorId,
        req.params.id,
        tid(req)
      ]
    );
    
    const paidOrder = rows[0];

    // Record into unified payments table
    if (Array.isArray(split_payments) && split_payments.length > 0) {
      for (const sp of split_payments) {
        const spIsMobile = ['telebirr', 'cbe_birr', 'bank_transfer'].includes(sp.method);
        await client.query(
          `INSERT INTO payments 
            (restaurant_id, order_id, till_session_id, created_by, method, amount, currency, reference, proof_url, status, confirmed_by, confirmed_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'ETB', $7, $8, $9, $10, $11)`,
          [
            tid(req),
            paidOrder.id,
            tillSessionId,
            staffActorId,
            sp.method,
            Number(sp.amount),
            sp.reference ? sp.reference.trim() : null,
            sp.proof_url || proof_url || null,
            spIsMobile ? 'pending' : 'confirmed',
            spIsMobile ? null : staffActorId,
            spIsMobile ? null : new Date(),
          ]
        );
      }
    } else {
      await client.query(
        `INSERT INTO payments 
          (restaurant_id, order_id, till_session_id, created_by, method, amount, currency, reference, proof_url, status, confirmed_by, confirmed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ETB', $7, $8, $9, $10, $11)`,
        [
          tid(req),
          paidOrder.id,
          tillSessionId,
          staffActorId,
          actualMethod,
          totalDueWithTip,
          payment_reference ? payment_reference.trim() : null,
          proof_url || null,
          isConfirmed ? 'confirmed' : 'pending',
          isConfirmed ? staffActorId : null,
          isConfirmed ? new Date() : null,
        ]
      );
    }
    for (const item of items) {
      const { rows: ingredients } = await client.query(
        "SELECT inventory_item_id, quantity_required FROM menu_item_ingredients WHERE menu_item_id = $1",
        [item.menu_item_id]
      );
      for (const ing of ingredients) {
        const totalNeeded = Number(ing.quantity_required) * Number(item.quantity);
        await client.query(
          "UPDATE inventory_items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2",
          [totalNeeded, ing.inventory_item_id]
        );
        await client.query(
          `INSERT INTO inventory_transactions (restaurant_id, item_id, type, quantity_delta, note)
           VALUES ($1, $2, 'order_usage', $3, $4)`,
          [tid(req), ing.inventory_item_id, -totalNeeded, `Order ${paidOrder.local_id || req.params.id}`]
        );
      }
    }

    if (actualMethod === 'cash' && tillSessionId) {
       await client.query(
         `UPDATE cash_drawer_sessions SET expected_cash = expected_cash + $1 WHERE id=$2`,
         [Number(paidOrder.total), tillSessionId]
       );
    }
    
    if (actualMethod === 'split' && tillSessionId) {
       const cashSplit = split_payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0);
       if (cashSplit > 0) {
         await client.query(
           `UPDATE cash_drawer_sessions SET expected_cash = expected_cash + $1 WHERE id=$2`,
           [cashSplit, tillSessionId]
         );
       }
    }

    if (paidOrder.table_id) {
       const { rows: openOrders } = await client.query(
         "SELECT id FROM orders WHERE table_id=$1 AND restaurant_id=$2 AND status NOT IN ('served', 'cancelled') AND id != $3",
         [paidOrder.table_id, tid(req), req.params.id]
       );
       if (openOrders.length === 0) {
         const nextStatus = ['available', 'cleaning'].includes(table_next_status) ? table_next_status : 'available';
         await client.query(
           "UPDATE tables SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3",
           [nextStatus, paidOrder.table_id, tid(req)]
         );
       }
    }

    const { triggerAuto86 } = require('../utils/inventory');
    await triggerAuto86(client, tid(req));

    // Award loyalty points if payment is confirmed & customer is attached
    let pointsAwarded = null;
    if (paidOrder.is_payment_confirmed && paidOrder.customer_id) {
      pointsAwarded = await awardPointsForPaidOrder(client, {
        restaurantId: tid(req),
        orderId: paidOrder.id,
        customerId: paidOrder.customer_id,
        total: paidOrder.total,
        staffId: staffActorId
      });
    }

    let currentLoyaltyBalance = null;
    if (paidOrder.customer_id) {
      const { rows: balRows } = await client.query(
        `SELECT points FROM customers WHERE id = $1 AND restaurant_id = $2`,
        [paidOrder.customer_id, tid(req)]
      );
      currentLoyaltyBalance = balRows[0]?.points ?? null;
    }

    await client.query('COMMIT');
    res.json({
      ...paidOrder,
      change_due,
      points_awarded: pointsAwarded,
      loyalty_balance: currentLoyaltyBalance
    });
  } catch (err) { 
    await client.query('ROLLBACK');
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message || 'Failed' }); 
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/confirm-payment ────────────────────
router.patch('/:id/confirm-payment', async (req, res) => {
  const role = req.user.role === 'platform_admin' ? 'admin' : (req.user.staffRole || 'owner');
  if (!['admin', 'owner', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Only managers or owners can confirm payments' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      "SELECT id, payment_method, is_payment_confirmed, customer_id, total FROM orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
      [req.params.id, tid(req)]
    );
    if (!orderRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderRows[0];
    if (!['telebirr', 'cbe_birr', 'bank_transfer'].includes(order.payment_method)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only mobile-money or bank transfers require confirmation' });
    }
    if (order.is_payment_confirmed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment already confirmed' });
    }

    const { rows } = await client.query(
      `UPDATE orders SET is_payment_confirmed = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    const confirmerId = req.user.role === 'staff' ? (req.user.userId || req.user.id) : null;
    await client.query(
      `UPDATE payments 
       SET status = 'confirmed', confirmed_by = $1, confirmed_at = NOW(), updated_at = NOW() 
       WHERE order_id = $2 AND status = 'pending'`,
      [confirmerId, req.params.id]
    );

    if (order.customer_id) {
      await awardPointsForPaidOrder(client, {
        restaurantId: tid(req),
        orderId: order.id,
        customerId: order.customer_id,
        total: order.total,
        staffId: req.user.userId || req.user.id
      });
    }

    await client.query(
      `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'confirm_payment', 'order', $3, $4)`,
      [tid(req), req.user.userId || req.user.id, req.params.id, JSON.stringify({ payment_method: order.payment_method, reference: req.body.payment_reference || null })]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to confirm payment' });
  } finally {
    client.release();
  }
});

// ── Helper for restoring stock (void/refund) ──────────────────
async function restoreOrderStock(client, req, order) {
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
        [tid(req), ing.inventory_item_id, totalNeeded, `Void/Refund Order ${order.local_id || order.id}`]
      );
    }
  }
}

// ── PATCH /api/orders/:id/void ───────────────────────────────
// Requires manager/owner PIN — logs to audit
router.patch('/:id/void', async (req, res) => {
  const { manager_pin } = req.body;
  if (!manager_pin) return res.status(400).json({ error: 'manager_pin required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verify a manager/owner PIN in this restaurant using bcrypt
    const managerId = await verifyManagerPin(tid(req), manager_pin, client);
    if (!managerId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Invalid manager PIN' });
    }

    // Void the order
    const { rows } = await client.query(
      `UPDATE orders SET status='cancelled', updated_at=NOW()
       WHERE id=$1 AND restaurant_id=$2 AND payment_status='pending'
       RETURNING *`,
      [req.params.id, tid(req)]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or already paid' });
    }

    // Free the table
    if (rows[0].table_id) {
       const { rows: openOrders } = await client.query(
         "SELECT id FROM orders WHERE table_id=$1 AND restaurant_id=$2 AND status NOT IN ('served', 'cancelled') AND id != $3",
         [rows[0].table_id, tid(req), req.params.id]
       );
       if (openOrders.length === 0) {
         await client.query("UPDATE tables SET status='available', updated_at=NOW() WHERE id=$1", [rows[0].table_id]);
       }
    }

    // Reverse loyalty points if any were earned
    const voidStaffActor = req.user.role === 'staff' ? (req.user.userId || req.user.id) : null;
    await reversePointsForOrder(client, {
      restaurantId: tid(req),
      orderId: req.params.id,
      staffId: voidStaffActor,
      reason: 'Order voided'
    });

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'order_void', 'order', $3, $4)`,
      [tid(req), req.user.userId || req.user.id, req.params.id, JSON.stringify({ approved_by: managerId })]
    );

    await client.query('COMMIT');
    res.json({ message: 'Order voided', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Void error:', err);
    res.status(500).json({ error: 'Failed to void order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/refund ─────────────────────────────
router.patch('/:id/refund', async (req, res) => {
  const { manager_pin, reason } = req.body;
  if (!manager_pin) return res.status(400).json({ error: 'manager_pin required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const managerId = await verifyManagerPin(tid(req), manager_pin, client);
    if (!managerId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Invalid manager PIN' });
    }

    // Refund the order
    const { rows } = await client.query(
      `UPDATE orders SET status='cancelled', payment_status='refunded', notes=COALESCE(notes||' | Refund: '||$3, 'Refund: '||$3), updated_at=NOW()
       WHERE id=$1 AND restaurant_id=$2 AND payment_status='paid'
       RETURNING *`,
      [req.params.id, tid(req), reason || 'No reason']
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or not paid' });
    }
    
    const order = rows[0];
    await restoreOrderStock(client, req, order);

    // Free the table
    if (order.table_id) {
       const { rows: openOrders } = await client.query(
         "SELECT id FROM orders WHERE table_id=$1 AND restaurant_id=$2 AND status NOT IN ('served', 'cancelled') AND id != $3",
         [order.table_id, tid(req), req.params.id]
       );
       if (openOrders.length === 0) {
         await client.query("UPDATE tables SET status='available', updated_at=NOW() WHERE id=$1", [order.table_id]);
       }
    }

    // Reverse loyalty points
    const refundStaffActor = req.user.role === 'staff' ? (req.user.userId || req.user.id) : null;
    await reversePointsForOrder(client, {
      restaurantId: tid(req),
      orderId: req.params.id,
      staffId: refundStaffActor,
      reason: reason || 'Order refunded'
    });

    // Update status in payments table
    await client.query(
      `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE order_id = $1`,
      [req.params.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'order_refund', 'order', $3, $4)`,
      [tid(req), req.user.userId || req.user.id, req.params.id, JSON.stringify({ approved_by: managerId, reason })]
    );

    // Trigger auto-86 since stock is back
    const { triggerAuto86 } = require('../utils/inventory');
    await triggerAuto86(client, tid(req));

    await client.query('COMMIT');
    res.json({ message: 'Order refunded', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refund error:', err);
    res.status(500).json({ error: 'Failed to refund order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/items/:itemId/status ───────────────────
router.patch('/items/:itemId/status', async (req, res) => {
  const { status } = req.body;
  try {
    const { rows: itemRows } = await db.query(
      "UPDATE order_items SET status=$1 WHERE id=$2 RETURNING order_id",
      [status, req.params.itemId]
    );
    if (!itemRows[0]) return res.status(404).json({ error: 'Not found' });

    const orderId = itemRows[0].order_id;

    // Auto-advance order status
    const { rows: allItems } = await db.query(
      "SELECT status FROM order_items WHERE order_id=$1", [orderId]
    );
    const allReady = allItems.every(i => i.status === 'ready');
    const anyPreparing = allItems.some(i => i.status === 'preparing');
    if (allReady) {
      await db.query("UPDATE orders SET status='ready', updated_at=NOW() WHERE id=$1", [orderId]);
    } else if (anyPreparing || status === 'preparing') {
      await db.query("UPDATE orders SET status='preparing', updated_at=NOW() WHERE id=$1", [orderId]);
    }

    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/orders/today/summary ────────────────────────────
router.get('/today/summary', async (req, res) => {
  try {
    const tz = await getSafeTz(tid(req));
    const { rows } = await db.query(
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as total_sales,
         AVG(CASE WHEN status != 'cancelled' THEN total END) as avg_order
       FROM orders
       WHERE restaurant_id=$1 AND created_at >= (NOW() AT TIME ZONE '${tz}')::date`,
      [tid(req)]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/orders/online ────────────────────────────────────
router.get('/online', async (req, res) => {
  const { tab = 'pending', limit = 100 } = req.query;
  try {
    const restaurantId = tid(req);
    let statusClause = '';
    const params = [restaurantId];

    if (tab === 'pending') {
      statusClause = `AND o.accept_status = 'pending' AND o.status != 'cancelled'`;
    } else if (tab === 'active') {
      statusClause = `AND o.accept_status = 'accepted' AND o.status NOT IN ('delivered', 'served', 'cancelled')`;
    } else if (tab === 'completed') {
      statusClause = `AND o.status IN ('delivered', 'served')`;
    } else if (tab === 'rejected') {
      statusClause = `AND (o.accept_status = 'rejected' OR (o.status = 'cancelled' AND o.order_source = 'online'))`;
    }

    const { rows } = await db.query(
      `SELECT o.*,
         dz.name as delivery_zone_name,
         dz.fee as zone_fee,
         dz.estimated_minutes as zone_estimated_minutes,
         s.name as driver_staff_name,
         s.phone as driver_staff_phone,
         ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60) as pending_minutes,
         json_agg(
           json_build_object(
             'id', oi.id,
             'menu_item_id', oi.menu_item_id,
             'menu_item_name', oi.menu_item_name,
             'quantity', oi.quantity,
             'unit_price', oi.unit_price,
             'modifier_choices', oi.modifier_choices,
             'notes', oi.notes,
             'status', oi.status
           ) ORDER BY oi.created_at
         ) FILTER (WHERE oi.id IS NOT NULL) as order_items
       FROM orders o
       LEFT JOIN delivery_zones dz ON dz.id = o.delivery_zone_id
       LEFT JOIN staff s ON s.id = o.driver_staff_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = $1
         AND o.order_source = 'online'
         ${statusClause}
       GROUP BY o.id, dz.name, dz.fee, dz.estimated_minutes, s.name, s.phone
       ORDER BY o.created_at DESC
       LIMIT $2`,
      [...params, limit]
    );

    // Auto-notify owner if any pending order stays pending longer than 5 minutes
    try {
      const { notify } = require('../utils/notifyService');
      const overdueOrders = rows.filter(r => r.accept_status === 'pending' && Number(r.pending_minutes) >= 5);
      for (const ov of overdueOrders) {
        // Check if already notified in audit_logs to avoid spam
        const auditCheck = await db.query(
          `SELECT id FROM audit_logs 
           WHERE restaurant_id = $1 AND target_id = $2 AND action = 'online_order_pending_alert_sent'
           LIMIT 1`,
          [restaurantId, ov.id]
        );
        if (auditCheck.rows.length === 0) {
          await notify({
            restaurant_id: restaurantId,
            type: 'order_stuck',
            title: `⚠️ Overdue Online Order #${ov.local_id || ov.tracking_token?.slice(0, 8)}`,
            message: `Online ${ov.order_type} order from ${ov.customer_name || 'Customer'} has been pending for over ${ov.pending_minutes} minutes without response!`,
            target_role: 'owner',
            metadata: { order_id: ov.id, customer_phone: ov.customer_phone, total: ov.total }
          });
          await db.query(
            `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, target_id, metadata)
             VALUES ($1, $2, 'online_order_pending_alert_sent', 'order', $3, $4)`,
            [restaurantId, req.user.userId || req.user.id, ov.id, JSON.stringify({ pending_minutes: ov.pending_minutes })]
          );
        }
      }
    } catch (notifErr) {
      console.warn('Overdue pending notification check error:', notifErr.message);
    }

    res.json(rows.map(r => ({ ...r, order_items: r.order_items || [] })));
  } catch (err) {
    console.error('Error fetching online orders:', err);
    res.status(500).json({ error: 'Failed to fetch online orders' });
  }
});

// ── PATCH /api/orders/:id/accept-online ──────────────────────
router.patch('/:id/accept-online', async (req, res) => {
  const { prep_time_minutes = 25 } = req.body;
  const prepMins = Math.max(5, Math.min(180, parseInt(prep_time_minutes, 10) || 25));
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orders
       SET accept_status = 'accepted',
           accepted_at = NOW(),
           estimated_ready_at = NOW() + ($1 * INTERVAL '1 minute'),
           status = CASE WHEN status = 'new' THEN 'preparing' ELSE status END,
           updated_at = NOW()
       WHERE id = $2 AND restaurant_id = $3 AND accept_status = 'pending'
       RETURNING *`,
      [prepMins, req.params.id, tid(req)]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or not in pending state' });
    }

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_accept',
      targetType: 'order',
      targetId: req.params.id,
      metadata: { prep_time_minutes: prepMins, estimated_ready_at: rows[0].estimated_ready_at }
    });

    await client.query('COMMIT');
    res.json({ message: 'Order accepted', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting online order:', err);
    res.status(500).json({ error: 'Failed to accept order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/reject-online ──────────────────────
router.patch('/:id/reject-online', async (req, res) => {
  const { rejection_reason } = req.body;
  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orders
       SET accept_status = 'rejected',
           rejection_reason = $1,
           status = 'cancelled',
           updated_at = NOW()
       WHERE id = $2 AND restaurant_id = $3 AND accept_status = 'pending'
       RETURNING *`,
      [rejection_reason.trim(), req.params.id, tid(req)]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or not in pending state' });
    }

    // Cancel items
    await client.query(
      `UPDATE order_items SET status = 'cancelled' WHERE order_id = $1`,
      [req.params.id]
    );

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_reject',
      targetType: 'order',
      targetId: req.params.id,
      metadata: { rejection_reason: rejection_reason.trim() }
    });

    await client.query('COMMIT');
    res.json({ message: 'Order rejected', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error rejecting online order:', err);
    res.status(500).json({ error: 'Failed to reject order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/assign-driver ──────────────────────
router.patch('/:id/assign-driver', async (req, res) => {
  const { driver_name, driver_phone, driver_staff_id = null, mark_out_for_delivery = false } = req.body;
  if (!driver_name && !driver_staff_id) {
    return res.status(400).json({ error: 'Driver name or staff member is required' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let resolvedName = driver_name || null;
    let resolvedPhone = driver_phone || null;

    if (driver_staff_id) {
      const { rows: staffRows } = await client.query(
        `SELECT name, phone FROM staff WHERE id = $1 AND restaurant_id = $2`,
        [driver_staff_id, tid(req)]
      );
      if (staffRows[0]) {
        resolvedName = staffRows[0].name;
        resolvedPhone = staffRows[0].phone || resolvedPhone;
      }
    }

    const { rows } = await client.query(
      `UPDATE orders
       SET driver_name = $1,
           driver_phone = $2,
           driver_staff_id = $3,
           status = CASE WHEN $4 = true THEN 'out_for_delivery' ELSE status END,
           out_for_delivery_at = CASE WHEN $4 = true THEN COALESCE(out_for_delivery_at, NOW()) ELSE out_for_delivery_at END,
           updated_at = NOW()
       WHERE id = $5 AND restaurant_id = $6
       RETURNING *`,
      [resolvedName, resolvedPhone, driver_staff_id || null, !!mark_out_for_delivery, req.params.id, tid(req)]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_driver_assigned',
      targetType: 'order',
      targetId: req.params.id,
      metadata: { driver_name: resolvedName, driver_phone: resolvedPhone, out_for_delivery: !!mark_out_for_delivery }
    });

    await client.query('COMMIT');
    res.json({ message: 'Driver assigned', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning driver:', err);
    res.status(500).json({ error: 'Failed to assign driver' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/out-for-delivery ───────────────────
router.patch('/:id/out-for-delivery', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orders
       SET status = 'out_for_delivery',
           out_for_delivery_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [req.params.id, tid(req)]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_out_for_delivery',
      targetType: 'order',
      targetId: req.params.id
    });

    await client.query('COMMIT');
    res.json({ message: 'Order is out for delivery', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error setting out for delivery:', err);
    res.status(500).json({ error: 'Failed to update order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/mark-delivered ─────────────────────
router.patch('/:id/mark-delivered', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orders
       SET status = 'delivered',
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [req.params.id, tid(req)]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_delivered',
      targetType: 'order',
      targetId: req.params.id
    });

    await client.query('COMMIT');
    res.json({ message: 'Order marked as delivered', order: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error marking delivered:', err);
    res.status(500).json({ error: 'Failed to update order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/collect-cod ────────────────────────
// Cash on delivery / pickup: cashier confirms cash handback, updates till session
router.patch('/:id/collect-cod', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, tid(req)]
    );

    const order = orderRows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order is already marked paid' });
    }

    // Check open cash drawer session for this cashier/staff
    let tillSessionId = null;
    const { rows: sessionRows } = await client.query(
      `SELECT id FROM cash_drawer_sessions 
       WHERE restaurant_id = $1 AND staff_id = $2 AND status = 'open' 
       LIMIT 1`,
      [tid(req), req.user.userId || req.user.id]
    );

    if (sessionRows.length > 0) {
      tillSessionId = sessionRows[0].id;
      // Increment expected_cash in active till session
      await client.query(
        `UPDATE cash_drawer_sessions 
         SET expected_cash = expected_cash + $1 
         WHERE id = $2`,
        [Number(order.total), tillSessionId]
      );
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE orders
       SET payment_status = 'paid',
           payment_method = 'cash',
           paid_by_staff_id = $1,
           till_session_id = COALESCE($2, till_session_id),
           is_payment_confirmed = true,
           updated_at = NOW()
       WHERE id = $3 AND restaurant_id = $4
       RETURNING *`,
      [req.user.userId || req.user.id, tillSessionId, req.params.id, tid(req)]
    );

    if (order.customer_id) {
      await awardPointsForPaidOrder(client, {
        restaurantId: tid(req),
        orderId: order.id,
        customerId: order.customer_id,
        total: order.total,
        staffId: req.user.userId || req.user.id
      });
    }

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_cod_collected',
      targetType: 'order',
      targetId: req.params.id,
      metadata: { total: order.total, tillSessionId }
    });

    await client.query('COMMIT');
    res.json({ message: 'Cash collection confirmed', order: updatedRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming COD:', err);
    res.status(500).json({ error: 'Failed to confirm cash collection' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/confirm-online-transfer ────────────
// Manager confirms online Telebirr / CBE payment
router.patch('/:id/confirm-online-transfer', async (req, res) => {
  const userRole = req.user.role === 'platform_admin' ? 'admin' : (req.user.staffRole || 'owner');
  if (!['owner', 'manager', 'admin'].includes(userRole)) {
    return res.status(403).json({ error: 'Manager or Owner approval required to confirm mobile/bank transfers' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [req.params.id, tid(req)]
    );

    const order = orderRows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE orders
       SET is_payment_confirmed = true,
           payment_status = 'paid',
           paid_by_staff_id = $1,
           updated_at = NOW()
       WHERE id = $2 AND restaurant_id = $3
       RETURNING *`,
      [req.user.userId || req.user.id, req.params.id, tid(req)]
    );

    if (order.customer_id) {
      await awardPointsForPaidOrder(client, {
        restaurantId: tid(req),
        orderId: order.id,
        customerId: order.customer_id,
        total: order.total,
        staffId: req.user.userId || req.user.id
      });
    }

    await logAudit(client, {
      restaurantId: tid(req),
      actorUserId: req.user.userId || req.user.id,
      action: 'online_order_transfer_confirmed',
      targetType: 'order',
      targetId: req.params.id,
      metadata: { payment_reference: order.payment_reference, total: order.total }
    });

    await client.query('COMMIT');
    res.json({ message: 'Online transfer confirmed', order: updatedRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming online transfer:', err);
    res.status(500).json({ error: 'Failed to confirm online transfer' });
  } finally {
    client.release();
  }
});

module.exports = router;
