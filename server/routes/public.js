const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { notify } = require('../utils/notifyService');
const { publicOrderLimiter, leadsLimiter, publicGeneralLimiter } = require('../middleware/rateLimit');
const { computeOrderTotals } = require('../utils/orderPricing');
const { hasPlanFeature } = require('../middleware/planLimits');
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
router.get('/restaurant/:slugOrId', publicGeneralLimiter, async (req, res) => {
  const { slugOrId } = req.params;
  try {
    let r = await findActiveRestaurant(slugOrId);
    if (!r) {
      const anyStatus = await db.query(
        "SELECT id, name, slug, status, rejection_reason FROM restaurants WHERE id::text = $1 OR LOWER(slug) = $1 OR previous_slugs @> jsonb_build_array($1::text) ORDER BY created_at DESC LIMIT 1",
        [slugOrId.trim().toLowerCase()]
      );
      if (anyStatus.rows[0]) {
        return res.json({
          id: anyStatus.rows[0].id,
          name: anyStatus.rows[0].name,
          slug: anyStatus.rows[0].slug,
          status: anyStatus.rows[0].status,
          rejection_reason: anyStatus.rows[0].rejection_reason,
          is_open: false,
        });
      }
      return res.status(404).json({ error: 'Restaurant not found or inactive' });
    }

    const isOpen = checkIsOpen(r.operating_hours);

    // Fetch active delivery zones for this restaurant
    const zonesRes = await db.query(
      'SELECT id, name, fee, min_order_amount, estimated_minutes FROM delivery_zones WHERE restaurant_id = $1 AND is_active = true ORDER BY name ASC',
      [r.id]
    ).catch(() => ({ rows: [] }));

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
      online_pickup_enabled: r.online_pickup_enabled !== false,
      online_delivery_enabled: r.online_delivery_enabled !== false,
      online_auto_accept: r.online_auto_accept === true,
      online_prep_time_minutes: r.online_prep_time_minutes || 25,
      online_max_active_orders: r.online_max_active_orders || 20,
      online_payment_methods: r.online_payment_methods || ['cash', 'telebirr', 'cbe_birr'],
      delivery_zones: zonesRes.rows || [],
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
router.get('/restaurant/:slugOrId/menu', publicGeneralLimiter, async (req, res) => {
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
router.get('/restaurant/:slugOrId/table/:tableIdOrLabel', publicGeneralLimiter, async (req, res) => {
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
      const { subtotal, taxAmount, deliveryFee, total, validatedItems } = await computeOrderTotals(client, restaurant_id, items, null, {
        orderType: order_type,
      });

      const localId = `CUST-${Date.now().toString().slice(-6)}`;
      const paymentStatus = 'pending'; // Always pending for new public orders
      const safePaymentMode = payment_mode === 'online_paid' ? 'pay_at_checkout' : String(payment_mode).slice(0, 50);

      // Insert order
      const orderRes = await client.query(
        `INSERT INTO orders
          (restaurant_id, table_id, order_type, order_source, status, subtotal, tax_amount, discount_amount, delivery_fee, delivery_address, total, 
           customer_name, customer_phone, customer_address, pickup_time, notes, local_id, payment_status, payment_method, synced_at)
         VALUES ($1, $2, $3, $4, 'new', $5, $6, 0, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
         RETURNING *`,
        [
          restaurant_id,
          table_id || null,
          order_type,
          order_source,
          subtotal,
          taxAmount,
          deliveryFee || 0,
          customer_address || null,
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
router.get('/order-status/:orderId', publicGeneralLimiter, async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT o.id, o.local_id, o.status, o.order_type, o.order_source, o.total, o.subtotal, o.tax_amount,
              o.customer_name, o.customer_phone, o.customer_address, o.pickup_time, o.created_at, o.updated_at,
              c.points as customer_points,
              COALESCE((SELECT points FROM loyalty_transactions WHERE order_id = o.id AND type = 'earn' LIMIT 1), 0) as points_earned,
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
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, c.points, t.label, r.name, r.logo_url, r.phone`,
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

// ── POST /api/public/leads ────────────────────────────────────
// Rate limited: 5 per hour per IP. Validation, honeypot, no auth required.
router.post('/leads', leadsLimiter, async (req, res) => {
  const {
    name,
    business_name,
    phone,
    email,
    branches,
    interest,
    preferred_contact_time,
    source_page,
    language,
    website,
    hp_bot_field
  } = req.body;

  // 1. Honeypot check: If bot filled hidden field, return success silently without inserting
  if (website || hp_bot_field) {
    console.warn('🤖 [BOT HONEYPOT TRIGGERED] Ignored lead submission from IP:', req.ip);
    return res.json({
      success: true,
      message: language === 'am'
        ? 'እናመሰግናለን፤ በአንድ የስራ ቀን ውስጥ እንደውላለን።'
        : 'Thanks, we will call you within one business day.'
    });
  }

  // 2. Validate mandatory fields
  const trimmedName = String(name || '').trim();
  const trimmedBusiness = String(business_name || '').trim();
  const trimmedPhone = String(phone || '').trim().replace(/[\s-]/g, '');

  if (!trimmedName) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!trimmedBusiness) {
    return res.status(400).json({ error: 'Restaurant / business name is required' });
  }
  if (!trimmedPhone || trimmedPhone.length < 9) {
    return res.status(400).json({ error: 'A valid phone number is required' });
  }

  // Basic email syntax check if provided
  let trimmedEmail = null;
  if (email && String(email).trim()) {
    trimmedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }
  }

  try {
    const insertRes = await db.query(
      `INSERT INTO leads (
        name, business_name, phone, email, branches, 
        interest, preferred_contact_time, source_page, language, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')
      RETURNING *`,
      [
        trimmedName,
        trimmedBusiness,
        trimmedPhone,
        trimmedEmail,
        branches ? String(branches).trim() : '1',
        interest ? String(interest).trim() : 'Full POS + KDS',
        preferred_contact_time ? String(preferred_contact_time).trim() : 'Anytime',
        source_page ? String(source_page).trim() : '/',
        language === 'am' ? 'am' : 'en'
      ]
    );

    const lead = insertRes.rows[0];

    // In-app & Platform Admin notification:
    console.log(`\n🔔 [NEW LEAD RECEIVED]`, {
      id: lead.id,
      name: lead.name,
      business: lead.business_name,
      phone: lead.phone,
      interest: lead.interest,
      branches: lead.branches,
      time: lead.preferred_contact_time
    });

    // Optional Telegram / Webhook notification if environment variable configured:
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
      try {
        const text = `🔔 *New Lead Alert (KushinaPOS)*\n\n👤 *Name:* ${lead.name}\n🏢 *Venue:* ${lead.business_name}\n📞 *Phone:* \`${lead.phone}\`\n📧 *Email:* ${lead.email || 'N/A'}\n🏬 *Branches:* ${lead.branches}\n🎯 *Interest:* ${lead.interest}\n⏰ *Preferred Time:* ${lead.preferred_contact_time}\n🌐 *Source Page:* ${lead.source_page}`;
        fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
            text,
            parse_mode: 'Markdown'
          })
        }).catch(err => console.error('Telegram notification error:', err.message));
      } catch (tgErr) {
        console.error('Telegram dispatch failed:', tgErr.message);
      }
    }

    res.status(201).json({
      success: true,
      lead_id: lead.id,
      message: language === 'am'
        ? 'እናመሰግናለን፤ በአንድ የስራ ቀን ውስጥ እንደውላለን።'
        : 'Thanks, we will call you within one business day.'
    });
  } catch (err) {
    console.error('Lead submission error:', err);
    res.status(500).json({ error: 'Failed to record inquiry. Please call us directly.' });
  }
});

// Helper: Normalize Ethiopian phone numbers to international +251 format
function normalizeEthiopianPhone(phone) {
  if (!phone) return null;
  let clean = String(phone).trim().replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('09') || clean.startsWith('07')) {
    clean = '+251' + clean.slice(1);
  } else if (clean.startsWith('9') || clean.startsWith('7')) {
    clean = '+251' + clean;
  } else if (clean.startsWith('251')) {
    clean = '+' + clean;
  }
  if (!/^\+251[79]\d{8}$/.test(clean)) return null;
  return clean;
}

// ── POST /api/public/online-order ─────────────────────────────
// Online ordering for pickup and delivery
router.post('/online-order', publicOrderLimiter, async (req, res) => {
  const {
    restaurant_id,
    slug,
    order_type = 'pickup', // 'pickup' | 'delivery'
    customer_name,
    customer_phone,
    delivery_zone_id,
    delivery_address,
    delivery_landmark,
    notes,
    payment_method = 'cash',
    payment_reference,
    payment_proof_url,
    scheduled_for,
    items = [],
    website,
    hp_bot_field,
    honeypot
  } = req.body;

  // 1. Honeypot check
  if (website || hp_bot_field || honeypot) {
    console.warn('🤖 [BOT HONEYPOT TRIGGERED] Rejected online order submission from IP:', req.ip);
    return res.status(400).json({ error: 'Bot submission rejected' });
  }

  // 2. Validate mandatory inputs
  const trimmedName = String(customer_name || '').trim().slice(0, 70);
  if (!trimmedName) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const normalizedPhone = normalizeEthiopianPhone(customer_phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid Ethiopian phone number (e.g. 0911234567 or +251911234567)' });
  }

  const normalizedType = order_type === 'delivery' ? 'delivery' : 'takeaway';

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 3. Lookup restaurant
    let restId = restaurant_id;
    if (!restId && slug) {
      const restBySlug = await client.query(
        "SELECT id FROM restaurants WHERE status = 'active' AND (LOWER(slug) = $1 OR previous_slugs @> jsonb_build_array($1::text)) LIMIT 1",
        [String(slug).toLowerCase().trim()]
      );
      if (restBySlug.rows[0]) restId = restBySlug.rows[0].id;
    }

    if (!restId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or missing restaurant identifier' });
    }

    const restRes = await client.query(
      `SELECT id, name, phone, status, operating_hours, tax_rate, tax_inclusive, 
              service_charge_enabled, service_charge_percent, default_delivery_fee,
              online_ordering_enabled, online_pickup_enabled, online_delivery_enabled,
              online_auto_accept, online_prep_time_minutes, online_max_active_orders,
              online_payment_methods
       FROM restaurants 
       WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [restId]
    );

    if (!restRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Restaurant not found or inactive' });
    }

    const rest = restRes.rows[0];

    // Check online ordering master switch
    if (rest.online_ordering_enabled === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Online ordering is currently turned off for this restaurant' });
    }

    // Check operating hours
    if (!checkIsOpen(rest.operating_hours)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Restaurant is currently closed. Online orders are not accepted outside operating hours.' });
    }

    // Mode-specific enablement
    if (normalizedType === 'takeaway' && rest.online_pickup_enabled === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pickup orders are currently disabled for this restaurant' });
    }

    let zoneRecord = null;
    let enforcedDeliveryFee = 0;

    if (normalizedType === 'delivery') {
      if (rest.online_delivery_enabled === false) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Delivery orders are currently disabled for this restaurant' });
      }

      // Check plan tier feature flag
      const deliveryAllowed = await hasPlanFeature(rest.id, 'delivery');
      if (!deliveryAllowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Delivery service is not supported by the restaurant subscription plan.' });
      }

      if (!delivery_zone_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Please select a delivery zone' });
      }

      const zoneRes = await client.query(
        `SELECT id, name, fee, min_order_amount, estimated_minutes 
         FROM delivery_zones 
         WHERE id = $1 AND restaurant_id = $2 AND is_active = true`,
        [delivery_zone_id, rest.id]
      );

      if (!zoneRes.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Selected delivery zone does not exist or is currently unavailable' });
      }

      zoneRecord = zoneRes.rows[0];
      enforcedDeliveryFee = Number(zoneRecord.fee) || 0;

      const cleanAddress = String(delivery_address || delivery_landmark || '').trim();
      if (!cleanAddress) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Delivery address or landmark is required' });
      }
    }

    // Check capacity: max active pending online orders
    const maxActive = rest.online_max_active_orders || 20;
    const activeOrdersRes = await client.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE restaurant_id = $1 AND order_source = 'online' AND status IN ('new', 'preparing') AND accept_status = 'pending'`,
      [rest.id]
    );
    if (parseInt(activeOrdersRes.rows[0].count, 10) >= maxActive) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'The restaurant is currently experiencing high volume. Please try placing your order again in a few minutes.' });
    }

    // 4. Secure server price calculation
    const pricing = await computeOrderTotals(client, rest.id, items, null, {
      orderType: normalizedType,
    });

    // Check minimum order amount for delivery zone
    if (zoneRecord && pricing.subtotal < Number(zoneRecord.min_order_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Minimum order amount for delivery to ${zoneRecord.name} is ${Number(zoneRecord.min_order_amount).toFixed(2)} ETB (current order: ${pricing.subtotal.toFixed(2)} ETB)`
      });
    }

    // Recalculate total with strictly enforced zone delivery fee
    const finalDeliveryFee = zoneRecord ? enforcedDeliveryFee : 0;
    const finalTotal = rest.tax_inclusive
      ? pricing.subtotal + pricing.serviceCharge + finalDeliveryFee
      : pricing.subtotal + pricing.taxAmount + pricing.serviceCharge + finalDeliveryFee;

    const roundedTotal = Math.round(finalTotal * 100) / 100;

    // Validate payment method
    const allowedPaymentMethods = Array.isArray(rest.online_payment_methods) && rest.online_payment_methods.length > 0
      ? rest.online_payment_methods
      : ['cash', 'telebirr', 'cbe_birr'];

    const safePaymentMethod = allowedPaymentMethods.includes(payment_method) ? payment_method : 'cash';

    // 5. Generate tracking token & auto-accept determination
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const isAutoAccept = rest.online_auto_accept === true;
    const acceptStatus = isAutoAccept ? 'accepted' : 'pending';
    const prepMinutes = rest.online_prep_time_minutes || 25;
    const estimatedReadyAt = isAutoAccept ? new Date(Date.now() + prepMinutes * 60000) : null;
    const acceptedAt = isAutoAccept ? new Date() : null;

    // 5. Automatic Customer Linking (find or create)
    let linkedCustomerId = null;
    const custRes = await client.query(
      `SELECT id FROM customers WHERE restaurant_id = $1 AND phone = $2 LIMIT 1`,
      [rest.id, normalizedPhone]
    );
    if (custRes.rows[0]) {
      linkedCustomerId = custRes.rows[0].id;
      await client.query(
        `UPDATE customers 
         SET name = COALESCE($1, name), 
             marketing_consent = CASE WHEN $2 = true THEN true ELSE marketing_consent END,
             updated_at = NOW() 
         WHERE id = $3`,
        [trimmedName, req.body.marketing_consent === true, linkedCustomerId]
      );
    } else {
      const newCust = await client.query(
        `INSERT INTO customers (restaurant_id, name, phone, marketing_consent, points, stamps, tier, total_spent, total_visits, order_count)
         VALUES ($1, $2, $3, $4, 0, 0, 'Bronze', 0, 0, 0)
         RETURNING id`,
        [rest.id, trimmedName, normalizedPhone, req.body.marketing_consent === true]
      );
      linkedCustomerId = newCust.rows[0].id;
    }

    const localId = `ONL-${Date.now().toString().slice(-6)}`;

    // Insert order (ALWAYS unpaid on creation)
    const orderRes = await client.query(
      `INSERT INTO orders
        (restaurant_id, order_type, order_source, status, subtotal, tax_amount, discount_amount, delivery_fee,
         delivery_address, delivery_landmark, delivery_zone_id, total, customer_name, customer_phone, notes,
         local_id, payment_status, payment_method, payment_reference, payment_proof_url,
         accept_status, tracking_token, accepted_at, estimated_ready_at, scheduled_for, customer_id, synced_at)
       VALUES ($1, $2, 'online', 'new', $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
       RETURNING *`,
      [
        rest.id,
        normalizedType,
        pricing.subtotal,
        pricing.taxAmount,
        finalDeliveryFee,
        delivery_address ? String(delivery_address).trim().slice(0, 250) : (delivery_landmark ? String(delivery_landmark).trim().slice(0, 250) : null),
        delivery_landmark ? String(delivery_landmark).trim().slice(0, 150) : null,
        zoneRecord ? zoneRecord.id : null,
        roundedTotal,
        trimmedName,
        normalizedPhone,
        notes ? String(notes).trim().slice(0, 200) : null,
        localId,
        safePaymentMethod,
        payment_reference ? String(payment_reference).trim().slice(0, 80) : null,
        payment_proof_url ? String(payment_proof_url).trim().slice(0, 300) : null,
        acceptStatus,
        trackingToken,
        acceptedAt,
        estimatedReadyAt,
        scheduled_for ? new Date(scheduled_for) : null,
        linkedCustomerId
      ]
    );

    const order = orderRes.rows[0];

    // Insert verified items
    for (const item of pricing.validatedItems) {
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
          item.station || 'kitchen'
        ]
      );
    }

    await client.query('COMMIT');

    // Notify staff via real-time notifyService
    try {
      const typeLabel = normalizedType === 'delivery' ? 'Delivery 🛵' : 'Pickup 🛍️';
      const zoneLabel = zoneRecord ? ` (${zoneRecord.name})` : '';
      await notify({
        restaurant_id: rest.id,
        type: 'new_online_order',
        title: `🔔 New Online Order #${order.local_id}: ${typeLabel}`,
        message: `${trimmedName} placed a ${typeLabel}${zoneLabel} order for ${roundedTotal.toFixed(2)} ETB (${pricing.validatedItems.length} items).`,
        target_role: 'all',
        metadata: {
          order_id: order.id,
          order_type: normalizedType,
          tracking_token: trackingToken,
          accept_status: acceptStatus,
          total: roundedTotal
        }
      });
    } catch (notifErr) {
      console.warn('Notification dispatch non-fatal warning:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      tracking_token: trackingToken,
      tracking_url: `/track/${trackingToken}`,
      accept_status: acceptStatus,
      order_type: normalizedType,
      total: roundedTotal,
      estimated_minutes: prepMinutes,
      created_at: order.created_at,
      order: {
        tracking_token: trackingToken,
        accept_status: acceptStatus,
        order_type: normalizedType,
        total: roundedTotal,
        customer_name: trimmedName,
        customer_phone: normalizedPhone,
        estimated_minutes: prepMinutes,
        created_at: order.created_at
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Online order submission error:', err);
    res.status(400).json({ error: err.message || 'Failed to place online order' });
  } finally {
    client.release();
  }
});

