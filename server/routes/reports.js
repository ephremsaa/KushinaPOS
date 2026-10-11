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

// ── GET /api/reports/online-ordering ─────────────────────────
router.get('/online-ordering', async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '90d' ? 90 : period === '7d' ? 7 : 30;

  try {
    const rId = tid(req);
    const tz = await getSafeTz(rId);

    // 1. Online vs In-restaurant comparison
    const { rows: salesComparison } = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN order_source = 'online' AND status != 'cancelled' THEN total ELSE 0 END), 0) as online_sales,
         COUNT(CASE WHEN order_source = 'online' AND status != 'cancelled' THEN 1 END) as online_orders_count,
         COALESCE(SUM(CASE WHEN (order_source != 'online' OR order_source IS NULL) AND status != 'cancelled' THEN total ELSE 0 END), 0) as in_restaurant_sales,
         COUNT(CASE WHEN (order_source != 'online' OR order_source IS NULL) AND status != 'cancelled' THEN 1 END) as in_restaurant_orders_count,
         COALESCE(SUM(CASE WHEN order_source = 'online' AND order_type = 'delivery' AND status != 'cancelled' THEN delivery_fee ELSE 0 END), 0) as delivery_fees_collected,
         COUNT(CASE WHEN order_source = 'online' AND order_type = 'delivery' AND status != 'cancelled' THEN 1 END) as delivery_orders_count,
         COUNT(CASE WHEN order_source = 'online' AND order_type = 'pickup' AND status != 'cancelled' THEN 1 END) as pickup_orders_count
       FROM orders
       WHERE restaurant_id = $1
         AND created_at >= (NOW() AT TIME ZONE '${tz}')::date - ($2 || ' days')::interval`,
      [rId, days]
    );

    // 2. Average delivery time: minutes between accepted_at and delivered_at
    const { rows: avgTimeRows } = await db.query(
      `SELECT
         ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - accepted_at)) / 60), 0)) as avg_delivery_minutes,
         ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (estimated_ready_at - accepted_at)) / 60), 0)) as avg_prep_minutes,
         COUNT(*) as delivered_count
       FROM orders
       WHERE restaurant_id = $1
         AND order_source = 'online'
         AND accept_status = 'accepted'
         AND delivered_at IS NOT NULL
         AND accepted_at IS NOT NULL
         AND created_at >= (NOW() AT TIME ZONE '${tz}')::date - ($2 || ' days')::interval`,
      [rId, days]
    );

    // 3. Rejected orders count & reasons
    const { rows: rejectionSummary } = await db.query(
      `SELECT
         COUNT(*) as total_rejected,
         COALESCE(rejection_reason, 'No reason specified') as reason,
         COUNT(*) as count
       FROM orders
       WHERE restaurant_id = $1
         AND order_source = 'online'
         AND accept_status = 'rejected'
         AND created_at >= (NOW() AT TIME ZONE '${tz}')::date - ($2 || ' days')::interval
       GROUP BY rejection_reason
       ORDER BY count DESC`,
      [rId, days]
    );

    const totalRejected = rejectionSummary.reduce((acc, cur) => acc + parseInt(cur.count || 0), 0);

    // 4. Daily trend for charts/tables
    const { rows: dailyTrend } = await db.query(
      `SELECT
         DATE(created_at AT TIME ZONE '${tz}') as date,
         COALESCE(SUM(CASE WHEN order_source = 'online' AND status != 'cancelled' THEN total ELSE 0 END), 0) as online_sales,
         COUNT(CASE WHEN order_source = 'online' AND status != 'cancelled' THEN 1 END) as online_orders,
         COALESCE(SUM(CASE WHEN (order_source != 'online' OR order_source IS NULL) AND status != 'cancelled' THEN total ELSE 0 END), 0) as in_restaurant_sales,
         COUNT(CASE WHEN (order_source != 'online' OR order_source IS NULL) AND status != 'cancelled' THEN 1 END) as in_restaurant_orders,
         COALESCE(SUM(CASE WHEN order_source = 'online' AND order_type = 'delivery' AND status != 'cancelled' THEN delivery_fee ELSE 0 END), 0) as delivery_fees
       FROM orders
       WHERE restaurant_id = $1
         AND created_at >= (NOW() AT TIME ZONE '${tz}')::date - ($2 || ' days')::interval
       GROUP BY DATE(created_at AT TIME ZONE '${tz}')
       ORDER BY date ASC`,
      [rId, days]
    );

    res.json({
      period,
      days,
      kpis: {
        online_sales: Number(salesComparison[0]?.online_sales || 0),
        online_orders_count: parseInt(salesComparison[0]?.online_orders_count || 0),
        in_restaurant_sales: Number(salesComparison[0]?.in_restaurant_sales || 0),
        in_restaurant_orders_count: parseInt(salesComparison[0]?.in_restaurant_orders_count || 0),
        delivery_fees_collected: Number(salesComparison[0]?.delivery_fees_collected || 0),
        delivery_orders_count: parseInt(salesComparison[0]?.delivery_orders_count || 0),
        pickup_orders_count: parseInt(salesComparison[0]?.pickup_orders_count || 0),
        avg_delivery_minutes: Number(avgTimeRows[0]?.avg_delivery_minutes || 0),
        avg_prep_minutes: Number(avgTimeRows[0]?.avg_prep_minutes || 0),
        delivered_count: parseInt(avgTimeRows[0]?.delivered_count || 0),
        total_rejected: totalRejected
      },
      rejection_reasons: rejectionSummary,
      daily_trend: dailyTrend
    });
  } catch (err) {
    console.error('Error fetching online ordering reports:', err);
    res.status(500).json({ error: 'Failed to fetch online ordering report' });
  }
});

// ── GET /api/reports/customers-loyalty ───────────────────────
// Metrics: repeat-customer rate, average spend per customer, loyalty liability (ETB), redemptions per month
router.get('/customers-loyalty', async (req, res) => {
  try {
    const rId = tid(req);
    const tz = await getSafeTz(rId);

    // 1. Fetch restaurant loyalty configuration (for point conversion)
    const { rows: restRows } = await db.query(
      `SELECT loyalty_enabled, loyalty_program_type, loyalty_point_val_etb 
       FROM restaurants WHERE id = $1`,
      [rId]
    );
    const pointVal = Number(restRows[0]?.loyalty_point_val_etb) || 0.10;

    // 2. Customer metrics
    const { rows: customerKpis } = await db.query(
      `SELECT
         COUNT(*) as total_customers,
         COUNT(*) FILTER (WHERE order_count >= 1) as customers_with_orders,
         COUNT(*) FILTER (WHERE order_count >= 2) as repeat_customers,
         COALESCE(SUM(total_spent), 0) as total_revenue,
         COALESCE(AVG(total_spent) FILTER (WHERE total_spent > 0), 0) as avg_spend_per_active_customer,
         COALESCE(SUM(points), 0) as total_points_outstanding,
         COUNT(*) FILTER (WHERE marketing_consent = true) as consented_marketing_count,
         COUNT(*) FILTER (WHERE created_at >= (NOW() AT TIME ZONE '${tz}') - INTERVAL '30 days') as new_customers_30d,
         COUNT(*) FILTER (WHERE last_visit_at < (NOW() AT TIME ZONE '${tz}') - INTERVAL '30 days') as inactive_customers_30d
       FROM customers
       WHERE restaurant_id = $1 AND is_anonymized = false`,
      [rId]
    );

    const ck = customerKpis[0] || {};
    const totalWithOrders = parseInt(ck.customers_with_orders || 0, 10);
    const repeatCustomers = parseInt(ck.repeat_customers || 0, 10);
    const repeatRate = totalWithOrders > 0
      ? Math.round((repeatCustomers / totalWithOrders) * 1000) / 10
      : 0;
    const totalPoints = parseInt(ck.total_points_outstanding || 0, 10);
    const liabilityEtb = Math.round(totalPoints * pointVal * 100) / 100;

    // 3. Monthly redemptions (last 6 months)
    const { rows: monthlyRedemptions } = await db.query(
      `SELECT
         TO_CHAR(created_at AT TIME ZONE '${tz}', 'YYYY-MM') as month,
         COUNT(*) as redemption_count,
         ABS(COALESCE(SUM(points), 0)) as points_redeemed,
         ROUND(ABS(COALESCE(SUM(points), 0))::numeric * $2::numeric, 2) as value_redeemed_etb
       FROM loyalty_transactions
       WHERE restaurant_id = $1 
         AND type = 'redeem'
         AND created_at >= (NOW() AT TIME ZONE '${tz}') - INTERVAL '6 months'
       GROUP BY TO_CHAR(created_at AT TIME ZONE '${tz}', 'YYYY-MM')
       ORDER BY month ASC`,
      [rId, pointVal]
    );

    // 4. Monthly earned points (last 6 months)
    const { rows: monthlyEarned } = await db.query(
      `SELECT
         TO_CHAR(created_at AT TIME ZONE '${tz}', 'YYYY-MM') as month,
         COUNT(*) as earn_count,
         COALESCE(SUM(points), 0) as points_earned
       FROM loyalty_transactions
       WHERE restaurant_id = $1 
         AND type = 'earn'
         AND created_at >= (NOW() AT TIME ZONE '${tz}') - INTERVAL '6 months'
       GROUP BY TO_CHAR(created_at AT TIME ZONE '${tz}', 'YYYY-MM')
       ORDER BY month ASC`,
      [rId]
    );

    res.json({
      repeat_customer_rate: repeatRate,
      repeat_customers: repeatCustomers,
      total_ordering_customers: totalWithOrders,
      total_customers: parseInt(ck.total_customers || 0, 10),
      average_spend_per_customer: Math.round(Number(ck.avg_spend_per_active_customer || 0) * 100) / 100,
      total_revenue_from_customers: Number(ck.total_revenue || 0),
      loyalty_points_outstanding: totalPoints,
      loyalty_liability_etb: liabilityEtb,
      point_value_etb: pointVal,
      consented_marketing_count: parseInt(ck.consented_marketing_count || 0, 10),
      new_customers_30d: parseInt(ck.new_customers_30d || 0, 10),
      inactive_customers_30d: parseInt(ck.inactive_customers_30d || 0, 10),
      monthly_redemptions: monthlyRedemptions,
      monthly_earned: monthlyEarned
    });
  } catch (err) {
    console.error('Error fetching customers/loyalty report:', err);
    res.status(500).json({ error: 'Failed to fetch customer loyalty reports' });
  }
});

// ── GET /api/reports/payments ─────────────────────────────────
// Totals by method per day, per shift, unconfirmed amount, and reconciliation metrics
router.get('/payments', async (req, res) => {
  try {
    const rId = tid(req);
    const tz = await getSafeTz(rId);

    // 1. Daily totals by payment method (last 30 days)
    const { rows: dailyByMethod } = await db.query(
      `SELECT 
         DATE(p.created_at AT TIME ZONE '${tz}') as date,
         p.method,
         COUNT(*) as transaction_count,
         COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('confirmed', 'paid')), 0) as confirmed_amount,
         COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'pending'), 0) as pending_amount,
         COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0) as refunded_amount
       FROM payments p
       WHERE p.restaurant_id = $1
         AND p.created_at >= (NOW() AT TIME ZONE '${tz}') - INTERVAL '30 days'
       GROUP BY DATE(p.created_at AT TIME ZONE '${tz}'), p.method
       ORDER BY date DESC, p.method ASC`,
      [rId]
    );

    // 2. Totals by shift / till session
    const { rows: shiftTotals } = await db.query(
      `SELECT 
         s.id as session_id,
         s.opened_at,
         s.closed_at,
         s.status as session_status,
         st.name as staff_name,
         COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('confirmed', 'paid')), 0) as confirmed_total,
         COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash' AND p.status IN ('confirmed', 'paid')), 0) as cash_total,
         COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'telebirr' AND p.status IN ('confirmed', 'paid')), 0) as telebirr_total,
         COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cbe_birr' AND p.status IN ('confirmed', 'paid')), 0) as cbe_birr_total,
         COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'bank_transfer' AND p.status IN ('confirmed', 'paid')), 0) as bank_total,
         COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'card' AND p.status IN ('confirmed', 'paid')), 0) as card_total,
         COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'pending'), 0) as unconfirmed_amount,
         COUNT(*) FILTER (WHERE p.status = 'pending') as unconfirmed_count
       FROM cash_drawer_sessions s
       LEFT JOIN staff st ON st.id = s.staff_id
       LEFT JOIN payments p ON p.till_session_id = s.id
       WHERE s.restaurant_id = $1
       GROUP BY s.id, s.opened_at, s.closed_at, s.status, st.name
       ORDER BY s.opened_at DESC
       LIMIT 25`,
      [rId]
    );

    // 3. Unconfirmed pending mobile-money metrics
    const { rows: unconfirmedRows } = await db.query(
      `SELECT
         COUNT(*) as total_unconfirmed_count,
         COALESCE(SUM(amount), 0) as total_unconfirmed_amount,
         COALESCE(SUM(amount) FILTER (WHERE method = 'telebirr'), 0) as telebirr_unconfirmed_amount,
         COALESCE(SUM(amount) FILTER (WHERE method = 'cbe_birr'), 0) as cbe_unconfirmed_amount,
         COALESCE(SUM(amount) FILTER (WHERE method = 'bank_transfer'), 0) as bank_unconfirmed_amount
       FROM payments
       WHERE restaurant_id = $1 AND status = 'pending'`,
      [rId]
    );

    // 4. Statement reconciliation metrics
    const { rows: reconRows } = await db.query(
      `SELECT
         COALESCE(SUM(amount), 0) as total_statement_eligible,
         COALESCE(SUM(amount) FILTER (WHERE is_matched_with_statement = true), 0) as matched_amount,
         COALESCE(SUM(amount) FILTER (WHERE is_matched_with_statement = false), 0) as unmatched_amount,
         COUNT(*) FILTER (WHERE is_matched_with_statement = true) as matched_count,
         COUNT(*) FILTER (WHERE is_matched_with_statement = false) as unmatched_count
       FROM payments
       WHERE restaurant_id = $1 
         AND method IN ('telebirr', 'cbe_birr', 'bank_transfer')
         AND status IN ('confirmed', 'paid')`,
      [rId]
    );

    const unconfirmed = unconfirmedRows[0] || {};
    const recon = reconRows[0] || {};

    res.json({
      daily_by_method: dailyByMethod,
      shifts: shiftTotals,
      unconfirmed: {
        count: parseInt(unconfirmed.total_unconfirmed_count || 0, 10),
        total_amount: parseFloat(unconfirmed.total_unconfirmed_amount || 0),
        telebirr_amount: parseFloat(unconfirmed.telebirr_unconfirmed_amount || 0),
        cbe_birr_amount: parseFloat(unconfirmed.cbe_unconfirmed_amount || 0),
        bank_transfer_amount: parseFloat(unconfirmed.bank_unconfirmed_amount || 0),
      },
      reconciliation: {
        total_eligible: parseFloat(recon.total_statement_eligible || 0),
        matched_amount: parseFloat(recon.matched_amount || 0),
        unmatched_amount: parseFloat(recon.unmatched_amount || 0),
        matched_count: parseInt(recon.matched_count || 0, 10),
        unmatched_count: parseInt(recon.unmatched_count || 0, 10),
      },
    });
  } catch (err) {
    console.error('Error fetching payments report:', err);
    res.status(500).json({ error: 'Failed to fetch payments report' });
  }
});

module.exports = router;

