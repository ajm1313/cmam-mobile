import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { logger } from '../../lib/logger';
import { setCache, getCacheFallback } from '../../lib/cache';
import { useOfflineSync } from '../../lib/useOfflineSync';
import OfflineBanner from '../../components/OfflineBanner';
import { SyncStatusBanner } from '../../components/SyncStatus';
import EmptyState from '../../components/EmptyState';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import type { IpcCase, IpcCaseStatus } from '../../lib/types';

const STATUS_COLORS: Record<IpcCaseStatus, string> = {
  Admitted: '#10b981',
  Discharged: '#3b82f6',
  Death: '#ef4444',
  Defaulted: '#f59e0b',
  Transfer: '#8b5cf6',
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Admitted', label: 'Admitted' },
  { key: 'Discharged', label: 'Discharged' },
  { key: 'Defaulted', label: 'Defaulted' },
  { key: 'Death', label: 'Death' },
  { key: 'Transfer', label: 'Transfer' },
];

const IPC_COLOR = '#7c3aed';

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingBottom: 14, paddingHorizontal: 16,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    shadowColor: IPC_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterBar: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
  },
  summaryText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  patientName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  patientMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cardMetric: { alignItems: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 1 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: IPC_COLOR, justifyContent: 'center', alignItems: 'center',
    shadowColor: IPC_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
});

export default function IpcListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [cases, setCases] = useState<IpcCase[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  useOfflineSync();

  const CACHE_KEY = `ipc_cases_${statusFilter}`;

  const fetchCases = useCallback(async () => {
    const cached = await getCacheFallback<IpcCase[]>(CACHE_KEY);
    if (cached && !cases.length) {
      setCases(cached.data);
      setIsStale(cached.isStale);
      setLoading(false);
    }

    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/v1/ipc/cases/', { params });
      const fresh = res.data.data || [];
      setCases(fresh);
      setIsStale(false);
      await setCache(CACHE_KEY, fresh, 10 * 60 * 1000);
    } catch (e) {
      logger.error('IPC cases fetch error:', e);
      if (!cases.length && cached) setIsStale(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const onRefresh = () => { setRefreshing(true); fetchCases(); };

  const filtered = cases;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: IPC_COLOR, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>IPC Cases</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <OfflineBanner isStale={isStale} />
      <SyncStatusBanner />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
        style={[styles.filterBar, { borderBottomWidth: 0 }]}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => { setStatusFilter(f.key); setLoading(true); }}
            style={[styles.filterChip, {
              borderColor: statusFilter === f.key ? IPC_COLOR : colors.border,
              backgroundColor: statusFilter === f.key ? IPC_COLOR + '15' : 'transparent',
            }]}
          >
            <Text style={{
              fontSize: 12, fontWeight: '700',
              color: statusFilter === f.key ? IPC_COLOR : colors.textMuted,
            }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: colors.textMuted }]}>
          {filtered.length} case{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IPC_COLOR} />}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={loading ? (
          <View style={{ paddingTop: 4 }}>
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="No IPC Cases"
            subtitle="No inpatient care cases found for this filter."
          />
        ) : null}
        ListEmptyComponent={!loading ? (
          <EmptyState
            icon="medkit-outline"
            title="No IPC Cases"
            subtitle="No inpatient care cases found for this filter."
          />
        ) : null}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/case/ipc-detail?id=${c.id}`)}
          >
            <IpcCard item={c} colors={colors} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/case/ipc-register')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function IpcCard({ item, colors }: { item: IpcCase; colors: any }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const statusColor = STATUS_COLORS[item.status] || colors.textMuted;

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
        <Ionicons name="medkit-outline" size={16} color={IPC_COLOR} />
      </View>
      <Text style={[styles.patientName, { color: colors.textPrimary }]}>{item.patient_name}</Text>
      <Text style={[styles.patientMeta, { color: colors.textMuted }]}>
        {item.facility_name} • {item.gender}, {item.patient_age}m
      </Text>
      <View style={styles.cardMeta}>
        <MetaItem icon="calendar-outline" label={formatDate(item.admission_date)} color={colors.textMuted} />
        <MetaItem icon="business-outline" label={item.facility_name} color={colors.textMuted} />
      </View>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.cardMetric}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Wt</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{item.weight}kg</Text>
        </View>
        <View style={styles.cardMetric}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Ht</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{item.height}cm</Text>
        </View>
        {item.muac != null && (
          <View style={styles.cardMetric}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>MUAC</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{item.muac}cm</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
