/**
 * kushinaPOS Offline Sync Engine
 *
 * Stores orders locally in localStorage when offline
 * and syncs them via ordersApi when connectivity is restored.
 */

import { ordersApi } from './api';

const STORAGE_KEY = 'kushina_pending_orders';

export interface LocalOrder {
  local_id: string;
  restaurant_id: string;
  table_id?: string | null;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  customer_name?: string | null;
  notes?: string | null;
  items: Array<{
    menu_item_id?: string | null;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    modifier_choices: any[];
    notes?: string | null;
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
  saveLocalOrder(order: Omit<LocalOrder, 'created_at'>): LocalOrder {
    const localOrder: LocalOrder = {
      ...order,
      local_id: order.local_id || crypto.randomUUID(),
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

  /** Get all pending orders */
  getPendingOrders(): LocalOrder[] {
    return getPending();
  },

  /** Sync all pending orders to Backend API */
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
        await ordersApi.create({
          restaurant_id: order.restaurant_id,
          table_id: order.table_id || null,
          order_type: order.order_type,
          status: order.status || 'new',
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          discount_amount: order.discount_amount,
          total: order.total,
          customer_name: order.customer_name || null,
          notes: order.notes || null,
          local_id: order.local_id,
          items: order.items,
        });

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
