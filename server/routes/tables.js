const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant, requireOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// ── GET /api/tables ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM tables WHERE restaurant_id=$1 ORDER BY label',
      [tid(req)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── POST /api/tables ──────────────────────────────────────────
router.post('/', requireOwner, async (req, res) => {
  const { label, capacity = 4, shape = 'rect', status = 'available' } = req.body;
  if (!label) return res.status(400).json({ error: 'label required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO tables (restaurant_id, label, capacity, shape, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [tid(req), label, capacity, shape, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── PATCH /api/tables/:id ─────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { label, capacity, shape, status } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE tables SET
        label    = COALESCE($1, label),
        capacity = COALESCE($2, capacity),
        shape    = COALESCE($3, shape),
        status   = COALESCE($4, status),
        updated_at = NOW()
       WHERE id=$5 AND restaurant_id=$6 RETURNING *`,
      [label, capacity, shape, status, req.params.id, tid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── DELETE /api/tables/:id ────────────────────────────────────
router.delete('/:id', requireOwner, async (req, res) => {
  await db.query('DELETE FROM tables WHERE id=$1 AND restaurant_id=$2', [req.params.id, tid(req)]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
