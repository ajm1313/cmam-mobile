import { create } from 'zustand';
import api, { storage } from './api';
import { clearAllCache } from './cache';
import type { User } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user: User) => set({ user }),

  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/v1/login/', { email, password });
      const { user, token, refresh_token } = response.data.data;
      await storage.setItem('auth_token', token);
      if (refresh_token) {
        await storage.setItem('auth_refresh_token', refresh_token);
      }
      await storage.setItem('auth_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (e: any) {
      throw e;
    }
  },

  logout: async () => {
    try {
      await api.post('/v1/logout/');
    } catch {
      // ignore
    }
    await storage.deleteItem('auth_token');
    await storage.deleteItem('auth_refresh_token');
    await storage.deleteItem('auth_user');
    await clearAllCache();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const cachedUser = await storage.getItem('auth_user');
      if (cachedUser) {
        set({ user: JSON.parse(cachedUser), token, isAuthenticated: true, isLoading: false });
      }
      try {
        const res = await api.get('/v1/profile/');
        const fresh = res.data.data;
        await storage.setItem('auth_user', JSON.stringify(fresh));
        set({ user: fresh, token, isAuthenticated: true, isLoading: false });
      } catch (e: any) {
        // The interceptor handles 401s (token refresh → retry, or logout).
        // Here we only handle non-401 errors (network errors, server errors).
        // Keep cached user visible but always clear loading state.
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
