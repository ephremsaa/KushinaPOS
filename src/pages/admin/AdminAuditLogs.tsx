import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search, Shield, UserCheck, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import type { AuditLog } from '../../types';

function getActionBadge(action: string) {
  switch (action) {
    case 'restaurant_approved':
    case 'payment_approved':
    case 'restaurant_reactivated':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'restaurant_rejected':
    case 'payment_rejected':
    case 'restaurant_suspended':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'tenant_impersonated':
      return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold';
    default:
      return 'bg-slate-800 text-slate-400 border border-slate-700';
  }
}

export default function AdminAuditLogs() {
  const [search, setSearch] = useState('');
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const data = await adminApi.auditLogs();
      return (data ?? []) as AuditLog[];
    },
  });

  const filtered = logs.filter((l) =>
    l.action.includes(search.toLowerCase()) ||
    l.actor_email?.includes(search.toLowerCase()) ||
    JSON.stringify(l.metadata).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Immutable Audit Trail
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Recorded history of platform super admin actions, approvals, suspensions, and tenant impersonation sessions
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-sm pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all" 
          placeholder="Search by action, actor admin email, or metadata..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* Audit Log Table */}
      <div className="rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Admin Action</th>
                <th className="py-3.5 px-4">Actor Admin</th>
                <th className="py-3.5 px-4">Target & Metadata Payload</th>
                <th className="py-3.5 px-4">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                [...Array(8)].map((_, i) => <tr key={i}><td colSpan={4} className="p-4"><div className="h-8 bg-slate-900 rounded-xl animate-pulse" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16">
                    <ScrollText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-semibold">No audit logs found</p>
                  </td>
                </tr>
              ) : filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider inline-flex items-center gap-1.5 ${getActionBadge(log.action)}`}>
                      {log.action === 'tenant_impersonated' && <UserCheck className="w-3 h-3 text-orange-400" />}
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-white text-xs">{log.actor_email ?? 'System Engine'}</span>
                  </td>
                  <td className="py-3.5 px-4 max-w-sm">
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80 font-mono text-[11px] text-slate-300 truncate">
                      {JSON.stringify(log.metadata)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

