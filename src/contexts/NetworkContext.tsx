import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Network } from '@capacitor/network';
import { syncEngine, triggerSync } from '../lib/sync';

interface NetworkContextValue {
  isOnline: boolean;
  pendingSyncCount: number;
  failedSyncCount: number;
  setPendingSyncCount: (n: number) => void;
  refreshSyncStatus: () => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  pendingSyncCount: 0,
  failedSyncCount: 0,
  setPendingSyncCount: () => {},
  refreshSyncStatus: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(syncEngine.getPendingCount());
  const [failedSyncCount, setFailedSyncCount] = useState(syncEngine.getFailedCount());

  const refreshSyncStatus = () => {
    setPendingSyncCount(syncEngine.getPendingCount());
    setFailedSyncCount(syncEngine.getFailedCount());
  };

  useEffect(() => {
    // 1. Initial status from Capacitor Network
    Network.getStatus().then(status => {
      setIsOnline(status.connected);
    }).catch(() => {
      setIsOnline(navigator.onLine);
    });

    const runSync = () => {
      const count = syncEngine.getPendingCount();
      if (count > 0) {
        triggerSync((result) => {
          console.log(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
          refreshSyncStatus();
        });
      } else {
        refreshSyncStatus();
      }
    };

    // 2. Native listener (Capacitor)
    let listenerHandle: any = null;
    Network.addListener('networkStatusChange', status => {
      setIsOnline(status.connected);
      if (status.connected) {
        runSync();
      }
    }).then(handle => {
      listenerHandle = handle;
    }).catch(() => {
      // Browser fallback
    });

    // 3. Browser event fallback
    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also run sync on mount if online
    if (navigator.onLine) {
      runSync();
    }

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        try {
          listenerHandle.remove();
        } catch {
          // ignore
        }
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, pendingSyncCount, failedSyncCount, setPendingSyncCount, refreshSyncStatus }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
