import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, ChefHat, Sparkles, Truck, AlertCircle,
  Phone, RefreshCw, Loader2, Store, MapPin, DollarSign,
  User, ArrowLeft, ShieldCheck, XCircle
} from 'lucide-react';
import { publicApi } from '../../lib/api';
import { formatCurrency, formatRelative, cn } from '../../lib/utils';
import { Badge } from '../../components/ui';
import { assetUrl } from '../../lib/assetUrl';

export default function PublicTrackOrderPage() {
  const { token } = useParams<{ token: string }>();

  // Fetch order tracking data by token
  const { data: trackData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['public-track-order', token],
    queryFn: () => publicApi.trackOrder(token || ''),
    enabled: Boolean(token),
    refetchInterval: 8000, // Auto-refresh every 8 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <p className="text-surface-600 font-medium text-sm">Locating your order…</p>
      </div>
    );
  }

  if (error || !trackData || !trackData.order) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-primary">Order Not Found</h1>
        <p className="text-sm text-muted max-w-sm mt-1 mb-4">
          We could not find an active online order for this tracking link. Please verify the link sent to your phone or check with the restaurant.
        </p>
        <Link to="/" className="btn-primary">Return Home</Link>
      </div>
    );
  }

  const { order, restaurant } = trackData;

  const isPickup = order.order_type === 'pickup';
  const isRejected = order.accept_status === 'rejected' || order.status === 'cancelled';
  const isDelivered = order.status === 'delivered' || order.status === 'served';

  // Status mapping
  const steps = isPickup ? [
    { key: 'received',  label: 'Received',  desc: 'Sent to restaurant', icon: Clock },
    { key: 'accepted',  label: 'Accepted',  desc: 'Order confirmed',    icon: CheckCircle2 },
    { key: 'preparing', label: 'Preparing', desc: 'Chefs cooking',       icon: ChefHat },
    { key: 'ready',     label: 'Ready',     desc: 'Ready for pickup',   icon: Sparkles },
    { key: 'delivered', label: 'Collected', desc: 'Picked up by you',   icon: Store },
  ] : [
    { key: 'received',         label: 'Received',         desc: 'Sent to restaurant', icon: Clock },
    { key: 'accepted',         label: 'Accepted',         desc: 'Order confirmed',    icon: CheckCircle2 },
    { key: 'preparing',        label: 'Preparing',        desc: 'Chefs cooking',       icon: ChefHat },
    { key: 'ready',            label: 'Ready',            desc: 'Waiting for driver', icon: Sparkles },
    { key: 'out_for_delivery', label: 'On The Way',       desc: 'Driver dispatched',  icon: Truck },
    { key: 'delivered',        label: 'Delivered',        desc: 'Enjoy your food!',   icon: CheckCircle2 },
  ];

  const getStepIndex = () => {
    if (order.status === 'delivered' || order.status === 'served') return isPickup ? 4 : 5;
    if (order.status === 'out_for_delivery') return 4;
    if (order.status === 'ready') return 3;
    if (order.status === 'preparing') return 2;
    if (order.accept_status === 'accepted') return 1;
    return 0; // pending / received
  };

  const currentStepIdx = getStepIndex();

  const formatEstTime = (isoString?: string) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col pb-16">
      {/* ── Top Header ── */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-default sticky top-0 z-30 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <img
                src={assetUrl(restaurant.logo_url)}
                alt={restaurant.name}
                className="w-10 h-10 rounded-2xl object-cover border border-default flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-extrabold text-base flex-shrink-0">
                {restaurant?.name?.charAt(0) || 'R'}
              </div>
            )}
            <div>
              <h1 className="font-display font-extrabold text-sm text-primary">
                {restaurant?.name || 'Restaurant'}
              </h1>
              <p className="text-[10px] text-muted flex items-center gap-1.5">
                <span>Order #{order.local_id || token?.slice(0, 8)}</span>
                <span>·</span>
                <span className="capitalize">{order.order_type}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 text-muted hover:text-primary transition-colors cursor-pointer rounded-xl hover:bg-surface-100 flex items-center gap-1.5 text-xs font-medium"
              title="Refresh status"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin text-brand-600')} />
              <span className="hidden sm:inline text-[11px]">Live</span>
            </button>

            {restaurant?.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="btn-secondary !py-1.5 !px-3 text-xs gap-1.5 rounded-xl"
              >
                <Phone className="w-3.5 h-3.5 text-brand-600" />
                <span className="hidden sm:inline">Call Store</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-2xl mx-auto px-4 py-6 w-full space-y-6">
        
        {/* ── Status Card ── */}
        <div className="card p-6 border border-default/80 shadow-card text-center space-y-6">
          {isRejected ? (
            <div className="py-4 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10" />
              </div>
              <div>
                <h2 className="font-display font-extrabold text-xl text-red-700">Order Could Not Be Accepted</h2>
                <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                  The restaurant declined this order.
                </p>
              </div>
              {order.rejection_reason && (
                <div className="p-3.5 rounded-2xl bg-red-50/80 border border-red-200 text-red-800 text-xs font-medium max-w-md mx-auto">
                  <strong>Reason:</strong> {order.rejection_reason}
                </div>
              )}
              {restaurant?.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="btn-secondary inline-flex items-center gap-2 text-xs"
                >
                  <Phone className="w-4 h-4 text-brand-600" /> Call Restaurant: {restaurant.phone}
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Top Hero Icon & Status Message */}
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
                  {currentStepIdx === 0 && <Clock className="w-8 h-8 animate-pulse text-amber-500" />}
                  {currentStepIdx === 1 && <CheckCircle2 className="w-8 h-8 text-brand-600" />}
                  {currentStepIdx === 2 && <ChefHat className="w-8 h-8 animate-bounce text-brand-600" />}
                  {currentStepIdx === 3 && <Sparkles className="w-8 h-8 text-amber-500" />}
                  {currentStepIdx === 4 && (!isPickup ? <Truck className="w-8 h-8 animate-pulse text-blue-600" /> : <Store className="w-8 h-8 text-emerald-600" />)}
                  {currentStepIdx >= 5 && <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </div>

                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-primary">
                  {steps[currentStepIdx]?.label}
                </h2>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {order.accept_status === 'pending'
                    ? 'Your order has been received and is waiting for restaurant acceptance.'
                    : steps[currentStepIdx]?.desc}
                </p>

                {order.estimated_ready_at && !isDelivered && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mt-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Estimated Ready: {formatEstTime(order.estimated_ready_at)}</span>
                  </div>
                )}
              </div>

              {/* Progress Stepper */}
              <div className="pt-4">
                <div className="flex items-center justify-between relative">
                  {/* Connecting line */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-surface-200 -z-0" />
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-500 transition-all duration-500 -z-0"
                    style={{
                      width: `${(currentStepIdx / (steps.length - 1)) * 100}%`,
                    }}
                  />

                  {steps.map((st, i) => {
                    const isDone = i <= currentStepIdx;
                    const isCurrent = i === currentStepIdx;
                    const StepIcon = st.icon;

                    return (
                      <div key={st.key} className="relative z-10 flex flex-col items-center group">
                        <div
                          className={cn(
                            'w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center transition-all',
                            isCurrent
                              ? 'bg-brand-600 text-white ring-4 ring-brand-100 scale-110 shadow-sm'
                              : isDone
                              ? 'bg-brand-500 text-white shadow-xs'
                              : 'bg-surface-100 text-surface-400 border border-default'
                          )}
                        >
                          <StepIcon className="w-4 h-4" />
                        </div>
                        <span
                          className={cn(
                            'text-[10px] sm:text-[11px] font-bold mt-2 text-center whitespace-nowrap',
                            isCurrent
                              ? 'text-brand-700'
                              : isDone
                              ? 'text-primary'
                              : 'text-surface-400'
                          )}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Driver Contact Card (When out for delivery or assigned) ── */}
        {order.order_type === 'delivery' && (order.driver_name || order.driver_phone) && (
          <div className="card p-5 border border-brand-200/80 bg-gradient-to-r from-blue-50/60 to-indigo-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Dispatch Driver</p>
                  <p className="font-extrabold text-sm text-primary">{order.driver_name || 'Assigned Courier'}</p>
                </div>
              </div>

              {order.driver_phone && (
                <a
                  href={`tel:${order.driver_phone}`}
                  className="btn-primary !py-2 !px-4 text-xs gap-2 rounded-2xl shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Driver</span>
                </a>
              )}
            </div>
            {order.driver_phone && (
              <p className="text-xs text-muted font-mono">
                Driver Phone: <span className="font-bold text-primary">{order.driver_phone}</span>
              </p>
            )}
          </div>
        )}

        {/* ── Delivery Landmark & Address Card ── */}
        {order.order_type === 'delivery' && (order.delivery_landmark || order.delivery_zone_name) && (
          <div className="card p-5 border border-default/80 space-y-3">
            <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-600" /> Delivery Destination
            </h3>
            <div className="bg-surface-50 p-3.5 rounded-2xl border border-default/60 space-y-1 text-xs">
              {order.delivery_zone_name && (
                <p className="font-bold text-primary">
                  Zone: <span className="text-brand-700">{order.delivery_zone_name}</span>
                </p>
              )}
              {order.delivery_landmark && (
                <p className="text-surface-700">
                  Landmark: <span className="font-medium text-primary">{order.delivery_landmark}</span>
                </p>
              )}
              {order.delivery_address && (
                <p className="text-muted text-[11px]">
                  Address / Notes: {order.delivery_address}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Loyalty Rewards Card ── */}
        {(Number(order.points_earned) > 0 || (order.customer_points !== null && order.customer_points !== undefined)) && (
          <div className="card p-4 border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-xs uppercase tracking-wider text-amber-900">★ Loyalty Rewards</span>
              </div>
              {order.customer_name && (
                <span className="text-[11px] font-semibold text-amber-800">{order.customer_name}</span>
              )}
            </div>
            <div className="flex items-center justify-between pt-1 text-xs">
              {Number(order.points_earned) > 0 ? (
                <span className="text-amber-900">
                  Points Earned Today: <strong className="text-emerald-700 font-extrabold font-mono">+{order.points_earned} pts</strong>
                </span>
              ) : (
                <span className="text-amber-800 text-[11px]">
                  Points will be awarded when order is confirmed & delivered.
                </span>
              )}
              {order.customer_points !== null && order.customer_points !== undefined && (
                <span className="text-amber-900">
                  Balance: <strong className="font-extrabold font-mono text-brand-700">{order.customer_points} pts</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Order Summary Card ── */}
        <div className="card p-5 border border-default/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-default/60">
            <h3 className="font-display font-bold text-sm text-primary">Ordered Items</h3>
            <Badge
              variant={
                order.payment_status === 'paid'
                  ? 'success'
                  : ['telebirr', 'cbe_birr'].includes(order.payment_method)
                  ? 'warning'
                  : 'neutral'
              }
            >
              {order.payment_status === 'paid'
                ? 'Paid'
                : ['telebirr', 'cbe_birr'].includes(order.payment_method)
                ? 'Payment Pending Verification'
                : `Pay on ${isPickup ? 'Pickup' : 'Delivery'}`}
            </Badge>
          </div>

          <div className="space-y-3 divide-y divide-surface-100">
            {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
              <div key={idx} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-primary">
                    {item.quantity} × {item.menu_item_name}
                  </p>
                  {item.modifier_choices && item.modifier_choices.length > 0 && (
                    <p className="text-[10px] text-muted">
                      + {item.modifier_choices.map((m: any) => m.name).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-amber-700 italic">Note: {item.notes}</p>
                  )}
                </div>
                <span className="font-mono font-bold text-surface-700">
                  {formatCurrency(Number(item.unit_price) * Number(item.quantity))}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing breakdown */}
          <div className="pt-3 border-t border-default/60 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(Number(order.subtotal || 0))}</span>
            </div>
            {order.order_type === 'delivery' && (
              <div className="flex justify-between text-muted">
                <span>Delivery Fee</span>
                <span className="font-mono font-bold text-emerald-600">
                  {formatCurrency(Number(order.delivery_fee || 0))}
                </span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm text-primary pt-2 border-t border-default/60">
              <span>Total Amount</span>
              <span className="font-mono text-brand-700">{formatCurrency(Number(order.total || 0))}</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center space-y-1 pt-2">
          <p className="text-[11px] text-muted">
            Tracking Link: Keep this URL bookmarked to check order progress anytime.
          </p>
          <p className="text-[10px] text-surface-400">
            KushinaPOS — Ethiopian Restaurant Operating System
          </p>
        </div>
      </main>
    </div>
  );
}
