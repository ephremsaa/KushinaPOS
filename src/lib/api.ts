/**
 * kushinaPOS Frontend API Client
 *
 * Replaces @supabase/supabase-js — wraps all fetch calls to the Express backend.
 * Token is stored in localStorage and auto-attached to every request.
 */

function getBaseApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`;
  }
  return '/api';
}

export const BASE_URL = getBaseApiUrl();

export const TOKEN_KEY = 'kushina_token';

// ── Token helpers ─────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember: boolean = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ── Base fetch wrapper ────────────────────────────────────────
async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

  const data = await res.json().catch(() => ({})); // Safe to ignore: empty body is not an error

  if (!res.ok) {
    // Handle session invalidation (401 or specific 403 codes)
    if (res.status === 401 || (res.status === 403 && (data?.code === 'STAFF_DISABLED' || data?.code === 'RESTAURANT_SUSPENDED'))) {
      clearToken();
      sessionStorage.setItem('redirect_after_login', window.location.pathname);
      
      const match = window.location.pathname.match(/^\/r\/([^\/]+)/);
      const loginPath = match ? `/r/${match[1]}/staff/login` : '/login';
      
      if (window.location.pathname !== loginPath) {
        window.location.href = `${loginPath}?expired=1`;
        return new Promise(() => {}); // wait for redirect
      }
    }

    const message = data?.error || `Request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

// ── Convenience methods ───────────────────────────────────────
export const api = {
  get:    <T = unknown>(path: string) => request<T>('GET', path),
  post:   <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  put:    <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch:  <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),

  /** Multipart form upload (for screenshots, images, logos) */
  upload: <T = unknown>(path: string, formData: FormData) =>
    request<T>('POST', path, formData, true),
};

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  register: (body: Record<string, unknown>) =>
    api.post<{ token: string; user: Record<string, unknown> }>('/auth/register', body),

  login: (email: string, password: string) =>
    api.post<{ token: string; user: Record<string, unknown> }>('/auth/login', { email, password }),

  staffLogin: (slug: string, pin: string) =>
    api.post<{ token: string; user: Record<string, unknown> }>('/auth/staff-login', { slug, pin }),

  me: () => api.get('/auth/me'),

  createAdmin: (body: Record<string, unknown>) =>
    api.post('/auth/admin/create', body),
};

// ── Restaurant self-service ───────────────────────────────────
export const restaurantApi = {
  me: () => api.get('/restaurants/me'),
  update: (data: Record<string, unknown>) => api.patch('/restaurants/me', data),
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    return api.upload<{ logo_url: string }>('/restaurants/me/logo', fd);
  },
  uploadMenuImage: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.upload<{ image_url: string }>('/restaurants/menu-image', fd);
  },
  testPrint: (data: { printer_name: string; ip_or_usb: string; type: string }) =>
    api.post<{ success: boolean; message: string }>('/restaurants/me/test-print', data),
  getDeliveryZones: () => api.get<any[]>('/restaurants/delivery-zones'),
  createDeliveryZone: (data: Record<string, unknown>) => api.post<any>('/restaurants/delivery-zones', data),
  updateDeliveryZone: (id: string, data: Record<string, unknown>) => api.patch<any>(`/restaurants/delivery-zones/${id}`, data),
  deleteDeliveryZone: (id: string) => api.delete<any>(`/restaurants/delivery-zones/${id}`),
};

// ── Menu ──────────────────────────────────────────────────────
export const menuApi = {
  getCategories:  () => api.get('/menu/categories'),
  createCategory: (data: Record<string, unknown>) => api.post('/menu/categories', data),
  updateCategory: (id: string, data: Record<string, unknown>) => api.patch(`/menu/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/menu/categories/${id}`),

  getItems:    () => api.get('/menu/items'),
  createItem:  (data: Record<string, unknown>) => api.post('/menu/items', data),
  updateItem:  (id: string, data: Record<string, unknown>) => api.patch(`/menu/items/${id}`, data),
  deleteItem:  (id: string) => api.delete(`/menu/items/${id}`),

  // Modifiers
  getModifiers:  (itemId: string) => api.get(`/menu/items/${itemId}/modifiers`),
  saveModifiers: (itemId: string, modifiers: unknown[]) => api.post(`/menu/items/${itemId}/modifiers`, { modifiers }),

  // CSV import/export
  exportCsv: () => `${'/api'}/menu/export`,  // returns URL — open in new tab or anchor
  importCsv: (rows: Record<string, unknown>[]) => api.post('/menu/import', { rows }),
};


