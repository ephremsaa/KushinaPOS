import React, { useState, useEffect } from 'react';
import {
  Award, Coins, Stamp, Check, AlertCircle, Loader2, Save,
  ShieldCheck, HelpCircle, RefreshCw, Calendar, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { loyaltyApi } from '../../../lib/api';
import { Button, Input, Toggle } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';
import { globalToast } from '../../../components/ui/Toast';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { LoyaltySettings, LoyaltyTransaction } from '../../../types';

interface LoyaltyProgramTabProps {
  restaurant: any;
  onRefresh?: () => void;
}

export default function LoyaltyProgramTab({ restaurant: _restaurant, onRefresh }: LoyaltyProgramTabProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [settings, setSettings] = useState<LoyaltySettings>({
    loyalty_enabled: true,
    loyalty_program_type: 'points',
    loyalty_points_per_100_etb: 10,
    loyalty_point_val_etb: 0.10,
    loyalty_min_redeem_points: 50,
    loyalty_max_bill_share_percent: 50,
    loyalty_expiry_months: 12,
    loyalty_stamp_target: 10,
  });

  const [recentTransactions, setRecentTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Load Settings from API
  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loyaltyApi.getSettings();
      if (data) {
        setSettings({
          loyalty_enabled: Boolean(data.loyalty_enabled),
          loyalty_program_type: data.loyalty_program_type || 'points',
          loyalty_points_per_100_etb: Number(data.loyalty_points_per_100_etb) || 10,
          loyalty_point_val_etb: Number(data.loyalty_point_val_etb) || 0.10,
          loyalty_min_redeem_points: Number(data.loyalty_min_redeem_points) || 50,
          loyalty_max_bill_share_percent: Number(data.loyalty_max_bill_share_percent) || 50,
          loyalty_expiry_months: Number(data.loyalty_expiry_months) || 12,
          loyalty_stamp_target: Number(data.loyalty_stamp_target) || 10,
        });
      }
    } catch (err: any) {
      console.error('Failed to load loyalty settings:', err);
      setError(err?.message || 'Failed to load loyalty program settings');
    } finally {
      setLoading(false);
    }
  };

  // Load Recent Transactions
  const loadLedger = async () => {
    setLoadingLedger(true);
    try {
      const txs = await loyaltyApi.getTransactions({ limit: 10 });
      setRecentTransactions(Array.isArray(txs) ? txs : []);
    } catch (err) {
      console.error('Failed to load loyalty transactions:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadLedger();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await loyaltyApi.updateSettings({
        loyalty_enabled: settings.loyalty_enabled,
        loyalty_program_type: settings.loyalty_program_type,
        loyalty_points_per_100_etb: Number(settings.loyalty_points_per_100_etb),
        loyalty_point_val_etb: Number(settings.loyalty_point_val_etb),
        loyalty_min_redeem_points: Number(settings.loyalty_min_redeem_points),
        loyalty_max_bill_share_percent: Number(settings.loyalty_max_bill_share_percent),
        loyalty_expiry_months: Number(settings.loyalty_expiry_months),
        loyalty_stamp_target: Number(settings.loyalty_stamp_target),
      });
      globalToast.success('Loyalty program settings updated successfully');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Failed to save loyalty settings:', err);
      setError(err?.message || 'Failed to update settings');
      globalToast.error(err?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Computations for helpful preview cards
  const pointsPer100 = Number(settings.loyalty_points_per_100_etb) || 10;
  const pointValue = Number(settings.loyalty_point_val_etb) || 0.10;
  const rewardRatePercent = ((pointsPer100 * pointValue) / 100) * 100;
  const minRedeemValue = (Number(settings.loyalty_min_redeem_points) || 0) * pointValue;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm text-default-500">Loading Loyalty Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-inner">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-default-900 tracking-tight flex items-center gap-2">
              Customer Loyalty Program
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Owner Only
              </span>
            </h2>
            <p className="text-sm text-default-500 mt-0.5">
              Reward repeat patrons with points or digital stamp cards, strictly validated server-side.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-card px-4 py-2.5 rounded-xl border border-default shadow-sm">
          <span className="text-sm font-semibold text-default-700">Program Active</span>
          <Toggle
            checked={settings.loyalty_enabled}
            onChange={(checked) => setSettings((s) => ({ ...s, loyalty_enabled: checked }))}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Program Model Picker */}
      <div className="space-y-4">
        <label className="text-sm font-bold text-default-900 uppercase tracking-wider block">
          Loyalty Program Model
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Points Model */}
          <div
            onClick={() => setSettings((s) => ({ ...s, loyalty_program_type: 'points' }))}
            className={`cursor-pointer relative rounded-2xl p-5 border-2 transition-all ${
              settings.loyalty_program_type === 'points'
                ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/10'
                : 'border-default hover:border-default-400 bg-card'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  settings.loyalty_program_type === 'points' ? 'bg-brand-500 text-white' : 'bg-default-100 text-default-600'
                }`}>
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-default-900">Points Cashback Program</h4>
                  <p className="text-xs text-default-500 mt-0.5">Earn points on every 100 ETB; redeem for order discounts.</p>
                </div>
              </div>
              {settings.loyalty_program_type === 'points' && (
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-default/40 flex items-center justify-between text-xs text-default-600">
              <span>Earn rate: <strong>{pointsPer100} pts / 100 ETB</strong></span>
              <span>Reward rate: <strong>{rewardRatePercent.toFixed(1)}% back</strong></span>
            </div>
          </div>

          {/* Stamp Card Model */}
          <div
            onClick={() => setSettings((s) => ({ ...s, loyalty_program_type: 'stamps' }))}
            className={`cursor-pointer relative rounded-2xl p-5 border-2 transition-all ${
              settings.loyalty_program_type === 'stamps'
                ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/10'
                : 'border-default hover:border-default-400 bg-card'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  settings.loyalty_program_type === 'stamps' ? 'bg-brand-500 text-white' : 'bg-default-100 text-default-600'
                }`}>
                  <Stamp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-default-900">Digital Stamp Card</h4>
                  <p className="text-xs text-default-500 mt-0.5">Every Nth visit or qualifying purchase earns a free reward.</p>
                </div>
              </div>
              {settings.loyalty_program_type === 'stamps' && (
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-default/40 flex items-center justify-between text-xs text-default-600">
              <span>Target: <strong>{settings.loyalty_stamp_target || 10} stamps</strong></span>
              <span>Reward: <strong>1 Free Item</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Program Configuration Parameters */}
      {settings.loyalty_program_type === 'points' ? (
        <div className="bg-card border border-default rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-default/60 pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-default-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-brand-500" />
              Points Earning & Redemption Rules
            </h3>
            <span className="text-xs text-default-500">All calculations strictly server-verified</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">
                Points Earned per 100 ETB Spent
              </label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={settings.loyalty_points_per_100_etb}
                  onChange={(e) => setSettings((s) => ({ ...s, loyalty_points_per_100_etb: Number(e.target.value) || 0 }))}
                  placeholder="e.g. 10"
                />
                <span className="absolute right-3 top-2.5 text-xs text-default-400 font-medium pointer-events-none">
                  Points
                </span>
              </div>
              <p className="text-xs text-default-500 mt-1.5">
                Patron receives {pointsPer100} points when they spend 100 ETB on paid, confirmed orders.
              </p>
            </div>

            <div>
              <label className="label">
                Value of 1 Point in ETB (when redeeming)
              </label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={settings.loyalty_point_val_etb}
                  onChange={(e) => setSettings((s) => ({ ...s, loyalty_point_val_etb: Number(e.target.value) || 0 }))}
                  placeholder="e.g. 0.10"
                />
                <span className="absolute right-3 top-2.5 text-xs text-default-400 font-medium pointer-events-none">
                  ETB / point
                </span>
              </div>
              <p className="text-xs text-default-500 mt-1.5">
                100 points = {formatCurrency(100 * pointValue)} ETB discount at checkout.
              </p>
            </div>

            <div>
              <label className="label">
                Minimum Points Required to Redeem
              </label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={settings.loyalty_min_redeem_points}
                  onChange={(e) => setSettings((s) => ({ ...s, loyalty_min_redeem_points: Number(e.target.value) || 0 }))}
                  placeholder="e.g. 50"
                />
                <span className="absolute right-3 top-2.5 text-xs text-default-400 font-medium pointer-events-none">
                  Points ({formatCurrency(minRedeemValue)})
                </span>
              </div>
              <p className="text-xs text-default-500 mt-1.5">
                Customers cannot redeem fewer than {settings.loyalty_min_redeem_points} points in a single transaction.
              </p>
            </div>

            <div>
              <label className="label">
                Maximum Share of Bill Payable with Points (%)
              </label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="5"
                  max="100"
                  step="5"
                  value={settings.loyalty_max_bill_share_percent}
                  onChange={(e) => setSettings((s) => ({ ...s, loyalty_max_bill_share_percent: Number(e.target.value) || 0 }))}
                  placeholder="e.g. 50"
                />
                <span className="absolute right-3 top-2.5 text-xs text-default-400 font-medium pointer-events-none">
                  % of Subtotal
                </span>
              </div>
              <p className="text-xs text-default-500 mt-1.5">
                Prevents 100% free bills if you wish to enforce cash/card minimums (e.g. max 50% discount).
              </p>
            </div>

            <div>
              <label className="label">
                Points Expiry Period (Months)
              </label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  value={settings.loyalty_expiry_months}
                  onChange={(e) => setSettings((s) => ({ ...s, loyalty_expiry_months: Number(e.target.value) || 0 }))}
                  placeholder="e.g. 12 (0 for no expiry)"
                />
                <span className="absolute right-3 top-2.5 text-xs text-default-400 font-medium pointer-events-none">
                  Months
                </span>
              </div>
              <p className="text-xs text-default-500 mt-1.5">
                Set to 0 to make points permanent with no expiration date.
              </p>
            </div>
          </div>

          {/* Quick Simulation Box */}
          <div className="rounded-xl p-4 bg-default-50 dark:bg-card border border-default flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div className="text-xs text-default-600">
                <p className="font-semibold text-default-900">Example Checkout Scenario:</p>
                <p>
                  A 1,000 ETB bill earns <strong>{10 * pointsPer100} points</strong> ({formatCurrency(10 * pointsPer100 * pointValue)} ETB future value).
                  If redeeming 200 points, customer gets <strong>{formatCurrency(200 * pointValue)}</strong> discount.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-brand-600 bg-brand-50 dark:bg-brand-950/40 px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-900">
                Effective Reward: {rewardRatePercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-default rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-default/60 pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-default-900 flex items-center gap-2">
              <Stamp className="w-4 h-4 text-brand-500" />
              Digital Stamp Card Rules
            </h3>
            <span className="text-xs text-default-500">Every Nth visit is rewarded</span>
          </div>

          <div className="max-w-md">
            <label className="label">
              Stamps Required for Free Reward
            </label>
            <div className="relative mt-1">
              <Input
                type="number"
                min="3"
                max="30"
                step="1"
                value={settings.loyalty_stamp_target}
                onChange={(e) => setSettings((s) => ({ ...s, loyalty_stamp_target: Number(e.target.value) || 10 }))}
                placeholder="e.g. 10"
              />
              <span className="absolute right-3 top-2.5 text-xs text-default-400 font-medium pointer-events-none">
                Stamps
              </span>
            </div>
            <p className="text-xs text-default-500 mt-1.5">
              Patrons receive 1 stamp per confirmed order. On reaching {settings.loyalty_stamp_target || 10} stamps, their next item is on the house.
            </p>
          </div>
        </div>
      )}

      {/* Save Action */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          icon={<Save className="w-4 h-4" />}
          loading={saving}
          onClick={handleSave}
          className="px-6 py-2.5"
        >
          Save Loyalty Configuration
        </Button>
      </div>

      {/* Recent Ledger Audit Trail */}
      <div className="bg-card border border-default rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-default-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-default-500" />
              Recent Loyalty Ledger Activity
            </h3>
            <p className="text-xs text-default-500 mt-0.5">
              Immutable ledger of point awards, redemptions, adjustments and reversals.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadLedger}
            loading={loadingLedger}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-sm text-default-400 bg-default-50 dark:bg-card/40 rounded-xl border border-dashed border-default">
            No loyalty transactions recorded yet. They will appear here once orders are paid and points redeemed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-default-100 dark:bg-default-900/40 text-default-600 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Time</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Points</th>
                  <th className="py-2.5 px-3">Balance After</th>
                  <th className="py-2.5 px-3">Staff / Authorizer</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default/40">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-default-50/50">
                    <td className="py-2.5 px-3 text-default-500 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                        tx.type === 'earn'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : tx.type === 'redeem'
                          ? 'bg-amber-500/10 text-amber-600'
                          : tx.type === 'reverse'
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-blue-500/10 text-blue-600'
                      }`}>
                        {tx.type === 'earn' && <ArrowDownLeft className="w-3 h-3" />}
                        {tx.type === 'redeem' && <ArrowUpRight className="w-3 h-3" />}
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${tx.points >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-default-800">
                      {tx.balance_after} pts
                    </td>
                    <td className="py-2.5 px-3 text-default-600">
                      {tx.staff_name || 'System / Cashier'}
                    </td>
                    <td className="py-2.5 px-3 text-default-500 max-w-xs truncate">
                      {tx.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
