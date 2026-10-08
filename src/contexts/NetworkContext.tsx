import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Network } from '@capacitor/network';
import { syncEngine, triggerSync } from '../lib/sync';

interface NetworkContextValue {
  isOnline: boolean;
  pendingSyncCount: number;
  setPendingSyncCount: (n: number) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  pendingSyncCount: 0,
  setPendingSyncCount: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(syncEngine.getPendingCount());

  useEffect(() => {
    // 1. Initial status from Capacitor Network
    Network.getStatus().then(status => {
      setIsOnline(status.connected);
    }).catch(() => {
      setIsOnline(navigator.onLine);
    });

    // 2. Native listener
    let listenerHandle: any = null;
    try {
      listenerHandle = Network.addListener('networkStatusChange', status => {
        setIsOnline(status.connected);
        if (status.connected) {
          const count = syncEngine.getPendingCount();
          if (count > 0) {
            triggerSync((result) => {
              console.log(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
              setPendingSyncCount(syncEngine.getPendingCount());
            });
          }
        }
      });
    } catch {
      // Browser fallback
    }

    // 3. Browser event fallback
    const handleOnline = () => {
      setIsOnline(true);
      const count = syncEngine.getPendingCount();
      if (count > 0) {
        triggerSync((result) => {
          console.log(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
          setPendingSyncCount(syncEngine.getPendingCount());
        });
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, pendingSyncCount, setPendingSyncCount }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
