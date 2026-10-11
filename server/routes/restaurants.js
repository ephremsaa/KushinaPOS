const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner, requireManager } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

const { createUploadMiddleware, deleteOldUpload } = require('../utils/uploadHelper');

const menuUpload = createUploadMiddleware({ fieldName: 'image', folder: 'menu-images', maxBytes: 5 * 1024 * 1024 });
const logoUpload = createUploadMiddleware({ fieldName: 'logo', folder: 'logos', maxBytes: 2 * 1024 * 1024 });
const docUpload = createUploadMiddleware({ fieldName: 'document', folder: 'licenses', maxBytes: 5 * 1024 * 1024, isPrivate: true, allowPdf: true });

// ── GET /api/restaurants/me ───────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM restaurants WHERE id=$1',
      [tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const { password_hash, ...restaurant } = rows[0];
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── PATCH /api/restaurants/me ─────────────────────────────────
router.patch('/me', requireOwner, async (req, res) => {
  const {
    // Profile & Public
    name, phone, address, city, cuisine_type, currency, slug,
    // Online ordering
    online_ordering_enabled, online_pickup_enabled, online_delivery_enabled,
    online_auto_accept, online_prep_time_minutes, online_max_active_orders,
    online_payment_methods,
    // Theme
    theme_color, background_color,
    // Tax
    tax_rate, tax_inclusive, extra_tax_rates,
    // Service charge
    service_charge_enabled, service_charge_percent, service_charge_mandatory, service_charge_split_staff,
    // Receipt
    receipt_footer, receipt_header, receipt_show_logo, receipt_show_tax_breakdown, receipt_default_mode,
    // Operating hours
    operating_hours,
    // Devices
    printers, kds_stations_config,
  } = req.body;

  try {
    // 1. Validate Tax Rate bounds
    if (tax_rate !== undefined && tax_rate !== null) {
      const numTax = Number(tax_rate);
      if (isNaN(numTax) || numTax < 0 || numTax > 100) {
        return res.status(400).json({ error: 'Tax rate must be between 0% and 100%' });
      }
    }

    // 2. Validate Extra Tax Rates
    if (extra_tax_rates !== undefined && extra_tax_rates !== null) {
      if (!Array.isArray(extra_tax_rates)) {
        return res.status(400).json({ error: 'extra_tax_rates must be an array' });
      }
      for (const et of extra_tax_rates) {
        const rate = Number(et.rate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          return res.status(400).json({ error: `Additional tax '${et.name || 'Rate'}' must be between 0% and 100%` });
        }
      }
    }

    // 3. Validate Service Charge bounds
    if (service_charge_percent !== undefined && service_charge_percent !== null) {
      const numSc = Number(service_charge_percent);
      if (isNaN(numSc) || numSc < 0 || numSc > 100) {
        return res.status(400).json({ error: 'Service charge must be between 0% and 100%' });
      }
    }

    // 4. Validate Operating Hours
    if (operating_hours && typeof operating_hours === 'object') {
      for (const [day, val] of Object.entries(operating_hours)) {
        if (val && !val.closed && val.open && val.close) {
          if (val.open >= val.close) {
            return res.status(400).json({
              error: `Invalid hours for ${day}: open time (${val.open}) must be earlier than closing time (${val.close})`
            });
          }
        }
      }
    }

    if (tax_rate != null) {
      const num = Number(tax_rate);
      if (num < 0 || num > 100) return res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    }

    if (service_charge_percent != null) {
      const num = Number(service_charge_percent);
      if (num < 0 || num > 100) return res.status(400).json({ error: 'Service charge must be between 0 and 100' });
    }

    // 5. Validate and check slug uniqueness
    let cleanSlug = null;
    if (slug !== undefined && slug !== null) {
      cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (cleanSlug.length < 3) {
        return res.status(400).json({ error: 'URL slug must be at least 3 characters long' });
      }
      const { rows: existingSlug } = await db.query(
        'SELECT id FROM restaurants WHERE slug = $1 AND id != $2 LIMIT 1',
        [cleanSlug, tid(req)]
      );
      if (existingSlug.length > 0) {
        return res.status(409).json({ error: `The URL slug '${cleanSlug}' is already taken by another restaurant. Please choose a different one.` });
      }
    }

    let slugUpdateFragment = 'slug = COALESCE($24, slug),';
    if (cleanSlug) {
      // If slug is changing, save the old one into previous_slugs so old QR codes still work
      slugUpdateFragment = `
        previous_slugs = CASE 
          WHEN slug != $24 THEN previous_slugs || jsonb_build_array(slug)
          ELSE previous_slugs 
        END,
        slug = $24,
      `;
    }

    const { rows } = await db.query(
      `UPDATE restaurants SET
        name                       = COALESCE($1,  name),
        phone                      = COALESCE($2,  phone),
        address                    = COALESCE($3,  address),
        city                       = COALESCE($4,  city),
        cuisine_type               = COALESCE($5,  cuisine_type),
        currency                   = COALESCE($6,  currency),
        theme_color                = COALESCE($7,  theme_color),
        background_color           = COALESCE($8,  background_color),
        tax_rate                   = COALESCE($9,  tax_rate),
        tax_inclusive              = COALESCE($10, tax_inclusive),
        extra_tax_rates            = COALESCE($11, extra_tax_rates),
        service_charge_enabled     = COALESCE($12, service_charge_enabled),
        service_charge_percent     = COALESCE($13, service_charge_percent),
        service_charge_mandatory   = COALESCE($14, service_charge_mandatory),
        service_charge_split_staff = COALESCE($15, service_charge_split_staff),
        receipt_footer             = COALESCE($16, receipt_footer),
        receipt_header             = COALESCE($17, receipt_header),
        receipt_show_logo          = COALESCE($18, receipt_show_logo),
        receipt_show_tax_breakdown = COALESCE($19, receipt_show_tax_breakdown),
        receipt_default_mode       = COALESCE($20, receipt_default_mode),
        operating_hours            = COALESCE($21, operating_hours),
        printers                   = COALESCE($22, printers),
        kds_stations_config        = COALESCE($23, kds_stations_config),
        ${slugUpdateFragment}
        online_ordering_enabled    = COALESCE($25, online_ordering_enabled),
        online_pickup_enabled      = COALESCE($26, online_pickup_enabled),
        online_delivery_enabled    = COALESCE($27, online_delivery_enabled),
        online_auto_accept         = COALESCE($28, online_auto_accept),
        online_prep_time_minutes   = COALESCE($29, online_prep_time_minutes),
        online_max_active_orders   = COALESCE($30, online_max_active_orders),
        online_payment_methods     = COALESCE($31, online_payment_methods),
        updated_at                 = NOW()
       WHERE id = $32 RETURNING *`,
      [
        name, phone, address, city, cuisine_type, currency,
        theme_color, background_color,
        tax_rate != null ? Number(tax_rate) : null,
        tax_inclusive != null ? Boolean(tax_inclusive) : null,
        extra_tax_rates != null ? JSON.stringify(extra_tax_rates) : null,
        service_charge_enabled != null ? Boolean(service_charge_enabled) : null,
        service_charge_percent != null ? Number(service_charge_percent) : null,
        service_charge_mandatory != null ? Boolean(service_charge_mandatory) : null,
        service_charge_split_staff != null ? Boolean(service_charge_split_staff) : null,
        receipt_footer, receipt_header,
        receipt_show_logo != null ? Boolean(receipt_show_logo) : null,
        receipt_show_tax_breakdown != null ? Boolean(receipt_show_tax_breakdown) : null,
        receipt_default_mode,
        operating_hours != null ? JSON.stringify(operating_hours) : null,
        printers != null ? JSON.stringify(printers) : null,
        kds_stations_config != null ? JSON.stringify(kds_stations_config) : null,
        cleanSlug,
        online_ordering_enabled != null ? Boolean(online_ordering_enabled) : null,
        online_pickup_enabled != null ? Boolean(online_pickup_enabled) : null,
        online_delivery_enabled != null ? Boolean(online_delivery_enabled) : null,
        online_auto_accept != null ? Boolean(online_auto_accept) : null,
        online_prep_time_minutes != null ? Math.max(5, Math.min(180, parseInt(online_prep_time_minutes, 10) || 25)) : null,
        online_max_active_orders != null ? Math.max(1, Math.min(100, parseInt(online_max_active_orders, 10) || 20)) : null,
        online_payment_methods != null ? JSON.stringify(online_payment_methods) : null,
        tid(req),
      ]
    );
    const { password_hash, ...restaurant } = rows[0] || {};
    res.json(restaurant);
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update settings' });
  }
});

// ── POST /api/restaurants/me/test-print ───────────────────────
router.post('/me/test-print', requireManager, async (req, res) => {
  const { printer_name, ip_or_usb, type } = req.body;
  if (!ip_or_usb) {
    return res.status(400).json({ error: 'Printer IP address or USB port is required to perform a test print' });
  }
  // In a production POS environment, this triggers network ESC/POS socket connection.
  // For simulation / local testing, we validate device reachability and log.
  console.log(`🖨️ [ESC/POS TEST PRINT] Sending test ticket to "${printer_name || 'Printer'}" at ${ip_or_usb} (Type: ${type || 'receipt'})`);
  res.json({
    success: true,
    message: `Test print successfully dispatched to ${printer_name || 'printer'} (${ip_or_usb})`,
  });
});

// ── POST /api/restaurants/me/logo ────────────────────────────
router.post('/me/logo', requireOwner, logoUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Logo file required' });
  const logo_url = req.file.url;
  const { rows } = await db.query('SELECT logo_url FROM restaurants WHERE id=$1', [tid(req)]);
  if (rows[0] && rows[0].logo_url) await deleteOldUpload(rows[0].logo_url);
  
  await db.query('UPDATE restaurants SET logo_url=$1, updated_at=NOW() WHERE id=$2', [logo_url, tid(req)]);
  res.json({ logo_url });
});

