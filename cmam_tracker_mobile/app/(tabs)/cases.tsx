import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, FlatList,
  TouchableOpacity, TextInput, Share, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../lib/store';

import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { setCache, getCacheFallback } from '../../lib/cache';
import OfflineBanner from '../../components/OfflineBanner';
import { SyncStatusBanner } from '../../components/SyncStatus';
import EmptyState from '../../components/EmptyState';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import { useFocusEffect } from 'expo-router';
import type { OpcCase, Region, District, SubDistrict, Facility } from '../../lib/types';
import PickerSelect from '../../components/PickerSelect';
import { useSyncStore } from '../../lib/sync-store';

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  quickScroll: { flexGrow: 0, flexShrink: 0 },
  quickCard: {
    width: 130,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  quickIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardText: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', margin: 12, borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipActiveSecondary: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipTextActiveSecondary: { color: '#fff' },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 8,
  },
  summaryText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  legendRow: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
  },
  exportBtnText: { fontSize: 11, fontWeight: '700' },
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  childName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  childId: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  duePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.danger + '10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  dueText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  cardMetric: { alignItems: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 1 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  advToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5,
  },
  advToggleText: { fontSize: 12, fontWeight: '600' },
  advModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  advModalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, maxHeight: '80%' },
  advModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  advModalTitle: { fontSize: 16, fontWeight: '800' },
  advField: { paddingHorizontal: 20, paddingTop: 16 },
  advLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  advInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 8 },
  advChipRow: { flexDirection: 'row', gap: 8 },
  advChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  advChipText: { fontSize: 13, fontWeight: '700' },
  advRow: { flexDirection: 'row', gap: 8 },
  advActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 20 },
  advBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  advBtnText: { fontSize: 14, fontWeight: '700' },
});
type CaseType = 'ALL' | 'SAM' | 'High-risk MAM' | 'Other MAM';
type StatusFilter = 'active' | 'discharged' | 'defaulter' | 'all';

