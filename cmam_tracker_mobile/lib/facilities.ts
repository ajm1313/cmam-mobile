/**
 * Facility loading with offline support.
 *
 * Facilities change rarely but are required to register a case, so the full
 * accessible-facility list is cached with a long TTL. When the device is
 * offline (or the request fails) the cached list is served instead, which
 * keeps case registration usable for sub-district, district, regional,
 * national and superadmin users who must pick a facility from a list.
 */

import api from './api';
import { setCache, getCache, getCacheFallback } from './cache';
import type { Facility } from './types';

/** Facilities rarely change — keep them for 30 days so offline use is reliable. */
export const FACILITY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Single cache key holding every accessible facility, filtered client-side. */
const FACILITY_CACHE_KEY = 'facilities_all';

export type FacilityType = 'OPC' | 'IPC';

export interface FacilitiesResult {
  facilities: Facility[];
  /** True when the list came from cache because the network was unavailable. */
  fromCache: boolean;
}

function filterByType(list: Facility[], type?: FacilityType): Facility[] {
  if (!type) return list;
  return list.filter((f) => (f.type ?? '').toUpperCase() === type);
}

/**
 * Persist the accessible facility list so it can be used offline.
 * Safe to call from any screen that already loaded facilities.
 */
export async function primeFacilityCache(list: Facility[]): Promise<void> {
  if (Array.isArray(list) && list.length) {
    await setCache(FACILITY_CACHE_KEY, list, FACILITY_CACHE_TTL_MS);
  }
}

/**
 * Load accessible facilities, optionally filtered by type.
 *
 * Order of preference:
 *   1. Network (result is written to cache).
 *   2. Cached list — even if stale — when the network fails.
 */
export async function fetchFacilities(type?: FacilityType): Promise<FacilitiesResult> {
  try {
    // Fetch every accessible facility so one cache entry serves OPC and IPC.
    const res = await api.get('/v1/facilities/', { params: { page_size: 500 } });
    const list: Facility[] = res.data?.data ?? [];
    await primeFacilityCache(list);
    return { facilities: filterByType(list, type), fromCache: false };
  } catch {
    // Offline or server error — fall back to whatever we cached previously.
    const fallback = await getCacheFallback<Facility[]>(FACILITY_CACHE_KEY);
    if (fallback) {
      return { facilities: filterByType(fallback.data, type), fromCache: true };
    }
    return { facilities: [], fromCache: false };
  }
}

/**
 * Read facilities from cache only, without touching the network.
 * Returns null when nothing has been cached yet.
 */
export async function getCachedFacilities(type?: FacilityType): Promise<Facility[] | null> {
  const cached = await getCache<Facility[]>(FACILITY_CACHE_KEY);
  if (cached) return filterByType(cached, type);
  const fallback = await getCacheFallback<Facility[]>(FACILITY_CACHE_KEY);
  return fallback ? filterByType(fallback.data, type) : null;
}
