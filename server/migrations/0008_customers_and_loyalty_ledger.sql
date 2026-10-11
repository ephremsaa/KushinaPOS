-- ============================================================
-- kushinaPOS — Migration 0008: Customers, Loyalty Ledger & Marketing
-- ============================================================

-- 1. Extend Customers Table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS order_count INT NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

-- Ensure phone is unique per restaurant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_customers_restaurant_phone'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT uq_customers_restaurant_phone UNIQUE (restaurant_id, phone);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_restaurant_spent ON customers(restaurant_id, total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_visit ON customers(restaurant_id, last_visit_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_marketing ON customers(restaurant_id, marketing_consent);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Link Customers to Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- 3. Restaurant Loyalty Program Settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_program_type TEXT NOT NULL DEFAULT 'points'; -- 'points' | 'stamps'
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_points_per_100_etb NUMERIC(5,2) NOT NULL DEFAULT 10;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_point_val_etb NUMERIC(5,2) NOT NULL DEFAULT 0.10;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_min_redeem_points INT NOT NULL DEFAULT 50;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_max_bill_share_percent NUMERIC(5,2) NOT NULL DEFAULT 50;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_expiry_months INT DEFAULT 12;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS loyalty_stamp_target INT NOT NULL DEFAULT 10;

-- 4. Loyalty Ledger Table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust', 'expire', 'reverse')),
  points          INT NOT NULL,
  balance_after   INT NOT NULL CHECK (balance_after >= 0),
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_restaurant ON loyalty_transactions(restaurant_id, created_at DESC);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Marketing Campaigns Table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('manual', 'whatsapp', 'telegram', 'sms')),
  target_segment    TEXT NOT NULL DEFAULT 'all',
  recipient_count   INT NOT NULL DEFAULT 0,
  message_text      TEXT NOT NULL,
  sent_by           UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_restaurant ON marketing_campaigns(restaurant_id, created_at DESC);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
