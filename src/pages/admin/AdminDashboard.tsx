import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Store, Clock, CheckCircle2, CreditCard, TrendingUp, 
  AlertTriangle, RefreshCw, ArrowUpRight, ShieldCheck, 
  Layers, ChevronRight, Activity, ArrowRight
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatCurrency, formatRelative } from '../../lib/utils';
import { Link, useNavigate } from 'react-router-dom';

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold';
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold';
    case 'suspended':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold';
    case 'rejected':
      return 'bg-red-500/10 text-red-400 border border-red-500/20 font-bold';
    default:
      return 'bg-slate-800 text-slate-400 border border-slate-700 font-bold';
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats() as Promise<Record<string, unknown>>,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const churnRate = Number(stats?.churnRate ?? 0).toFixed(1);
  const totalTenants = Number(stats?.total ?? 0);
  const activeTenants = Number(stats?.active ?? 0);

  const kpiCards = [
    { 
      label: 'Total Restaurants', 
      value: totalTenants,           
      icon: Store,        
      color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30',
      badge: 'All Tenants',
      badgeColor: 'text-blue-400 bg-blue-500/10'
    },
    { 
      label: 'Active Tenants',    
      value: activeTenants,          
      icon: CheckCircle2, 
      color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
      badge: totalTenants ? `${Math.round((activeTenants / totalTenants) * 100)}% Active` : '100%',
      badgeColor: 'text-emerald-400 bg-emerald-500/10'
    },
    { 
      label: 'Pending Approvals',  
      value: stats?.pending ?? 0,         
      icon: Clock,        
      color: 'from-amber-500/20 to-yellow-500/10 text-amber-400 border-amber-500/30',   
      link: '/admin/approvals',
      badge: Number(stats?.pending ?? 0) > 0 ? 'Requires Action' : 'All Clear',
      badgeColor: Number(stats?.pending ?? 0) > 0 ? 'text-amber-400 bg-amber-500/20 animate-pulse' : 'text-slate-400 bg-slate-800'
    },
    { 
      label: 'Pending Payments',  
      value: stats?.pendingPayments ?? 0, 
      icon: CreditCard,   
      color: 'from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30', 
      link: '/admin/payments',
      badge: Number(stats?.pendingPayments ?? 0) > 0 ? 'Proofs Waiting' : 'Updated',
      badgeColor: Number(stats?.pendingPayments ?? 0) > 0 ? 'text-purple-400 bg-purple-500/20 animate-pulse' : 'text-slate-400 bg-slate-800'
    },
    { 
      label: 'Suspended Accounts', 
      value: stats?.suspended ?? 0,       
      icon: AlertTriangle,
      color: 'from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30',
      badge: 'Manual / ToS',
      badgeColor: 'text-rose-400 bg-rose-500/10'
    },
    { 
      label: 'Est. Monthly Revenue (MRR)', 
      value: formatCurrency(Number(stats?.mrr ?? 0)), 
      icon: TrendingUp, 
      color: 'from-orange-500/20 to-amber-500/10 text-orange-400 border-orange-500/30', 
      isText: true,
      badge: 'Recurring',
      badgeColor: 'text-orange-400 bg-orange-500/10'
    },
    { 
      label: 'Platform Churn Rate',        
      value: `${churnRate}%`,             
      icon: Activity,
      color: 'from-pink-500/20 to-rose-500/10 text-pink-400 border-pink-500/30', 
      isText: true,
      badge: Number(churnRate) > 5 ? 'High Churn' : 'Low Churn',
      badgeColor: Number(churnRate) > 5 ? 'text-rose-400 bg-rose-500/20' : 'text-emerald-400 bg-emerald-500/10'
    },
    { 
      label: 'Upcoming 7-Day Renewals', 
      value: stats?.upcomingRenewals ?? 0,
      icon: Clock,        
      color: 'from-indigo-500/20 to-cyan-500/10 text-indigo-400 border-indigo-500/30',
      badge: 'Expiring Soon',
      badgeColor: 'text-indigo-400 bg-indigo-500/10'
    },
  ];

  const recent = (stats?.recent as Record<string, unknown>[] | undefined) ?? [];
  const planBreakdown = (stats?.planBreakdown as Record<string, number> | undefined) ?? {};

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> HQ Command Room
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Platform Overview
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time multi-tenant analytics, subscription revenue, and operational health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 font-semibold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-orange-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, color, link, isText, badge, badgeColor }) => (
          <div
            key={label}
            className={`p-5 rounded-3xl bg-slate-950/80 border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 ${
              link ? 'cursor-pointer hover:border-orange-500/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.15)]' : 'border-slate-800/80'
            }`}
            onClick={link ? () => navigate(link) : undefined}
          >
            {/* Top Row: Icon + Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${color} border flex items-center justify-center shadow-md transition-transform group-hover:scale-110`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${badgeColor}`}>
                {badge}
              </span>
            </div>

            {/* Value & Label */}
            <div>
              <p className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                {isLoading ? (
                  <span className="inline-block w-16 h-8 bg-slate-800 rounded-lg animate-pulse" />
                ) : (
                  isText ? value : Number(value).toLocaleString()
                )}
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center justify-between">
                <span>{label}</span>
                {link && <ArrowUpRight className="w-3.5 h-3.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Middle Section: Plans Breakdown + Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Subscription Plan Distribution (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-white">Subscription Tier Distribution</h2>
                  <p className="text-xs text-slate-400">Active tenant subscriptions by tier</p>
                </div>
              </div>
              <Link to="/admin/plans" className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-0.5">
                Manage Plans <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-900 rounded-2xl animate-pulse" />)}
              </div>
            ) : Object.keys(planBreakdown).length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No active subscriptions yet</p>
                <p className="text-xs text-slate-500 mt-1">Approve pending applications to initiate trial plans.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(planBreakdown).map(([planName, count]) => {
                  const percentage = activeTenants ? Math.round((count / activeTenants) * 100) : 0;
                  return (
                    <div key={planName} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white uppercase tracking-wider">{planName} Plan</span>
                        <span className="font-black text-orange-400">{count} Active ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Total Active Subscribers</span>
            <span className="font-mono font-bold text-white">{activeTenants} Restaurants</span>
          </div>
        </div>

        {/* Recent Registrations Table (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-bold text-lg text-white">Recent Registrations</h2>
                <p className="text-xs text-slate-400">Latest tenant signups requesting onboarding</p>
              </div>
              <Link to="/admin/restaurants" className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-0.5">
                View All Directory <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-900 rounded-2xl animate-pulse" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                <Store className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No recent registrations</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Restaurant</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Registered</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recent.slice(0, 5).map((r) => (
                      <tr key={r.id as string} className="hover:bg-slate-900/50 transition-colors group">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 text-orange-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                              {(r.name as string)?.charAt(0)}
                            </div>
                            <span className="font-bold text-white text-sm">{r.name as string}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${getStatusBadge(r.status as string)}`}>
                            {r.status as string}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono">
                          {formatRelative(r.created_at as string)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {r.status === 'pending' ? (
                            <Link 
                              to="/admin/approvals" 
                              className="px-3 py-1 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 font-bold transition-all inline-flex items-center gap-1"
                            >
                              Review <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <Link 
                              to="/admin/restaurants" 
                              className="text-slate-400 hover:text-white font-medium transition-colors"
                            >
                              Details
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Showing top 5 recent signups</span>
            <Link to="/admin/approvals" className="font-bold text-orange-400 hover:underline">
              Check Pending Queue ({Number(stats?.pending ?? 0)})
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

