-- Step 5: Update Materialized Views to use timezone instead of UTC
BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_daily_sales;
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT 
  o.restaurant_id,
  DATE(o.created_at AT TIME ZONE r.timezone) as date,
  o.order_type,
  o.payment_method,
  COUNT(o.id) as total_orders,
  SUM(o.total) as total_revenue,
  SUM(o.tip_amount) as total_tips
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.status != 'cancelled'
GROUP BY 1, 2, 3, 4
WITH DATA;
CREATE UNIQUE INDEX idx_mv_daily_sales ON mv_daily_sales (restaurant_id, date, order_type, payment_method);

DROP MATERIALIZED VIEW IF EXISTS mv_item_performance;
CREATE MATERIALIZED VIEW mv_item_performance AS
SELECT 
  o.restaurant_id,
  DATE(o.created_at AT TIME ZONE r.timezone) as date,
  oi.menu_item_id,
  oi.menu_item_name,
  SUM(oi.quantity) as total_quantity,
  SUM(oi.quantity * oi.unit_price) as total_revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.status != 'cancelled'
GROUP BY 1, 2, 3, 4
WITH DATA;
CREATE UNIQUE INDEX idx_mv_item_perf ON mv_item_performance (restaurant_id, date, menu_item_id, menu_item_name);

DROP MATERIALIZED VIEW IF EXISTS mv_staff_performance;
CREATE MATERIALIZED VIEW mv_staff_performance AS
SELECT 
  o.restaurant_id,
  o.staff_id,
  DATE(o.created_at AT TIME ZONE r.timezone) as date,
  COUNT(o.id) as orders_handled,
  SUM(o.total) as total_sales,
  AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at))) FILTER (WHERE o.status = 'completed' OR o.status = 'served') as avg_handling_seconds,
  COUNT(o.id) FILTER (WHERE o.status = 'cancelled') as voided_orders
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.staff_id IS NOT NULL
GROUP BY 1, 2, 3
WITH DATA;
CREATE UNIQUE INDEX idx_mv_staff_perf ON mv_staff_performance (restaurant_id, staff_id, date);

DROP MATERIALIZED VIEW IF EXISTS mv_hourly_heatmap;
CREATE MATERIALIZED VIEW mv_hourly_heatmap AS
SELECT 
  o.restaurant_id,
  EXTRACT(ISODOW FROM o.created_at AT TIME ZONE r.timezone) as day_of_week,
  EXTRACT(HOUR FROM o.created_at AT TIME ZONE r.timezone) as hour_of_day,
  COUNT(o.id) as total_orders
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.status != 'cancelled'
GROUP BY 1, 2, 3
WITH DATA;
CREATE UNIQUE INDEX idx_mv_hourly_heatmap ON mv_hourly_heatmap (restaurant_id, day_of_week, hour_of_day);

DROP MATERIALIZED VIEW IF EXISTS mv_table_utilization;
CREATE MATERIALIZED VIEW mv_table_utilization AS
SELECT 
  o.restaurant_id,
  DATE(o.created_at AT TIME ZONE r.timezone) as date,
  o.table_id,
  COUNT(o.id) as total_parties,
  AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at))) FILTER (WHERE o.status IN ('completed', 'served')) as avg_duration_seconds
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.table_id IS NOT NULL AND o.status != 'cancelled'
GROUP BY 1, 2, 3
WITH DATA;
CREATE UNIQUE INDEX idx_mv_table_util ON mv_table_utilization (restaurant_id, date, table_id);

COMMIT;
