// ============================================================
// Database Types — auto-matched to kushinaPOS schema
// ============================================================

// ── Settings helpers ──────────────────────────────────────

export interface DayHours {
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
  closed: boolean;
}

/** Keyed by lowercase day name: "monday" … "sunday" */
export type OperatingHours = Record<string, DayHours>;

export interface ExtraTaxRate {
  id: string;
  name: string;   // e.g. "Alcohol Tax"
  rate: number;   // percentage, e.g. 5.0
}

export interface Printer {
  id: string;
  name: string;
  station: string;        // "General" | "Kitchen" | "Bar" | …
  type: 'receipt' | 'kitchen';
  ip_or_usb: string;      // IP address or USB path
  is_active: boolean;
}

export interface KDSStationConfig {
  id: string;
  name: string;           // display label, e.g. "Grill"
  label: string;          // short tag
  menu_stations: string[]; // which menu item stations route here
}

export type RestaurantStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'cancelled';
export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'suspended' | 'cancelled';
export type StaffRole = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type PaymentMethod = 'telebirr' | 'cbe' | 'other';
export type PaymentProofStatus = 'pending' | 'approved' | 'rejected';
export type InventoryTxType = 'restock' | 'usage' | 'adjustment' | 'waste';
export type BillingCycle = 'monthly' | 'annual';

// ── Platform ──────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  max_staff: number;
  max_pos_terminals: number;
  features: {
    kds?: boolean;
    inventory?: boolean;
    reports?: 'basic' | 'advanced';
    api_access?: boolean;
    priority_support?: boolean;
  };
  is_active: boolean;
  created_at: string;
}

export interface PlatformAdmin {
  user_id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Restaurant {
  id: string;
  owner_user_id: string;
  name: string;
  address?: string;
  city?: string;
  cuisine_type?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  business_license_url?: string;
  tax_id?: string;
  tax_rate: number;
  tax_inclusive?: boolean;
  extra_tax_rates?: ExtraTaxRate[];
  status: RestaurantStatus;
  theme_color?: string;
  background_color?: string;
  currency?: string;
  plan_id?: string;
  trial_ends_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  // Receipt
  receipt_footer?: string;
  receipt_header?: string;
  receipt_show_logo?: boolean;
  receipt_show_tax_breakdown?: boolean;
  receipt_default_mode?: 'print' | 'email' | 'sms';
  // Service charge
  service_charge_enabled?: boolean;
  service_charge_percent?: number;
  service_charge_mandatory?: boolean;
  service_charge_split_staff?: boolean;
  // Operating hours
  operating_hours?: OperatingHours;
  // Devices
  printers?: Printer[];
  kds_stations_config?: KDSStationConfig[];
  created_at: string;
  updated_at: string;
  // Joined
  subscription_plans?: SubscriptionPlan;
  subscriptions?: Subscription[];
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
  // Joined
  subscription_plans?: SubscriptionPlan;
}

export interface PaymentProof {
  id: string;
  restaurant_id: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  screenshot_url: string;
  note?: string;
  status: PaymentProofStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  submitted_at: string;
  // Joined
  restaurants?: Pick<Restaurant, 'id' | 'name' | 'email'>;
}

// ── Tenant ────────────────────────────────────────────────

export interface Staff {
  id: string;
  restaurant_id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  is_active: boolean;
  pin?: string;
  has_pin?: boolean;
  deactivated_at?: string;
  deactivation_note?: string;
  invited_at: string;
  last_login_at?: string;
  created_at?: string;
}


export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

export interface ModifierOption {
  label: string;
  price_delta: number;
}

export interface MenuModifier {
  id: string;
  menu_item_id: string;
  name: string;
  is_required: boolean;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time_minutes: number;
  sort_order: number;
  tags: string[];
  station: string;
  created_at: string;
  updated_at: string;
  // Joined
  category_name?: string;
  menu_modifiers?: MenuModifier[];
}


export interface Table {
  id: string;
  restaurant_id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  position_x: number;
  position_y: number;
  shape: 'rect' | 'circle';
  created_at: string;
}

export interface ModifierChoice {
  modifier_id: string;
  modifier_name: string;
  option_label: string;
  price_delta: number;
}

export interface OrderItem {
  id?: string;
  order_id: string;
  menu_item_id?: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  modifier_choices: ModifierChoice[];
  status: OrderItemStatus;
  notes?: string;
  station?: string;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id?: string;
  staff_id?: string;
  order_number?: number;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  tip_amount?: number;
  amount_tendered?: number;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  local_id?: string;
  synced_at?: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method?: string | null;
  device_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields from backend queries
  table_label?: string;
  staff_name?: string;
  tables?: Pick<Table, 'id' | 'label'>;
  staff?: Pick<Staff, 'id' | 'name' | 'role'>;
  order_items?: OrderItem[];
}


export interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  cost_per_unit?: number;
  supplier_id?: string;
  supplier_name?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  restaurant_id: string;
  item_id: string;
  type: 'restock' | 'adjustment' | 'waste' | 'order_usage';
  quantity_delta: number;
  reference_order_id?: string;
  note?: string;
  recorded_by?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id?: string;
  actor_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Auth Context ──────────────────────────────────────────

export type AppRole = 'platform_admin' | 'restaurant_owner' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  staffRecord?: Staff;
  restaurant?: Restaurant;
  isPlatformAdmin: boolean;
}

// ── Notifications ──────────────────────────────────────────

export type NotificationType = 
  | 'low_stock' 
  | 'payment_failed' 
  | 'new_reservation' 
  | 'order_stuck' 
  | 'staff_anomaly' 
  | 'new_online_order' 
  | 'billing';

export interface Notification {
  id: string;
  restaurant_id: string;
  type: NotificationType;
  title: string;
  message: string;
  target_role: StaffRole | 'all';
  user_id?: string;
  channel: 'in_app' | 'email' | 'sms';
  metadata?: Record<string, any>;
  read_by: string[];
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreference {
  alert_type: NotificationType;
  in_app: boolean;
  email: boolean;
  sms: boolean;
}

