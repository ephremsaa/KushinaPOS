import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Wallet, ChefHat, Table2, Menu, X,
  Users, Package, BarChart3, CreditCard, Settings, LogOut, 
  UtensilsCrossed, Monitor, BookOpen, Bell, Wifi, WifiOff,
  Banknote, Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { cn, getInitials } from '../lib/utils';
import type { StaffRole } from '../types';

import NotificationBell from '../components/NotificationBell';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  roles?: StaffRole[];
}

const navItems: NavItem[] = [
  { to: '/dashboard',               icon: LayoutDashboard, label: 'Overview',    end: true, roles: ['owner', 'manager'] },
  { to: '/dashboard/pos',           icon: Store,            label: 'POS',         roles: ['owner','manager','cashier','waiter'] },
  { to: '/dashboard/checkout',      icon: Wallet,           label: 'Checkout',    roles: ['owner','manager','cashier'] },
  { to: '/dashboard/till',          icon: Banknote,         label: 'Cash Drawer', roles: ['owner','manager','cashier'] },
  { to: '/dashboard/bill-history',  icon: Receipt,          label: 'Bill History',roles: ['owner','manager','cashier'] },
  { to: '/dashboard/orders',        icon: UtensilsCrossed, label: 'Orders',      roles: ['owner','manager','waiter'] },
  { to: '/dashboard/kitchen',       icon: Monitor,         label: 'Kitchen',     roles: ['owner','manager','kitchen'] },
  { to: '/dashboard/tables',        icon: Table2,          label: 'Tables',      roles: ['owner','manager','cashier','waiter'] },
  { to: '/dashboard/menu',          icon: BookOpen,        label: 'Menu',        roles: ['owner','manager'] },
  { to: '/dashboard/staff',         icon: Users,           label: 'Staff',       roles: ['owner','manager'] },
  { to: '/dashboard/inventory',     icon: Package,         label: 'Inventory',   roles: ['owner','manager'] },
  { to: '/dashboard/notifications', icon: Bell,            label: 'Alerts' },
  { to: '/dashboard/reports',       icon: BarChart3,       label: 'Reports',     roles: ['owner','manager'] },
  { to: '/dashboard/billing',       icon: CreditCard,      label: 'Billing',     roles: ['owner'] },
  { to: '/dashboard/settings',      icon: Settings,        label: 'Settings',    roles: ['owner'] },
];

export default function TenantLayout() {
  const { user, signOut } = useAuth();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const staffRole = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : undefined);
  const restaurantName = user?.restaurant?.name ?? user?.restaurantName ?? 'Restaurant';
  const userName = user?.name ?? user?.email ?? '';

  const visibleNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return staffRole ? item.roles.includes(staffRole as StaffRole) : false;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white/80 backdrop-blur-3xl border border-white/40 shadow-card w-64 flex-shrink-0 rounded-3xl overflow-hidden m-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-100">
        {user?.restaurant?.logo_url ? (
          <img src={user.restaurant.logo_url as string} alt="Logo" className="w-9 h-9 rounded-xl object-cover border border-surface-100 bg-white flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-surface-900 text-sm leading-none truncate">
            {String(restaurantName)}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">kushinaPOS</p>
        </div>
        {/* Online indicator */}
        <div className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          isOnline ? 'bg-emerald-500' : 'bg-red-500'
        )} title={isOnline ? 'Online' : 'Offline'} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
        {visibleNavItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('nav-item', isActive && 'active')
            }
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-surface-100">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
              <p className="font-bold text-surface-900 text-sm leading-none">{String(userName)}</p>
              <p className="text-xs text-surface-500 mt-0.5 capitalize">{String(staffRole?.replace('_', ' '))}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2 py-2 rounded-xl text-xs text-surface-500
                     hover:bg-surface-100 hover:text-surface-900 transition-all w-full mt-0.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );

  const isAdminImpersonating = !!localStorage.getItem('admin_token');

  const stopImpersonating = () => {
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
      localStorage.setItem('token', adminToken);
      localStorage.removeItem('admin_token');
      window.location.href = '/admin'; // Redirect back to admin console
    }
  };

  return (
    <div className="flex h-screen bg-surface-50 font-sans text-surface-900 overflow-hidden relative selection:bg-brand-500/20 selection:text-brand-900">
      {/* Impersonation Banner */}
      {isAdminImpersonating && (
        <div className="absolute top-0 left-0 right-0 z-[100] bg-orange-600 text-white px-4 py-1.5 flex justify-between items-center text-sm font-bold shadow-md">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🔴</span>
            <span>You are impersonating {String(restaurantName)}</span>
          </div>
          <button 
            onClick={stopImpersonating}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors border border-white/20">
            Return to Admin
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div className={`flex-1 flex flex-col overflow-hidden relative z-10 ${isAdminImpersonating ? 'pt-8' : ''}`}>
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-xl border-b border-surface-200/50 sticky top-0 z-40">
          <button className="p-2.5 rounded-2xl hover:bg-surface-100/80 transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-surface-700" />
          </button>
          <div className="flex items-center gap-2">
            {user?.restaurant?.logo_url ? (
              <img src={user.restaurant.logo_url as string} alt="Logo" className="w-6 h-6 rounded object-cover border border-surface-100 bg-white" />
            ) : (
              <ChefHat className="w-5 h-5 text-brand-500" />
            )}
            <span className="font-display font-bold text-lg text-surface-900 leading-none">{String(restaurantName)}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
          </div>
        </header>

        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-3 bg-white/40 backdrop-blur-md border-b border-surface-200/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-surface-400 uppercase tracking-widest">Workspace</span>
            <span className="text-xs text-surface-300">/</span>
            <span className="text-xs font-bold text-surface-900">{String(restaurantName)}</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 lg:pl-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
