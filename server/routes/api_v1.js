const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { authenticateApiV1, requireScope } = require('../middleware/apiKeyV1Auth');
const { computeOrderTotals } = require('../utils/orderPricing');
const { dispatchWebhookEvent } = require('../jobs/webhookDispatcher');

const router = express.Router();

// ── Open Endpoints (Publicly accessible for developer inspection) ──────────

// 1. GET /api/v1/openapi.json
router.get('/openapi.json', (req, res) => {
  const specPath = path.join(__dirname, '../docs/openapi.json');
  if (fs.existsSync(specPath)) {
    return res.sendFile(specPath);
  }
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'OpenAPI specification file not found' }
  });
});

// 2. GET /api/v1/docs (Interactive HTML Docs)
router.get('/docs', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>KushinaPOS Partner & Developer API v1</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>
  `);
});

// ── Protected API v1 Endpoints (Require API Key) ──────────────────────────
router.use(authenticateApiV1);

// ── 1. GET /api/v1/menu (Scope: menu:read) ─────────────────────────────────
router.get('/menu', requireScope('menu:read'), async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const [categoriesRes, itemsRes] = await Promise.all([
      db.query(
        `SELECT id, name, sort_order, created_at 
         FROM menu_categories 
         WHERE restaurant_id = $1 
         ORDER BY sort_order ASC, name ASC`,
        [tenantId]
      ),
      db.query(
        `SELECT id, category_id, name, description, price, is_available, 
                image_url, tags, created_at 
         FROM menu_items 
         WHERE restaurant_id = $1 AND is_available = true 
         ORDER BY name ASC`,
        [tenantId]
      )
    ]);

    res.json({
      categories: categoriesRes.rows,
      items: itemsRes.rows,
      restaurant: {
        id: tenantId,
        name: req.apiKey.restaurantName,
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('API v1 GET /menu error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve menu' },
      request_id: req.requestId
    });
  }
});

// ── 2. GET /api/v1/orders (Scope: orders:read) ────────────────────────────
router.get('/orders', requireScope('orders:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const { status, source, date_from, date_to, cursor } = req.query;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  try {
    const conditions = ['restaurant_id = $1'];
    const params = [tenantId];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (source) {
      params.push(source);
      conditions.push(`order_source = $${params.length}`);
    }

    if (date_from) {
      params.push(date_from);
      conditions.push(`created_at >= $${params.length}::timestamptz`);
    }

    if (date_to) {
      params.push(date_to);
      conditions.push(`created_at <= $${params.length}::timestamptz`);
    }

    // Cursor pagination parsing: base64(created_at|id)
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorCreatedAt, cursorId] = decoded.split('|');
        if (cursorCreatedAt && cursorId) {
          params.push(cursorCreatedAt, cursorId);
          conditions.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
        }
      } catch (err) {
        // Ignore invalid cursor format
      }
    }

    params.push(limit + 1);
    const query = `
      SELECT id, local_id as order_number, status, payment_status, 
             subtotal, tax_amount, discount_amount, delivery_fee, total,
             order_source, customer_phone, customer_name, customer_id, 
             pickup_time, delivery_address, created_at, updated_at
      FROM orders
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}
    `;

    const { rows } = await db.query(query, params);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64');
    }

    res.json({
      data,
      next_cursor: nextCursor,
      has_more: hasMore,
      limit,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('API v1 GET /orders error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve orders' },
      request_id: req.requestId
    });
  }
});

// ── 3. GET /api/v1/orders/:id (Scope: orders:read) ────────────────────────
router.get('/orders/:id', requireScope('orders:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const orderId = req.params.id;

  try {
    const { rows: orderRows } = await db.query(
      `SELECT o.*, o.local_id as order_number,
              c.name as registered_customer_name, c.points as customer_loyalty_points
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1 AND o.restaurant_id = $2`,
      [orderId, tenantId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
        request_id: req.requestId
      });
    }

    const order = orderRows[0];

    const [itemsRes, paymentsRes] = await Promise.all([
      db.query(
        `SELECT id, menu_item_id, menu_item_name, quantity, unit_price, notes, status, created_at
         FROM order_items 
         WHERE order_id = $1`,
        [orderId]
      ),
      db.query(
        `SELECT id, method, amount, currency, reference, status, confirmed_at, created_at
         FROM payments 
         WHERE order_id = $1`,
        [orderId]
      )
    ]);

    order.items = itemsRes.rows;
    order.payments = paymentsRes.rows;

    res.json({
      order,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('API v1 GET /orders/:id error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve order details' },
      request_id: req.requestId
    });
  }
});

// ── 4. POST /api/v1/orders (Scope: orders:write, Idempotent) ──────────────
router.post('/orders', requireScope('orders:write'), async (req, res) => {
  const tenantId = req.tenantId;
  const idempotencyKey = req.headers['idempotency-key'] ? String(req.headers['idempotency-key']).trim() : null;

  // 1. Check idempotency record if key provided
  if (idempotencyKey) {
    try {
      const { rows: idemRows } = await db.query(
        `SELECT response_status, response_body 
         FROM api_idempotency_records 
         WHERE restaurant_id = $1 AND idempotency_key = $2`,
        [tenantId, idempotencyKey]
      );

      if (idemRows.length > 0) {
        const cached = idemRows[0];
        return res.status(cached.response_status).json({
          ...cached.response_body,
          idempotent_replay: true,
          request_id: req.requestId
        });
      }
    } catch (err) {
      console.warn('[Idempotency] Lookup warning:', err.message);
    }
  }

  const {
    items = [],
    order_type = 'dine_in',
    customer_phone,
    customer_name,
    delivery_address,
    notes,
    table_id,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Order must contain at least one item' },
      request_id: req.requestId
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Calculate verified totals with computeOrderTotals
    let pricing;
    try {
      pricing = await computeOrderTotals(client, tenantId, items, null, {
        orderType: order_type,
      });
    } catch (pricingErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: { code: 'PRICING_ERROR', message: pricingErr.message },
        request_id: req.requestId
      });
    }

    // Resolve optional customer by phone
    let customerId = null;
    if (customer_phone) {
      const cleanPhone = customer_phone.trim();
      const { rows: custRows } = await client.query(
        `SELECT id FROM customers WHERE restaurant_id = $1 AND phone = $2 LIMIT 1`,
        [tenantId, cleanPhone]
      );
      if (custRows.length > 0) customerId = custRows[0].id;
    }

    // Insert order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders 
        (restaurant_id, customer_id, customer_name, customer_phone, delivery_address, notes, table_id,
         status, payment_status, subtotal, tax_amount, discount_amount, delivery_fee, total, order_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending', $8, $9, $10, $11, $12, 'partner_api')
       RETURNING *`,
      [
        tenantId,
        customerId,
        customer_name || null,
        customer_phone || null,
        delivery_address || null,
        notes || null,
        table_id || null,
        pricing.subtotal,
        pricing.taxAmount,
        pricing.discountAmount,
        pricing.deliveryFee,
        pricing.total,
      ]
    );

    const order = orderRows[0];

    // Insert order items
    const insertedItems = [];
    for (const it of pricing.validatedItems) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO order_items 
          (order_id, menu_item_id, menu_item_name, quantity, unit_price, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [order.id, it.menu_item_id, it.menu_item_name || it.name, it.quantity, it.unit_price, it.notes || null]
      );
      insertedItems.push(itemRows[0]);
    }

    order.items = insertedItems;

    // Save idempotency record if key provided
    const responsePayload = {
      order,
      request_id: req.requestId
    };

    if (idempotencyKey) {
      await client.query(
        `INSERT INTO api_idempotency_records 
          (restaurant_id, idempotency_key, resource_type, resource_id, response_status, response_body)
         VALUES ($1, $2, 'order', $3, 201, $4)
         ON CONFLICT (restaurant_id, idempotency_key) DO NOTHING`,
        [tenantId, idempotencyKey, order.id, JSON.stringify(responsePayload)]
      );
    }

    await client.query('COMMIT');

    // Dispatch order.created webhook
    dispatchWebhookEvent(tenantId, 'order.created', {
      order_id: order.id,
      order_number: order.local_id,
      total: order.total,
      status: order.status,
      items: insertedItems.map(i => ({ name: i.menu_item_name, qty: i.quantity, price: i.unit_price })),
      created_at: order.created_at,
    }).catch(() => {});

    res.status(201).json(responsePayload);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('API v1 POST /orders error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' },
      request_id: req.requestId
    });
  } finally {
    client.release();
  }
});

