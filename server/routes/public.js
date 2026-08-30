const express = require('express');
const db = require('../config/db');
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
    "SELECT * FROM restaurants WHERE status = 'active' AND (id::text = $1 OR LOWER(slug) = $1)",
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
router.post('/order', async (req, res) => {
  const {
    restaurant_id,
    order_type = 'dine_in',
    order_source = 'qr_code',
    table_id,
    customer_name,
    customer_phone,
    customer_address,
    pickup_time,
    notes,
    payment_mode = 'pay_at_checkout',
    items = [],
  } = req.body;

  if (!restaurant_id) return res.status(400).json({ error: 'restaurant_id is required' });
  if (!items || items.length === 0) return res.status(400).json({ error: 'Order must contain at least one item' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify restaurant status & online ordering availability
    const restRes = await client.query(
      'SELECT id, name, tax_rate, tax_inclusive, service_charge_enabled, service_charge_percent, operating_hours, online_ordering_enabled FROM restaurants WHERE id = $1 AND status = \'active\'',
      [restaurant_id]
    );
    if (!restRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Restaurant is not active' });
    }

    const rest = restRes.rows[0];
    if (rest.online_ordering_enabled === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Online ordering is currently disabled for this restaurant' });
    }

    // 2. Check operating hours
    const isOpen = checkIsOpen(rest.operating_hours);
    if (!isOpen && order_type === 'dine_in') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Restaurant is currently closed for ordering' });
    }

    // 3. Calculate order subtotal, tax, service charge, total
    let subtotal = 0;
    for (const item of items) {
      subtotal += (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
    }

    const taxRate = Number(rest.tax_rate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    let serviceCharge = 0;
    if (rest.service_charge_enabled && Number(rest.service_charge_percent) > 0) {
      serviceCharge = (subtotal * Number(rest.service_charge_percent)) / 100;
    }

    const total = subtotal + taxAmount + serviceCharge;

    const localId = `CUST-${Date.now().toString().slice(-6)}`;
    const paymentStatus = (payment_mode === 'online_paid') ? 'paid' : 'pending';

    // 4. Insert order
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
        customer_name || 'Online Customer',
        customer_phone || null,
        customer_address || null,
        pickup_time || null,
        notes || null,
        localId,
        paymentStatus,
        payment_mode,
      ]
    );

    const order = orderRes.rows[0];

    // 5. Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, modifier_choices, notes, status, station)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
        [
          order.id,
          item.menu_item_id || null,
          item.menu_item_name,
          item.quantity || 1,
          item.unit_price || 0,
          JSON.stringify(item.modifier_choices || []),
          item.notes || null,
          item.station || 'General',
        ]
      );
    }

    // 6. Update table status if dine_in
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
    console.error('Public order submission error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    client.release();
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

module.exports = router;
