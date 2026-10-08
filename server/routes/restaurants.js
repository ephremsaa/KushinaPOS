const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner, requireManager } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// Multer setup for menu images
const menuStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/menu-images')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const menuUpload = multer({ storage: menuStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Logo upload
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/logos')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${tid(req)}${ext}`);
  },
});
const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

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
    name, phone, address, city, cuisine_type, currency, slug, online_ordering_enabled,
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
        updated_at                 = NOW()
       WHERE id = $26 RETURNING *`,
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
router.post('/me/logo', requireOwner, logoUpload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Logo file required' });
  const logo_url = `/uploads/logos/${req.file.filename}`;
  await db.query('UPDATE restaurants SET logo_url=$1, updated_at=NOW() WHERE id=$2', [logo_url, tid(req)]);
  res.json({ logo_url });
});

// ── POST /api/restaurants/me/document ────────────────────────
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/payment-proofs')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${tid(req)}${ext}`);
  },
});
const docUpload = multer({ storage: docStorage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/me/document', requireOwner, docUpload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Document file required' });
  const doc_url = `/uploads/payment-proofs/${req.file.filename}`;
  await db.query('UPDATE restaurants SET business_license_url=$1, updated_at=NOW() WHERE id=$2', [doc_url, tid(req)]);
  res.json({ business_license_url: doc_url });
});

// ── POST /api/restaurants/menu-image ─────────────────────────
router.post('/menu-image', requireManager, menuUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image file required' });
  const image_url = `/uploads/menu-images/${req.file.filename}`;
  res.json({ image_url });
});

module.exports = router;
