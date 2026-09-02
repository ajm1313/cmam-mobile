import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';
import { clearAllCache } from './cache';

export type SyncItemState = 'queued' | 'syncing' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, any>;
  timestamp: number;
  retries: number;
  label: string;
  ownerId: string;
  state: SyncItemState;
  lastError?: string;
  clientUid?: string;
  conflict?: boolean;
  conflictMessage?: string;
  serverData?: Record<string, any>;
}

export interface SyncResult { synced: number; failed: number; }

function reconstructFormData(data: Record<string, any>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (key === '_formData' || value === null || value === undefined) continue;
    formData.append(key, value as any);
  }
  return formData;
}

function payloadFor(item: SyncQueueItem) {
  return item.data?._formData ? reconstructFormData(item.data) : item.data;
}

function errorMessage(error: any): string {
  const body = error?.response?.data;
  if (typeof body?.message === 'string') return body.message;
  if (typeof body?.error === 'string') return body.error;
  if (body?.errors) return Object.entries(body.errors).map(([key, value]) => `${key}: ${String(value)}`).join('; ');
  return error?.message || 'Synchronization failed.';
}

async function send(item: SyncQueueItem) {
  const payload = payloadFor(item);
  if (item.method === 'DELETE') return api.delete(item.url);
  if (item.method === 'PATCH') return api.patch(item.url, payload);
  if (item.method === 'PUT') return api.put(item.url, payload);
  return api.post(item.url, payload);
}

function ownedBy(item: SyncQueueItem, ownerId?: string) {
  return !ownerId || !item.ownerId || item.ownerId === ownerId;
}

async function deleteStoredFiles(item?: SyncQueueItem) {
  if (!item?.data) return;
  const files = Object.values(item.data).filter((value: any) => value?.offlineFile && value?.uri) as { uri: string }[];
  await Promise.all(files.map((file) => FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => {})));
}

interface SyncState {
  queue: SyncQueueItem[];
  isSyncing: boolean;
  lastSyncAt: number | null;
  enqueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries' | 'state'> & Partial<Pick<SyncQueueItem, 'state'>>) => string;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  sync: (ownerId?: string) => Promise<SyncResult>;
  clear: (ownerId?: string) => void;
  resolveConflict: (id: string, resolution: 'mine' | 'server') => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      lastSyncAt: null,

      enqueue: (item) => {
        const id = item.clientUid || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          queue: [...state.queue, {
            ...item,
            id,
            ownerId: item.ownerId || '',
            state: item.state || 'queued',
            timestamp: Date.now(),
            retries: 0,
          }],
        }));
        return id;
      },

      removeItem: (id) => {
        const item = get().queue.find((entry) => entry.id === id);
        set((state) => ({ queue: state.queue.filter((entry) => entry.id !== id) }));
        deleteStoredFiles(item).catch(() => {});
      },

      retryItem: (id) => set((state) => ({
        queue: state.queue.map((item) => item.id === id
          ? { ...item, state: 'queued', conflict: false, lastError: undefined, conflictMessage: undefined }
          : item),
      })),

      sync: async (ownerId) => {
        if (get().isSyncing) return { synced: 0, failed: get().queue.filter((item) => ownedBy(item, ownerId)).length };
        const eligible = get().queue.filter((item) => ownedBy(item, ownerId));
        if (!eligible.length) return { synced: 0, failed: 0 };

        set({ isSyncing: true });
        let synced = 0;
        let failed = 0;
        try {
          for (const snapshot of eligible) {
            const current = get().queue.find((item) => item.id === snapshot.id);
            if (!current) continue;
            if (current.state === 'failed' || current.state === 'conflict' || current.conflict) {
              failed += 1;
              continue;
            }
            if (!current.ownerId && ownerId) {
              current.ownerId = ownerId;
            }
            set((state) => ({
              queue: state.queue.map((item) => item.id === current.id ? { ...current, state: 'syncing' } : item),
            }));
            try {
              const response = await send(current);
              const serverCaseId = response?.data?.data?.id;
              if (current.url === '/v1/cases/create/' && current.clientUid && serverCaseId) {
                const pendingUrl = `/v1/cases/client/${current.clientUid}/visits/record/`;
                set((state) => ({
                  queue: state.queue.map((item) => item.url === pendingUrl
                    ? { ...item, url: `/v1/cases/${serverCaseId}/visits/record/` }
                    : item),
                }));
              }
              get().removeItem(current.id);
              synced += 1;
            } catch (error: any) {
              const httpStatus = error?.response?.status;
              const message = errorMessage(error);
              if (httpStatus === 409 && (current.method === 'PATCH' || current.method === 'PUT')) {
                let serverData: Record<string, any> | undefined;
                try {
                  const response = await api.get(current.url.replace(/\/edit\/?$/, '/'));
                  serverData = response.data?.data ?? response.data;
                } catch { /* Best effort for the comparison screen. */ }
                set((state) => ({ queue: state.queue.map((item) => item.id === current.id ? {
                  ...current,
                  ownerId: current.ownerId || ownerId || '',
                  state: 'conflict',
                  conflict: true,
                  conflictMessage: message,
                  lastError: message,
                  serverData,
                } : item) }));
              } else {
                const shouldRetry = !httpStatus || httpStatus >= 500 || httpStatus === 401 || httpStatus === 403 || httpStatus === 429;
                set((state) => ({ queue: state.queue.map((item) => item.id === current.id ? {
                  ...current,
                  ownerId: current.ownerId || ownerId || '',
                  state: shouldRetry ? 'queued' : 'failed',
                  lastError: message,
                  retries: current.retries + 1,
                } : item) }));
              }
              failed += 1;
            }
          }
        } finally {
          set({ isSyncing: false, lastSyncAt: Date.now() });
        }
        if (synced) clearAllCache().catch(() => {});
        return { synced, failed };
      },

      clear: (ownerId) => {
        const removed = get().queue.filter((item) => ownedBy(item, ownerId));
        set((state) => ({ queue: ownerId ? state.queue.filter((item) => !ownedBy(item, ownerId)) : [] }));
        removed.forEach((item) => deleteStoredFiles(item).catch(() => {}));
      },

      resolveConflict: async (id, resolution) => {
        const item = get().queue.find((entry) => entry.id === id);
        if (!item) return;
        if (resolution === 'server') {
          get().removeItem(id);
          return;
        }
        const data = { ...item.data };
        delete data._updated_at;
        try {
          await send({ ...item, data });
          get().removeItem(id);
        } catch (error: any) {
          const message = errorMessage(error);
          set((state) => ({ queue: state.queue.map((entry) => entry.id === id
            ? { ...entry, state: 'conflict', conflict: true, conflictMessage: message, lastError: message }
            : entry) }));
        }
      },
    }),
    {
      name: 'cmam_sync_queue',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted: any) => ({
        ...persisted,
        queue: (persisted?.queue || []).map((item: any) => ({
          ...item,
          ownerId: item.ownerId || '',
          state: item.conflict ? 'conflict' : (item.state || 'queued'),
          lastError: item.lastError || item.conflictMessage,
        })),
      }),
      partialize: (state) => ({ queue: state.queue, lastSyncAt: state.lastSyncAt }),
    }
  )
);
