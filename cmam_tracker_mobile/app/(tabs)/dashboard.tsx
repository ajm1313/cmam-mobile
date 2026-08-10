import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';

import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { logger } from '../../lib/logger';
import { setCache, getCacheFallback } from '../../lib/cache';
import { useOfflineSync } from '../../lib/useOfflineSync';
import OfflineBanner from '../../components/OfflineBanner';
import { SyncStatusBanner } from '../../components/SyncStatus';
import { Skeleton, CardSkeleton } from '../../components/LoadingSkeleton';
import PickerSelect from '../../components/PickerSelect';
import type { Facility, DashboardStats } from '../../lib/types';

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  bannerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  welcomeText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.3 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  roleText: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  avatarCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  locationText: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  scopeText: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '500', fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 16, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  section: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 14, letterSpacing: -0.2 },
  sectionCount: { color: colors.textMuted, fontWeight: '500' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: '47%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  facilityRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12,
  },
  facilityIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  facilityInfo: { flex: 1 },
  facilityName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  facilityMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  moreText: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 10, fontWeight: '500' },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: colors.primary + '10', borderColor: colors.primary + '30',
  },
  syncText: { fontSize: 12, fontWeight: '600', color: colors.primary, flex: 1 },
  // Filter bar
  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
  },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtnText: { fontSize: 13, fontWeight: '600' },
  filterBadge: {
    width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  clearBtn: { padding: 4 },
  // Filter modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { paddingHorizontal: 20, paddingVertical: 16 },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  pickerWrap: { marginBottom: 0 },
  periodRow: { flexDirection: 'row', marginTop: 14 },
  modalActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  modalBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1.5,
  },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
  // Programme Guide
  guideCard: {
    marginHorizontal: 12, marginTop: 12, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#1e293b',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  guideHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  guideIconWrap: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  guideTitle: { fontSize: 13, fontWeight: '800', color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: 0.8 },
  guideBody: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  guideText: { fontSize: 13, color: '#dbeafe', flex: 1, lineHeight: 19 },
  guideBold: { fontWeight: '800', color: '#fff' },
  // Analytics Charts
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, paddingHorizontal: 8, paddingTop: 10 },
  chartBar: { flex: 1, alignItems: 'center', gap: 4 },
  barGroup: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 100 },
  barSam: { width: 8, borderRadius: 3 },
  barMam: { width: 8, borderRadius: 3 },
  chartLabel: { fontSize: 9, fontWeight: '600' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  outcomesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
  outcomeItem: { width: '48%', borderRadius: 10, padding: 10, backgroundColor: colors.background },
  outcomeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  outcomeDot: { width: 8, height: 8, borderRadius: 4 },
  outcomeLabel: { fontSize: 11, fontWeight: '600' },
  outcomeValue: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  outcomeBar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  outcomeBarFill: { height: '100%', borderRadius: 3 },
  outcomePct: { fontSize: 10, fontWeight: '600', marginTop: 4 },
});
interface Region { id: number; name: string }
interface District { id: number; name: string; region_id: number }
interface SubDistrict { id: number; name: string; district_id: number }

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];
const YEARS = (() => {
  const now = new Date();
  const arr: { value: string; label: string }[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    arr.push({ value: String(y), label: String(y) });
  }
  return arr;
})();

interface DashboardData {
  facilities: Facility[];
  stats: DashboardStats | null;
}

