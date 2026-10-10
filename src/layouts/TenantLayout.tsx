import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Store, Wallet, ChefHat, Table2, Menu, X,
  Users, Package, BarChart3, CreditCard, Settings, LogOut,
  UtensilsCrossed, Monitor, BookOpen, Bell, Wifi, WifiOff,
  Banknote, Receipt, ChevronRight, ShieldCheck, Globe, Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/ui';
import { cn, getInitials } from '../lib/utils';
import type { StaffRole } from '../types';

import NotificationBell from '../components/NotificationBell';

export interface NavItem {
  to: string;
  icon: React.ElementType;
  i18nKey: string;
  end?: boolean;
  roles?: StaffRole[];
  badge?: string;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, i18nKey: 'nav.dashboard', end: true, roles: ['owner', 'manager'] },
  { to: '/dashboard/pos', icon: Store, i18nKey: 'nav.pos', roles: ['owner', 'manager', 'cashier', 'waiter'] },
  { to: '/dashboard/checkout', icon: Wallet, i18nKey: 'checkout.title', roles: ['owner', 'manager', 'cashier'] },
  { to: '/dashboard/till', icon: Banknote, i18nKey: 'till.title', roles: ['owner', 'manager', 'cashier'] },
  { to: '/dashboard/bill-history', icon: Receipt, i18nKey: 'bills.title', roles: ['owner', 'manager', 'cashier'] },
  { to: '/dashboard/orders', icon: UtensilsCrossed, i18nKey: 'nav.orders', roles: ['owner', 'manager', 'waiter'] },
  { to: '/dashboard/kitchen', icon: Monitor, i18nKey: 'nav.kitchen', roles: ['owner', 'manager', 'kitchen'] },
  { to: '/dashboard/tables', icon: Table2, i18nKey: 'nav.tables', roles: ['owner', 'manager', 'cashier', 'waiter'] },
  { to: '/dashboard/reservations', icon: Calendar, i18nKey: 'nav.reservations', roles: ['owner', 'manager', 'cashier'] },
  { to: '/dashboard/menu', icon: BookOpen, i18nKey: 'nav.menu', roles: ['owner', 'manager'] },
  { to: '/dashboard/staff', icon: Users, i18nKey: 'nav.staff', roles: ['owner', 'manager'] },
  { to: '/dashboard/inventory', icon: Package, i18nKey: 'nav.inventory', roles: ['owner', 'manager'] },
  { to: '/dashboard/notifications', icon: Bell, i18nKey: 'nav.notifications', roles: ['owner', 'manager', 'cashier'] },
  { to: '/dashboard/reports', icon: BarChart3, i18nKey: 'nav.reports', roles: ['owner', 'manager'] },
  { to: '/dashboard/billing', icon: CreditCard, i18nKey: 'nav.billing', roles: ['owner'] },
  { to: '/dashboard/settings', icon: Settings, i18nKey: 'nav.settings', roles: ['owner'] },
];

