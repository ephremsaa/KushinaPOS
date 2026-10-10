import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Eye, Clock, ShieldAlert, Sparkles, Building2, MapPin, Mail, Phone, FileText } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatRelative, formatDate } from '../../lib/utils';
import { openPrivateDocument } from '../../lib/assetUrl';

function ApproveModal({ restaurant, onClose }: { restaurant: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const handle = async (action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      if (action === 'approve') {
        await adminApi.approveRestaurant(restaurant.id as string);
      } else {
        await adminApi.rejectRestaurant(restaurant.id as string, reason);
      }
      qc.invalidateQueries({ queryKey: ['pending-restaurants'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-6 text-slate-100" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-white">{restaurant.name as string}</h3>
              <p className="text-xs text-slate-400">Onboarding Application Verification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Business Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'City', val: restaurant.city, Icon: MapPin },
            { label: 'Cuisine Type', val: restaurant.cuisine_type, Icon: Sparkles },
            { label: 'Email', val: restaurant.email, Icon: Mail },
            { label: 'Phone', val: restaurant.phone, Icon: Phone },
            { label: 'Tax ID / TIN', val: restaurant.tax_id, Icon: FileText },
            { label: 'Submitted Date', val: formatDate(restaurant.created_at as string), Icon: Clock },
          ].map(({ label, val, Icon }) => (
            <div key={label} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Icon className="w-3 h-3 text-orange-400" /> {label}
              </p>
              <p className="font-bold text-white text-sm">{String(val || '—')}</p>
            </div>
          ))}
        </div>

        {Boolean(restaurant.business_license_url) && (
          <button 
            onClick={() => openPrivateDocument(restaurant.business_license_url as string)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all text-xs font-bold"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> View Submitted Business License / Documents
            </span>
            <span className="text-[10px] uppercase font-black bg-orange-500/20 px-2 py-0.5 rounded">PDF / Image</span>
          </button>
        )}

        {/* Rejection reason box */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Rejection Reason <span className="text-slate-500 font-normal">(Required if rejecting)</span>
          </label>
          <textarea
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all resize-none"
            rows={3}
            placeholder="e.g. Invalid business TIN registration, unreadable document copy..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-all flex-1">
            Cancel
          </button>
          <button 
            className="px-5 py-3 rounded-2xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 flex-1 cursor-pointer"
            disabled={loading || !reason.trim()} 
            onClick={() => handle('reject')}
          >
            <XCircle className="w-4 h-4" /> Reject Application
          </button>
          <button 
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 flex-1 shadow-lg shadow-emerald-500/20 cursor-pointer"
            disabled={loading} 
            onClick={() => handle('approve')}
          >
            <CheckCircle2 className="w-4 h-4" /> Approve Tenant
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminApprovals() {
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['pending-restaurants'],
    queryFn: () => adminApi.pendingRestaurants() as Promise<Record<string, unknown>[]>,
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Pending Approvals Queue
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {restaurants.length} restaurant application{restaurants.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-950/80 rounded-3xl animate-pulse" />)}</div>
      ) : restaurants.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-display font-bold text-xl text-white mb-2">All Queue Cleared!</h3>
          <p className="text-slate-400 text-sm">There are no pending restaurant onboarding applications requiring review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {restaurants.map(r => (
            <div key={r.id as string} className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-amber-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{r.name as string}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Pending Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    📍 {r.city as string || 'N/A'} · 🍽️ {r.cuisine_type as string || 'General'} · ⏱️ Submitted {formatRelative(r.created_at as string)}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelected(r)} 
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs transition-all shadow-md shadow-orange-500/20 cursor-pointer self-start sm:self-center"
              >
                Inspect & Action
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && <ApproveModal restaurant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

