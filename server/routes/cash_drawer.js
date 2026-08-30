const express = require('express');
const pool = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');

const router = express.Router();

// Get the current active cash drawer session for the logged-in staff member
router.get('/current', authenticate, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM cash_drawer_sessions 
       WHERE restaurant_id = $1 
         AND staff_id = $2 
       ORDER BY opened_at DESC LIMIT 1`,
      [req.user.restaurantId, req.user.userId || req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Open a new cash drawer session
router.post('/open', authenticate, requireTenant, async (req, res) => {
  const { starting_cash } = req.body;
  try {
    await pool.query('BEGIN');
    
    // Check if one is already open
    const { rows: existing } = await pool.query(
      `SELECT id FROM cash_drawer_sessions WHERE restaurant_id = $1 AND staff_id = $2 AND status = 'open'`,
      [req.user.restaurantId, req.user.userId || req.user.id]
    );
    if (existing.length > 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'A cash drawer session is already open' });
    }

    // Find the current active shift if any
    const { rows: shifts } = await pool.query(
      `SELECT id FROM staff_shifts WHERE restaurant_id=$1 AND staff_id=$2 AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1`,
      [req.user.restaurantId, req.user.userId || req.user.id]
    );
    const shiftId = shifts[0] ? shifts[0].id : null;

    const { rows } = await pool.query(
      `INSERT INTO cash_drawer_sessions (restaurant_id, staff_id, shift_id, starting_cash, expected_cash, status)
       VALUES ($1, $2, $3, $4, $4, 'open') RETURNING *`,
      [req.user.restaurantId, req.user.userId || req.user.id, shiftId, starting_cash || 0]
    );

    await pool.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Close a cash drawer session
router.post('/close', authenticate, requireTenant, async (req, res) => {
  const { actual_cash, manager_pin, notes } = req.body;
  try {
    await pool.query('BEGIN');

    const { rows: active } = await pool.query(
      `SELECT * FROM cash_drawer_sessions WHERE restaurant_id = $1 AND staff_id = $2 AND status = 'open' LIMIT 1`,
      [req.user.restaurantId, req.user.userId || req.user.id]
    );
    
    if (active.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'No open cash drawer session found' });
    }

    const session = active[0];
    const expected = Number(session.expected_cash);
    const actual = Number(actual_cash);
    const discrepancy = actual - expected;

    let signoff_id = null;
    
    // If discrepancy is > $5 or < -$5, require manager signoff
    if (Math.abs(discrepancy) > 5) {
      if (!manager_pin) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Manager PIN required for discrepancy over $5' });
      }

      const { rows: managers } = await pool.query(
        `SELECT id, role FROM staff WHERE restaurant_id=$1 AND pin=$2 AND role IN ('manager', 'owner') AND is_active=true LIMIT 1`,
        [req.user.restaurantId, manager_pin]
      );

      if (managers.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(401).json({ error: 'Invalid Manager PIN' });
      }
      signoff_id = managers[0].id;
    }

    const { rows } = await pool.query(
      `UPDATE cash_drawer_sessions 
       SET closed_at=NOW(), status='closed', actual_cash=$1, discrepancy_amount=$2, manager_signoff_id=$3, notes=$4
       WHERE id=$5 RETURNING *`,
      [actual, discrepancy, signoff_id, notes, session.id]
    );
    
    // Audit log if there was a discrepancy
    if (Math.abs(discrepancy) > 5) {
      await pool.query(
        `INSERT INTO audit_logs (action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4)`,
        ['cash_drawer_discrepancy', 'cash_drawer_sessions', session.id, JSON.stringify({
          staff_id: req.user.userId || req.user.id,
          expected_cash: Number(session.expected_cash),
          discrepancy,
          manager_signoff_id: signoff_id
        })]
      );
    }

    await pool.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