export default function CasesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const syncQueue = useSyncStore((state) => state.queue);
  const canRegisterCase = !!(user?.is_superuser || user?.is_staff || user?.location?.facility_id);
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [cases, setCases] = useState<OpcCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [caseType, setCaseType] = useState<CaseType>('ALL');
  const caseTypeLabel: Record<CaseType, string> = {
    ALL: 'ALL',
    SAM: 'SAM',
    'High-risk MAM': 'High Risk MAM',
    'Other MAM': 'Other MAM',
  };
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const facilityId = user?.location?.facility_id;
  const isSuperAdmin = !!(user?.is_superuser);

  // Location filter state
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selRegion, setSelRegion] = useState('');
  const [selDistrict, setSelDistrict] = useState('');
  const [selSubDistrict, setSelSubDistrict] = useState('');
  const [selFacility, setSelFacility] = useState('');

  const cacheKey = `cases_${statusFilter}_${caseType}_${facilityId ?? 'all'}_${selRegion || '0'}_${selDistrict || '0'}_${selSubDistrict || '0'}_${selFacility || '0'}`;

  const fetchCases = useCallback(async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      const params: Record<string, any> = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page: pageNum,
        page_size: 50,
      };
      if (caseType === 'SAM') {
        params.case_type = 'SAM';
      } else if (caseType === 'High-risk MAM') {
        params.case_type = 'MAM';
        params.mam_type = 'High-risk MAM';
      } else if (caseType === 'Other MAM') {
        params.case_type = 'MAM';
        params.mam_type = 'Other MAM';
      }
      if (selFacility) params.facility_id = selFacility;
      else if (selSubDistrict) params.sub_district_id = selSubDistrict;
      else if (selDistrict) params.district_id = selDistrict;
      else if (selRegion) params.region_id = selRegion;
      else if (facilityId) params.facility_id = facilityId;
      const res = await api.get('/v1/cases/', { params });
      const fresh = res.data.data ?? [];
      const pagination = res.data.pagination;
      if (pageNum === 1) {
        setCases(fresh);
        await setCache(cacheKey, fresh, 10 * 60 * 1000);
      } else {
        setCases(prev => [...prev, ...fresh]);
      }
      setHasMore(pagination?.has_next ?? false);
      setTotalCount(pagination?.total ?? fresh.length);
      setPage(pageNum);
      setIsStale(false);
    } catch {
      if (pageNum === 1) {
        const cached = await getCacheFallback<OpcCase[]>(cacheKey);
        if (cached) {
          setCases(cached.data);
          setIsStale(true);
        } else {
          setCases([]);
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, caseType, facilityId, selRegion, selDistrict, selSubDistrict, selFacility, cacheKey]);

  useFocusEffect(useCallback(() => { fetchCases(); }, [fetchCases]));

  const [exporting, setExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [muacMax, setMuacMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch regions on mount (superadmin only sees all; facility users get scoped by API)
  useFocusEffect(useCallback(() => {
    if (!isSuperAdmin && facilityId) return; // facility users don't need location filters
    api.get('/v1/locations/regions/').then(r => setRegions(r.data.data || [])).catch(() => {});
  }, [isSuperAdmin, facilityId]));

  // Cascading: fetch districts when region changes
  const onRegionChange = useCallback((val: string) => {
    setSelRegion(val);
    setSelDistrict('');
    setSelSubDistrict('');
    setSelFacility('');
    setDistricts([]);
    setSubDistricts([]);
    setFacilities([]);
    if (val) {
      api.get(`/v1/locations/districts/?region_id=${val}`).then(r => setDistricts(r.data.data || [])).catch(() => {});
      api.get(`/v1/facilities/?region=${val}&page_size=500`).then(r => setFacilities(r.data.data || [])).catch(() => {});
    }
  }, []);

  // Cascading: fetch sub-districts when district changes
  const onDistrictChange = useCallback((val: string) => {
    setSelDistrict(val);
    setSelSubDistrict('');
    setSelFacility('');
    setSubDistricts([]);
    setFacilities([]);
    if (val) {
      api.get(`/v1/locations/sub-districts/?district_id=${val}`).then(r => setSubDistricts(r.data.data || [])).catch(() => {});
      api.get(`/v1/facilities/?district=${val}&page_size=500`).then(r => setFacilities(r.data.data || [])).catch(() => {});
    }
  }, []);

  // Cascading: fetch facilities when sub-district changes
  const onSubDistrictChange = useCallback((val: string) => {
    setSelSubDistrict(val);
    setSelFacility('');
    if (val) {
      api.get(`/v1/facilities/?sub_district=${val}&page_size=500`).then(r => setFacilities(r.data.data || [])).catch(() => {});
    }
  }, []);

  const hasLocationFilter = !!selRegion || !!selDistrict || !!selSubDistrict || !!selFacility;
  const hasAdvanced = genderFilter !== 'all' || ageMin || ageMax || muacMax || dateFrom || dateTo || hasLocationFilter;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCases(1);
    setRefreshing(false);
  }, [fetchCases]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchCases(page + 1);
    }
  }, [hasMore, loadingMore, loading, page, fetchCases]);

  const handleExport = async (format: 'excel' | 'csv') => {
    setExporting(true);
    try {
      const params: Record<string, string> = { format };
      if (caseType === 'SAM') params.type = 'SAM';
      else if (caseType === 'High-risk MAM') { params.type = 'MAM'; params.mam_type = 'High-risk MAM'; }
      else if (caseType === 'Other MAM') { params.type = 'MAM'; params.mam_type = 'Other MAM'; }
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.get('/v1/export/cases/', {
        params,
        responseType: 'arraybuffer',
      });

      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const mimeType = format === 'excel' ?
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
        'text/csv';
      const fileName = `cases_${caseType}_${statusFilter}_${Date.now()}.${ext}`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const base64 = btoa(
        new Uint8Array(res.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: 'Export Cases' });
      } else {
        Alert.alert('Export Complete', `File saved: ${fileName}`);
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'Could not export cases.');
    } finally {
      setExporting(false);
    }
  };

  const filtered = cases.filter((c) => {
    let match = c.child_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.registration_number?.toLowerCase().includes(search.toLowerCase());
    if (hasAdvanced) {
      if (genderFilter !== 'all' && c.child_gender !== genderFilter) match = false;
      if (ageMin && (c.age_months ?? 0) < parseInt(ageMin)) match = false;
      if (ageMax && (c.age_months ?? 0) > parseInt(ageMax)) match = false;
      if (muacMax && (c.muac_cm ?? 0) > parseFloat(muacMax)) match = false;
      if (dateFrom && c.admission_date && new Date(c.admission_date) < new Date(dateFrom)) match = false;
      if (dateTo && c.admission_date && new Date(c.admission_date) > new Date(dateTo)) match = false;
    }
    return match;
  });
  const currentOwner = String(user?.id || '');
  const pendingCases = syncQueue.filter((item) => {
    if (item.url !== '/v1/cases/create/' || item.method !== 'POST') return false;
    if (item.ownerId && item.ownerId !== currentOwner) return false;
    const data = item.data || {};
    const nameMatches = String(data.child_name || '').toLowerCase().includes(search.toLowerCase());
    const typeMatches = caseType === 'ALL'
      || (caseType === 'SAM' && data.malnutrition_type === 'SAM')
      || (caseType !== 'SAM' && data.malnutrition_type === 'MAM' && (!data.mam_type || data.mam_type === caseType));
    return nameMatches && typeMatches && (statusFilter === 'active' || statusFilter === 'all');
  });

  const clearAdvanced = () => {
    setGenderFilter('all'); setAgeMin(''); setAgeMax(''); setMuacMax(''); setDateFrom(''); setDateTo('');
    setSelRegion(''); setSelDistrict(''); setSelSubDistrict(''); setSelFacility('');
    setDistricts([]); setSubDistricts([]); setFacilities([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={isStale} />
      <SyncStatusBanner />

      {/* Clinical Quick Actions — horizontally scrollable premium cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 10 }}
        style={styles.quickScroll}
      >
        {[
          { label: 'Due Visits', icon: 'alarm-outline' as const, color: colors.danger, route: '/case/due-visits' },
          { label: 'Discharge', icon: 'exit-outline' as const, color: colors.warning, route: '/case/discharge' },
          { label: 'Dashboard', icon: 'bar-chart-outline' as const, color: colors.primary, route: '/admin/case-dashboard' },
          { label: 'Reminders', icon: 'notifications-outline' as const, color: colors.secondary, route: '/case/visit-schedule' },
          { label: 'Batch Visit', icon: 'add-circle-outline' as const, color: colors.success, route: '/case/batch-visit' },
          { label: 'IPC', icon: 'medkit-outline' as const, color: '#7c3aed', route: '/case/ipc-list' },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[
              styles.quickCard,
              {
                backgroundColor: colors.surface,
                borderColor: action.color + '30',
                shadowColor: action.color,
              },
            ]}
            onPress={() => router.push(action.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon} size={20} color={action.color} />
            </View>
            <Text style={[styles.quickCardText, { color: colors.textPrimary }]} numberOfLines={2}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search by name or ID..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type Filter */}
      <View style={styles.filterRow}>
        {(['ALL', 'SAM', 'High-risk MAM', 'Other MAM'] as CaseType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, caseType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setCaseType(t)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, caseType === t && { color: '#fff' }]}>{caseTypeLabel[t]}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {(['active', 'discharged', 'defaulter', 'all'] as StatusFilter[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, statusFilter === s && { backgroundColor: colors.secondary, borderColor: colors.secondary }]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, statusFilter === s && { color: '#fff' }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Advanced Filter Toggle */}
      <TouchableOpacity
        style={[styles.advToggle, { backgroundColor: colors.surface, borderColor: hasAdvanced ? colors.primary : colors.border }]}
        onPress={() => setShowAdvanced(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="options-outline" size={14} color={hasAdvanced ? colors.primary : colors.textMuted} />
        <Text style={[styles.advToggleText, { color: hasAdvanced ? colors.primary : colors.textMuted }]}>
          Advanced Filters {hasAdvanced ? `(Active${hasLocationFilter ? ' — Location' : ''})` : ''}
        </Text>
        {hasAdvanced && (
          <TouchableOpacity onPress={clearAdvanced} style={{ marginLeft: 'auto' }}>
            <Ionicons name="close-circle" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Summary + Export */}
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: colors.textMuted }]}>
          {search || hasAdvanced ? `${filtered.length + pendingCases.length} of ${totalCount + pendingCases.length}` : `${totalCount + pendingCases.length}`} case{totalCount + pendingCases.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.legendRow}>
          <LegendDot color={colors.sam} label="SAM" mutedColor={colors.textMuted} />
          <LegendDot color={colors.mam} label="MAM" mutedColor={colors.textMuted} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: colors.success + '40', backgroundColor: colors.success + '10' }]}
            onPress={() => handleExport('excel')}
            disabled={exporting}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size={14} color={colors.success} />
            ) : (
              <Ionicons name="logo-microsoft" size={14} color={colors.success} />
            )}
            <Text style={[styles.exportBtnText, { color: colors.success }]}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: colors.secondary + '40', backgroundColor: colors.secondary + '10' }]}
            onPress={() => handleExport('csv')}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={14} color={colors.secondary} />
            <Text style={[styles.exportBtnText, { color: colors.secondary }]}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={<>
          {pendingCases.map((item) => {
            const data = item.data || {};
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => router.push({
                  pathname: '/visit/[caseId]',
                  params: {
                    caseId: item.clientUid || data.client_uid,
                    caseClientUid: item.clientUid || data.client_uid,
                    caseName: data.child_name,
                    caseType: data.malnutrition_type,
                    caseAge: String(data.age_months || ''),
                    admissionWeight: String(data.weight_kg || ''),
                    facilityId: String(data.facility_id || ''),
                    visitNumber: '1',
                  },
                })}
              >
                <PendingCaseCard item={item} colors={colors} />
              </TouchableOpacity>
            );
          })}
          {loading ? (
          <View style={{ paddingTop: 8 }}>
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : filtered.length === 0 && pendingCases.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No cases found"
            subtitle={search ? 'Try a different search term' : 'No cases match the selected filters'}
          />
        ) : null}
        </>}
        ListEmptyComponent={!loading && pendingCases.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No cases found"
            subtitle={search ? 'Try a different search term' : 'No cases match the selected filters'}
          />
        ) : null}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/case/[id]', params: { id: String(c.id) } })}
          >
            <CaseCard item={c} colors={colors} />
          </TouchableOpacity>
        )}
        ListFooterComponent={loadingMore ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      />

      {/* FAB - Register Case (only for facility-level users and admins) */}
      {canRegisterCase && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          onPress={() => router.push('/case/register')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Advanced Filter Modal */}
      <Modal visible={showAdvanced} animationType="slide" transparent={true} onRequestClose={() => setShowAdvanced(false)}>
        <View style={styles.advModalOverlay}>
          <View style={[styles.advModalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.advModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.advModalTitle, { color: colors.textPrimary }]}>Advanced Filters</Text>
              <TouchableOpacity onPress={() => setShowAdvanced(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Location Filters */}
              {(!facilityId || isSuperAdmin) && (
                <View style={styles.advField}>
                  <Text style={[styles.advLabel, { color: colors.textMuted }]}>Location Filters</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Filter cases by geographic hierarchy</Text>
                  <PickerSelect
                    placeholder={{ label: 'All Regions', value: '' }}
                    value={selRegion}
                    onValueChange={onRegionChange}
                    items={regions.map(r => ({ label: r.name, value: String(r.id) }))}
                    colors={colors}
                  />
                  <View style={{ height: 8 }} />
                  <PickerSelect
                    placeholder={{ label: 'All Districts', value: '' }}
                    value={selDistrict}
                    onValueChange={onDistrictChange}
                    items={districts.map(d => ({ label: d.name, value: String(d.id) }))}
                    colors={colors}
                    disabled={!selRegion}
                  />
                  <View style={{ height: 8 }} />
                  <PickerSelect
                    placeholder={{ label: 'All Sub-Districts', value: '' }}
                    value={selSubDistrict}
                    onValueChange={onSubDistrictChange}
                    items={subDistricts.map(s => ({ label: s.name, value: String(s.id) }))}
                    colors={colors}
                    disabled={!selDistrict}
                  />
                  <View style={{ height: 8 }} />
                  <PickerSelect
                    placeholder={{ label: 'All Facilities', value: '' }}
                    value={selFacility}
                    onValueChange={setSelFacility}
                    items={facilities.map(f => ({ label: f.name, value: String(f.id) }))}
                    colors={colors}
                    disabled={!selRegion}
                  />
                </View>
              )}

              <View style={styles.advField}>
                <Text style={[styles.advLabel, { color: colors.textMuted }]}>Gender</Text>
                <View style={styles.advChipRow}>
                  {['all', 'Male', 'Female'].map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.advChip, { borderColor: genderFilter === g ? colors.primary : colors.border, backgroundColor: genderFilter === g ? colors.primary + '15' : 'transparent' }]}
                      onPress={() => setGenderFilter(g)}
                    >
                      <Text style={[styles.advChipText, { color: genderFilter === g ? colors.primary : colors.textMuted }]}>{g === 'all' ? 'All' : g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.advField}>
                <Text style={[styles.advLabel, { color: colors.textMuted }]}>Age Range (months)</Text>
                <View style={styles.advRow}>
                  <TextInput style={[styles.advInput, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]} value={ageMin} onChangeText={setAgeMin} keyboardType="numeric" placeholder="Min (e.g. 6)" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[styles.advInput, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]} value={ageMax} onChangeText={setAgeMax} keyboardType="numeric" placeholder="Max (e.g. 59)" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <View style={styles.advField}>
                <Text style={[styles.advLabel, { color: colors.textMuted }]}>MUAC Max (cm)</Text>
                <TextInput style={[styles.advInput, { borderColor: colors.border, color: colors.textPrimary }]} value={muacMax} onChangeText={setMuacMax} keyboardType="decimal-pad" placeholder="e.g. 11.5" placeholderTextColor={colors.textMuted} />
              </View>

              <View style={styles.advField}>
                <Text style={[styles.advLabel, { color: colors.textMuted }]}>Admission Date Range</Text>
                <View style={styles.advRow}>
                  <TextInput style={[styles.advInput, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]} value={dateFrom} onChangeText={setDateFrom} placeholder="From (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[styles.advInput, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]} value={dateTo} onChangeText={setDateTo} placeholder="To (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} />
                </View>
              </View>
            </ScrollView>

            <View style={styles.advActions}>
              <TouchableOpacity style={[styles.advBtn, { borderColor: colors.border }]} onPress={clearAdvanced}>
                <Text style={[styles.advBtnText, { color: colors.textMuted }]}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.advBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]} onPress={() => setShowAdvanced(false)}>
                <Text style={[styles.advBtnText, { color: '#fff' }]}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CaseCard({ item, colors }: { item: OpcCase; colors: any }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const typeColor = item.malnutrition_type === 'SAM' ? colors.sam : colors.mam;
  const statusColor = item.status === 'Active' ? colors.success :
    item.status === 'Defaulted' ? colors.danger :
    item.status === 'Discharged' ? colors.secondary : colors.textMuted;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '18', borderColor: typeColor + '40' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{item.malnutrition_type}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {item.is_visit_due && (
            <View style={[styles.duePill, { backgroundColor: colors.danger + '10' }]}>
              <Ionicons name="alert-circle" size={10} color={colors.danger} />
              <Text style={[styles.dueText, { color: colors.danger }]}>Due</Text>
            </View>
          )}
          <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.childName, { color: colors.textPrimary }]}>{item.child_name || 'Unknown Child'}</Text>
      <Text style={[styles.childId, { color: colors.textMuted }]}>{item.registration_number || '—'}</Text>
      <View style={styles.cardMeta}>
        <MetaItem icon="calendar-outline" label={item.admission_date ? new Date(item.admission_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} color={colors.textMuted} />
        <MetaItem icon="business-outline" label={item.facility_name || '—'} color={colors.textMuted} />
        <MetaItem icon="time-outline" label={`${item.age_months}m`} color={colors.textMuted} />
        <MetaItem icon="documents-outline" label={`${item.visit_count} visits`} color={colors.textMuted} />
      </View>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.cardMetric}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Wt</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{item.weight_kg}kg</Text>
        </View>
        {item.muac_cm && (
          <View style={styles.cardMetric}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>MUAC</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{item.muac_cm}cm</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </View>
  );
}

