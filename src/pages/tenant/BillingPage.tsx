import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, CheckCircle2, Clock, XCircle, AlertTriangle,
  CreditCard, Zap, Shield, BarChart3, Package,
  ChevronUp, ChevronDown, RefreshCw, X, ExternalLink,
  Loader2, AlertCircle, Check, TrendingUp, Users, Monitor,
  ArrowUpRight, ArrowDownRight, Ban, RotateCcw, Sparkles,
} from 'lucide-react';
import { billingApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, formatRelative, cn } from '../../lib/utils';
import type { PaymentProof, SubscriptionPlan } from '../../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SubData {
  id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  billing_cycle: 'monthly' | 'annual';
  current_period_end: string;
  current_period_start: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
  cancellation_reason?: string;
  price_monthly: number;
  price_annual: number;
  max_staff: number;
  max_pos_terminals: number;
  features: Record<string, unknown>;
}

interface UsageData {
  subscription: SubData | null;
  usage: { staff_count: number };
  payment_failed: boolean;
  payment_failed_reason: string | null;
  grace_period_ends_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    trial:   'bg-blue-100 text-blue-700 border-blue-200',
    grace:   'bg-amber-100 text-amber-700 border-amber-200',
    expired: 'bg-red-100 text-red-700 border-red-200',
    cancelled: 'bg-surface-100 text-surface-600 border-default',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border', map[status] ?? map.expired)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', {
        'bg-emerald-500': status === 'active',
        'bg-blue-500':    status === 'trial',
        'bg-amber-500':   status === 'grace',
        'bg-red-500':     status === 'expired',
        'bg-surface-400': status === 'cancelled',
      })} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function UsageMeter({ label, used, max, icon: Icon }: {
  label: string; used: number; max: number; icon: React.ElementType;
}) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-surface-400" />
          <span className="text-xs font-semibold text-surface-700">{label}</span>
        </div>
        <span className={cn('text-xs font-bold', isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-surface-600')}>
          {used} / {max}
        </span>
      </div>
      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-brand-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Plan card
// ─────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, React.ElementType> = {
  Starter: Zap,
  Growth:  TrendingUp,
  Pro:     Sparkles,
};

const PLAN_COLORS: Record<string, { border: string; badge: string; btn: string }> = {
  Starter: { border: 'border-blue-200', badge: 'bg-blue-50 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  Growth:  { border: 'border-brand-200', badge: 'bg-brand-50 text-brand-700', btn: 'bg-brand-500 hover:bg-brand-600 text-white' },
  Pro:     { border: 'border-purple-200', badge: 'bg-purple-50 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700 text-white' },
};

function PlanCard({
  plan, isCurrent, isUpgrade, isDowngrade, onSelect,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  isUpgrade: boolean;
  isDowngrade: boolean;
  onSelect: () => void;
}) {
  const Icon = PLAN_ICONS[plan.name] ?? Zap;
  const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.Starter;
  const features = plan.features as Record<string, unknown>;

  return (
    <div className={cn(
      'relative rounded-3xl border-2 p-6 flex flex-col transition-all duration-200',
      isCurrent ? `${colors.border} shadow-lg bg-surface` : 'border-default bg-surface/60 hover:border-surface-300 hover:shadow-md'
    )}>
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={cn('px-3 py-0.5 rounded-full text-xs font-bold border', colors.badge)}>
            Current plan
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', colors.badge)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-display font-bold text-primary">{plan.name}</p>
          <p className="text-xs text-muted">{plan.max_staff} staff · {plan.max_pos_terminals} terminal{plan.max_pos_terminals > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-2xl font-display font-bold text-primary">
          ETB {plan.price_monthly.toLocaleString()}
          <span className="text-sm font-normal text-surface-400">/mo</span>
        </p>
        <p className="text-xs text-surface-400">ETB {plan.price_annual.toLocaleString()}/yr (save 17%)</p>
      </div>

      <div className="space-y-2 flex-1 mb-5">
        <FeatureRow label={`${plan.max_staff} staff seats`} enabled />
        <FeatureRow label={`${plan.max_pos_terminals} POS terminal${plan.max_pos_terminals > 1 ? 's' : ''}`} enabled />
        <FeatureRow label="Kitchen Display (KDS)" enabled={Boolean(features.kds)} />
        <FeatureRow label="Inventory management" enabled={Boolean(features.inventory)} />
        <FeatureRow label="Multi-branch" enabled={Boolean(features.multi_branch)} />
        <FeatureRow label="Advanced reports" enabled={plan.name !== 'Starter'} />
      </div>

      {isCurrent ? (
        <button disabled className="btn btn-sm w-full justify-center bg-surface-100 text-muted cursor-not-allowed">
          <Check className="w-3.5 h-3.5" /> Current
        </button>
      ) : (
        <button
          onClick={onSelect}
          className={cn('btn btn-sm w-full justify-center gap-1.5 transition-all', colors.btn)}
        >
          {isUpgrade ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {isUpgrade ? 'Upgrade' : 'Downgrade'}
        </button>
      )}
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {enabled
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        : <XCircle className="w-4 h-4 text-surface-300 flex-shrink-0" />}
      <span className={enabled ? 'text-surface-700' : 'text-surface-400 line-through'}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Plan change confirmation modal
// ─────────────────────────────────────────────────────────────

function PlanChangeModal({
  selectedPlan,
  currentPlan,
  isUpgrade,
  onConfirm,
  onClose,
  loading,
}: {
  selectedPlan: SubscriptionPlan;
  currentPlan: SubData;
  isUpgrade: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', isUpgrade ? 'bg-brand-100' : 'bg-amber-100')}>
            {isUpgrade ? <ArrowUpRight className="w-5 h-5 text-brand-600" /> : <ArrowDownRight className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <p className="font-display font-bold text-primary">{isUpgrade ? 'Upgrade' : 'Downgrade'} Plan</p>
            <p className="text-sm text-muted">{currentPlan.plan_name} → {selectedPlan.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>

        <div className={cn('p-4 rounded-2xl mb-4 text-sm', isUpgrade ? 'bg-brand-50 text-brand-800 border border-brand-100' : 'bg-amber-50 text-amber-800 border border-amber-100')}>
          {isUpgrade ? (
            <p>✅ Your plan will switch to <strong>{selectedPlan.name}</strong> immediately. Please submit a payment proof for the new price of <strong>ETB {selectedPlan.price_monthly.toLocaleString()}/mo</strong> to activate.</p>
          ) : (
            <p>⚠️ Downgrading to <strong>{selectedPlan.name}</strong> takes effect immediately. Features above the new plan limits (e.g., extra staff) will be restricted. Please confirm you've reviewed the plan limits.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={cn('btn flex-1 justify-center gap-2', isUpgrade ? 'btn-primary' : 'bg-amber-500 hover:bg-amber-600 text-white')}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm {isUpgrade ? 'Upgrade' : 'Downgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cancellation modal
// ─────────────────────────────────────────────────────────────

function CancelModal({ sub, onConfirm, onClose, loading }: {
  sub: SubData; onConfirm: (reason: string) => void;
  onClose: () => void; loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
            <Ban className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-display font-bold text-primary">Cancel Subscription</p>
            <p className="text-sm text-muted">Access continues until {formatDate(sub.current_period_end)}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-sm text-emerald-800">
          <p>✅ <strong>Cancel at period end (recommended)</strong> — Your restaurant keeps full access until <strong>{formatDate(sub.current_period_end)}</strong>. No data is deleted.</p>
        </div>

        <div className="mb-4">
          <label className="label">Reason for cancelling (optional)</label>
          <textarea className="textarea" rows={2} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Too expensive, switching systems, closing temporarily…" />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Keep subscription</button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            className="btn btn-danger flex-1 justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Cancel at period end
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Payment submit section
// ─────────────────────────────────────────────────────────────

function PaymentSubmitSection({ subscriptionId, onSuccess }: {
  subscriptionId?: string; onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [method, setMethod] = useState<'telebirr' | 'cbe' | 'other'>('telebirr');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please upload an image file'); return; }
    if (f.size > 5 * 1024 * 1024) { setError('File must be under 5 MB'); return; }
    setFile(f);
    setError('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const submit = async () => {
    if (!file || !amount) { setError('Screenshot and amount are required'); return; }
    setLoading(true);
    setError('');
    try {
      await billingApi.submitProof(file, Number(amount), method, referenceNumber, note, subscriptionId);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setFile(null); setAmount(''); setReferenceNumber(''); setNote(''); onSuccess(); }, 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="font-display font-bold text-lg text-primary">Payment submitted!</p>
        <p className="text-sm text-muted mt-1">Our team will review within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Payment method */}
      <div>
        <label className="label">Payment method</label>
        <div className="grid grid-cols-3 gap-2">
          {(['telebirr', 'cbe', 'other'] as const).map(m => (
            <button key={m}
              onClick={() => setMethod(m)}
              className={cn(
                'py-3 px-4 rounded-2xl border-2 text-sm font-bold transition-all',
                method === m ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm' : 'border-default text-surface-600 hover:border-surface-300'
              )}
            >
              {m === 'telebirr' ? '📱 Telebirr' : m === 'cbe' ? '🏦 CBE' : '💰 Other'}
            </button>
          ))}
        </div>
      </div>

      {/* Amount and Reference */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Amount paid (ETB) *</label>
          <input type="number" className="input" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="1,200" />
        </div>
        <div>
          <label className="label">Reference Number</label>
          <input type="text" className="input font-mono" value={referenceNumber}
            onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g. TF298A" />
        </div>
      </div>

      {/* Drag-drop file */}
      <div>
        <label className="label">Payment screenshot *</label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all',
            dragOver ? 'border-brand-400 bg-brand-50 scale-[1.01]' : 'border-default hover:border-brand-300 hover:bg-surface-50'
          )}
        >
          {file ? (
            <>
              <img src={URL.createObjectURL(file)} alt="Preview"
                className="w-24 h-24 object-cover rounded-xl border border-default mb-1" />
              <p className="text-sm font-semibold text-surface-700">{file.name}</p>
              <p className="text-xs text-surface-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-surface-300" />
              <p className="text-sm font-semibold text-surface-600">Drop screenshot here or click to browse</p>
              <p className="text-xs text-surface-400">JPG, PNG · Max 5 MB</p>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>

      {/* Note */}
      <div>
        <label className="label">Note (optional)</label>
        <textarea className="textarea" rows={2} value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Additional details..." />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <button onClick={submit} disabled={loading || !file || !amount}
        className="btn-primary w-full justify-center gap-2" id="submit-payment-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {loading ? 'Submitting…' : 'Submit Payment Proof'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [planChangeTarget, setPlanChangeTarget] = useState<SubscriptionPlan | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [planChangeLoading, setPlanChangeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 60_000,
  });

  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => billingApi.plans() as Promise<SubscriptionPlan[]>,
  });

  const { data: proofs = [], refetch: refetchProofs } = useQuery<PaymentProof[]>({
    queryKey: ['billing-proofs'],
    queryFn: () => billingApi.proofs() as Promise<PaymentProof[]>,
  });

  const sub = usageData?.subscription as SubData | null;
  const usage = usageData?.usage;
  const paymentFailed = usageData?.payment_failed ?? false;
  const paymentFailedReason = usageData?.payment_failed_reason ?? null;
  const gracePeriodEndsAt = usageData?.grace_period_ends_at ?? null;

  const daysUntilExpiry = sub?.current_period_end
    ? Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;

  const currentPlanIdx = plans.findIndex(p => p.id === sub?.plan_id);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['billing-usage'] });
    qc.invalidateQueries({ queryKey: ['billing-proofs'] });
  };

  const handlePlanChange = async () => {
    if (!planChangeTarget) return;
    setPlanChangeLoading(true);
    try {
      await billingApi.upgradePlan(planChangeTarget.id);
      setPlanChangeTarget(null);
      invalidateAll();
    } catch { /* noop */ }
    finally { setPlanChangeLoading(false); }
  };

  const handleCancel = async (reason: string) => {
    setCancelLoading(true);
    try {
      await billingApi.cancelSubscription(reason, false);
      setShowCancelModal(false);
      invalidateAll();
    } catch { /* noop */ }
    finally { setCancelLoading(false); }
  };

  const handleReactivate = async () => {
    setReactivateLoading(true);
    try {
      await billingApi.reactivateSubscription();
      invalidateAll();
    } catch { /* noop */ }
    finally { setReactivateLoading(false); }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-4xl space-y-6">

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Subscription, usage, and payment history</p>
        </div>
        <button onClick={invalidateAll} className="btn-secondary btn-sm gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Alert: failed payment ── */}
      {paymentFailed && (
        <div className="flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-3xl shadow-sm animate-fade-in" id="payment-failed-banner">
          <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800">Payment rejected</p>
            <p className="text-sm text-red-700 mt-0.5">{paymentFailedReason}</p>
            {gracePeriodEndsAt && (
              <p className="text-xs text-red-600 mt-1">
                ⏳ Grace period ends {formatRelative(gracePeriodEndsAt)} — submit a corrected payment to avoid suspension.
              </p>
            )}
          </div>
          <a href="#submit-payment" className="btn btn-sm bg-red-600 hover:bg-red-700 text-white flex-shrink-0">
            Submit Payment <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ── Alert: expiring soon ── */}
      {!paymentFailed && isExpiringSoon && (
        <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-3xl shadow-sm animate-fade-in">
          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-800">Subscription expiring in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</p>
            <p className="text-sm text-amber-700 mt-0.5">Submit a payment proof before {formatDate(sub!.current_period_end)} to avoid service interruption.</p>
          </div>
          <a href="#submit-payment" className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0 gap-1">
            Pay now <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ── Cancellation notice ── */}
      {sub?.cancel_at_period_end && (
        <div className="flex items-center gap-4 p-4 bg-surface-50 border border-default rounded-3xl">
          <Ban className="w-5 h-5 text-muted flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-bold text-surface-800">Cancels on {formatDate(sub.current_period_end)}</span>
            <span className="text-muted ml-2">— you have full access until then.</span>
          </div>
          <button onClick={handleReactivate} disabled={reactivateLoading}
            className="btn-secondary btn-sm gap-1.5 flex-shrink-0">
            {reactivateLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reactivate
          </button>
        </div>
      )}

      {/* ── Current plan + usage ── */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-brand-500" />
            </div>
            <div>
              <p className="text-sm text-muted mb-0.5">Current plan</p>
              <h2 className="font-display font-bold text-2xl text-primary">
                {usageLoading ? '—' : sub?.plan_name ?? 'No plan'}
              </h2>
            </div>
          </div>
          <StatusBadge status={sub?.status ?? 'expired'} />
        </div>

        {/* Billing details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Monthly price', value: sub ? `ETB ${sub.price_monthly.toLocaleString()}` : '—' },
            { label: 'Billing cycle', value: sub?.billing_cycle ?? '—' },
            { label: 'Period ends', value: sub?.current_period_end ? formatDate(sub.current_period_end) : '—' },
            { label: 'POS terminals', value: sub?.max_pos_terminals != null ? `1 of ${sub.max_pos_terminals}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 bg-surface-50 rounded-2xl">
              <p className="text-xs text-muted mb-0.5">{label}</p>
              <p className="font-bold text-primary text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* Usage meters */}
        {sub && usage && (
          <div className="space-y-3 mb-6 p-4 bg-surface-50 rounded-2xl">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Usage</p>
            <UsageMeter label="Staff seats" used={usage.staff_count} max={sub.max_staff} icon={Users} />
            <UsageMeter label="POS Terminals" used={1} max={sub.max_pos_terminals} icon={Monitor} />
          </div>
        )}

        {/* Features */}
        {sub && (
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'kds',         label: 'Kitchen Display' },
              { key: 'inventory',   label: 'Inventory' },
              { key: 'multi_branch',label: 'Multi-branch' },
            ].map(({ key, label }) => {
              const enabled = Boolean((sub.features as Record<string, unknown>)[key]);
              return (
                <span key={key} className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                  enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-surface-100 text-surface-400 border-default line-through'
                )}>
                  {enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
                </span>
              );
            })}
          </div>
        )}

        {/* Cancel button */}
        {sub && sub.status !== 'cancelled' && !sub.cancel_at_period_end && (
          <div className="border-t border-surface-100 pt-4">
            <button onClick={() => setShowCancelModal(true)}
              className="text-xs text-surface-400 hover:text-red-600 transition-colors flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" /> Cancel subscription
            </button>
          </div>
        )}
      </div>

      {/* ── Plan comparison ── */}
      {plans.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg text-primary mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-500" /> Available Plans
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan, idx) => {
              const isCurrent = plan.id === sub?.plan_id;
              const isUpgrade = idx > currentPlanIdx;
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrent={isCurrent}
                  isUpgrade={isUpgrade}
                  isDowngrade={!isCurrent && !isUpgrade}
                  onSelect={() => setPlanChangeTarget(plan)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Submit payment ── */}
      <div className="card" id="submit-payment">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-primary">Submit Payment</h3>
            <p className="text-sm text-muted">Telebirr, CBE, or bank transfer</p>
          </div>
        </div>
        <PaymentSubmitSection subscriptionId={sub?.id} onSuccess={() => { refetchProofs(); invalidateAll(); }} />
      </div>

      {/* ── Payment history ── */}
      <div className="card">
        <h3 className="font-display font-bold text-lg text-primary mb-5">Payment History</h3>

        {proofs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-surface-100 rounded-3xl flex items-center justify-center mx-auto mb-3">
              <Package className="w-7 h-7 text-surface-300" />
            </div>
            <p className="text-sm font-semibold text-muted">No payments yet</p>
            <p className="text-xs text-surface-400 mt-0.5">Submit your first payment proof above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proofs.map(proof => (
              <div key={proof.id}
                className="flex items-center gap-4 p-4 bg-surface-50/80 rounded-2xl border border-surface-100 hover:border-default transition-all">
                {/* Status icon */}
                <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0', {
                  'bg-emerald-100': proof.status === 'approved',
                  'bg-red-100':     proof.status === 'rejected',
                  'bg-amber-100':   proof.status === 'pending',
                })}>
                  {proof.status === 'approved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                   proof.status === 'rejected' ? <XCircle className="w-5 h-5 text-red-600" /> :
                   <Clock className="w-5 h-5 text-amber-600" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-primary text-sm">{formatCurrency(proof.amount)}</p>
                    <span className="text-xs text-surface-400 capitalize">· {proof.payment_method}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{formatRelative(proof.submitted_at)}</p>
                  {proof.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {proof.rejection_reason}
                    </p>
                  )}
                </div>

                {/* Screenshot thumbnail */}
                {proof.screenshot_url && (
                  <button onClick={() => setLightboxUrl(proof.screenshot_url)}
                    className="w-12 h-12 rounded-xl overflow-hidden border border-default flex-shrink-0 hover:border-brand-300 hover:shadow-md transition-all relative group">
                    <img src={proof.screenshot_url} alt="Proof" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                    </div>
                  </button>
                )}

                {/* Status badge */}
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0', {
                  'bg-emerald-50 text-emerald-700 border-emerald-200': proof.status === 'approved',
                  'bg-red-50 text-red-700 border-red-200':             proof.status === 'rejected',
                  'bg-amber-50 text-amber-700 border-amber-200':       proof.status === 'pending',
                })}>
                  {proof.status.charAt(0).toUpperCase() + proof.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {planChangeTarget && sub && (
        <PlanChangeModal
          selectedPlan={planChangeTarget}
          currentPlan={sub}
          isUpgrade={plans.findIndex(p => p.id === planChangeTarget.id) > currentPlanIdx}
          onConfirm={handlePlanChange}
          onClose={() => setPlanChangeTarget(null)}
          loading={planChangeLoading}
        />
      )}

      {showCancelModal && sub && (
        <CancelModal
          sub={sub}
          onConfirm={handleCancel}
          onClose={() => setShowCancelModal(false)}
          loading={cancelLoading}
        />
      )}

      {/* Screenshot lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-2xl w-full animate-fade-in" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Payment proof" className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
