const express = require('express');
const db = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// GET /api/reservations - List all reservations for the tenant
router.get('/', async (req, res) => {
  const { date } = req.query; // optional date filter (YYYY-MM-DD)
  try {
    let query = `
      SELECT r.*, t.label as table_label 
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      WHERE r.restaurant_id = $1
    `;
    const params = [tid(req)];
    
    if (date) {
      query += ` AND DATE(r.reservation_time AT TIME ZONE 'UTC') = $2`;
      params.push(date);
    }
    
    query += ` ORDER BY r.reservation_time ASC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// POST /api/reservations - Create a new reservation
router.post('/', async (req, res) => {
  const { customer_name, customer_phone, party_size, reservation_time, table_id, notes } = req.body;
  if (!customer_name || !customer_phone || !reservation_time) {
    return res.status(400).json({ error: 'Name, phone, and time are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO reservations 
         (restaurant_id, customer_name, customer_phone, party_size, reservation_time, table_id, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed') 
       RETURNING *`,
      [tid(req), customer_name, customer_phone, party_size || 2, reservation_time, table_id || null, notes || null]
    );

    if (table_id) {
      await db.query(`UPDATE tables SET status = 'reserved' WHERE id = $1 AND restaurant_id = $2`, [table_id, tid(req)]);
    }
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating reservation:', err);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// PATCH /api/reservations/:id - Update status or details
router.patch('/:id', async (req, res) => {
  const { status, table_id } = req.body;
  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM reservations WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, tid(req)]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Not found' });

    let sets = ['updated_at = NOW()'];
    const params = [];
    let i = 1;

    if (status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(status);
    }
    if (table_id !== undefined) {
      sets.push(`table_id = $${i++}`);
      params.push(table_id);
    }

    params.push(req.params.id, tid(req));
    const { rows } = await db.query(
      `UPDATE reservations SET ${sets.join(', ')} 
       WHERE id=$${i-2} AND restaurant_id=$${i-1} 
       RETURNING *`,
      params
    );

    const updatedRes = rows[0];
    if (updatedRes && updatedRes.table_id) {
      if (status === 'seated') {
        await db.query(`UPDATE tables SET status = 'occupied' WHERE id = $1 AND restaurant_id = $2`, [updatedRes.table_id, tid(req)]);
      } else if (status === 'cancelled' || status === 'no_show') {
        await db.query(`UPDATE tables SET status = 'available' WHERE id = $1 AND restaurant_id = $2`, [updatedRes.table_id, tid(req)]);
      } else if (table_id !== undefined || status === 'confirmed') {
        await db.query(`UPDATE tables SET status = 'reserved' WHERE id = $1 AND restaurant_id = $2`, [updatedRes.table_id, tid(req)]);
      }
    }

    res.json(updatedRes);
  } catch (err) {
    console.error('Error updating reservation:', err);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

// DELETE /api/reservations/:id - Cancel/Delete reservation
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT table_id FROM reservations WHERE id=$1 AND restaurant_id=$2', [req.params.id, tid(req)]);
    
    const { rowCount } = await db.query(
      'DELETE FROM reservations WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, tid(req)]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    
    if (rows[0] && rows[0].table_id) {
      await db.query(`UPDATE tables SET status = 'available' WHERE id = $1 AND restaurant_id = $2`, [rows[0].table_id, tid(req)]);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

module.exports = router;