// ── Orders ────────────────────────────────────────────────────
export const ordersApi = {
  list:            (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/orders${qs}`);
  },
  kitchen:         () => api.get('/orders/kitchen'),
  stale:           (minutes = 45) => api.get(`/orders/stale?minutes=${minutes}`),
  openForTable:    (table_id: string) => api.get(`/orders/open?table_id=${table_id}`),
  create:          (data: Record<string, unknown>) => api.post('/orders', data),
  addItems:        (id: string, data: Record<string, unknown>) => api.post(`/orders/${id}/items`, data),
  setStatus:       (id: string, status: string) => api.patch(`/orders/${id}/status`, { status }),
  cancelWithReason:(id: string, reason: string) => api.patch(`/orders/${id}/status`, { status: 'cancelled', reason }),
  update:          (id: string, data: Record<string, unknown>) => api.patch(`/orders/${id}`, data),
  pay:             (id: string, data: Record<string, unknown>) => api.patch(`/orders/${id}/pay`, data),
  void:            (id: string, manager_pin: string) => api.patch(`/orders/${id}/void`, { manager_pin }),
  confirmPayment:  (id: string) => api.patch(`/orders/${id}/confirm-payment`),
  setItemStatus:   (itemId: string, status: string) => api.patch(`/orders/items/${itemId}/status`, { status }),
  todaySummary:    () => api.get('/orders/today/summary'),
  history:         (dateFrom?: string) => api.get(`/orders/history${dateFrom ? `?date_from=${dateFrom}` : ''}`),
  onlineList:      (tab?: string) => api.get<any[]>(`/orders/online${tab ? `?tab=${tab}` : ''}`),
  acceptOnline:    (id: string, prep_time_minutes?: number) => api.patch<any>(`/orders/${id}/accept-online`, { prep_time_minutes }),
  rejectOnline:    (id: string, rejection_reason: string) => api.patch<any>(`/orders/${id}/reject-online`, { rejection_reason }),
  assignDriver:    (id: string, data: { driver_name?: string; driver_phone?: string; driver_staff_id?: string; mark_out_for_delivery?: boolean }) =>
    api.patch<any>(`/orders/${id}/assign-driver`, data),
  outForDelivery:  (id: string) => api.patch<any>(`/orders/${id}/out-for-delivery`),
  markDelivered:   (id: string) => api.patch<any>(`/orders/${id}/mark-delivered`),
  collectCod:      (id: string) => api.patch<any>(`/orders/${id}/collect-cod`),
  confirmOnlineTransfer: (id: string) => api.patch<any>(`/orders/${id}/confirm-online-transfer`),
};

// ── Tables ────────────────────────────────────────────────────
export const tablesApi = {
  list:   () => api.get('/tables'),
  create: (data: Record<string, unknown>) => api.post('/tables', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/tables/${id}`, data),
  delete: (id: string) => api.delete(`/tables/${id}`),
};

// ── Staff ─────────────────────────────────────────────────────
export const staffApi = {
  list:       () => api.get('/staff'),
  create:     (data: Record<string, unknown>) => api.post('/staff', data),
  update:     (id: string, data: Record<string, unknown>) => api.patch(`/staff/${id}`, data),
  deactivate: (id: string, note?: string) => api.delete(`/staff/${id}`), // soft delete
  verifyPin:  (pin: string) => api.post<{ authorized: boolean; staff_id?: string; staff_name?: string; role?: string }>('/staff/verify-pin', { pin }),
  // Attendance
  clockIn:    (id: string) => api.post(`/staff/${id}/clock-in`, {}),
  clockOut:   (id: string, notes?: string) => api.post(`/staff/${id}/clock-out`, { notes }),
  activeNow:  () => api.get('/staff/active-now'),
  shifts:     (id: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/staff/${id}/shifts${qs}`);
  },
  allShifts:  (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/staff/shifts/all${qs}`);
  },
};


