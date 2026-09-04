import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, Share, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';
import EmptyState from '../../components/EmptyState';
import OfflineBanner from '../../components/OfflineBanner';
import StrategicReportFilters, { StrategicFilters } from '../../components/StrategicReportFilters';

interface VisitRow {
  id: number;
  visit_number: number;
  visit_date: string;
  visit_type: string;
  weight_kg: string | number | null;
  muac_cm: string | number | null;
  oedema: string | null;
  visit_outcome: string | null;
  rutf_sachets_given: number | null;
}

interface CaseRow {
  id: number;
  registration_number: string | null;
  child_name: string;
  child_gender: string;
  age_months: number;
  caregiver_name: string;
  caregiver_phone: string | null;
  programme: 'SAM' | 'High-Risk MAM' | 'Other MAM';
  admission_date: string;
  registration_date: string;
  weight_kg: string | number | null;
  muac_cm: string | number | null;
  status: string;
  outcome: string | null;
  discharge_date: string | null;
  treatment_days: number;
  visit_count: number;
  visits: VisitRow[];
  facility: { name: string; code: string; sub_district: string | null; district: string; region: string };
}

interface Totals { total: number; active: number; discharged: number; visits: number }
interface Pagination { page: number; total_pages: number; has_next: boolean }

const EMPTY_FILTERS: StrategicFilters = {
  region: '', district: '', sub_district: '', facility: '', year: '', month: '',
  date_from: '', date_to: '',
};

