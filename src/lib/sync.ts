/**
 * kushinaPOS Offline Sync Engine
 *
 * Stores orders locally in localStorage when offline
 * and syncs them via ordersApi when connectivity is restored.
 */

import { ordersApi, ApiError } from './api';

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
  
  // Sync metadata
  attempts?: number;
  sync_status?: 'pending' | 'failed';
  error_reason?: string | null;
  next_retry_at?: string | null;
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
  saveLocalOrder(order: Omit<LocalOrder, 'created_at' | 'local_id'> & { local_id?: string }): LocalOrder {
    const localOrder: LocalOrder = {
      ...order,
      local_id: order.local_id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      attempts: 0,
      sync_status: 'pending',
    };
    const pending = getPending();
    pending.push(localOrder);
    savePending(pending);
    return localOrder;
  },

  /** Get count of pending unsynced orders */
  getPendingCount(): number {
    return getPending().filter(o => o.sync_status === 'pending').length;
  },

  /** Get count of failed orders that require review */
  getFailedCount(): number {
    return getPending().filter(o => o.sync_status === 'failed').length;
  },

  /** Get all orders in local queue */
  getAllOrders(): LocalOrder[] {
    return getPending();
  },
  
  /** Discard a failed order */
  discardOrder(local_id: string) {
    const pending = getPending().filter(o => o.local_id !== local_id);
    savePending(pending);
  },

  /** Mark a failed order to retry immediately */
  retryOrder(local_id: string) {
    const pending = getPending();
    const order = pending.find(o => o.local_id === local_id);
    if (order) {
      order.sync_status = 'pending';
      order.attempts = 0;
      order.next_retry_at = null;
      order.error_reason = null;
      savePending(pending);
    }
  },

  /** Sync all pending orders to Backend API */
  async syncPending(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    const allOrders = getPending();
    const now = new Date();
    
    // Only attempt pending orders that are due for retry
    const toSync = allOrders.filter(o => 
      o.sync_status === 'pending' && 
      (!o.next_retry_at || new Date(o.next_retry_at) <= now)
    );

    if (toSync.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failedCount = 0;
    const remaining: LocalOrder[] = [];

    // Store orders that are not part of this sync batch
    for (const order of allOrders) {
      if (!toSync.some(o => o.local_id === order.local_id)) {
        remaining.push(order);
      }
    }

    for (const order of toSync) {
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
        onProgress?.(synced, toSync.length);
      } catch (err: any) {
        console.error('Failed to sync order:', order.local_id, err);
        
        order.attempts = (order.attempts || 0) + 1;
        let shouldRetry = true;
        
        if (err instanceof ApiError) {
          const status = err.status;
          // HTTP 4xx (except 408 Timeout and 429 Too Many Requests) are permanent errors
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            shouldRetry = false;
          }
        }
        
        order.error_reason = err.message || 'Unknown network error';

        const MAX_ATTEMPTS = 5;
        if (shouldRetry && order.attempts < MAX_ATTEMPTS) {
          // Exponential backoff: 2s, 4s, 8s, 16s...
          const backoffMs = Math.pow(2, order.attempts) * 1000;
          order.next_retry_at = new Date(Date.now() + backoffMs).toISOString();
          order.sync_status = 'pending';
        } else {
          order.sync_status = 'failed';
          failedCount++;
        }
        
        remaining.push(order);
      }
    }

    savePending(remaining);
    return { synced, failed: failedCount };
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
