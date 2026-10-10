import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ProtectedRoute, AdminRoute, TenantRoute } from './components/ProtectedRoute';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import { ToastProvider }    from './components/ui/Toast';
import { ConfirmProvider }  from './contexts/ConfirmContext';

// Lazy loaded pages
const LandingPage      = lazy(() => import('./pages/LandingPage'));
const LoginPage        = lazy(() => import('./pages/LoginPage'));
const RegisterPage     = lazy(() => import('./pages/RegisterPage'));
const PendingPage      = lazy(() => import('./pages/PendingPage'));
const SuspendedPage    = lazy(() => import('./pages/SuspendedPage'));
const RejectedPage     = lazy(() => import('./pages/RejectedPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));

// Public Customer Ordering pages
const PublicMenuPage   = lazy(() => import('./pages/public/PublicMenuPage'));
const OrderStatusPage  = lazy(() => import('./pages/public/OrderStatusPage'));
const StaffLoginPage   = lazy(() => import('./pages/public/StaffLoginPage'));

// Admin pages
const AdminLayout      = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminApprovals   = lazy(() => import('./pages/admin/AdminApprovals'));
const AdminPayments    = lazy(() => import('./pages/admin/AdminPayments'));
const AdminRestaurants = lazy(() => import('./pages/admin/AdminRestaurants'));
const AdminPlans       = lazy(() => import('./pages/admin/AdminPlans'));
const AdminAuditLogs   = lazy(() => import('./pages/admin/AdminAuditLogs'));

// Tenant pages
const TenantLayout     = lazy(() => import('./layouts/TenantLayout'));
const TenantDashboard  = lazy(() => import('./pages/tenant/TenantDashboard'));
const POSPage          = lazy(() => import('./pages/tenant/POSPage'));
const OrdersPage       = lazy(() => import('./pages/tenant/OrdersPage'));
const CheckoutPage     = lazy(() => import('./pages/tenant/CheckoutPage'));
const KitchenPage      = lazy(() => import('./pages/tenant/KitchenPage'));
const TablesPage       = lazy(() => import('./pages/tenant/TablesPage'));
const ReservationsPage = lazy(() => import('./pages/tenant/ReservationsPage'));
const MenuPage         = lazy(() => import('./pages/tenant/MenuPage'));
const StaffPage        = lazy(() => import('./pages/tenant/StaffPage'));
const InventoryPage    = lazy(() => import('./pages/tenant/InventoryPage'));
const NotificationsPage = lazy(() => import('./pages/tenant/NotificationsPage'));
const ReportsPage      = lazy(() => import('./pages/tenant/ReportsPage'));
const BillingPage      = lazy(() => import('./pages/tenant/BillingPage'));
const SettingsPage     = lazy(() => import('./pages/tenant/SettingsPage'));
const TillManagementPage = lazy(() => import('./pages/tenant/TillManagementPage'));
const BillHistoryPage    = lazy(() => import('./pages/tenant/BillHistoryPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

import { applyTheme } from './lib/utils';

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading: loading } = useAuth();
  
  const themeColor = user?.restaurant?.theme_color;
  const backgroundColor = user?.restaurant?.background_color;

  React.useEffect(() => {
    applyTheme(themeColor as string | undefined, backgroundColor as string | undefined);
  }, [themeColor, backgroundColor]);

  if (loading) return <PageLoader />;

  // Redirect authenticated users to correct home
  const getHome = () => {
    if (!user) return '/login';
    if (user.role === 'platform_admin') return '/admin';
    // Active owner with no subscription → must pick a plan first
    if (user.role === 'restaurant_owner' && user.restaurantStatus === 'active' && !user.hasSubscription) {
      return '/subscribe';
    }
    // Role-based redirects only for staff (owners always go to dashboard)
    if (user.role === 'staff') {
      if (user.staffRole === 'cashier') return '/dashboard/pos';
      if (user.staffRole === 'kitchen') return '/dashboard/kitchen';
      if (user.staffRole === 'waiter') return '/dashboard/tables';
    }
    return '/dashboard';
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={user ? <Navigate to={getHome()} replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to={getHome()} replace /> : <RegisterPage />} />
        
        {/* Public Customer Menu & Order Tracking */}
        <Route path="/r/:slug" element={<PublicMenuPage />} />
        <Route path="/r/:slug/table/:tableId" element={<PublicMenuPage />} />
        <Route path="/order-status/:orderId" element={<OrderStatusPage />} />

        {/* Staff Login */}
        <Route path="/r/:slug/staff/login" element={user && user.role === 'staff' ? <Navigate to={getHome()} replace /> : <StaffLoginPage />} />

        {/* Status gates */}
        <Route path="/pending"   element={<PendingPage />} />
        <Route path="/suspended" element={<SuspendedPage />} />
        <Route path="/rejected"  element={<RejectedPage />} />

        {/* Subscription plan selection — post-approval, owner only */}
        <Route path="/subscribe" element={
          user ? <SubscriptionPage /> : <Navigate to="/login" replace />
        } />

        {/* Platform Admin */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="approvals"   element={<AdminApprovals />} />
          <Route path="payments"    element={<AdminPayments />} />
          <Route path="restaurants" element={<AdminRestaurants />} />
          <Route path="plans"       element={<AdminPlans />} />
          <Route path="audit-logs"  element={<AdminAuditLogs />} />
        </Route>

        {/* Tenant Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><TenantLayout /></ProtectedRoute>}>
          <Route index element={<TenantDashboard />} />
          <Route path="pos"       element={<TenantRoute allowedRoles={['owner', 'manager', 'cashier', 'waiter']}><POSPage /></TenantRoute>} />
          <Route path="checkout"  element={<TenantRoute allowedRoles={['owner', 'manager', 'cashier']}><CheckoutPage /></TenantRoute>} />
          <Route path="till"      element={<TenantRoute allowedRoles={['owner', 'manager', 'cashier']}><TillManagementPage /></TenantRoute>} />
          <Route path="bill-history" element={<TenantRoute allowedRoles={['owner', 'manager', 'cashier']}><BillHistoryPage /></TenantRoute>} />
          <Route path="orders"    element={<TenantRoute allowedRoles={['owner', 'manager', 'waiter']}><OrdersPage /></TenantRoute>} />
          <Route path="kitchen"   element={<TenantRoute allowedRoles={['owner', 'manager', 'kitchen']}><KitchenPage /></TenantRoute>} />
          <Route path="tables"    element={<TenantRoute allowedRoles={['owner', 'manager', 'cashier', 'waiter']}><TablesPage /></TenantRoute>} />
          <Route path="reservations" element={<TenantRoute allowedRoles={['owner', 'manager', 'cashier']}><ReservationsPage /></TenantRoute>} />
          <Route path="menu"      element={<TenantRoute allowedRoles={['owner', 'manager']}><MenuPage /></TenantRoute>} />
          <Route path="staff"     element={<TenantRoute allowedRoles={['owner', 'manager']}><StaffPage /></TenantRoute>} />
          <Route path="inventory" element={<TenantRoute allowedRoles={['owner', 'manager']}><InventoryPage /></TenantRoute>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reports"   element={<TenantRoute allowedRoles={['owner', 'manager']}><ReportsPage /></TenantRoute>} />
          <Route path="billing"   element={<TenantRoute allowedRoles={['owner']}><BillingPage /></TenantRoute>} />
          <Route path="settings"  element={<TenantRoute allowedRoles={['owner']}><SettingsPage /></TenantRoute>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NetworkProvider>
          <LanguageProvider>
            <ToastProvider>
              <ConfirmProvider>
                <BrowserRouter>
                  <AppRoutes />
                  <SyncStatusBanner />
                </BrowserRouter>
              </ConfirmProvider>
            </ToastProvider>
          </LanguageProvider>
        </NetworkProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

