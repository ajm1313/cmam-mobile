import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from './sync-store';

/**
 * Hook that auto-syncs the unified offline queue when connectivity returns.
 * Returns { pendingCount, isSyncing, syncNow } — backed by sync-store.
 */
export function useOfflineSync() {
  const { queue, isSyncing, sync } = useSyncStore();
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && wasOffline.current) {
        const { queue: q } = useSyncStore.getState();
        if (q.length > 0) {
          await useSyncStore.getState().sync();
        }
      }
      wasOffline.current = !state.isConnected;
    });
    return () => unsubscribe();
  }, []);

  return {
    pendingCount: queue.length,
    isSyncing,
    syncNow: sync,
  };
}
