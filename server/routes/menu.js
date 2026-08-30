const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant, requireManager } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// ── GET /api/menu/categories ──────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM menu_categories WHERE restaurant_id=$1 ORDER BY sort_order, name',
      [tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/menu/categories ─────────────────────────────────
router.post('/categories', requireManager, async (req, res) => {
  const { name, sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [tid(req), name, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── PATCH /api/menu/categories/:id ───────────────────────────
router.patch('/categories/:id', requireManager, async (req, res) => {
  const { name, sort_order, is_visible } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE menu_categories SET
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order),
        is_visible = COALESCE($3, is_visible)
       WHERE id=$4 AND restaurant_id=$5 RETURNING *`,
      [name, sort_order, is_visible, req.params.id, tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── DELETE /api/menu/categories/:id ──────────────────────────
router.delete('/categories/:id', requireManager, async (req, res) => {
  await db.query('DELETE FROM menu_categories WHERE id=$1 AND restaurant_id=$2', [req.params.id, tid(req)]);
  res.json({ message: 'Deleted' });
});

// ── GET /api/menu/items ───────────────────────────────────────
// Returns items with their modifier groups and options
router.get('/items', async (req, res) => {
  try {
    const { rows: items } = await db.query(
      `SELECT mi.*, mc.name as category_name
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.restaurant_id=$1
       ORDER BY mc.sort_order NULLS LAST, mi.sort_order, mi.name`,
      [tid(req)]
    );

    if (items.length === 0) return res.json([]);

    // Fetch all modifiers for these items in one query
    const itemIds = items.map(i => i.id);
    const { rows: modifiers } = await db.query(
      `SELECT mm.*, 
        json_agg(
          json_build_object('id', mmo.id, 'label', mmo.label, 'price_delta', mmo.price_delta, 'sort_order', mmo.sort_order)
          ORDER BY mmo.sort_order
        ) FILTER (WHERE mmo.id IS NOT NULL) as options
       FROM menu_modifiers mm
       LEFT JOIN menu_modifier_options mmo ON mmo.modifier_id = mm.id
       WHERE mm.menu_item_id = ANY($1)
       GROUP BY mm.id
       ORDER BY mm.sort_order`,
      [itemIds]
    );

    // Map modifiers onto items
    const modsByItem = {};
    for (const mod of modifiers) {
      if (!modsByItem[mod.menu_item_id]) modsByItem[mod.menu_item_id] = [];
      modsByItem[mod.menu_item_id].push({ ...mod, options: mod.options || [] });
    }

    res.json(items.map(i => ({ ...i, menu_modifiers: modsByItem[i.id] || [] })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/menu/items ──────────────────────────────────────
router.post('/items', requireManager, async (req, res) => {
  const { name, description, price, category_id, preparation_time_minutes, is_available, sort_order, image_url, tags, station } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, category_id, preparation_time_minutes, is_available, sort_order, image_url, tags, station)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tid(req), name, description || null, price, category_id || null,
       preparation_time_minutes || 10, is_available !== false, sort_order || 0,
       image_url || null, tags || [], station || 'General']
    );
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// ── PATCH /api/menu/items/:id ─────────────────────────────────
router.patch('/items/:id', requireManager, async (req, res) => {
  const { name, description, price, category_id, preparation_time_minutes, is_available, sort_order, image_url, tags, station } = req.body;
  try {
    let query = 'UPDATE menu_items SET updated_at = NOW()';
    const params = [];
    let i = 1;

    if (name !== undefined)                    { query += `, name = $${i++}`;                   params.push(name); }
    if (description !== undefined)             { query += `, description = $${i++}`;            params.push(description); }
    if (price !== undefined)                   { query += `, price = $${i++}`;                  params.push(price); }
    if (category_id !== undefined)             { query += `, category_id = $${i++}`;            params.push(category_id === '' ? null : category_id); }
    if (preparation_time_minutes !== undefined) { query += `, preparation_time_minutes = $${i++}`; params.push(preparation_time_minutes); }
    if (is_available !== undefined)            { query += `, is_available = $${i++}`;           params.push(is_available); }
    if (sort_order !== undefined)              { query += `, sort_order = $${i++}`;             params.push(sort_order); }
    if (image_url !== undefined)               { query += `, image_url = $${i++}`;             params.push(image_url); }
    if (tags !== undefined)                    { query += `, tags = $${i++}`;                   params.push(tags); }
    if (station !== undefined)                 { query += `, station = $${i++}`;                params.push(station); }

    query += ` WHERE id = $${i++} AND restaurant_id = $${i++} RETURNING *`;
    params.push(req.params.id, tid(req));

    const { rows } = await db.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// ── DELETE /api/menu/items/:id ────────────────────────────────
router.delete('/items/:id', requireManager, async (req, res) => {
  await db.query('DELETE FROM menu_items WHERE id=$1 AND restaurant_id=$2', [req.params.id, tid(req)]);
  res.json({ message: 'Deleted' });
});

// ── GET /api/menu/items/:id/modifiers ─────────────────────────
router.get('/items/:id/modifiers', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT mm.*, 
        json_agg(
          json_build_object('id', mmo.id, 'label', mmo.label, 'price_delta', mmo.price_delta, 'sort_order', mmo.sort_order)
          ORDER BY mmo.sort_order
        ) FILTER (WHERE mmo.id IS NOT NULL) as options
       FROM menu_modifiers mm
       LEFT JOIN menu_modifier_options mmo ON mmo.modifier_id = mm.id
       WHERE mm.menu_item_id = $1
       GROUP BY mm.id ORDER BY mm.sort_order`,
      [req.params.id]
    );
    res.json(rows.map(r => ({ ...r, options: r.options || [] })));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/menu/items/:id/modifiers ────────────────────────
// Full replace — send entire modifier groups array
router.post('/items/:id/modifiers', requireManager, async (req, res) => {
  const { modifiers } = req.body; // [{ name, is_required, min_select, max_select, sort_order, options: [{label, price_delta}] }]
  if (!Array.isArray(modifiers)) return res.status(400).json({ error: 'modifiers array required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verify item belongs to restaurant
    const { rows: itemRows } = await client.query(
      'SELECT id FROM menu_items WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, tid(req)]
    );
    if (!itemRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }

    // Delete existing modifiers (cascade deletes options)
    await client.query('DELETE FROM menu_modifiers WHERE menu_item_id=$1', [req.params.id]);

    // Insert new ones
    for (let mi = 0; mi < modifiers.length; mi++) {
      const mod = modifiers[mi];
      const { rows: modRows } = await client.query(
        `INSERT INTO menu_modifiers (restaurant_id, menu_item_id, name, is_required, min_select, max_select, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [tid(req), req.params.id, mod.name, mod.is_required || false, mod.min_select || 0, mod.max_select || 1, mi]
      );
      const modId = modRows[0].id;
      for (let oi = 0; oi < (mod.options || []).length; oi++) {
        const opt = mod.options[oi];
        await client.query(
          'INSERT INTO menu_modifier_options (modifier_id, label, price_delta, sort_order) VALUES ($1,$2,$3,$4)',
          [modId, opt.label, opt.price_delta || 0, oi]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Modifiers saved' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save modifiers' });
  } finally {
    client.release();
  }
});

// ── GET /api/menu/export ──────────────────────────────────────
// Export all menu items as CSV
router.get('/export', requireManager, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT mi.name, mi.description, mi.price, mc.name as category, mi.preparation_time_minutes, mi.is_available, array_to_string(mi.tags, '|') as tags
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.restaurant_id=$1
       ORDER BY mc.sort_order NULLS LAST, mi.sort_order`,
      [tid(req)]
    );

    const header = 'name,description,price,category,prep_time_minutes,is_available,tags\n';
    const csv = header + rows.map(r =>
      [r.name, r.description || '', r.price, r.category || '', r.preparation_time_minutes, r.is_available, r.tags || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="menu.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/menu/import ─────────────────────────────────────
// Import CSV — expects JSON body with rows array (parsed on frontend)
router.post('/import', requireManager, async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows array required' });

  const client = await db.connect();
  let imported = 0;
  let errors = [];
  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const { name, description, price, category, prep_time_minutes, is_available, tags } = row;
      if (!name || !price) { errors.push(`Skipped row: missing name or price`); continue; }

      // Find or create category
      let catId = null;
      if (category) {
        const { rows: catRows } = await client.query(
          'SELECT id FROM menu_categories WHERE restaurant_id=$1 AND LOWER(name)=LOWER($2)',
          [tid(req), category]
        );
        if (catRows[0]) {
          catId = catRows[0].id;
        } else {
          const { rows: newCat } = await client.query(
            'INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id',
            [tid(req), category]
          );
          catId = newCat[0].id;
        }
      }

      const tagsArr = tags ? String(tags).split('|').map(t => t.trim()).filter(Boolean) : [];

      await client.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, category_id, preparation_time_minutes, is_available, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [tid(req), name, description || null, parseFloat(price), catId,
         parseInt(prep_time_minutes) || 10, is_available !== 'false', tagsArr]
      );
      imported++;
    }

    await client.query('COMMIT');
    res.json({ imported, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
