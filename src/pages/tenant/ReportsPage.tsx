import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { reportsApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { RefreshCw, Download, TrendingUp, Users, Package, Grid, Clock, Hash } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type Period = '7d' | '30d' | '90d';
type Tab = 'sales' | 'items' | 'staff' | 'peak-hours' | 'tables' | 'inventory';

const CHART_COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#ea580c', '#c2410c'];

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

  const { mutate: refresh, isPending: refreshing } = useMutation({
    mutationFn: () => reportsApi.refresh(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });

  const downloadCsv = () => {
    let typeMap: Record<Tab, string> = { sales: 'sales', items: 'items', staff: 'staff', 'peak-hours': '', tables: '', inventory: '' };
    if (!typeMap[tab]) return alert('Export not supported for this tab yet');
    window.open(reportsApi.exportUrl(typeMap[tab], period), '_blank');
  };

  const tabs = [
    { k: 'sales', l: 'Sales Overview', i: TrendingUp },
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
          <Scatter data={data} fill="#f97316" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header bg-white/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2"><TrendingUp className="w-6 h-6 text-brand-500" /> Analytics & Reports</h1>
          <p className="page-subtitle">Deep dive into operational data via Read-Optimized Views</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-white rounded-xl p-1 border border-surface-200 shadow-sm">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-all', period === p ? 'bg-surface-900 text-white shadow-md' : 'text-surface-500 hover:text-surface-900')}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => refresh()} disabled={refreshing} className="btn-secondary gap-2 bg-white">
            <RefreshCw className={cn("w-4 h-4 text-surface-500", refreshing && "animate-spin")} /> {refreshing ? 'Refreshing MVs...' : 'Refresh Data'}
          </button>
          {['sales', 'items', 'staff'].includes(tab) && (
            <button onClick={downloadCsv} className="btn-primary gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all border-2',
              tab === t.k ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' : 'border-transparent bg-white text-surface-500 hover:text-surface-900')}>
            <t.i className="w-4 h-4" /> {t.l}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {tab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-white p-6"><p className="text-surface-500 font-bold mb-1">Total Orders</p><p className="text-3xl font-display font-extrabold">{salesLoading ? '—' : Number(sales?.kpi?.total_orders || 0).toLocaleString()}</p></div>
            <div className="card bg-white p-6"><p className="text-surface-500 font-bold mb-1">Total Revenue</p><p className="text-3xl font-display font-extrabold text-brand-600">{salesLoading ? '—' : formatCurrency(sales?.kpi?.total_revenue || 0)}</p></div>
            <div className="card bg-white p-6"><p className="text-surface-500 font-bold mb-1">Avg Order Value</p><p className="text-3xl font-display font-extrabold">{salesLoading ? '—' : formatCurrency(sales?.kpi?.avg_order || 0)}</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card lg:col-span-2">
              <h3 className="font-bold text-surface-900 mb-6">Daily Revenue</h3>
              <div className="h-64">
                {salesLoading ? <div className="h-full bg-surface-100 rounded-xl animate-pulse"/> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sales?.dailySales}>
                      <XAxis dataKey="date" tick={{fontSize:11}} tickFormatter={v => new Date(v).toLocaleDateString(undefined, {month:'short',day:'numeric'})} />
                      <YAxis tick={{fontSize:11}} tickFormatter={v => `${(v/1000)}k`} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} labelFormatter={v => new Date(v).toLocaleDateString()} />
                      <Bar dataKey="total" fill="#f97316" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="card">
              <h3 className="font-bold text-surface-900 mb-6">Revenue by Order Type</h3>
              <div className="h-64">
                {salesLoading ? <div className="h-full bg-surface-100 rounded-xl animate-pulse"/> : (
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
          <h3 className="font-bold text-surface-900 mb-6">Best Selling Items</h3>
          <div className="h-[400px]">
            {itemsLoading ? <div className="h-full bg-surface-100 rounded-xl animate-pulse"/> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={items} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{fontSize:11}} />
                  <YAxis type="category" dataKey="name" tick={{fontSize:11}} />
                  <Tooltip formatter={(v:any,n:any) => n === 'quantity' ? v : formatCurrency(v)} />
                  <Bar dataKey="quantity" fill="#f97316" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="card overflow-hidden p-0">
          <div className="p-6 border-b border-surface-100">
            <h3 className="font-bold text-surface-900">Staff Performance</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Staff</th><th>Orders Handled</th><th>Total Sales</th><th>Avg Handling Time</th><th>Voids</th></tr></thead>
            <tbody>
              {staffLoading ? [...Array(5)].map((_,i) => <tr key={i}><td colSpan={5} className="py-4"><div className="h-4 bg-surface-100 animate-pulse rounded"/></td></tr>) :
               staff?.length === 0 ? <tr><td colSpan={5} className="text-center py-10">No data</td></tr> :
               staff?.map((s:any, i:number) => (
                <tr key={i}>
                  <td className="font-bold text-surface-900">{s.name}</td>
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
          <h3 className="font-bold text-surface-900 mb-6">Peak Operational Hours</h3>
          <p className="text-sm text-surface-500 mb-6">Identify the busiest hours across the week to optimize staffing schedules.</p>
          {peakLoading ? <div className="h-[400px] bg-surface-100 rounded-xl animate-pulse"/> : renderPeakHours()}
        </div>
      )}

      {tab === 'tables' && (
        <div className="card">
          <h3 className="font-bold text-surface-900 mb-6">Table Utilization (Dine-in)</h3>
          <div className="h-[300px]">
            {tablesLoading ? <div className="h-full bg-surface-100 rounded-xl animate-pulse"/> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tables}>
                  <XAxis dataKey="name" tick={{fontSize:11}} />
                  <YAxis yAxisId="left" tick={{fontSize:11}} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:11}} />
                  <Tooltip formatter={(v:any, n:any) => n === 'parties' ? v : `${Math.round(v/60)} mins`} />
                  <Bar yAxisId="left" dataKey="parties" fill="#f97316" radius={[4,4,0,0]} name="Total Parties" />
                  <Bar yAxisId="right" dataKey="avg_duration_seconds" fill="#fdba74" radius={[4,4,0,0]} name="Avg Duration (sec)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-white p-6 border-2 border-brand-100">
            <p className="text-surface-500 font-bold mb-1">Stock Valuation</p>
            <p className="text-4xl font-display font-extrabold text-brand-600">{invLoading ? '—' : formatCurrency(inv?.total_value || 0)}</p>
            <p className="text-sm text-surface-500 mt-2">Current estimated value of all tracked inventory on hand.</p>
          </div>
          <div className="card bg-white p-6">
            <p className="text-surface-500 font-bold mb-1">Tracked Items</p>
            <p className="text-4xl font-display font-extrabold">{invLoading ? '—' : inv?.tracked_items}</p>
          </div>
          <div className="card bg-white p-6 border-2 border-red-100">
            <p className="text-surface-500 font-bold mb-1">Total Wastage (30d)</p>
            <p className="text-4xl font-display font-extrabold text-red-500">{invLoading ? '—' : formatCurrency(inv?.wastage_30d || 0)}</p>
            <p className="text-sm text-surface-500 mt-2">Cost of goods lost to spoilage/waste in the last 30 days.</p>
          </div>
        </div>
      )}

    </div>
  );
}
