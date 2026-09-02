import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from './sync-store';
import { useAuthStore } from './store';

/** Automatically synchronize the signed-in user's outbox at startup and reconnect. */
export function useOfflineSync() {
  const userId = useAuthStore((state) => state.user?.id);
  const queue = useSyncStore((state) => state.queue);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const ownerId = String(userId || '');

  const syncNow = useCallback(
    () => useSyncStore.getState().sync(ownerId),
    [ownerId],
  );

  useEffect(() => {
    if (!ownerId) return;
    const synchronizeIfOnline = async (providedState?: Awaited<ReturnType<typeof NetInfo.fetch>>) => {
      const state = providedState || await NetInfo.fetch();
      if (state.isConnected && state.isInternetReachable !== false) {
        const pending = useSyncStore.getState().queue.some((item) => !item.ownerId || item.ownerId === ownerId);
        if (pending) await useSyncStore.getState().sync(ownerId);
      }
    };
    synchronizeIfOnline();
    const unsubscribe = NetInfo.addEventListener(synchronizeIfOnline);
    return unsubscribe;
  }, [ownerId]);

  return {
    pendingCount: queue.filter((item) => !item.ownerId || item.ownerId === ownerId).length,
    isSyncing,
    syncNow,
  };
}
