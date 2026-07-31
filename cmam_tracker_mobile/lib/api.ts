import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { appConfig } from './config';
import { logger } from './logger';

const isWeb = Platform.OS === 'web';

// Storage abstraction for web/native compatibility
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

const api = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

let _onUnauthorized: (() => void) | null = null;
let _unauthorizedFiring = false;
let _isRefreshing = false;
let _refreshPromise: Promise<string | null> | null = null;

export function setOnUnauthorized(callback: () => void) {
  _onUnauthorized = callback;
}

// Attempt to refresh the access token using the stored refresh token.
// Returns the new access token, or null if refresh failed.
async function tryRefreshToken(): Promise<string | null> {
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  _isRefreshing = true;
  _refreshPromise = (async () => {
    try {
      const refreshToken = await storage.getItem('auth_refresh_token');
      if (!refreshToken) return null;

      const response = await axios.post(
        `${appConfig.apiBaseUrl}/v1/token/refresh/`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
      );

      if (response.data?.success && response.data?.data?.token) {
        const newToken = response.data.data.token;
        await storage.setItem('auth_token', newToken);
        return newToken;
      }
      return null;
    } catch {
      // Refresh token is also expired — clean up
      await storage.deleteItem('auth_refresh_token');
      return null;
    } finally {
      _isRefreshing = false;
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error?.config?.url ?? '';
    const isAuthEndpoint = url.includes('/v1/login') || url.includes('/v1/logout') || url.includes('/v1/token/refresh');
    const originalRequest = error?.config;
    const status = error?.response?.status;

    // Handle 401 Unauthorized — try to refresh the token and retry
    if (
      status === 401 &&
      !isAuthEndpoint &&
      originalRequest &&
      !originalRequest._retryAttempted
    ) {
      originalRequest._retryAttempted = true; // Prevent infinite retry loop

      const newToken = await tryRefreshToken();
      if (newToken) {
        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        try {
          return await api(originalRequest);
        } catch (retryError) {
          // Retry also failed — fall through to unauthorized handler
        }
      }

      // Refresh failed or retry failed — fire unauthorized handler
      if (_onUnauthorized && !_unauthorizedFiring) {
        _unauthorizedFiring = true;
        try {
          _onUnauthorized();
        } finally {
          setTimeout(() => { _unauthorizedFiring = false; }, 5000);
        }
      }
      return Promise.reject(error);
    }

    // Handle 401 on auth endpoints (login/refresh) — just reject, no retry
    if (status === 401 && isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Handle 429 Rate Limit
    if (status === 429) {
      const retryAfter = error.response?.data?.retry_after || 60;
      const message = error.response?.data?.error || `Rate limit exceeded. Please wait ${retryAfter} seconds.`;

      // Enhance error with user-friendly message
      error.userMessage = message;

      // Could implement automatic retry with exponential backoff here
      logger.warn(`[API] Rate limited. Retry after: ${retryAfter}s`);
    }

    return Promise.reject(error);
  }
);

export { storage };
export default api;
