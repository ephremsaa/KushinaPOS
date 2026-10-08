const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const { verifyManagerPin } = require('../utils/pinHelper');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

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
    
    // Only filter by staff_id for cashiers and waiters so they only see their own bills
    if (req.user.role === 'staff' && ['cashier', 'waiter'].includes(req.user.staffRole)) {
      query += ` AND o.staff_id = $2`;
      params.push(req.user.userId || req.user.id);
    }

    // Now index 3 (or 2) depends on whether staff_id was pushed, so let's track param index
    let pi = params.length + 1;
    if (date_from) {
      query += ` AND o.created_at >= $${pi++}`;
      params.push(date_from);
    } else {
      // Default to today if no active till session
      query += ` AND o.created_at >= CURRENT_DATE`;
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
  const { items, subtotal, tax_amount, discount_amount, total } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Verify order belongs to this restaurant
    const { rows: orderRows } = await client.query(
      "SELECT id FROM orders WHERE id=$1 AND restaurant_id=$2 AND payment_status='pending'",
      [req.params.id, tid(req)]
    );
    if (!orderRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, modifier_choices, notes, status, station)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
        [req.params.id, item.menu_item_id || null, item.menu_item_name, item.quantity, item.unit_price, JSON.stringify(item.modifier_choices || []), item.notes || null, item.station || 'General']
      );
    }

    // Update order totals
    await client.query(
      `UPDATE orders SET subtotal=$1, tax_amount=$2, discount_amount=$3, total=$4, updated_at=NOW() WHERE id=$5`,
      [subtotal, tax_amount, discount_amount, total, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Items added' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add items error:', err);
    res.status(500).json({ error: 'Failed' });
  } finally {
    client.release();
  }
});

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  const { table_id, order_type, subtotal, tax_amount, discount_amount, total, customer_name, notes, local_id, items } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO orders
        (restaurant_id, table_id, staff_id, order_type, status, subtotal, tax_amount, discount_amount, total, customer_name, notes, local_id, synced_at)
       VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (restaurant_id, local_id) DO UPDATE SET updated_at=NOW()
       RETURNING *`,
      [tid(req), table_id || null, req.user.userId || req.user.id, order_type || 'dine_in', subtotal, tax_amount, discount_amount, total, customer_name || null, notes || null, local_id || null]
    );
    const order = rows[0];

    // Insert items
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, modifier_choices, notes, status, station)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
          [order.id, item.menu_item_id || null, item.menu_item_name, item.quantity, item.unit_price, JSON.stringify(item.modifier_choices || []), item.notes || null, item.station || 'General']
        );
      }
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

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/status ─────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status, reason } = req.body;
  const valid = ['new','preparing','ready','served','cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    // If cancelling, store the reason in notes field
    const updateQuery = status === 'cancelled' && reason
      ? "UPDATE orders SET status=$1, notes=COALESCE(notes||' | Cancelled: '||$4, 'Cancelled: '||$4), updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *"
      : "UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3 RETURNING *";
    const updateParams = status === 'cancelled' && reason
      ? [status, req.params.id, tid(req), reason]
      : [status, req.params.id, tid(req)];

    const { rows } = await db.query(updateQuery, updateParams);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    // Free table if served or cancelled
    if ((status === 'served' || status === 'cancelled') && rows[0].table_id) {
      await db.query("UPDATE tables SET status='available', updated_at=NOW() WHERE id=$1", [rows[0].table_id]);
    }

    // Audit log for cancellations
    if (status === 'cancelled') {
      await db.query(
        `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, 'order_cancel', 'order', $2, $3)`,
        [req.user.userId || req.user.id, req.params.id, JSON.stringify({ reason: reason || 'No reason given', restaurant_id: tid(req) })]
      ).catch(() => {}); // non-fatal
    }

    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});


// ── PATCH /api/orders/:id/pay ────────────────────────────────
router.patch('/:id/pay', async (req, res) => {
  const { payment_method, tip_amount = 0, amount_tendered = null, table_next_status = 'available', payment_reference } = req.body;
  if (!['cash', 'card', 'telebirr', 'cbe_birr', 'bank_transfer', 'other'].includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // First find active till session for this cashier
    let tillSessionId = null;
    const { rows: sessionRows } = await client.query(
      `SELECT id FROM cash_drawer_sessions WHERE restaurant_id=$1 AND staff_id=$2 AND status='open' LIMIT 1`,
      [tid(req), req.user.userId || req.user.id]
    );
    if (sessionRows.length > 0) {
      tillSessionId = sessionRows[0].id;
    }

    // Determine if payment is confirmed. Mobile money/bank transfer defaults to false unless explicitly confirmed later.
    // Wait, the prompt says "Mark mobile-money payments as 'pending confirmation' until staff confirm receipt".
    // For now, at checkout, they are unconfirmed.
    const isMobileMoney = ['telebirr', 'cbe_birr', 'bank_transfer'].includes(payment_method);
    const isConfirmed = !isMobileMoney;

    const { rows } = await client.query(
      `UPDATE orders 
       SET payment_status='paid', payment_method=$1, 
           tip_amount=$2,
           total = total + $2,
           till_session_id=$3,
           payment_reference=$4,
           is_payment_confirmed=$5,
           status = CASE WHEN status NOT IN ('cancelled') THEN 'served' ELSE status END,
           updated_at=NOW() 
       WHERE id=$6 AND restaurant_id=$7 AND payment_status='pending'
       RETURNING *`,
      [payment_method, tip_amount, tillSessionId, payment_reference || null, isConfirmed, req.params.id, tid(req)]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or already paid' });
    }
    const order = rows[0];

    // If cash payment and till is open, increment expected cash
    if (payment_method === 'cash' && tillSessionId) {
       await client.query(
         `UPDATE cash_drawer_sessions SET expected_cash = expected_cash + $1 WHERE id=$2`,
         [order.total, tillSessionId]
       );
    }

    // Release table → configurable: available or cleaning
    if (order.table_id) {
      const nextStatus = ['available', 'cleaning'].includes(table_next_status) ? table_next_status : 'available';
      await client.query(
        "UPDATE tables SET status=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3",
        [nextStatus, order.table_id, tid(req)]
      );
    }

    // --- AUTO DEDUCTION LOGIC ---
    const { rows: items } = await client.query(
      "SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1 AND menu_item_id IS NOT NULL",
      [req.params.id]
    );
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
          [tid(req), ing.inventory_item_id, -totalNeeded, `Order ${order.local_id || req.params.id}`]
        );
      }
    }

    // Trigger auto-86
    const { triggerAuto86 } = require('../utils/inventory');
    await triggerAuto86(client, tid(req));

    await client.query('COMMIT');
    res.json(order);
  } catch (err) { 
    await client.query('ROLLBACK');
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Failed' }); 
  } finally {
    client.release();
  }
});

// ── PATCH /api/orders/:id/confirm-payment ────────────────────
router.patch('/:id/confirm-payment', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE orders 
       SET is_payment_confirmed = true, updated_at = NOW() 
       WHERE id = $1 AND restaurant_id = $2 
       RETURNING *`,
      [req.params.id, tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// ── PATCH /api/orders/:id/void ───────────────────────────────
// Requires manager/owner PIN — logs to audit
router.patch('/:id/void', async (req, res) => {
  const { manager_pin } = req.body;
  if (!manager_pin) return res.status(400).json({ error: 'manager_pin required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verify a manager/owner PIN in this restaurant using bcrypt
    const { authorized, staff: managerStaff } = await verifyManagerPin(tid(req), manager_pin, client);
    if (!authorized) {
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
      await client.query(
        "UPDATE tables SET status='available', updated_at=NOW() WHERE id=$1",
        [rows[0].table_id]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'order_void', 'order', $2, $3)`,
      [req.user.userId || req.user.id, req.params.id, JSON.stringify({ authorized_by_staff: managerStaff?.id, restaurant_id: tid(req) })]
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
    const { rows } = await db.query(
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as total_sales,
         AVG(CASE WHEN status != 'cancelled' THEN total END) as avg_order
       FROM orders
       WHERE restaurant_id=$1 AND created_at >= CURRENT_DATE`,
      [tid(req)]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
