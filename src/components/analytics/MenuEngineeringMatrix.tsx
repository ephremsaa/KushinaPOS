import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts';
import {
  Sparkles, Star, TrendingUp, HelpCircle, AlertTriangle, ArrowUpRight,
  TrendingDown, DollarSign, Lightbulb, CheckCircle, ChevronRight, Info
} from 'lucide-react';
import { reportsApi, menuApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { Button, Badge, Skeleton } from '../ui';

export type MenuQuadrant = 'star' | 'workhorse' | 'puzzle' | 'dog';

export interface EngineeredItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  margin: number;
  marginPercent: number;
  volume: number;
  totalRevenue: number;
  totalProfit: number;
  quadrant: MenuQuadrant;
  aiRecommendation: string;
  suggestedAction: string;
  projectedProfitLift: number;
}

const QUADRANT_CONFIG: Record<MenuQuadrant, {
  label: string;
  amharicLabel: string;
  icon: any;
  color: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  summary: string;
  advice: string;
}> = {
  star: {
    label: 'Star (ኮከብ)',
    amharicLabel: 'ኮከብ',
    icon: Star,
    color: 'text-amber-600',
    dotColor: '#D4A72C',
    badgeBg: 'bg-gold-50 border-gold-300',
    badgeText: 'text-gold-800',
    summary: 'High Profit · High Popularity',
    advice: 'Protect recipe quality and maintain high visibility at the top of menu.',
  },
  workhorse: {
    label: 'Workhorse (ዋና ደንበኛ)',
    amharicLabel: 'ዋና ደንበኛ',
    icon: TrendingUp,
    color: 'text-brand-600',
    dotColor: '#2F7D32',
    badgeBg: 'bg-brand-50 border-brand-200',
    badgeText: 'text-brand-800',
    summary: 'Low Profit · High Popularity',
    advice: 'Increase price by 5–10% or renegotiate bulk ingredient costs to boost margin.',
  },
  puzzle: {
    label: 'Puzzle (እምቅ ዕድል)',
    amharicLabel: 'እምቅ ዕድል',
    icon: HelpCircle,
    color: 'text-indigo-600',
    dotColor: '#6366F1',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-800',
    summary: 'High Profit · Low Popularity',
    advice: 'Promote as Chef Specials, add high-res photos, or train waitstaff to recommend.',
  },
  dog: {
    label: 'Dog (ዝቅተኛ አፈጻጸም)',
    amharicLabel: 'ዝቅተኛ አፈጻጸም',
    icon: AlertTriangle,
    color: 'text-rose-600',
    dotColor: '#E11D48',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-800',
    summary: 'Low Profit · Low Popularity',
    advice: 'Consider removing from menu or substituting with a modern seasonal dish.',
  },
};

