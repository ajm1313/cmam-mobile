import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import EmptyState from '../../components/EmptyState';
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

export default function IpcListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cases, setCases] = useState<IpcCase[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchCases = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/v1/ipc/cases/', { params });
      setCases(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load IPC cases');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const onRefresh = () => { setRefreshing(true); fetchCases(); };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: '#7c3aed', paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>IPC Cases</Text>
          <TouchableOpacity onPress={() => router.push('/case/ipc-register')} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        style={{ backgroundColor: colors.surface }}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => { setStatusFilter(f.key); setLoading(true); }}
            style={[styles.filterChip, {
              borderColor: statusFilter === f.key ? '#7c3aed' : colors.border,
              backgroundColor: statusFilter === f.key ? '#7c3aed15' : 'transparent',
            }]}
          >
            <Text style={{
              fontSize: 12, fontWeight: '700',
              color: statusFilter === f.key ? '#7c3aed' : colors.textMuted,
            }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
        ) : cases.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="No IPC Cases"
            subtitle="No inpatient care cases found for this filter."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {cases.map((c) => {
              const statusColor = STATUS_COLORS[c.status] || colors.textMuted;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => router.push(`/case/ipc-detail?id=${c.id}`)}
                  activeOpacity={0.7}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                        {c.patient_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        {c.facility_name} • Age {c.patient_age}mo • {c.gender}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{c.status}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Weight</Text>
                      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{c.weight} kg</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Height</Text>
                      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{c.height} cm</Text>
                    </View>
                    {c.muac != null && (
                      <View style={styles.metric}>
                        <Text style={styles.metricLabel}>MUAC</Text>
                        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{c.muac} cm</Text>
                      </View>
                    )}
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Admitted</Text>
                      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{c.admission_date}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cardBody: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  metric: { gap: 2 },
  metricLabel: { fontSize: 10, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 13, fontWeight: '600' },
});
