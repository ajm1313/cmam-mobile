import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import OfflineBanner from '../../components/OfflineBanner';
import { getCacheFallback, setCache } from '../../lib/cache';

interface DueVisitItem {
  id: number;
  registration_number: string;
  child_name: string;
  child_gender: string;
  malnutrition_type: string;
  facility_name: string;
  next_due_date: string;
  days_overdue: number;
  visit_count: number;
  last_visit_date: string | null;
}

interface DueVisitStats {
  due_count: number;
  overdue_count: number;
  today_count: number;
}

export default function DueVisitsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visitType, setVisitType] = useState<'SAM' | 'MAM'>('SAM');
  const [visits, setVisits] = useState<DueVisitItem[]>([]);
  const [stats, setStats] = useState<DueVisitStats | null>(null);
  const [search, setSearch] = useState('');
  const [isStale, setIsStale] = useState(false);

  const fetchData = useCallback(async () => {
    const cacheKey = `due_visits_${visitType}`;
    try {
      const res = await api.get('/v1/cases/due-visits/', { params: { type: visitType } });
      const d = res.data.data;
      setVisits(d.due_visits || []);
      setStats(d.stats || null);
      setIsStale(false);
      setCache(cacheKey, d, 10 * 60 * 1000);
    } catch {
      const cached = await getCacheFallback(cacheKey);
      if (cached) { const d = cached.data as any; setVisits(d?.due_visits || []); setStats(d?.stats || null); setIsStale(true); }
      else Alert.alert('Error', 'Failed to load due visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [visitType]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filtered = search.trim()
    ? visits.filter(v => v.child_name.toLowerCase().includes(search.toLowerCase()) || v.registration_number.toLowerCase().includes(search.toLowerCase()))
    : visits;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={isStale} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Due Visits</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Type Toggle */}
      <View style={[styles.toggleRow, { backgroundColor: colors.surface }]}>
        {(['SAM', 'MAM'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.toggleBtn, visitType === t && { backgroundColor: t === 'SAM' ? colors.sam : colors.mam }]}
            onPress={() => setVisitType(t)}
          >
            <Text style={[styles.toggleText, { color: visitType === t ? '#fff' : colors.textMuted }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{stats.due_count}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Due</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.danger }]}>{stats.overdue_count}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Overdue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.success }]}>{stats.today_count}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Due Today</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or reg number..."
          placeholderTextColor={colors.textMuted}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{search ? 'No results found' : `No visits due for ${visitType}`}</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.caseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/case/[id]', params: { id: String(item.id) } })}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.caseName, { color: colors.textPrimary }]}>{item.child_name}</Text>
                    <Text style={[styles.caseReg, { color: colors.textMuted }]}>{item.registration_number}</Text>
                  </View>
                  {item.days_overdue > 0 ? (
                    <View style={[styles.overduePill, { backgroundColor: colors.danger + '15' }]}>
                      <Text style={[styles.overdueText, { color: colors.danger }]}>{item.days_overdue}d overdue</Text>
                    </View>
                  ) : (
                    <View style={[styles.overduePill, { backgroundColor: colors.success + '15' }]}>
                      <Text style={[styles.overdueText, { color: colors.success }]}>Due today</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardMeta}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    <Ionicons name="business-outline" size={12} /> {item.facility_name}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Visits: {item.visit_count}</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Due: {formatDate(item.next_due_date)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.recordBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push({ pathname: '/visit/[caseId]', params: { caseId: String(item.id), caseName: item.child_name, caseType: item.malnutrition_type, visitNumber: String(item.visit_count + 1) } })}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={styles.recordBtnText}>Record Visit</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  toggleRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, borderRadius: 12, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  caseCard: { marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  caseName: { fontSize: 15, fontWeight: '700' },
  caseReg: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  overduePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  overdueText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  metaText: { fontSize: 12, fontWeight: '500' },
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  recordBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
