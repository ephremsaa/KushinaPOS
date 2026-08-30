import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Package, Check, X, Shield, Sparkles, Layers } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { SubscriptionPlan } from '../../types';

function PlanModal({ plan, onClose }: { plan?: SubscriptionPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    price_monthly: plan?.price_monthly ?? 0,
    price_annual: plan?.price_annual ?? 0,
    max_staff: plan?.max_staff ?? 5,
    max_pos_terminals: plan?.max_pos_terminals ?? 1,
    kds: plan?.features?.kds ?? false,
    inventory: plan?.features?.inventory ?? false,
  });
  const [loading, setLoading] = useState(false);
  const upd = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setLoading(true);
    const payload = {
      name: form.name,
      price_monthly: Number(form.price_monthly),
      price_annual: Number(form.price_annual),
      max_staff: Number(form.max_staff),
      max_pos_terminals: Number(form.max_pos_terminals),
      features: { kds: form.kds, inventory: form.inventory },
    };
    if (plan) {
      await adminApi.updatePlan(plan.id, payload);
    } else {
      await adminApi.createPlan(payload);
    }
    qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-display font-bold text-lg text-white">{plan ? 'Edit Subscription Tier' : 'Create Subscription Tier'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Plan Name</label>
            <input 
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all" 
              value={form.name} 
              onChange={(e) => upd('name', e.target.value)} 
              placeholder="e.g. Starter, Growth, Pro" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Monthly Price (ETB)</label>
              <input 
                type="number" 
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-mono font-bold" 
                value={form.price_monthly} 
                onChange={(e) => upd('price_monthly', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Annual Price (ETB)</label>
              <input 
                type="number" 
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-mono font-bold" 
                value={form.price_annual} 
                onChange={(e) => upd('price_annual', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Max Staff</label>
              <input 
                type="number" 
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-bold" 
                value={form.max_staff} 
                onChange={(e) => upd('max_staff', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Max Terminals</label>
              <input 
                type="number" 
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-bold" 
                value={form.max_pos_terminals} 
                onChange={(e) => upd('max_pos_terminals', e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Features Included</label>
            {[['kds', 'Kitchen Display System (KDS)'], ['inventory', 'Inventory Management']].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded text-orange-500 focus:ring-orange-500 bg-slate-950 border-slate-700" 
                  checked={(form as any)[key]} 
                  onChange={(e) => upd(key, e.target.checked)} 
                />
                <span className="text-xs font-bold text-white">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs flex-1">Cancel</button>
          <button 
            onClick={save} 
            disabled={loading || !form.name} 
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs flex-1 shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Saving…' : plan ? 'Save Plan Changes' : 'Create Plan Tier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPlans() {
  const [modal, setModal] = useState<{ open: boolean; plan?: SubscriptionPlan }>({ open: false });
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const data = await adminApi.plans();
      return (data ?? []) as SubscriptionPlan[];
    },
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Subscription Plan Tiers
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure pricing, staff limits, and feature flags for tenant plans
          </p>
        </div>
        <button 
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs transition-all shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-2 self-start sm:self-center"
          onClick={() => setModal({ open: true })}
        >
          <Plus className="w-4 h-4" /> Create New Tier
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="h-64 bg-slate-950/80 rounded-3xl animate-pulse" />) :
          plans.map((plan) => (
            <div key={plan.id} className="p-6 rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all relative overflow-hidden group">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Package className="w-6 h-6" />
                  </div>
                  <button
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    onClick={() => setModal({ open: true, plan })}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-display font-black text-xl text-white">{plan.name} Tier</h3>
                <div className="my-3">
                  <p className="text-3xl font-black text-white font-mono">
                    {formatCurrency(plan.price_monthly)}
                    <span className="text-xs font-normal text-slate-400 font-sans"> /month</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(plan.price_annual)} billed annually</p>
                </div>

                <ul className="text-xs text-slate-300 space-y-2 mt-4 pt-4 border-t border-slate-800">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" /> Up to <strong>{plan.max_staff} staff members</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" /> <strong>{plan.max_pos_terminals} POS terminal{plan.max_pos_terminals > 1 ? 's' : ''}</strong>
                  </li>
                  {plan.features?.kds && (
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Kitchen Display System (KDS)
                    </li>
                  )}
                  {plan.features?.inventory && (
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Inventory & Recipe Management
                    </li>
                  )}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                  plan.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                }`}>
                  {plan.is_active ? 'Active Tier' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        }
      </div>

      {modal.open && (
        <PlanModal plan={modal.plan} onClose={() => setModal({ open: false })} />
      )}
    </div>
  );
}

