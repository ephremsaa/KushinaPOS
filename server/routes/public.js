const express = require('express');
const db = require('../config/db');
const { notify } = require('../utils/notifyService');
const { publicOrderLimiter } = require('../middleware/rateLimit');
const { computeOrderTotals } = require('../utils/orderPricing');
const router = express.Router();

// Helper: Check operating hours
function checkIsOpen(operatingHours) {
  if (!operatingHours || Object.keys(operatingHours).length === 0) return true;

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date();
  const dayName = days[now.getDay()];
  const dayConfig = operatingHours[dayName];

  if (!dayConfig || dayConfig.closed) return false;
  if (!dayConfig.open || !dayConfig.close) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = dayConfig.open.split(':').map(Number);
  const [closeH, closeM] = dayConfig.close.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes < openMinutes) {
    // Overnight hours (e.g. 18:00 - 02:00)
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

// Helper: Resilient active restaurant lookup
async function findActiveRestaurant(slugOrId) {
  if (!slugOrId) return null;
  const cleaned = slugOrId.trim().toLowerCase();

  // 1. Exact match (UUID or exact slug)
  const exact = await db.query(
    "SELECT * FROM restaurants WHERE status = 'active' AND (id::text = $1 OR LOWER(slug) = $1 OR previous_slugs @> jsonb_build_array($1::text))",
    [cleaned]
  );
  if (exact.rows[0]) return exact.rows[0];

  // 2. Fuzzy match (typos in slug, name hyphenation, or ID prefix match like e14740)
  const fuzzy = await db.query(
    `SELECT * FROM restaurants 
     WHERE status = 'active' AND (
       LOWER(slug) ILIKE $1 
       OR LOWER(REPLACE(name, ' ', '-')) ILIKE $1 
       OR id::text ILIKE $1 || '%'
       OR $1 ILIKE '%' || SUBSTRING(id::text FROM 1 FOR 6) || '%'
       OR LOWER(slug) ILIKE '%' || $2 || '%'
     )
     ORDER BY created_at DESC LIMIT 1`,
    [`%${cleaned}%`, cleaned.split('-')[0] || cleaned]
  );
  if (fuzzy.rows[0]) return fuzzy.rows[0];

  // 3. Fallback: single active restaurant fallback
  const fallback = await db.query("SELECT * FROM restaurants WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
  return fallback.rows[0] || null;
}

// ── GET /api/public/restaurant/:slugOrId ──────────────────────
router.get('/restaurant/:slugOrId', async (req, res) => {
  const { slugOrId } = req.params;
  try {
    const r = await findActiveRestaurant(slugOrId);
    if (!r) return res.status(404).json({ error: 'Restaurant not found or inactive' });

    const isOpen = checkIsOpen(r.operating_hours);

    res.json({
      id: r.id,
      name: r.name,
      slug: r.slug,
      logo_url: r.logo_url,
      address: r.address,
      city: r.city,
      phone: r.phone,
      cuisine_type: r.cuisine_type,
      tax_rate: r.tax_rate || 0,
      tax_inclusive: r.tax_inclusive || false,
      extra_tax_rates: r.extra_tax_rates || [],
      service_charge_enabled: r.service_charge_enabled || false,
      service_charge_percent: r.service_charge_percent || 0,
      theme_color: r.theme_color || '#f97316',
      background_color: r.background_color || '#f1f5f9',
      currency: r.currency || 'ETB',
      online_ordering_enabled: r.online_ordering_enabled !== false,
      operating_hours: r.operating_hours || {},
      receipt_header: r.receipt_header || null,
      is_open: isOpen,
    });
  } catch (err) {
    console.error('Public restaurant fetch error:', err);
    res.status(500).json({ error: 'Failed to load restaurant details' });
  }
});

// ── GET /api/public/restaurant/:slugOrId/menu ─────────────────
router.get('/restaurant/:slugOrId/menu', async (req, res) => {
  const { slugOrId } = req.params;
  try {
    const r = await findActiveRestaurant(slugOrId);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    const restaurantId = r.id;

    // Categories
    const catRes = await db.query(
      'SELECT id, name, sort_order FROM menu_categories WHERE restaurant_id = $1 AND is_visible = true ORDER BY sort_order ASC, name ASC',
      [restaurantId]
    );

    // Items
    const itemRes = await db.query(
      `SELECT id, category_id, name, description, price, image_url, is_available, preparation_time_minutes, tags
       FROM menu_items 
       WHERE restaurant_id = $1 AND is_available = true 
       ORDER BY sort_order ASC, name ASC`,
      [restaurantId]
    );

    // Modifiers (if any)
    const modRes = await db.query(
      `SELECT m.id, m.menu_item_id, m.name, m.is_required, m.min_select, m.max_select,
              json_agg(
                json_build_object(
                  'id', o.id,
                  'label', o.label,
                  'price_delta', o.price_delta
                ) ORDER BY o.sort_order
              ) as options
       FROM menu_modifiers m
       JOIN menu_modifier_options o ON o.modifier_id = m.id
       WHERE m.restaurant_id = $1
       GROUP BY m.id ORDER BY m.sort_order`,
      [restaurantId]
    ).catch(() => ({ rows: [] }));

    res.json({
      categories: catRes.rows,
      items: itemRes.rows,
      modifiers: modRes.rows || [],
    });
  } catch (err) {
    console.error('Public menu fetch error:', err);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

// ── GET /api/public/restaurant/:slugOrId/table/:tableIdOrLabel ──
router.get('/restaurant/:slugOrId/table/:tableIdOrLabel', async (req, res) => {
  const { slugOrId, tableIdOrLabel } = req.params;
  try {
    const r = await findActiveRestaurant(slugOrId);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    const restaurantId = r.id;

    const isTableUuid = /^[0-9a-fA-F-]{36}$/.test(tableIdOrLabel);
    const tableRes = await db.query(
      isTableUuid
        ? 'SELECT id, label, capacity, shape, status FROM tables WHERE id = $1 AND restaurant_id = $2'
        : 'SELECT id, label, capacity, shape, status FROM tables WHERE (label ILIKE $1 OR id::text = $1) AND restaurant_id = $2',
      [tableIdOrLabel, restaurantId]
    );

    if (!tableRes.rows[0]) return res.status(404).json({ error: 'Table not found' });
    res.json(tableRes.rows[0]);
  } catch (err) {
    console.error('Public table fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch table' });
  }
});

// ── POST /api/public/order ────────────────────────────────────
router.post('/order', publicOrderLimiter, async (req, res) => {
  try {
    const {
      restaurant_id,
      order_type = 'dine_in',
      order_source = 'qr_code',
      table_id,
      payment_mode = 'pay_at_checkout',
      items = [],
    } = req.body;

    if (!restaurant_id) return res.status(400).json({ error: 'restaurant_id is required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order must contain at least one item' });

    // Validate and cap string lengths
    const customer_name = String(req.body.customer_name || '').slice(0, 50) || 'Online Customer';
    const customer_phone = req.body.customer_phone ? String(req.body.customer_phone).slice(0, 20) : null;
    const customer_address = req.body.customer_address ? String(req.body.customer_address).slice(0, 200) : null;
    const pickup_time = req.body.pickup_time ? String(req.body.pickup_time).slice(0, 50) : null;
    const notes = req.body.notes ? String(req.body.notes).slice(0, 200) : null;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify restaurant status & online ordering availability
      const restRes = await client.query(
        'SELECT id, name, tax_rate, tax_inclusive, service_charge_enabled, service_charge_percent, operating_hours, online_ordering_enabled FROM restaurants WHERE id = $1 AND status = \'active\'',
        [restaurant_id]
      );
      if (!restRes.rows[0]) {
        throw new Error('Restaurant is not active');
      }

      const rest = restRes.rows[0];
      if (rest.online_ordering_enabled === false) {
        throw new Error('Online ordering is disabled');
      }

      // 2. Check operating hours
      if (!checkIsOpen(rest.operating_hours) && order_type === 'dine_in') {
        throw new Error('Restaurant is currently closed for ordering');
      }

      // 3. Verify Table
      if (table_id) {
        const tableRes = await client.query('SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2', [table_id, restaurant_id]);
        if (!tableRes.rows[0]) throw new Error('Invalid table_id for this restaurant');
      }

      // 4. Calculate items, subtotal, and validate securely via shared helper
      const { subtotal, taxAmount, total, validatedItems } = await computeOrderTotals(client, restaurant_id, items, null);

      const localId = `CUST-${Date.now().toString().slice(-6)}`;
      const paymentStatus = 'pending'; // Always pending for new public orders
      const safePaymentMode = payment_mode === 'online_paid' ? 'pay_at_checkout' : String(payment_mode).slice(0, 50);

      // Insert order
      const orderRes = await client.query(
        `INSERT INTO orders
          (restaurant_id, table_id, order_type, order_source, status, subtotal, tax_amount, discount_amount, total, 
           customer_name, customer_phone, customer_address, pickup_time, notes, local_id, payment_status, payment_method, synced_at)
         VALUES ($1, $2, $3, $4, 'new', $5, $6, 0, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         RETURNING *`,
        [
          restaurant_id,
          table_id || null,
          order_type,
          order_source,
          subtotal,
          taxAmount,
          total,
          customer_name,
          customer_phone,
          customer_address,
          pickup_time,
          notes,
          localId,
          paymentStatus,
          safePaymentMode,
        ]
      );

      const order = orderRes.rows[0];

      // Insert order items
      for (const item of validatedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, modifier_choices, notes, status, station)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
          [
            order.id,
            item.menu_item_id,
            item.menu_item_name,
            item.quantity,
            item.unit_price,
            JSON.stringify(item.modifier_choices),
            item.notes,
            item.station,
          ]
        );
      }

      // Update table status if dine_in
      if (table_id) {
        await client.query(
          "UPDATE tables SET status = 'occupied', updated_at = NOW() WHERE id = $1 AND restaurant_id = $2",
          [table_id, restaurant_id]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        order_id: order.id,
        local_id: order.local_id,
        status: order.status,
        total: order.total,
        created_at: order.created_at,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Public order submission transaction error:', err.message);
      res.status(400).json({ error: 'Failed to place order: ' + (err.message.includes('Invalid') || err.message.includes('unavailable') || err.message.includes('closed') ? err.message : 'Please check your items and try again.') });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Public order route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/public/order-status/:orderId ──────────────────────
router.get('/order-status/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT o.id, o.local_id, o.status, o.order_type, o.order_source, o.total, o.subtotal, o.tax_amount,
              o.customer_name, o.customer_phone, o.customer_address, o.pickup_time, o.created_at, o.updated_at,
              t.label as table_label, r.name as restaurant_name, r.logo_url as restaurant_logo, r.phone as restaurant_phone,
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'menu_item_name', oi.menu_item_name,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'notes', oi.notes,
                  'modifier_choices', oi.modifier_choices,
                  'status', oi.status
                ) ORDER BY oi.created_at
              ) FILTER (WHERE oi.id IS NOT NULL) as order_items
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, t.label, r.name, r.logo_url, r.phone`,
      [orderId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json({ ...rows[0], order_items: rows[0].order_items || [] });
  } catch (err) {
    console.error('Order status fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// ── POST /api/public/call-waiter ──────────────────────────────
router.post('/call-waiter', publicOrderLimiter, async (req, res) => {
  const { restaurant_id, table_label, request_type = 'general', notes } = req.body;
  if (!restaurant_id || !table_label) {
    return res.status(400).json({ error: 'Restaurant and table are required' });
  }

  try {
    const actionLabel = request_type === 'bill'
      ? 'Requesting Bill / Check 🧾'
      : request_type === 'water'
      ? 'Requesting Water / Napkins 💧'
      : 'Calling Waiter Assistance 🙋‍♂️';

    const title = `🔔 Table ${table_label}: ${actionLabel}`;
    const message = notes 
      ? `Table ${table_label} requested: ${actionLabel}. Note: "${notes}"`
      : `Table ${table_label} needs assistance: ${actionLabel}.`;

    await notify({
      restaurant_id,
      type: 'new_online_order',
      title,
      message,
      target_role: 'all',
      metadata: { table_label, request_type, notes },
    });

    res.json({
      success: true,
      message: 'Staff has been notified! A team member will assist you shortly.',
    });
  } catch (err) {
    console.error('Call waiter error:', err);
    res.status(500).json({ error: 'Failed to notify staff' });
  }
});

module.exports = router;
