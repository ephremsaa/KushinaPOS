import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Clock, CreditCard, Store,
  Package, ScrollText, LogOut, ChefHat, Menu, X, Bell,
  Search, ShieldCheck, Activity, Sparkles, Command, Users, Terminal
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../lib/api';

const navItems = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Dashboard',   end: true },
  { to: '/admin/leads',        icon: Users,           label: 'Leads' },
  { to: '/admin/approvals',    icon: Clock,           label: 'Approvals' },
  { to: '/admin/payments',     icon: CreditCard,      label: 'Payments' },
  { to: '/admin/restaurants',  icon: Store,           label: 'Restaurants' },
  { to: '/admin/plans',        icon: Package,         label: 'Plans' },
  { to: '/admin/developers',   icon: Terminal,        label: 'Developers & API' },
  { to: '/admin/audit-logs',   icon: ScrollText,      label: 'Audit Logs' },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: leadsData } = useQuery({
    queryKey: ['admin-leads-badge'],
    queryFn: async () => {
      try {
        const res = await adminApi.leads({ status: 'new' });
        return res as { leads: any[]; counts: { new: number } };
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
  });

  const newLeadsCount = leadsData?.counts?.new || 0;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-slate-950 text-slate-200 w-64 flex-shrink-0 border-r border-slate-800/60 shadow-2xl relative z-20">
      {/* Brand Header */}
      <div className="flex items-center gap-3.5 px-6 py-6 border-b border-slate-800/80">
        <img
          src="/kushinaPOStrace.png"
          alt="kushinaPOS"
          className="w-10 h-10 object-contain rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.3)]"
        />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-display font-black text-white text-xl tracking-tight leading-none">kushina</span>
            <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">HQ</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-orange-400" /> Platform Control
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-4 pt-6 pb-2">
        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-3 mb-2">Core Operations</p>
      </div>
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-200 cursor-pointer group relative',
                isActive
                  ? 'bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent border-l-4 border-orange-500 text-white font-semibold shadow-inner'
                  : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-100'
              )
            }
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            <span>{label}</span>
            {to === '/admin/leads' && newLeadsCount > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white animate-pulse">
                {newLeadsCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Admin Profile Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white text-xs font-black shadow-md flex-shrink-0">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Super Admin</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-400
                     hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/20 transition-all w-full mt-3 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign out Control Room
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-orange-500 selection:text-white">

      {/* ── Platform Admin Identity Band ─────────────────────────────── */}
      {/* This band is the primary visual signal that you are in the control room, */}
      {/* NOT in your restaurant. It must be visible at all times. */}
      <div className="admin-band flex-shrink-0 z-[60]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 opacity-80" />
          <span className="uppercase tracking-widest">Platform Admin — KushinaPOS Control Room</span>
        </div>
        <span className="opacity-70 font-mono text-[11px]">
          {user?.email}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 animate-slide-in-right">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        {/* Top Command Bar */}
        <header className="flex items-center justify-between px-6 py-3.5 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 flex-shrink-0 relative z-10 shadow-lg">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Search Shortcut */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl px-3.5 py-1.5 text-xs text-slate-400 hover:border-slate-700 transition-colors w-72 cursor-pointer shadow-inner">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search platform, tenants…</span>
              <kbd className="ml-auto bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono flex items-center gap-0.5">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </div>
          </div>

          {/* Right Header Status Widgets */}
          <div className="flex items-center gap-4">
            {/* System Health Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Activity className="w-3.5 h-3.5" />
              <span>All Systems Operational</span>
            </div>

            {/* Clock Widget */}
            <div className="hidden lg:block text-right pr-2 border-r border-slate-800">
              <p className="text-xs font-bold text-white font-mono">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[10px] text-slate-400">
                {currentTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Notifications / In-App Alert */}
            <button 
              type="button"
              onClick={() => navigate('/admin/leads')}
              title={newLeadsCount > 0 ? `${newLeadsCount} new lead inquiries awaiting follow-up` : 'No new inquiries'}
              className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-800 transition-all relative text-slate-300 hover:text-white cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {newLeadsCount > 0 && (
                <>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
                </>
              )}
            </button>
          </div>
        </header>

        {/* Page Content Surface */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-900 text-slate-100">
          {newLeadsCount > 0 && location.pathname !== '/admin/leads' && (
            <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-4 animate-fade-in shadow-md">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Users className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white">
                    {newLeadsCount} New Lead {newLeadsCount === 1 ? 'Inquiry' : 'Inquiries'} Awaiting Follow-Up
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Prospective restaurants have submitted demo or quote requests from the website.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/leads')}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
              >
                View Leads
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
}
