import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { Order } from '../../types';
import {
  ClipboardList, Search, Filter, ChevronRight, X, Clock,
  AlertTriangle, CheckCircle2, XCircle, ChefHat, Truck,
  UtensilsCrossed, Banknote, CreditCard, Smartphone, Info,
  RefreshCw, ArrowRight, AlertCircle, Calendar, User
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────

type OrderStatus = 'all' | 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
type OrderType   = 'all' | 'dine_in' | 'takeaway' | 'delivery';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: React.ElementType }> = {
  new:       { label: 'New',       color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',    icon: ClipboardList },
  preparing: { label: 'Preparing', color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500',   icon: ChefHat },
  ready:     { label: 'Ready',     color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
  served:    { label: 'Served',    color: 'bg-surface-100 text-surface-600', dot: 'bg-surface-400', icon: UtensilsCrossed },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600',      dot: 'bg-red-400',     icon: XCircle },
};

const ORDER_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  dine_in:  { label: 'Dine-in',  icon: UtensilsCrossed },
  takeaway: { label: 'Takeaway', icon: ChefHat },
  delivery: { label: 'Delivery', icon: Truck },
};

const PAY_ICON: Record<string, React.ElementType> = {
  cash: Banknote, card: CreditCard, telebirr: Smartphone,
};

const STATUS_NEXT: Partial<Record<string, string>> = {
  new: 'preparing', preparing: 'ready', ready: 'served',
};
const STATUS_NEXT_LABEL: Partial<Record<string, string>> = {
  new: 'Start Preparing', preparing: 'Mark Ready', ready: 'Mark Served',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
}

function minutesElapsed(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

// ─── Cancel Modal ──────────────────────────────────────────────────────────

function CancelModal({
  order,
  onConfirm,
  onClose,
}: {
  order: Order;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const PRESETS = ['Customer changed mind', 'Item unavailable', 'Duplicate order', 'Operational error', 'Customer left'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-[2rem] w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-primary">Cancel Order</p>
            <p className="text-xs text-muted">#{order.id.split('-')[0].toUpperCase()} · {formatCurrency(order.total)}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">This action is logged and cannot be undone. A reason is required.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-surface-700 mb-2">Select or type a reason</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setReason(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                  reason === p ? 'bg-red-500 border-red-500 text-white' : 'bg-surface-50 border-default text-surface-600 hover:border-red-300'
                )}
              >{p}</button>
            ))}
          </div>
          <textarea
            rows={2}
            className="input w-full text-sm resize-none"
            placeholder="Or type a custom reason..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Back</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-2xl transition-colors"
          >
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Panel ────────────────────────────────────────────────────

function OrderDetail({
  order,
  canManage,
  onAdvance,
  onCancel,
  onCheckout,
  onClose,
  advancing,
}: {
  order: Order;
  canManage: boolean;
  onAdvance: (order: Order) => void;
  onCancel: (order: Order) => void;
  onCheckout: (order: Order) => void;
  onClose: () => void;
  advancing: boolean;
}) {
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
  const StatusIcon = status.icon;
  const TypeInfo = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG.dine_in;
  const TypeIcon = TypeInfo.icon;
  const PayIcon = order.payment_method ? (PAY_ICON[order.payment_method] || Banknote) : null;
  const elapsed = minutesElapsed(order.created_at);
  const isStale = elapsed > 45 && ['new', 'preparing'].includes(order.status);

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold', status.color)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
            {isStale && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                <AlertCircle className="w-3 h-3" /> Stale {elapsed}m
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-2xl text-primary">
            {order.table_label ? `Table ${order.table_label}` : (order.customer_name || TypeInfo.label)}
          </h3>
          <p className="text-surface-400 text-sm mt-0.5">
            #{order.id.split('-')[0].toUpperCase()} · {timeAgo(order.created_at)}
          </p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-surface-400" />
        </button>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-surface-50 rounded-2xl p-3 flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-surface-400" />
          <span className="text-sm font-semibold text-surface-700">{TypeInfo.label}</span>
        </div>
        <div className="bg-surface-50 rounded-2xl p-3 flex items-center gap-2">
          {PayIcon && <PayIcon className="w-4 h-4 text-surface-400" />}
          <span className="text-sm font-semibold text-surface-700 capitalize">
            {order.payment_status === 'paid' ? (order.payment_method || 'Paid') : 'Unpaid'}
          </span>
        </div>
        {order.staff_name && (
          <div className="bg-surface-50 rounded-2xl p-3 flex items-center gap-2">
            <User className="w-4 h-4 text-surface-400" />
            <span className="text-sm font-semibold text-surface-700">{order.staff_name}</span>
          </div>
        )}
        <div className="bg-surface-50 rounded-2xl p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-surface-400" />
          <span className="text-sm font-semibold text-surface-700">
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto mb-5">
        <p className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-3">Order Items</p>
        <div className="space-y-2">
          {order.order_items?.map(item => (
            <div key={item.id} className="bg-surface-50 rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-brand-100 text-brand-700 text-sm font-extrabold flex items-center justify-center flex-shrink-0">
                    {item.quantity}
                  </span>
                  <span className="font-semibold text-primary text-sm">{item.menu_item_name}</span>
                </div>
                <span className="text-sm font-bold text-surface-700">
                  {formatCurrency(item.quantity * item.unit_price)}
                </span>
              </div>
              {item.notes && (
                <p className="text-xs text-amber-600 italic mt-1.5 pl-9">"{item.notes}"</p>
              )}
              {item.modifier_choices && Array.isArray(item.modifier_choices) && item.modifier_choices.length > 0 && (
                <div className="pl-9 mt-1 flex flex-wrap gap-1">
                  {item.modifier_choices.map((mc: any, i: number) => (
                    <span key={i} className="text-xs bg-surface-200 text-surface-600 rounded-full px-2 py-0.5">
                      {mc.option_name ?? mc}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-surface-100 pt-4 mb-5 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.tax_amount > 0 && (
          <div className="flex justify-between text-muted">
            <span>Tax</span><span>{formatCurrency(order.tax_amount)}</span>
          </div>
        )}
        {order.discount_amount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Discount</span><span>-{formatCurrency(order.discount_amount)}</span>
          </div>
        )}
        {(order as any).tip_amount > 0 && (
          <div className="flex justify-between text-muted">
            <span>Tip</span><span>{formatCurrency((order as any).tip_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-lg text-primary border-t border-surface-100 pt-2 mt-1">
          <span>Total</span>
          <span className="text-brand-600">{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* Notes / Cancellation reason */}
      {order.notes && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{order.notes}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {canManage && order.status !== 'cancelled' && order.payment_status !== 'paid' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {STATUS_NEXT[order.status] && (
              <button
                onClick={() => onAdvance(order)}
                disabled={advancing}
                className="btn-primary flex-1 gap-2"
              >
                {advancing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {STATUS_NEXT_LABEL[order.status]}
              </button>
            )}
            <button
              onClick={() => onCancel(order)}
              className="flex items-center justify-center gap-1.5 text-red-500 hover:bg-red-50 border border-red-200 font-semibold px-4 py-2.5 rounded-2xl text-sm transition-colors"
            >
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          </div>
          
          <button
            onClick={() => onCheckout(order)}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-glow shadow-brand-500/30"
          >
            <Banknote className="w-5 h-5" />
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Orders Page ──────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const staffRole: string = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : 'waiter');
  const canManage = ['owner', 'manager', 'cashier'].includes(staffRole);

  // ── Filter state ─────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [typeFilter, setTypeFilter]   = useState<OrderType>('all');
  const [search, setSearch]           = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection/modal state ────────────────────────────────────
  const [selectedOrder, setSelectedOrder]         = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget]           = useState<Order | null>(null);
  const [advancingId, setAdvancingId]             = useState<string | null>(null);

  // ── Build query params ───────────────────────────────────────
  const queryParams = useMemo(() => {
    const p: Record<string, string> = { limit: '200' };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (statusFilter === 'cancelled') p.include_cancelled = 'true';
    if (typeFilter !== 'all') p.order_type = typeFilter;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo)   p.date_to   = `${dateTo}T23:59:59Z`;
    return p;
  }, [statusFilter, typeFilter, dateFrom, dateTo]);

  // ── Data fetching ────────────────────────────────────────────
  const { data: orders = [], isLoading, isFetching } = useQuery({
    queryKey: ['orders', queryParams],
    queryFn: () => ordersApi.list(queryParams) as Promise<Order[]>,
    refetchInterval: 8_000,
  });

  const { data: staleOrders = [] } = useQuery({
    queryKey: ['orders-stale'],
    queryFn: () => ordersApi.stale(45) as Promise<Order[]>,
    refetchInterval: 60_000,
    enabled: canManage,
  });

  // ── Filtered orders (client-side search) ─────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.id.includes(q) ||
      (o.table_label ?? '').toLowerCase().includes(q) ||
      (o.customer_name ?? '').toLowerCase().includes(q) ||
      (o.staff_name ?? '').toLowerCase().includes(q) ||
      o.order_items?.some(i => i.menu_item_name.toLowerCase().includes(q))
    );
  }, [orders, search]);

  // ── Status counts ────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
    return counts;
  }, [orders]);

  // ── Mutations ────────────────────────────────────────────────
  const advanceMutation = useMutation({
    mutationFn: async (order: Order) => {
      const next = STATUS_NEXT[order.status];
      if (!next) return;
      setAdvancingId(order.id);
      await ordersApi.setStatus(order.id, next);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      setSelectedOrder(null);
    },
    onSettled: () => setAdvancingId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ order, reason }: { order: Order; reason: string }) => {
      await ordersApi.cancelWithReason(order.id, reason);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-stale'] });
      setCancelTarget(null);
      setSelectedOrder(null);
    },
  });

  // ── Helpers ──────────────────────────────────────────────────
  const activeFilterCount = [
    statusFilter !== 'all', typeFilter !== 'all', !!dateFrom, !!dateTo
  ].filter(Boolean).length;

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <>
      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onConfirm={reason => cancelMutation.mutate({ order: cancelTarget, reason })}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <div className="flex gap-5 h-full animate-fade-in" style={{ height: 'calc(100vh - 80px)' }}>

        {/* ── Left: List ───────────────────────────────────────── */}
        <div className={cn('flex flex-col transition-all duration-300', selectedOrder ? 'w-[55%]' : 'w-full')}>

          {/* Header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1 className="font-display font-bold text-2xl text-primary flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-brand-500" /> Orders
              </h1>
              <p className="text-muted text-sm mt-0.5">
                {filtered.length} order{filtered.length !== 1 ? 's' : ''} · auto-updates every 8s
                {isFetching && !isLoading && <RefreshCw className="w-3 h-3 inline ml-1.5 animate-spin text-brand-400" />}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateFrom(todayStr)}
                className={cn('text-xs font-bold px-3 py-1.5 rounded-xl transition-all', dateFrom === todayStr ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
              >
                Today
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn('flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl transition-all relative', showFilters ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
              >
                <Filter className="w-4 h-4" /> Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Stale orders alert */}
          {canManage && staleOrders.length > 0 && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">
                  {staleOrders.length} order{staleOrders.length > 1 ? 's are' : ' is'} stale (45+ min open)
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {staleOrders.map(o => o.table_label ? `Table ${o.table_label}` : `#${o.id.split('-')[0]}`).join(', ')}
                </p>
              </div>
              <button
                onClick={() => { setStatusFilter('new'); }}
                className="text-xs font-bold text-red-600 underline whitespace-nowrap"
              >
                View →
              </button>
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="mb-4 card space-y-4 animate-slide-up">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search by table, customer, item..."
                  className="input pl-10 w-full"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-surface-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Status filter */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'new', 'preparing', 'ready', 'served', 'cancelled'] as OrderStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-bold border transition-all',
                          statusFilter === s
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'bg-surface-50 border-default text-surface-600 hover:border-brand-300'
                        )}
                      >
                        {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                        {s !== 'all' && statusCounts[s] != null && (
                          <span className="ml-1 opacity-70">({statusCounts[s] ?? 0})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type filter */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'dine_in', 'takeaway', 'delivery'] as OrderType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-bold border transition-all',
                          typeFilter === t
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'bg-surface-50 border-default text-surface-600 hover:border-brand-300'
                        )}
                      >
                        {t === 'all' ? 'All' : ORDER_TYPE_CONFIG[t].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date from */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">From</label>
                  <input type="date" className="input w-full text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                {/* Date to */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">To</label>
                  <input type="date" className="input w-full text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setSearch(''); }}
                  className="text-xs text-red-500 font-semibold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Status tab bar (always visible) */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide flex-shrink-0">
            {(['all', 'new', 'preparing', 'ready', 'served', 'cancelled'] as OrderStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                  statusFilter === s
                    ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                    : 'bg-surface border-default text-surface-600 hover:border-brand-200'
                )}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                {s !== 'all' && statusCounts[s] != null && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-extrabold', statusFilter === s ? 'bg-surface/20 text-white' : 'bg-surface-100 text-muted')}>
                    {statusCounts[s] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Order list */}
          <div className="flex-1 overflow-y-auto space-y-2.5">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-surface-100 rounded-2xl animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-surface-300">
                <ClipboardList className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-lg font-semibold text-surface-400">No orders found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : filtered.map(order => {
              const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
              const tc = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG.dine_in;
              const TypeIcon = tc.icon;
              const elapsed = minutesElapsed(order.created_at);
              const isStale = elapsed > 45 && ['new', 'preparing'].includes(order.status);
              const isSelected = selectedOrder?.id === order.id;

              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(isSelected ? null : order)}
                  className={cn(
                    'w-full text-left p-4 rounded-[1.5rem] border-2 transition-all group',
                    isSelected
                      ? 'bg-brand-50 border-brand-400 shadow-md'
                      : isStale
                        ? 'bg-red-50/60 border-red-200 hover:border-red-300'
                        : 'bg-surface border-default hover:border-brand-200 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn('flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold', sc.color)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
                        {sc.label}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-primary truncate">
                          {order.table_label ? `Table ${order.table_label}` : (order.customer_name || tc.label)}
                        </p>
                        <p className="text-xs text-surface-400 flex items-center gap-1.5 mt-0.5">
                          <TypeIcon className="w-3 h-3" /> {tc.label}
                          {order.staff_name && <><span>·</span>{order.staff_name}</>}
                          {isStale && <span className="text-red-500 font-semibold">· {elapsed}m!</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-extrabold text-brand-600">{formatCurrency(order.total)}</p>
                        <p className="text-xs text-surface-400">
                          {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-surface-400">{timeAgo(order.created_at)}</p>
                        <p className={cn('text-xs font-semibold mt-0.5', order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600')}>
                          {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </p>
                      </div>
                      <ChevronRight className={cn('w-4 h-4 text-surface-300 transition-transform', isSelected && 'rotate-90 text-brand-500')} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Detail Panel ─────────────────────────────── */}
        {selectedOrder && (
          <div className="flex-1 min-w-0 card overflow-y-auto animate-slide-up">
            <OrderDetail
              order={selectedOrder}
              canManage={canManage}
              onAdvance={order => advanceMutation.mutate(order)}
              onCancel={order => setCancelTarget(order)}
              onCheckout={order => navigate('/dashboard/checkout', { state: { orderId: order.id } })}
              onClose={() => setSelectedOrder(null)}
              advancing={advancingId === selectedOrder.id}
            />
          </div>
        )}
      </div>
    </>
  );
}
