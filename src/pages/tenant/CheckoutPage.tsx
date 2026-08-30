import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { Order, OrderItem } from '../../types';
import {
  Wallet, CheckCircle, Clock, Banknote, CreditCard, Smartphone,
  X, Printer, Users, SplitSquareHorizontal, ShieldAlert,
  ChevronRight, Percent, Minus, Plus, AlertTriangle, Sparkles
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type PayMethod = 'cash' | 'card' | 'telebirr';

interface PaymentSplit {
  method: PayMethod;
  amount: number;
}

interface SplitGuest {
  id: number;
  label: string;
  itemIndexes: number[];
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({
  order,
  tipAmount,
  paymentMethod,
  amountTendered,
  change,
  restaurantName,
  onClose,
}: {
  order: Order;
  tipAmount: number;
  paymentMethod: string;
  amountTendered: number;
  change: number;
  restaurantName: string;
  onClose: () => void;
}) {
  const handlePrint = () => window.print();
  const grandTotal = order.total + tipAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-surface-900">Payment Complete</p>
              <p className="text-xs text-surface-400">Receipt ready</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full">
            <X className="w-4 h-4 text-surface-400" />
          </button>
        </div>

        {/* Receipt body */}
        <div className="overflow-y-auto flex-1 p-6 print:p-4" id="receipt-content">
          <div className="text-center mb-6">
            <p className="font-display font-bold text-xl text-surface-900">{restaurantName}</p>
            <p className="text-xs text-surface-400 mt-1">{new Date().toLocaleString()}</p>
            <p className="text-xs text-surface-400">
              #{order.id.split('-')[0].toUpperCase()}
              {order.table_label ? ` · Table ${order.table_label}` : ''}
            </p>
          </div>

          <div className="border-t border-dashed border-surface-200 pt-4 mb-4 space-y-2">
            {order.order_items?.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-surface-600">{item.quantity}× {item.menu_item_name}</span>
                <span className="font-medium">{formatCurrency(item.quantity * item.unit_price)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-surface-200 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-surface-500">
              <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.tax_amount > 0 && (
              <div className="flex justify-between text-surface-500">
                <span>Tax</span><span>{formatCurrency(order.tax_amount)}</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>-{formatCurrency(order.discount_amount)}</span>
              </div>
            )}
            {tipAmount > 0 && (
              <div className="flex justify-between text-surface-500">
                <span>Tip</span><span>{formatCurrency(tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-lg pt-2 border-t border-surface-200">
              <span>Total Paid</span>
              <span className="text-brand-600">{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-surface-500 text-xs pt-2">
              <span>Method</span>
              <span className="capitalize font-medium">{paymentMethod}</span>
            </div>
            {amountTendered > 0 && (
              <>
                <div className="flex justify-between text-surface-500 text-xs">
                  <span>Tendered</span><span>{formatCurrency(amountTendered)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 text-xs font-bold">
                  <span>Change</span><span>{formatCurrency(change)}</span>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-surface-400 mt-6 border-t border-dashed border-surface-200 pt-4">
            Thank you for dining with us!
          </p>
        </div>

        <div className="p-4 border-t border-surface-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          <button onClick={handlePrint} className="btn-primary flex-1 gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Void Modal ───────────────────────────────────────────────────────────────

function VoidModal({
  order,
  onConfirm,
  onClose,
}: {
  order: Order;
  onConfirm: (pin: string) => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    onConfirm(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-surface-900">Void Order</p>
            <p className="text-xs text-surface-500">Requires manager authorization</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-5 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            This will cancel order <strong>#{order.id.split('-')[0].toUpperCase()}</strong> worth <strong>{formatCurrency(order.total)}</strong>. This action is logged.
          </p>
        </div>

        <p className="text-sm font-semibold text-surface-700 mb-2">Manager PIN</p>
        <input
          type="password"
          maxLength={6}
          inputMode="numeric"
          className={cn('input text-center text-2xl tracking-widest font-bold', error && 'border-red-400 focus:ring-red-400')}
          placeholder="••••"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-2xl transition-colors"
          >
            Void Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table Status Modal ───────────────────────────────────────────────────────

function TableStatusModal({
  tableLabel,
  onChoose,
}: {
  tableLabel: string;
  onChoose: (status: 'available' | 'cleaning') => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-6">
        <p className="font-bold text-surface-900 text-lg mb-1">Table {tableLabel} — next status?</p>
        <p className="text-sm text-surface-500 mb-6">Payment complete. What should the table status be?</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onChoose('available')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition-all"
          >
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Mark Available Now
          </button>
          <button
            onClick={() => onChoose('cleaning')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-surface-300 bg-surface-50 hover:bg-surface-100 text-surface-700 font-bold transition-all"
          >
            <span className="w-3 h-3 rounded-full bg-surface-400" />
            Needs Cleaning First
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Checkout Component ─────────────────────────────────────────────────

const TIP_PRESETS = [10, 15, 20];
const METHOD_CONFIG: { id: PayMethod; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'cash',     label: 'Cash',     icon: Banknote,    color: 'emerald' },
  { id: 'card',     label: 'Card',     icon: CreditCard,  color: 'blue' },
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone,  color: 'violet' },
];

export default function CheckoutPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const restaurantName = (user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant';

  // ── Selections ────────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [processing, setProcessing] = useState(false);

  // ── Payment ───────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialMethod, setPartialMethod] = useState<PayMethod>('cash');

  // ── Tip ───────────────────────────────────────────────────────
  const [tipPercent, setTipPercent] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');

  // ── Split bill ────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState<'none' | 'even' | 'items'>('none');
  const [guestCount, setGuestCount] = useState(2);
  const [guests, setGuests] = useState<SplitGuest[]>([]);
  const [activeGuest, setActiveGuest] = useState(0);

  // ── Modals ────────────────────────────────────────────────────
  const [showVoid, setShowVoid] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [lastPaidData, setLastPaidData] = useState<{
    order: Order; tip: number; method: string; tendered: number; change: number; tableLabel?: string;
  } | null>(null);
  const [pendingTableStatus, setPendingTableStatus] = useState<'available' | 'cleaning'>('available');

  // ── Data ──────────────────────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => ordersApi.list() as Promise<Order[]>,
    refetchInterval: 10_000,
  });

  const unpaidOrders = orders.filter(
    o => o.status !== 'cancelled' && o.payment_status === 'pending'
  );

  // ── Derived amounts ───────────────────────────────────────────
  const baseTotal = selectedOrder?.total ?? 0;
  const tipAmount = tipPercent != null
    ? Math.round(baseTotal * (tipPercent / 100) * 100) / 100
    : parseFloat(customTip) || 0;
  const grandTotal = baseTotal + tipAmount;

  const totalSplitPaid = splits.reduce((s, p) => s + p.amount, 0);
  const amountRemaining = Math.max(0, grandTotal - totalSplitPaid);

  const tendered = parseFloat(amountTendered) || 0;
  const changeDue = paymentMethod === 'cash' && splits.length === 0
    ? Math.max(0, tendered - grandTotal)
    : 0;

  // ── Split-by-items helpers ────────────────────────────────────
  const initGuests = (count: number) => {
    const g: SplitGuest[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      label: `Guest ${i + 1}`,
      itemIndexes: [],
    }));
    setGuests(g);
    setActiveGuest(0);
  };

  const toggleItemGuest = (itemIdx: number) => {
    setGuests(prev => prev.map((g, gi) => {
      if (gi === activeGuest) {
        const has = g.itemIndexes.includes(itemIdx);
        return { ...g, itemIndexes: has ? g.itemIndexes.filter(i => i !== itemIdx) : [...g.itemIndexes, itemIdx] };
      }
      return { ...g, itemIndexes: g.itemIndexes.filter(i => i !== itemIdx) };
    }));
  };

  const guestTotal = (guest: SplitGuest) => {
    if (!selectedOrder?.order_items) return 0;
    return guest.itemIndexes.reduce((s, idx) => {
      const item = selectedOrder.order_items![idx];
      return s + (item ? item.quantity * item.unit_price : 0);
    }, 0);
  };

  // ── Select order helper ───────────────────────────────────────
  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    setPaymentMethod('cash');
    setAmountTendered('');
    setSplits([]);
    setTipPercent(null);
    setCustomTip('');
    setSplitMode('none');
    setGuestCount(2);
    setGuests([]);
  };

  // ── Auto-select from location state ───────────────────────────
  useEffect(() => {
    if (location.state?.orderId && unpaidOrders.length > 0 && !selectedOrder) {
      const match = unpaidOrders.find(o => o.id === location.state.orderId);
      if (match) {
        selectOrder(match);
      }
      // Clean up state so refresh doesn't re-trigger unnecessarily
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, unpaidOrders, selectedOrder, navigate]);

  // ── Add partial payment ───────────────────────────────────────
  const addSplit = () => {
    const amt = parseFloat(partialAmount);
    if (!amt || amt <= 0 || amt > amountRemaining + 0.01) return;
    setSplits(prev => [...prev, { method: partialMethod, amount: amt }]);
    setPartialAmount('');
  };

  // ── Process payment ───────────────────────────────────────────
  const handlePay = async (tableNextStatus: 'available' | 'cleaning' = 'available') => {
    if (!selectedOrder) return;
    setProcessing(true);

    const primaryMethod = splits.length > 0
      ? splits.reduce((a, b) => a.amount > b.amount ? a : b).method
      : paymentMethod;

    try {
      await ordersApi.pay(selectedOrder.id, {
        payment_method: primaryMethod,
        tip_amount: tipAmount,
        amount_tendered: paymentMethod === 'cash' && splits.length === 0 ? tendered || null : null,
        table_next_status: tableNextStatus,
      });

      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });

      setLastPaidData({
        order: selectedOrder,
        tip: tipAmount,
        method: primaryMethod,
        tendered: tendered,
        change: changeDue,
        tableLabel: selectedOrder.table_label ?? undefined,
      });
      setShowReceipt(true);
      setSelectedOrder(null);
      setSplits([]);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
      setShowTableModal(false);
    }
  };

  const initiatePayment = () => {
    if (!selectedOrder) return;
    if (selectedOrder.table_label) {
      setShowTableModal(true);
    } else {
      handlePay('available');
    }
  };

  // ── Void order ────────────────────────────────────────────────
  const handleVoid = async (pin: string) => {
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      await ordersApi.void(selectedOrder.id, pin);
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      setSelectedOrder(null);
      setShowVoid(false);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Void failed');
    } finally {
      setProcessing(false);
    }
  };

  const canPay = selectedOrder && (splits.length > 0 ? amountRemaining < 0.01 : true);

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modals */}
      {showVoid && selectedOrder && (
        <VoidModal order={selectedOrder} onConfirm={handleVoid} onClose={() => setShowVoid(false)} />
      )}
      {showReceipt && lastPaidData && (
        <ReceiptModal
          order={lastPaidData.order}
          tipAmount={lastPaidData.tip}
          paymentMethod={lastPaidData.method}
          amountTendered={lastPaidData.tendered}
          change={lastPaidData.change}
          restaurantName={restaurantName}
          onClose={() => setShowReceipt(false)}
        />
      )}
      {showTableModal && selectedOrder?.table_label && (
        <TableStatusModal
          tableLabel={selectedOrder.table_label}
          onChoose={status => handlePay(status)}
        />
      )}

      <div className="flex h-full gap-5 animate-fade-in" style={{ height: 'calc(100vh - 80px)' }}>

        {/* ── Left: Order List ─────────────────────────────────── */}
        <div className="w-80 flex flex-col flex-shrink-0">
          <div className="mb-5">
            <h2 className="font-display font-bold text-2xl text-surface-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-brand-500" /> Checkout
            </h2>
            <p className="text-surface-500 text-sm mt-0.5">
              {unpaidOrders.length} bill{unpaidOrders.length !== 1 ? 's' : ''} pending
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5">
            {isLoading ? (
              <div className="flex justify-center pt-12">
                <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : unpaidOrders.length === 0 ? (
              <div className="text-center py-14 bg-surface-50 rounded-3xl border border-surface-100">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-surface-600 font-semibold">All bills are settled!</p>
              </div>
            ) : unpaidOrders.map(order => (
              <button
                key={order.id}
                onClick={() => selectOrder(order)}
                className={cn(
                  'w-full text-left p-4 rounded-[1.5rem] border-2 transition-all',
                  selectedOrder?.id === order.id
                    ? 'bg-brand-50 border-brand-400 shadow-sm'
                    : 'bg-white border-surface-200 hover:border-brand-200 hover:shadow-sm'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-surface-900">
                      {order.table_label ? `Table ${order.table_label}` : (order.customer_name || 'Takeaway')}
                    </p>
                    <p className="text-xs text-surface-400">
                      {order.order_items?.length ?? 0} items
                    </p>
                  </div>
                  <span className="font-extrabold text-brand-600 text-lg">{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold',
                    order.status === 'served' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'ready'  ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  )}>{order.status}</span>
                  <span className="text-surface-400 text-xs flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Payment Panel ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto pb-4">
          {!selectedOrder ? (
            <div className="h-full flex flex-col items-center justify-center text-surface-300">
              <Wallet className="w-20 h-20 mb-4 opacity-40" />
              <p className="text-xl font-semibold text-surface-400">Select a bill to process</p>
              <p className="text-sm mt-1">Choose an order from the left panel</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">

              {/* Header */}
              <div className="card flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-2xl text-surface-900">
                    {selectedOrder.table_label ? `Table ${selectedOrder.table_label}` : (selectedOrder.customer_name || 'Takeaway')}
                  </h3>
                  <p className="text-surface-400 text-sm mt-0.5">
                    Order #{selectedOrder.id.split('-')[0].toUpperCase()} · {selectedOrder.order_items?.length ?? 0} items
                  </p>
                </div>
                <button
                  onClick={() => setShowVoid(true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors font-semibold"
                >
                  <X className="w-3.5 h-3.5" /> Void Order
                </button>
              </div>

              {/* Order Summary */}
              <div className="card">
                <h4 className="font-bold text-surface-900 mb-4 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-brand-500" /> Order Summary
                </h4>
                <div className="space-y-2 mb-5">
                  {selectedOrder.order_items?.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between text-sm group">
                      {splitMode === 'items' && (
                        <button
                          onClick={() => toggleItemGuest(idx)}
                          className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold transition-all',
                            guests[activeGuest]?.itemIndexes.includes(idx)
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-surface-300 text-surface-400'
                          )}
                        >
                          {guests[activeGuest]?.itemIndexes.includes(idx) ? `G${activeGuest + 1}` : '+'}
                        </button>
                      )}
                      <span className="flex-1 text-surface-700">
                        {item.quantity}× {item.menu_item_name}
                        {item.notes && <span className="text-amber-500 italic ml-1 text-xs">({item.notes})</span>}
                      </span>
                      <span className="font-medium text-surface-900 ml-4">{formatCurrency(item.quantity * item.unit_price)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-surface-100 pt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-surface-500">
                    <span>Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.tax_amount > 0 && (
                    <div className="flex justify-between text-surface-500">
                      <span>Tax</span><span>{formatCurrency(selectedOrder.tax_amount)}</span>
                    </div>
                  )}
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount</span><span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-surface-500">
                      <span>Tip</span><span>{formatCurrency(tipAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-xl text-surface-900 border-t border-surface-200 pt-3 mt-1">
                    <span>Total Due</span>
                    <span className="text-brand-600">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div className="card">
                <h4 className="font-bold text-surface-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-500" /> Tip
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {TIP_PRESETS.map(pct => (
                    <button
                      key={pct}
                      onClick={() => { setTipPercent(tipPercent === pct ? null : pct); setCustomTip(''); }}
                      className={cn(
                        'px-4 py-2 rounded-2xl text-sm font-bold border-2 transition-all',
                        tipPercent === pct
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'bg-surface-50 border-surface-200 text-surface-700 hover:border-brand-300'
                      )}
                    >
                      <Percent className="w-3 h-3 inline mr-0.5" />{pct}
                      {tipPercent === pct && <span className="ml-1 text-white/80">= {formatCurrency(tipAmount)}</span>}
                    </button>
                  ))}
                  <input
                    type="number"
                    className="input py-2 text-sm w-28 text-right font-bold"
                    placeholder="Custom"
                    value={customTip}
                    onChange={e => { setCustomTip(e.target.value); setTipPercent(null); }}
                  />
                </div>
              </div>

              {/* Split Bill */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-surface-900 flex items-center gap-2">
                    <SplitSquareHorizontal className="w-4 h-4 text-brand-500" /> Split Bill
                  </h4>
                  <div className="flex gap-2">
                    {(['none', 'even', 'items'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setSplitMode(mode);
                          if (mode === 'items') initGuests(guestCount);
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                          splitMode === mode
                            ? 'bg-brand-500 text-white'
                            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                        )}
                      >
                        {mode === 'none' ? 'Off' : mode === 'even' ? 'Split Evenly' : 'By Item'}
                      </button>
                    ))}
                  </div>
                </div>

                {splitMode === 'even' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-surface-400" />
                      <span className="text-sm text-surface-600">Guests</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => setGuestCount(Math.max(2, guestCount - 1))}
                          className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center hover:bg-surface-200 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-extrabold text-lg w-8 text-center">{guestCount}</span>
                        <button
                          onClick={() => setGuestCount(guestCount + 1)}
                          className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-brand-50 rounded-2xl p-4 text-center border border-brand-100">
                      <p className="text-3xl font-extrabold text-brand-600">{formatCurrency(grandTotal / guestCount)}</p>
                      <p className="text-sm text-brand-500 mt-1">per person</p>
                    </div>
                  </div>
                )}

                {splitMode === 'items' && (
                  <div className="space-y-3">
                    <p className="text-xs text-surface-500">Tap items above to assign them to each guest. Unassigned items appear as shared.</p>
                    <div className="flex gap-2 flex-wrap mb-2">
                      {guests.map((g, gi) => (
                        <button
                          key={g.id}
                          onClick={() => setActiveGuest(gi)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                            activeGuest === gi ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600'
                          )}
                        >
                          {g.label} · {formatCurrency(guestTotal(g))}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-surface-400" />
                      <span className="text-sm text-surface-500">Guests:</span>
                      <button onClick={() => { setGuestCount(Math.max(2, guestCount - 1)); initGuests(Math.max(2, guestCount - 1)); }} className="w-7 h-7 rounded-full bg-surface-100 flex items-center justify-center text-sm"><Minus className="w-3 h-3" /></button>
                      <span className="font-bold text-sm">{guestCount}</span>
                      <button onClick={() => { setGuestCount(guestCount + 1); initGuests(guestCount + 1); }} className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="card">
                <h4 className="font-bold text-surface-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand-500" /> Payment Method
                </h4>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {METHOD_CONFIG.map(({ id, label, icon: Icon, color }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold text-sm',
                        paymentMethod === id
                          ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                          : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Cash tendered / change */}
                {paymentMethod === 'cash' && splits.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-surface-600 w-24 flex-shrink-0">Tendered</label>
                      <input
                        type="number"
                        className="input flex-1 text-right font-bold text-lg"
                        placeholder={formatCurrency(grandTotal)}
                        value={amountTendered}
                        onChange={e => setAmountTendered(e.target.value)}
                      />
                    </div>
                    {tendered > 0 && (
                      <div className={cn(
                        'flex items-center justify-between p-4 rounded-2xl border',
                        changeDue >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                      )}>
                        <span className="font-semibold text-sm text-surface-700">Change Due</span>
                        <span className={cn('font-extrabold text-2xl', changeDue >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {formatCurrency(Math.abs(changeDue))}
                        </span>
                      </div>
                    )}
                    {/* Quick cash buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {[Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100].filter((v, i, a) => a.indexOf(v) === i && v > grandTotal).slice(0, 3).map(v => (
                        <button
                          key={v}
                          onClick={() => setAmountTendered(v.toString())}
                          className="px-3 py-1.5 text-sm font-bold bg-surface-100 hover:bg-surface-200 rounded-2xl transition-colors"
                        >
                          {formatCurrency(v)}
                        </button>
                      ))}
                      <button
                        onClick={() => setAmountTendered(grandTotal.toFixed(2))}
                        className="px-3 py-1.5 text-sm font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-2xl transition-colors"
                      >
                        Exact
                      </button>
                    </div>
                  </div>
                )}

                {/* Multi-payment splits */}
                <div className="mt-4 border-t border-surface-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-surface-600">Split Payment</p>
                    {splits.length > 0 && (
                      <button onClick={() => setSplits([])} className="text-xs text-red-500 hover:underline">Clear</button>
                    )}
                  </div>
                  {splits.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-surface-600 capitalize">{s.method}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatCurrency(s.amount)}</span>
                        <button onClick={() => setSplits(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {amountRemaining > 0.01 && (
                    <div className="flex gap-2 mt-2">
                      <select
                        className="input py-2 text-sm flex-shrink-0 w-32"
                        value={partialMethod}
                        onChange={e => setPartialMethod(e.target.value as PayMethod)}
                      >
                        {METHOD_CONFIG.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                      <input
                        type="number"
                        className="input py-2 text-sm flex-1 text-right"
                        placeholder={`Up to ${formatCurrency(amountRemaining)}`}
                        value={partialAmount}
                        onChange={e => setPartialAmount(e.target.value)}
                      />
                      <button onClick={addSplit} className="btn-primary btn-sm px-4">+Add</button>
                    </div>
                  )}
                  {splits.length > 0 && (
                    <div className="mt-3 flex justify-between text-sm font-bold">
                      <span className="text-surface-600">Remaining</span>
                      <span className={amountRemaining < 0.01 ? 'text-emerald-600' : 'text-amber-600'}>
                        {formatCurrency(amountRemaining)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pay button */}
              <button
                onClick={initiatePayment}
                disabled={processing || !canPay}
                className="w-full btn-primary py-4 text-lg font-bold shadow-glow shadow-brand-500/40 relative overflow-hidden group rounded-3xl disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full skew-x-12" />
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing…
                  </span>
                ) : (
                  `Collect ${formatCurrency(grandTotal)}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
