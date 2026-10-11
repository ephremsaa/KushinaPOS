import React from 'react';
import { Printer, X, CheckCircle, Smartphone, Banknote, CreditCard, Sparkles, Building2, Store } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import type { Order } from '../../types';

export interface ThermalReceiptProps {
  order: Order;
  tipAmount?: number;
  paymentMethod: string;
  amountTendered?: number;
  change?: number;
  pointsEarned?: number;
  loyaltyBalance?: number;
  restaurantName: string;
  restaurantLogo?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  showTaxBreakdown?: boolean;
  showLogo?: boolean;
  onClose: () => void;
}

export function ThermalReceipt({
  order,
  tipAmount = 0,
  paymentMethod,
  amountTendered = 0,
  change = 0,
  pointsEarned,
  loyaltyBalance,
  restaurantName,
  restaurantLogo,
  taxId,
  address,
  phone,
  receiptHeader,
  receiptFooter,
  showTaxBreakdown = true,
  showLogo = true,
  onClose,
}: ThermalReceiptProps) {
  const grandTotal = Number(order.total || 0) + Number(tipAmount || 0);
  const orderShortId = (order.id || '').split('-')[0].toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  const getMethodIcon = () => {
    switch (paymentMethod.toLowerCase()) {
      case 'telebirr':
        return <Smartphone className="w-4 h-4 text-violet-600 inline mr-1" />;
      case 'cbe':
      case 'cbe_birr':
        return <Building2 className="w-4 h-4 text-purple-600 inline mr-1" />;
      case 'card':
        return <CreditCard className="w-4 h-4 text-blue-600 inline mr-1" />;
      default:
        return <Banknote className="w-4 h-4 text-emerald-600 inline mr-1" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-surface print:static print:inset-auto">
      {/* Modal Container */}
      <div className="bg-surface rounded-[2.5rem] w-full max-w-sm shadow-2xl flex flex-col max-h-[92vh] border border-default/80 overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none">
        {/* Screen Header (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-surface-100 flex items-center justify-between bg-surface-50/50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100/80 border border-emerald-200/50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-black text-sm text-primary leading-tight">Payment Settled</p>
              <p className="text-[11px] text-muted">Official Thermal Receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-200/60 rounded-xl text-surface-400 hover:text-surface-700 transition-colors cursor-pointer"
            aria-label="Close receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Paper View */}
        <div className="overflow-y-auto flex-1 p-6 font-mono text-xs text-surface-800 space-y-4 print:p-0 print:text-black">
          {/* Top Brand & Header */}
          <div className="text-center space-y-1">
            {showLogo && restaurantLogo ? (
              <div className="w-14 h-14 mx-auto mb-2 rounded-2xl overflow-hidden border border-default p-0.5 bg-surface shadow-xs">
                <img src={restaurantLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : null}

            <h2 className="font-display font-black text-base tracking-tight text-surface-950 uppercase">{restaurantName}</h2>
            {address && <p className="text-[11px] text-muted print:text-black">{address}</p>}
            {phone && <p className="text-[11px] text-muted print:text-black">Tel: {phone}</p>}
            {taxId && <p className="text-[10px] text-surface-400 print:text-black">TIN/VAT: {taxId}</p>}
            {receiptHeader && (
              <p className="text-[11px] italic text-surface-600 mt-1 border-y border-dashed border-default py-1 print:border-black">
                {receiptHeader}
              </p>
            )}
          </div>

          {/* Order Details */}
          <div className="border-t border-dashed border-surface-300 pt-2.5 space-y-0.5 text-[11px] text-surface-600 print:border-black print:text-black">
            <div className="flex justify-between">
              <span>Order #:</span>
              <span className="font-bold text-primary print:text-black">#{orderShortId}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{new Date(order.created_at || Date.now()).toLocaleString()}</span>
            </div>
            {order.order_type && (
              <div className="flex justify-between uppercase">
                <span>Type:</span>
                <span className="font-bold">{order.order_type.replace('_', ' ')}</span>
              </div>
            )}
            {order.table_label && (
              <div className="flex justify-between">
                <span>Table:</span>
                <span className="font-bold">{order.table_label}</span>
              </div>
            )}
            {order.customer_name && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{order.customer_name}</span>
              </div>
            )}
          </div>

          {/* Itemized Lines */}
          <div className="border-t border-b border-dashed border-surface-300 py-2.5 space-y-1.5 print:border-black">
            <div className="flex justify-between font-bold text-primary text-[11px] uppercase pb-1 border-b border-surface-100 print:text-black print:border-black">
              <span>Item (Qty)</span>
              <span>Total</span>
            </div>
            {(order.order_items || []).map((item, idx) => (
              <div key={item.id || idx} className="space-y-0.5">
                <div className="flex justify-between items-start text-primary print:text-black">
                  <span className="font-bold pr-2 flex-1 leading-tight">
                    {item.quantity}x {item.menu_item_name}
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {formatCurrency(Number(item.quantity) * Number(item.unit_price))}
                  </span>
                </div>
                {item.modifier_choices && item.modifier_choices.length > 0 && (
                  <p className="text-[10px] text-muted pl-4 print:text-black">
                    + {item.modifier_choices.map(m => m.option_label).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-[10px] text-amber-700 italic pl-4 print:text-black">
                    "{item.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Calculations */}
          <div className="space-y-1 text-[11px] pt-1">
            <div className="flex justify-between text-surface-600 print:text-black">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(order.subtotal || 0))}</span>
            </div>

            {showTaxBreakdown && Number(order.tax_amount || 0) > 0 && (
              <div className="flex justify-between text-surface-600 print:text-black">
                <span>Tax / VAT</span>
                <span>{formatCurrency(Number(order.tax_amount))}</span>
              </div>
            )}

            {Number(order.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium print:text-black">
                <span>Discount</span>
                <span>-{formatCurrency(Number(order.discount_amount))}</span>
              </div>
            )}

            {tipAmount > 0 && (
              <div className="flex justify-between text-surface-600 print:text-black">
                <span>Tip</span>
                <span>{formatCurrency(tipAmount)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex justify-between items-baseline font-black text-sm text-surface-950 pt-2 border-t-2 border-surface-900 print:text-black print:border-black">
              <span>TOTAL DUE</span>
              <span className="text-base tracking-tight">{formatCurrency(grandTotal)}</span>
            </div>

            {/* Payment Details */}
            <div className="pt-2 border-t border-dashed border-surface-300 space-y-1 text-surface-600 print:border-black print:text-black">
              <div className="flex justify-between items-center">
                <span>Paid via:</span>
                <span className="font-bold text-primary capitalize flex items-center print:text-black">
                  {getMethodIcon()}
                  {paymentMethod.replace('_', ' ')}
                </span>
              </div>
              {amountTendered > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Tendered:</span>
                    <span className="font-bold">{formatCurrency(amountTendered)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold print:text-black">
                    <span>Change:</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Loyalty Points Section */}
            {((pointsEarned !== undefined && pointsEarned > 0) || (loyaltyBalance !== undefined && loyaltyBalance > 0) || (order.loyalty_points_redeemed && order.loyalty_points_redeemed > 0)) && (
              <div className="pt-2 border-t border-dashed border-surface-300 space-y-1 text-surface-700 print:border-black print:text-black">
                <div className="flex justify-between items-center font-bold text-brand-700 print:text-black">
                  <span>★ LOYALTY REWARDS</span>
                  {order.customer_name && <span className="text-[10px] text-surface-500 print:text-black">{order.customer_name}</span>}
                </div>
                {order.loyalty_points_redeemed && order.loyalty_points_redeemed > 0 ? (
                  <div className="flex justify-between text-amber-700 print:text-black">
                    <span>Points Redeemed:</span>
                    <span>-{order.loyalty_points_redeemed} pts ({formatCurrency(order.loyalty_discount || 0)})</span>
                  </div>
                ) : null}
                {pointsEarned !== undefined && pointsEarned > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold print:text-black">
                    <span>Points Earned Today:</span>
                    <span>+{pointsEarned} pts</span>
                  </div>
                )}
                {loyaltyBalance !== undefined && loyaltyBalance > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>New Loyalty Balance:</span>
                    <span>{loyaltyBalance} pts</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer & Barcode/QR note */}
          <div className="text-center pt-3 border-t border-dashed border-surface-300 space-y-2 print:border-black">
            <p className="font-semibold text-[11px] text-surface-700 print:text-black">
              {receiptFooter || 'Thank you for your patronage!'}
            </p>
            <p className="text-[9px] text-surface-400 print:text-black">
              Powered by kushinaPOS · System Verified
            </p>
          </div>
        </div>

        {/* Modal Action Buttons (Hidden on Print) */}
        <div className="p-4 border-t border-surface-100 flex gap-3 bg-surface-50/50 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl border border-default bg-surface hover:bg-surface-100 text-surface-700 font-bold text-sm transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Printer className="w-4 h-4" />
            Print Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
