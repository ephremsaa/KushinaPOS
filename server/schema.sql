-- ============================================================
-- kushinaPOS — PostgreSQL Schema (No Supabase)
-- Run: psql -U postgres -d kushina_pos -f schema.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- PLATFORM ADMINS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- SUBSCRIPTION PLANS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  price_monthly       NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_annual        NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_staff           INT NOT NULL DEFAULT 5,
  max_pos_terminals   INT NOT NULL DEFAULT 1,
  features            JSONB NOT NULL DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RESTAURANTS (Tenants)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT UNIQUE NOT NULL,
  password_hash           TEXT NOT NULL,
  phone                   TEXT,
  address                 TEXT,
  city                    TEXT,
  cuisine_type            TEXT,
  tax_id                  TEXT,
  logo_url                TEXT,
  business_license_url    TEXT,
  slug                    TEXT UNIQUE,
  previous_slugs          JSONB DEFAULT '[]'::jsonb,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','suspended','rejected')),
  rejection_reason        TEXT,
  approved_by             UUID REFERENCES platform_admins(id),
  approved_at             TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  tax_rate                NUMERIC(5,2) DEFAULT 0,
  receipt_footer          TEXT,
  theme_color             TEXT DEFAULT '#f97316',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES subscription_plans(id),
  status                TEXT NOT NULL DEFAULT 'trial'
                        CHECK (status IN ('trial','active','grace','expired','cancelled')),
  billing_cycle         TEXT NOT NULL DEFAULT 'monthly'
                        CHECK (billing_cycle IN ('monthly','annual')),
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PAYMENT PROOFS (Manual Telebirr/CBE billing)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_proofs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ETB',
  payment_method  TEXT NOT NULL DEFAULT 'telebirr'
                  CHECK (payment_method IN ('telebirr','cbe','other')),
  screenshot_url  TEXT NOT NULL,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID REFERENCES platform_admins(id),
  reviewed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- STAFF
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT,
  role            TEXT NOT NULL DEFAULT 'cashier'
                  CHECK (role IN ('owner','manager','cashier','kitchen','waiter')),
  pin_hash        TEXT,
  phone           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, email)
);

-- ─────────────────────────────────────────────
-- MENU CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- MENU ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id               UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id                 UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name                        TEXT NOT NULL,
  description                 TEXT,
  price                       NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url                   TEXT,
  is_available                BOOLEAN NOT NULL DEFAULT TRUE,
  preparation_time_minutes    INT DEFAULT 10,
  sort_order                  INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLES (Floor plan)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  capacity      INT NOT NULL DEFAULT 4,
  shape         TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect','circle')),
  status        TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','occupied','reserved','cleaning')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RESERVATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id        UUID REFERENCES tables(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  party_size      INT NOT NULL DEFAULT 2,
  reservation_time TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','seated','cancelled','no_show')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id        UUID REFERENCES tables(id) ON DELETE SET NULL,
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_type      TEXT NOT NULL DEFAULT 'dine_in'
                  CHECK (order_type IN ('dine_in','takeaway','delivery')),
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','preparing','ready','served','cancelled')),
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  tip_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_name   TEXT,
  notes           TEXT,
  local_id        TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending','paid','refunded')),
  payment_method  TEXT,
  till_session_id UUID, -- Will reference cash_drawer_sessions(id)
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, local_id)
);

-- ─────────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id      UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_name    TEXT NOT NULL,
  quantity          INT NOT NULL DEFAULT 1,
  unit_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  modifier_choices  JSONB NOT NULL DEFAULT '[]',
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','preparing','ready','served')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- INVENTORY
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'pcs',
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,3) NOT NULL DEFAULT 5,
  cost_per_unit       NUMERIC(10,2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('restock','adjustment','waste','order_usage')),
  quantity_delta NUMERIC(10,3) NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id  UUID REFERENCES platform_admins(id),
  actor_email     TEXT,
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS (Decoupled Engine)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('low_stock','payment_failed','new_reservation','order_stuck','staff_anomaly','new_online_order','billing')),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  target_role   TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('owner','manager','cashier','kitchen','waiter','all')),
  user_id       UUID REFERENCES staff(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','sms')),
  metadata      JSONB NOT NULL DEFAULT '{}',
  read_by       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  alert_type    TEXT NOT NULL CHECK (alert_type IN ('low_stock','payment_failed','new_reservation','order_stuck','staff_anomaly','new_online_order','billing')),
  in_app        BOOLEAN NOT NULL DEFAULT TRUE,
  email         BOOLEAN NOT NULL DEFAULT FALSE,
  sms           BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, alert_type)
);

-- ─────────────────────────────────────────────
-- SEED: Subscription Plans
-- ─────────────────────────────────────────────
INSERT INTO subscription_plans (name, price_monthly, price_annual, max_staff, max_pos_terminals, features)
VALUES
  ('Starter',  499,   4990,   5,  1, '{"kds": false, "inventory": false}'),
  ('Growth',   999,   9990,   15, 3, '{"kds": true,  "inventory": true}'),
  ('Pro',      1999,  19990,  50, 10,'{"kds": true,  "inventory": true, "multi_branch": true}')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- TILL / CASH DRAWER SESSIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES staff_shifts(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  starting_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  actual_cash NUMERIC(10,2),
  expected_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  discrepancy_amount NUMERIC(10,2),
  manager_signoff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);
