/**
 * offlineQueue.ts — thin adapter over sync-store.ts (single source of truth).
 * All callers of the old imperative API continue to work unchanged.
 */
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { useSyncStore } from './sync-store';

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  data?: any;
  timestamp: number;
  label: string;
}

/** Add a request to the unified sync queue. */
export async function enqueue(req: Omit<QueuedRequest, 'id' | 'timestamp'>): Promise<void> {
  useSyncStore.getState().enqueue({
    url: req.url,
    method: req.method.toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: req.data,
    label: req.label,
  });
}

/** Get all queued requests (mapped from sync-store shape). */
export async function getQueue(): Promise<QueuedRequest[]> {
  return useSyncStore.getState().queue.map((q) => ({
    id: q.id,
    url: q.url,
    method: q.method.toLowerCase() as 'post' | 'put' | 'patch' | 'delete',
    data: q.data,
    timestamp: q.timestamp,
    label: q.label,
  }));
}

/** Count of pending requests. */
export async function getQueueCount(): Promise<number> {
  return useSyncStore.getState().queue.length;
}

/** Clear entire queue. */
export async function clearQueue(): Promise<void> {
  useSyncStore.getState().clear();
}

/**
 * Process the offline queue — delegates to sync-store.sync().
 * Returns { synced, failed } for backward compatibility.
 */
export async function processQueue(): Promise<{ synced: number; failed: number }> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { synced: 0, failed: 0 };

  const store = useSyncStore.getState();
  const before = store.queue.length;
  if (!before) return { synced: 0, failed: 0 };

  await store.sync();

  const after = useSyncStore.getState().queue.length;
  return { synced: before - after, failed: after };
}

/**
 * Send immediately if online, otherwise queue and alert the user.
 */
export async function sendOrQueue(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete',
  data: any,
  label: string,
): Promise<any | null> {
  const netState = await NetInfo.fetch();

  if (netState.isConnected && netState.isInternetReachable !== false) {
    const { default: api } = await import('./api');
    return api.request({ url, method, data });
  }

  if (data instanceof FormData) {
    Alert.alert(
      'Cannot Save Offline',
      `"${label}" includes a file upload that cannot be saved offline. Please connect to the internet and try again.`,
      [{ text: 'OK' }],
    );
    return null;
  }

  await enqueue({ url, method, data, label });
  Alert.alert(
    'Saved Offline',
    `"${label}" has been saved and will sync automatically when you're back online.`,
    [{ text: 'OK' }],
  );
  return null;
}

/**
 * Send immediately if online, otherwise reject with a clear error.
 * Use for operations that cannot be queued offline (e.g. user management,
 * authentication, role assignment) — these require immediate server validation.
 */
export async function sendOrReject(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete',
  data: any,
  label: string,
): Promise<any> {
  const netState = await NetInfo.fetch();

  if (netState.isConnected && netState.isInternetReachable !== false) {
    const { default: api } = await import('./api');
    return api.request({ url, method, data });
  }

  Alert.alert(
    'Internet Required',
    `"${label}" requires an internet connection and cannot be saved offline. Please connect and try again.`,
    [{ text: 'OK' }],
  );
  throw new Error(`${label} requires internet connection`);
}
