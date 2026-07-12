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
    console.log('[LOGIN] baseURL:', api.defaults.baseURL);
    console.log('[LOGIN] Attempting login with email:', email);
    console.log('[LOGIN] Full URL:', api.defaults.baseURL + '/v1/login/');
    try {
      const response = await api.post('/v1/login/', { email, password });
      console.log('[LOGIN] SUCCESS:', response.status);
      console.log('[LOGIN] Response data:', JSON.stringify(response.data));
      const { user, token } = response.data.data;
      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (e: any) {
      console.log('[LOGIN] ERROR:', e.message);
      console.log('[LOGIN] response status:', e.response?.status);
      console.log('[LOGIN] response data:', JSON.stringify(e.response?.data));
      console.log('[LOGIN] response headers:', JSON.stringify(e.response?.headers));
      console.log('[LOGIN] request:', JSON.stringify(e.config));
      console.log('[LOGIN] code:', e.code);
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
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          if (cachedUser) {
            // Token expired but we have cached data — keep user visible offline.
            // The onUnauthorized interceptor will redirect to login when they
            // perform an action while online.
            await storage.deleteItem('auth_token');
            set({ token: null, isLoading: false });
          } else {
            // No cached data — full sign-out.
            await storage.deleteItem('auth_token');
            await storage.deleteItem('auth_user');
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        } else if (!cachedUser) {
          set({ isLoading: false });
        }
        // Network error with cached user: state already set above — nothing to do.
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