interface MonthlyTrend { month: string; sam: number; mam: number; }
interface Outcomes { cured: number; defaulted: number; died: number; transferred: number; active: number; }
interface AnalyticsData {
  monthly_trends: MonthlyTrend[];
  outcomes: Outcomes;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const { pendingCount, isSyncing } = useOfflineSync();

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);
  const [selRegion, setSelRegion] = useState<string>('');
  const [selDistrict, setSelDistrict] = useState<string>('');
  const [selSubDistrict, setSelSubDistrict] = useState<string>('');
  const [selFacility, setSelFacility] = useState<string>('');
  const [selMonth, setSelMonth] = useState<string>('');
  const [selYear, setSelYear] = useState<string>('');

  const isFacilityUser = !!(user?.location?.facility_id);

  const CACHE_KEY = 'dashboard_data';

  const buildParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (selRegion) p.region = selRegion;
    if (selDistrict) p.district = selDistrict;
    if (selSubDistrict) p.sub_district = selSubDistrict;
    if (selFacility) p.facility = selFacility;
    if (selMonth) p.month = selMonth;
    if (selYear) p.year = selYear;
    return p;
  }, [selRegion, selDistrict, selSubDistrict, selFacility, selMonth, selYear]);

  const hasFilters = !!(selRegion || selDistrict || selSubDistrict || selFacility || selMonth || selYear);

  const fetchData = useCallback(async () => {
    // Restore from cache immediately for instant display
    const cached = await getCacheFallback<DashboardData>(CACHE_KEY);
    if (cached && !data) {
      setData(cached.data);
      setIsStale(cached.isStale);
      setLoading(false);
    }

    try {
      const params = buildParams();
      const [facilitiesRes, statsRes, analyticsRes] = await Promise.all([
        api.get('/v1/facilities/'),
        api.get('/v1/dashboard/stats/', { params }).catch(() => ({ data: { data: null } })),
        api.get('/v1/dashboard/analytics/', { params }).catch(() => ({ data: { data: null } })),
      ]);
      const freshData: DashboardData = {
        facilities: facilitiesRes.data.data ?? [],
        stats: statsRes.data.data ?? null,
      };
      setData(freshData);
      setAnalytics(analyticsRes.data.data ?? null);
      setIsStale(false);
      await setCache(CACHE_KEY, freshData, 15 * 60 * 1000); // 15 min TTL
    } catch (e) {
      logger.error('Dashboard fetch error:', e);
      // If we already showed cached data, just mark stale
      if (!data && cached) {
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch regions on mount for non-facility users
  useEffect(() => {
    if (!isFacilityUser) {
      api.get('/v1/locations/regions/').then(r => setRegions(r.data.data ?? [])).catch(() => {});
    }
  }, [isFacilityUser]);

  // Fetch districts when region changes
  useEffect(() => {
    if (selRegion) {
      api.get('/v1/locations/districts/', { params: { region_id: selRegion } })
        .then(r => setDistricts(r.data.data ?? [])).catch(() => {});
    } else {
      setDistricts([]);
    }
    setSelDistrict('');
    setSubDistricts([]);
    setSelSubDistrict('');
  }, [selRegion]);

  // Fetch sub-districts when district changes
  useEffect(() => {
    if (selDistrict) {
      api.get('/v1/locations/sub-districts/', { params: { district_id: selDistrict } })
        .then(r => setSubDistricts(r.data.data ?? [])).catch(() => {});
    } else {
      setSubDistricts([]);
    }
    setSelSubDistrict('');
  }, [selDistrict]);

  const applyFilter = () => {
    setFilterActive(hasFilters);
    setShowFilter(false);
    fetchData();
  };

  const clearFilter = () => {
    setSelRegion(''); setSelDistrict(''); setSelSubDistrict('');
    setSelFacility(''); setSelMonth(''); setSelYear('');
    setFilterActive(false);
    setShowFilter(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const roleName = user?.role?.name ?? 'User';
  const facilityName = user?.location?.facility_name;
  const districtName = user?.location?.district_name;
  const regionName = user?.location?.region_name;
  const locationLabel = facilityName ?? districtName ?? regionName ?? 'National';

  // All roles can access all Quick Actions

  // Describe the scope of data being shown
  const dataScopeLabel = facilityName
    ? `Facility: ${facilityName}`
    : districtName
    ? `District: ${districtName}`
    : regionName
    ? `Region: ${regionName}`
    : 'National View';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Welcome Banner */}
      <View style={[styles.banner, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
        <View style={styles.bannerContent}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
            <View style={styles.roleChip}>
              <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.roleText}>{roleName}</Text>
            </View>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.locationText}>{locationLabel}</Text>
        </View>
        <View style={[styles.scopeRow]}>
          <Ionicons name="funnel-outline" size={11} color="rgba(255,255,255,0.55)" />
          <Text style={styles.scopeText}>Data scope: {dataScopeLabel}</Text>
        </View>
      </View>

      <OfflineBanner isStale={isStale} />
      <SyncStatusBanner />

      {/* Filter Bar */}
      {!isFacilityUser && (
        <View style={[styles.filterBar, { backgroundColor: colors.surface, borderColor: filterActive ? colors.primary + '40' : colors.border }]}>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilter(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter-outline" size={16} color={filterActive ? colors.primary : colors.textSecondary} />
            <Text style={[styles.filterBtnText, { color: filterActive ? colors.primary : colors.textSecondary }]}>
              {filterActive ? 'Filter Active' : 'Filter Dashboard'}
            </Text>
            {filterActive && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterBadgeText}>!</Text>
              </View>
            )}
          </TouchableOpacity>
          {filterActive && (
            <TouchableOpacity onPress={clearFilter} activeOpacity={0.7} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {pendingCount > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
          )}
          <Text style={[styles.syncText, { color: colors.primary }]}>
            {isSyncing ? 'Syncing...' : `${pendingCount} item${pendingCount > 1 ? 's' : ''} pending sync`}
          </Text>
        </View>
      )}

      {/* Quick Stats */}
      {loading && !data ? (
        <View style={{ padding: 12, gap: 8 }}>
          <View style={styles.statsRow}>
            <Skeleton width="31%" height={86} borderRadius={14} />
            <Skeleton width="31%" height={86} borderRadius={14} />
            <Skeleton width="31%" height={86} borderRadius={14} />
          </View>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard icon="pulse-outline" label="Active SAM" value={data?.stats?.active_sam ?? 0} color={colors.sam} bg={colors.surface} mutedColor={colors.textMuted} />
            <StatCard icon="trending-up-outline" label="Active MAM" value={data?.stats?.active_mam ?? 0} color={colors.mam} bg={colors.surface} mutedColor={colors.textMuted} />
            <StatCard icon="checkmark-done-outline" label="Discharged" value={data?.stats?.total_discharged ?? 0} color={colors.success} bg={colors.surface} mutedColor={colors.textMuted} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="business-outline" label="Facilities" value={data?.stats?.facilities_count ?? 0} color={colors.primary} bg={colors.surface} mutedColor={colors.textMuted} />
            <StatCard icon="alert-circle-outline" label="Defaulters" value={data?.stats?.defaulters ?? 0} color={colors.danger} bg={colors.surface} mutedColor={colors.textMuted} />
            <StatCard icon="documents-outline" label="Total Cases" value={data?.stats?.total_all_cases ?? 0} color={colors.secondary} bg={colors.surface} mutedColor={colors.textMuted} />
          </View>

          {/* Quick Actions — role-filtered */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <ActionButton icon="person-add-outline" label="Register Case" color={colors.primary} bg={colors.surfaceSecondary} borderColor={colors.border} textColor={colors.textPrimary} onPress={() => router.push('/case/register')} />
              <ActionButton icon="people-outline" label="View Cases" color={colors.secondary} bg={colors.surfaceSecondary} borderColor={colors.border} textColor={colors.textPrimary} onPress={() => router.push('/(tabs)/cases')} />
              <ActionButton icon="cube-outline" label="Inventory" color={colors.warning} bg={colors.surfaceSecondary} borderColor={colors.border} textColor={colors.textPrimary} onPress={() => router.push('/(tabs)/inventory')} />
              <ActionButton icon="bar-chart-outline" label="Reports" color={colors.success} bg={colors.surfaceSecondary} borderColor={colors.border} textColor={colors.textPrimary} onPress={() => router.push('/(tabs)/reports')} />
            </View>
          </View>

          {/* Analytics Charts */}
          {analytics && (
            <>
              {/* Monthly Admission Trends */}
              {analytics.monthly_trends.length > 0 && (
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Admission Trends (6 months)</Text>
                  <View style={styles.chartRow}>
                    {analytics.monthly_trends.map((t, i) => {
                      const maxVal = Math.max(...analytics.monthly_trends.map(x => Math.max(x.sam, x.mam)), 1);
                      const samH = Math.max((t.sam / maxVal) * 100, 2);
                      const mamH = Math.max((t.mam / maxVal) * 100, 2);
                      return (
                        <View key={i} style={styles.chartBar}>
                          <View style={styles.barGroup}>
                            <View style={[styles.barSam, { height: samH, backgroundColor: colors.sam }]} />
                            <View style={[styles.barMam, { height: mamH, backgroundColor: colors.mam }]} />
                          </View>
                          <Text style={[styles.chartLabel, { color: colors.textMuted }]}>{t.month.split(' ')[0]}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.sam }]} />
                      <Text style={[styles.legendText, { color: colors.textMuted }]}>SAM</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.mam }]} />
                      <Text style={[styles.legendText, { color: colors.textMuted }]}>MAM</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Case Outcomes */}
              {analytics.outcomes && (
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Case Outcomes</Text>
                  <View style={styles.outcomesRow}>
                    {[
                      { label: 'Active', value: analytics.outcomes.active, color: colors.success },
                      { label: 'Cured', value: analytics.outcomes.cured, color: '#2563eb' },
                      { label: 'Defaulted', value: analytics.outcomes.defaulted, color: colors.warning },
                      { label: 'Died', value: analytics.outcomes.died, color: colors.danger },
                      { label: 'Transferred', value: analytics.outcomes.transferred, color: '#7c3aed' },
                    ].map(o => {
                      const total = analytics.outcomes.active + analytics.outcomes.cured + analytics.outcomes.defaulted + analytics.outcomes.died + analytics.outcomes.transferred || 1;
                      const pct = Math.round((o.value / total) * 100);
                      return (
                        <View key={o.label} style={styles.outcomeItem}>
                          <View style={styles.outcomeHeader}>
                            <View style={[styles.outcomeDot, { backgroundColor: o.color }]} />
                            <Text style={[styles.outcomeLabel, { color: colors.textSecondary }]}>{o.label}</Text>
                          </View>
                          <Text style={[styles.outcomeValue, { color: colors.textPrimary }]}>{o.value}</Text>
                          <View style={[styles.outcomeBar, { backgroundColor: colors.border }]}>
                            <View style={[styles.outcomeBarFill, { width: `${pct}%`, backgroundColor: o.color }]} />
                          </View>
                          <Text style={[styles.outcomePct, { color: colors.textMuted }]}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Accessible Facilities — backend-filtered by role */}
          {data && data.facilities.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Accessible Facilities
                  <Text style={{ color: colors.textMuted, fontWeight: '500' }}> ({data.facilities.length})</Text>
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Ionicons name="lock-closed-outline" size={10} color={colors.primary} />
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>{roleName}</Text>
                </View>
              </View>
              {data.facilities.slice(0, 5).map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.facilityRow, { borderBottomColor: colors.border }]}
                  onPress={() => router.push(`/facility/${f.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.facilityIcon, { backgroundColor: colors.primary + '12' }]}>
                    <Ionicons name="business" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.facilityInfo}>
                    <Text style={[styles.facilityName, { color: colors.textPrimary }]}>{f.name}</Text>
                    <Text style={[styles.facilityMeta, { color: colors.textMuted }]}>{f.type} • {f.district_name ?? 'N/A'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
              {data.facilities.length > 5 && (
                <Text style={[styles.moreText, { color: colors.textMuted }]}>+{data.facilities.length - 5} more facilities</Text>
              )}
            </View>
          )}
        </>
      )}

      {/* Programme Guide */}
      <View style={styles.guideCard}>
        <View style={styles.guideHeader}>
          <View style={styles.guideIconWrap}>
            <Ionicons name="information-circle-outline" size={16} color="#fff" />
          </View>
          <Text style={styles.guideTitle}>Programme Guide</Text>
        </View>
        <View style={styles.guideBody}>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#f87171' }]} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>SAM</Text> — MUAC {'<'} 11.5cm or WFH {'<'} -3 SD or bilateral oedema
            </Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#fbbf24' }]} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>MAM</Text> — MUAC 11.5–12.5cm or WFH -2 to -3 SD
            </Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#4ade80' }]} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Visits</Text> — Weekly for SAM, bi-weekly for MAM
            </Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#93c5fd' }]} />
            <Text style={styles.guideText}>
              <Text style={styles.guideBold}>Discharge</Text> — MUAC ≥ 12.5cm for 2 consecutive visits
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 24 }} />

      {/* Filter Modal */}
      <Modal visible={showFilter} animationType="slide" transparent={true} onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Filter Dashboard</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Region */}
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Region</Text>
              <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <PickerSelect
                  placeholder={{ label: 'All Regions', value: '' }}
                  value={selRegion}
                  onValueChange={setSelRegion}
                  items={regions.map(r => ({ label: r.name, value: String(r.id) }))}
                  colors={colors}
                />
              </View>

              {/* District */}
              <Text style={[styles.filterLabel, { color: colors.textSecondary, marginTop: 14 }]}>District</Text>
              <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <PickerSelect
                  placeholder={{ label: selRegion ? 'All Districts' : 'Select Region First', value: '' }}
                  value={selDistrict}
                  onValueChange={setSelDistrict}
                  items={districts.map(d => ({ label: d.name, value: String(d.id) }))}
                  colors={colors}
                  disabled={!selRegion}
                />
              </View>

              {/* Sub-District */}
              <Text style={[styles.filterLabel, { color: colors.textSecondary, marginTop: 14 }]}>Sub-District</Text>
              <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <PickerSelect
                  placeholder={{ label: selDistrict ? 'All Sub-Districts' : 'Select District First', value: '' }}
                  value={selSubDistrict}
                  onValueChange={setSelSubDistrict}
                  items={subDistricts.map(s => ({ label: s.name, value: String(s.id) }))}
                  colors={colors}
                  disabled={!selDistrict}
                />
              </View>

              {/* Facility */}
              <Text style={[styles.filterLabel, { color: colors.textSecondary, marginTop: 14 }]}>Facility</Text>
              <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <PickerSelect
                  placeholder={{ label: 'All Facilities', value: '' }}
                  value={selFacility}
                  onValueChange={setSelFacility}
                  items={(data?.facilities ?? []).map(f => ({ label: f.name, value: String(f.id) }))}
                  colors={colors}
                />
              </View>

              {/* Period */}
              <View style={styles.periodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Month</Text>
                  <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                    <PickerSelect
                      placeholder={{ label: 'All Months', value: '' }}
                      value={selMonth}
                      onValueChange={setSelMonth}
                      items={MONTHS}
                      colors={colors}
                    />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Year</Text>
                  <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                    <PickerSelect
                      placeholder={{ label: 'All Years', value: '' }}
                      value={selYear}
                      onValueChange={setSelYear}
                      items={YEARS}
                      colors={colors}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={clearFilter}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={applyFilter}
                activeOpacity={0.85}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color, bg, mutedColor }: { icon: any; label: string; value: number; color: string; bg: string; mutedColor: string }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.statCard, { borderTopColor: color, backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function ActionButton({ icon, label, color, onPress, bg, borderColor, textColor }: { icon: any; label: string; color: string; onPress: () => void; bg: string; borderColor: string; textColor: string }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: bg, borderColor }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}


