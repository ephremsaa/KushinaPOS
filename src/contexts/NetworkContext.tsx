import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync pending orders when connection is restored
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