export default function TenantLayout() {
  const { user, signOut } = useAuth();
  const { isOnline } = useNetwork();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const staffRole = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : undefined);
  const restaurantName = user?.restaurant?.name ?? user?.restaurantName ?? 'Restaurant';
  const userName = user?.name ?? user?.email ?? 'User';

  const visibleNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return staffRole ? item.roles.includes(staffRole as StaffRole) : false;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isAdminImpersonating = !!localStorage.getItem('admin_token');

  const stopImpersonating = () => {
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
      localStorage.setItem('token', adminToken);
      localStorage.removeItem('admin_token');
      window.location.href = '/admin';
    }
  };

  // Extract current page title for breadcrumb
  const currentNav = navItems.find(n => n.to === location.pathname || (n.to !== '/dashboard' && location.pathname.startsWith(n.to)));
  const pageTitle = currentNav ? t(currentNav.i18nKey) : t('nav.dashboard', 'Dashboard');

  const renderSidebar = () => (
    <aside
      className="flex flex-col h-full backdrop-blur-3xl border shadow-card w-64 flex-shrink-0 rounded-3xl overflow-hidden my-4 ml-4 transition-colors duration-200"
      style={{
        backgroundColor: 'var(--sidebar-bg, rgba(255,255,255,0.92))',
        borderColor: 'var(--card-border, rgba(226,232,240,0.8))',
        color: 'var(--text-main, #0f172a)',
      }}
    >
      {/* Brand Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b transition-colors"
        style={{ borderColor: 'var(--card-border, rgba(226,232,240,0.6))' }}
      >
        {user?.restaurant?.logo_url ? (
          <img
            src={user.restaurant.logo_url as string}
            alt="Logo"
            className="w-10 h-10 rounded-2xl object-cover border bg-surface flex-shrink-0 shadow-sm ring-2 ring-brand-500/40"
            style={{ borderColor: 'var(--card-border, #E2E8F0)' }}
          />
        ) : (
          <div className="w-10 h-10 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-300 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-brand-500/30">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-display font-black text-sm leading-tight truncate text-primary">
              {String(restaurantName)}
            </p>
            <span className="w-2 h-2 rounded-full bg-gold-500 flex-shrink-0" title="Kushina Verified" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">kushinaPOS</span>
            <span className="w-1 h-1 rounded-full opacity-40 bg-current" />
            <span className={cn('text-[10px] font-bold uppercase', isOnline ? 'text-brand-600' : 'text-red-500')}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {visibleNavItems.map(({ to, icon: Icon, i18nKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'nav-item group',
                isActive && 'active'
              )
            }
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="truncate">{t(i18nKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div
        className="p-3 border-t transition-colors"
        style={{ borderColor: 'var(--card-border, #E2E8F0)' }}
      >
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-2xl border transition-colors"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 text-xs font-black flex-shrink-0 shadow-xs">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs leading-none truncate text-primary">
              {String(userName)}
            </p>
            <p className="text-[10px] font-semibold mt-1 capitalize flex items-center gap-1 text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              {String(staffRole?.replace('_', ' '))}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className="flex h-screen font-sans overflow-hidden relative selection:bg-brand-500/20 transition-colors duration-200"
      style={{
        backgroundColor: 'var(--background-color, #f8fafc)',
        color: 'var(--text-main, #0f172a)',
      }}
    >
      {/* Impersonation Banner */}
      {isAdminImpersonating && (
        <div className="absolute top-0 left-0 right-0 z-[100] bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🔴</span>
            <span>Platform Admin Session — Impersonating: <span className="underline">{String(restaurantName)}</span></span>
          </div>
          <button
            onClick={stopImpersonating}
            className="bg-surface/20 hover:bg-surface/30 px-3 py-1 rounded-xl transition-colors border border-white/30 cursor-pointer">
            Exit to Control Room
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        {renderSidebar()}
      </div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 animate-slide-in-right h-full">
            {renderSidebar()}
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <div className={`flex-1 flex flex-col overflow-hidden relative z-10 ${isAdminImpersonating ? 'pt-9' : ''}`}>
        {/* Mobile header */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3 backdrop-blur-xl border-b sticky top-0 z-40 transition-colors"
          style={{
            backgroundColor: 'var(--header-bg, rgba(255,255,255,0.8))',
            borderColor: 'var(--card-border, rgba(226,232,240,0.6))',
          }}
        >
          <button
            className="p-2 rounded-2xl hover:bg-surface/10 transition-colors cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--text-main, #0f172a)' }} />
          </button>
          <div className="flex items-center gap-2">
            {user?.restaurant?.logo_url ? (
              <img src={user.restaurant.logo_url as string} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-surface-100 bg-surface" />
            ) : (
              <ChefHat className="w-5 h-5 text-brand-500" />
            )}
            <span className="font-display font-black text-base leading-none truncate max-w-[160px]" style={{ color: 'var(--text-main, #0f172a)' }}>
              {String(restaurantName)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="button" />
            <NotificationBell />
            <div className={cn('w-2.5 h-2.5 rounded-full', isOnline ? 'bg-emerald-500 shadow-glow-emerald' : 'bg-red-500 shadow-glow-red')} />
          </div>
        </header>

        {/* Desktop Top Header Bar */}
        <header
          className="hidden lg:flex items-center justify-between px-8 py-3.5 backdrop-blur-md border-b flex-shrink-0 transition-colors"
          style={{
            backgroundColor: 'var(--header-bg, rgba(255,255,255,0.5))',
            borderColor: 'var(--card-border, rgba(226,232,240,0.5))',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted, #64748b)' }}>
              <span>Workspace</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              <span className="font-semibold">{String(restaurantName)}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              <span className="font-black text-xs" style={{ color: 'var(--text-main, #0f172a)' }}>{pageTitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold"
              style={{
                backgroundColor: 'var(--card-bg, rgba(255,255,255,0.8))',
                borderColor: 'var(--card-border, rgba(226,232,240,0.7))',
                color: 'var(--text-main, #0f172a)',
              }}
            >
              <span className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
              <span>{isOnline ? 'Cloud Synced' : 'Offline Mode'}</span>
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* Dynamic Route Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