// ── 5. PATCH /api/v1/orders/:id/status (Scope: orders:write) ──────────────
const VALID_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  served: ['completed'],
  delivered: ['completed'],
  cancelled: [],
  completed: []
};

router.patch('/orders/:id/status', requireScope('orders:write'), async (req, res) => {
  const tenantId = req.tenantId;
  const orderId = req.params.id;
  const { status: targetStatus, reason } = req.body;

  if (!targetStatus) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Target status is required' },
      request_id: req.requestId
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
      [orderId, tenantId]
    );

    if (orderRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
        request_id: req.requestId
      });
    }

    const order = orderRows[0];
    const currentStatus = order.status;

    // Check transition validity
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot transition order status from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowed.join(', ')}]`
        },
        request_id: req.requestId
      });
    }

    // If cancelling, restore inventory ingredients
    if (targetStatus === 'cancelled') {
      const { rows: items } = await client.query(
        `SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1 AND menu_item_id IS NOT NULL`,
        [orderId]
      );

      for (const item of items) {
        const { rows: ings } = await client.query(
          `SELECT inventory_item_id, quantity_required FROM menu_item_ingredients WHERE menu_item_id = $1`,
          [item.menu_item_id]
        );
        for (const ing of ings) {
          const restoreQty = Number(ing.quantity_required) * Number(item.quantity);
          await client.query(
            `UPDATE inventory_items SET quantity = quantity + $1 WHERE id = $2`,
            [restoreQty, ing.inventory_item_id]
          );
        }
      }
    }

    // Update order status
    const updateQuery = (targetStatus === 'cancelled' && reason)
      ? `UPDATE orders 
         SET status = $1, notes = COALESCE(notes || ' | Cancelled: ' || $2, 'Cancelled: ' || $2), updated_at = NOW() 
         WHERE id = $3 
         RETURNING *`
      : `UPDATE orders 
         SET status = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`;
    const updateParams = (targetStatus === 'cancelled' && reason)
      ? [targetStatus, reason, orderId]
      : [targetStatus, orderId];

    const { rows: updatedRows } = await client.query(updateQuery, updateParams);

    await client.query('COMMIT');

    const updatedOrder = updatedRows[0];

    // Dispatch webhook
    dispatchWebhookEvent(tenantId, 'order.status_changed', {
      order_id: updatedOrder.id,
      previous_status: currentStatus,
      new_status: targetStatus,
      reason: reason || null,
      updated_at: updatedOrder.updated_at,
    }).catch(() => {});

    res.json({
      order: updatedOrder,
      message: `Order status successfully transitioned from '${currentStatus}' to '${targetStatus}'`,
      request_id: req.requestId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('API v1 PATCH /orders/:id/status error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' },
      request_id: req.requestId
    });
  } finally {
    client.release();
  }
});

// ── 6. GET /api/v1/customers (Scope: customers:read) ──────────────────────
router.get('/customers', requireScope('customers:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  try {
    const { rows } = await db.query(
      `SELECT id, name, 
              CASE WHEN is_anonymized THEN 'REDACTED' ELSE phone END as phone,
              email, points, tier, total_spent, order_count, last_visit_at, created_at
       FROM customers
       WHERE restaurant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    res.json({
      data: rows,
      limit,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('API v1 GET /customers error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve customers' },
      request_id: req.requestId
    });
  }
});