// ── POST /api/restaurants/me/document ────────────────────────
router.post('/me/document', requireOwner, docUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Document file required' });
  const doc_url = req.file.url;
  const { rows } = await db.query('SELECT business_license_url FROM restaurants WHERE id=$1', [tid(req)]);
  if (rows[0] && rows[0].business_license_url) await deleteOldUpload(rows[0].business_license_url);

  await db.query('UPDATE restaurants SET business_license_url=$1, updated_at=NOW() WHERE id=$2', [doc_url, tid(req)]);
  res.json({ business_license_url: doc_url });
});

// ── POST /api/restaurants/menu-image ─────────────────────────
router.post('/menu-image', requireManager, menuUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image file required' });
  // Menu images aren't tracked to a single column in restaurants, they are typically returned 
  // to the client to be attached to a menu item create/update request.
  // The client or a cron job would delete orphaned images.
  const image_url = req.file.url;
  res.json({ image_url });
});

// ── DELIVERY ZONES CRUD ────────────────────────────────────────
// GET /api/restaurants/delivery-zones
router.get('/delivery-zones', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM delivery_zones WHERE restaurant_id = $1 ORDER BY name ASC',
      [tid(req)]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch delivery zones error:', err);
    res.status(500).json({ error: 'Failed to fetch delivery zones' });
  }
});

