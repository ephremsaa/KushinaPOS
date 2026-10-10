-- Step 2: Add Indexes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created ON orders(restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_payment_created ON orders(restaurant_id, payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table_pending ON orders(restaurant_id, table_id) WHERE payment_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_rest_cat ON menu_items(restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_staff_rest_active ON staff(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_tx_rest_created ON inventory_transactions(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_paid_by_staff ON orders(paid_by_staff_id);

-- Step 3: Add CHECK Constraints
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (status IN ('new', 'pending', 'preparing', 'ready', 'served', 'cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_payment_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('pending', 'paid', 'refunded', 'voided'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_order_type;
ALTER TABLE orders ADD CONSTRAINT chk_orders_order_type CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_amounts;
ALTER TABLE orders ADD CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND tax_amount >= 0 AND total >= 0 AND tip_amount >= 0);

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_qty;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_qty CHECK (quantity > 0);

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_amounts;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_amounts CHECK (unit_price >= 0);

ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_price;
ALTER TABLE menu_items ADD CONSTRAINT chk_menu_items_price CHECK (price >= 0);

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_qty;
ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_qty CHECK (quantity >= 0);

-- Step 4: Add restaurants.timezone
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Addis_Ababa';