// ── Inventory ─────────────────────────────────────────────────
export const inventoryApi = {
  list:   () => api.get('/inventory'),
  create: (data: Record<string, unknown>) => api.post('/inventory', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/inventory/${id}`, data),
  adjust: (id: string, data: Record<string, unknown>) => api.post(`/inventory/${id}/adjust`, data),
  delete: (id: string) => api.delete(`/inventory/${id}`),
  transactions: (id: string) => api.get(`/inventory/${id}/transactions`),
  
  // Suppliers
  getSuppliers:    () => api.get('/inventory/suppliers'),
  createSupplier:  (data: Record<string, unknown>) => api.post('/inventory/suppliers', data),
  updateSupplier:  (id: string, data: Record<string, unknown>) => api.patch(`/inventory/suppliers/${id}`, data),
};

// ── Cash Drawer ───────────────────────────────────────────────
export const cashDrawerApi = {
  current: () => api.get('/cash-drawer/current'),
  open:    (starting_cash: number) => api.post('/cash-drawer/open', { starting_cash }),
  close:   (payload: { actual_cash: number; manager_pin?: string; notes?: string }) => api.post('/cash-drawer/close', payload),
};

// ── Reservations ────────────────────────────────────────────────
export const reservationsApi = {
  get: (date?: string) => api.get(`/reservations${date ? `?date=${date}` : ''}`),
  create: (data: Record<string, unknown>) => api.post('/reservations', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/reservations/${id}`, data),
  delete: (id: string) => api.delete(`/reservations/${id}`),
};

// ── Reports ───────────────────────────────────────────────────
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  sales: (period: string) => api.get(`/reports/sales?period=${period}`),
  items: (period: string) => api.get(`/reports/items?period=${period}`),
  staff: (period: string) => api.get(`/reports/staff?period=${period}`),
  tables: (period: string) => api.get(`/reports/tables?period=${period}`),
  peakHours: () => api.get('/reports/peak-hours'),
  inventoryValuation: () => api.get('/reports/inventory-valuation'),
  refresh: () => api.post('/reports/refresh'),
  exportUrl: (type: string, period: string) => `/api/reports/export?type=${type}&period=${period}`,
  onlineOrdering: (period = '30d') => api.get<any>(`/reports/online-ordering?period=${period}`),
  customersLoyalty: () => api.get<any>('/reports/customers-loyalty'),
  payments: () => api.get<any>('/reports/payments'),
};

// ── Kitchen ───────────────────────────────────────────────────
export const kitchenApi = {
  getOrders: (station: string) => api.get(`/orders/kitchen?station=${station}`),
  updateItemStatus: (id: string, status: string) => api.patch(`/orders/items/${id}/status`, { status }),
  updateOrderStatus: (id: string, status: string) => api.patch(`/orders/${id}/status`, { status }),
};

// ── Recipes ───────────────────────────────────────────────────
export const recipesApi = {
  get: (menuItemId: string) => api.get(`/recipes/${menuItemId}`),
  update: (menuItemId: string, ingredients: { inventory_item_id: string, quantity_required: number }[]) => 
    api.post(`/recipes/${menuItemId}`, { ingredients }),
};

