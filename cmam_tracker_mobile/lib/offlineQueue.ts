/** Durable, user-scoped adapter for the mobile synchronization outbox. */
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import { useSyncStore } from './sync-store';
import { useAuthStore } from './store';

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  data?: any;
  timestamp: number;
  label: string;
}

export function createClientUid(): string {
  const randomUUID = (globalThis.crypto as any)?.randomUUID;
  if (randomUUID) return randomUUID.call(globalThis.crypto);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    return (character === 'x' ? random : (random & 3) | 8).toString(16);
  });
}

function ownerId(): string {
  return String(useAuthStore.getState().user?.id || '');
}

async function persistUpload(file: { uri: string; name?: string; type?: string }) {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return file;
  const directory = `${FileSystem.documentDirectory}offline-uploads/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = (file.name || file.uri).match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
  const target = `${directory}${createClientUid()}${extension}`;
  await FileSystem.copyAsync({ from: file.uri, to: target });
  return { ...file, uri: target, offlineFile: true };
}

async function serialiseFormData(data: FormData): Promise<Record<string, any>> {
  const serialized: Record<string, any> = { _formData: true };
  const parts = typeof (data as any).getParts === 'function' ? (data as any).getParts() : [];
  for (const part of parts) {
    const key = part.fieldName;
    if (part.uri) {
      serialized[key] = await persistUpload({
        uri: part.uri,
        name: part.fileName || part.name || 'photo.jpg',
        type: part.type || 'image/jpeg',
      });
    } else {
      serialized[key] = part.string;
    }
  }
  return serialized;
}

/** Add a request to the unified synchronization queue. */
export async function enqueue(req: Omit<QueuedRequest, 'id' | 'timestamp'> & { clientUid?: string }): Promise<string> {
  const data = req.data instanceof FormData ? await serialiseFormData(req.data) : req.data;
  return useSyncStore.getState().enqueue({
    url: req.url,
    method: req.method.toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data,
    label: req.label,
    ownerId: ownerId(),
    clientUid: req.clientUid || data?.client_uid,
  });
}

/** Get queued requests belonging to the signed-in user. */
export async function getQueue(): Promise<QueuedRequest[]> {
  const owner = ownerId();
  return useSyncStore.getState().queue
    .filter((item) => !item.ownerId || item.ownerId === owner)
    .map((item) => ({
      id: item.id,
      url: item.url,
      method: item.method.toLowerCase() as QueuedRequest['method'],
      data: item.data,
      timestamp: item.timestamp,
      label: item.label,
    }));
}

export async function getQueueCount(): Promise<number> {
  return (await getQueue()).length;
}

export async function clearQueue(): Promise<void> {
  useSyncStore.getState().clear(ownerId());
}

export async function processQueue() {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return { synced: 0, failed: 0 };
  return useSyncStore.getState().sync(ownerId());
}

async function saveOffline(url: string, method: QueuedRequest['method'], data: any, label: string) {
  await enqueue({ url, method, data, label, clientUid: data instanceof FormData ? undefined : data?.client_uid });
  Alert.alert('Saved Offline', `“${label}” is safely stored on this device and will sync automatically.`);
  return null;
}

/** Send immediately, falling back to the durable queue only for connectivity failures. */
export async function sendOrQueue(
  url: string,
  method: QueuedRequest['method'],
  data: any,
  label: string,
): Promise<any | null> {
  const network = await NetInfo.fetch();
  if (network.isConnected && network.isInternetReachable !== false) {
    const { default: api } = await import('./api');
    try {
      return await api.request({ url, method, data });
    } catch (error: any) {
      // Server validation/permission errors must be shown, never hidden in the queue.
      if (error?.response) throw error;
      return saveOffline(url, method, data, label);
    }
  }
  return saveOffline(url, method, data, label);
}

/** Operations requiring immediate server validation are deliberately not queued. */
export async function sendOrReject(
  url: string,
  method: QueuedRequest['method'],
  data: any,
  label: string,
): Promise<any> {
  const network = await NetInfo.fetch();
  if (network.isConnected && network.isInternetReachable !== false) {
    const { default: api } = await import('./api');
    return api.request({ url, method, data });
  }
  Alert.alert('Internet Required', `“${label}” needs an internet connection.`);
  throw new Error(`${label} requires internet connection`);
}
