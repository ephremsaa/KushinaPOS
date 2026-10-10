import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kitchenApi, ordersApi } from '../../lib/api';
import { cn, formatCurrency } from '../../lib/utils';
import { audioService } from '../../lib/audioService';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ChefHat, Clock, CheckCircle2, MonitorPlay,
  Volume2, VolumeX, Flame, AlertCircle, Bell,
  RotateCcw, Maximize2, Minimize2, Check, Sparkles, X,
  Layers, History
} from 'lucide-react';
import { Badge } from '../../components/ui';
import { globalToast } from '../../components/ui/Toast';

const STATIONS = [
  { id: 'All Stations', key: 'kds.all_stations', fallback: 'All Stations' },
  { id: 'Kitchen', key: 'kds.kitchen', fallback: 'Kitchen' },
  { id: 'Grill', key: 'kds.grill', fallback: 'Grill' },
  { id: 'Bar', key: 'kds.bar', fallback: 'Bar' },
  { id: 'Bakery', key: 'kds.bakery', fallback: 'Bakery' },
  { id: 'Dessert', key: 'kds.dessert', fallback: 'Dessert' },
];


function getMinutesSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
}

// ─── SLA Timer ───────────────────────────────────────────────────────────────
// Colour-coded urgency: green (<10m) → amber (10-20m) → red/pulse (>20m)
const SLATimer = ({ createdAt }: { createdAt: string }) => {
  const [mins, setMins] = useState(getMinutesSince(createdAt));

  useEffect(() => {
    const interval = setInterval(() => setMins(getMinutesSince(createdAt)), 5000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const isUrgent  = mins >= 20;
  const isWarning = mins >= 10 && mins < 20;

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-black text-xs tracking-wider border transition-all',
      isUrgent
        ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-glow-red'
        : isWarning
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    )}>
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{mins}m</span>
    </div>
  );
};

// ─── Order Ticket ─────────────────────────────────────────────────────────────
interface TicketProps {
  order: any;
  onUpdateItem:  (args: { id: string; status: string }) => void;
  onUpdateOrder: (args: { id: string; status: string }) => void;
  onBumpAllItems: (order: any) => void;
}

