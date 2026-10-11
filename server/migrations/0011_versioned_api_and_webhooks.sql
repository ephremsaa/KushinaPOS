-- 0011_versioned_api_and_webhooks.sql
-- Migration for Versioned Developer API v1, Scoped API Keys, Webhooks with SSRF Security, and Delivery Logs

-- 1. Upgrade api_keys table with scopes, expiry, IP allowlist, rate limits, and admin suspension
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes JSONB NOT NULL DEFAULT '["menu:read", "orders:read"]'::jsonb;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_allowlist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_minute INT NOT NULL DEFAULT 60;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_suspended_by_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS request_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_api_keys_scopes ON api_keys USING gin(scopes);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);

-- 2. Webhooks Configuration Table
CREATE TABLE IF NOT EXISTS webhooks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'Webhook Endpoint',
  url                 TEXT NOT NULL,
  secret              TEXT NOT NULL,
  events              TEXT[] NOT NULL DEFAULT ARRAY['order.created', 'order.paid'],
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count       INT NOT NULL DEFAULT 0,
  max_failures        INT NOT NULL DEFAULT 10,
  auto_disabled_at    TIMESTAMPTZ,
  last_delivered_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_restaurant_id ON webhooks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(restaurant_id, is_active);

-- 3. Webhook Deliveries Log Table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id          UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  event               TEXT NOT NULL,
  payload             JSONB NOT NULL,
  status_code         INT,
  response_body       TEXT,
  status              TEXT NOT NULL DEFAULT 'retrying', -- 'success', 'failed', 'retrying'
  attempts            INT NOT NULL DEFAULT 1,
  max_attempts        INT NOT NULL DEFAULT 6,
  next_retry_at       TIMESTAMPTZ,
  error_message       TEXT,
  duration_ms         INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_restaurant ON webhook_deliveries(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(status, next_retry_at) WHERE status = 'retrying';

-- 4. API Request Idempotency & Rate Limit Store
CREATE TABLE IF NOT EXISTS api_idempotency_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  idempotency_key     TEXT NOT NULL,
  resource_type       TEXT NOT NULL,
  resource_id         TEXT NOT NULL,
  response_status     INT NOT NULL,
  response_body       JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_idempotency_key ON api_idempotency_records(restaurant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_api_idempotency_created ON api_idempotency_records(created_at);

-- 5. Integration Requests (Lead capture for custom integrations)
CREATE TABLE IF NOT EXISTS integration_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name     TEXT NOT NULL,
  contact_name        TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  integration_name    TEXT NOT NULL,
  use_case_notes      TEXT,
  status              TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'planned', 'closed'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_requests_status ON integration_requests(status);
