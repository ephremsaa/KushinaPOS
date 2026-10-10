import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, TrendingUp, Users, AlertTriangle,
  UtensilsCrossed, Table2, Package, CreditCard,
  Sparkles, ArrowUpRight, ArrowDownRight, Clock,
  ChefHat, ChevronRight, Store, Banknote
} from 'lucide-react';
import { reportsApi } from '../../lib/api';
import { navItems } from '../../layouts/TenantLayout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatRelative, cn } from '../../lib/utils';
import { Link, Navigate } from 'react-router-dom';
import { StatCardSkeleton, Badge } from '../../components/ui';

function useTenantOverview() {
  return useQuery({
    queryKey: ['tenant-overview'],
    queryFn: async () => {
      const data = await reportsApi.dashboard();
      return data as any;
    },
    refetchInterval: 20_000,
  });
}

export default function TenantDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data, isLoading } = useTenantOverview();

  const staffRole: string = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : 'waiter');
  const restaurantName = (user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant';

  if (staffRole === 'cashier') return <Navigate to="/dashboard/pos" replace />;
  if (staffRole === 'kitchen') return <Navigate to="/dashboard/kitchen" replace />;
  if (staffRole === 'waiter') return <Navigate to="/dashboard/tables" replace />;

  const calculateTrend = (today: number, yesterday: number) => {
    if (!yesterday || yesterday === 0) return { text: '+100%', positive: true };
    const diff = today - yesterday;
    const percent = (diff / yesterday) * 100;
    return {
      text: `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`,
      positive: percent >= 0,
    };
  };

  const salesTrend = data ? calculateTrend(parseFloat(data.kpis?.today_sales ?? 0), parseFloat(data.kpis?.yesterday_sales ?? 0)) : null;
  const ordersTrend = data ? calculateTrend(parseInt(data.kpis?.today_orders ?? 0), parseInt(data.kpis?.yesterday_orders ?? 0)) : null;

  const kpis = [
    { 
      label: "Today's Revenue", 
      value: formatCurrency(parseFloat(data?.kpis?.today_sales ?? 0)), 
      trend: salesTrend,
      subtitle: "vs yesterday",
      icon: TrendingUp, 
      gradient: 'from-brand-500/15 via-brand-300/10 to-transparent',
      iconBg: 'bg-gradient-to-br from-brand-600 via-brand-500 to-brand-300 text-white shadow-glow-sm',
      roles: ['owner', 'manager'] 
    },
    { 
      label: "Today's Orders", 
      value: data?.kpis?.today_orders ?? 0, 
      trend: ordersTrend,
      subtitle: "completed & open",
      icon: ShoppingCart, 
      gradient: 'from-blue-500/15 via-indigo-500/10 to-transparent',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm',
      roles: ['owner', 'manager'] 
    },
    { 
      label: 'Kitchen in Flight', 
      value: data?.liveStatus?.preparing_orders ?? 0, 
      subtitle: "orders cooking",
      icon: UtensilsCrossed, 
      gradient: 'from-gold-500/15 via-amber-500/10 to-transparent',
      iconBg: 'bg-gradient-to-br from-gold-600 to-gold-500 text-white shadow-glow-gold',
      link: '/dashboard/orders', 
      roles: ['owner', 'manager', 'cashier', 'waiter', 'kitchen'] 
    },
    { 
      label: 'Staff on Shift', 
      value: data?.liveStatus?.active_staff ?? 0, 
      subtitle: "clocked-in team",
      icon: Users, 
      gradient: 'from-surface-800/10 via-surface-700/5 to-transparent',
      iconBg: 'bg-surface-900 text-white shadow-sm',
      roles: ['owner', 'manager'] 
    },
  ].filter(k => k.roles.includes(staffRole as string));

  const showBillingNudge = data?.subscription?.subscription_status != null &&
    data.subscription.subscription_status !== 'active' &&
    staffRole === 'owner';

  const occupiedTables = data?.liveStatus?.occupied_tables ?? 0;
  const totalTables = data?.liveStatus?.total_tables ?? 0;
  const occupancyPercent = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;

  return (
    <div className="animate-fade-in pb-12 max-w-7xl mx-auto space-y-8">
      {/* Billing Alert Nudge */}
      {showBillingNudge && (
        <div className="p-5 bg-gradient-to-r from-red-500/10 via-rose-500/10 to-transparent border border-red-200/80 rounded-3xl flex items-center justify-between gap-4 shadow-sm animate-pulse-soft">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500 text-white rounded-2xl shadow-glow-red">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-red-950 text-sm">Action Required: Subscription Status is {data.subscription.subscription_status}</h3>
              <p className="text-xs text-red-700 mt-0.5 font-medium">Please review payment proofs or update your subscription tier to ensure uninterrupted access.</p>
            </div>
          </div>
          <Link to="/dashboard/billing" className="btn-sm btn-danger px-4 flex-shrink-0">Review Billing</Link>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-surface-900 via-surface-800 to-slate-900 text-white p-7 sm:p-9 shadow-2xl border border-surface-700/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-500/20 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface/10 backdrop-blur-md border border-white/15 text-brand-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Operation Center</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight">
              Good {getTimeOfDay()}, {restaurantName}
            </h1>
            <p className="text-xs sm:text-sm text-surface-300 mt-1.5 font-medium">
              Live floor overview, active tickets, and performance analytics for today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {['owner', 'manager', 'cashier', 'waiter'].includes(staffRole as string) && (
              <Link to="/dashboard/pos" className="btn-primary gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-glow">
                <Store className="w-4 h-4" />
                Launch POS
              </Link>
            )}
            {['owner', 'manager'].includes(staffRole as string) && (
              <Link to="/dashboard/reports" className="btn-secondary bg-surface/10 hover:bg-surface/20 text-white border-white/20 px-4 py-3 rounded-2xl text-sm font-semibold backdrop-blur-md">
                Reports
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stat Cards — skeleton while loading */}
      {isLoading ? (
        <StatCardSkeleton count={kpis.length || 4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {kpis.map(({ label, value, trend, subtitle, icon: Icon, gradient, iconBg, link }) => {
            const CardContent = (
              <div className={cn(
                'card relative overflow-hidden bg-gradient-to-br border border-[var(--card-border)] p-6 flex flex-col justify-between h-full transition-all duration-200',
                gradient,
                link && 'hover:shadow-card-hover hover:-translate-y-1 cursor-pointer'
              )}>
                <div className="flex items-start justify-between">
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', iconBg)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {trend && (
                    <span className={cn(
                      'inline-flex items-center gap-0.5 text-xs font-bold px-2.5 py-1 rounded-full border',
                      trend.positive
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                    )}>
                      {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {trend.text}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-display font-black text-primary tracking-tight font-mono">
                    {value}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">{label}</p>
                    {subtitle && <span className="text-[11px] text-surface-400 font-medium">{subtitle}</span>}
                  </div>
                </div>
              </div>
            );

            return link ? (
              <Link key={label} to={link}>
                {CardContent}
              </Link>
            ) : (
              <div key={label}>{CardContent}</div>
            );
          })}
        </div>
      )}

      {/* Main Grid: Recent Activity & Live Room Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List (2 Cols) */}
        <div className="lg:col-span-2 card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-100">
              <div>
                <h2 className="font-display font-extrabold text-xl text-primary tracking-tight">Live Orders Stream</h2>
                <p className="text-xs text-surface-400 font-medium mt-0.5">Real-time status updates across all stations</p>
              </div>
              <Link to="/dashboard/orders" className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all">
                <span>View Full Pipeline</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {(data?.recentOrders?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 bg-surface-100/80 rounded-3xl flex items-center justify-center mb-3">
                  <UtensilsCrossed className="w-8 h-8 text-surface-400" />
                </div>
                <p className="text-primary font-bold text-sm">No live orders right now</p>
                <p className="text-surface-400 text-xs mt-1">Orders placed in POS or online menu will stream here automatically.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data?.recentOrders?.slice(0, 5).map((order: any) => (
                  <div 
                    key={order.id} 
                    className="flex items-center gap-4 p-3.5 bg-surface-50/70 hover:bg-surface-100/80 rounded-2xl border border-default/50 transition-all duration-150"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--card-bg)] border border-default/80 flex items-center justify-center font-display font-black text-xs text-surface-700 shadow-sm flex-shrink-0">
                      {order.table_label ? `T${order.table_label}` : '🛍️'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-primary truncate">
                          {order.table_label ? `Table ${order.table_label}` : (order.customer_name || 'Takeaway Order')}
                        </p>
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest bg-surface-200/60 px-2 py-0.5 rounded-md">
                          {order.order_type?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-surface-400 mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatRelative(order.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge status={order.status as any}>
                        {order.status}
                      </Badge>
                      <p className="font-display font-black text-primary text-sm w-20 text-right">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-surface-100 flex items-center justify-between text-xs text-muted font-medium">
            <span>Auto-refreshing every 20s</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected to local terminal
            </span>
          </div>
        </div>

        {/* Live Status & Quick Action Hub (1 Col) */}
        <div className="flex flex-col gap-6">
          {/* Table Occupancy Widget */}
          {['owner', 'manager', 'cashier', 'waiter'].includes(staffRole as string) && (
            <div className="card bg-gradient-to-br from-surface-900 via-surface-800 to-surface-950 text-white border-surface-700/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Table2 className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-5 h-5 text-brand-400" />
                    <h3 className="font-display font-bold text-white text-base">Dining Floor Status</h3>
                  </div>
                  <Link to="/dashboard/tables" className="text-xs font-bold text-brand-400 hover:text-brand-300">
                    Manage Floor →
                  </Link>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="text-4xl font-display font-black text-white">{occupiedTables}</span>
                    <span className="text-surface-400 text-sm font-medium ml-1.5">/ {totalTables} tables occupied</span>
                  </div>
                  <span className="text-xl font-display font-extrabold text-brand-400">{occupancyPercent}%</span>
                </div>

                <div className="h-3 bg-surface-800 rounded-full overflow-hidden p-0.5 border border-surface-700">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-500 to-amber-400 rounded-full transition-all duration-700 shadow-glow-sm"
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quick Launch Cards */}
          <div className="card">
            <h3 className="font-display font-bold text-base text-primary mb-4">Operational Shortcuts</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { to: '/dashboard/pos',       icon: Store,            label: 'POS Terminal', color: 'from-orange-500 to-amber-500', roles: ['owner', 'manager', 'cashier', 'waiter'] },
                { to: '/dashboard/tables',    icon: Table2,           label: 'Floor Plan',   color: 'from-blue-500 to-indigo-600', roles: ['owner', 'manager', 'cashier', 'waiter'] },
                { to: '/dashboard/kitchen',   icon: ChefHat,          label: 'KDS Display',  color: 'from-amber-500 to-orange-600', roles: ['owner', 'manager', 'kitchen'] },
                { to: '/dashboard/inventory', icon: Package,          label: 'Stock Room',   color: 'from-purple-500 to-pink-600', roles: ['owner', 'manager'] },
              ].filter(a => a.roles.includes(staffRole as string)).map(({ to, icon: Icon, label, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-surface-50 hover:bg-[var(--card-bg)] border border-default/70 hover:border-brand-300/80 shadow-sm hover:shadow-card transition-all duration-200 group text-center"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-xs text-surface-800">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Low Stock Urgent Banner */}
          {data && (data.lowStock?.length ?? 0) > 0 && ['owner', 'manager'].includes(staffRole as string) && (
            <Link
              to="/dashboard/inventory"
              className="p-4 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-white border border-red-200/80 rounded-2xl flex items-center gap-3.5 hover:shadow-card transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center flex-shrink-0 shadow-glow-red group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-red-950 uppercase tracking-wider">Inventory Alert</p>
                <p className="text-xs text-red-700 font-medium truncate mt-0.5">
                  {data.lowStock.length} ingredient{data.lowStock.length > 1 ? 's' : ''} running critically low
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" />
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

