const express = require('express');
const db = require('../config/db');
const { getSafeTz } = require('../utils/tzHelper');
const { authenticate, requireTenant } = require('../middleware/auth');
const { verifyManagerPin } = require('../utils/pinHelper');
const { computeOrderTotals } = require('../utils/orderPricing');
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
  const { table_id, order_type, customer_name, notes, local_id, items, discount, manager_pin } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await verifyDiscountLimit(req, client, discount, manager_pin);

    const { subtotal, discountAmount, taxAmount, total, validatedItems } = await computeOrderTotals(client, tid(req), items, discount);

    // Insert order with ON CONFLICT trick to detect existing
    const { rows } = await client.query(
      `INSERT INTO orders
        (restaurant_id, table_id, staff_id, order_type, status, subtotal, tax_amount, discount_amount, total, customer_name, notes, local_id, synced_at)
       VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (restaurant_id, local_id) DO UPDATE SET updated_at=NOW()
       RETURNING (xmax = 0) AS inserted, *`,
      [tid(req), table_id || null, req.user.userId || req.user.id, order_type || 'dine_in', subtotal, taxAmount, discountAmount, total, customer_name || null, notes || null, local_id || null]
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
    res.status(400).json({ error: err.message || 'Failed to create order' });
  } finally {
    client.release();
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
      await client.query(
        `INSERT INTO audit_logs (restaurant_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'order_cancel', 'order', $3, $4)`,
        [tid(req), req.user.userId || req.user.id, req.params.id, JSON.stringify({ reason, approved_by: managerId })]
      );
    }

    await client.query('COMMIT');
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
  let { payment_method, tip_amount = 0, amount_tendered = null, table_next_status = 'available', payment_reference, split_payments = [] } = req.body;
  
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
      if (Math.abs(totalSplit - Number(order.total)) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Split payments must sum exactly to order total' });
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

    if (actualMethod === 'cash' && amount_tendered !== null) {
      if (Number(amount_tendered) < Number(order.total)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Amount tendered is less than total' });
      }
    }
    const change_due = (actualMethod === 'cash' && amount_tendered !== null) ? Number(amount_tendered) - Number(order.total) : 0;

    let tillSessionId = null;
    const { rows: sessionRows } = await client.query(
      `SELECT id FROM cash_drawer_sessions WHERE restaurant_id=$1 AND staff_id=$2 AND status='open' LIMIT 1`,
      [tid(req), req.user.userId || req.user.id]
    );
    if (sessionRows.length > 0) {
      tillSessionId = sessionRows[0].id;
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

    const { rows } = await client.query(
      `UPDATE orders 
       SET payment_status='paid', payment_method=$1, 
           tip_amount=$2,
           total = total + $2,
           till_session_id=$3,
           payment_reference=$4,
           is_payment_confirmed=$5,
           split_payments=$6,
           paid_by_staff_id=$7,
           status = CASE WHEN status NOT IN ('cancelled') THEN 'served' ELSE status END,
           updated_at=NOW() 
       WHERE id=$8 AND restaurant_id=$9 AND payment_status='pending'
       RETURNING *`,
      [actualMethod, tip_amount, tillSessionId, payment_reference || null, isConfirmed, JSON.stringify(split_payments), req.user.userId || req.user.id, req.params.id, tid(req)]
    );
    
    const paidOrder = rows[0];

    // Deduct stock
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

    await client.query('COMMIT');
    res.json({ ...paidOrder, change_due });
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
  const role = req.user.role === 'platform_admin' ? 'admin' : (req.user.staffRole || 'owner');
  if (!['admin', 'owner', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Only managers or owners can confirm payments' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      "SELECT payment_method, is_payment_confirmed FROM orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
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

module.exports = router;
