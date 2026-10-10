import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, CheckCheck, Package, CreditCard, Calendar, Clock, 
  AlertTriangle, ShoppingBag, ShieldAlert, ChevronRight, X
} from 'lucide-react';
import { notificationApi } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import type { Notification, NotificationType } from '../types';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'low_stock':
      return <Package className="w-4 h-4 text-amber-500" />;
    case 'payment_failed':
    case 'billing':
      return <CreditCard className="w-4 h-4 text-rose-500" />;
    case 'new_reservation':
      return <Calendar className="w-4 h-4 text-blue-500" />;
    case 'order_stuck':
      return <Clock className="w-4 h-4 text-orange-500" />;
    case 'staff_anomaly':
      return <AlertTriangle className="w-4 h-4 text-purple-500" />;
    case 'new_online_order':
      return <ShoppingBag className="w-4 h-4 text-emerald-500" />;
    default:
      return <ShieldAlert className="w-4 h-4 text-slate-500" />;
  }
}

function getRedirectPath(type: NotificationType): string | null {
  switch (type) {
    case 'low_stock':        return '/dashboard/inventory';
    case 'new_online_order':
    case 'order_stuck':      return '/dashboard/orders';
    case 'payment_failed':
    case 'billing':          return '/dashboard/billing';
    default:                 return '/dashboard/notifications';
  }
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['user-notifications'],
    queryFn: () => notificationApi.list(),
    refetchInterval: 15000, // Poll every 15s for real-time alerts
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationApi.markRead(id);
    qc.invalidateQueries({ queryKey: ['user-notifications'] });
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    qc.invalidateQueries({ queryKey: ['user-notifications'] });
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      await notificationApi.markRead(n.id);
      qc.invalidateQueries({ queryKey: ['user-notifications'] });
    }
    setIsOpen(false);
    const path = getRedirectPath(n.type);
    if (path) navigate(path);
  };

  const filtered = activeTab === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-surface/80 border border-default/80 hover:bg-surface-100 text-surface-700 transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center"
        title="Notification Center"
      >
        <Bell className="w-5 h-5 text-surface-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Drawer / Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl bg-surface border border-default/80 shadow-2xl z-50 overflow-hidden animate-fade-in text-primary">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-100 bg-surface-50/80">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base text-primary">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-brand-50 text-brand-600 border border-brand-200">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Read all
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-surface-400 hover:text-surface-700 rounded-lg hover:bg-surface-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 p-2 bg-surface-100/60 border-b border-surface-100 text-xs">
            <button
              className={`flex-1 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'all' ? 'bg-surface shadow text-primary' : 'text-muted hover:text-surface-800'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`flex-1 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'unread' ? 'bg-surface shadow text-primary' : 'text-muted hover:text-surface-800'
              }`}
              onClick={() => setActiveTab('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-surface-100">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 bg-surface-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-surface-400">
                <Bell className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">No {activeTab === 'unread' ? 'unread' : ''} notifications</p>
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-surface-50 relative group ${
                    !n.is_read ? 'bg-brand-50/40 border-l-4 border-brand-500' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-surface-100 border border-default/80 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs leading-tight truncate ${!n.is_read ? 'font-bold text-primary' : 'font-medium text-surface-700'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <button
                          onClick={(e) => handleMarkRead(n.id, e)}
                          title="Mark read"
                          className="text-surface-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted line-clamp-2 leading-relaxed mb-1">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-surface-400">
                      <span>{formatRelative(n.created_at)}</span>
                      <span className="uppercase font-extrabold text-[9px] bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">
                        {n.target_role}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Link */}
          <div className="p-3 border-t border-surface-100 bg-surface-50/50 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/dashboard/notifications');
              }}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
            >
              View Full History & Preferences <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
