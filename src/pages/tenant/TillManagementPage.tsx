import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashDrawerApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { ThermalZReport, type ZReportData } from '../../components/pos/ThermalZReport';
import {
  Banknote, AlertTriangle, ShieldAlert,
  Lock, Unlock, Key, CheckCircle, Calculator,
  CreditCard, Smartphone, DollarSign, Receipt,
  Building2, Printer, Sparkles, X, Plus, Minus
} from 'lucide-react';
import { Button, Input, Badge, Card } from '../../components/ui';
import { assetUrl } from '../../lib/assetUrl';

const ETB_DENOMINATIONS = [1000, 500, 200, 100, 50, 10, 5, 1];

// ─── Denomination Counter Modal ───────────────────────────────────────────────
function DenominationCounterModal({
  title,
  onApply,
  onClose,
}: {
  title: string;
  onApply: (total: number) => void;
  onClose: () => void;
}) {
  const [counts, setCounts] = useState<Record<number, number>>({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 10: 0, 5: 0, 1: 0
  });

  const total = ETB_DENOMINATIONS.reduce((sum, denom) => sum + denom * (counts[denom] || 0), 0);

  const updateCount = (denom: number, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [denom]: Math.max(0, (prev[denom] || 0) + delta)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="rounded-[2rem] w-full max-w-md shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <div className="flex items-center justify-between pb-3 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-primary">{title}</h3>
              <p className="text-xs text-muted font-medium">Count Ethiopian Birr (ETB) notes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-100 text-surface-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Denominations Grid */}
        <div className="space-y-2">
          {ETB_DENOMINATIONS.map(denom => (
            <div key={denom} className="flex items-center justify-between p-2.5 bg-surface-50 rounded-2xl border border-default/80">
              <div className="w-24 font-bold text-sm text-primary font-mono">
                {denom} ETB
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateCount(denom, -1)}
                  className="w-8 h-8 rounded-xl bg-surface border border-default text-surface-700 font-bold hover:bg-surface-100 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  className="w-14 text-center font-bold text-sm bg-surface border border-default rounded-xl py-1 outline-none font-mono"
                  value={counts[denom] || 0}
                  onChange={e => setCounts(prev => ({ ...prev, [denom]: Math.max(0, parseInt(e.target.value) || 0) }))}
                />
                <button
                  type="button"
                  onClick={() => updateCount(denom, 1)}
                  className="w-8 h-8 rounded-xl bg-brand-500 text-white font-bold hover:bg-brand-600 cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="w-24 text-right font-mono font-bold text-sm text-surface-700">
                {formatCurrency(denom * (counts[denom] || 0))}
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary */}
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
          <span className="font-bold text-sm text-emerald-900">Total Counted:</span>
          <span className="font-mono font-extrabold text-2xl text-emerald-700">{formatCurrency(total)}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={() => { onApply(total); onClose(); }}>
            Apply ({formatCurrency(total)})
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Till Management Page ────────────────────────────────────────────────
export default function TillManagementPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [startingCash, setStartingCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Modals state
  const [counterModal, setCounterModal] = useState<{ open: boolean; target: 'start' | 'close' }>({ open: false, target: 'start' });
  const [zReportData, setZReportData] = useState<ZReportData | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ['cash-drawer-current'],
    queryFn: async () => {
      const session = await cashDrawerApi.current();
      return session as any;
    },
    refetchInterval: 10_000,
  });

  const openMut = useMutation({
    mutationFn: (amount: number) => cashDrawerApi.open(amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-drawer-current'] });
      setStartingCash('');
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to open till'),
  });

  const closeMut = useMutation({
    mutationFn: (data: { actual_cash: number; manager_pin?: string; notes?: string }) => cashDrawerApi.close(data),
    onSuccess: (closedRes: any) => {
      qc.invalidateQueries({ queryKey: ['cash-drawer-current'] });
      
      const amt = parseFloat(actualCash);
      const discrepancy = amt - Number(session?.expected_cash || 0);

      // Generate Z-Report Modal preview
      setZReportData({
        reportType: 'Z_REPORT',
        sessionId: session?.id || 'SHIFT',
        cashierName: user?.name || 'Cashier',
        openedAt: session?.opened_at || new Date().toISOString(),
        closedAt: new Date().toISOString(),
        startingCash: Number(session?.starting_cash || 0),
        expectedCash: Number(session?.expected_cash || 0),
        actualCash: amt,
        discrepancy,
        notes,
        shiftSummary: closedRes?.shift_summary || summary,
      });

      setActualCash('');
      setManagerPin('');
      setNotes('');
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to close till'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleOpen = () => {
    const amt = parseFloat(startingCash);
    if (isNaN(amt) || amt < 0) return setError('Enter a valid starting amount');
    openMut.mutate(amt);
  };

  const handleClose = () => {
    const amt = parseFloat(actualCash);
    if (isNaN(amt) || amt < 0) return setError('Enter a valid actual cash amount');

    const discrepancy = amt - Number(session.expected_cash);
    if (Math.abs(discrepancy) > 5 && !managerPin) {
      return setError('Manager PIN required for discrepancy over 5 ETB');
    }

    if (summary.unconfirmed_count > 0 && !notes.trim()) {
      return setError(`Cannot close shift with ${summary.unconfirmed_count} unconfirmed payment(s) without a manager note explaining the exception.`);
    }

    if (summary.unconfirmed_count > 0 && !managerPin.trim()) {
      return setError('Manager PIN required to authorize shift close with unconfirmed payments.');
    }

    closeMut.mutate({ actual_cash: amt, manager_pin: managerPin, notes });
  };

  const summary = session?.shift_summary || {
    order_count: 0,
    total_cash_sales: 0,
    total_card_sales: 0,
    total_telebirr_sales: 0,
    total_cbe_sales: 0,
    total_bank_sales: 0,
    unconfirmed_count: 0,
    total_tax: 0,
    total_discount: 0,
    total_tips: 0,
    total_sales: 0,
  };

  const handlePrintXReport = () => {
    if (!session) return;
    setZReportData({
      reportType: 'X_REPORT',
      sessionId: session.id,
      cashierName: user?.name || 'Cashier',
      openedAt: session.opened_at,
      startingCash: Number(session.starting_cash),
      expectedCash: Number(session.expected_cash),
      actualCash: Number(session.expected_cash),
      discrepancy: 0,
      shiftSummary: summary,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="page-header p-6 rounded-3xl border shadow-card flex items-center justify-between" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Banknote className="w-6 h-6 text-brand-500" />
            Cash Drawer & Till Management
          </h1>
          <p className="page-subtitle">Track your physical float, live cash expected, and daily Z-Report reconciliation.</p>
        </div>

        {session && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="w-4 h-4 text-brand-500" />}
            onClick={handlePrintXReport}
          >
            Mid-Shift X-Report
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl flex items-center gap-3 border border-red-200">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {!session ? (
        <div className="card text-center space-y-6 py-12 p-8">
          <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="w-10 h-10 text-surface-400" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-primary">Till is Currently Closed</h2>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
              Enter your starting cash float or use the ETB note counter to open the drawer.
            </p>
          </div>

          <div className="max-w-xs mx-auto space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label text-left mb-0">Starting Cash Float</label>
                <button
                  type="button"
                  onClick={() => setCounterModal({ open: true, target: 'start' })}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" /> Note Counter
                </button>
              </div>
              <input
                type="number"
                className="input text-center text-2xl font-bold font-mono tracking-wider"
                placeholder="0.00"
                value={startingCash}
                onChange={e => { setStartingCash(e.target.value); setError(''); }}
              />
            </div>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon={<Unlock className="w-5 h-5" />}
              loading={openMut.isPending}
              onClick={handleOpen}
            >
              Open Cash Drawer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Session Status Card */}
          <div className="card space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-surface-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <h2 className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest">Till Open & Active</h2>
                </div>
                <p className="text-xs text-muted">Opened at {new Date(session.opened_at).toLocaleTimeString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-400 mb-0.5">Starting Float</p>
                <p className="font-mono font-bold text-primary">{formatCurrency(session.starting_cash)}</p>
              </div>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="bg-gradient-to-br from-brand-50 to-surface-50 p-6 rounded-2xl flex items-center justify-between border border-brand-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-600">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-surface-700">Expected Cash in Drawer</p>
                  <p className="text-xs text-surface-400 mt-0.5">Starting float + Cash sales</p>
                </div>
              </div>
              <p className="text-3xl font-display font-extrabold text-primary font-mono tracking-tight text-brand-600">
                {formatCurrency(session.expected_cash)}
              </p>
            </div>

            {/* Shift Sales Summary by Method */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-400">Shift Sales by Channel</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-50 p-3.5 rounded-2xl border border-surface-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                    <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Cash (ETB)
                  </div>
                  <p className="font-bold font-mono text-primary text-sm">{formatCurrency(summary.total_cash_sales)}</p>
                </div>
                <div className="bg-surface-50 p-3.5 rounded-2xl border border-surface-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-violet-600" /> Telebirr
                  </div>
                  <p className="font-bold font-mono text-primary text-sm">{formatCurrency(summary.total_telebirr_sales)}</p>
                </div>
                <div className="bg-surface-50 p-3.5 rounded-2xl border border-surface-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                    <Building2 className="w-3.5 h-3.5 text-purple-600" /> CBE Birr
                  </div>
                  <p className="font-bold font-mono text-primary text-sm">{formatCurrency(summary.total_cbe_sales || 0)}</p>
                </div>
                <div className="bg-surface-50 p-3.5 rounded-2xl border border-surface-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Card / POS
                  </div>
                  <p className="font-bold font-mono text-primary text-sm">{formatCurrency(summary.total_card_sales)}</p>
                </div>
                <div className="bg-surface-50 p-3.5 rounded-2xl border border-surface-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> Bank Transfer
                  </div>
                  <p className="font-bold font-mono text-primary text-sm">{formatCurrency(summary.total_bank_sales || 0)}</p>
                </div>
              </div>
            </div>

            {summary.unconfirmed_count > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Pending Confirmations ({summary.unconfirmed_count})</p>
                    <p className="text-xs text-amber-700">You have {summary.unconfirmed_count} unconfirmed payment(s). Shift cannot close without a manager exception note & PIN.</p>
                  </div>
                </div>
                <Link to="/dashboard/payments" className="btn-sm bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex-shrink-0 shadow-xs">
                  Review & Confirm →
                </Link>
              </div>
            )}
          </div>

          {/* Close Till Section */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-primary text-base">End of Shift Reconciliation</h3>
                <p className="text-xs text-muted">Count physical cash in the drawer to close the till and generate Z-Report.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Calculator className="w-3.5 h-3.5 text-brand-500" />}
                onClick={() => setCounterModal({ open: true, target: 'close' })}
              >
                Count Notes
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="label">Actual Cash Counted</label>
                <input
                  type="number"
                  className="input text-2xl font-bold font-mono tracking-wider"
                  placeholder="0.00"
                  value={actualCash}
                  onChange={e => { setActualCash(e.target.value); setError(''); }}
                />
              </div>
              {((actualCash && Math.abs(Number(actualCash) - Number(session.expected_cash)) > 5) || summary.unconfirmed_count > 0) && (
                <div className="animate-fade-in">
                  <label className="label text-amber-700 flex items-center gap-1 font-bold text-xs">
                    <Key className="w-3.5 h-3.5" /> Manager PIN Required {summary.unconfirmed_count > 0 ? '(Unconfirmed Payments Authorization)' : ''}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    className="input border-amber-300 focus:ring-amber-200 bg-amber-50 text-xl font-bold tracking-widest text-center"
                    placeholder="••••"
                    value={managerPin}
                    onChange={e => { setManagerPin(e.target.value); setError(''); }}
                  />
                </div>
              )}
            </div>

            {actualCash && (
              <div className={cn(
                "p-4 rounded-2xl flex items-center justify-between animate-fade-in",
                Math.abs(Number(actualCash) - Number(session.expected_cash)) <= 0.01
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              )}>
                <span className="font-bold text-sm">Discrepancy:</span>
                <span className="font-mono font-bold text-lg">
                  {Number(actualCash) - Number(session.expected_cash) > 0 ? '+' : ''}
                  {formatCurrency(Number(actualCash) - Number(session.expected_cash))}
                </span>
              </div>
            )}

            {((actualCash && Math.abs(Number(actualCash) - Number(session.expected_cash)) > 0.01) || summary.unconfirmed_count > 0) && (
              <div className="animate-fade-in">
                <label className="label font-bold text-xs">
                  {summary.unconfirmed_count > 0 ? 'Manager Exception / Discrepancy Note (Mandatory)' : 'Discrepancy Note'}
                </label>
                <Input
                  placeholder={summary.unconfirmed_count > 0 ? "Explain why unconfirmed payments remain open at shift end..." : "e.g. Returned 2 ETB excess change"}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            <div className="pt-3">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                className="bg-surface-900 hover:bg-black text-white shadow-md"
                icon={<Lock className="w-5 h-5" />}
                loading={closeMut.isPending}
                onClick={handleClose}
              >
                Close Till & Generate Z-Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Denomination Counter Modal ─────────────────────────── */}
      {counterModal.open && (
        <DenominationCounterModal
          title={counterModal.target === 'start' ? 'Starting Float Calculator' : 'Closing Cash Calculator'}
          onApply={(total) => {
            if (counterModal.target === 'start') {
              setStartingCash(total.toString());
            } else {
              setActualCash(total.toString());
            }
          }}
          onClose={() => setCounterModal({ open: false, target: 'start' })}
        />
      )}

      {/* ── Thermal Z-Report / X-Report Modal ──────────────────── */}
      {zReportData && (
        <ThermalZReport
          data={zReportData}
          restaurantName={(user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant'}
          restaurantLogo={assetUrl((user?.restaurant as any)?.logo_url)}
          taxId={(user?.restaurant as any)?.tax_id}
          address={(user?.restaurant as any)?.address}
          phone={(user?.restaurant as any)?.phone}
          onClose={() => setZReportData(null)}
        />
      )}
    </div>
  );
}
