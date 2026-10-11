import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { reportsApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { RefreshCw, Download, TrendingUp, Users, Package, Grid, Clock, Hash, Sparkles, ShoppingBag, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button, StatCardSkeleton, Skeleton } from '../../components/ui';
import { MenuEngineeringMatrix } from '../../components/analytics/MenuEngineeringMatrix';
import { globalToast } from '../../components/ui/Toast';

type Period = '7d' | '30d' | '90d';
type Tab = 'sales' | 'online' | 'items' | 'menu-matrix' | 'staff' | 'peak-hours' | 'tables' | 'inventory';

const CHART_COLORS = ['#2F7D32', '#7BC67E', '#D4A72C', '#172033', '#52a856', '#e4be52', '#a7d5ab'];

export default function ReportsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [tab, setTab] = useState<Tab>('sales');

  const { data: sales, isLoading: salesLoading } = useQuery({ queryKey: ['reports-sales', period], queryFn: () => reportsApi.sales(period).then(res => res as any) });
  const { data: items, isLoading: itemsLoading } = useQuery({ queryKey: ['reports-items', period], queryFn: () => reportsApi.items(period).then(res => res as any) });
  const { data: staff, isLoading: staffLoading } = useQuery({ queryKey: ['reports-staff', period], queryFn: () => reportsApi.staff(period).then(res => res as any) });
  const { data: tables, isLoading: tablesLoading } = useQuery({ queryKey: ['reports-tables', period], queryFn: () => reportsApi.tables(period).then(res => res as any) });
  const { data: peak, isLoading: peakLoading } = useQuery({ queryKey: ['reports-peak'], queryFn: () => reportsApi.peakHours().then(res => res as any) });
  const { data: inv, isLoading: invLoading } = useQuery({ queryKey: ['reports-inv'], queryFn: () => reportsApi.inventoryValuation().then(res => res as any) });
  const { data: onlineReport, isLoading: onlineLoading } = useQuery({ queryKey: ['reports-online', period], queryFn: () => reportsApi.onlineOrdering(period).then(res => res as any) });

  const { mutate: refresh, isPending: refreshing } = useMutation({
    mutationFn: () => reportsApi.refresh(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });

  const downloadCsv = () => {
    let typeMap: Record<Tab, string> = { sales: 'sales', online: '', items: 'items', 'menu-matrix': 'items', staff: 'staff', 'peak-hours': '', tables: '', inventory: '' };
    if (!typeMap[tab]) return globalToast.info('Export not supported for this tab yet');
    window.open(reportsApi.exportUrl(typeMap[tab], period), '_blank');
  };

  const tabs = [
    { k: 'sales', l: 'Sales Overview', i: TrendingUp },
    { k: 'online', l: 'Online & Delivery', i: ShoppingBag },
    { k: 'menu-matrix', l: 'AI Menu Matrix', i: Sparkles },
    { k: 'items', l: 'Top Items', i: Hash },
    { k: 'staff', l: 'Staff Perf.', i: Users },
    { k: 'tables', l: 'Table Util.', i: Grid },
    { k: 'peak-hours', l: 'Peak Hours', i: Clock },
    { k: 'inventory', l: 'Inventory', i: Package },
  ] as const;

  const renderPeakHours = () => {
    if (!peak || peak.length === 0) return <div className="text-surface-400 py-10 text-center">No data</div>;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = peak.map((p: any) => ({
      day: days[p.day_of_week - 1],
      dayIndex: p.day_of_week,
      hour: p.hour_of_day,
      value: Number(p.value)
    }));

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis type="number" dataKey="hour" name="Hour" unit=":00" tickCount={24} domain={[0, 23]} />
          <YAxis type="category" dataKey="day" name="Day" allowDuplicatedCategory={false} />
          <ZAxis type="number" dataKey="value" range={[50, 400]} name="Orders" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill="#2F7D32" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header bg-surface/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2"><TrendingUp className="w-6 h-6 text-brand-500" /> Analytics & Reports</h1>
          <p className="page-subtitle">Deep dive into operational data via Read-Optimized Views</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-surface rounded-xl p-1 border border-default shadow-sm">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-all', period === p ? 'bg-surface-900 text-white shadow-md' : 'text-muted hover:text-primary')}>
                {p}
              </button>
            ))}
          </div>
          <Button variant="secondary" loading={refreshing} icon={<RefreshCw className="w-4 h-4" />} onClick={() => refresh()}>
            {refreshing ? 'Refreshing…' : 'Refresh Data'}
          </Button>
          {['sales', 'items', 'staff'].includes(tab) && (
            <Button variant="primary" icon={<Download className="w-4 h-4" />} onClick={downloadCsv}>
              Export CSV
            </Button>
          )}
          <Button variant="gold" icon={<Download className="w-4 h-4" />} onClick={() => window.open(reportsApi.exportUrl('z-report', period), '_blank')}>
            Daily Z-Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all border-2',
              tab === t.k ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' : 'border-transparent bg-surface text-muted hover:text-primary')}>
            <t.i className="w-4 h-4" /> {t.l}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {tab === 'sales' && (
        <div className="space-y-6">
          {salesLoading ? (
            <StatCardSkeleton count={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card bg-surface p-6"><p className="text-muted font-bold mb-1">Total Orders</p><p className="text-3xl font-display font-extrabold font-mono">{Number(sales?.kpi?.total_orders || 0).toLocaleString()}</p></div>
              <div className="card bg-surface p-6"><p className="text-muted font-bold mb-1">Total Revenue</p><p className="text-3xl font-display font-extrabold text-brand-600 font-mono">{formatCurrency(sales?.kpi?.total_revenue || 0)}</p></div>
              <div className="card bg-surface p-6"><p className="text-muted font-bold mb-1">Avg Order Value</p><p className="text-3xl font-display font-extrabold font-mono">{formatCurrency(sales?.kpi?.avg_order || 0)}</p></div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card lg:col-span-2">
              <h3 className="font-bold text-primary mb-6">Daily Revenue</h3>
              <div className="h-64">
                {salesLoading ? (
                  <Skeleton height="100%" rounded="lg" className="w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sales?.dailySales}>
                      <XAxis dataKey="date" tick={{fontSize:11}} tickFormatter={v => new Date(v).toLocaleDateString(undefined, {month:'short',day:'numeric'})} />
                      <YAxis tick={{fontSize:11}} tickFormatter={v => `${(v/1000)}k`} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelFormatter={(v: any) => v ? new Date(v).toLocaleDateString() : ''} />
                      <Bar dataKey="total" fill="#2F7D32" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="card">
              <h3 className="font-bold text-primary mb-6">Revenue by Order Type</h3>
              <div className="h-64">
                {salesLoading ? (
                  <Skeleton height="100%" rounded="lg" className="w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sales?.typeBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({name, percent}: any) => `${String(name || '').replace('_',' ')} ${(Number(percent)*100).toFixed(0)}%`}>
                        {sales?.typeBreakdown.map((_:any, i:number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v:any) => v + ' orders'} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'items' && (
        <div className="card">
          <h3 className="font-bold text-primary mb-6">Best Selling Items</h3>
          <div className="h-[400px]">
            {itemsLoading ? <div className="h-full bg-surface-100 rounded-xl animate-pulse"/> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={items} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{fontSize:11}} />
                  <YAxis type="category" dataKey="name" tick={{fontSize:11}} />
                  <Tooltip formatter={(v:any,n:any) => n === 'quantity' ? v : formatCurrency(v)} />
                  <Bar dataKey="quantity" fill="#2F7D32" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'menu-matrix' && (
        <MenuEngineeringMatrix />
      )}

      {tab === 'staff' && (
        <div className="card overflow-hidden p-0">
          <div className="p-6 border-b border-surface-100">
            <h3 className="font-bold text-primary">Staff Performance</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Staff</th><th>Orders Handled</th><th>Total Sales</th><th>Avg Handling Time</th><th>Voids</th></tr></thead>
            <tbody>
              {staffLoading ? [...Array(5)].map((_,i) => <tr key={i}><td colSpan={5} className="py-4"><div className="h-4 bg-surface-100 animate-pulse rounded"/></td></tr>) :
               staff?.length === 0 ? <tr><td colSpan={5} className="text-center py-10">No data</td></tr> :
               staff?.map((s:any, i:number) => (
                <tr key={i}>
                  <td className="font-bold text-primary">{s.name}</td>
                  <td>{s.orders_handled}</td>
                  <td className="font-bold text-brand-600">{formatCurrency(s.total_sales)}</td>
                  <td>{s.avg_handling_seconds ? Math.round(s.avg_handling_seconds/60) : 0} mins</td>
                  <td className="text-red-500">{s.voided_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'peak-hours' && (
        <div className="card">
          <h3 className="font-bold text-primary mb-6">Peak Operational Hours</h3>
          <p className="text-sm text-muted mb-6">Identify the busiest hours across the week to optimize staffing schedules.</p>
          {peakLoading ? <div className="h-[400px] bg-surface-100 rounded-xl animate-pulse"/> : renderPeakHours()}
        </div>
      )}

      {tab === 'tables' && (
        <div className="card">
          <h3 className="font-bold text-primary mb-6">Table Utilization (Dine-in)</h3>
          <div className="h-[300px]">
            {tablesLoading ? <div className="h-full bg-surface-100 rounded-xl animate-pulse"/> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tables}>
                  <XAxis dataKey="name" tick={{fontSize:11}} />
                  <YAxis yAxisId="left" tick={{fontSize:11}} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:11}} />
                  <Tooltip formatter={(v:any, n:any) => n === 'parties' ? v : `${Math.round(v/60)} mins`} />
                  <Bar yAxisId="left" dataKey="parties" fill="#2F7D32" radius={[4,4,0,0]} name="Total Parties" />
                  <Bar yAxisId="right" dataKey="avg_duration_seconds" fill="#7BC67E" radius={[4,4,0,0]} name="Avg Duration (sec)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-surface p-6 border-2 border-brand-100">
            <p className="text-muted font-bold mb-1">Stock Valuation</p>
            <p className="text-4xl font-display font-extrabold text-brand-600">{invLoading ? '—' : formatCurrency(inv?.total_value || 0)}</p>
            <p className="text-sm text-muted mt-2">Current estimated value of all tracked inventory on hand.</p>
          </div>
          <div className="card bg-surface p-6">
            <p className="text-muted font-bold mb-1">Tracked Items</p>
            <p className="text-4xl font-display font-extrabold">{invLoading ? '—' : inv?.tracked_items}</p>
          </div>
          <div className="card bg-surface p-6 border-2 border-red-100">
            <p className="text-muted font-bold mb-1">Total Wastage (30d)</p>
            <p className="text-4xl font-display font-extrabold text-red-500">{invLoading ? '—' : formatCurrency(inv?.wastage_30d || 0)}</p>
            <p className="text-sm text-muted mt-2">Cost of goods lost to spoilage/waste in the last 30 days.</p>
          </div>
        </div>
      )}

      {/* ══════════════ ONLINE ORDERING & DELIVERY REPORT ══════════════ */}
      {tab === 'online' && (
        <div className="space-y-6">
          {onlineLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
          ) : (
            <>
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5 border border-brand-200 bg-brand-50/30 space-y-1">
                  <div className="flex items-center justify-between text-brand-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Online Revenue</span>
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-display font-extrabold text-primary">
                    {formatCurrency(onlineReport?.kpis?.online_sales || 0)}
                  </p>
                  <p className="text-xs text-muted">
                    {onlineReport?.kpis?.online_orders_count || 0} orders ({onlineReport?.kpis?.pickup_orders_count || 0} pickup, {onlineReport?.kpis?.delivery_orders_count || 0} delivery)
                  </p>
                </div>

                <div className="card p-5 border border-emerald-200 bg-emerald-50/30 space-y-1">
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Delivery Fees</span>
                    <Truck className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-display font-extrabold text-emerald-700">
                    {formatCurrency(onlineReport?.kpis?.delivery_fees_collected || 0)}
                  </p>
                  <p className="text-xs text-muted">
                    Collected across {onlineReport?.kpis?.delivery_orders_count || 0} fulfilled deliveries
                  </p>
                </div>

                <div className="card p-5 border border-blue-200 bg-blue-50/30 space-y-1">
                  <div className="flex items-center justify-between text-blue-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Avg Delivery Time</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-display font-extrabold text-blue-800">
                    {onlineReport?.kpis?.avg_delivery_minutes || 0} <span className="text-sm font-normal">mins</span>
                  </p>
                  <p className="text-xs text-muted">
                    Time from order acceptance to door arrival
                  </p>
                </div>

                <div className="card p-5 border border-red-200 bg-red-50/30 space-y-1">
                  <div className="flex items-center justify-between text-red-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Declined Orders</span>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-display font-extrabold text-red-600">
                    {onlineReport?.kpis?.total_rejected || 0}
                  </p>
                  <p className="text-xs text-muted">
                    Rejected during selected {period} period
                  </p>
                </div>
              </div>

              {/* Online vs In-Restaurant Sales Comparison Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6 border border-default/80 space-y-4">
                  <h3 className="font-bold text-base text-primary">Revenue Channel Breakdown</h3>
                  <p className="text-xs text-muted">Compare online pickup/delivery vs in-store POS register volume.</p>

                  <div className="space-y-4 pt-2">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5 text-brand-600" /> Online Ordering</span>
                        <span className="font-mono text-brand-700">{formatCurrency(onlineReport?.kpis?.online_sales || 0)}</span>
                      </div>
                      <div className="w-full bg-surface-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-brand-600 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((onlineReport?.kpis?.online_sales || 0) /
                                Math.max(1, (onlineReport?.kpis?.online_sales || 0) + (onlineReport?.kpis?.in_restaurant_sales || 0))) * 100
                            }%`
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-surface-600" /> In-Restaurant POS</span>
                        <span className="font-mono text-surface-800">{formatCurrency(onlineReport?.kpis?.in_restaurant_sales || 0)}</span>
                      </div>
                      <div className="w-full bg-surface-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-surface-800 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((onlineReport?.kpis?.in_restaurant_sales || 0) /
                                Math.max(1, (onlineReport?.kpis?.online_sales || 0) + (onlineReport?.kpis?.in_restaurant_sales || 0))) * 100
                            }%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rejection Reasons Breakdown Table */}
                <div className="card p-6 border border-default/80 space-y-4">
                  <h3 className="font-bold text-base text-primary">Declined Orders & Reasons</h3>
                  <p className="text-xs text-muted">Audit root causes why online orders were rejected.</p>

                  {(!onlineReport?.rejection_reasons || onlineReport.rejection_reasons.length === 0) ? (
                    <div className="py-8 text-center text-muted text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold text-primary">Zero Rejected Orders</p>
                      <p>All incoming online orders were accepted and processed.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-default/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-50 border-b border-default text-[10px] uppercase font-bold text-surface-500">
                          <tr>
                            <th className="py-2.5 px-3">Rejection Reason</th>
                            <th className="py-2.5 px-3 text-right">Orders</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 font-medium">
                          {onlineReport.rejection_reasons.map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-surface-50">
                              <td className="py-2.5 px-3 text-red-700">{r.reason}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