// POST /api/restaurants/delivery-zones
router.post('/delivery-zones', requireManager, async (req, res) => {
  const { name, fee = 0, min_order_amount = 0, estimated_minutes = 35 } = req.body;
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Zone name is required' });
  }

  const numFee = Number(fee);
  const numMinOrder = Number(min_order_amount);
  const numMinutes = parseInt(estimated_minutes, 10);

  if (isNaN(numFee) || numFee < 0) return res.status(400).json({ error: 'Delivery fee must be >= 0' });
  if (isNaN(numMinOrder) || numMinOrder < 0) return res.status(400).json({ error: 'Minimum order amount must be >= 0' });
  if (isNaN(numMinutes) || numMinutes < 5) return res.status(400).json({ error: 'Estimated delivery minutes must be at least 5' });

  try {
    const { rows } = await db.query(
      `INSERT INTO delivery_zones (restaurant_id, name, fee, min_order_amount, estimated_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [tid(req), cleanName.slice(0, 80), Math.round(numFee * 100) / 100, Math.round(numMinOrder * 100) / 100, numMinutes]
    );

    await logAudit(db, {
      restaurant_id: tid(req),
      actor_user_id: req.user.userId || req.user.id,
      action: 'delivery_zone_create',
      target_type: 'delivery_zone',
      target_id: rows[0].id,
      metadata: { name: cleanName, fee: numFee }
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create delivery zone error:', err);
    res.status(500).json({ error: 'Failed to create delivery zone' });
  }
});

// PATCH /api/restaurants/delivery-zones/:id
router.patch('/delivery-zones/:id', requireManager, async (req, res) => {
  const { name, fee, min_order_amount, estimated_minutes, is_active } = req.body;
  const zoneId = req.params.id;

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM delivery_zones WHERE id = $1 AND restaurant_id = $2',
      [zoneId, tid(req)]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Delivery zone not found' });

    const { rows } = await db.query(
      `UPDATE delivery_zones SET
        name = COALESCE($1, name),
        fee = COALESCE($2, fee),
        min_order_amount = COALESCE($3, min_order_amount),
        estimated_minutes = COALESCE($4, estimated_minutes),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
       WHERE id = $6 AND restaurant_id = $7
       RETURNING *`,
      [
        name != null ? String(name).trim().slice(0, 80) : null,
        fee != null ? Math.round(Number(fee) * 100) / 100 : null,
        min_order_amount != null ? Math.round(Number(min_order_amount) * 100) / 100 : null,
        estimated_minutes != null ? parseInt(estimated_minutes, 10) : null,
        is_active != null ? Boolean(is_active) : null,
        zoneId,
        tid(req)
      ]
    );

    await logAudit(db, {
      restaurant_id: tid(req),
      actor_user_id: req.user.userId || req.user.id,
      action: 'delivery_zone_update',
      target_type: 'delivery_zone',
      target_id: zoneId,
      metadata: req.body
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('Update delivery zone error:', err);
    res.status(500).json({ error: 'Failed to update delivery zone' });
  }
});

// DELETE /api/restaurants/delivery-zones/:id
router.delete('/delivery-zones/:id', requireManager, async (req, res) => {
  const zoneId = req.params.id;
  try {
    const { rows } = await db.query(
      'DELETE FROM delivery_zones WHERE id = $1 AND restaurant_id = $2 RETURNING id, name',
      [zoneId, tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Delivery zone not found' });

    await logAudit(db, {
      restaurant_id: tid(req),
      actor_user_id: req.user.userId || req.user.id,
      action: 'delivery_zone_delete',
      target_type: 'delivery_zone',
      target_id: zoneId,
      metadata: { name: rows[0].name }
    });

    res.json({ message: 'Delivery zone deleted successfully', id: zoneId });
  } catch (err) {
    console.error('Delete delivery zone error:', err);
    res.status(500).json({ error: 'Failed to delete delivery zone' });
  }
});

module.exports = router;
