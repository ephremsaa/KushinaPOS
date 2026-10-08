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

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error || `Request failed: ${res.status} ${res.statusText}`;
    throw new Error(message);
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
};

// ── Public Customer Ordering ──────────────────────────────────
export const publicApi = {
  getRestaurant:  (slugOrId: string) => api.get<any>(`/public/restaurant/${slugOrId}`),
  getMenu:        (slugOrId: string) => api.get<any>(`/public/restaurant/${slugOrId}/menu`),
  getTable:       (slugOrId: string, tableIdOrLabel: string) => api.get<any>(`/public/restaurant/${slugOrId}/table/${tableIdOrLabel}`),
  placeOrder:     (orderData: Record<string, unknown>) => api.post<any>('/public/order', orderData),
  getOrderStatus: (orderId: string) => api.get<any>(`/public/order-status/${orderId}`),
  callWaiter:     (data: { restaurant_id: string; table_label: string; request_type?: string; notes?: string }) =>
    api.post<{ success: boolean; message: string }>('/public/call-waiter', data),
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