export default function CaseLineListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore(state => state.user);
  const allowed = !!user && (user.is_superuser || user.is_staff || (user.role?.level ?? 99) <= 2);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, active: 0, discharged: 0, visits: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total_pages: 1, has_next: false });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const queryParams = useCallback((page = 1) => {
    const params: Record<string, string | number> = { page, page_size: 25 };
    for (const key of ['region', 'district', 'sub_district', 'facility', 'date_from', 'date_to'] as const) {
      if (filters[key]) params[key] = filters[key];
    }
    return params;
  }, [filters]);

  const load = useCallback(async (page = 1) => {
    if (!allowed) return;
    try {
      const response = await api.get('/v1/reports/strategic/linelist/', { params: queryParams(page) });
      const payload = response.data.data;
      setRows(current => page === 1 ? payload.results : [...current, ...payload.results]);
      setTotals(payload.totals);
      setPagination(payload.pagination);
      setError('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'The case line list could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [allowed, queryParams]);

  useEffect(() => {
    setLoading(true);
    setRows([]);
    setExpanded(new Set());
    load(1);
  }, [load]);

  const exportCsv = async () => {
    if (!allowed || exporting) return;
    setExporting(true);
    try {
      const response = await api.get('/v1/reports/strategic/linelist/', {
        params: { ...queryParams(1), export: 'csv' },
        responseType: 'text',
        timeout: 60000,
      });
      const name = `cmam-case-linelist-${new Date().toISOString().slice(0, 10)}.csv`;
      if (Platform.OS === 'web') {
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const uri = `${FileSystem.cacheDirectory}${name}`;
        await FileSystem.writeAsStringAsync(uri, String(response.data), { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export case line list' });
        } else {
          await Share.share({ title: name, message: String(response.data) });
        }
      }
    } catch (exportError: any) {
      Alert.alert('Export failed', exportError?.response?.data?.message || 'Connect to the internet and try again.');
    } finally {
      setExporting(false);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const listHeader = useMemo(() => (
    <>
      <View style={[styles.hero, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 18) }]}>
        <View style={styles.heroRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>LONGITUDINAL REPORT</Text>
            <Text style={styles.heroTitle}>Case Line List</Text>
            <Text style={styles.heroSub}>Registration through every visit and discharge</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={exportCsv} disabled={exporting}>
            {exporting ? <ActivityIndicator size={18} color="#fff" /> : <Ionicons name="download-outline" size={21} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      <StrategicReportFilters value={filters} mode="linelist" colors={colors} onApply={setFilters} />

      <View style={styles.summaryGrid}>
        <Metric label="Children" value={totals.total} color="#0f766e" colors={colors} />
        <Metric label="Visits" value={totals.visits} color="#2563eb" colors={colors} />
        <Metric label="Active" value={totals.active} color="#d97706" colors={colors} />
        <Metric label="Discharged" value={totals.discharged} color="#16a34a" colors={colors} />
      </View>

      <View style={styles.listHeading}>
        <View>
          <Text style={[styles.listTitle, { color: colors.textPrimary }]}>CHILD RECORDS</Text>
          <Text style={[styles.listSubtitle, { color: colors.textMuted }]}>Tap a record to inspect its visit timeline</Text>
        </View>
        <Text style={[styles.pageLabel, { color: colors.textMuted }]}>Page {pagination.page} of {pagination.total_pages}</Text>
      </View>

      {!!error && (
        <TouchableOpacity style={[styles.errorCard, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }]} onPress={() => load(1)}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      )}
    </>
  ), [colors, error, exporting, filters, insets.top, load, pagination, totals]);

  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="lock-closed-outline" title="Restricted report" subtitle="This report is available to regional, national and super administrator users." />
        <TouchableOpacity onPress={() => router.back()} style={[styles.backLink, { backgroundColor: colors.primary }]}>
          <Text style={styles.backLinkText}>Back to reports</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={false} />
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <CaseCard
            item={item} expanded={expanded.has(item.id)} colors={colors}
            onToggle={() => toggleExpanded(item.id)}
            onOpen={() => router.push({ pathname: '/case/[id]', params: { id: String(item.id) } })}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!loading && !error ? <EmptyState icon="document-text-outline" title="No cases found" subtitle="Try changing or clearing the report filters." /> : null}
        ListFooterComponent={loading || loadingMore ? <ActivityIndicator style={{ margin: 24 }} color={colors.primary} /> : <View style={{ height: 28 }} />}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(1); }}
        onEndReached={() => {
          if (pagination.has_next && !loadingMore) {
            setLoadingMore(true);
            load(pagination.page + 1);
          }
        }}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

function Metric({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function CaseCard({ item, expanded, onToggle, onOpen, colors }: {
  item: CaseRow; expanded: boolean; onToggle: () => void; onOpen: () => void; colors: any;
}) {
  const programmeColor = item.programme === 'SAM' ? '#dc2626' : item.programme === 'High-Risk MAM' ? '#d97706' : '#2563eb';
  const statusColor = item.status === 'Active' ? '#d97706' : item.status === 'Discharged' ? '#16a34a' : '#64748b';
  return (
    <View style={[styles.caseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.75} accessibilityLabel={`${item.child_name}, ${item.programme}, ${item.visit_count} visits`}>
        <View style={styles.caseTop}>
          <View style={[styles.avatar, { backgroundColor: programmeColor + '15' }]}>
            <Text style={[styles.avatarText, { color: programmeColor }]}>{item.child_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.childName, { color: colors.textPrimary }]}>{item.child_name}</Text>
            <Text style={[styles.regNumber, { color: colors.textMuted }]}>{item.registration_number || 'Pending registration number'}</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </View>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: programmeColor + '12' }]}><Text style={[styles.pillText, { color: programmeColor }]}>{item.programme}</Text></View>
          <View style={[styles.pill, { backgroundColor: statusColor + '12' }]}><Text style={[styles.pillText, { color: statusColor }]}>{item.status}</Text></View>
          <Text style={[styles.visitCount, { color: colors.textMuted }]}>{item.visit_count} visit{item.visit_count === 1 ? '' : 's'}</Text>
        </View>
        <View style={[styles.caseMeta, { borderTopColor: colors.border }]}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.facility.name}</Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.registration_date}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.timeline, { borderTopColor: colors.border }]}>
          <Detail label="Location" value={`${item.facility.region} • ${item.facility.district}${item.facility.sub_district ? ` • ${item.facility.sub_district}` : ''}`} colors={colors} />
          <Detail label="Admission" value={`${item.admission_date} • ${item.weight_kg ?? '—'} kg • MUAC ${item.muac_cm ?? '—'} cm`} colors={colors} />
          <Detail label="Caregiver" value={`${item.caregiver_name}${item.caregiver_phone ? ` • ${item.caregiver_phone}` : ''}`} colors={colors} />
          <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>VISIT TIMELINE</Text>
          {item.visits.length ? item.visits.map((visit, index) => (
            <View key={visit.id} style={styles.visitRow}>
              <View style={styles.lineColumn}>
                <View style={[styles.timelineDot, { backgroundColor: programmeColor }]} />
                {index < item.visits.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <Text style={[styles.visitTitle, { color: colors.textPrimary }]}>Visit {visit.visit_number} • {visit.visit_date}</Text>
                <Text style={[styles.visitMeta, { color: colors.textMuted }]}>
                  {visit.visit_type} • {visit.weight_kg ?? '—'} kg • MUAC {visit.muac_cm ?? '—'} cm • {visit.visit_outcome || 'No outcome'}
                </Text>
              </View>
            </View>
          )) : <Text style={[styles.noVisits, { color: colors.textMuted }]}>No follow-up visits recorded.</Text>}
          {!!item.discharge_date && <Detail label="Discharge" value={`${item.discharge_date} • ${item.outcome || item.status}`} colors={colors} />}
          <TouchableOpacity onPress={onOpen} style={[styles.openButton, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.openButtonText, { color: colors.primary }]}>Open full case record</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Detail({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center' },
  hero: { paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 },
  summaryGrid: { paddingHorizontal: 12, marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48.8%', borderWidth: 1, borderRadius: 14, padding: 12 },
  metricDot: { width: 18, height: 4, borderRadius: 2, marginBottom: 8 },
  metricValue: { fontSize: 24, fontWeight: '900' }, metricLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  listHeading: { marginHorizontal: 14, marginTop: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  listTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7 }, listSubtitle: { fontSize: 10, marginTop: 3 }, pageLabel: { fontSize: 10, fontWeight: '600' },
  errorCard: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8 }, errorText: { flex: 1, fontSize: 12 },
  caseCard: { marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  caseTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 18, fontWeight: '900' },
  childName: { fontSize: 15, fontWeight: '800' }, regNumber: { fontSize: 10, marginTop: 2 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }, pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, pillText: { fontSize: 9, fontWeight: '800' }, visitCount: { marginLeft: 'auto', fontSize: 10, fontWeight: '700' },
  caseMeta: { borderTopWidth: 1, marginTop: 11, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }, metaText: { fontSize: 10, maxWidth: '68%' },
  timeline: { borderTopWidth: 1, marginTop: 13, paddingTop: 13 }, detailRow: { marginBottom: 9 }, detailLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }, detailValue: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  timelineTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 7, marginBottom: 10 }, visitRow: { flexDirection: 'row', gap: 9 }, lineColumn: { width: 10, alignItems: 'center' }, timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 }, timelineLine: { flex: 1, width: 1, marginTop: 3 }, visitTitle: { fontSize: 11, fontWeight: '800' }, visitMeta: { fontSize: 10, lineHeight: 15, marginTop: 2 }, noVisits: { fontSize: 11, fontStyle: 'italic', marginBottom: 10 },
  openButton: { minHeight: 42, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 5 }, openButtonText: { fontSize: 12, fontWeight: '800' },
  backLink: { alignSelf: 'center', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }, backLinkText: { color: '#fff', fontWeight: '800' },
});
