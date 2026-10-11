-- ============================================================
-- kushinaPOS — Migration 0007: Online Ordering & Delivery Zones
-- ============================================================

-- 1. Delivery Zones Table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  fee                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_minutes   INT NOT NULL DEFAULT 35,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant_active ON delivery_zones(restaurant_id, is_active);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- 2. Restaurant Online Ordering Configuration Columns
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_ordering_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_pickup_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_delivery_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_auto_accept BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_prep_time_minutes INT DEFAULT 25;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_max_active_orders INT DEFAULT 20;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_payment_methods JSONB DEFAULT '["cash", "telebirr", "cbe_birr"]'::jsonb;

-- 3. Orders Table Columns for Pickup, Delivery & Tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_landmark TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accept_status TEXT DEFAULT 'accepted';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 4. Indexes for Rapid Lookup & Isolation
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token);
CREATE INDEX IF NOT EXISTS idx_orders_online_inbox ON orders(restaurant_id, order_source, accept_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone ON orders(delivery_zone_id);

-- 5. Expand Status Constraints for Delivery & Cancellation
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (status IN ('new', 'pending', 'preparing', 'ready', 'served', 'cancelled', 'out_for_delivery', 'delivered'));

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_status_check CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled'));
