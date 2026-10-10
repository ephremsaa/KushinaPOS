import React, { useState } from 'react';
import {
  Printer, Download, Copy, Check, X, QrCode, Sparkles,
  Layers, Utensils, Wifi, Smartphone, ChefHat, Eye
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import type { Table } from '../../types';

interface TableStandModalProps {
  table?: Table | null;
  allTables?: Table[];
  restaurantName: string;
  restaurantLogo?: string;
  restaurantSlug: string;
  themeColor?: string;
  onClose: () => void;
}

export function TableStandModal({
  table,
  allTables = [],
  restaurantName,
  restaurantLogo,
  restaurantSlug,
  themeColor = '#2F7D32',
  onClose,
}: TableStandModalProps) {
  const [copied, setCopied] = useState(false);
  const [printAll, setPrintAll] = useState(false);
  const [standStyle, setStandStyle] = useState<'acrylic' | 'tent' | 'minimal'>('acrylic');

  const selectedTables = printAll && allTables.length > 0 
    ? allTables 
    : table 
    ? [table] 
    : allTables.slice(0, 1);

  const getTableUrl = (t: Table) => {
    return `${window.location.origin}/r/${restaurantSlug}?table=${encodeURIComponent(t.label)}`;
  };

  const getQrImage = (url: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}&margin=1`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Container */}
      <div className="bg-surface-50 rounded-[2rem] w-full max-w-4xl shadow-2xl border border-default/80 flex flex-col max-h-[95vh] overflow-hidden my-auto">
        
        {/* Modal Top Bar (Hidden during print) */}
        <div className="p-5 sm:p-6 bg-surface border-b border-default/80 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: themeColor }}
            >
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-primary leading-tight">
                Table QR Stand Generator
              </h3>
              <p className="text-xs text-muted">
                {table ? `Table ${table.label} Stand Card` : 'Printable Table QR Stand Cards'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {allTables.length > 1 && (
              <button
                type="button"
                onClick={() => setPrintAll(!printAll)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5',
                  printAll
                    ? 'bg-brand-500 text-white border-brand-600 shadow-sm'
                    : 'bg-surface-100 hover:bg-surface-200 text-surface-700 border-default'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                {printAll ? `Print All (${allTables.length})` : 'Single Table'}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2.5 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Style Selector Toolbar (Hidden during print) */}
        <div className="px-6 py-3 bg-surface-100/70 border-b border-default/60 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">Stand Card Style:</span>
            <div className="flex bg-surface-200/80 p-1 rounded-xl gap-1">
              <button
                onClick={() => setStandStyle('acrylic')}
                className={cn(
                  'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                  standStyle === 'acrylic' ? 'bg-surface text-primary shadow-xs' : 'text-surface-600 hover:text-primary'
                )}
              >
                Acrylic Frame
              </button>
              <button
                onClick={() => setStandStyle('tent')}
                className={cn(
                  'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                  standStyle === 'tent' ? 'bg-surface text-primary shadow-xs' : 'text-surface-600 hover:text-primary'
                )}
              >
                Tent Card
              </button>
              <button
                onClick={() => setStandStyle('minimal')}
                className={cn(
                  'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                  standStyle === 'minimal' ? 'bg-surface text-primary shadow-xs' : 'text-surface-600 hover:text-primary'
                )}
              >
                Minimal Flyer
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {table && (
              <button
                onClick={() => handleCopy(getTableUrl(table))}
                className="btn-secondary btn-sm text-xs gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy URL'}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="btn-primary btn-sm text-xs gap-1.5 shadow-sm"
              style={{ backgroundColor: themeColor, borderColor: themeColor }}
            >
              <Printer className="w-3.5 h-3.5" />
              {printAll ? `Print ${allTables.length} Stands` : 'Print Stand Card'}
            </button>
          </div>
        </div>

        {/* Stand Preview Container (Prints clearly) */}
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center print:p-0 print:overflow-visible">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-2xl print:max-w-none print:grid-cols-1 print:gap-12">
            {selectedTables.map((t) => {
              const url = getTableUrl(t);
              const qrSrc = getQrImage(url);

              return (
                <div
                  key={t.id}
                  className={cn(
                    'bg-surface mx-auto transition-all shadow-xl rounded-[2.5rem] border-2 overflow-hidden flex flex-col justify-between text-center relative print:shadow-none print:rounded-2xl print:break-inside-avoid print:page-break-after-always',
                    standStyle === 'acrylic' && 'p-7 border-default/80 w-80 min-h-[460px]',
                    standStyle === 'tent' && 'p-8 border-dashed border-surface-300 w-84 min-h-[480px]',
                    standStyle === 'minimal' && 'p-6 border-default w-72 min-h-[420px]'
                  )}
                >
                  {/* Decorative Brand Header Accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-3"
                    style={{ backgroundColor: themeColor }}
                  />

                  {/* Stand Top: Restaurant Branding */}
                  <div className="pt-2 space-y-2">
                    {restaurantLogo ? (
                      <img
                        src={restaurantLogo}
                        alt={restaurantName}
                        className="w-14 h-14 mx-auto object-contain rounded-2xl p-1 bg-surface-50 border border-default/70 shadow-xs"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-white shadow-xs font-bold text-lg"
                        style={{ backgroundColor: themeColor }}
                      >
                        {restaurantName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <h4 className="font-display font-black text-xl text-primary tracking-tight leading-none">
                      {restaurantName}
                    </h4>
                  </div>

                  {/* Table Badge */}
                  <div className="my-3">
                    <div
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl border font-mono font-black text-lg tracking-wide shadow-xs"
                      style={{
                        backgroundColor: `${themeColor}15`,
                        borderColor: `${themeColor}40`,
                        color: themeColor,
                      }}
                    >
                      <span>TABLE {t.label.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* QR Code with frame */}
                  <div className="my-2">
                    <div className="p-3.5 bg-surface-50 rounded-3xl border-2 border-default/90 inline-block shadow-inner">
                      <img
                        src={qrSrc}
                        alt={`QR Code for Table ${t.label}`}
                        className="w-44 h-44 mx-auto rounded-xl object-contain bg-surface p-1"
                      />
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-1.5 pb-2">
                    <p className="font-extrabold text-sm text-primary flex items-center justify-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-brand-500" />
                      Scan to View Menu & Order
                    </p>
                    <p className="text-[11px] text-surface-400 font-medium">
                      Point phone camera to browse, order & call waiter
                    </p>
                  </div>

                  {/* Footer Features */}
                  <div className="pt-3 border-t border-surface-100 flex items-center justify-center gap-4 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-brand-500" /> Free Wi-Fi
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <ChefHat className="w-3 h-3 text-brand-500" /> Fast Service
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Print Note (Hidden during print) */}
        <div className="p-4 bg-surface border-t border-default/80 text-center text-xs text-surface-400 print:hidden flex items-center justify-between px-6">
          <span>💡 Tip: Print on heavy cardstock or A6 acrylic inserts for best table presentation.</span>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          #root {
            display: none;
          }
          .fixed.inset-0 {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            visibility: visible !important;
          }
          .fixed.inset-0 * {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