function OrderTicket({ order, onUpdateItem, onUpdateOrder, onBumpAllItems }: TicketProps) {
  const mins = getMinutesSince(order.created_at);
  const isUrgent = mins >= 20;
  const allItemsDone = order.order_items.every((i: any) => i.status === 'ready' || i.status === 'served');

  return (
    <div className={cn(
      'shrink-0 w-[380px] flex flex-col rounded-3xl shadow-2xl border overflow-hidden',
      'bg-slate-900/95 max-h-full transition-all animate-scale-in',
      isUrgent
        ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-rose-900/30'
        : order.status === 'new'
        ? 'border-brand-500/70 shadow-orange-900/20'
        : 'border-amber-500/50'
    )}>
      {/* ── Ticket Header ── */}
      <div className="px-5 pt-4 pb-3 bg-slate-950/80 border-b border-slate-800 space-y-2.5">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-black text-white leading-none tracking-tight">
              {order.order_type === 'dine_in'
                ? `Table ${order.table_label || '?'}`
                : order.order_type === 'takeaway'
                ? 'Takeaway'
                : 'Delivery'}
            </h2>
            <p className="text-slate-400 font-mono font-bold text-xs mt-1 tracking-wider">
              #{order.local_id || order.id.slice(0, 6).toUpperCase()}
            </p>
          </div>
          <SLATimer createdAt={order.created_at} />
        </div>

        {/* Meta tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {order.order_source === 'qr_code' && (
            <Badge color="purple" dot>QR Order</Badge>
          )}
          {order.order_source === 'online_delivery' && (
            <Badge color="blue" dot>Delivery</Badge>
          )}
          {order.customer_name && (
            <span className="text-slate-300 font-bold bg-slate-800/90 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700">
              👤 {order.customer_name}
            </span>
          )}
          <Badge
            status={order.status === 'new' ? 'new' : 'preparing'}
            dot
            pulse={order.status === 'new'}
          >
            {order.status === 'new' ? 'New' : 'Cooking'}
          </Badge>
        </div>

        {order.notes && (
          <div className="flex items-start gap-2 p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/25 text-rose-300 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{order.notes}</span>
          </div>
        )}
      </div>

      {/* ── Items Checklist ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-slate-950/40">
        {order.order_items.map((item: any) => {
          const isDone = item.status === 'ready' || item.status === 'served';
          const isPrep = item.status === 'preparing';
          const nextStatus = isDone ? 'pending' : isPrep ? 'ready' : 'preparing';

          return (
            <button
              key={item.id}
              onClick={() => onUpdateItem({ id: item.id, status: nextStatus })}
              className={cn(
                'w-full text-left p-3 rounded-2xl border transition-all cursor-pointer',
                'active:scale-[0.98] touch-manipulation select-none min-h-[58px]',
                isDone
                  ? 'bg-slate-950/60 border-slate-800/70 opacity-60'
                  : isPrep
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-inner'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              )}
            >
              <div className="flex justify-between items-start gap-2.5">
                <div className="flex gap-2.5 items-start min-w-0">
                  <span className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-base flex-shrink-0',
                    isDone
                      ? 'bg-slate-800 text-slate-500'
                      : 'bg-gradient-to-br from-brand-500 to-orange-600 text-white shadow-sm'
                  )}>
                    {item.quantity}
                  </span>
                  <div className="min-w-0">
                    <p className={cn(
                      'text-base font-bold leading-tight truncate',
                      isDone ? 'line-through text-slate-500' : 'text-white'
                    )}>
                      {item.menu_item_name}
                    </p>
                    {item.station && item.station !== 'General' && (
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-0.5 block">
                        {item.station}
                      </span>
                    )}
                    {item.modifier_choices?.map((mod: any, i: number) => (
                      <p key={i} className="text-slate-400 text-xs font-medium mt-0.5 pl-2 border-l-2 border-slate-700">
                        + {mod.option_label}
                      </p>
                    ))}
                    {item.notes && (
                      <p className="text-amber-400 text-xs font-semibold mt-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        ⚠ {item.notes}
                      </p>
                    )}
                  </div>
                </div>
                {isDone ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <div className={cn(
                    'w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all',
                    isPrep ? 'border-amber-500 bg-amber-500/20' : 'border-slate-700'
                  )} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Primary Action Button / Bump ── */}
      <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        {order.status === 'new' ? (
          <button
            onClick={() => onUpdateOrder({ id: order.id, status: 'preparing' })}
            className="flex-1 py-4 rounded-2xl font-display font-black text-lg shadow-glow
                       flex items-center justify-center gap-2 cursor-pointer transition-all
                       active:scale-[0.98] touch-manipulation
                       bg-gradient-to-r from-brand-500 via-orange-500 to-amber-500 text-white
                       hover:brightness-110"
          >
            <Flame className="w-5 h-5" />
            Start Cooking
          </button>
        ) : (
          <button
            onClick={() => onUpdateOrder({ id: order.id, status: 'ready' })}
            className="flex-1 py-4 rounded-2xl font-display font-black text-lg shadow-glow-emerald
                       flex items-center justify-center gap-2 cursor-pointer transition-all
                       active:scale-[0.98] touch-manipulation
                       bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                       hover:brightness-110"
          >
            <CheckCircle2 className="w-5 h-5" />
            Bump Ticket (Ready)
          </button>
        )}

        {!allItemsDone && (
          <button
            type="button"
            onClick={() => onBumpAllItems(order)}
            title="Mark all items ready"
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <Check className="w-5 h-5 text-emerald-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Recall Bumped Tickets Modal ─────────────────────────────────────────────
function RecallModal({
  onClose,
  onRecall,
}: {
  onClose: () => void;
  onRecall: (orderId: string) => void;
}) {
  const { data: pastOrders = [], isLoading } = useQuery({
    queryKey: ['recent-bumped-orders'],
    queryFn: async () => {
      const all = (await ordersApi.list()) as any[];
      return all
        .filter((o) => o.status === 'ready' || o.status === 'served')
        .slice(0, 10);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 rounded-[2rem] w-full max-w-xl border border-slate-800 shadow-2xl p-6 flex flex-col max-h-[85vh] text-white">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-brand-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg">Recall Bumped Tickets</h3>
              <p className="text-xs text-slate-400">Restore accidentally bumped orders back to KDS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-slate-500">Loading recently finished orders…</div>
          ) : pastOrders.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No recently completed tickets found.</div>
          ) : (
            pastOrders.map((o) => (
              <div
                key={o.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white">
                      {o.order_type === 'dine_in' ? `Table ${o.table_label || '?'}` : (o.customer_name || 'Takeaway')}
                    </span>
                    <span className="text-xs font-mono text-slate-400">#{o.id.slice(0, 6).toUpperCase()}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {o.order_items?.length || 0} items · {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onRecall(o.id);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recall Ticket
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Kitchen Page ───────────────────────────────────────────────────────
export default function KitchenPage() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [station, setStation] = useState('All Stations');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRecall, setShowRecall] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track order IDs to detect new orders and play chime
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstMountRef = useRef<boolean>(true);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders', station],
    queryFn: () => kitchenApi.getOrders(station).then((res) => res as any),
    refetchInterval: 3000,
  });

  // Sound chime on new order arrival
  useEffect(() => {
    if (!orders || orders.length === 0) {
      prevOrderIdsRef.current = new Set();
      return;
    }

    const currentIds = new Set<string>(orders.map((o: any) => o.id));

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevOrderIdsRef.current = currentIds;
      return;
    }

    // Check if there are brand new orders
    let hasNew = false;
    for (const id of currentIds) {
      if (!prevOrderIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }

    if (hasNew && soundEnabled) {
      audioService.playOrderChime();
    }

    prevOrderIdsRef.current = currentIds;
  }, [orders, soundEnabled]);

  // Mutations
  const { mutate: updateItem } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      kitchenApi.updateItemStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['kitchen-orders', station] });
      const prev = qc.getQueryData(['kitchen-orders', station]);
      qc.setQueryData(['kitchen-orders', station], (old: any) => {
        if (!old) return old;
        return old.map((o: any) => ({
          ...o,
          order_items: o.order_items.map((i: any) =>
            i.id === id ? { ...i, status } : i
          ),
        }));
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['kitchen-orders', station], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['kitchen-orders', station] }),
  });

  const { mutate: updateOrder } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      kitchenApi.updateOrderStatus(id, status),
    onSuccess: (_, variables) => {
      if (variables.status === 'ready' && soundEnabled) {
        audioService.playBumpChime();
      }
      qc.invalidateQueries({ queryKey: ['kitchen-orders', station] });
    },
  });

  const handleBumpAllItems = async (order: any) => {
    try {
      for (const it of order.order_items) {
        if (it.status !== 'ready' && it.status !== 'served') {
          await kitchenApi.updateItemStatus(it.id, 'ready');
        }
      }
      await updateOrder({ id: order.id, status: 'ready' });
    } catch (e) {
      console.warn('Failed to bump all items:', e);
    }
  };

  const handleRecallOrder = async (orderId: string) => {
    try {
      await kitchenApi.updateOrderStatus(orderId, 'preparing');
      qc.invalidateQueries({ queryKey: ['kitchen-orders', station] });
    } catch (e) {
      globalToast.info('Failed to recall order.');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {}); // Safe to ignore: may not be in fullscreen // Safe to ignore: fullscreen may be denied
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const orderCount = orders.length;

  return (
    <div
      onClick={() => audioService.unlock()}
      className="h-[calc(100vh-80px)] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden -m-4 sm:-m-6 lg:-m-8 select-none"
    >
      {/* ── KDS Header ── */}
      <header className="bg-slate-900 border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between flex-shrink-0 z-10 shadow-xl gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 via-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-glow-sm flex-shrink-0">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-display font-black text-white leading-tight">
                {t('kds.title', 'Kitchen Display (KDS)')}
              </h1>
              <span className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-black border transition-all',
                orderCount > 0
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              )}>
                {orderCount === 0 ? t('kds.all_clear', 'All clear') : `${orderCount} ticket${orderCount > 1 ? 's' : ''}`}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] font-medium hidden sm:block">
              Auto-syncing every 3s · Audio alerts active
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Station selector */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            {STATIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStation(s.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer',
                  station === s.id
                    ? 'bg-gradient-to-r from-brand-500 to-orange-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                )}
              >
                {t(s.key, s.fallback)}
              </button>
            ))}
          </div>

          {/* Mobile Station dropdown */}
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="md:hidden bg-slate-950 text-white border border-slate-800 text-xs font-bold rounded-xl px-2.5 py-2 outline-none"
          >
            {STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.key, s.fallback)}
              </option>
            ))}
          </select>

          {/* Test Sound Button */}
          <button
            type="button"
            onClick={() => {
              audioService.unlock();
              audioService.playOrderChime();
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Test audio chime"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('kds.test_bell', 'Test Bell')}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title={soundEnabled ? 'Mute audio' : 'Unmute audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Recall Modal Button */}
          <button
            onClick={() => setShowRecall(true)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Recall recently bumped orders"
          >
            <History className="w-4 h-4 text-brand-400" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Ticket Board ── */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-5 scrollbar-hide flex gap-5 bg-gradient-to-b from-slate-950 to-slate-900/95 items-start">
        {isLoading && orders.length === 0 ? (
          <div className="flex gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 w-[380px] rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse h-96" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center mb-4 shadow-xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-display font-black text-white mb-1.5">
              All Orders Prepared!
            </h2>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
              No pending tickets for <span className="text-white font-semibold">{station}</span>. New orders will play an audio chime and appear instantly.
            </p>
          </div>
        ) : (
          orders.map((order: any) => (
            <OrderTicket
              key={order.id}
              order={order}
              onUpdateItem={updateItem}
              onUpdateOrder={updateOrder}
              onBumpAllItems={handleBumpAllItems}
            />
          ))
        )}
      </main>

      {/* Recall Bumped Tickets Modal */}
      {showRecall && (
        <RecallModal
          onClose={() => setShowRecall(false)}
          onRecall={handleRecallOrder}
        />
      )}
    </div>
  );
}