function PendingCaseCard({ item, colors }: { item: any; colors: any }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const data = item.data || {};
  const typeColor = data.malnutrition_type === 'SAM' ? colors.sam : colors.mam;
  const hasError = item.state === 'failed';
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: hasError ? colors.danger : colors.warning }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '18', borderColor: typeColor + '40' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{data.malnutrition_type || 'CASE'}</Text>
        </View>
        <Text style={{ color: hasError ? colors.danger : colors.warning, fontSize: 11, fontWeight: '800' }}>
          {hasError ? 'SYNC NEEDS ATTENTION' : 'PENDING SYNC'}
        </Text>
      </View>
      <Text style={[styles.childName, { color: colors.textPrimary }]}>{data.child_name || 'Unnamed child'}</Text>
      <Text style={[styles.childId, { color: colors.textMuted }]}>
        {hasError ? item.lastError || 'Open Offline Sync to retry.' : 'Tap to record the first visit offline'}
      </Text>
      <View style={styles.cardMeta}>
        <MetaItem icon="calendar-outline" label={data.admission_date || '—'} color={colors.textMuted} />
        <MetaItem icon="time-outline" label={`${data.age_months || 0}m`} color={colors.textMuted} />
        <MetaItem icon="documents-outline" label="0 visits synced" color={colors.textMuted} />
      </View>
    </View>
  );
}

function MetaItem({ icon, label, color }: { icon: any; label: string; color: string }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.metaText, { color }]}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label, mutedColor }: { color: string; label: string; mutedColor: string }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}
