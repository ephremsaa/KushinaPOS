const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planLimits');
const { generateV1ApiKey, hashApiKey } = require('../middleware/apiKeyV1Auth');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

const VALID_SCOPES = [
  'menu:read',
  'orders:read',
  'orders:write',
  'customers:read',
  'reports:read'
];

// All API Key management routes require authentication, tenant context, owner role, and plan feature 'api_access'
router.use(authenticate, requireTenant, requireOwner, requirePlanFeature('api_access'));

// ── GET /api/api-keys ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  try {
    const { rows } = await db.query(
      `SELECT id, name, key_prefix, scopes, permissions, expires_at, ip_allowlist, 
              rate_limit_per_minute, is_active, is_suspended_by_admin, last_used_at, 
              request_count, created_at 
       FROM api_keys 
       WHERE restaurant_id = $1 
       ORDER BY created_at DESC`,
      [restaurantId]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      name: r.name,
      key_prefix: r.key_prefix,
      scopes: Array.isArray(r.scopes) ? r.scopes : (typeof r.scopes === 'string' ? JSON.parse(r.scopes) : (Array.isArray(r.permissions) ? r.permissions : [])),
      expires_at: r.expires_at,
      ip_allowlist: Array.isArray(r.ip_allowlist) ? r.ip_allowlist : (typeof r.ip_allowlist === 'string' ? JSON.parse(r.ip_allowlist) : []),
      rate_limit_per_minute: r.rate_limit_per_minute || 60,
      is_active: r.is_active,
      is_suspended_by_admin: r.is_suspended_by_admin,
      last_used_at: r.last_used_at,
      request_count: r.request_count || 0,
      created_at: r.created_at,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: 'Failed to load API keys' });
  }
});

