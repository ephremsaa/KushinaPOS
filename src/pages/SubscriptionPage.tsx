import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChefHat, CheckCircle2, Zap, Users, Monitor, BarChart3,
  Globe, Shield, Loader2, ArrowRight, Sparkles, Star,
  BadgeCheck, Clock, CreditCard,
} from 'lucide-react';
import { billingApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  max_staff: number;
  max_pos_terminals: number;
  features: Record<string, unknown>;
  is_active: boolean;
}

// ─────────────────────────────────────────────────────────────
// Feature row helper
// ─────────────────────────────────────────────────────────────
function FeatureRow({ label, value, highlight = false }: { label: string; value: string | boolean; highlight?: boolean }) {
  const isTrue = value === true;
  const isFalse = value === false;
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0 ${highlight ? 'text-orange-300' : ''}`}>
      <span className="text-xs text-slate-400">{label}</span>
      {isTrue ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      ) : isFalse ? (
        <span className="text-slate-600 text-xs">—</span>
      ) : (
        <span className={`text-xs font-semibold ${highlight ? 'text-orange-300' : 'text-slate-200'}`}>{value}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Plan Card
// ─────────────────────────────────────────────────────────────
interface PlanCardProps {
  plan: Plan;
  isPopular?: boolean;
  billingCycle: 'monthly' | 'annual';
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
}

const PLAN_ACCENT: Record<string, { border: string; bg: string; badge: string; glow: string }> = {
  Starter:    { border: 'border-slate-700 hover:border-orange-500/50',   bg: 'bg-slate-900/60',   badge: 'bg-slate-700', glow: '' },
  Growth:     { border: 'border-orange-500/60 hover:border-orange-400',  bg: 'bg-slate-900/80',   badge: 'bg-orange-500', glow: 'shadow-[0_0_40px_rgba(249,115,22,0.2)]' },
  Enterprise: { border: 'border-indigo-500/50 hover:border-indigo-400',  bg: 'bg-slate-900/70',   badge: 'bg-indigo-600', glow: '' },
};

function PlanCard({ plan, isPopular, billingCycle, isSelected, isLoading, onSelect }: PlanCardProps) {
  const accent = PLAN_ACCENT[plan.name] ?? PLAN_ACCENT.Starter;
  const priceMonthly = Number(plan.price_monthly || 0);
  const priceAnnual = Number(plan.price_annual || 0);
  const displayPrice = billingCycle === 'annual' ? priceAnnual / 12 : priceMonthly;
  const save = billingCycle === 'annual' && priceMonthly > 0
    ? Math.round(((priceMonthly - priceAnnual / 12) / priceMonthly) * 100)
    : 0;

  const features = typeof plan.features === 'string'
    ? JSON.parse(plan.features)
    : (plan.features as Record<string, unknown> || {});
  const onlineOrdering  = features?.online_ordering  === true || features?.online_ordering  === 'true';
  const advancedReports = features?.advanced_reports === true || features?.advanced_reports === 'true';
  const multiBranch     = features?.multi_branch     === true || features?.multi_branch     === 'true';
  const prioritySupport = features?.priority_support === true || features?.priority_support === 'true';

  const iconEl = plan.name === 'Starter'
    ? <Zap className="w-4 h-4 text-orange-400" />
    : plan.name === 'Growth'
    ? <BarChart3 className="w-4 h-4 text-amber-400" />
    : <Shield className="w-4 h-4 text-indigo-400" />;

  return (
    <div
      className={`relative flex flex-col rounded-3xl border-2 transition-all duration-300 cursor-pointer select-none
        ${accent.border} ${accent.bg} ${accent.glow} backdrop-blur-xl
        ${isSelected ? 'scale-[1.02] ring-2 ring-orange-500/40' : 'hover:scale-[1.01]'}`}
      onClick={!isLoading ? onSelect : undefined}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${accent.badge} text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap`}>
          <Star className="w-3 h-3 fill-white" /> Most Popular
        </div>
      )}

      <div className="p-6 flex flex-col h-full">
        {/* Plan name + icon */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
            {iconEl}
          </div>
          <h3 className="font-display font-bold text-lg text-white">{plan.name}</h3>
        </div>

        {/* Price */}
        <div className="mb-1">
          <div className="flex items-end gap-1.5">
            <span className="text-3xl font-display font-extrabold text-white">
              {priceMonthly === 0 ? 'Free' : `ETB ${displayPrice.toLocaleString()}`}
            </span>
            {priceMonthly > 0 && (
              <span className="text-slate-400 text-sm pb-1">/mo</span>
            )}
          </div>
          {billingCycle === 'annual' && priceMonthly > 0 && save > 0 && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              <span className="text-orange-400 font-semibold">Save {save}%</span>
              {' '}· billed ETB {priceAnnual.toLocaleString()}/year
            </p>
          )}
          {billingCycle === 'monthly' && priceMonthly > 0 && (
            <p className="text-[11px] text-slate-500 mt-0.5">billed monthly</p>
          )}
        </div>

        {/* Trial pill */}
        <div className="inline-flex items-center gap-1.5 mt-2 mb-5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit">
          <Clock className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-400">14-day free trial</span>
        </div>

        {/* Feature list */}
        <div className="flex-1 mb-5">
          <FeatureRow label="Staff seats"       value={`Up to ${plan.max_staff}`}          highlight={isPopular} />
          <FeatureRow label="POS terminals"     value={String(plan.max_pos_terminals)} />
          <FeatureRow label="Online ordering"   value={onlineOrdering} />
          <FeatureRow label="Advanced reports"  value={advancedReports} />
          <FeatureRow label="Multiple branches" value={multiBranch} />
          <FeatureRow label="Priority support"  value={prioritySupport} />
        </div>

        {/* CTA button */}
        <button
          onClick={onSelect}
          disabled={isLoading}
          id={`plan-select-${plan.name.toLowerCase()}`}
          className={`w-full py-3 px-5 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer
            ${isPopular
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.35)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white active:scale-[0.98]'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isLoading && isSelected ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Setting up…</span>
            </>
          ) : (
            <>
              <span>Start with {plan.name}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => billingApi.plans() as unknown as Promise<Plan[]>,
  });

  async function handleSelectPlan(planId: string) {
    setSelectedPlanId(planId);
    setLoading(true);
    setError('');
    try {
      await billingApi.subscribe(planId, billingCycle);
      // Refresh auth user so hasSubscription flips to true
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start subscription. Please try again.');
      setSelectedPlanId(null);
    } finally {
      setLoading(false);
    }
  }

  const popularPlan = plans.find(p => p.name === 'Growth') ?? plans[Math.floor(plans.length / 2)];

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[32rem] h-[32rem] bg-orange-500/12 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-[130px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[50rem] h-[50rem] bg-indigo-900/8 rounded-full blur-[180px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Header */}
        <div className="text-center mb-12">
          {/* Logo wordmark */}
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">kushinaPOS</span>
          </div>

          {/* Approval celebration badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-semibold mb-5">
            <Sparkles className="w-4 h-4" />
            <span>Your restaurant has been approved! 🎉</span>
            <BadgeCheck className="w-4 h-4" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            Choose your plan
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Every plan starts with a <strong className="text-white">14-day free trial</strong>.
            No payment required until your trial ends — cancel anytime before then.
          </p>

          {/* Billing cycle toggle */}
          <div className="inline-flex items-center mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1 shadow-inner">
            <button
              onClick={() => setBillingCycle('monthly')}
              id="billing-monthly"
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              id="billing-annual"
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Annual
              <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        {plansLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold text-slate-300">Plans not yet configured</p>
            <p className="text-sm mt-2">
              Contact{' '}
              <a href="mailto:support@kushina.pos" className="text-orange-400 hover:underline">
                support@kushina.pos
              </a>{' '}
              to activate your account manually.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              plans.length === 1
                ? 'max-w-sm mx-auto'
                : plans.length === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isPopular={plan.id === popularPlan?.id}
                billingCycle={billingCycle}
                isSelected={selectedPlanId === plan.id}
                isLoading={loading}
                onSelect={() => handleSelectPlan(plan.id)}
              />
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-6 max-w-lg mx-auto p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Trust strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>No credit card to start</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Cancel before trial ends — stay free</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Upgrade or downgrade anytime</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>Pay via Telebirr · CBE · Other</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5" />
            <span>Works offline</span>
          </div>
        </div>

        {/* Billing note */}
        <p className="mt-8 text-center text-xs text-slate-600 max-w-xl mx-auto">
          After your trial, upload a payment screenshot via your dashboard → Billing. Our admin team confirms it within 1–2 business days.
        </p>

      </div>
    </div>
  );
}
