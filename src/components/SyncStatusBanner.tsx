import React from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export function SyncStatusBanner() {
  const { isOnline, pendingSyncCount } = useNetwork();

  if (isOnline && pendingSyncCount === 0) return null;

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