// ── 7. GET /api/v1/reports/sales-summary (Scope: reports:read) ───────────
router.get('/reports/sales-summary', requireScope('reports:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const dateFrom = req.query.date_from || new Date().toISOString().split('T')[0];
  const dateTo = req.query.date_to || new Date().toISOString().split('T')[0];

  try {
    const [salesRes, paymentsRes] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total_orders,
                COALESCE(SUM(total), 0) as gross_sales,
                COALESCE(SUM(subtotal), 0) as net_sales,
                COALESCE(SUM(tax_amount), 0) as tax_total,
                COALESCE(SUM(discount_amount), 0) as discount_total,
                COALESCE(SUM(delivery_fee), 0) as delivery_fees
         FROM orders
         WHERE restaurant_id = $1 
           AND status != 'cancelled'
           AND created_at::date >= $2::date 
           AND created_at::date <= $3::date`,
        [tenantId, dateFrom, dateTo]
      ),
      db.query(
        `SELECT method, 
                COUNT(*) as count, 
                COALESCE(SUM(amount), 0) as total_amount
         FROM payments
         WHERE restaurant_id = $1 
           AND status = 'confirmed'
           AND created_at::date >= $2::date 
           AND created_at::date <= $3::date
         GROUP BY method`,
        [tenantId, dateFrom, dateTo]
      )
    ]);

    const sales = salesRes.rows[0];
    const paymentMethods = paymentsRes.rows.reduce((acc, row) => {
      acc[row.method] = {
        count: parseInt(row.count, 10),
        amount: parseFloat(row.total_amount)
      };
      return acc;
    }, {});

    res.json({
      date_from: dateFrom,
      date_to: dateTo,
      total_orders: parseInt(sales.total_orders, 10),
      gross_sales: parseFloat(sales.gross_sales),
      net_sales: parseFloat(sales.net_sales),
      tax_total: parseFloat(sales.tax_total),
      discount_total: parseFloat(sales.discount_total),
      delivery_fees: parseFloat(sales.delivery_fees),
      payment_methods: paymentMethods,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('API v1 GET /reports/sales-summary error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate sales summary' },
      request_id: req.requestId
    });
  }
});

module.exports = router;
