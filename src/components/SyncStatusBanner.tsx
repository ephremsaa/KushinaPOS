import React, { useState } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { syncEngine, triggerSync } from '../lib/sync';

export function SyncStatusBanner() {
  const { isOnline, pendingSyncCount, failedSyncCount, refreshSyncStatus } = useNetwork();
  const [showReview, setShowReview] = useState(false);

  if (isOnline && pendingSyncCount === 0 && failedSyncCount === 0) return null;

  if (failedSyncCount > 0) {
    const failedOrders = syncEngine.getAllOrders().filter(o => o.sync_status === 'failed');

    if (showReview) {
      return (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-surface border-t shadow-lg p-4 max-h-[50vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Failed Orders ({failedSyncCount})
            </h3>
            <button onClick={() => setShowReview(false)} className="text-muted hover:text-gray-700">Close</button>
          </div>
          <div className="space-y-4">
            {failedOrders.map(order => (
              <div key={order.local_id} className="border rounded p-3 bg-red-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-gray-800">Order ID: {order.local_id.slice(0, 8)}</span>
                    <p className="text-sm text-red-600 mt-1">{order.error_reason}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${order.total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => {
                      syncEngine.discardOrder(order.local_id);
                      refreshSyncStatus();
                      if (failedOrders.length === 1) setShowReview(false);
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => {
                      syncEngine.retryOrder(order.local_id);
                      refreshSyncStatus();
                      triggerSync(() => refreshSyncStatus());
                      if (failedOrders.length === 1) setShowReview(false);
                    }}
                    className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className="sync-banner bg-red-500 text-white cursor-pointer hover:bg-red-600"
        onClick={() => setShowReview(true)}
      >
        <AlertTriangle className="w-4 h-4" />
        <span>
          {failedSyncCount} order{failedSyncCount > 1 ? 's' : ''} could not be synced — tap to review
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'sync-banner',
        isOnline && pendingSyncCount > 0 ? 'sync-syncing' :
        !isOnline ? 'sync-offline' : 'sync-online'
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>
            Offline
            {pendingSyncCount > 0 && ` — ${pendingSyncCount} order${pendingSyncCount > 1 ? 's' : ''} pending`}
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing {pendingSyncCount} order{pendingSyncCount > 1 ? 's' : ''}…</span>
        </>
      )}
    </div>
  );
}
