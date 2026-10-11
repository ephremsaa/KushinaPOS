import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, Utensils, AlertCircle, Phone,
  ArrowLeft, RefreshCw, Loader2, Sparkles, ChefHat, Check, ShoppingBag
} from 'lucide-react';
import { publicApi } from '../../lib/api';
import { formatCurrency, formatRelative, cn } from '../../lib/utils';

export default function OrderStatusPage() {
  const { orderId } = useParams();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['public-order-status', orderId],
    queryFn: () => publicApi.getOrderStatus(orderId || ''),
    enabled: Boolean(orderId),
    refetchInterval: 5000, // Poll status every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <p className="text-surface-600 font-medium text-sm">Fetching order status…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-primary">Order Not Found</h1>
        <p className="text-sm text-muted max-w-sm mt-1 mb-4">We couldn't find an order matching ID `{orderId}`.</p>
        <Link to="/" className="btn-primary">Return Home</Link>
      </div>
    );
  }

  const steps = [
    { key: 'new', label: 'Order Received', desc: 'Sent to kitchen', icon: Clock },
    { key: 'preparing', label: 'Preparing Food', desc: 'Chefs are cooking', icon: ChefHat },
    { key: 'ready', label: 'Order Ready', desc: order.order_type === 'delivery' ? 'Out for delivery' : 'Ready for pickup / serving', icon: Sparkles },
    { key: 'served', label: 'Completed', desc: 'Order fulfilled', icon: CheckCircle2 },
  ];

  const getStepIndex = (status: string) => {
    if (status === 'new') return 0;
    if (status === 'preparing') return 1;
    if (status === 'ready') return 2;
    if (status === 'served' || status === 'completed') return 3;
    return 0;
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-surface-50 pb-12">
      {/* Header */}
      <header className="bg-surface border-b border-default sticky top-0 z-20 shadow-xs">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {order.restaurant_logo ? (
              <img src={order.restaurant_logo} alt={order.restaurant_name} className="w-10 h-10 rounded-2xl object-cover border border-default flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-bold text-base flex-shrink-0">
                {order.restaurant_name?.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-display font-bold text-sm text-primary">{order.restaurant_name}</h1>
              <p className="text-[10px] text-muted">Order #{order.local_id || order.id.slice(0, 8)}</p>
            </div>
          </div>

          <button onClick={() => refetch()} className="btn-ghost btn-sm p-2 text-muted hover:text-primary">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        
        {/* Status Card */}
        <div className="bg-surface rounded-3xl border border-default p-6 shadow-xs text-center">
          {isCancelled ? (
            <div className="py-4">
              <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-2" />
              <h2 className="font-display font-bold text-xl text-red-700">Order Cancelled</h2>
              <p className="text-xs text-muted mt-1">Please contact the restaurant for details.</p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-3 text-brand-600">
                {currentStepIdx === 0 && <Clock className="w-8 h-8 animate-pulse" />}
                {currentStepIdx === 1 && <ChefHat className="w-8 h-8 animate-bounce" />}
                {currentStepIdx === 2 && <Sparkles className="w-8 h-8 text-amber-500" />}
                {currentStepIdx >= 3 && <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
              </div>

              <h2 className="font-display font-bold text-2xl text-primary capitalize">
                {steps[currentStepIdx]?.label || order.status}
              </h2>
              <p className="text-xs text-muted mt-1">{steps[currentStepIdx]?.desc}</p>

              {/* Progress Tracker */}
              <div className="mt-8 relative flex items-center justify-between">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-surface-100 -z-0 rounded-full" />
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-500 -z-0 rounded-full transition-all duration-500"
                  style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, idx) => {
                  const isDone = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={step.key} className="relative z-10 flex flex-col items-center">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                        isDone ? 'bg-brand-500 text-white shadow-xs scale-105' : 'bg-surface border-2 border-default text-surface-400'
                      )}>
                        {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={cn('text-[10px] font-semibold mt-2 text-center max-w-[65px]', isCurrent ? 'text-brand-600 font-bold' : 'text-surface-400')}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Loyalty Rewards */}
        {(Number(order.points_earned) > 0 || (order.customer_points !== null && order.customer_points !== undefined)) && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border border-amber-300 p-4 shadow-xs space-y-2">
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
                  Points Earned: <strong className="text-emerald-700 font-extrabold font-mono">+{order.points_earned} pts</strong>
                </span>
              ) : (
                <span className="text-amber-800 text-[11px]">
                  Points will be awarded when order is completed.
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

        {/* Order Details Card */}
        <div className="bg-surface rounded-3xl border border-default p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <h3 className="font-display font-bold text-sm text-primary">Order Summary</h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-100 text-surface-700 capitalize">
              {order.order_type.replace('_', ' ')} {order.table_label && `(Table ${order.table_label})`}
            </span>
          </div>

          <div className="space-y-2.5">
            {order.order_items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start text-xs">
                <div className="flex gap-2">
                  <span className="font-bold text-brand-600">{item.quantity}x</span>
                  <div>
                    <p className="font-semibold text-surface-800">{item.menu_item_name}</p>
                    {item.notes && <p className="text-[10px] text-surface-400 italic">"{item.notes}"</p>}
                  </div>
                </div>
                <span className="font-bold text-primary">{formatCurrency(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-surface-100 flex justify-between font-bold text-primary text-sm">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>

        {/* Restaurant Contact */}
        {order.restaurant_phone && (
          <div className="bg-surface rounded-3xl border border-default p-4 shadow-xs flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-primary">Need help with your order?</p>
              <p className="text-muted">Call {order.restaurant_name}</p>
            </div>
            <a href={`tel:${order.restaurant_phone}`} className="btn-secondary btn-sm gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {order.restaurant_phone}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
