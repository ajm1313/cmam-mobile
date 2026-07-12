import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { appConfig } from './config';

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

export function setOnUnauthorized(callback: () => void) {
  _onUnauthorized = callback;
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
    const isAuthEndpoint = url.includes('/v1/login') || url.includes('/v1/logout');
    
    // Handle 401 Unauthorized
    if (
      error?.response?.status === 401 &&
      !isAuthEndpoint &&
      _onUnauthorized &&
      !_unauthorizedFiring
    ) {
      _unauthorizedFiring = true;
      try {
        _onUnauthorized();
      } finally {
        setTimeout(() => { _unauthorizedFiring = false; }, 5000);
      }
    }
    
    // Handle 429 Rate Limit
    if (error?.response?.status === 429) {
      const retryAfter = error.response?.data?.retry_after || 60;
      const message = error.response?.data?.error || `Rate limit exceeded. Please wait ${retryAfter} seconds.`;
      
      // Enhance error with user-friendly message
      error.userMessage = message;
      
      // Could implement automatic retry with exponential backoff here
      console.warn(`[API] Rate limited. Retry after: ${retryAfter}s`);
    }
    
    return Promise.reject(error);
  }
);

export { storage };
export default api;