export function MenuEngineeringMatrix() {
  const [selectedQuadrant, setSelectedQuadrant] = useState<MenuQuadrant | 'all'>('all');
  const [period, setPeriod] = useState<'30d' | '7d' | '90d'>('30d');

  const { data: reportItems = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['reports-items', period],
    queryFn: async () => {
      const data = await reportsApi.items(period);
      return data as any[];
    },
  });

  const { data: menuList = [], isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const data = await menuApi.getItems();
      return (data as any)?.items || (Array.isArray(data) ? data : []);
    },
  });

  const isLoading = reportsLoading || menuLoading;

  // Compute Menu Engineering Data
  const { engineeredItems, avgMargin, avgVolume, totalProjectedLift, stats } = useMemo(() => {
    const itemMap = new Map<string, any>();
    menuList.forEach((m: any) => {
      itemMap.set(m.id, m);
    });

    const parsed: EngineeredItem[] = reportItems.map((rep: any) => {
      const matched = itemMap.get(rep.item_id || rep.id);
      const price = Number(rep.price || matched?.price || 150);
      const cost = Number(rep.cost_price || matched?.cost_price || price * 0.38);
      const margin = Math.max(0, price - cost);
      const marginPercent = price > 0 ? (margin / price) * 100 : 0;
      const volume = Number(rep.quantity || rep.total_quantity || 1);
      const totalRevenue = price * volume;
      const totalProfit = margin * volume;

      return {
        id: rep.item_id || rep.id || Math.random().toString(),
        name: rep.item_name || rep.name || matched?.name || 'Menu Dish',
        category: matched?.category?.name || 'Main',
        price,
        cost,
        margin,
        marginPercent,
        volume,
        totalRevenue,
        totalProfit,
        quadrant: 'star', // determined below
        aiRecommendation: '',
        suggestedAction: '',
        projectedProfitLift: 0,
      };
    });

    if (parsed.length === 0) {
      return { engineeredItems: [], avgMargin: 0, avgVolume: 0, totalProjectedLift: 0, stats: { star: 0, workhorse: 0, puzzle: 0, dog: 0 } };
    }

    const meanMargin = parsed.reduce((sum, i) => sum + i.margin, 0) / parsed.length;
    const meanVolume = parsed.reduce((sum, i) => sum + i.volume, 0) / parsed.length;

    const statsCount = { star: 0, workhorse: 0, puzzle: 0, dog: 0 };
    let sumLift = 0;

    const classified: EngineeredItem[] = parsed.map(item => {
      const isHighMargin = item.margin >= meanMargin;
      const isHighVolume = item.volume >= meanVolume;

      let quad: MenuQuadrant = 'dog';
      let rec = '';
      let action = '';
      let lift = 0;

      if (isHighMargin && isHighVolume) {
        quad = 'star';
        rec = `Strong performer with ${formatCurrency(item.margin)} margin. Keep quality consistent.`;
        action = 'Feature in menu top banner';
        lift = item.volume * 5;
      } else if (!isHighMargin && isHighVolume) {
        quad = 'workhorse';
        rec = `High customer demand (${item.volume} sold). Increase price by 8–10% to convert into a Star.`;
        action = `Increase price to ${formatCurrency(Math.round(item.price * 1.08))}`;
        lift = item.volume * (item.price * 0.08);
      } else if (isHighMargin && !isHighVolume) {
        quad = 'puzzle';
        rec = `Excellent profit margin (${item.marginPercent.toFixed(0)}%), but low order volume.`;
        action = 'Promote via QR specials & waiter suggestions';
        lift = (meanVolume - item.volume) * item.margin * 0.4;
      } else {
        quad = 'dog';
        rec = `Low volume and low margin. Redesign recipe or replace with seasonal special.`;
        action = 'Revamp recipe portion or retire';
        lift = 0;
      }

      statsCount[quad]++;
      sumLift += Math.max(0, lift);

      return {
        ...item,
        quadrant: quad,
        aiRecommendation: rec,
        suggestedAction: action,
        projectedProfitLift: Math.round(lift),
      };
    });

    return {
      engineeredItems: classified,
      avgMargin: meanMargin,
      avgVolume: meanVolume,
      totalProjectedLift: Math.round(sumLift),
      stats: statsCount,
    };
  }, [reportItems, menuList]);

  const filteredList = useMemo(() => {
    if (selectedQuadrant === 'all') return engineeredItems;
    return engineeredItems.filter(i => i.quadrant === selectedQuadrant);
  }, [engineeredItems, selectedQuadrant]);

  const chartData = useMemo(() => {
    return engineeredItems.map(item => ({
      ...item,
      x: item.volume,
      y: item.margin,
      z: item.totalProfit,
    }));
  }, [engineeredItems]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top AI Advisor Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-surface-900 via-surface-950 to-brand-950 text-white shadow-xl relative overflow-hidden border border-surface-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/20 border border-gold-500/30 text-gold-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> AI Menu Matrix & Profitability Advisor
            </div>
            <h2 className="text-2xl font-display font-black tracking-tight text-white">
              Menu Engineering & Profit Optimization
            </h2>
            <p className="text-xs text-surface-300 leading-relaxed">
              Analyzes your menu by <span className="text-gold-400 font-bold">Gross Margin (ETB)</span> vs <span className="text-brand-400 font-bold">Sales Volume</span> using the restaurant profitability quadrant matrix.
            </p>
          </div>

          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center sm:text-right min-w-[200px]">
            <p className="text-xs text-surface-300 font-medium">Estimated Monthly Profit Lift</p>
            <p className="text-3xl font-black font-mono text-gold-400 mt-0.5">
              +{formatCurrency(totalProjectedLift)}
            </p>
            <p className="text-[11px] text-surface-400 mt-1">Based on AI pricing recommendations</p>
          </div>
        </div>
      </div>

      {/* Quadrant Summary Pill Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['star', 'workhorse', 'puzzle', 'dog'] as MenuQuadrant[]).map(q => {
          const cfg = QUADRANT_CONFIG[q];
          const Icon = cfg.icon;
          const count = stats[q] || 0;
          const isSelected = selectedQuadrant === q;

          return (
            <button
              key={q}
              type="button"
              onClick={() => setSelectedQuadrant(isSelected ? 'all' : q)}
              className={cn(
                'card p-5 text-left transition-all relative overflow-hidden border-2 cursor-pointer',
                isSelected
                  ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md bg-white'
                  : 'border-surface-200 hover:border-surface-300 bg-white/80'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', cfg.badgeBg)}>
                  <Icon className={cn('w-5 h-5', cfg.color)} />
                </div>
                <span className="text-2xl font-black font-mono text-surface-900">{count}</span>
              </div>
              <h4 className="font-display font-black text-sm text-surface-900">{cfg.label}</h4>
              <p className="text-[11px] text-surface-500 font-medium mt-0.5">{cfg.summary}</p>
            </button>
          );
        })}
      </div>

      {/* 4-Quadrant Visual Scatter Plot Matrix */}
      <div className="card p-6 bg-white border border-surface-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-100">
          <div>
            <h3 className="font-display font-black text-lg text-surface-900">
              Interactive Profit vs Popularity Matrix
            </h3>
            <p className="text-xs text-surface-500">
              Hover over points to inspect dish margins, sales counts, and AI actions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-surface-500">Period:</span>
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  period === p ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Recharts Scatter Plot */}
        <div className="h-80 w-full">
          {isLoading ? (
            <div className="h-full w-full bg-surface-100 rounded-3xl animate-pulse" />
          ) : chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-surface-400 text-xs">
              <Info className="w-8 h-8 mb-2" />
              <span>Not enough sales data recorded for this period yet.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Volume"
                  unit=" orders"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Margin"
                  unit=" ETB"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="z" range={[60, 320]} />
                
                {/* Quadrant Benchmark Crosshairs */}
                <ReferenceLine x={avgVolume} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Avg Volume', position: 'top', fill: '#94a3b8', fontSize: 10 }} />
                <ReferenceLine y={avgMargin} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Avg Margin', position: 'right', fill: '#94a3b8', fontSize: 10 }} />
                
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const data = payload[0].payload as EngineeredItem;
                    const cfg = QUADRANT_CONFIG[data.quadrant];
                    return (
                      <div className="bg-surface-900 text-white p-3.5 rounded-2xl shadow-xl border border-surface-700 text-xs max-w-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm text-white">{data.name}</p>
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black', cfg.badgeBg, cfg.badgeText)}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-surface-300 pt-1 border-t border-surface-700">
                          <div>Price: <span className="text-white font-mono font-bold">{formatCurrency(data.price)}</span></div>
                          <div>Cost: <span className="text-white font-mono font-bold">{formatCurrency(data.cost)}</span></div>
                          <div>Margin: <span className="text-brand-400 font-mono font-bold">{formatCurrency(data.margin)}</span></div>
                          <div>Sold: <span className="text-gold-400 font-mono font-bold">{data.volume} units</span></div>
                        </div>
                        <p className="text-[10px] text-gold-300 font-medium pt-1">
                          💡 {data.suggestedAction}
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter data={chartData}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={QUADRANT_CONFIG[entry.quadrant].dotColor} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Actionable Dishes List */}
      <div className="card p-6 bg-white border border-surface-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface-100">
          <div>
            <h3 className="font-display font-black text-lg text-surface-900">
              AI Strategy Recommendations
            </h3>
            <p className="text-xs text-surface-500">
              Showing {filteredList.length} items {selectedQuadrant !== 'all' ? `in ${selectedQuadrant.toUpperCase()} quadrant` : ''}
            </p>
          </div>

          {selectedQuadrant !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedQuadrant('all')}>
              Show All Dishes
            </Button>
          )}
        </div>

        <div className="divide-y divide-surface-100">
          {filteredList.map((item) => {
            const cfg = QUADRANT_CONFIG[item.quadrant];
            const Icon = cfg.icon;

            return (
              <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50/60 p-2 rounded-2xl transition-colors">
                <div className="flex items-start gap-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', cfg.badgeBg)}>
                    <Icon className={cn('w-4 h-4', cfg.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-bold text-sm text-surface-900">{item.name}</h4>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border', cfg.badgeBg, cfg.badgeText)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">{item.aiRecommendation}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-surface-900">
                      {formatCurrency(item.price)} <span className="text-[11px] text-surface-400 font-normal">({item.volume} sold)</span>
                    </p>
                    <p className="text-[11px] text-brand-700 font-bold font-mono">
                      Margin: {formatCurrency(item.margin)} ({item.marginPercent.toFixed(0)}%)
                    </p>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-gold-50 border border-gold-200 text-xs font-bold text-gold-900 flex items-center gap-1 shadow-2xs">
                    <Lightbulb className="w-3.5 h-3.5 text-gold-600" />
                    <span>{item.suggestedAction}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
