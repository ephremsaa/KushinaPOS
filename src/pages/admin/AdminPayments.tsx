import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Eye, CreditCard, ExternalLink, Building2, Calendar, FileText } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatCurrency, formatRelative, formatDateTime } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { PaymentProof } from '../../types';

function PaymentModal({ proof, onClose }: { proof: PaymentProof; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const handle = async (action: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      if (action === 'approved') {
        await adminApi.approvePayment(proof.id);
      } else {
        await adminApi.rejectPayment(proof.id, reason);
      }

      qc.invalidateQueries({ queryKey: ['payment-proofs'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-6 text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-white">Payment Proof Review</h3>
              <p className="text-xs text-slate-400">{(proof as any).restaurants?.name || 'Tenant Payment'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount Paid</p>
              <p className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(proof.amount, proof.currency)}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Channel</p>
              <p className="text-sm font-bold text-white uppercase">{proof.payment_method}</p>
            </div>
          </div>
          {proof.reference_number && (
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference Number</p>
              <p className="text-sm font-bold text-white font-mono">{proof.reference_number}</p>
            </div>
          )}

          {proof.screenshot_url && (
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
              <a 
                href={proof.screenshot_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 hover:text-orange-300"
              >
                <ExternalLink className="w-4 h-4" /> Open Transfer Receipt Screenshot
              </a>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Rejection Reason <span className="text-slate-500 font-normal">(Required if rejecting)</span>
            </label>
            <textarea
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all resize-none"
              rows={2}
              placeholder="e.g. Unreadable receipt screenshot, transfer reference not found..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs flex-1">
            Cancel
          </button>
          <button
            onClick={() => handle('rejected')}
            disabled={loading || !reason.trim()}
            className="px-4 py-3 rounded-2xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-bold text-xs flex-1 disabled:opacity-50 cursor-pointer"
          >
            Reject Transfer
          </button>
          <button
            onClick={() => handle('approved')}
            disabled={loading}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs flex-1 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Approve Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPayments() {
  const [selected, setSelected] = useState<PaymentProof | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ['payment-proofs', filter],
    queryFn: async () => {
      const data = await adminApi.payments(filter);
      return (data ?? []) as PaymentProof[];
    },
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Manual Payment Proofs
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Verify CBE & Telebirr mobile bank transfer screenshots submitted by tenants
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-1 w-fit">
        {(['pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              filter === f ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-950/80 rounded-3xl animate-pulse" />)}
        </div>
      ) : proofs.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-semibold">No {filter} payment proofs</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Restaurant</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {proofs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{(p as any).restaurants?.name || 'Tenant Account'}</td>
                    <td className="py-3.5 px-4 font-black text-emerald-400 font-mono">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="py-3.5 px-4 uppercase font-bold text-slate-300">{p.payment_method}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{formatRelative(p.submitted_at)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                        p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        p.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                        'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelected(p)}
                        className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <PaymentModal proof={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
