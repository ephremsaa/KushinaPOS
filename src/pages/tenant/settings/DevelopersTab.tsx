import React, { useState, useEffect } from 'react';
import {
  Key, Webhook, Plus, RotateCw, Trash2, Copy, Check, ExternalLink,
  ShieldAlert, ShieldCheck, AlertCircle, Clock, Globe, Lock, Play,
  FileText, Activity, Send, RefreshCw, Eye, EyeOff, Terminal, Sparkles
} from 'lucide-react';
import { apiKeysApi, webhooksApi } from '../../../lib/api';
import { Button, Input, Modal, Badge, Card } from '../../../components/ui';
import { globalToast } from '../../../components/ui/Toast';
import { cn } from '../../../lib/utils';

const AVAILABLE_SCOPES = [
  { id: 'menu:read', label: 'Menu: Read', desc: 'Read food items, categories, prices, and availability' },
  { id: 'orders:read', label: 'Orders: Read', desc: 'Read order details, customer info, items, and status' },
  { id: 'orders:write', label: 'Orders: Write', desc: 'Create partner orders and transition order lifecycle statuses' },
  { id: 'customers:read', label: 'Customers: Read', desc: 'Read customer profiles, tiers, and loyalty points' },
  { id: 'reports:read', label: 'Reports: Read', desc: 'Access revenue metrics and sales summaries' },
];

const AVAILABLE_EVENTS = [
  { id: 'order.created', label: 'order.created', desc: 'Triggered when a new order is placed (POS, Online, or API)' },
  { id: 'order.status_changed', label: 'order.status_changed', desc: 'Triggered when kitchen or waiter transitions order status' },
  { id: 'order.paid', label: 'order.paid', desc: 'Triggered when confirmed payments cover order total' },
  { id: 'payment.confirmed', label: 'payment.confirmed', desc: 'Triggered when manager confirms cash/mobile money payment' },
];

interface DevelopersTabProps {
  restaurant: any;
  onRefresh?: () => void;
}

