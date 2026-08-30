-- ============================================================
-- kushinaPOS — Seed Data
-- ============================================================

-- Plans
INSERT INTO subscription_plans (id, name, price_monthly, price_annual, max_staff, max_pos_terminals, features) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Starter',    500,  5000, 5,  1, '{"kds": false, "inventory": false, "reports": "basic"}'),
  ('00000000-0000-0000-0000-000000000002', 'Growth',    1200, 12000, 20, 3, '{"kds": true,  "inventory": true,  "reports": "advanced"}'),
  ('00000000-0000-0000-0000-000000000003', 'Enterprise', 2500, 25000, 999,10,'{"kds": true,  "inventory": true,  "reports": "advanced", "api_access": true, "priority_support": true}')
ON CONFLICT (id) DO NOTHING;
