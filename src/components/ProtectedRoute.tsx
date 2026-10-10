import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AppRole, StaffRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  allowedStaffRoles?: StaffRole[];
}

export function ProtectedRoute({ children, requiredRole, allowedStaffRoles }: ProtectedRouteProps) {
  const { user, isLoading: loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const staffSlug = localStorage.getItem('kushina_staff_slug');
    if (staffSlug) {
      return <Navigate to={`/r/${staffSlug}/staff/login`} state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Platform admin trying to access admin routes
  if (requiredRole === 'platform_admin' && user.role !== 'platform_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Check restaurant status gate
  if (user.role === 'restaurant_owner' || user.role === 'staff') {
    const status = user.restaurantStatus;
    if (status) {
      if (status === 'pending') {
        return <Navigate to="/pending" replace />;
      }
      if (status === 'suspended') {
        return <Navigate to="/suspended" replace />;
      }
      if (status === 'rejected') {
        return <Navigate to="/rejected" replace />;
      }
    }
  }

  // Subscription gate: active owner with no plan → plan selection
  // (exempts the /subscribe route itself to avoid redirect loop)
  if (
    user.role === 'restaurant_owner' &&
    user.restaurantStatus === 'active' &&
    user.hasSubscription === false &&
    !location.pathname.startsWith('/subscribe')
  ) {
    return <Navigate to="/subscribe" replace />;
  }

  // Staff role check
  if (allowedStaffRoles && user.role === 'staff' && user.staffRole) {
    if (!allowedStaffRoles.includes(user.staffRole as StaffRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="platform_admin">
      {children}
    </ProtectedRoute>
  );
}

export function TenantRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: StaffRole[] }) {
  return (
    <ProtectedRoute allowedStaffRoles={allowedRoles}>
      {children}
    </ProtectedRoute>
  );
}