export default function DevelopersTab({ restaurant: _restaurant }: DevelopersTabProps) {
  // State
  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);

  // Key creation state
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['menu:read', 'orders:read']);
  const [expiresAt, setExpiresAt] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');
  const [rateLimit, setRateLimit] = useState(60);
  const [creatingKey, setCreatingKey] = useState(false);

  // Key revealed modal
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedKeyName, setRevealedKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Key rotation confirmation modal
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [rotatingKeyName, setRotatingKeyName] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // Webhook creation state
  const [showCreateWebhookModal, setShowCreateWebhookModal] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['order.created', 'order.paid']);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  // Webhook secret revealed modal
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedSecretName, setRevealedSecretName] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Test Ping Modal
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Delivery Logs Drawer / Modal
  const [logsWebhook, setLogsWebhook] = useState<any | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);

  // Load data
  const loadKeys = async () => {
    setLoadingKeys(true);
    try {
      const data = await apiKeysApi.list();
      setKeys(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const data = await webhooksApi.list();
      setWebhooks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load webhooks:', err);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  useEffect(() => {
    loadKeys();
    loadWebhooks();
  }, []);

  // Handle create key
  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      globalToast.error('Please enter a key name');
      return;
    }
    if (selectedScopes.length === 0) {
      globalToast.error('Select at least one scope');
      return;
    }

    setCreatingKey(true);
    try {
      const ips = ipAllowlist
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(Boolean);

      const res = await apiKeysApi.create({
        name: keyName.trim(),
        scopes: selectedScopes,
        expires_at: expiresAt || null,
        ip_allowlist: ips,
        rate_limit_per_minute: rateLimit,
      });

      setShowCreateKeyModal(false);
      setRevealedKey(res.apiKey);
      setRevealedKeyName(res.name);
      setKeyName('');
      setSelectedScopes(['menu:read', 'orders:read']);
      setExpiresAt('');
      setIpAllowlist('');
      loadKeys();
      globalToast.success('API key created successfully');
    } catch (err: any) {
      globalToast.error(err.message || 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  // Handle rotate key
  const handleRotateKey = async () => {
    if (!rotatingKeyId) return;
    setIsRotating(true);
    try {
      const res = await apiKeysApi.rotate(rotatingKeyId);
      setRotatingKeyId(null);
      setRevealedKey(res.apiKey);
      setRevealedKeyName(res.name);
      loadKeys();
      globalToast.success('API key rotated. The old key has been invalidated.');
    } catch (err: any) {
      globalToast.error(err.message || 'Failed to rotate key');
    } finally {
      setIsRotating(false);
    }
  };

  // Handle revoke key
  const handleRevokeKey = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? Any partner using this key will immediately lose access.`)) {
      return;
    }
    try {
      await apiKeysApi.revoke(id);
      loadKeys();
      globalToast.success('API key revoked');
    } catch (err: any) {
      globalToast.error(err.message || 'Failed to revoke key');
    }
  };

  // Handle create webhook
  const handleCreateWebhook = async () => {
    if (!webhookName.trim()) {
      globalToast.error('Please enter an endpoint name');
      return;
    }
    if (!webhookUrl.trim().startsWith('https://')) {
      globalToast.error('Webhook URL must be a valid HTTPS URL');
      return;
    }
    if (selectedEvents.length === 0) {
      globalToast.error('Select at least one event');
      return;
    }

    setCreatingWebhook(true);
    try {
      const res = await webhooksApi.create({
        name: webhookName.trim(),
        url: webhookUrl.trim(),
        events: selectedEvents,
      });

      setShowCreateWebhookModal(false);
      setRevealedSecret(res.secret);
      setRevealedSecretName(res.name);
      setWebhookName('');
      setWebhookUrl('');
      setSelectedEvents(['order.created', 'order.paid']);
      loadWebhooks();
      globalToast.success('Webhook endpoint configured');
    } catch (err: any) {
      globalToast.error(err.message || 'Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  // Handle test webhook
  const handleTestWebhook = async (id: string) => {
    setTestingWebhookId(id);
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await webhooksApi.test(id);
      setTestResult(res);
      loadWebhooks();
      if (res.success) {
        globalToast.success(`Ping verified! Received HTTP ${res.delivery.status_code}`);
      } else {
        globalToast.error(res.message || 'Webhook ping failed');
      }
    } catch (err: any) {
      globalToast.error(err.message || 'Failed to test webhook');
    } finally {
      setIsTesting(false);
    }
  };

  // Handle view deliveries
  const handleViewDeliveries = async (wh: any) => {
    setLogsWebhook(wh);
    setLoadingDeliveries(true);
    try {
      const logs = await webhooksApi.deliveries(wh.id);
      setDeliveries(logs);
    } catch (err: any) {
      console.error('Failed to load deliveries:', err);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  // Handle retry delivery
  const handleRetryDelivery = async (deliveryId: string) => {
    setRetryingDeliveryId(deliveryId);
    try {
      const res = await webhooksApi.retryDelivery(deliveryId);
      if (res.success) {
        globalToast.success('Retry delivered successfully');
      } else {
        globalToast.error(res.message || 'Retry delivery failed');
      }
      if (logsWebhook) {
        const logs = await webhooksApi.deliveries(logsWebhook.id);
        setDeliveries(logs);
      }
    } catch (err: any) {
      globalToast.error(err.message || 'Retry failed');
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, isSecret = false) => {
    navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
    globalToast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── Banner: Developer Hub Quick Links ───────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold tracking-wide border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              KUSHINAPOS DEVELOPER PLATFORM v1
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Partner API & Real-Time Webhook Engine
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Connect delivery dispatchers (BeU, Deliver Addis), automated ERP syncs (Odoo, QuickBooks),
              and internal restaurant dashboards. Authenticated via scoped Bearer tokens with HMAC-SHA256 event signing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/25 active:scale-95"
            >
              <Terminal className="w-4 h-4" />
              Interactive API Docs
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm backdrop-blur-sm transition-all border border-white/10 active:scale-95"
            >
              <FileText className="w-4 h-4" />
              Integration Guide
            </a>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: API KEYS ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              Scoped API Keys
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Manage secret keys for custom partner apps. Keys are hashed using SHA-256 and only revealed once.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateKeyModal(true)}
            icon={<Plus className="w-4 h-4" />}
            className="shadow-sm"
          >
            Create API Key
          </Button>
        </div>

        {loadingKeys ? (
          <div className="p-8 text-center text-stone-400">Loading API keys...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40">
            <Key className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">No active API keys yet</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Create an API key with scoped permissions to connect your external ordering or accounting tools.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-950/40 text-stone-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Key Name & Prefix</th>
                  <th className="py-3 px-4">Scopes</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4">Rate Limit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">{k.name}</div>
                      <div className="font-mono text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                        <span className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                          {k.key_prefix}••••••••
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.isArray(k.scopes) && k.scopes.map((s: string) => (
                          <span
                            key={s}
                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400 text-xs">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400 text-xs">
                      {k.last_used_at ? (
                        <span>{new Date(k.last_used_at).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-stone-400 italic">Never used</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400 text-xs font-mono">
                      {k.rate_limit_per_minute || 60}/min
                    </td>
                    <td className="py-3.5 px-4">
                      {k.is_suspended_by_admin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                          <ShieldAlert className="w-3 h-3" /> Suspended
                        </span>
                      ) : k.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-500">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {k.is_active && !k.is_suspended_by_admin && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setRotatingKeyId(k.id);
                              setRotatingKeyName(k.name);
                            }}
                            title="Rotate Key (Invalidate old key and create new secret)"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRevokeKey(k.id, k.name)}
                            title="Revoke Key"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 2: WEBHOOK ENDPOINTS ────────────────────────── */}
      <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Webhook className="w-5 h-5 text-emerald-600" />
              Webhook Endpoints (Outgoing Events)
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Receive signed JSON payloads in real time. Signed with HMAC-SHA256 with automatic exponential backoff up to 24h.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowCreateWebhookModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Webhook Endpoint
          </Button>
        </div>

        {loadingWebhooks ? (
          <div className="p-8 text-center text-stone-400">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40">
            <Webhook className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">No webhook endpoints configured</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Add your secure HTTPS webhook URL to receive order and payment confirmation notifications automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all bg-white dark:bg-stone-900 shadow-sm",
                  wh.auto_disabled_at
                    ? "border-red-300 dark:border-red-900 bg-red-50/20"
                    : "border-stone-200 dark:border-stone-800"
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 text-base">{wh.name}</h4>
                      {wh.auto_disabled_at ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                          <AlertCircle className="w-3.5 h-3.5" /> Auto-Disabled (Failures Exceeded)
                        </span>
                      ) : wh.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                          Paused
                        </span>
                      )}

                      {wh.failure_count > 0 && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          {wh.failure_count} recent failure{wh.failure_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-xs text-stone-600 dark:text-stone-400 break-all bg-stone-50 dark:bg-stone-950/50 p-2 rounded-lg border border-stone-100 dark:border-stone-800">
                      {wh.url}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-stone-400 font-medium mr-1">Events:</span>
                      {Array.isArray(wh.events) && wh.events.map((ev: string) => (
                        <span
                          key={ev}
                          className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestWebhook(wh.id)}
                      loading={isTesting && testingWebhookId === wh.id}
                      icon={<Play className="w-3.5 h-3.5" />}
                    >
                      Send Test Ping
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDeliveries(wh)}
                      icon={<Activity className="w-3.5 h-3.5" />}
                    >
                      Delivery Logs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const newActive = !wh.is_active;
                        await webhooksApi.update(wh.id, { is_active: newActive });
                        loadWebhooks();
                        globalToast.success(newActive ? 'Webhook activated' : 'Webhook paused');
                      }}
                    >
                      {wh.is_active ? 'Pause' : 'Enable'}
                    </Button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete webhook endpoint "${wh.name}"?`)) {
                          await webhooksApi.delete(wh.id);
                          loadWebhooks();
                          globalToast.success('Webhook deleted');
                        }
                      }}
                      className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                      title="Delete Endpoint"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL: CREATE API KEY ──────────────────────────────── */}
      <Modal
        open={showCreateKeyModal}
        onClose={() => setShowCreateKeyModal(false)}
        title="Create Scoped API Key"
      >
        <div className="space-y-5">
          <Input
            label="Key Name"
            placeholder="e.g. Odoo Inventory Sync or Delivery Bot"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            required
          />

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              Permission Scopes
            </label>
            <div className="space-y-2 border border-stone-200 dark:border-stone-800 rounded-xl p-3 bg-stone-50/50 dark:bg-stone-900/50">
              {AVAILABLE_SCOPES.map((sc) => {
                const checked = selectedScopes.includes(sc.id);
                return (
                  <label
                    key={sc.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, sc.id]);
                        } else {
                          setSelectedScopes(selectedScopes.filter(s => s !== sc.id));
                        }
                      }}
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-left">
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{sc.label}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{sc.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Expiration Date (Optional)"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Rate Limit (Req / Min)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">Standard default: 60 requests per minute</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
              IP Allowlist (Optional)
            </label>
            <textarea
              placeholder="e.g. 197.156.68.10, 102.217.18.0/24 (Leave blank to allow any IP)"
              value={ipAllowlist}
              onChange={(e) => setIpAllowlist(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
            <Button variant="ghost" onClick={() => setShowCreateKeyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={creatingKey} onClick={handleCreateKey}>
              Generate API Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: ONE-TIME KEY REVEAL ─────────────────────────── */}
      <Modal
        open={Boolean(revealedKey)}
        onClose={() => setRevealedKey(null)}
        title="Save Your Secret API Key"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
            <div className="font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Copy your secret key now!
            </div>
            <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
              For security, we store only a cryptographic SHA-256 hash. <strong>You will not be able to view this full key again.</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
              {revealedKeyName}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedKey || ''}
                className="w-full px-3 py-2.5 font-mono text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl select-all"
              />
              <Button
                variant={copiedKey ? 'outline' : 'primary'}
                onClick={() => revealedKey && copyToClipboard(revealedKey)}
                icon={copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              >
                {copiedKey ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <Button variant="primary" onClick={() => setRevealedKey(null)}>
              I Have Saved My Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: ROTATE KEY CONFIRMATION ─────────────────────── */}
      <Modal
        open={Boolean(rotatingKeyId)}
        onClose={() => setRotatingKeyId(null)}
        title="Rotate API Key"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Are you sure you want to rotate the key <strong>"{rotatingKeyName}"</strong>?
          </p>
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
            <strong>Warning:</strong> The old key will immediately stop working. Make sure to update your application or partner systems with the new key right away.
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setRotatingKeyId(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={isRotating} onClick={handleRotateKey}>
              Confirm & Rotate Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: CREATE WEBHOOK ──────────────────────────────── */}
      <Modal
        open={showCreateWebhookModal}
        onClose={() => setShowCreateWebhookModal(false)}
        title="Add Webhook Endpoint"
      >
        <div className="space-y-5">
          <Input
            label="Endpoint Name"
            placeholder="e.g. ERP Invoicing or Telegram Dispatcher"
            value={webhookName}
            onChange={(e) => setWebhookName(e.target.value)}
            required
          />

          <div>
            <Input
              label="Payload Delivery URL (HTTPS Required)"
              placeholder="https://api.yourdomain.com/webhooks/kushina"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              required
            />
            <span className="text-[11px] text-stone-500 mt-1 block">
              SSRF security policy strictly blocks internal IPs, localhost, and non-HTTPS URLs.
            </span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              Subscribe to Events
            </label>
            <div className="space-y-2 border border-stone-200 dark:border-stone-800 rounded-xl p-3 bg-stone-50/50 dark:bg-stone-900/50">
              {AVAILABLE_EVENTS.map((ev) => {
                const checked = selectedEvents.includes(ev.id);
                return (
                  <label
                    key={ev.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, ev.id]);
                        } else {
                          setSelectedEvents(selectedEvents.filter(s => s !== ev.id));
                        }
                      }}
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-left">
                      <div className="text-sm font-mono font-semibold text-stone-900 dark:text-stone-100">{ev.label}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{ev.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
            <Button variant="ghost" onClick={() => setShowCreateWebhookModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={creatingWebhook} onClick={handleCreateWebhook}>
              Save Webhook Endpoint
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: ONE-TIME WEBHOOK SECRET REVEAL ───────────────── */}
      <Modal
        open={Boolean(revealedSecret)}
        onClose={() => setRevealedSecret(null)}
        title="Webhook Signing Secret"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Use this secret key to verify HMAC-SHA256 signatures for endpoint <strong>"{revealedSecretName}"</strong>.
          </p>

          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedSecret || ''}
                className="w-full px-3 py-2.5 font-mono text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl select-all"
              />
              <Button
                variant={copiedSecret ? 'outline' : 'primary'}
                onClick={() => revealedSecret && copyToClipboard(revealedSecret, true)}
                icon={copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              >
                {copiedSecret ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-stone-100 dark:bg-stone-800/80 rounded-xl text-xs font-mono text-stone-700 dark:text-stone-300 overflow-x-auto">
            <code>
              {`// Node.js signature verification
const expected = 't=' + t + ',v1=' + crypto.createHmac('sha256', secret).update(t + '.' + rawBody).digest('hex');`}
            </code>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setRevealedSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: DELIVERY LOGS DRAWER ────────────────────────── */}
      <Modal
        open={Boolean(logsWebhook)}
        onClose={() => setLogsWebhook(null)}
        title={`Delivery Logs: ${logsWebhook?.name || ''}`}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {loadingDeliveries ? (
            <div className="p-8 text-center text-stone-400">Loading delivery attempts...</div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-sm">No delivery logs recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((del) => (
                <div
                  key={del.id}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                      {del.event}
                    </span>
                    <div className="flex items-center gap-2">
                      {del.status === 'success' ? (
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          HTTP {del.status_code || 200} OK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                          {del.status_code ? `HTTP ${del.status_code}` : 'Failed'}
                        </span>
                      )}
                      <span className="text-stone-400 font-mono">{del.duration_ms || 0}ms</span>
                    </div>
                  </div>

                  {del.error_message && (
                    <div className="text-red-600 dark:text-red-400 font-mono text-[11px] bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-100 dark:border-red-900">
                      {del.error_message}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-stone-400 pt-1 border-t border-stone-200/60 dark:border-stone-800/60">
                    <span>{new Date(del.created_at).toLocaleString()} (Attempt {del.attempts}/{del.max_attempts})</span>
                    {del.status !== 'success' && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={retryingDeliveryId === del.id}
                        onClick={() => handleRetryDelivery(del.id)}
                        icon={<RotateCw className="w-3 h-3" />}
                      >
                        Retry Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
