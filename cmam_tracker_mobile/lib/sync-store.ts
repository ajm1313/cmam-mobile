import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export interface SyncQueueItem {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  data?: Record<string, any>;
  timestamp: number;
  retries: number;
  label: string;
  conflict?: boolean;
  conflictMessage?: string;
}

interface SyncState {
  queue: SyncQueueItem[];
  isSyncing: boolean;
  lastSyncAt: number | null;
  enqueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) => void;
  removeItem: (id: string) => void;
  sync: () => Promise<void>;
  clear: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      lastSyncAt: null,

      enqueue: (item) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          queue: [...state.queue, { ...item, id, timestamp: Date.now(), retries: 0 }],
        }));
      },

      removeItem: (id) => {
        set((state) => ({ queue: state.queue.filter((q) => q.id !== id) }));
      },

      sync: async () => {
        const { queue } = get();
        if (queue.length === 0) return;

        set({ isSyncing: true });
        const failed: SyncQueueItem[] = [];

        for (const item of queue) {
          // Skip items already flagged as conflicts — user must resolve manually
          if (item.conflict) {
            failed.push(item);
            continue;
          }
          try {
            if (item.method === 'DELETE') {
              await api.delete(item.url);
            } else if (item.method === 'PATCH') {
              await api.patch(item.url, item.data);
            } else {
              await api.post(item.url, item.data);
            }
            get().removeItem(item.id);
          } catch (err: any) {
            const httpStatus = err?.response?.status;
            // 409 Conflict — record was modified remotely; surface to user, stop retrying
            if (httpStatus === 409) {
              const msg = err?.response?.data?.message ?? 'Record was modified remotely.';
              failed.push({ ...item, conflict: true, conflictMessage: msg });
            } else if (httpStatus && httpStatus >= 400 && httpStatus < 500 && item.retries >= 3) {
              // Unrecoverable 4xx after max retries — drop it
            } else {
              failed.push({ ...item, retries: item.retries + 1 });
            }
          }
        }

        set({ queue: failed, isSyncing: false, lastSyncAt: Date.now() });
      },

      clear: () => set({ queue: [] }),
    }),
    {
      name: 'cmam_sync_queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