// ── Billing ───────────────────────────────────────────────────
export const billingApi = {
  subscription: () => api.get('/billing/subscription'),
  usage:        () => api.get<{
    subscription: Record<string, unknown> | null;
    usage: { staff_count: number };
    payment_failed: boolean;
    payment_failed_reason: string | null;
    grace_period_ends_at: string | null;
  }>('/billing/usage'),
  proofs:       () => api.get('/billing/proofs'),
  plans:        () => api.get('/billing/plans'),
  /** Create the FIRST subscription for a newly-approved restaurant */
  subscribe:    (plan_id: string, billing_cycle: 'monthly' | 'annual') =>
    api.post('/billing/subscribe', { plan_id, billing_cycle }),
  submitProof:  (file: File, amount: number, method: string, referenceNumber: string, note: string, subscriptionId?: string) => {
    const fd = new FormData();
    fd.append('screenshot', file);
    fd.append('amount', String(amount));
    fd.append('payment_method', method);
    if (referenceNumber) fd.append('reference_number', referenceNumber);
    fd.append('note', note);
    if (subscriptionId) fd.append('subscription_id', subscriptionId);
    return api.upload('/billing/proofs', fd);
  },
  upgradePlan:          (plan_id: string) => api.post('/billing/upgrade', { plan_id }),
  cancelSubscription:   (reason?: string, immediate = false) =>
    api.post('/billing/cancel', { reason, immediate }),
  reactivateSubscription: () => api.post('/billing/reactivate', {}),
};

// ── Admin ─────────────────────────────────────────────────────
export const adminApi = {
  stats:              () => api.get('/admin/stats'),
  restaurants:        (status?: string) => api.get(`/admin/restaurants${status ? `?status=${status}` : ''}`),
  pendingRestaurants: () => api.get('/admin/restaurants/pending'),
  approveRestaurant:  (id: string) => api.patch(`/admin/restaurants/${id}/approve`),
  rejectRestaurant:   (id: string, reason: string) => api.patch(`/admin/restaurants/${id}/reject`, { reason }),
  suspendRestaurant:  (id: string, reason?: string) => api.patch(`/admin/restaurants/${id}/suspend`, { reason }),
  payments:           (status: string) => api.get(`/admin/payments?status=${status}`),
  approvePayment:     (id: string) => api.patch(`/admin/payments/${id}/approve`),
  rejectPayment:      (id: string, reason: string) => api.patch(`/admin/payments/${id}/reject`, { reason }),
  auditLogs:         () => api.get('/admin/audit-logs'),
  plans:             () => api.get('/admin/plans'),
  createPlan:        (plan: Record<string, unknown>) => api.post('/admin/plans', plan),
  updatePlan:        (id: string, plan: Record<string, unknown>) => api.patch(`/admin/plans/${id}`, plan),
  impersonateTenant: (id: string) => api.post(`/admin/restaurants/${id}/impersonate`),
  leads:             (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return api.get<{ leads: any[]; counts: any }>(`/admin/leads${qs ? `?${qs}` : ''}`);
  },
  updateLeadStatus:  (id: string, status: string) => api.patch<any>(`/admin/leads/${id}/status`, { status }),
  updateLeadNotes:   (id: string, notes: string) => api.patch<any>(`/admin/leads/${id}/notes`, { notes }),
};

