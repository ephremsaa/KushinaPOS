const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// ── GET /api/kitchen/orders ───────────────────────────────────
router.get('/orders', async (req, res) => {
  const { station } = req.query;
  try {
    const params = [tid(req)];
    let stationFilter = '';
    
    if (station && station !== 'All Stations') {
      stationFilter = ` AND oi.station = $2`;
      params.push(station);
    }

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
            'status', oi.status,
            'station', oi.station
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL ${stationFilter}) as order_items
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = $1
         AND o.status IN ('new', 'preparing')
         AND (o.accept_status IS NULL OR o.accept_status = 'accepted')
       GROUP BY o.id, t.label
       HAVING COUNT(oi.id) FILTER (WHERE oi.id IS NOT NULL ${stationFilter}) > 0
       ORDER BY o.created_at ASC`,
      params
    );
    
    // Ensure order_items is always an array
    res.json(rows.map(r => ({ ...r, order_items: r.order_items || [] })));
  } catch (err) {
    console.error('Kitchen orders err:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── PATCH /api/kitchen/items/:id/status ───────────────────────
// Updates a specific item's status, then auto-completes parent order if all items ready
router.patch('/items/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'preparing', 'ready', 'served'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Update the item
    const { rows: itemRows } = await client.query(
      `UPDATE order_items 
       SET status = $1 
       WHERE id = $2 
         AND order_id IN (SELECT id FROM orders WHERE restaurant_id = $3)
       RETURNING order_id`,
      [status, req.params.id, tid(req)]
    );

    if (!itemRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const orderId = itemRows[0].order_id;

    // Check parent order statuses
    const { rows: orderItems } = await client.query(
      `SELECT status FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    const allReady = orderItems.every(i => i.status === 'ready' || i.status === 'served');
    const anyPreparing = orderItems.some(i => i.status === 'preparing' || i.status === 'ready');

    let newOrderStatus = 'new';
    if (allReady) newOrderStatus = 'ready';
    else if (anyPreparing) newOrderStatus = 'preparing';

    const { rows: orderRows } = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING table_id`,
      [newOrderStatus, orderId]
    );

    // If order became ready and it's a table order, maybe update table status (optional, left it flexible)
    // if (newOrderStatus === 'ready' && orderRows[0].table_id) { ... }

    await client.query('COMMIT');
    res.json({ message: 'Item updated', order_status: newOrderStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/kitchen/orders/:id/status ──────────────────────
// Bulk update all items in an order and the order itself
router.patch('/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: orderRows } = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
      [status, req.params.id, tid(req)]
    );

    if (!orderRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update all its items too
    let itemStatus = status;
    if (status === 'new') itemStatus = 'pending'; // 'new' order -> 'pending' items

    await client.query(
      `UPDATE order_items SET status = $1 WHERE order_id = $2`,
      [itemStatus, req.params.id]
    );

    await client.query('COMMIT');
    res.json(orderRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
