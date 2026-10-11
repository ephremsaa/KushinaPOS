import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, CheckCircle2, XCircle, AlertTriangle, Clock,
  RefreshCw, Shield, Search, Filter, Eye, ArrowUpRight,
  CreditCard, Smartphone, Building2, ExternalLink,
  RotateCcw, Check, Sparkles, Key, FileText, CheckCheck,
  Zap, Copy, ToggleLeft, ToggleRight, Layers, HelpCircle
} from 'lucide-react';
import { paymentsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, formatRelative, cn } from '../../lib/utils';
import { assetUrl, openPrivateDocument } from '../../lib/assetUrl';
import { globalToast } from '../../components/ui/Toast';
import { Button, Input, Modal } from '../../components/ui';
import type { PaymentRecord, PaymentProviderConfig } from '../../types';

type TabType = 'to-confirm' | 'all' | 'reconciliation' | 'gateways';

export default function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('to-confirm');

  // Filter state for All Payments tab
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reconciliation filter
  const [reconMatchedFilter, setReconMatchedFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [reconMethodFilter, setReconMethodFilter] = useState<string>('all');

  // Modals state
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<PaymentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [refundModalPayment, setRefundModalPayment] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundManagerPin, setRefundManagerPin] = useState('');
  const [detailsModalPayment, setDetailsModalPayment] = useState<PaymentRecord | null>(null);

  // Actor info
  const actorId = user?.id || '';
  const isManagerOrOwner = user?.role === 'restaurant_owner' || user?.staffRole === 'manager' || user?.staffRole === 'owner';

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: toConfirmData, isLoading: loadingToConfirm, refetch: refetchToConfirm } = useQuery({
    queryKey: ['payments-to-confirm'],
    queryFn: () => paymentsApi.toConfirm(),
    refetchInterval: 15_000,
  });

  const { data: allPayments, isLoading: loadingAll, refetch: refetchAll } = useQuery({
    queryKey: ['payments-list', methodFilter, statusFilter, searchQuery],
    queryFn: () => paymentsApi.list({
      method: methodFilter === 'all' ? undefined : methodFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery.trim() || undefined,
      limit: 100,
    }),
  });

  const { data: reconData, isLoading: loadingRecon, refetch: refetchRecon } = useQuery({
    queryKey: ['payments-reconciliation', reconMatchedFilter, reconMethodFilter],
    queryFn: () => paymentsApi.reconciliation({
      matched: reconMatchedFilter === 'all' ? undefined : reconMatchedFilter === 'matched',
      method: reconMethodFilter === 'all' ? undefined : reconMethodFilter,
    }),
  });

  const { data: providerConfigs, isLoading: loadingConfigs, refetch: refetchConfigs } = useQuery({
    queryKey: ['payments-provider-configs'],
    queryFn: () => paymentsApi.getProviderConfigs(),
    enabled: isManagerOrOwner,
  });

  // ── Mutations ───────────────────────────────────────────────────────────
  const confirmMut = useMutation({
    mutationFn: (paymentId: string) => paymentsApi.confirm(paymentId),
    onSuccess: (res) => {
      globalToast.success(res.order_paid ? 'Payment confirmed! Order fully paid.' : 'Payment confirmed.');
      qc.invalidateQueries({ queryKey: ['payments-to-confirm'] });
      qc.invalidateQueries({ queryKey: ['payments-list'] });
      qc.invalidateQueries({ queryKey: ['payments-reconciliation'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      globalToast.error(err?.response?.data?.error || 'Failed to confirm payment');
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => paymentsApi.reject(paymentId, reason),
    onSuccess: () => {
      globalToast.success('Payment rejected.');
      setRejectModalPayment(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['payments-to-confirm'] });
      qc.invalidateQueries({ queryKey: ['payments-list'] });
    },
    onError: (err: any) => {
      globalToast.error(err?.response?.data?.error || 'Failed to reject payment');
    },
  });

  const refundMut = useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: { manager_pin: string; reason: string; amount?: number } }) =>
      paymentsApi.refund(paymentId, data),
    onSuccess: () => {
      globalToast.success('Refund processed successfully. Inventory and points updated.');
      setRefundModalPayment(null);
      setRefundAmount('');
      setRefundReason('');
      setRefundManagerPin('');
      qc.invalidateQueries({ queryKey: ['payments-list'] });
      qc.invalidateQueries({ queryKey: ['payments-reconciliation'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      globalToast.error(err?.response?.data?.error || 'Failed to process refund');
    },
  });

  const matchMut = useMutation({
    mutationFn: ({ paymentId, matched }: { paymentId: string; matched: boolean }) =>
      paymentsApi.matchStatement(paymentId, matched),
    onSuccess: () => {
      globalToast.success('Statement reconciliation status updated.');
      qc.invalidateQueries({ queryKey: ['payments-reconciliation'] });
      qc.invalidateQueries({ queryKey: ['payments-list'] });
    },
    onError: (err: any) => {
      globalToast.error(err?.response?.data?.error || 'Failed to update match status');
    },
  });

  const expireStaleMut = useMutation({
    mutationFn: () => paymentsApi.expireStale(),
    onSuccess: (data) => {
      globalToast.info(`Stale check done: ${data.expiredCount} expired, ${data.confirmedCount} verified.`);
      qc.invalidateQueries({ queryKey: ['payments-to-confirm'] });
      qc.invalidateQueries({ queryKey: ['payments-list'] });
    },
    onError: (err: any) => {
      globalToast.error(err?.response?.data?.error || 'Failed to check stale payments');
    },
  });

  // ── Helper Badges ───────────────────────────────────────────────────────
  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'telebirr':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-800 border border-violet-200">
            <Smartphone className="w-3 h-3 text-violet-600" /> Telebirr
          </span>
        );
      case 'cbe_birr':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Building2 className="w-3 h-3 text-purple-600" /> CBE Birr
          </span>
        );
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Building2 className="w-3 h-3 text-blue-600" /> Bank Transfer
          </span>
        );
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Wallet className="w-3 h-3 text-emerald-600" /> Cash
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <CreditCard className="w-3 h-3 text-amber-600" /> Card / POS
          </span>
        );
      case 'loyalty':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Sparkles className="w-3 h-3 text-yellow-600" /> Loyalty Points
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-100 text-surface-700 border border-default">
            {method}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse-soft">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Verification
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" /> Rejected
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-100 text-surface-600 border border-default">
            <RotateCcw className="w-3 h-3 text-surface-500" /> Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-100 text-surface-600 border border-default">
            {status}
          </span>
        );
    }
  };

  const unconfirmedCount = toConfirmData?.count || 0;
  const unconfirmedAmount = toConfirmData?.total_unconfirmed || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* ── Top Page Header ─────────────────────────────────────────── */}
      <div
        className="page-header p-6 sm:p-8 rounded-[2rem] border shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 text-xs font-bold tracking-wide">
            <Shield className="w-3.5 h-3.5" />
            <span>Dual-Stage Payment Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-primary tracking-tight">
            Payments & Verification
          </h1>
          <p className="text-sm text-muted max-w-2xl font-medium">
            Review cashier-recorded mobile money transfers, resolve unconfirmed payments before shift close, issue refunds, and reconcile bank statements.
          </p>
        </div>

        {/* Action Header Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">To Confirm</p>
              <p className="text-base font-black font-mono text-amber-950">
                {unconfirmedCount} tx ({formatCurrency(unconfirmedAmount)})
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("w-4 h-4 text-brand-500", (loadingToConfirm || loadingAll) && "animate-spin")} />}
            onClick={() => {
              refetchToConfirm();
              refetchAll();
              refetchRecon();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Tabs Navigation Bar ────────────────────────────────────── */}
      <div className="flex border-b border-surface-200 gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveTab('to-confirm')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all relative whitespace-nowrap cursor-pointer',
            activeTab === 'to-confirm'
              ? 'bg-brand-500 text-white shadow-glow'
              : 'text-surface-600 hover:text-primary hover:bg-surface-100'
          )}
        >
          <Clock className="w-4 h-4" />
          <span>To Confirm</span>
          {unconfirmedCount > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-black',
                activeTab === 'to-confirm' ? 'bg-white text-brand-600' : 'bg-amber-500 text-white'
              )}
            >
              {unconfirmedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'all'
              ? 'bg-brand-500 text-white shadow-glow'
              : 'text-surface-600 hover:text-primary hover:bg-surface-100'
          )}
        >
          <Layers className="w-4 h-4" />
          <span>All Payments</span>
          {allPayments && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-black',
                activeTab === 'all' ? 'bg-white text-brand-600' : 'bg-surface-200 text-surface-700'
              )}
            >
              {allPayments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'reconciliation'
              ? 'bg-brand-500 text-white shadow-glow'
              : 'text-surface-600 hover:text-primary hover:bg-surface-100'
          )}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Statement Reconciliation</span>
        </button>

        {isManagerOrOwner && (
          <button
            onClick={() => setActiveTab('gateways')}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap cursor-pointer',
              activeTab === 'gateways'
                ? 'bg-brand-500 text-white shadow-glow'
                : 'text-surface-600 hover:text-primary hover:bg-surface-100'
            )}
          >
            <Zap className="w-4 h-4" />
            <span>Payment Gateways (Stage 2)</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: TO CONFIRM ────────────────────────────────────────── */}
      {activeTab === 'to-confirm' && (
        <div className="space-y-4 animate-fade-in">
          {unconfirmedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-3xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">
                    {unconfirmedCount} Payment(s) Awaiting Manager Confirmation
                  </h4>
                  <p className="text-xs text-amber-800">
                    A shift cannot close with unconfirmed mobile money or bank payments without a manager authorization note & PIN.
                  </p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-xs font-semibold text-amber-700">Total Pending:</span>
                <p className="text-lg font-black font-mono text-amber-900">{formatCurrency(unconfirmedAmount)}</p>
              </div>
            </div>
          )}

          {loadingToConfirm ? (
            <div className="card p-12 text-center text-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Loading pending payments...
            </div>
          ) : !toConfirmData || toConfirmData.payments.length === 0 ? (
            <div
              className="card p-16 text-center rounded-[2rem] border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-display font-black text-xl text-primary">All Caught Up!</h3>
              <p className="text-sm text-muted max-w-md mx-auto mt-1">
                There are no unconfirmed mobile money or bank payments in the queue. All transactions have been verified.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {toConfirmData.payments.map((p: PaymentRecord) => {
                const isSelfCreated = p.created_by && p.created_by === actorId;
                const canConfirm = isManagerOrOwner && !isSelfCreated;

                return (
                  <div
                    key={p.id}
                    className="card p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-card-hover"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    {/* Left: Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center flex-shrink-0 text-brand-600">
                        {p.method === 'telebirr' ? <Smartphone className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-base text-primary">
                            {formatCurrency(p.amount)}
                          </span>
                          {getMethodBadge(p.method)}
                          {getStatusBadge(p.status)}
                          {p.order_local_id && (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface-100 text-surface-700">
                              Order #{p.order_local_id}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                          <span className="font-mono bg-surface-100 px-2 py-0.5 rounded-md font-bold text-surface-800">
                            Ref: {p.reference || 'N/A'}
                          </span>
                          <span>•</span>
                          <span>Recorded by: <strong>{p.created_by_name || 'Cashier'}</strong></span>
                          <span>•</span>
                          <span>{formatRelative(p.created_at)}</span>
                        </div>

                        {isSelfCreated && (
                          <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Cashiers cannot confirm their own payment entries. A manager or owner must confirm.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                      {p.proof_url && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedProofUrl(p.proof_url || null)}
                        >
                          View Receipt
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        size="sm"
                        icon={<XCircle className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setRejectModalPayment(p);
                          setRejectReason('');
                        }}
                      >
                        Reject
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!canConfirm || confirmMut.isPending}
                        loading={confirmMut.isPending && confirmMut.variables === p.id}
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        onClick={() => confirmMut.mutate(p.id)}
                        title={isSelfCreated ? "Cashiers cannot confirm their own payment entries" : "Confirm payment"}
                      >
                        Confirm Payment
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ALL PAYMENTS ──────────────────────────────────────── */}
      {activeTab === 'all' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters Bar */}
          <div
            className="p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-3"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder="Search reference or order..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input pl-10 py-2 text-sm w-full"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                className="input py-2 text-sm font-semibold"
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
              >
                <option value="all">All Payment Methods</option>
                <option value="telebirr">Telebirr</option>
                <option value="cbe_birr">CBE Birr</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card / POS</option>
                <option value="loyalty">Loyalty</option>
              </select>

              <select
                className="input py-2 text-sm font-semibold"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Payments Table */}
          {loadingAll ? (
            <div className="card p-12 text-center text-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Loading payments...
            </div>
          ) : !allPayments || allPayments.length === 0 ? (
            <div
              className="card p-16 text-center rounded-[2rem] border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <FileText className="w-12 h-12 text-surface-400 mx-auto mb-3" />
              <h3 className="font-display font-black text-lg text-primary">No Payments Found</h3>
              <p className="text-xs text-muted mt-1">No transaction records match the current filters.</p>
            </div>
          ) : (
            <div
              className="card overflow-hidden rounded-3xl border shadow-card"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-50 border-b border-default text-xs uppercase font-extrabold text-muted">
                    <tr>
                      <th className="px-5 py-3.5">Date / Time</th>
                      <th className="px-5 py-3.5">Order</th>
                      <th className="px-5 py-3.5">Method</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Reference</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Statement Match</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {allPayments.map((p: PaymentRecord) => {
                      const isNegative = Number(p.amount) < 0;
                      const canRefund = p.status === 'confirmed' && !isNegative && isManagerOrOwner;

                      return (
                        <tr key={p.id} className="hover:bg-surface-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
                            {formatDate(p.created_at)}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-primary whitespace-nowrap">
                            {p.order_local_id ? `#${p.order_local_id}` : p.order_id?.slice(0, 8) || 'N/A'}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getMethodBadge(p.method)}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold whitespace-nowrap">
                            <span className={cn(isNegative ? 'text-red-600' : 'text-primary')}>
                              {formatCurrency(p.amount)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-surface-700 whitespace-nowrap">
                            {p.reference || '—'}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getStatusBadge(p.status)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {['telebirr', 'cbe_birr', 'bank_transfer'].includes(p.method) ? (
                              p.is_matched_with_statement ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Matched
                                </span>
                              ) : (
                                <span className="text-xs text-surface-400 font-medium">Unmatched</span>
                              )
                            ) : (
                              <span className="text-xs text-surface-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {p.proof_url && (
                                <button
                                  onClick={() => setSelectedProofUrl(p.proof_url || null)}
                                  className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-primary transition-colors cursor-pointer"
                                  title="View Proof"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => setDetailsModalPayment(p)}
                                className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-primary transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              {canRefund && (
                                <button
                                  onClick={() => {
                                    setRefundModalPayment(p);
                                    setRefundAmount(String(p.amount));
                                    setRefundReason('');
                                    setRefundManagerPin('');
                                  }}
                                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-surface-100 hover:bg-red-50 hover:text-red-700 border border-default text-surface-700 transition-colors cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: STATEMENT RECONCILIATION ──────────────────────────── */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6 animate-fade-in">
          {/* Reconciliation KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="card p-5 rounded-3xl border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider mb-2">
                <span>Total Mobile & Bank Volume</span>
                <Wallet className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black font-mono text-primary">
                {formatCurrency(reconData?.total_amount || 0)}
              </p>
              <p className="text-xs text-muted mt-1">{reconData?.payments?.length || 0} eligible transactions</p>
            </div>

            <div
              className="card p-5 rounded-3xl border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
                <span>Matched With Statement</span>
                <CheckCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black font-mono text-emerald-600">
                {formatCurrency(reconData?.matched_amount || 0)}
              </p>
              <p className="text-xs text-emerald-700 mt-1">Verified on SMS / Bank statement</p>
            </div>

            <div
              className="card p-5 rounded-3xl border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
                <span>Unmatched Pending</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black font-mono text-amber-600">
                {formatCurrency(reconData?.unmatched_amount || 0)}
              </p>
              <p className="text-xs text-amber-700 mt-1">Requires bank statement check</p>
            </div>

            <div
              className="card p-5 rounded-3xl border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-center justify-between text-brand-600 text-xs font-bold uppercase tracking-wider mb-2">
                <span>Reconciliation Rate</span>
                <Sparkles className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black font-mono text-brand-600">
                {reconData?.total_amount && reconData.total_amount > 0
                  ? Math.round((reconData.matched_amount / reconData.total_amount) * 100)
                  : 0}
                %
              </p>
              <div className="w-full bg-surface-200 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-brand-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      reconData?.total_amount && reconData.total_amount > 0
                        ? Math.min(100, Math.round((reconData.matched_amount / reconData.total_amount) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Reconciliation Filter Bar */}
          <div
            className="p-4 rounded-3xl border flex items-center justify-between gap-4 flex-wrap"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase">Match Status:</span>
              {(['all', 'unmatched', 'matched'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setReconMatchedFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize',
                    reconMatchedFilter === f
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  )}
                >
                  {f === 'all' ? 'All Transactions' : f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase">Provider:</span>
              <select
                className="input py-1.5 text-xs font-bold"
                value={reconMethodFilter}
                onChange={e => setReconMethodFilter(e.target.value)}
              >
                <option value="all">All Providers</option>
                <option value="telebirr">Telebirr</option>
                <option value="cbe_birr">CBE Birr</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Reconciliation List */}
          {loadingRecon ? (
            <div className="card p-12 text-center text-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Loading reconciliation entries...
            </div>
          ) : !reconData || reconData.payments.length === 0 ? (
            <div
              className="card p-16 text-center rounded-[2rem] border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-display font-black text-lg text-primary">No Matching Records</h3>
              <p className="text-xs text-muted mt-1">All mobile money transactions are in order for these filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reconData.payments.map((p: PaymentRecord) => {
                const isMatched = p.is_matched_with_statement;

                return (
                  <div
                    key={p.id}
                    className={cn(
                      'p-4 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all',
                      isMatched
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-surface border-default hover:border-brand-200'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => matchMut.mutate({ paymentId: p.id, matched: !isMatched })}
                        disabled={matchMut.isPending}
                        className={cn(
                          'w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0',
                          isMatched
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-surface-100 text-surface-400 border border-default hover:border-brand-400'
                        )}
                        title={isMatched ? 'Click to unmatch' : 'Click to match with statement'}
                      >
                        <Check className="w-5 h-5" />
                      </button>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-base text-primary">
                            {formatCurrency(p.amount)}
                          </span>
                          {getMethodBadge(p.method)}
                          <span className="font-mono text-xs font-bold text-surface-700 bg-surface-100 px-2 py-0.5 rounded-md">
                            Ref: {p.reference || 'N/A'}
                          </span>
                          {p.order_local_id && (
                            <span className="text-xs font-bold text-muted">
                              Order #{p.order_local_id}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span>{formatDate(p.created_at)}</span>
                          {p.matched_by_name && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">
                                Matched by {p.matched_by_name} ({formatRelative(p.matched_at || '')})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {p.proof_url && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedProofUrl(p.proof_url || null)}
                        >
                          Receipt
                        </Button>
                      )}

                      <Button
                        variant={isMatched ? 'secondary' : 'primary'}
                        size="sm"
                        icon={isMatched ? <XCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                        onClick={() => matchMut.mutate({ paymentId: p.id, matched: !isMatched })}
                        loading={matchMut.isPending}
                      >
                        {isMatched ? 'Unmatch' : 'Match with Statement'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: PAYMENT GATEWAYS (STAGE 2) ────────────────────────── */}
      {activeTab === 'gateways' && isManagerOrOwner && (
        <div className="space-y-6 animate-fade-in">
          {/* Gateways Banner */}
          <div className="p-6 rounded-[2rem] bg-gradient-to-r from-surface-900 to-slate-900 text-white border border-surface-700 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-brand-300 text-xs font-bold">
                <Zap className="w-3.5 h-3.5" />
                <span>Stage 2 Automated Providers</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-white">
                Merchant API Adapters & Webhooks
              </h2>
              <p className="text-xs sm:text-sm text-surface-300 max-w-2xl font-medium">
                Store restaurant credentials encrypted with server-side AES-256-GCM. Never plaintext in the database or client. Instantly toggle providers on or off.
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 flex-shrink-0"
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              loading={expireStaleMut.isPending}
              onClick={() => expireStaleMut.mutate()}
            >
              Run Expiry Check (&gt;15 min)
            </Button>
          </div>

          {/* Provider Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProviderConfigCard
              provider="telebirr"
              title="Telebirr H5 / InPay"
              description="Direct merchant integration with Ethio telecom Telebirr super-app and QR checkout."
              icon={<Smartphone className="w-6 h-6 text-violet-600" />}
              badgeColor="violet"
              config={providerConfigs?.find((c: any) => c.provider === 'telebirr')}
              credentialFields={[
                { key: 'app_id', label: 'App ID', placeholder: 'e.g. 1002345' },
                { key: 'app_key', label: 'App Key', placeholder: '••••••••••••••••', secret: true },
                { key: 'public_key', label: 'Public Key', placeholder: '••••••••••••••••', secret: true },
                { key: 'short_code', label: 'Short Code / Merchant ID', placeholder: 'e.g. 54321' },
              ]}
              onSaved={() => refetchConfigs()}
            />

            <ProviderConfigCard
              provider="cbe_birr"
              title="CBE Birr Digital"
              description="Commercial Bank of Ethiopia (CBE) Birr digital merchant gateway API."
              icon={<Building2 className="w-6 h-6 text-purple-600" />}
              badgeColor="purple"
              config={providerConfigs?.find((c: any) => c.provider === 'cbe_birr')}
              credentialFields={[
                { key: 'merchant_code', label: 'Merchant Code', placeholder: 'e.g. CBE-M-9021' },
                { key: 'api_key', label: 'API Key', placeholder: '••••••••••••••••', secret: true },
                { key: 'channel_id', label: 'Channel ID', placeholder: 'e.g. WEB_POS' },
              ]}
              onSaved={() => refetchConfigs()}
            />

            <ProviderConfigCard
              provider="chapa"
              title="Chapa Financial Tech"
              description="Unified Ethiopian card & digital money gateway with inline checkout and webhooks."
              icon={<CreditCard className="w-6 h-6 text-emerald-600" />}
              badgeColor="emerald"
              config={providerConfigs?.find((c: any) => c.provider === 'chapa')}
              credentialFields={[
                { key: 'secret_key', label: 'Secret Key (CHASECK_...)', placeholder: '••••••••••••••••', secret: true },
                { key: 'public_key', label: 'Public Key (CHAPUBK_...)', placeholder: 'CHAPUBK_TEST-...' },
                { key: 'webhook_secret', label: 'Webhook Secret', placeholder: '••••••••••••••••', secret: true },
              ]}
              onSaved={() => refetchConfigs()}
            />

            <ProviderConfigCard
              provider="mock_sandbox"
              title="Mock Sandbox Simulator"
              description="Offline simulator for staff training, POS stress-testing, and automated validation."
              icon={<Sparkles className="w-6 h-6 text-brand-600" />}
              badgeColor="brand"
              config={providerConfigs?.find((c: any) => c.provider === 'mock_sandbox')}
              credentialFields={[
                { key: 'api_key', label: 'Sandbox Simulation Token', placeholder: 'mock_sandbox_key_123' },
              ]}
              onSaved={() => refetchConfigs()}
            />
          </div>
        </div>
      )}

      {/* ── Proof Preview Modal ──────────────────────────────────────── */}
      {selectedProofUrl && (
        <Modal
          open={!!selectedProofUrl}
          onClose={() => setSelectedProofUrl(null)}
          title="Payment Proof / Receipt Photo"
          subtitle="Customer transfer screenshot or physical deposit slip"
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-default bg-black/5 flex items-center justify-center max-h-[60vh]">
              <img
                src={assetUrl(selectedProofUrl)}
                alt="Payment proof"
                className="max-h-[55vh] object-contain rounded-xl"
                onError={(e) => {
                  // Fallback for private document download
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                icon={<ExternalLink className="w-4 h-4" />}
                onClick={() => openPrivateDocument(selectedProofUrl)}
              >
                Open Full Document
              </Button>
              <Button variant="primary" onClick={() => setSelectedProofUrl(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────────── */}
      {rejectModalPayment && (
        <Modal
          open={!!rejectModalPayment}
          onClose={() => setRejectModalPayment(null)}
          title="Reject Payment Entry"
          subtitle={`Rejecting payment for Order #${rejectModalPayment.order_local_id || rejectModalPayment.order_id?.slice(0, 8)}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-red-50 text-red-800 p-3.5 rounded-2xl border border-red-200 text-xs">
              <p className="font-bold">This will decline the payment entry.</p>
              <p className="mt-1">
                The order balance will remain unpaid. State a clear reason for the audit log and cashier review.
              </p>
            </div>

            <div>
              <label className="label">Rejection Reason</label>
              <Input
                placeholder="e.g. Reference not found on SMS statement, wrong amount"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" fullWidth onClick={() => setRejectModalPayment(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                disabled={!rejectReason.trim() || rejectMut.isPending}
                loading={rejectMut.isPending}
                onClick={() =>
                  rejectMut.mutate({ paymentId: rejectModalPayment.id, reason: rejectReason.trim() })
                }
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Refund Modal ─────────────────────────────────────────────── */}
      {refundModalPayment && (
        <Modal
          open={!!refundModalPayment}
          onClose={() => setRefundModalPayment(null)}
          title="Issue Payment Refund"
          subtitle={`Original Payment: ${formatCurrency(refundModalPayment.amount)} via ${refundModalPayment.method}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 text-amber-900 p-3.5 rounded-2xl border border-amber-200 text-xs">
              <p className="font-bold">Security & Inventory Reversal Notice:</p>
              <p className="mt-1">
                Processing a refund links a negative payment record, automatically restores order inventory items back into stock, and reverses any awarded loyalty points.
              </p>
            </div>

            <div>
              <label className="label">Refund Amount (ETB)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Reason for Refund</label>
              <Input
                placeholder="e.g. Customer returned dish, order cancelled after prep"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1 text-amber-800">
                <Key className="w-3.5 h-3.5" /> Manager Authorization PIN
              </label>
              <Input
                type="password"
                maxLength={6}
                placeholder="••••"
                value={refundManagerPin}
                onChange={e => setRefundManagerPin(e.target.value)}
                className="text-center tracking-widest text-lg font-bold"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" fullWidth onClick={() => setRefundModalPayment(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                disabled={!refundReason.trim() || !refundManagerPin.trim() || refundMut.isPending}
                loading={refundMut.isPending}
                onClick={() =>
                  refundMut.mutate({
                    paymentId: refundModalPayment.id,
                    data: {
                      amount: parseFloat(refundAmount) || undefined,
                      reason: refundReason.trim(),
                      manager_pin: refundManagerPin.trim(),
                    },
                  })
                }
              >
                Process Refund
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Transaction Details Modal ─────────────────────────────────── */}
      {detailsModalPayment && (
        <Modal
          open={!!detailsModalPayment}
          onClose={() => setDetailsModalPayment(null)}
          title="Payment Audit Details"
          subtitle={`ID: ${detailsModalPayment.id}`}
          size="md"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-50 border border-default">
              <div>
                <span className="text-xs text-muted">Amount</span>
                <p className="font-mono font-bold text-base text-primary">
                  {formatCurrency(detailsModalPayment.amount)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">Method</span>
                <div>{getMethodBadge(detailsModalPayment.method)}</div>
              </div>
              <div>
                <span className="text-xs text-muted">Status</span>
                <div>{getStatusBadge(detailsModalPayment.status)}</div>
              </div>
              <div>
                <span className="text-xs text-muted">Reference</span>
                <p className="font-mono font-bold text-surface-800">
                  {detailsModalPayment.reference || 'None'}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">Created By</span>
                <p className="font-bold text-surface-800">
                  {detailsModalPayment.created_by_name || 'Cashier'}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">Created At</span>
                <p className="text-xs text-surface-700">
                  {formatDate(detailsModalPayment.created_at)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">Confirmed By</span>
                <p className="font-bold text-surface-800">
                  {detailsModalPayment.confirmed_by_name || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">Confirmed At</span>
                <p className="text-xs text-surface-700">
                  {detailsModalPayment.confirmed_at ? formatDate(detailsModalPayment.confirmed_at) : '—'}
                </p>
              </div>
            </div>

            {detailsModalPayment.rejected_reason && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs">
                <span className="font-bold">Rejection Reason:</span>
                <p className="mt-0.5">{detailsModalPayment.rejected_reason}</p>
              </div>
            )}

            {detailsModalPayment.is_matched_with_statement && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                <span className="font-bold">Statement Reconciliation:</span>
                <p className="mt-0.5">
                  Matched by {detailsModalPayment.matched_by_name || 'Manager'} on{' '}
                  {formatDate(detailsModalPayment.matched_at || '')}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setDetailsModalPayment(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Provider Config Card (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

function ProviderConfigCard({
  provider,
  title,
  description,
  icon,
  badgeColor,
  config,
  credentialFields,
  onSaved,
}: {
  provider: 'telebirr' | 'cbe_birr' | 'chapa' | 'mock_sandbox';
  title: string;
  description: string;
  icon: React.ReactNode;
  badgeColor: string;
  config?: PaymentProviderConfig;
  credentialFields: CredentialField[];
  onSaved: () => void;
}) {
  const [isEnabled, setIsEnabled] = useState(config?.is_enabled ?? false);
  const [isSandbox, setIsSandbox] = useState(config?.is_sandbox ?? true);
  const [credentials, setCredentials] = useState<Record<string, string>>(config?.credentials || {});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state if config arrives after query load
  React.useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setIsSandbox(config.is_sandbox);
      setCredentials(config.credentials || {});
    }
  }, [config]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await paymentsApi.testProvider(provider, {
        credentials,
        is_sandbox: isSandbox,
      });
      setTestResult(res);
      if (res.success) {
        globalToast.success(`${title}: Connection verified!`);
      } else {
        globalToast.error(`${title}: ${res.message}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Connection failed';
      setTestResult({ success: false, message: msg });
      globalToast.error(`${title}: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await paymentsApi.saveProviderConfig(provider, {
        is_enabled: isEnabled,
        is_sandbox: isSandbox,
        credentials,
      });
      globalToast.success(`${title} configuration saved securely.`);
      onSaved();
    } catch (err: any) {
      globalToast.error(err?.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/webhooks/payments/${provider}`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    globalToast.info('Webhook URL copied to clipboard.');
  };

  return (
    <div
      className="card p-6 rounded-3xl border shadow-card flex flex-col justify-between gap-5 transition-all"
      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
    >
      <div className="space-y-4">
        {/* Header & Feature Flag Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center flex-shrink-0 shadow-xs">
              {icon}
            </div>
            <div>
              <h3 className="font-display font-black text-base text-primary">{title}</h3>
              <p className="text-xs text-muted leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Master Feature Flag */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-xs font-bold text-surface-600">
              {isEnabled ? 'Active' : 'Disabled'}
            </label>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                isEnabled ? 'bg-emerald-500' : 'bg-surface-300'
              )}
            >
              <span
                className={cn(
                  'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                  isEnabled ? 'right-1' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>

        {/* Sandbox vs Production Switch */}
        <div className="p-3 bg-surface-50 rounded-2xl border border-default flex items-center justify-between">
          <span className="text-xs font-bold text-surface-700">Environment Mode</span>
          <div className="flex items-center gap-1.5 bg-surface-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIsSandbox(true)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                isSandbox ? 'bg-amber-500 text-white shadow-xs' : 'text-surface-600 hover:text-primary'
              )}
            >
              Sandbox (Test)
            </button>
            <button
              type="button"
              onClick={() => setIsSandbox(false)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                !isSandbox ? 'bg-emerald-600 text-white shadow-xs' : 'text-surface-600 hover:text-primary'
              )}
            >
              Production (Live)
            </button>
          </div>
        </div>

        {/* Credential Inputs */}
        <div className="space-y-3 pt-1">
          {credentialFields.map(f => (
            <div key={f.key}>
              <label className="label text-xs">{f.label}</label>
              <Input
                type={f.secret ? 'password' : 'text'}
                placeholder={f.placeholder}
                value={credentials[f.key] || ''}
                onChange={e =>
                  setCredentials(prev => ({ ...prev, [f.key]: e.target.value }))
                }
                className="text-xs font-mono"
              />
            </div>
          ))}
        </div>

        {/* Webhook Endpoint Info */}
        <div className="p-3 bg-surface-50 rounded-2xl border border-default space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-muted">
            <span>Webhook URL (Idempotent):</span>
            <button
              type="button"
              onClick={copyWebhook}
              className="text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <p className="font-mono text-[11px] text-surface-700 truncate select-all">{webhookUrl}</p>
        </div>

        {/* Test Result Indicator */}
        {testResult && (
          <div
            className={cn(
              'p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border animate-fade-in',
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            )}
          >
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={<Zap className="w-3.5 h-3.5 text-brand-500" />}
          loading={testing}
          onClick={handleTest}
        >
          Test Connection
        </Button>

        <Button
          variant="primary"
          size="sm"
          fullWidth
          loading={saving}
          onClick={handleSave}
        >
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