// ── Public Customer Ordering & Marketing ───────────────────────
export const publicApi = {
  getRestaurant:  (slugOrId: string) => api.get<any>(`/public/restaurant/${slugOrId}`),
  getMenu:        (slugOrId: string) => api.get<any>(`/public/restaurant/${slugOrId}/menu`),
  getTable:       (slugOrId: string, tableIdOrLabel: string) => api.get<any>(`/public/restaurant/${slugOrId}/table/${tableIdOrLabel}`),
  placeOrder:     (orderData: Record<string, unknown>) => api.post<any>('/public/order', orderData),
  getOrderStatus: (orderId: string) => api.get<any>(`/public/order-status/${orderId}`),
  callWaiter:     (data: { restaurant_id: string; table_label: string; request_type?: string; notes?: string }) =>
    api.post<{ success: boolean; message: string }>('/public/call-waiter', data),
  submitLead:     (leadData: Record<string, unknown>) =>
    api.post<{ success: boolean; lead_id?: string; message: string }>('/public/leads', leadData),
  placeOnlineOrder: (orderData: Record<string, unknown>) =>
    api.post<{ success: boolean; tracking_token: string; tracking_url: string; order: any }>('/public/online-order', orderData),
  trackOrder:     (token: string) => api.get<any>(`/public/track/${token}`),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationApi = {
  list:           () => api.get<{ notifications: any[]; unreadCount: number }>('/notifications'),
  markRead:       (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead:    () => api.post('/notifications/read-all'),
  getPreferences: () => api.get<any[]>('/notifications/preferences'),
  updatePreferences: (preferences: any[]) => api.put('/notifications/preferences', { preferences }),
  testTrigger:    (type: string) => api.post('/notifications/test-trigger', { type }),
};

// ── Customers & CRM ───────────────────────────────────────────
export const customersApi = {
  list: (params?: { search?: string; segment?: string; sort?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.segment) q.set('segment', params.segment);
    if (params?.sort) q.set('sort', params.sort);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return api.get<{
      customers: any[];
      total: number;
      limit: number;
      offset: number;
      segments: { all: number; new: number; regular: number; inactive_30d: number; consented: number };
    }>(`/customers${qs ? `?${qs}` : ''}`);
  },
  searchByPhone: (phone: string) =>
    api.get<any[]>(`/customers/search-phone?phone=${encodeURIComponent(phone)}`),
  get: (id: string) =>
    api.get<{ customer: any; orders: any[]; loyaltyTransactions: any[]; loyaltySettings: any }>(`/customers/${id}`),
  create: (data: { name: string; phone: string; email?: string; birthday?: string; notes?: string; marketing_consent?: boolean }) =>
    api.post<{ message: string; customer: any }>('/customers', data),
  update: (id: string, data: Partial<{ name: string; phone: string; email?: string; birthday?: string; notes?: string; marketing_consent?: boolean }>) =>
    api.patch<{ message: string; customer: any }>(`/customers/${id}`, data),
  adjustPoints: (id: string, data: { points: number; manager_pin: string; reason: string }) =>
    api.post<any>(`/customers/${id}/adjust-points`, data),
  anonymize: (id: string) =>
    api.post<{ message: string }>(`/customers/${id}/anonymize`, {}),
  delete: (id: string) =>
    api.delete<{ message: string }>(`/customers/${id}`),
  exportCsv: async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/customers/export/csv`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (!res.ok) throw new ApiError('Failed to export CSV', res.status);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  getCampaigns: () => api.get<any[]>('/customers/marketing/campaigns'),
  createCampaign: (data: { title: string; message: string; channel: string; segment: string }) =>
    api.post<{ message: string; campaign: any; dispatches: any[] }>('/customers/marketing/campaigns', data),
  getMarketingLimit: () => api.get<{ sentToday: number; limit: number; remaining: number; isLimitReached: boolean }>('/customers/marketing/limit'),
};

// ── Loyalty Program ───────────────────────────────────────────
export const loyaltyApi = {
  getSettings: () => api.get<any>('/loyalty/settings'),
  updateSettings: (data: Record<string, unknown>) => api.patch<{ message: string; settings: any }>('/loyalty/settings', data),
  getTransactions: (params?: { customer_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.customer_id) q.set('customer_id', params.customer_id);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return api.get<any[]>(`/loyalty/transactions${qs ? `?${qs}` : ''}`);
  },
  adjustPoints: (id: string, data: { points: number; manager_pin: string; reason: string }) =>
    api.post<any>(`/loyalty/customers/${id}/adjust-points`, data),
};

// ── Unified Payments ───────────────────────────────────────────
export const paymentsApi = {
  list: (params?: { status?: string; method?: string; order_id?: string; till_session_id?: string; search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.method) q.set('method', params.method);
    if (params?.order_id) q.set('order_id', params.order_id);
    if (params?.till_session_id) q.set('till_session_id', params.till_session_id);
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return api.get<any[]>(`/payments${qs ? `?${qs}` : ''}`);
  },
  toConfirm: () => api.get<{ count: number; total_unconfirmed: number; payments: any[] }>('/payments/to-confirm'),
  create: (data: {
    order_id?: string;
    method: string;
    amount: number;
    reference?: string;
    proof_url?: string;
    notes?: string;
    provider?: string;
  }) => api.post<{ payment: any; order_paid: boolean; total_confirmed: number; remaining_due: number }>('/payments', data),
  confirm: (id: string) => api.patch<{ payment: any; order_paid: boolean }>(`/payments/${id}/confirm`),
  reject: (id: string, rejected_reason: string) => api.patch<any>(`/payments/${id}/reject`, { rejected_reason }),
  refund: (id: string, data: { manager_pin: string; reason: string; amount?: number }) =>
    api.post<{ message: string; refund: any }>(`/payments/${id}/refund`, data),
  reconciliation: (params?: { matched?: boolean; method?: string }) => {
    const q = new URLSearchParams();
    if (params?.matched !== undefined) q.set('matched', String(params.matched));
    if (params?.method) q.set('method', params.method);
    const qs = q.toString();
    return api.get<{ total_amount: number; matched_amount: number; unmatched_amount: number; payments: any[] }>(`/payments/reconciliation${qs ? `?${qs}` : ''}`);
  },
  matchStatement: (id: string, matched = true) => api.patch<any>(`/payments/${id}/match`, { matched }),
  uploadProof: (formData: FormData) => api.upload<{ proof_url: string }>('/payments/upload-proof', formData),
  getProviderConfigs: () => api.get<any[]>('/payments/providers/config'),
  saveProviderConfig: (provider: string, data: any) =>
    api.put<any>(`/payments/providers/${provider}`, data),
  testProvider: (provider: string, data?: { credentials?: Record<string, string>; is_sandbox?: boolean }) =>
    api.post<{ success: boolean; message: string }>(`/payments/providers/${provider}/test`, data || {}),
  expireStale: () => api.post<{ totalChecked: number; expiredCount: number; confirmedCount: number }>('/payments/expire-stale'),
};

// ── Developer API Keys & Webhooks ──────────────────────────────
export const apiKeysApi = {
  list: () => api.get<any[]>('/api-keys'),
  create: (data: {
    name: string;
    scopes: string[];
    expires_at?: string | null;
    ip_allowlist?: string[];
    rate_limit_per_minute?: number;
  }) => api.post<any>('/api-keys', data),
  rotate: (id: string) => api.post<any>(`/api-keys/${id}/rotate`),
  update: (id: string, data: any) => api.patch<any>(`/api-keys/${id}`, data),
  revoke: (id: string) => api.delete<{ message: string }>(`/api-keys/${id}`),
};

export const webhooksApi = {
  list: () => api.get<any[]>('/webhook-endpoints'),
  create: (data: { name: string; url: string; events: string[] }) =>
    api.post<any>('/webhook-endpoints', data),
  update: (id: string, data: { name?: string; url?: string; events?: string[]; is_active?: boolean }) =>
    api.patch<any>(`/webhook-endpoints/${id}`, data),
  rotateSecret: (id: string) => api.post<any>(`/webhook-endpoints/${id}/rotate-secret`),
  test: (id: string) => api.post<any>(`/webhook-endpoints/${id}/test`),
  delete: (id: string) => api.delete<{ message: string }>(`/webhook-endpoints/${id}`),
  deliveries: (id: string, limit = 50) => api.get<any[]>(`/webhook-endpoints/${id}/deliveries?limit=${limit}`),
  retryDelivery: (deliveryId: string) => api.post<any>(`/webhook-endpoints/deliveries/${deliveryId}/retry`),
};

export const developerAdminApi = {
  getUsage: () => api.get<any[]>('/admin/developer-usage'),
  getKeys: () => api.get<any[]>('/admin/developer-keys'),
  suspendKey: (id: string, suspended: boolean, reason?: string) =>
    api.patch<any>(`/admin/developer-keys/${id}/suspend`, { suspended, reason }),
  getWebhookFailures: () => api.get<any[]>('/admin/developer-webhooks/failures'),
  getIntegrationRequests: () => api.get<any[]>('/admin/developer-integrations/requests'),
  updateIntegrationStatus: (id: string, status: string) =>
    api.patch<any>(`/admin/developer-integrations/requests/${id}/status`, { status }),
};