// ── GET /api/public/track/:token ──────────────────────────────
// Live customer tracking page data
router.get('/track/:token', publicGeneralLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 8) {
    return res.status(400).json({ error: 'Valid tracking token is required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT o.id, o.local_id, o.status, o.accept_status, o.rejection_reason, o.order_type, o.order_source,
              o.total, o.subtotal, o.tax_amount, o.delivery_fee, o.payment_method, o.payment_status,
              o.payment_reference, o.customer_name, o.customer_phone, o.delivery_address, o.delivery_landmark,
              o.driver_name, o.driver_phone, o.estimated_ready_at, o.accepted_at, o.out_for_delivery_at,
              o.delivered_at, o.created_at, o.updated_at,
              c.points as customer_points,
              COALESCE((SELECT points FROM loyalty_transactions WHERE order_id = o.id AND type = 'earn' LIMIT 1), 0) as points_earned,
              z.name as zone_name, z.estimated_minutes as zone_estimated_minutes,
              r.name as restaurant_name, r.phone as restaurant_phone, r.slug as restaurant_slug,
              r.address as restaurant_address, r.logo_url as restaurant_logo,
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'menu_item_name', oi.menu_item_name,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'modifier_choices', oi.modifier_choices,
                  'notes', oi.notes
                ) ORDER BY oi.created_at
              ) FILTER (WHERE oi.id IS NOT NULL) as items
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.tracking_token = $1
       GROUP BY o.id, c.points, z.name, z.estimated_minutes, r.name, r.phone, r.slug, r.address, r.logo_url`,
      [token]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Order not found or invalid tracking token' });
    }

    const orderData = rows[0];
    const { id, ...safeOrder } = orderData;
    res.json({
      order: {
        ...safeOrder,
        items: orderData.items || []
      },
      restaurant: {
        name: orderData.restaurant_name,
        phone: orderData.restaurant_phone,
        slug: orderData.restaurant_slug,
        address: orderData.restaurant_address,
        logo_url: orderData.restaurant_logo
      }
    });
  } catch (err) {
    console.error('Tracking query error:', err);
    res.status(500).json({ error: 'Failed to retrieve order tracking info' });
  }
});

// ── POST /api/public/integration-request ─────────────────────────
// Lead capture form for custom integration requests
router.post('/integration-request', leadsLimiter, async (req, res) => {
  const {
    restaurant_name,
    contact_name,
    email,
    phone,
    integration_name,
    use_case_notes
  } = req.body;

  if (!restaurant_name || !contact_name || !integration_name) {
    return res.status(400).json({ 
      error: 'Restaurant name, contact name, and integration name are required.' 
    });
  }

  if (!email && !phone) {
    return res.status(400).json({ 
      error: 'Please provide either an email or a phone number.' 
    });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO integration_requests 
        (restaurant_name, contact_name, email, phone, integration_name, use_case_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'new')
       RETURNING *`,
      [
        String(restaurant_name).trim().slice(0, 100),
        String(contact_name).trim().slice(0, 100),
        email ? String(email).trim().slice(0, 100) : null,
        phone ? String(phone).trim().slice(0, 50) : null,
        String(integration_name).trim().slice(0, 100),
        use_case_notes ? String(use_case_notes).trim().slice(0, 1000) : null
      ]
    );

    // Notify platform admin
    notify({
      restaurant_id: null,
      type: 'new_lead',
      title: '🔌 New Integration Request',
      message: `${contact_name} from ${restaurant_name} requested an integration with "${integration_name}".`,
      target_role: 'admin',
      metadata: { request_id: rows[0].id, integration_name }
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Thank you for your request! Our partner integrations team will be in touch shortly.',
      request: rows[0]
    });
  } catch (err) {
    console.error('Integration request error:', err);
    res.status(500).json({ error: 'Failed to record integration request' });
  }
});

module.exports = router;

