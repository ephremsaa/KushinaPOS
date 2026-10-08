import React, { useState, useMemo } from 'react';
import {
  Users, Split, Utensils, Check, Banknote, Smartphone, Building2,
  CreditCard, Printer, Sparkles, X, ChevronRight, Calculator, AlertCircle,
  Receipt, ShieldCheck
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { ordersApi, tablesApi } from '../../lib/api';
import { Button, Badge, Modal } from '../ui';
import { ThermalReceipt } from './ThermalReceipt';
import { type EthiopianPaymentMethod } from './QuickPaymentModal';
import type { Order, OrderItem } from '../../types';

export interface SplitShare {
  id: string;
  label: string;
  amount: number;
  itemIds: string[];
  isPaid: boolean;
  paymentMethod?: EthiopianPaymentMethod;
  tendered?: number;
  change?: number;
  paidAt?: string;
  referenceCode?: string;
}

export interface SplitBillModalProps {
  order: Order;
  restaurantName: string;
  restaurantPhone?: string;
  onComplete: (updatedOrder: Order) => void;
  onClose: () => void;
}

export function SplitBillModal({
  order,
  restaurantName,
  restaurantPhone = '+251 91 123 4567',
  onComplete,
  onClose,
}: SplitBillModalProps) {
  const [splitMode, setSplitMode] = useState<'equal' | 'itemized'>('equal');
  const [splitCount, setSplitCount] = useState<number>(2);
  const [activeShareIdx, setActiveShareIdx] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<EthiopianPaymentMethod>('cash');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [refCodeInput, setRefCodeInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [printReceiptData, setPrintReceiptData] = useState<{ order: Order; shareLabel: string; method: string } | null>(null);

  const orderItems: OrderItem[] = useMemo(() => {
    return (order as any).order_items || (order as any).items || [];
  }, [order]);

  const grandTotal = Number(order.total || 0);

  // ── Equal Split Shares ───────────────────────────────────────────────────────
  const [equalShares, setEqualShares] = useState<SplitShare[]>(() => {
    const shareAmt = grandTotal / 2;
    return [
      { id: '1', label: 'Diner 1', amount: shareAmt, itemIds: [], isPaid: false },
      { id: '2', label: 'Diner 2', amount: shareAmt, itemIds: [], isPaid: false },
    ];
  });

  // Recompute equal shares when splitCount changes
  const handleSplitCountChange = (count: number) => {
    setSplitCount(count);
    const shareAmt = Math.round((grandTotal / count) * 100) / 100;
    const newShares: SplitShare[] = Array.from({ length: count }).map((_, i) => ({
      id: String(i + 1),
      label: `Diner ${i + 1}`,
      amount: i === count - 1 ? grandTotal - shareAmt * (count - 1) : shareAmt,
      itemIds: [],
      isPaid: false,
    }));
    setEqualShares(newShares);
    setActiveShareIdx(0);
  };

  // ── Itemized Split Assignments (item id -> diner index) ──────────────────────
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({});

  const itemizedShares = useMemo<SplitShare[]>(() => {
    const shares: SplitShare[] = Array.from({ length: splitCount }).map((_, i) => ({
      id: String(i + 1),
      label: `Diner ${i + 1}`,
      amount: 0,
      itemIds: [],
      isPaid: false,
    }));

    orderItems.forEach((item: any) => {
      const assignedDinerIdx = itemAssignments[item.id] ?? 0;
      const target = shares[assignedDinerIdx] || shares[0];
      const itemTotal = Number(item.total_price || item.unit_price * item.quantity || 0);
      target.amount += itemTotal;
      target.itemIds.push(item.id);
    });

    return shares;
  }, [orderItems, splitCount, itemAssignments]);

  const currentShares = splitMode === 'equal' ? equalShares : itemizedShares;
  const currentActiveShare = currentShares[activeShareIdx] || currentShares[0];

  const totalPaid = currentShares.filter(s => s.isPaid).reduce((sum, s) => sum + s.amount, 0);
  const remainingBalance = Math.max(0, grandTotal - totalPaid);
  const allPaid = currentShares.every(s => s.isPaid) || remainingBalance <= 0.05;

  // Pay active share
  const handlePayActiveShare = async () => {
    if (!currentActiveShare || currentActiveShare.isPaid) return;
    setIsSubmitting(true);

    try {
      const shareAmount = currentActiveShare.amount;
      const tendered = selectedMethod === 'cash' ? (parseFloat(tenderedInput) || shareAmount) : shareAmount;
      const change = Math.max(0, tendered - shareAmount);

      const updated = equalShares.map((s, idx) => {
        if (idx === activeShareIdx) {
          return {
            ...s,
            isPaid: true,
            paymentMethod: selectedMethod,
            tendered,
            change,
            paidAt: new Date().toISOString(),
            referenceCode: refCodeInput || undefined,
          };
        }
        return s;
      });

      setEqualShares(updated);
      setTenderedInput('');
      setRefCodeInput('');

      // Auto-advance to next unpaid share
      const nextUnpaid = updated.findIndex((s, idx) => !s.isPaid && idx !== activeShareIdx);
      if (nextUnpaid !== -1) {
        setActiveShareIdx(nextUnpaid);
      }

      // If all paid, finalize order
      if (updated.every(s => s.isPaid)) {
        if (order.id && order.table_id) {
          await tablesApi.update(order.table_id, { status: 'cleaning' });
        }
        await ordersApi.update(order.id, { status: 'served', payment_status: 'paid' });
        onComplete({ ...order, status: 'served', payment_status: 'paid' });
      }
    } catch (e) {
      console.error('Failed to settle split share:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-surface-200 overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center shadow-xs">
                <Split className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-surface-900 leading-tight">
                  Split Bill & Settle
                </h3>
                <p className="text-xs text-surface-500">
                  {order.table_label ? `Table ${order.table_label} · ` : ''} Total Bill: <span className="font-bold font-mono text-surface-900">{formatCurrency(grandTotal)}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-200 text-surface-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            
            {/* Split Mode Selector & Split Count */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-50 p-3.5 rounded-2xl border border-surface-200">
              <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-surface-200 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center',
                    splitMode === 'equal' ? 'bg-brand-500 text-white shadow-xs' : 'text-surface-600 hover:text-surface-900'
                  )}
                >
                  <Users className="w-3.5 h-3.5" /> Equal Split
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('itemized')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center',
                    splitMode === 'itemized' ? 'bg-brand-500 text-white shadow-xs' : 'text-surface-600 hover:text-surface-900'
                  )}
                >
                  <Utensils className="w-3.5 h-3.5" /> By Items
                </button>
              </div>

              {/* Ways / Diners Slider / Pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-surface-600 mr-1">Diners:</span>
                {[2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSplitCountChange(num)}
                    className={cn(
                      'w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer',
                      splitCount === num
                        ? 'bg-surface-900 text-white shadow-xs'
                        : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-100'
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Shares Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {currentShares.map((share, idx) => (
                <button
                  key={share.id}
                  type="button"
                  onClick={() => setActiveShareIdx(idx)}
                  className={cn(
                    'p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer',
                    activeShareIdx === idx
                      ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs'
                      : 'border-surface-200 bg-white hover:border-surface-300',
                    share.isPaid && 'bg-emerald-50/70 border-emerald-300'
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-xs font-bold text-surface-600">{share.label}</span>
                    {share.isPaid ? (
                      <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-surface-300" />
                    )}
                  </div>
                  <p className="text-base font-black font-mono text-surface-900 leading-tight">
                    {formatCurrency(share.amount)}
                  </p>
                  <span className="text-[10px] font-bold text-surface-400 mt-1 capitalize truncate">
                    {share.isPaid ? `Paid (${share.paymentMethod})` : 'Pending'}
                  </span>
                </button>
              ))}
            </div>

            {/* Itemized Mode Item Assignment Tray */}
            {splitMode === 'itemized' && (
              <div className="bg-surface-50 p-4 rounded-2xl border border-surface-200 space-y-2">
                <p className="text-xs font-bold text-surface-700">Assign Items to Diners:</p>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {orderItems.map((item: any) => {
                    const currentDiner = itemAssignments[item.id] ?? 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-surface-200 text-xs">
                        <span className="font-bold text-surface-800 truncate flex-1">{item.quantity}x {item.menu_item_name || item.name}</span>
                        <span className="font-mono font-bold text-surface-600 mr-3">{formatCurrency(item.total_price || item.unit_price * item.quantity)}</span>
                        <div className="flex gap-1">
                          {Array.from({ length: splitCount }).map((_, dIdx) => (
                            <button
                              key={dIdx}
                              type="button"
                              onClick={() => setItemAssignments(p => ({ ...p, [item.id]: dIdx }))}
                              className={cn(
                                'px-2 py-1 rounded-lg text-[10px] font-bold transition-all',
                                currentDiner === dIdx ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                              )}
                            >
                              D{dIdx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Share Payment Box */}
            <div className="bg-white p-5 rounded-3xl border border-surface-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-100">
                <div>
                  <h4 className="font-display font-bold text-sm text-surface-900">
                    Settle {currentActiveShare.label}
                  </h4>
                  <p className="text-xs text-surface-500">
                    Share amount due: <span className="font-bold font-mono text-brand-700">{formatCurrency(currentActiveShare.amount)}</span>
                  </p>
                </div>
                {currentActiveShare.isPaid ? (
                  <Badge color="brand">Paid</Badge>
                ) : (
                  <Badge color="gold">Awaiting Payment</Badge>
                )}
              </div>

              {!currentActiveShare.isPaid ? (
                <>
                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'telebirr', label: 'Telebirr', icon: Smartphone },
                      { id: 'cbe_birr', label: 'CBE Birr', icon: Building2 },
                      { id: 'card', label: 'Bank Card', icon: CreditCard },
                    ].map(pm => {
                      const Icon = pm.icon;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setSelectedMethod(pm.id as any)}
                          className={cn(
                            'p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer',
                            selectedMethod === pm.id
                              ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs font-extrabold'
                              : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Cash tender / ref code */}
                  {selectedMethod === 'cash' ? (
                    <div>
                      <label className="text-xs font-bold text-surface-600 mb-1 block">Cash Tendered (Optional)</label>
                      <input
                        type="number"
                        className="input text-base font-bold font-mono"
                        placeholder={String(currentActiveShare.amount)}
                        value={tenderedInput}
                        onChange={e => setTenderedInput(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-bold text-surface-600 mb-1 block">Transaction Reference / Receipt #</label>
                      <input
                        type="text"
                        className="input text-xs font-bold font-mono"
                        placeholder="e.g. TXN-948271"
                        value={refCodeInput}
                        onChange={e => setRefCodeInput(e.target.value)}
                      />
                    </div>
                  )}

                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    loading={isSubmitting}
                    icon={<Check className="w-4 h-4" />}
                    onClick={handlePayActiveShare}
                  >
                    Confirm {currentActiveShare.label} ({formatCurrency(currentActiveShare.amount)})
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-brand-500" />
                    Paid via {currentActiveShare.paymentMethod}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Printer className="w-3.5 h-3.5 text-brand-600" />}
                    onClick={() => setPrintReceiptData({
                      order: { ...order, total: currentActiveShare.amount },
                      shareLabel: currentActiveShare.label,
                      method: currentActiveShare.paymentMethod || 'cash'
                    })}
                  >
                    Sub-Receipt
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Footer & Progress Bar */}
          <div className="p-4 border-t border-surface-200 bg-surface-50 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-surface-500">Remaining Balance: </span>
              <span className="font-mono font-bold text-surface-900">{formatCurrency(remainingBalance)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                {allPaid ? 'Done' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Receipt Modal */}
      {printReceiptData && (
        <Modal
          open={true}
          onClose={() => setPrintReceiptData(null)}
          title={`Thermal Receipt — ${printReceiptData.shareLabel}`}
          size="sm"
        >
          <ThermalReceipt
            order={printReceiptData.order}
            restaurantName={restaurantName}
            phone={restaurantPhone}
            paymentMethod={printReceiptData.method}
            amountTendered={printReceiptData.order.total}
            change={0}
            tipAmount={0}
            onClose={() => setPrintReceiptData(null)}
          />
        </Modal>
      )}
    </>
  );
}
