const express = require('express');
const db = require('../config/db');
const { getSafeTz } = require('../utils/tzHelper');
const { authenticate, requireTenant } = require('../middleware/auth');
const router = express.Router();
const { Parser } = require('json2csv');

router.use(authenticate, requireTenant);
const tid = (req) => req.user.restaurantId;

// ── POST /api/reports/refresh ─────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    // Refresh all MVs concurrently to avoid locking reads
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales');
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_item_performance');
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_staff_performance');
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hourly_heatmap');
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_table_utilization');
    res.json({ message: 'Refreshed' });
  } catch (err) {
    console.error('Refresh Error:', err);
    res.status(500).json({ error: 'Failed to refresh reports' });
  }
});

// ── GET /api/reports/dashboard ────────────────────────────────
// Real-time dashboard KPI metrics (still uses transactional tables for immediate operational needs)
router.get('/dashboard', async (req, res) => {
  try {
    const rId = tid(req);
    const tz = await getSafeTz(rId);

    const { rows: kpis } = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE DATE(created_at AT TIME ZONE '${tz}') = (NOW() AT TIME ZONE '${tz}')::date AND status != 'cancelled') as today_orders,
        COALESCE(SUM(total) FILTER (WHERE DATE(created_at AT TIME ZONE '${tz}') = (NOW() AT TIME ZONE '${tz}')::date AND status != 'cancelled'), 0) as today_sales,
        COALESCE(AVG(total) FILTER (WHERE DATE(created_at AT TIME ZONE '${tz}') = (NOW() AT TIME ZONE '${tz}')::date AND status != 'cancelled'), 0) as today_avg_order,
        COUNT(*) FILTER (WHERE DATE(created_at AT TIME ZONE '${tz}') = (NOW() AT TIME ZONE '${tz}')::date - INTERVAL '1 day' AND status != 'cancelled') as yesterday_orders,
        COALESCE(SUM(total) FILTER (WHERE DATE(created_at AT TIME ZONE '${tz}') = (NOW() AT TIME ZONE '${tz}')::date - INTERVAL '1 day' AND status != 'cancelled'), 0) as yesterday_sales
      FROM orders
      WHERE restaurant_id = $1 AND created_at >= (NOW() AT TIME ZONE '${tz}')::date - INTERVAL '1 day'
    `, [rId]);

    const { rows: tableStatus } = await db.query(`
      SELECT COUNT(*) as total_tables, COUNT(*) FILTER (WHERE status = 'occupied') as occupied_tables
      FROM tables WHERE restaurant_id = $1
    `, [rId]);

    const { rows: orderStatus } = await db.query(`
      SELECT COUNT(*) as preparing_orders 
      FROM orders WHERE restaurant_id = $1 AND status = 'preparing'
    `, [rId]);

    const { rows: staffStatus } = await db.query(`
      SELECT COUNT(*) as active_staff FROM staff WHERE restaurant_id = $1 AND is_active = true
    `, [rId]);

    const { rows: inventory } = await db.query(`
      SELECT id, name, quantity, unit, low_stock_threshold
      FROM inventory_items WHERE restaurant_id = $1
    `, [rId]);
    const lowStockItems = inventory.filter(i => i.quantity <= i.low_stock_threshold);

    // Recent orders for the Live Orders Stream panel on the dashboard
    const { rows: recentOrders } = await db.query(`
      SELECT o.id, o.status, o.order_type, o.total, o.customer_name, o.created_at,
             t.label as table_label
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      WHERE o.restaurant_id = $1 AND o.status != 'cancelled'
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [rId]);

    res.json({
      kpis: kpis[0] || { today_orders: 0, today_sales: 0, today_avg_order: 0, yesterday_orders: 0, yesterday_sales: 0 },
      liveStatus: {
        total_tables: parseInt(tableStatus[0]?.total_tables || 0),
        occupied_tables: parseInt(tableStatus[0]?.occupied_tables || 0),
        preparing_orders: parseInt(orderStatus[0]?.preparing_orders || 0),
        active_staff: parseInt(staffStatus[0]?.active_staff || 0),
      },
      lowStock: lowStockItems,
      recentOrders,
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── GET /api/reports/sales ────────────────────────────────────
router.get('/sales', async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  
  try {
    const { rows: daily } = await db.query(`
      SELECT date, SUM(total_orders) as orders, SUM(total_revenue) as total
      FROM mv_daily_sales
      WHERE restaurant_id = $1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
      GROUP BY date ORDER BY date
    `, [tid(req), days]);

    const { rows: kpi } = await db.query(`
      SELECT 
        SUM(total_orders) as total_orders, 
        SUM(total_revenue) as total_revenue,
        SUM(total_revenue) / NULLIF(SUM(total_orders), 0) as avg_order
      FROM mv_daily_sales
      WHERE restaurant_id = $1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
    `, [tid(req), days]);

    const { rows: typeBreakdown } = await db.query(`
      SELECT order_type as name, SUM(total_orders) as value
      FROM mv_daily_sales
      WHERE restaurant_id = $1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
      GROUP BY order_type
    `, [tid(req), days]);

    const { rows: paymentBreakdown } = await db.query(`
      SELECT COALESCE(payment_method, 'unknown') as name, SUM(total_revenue) as value
      FROM mv_daily_sales
      WHERE restaurant_id = $1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
      GROUP BY payment_method
    `, [tid(req), days]);

    res.json({
      kpi: kpi[0] || { total_orders: 0, total_revenue: 0, avg_order: 0 },
      dailySales: daily,
      typeBreakdown: typeBreakdown.map(r => ({ ...r, value: Number(r.value) })),
      paymentBreakdown: paymentBreakdown.map(r => ({ ...r, value: Number(r.value) }))
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/reports/items ────────────────────────────────────
router.get('/items', async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  try {
    const { rows } = await db.query(`
      SELECT 
        menu_item_name as name, 
        SUM(total_quantity) as quantity, 
        SUM(total_revenue) as revenue
      FROM mv_item_performance
      WHERE restaurant_id = $1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
      GROUP BY menu_item_name
      ORDER BY quantity DESC
      LIMIT 20
    `, [tid(req), days]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/reports/staff ────────────────────────────────────
router.get('/staff', async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  try {
    const { rows } = await db.query(`
      SELECT 
        s.name,
        SUM(p.orders_handled) as orders_handled,
        SUM(p.total_sales) as total_sales,
        SUM(p.voided_orders) as voided_orders,
        AVG(p.avg_handling_seconds) as avg_handling_seconds
      FROM mv_staff_performance p
      JOIN staff s ON s.id = p.staff_id
      WHERE p.restaurant_id = $1 AND p.date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
      GROUP BY s.name
      ORDER BY total_sales DESC
    `, [tid(req), days]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/reports/tables ───────────────────────────────────
router.get('/tables', async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  try {
    const { rows } = await db.query(`
      SELECT 
        t.label as name,
        SUM(p.total_parties) as parties,
        AVG(p.avg_duration_seconds) as avg_duration_seconds
      FROM mv_table_utilization p
      JOIN tables t ON t.id = p.table_id
      WHERE p.restaurant_id = $1 AND p.date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer
      GROUP BY t.label
      ORDER BY parties DESC
    `, [tid(req), days]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/reports/peak-hours ───────────────────────────────
router.get('/peak-hours', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT day_of_week, hour_of_day, SUM(total_orders) as value
      FROM mv_hourly_heatmap
      WHERE restaurant_id = $1
      GROUP BY day_of_week, hour_of_day
    `, [tid(req)]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/reports/inventory-valuation ──────────────────────
router.get('/inventory-valuation', async (req, res) => {
  try {
    const { rows: current } = await db.query(`
      SELECT 
        SUM(quantity * cost_per_unit) as total_value,
        COUNT(*) as tracked_items
      FROM inventory_items WHERE restaurant_id = $1
    `, [tid(req)]);

    const { rows: wastage } = await db.query(`
      SELECT 
        SUM(ABS(t.quantity_delta) * i.cost_per_unit) as total_wastage_value
      FROM inventory_transactions t
      JOIN inventory_items i ON i.id = t.item_id
      WHERE t.restaurant_id = $1 AND t.type = 'waste' AND t.created_at >= (NOW() AT TIME ZONE '${tz}')::date - INTERVAL '30 days'
    `, [tid(req)]);

    res.json({
      total_value: current[0]?.total_value || 0,
      tracked_items: current[0]?.tracked_items || 0,
      wastage_30d: wastage[0]?.total_wastage_value || 0
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/reports/export ───────────────────────────────────
router.get('/export', async (req, res) => {
  const { type, period = '30d' } = req.query;
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  let rows = [];

  try {
    if (type === 'sales') {
      const q = await db.query(`SELECT date, order_type, payment_method, total_orders, total_revenue FROM mv_daily_sales WHERE restaurant_id=$1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer ORDER BY date DESC`, [tid(req), days]);
      rows = q.rows;
    } else if (type === 'items') {
      const q = await db.query(`SELECT date, menu_item_name, total_quantity, total_revenue FROM mv_item_performance WHERE restaurant_id=$1 AND date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer ORDER BY date DESC`, [tid(req), days]);
      rows = q.rows;
    } else if (type === 'staff') {
      const q = await db.query(`
        SELECT p.date, s.name as staff_name, p.orders_handled, p.total_sales, p.voided_orders, p.avg_handling_seconds 
        FROM mv_staff_performance p JOIN staff s ON s.id = p.staff_id 
        WHERE p.restaurant_id=$1 AND p.date >= (NOW() AT TIME ZONE '${tz}')::date - $2::integer ORDER BY p.date DESC
      `, [tid(req), days]);
      rows = q.rows;
    } else if (type === 'z-report') {
      // Z-Report is a daily summary of today's register
      const targetDate = req.query.date || 'CURRENT_DATE';
      const q = await db.query(`
        SELECT 
          DATE(created_at AT TIME ZONE '${tz}') as date,
          COUNT(id) as total_orders,
          SUM(subtotal) as subtotal,
          SUM(tax_amount) as tax_amount,
          SUM(discount_amount) as discount_amount,
          SUM(total) as gross_total,
          payment_method
        FROM orders
        WHERE restaurant_id = $1 
          AND status != 'cancelled'
          AND DATE(created_at AT TIME ZONE '${tz}') = ${targetDate === 'CURRENT_DATE' ? `(NOW() AT TIME ZONE '${tz}')::date` : '$2'}
        GROUP BY DATE(created_at AT TIME ZONE '${tz}'), payment_method
      `, targetDate === 'CURRENT_DATE' ? [tid(req)] : [tid(req), targetDate]);
      rows = q.rows;
    }

    if (!rows.length) {
      return res.status(404).send('No data found for export');
    }

    const parser = new Parser();
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}_report_${period}.csv`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).send('Export failed');
  }
});

module.exports = router;