// ── POST /api/api-keys ────────────────────────────────────────
router.post('/', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const name = String(req.body.name || '').trim().slice(0, 50);
  const rawScopes = Array.isArray(req.body.scopes) ? req.body.scopes : ['menu:read', 'orders:read'];
  const expiresAt = req.body.expires_at ? new Date(req.body.expires_at) : null;
  const ipAllowlist = Array.isArray(req.body.ip_allowlist) 
    ? req.body.ip_allowlist.map(ip => String(ip).trim()).filter(Boolean)
    : [];
  const rateLimit = Math.min(300, Math.max(10, parseInt(req.body.rate_limit_per_minute, 10) || 60));

  if (!name) {
    return res.status(400).json({ error: 'Key name is required (max 50 characters)' });
  }

  // Filter scopes to only valid ones
  const scopes = rawScopes.filter(s => VALID_SCOPES.includes(s));
  if (scopes.length === 0) {
    return res.status(400).json({ 
      error: `At least one valid scope is required. Available scopes: ${VALID_SCOPES.join(', ')}` 
    });
  }

  if (expiresAt && isNaN(expiresAt.getTime())) {
    return res.status(400).json({ error: 'Invalid expiry date format' });
  }

  try {
    const { rawKey, keyPrefix, keyHash } = generateV1ApiKey();

    const insertRes = await db.query(
      `INSERT INTO api_keys 
        (restaurant_id, name, key_hash, key_prefix, scopes, permissions, expires_at, ip_allowlist, rate_limit_per_minute, is_active)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, true)
       RETURNING id, restaurant_id, name, key_prefix, scopes, expires_at, ip_allowlist, rate_limit_per_minute, is_active, created_at`,
      [
        restaurantId, 
        name, 
        keyHash, 
        keyPrefix, 
        JSON.stringify(scopes), 
        expiresAt ? expiresAt.toISOString() : null, 
        JSON.stringify(ipAllowlist), 
        rateLimit
      ]
    );

    const keyRecord = insertRes.rows[0];

    // Record in audit log
    await logAudit(db, {
      restaurant_id: restaurantId,
      actor_user_id: req.user.userId || req.user.id,
      actor_email: req.user.email,
      action: 'api_key_create',
      target_type: 'api_key',
      target_id: keyRecord.id,
      metadata: { key_name: name, key_prefix: keyPrefix, scopes }
    });

    res.status(201).json({
      ...keyRecord,
      apiKey: rawKey,
      warning: 'Store this key in a secure location. You will not be able to view the full key again.'
    });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// ── POST /api/api-keys/:id/rotate ─────────────────────────────
router.post('/:id/rotate', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const keyId = req.params.id;

  try {
    const { rows: existingRows } = await db.query(
      `SELECT id, name, key_prefix, scopes FROM api_keys WHERE id = $1 AND restaurant_id = $2`,
      [keyId, restaurantId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const existingKey = existingRows[0];
    const { rawKey, keyPrefix, keyHash } = generateV1ApiKey();

    const updateRes = await db.query(
      `UPDATE api_keys 
       SET key_hash = $1, 
           key_prefix = $2, 
           last_used_at = NULL, 
           updated_at = NOW() 
       WHERE id = $3 AND restaurant_id = $4 
       RETURNING id, name, key_prefix, scopes, expires_at, ip_allowlist, rate_limit_per_minute, is_active, created_at, updated_at`,
      [keyHash, keyPrefix, keyId, restaurantId]
    );

    const rotatedKey = updateRes.rows[0];

    // Record in audit log
    await logAudit(db, {
      restaurant_id: restaurantId,
      actor_user_id: req.user.userId || req.user.id,
      actor_email: req.user.email,
      action: 'api_key_rotate',
      target_type: 'api_key',
      target_id: keyId,
      metadata: { key_name: existingKey.name, old_prefix: existingKey.key_prefix, new_prefix: keyPrefix }
    });

    res.json({
      ...rotatedKey,
      apiKey: rawKey,
      warning: 'Store this rotated key in a secure location. The old key has been invalidated immediately.'
    });
  } catch (err) {
    console.error('Rotate API key error:', err);
    res.status(500).json({ error: 'Failed to rotate API key' });
  }
});

// ── PATCH /api/api-keys/:id ───────────────────────────────────
router.patch('/:id', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const keyId = req.params.id;
  const { name, scopes: rawScopes, ip_allowlist, expires_at, rate_limit_per_minute } = req.body;

  try {
    const { rows: existing } = await db.query(
      `SELECT * FROM api_keys WHERE id = $1 AND restaurant_id = $2`,
      [keyId, restaurantId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const updates = [];
    const params = [keyId, restaurantId];

    if (name !== undefined) {
      params.push(String(name).trim().slice(0, 50));
      updates.push(`name = $${params.length}`);
    }

    if (rawScopes !== undefined) {
      const scopes = Array.isArray(rawScopes) ? rawScopes.filter(s => VALID_SCOPES.includes(s)) : [];
      params.push(JSON.stringify(scopes));
      updates.push(`scopes = $${params.length}::jsonb, permissions = $${params.length}::jsonb`);
    }

    if (ip_allowlist !== undefined) {
      const ips = Array.isArray(ip_allowlist) ? ip_allowlist.map(s => String(s).trim()).filter(Boolean) : [];
      params.push(JSON.stringify(ips));
      updates.push(`ip_allowlist = $${params.length}::jsonb`);
    }

    if (expires_at !== undefined) {
      const exp = expires_at ? new Date(expires_at).toISOString() : null;
      params.push(exp);
      updates.push(`expires_at = $${params.length}`);
    }

    if (rate_limit_per_minute !== undefined) {
      const limit = Math.min(300, Math.max(10, parseInt(rate_limit_per_minute, 10) || 60));
      params.push(limit);
      updates.push(`rate_limit_per_minute = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.json(existing[0]);
    }

    updates.push('updated_at = NOW()');

    const { rows } = await db.query(
      `UPDATE api_keys 
       SET ${updates.join(', ')} 
       WHERE id = $1 AND restaurant_id = $2 
       RETURNING id, name, key_prefix, scopes, expires_at, ip_allowlist, rate_limit_per_minute, is_active, last_used_at, created_at`,
      params
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Update API key error:', err);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// ── DELETE /api/api-keys/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  const restaurantId = req.user.restaurantId;
  const keyId = req.params.id;

  try {
    const { rows } = await db.query(
      `UPDATE api_keys 
       SET is_active = false, updated_at = NOW() 
       WHERE id = $1 AND restaurant_id = $2 
       RETURNING id, name, key_prefix`,
      [keyId, restaurantId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Record in audit log
    await logAudit(db, {
      restaurant_id: restaurantId,
      actor_user_id: req.user.userId || req.user.id,
      actor_email: req.user.email,
      action: 'api_key_revoke',
      target_type: 'api_key',
      target_id: keyId,
      metadata: { key_name: rows[0].name, key_prefix: rows[0].key_prefix }
    });

    res.json({ message: 'API key revoked successfully' });
  } catch (err) {
    console.error('Revoke API key error:', err);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
