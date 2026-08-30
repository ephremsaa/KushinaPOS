-- ============================================================
-- kushinaPOS — RLS Policies Migration 002
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================

-- Returns the restaurant_id for the currently authenticated staff member
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id
  FROM staff
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Returns true if the current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Returns the role of the current user within their tenant
CREATE OR REPLACE FUNCTION current_staff_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM staff
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- platform_admins — only platform admins can read their own row
-- ============================================================

CREATE POLICY "admins_read_own" ON platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- subscription_plans — publicly readable (for signup page)
-- ============================================================

CREATE POLICY "plans_public_read" ON subscription_plans
  FOR SELECT USING (true);

CREATE POLICY "plans_admin_write" ON subscription_plans
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- restaurants
-- ============================================================

-- Restaurant owner can read/update their own restaurant
CREATE POLICY "restaurant_owner_read" ON restaurants
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR is_platform_admin()
    OR id = current_tenant_id()
  );

CREATE POLICY "restaurant_owner_update" ON restaurants
  FOR UPDATE USING (owner_user_id = auth.uid() OR is_platform_admin());

-- Anyone can insert (self-registration)
CREATE POLICY "restaurant_self_register" ON restaurants
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Platform admin full access
CREATE POLICY "restaurant_admin_all" ON restaurants
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- subscriptions
-- ============================================================

CREATE POLICY "subscriptions_tenant_read" ON subscriptions
  FOR SELECT USING (
    restaurant_id = current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = subscriptions.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR is_platform_admin()
  );

CREATE POLICY "subscriptions_admin_write" ON subscriptions
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- payment_proofs
-- ============================================================

-- Tenant/owner can read and insert their own proofs
CREATE POLICY "payment_proof_tenant_select" ON payment_proofs
  FOR SELECT USING (
    restaurant_id = current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = payment_proofs.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR is_platform_admin()
  );

CREATE POLICY "payment_proof_tenant_insert" ON payment_proofs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = payment_proofs.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR is_platform_admin()
  );

CREATE POLICY "payment_proof_admin_update" ON payment_proofs
  FOR UPDATE USING (is_platform_admin());

-- ============================================================
-- staff — scoped to tenant
-- ============================================================

CREATE POLICY "staff_tenant_read" ON staff
  FOR SELECT USING (
    restaurant_id = current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = staff.restaurant_id AND r.owner_user_id = auth.uid()
    )
    OR is_platform_admin()
    OR user_id = auth.uid() -- can read own record
  );

CREATE POLICY "staff_manager_write" ON staff
  FOR INSERT WITH CHECK (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

CREATE POLICY "staff_manager_update" ON staff
  FOR UPDATE USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

CREATE POLICY "staff_admin_all" ON staff
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- menu_categories
-- ============================================================

CREATE POLICY "menu_cat_tenant_read" ON menu_categories
  FOR SELECT USING (restaurant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "menu_cat_manager_write" ON menu_categories
  FOR ALL USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

-- ============================================================
-- menu_items
-- ============================================================

CREATE POLICY "menu_items_tenant_read" ON menu_items
  FOR SELECT USING (restaurant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "menu_items_manager_write" ON menu_items
  FOR ALL USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

-- ============================================================
-- menu_modifiers
-- ============================================================

CREATE POLICY "modifiers_tenant_read" ON menu_modifiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      WHERE mi.id = menu_modifiers.menu_item_id
        AND mi.restaurant_id = current_tenant_id()
    )
    OR is_platform_admin()
  );

CREATE POLICY "modifiers_manager_write" ON menu_modifiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      WHERE mi.id = menu_modifiers.menu_item_id
        AND mi.restaurant_id = current_tenant_id()
        AND current_staff_role() IN ('owner','manager')
    )
  );

-- ============================================================
-- tables
-- ============================================================

CREATE POLICY "tables_tenant_read" ON tables
  FOR SELECT USING (restaurant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "tables_staff_update" ON tables
  FOR UPDATE USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager','cashier','waiter')
  );

CREATE POLICY "tables_manager_insert_delete" ON tables
  FOR ALL USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

-- ============================================================
-- orders
-- ============================================================

CREATE POLICY "orders_tenant_read" ON orders
  FOR SELECT USING (restaurant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "orders_staff_insert" ON orders
  FOR INSERT WITH CHECK (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager','cashier','waiter')
  );

CREATE POLICY "orders_staff_update" ON orders
  FOR UPDATE USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager','cashier','waiter','kitchen')
  );

-- ============================================================
-- order_items
-- ============================================================

CREATE POLICY "order_items_tenant_read" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.restaurant_id = current_tenant_id()
    )
    OR is_platform_admin()
  );

CREATE POLICY "order_items_staff_write" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.restaurant_id = current_tenant_id()
    )
    AND current_staff_role() IN ('owner','manager','cashier','waiter','kitchen')
  );

-- ============================================================
-- inventory_items
-- ============================================================

CREATE POLICY "inventory_tenant_read" ON inventory_items
  FOR SELECT USING (restaurant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "inventory_manager_write" ON inventory_items
  FOR ALL USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

-- ============================================================
-- inventory_transactions
-- ============================================================

CREATE POLICY "inv_tx_tenant_read" ON inventory_transactions
  FOR SELECT USING (restaurant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "inv_tx_manager_write" ON inventory_transactions
  FOR ALL USING (
    restaurant_id = current_tenant_id()
    AND current_staff_role() IN ('owner','manager')
  );

-- ============================================================
-- audit_logs — platform admin only
-- ============================================================

CREATE POLICY "audit_admin_read" ON audit_logs
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "audit_service_insert" ON audit_logs
  FOR INSERT WITH CHECK (true); -- service role writes from edge functions
