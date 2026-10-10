import React, { useState } from 'react';
import {
  Printer, X, CheckCircle2, AlertTriangle,
  Banknote, CreditCard, Smartphone, Building2,
  Receipt, Calculator, ShieldCheck, UserCheck
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';

export interface ZReportData {
  reportType?: 'Z_REPORT' | 'X_REPORT';
  sessionId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  startingCash: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
  notes?: string;
  managerSignoff?: string;
  shiftSummary: {
    order_count: number;
    total_cash_sales: number;
    total_card_sales: number;
    total_telebirr_sales: number;
    total_cbe_sales?: number;
    total_tax?: number;
    total_discount?: number;
    total_tips?: number;
    total_sales: number;
  };
}

interface ThermalZReportProps {
  data: ZReportData;
  restaurantName: string;
  restaurantLogo?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  onClose: () => void;
}

export function ThermalZReport({
  data,
  restaurantName,
  restaurantLogo,
  taxId,
  address,
  phone,
  onClose,
}: ThermalZReportProps) {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');

  const handlePrint = () => {
    window.print();
  };

  const isXReport = data.reportType === 'X_REPORT';
  const summary = data.shiftSummary || {
    order_count: 0,
    total_cash_sales: 0,
    total_card_sales: 0,
    total_telebirr_sales: 0,
    total_cbe_sales: 0,
    total_tax: 0,
    total_discount: 0,
    total_tips: 0,
    total_sales: 0,
  };

  const cbeSales = summary.total_cbe_sales || 0;
  const taxCollected = summary.total_tax || 0;
  const tipsCollected = summary.total_tips || 0;
  const discountsGiven = summary.total_discount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-surface-50 rounded-[2rem] w-full max-w-md shadow-2xl border border-default/80 flex flex-col max-h-[95vh] overflow-hidden my-auto">
        
        {/* Top Control Bar (Hidden during print) */}
        <div className="p-4 sm:p-5 bg-surface border-b border-default/80 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-primary leading-tight">
                {isXReport ? 'Mid-Shift X-Report' : 'End-of-Day Z-Report'}
              </h3>
              <p className="text-[11px] text-surface-400 font-mono">
                #{data.sessionId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-surface-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all',
                  paperWidth === '80mm' ? 'bg-surface shadow-xs text-primary' : 'text-muted'
                )}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all',
                  paperWidth === '58mm' ? 'bg-surface shadow-xs text-primary' : 'text-muted'
                )}
              >
                58mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Thermal Z-Report Body ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center print:p-0 print:overflow-visible">
          <div
            id="thermal-z-report-area"
            className={cn(
              'bg-surface text-primary font-mono text-xs shadow-md p-6 rounded-2xl border border-default/80 transition-all print:shadow-none print:border-none print:p-2 print:m-0',
              paperWidth === '80mm' ? 'w-[320px]' : 'w-[240px] text-[11px] p-4'
            )}
          >
            {/* Header / Logo */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-surface-300">
              {restaurantLogo && (
                <img
                  src={restaurantLogo}
                  alt={restaurantName}
                  className="w-12 h-12 mx-auto object-contain rounded-xl mb-1 filter grayscale"
                />
              )}
              <h2 className="font-bold text-base uppercase tracking-tight text-black">
                {restaurantName}
              </h2>
              {address && <p className="text-[10px] text-surface-600 leading-tight">{address}</p>}
              {phone && <p className="text-[10px] text-surface-600">Tel: {phone}</p>}
              {taxId && <p className="text-[10px] text-surface-600 font-semibold">TIN: {taxId}</p>}
              
              <div className="pt-2">
                <span className="inline-block px-3 py-1 rounded-md bg-black text-white font-black text-xs tracking-widest uppercase">
                  {isXReport ? '*** X-REPORT (AUDIT) ***' : '*** Z-REPORT (DAILY) ***'}
                </span>
              </div>
            </div>

            {/* Shift Metadata */}
            <div className="py-3 border-b border-dashed border-default space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">Shift Session:</span>
                <span className="font-bold">#{data.sessionId.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cashier:</span>
                <span className="font-bold">{data.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Opened:</span>
                <span>{new Date(data.openedAt).toLocaleString()}</span>
              </div>
              {data.closedAt && (
                <div className="flex justify-between">
                  <span className="text-muted">Closed:</span>
                  <span>{new Date(data.closedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Sales Breakdown by Payment Channel */}
            <div className="py-3 border-b-2 border-dashed border-surface-300 space-y-1.5">
              <p className="font-bold uppercase tracking-wider text-[11px] text-black">
                1. SALES BY CHANNEL
              </p>
              <div className="flex justify-between text-surface-700">
                <span>💵 Cash (ETB)</span>
                <span className="font-bold">{formatCurrency(summary.total_cash_sales)}</span>
              </div>
              <div className="flex justify-between text-surface-700">
                <span>📱 Telebirr</span>
                <span className="font-bold">{formatCurrency(summary.total_telebirr_sales)}</span>
              </div>
              {cbeSales > 0 && (
                <div className="flex justify-between text-surface-700">
                  <span>🏦 CBE Birr</span>
                  <span className="font-bold">{formatCurrency(cbeSales)}</span>
                </div>
              )}
              <div className="flex justify-between text-surface-700">
                <span>💳 Card / POS</span>
                <span className="font-bold">{formatCurrency(summary.total_card_sales)}</span>
              </div>
              
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-dashed border-default text-black">
                <span>GROSS SALES</span>
                <span>{formatCurrency(summary.total_sales)}</span>
              </div>
            </div>

            {/* Financial & Tax Summary */}
            <div className="py-3 border-b-2 border-dashed border-surface-300 space-y-1.5">
              <p className="font-bold uppercase tracking-wider text-[11px] text-black">
                2. FINANCIAL BREAKDOWN
              </p>
              <div className="flex justify-between text-surface-600">
                <span>Total Orders Settled</span>
                <span className="font-bold text-black">{summary.order_count}</span>
              </div>
              {discountsGiven > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Total Discounts</span>
                  <span className="font-bold text-black">-{formatCurrency(discountsGiven)}</span>
                </div>
              )}
              {taxCollected > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Total VAT / Tax</span>
                  <span className="font-bold text-black">{formatCurrency(taxCollected)}</span>
                </div>
              )}
              {tipsCollected > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Total Tips</span>
                  <span className="font-bold text-black">{formatCurrency(tipsCollected)}</span>
                </div>
              )}
            </div>

            {/* Cash Drawer Reconciliation */}
            <div className="py-3 border-b-2 border-dashed border-surface-300 space-y-1.5">
              <p className="font-bold uppercase tracking-wider text-[11px] text-black">
                3. DRAWER RECONCILIATION
              </p>
              <div className="flex justify-between text-surface-600">
                <span>Opening Float</span>
                <span>{formatCurrency(data.startingCash)}</span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>+ Cash Sales</span>
                <span>+{formatCurrency(summary.total_cash_sales)}</span>
              </div>
              <div className="flex justify-between font-bold text-surface-800 pt-1 border-t border-surface-100">
                <span>Expected in Drawer</span>
                <span>{formatCurrency(data.expectedCash)}</span>
              </div>
              <div className="flex justify-between font-bold text-black">
                <span>Actual Cash Counted</span>
                <span>{formatCurrency(data.actualCash)}</span>
              </div>
              
              <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-dashed border-surface-300">
                <span>DISCREPANCY:</span>
                <span className={cn(
                  Math.abs(data.discrepancy) <= 0.01
                    ? 'text-black'
                    : data.discrepancy > 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                )}>
                  {data.discrepancy > 0 ? '+' : ''}{formatCurrency(data.discrepancy)}
                </span>
              </div>
              
              {data.notes && (
                <p className="text-[10px] text-muted pt-1 italic">
                  Note: {data.notes}
                </p>
              )}
            </div>

            {/* Sign-off section */}
            <div className="pt-4 pb-2 space-y-5">
              <div className="flex justify-between text-[10px] text-muted">
                <div className="text-center w-28">
                  <div className="border-b border-black h-8 mb-1" />
                  <span>Cashier Signature</span>
                </div>
                <div className="text-center w-28">
                  <div className="border-b border-black h-8 mb-1" />
                  <span>Manager Signature</span>
                </div>
              </div>
              
              <p className="text-center text-[9px] text-surface-400 border-t border-dashed border-default pt-2">
                KushinaPOS Electronic Journal · Verified
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden during print) */}
        <div className="p-4 bg-surface border-t border-default/80 flex items-center justify-between gap-3 px-6 print:hidden">
          <button onClick={onClose} className="btn-secondary btn-sm flex-1">
            Done
          </button>
          <button
            onClick={handlePrint}
            className="btn-primary btn-sm flex-1 gap-1.5 shadow-md bg-surface-900 hover:bg-black text-white"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Print {isXReport ? 'X-Report' : 'Z-Report'}
          </button>
        </div>
      </div>

      {/* Print stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          #thermal-z-report-area, #thermal-z-report-area * {
            visibility: visible;
          }
          #thermal-z-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
