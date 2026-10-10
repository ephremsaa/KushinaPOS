import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, CheckCheck, Package, CreditCard, Calendar, Clock, 
  AlertTriangle, ShoppingBag, ShieldAlert, Search, RefreshCw, 
  ExternalLink, Sparkles, Filter, Settings
} from 'lucide-react';
import { notificationApi } from '../../lib/api';
import { formatRelative, formatDateTime } from '../../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import type { Notification, NotificationType } from '../../types';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'low_stock':
      return <Package className="w-5 h-5 text-amber-500" />;
    case 'payment_failed':
    case 'billing':
      return <CreditCard className="w-5 h-5 text-rose-500" />;
    case 'new_reservation':
      return <Calendar className="w-5 h-5 text-blue-500" />;
    case 'order_stuck':
      return <Clock className="w-5 h-5 text-orange-500" />;
    case 'staff_anomaly':
      return <AlertTriangle className="w-5 h-5 text-purple-500" />;
    case 'new_online_order':
      return <ShoppingBag className="w-5 h-5 text-emerald-500" />;
    default:
      return <ShieldAlert className="w-5 h-5 text-slate-500" />;
  }
}

function getActionRoute(type: NotificationType): { label: string; url: string } | null {
  switch (type) {
    case 'low_stock':
      return { label: 'Go to Inventory', url: '/dashboard/inventory' };
    case 'new_online_order':
    case 'order_stuck':
      return { label: 'View Orders', url: '/dashboard/orders' };
    case 'payment_failed':
    case 'billing':
      return { label: 'Manage Billing', url: '/dashboard/billing' };
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-notifications'],
    queryFn: () => notificationApi.list(),
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleTriggerTest = async (type: string) => {
    setTestingType(type);
    try {
      await notificationApi.testTrigger(type);
      await refetch();
      qc.invalidateQueries({ queryKey: ['user-notifications'] });
    } finally {
      setTestingType(null);
    }
  };

  const handleMarkRead = async (id: string) => {
    await notificationApi.markRead(id);
    qc.invalidateQueries({ queryKey: ['user-notifications'] });
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    qc.invalidateQueries({ queryKey: ['user-notifications'] });
  };

  const filtered = notifications.filter((n) => {
    const matchesSearch = 
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || n.type === typeFilter;
    const matchesUnread = !unreadOnly || !n.is_read;
    return matchesSearch && matchesType && matchesUnread;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/80 p-6 rounded-3xl border border-default/80 shadow-card backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand-50 text-brand-600 border border-brand-200 flex items-center gap-1">
              <Bell className="w-3 h-3" /> Real-time Alert Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-primary tracking-tight">
            Notifications & Alerts
          </h1>
          <p className="text-muted text-sm mt-1">
            Role-routed operational warnings, stock thresholds, billing events, and system alerts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2.5 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <CheckCheck className="w-4 h-4 text-brand-600" /> Mark All Read ({unreadCount})
            </button>
          )}
          <Link
            to="/dashboard/settings"
            className="px-4 py-2.5 rounded-2xl bg-surface-100 border border-default text-surface-700 hover:bg-surface-200 font-bold text-xs transition-all flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4" /> Preferences
          </Link>
        </div>
      </div>

      {/* Simulator Test Bar */}
      <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Alert Trigger Simulator (Testing Console)
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Click to dispatch test notification to engine</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['low_stock', '⚠️ Low Stock Warning'],
            ['payment_failed', '🚨 Payment Failure'],
            ['new_reservation', '📅 Table Reservation'],
            ['order_stuck', '⏱️ Kitchen Delay'],
            ['staff_anomaly', '⏰ Clock-In Anomaly'],
            ['new_online_order', '🛍️ New Online Order'],
            ['billing', '💳 Billing Renewal'],
          ].map(([t, label]) => (
            <button
              key={t}
              disabled={testingType === t}
              onClick={() => handleTriggerTest(t)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {testingType === t ? 'Dispatching…' : label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface/60 p-4 rounded-3xl border border-default/80 shadow-sm backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="w-full rounded-2xl border border-default bg-surface pl-10 pr-4 py-2 text-xs text-primary placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
            placeholder="Search alerts by title or message content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <select
            className="rounded-2xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Alert Types</option>
            <option value="low_stock">Low Stock</option>
            <option value="payment_failed">Payment Failed</option>
            <option value="new_reservation">Table Reservation</option>
            <option value="order_stuck">Order Stuck</option>
            <option value="staff_anomaly">Staff Anomaly</option>
            <option value="new_online_order">New Online Order</option>
            <option value="billing">Billing & Renewal</option>
          </select>

          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
              unreadOnly
                ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                : 'bg-surface text-surface-600 border-default hover:bg-surface-100'
            }`}
          >
            Unread Only ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-surface rounded-3xl animate-pulse border border-default/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-surface border border-default/80 shadow-card">
          <Bell className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg text-primary">No Notifications Found</h3>
          <p className="text-muted text-xs mt-1">
            {unreadOnly ? 'You have read all your notifications!' : 'Try adjusting your search or filter options.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const action = getActionRoute(n.type);
            return (
              <div
                key={n.id}
                className={`p-5 rounded-3xl bg-surface border shadow-card transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative group ${
                  !n.is_read ? 'border-brand-300 ring-2 ring-brand-500/10 bg-brand-50/20' : 'border-default/80'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-surface-100 border border-default/80 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm font-bold text-primary ${!n.is_read ? 'text-brand-950 font-black' : ''}`}>
                        {n.title}
                      </h4>
                      {!n.is_read && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-brand-500 text-white shadow-xs">
                          New
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-surface-100 text-surface-600 border border-default">
                        {n.target_role}
                      </span>
                    </div>

                    <p className="text-xs text-surface-600 leading-relaxed">{n.message}</p>

                    <p className="text-[11px] text-surface-400 font-mono mt-1">
                      {formatDateTime(n.created_at)} ({formatRelative(n.created_at)})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark Read
                    </button>
                  )}

                  {action && (
                    <button
                      onClick={() => {
                        if (!n.is_read) handleMarkRead(n.id);
                        navigate(action.url);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-all flex items-center gap-1 shadow-md shadow-brand-500/20 cursor-pointer"
                    >
                      {action.label} <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
