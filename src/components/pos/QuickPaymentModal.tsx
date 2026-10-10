import React, { useState, useMemo } from 'react';
import {
  Banknote, Smartphone, Building2, CreditCard, X, Check,
  Sparkles, CheckCircle, ArrowRight, RefreshCw, QrCode, ShieldCheck,
  Calculator, AlertCircle, Split
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { ordersApi, tablesApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { SplitBillModal } from './SplitBillModal';
import type { Order } from '../../types';

export type EthiopianPaymentMethod = 'cash' | 'telebirr' | 'cbe_birr' | 'card';

export interface QuickPaymentModalProps {
  order: Order;
  restaurantName: string;
  restaurantPhone?: string;
  onSuccess: (paidOrder: Order, details: { method: string; tendered: number; change: number; tip: number }) => void;
  onClose: () => void;
}

const ETB_QUICK_BILLS = [50, 100, 200, 500, 1000];

export function QuickPaymentModal({
  order,
  restaurantName,
  restaurantPhone = '+251 91 123 4567',
  onSuccess,
  onClose,
}: QuickPaymentModalProps) {
  const [method, setMethod] = useState<EthiopianPaymentMethod>('cash');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showSplit, setShowSplit] = useState<boolean>(false);

  const grandTotal = useMemo(() => {
    return Number(order.total || 0) + Number(tipAmount || 0);
  }, [order.total, tipAmount]);

  const tenderedNumber = useMemo(() => {
    if (!tenderedInput) return 0;
    const num = parseFloat(tenderedInput);
    return isNaN(num) ? 0 : num;
  }, [tenderedInput]);

  const changeDue = useMemo(() => {
    if (method !== 'cash') return 0;
    return Math.max(0, tenderedNumber - grandTotal);
  }, [method, tenderedNumber, grandTotal]);

  const isExactOrMore = useMemo(() => {
    if (method !== 'cash') return true;
    return tenderedNumber >= grandTotal;
  }, [method, tenderedNumber, grandTotal]);

  // Quick ETB Bills click handler
  const handleAddBill = (bill: number) => {
    const current = tenderedNumber;
    setTenderedInput(String(current + bill));
  };

  const handleSetExact = () => {
    setTenderedInput(String(grandTotal));
  };

  const handleNumpadPress = (digit: string) => {
    if (digit === 'C') {
      setTenderedInput('');
    } else if (digit === 'DEL') {
      setTenderedInput(p => p.slice(0, -1));
    } else if (digit === '.') {
      if (!tenderedInput.includes('.')) {
        setTenderedInput(p => (p ? p + '.' : '0.'));
      }
    } else {
      setTenderedInput(p => p + digit);
    }
  };

  // Submit payment
  const handleProcessPayment = async () => {
    if (method === 'cash' && tenderedNumber < grandTotal) {
      setError(`Amount tendered must be at least ${formatCurrency(grandTotal)}`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Pay the order
      const paidOrder = await ordersApi.pay(order.id, {
        payment_method: method,
        amount_tendered: method === 'cash' ? tenderedNumber : grandTotal,
        change_amount: changeDue,
        tip_amount: tipAmount,
        reference_code: referenceCode || null,
      }) as Order;

      // 2. Free up table if dine_in
      if (order.table_id) {
        try {
          await tablesApi.update(order.table_id, { status: 'available' });
        } catch (e) {
          console.warn('Note updating table status:', e);
        }
      }

      onSuccess(paidOrder || { ...order, status: 'served' }, {
        method,
        tendered: method === 'cash' ? tenderedNumber : grandTotal,
        change: changeDue,
        tip: tipAmount,
      });
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err?.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortOrderId = (order.id || '').split('-')[0].toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-[2.5rem] w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh] border border-default/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-sm">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-lg text-primary leading-tight">Fast Settle & Checkout</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 text-brand-700">#{shortOrderId}</span>
              </div>
              <p className="text-xs text-muted">
                {order.table_label ? `Table ${order.table_label} · ` : ''}
                {order.order_type?.replace('_', ' ').toUpperCase() || 'DINE IN'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-200/60 rounded-xl text-surface-400 hover:text-surface-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Order Summary Ribbon */}
          <div className="flex items-center justify-between p-4 rounded-3xl bg-gradient-to-br from-surface-900 via-surface-950 to-black text-white shadow-md">
            <div>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Total Amount Due</p>
              <p className="font-display font-black text-3xl text-brand-400 tracking-tight mt-0.5 font-mono">
                {formatCurrency(grandTotal)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSplit(true)}
                className="px-3 py-2 rounded-2xl bg-surface/10 hover:bg-surface/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Split className="w-4 h-4 text-gold-400" />
                <span>Split Bill</span>
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-surface-400">Items: {(order.order_items || []).reduce((s, i) => s + i.quantity, 0)}</p>
                {Number(order.tax_amount || 0) > 0 && (
                  <p className="text-[11px] text-surface-400">Incl. Tax: {formatCurrency(Number(order.tax_amount))}</p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div>
            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider mb-2.5 block">
              Select Ethiopian Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Cash */}
              <button
                type="button"
                onClick={() => { setMethod('cash'); setError(''); }}
                className={cn(
                  'p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer text-center relative overflow-hidden',
                  method === 'cash'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-500/20 ring-2 ring-emerald-500/20'
                    : 'border-default bg-surface hover:border-surface-300 text-surface-700'
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', method === 'cash' ? 'bg-emerald-500 text-white' : 'bg-surface-100 text-surface-600')}>
                  <Banknote className="w-5 h-5" />
                </div>
                <span className="font-black text-xs">Cash (ETB)</span>
                <span className="text-[10px] text-surface-400">Quick change</span>
              </button>

              {/* Telebirr */}
              <button
                type="button"
                onClick={() => { setMethod('telebirr'); setError(''); }}
                className={cn(
                  'p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer text-center relative overflow-hidden',
                  method === 'telebirr'
                    ? 'border-violet-500 bg-violet-50 text-violet-900 shadow-sm shadow-violet-500/20 ring-2 ring-violet-500/20'
                    : 'border-default bg-surface hover:border-surface-300 text-surface-700'
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', method === 'telebirr' ? 'bg-violet-500 text-white' : 'bg-surface-100 text-surface-600')}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="font-black text-xs">Telebirr</span>
                <span className="text-[10px] text-surface-400">QR / SuperApp</span>
              </button>

              {/* CBE Birr */}
              <button
                type="button"
                onClick={() => { setMethod('cbe_birr'); setError(''); }}
                className={cn(
                  'p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer text-center relative overflow-hidden',
                  method === 'cbe_birr'
                    ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm shadow-purple-500/20 ring-2 ring-purple-500/20'
                    : 'border-default bg-surface hover:border-surface-300 text-surface-700'
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', method === 'cbe_birr' ? 'bg-purple-600 text-white' : 'bg-surface-100 text-surface-600')}>
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="font-black text-xs">CBE Birr</span>
                <span className="text-[10px] text-surface-400">CBE Mobile / QR</span>
              </button>

              {/* Card / POS */}
              <button
                type="button"
                onClick={() => { setMethod('card'); setError(''); }}
                className={cn(
                  'p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer text-center relative overflow-hidden',
                  method === 'card'
                    ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm shadow-blue-500/20 ring-2 ring-blue-500/20'
                    : 'border-default bg-surface hover:border-surface-300 text-surface-700'
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', method === 'card' ? 'bg-blue-500 text-white' : 'bg-surface-100 text-surface-600')}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="font-black text-xs">Debit / Card</span>
                <span className="text-[10px] text-surface-400">POS Machine</span>
              </button>
            </div>
          </div>

          {/* Dynamic Payment Method Panels */}
          {method === 'cash' && (
            <div className="space-y-4 animate-fade-in">
              {/* Quick ETB Denomination Chips */}
              <div>
                <p className="text-xs font-bold text-surface-600 mb-2">Quick Cash ETB Bills</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSetExact}
                    className="px-3.5 py-2 rounded-xl bg-surface-900 text-white font-black text-xs hover:bg-black transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    Exact ({formatCurrency(grandTotal)})
                  </button>
                  {ETB_QUICK_BILLS.map(bill => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleAddBill(bill)}
                      className="px-3.5 py-2 rounded-xl bg-surface-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-default font-bold text-xs text-surface-800 transition-all cursor-pointer active:scale-95"
                    >
                      +{bill} ETB
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTenderedInput('')}
                    className="px-3 py-2 rounded-xl text-surface-400 hover:text-red-500 font-bold text-xs transition-colors cursor-pointer ml-auto"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Tendered Input & Live Change Readout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-surface-50 border border-default">
                  <label className="text-xs font-bold text-muted block mb-1">Amount Tendered</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-surface-400 font-mono">ETB</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={tenderedInput}
                      onChange={e => setTenderedInput(e.target.value)}
                      className="w-full text-2xl font-black text-primary font-mono bg-transparent outline-none"
                    />
                  </div>
                </div>

                <div className={cn(
                  'p-4 rounded-2xl border transition-all flex flex-col justify-center',
                  changeDue > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-surface-50 border-default text-surface-700'
                )}>
                  <label className="text-xs font-bold block mb-1 opacity-75">Change Due</label>
                  <p className="text-2xl font-black font-mono tracking-tight">
                    {formatCurrency(changeDue)}
                  </p>
                </div>
              </div>

              {/* Tactile Mini Numpad */}
              <div className="grid grid-cols-4 gap-1.5 p-2 bg-surface-100/60 rounded-2xl">
                {['7','8','9','C','4','5','6','DEL','1','2','3','00','0','.'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleNumpadPress(k)}
                    className={cn(
                      'py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer active:scale-95 shadow-xs',
                      k === 'C'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 col-span-1'
                        : k === 'DEL'
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 col-span-1'
                        : 'bg-surface text-surface-800 hover:bg-surface-50'
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Telebirr / CBE Birr QR Code Panel */}
          {(method === 'telebirr' || method === 'cbe_birr') && (
            <div className="p-5 rounded-3xl bg-surface-50 border border-default space-y-4 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-24 h-24 rounded-2xl flex items-center justify-center p-2 shadow-inner border',
                  method === 'telebirr' ? 'bg-violet-600 text-white border-violet-700' : 'bg-purple-700 text-white border-purple-800'
                )}>
                  <QrCode className="w-16 h-16" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="font-black text-sm text-primary capitalize">
                      {method === 'telebirr' ? 'Telebirr SuperApp QR' : 'CBE Birr Digital Transfer'}
                    </p>
                  </div>
                  <p className="text-xs text-muted font-mono">
                    Merchant: <strong className="text-primary">{restaurantPhone}</strong>
                  </p>
                  <p className="text-xs text-muted font-mono">
                    Ref ID: <strong className="text-primary">KUS-{shortOrderId}</strong>
                  </p>
                  <p className="text-xs font-bold text-brand-600">
                    Amount: {formatCurrency(grandTotal)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-surface-600 block mb-1">
                  Customer Transaction / Approval Ref # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TLB89472910 or CBE991203"
                  value={referenceCode}
                  onChange={e => setReferenceCode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-default bg-surface font-mono text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                />
              </div>
            </div>
          )}

          {/* Card / POS Reference Panel */}
          {method === 'card' && (
            <div className="p-5 rounded-3xl bg-surface-50 border border-default space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-bold text-sm text-primary">Swipe or Tap on Bank POS Terminal</p>
                  <p className="text-xs text-muted">Insert card authorization code below once approved</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="POS Auth / Approval Code (e.g. AUTH-4821)"
                value={referenceCode}
                onChange={e => setReferenceCode(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-default bg-surface font-mono text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-surface-100 flex gap-3 bg-surface-50/50">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleProcessPayment}
            loading={isSubmitting}
            disabled={!isExactOrMore}
            icon={<CheckCircle className="w-4 h-4" />}
            className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
          >
            Confirm & Settle ({formatCurrency(grandTotal)})
          </Button>
        </div>
      </div>

      {showSplit && (
        <SplitBillModal
          order={order}
          restaurantName={restaurantName}
          restaurantPhone={restaurantPhone}
          onComplete={(paidOrder) => {
            setShowSplit(false);
            onSuccess(paidOrder, {
              method: 'split',
              tendered: grandTotal,
              change: 0,
              tip: 0,
            });
          }}
          onClose={() => setShowSplit(false)}
        />
      )}
    </div>
  );
}
