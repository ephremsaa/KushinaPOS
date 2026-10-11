import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag, Truck, Store, Clock, Phone, MapPin, CheckCircle2,
  XCircle, AlertCircle, Volume2, VolumeX, Printer, User, DollarSign,
  ChevronRight, RefreshCw, Loader2, Sparkles, AlertTriangle, ShieldCheck,
  ChefHat
} from 'lucide-react';
import { ordersApi, staffApi } from '../../lib/api';
import { formatCurrency, formatRelative, cn } from '../../lib/utils';
import { Button, Input, Modal, Badge, Card } from '../../components/ui';
import { globalToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function OnlineOrdersPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed' | 'rejected'>('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio Context Ref
  const prevPendingCountRef = useRef<number>(0);

  // Modals state
  const [acceptingOrder, setAcceptingOrder] = useState<any | null>(null);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(25);
  const [rejectingOrder, setRejectingOrder] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assigningOrder, setAssigningOrder] = useState<any | null>(null);
  const [driverStaffId, setDriverStaffId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [markOutImmediate, setMarkOutImmediate] = useState(true);

  // Fetch online orders with auto-refresh every 7 seconds
  const { data: orders = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tenant-online-orders', activeTab],
    queryFn: () => ordersApi.onlineList(activeTab),
    refetchInterval: 7000,
  });

  // Fetch staff for driver assignment
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list-drivers'],
    queryFn: () => staffApi.list(),
  });

  // Play pleasant notification ding using Web Audio API
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio chime playback failed:', e);
    }
  };

  // Detect new pending orders and trigger sound
  useEffect(() => {
    if (activeTab === 'pending') {
      const currentPending = orders.length;
      if (currentPending > prevPendingCountRef.current && prevPendingCountRef.current >= 0) {
        playAlertSound();
      }
      prevPendingCountRef.current = currentPending;
    }
  }, [orders, activeTab]);

  // Accept Mutation
  const acceptMutation = useMutation({
    mutationFn: ({ id, mins }: { id: string; mins: number }) => ordersApi.acceptOnline(id, mins),
    onSuccess: () => {
      globalToast.success('Order accepted and sent to kitchen display');
      setAcceptingOrder(null);
      qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
    },
    onError: (err: any) => globalToast.error(err.message || 'Failed to accept order'),
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => ordersApi.rejectOnline(id, reason),
    onSuccess: () => {
      globalToast.success('Order rejected and customer notified');
      setRejectingOrder(null);
      setRejectionReason('');
      qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
    },
    onError: (err: any) => globalToast.error(err.message || 'Failed to reject order'),
  });

  // Assign Driver Mutation
  const assignDriverMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => ordersApi.assignDriver(id, payload),
    onSuccess: () => {
      globalToast.success('Driver assigned successfully');
      setAssigningOrder(null);
      qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
    },
    onError: (err: any) => globalToast.error(err.message || 'Failed to assign driver'),
  });

  // Mark Delivered Mutation
  const markDeliveredMutation = useMutation({
    mutationFn: (id: string) => ordersApi.markDelivered(id),
    onSuccess: () => {
      globalToast.success('Order marked as delivered');
      qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
    },
    onError: (err: any) => globalToast.error(err.message || 'Failed to mark delivered'),
  });

  // Collect COD Mutation
  const collectCodMutation = useMutation({
    mutationFn: (id: string) => ordersApi.collectCod(id),
    onSuccess: (res: any) => {
      globalToast.success('Cash collection confirmed and added to shift till');
      qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
    },
    onError: (err: any) => globalToast.error(err.message || 'Failed to confirm cash collection'),
  });

  // Confirm Online Transfer Mutation
  const confirmTransferMutation = useMutation({
    mutationFn: (id: string) => ordersApi.confirmOnlineTransfer(id),
    onSuccess: () => {
      globalToast.success('Online transfer verified and order marked paid');
      qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
    },
    onError: (err: any) => globalToast.error(err.message || 'Failed to verify payment'),
  });

  // Print Kitchen Ticket
  const printKitchenTicket = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = (order.order_items || [])
      .map((it: any) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
          <span><strong>${it.quantity}x</strong> ${it.menu_item_name}</span>
        </div>
        ${it.notes ? `<div style="font-size:11px; color:#555; margin-left:16px;">* ${it.notes}</div>` : ''}
      `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>KITCHEN TICKET #${order.local_id || order.id?.slice(0, 8)}</title>
          <style>
            body { font-family: monospace; padding: 15px; margin: 0; font-size: 13px; }
            h2 { text-align: center; margin: 0 0 5px 0; font-size: 18px; }
            .tag { text-align: center; font-size: 16px; font-weight: bold; padding: 4px; background: #eee; border: 1px dashed #000; margin: 8px 0; }
            .meta { margin-bottom: 12px; font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 8px; }
            .footer { margin-top: 15px; border-top: 1px dashed #000; padding-top: 8px; font-size: 11px; text-align: center; }
          </style>
        </head>
        <body>
          <h2>*** KITCHEN TICKET ***</h2>
          <div class="tag">${order.order_type.toUpperCase()} - ONLINE</div>
          <div class="meta">
            <div>Order: #${order.local_id || order.id?.slice(0, 8)}</div>
            <div>Time: ${new Date(order.created_at).toLocaleTimeString()}</div>
            <div>Customer: ${order.customer_name || 'Guest'}</div>
            ${order.delivery_landmark ? `<div>Landmark: ${order.delivery_landmark}</div>` : ''}
          </div>
          <div>${itemsHtml}</div>
          ${order.order_notes ? `<div style="margin-top:10px; font-weight:bold;">Special Instructions: ${order.order_notes}</div>` : ''}
          <div class="footer">KushinaPOS Kitchen Display</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print Delivery Slip
  const printDeliverySlip = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=420,height=650');
    if (!printWindow) return;

    const itemsHtml = (order.order_items || [])
      .map((it: any) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;">
          <span>${it.quantity}x ${it.menu_item_name}</span>
          <span>ETB ${(Number(it.unit_price) * Number(it.quantity)).toFixed(2)}</span>
        </div>
      `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>DELIVERY SLIP #${order.local_id || order.id?.slice(0, 8)}</title>
          <style>
            body { font-family: monospace; padding: 15px; margin: 0; font-size: 12px; }
            h2 { text-align: center; margin: 0; font-size: 16px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; }
            .box { border: 1px solid #000; padding: 8px; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 6px; border-top: 1px solid #000; padding-top: 6px; }
            .tag { font-weight: bold; text-align: center; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>CUSTOMER DELIVERY SLIP</h2>
            <div>Order #${order.local_id || order.id?.slice(0, 8)}</div>
          </div>
          <div class="box">
            <div class="tag">DELIVERY DESTINATION</div>
            <div><strong>Customer:</strong> ${order.customer_name}</div>
            <div><strong>Phone:</strong> ${order.customer_phone}</div>
            <div><strong>Zone:</strong> ${order.delivery_zone_name || 'Standard'}</div>
            <div><strong>Landmark:</strong> ${order.delivery_landmark || 'N/A'}</div>
            ${order.delivery_address ? `<div><strong>Address:</strong> ${order.delivery_address}</div>` : ''}
            ${order.driver_name ? `<div><strong>Driver:</strong> ${order.driver_name} (${order.driver_phone || ''})</div>` : ''}
          </div>
          <div style="margin: 10px 0;">
            ${itemsHtml}
          </div>
          <div style="border-top: 1px dashed #000; padding-top: 6px;">
            <div class="row"><span>Subtotal:</span><span>ETB ${Number(order.subtotal || 0).toFixed(2)}</span></div>
            <div class="row"><span>Delivery Fee:</span><span>ETB ${Number(order.delivery_fee || 0).toFixed(2)}</span></div>
            <div class="total-row"><span>AMOUNT DUE:</span><span>ETB ${Number(order.total || 0).toFixed(2)}</span></div>
            <div style="margin-top: 6px; text-align:center; font-weight:bold;">
              PAYMENT: ${order.payment_status === 'paid' ? 'PAID ONLINE' : `COLLECT CASH ON DELIVERY (ETB ${Number(order.total || 0).toFixed(2)})`}
            </div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isManagerOrOwner = ['owner', 'manager', 'admin'].includes(user?.staffRole || user?.role || '');

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="bg-surface/60 p-6 rounded-3xl backdrop-blur-sm border border-white/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title">Online Orders Inbox</h1>
            <Badge variant="brand">Live Feed</Badge>
          </div>
          <p className="page-subtitle">
            Manage incoming pickup and Ethiopian landmark delivery orders in real-time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              'btn-secondary gap-2 text-xs cursor-pointer',
              soundEnabled ? 'text-brand-600 font-bold' : 'text-muted'
            )}
            title="Toggle incoming order alert chime"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <button
            onClick={() => refetch()}
            className="btn-secondary gap-2 text-xs cursor-pointer"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin text-brand-600')} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Status Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'pending',   label: 'Pending Acceptance', icon: Clock, count: activeTab === 'pending' ? orders.length : undefined },
          { id: 'active',    label: 'Active & In Prep',  icon: ChefHat },
          { id: 'completed', label: 'Completed',         icon: CheckCircle2 },
          { id: 'rejected',  label: 'Declined / Cancelled', icon: XCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-surface border border-default text-surface-600 hover:border-surface-400'
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Orders Stream / List ── */}
      {isLoading ? (
        <div className="py-16 text-center text-muted flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-xs font-medium">Checking live orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center text-muted border border-dashed border-default space-y-2">
          <ShoppingBag className="w-12 h-12 mx-auto text-surface-300" />
          <p className="font-bold text-base text-primary">No {activeTab} online orders</p>
          <p className="text-xs max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'New online orders submitted by customers will ring here automatically.'
              : `There are currently no orders in the ${activeTab} queue.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const isDelivery = order.order_type === 'delivery';
            const pendingMins = Number(order.pending_minutes || 0);
            const isOverdue = order.accept_status === 'pending' && pendingMins >= 5;

            return (
              <div
                key={order.id}
                className={cn(
                  'card p-5 sm:p-6 border transition-all duration-200 space-y-4',
                  isOverdue
                    ? 'border-red-400 bg-red-50/20 shadow-md ring-2 ring-red-200'
                    : 'border-default/80 hover:border-surface-300'
                )}
              >
                {/* Overdue Banner */}
                {isOverdue && (
                  <div className="p-3 rounded-2xl bg-red-100 border border-red-300 text-red-900 text-xs font-bold flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
                      Pending for {pendingMins} minutes! Owner has been auto-notified.
                    </span>
                    <Badge variant="danger">Urgent Attention</Badge>
                  </div>
                )}

                {/* Top Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-default/60">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-base flex-shrink-0',
                      isDelivery ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                    )}>
                      {isDelivery ? <Truck className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-extrabold text-base text-primary">
                          #{order.local_id || order.tracking_token?.slice(0, 8)}
                        </span>
                        <Badge variant={isDelivery ? 'info' : 'success'}>
                          {isDelivery ? 'DELIVERY' : 'PICKUP'}
                        </Badge>
                        <Badge variant={order.accept_status === 'pending' ? 'warning' : 'neutral'}>
                          {order.accept_status?.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        Received {formatRelative(order.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Total Amount</p>
                      <p className="font-extrabold text-lg text-brand-700 font-mono">
                        {formatCurrency(Number(order.total || 0))}
                      </p>
                    </div>

                    <div className="text-right">
                      <Badge
                        variant={order.payment_status === 'paid' ? 'success' : 'warning'}
                      >
                        {order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                      </Badge>
                      <p className="text-[10px] text-muted capitalize mt-0.5">
                        {order.payment_method?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Middle details: customer & items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer & Destination */}
                  <div className="bg-surface-50 p-4 rounded-2xl border border-default/60 space-y-2 text-xs">
                    <p className="font-bold text-primary flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-brand-600" />
                      <span>{order.customer_name || 'Customer'}</span>
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="text-brand-600 hover:underline font-mono inline-flex items-center gap-1 ml-2"
                      >
                        <Phone className="w-3 h-3" /> {order.customer_phone}
                      </a>
                    </p>

                    {isDelivery && (
                      <div className="space-y-1 text-surface-600 pt-1 border-t border-surface-200">
                        <p className="flex items-center gap-1.5 font-bold text-primary">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          Zone: {order.delivery_zone_name || 'Standard Zone'} (+{formatCurrency(Number(order.delivery_fee || 0))})
                        </p>
                        <p><strong>Landmark:</strong> {order.delivery_landmark}</p>
                        {order.delivery_address && <p><strong>Address:</strong> {order.delivery_address}</p>}
                      </div>
                    )}

                    {order.driver_name && (
                      <div className="p-2.5 rounded-xl bg-blue-100/60 text-blue-900 text-xs flex items-center justify-between">
                        <span>Driver: <strong>{order.driver_name}</strong> ({order.driver_phone || 'No phone'})</span>
                        <Badge variant="info">{order.status}</Badge>
                      </div>
                    )}
                  </div>

                  {/* Items summary */}
                  <div className="bg-surface-50 p-4 rounded-2xl border border-default/60 space-y-1.5 text-xs max-h-36 overflow-y-auto">
                    <p className="font-bold text-primary uppercase text-[10px] tracking-wider mb-1">
                      Ordered Items ({order.order_items?.length || 0})
                    </p>
                    {order.order_items?.map((it: any) => (
                      <div key={it.id} className="flex justify-between py-0.5">
                        <span><strong>{it.quantity}×</strong> {it.menu_item_name}</span>
                        <span className="font-mono text-muted">{formatCurrency(Number(it.unit_price) * Number(it.quantity))}</span>
                      </div>
                    ))}
                    {order.order_notes && (
                      <p className="text-[11px] text-amber-800 font-medium italic pt-1 border-t border-surface-200">
                        Kitchen Note: "{order.order_notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-default/60">
                  {/* Left: Print slips */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printKitchenTicket(order)}
                      className="btn-secondary !py-1.5 !px-3 text-xs gap-1.5 rounded-xl"
                      title="Print ticket for kitchen line"
                    >
                      <Printer className="w-3.5 h-3.5 text-surface-600" />
                      <span>Kitchen Ticket</span>
                    </button>

                    {isDelivery && (
                      <button
                        onClick={() => printDeliverySlip(order)}
                        className="btn-secondary !py-1.5 !px-3 text-xs gap-1.5 rounded-xl"
                        title="Print slip for delivery driver and customer"
                      >
                        <Printer className="w-3.5 h-3.5 text-surface-600" />
                        <span>Delivery Slip</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Stage-specific workflow actions */}
                  <div className="flex items-center gap-2">
                    {/* Stage 1: Pending Acceptance */}
                    {order.accept_status === 'pending' && (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRejectingOrder(order)}
                        >
                          Reject Order
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setAcceptingOrder(order);
                            setPrepTimeMinutes(25);
                          }}
                        >
                          Accept Order
                        </Button>
                      </>
                    )}

                    {/* Stage 2: Accepted & Cooking -> Assign Driver / Out for delivery */}
                    {order.accept_status === 'accepted' && isDelivery && order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <>
                        {!order.driver_name && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAssigningOrder(order);
                              setDriverStaffId('');
                              setDriverName('');
                              setDriverPhone('');
                              setMarkOutImmediate(true);
                            }}
                          >
                            Assign Driver
                          </Button>
                        )}

                        {order.status !== 'out_for_delivery' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => ordersApi.outForDelivery(order.id).then(() => {
                              globalToast.success('Order is out for delivery');
                              qc.invalidateQueries({ queryKey: ['tenant-online-orders'] });
                            })}
                          >
                            Mark Out for Delivery
                          </Button>
                        )}

                        {order.status === 'out_for_delivery' && (
                          <Button
                            variant="success"
                            size="sm"
                            loading={markDeliveredMutation.isPending}
                            onClick={() => markDeliveredMutation.mutate(order.id)}
                          >
                            Mark Delivered
                          </Button>
                        )}
                      </>
                    )}

                    {/* Pickup fulfillment ready/complete */}
                    {order.accept_status === 'accepted' && !isDelivery && order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <Button
                        variant="success"
                        size="sm"
                        loading={markDeliveredMutation.isPending}
                        onClick={() => markDeliveredMutation.mutate(order.id)}
                      >
                        Mark Collected
                      </Button>
                    )}

                    {/* Stage 3: Payment Settling */}
                    {/* COD Cash Collection */}
                    {order.payment_method === 'cash' && order.payment_status === 'pending' && (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={collectCodMutation.isPending}
                        onClick={() => collectCodMutation.mutate(order.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        💵 Confirm Cash Handover ({formatCurrency(Number(order.total))})
                      </Button>
                    )}

                    {/* Telebirr / CBE Manager verification */}
                    {['telebirr', 'cbe_birr'].includes(order.payment_method) && order.payment_status === 'pending' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isManagerOrOwner}
                        loading={confirmTransferMutation.isPending}
                        onClick={() => confirmTransferMutation.mutate(order.id)}
                        className="text-brand-700 font-bold border-brand-300"
                        title={!isManagerOrOwner ? 'Manager or Owner approval required' : 'Confirm mobile transfer'}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-600 mr-1" />
                        Verify {order.payment_method === 'telebirr' ? 'Telebirr' : 'CBE'} Transfer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Accept Order Modal ── */}
      <Modal
        open={Boolean(acceptingOrder)}
        onClose={() => setAcceptingOrder(null)}
        title="Accept Online Order"
        description="Choose estimated food preparation time before routing to kitchen display."
        icon={<Clock className="w-5 h-5 text-emerald-600" />}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setAcceptingOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={acceptMutation.isPending}
              onClick={() => {
                if (acceptingOrder) {
                  acceptMutation.mutate({ id: acceptingOrder.id, mins: prepTimeMinutes });
                }
              }}
            >
              Accept ({prepTimeMinutes} mins)
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted">
            Customer will see this estimated ready countdown on their live tracking link.
          </p>

          <div>
            <label className="label text-xs font-bold text-primary">Preparation Time (Minutes)</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[15, 20, 25, 35, 45, 60].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setPrepTimeMinutes(mins)}
                  className={cn(
                    'py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                    prepTimeMinutes === mins
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'bg-surface border-default text-surface-600 hover:border-surface-400'
                  )}
                >
                  {mins} min
                </button>
              ))}
            </div>

            <Input
              type="number"
              min="5"
              max="180"
              value={prepTimeMinutes}
              onChange={e => setPrepTimeMinutes(parseInt(e.target.value) || 25)}
              className="!py-2 font-mono font-bold"
            />
          </div>
        </div>
      </Modal>

      {/* ── Reject Order Modal ── */}
      <Modal
        open={Boolean(rejectingOrder)}
        onClose={() => setRejectingOrder(null)}
        title="Decline Online Order"
        description="A mandatory rejection reason is required and will be communicated to the customer."
        icon={<XCircle className="w-5 h-5 text-red-600" />}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setRejectingOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejectMutation.isPending}
              disabled={!rejectionReason.trim()}
              onClick={() => {
                if (rejectingOrder && rejectionReason.trim()) {
                  rejectMutation.mutate({ id: rejectingOrder.id, reason: rejectionReason.trim() });
                }
              }}
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="label text-xs font-bold text-primary">Rejection Reason *</label>
            <div className="space-y-2 mb-3">
              {[
                'Kitchen at maximum capacity for the night',
                'Requested items currently out of stock',
                'Delivery landmark outside current courier radius',
                'Closing early for private event',
              ].map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className="w-full text-left p-2.5 rounded-xl border border-default/70 hover:border-brand-400 text-xs text-surface-700 hover:bg-surface-50 transition-colors cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={3}
              placeholder="Or write custom reason for customer…"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="input w-full text-xs !p-3"
            />
          </div>
        </div>
      </Modal>

      {/* ── Assign Driver Modal ── */}
      <Modal
        open={Boolean(assigningOrder)}
        onClose={() => setAssigningOrder(null)}
        title="Assign Delivery Driver"
        description="Select a registered staff member or enter a free-text courier name and phone number."
        icon={<Truck className="w-5 h-5 text-blue-600" />}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setAssigningOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={assignDriverMutation.isPending}
              disabled={!driverName && !driverStaffId}
              onClick={() => {
                if (assigningOrder) {
                  assignDriverMutation.mutate({
                    id: assigningOrder.id,
                    payload: {
                      driver_staff_id: driverStaffId || null,
                      driver_name: driverName.trim() || undefined,
                      driver_phone: driverPhone.trim() || undefined,
                      mark_out_for_delivery: markOutImmediate,
                    },
                  });
                }
              }}
            >
              Assign & Dispatch
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {Array.isArray(staffList) && staffList.length > 0 && (
            <div>
              <label className="label text-xs font-bold text-primary">Registered Staff Member</label>
              <select
                value={driverStaffId}
                onChange={e => {
                  setDriverStaffId(e.target.value);
                  const selected = (staffList as any[]).find((s: any) => s.id === e.target.value);
                  if (selected) {
                    setDriverName(selected.name);
                    setDriverPhone(selected.phone || '');
                  }
                }}
                className="input !py-2.5 w-full text-xs cursor-pointer"
              >
                <option value="">-- Or enter free-text driver below --</option>
                {(staffList as any[]).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role}) {s.phone ? `· ${s.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label text-xs font-bold text-primary">Driver Name *</label>
            <Input
              type="text"
              placeholder="e.g. Dawit Tadesse"
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              className="!py-2.5 text-xs"
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-primary">Driver Phone</label>
            <Input
              type="tel"
              placeholder="0911223344"
              value={driverPhone}
              onChange={e => setDriverPhone(e.target.value)}
              className="!py-2.5 text-xs font-mono"
            />
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface-50 border border-default cursor-pointer">
            <input
              type="checkbox"
              checked={markOutImmediate}
              onChange={e => setMarkOutImmediate(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-primary">
              Mark "Out for Delivery" immediately upon assignment
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
