import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kitchenApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { ChefHat, Clock, CheckCircle2, LayoutGrid, MonitorPlay } from 'lucide-react';

const STATIONS = ['All Stations', 'General', 'Grill', 'Bar', 'Dessert'];

function getMinutesSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

// React component for the Timer that updates every minute
const SLATimer = ({ createdAt }: { createdAt: string }) => {
  const [mins, setMins] = useState(getMinutesSince(createdAt));
  useEffect(() => {
    const interval = setInterval(() => setMins(getMinutesSince(createdAt)), 10000); // update frequently so it doesn't look stuck
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm border",
      mins < 10 ? "bg-green-50 text-green-700 border-green-200" :
      mins < 20 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
      "bg-red-50 text-red-700 border-red-200 animate-pulse"
    )}>
      <Clock className="w-4 h-4" />
      {mins} min
    </div>
  );
};

export default function KitchenPage() {
  const qc = useQueryClient();
  const [station, setStation] = useState('All Stations');

  // Short polling via react-query
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders', station],
    queryFn: () => kitchenApi.getOrders(station).then(res => res as any),
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const { mutate: updateItem } = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => kitchenApi.updateItemStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['kitchen-orders', station] });
      const prev = qc.getQueryData(['kitchen-orders', station]);
      qc.setQueryData(['kitchen-orders', station], (old: any) => {
        if (!old) return old;
        return old.map((o: any) => {
          const newItems = o.order_items.map((i: any) => i.id === id ? { ...i, status } : i);
          return { ...o, order_items: newItems };
        });
      });
      return { prev };
    },
    onError: (err, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['kitchen-orders', station], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['kitchen-orders', station] })
  });

  const { mutate: updateOrder } = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => kitchenApi.updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders', station] })
  });

  return (
    <div className="h-screen bg-surface-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-surface-900 text-white p-4 shadow-xl flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-inner">
            <MonitorPlay className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold leading-tight">Kitchen Display</h1>
            <p className="text-surface-400 text-xs font-medium">Real-time KDS • {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-surface-800 p-1.5 rounded-2xl">
          {STATIONS.map(s => (
            <button key={s} onClick={() => setStation(s)}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 touch-manipulation",
                station === s ? "bg-brand-500 text-white shadow-lg" : "text-surface-300 hover:bg-surface-700"
              )}>
              {s}
            </button>
          ))}
        </div>
      </header>

      {/* Kanban Board */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 hide-scrollbar flex gap-6">
        {isLoading && orders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-400">
            <ChefHat className="w-16 h-16 mb-4 animate-bounce text-brand-300" />
            <p className="font-bold text-lg">Loading Kitchen Orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-400">
            <CheckCircle2 className="w-16 h-16 mb-4 text-green-300" />
            <p className="font-bold text-lg">All caught up! No active orders.</p>
          </div>
        ) : (
          orders.map((order: any) => (
            <div key={order.id} className={cn(
              "shrink-0 w-[350px] flex flex-col rounded-3xl shadow-xl border-t-8 bg-white overflow-hidden max-h-full",
              order.status === 'new' ? 'border-brand-500' : 'border-yellow-400'
            )}>
              {/* Ticket Header */}
              <div className="p-5 bg-surface-50 border-b border-surface-100 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-display font-extrabold text-surface-900 leading-none">
                      {order.order_type === 'dine_in' ? `Table ${order.table_label || '?'}` : order.order_type.toUpperCase()}
                    </h2>
                    <p className="text-surface-500 font-bold mt-1 text-sm">Order #{order.local_id || order.id.slice(0,6)}</p>
                  </div>
                  <SLATimer createdAt={order.created_at} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {order.order_source === 'qr_code' && (
                    <span className="text-xs font-extrabold bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200">
                      📱 QR Table {order.table_label}
                    </span>
                  )}
                  {order.order_source === 'online_delivery' && (
                    <span className="text-xs font-extrabold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
                      🚗 Online Delivery
                    </span>
                  )}
                  {order.order_source === 'online_pickup' && (
                    <span className="text-xs font-extrabold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                      🛍️ Online Pickup
                    </span>
                  )}
                  {order.customer_name && (
                    <p className="text-surface-700 font-bold bg-white px-3 py-1 rounded-lg border inline-flex w-max shadow-xs text-xs">
                      👤 {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ''}
                    </p>
                  )}
                </div>
                {order.notes && (
                  <p className="text-red-600 bg-red-50 p-3 rounded-xl font-bold border border-red-100 shadow-inner">
                    ⚠️ {order.notes}
                  </p>
                )}
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-surface-100/50">
                {order.order_items.map((item: any) => {
                  const isItemDone = item.status === 'ready' || item.status === 'served';
                  const isItemPrep = item.status === 'preparing';
                  return (
                    <div key={item.id} className={cn(
                      "p-4 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 touch-manipulation select-none",
                      isItemDone ? "bg-surface-50 border-surface-200 opacity-60" :
                      isItemPrep ? "bg-yellow-50 border-yellow-300 shadow-md" :
                      "bg-white border-brand-200 shadow-md"
                    )} onClick={() => updateItem({ id: item.id, status: isItemDone ? 'pending' : isItemPrep ? 'ready' : 'preparing' })}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-3 items-start">
                          <span className={cn(
                            "text-xl font-black w-8 h-8 flex items-center justify-center rounded-lg",
                            isItemDone ? "bg-surface-200 text-surface-500" : "bg-surface-900 text-white"
                          )}>{item.quantity}</span>
                          <div>
                            <p className={cn("text-lg font-bold leading-tight", isItemDone && "line-through text-surface-500")}>
                              {item.menu_item_name}
                            </p>
                            {item.station && item.station !== 'General' && (
                              <span className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1 block">{item.station}</span>
                            )}
                            {item.modifier_choices?.map((mod: any, i: number) => (
                              <p key={i} className="text-surface-500 text-sm font-medium mt-1 pl-2 border-l-2 border-surface-300">
                                + {mod.option_label}
                              </p>
                            ))}
                            {item.notes && (
                              <p className="text-red-500 font-bold text-sm mt-2 bg-red-50 px-2 py-1 rounded-md">Note: {item.notes}</p>
                            )}
                          </div>
                        </div>
                        {isItemDone ? <CheckCircle2 className="w-8 h-8 text-green-500" /> : <div className="w-8 h-8 rounded-full border-4 border-surface-200" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Actions */}
              <div className="p-4 bg-white border-t border-surface-200">
                {order.status === 'new' ? (
                  <button 
                    onClick={() => updateOrder({ id: order.id, status: 'preparing' })}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all touch-manipulation">
                    Start Prep
                  </button>
                ) : (
                  <button 
                    onClick={() => updateOrder({ id: order.id, status: 'ready' })}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all touch-manipulation">
                    Mark Order Ready
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
