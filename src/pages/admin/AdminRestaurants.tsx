import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Store, AlertTriangle, CheckCircle2, UserCheck, X } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { Restaurant } from '../../types';

type StatusFilter = 'all' | 'active' | 'pending' | 'suspended' | 'rejected';

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold';
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold';
    case 'suspended':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold';
    case 'rejected':
      return 'bg-red-500/10 text-red-400 border border-red-500/20 font-bold';
    default:
      return 'bg-slate-800 text-slate-400 border border-slate-700 font-bold';
  }
}

export default function AdminRestaurants() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Restaurant | null>(null);

  const [suspendModal, setSuspendModal] = useState<{ open: boolean; restaurant?: Restaurant }>({ open: false });
  const [suspendReason, setSuspendReason] = useState('');

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['all-restaurants', statusFilter],
    queryFn: async () => {
      const res = await adminApi.restaurants(statusFilter);
      return res as unknown as Restaurant[];
    },
  });

  const filtered = restaurants.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspendSubmit = async () => {
    if (!suspendModal.restaurant) return;
    const r = suspendModal.restaurant;
    if (r.status !== 'suspended' && !suspendReason.trim()) return;

    setActionLoading(r.id);
    try {
      await adminApi.suspendRestaurant(r.id, r.status === 'suspended' ? undefined : suspendReason.trim());
      qc.invalidateQueries({ queryKey: ['all-restaurants'] });
      if (selectedTenant?.id === r.id) setSelectedTenant(null);
      setSuspendModal({ open: false });
      setSuspendReason('');
    } catch (err) {
      alert("Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async (r: Restaurant) => {
    if (!window.confirm(`Are you sure you want to impersonate ${r.name}? Your actions will be logged into the audit log.`)) return;
    
    setActionLoading(r.id);
    try {
      const res: any = await adminApi.impersonateTenant(r.id);
      const adminToken = localStorage.getItem('token');
      if (adminToken) localStorage.setItem('admin_token', adminToken);
      localStorage.setItem('token', res.token);
      window.location.href = '/dashboard';
    } catch (err) {
      alert("Failed to impersonate");
      setActionLoading(null);
    }
  };

  return (
    <div className="animate-fade-in flex h-full gap-6 pb-12">
      <div className={`flex-1 flex flex-col ${selectedTenant ? 'hidden lg:flex lg:w-2/3' : 'w-full'}`}>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              Tenant Directory
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Registered restaurants, status overrides, and debugging impersonation
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs self-start sm:self-center">
            Total: {restaurants.length} Tenants
          </span>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap gap-3 mb-6 shrink-0">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-sm pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
              placeholder="Search by restaurant name or owner email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-1 overflow-x-auto">
            {(['all', 'active', 'pending', 'suspended', 'rejected'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 cursor-pointer ${
                  statusFilter === f ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="p-0 flex-1 overflow-hidden flex flex-col rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] z-10">
                <tr>
                  <th className="py-3.5 px-4">Restaurant / Email</th>
                  <th className="py-3.5 px-4">Subscription Plan</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={4} className="p-4"><div className="h-8 bg-slate-900 rounded-xl animate-pulse" /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-slate-500">No restaurants match your search</td></tr>
                ) : filtered.map((r) => (
                  <tr 
                    key={r.id} 
                    className={`cursor-pointer hover:bg-slate-900/60 transition-colors ${selectedTenant?.id === r.id ? 'bg-orange-500/10 border-l-4 border-orange-500' : ''}`}
                    onClick={() => setSelectedTenant(r)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-orange-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                          {r.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{r.name}</p>
                          <p className="text-xs text-slate-400">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-300">
                      {(r as any).plan_name ?? 'Starter (Trial)'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drill-down Drawer */}
      {selectedTenant && (
        <div className="w-full lg:w-1/3 bg-slate-950 border border-slate-800 rounded-3xl overflow-y-auto flex flex-col animate-slide-in p-6 shadow-2xl relative z-10 text-slate-100">
          <button 
            className="absolute top-4 right-4 p-2 bg-slate-900 text-slate-400 rounded-full hover:text-white hover:bg-slate-800 transition-colors"
            onClick={() => setSelectedTenant(null)}>
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white leading-tight">{selectedTenant.name}</h2>
          <p className="text-slate-400 text-xs mt-0.5">{selectedTenant.email}</p>
          <div className="mt-3">
            <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider ${getStatusBadge(selectedTenant.status)}`}>
              {selectedTenant.status}
            </span>
          </div>

          {/* Details list */}
          <div className="my-6 space-y-3.5 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400">Subscription Plan</span>
              <span className="font-bold text-white">{(selectedTenant as any).plan_name || 'Starter (Trial)'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400">Phone Number</span>
              <span className="font-bold text-white">{selectedTenant.phone || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400">City / Location</span>
              <span className="font-bold text-white">{selectedTenant.city || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400">Registered Date</span>
              <span className="font-bold text-white font-mono">{formatDate(selectedTenant.created_at)}</span>
            </div>

            {selectedTenant.rejection_reason && (
               <div className="border border-red-500/30 bg-red-500/10 p-3 rounded-2xl mt-2">
                <span className="text-red-400 font-bold block mb-1">Rejection Note</span>
                <span className="text-red-300 text-xs">{selectedTenant.rejection_reason}</span>
               </div>
            )}
          </div>

          {/* Action triggers */}
          <div className="mt-auto pt-6 space-y-3">
            {selectedTenant.status === 'active' && (
              <button
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
                onClick={() => handleImpersonate(selectedTenant)}
                disabled={actionLoading === selectedTenant.id}
              >
                <UserCheck className="w-4 h-4" /> Impersonate Tenant Dashboard
              </button>
            )}

            {(selectedTenant.status === 'active' || selectedTenant.status === 'suspended') && (
              <button
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedTenant.status === 'suspended' 
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                }`}
                onClick={() => {
                  if (selectedTenant.status === 'suspended') {
                    handleSuspendSubmit();
                  } else {
                    setSuspendModal({ open: true, restaurant: selectedTenant });
                  }
                }}
                disabled={actionLoading === selectedTenant.id}
              >
                {selectedTenant.status === 'suspended' ? (
                  <><CheckCircle2 className="w-4 h-4" /> Reactivate Account</>
                ) : (
                  <><AlertTriangle className="w-4 h-4" /> Suspend Account (ToS)</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suspend Reason Modal */}
      {suspendModal.open && suspendModal.restaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 text-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-lg text-white">Suspend Tenant Account</h3>
              <button onClick={() => setSuspendModal({ open: false })} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                You are about to suspend <strong>{suspendModal.restaurant.name}</strong>. A reason is required and will be logged into the platform audit log.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Reason for Suspension</label>
                <textarea
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all resize-none"
                  rows={3}
                  placeholder="e.g. Terms of service violation, non-payment, fraud investigation..."
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSuspendModal({ open: false })} className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-all flex-1">Cancel</button>
              <button
                onClick={handleSuspendSubmit}
                disabled={!suspendReason.trim() || actionLoading === suspendModal.restaurant.id}
                className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all flex-1 shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
