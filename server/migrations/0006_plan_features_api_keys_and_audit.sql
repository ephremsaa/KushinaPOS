-- ============================================================
-- kushinaPOS — Migration 0006: Plan Feature Flags, API Keys, Audit Logs & Delivery
-- ============================================================

-- 1. Ensure audit_logs has restaurant_id and actor_user_id for tenant audit trails
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_created ON audit_logs(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);

-- 2. Delivery & Loyalty Columns on restaurants and orders
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS default_delivery_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_charge_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_charge_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'pos';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS station TEXT DEFAULT 'kitchen';

-- 3. API Keys Table for Enterprise / Pro External Integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  key_prefix    TEXT NOT NULL,
  permissions   JSONB NOT NULL DEFAULT '["read", "write"]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_restaurant_id ON api_keys(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(restaurant_id, is_active);

-- 4. Update Subscription Plans to explicitly define feature flags (delivery, loyalty, api_access)
UPDATE subscription_plans
SET features = jsonb_build_object(
  'kds', false,
  'inventory', false,
  'delivery', false,
  'loyalty', false,
  'api_access', false,
  'multi_branch', false
)
WHERE LOWER(name) = 'starter';

UPDATE subscription_plans
SET features = jsonb_build_object(
  'kds', true,
  'inventory', true,
  'delivery', true,
  'loyalty', true,
  'api_access', false,
  'multi_branch', false
)
WHERE LOWER(name) = 'growth';

UPDATE subscription_plans
SET features = jsonb_build_object(
  'kds', true,
  'inventory', true,
  'delivery', true,
  'loyalty', true,
  'api_access', true,
  'multi_branch', true
)
WHERE LOWER(name) IN ('pro', 'enterprise');

-- 5. Enable Row Level Security (RLS) on all public tables (including leads, api_keys, audit_logs)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END;
$$;
