-- ─────────────────────────────────────────────────────────────
-- MIGRATION 0010: UNIFIED PAYMENT LAYER & PROVIDER ADAPTERS
-- ─────────────────────────────────────────────────────────────

-- 1. Create Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  till_session_id UUID REFERENCES cash_drawer_sessions(id) ON DELETE SET NULL,
  created_by UUID, -- cashier or staff member who recorded it
  method TEXT NOT NULL CHECK (method IN ('cash','telebirr','cbe_birr','bank_transfer','card','loyalty')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETB',
  reference TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('initiated','pending','confirmed','paid','rejected','failed','refunded','expired')),
  confirmed_by UUID, -- manager or owner (or platform admin for subscriptions)
  confirmed_at TIMESTAMPTZ,
  rejected_reason TEXT,
  original_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  is_matched_with_statement BOOLEAN DEFAULT false,
  matched_at TIMESTAMPTZ,
  matched_by UUID,
  invoice_number TEXT,
  provider TEXT, -- adapter provider name (telebirr, cbe_birr, chapa, mock_sandbox)
  provider_reference TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive, trimmed uniqueness on reference per restaurant for active payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_restaurant_reference 
  ON payments (restaurant_id, LOWER(TRIM(reference))) 
  WHERE reference IS NOT NULL AND TRIM(reference) != '' AND status != 'rejected' AND status != 'failed';

CREATE INDEX IF NOT EXISTS idx_payments_restaurant_status ON payments (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_till_session ON payments (till_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);

-- 2. Restaurant Payment Gateway Configs (Encrypted credentials & feature flags)
CREATE TABLE IF NOT EXISTS restaurant_payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('telebirr','cbe_birr','chapa','mock_sandbox')),
  is_enabled BOOLEAN DEFAULT false,
  is_sandbox BOOLEAN DEFAULT true,
  encrypted_credentials TEXT, -- AES-256-GCM encrypted blob
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_rest_payment_configs_rest ON restaurant_payment_configs (restaurant_id);

-- 3. Webhook Idempotency & Audit Logs
CREATE TABLE IF NOT EXISTS payment_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  reference TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','ignored','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

-- 4. Subscription Sequential Invoice Sequence
CREATE SEQUENCE IF NOT EXISTS subscription_invoice_seq START 1001;

-- 5. Add columns to cash_drawer_sessions for unconfirmed payment audit if not already present
ALTER TABLE cash_drawer_sessions 
  ADD COLUMN IF NOT EXISTS unconfirmed_payments_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unconfirmed_notes TEXT,
  ADD COLUMN IF NOT EXISTS shift_id UUID;

-- 6. Add billing alert columns to restaurants and subscriptions
ALTER TABLE restaurants 
  ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_failed_reason TEXT,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

