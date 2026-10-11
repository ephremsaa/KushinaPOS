const express = require('express');
const pool = require('../config/db');
const { authenticate, requireTenant } = require('../middleware/auth');
const { verifyManagerPin } = require('../utils/pinHelper');

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

    if (!rows[0]) return res.json(null);

    const session = rows[0];

    // Compute shift summary metrics for this till session
    const { rows: orderStats } = await pool.query(
      `SELECT 
         COUNT(*) as order_count,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0) as total_cash_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0) as total_card_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'telebirr'), 0) as total_telebirr_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'cbe_birr'), 0) as total_cbe_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'bank_transfer'), 0) as total_bank_sales,
         COUNT(*) FILTER (WHERE is_payment_confirmed = false AND payment_method IN ('telebirr', 'cbe_birr', 'bank_transfer')) as unconfirmed_count,
         COALESCE(SUM(tax_amount), 0) as total_tax,
         COALESCE(SUM(discount_amount), 0) as total_discount,
         COALESCE(SUM(tip_amount), 0) as total_tips,
         COALESCE(SUM(total), 0) as total_sales
       FROM orders 
       WHERE (till_session_id = $1 OR created_at >= $2) 
         AND restaurant_id = $3 
         AND payment_status = 'paid'`,
      [session.id, session.opened_at, req.user.restaurantId]
    );

    const stats = orderStats[0] || {
      order_count: 0,
      total_cash_sales: 0,
      total_card_sales: 0,
      total_telebirr_sales: 0,
      total_cbe_sales: 0,
      total_bank_sales: 0,
      unconfirmed_count: 0,
      total_tax: 0,
      total_discount: 0,
      total_tips: 0,
      total_sales: 0,
    };

    // Query payments table for unconfirmed mobile-money metrics
    const { rows: payStats } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending' AND method IN ('telebirr', 'cbe_birr', 'bank_transfer')) as unconfirmed_count,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND method IN ('telebirr', 'cbe_birr', 'bank_transfer')), 0) as unconfirmed_amount
       FROM payments
       WHERE restaurant_id = $1 AND (till_session_id = $2 OR created_at >= $3)`,
      [req.user.restaurantId, session.id, session.opened_at]
    );
    const unconfirmedPaymentsCount = Math.max(
      parseInt(stats.unconfirmed_count || 0, 10),
      parseInt(payStats[0]?.unconfirmed_count || 0, 10)
    );
    const unconfirmedPaymentsAmount = parseFloat(payStats[0]?.unconfirmed_amount || 0);

    res.json({
      ...session,
      shift_summary: {
        order_count: parseInt(stats.order_count, 10),
        total_cash_sales: parseFloat(stats.total_cash_sales),
        total_card_sales: parseFloat(stats.total_card_sales),
        total_telebirr_sales: parseFloat(stats.total_telebirr_sales),
        total_cbe_sales: parseFloat(stats.total_cbe_sales),
        total_bank_sales: parseFloat(stats.total_bank_sales),
        unconfirmed_count: unconfirmedPaymentsCount,
        unconfirmed_amount: unconfirmedPaymentsAmount,
        total_tax: parseFloat(stats.total_tax),
        total_discount: parseFloat(stats.total_discount),
        total_tips: parseFloat(stats.total_tips),
        total_sales: parseFloat(stats.total_sales),
      },
    });
  } catch (err) {
    console.error('Cash drawer current error:', err);
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

    // Find the current active shift if staff_shifts table exists
    let shiftId = null;
    try {
      const { rows: shifts } = await pool.query(
        `SELECT id FROM staff_shifts WHERE restaurant_id=$1 AND staff_id=$2 AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1`,
        [req.user.restaurantId, req.user.userId || req.user.id]
      );
      shiftId = shifts[0] ? shifts[0].id : null;
    } catch {
      // staff_shifts table optional
    }

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

    // Check for unconfirmed mobile-money payments
    const { rows: unconfirmedCheck } = await pool.query(
      `SELECT COUNT(*) as unconfirmed_count,
              COALESCE(SUM(amount), 0) as unconfirmed_amount
       FROM payments
       WHERE restaurant_id = $1
         AND (till_session_id = $2 OR created_at >= $3)
         AND status = 'pending'
         AND method IN ('telebirr', 'cbe_birr', 'bank_transfer')`,
      [req.user.restaurantId, session.id, session.opened_at]
    );
    const unconfirmedCount = parseInt(unconfirmedCheck[0]?.unconfirmed_count || 0, 10);

    let signoff_id = null;

    // A shift cannot close with unconfirmed payments without a manager note and PIN
    if (unconfirmedCount > 0) {
      if (!notes || !notes.trim()) {
        await pool.query('ROLLBACK');
        return res.status(400).json({
          error: `Cannot close shift with ${unconfirmedCount} unconfirmed payment(s) without a manager note explaining why.`,
        });
      }
      if (!manager_pin) {
        await pool.query('ROLLBACK');
        return res.status(400).json({
          error: 'Manager PIN required to close shift with unconfirmed payments',
        });
      }
      const { authorized, staff: managerStaff } = await verifyManagerPin(req.user.restaurantId, manager_pin, pool);
      if (!authorized || !managerStaff) {
        await pool.query('ROLLBACK');
        return res.status(401).json({ error: 'Invalid Manager PIN' });
      }
      signoff_id = managerStaff.id;
    }

    // If discrepancy is > $5 / 50 ETB, require manager signoff
    if (Math.abs(discrepancy) > 5) {
      if (!manager_pin) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Manager PIN required for discrepancy over 5' });
      }

      const { authorized, staff: managerStaff } = await verifyManagerPin(req.user.restaurantId, manager_pin, pool);
      if (!authorized || !managerStaff) {
        await pool.query('ROLLBACK');
        return res.status(401).json({ error: 'Invalid Manager PIN' });
      }
      signoff_id = managerStaff.id;
    }

    const { rows } = await pool.query(
      `UPDATE cash_drawer_sessions 
       SET closed_at=NOW(), status='closed', actual_cash=$1, discrepancy_amount=$2, manager_signoff_id=$3, notes=$4,
           unconfirmed_payments_count=$5, unconfirmed_notes=$6
       WHERE id=$7 RETURNING *`,
      [actual, discrepancy, signoff_id, notes, unconfirmedCount, unconfirmedCount > 0 ? notes : null, session.id]
    );
    
    // Audit log if there was a discrepancy
    if (Math.abs(discrepancy) > 5) {
      await pool.query(
        `INSERT INTO audit_logs (restaurant_id, actor_user_id, actor_email, action, target_type, target_id, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.user.restaurantId,
          req.user.userId || req.user.id,
          req.user.email || null,
          'cash_drawer_discrepancy',
          'cash_drawer_sessions',
          session.id,
          JSON.stringify({
            expected_cash: Number(session.expected_cash),
            actual_cash: actual,
            discrepancy,
            manager_signoff_id: signoff_id,
            notes,
          })
        ]
      );
    }

    // Compute final shift summary for the Z-Report
    const { rows: orderStats } = await pool.query(
      `SELECT 
         COUNT(*) as order_count,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0) as total_cash_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0) as total_card_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'telebirr'), 0) as total_telebirr_sales,
         COALESCE(SUM(total) FILTER (WHERE payment_method = 'cbe_birr'), 0) as total_cbe_sales,
         COALESCE(SUM(tax_amount), 0) as total_tax,
         COALESCE(SUM(discount_amount), 0) as total_discount,
         COALESCE(SUM(tip_amount), 0) as total_tips,
         COALESCE(SUM(total), 0) as total_sales
       FROM orders 
       WHERE (till_session_id = $1 OR created_at >= $2) 
         AND restaurant_id = $3 
         AND payment_status = 'paid'`,
      [session.id, session.opened_at, req.user.restaurantId]
    );

    const stats = orderStats[0] || {};

    await pool.query('COMMIT');
    res.json({
      ...rows[0],
      shift_summary: {
        order_count: parseInt(stats.order_count || 0, 10),
        total_cash_sales: parseFloat(stats.total_cash_sales || 0),
        total_card_sales: parseFloat(stats.total_card_sales || 0),
        total_telebirr_sales: parseFloat(stats.total_telebirr_sales || 0),
        total_cbe_sales: parseFloat(stats.total_cbe_sales || 0),
        total_tax: parseFloat(stats.total_tax || 0),
        total_discount: parseFloat(stats.total_discount || 0),
        total_tips: parseFloat(stats.total_tips || 0),
        total_sales: parseFloat(stats.total_sales || 0),
      },
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
