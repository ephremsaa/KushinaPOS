import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Code2, Terminal, Key, Webhook, AlertTriangle, CheckCircle2,
  XCircle, Search, RefreshCw, ShieldAlert, ShieldCheck, Clock,
  Filter, Building2, Send, ExternalLink, HelpCircle, Eye,
  ArrowUpRight, ArrowRight, Ban, Play
} from 'lucide-react';
import { developerAdminApi, webhooksApi } from '../../lib/api';
import { globalToast } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';

export default function AdminApiWebhooks() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'keys' | 'usage' | 'webhooks' | 'integrations'>('keys');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Suspension Modal State
  const [suspendingKey, setSuspendingKey] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  // Queries
  const { data: usageList = [], isLoading: loadingUsage, refetch: refetchUsage } = useQuery({
    queryKey: ['admin-developer-usage'],
    queryFn: () => developerAdminApi.getUsage(),
  });

  const { data: keysList = [], isLoading: loadingKeys, refetch: refetchKeys } = useQuery({
    queryKey: ['admin-developer-keys'],
    queryFn: () => developerAdminApi.getKeys(),
  });

  const { data: failuresList = [], isLoading: loadingFailures, refetch: refetchFailures } = useQuery({
    queryKey: ['admin-webhook-failures'],
    queryFn: () => developerAdminApi.getWebhookFailures(),
  });

  const { data: requestsList = [], isLoading: loadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['admin-integration-requests'],
    queryFn: () => developerAdminApi.getIntegrationRequests(),
  });

  // Suspend / Reinstate Key Mutation
  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended, reason }: { id: string; suspended: boolean; reason?: string }) =>
      developerAdminApi.suspendKey(id, suspended, reason),
    onSuccess: (res, vars) => {
      globalToast.success(vars.suspended ? 'API key suspended.' : 'API key reinstated.');
      qc.invalidateQueries({ queryKey: ['admin-developer-keys'] });
      qc.invalidateQueries({ queryKey: ['admin-developer-usage'] });
      setSuspendingKey(null);
      setSuspendReason('');
    },
    onError: (err: any) => {
      globalToast.error(err.message || 'Action failed.');
    },
    onSettled: () => {
      setIsSuspending(false);
    },
  });

  // Manual Webhook Delivery Retry Mutation
  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => webhooksApi.retryDelivery(deliveryId),
    onSuccess: () => {
      globalToast.success('Webhook delivery re-queued.');
      qc.invalidateQueries({ queryKey: ['admin-webhook-failures'] });
    },
    onError: (err: any) => {
      globalToast.error(err.message || 'Retry failed.');
    },
  });

  // Update Integration Request Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      developerAdminApi.updateIntegrationStatus(id, status),
    onSuccess: () => {
      globalToast.success('Integration request updated.');
      qc.invalidateQueries({ queryKey: ['admin-integration-requests'] });
    },
    onError: (err: any) => {
      globalToast.error(err.message || 'Failed to update status.');
    },
  });

  // Summary Metrics
  const totalKeys = keysList.length;
  const activeKeys = keysList.filter((k: any) => k.is_active && !k.is_suspended_by_admin).length;
  const suspendedKeys = keysList.filter((k: any) => k.is_suspended_by_admin).length;
  const totalRequests = usageList.reduce((acc: number, u: any) => acc + Number(u.total_requests || 0), 0);
  const totalFailures = failuresList.length;
  const pendingRequests = requestsList.filter((r: any) => r.status === 'new').length;

  // Filtered keys
  const filteredKeys = keysList.filter((k: any) => {
    const matchesSearch =
      (k.restaurant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.key_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.key_prefix || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'active') return matchesSearch && k.is_active && !k.is_suspended_by_admin;
    if (statusFilter === 'suspended') return matchesSearch && k.is_suspended_by_admin;
    return matchesSearch;
  });

  const handleToggleSuspend = (k: any) => {
    if (k.is_suspended_by_admin) {
      // Direct reinstate
      suspendMutation.mutate({ id: k.id, suspended: false });
    } else {
      setSuspendingKey(k);
      setSuspendReason('');
    }
  };

  const confirmSuspend = () => {
    if (!suspendingKey) return;
    setIsSuspending(true);
    suspendMutation.mutate({
      id: suspendingKey.id,
      suspended: true,
      reason: suspendReason || 'Administrative suspension',
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl text-white tracking-tight">
                Developers & API Oversight
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor partner API traffic, inspect scoped keys, review failed webhooks, and manage integration leads
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchUsage();
              refetchKeys();
              refetchFailures();
              refetchRequests();
              globalToast.info('Refreshing developer metrics...');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total API Keys</span>
            <Key className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalKeys}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{activeKeys} active</span>
            <span>•</span>
            <span className="text-rose-400 font-semibold">{suspendedKeys} suspended</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">API Requests</span>
            <Terminal className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalRequests.toLocaleString()}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across all restaurant partners</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Tenants</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{usageList.filter((u: any) => u.active_keys > 0).length}</div>
          <p className="text-[11px] text-slate-400 mt-1">With live integration keys</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Webhook Failures</span>
            <Webhook className={cn("w-4 h-4", totalFailures > 0 ? "text-rose-400" : "text-emerald-400")} />
          </div>
          <div className={cn("text-2xl font-black", totalFailures > 0 ? "text-rose-400" : "text-emerald-400")}>
            {totalFailures}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Past 7 days delivery errors</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Integration Leads</span>
            <Send className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{requestsList.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span className="text-amber-400 font-semibold">{pendingRequests} new</span> requests
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('keys')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap',
            activeTab === 'keys'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Key className="w-4 h-4" />
          API Keys ({keysList.length})
        </button>

        <button
          onClick={() => setActiveTab('usage')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap',
            activeTab === 'usage'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Terminal className="w-4 h-4" />
          Restaurant Traffic ({usageList.length})
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap',
            activeTab === 'webhooks'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Webhook className="w-4 h-4" />
          Webhook Failures ({failuresList.length})
          {failuresList.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('integrations')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap',
            activeTab === 'integrations'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Send className="w-4 h-4" />
          Integration Requests ({requestsList.length})
          {pendingRequests > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black border border-amber-500/30">
              {pendingRequests}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search restaurant, key, or prefix..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="all">All Keys</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Key Name & Prefix</th>
                    <th className="py-3 px-4">Scopes</th>
                    <th className="py-3 px-4">Rate Limit</th>
                    <th className="py-3 px-4">Requests</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Used</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingKeys ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Loading API keys...
                      </td>
                    </tr>
                  ) : filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No API keys match the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map((k: any) => (
                      <tr key={k.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{k.restaurant_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{k.restaurant_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{k.key_name}</div>
                          <div className="text-[11px] font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 inline-block mt-0.5">
                            {k.key_prefix}...
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {Array.isArray(k.scopes) && k.scopes.length > 0 ? (
                              k.scopes.map((s: string) => (
                                <span
                                  key={s}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono"
                                >
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500">None</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {k.rate_limit_per_minute || 60} req/min
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-white">
                            {Number(k.request_count || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {k.is_suspended_by_admin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <Ban className="w-3 h-3" /> Suspended
                            </span>
                          ) : !k.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleSuspend(k)}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border inline-flex items-center gap-1.5',
                              k.is_suspended_by_admin
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                            )}
                          >
                            {k.is_suspended_by_admin ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Reinstate
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" /> Suspend Key
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTAURANT TRAFFIC */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">Active Keys</th>
                    <th className="py-3 px-4">Total Requests</th>
                    <th className="py-3 px-4">Active Webhooks</th>
                    <th className="py-3 px-4">Recent Delivery Failures</th>
                    <th className="py-3 px-4">Last API Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingUsage ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Loading traffic overview...
                      </td>
                    </tr>
                  ) : usageList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No restaurant traffic records.
                      </td>
                    </tr>
                  ) : (
                    usageList.map((u: any) => (
                      <tr key={u.restaurant_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{u.restaurant_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{u.restaurant_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                            {u.plan_name || 'Free'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "font-semibold",
                            u.active_keys > 0 ? "text-emerald-400" : "text-slate-500"
                          )}>
                            {u.active_keys} / {u.total_keys}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {Number(u.total_requests || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {u.active_webhooks} / {u.total_webhooks}
                        </td>
                        <td className="py-3 px-4">
                          {u.failed_deliveries > 0 ? (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {u.failed_deliveries} failed
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {u.last_api_activity ? new Date(u.last_api_activity).toLocaleString() : 'No requests yet'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WEBHOOK FAILURES */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Webhook & Event</th>
                    <th className="py-3 px-4">Destination URL</th>
                    <th className="py-3 px-4">Error / HTTP Status</th>
                    <th className="py-3 px-4">Attempts</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingFailures ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Loading webhook failure logs...
                      </td>
                    </tr>
                  ) : failuresList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center py-6">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                          <p className="text-sm font-semibold text-slate-300">All Webhook Deliveries Operational</p>
                          <p className="text-xs text-slate-500 mt-1">No failed or queued retries in the last 7 days.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    failuresList.map((f: any) => (
                      <tr key={f.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{f.restaurant_name}</div>
                          <div className="text-[10px] text-slate-500">{f.webhook_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
                            {f.event}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate font-mono text-[11px] text-slate-400">
                          {f.url}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {f.status_code ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                {f.status_code}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-rose-400 font-mono truncate max-w-xs">
                              {f.error_message || 'HTTP Error'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {f.attempts} / {f.max_attempts}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(f.updated_at || f.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => retryMutation.mutate(f.id)}
                            className="px-2.5 py-1 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                          >
                            <Play className="w-3 h-3" /> Retry Now
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTEGRATION REQUESTS */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Restaurant & Contact</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Requested Integration</th>
                    <th className="py-3 px-4">Use Case / Notes</th>
                    <th className="py-3 px-4">Received</th>
                    <th className="py-3 px-4">Lead Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading integration requests...
                      </td>
                    </tr>
                  ) : requestsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No integration lead requests received yet.
                      </td>
                    </tr>
                  ) : (
                    requestsList.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{r.restaurant_name}</div>
                          <div className="text-[11px] text-slate-400">{r.contact_name}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {r.email && <div>{r.email}</div>}
                          {r.phone && <div className="text-[11px] text-slate-400">{r.phone}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded text-[11px]">
                            {r.integration_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-sm">
                          <p className="line-clamp-2 text-[11px]">{r.use_case_notes || 'No description provided'}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={r.status}
                            onChange={(e) => updateStatusMutation.mutate({ id: r.id, status: e.target.value })}
                            className={cn(
                              'px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none focus:ring-1 transition-all',
                              r.status === 'new'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : r.status === 'contacted'
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                : r.status === 'planned'
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            )}
                          >
                            <option value="new">New Lead</option>
                            <option value="contacted">Contacted</option>
                            <option value="planned">Planned</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {suspendingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-rose-500/30 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 text-slate-100">
            <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <div>
                <h3 className="font-display font-bold text-lg text-white">Suspend Partner API Key</h3>
                <p className="text-xs text-slate-400">Revokes all partner access immediately</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                You are about to administratively suspend the key{' '}
                <strong className="text-white font-mono">{suspendingKey.key_prefix}...</strong> belonging to{' '}
                <strong className="text-orange-400">{suspendingKey.restaurant_name}</strong>.
              </p>
              <p className="text-slate-400">
                All future requests authenticated with this token will return HTTP 403 Forbidden until reinstated.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Suspension Reason (Logged to Audit Trail)
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Terms violation, abnormal rate spiking, partner request..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSuspendingKey(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuspend}
                disabled={isSuspending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40 transition-colors flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                {isSuspending ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
