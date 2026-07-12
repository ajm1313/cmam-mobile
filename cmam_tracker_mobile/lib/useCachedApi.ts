import { useState, useCallback } from 'react';
import api from './api';
import { setCache, getCache, getCacheFallback } from './cache';

interface UseCachedApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for API calls with transparent AsyncStorage caching.
 *
 * - First render: serves cached data immediately (if available), then
 *   fetches fresh data in the background and updates the cache.
 * - Offline: serves stale cache with `isStale = true`.
 * - No cache & offline: returns `error`.
 *
 * @param url    API endpoint (e.g. '/v1/dashboard/stats/')
 * @param cacheKey  Unique key for this data set
 * @param ttlMs  Cache time-to-live in ms (default 10 min)
 */
export function useCachedApi<T>(
  url: string,
  cacheKey: string,
  ttlMs = 10 * 60 * 1000,
): UseCachedApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);

    // 1. Try fresh cache first for instant display
    const cached = await getCache<T>(cacheKey);
    if (cached) {
      setData(cached);
      setIsStale(false);
      setLoading(false);
    }

    // 2. Fetch from network
    try {
      const res = await api.get(url);
      const freshData: T = res.data?.data ?? res.data;
      setData(freshData);
      setIsStale(false);
      setLoading(false);
      // Write to cache in background
      await setCache(cacheKey, freshData, ttlMs);
    } catch (e: any) {
      // 3. Network failed — try stale cache fallback
      if (!cached) {
        const fallback = await getCacheFallback<T>(cacheKey);
        if (fallback) {
          setData(fallback.data);
          setIsStale(true);
          setLoading(false);
        } else {
          setError(e.response?.data?.message || 'Unable to load data. Check your connection.');
          setLoading(false);
        }
      }
      // If we already showed cached data, keep it and mark stale
      else {
        setIsStale(true);
      }
    }
  }, [url, cacheKey, ttlMs]);

  return { data, loading, error, isStale, refresh };
}
