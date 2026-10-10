import React, { createContext, useContext, useCallback, useState, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id:        string;
  type:      ToastType;
  title:     string;
  message?:  string;
  duration?: number; // ms, default 4000
}

interface ToastContextValue {
  toast:   (item: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-600 border-emerald-500',
  error:   'bg-red-600 border-red-500',
  warning: 'bg-amber-500 border-amber-400',
  info:    'bg-surface-800 border-surface-700',
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastEl({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const Icon = ICONS[item.type];

  // Auto-dismiss
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl text-white w-80 max-w-[calc(100vw-2rem)]',
        'animate-slide-up backdrop-blur-xl',
        STYLES[item.type]
      )}
      role="alert"
      aria-live="assertive"
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-snug">{item.title}</p>
        {item.message && (
          <p className="text-xs opacity-90 mt-0.5 leading-snug">{item.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        className="p-1 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [...prev.slice(-4), { ...item, id }]); // max 5 visible
  }, []);

  const success = useCallback(
    (title: string, message?: string) => toast({ type: 'success', title, message }),
    [toast]
  );
  const error = useCallback(
    (title: string, message?: string) => toast({ type: 'error', title, message }),
    [toast]
  );
  const warning = useCallback(
    (title: string, message?: string) => toast({ type: 'warning', title, message }),
    [toast]
  );
  const info = useCallback(
    (title: string, message?: string) => toast({ type: 'info', title, message }),
    [toast]
  );

  React.useEffect(() => {
    globalToast.toast = toast;
    globalToast.success = success;
    globalToast.error = error;
    globalToast.warning = warning;
    globalToast.info = info;
  }, [toast, success, error, warning, info]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      {/* Toast stack — bottom-right, avoids SyncStatusBanner (bottom-6 right-6) */}
      <div
        className="fixed bottom-20 right-4 sm:right-6 z-[200] flex flex-col gap-2.5 items-end pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastEl item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export const globalToast = {
  toast: (item: Omit<ToastItem, 'id'>) => console.log('toast provider not mounted', item),
  success: (title: string, message?: string) => console.log('toast provider not mounted', title),
  error: (title: string, message?: string) => console.error('toast provider not mounted', title),
  warning: (title: string, message?: string) => console.warn('toast provider not mounted', title),
  info: (title: string, message?: string) => console.info('toast provider not mounted', title),
};
