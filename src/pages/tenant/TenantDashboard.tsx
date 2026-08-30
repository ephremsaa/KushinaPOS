import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, TrendingUp, Users, AlertTriangle,
  UtensilsCrossed, Table2, Package, CreditCard
} from 'lucide-react';
import { reportsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatRelative } from '../../lib/utils';
import { Link, Navigate } from 'react-router-dom';

function useTenantOverview() {
  return useQuery({
    queryKey: ['tenant-overview'],
    queryFn: async () => {
      const data = await reportsApi.dashboard();
      return data as any;
    },
    refetchInterval: 30_000,
  });
}

export default function TenantDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useTenantOverview();

  const staffRole: string = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : 'waiter');
  const restaurantName = (user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant';

  if (staffRole === 'cashier') return <Navigate to="/dashboard/pos" replace />;
  if (staffRole === 'kitchen') return <Navigate to="/dashboard/kitchen" replace />;
  if (staffRole === 'waiter') return <Navigate to="/dashboard/tables" replace />;

  // Helper for percentage diff
  const calculateTrend = (today: number, yesterday: number) => {
    if (!yesterday || yesterday === 0) return { text: '+100%', positive: true }; // arbitrary fallback if no yesterday data
    const diff = today - yesterday;
    const percent = (diff / yesterday) * 100;
    return {
      text: `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`,
      positive: percent >= 0,
    };
  };

  const salesTrend = data ? calculateTrend(parseFloat(data.kpis.today_sales), parseFloat(data.kpis.yesterday_sales)) : null;
  const ordersTrend = data ? calculateTrend(parseInt(data.kpis.today_orders), parseInt(data.kpis.yesterday_orders)) : null;

  const kpis = [
    { 
      label: "Today's Sales", 
      value: formatCurrency(parseFloat(data?.kpis?.today_sales ?? 0)), 
      trend: salesTrend,
      icon: TrendingUp, 
      color: 'bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 border border-brand-200/50', 
      roles: ['owner', 'manager'] 
    },
    { 
      label: "Today's Orders", 
      value: data?.kpis?.today_orders ?? 0, 
      trend: ordersTrend,
      icon: ShoppingCart, 
      color: 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 border border-blue-200/50', 
      roles: ['owner', 'manager'] 
    },
    { 
      label: 'Active Orders', 
      value: data?.liveStatus?.preparing_orders ?? 0, 
      icon: UtensilsCrossed, 
      color: 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 border border-amber-200/50', 
      link: '/dashboard/orders', 
      roles: ['owner', 'manager', 'cashier', 'waiter', 'kitchen'] 
    },
    { 
      label: 'Active Staff', 
      value: data?.liveStatus?.active_staff ?? 0, 
      icon: Users, 
      color: 'bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 border border-purple-200/50', 
      roles: ['owner', 'manager'] 
    },
  ].filter(k => k.roles.includes(staffRole as string));

  // Only show billing nudge if we have subscription data and it's not active
  const showBillingNudge = data?.subscription?.subscription_status != null &&
    data.subscription.subscription_status !== 'active' &&
    staffRole === 'owner';

  return (
    <div className="animate-fade-in pb-10">
      {/* Billing Nudge */}
      {showBillingNudge && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="p-2 bg-red-100 rounded-full">
            <CreditCard className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 text-sm">Action Required: Subscription Issue</h3>
            <p className="text-red-700 text-sm mt-0.5">Your subscription is currently <strong>{data.subscription.subscription_status}</strong>. Please update your billing info to avoid service interruption.</p>
          </div>
          <Link to="/dashboard/settings" className="btn-sm bg-red-600 text-white hover:bg-red-700">Manage Billing</Link>
        </div>
      )}

      <div className="page-header bg-white/40 p-6 rounded-3xl backdrop-blur-sm border border-white/60 shadow-sm mb-8">
        <div>
          <h1 className="page-title">Good {getTimeOfDay()}, {restaurantName}</h1>
          <p className="page-subtitle">Here's your real-time performance summary</p>
        </div>
        {['owner', 'manager', 'cashier', 'waiter'].includes(staffRole as string) && (
          <Link to="/dashboard/pos" className="btn-primary gap-2.5 px-6 shadow-glow">
            <ShoppingCart className="w-5 h-5" />
            New Order
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpis.map(({ label, value, trend, icon: Icon, color, link }) => (
          <Link key={label} to={link ?? '#'} className={`stat-card relative ${link ? 'cursor-pointer hover:-translate-y-2' : ''}`}>
            <div className={`stat-icon ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="mt-2">
              <p className="stat-value">{isLoading ? '—' : value}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="stat-label flex-1">{label}</p>
                {trend && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend.positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {trend.text}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-xl text-surface-900 tracking-tight">Recent Orders</h2>
            <Link to="/dashboard/orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full transition-colors">View all →</Link>
          </div>
          {(data?.recentOrders?.length ?? 0) === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-surface-50 rounded-full flex items-center justify-center mb-3">
                <UtensilsCrossed className="w-8 h-8 text-surface-300" />
              </div>
              <p className="text-surface-900 font-semibold">No recent orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.recentOrders?.map((order: any) => (
                <div key={order.id} className="flex items-center gap-4 p-4 bg-surface-50/50 hover:bg-surface-50 rounded-2xl border border-surface-100/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-surface-900 truncate">
                      {order.table_label ? `Table ${order.table_label}` : order.order_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs font-medium text-surface-400 mt-0.5">{formatRelative(order.created_at)}</p>
                  </div>
                  <span className={`status-${order.status}`}>{order.status}</span>
                  <p className="font-extrabold text-surface-900 text-sm tracking-tight w-20 text-right">{formatCurrency(order.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Status & Quick Actions */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="font-display font-bold text-xl text-surface-900 tracking-tight mb-5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { to: '/dashboard/pos',       icon: ShoppingCart, label: 'New Order',   color: 'bg-brand-500 text-white shadow-brand-500/30', roles: ['owner', 'manager', 'cashier', 'waiter'] },
                { to: '/dashboard/tables',    icon: Table2,       label: 'Floor Plan',  color: 'bg-blue-500 text-white shadow-blue-500/30', roles: ['owner', 'manager', 'cashier', 'waiter'] },
                { to: '/dashboard/kitchen',   icon: UtensilsCrossed, label: 'Kitchen',  color: 'bg-amber-500 text-white shadow-amber-500/30', roles: ['owner', 'manager', 'kitchen'] },
                { to: '/dashboard/inventory', icon: Package,      label: 'Inventory',   color: 'bg-purple-500 text-white shadow-purple-500/30', roles: ['owner', 'manager'] },
              ].filter(a => a.roles.includes(staffRole as string)).map(({ to, icon: Icon, label, color }) => (
                <Link key={to} to={to}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${color}`}>
                  <Icon className="w-8 h-8" />
                  <span className="font-bold text-sm tracking-wide">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Tables Live Status */}
          {['owner', 'manager', 'cashier', 'waiter'].includes(staffRole as string) && data?.liveStatus?.total_tables > 0 && (
             <div className="card bg-gradient-to-br from-surface-900 to-surface-800 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Table2 className="w-24 h-24" />
               </div>
               <div className="relative z-10">
                 <div className="flex justify-between items-center mb-2">
                   <h2 className="font-bold text-surface-100">Live Table Status</h2>
                 </div>
                 <div className="flex items-end gap-2">
                   <span className="text-4xl font-extrabold text-white">{data.liveStatus.occupied_tables}</span>
                   <span className="text-surface-400 mb-1 font-medium">/ {data.liveStatus.total_tables} occupied</span>
                 </div>
                 <div className="mt-4 h-2.5 bg-surface-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                   <div 
                     className="h-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-1000 rounded-full" 
                     style={{ width: `${(data.liveStatus.occupied_tables / data.liveStatus.total_tables) * 100}%` }}
                   />
                 </div>
               </div>
             </div>
          )}

          {data && (data.lowStock?.length ?? 0) > 0 && ['owner', 'manager'].includes(staffRole as string) && (
            <Link
              to="/dashboard/inventory"
              className="group flex items-center gap-4 p-5 bg-gradient-to-r from-red-50 to-white border border-red-100 rounded-[2rem] hover:shadow-md transition-all duration-300"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700">Low Stock Alert</p>
                <p className="text-xs font-medium text-red-500 mt-0.5">{data.lowStock.length} item{data.lowStock.length > 1 ? 's' : ''} running critically low</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                &rarr;
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
