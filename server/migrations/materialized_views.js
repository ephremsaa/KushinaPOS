require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Daily Sales
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales AS
      SELECT 
        restaurant_id,
        DATE(created_at AT TIME ZONE 'UTC') as date,
        order_type,
        payment_method,
        COUNT(id) as total_orders,
        SUM(total) as total_revenue,
        SUM(tip_amount) as total_tips
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY 1, 2, 3, 4
      WITH DATA;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_sales 
      ON mv_daily_sales (restaurant_id, date, order_type, payment_method);
    `);

    // 2. Item Performance
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_item_performance AS
      SELECT 
        o.restaurant_id,
        DATE(o.created_at AT TIME ZONE 'UTC') as date,
        oi.menu_item_id,
        oi.menu_item_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.unit_price) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled'
      GROUP BY 1, 2, 3, 4
      WITH DATA;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_item_perf 
      ON mv_item_performance (restaurant_id, date, menu_item_id, menu_item_name);
    `);

    // 3. Staff Performance
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_staff_performance AS
      SELECT 
        restaurant_id,
        staff_id,
        DATE(created_at AT TIME ZONE 'UTC') as date,
        COUNT(id) as orders_handled,
        SUM(total) as total_sales,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed' OR status = 'served') as avg_handling_seconds,
        COUNT(id) FILTER (WHERE status = 'cancelled') as voided_orders
      FROM orders
      WHERE staff_id IS NOT NULL
      GROUP BY 1, 2, 3
      WITH DATA;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_staff_perf 
      ON mv_staff_performance (restaurant_id, staff_id, date);
    `);

    // 4. Hourly Heatmap
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_heatmap AS
      SELECT 
        restaurant_id,
        EXTRACT(ISODOW FROM created_at AT TIME ZONE 'UTC') as day_of_week,
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') as hour_of_day,
        COUNT(id) as total_orders
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY 1, 2, 3
      WITH DATA;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hourly_heatmap 
      ON mv_hourly_heatmap (restaurant_id, day_of_week, hour_of_day);
    `);

    // 5. Table Utilization
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_table_utilization AS
      SELECT 
        restaurant_id,
        DATE(created_at AT TIME ZONE 'UTC') as date,
        table_id,
        COUNT(id) as total_parties,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status IN ('completed', 'served')) as avg_duration_seconds
      FROM orders
      WHERE table_id IS NOT NULL AND status != 'cancelled'
      GROUP BY 1, 2, 3
      WITH DATA;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_table_util 
      ON mv_table_utilization (restaurant_id, date, table_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Materialized Views created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
