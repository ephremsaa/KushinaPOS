const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner, requireManager } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// ── GET /api/inventory/suppliers ─────────────────────────────
router.get('/suppliers', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM suppliers WHERE restaurant_id=$1 ORDER BY name',
      [tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/inventory/suppliers ────────────────────────────
router.post('/suppliers', requireManager, async (req, res) => {
  const { name, contact_name, phone, email, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO suppliers (restaurant_id, name, contact_name, phone, email, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tid(req), name, contact_name || null, phone || null, email || null, address || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── PATCH /api/inventory/suppliers/:id ───────────────────────
router.patch('/suppliers/:id', requireManager, async (req, res) => {
  const { name, contact_name, phone, email, address, notes } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE suppliers SET
        name = COALESCE($1, name),
        contact_name = COALESCE($2, contact_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        notes = COALESCE($6, notes),
        updated_at = NOW()
       WHERE id=$7 AND restaurant_id=$8 RETURNING *`,
      [name, contact_name, phone, email, address, notes, req.params.id, tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/inventory ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT i.*, s.name as supplier_name 
       FROM inventory_items i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.restaurant_id=$1 ORDER BY i.name`,
      [tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/inventory ───────────────────────────────────────
router.post('/', requireManager, async (req, res) => {
  const { name, unit = 'pcs', quantity = 0, low_stock_threshold = 5, cost_per_unit = 0, supplier_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO inventory_items (restaurant_id, name, unit, quantity, low_stock_threshold, cost_per_unit, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tid(req), name, unit, quantity, low_stock_threshold, cost_per_unit, supplier_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/inventory/:id/adjust ───────────────────────────
// type: 'restock' | 'adjustment' | 'waste'
router.post('/:id/adjust', requireManager, async (req, res) => {
  const { type = 'restock', quantity_delta, note } = req.body;
  if (quantity_delta === undefined) return res.status(400).json({ error: 'quantity_delta required' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Record transaction
    await client.query(
      `INSERT INTO inventory_transactions (restaurant_id, item_id, type, quantity_delta, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [tid(req), req.params.id, type, quantity_delta, note || null]
    );

    // Update running quantity
    const { rows } = await client.query(
      `UPDATE inventory_items
       SET quantity = quantity + $1, updated_at = NOW()
       WHERE id=$2 AND restaurant_id=$3 RETURNING *`,
      [quantity_delta, req.params.id, tid(req)]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    // Trigger auto-86 if stock hits 0
    if (Number(rows[0].quantity) <= 0) {
      const { triggerAuto86 } = require('../utils/inventory');
      await triggerAuto86(client, tid(req));
    }

    // Trigger low stock notification if threshold crossed
    const item = rows[0];
    if (Number(item.quantity) <= Number(item.low_stock_threshold)) {
      const { notify } = require('../utils/notifyService');
      await notify({
        restaurant_id: tid(req),
        type: 'low_stock',
        title: `⚠️ Low Stock Alert: ${item.name}`,
        message: `Quantity has dropped to ${item.quantity} ${item.unit} (Threshold: ${item.low_stock_threshold} ${item.unit}).`,
        target_role: 'manager',
        metadata: { item_id: item.id, item_name: item.name, quantity: item.quantity, threshold: item.low_stock_threshold }
      });
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed' });
  } finally { client.release(); }
});

// ── PATCH /api/inventory/:id ──────────────────────────────────
router.patch('/:id', requireManager, async (req, res) => {
  const { name, unit, low_stock_threshold, cost_per_unit, supplier_id } = req.body;
  try {
    let query = 'UPDATE inventory_items SET updated_at = NOW()';
    const params = [];
    let i = 1;

    if (name !== undefined) { query += `, name = $${i++}`; params.push(name); }
    if (unit !== undefined) { query += `, unit = $${i++}`; params.push(unit); }
    if (low_stock_threshold !== undefined) { query += `, low_stock_threshold = $${i++}`; params.push(low_stock_threshold); }
    if (cost_per_unit !== undefined) { query += `, cost_per_unit = $${i++}`; params.push(cost_per_unit); }
    if (supplier_id !== undefined) { query += `, supplier_id = $${i++}`; params.push(supplier_id === '' ? null : supplier_id); }

    query += ` WHERE id=$${i++} AND restaurant_id=$${i++} RETURNING *`;
    params.push(req.params.id, tid(req));

    const { rows } = await db.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── DELETE /api/inventory/:id ─────────────────────────────────
router.delete('/:id', requireManager, async (req, res) => {
  await db.query('DELETE FROM inventory_items WHERE id=$1 AND restaurant_id=$2', [req.params.id, tid(req)]);
  res.json({ message: 'Deleted' });
});

// ── GET /api/inventory/:id/transactions ───────────────────────
router.get('/:id/transactions', requireManager, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM inventory_transactions
       WHERE item_id=$1 AND restaurant_id=$2
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.id, tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
