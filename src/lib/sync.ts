/**
 * kushinaPOS Offline Sync Engine
 *
 * Stores orders locally (sessionStorage/IndexedDB on web, SQLite via Capacitor on Android)
 * and syncs them to Supabase when connectivity is restored.
 *
 * Usage:
 *   import { syncEngine } from './sync';
 *   syncEngine.saveLocalOrder(orderData); // when offline
 *   syncEngine.syncPending(restaurantId); // when back online
 */

import { supabase } from './supabase';

const STORAGE_KEY = 'kushina_pending_orders';

export interface LocalOrder {
  local_id: string;
  restaurant_id: string;
  table_id?: string;
  order_type: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  customer_name?: string;
  items: Array<{
    menu_item_id?: string;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    modifier_choices: any[];
    notes?: string;
  }>;
  created_at: string;
}

function getPending(): LocalOrder[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function savePending(orders: LocalOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export const syncEngine = {
  /** Save an order locally when offline */
  saveLocalOrder(order: Omit<LocalOrder, 'local_id' | 'created_at'>): LocalOrder {
    const localOrder: LocalOrder = {
      ...order,
      local_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    const pending = getPending();
    pending.push(localOrder);
    savePending(pending);
    return localOrder;
  },

  /** Get count of pending unsynced orders */
  getPendingCount(): number {
    return getPending().length;
  },

  /** Sync all pending orders to Supabase */
  async syncPending(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    const pending = getPending();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remaining: LocalOrder[] = [];

    for (const order of pending) {
      try {
        // Insert order (upsert on local_id to handle double-submit)
        const { data: inserted, error } = await supabase
          .from('orders')
          .upsert(
            {
              restaurant_id: order.restaurant_id,
              table_id: order.table_id ?? null,
              order_type: order.order_type,
              status: order.status,
              subtotal: order.subtotal,
              tax_amount: order.tax_amount,
              discount_amount: order.discount_amount,
              total: order.total,
              customer_name: order.customer_name ?? null,
              local_id: order.local_id,
              synced_at: new Date().toISOString(),
              created_at: order.created_at,
            },
            { onConflict: 'restaurant_id,local_id' }
          )
          .select()
          .single();

        if (error) throw error;

        // Insert order items
        if (order.items?.length) {
          await supabase.from('order_items').insert(
            order.items.map((item) => ({
              order_id: inserted.id,
              menu_item_id: item.menu_item_id ?? null,
              menu_item_name: item.menu_item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              modifier_choices: item.modifier_choices,
              notes: item.notes ?? null,
              status: 'pending',
            }))
          );
        }

        synced++;
        onProgress?.(synced, pending.length);
      } catch (err) {
        console.error('Failed to sync order:', order.local_id, err);
        failed++;
        remaining.push(order); // keep failed ones for retry
      }
    }

    // Save back only the ones that failed
    savePending(remaining);
    return { synced, failed };
  },

  /** Clear all pending orders (use carefully) */
  clearPending() {
    savePending([]);
  },
};

/** Hook-friendly wrapper to start sync when connection is restored */
export async function triggerSync(onComplete?: (result: { synced: number; failed: number }) => void) {
  const count = syncEngine.getPendingCount();
  if (count === 0) return;

  const result = await syncEngine.syncPending();
  onComplete?.(result);
}
