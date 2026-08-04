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
import { sendOrQueue } from '../../lib/offlineQueue';
import OfflineBanner from '../../components/OfflineBanner';

interface DischargeStats {
  total_cases: number;
  discharged_cases: number;
  defaulted_cases: number;
  death_cases: number;
  cure_rate: number;
}

interface DischargeCaseItem {
  id: number;
  child_name: string;
  registration_number: string;
  facility_name: string;
  malnutrition_type: string;
  visit_count: number;
  last_visit_date: string | null;
  days_since_last_visit?: number;
  status?: string;
  outcome?: string;
  discharge_date?: string | null;
}

export default function DischargeManagementScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'ready' | 'defaulters' | 'history'>('ready');
  const [stats, setStats] = useState<DischargeStats | null>(null);
  const [ready, setReady] = useState<DischargeCaseItem[]>([]);
  const [defaulters, setDefaulters] = useState<DischargeCaseItem[]>([]);
  const [history, setHistory] = useState<DischargeCaseItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/v1/cases/discharge/');
      const d = res.data.data;
      setStats(d.stats);
      setReady(d.ready_for_discharge || []);
      setDefaulters(d.defaulters || []);
      setHistory(d.discharge_history || []);
    } catch {
      Alert.alert('Error', 'Failed to load discharge data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDischarge = (caseItem: DischargeCaseItem) => {
    Alert.alert('Discharge', `Select outcome for ${caseItem.child_name}`, [
      { text: 'Cured', onPress: () => processDischarge(caseItem.id, 'Cured') },
      { text: 'Defaulted', onPress: () => processDischarge(caseItem.id, 'Defaulted') },
      { text: 'Non-Response', onPress: () => processDischarge(caseItem.id, 'Non-Response') },
      { text: 'Transfer', onPress: () => processDischarge(caseItem.id, 'Transfer') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const processDischarge = async (caseId: number, outcome: string) => {
    try {
      const res = await sendOrQueue(`/v1/cases/${caseId}/discharge/`, 'post', { outcome }, `Discharge: ${outcome}`);
      if (res) {
        Alert.alert('Success', `Case discharged: ${outcome}`);
        fetchData();
      } else {
        Alert.alert('Saved Offline', `Discharge (${outcome}) saved and will sync when online.`);
      }
    } catch {
      Alert.alert('Error', 'Failed to process discharge');
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: 'ready', label: 'Ready', count: ready.length },
    { key: 'defaulters', label: 'Defaulters', count: defaulters.length },
    { key: 'history', label: 'History', count: history.length },
  ];

  const currentList = tab === 'ready' ? ready : tab === 'defaulters' ? defaulters : history;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discharge Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <OfflineBanner />

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{stats.total_cases}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.success }]}>{stats.discharged_cases}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Discharged</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.danger }]}>{stats.defaulted_cases}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Defaulted</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.secondary }]}>{stats.cure_rate}%</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Cure Rate</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.textMuted }]}>{t.label}</Text>
            <View style={[styles.tabBadge, { backgroundColor: tab === t.key ? colors.primary : colors.textMuted + '30' }]}>
              <Text style={[styles.tabBadgeText, { color: tab === t.key ? '#fff' : colors.textMuted }]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
      >
        {currentList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No cases in this category</Text>
          </View>
        ) : (
          currentList.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.caseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/case/[id]', params: { id: String(item.id) } })}
              activeOpacity={0.7}
            >
              <View style={styles.caseCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.caseName, { color: colors.textPrimary }]}>{item.child_name}</Text>
                  <Text style={[styles.caseReg, { color: colors.textMuted }]}>{item.registration_number}</Text>
                </View>
                <View style={[styles.typePill, { backgroundColor: item.malnutrition_type === 'SAM' ? colors.sam + '15' : colors.mam + '15' }]}>
                  <Text style={[styles.typeText, { color: item.malnutrition_type === 'SAM' ? colors.sam : colors.mam }]}>{item.malnutrition_type}</Text>
                </View>
              </View>
              <View style={styles.caseCardMeta}>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  <Ionicons name="business-outline" size={12} color={colors.textMuted} /> {item.facility_name}
                </Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  Visits: {item.visit_count}
                </Text>
                {item.days_since_last_visit !== undefined && (
                  <Text style={[styles.metaText, { color: item.days_since_last_visit > 21 ? colors.danger : colors.warning }]}>
                    {item.days_since_last_visit}d since last visit
                  </Text>
                )}
                {item.discharge_date && (
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Discharged: {formatDate(item.discharge_date)}
                  </Text>
                )}
              </View>
              {tab === 'ready' && (
                <TouchableOpacity
                  style={[styles.dischargeBtn, { backgroundColor: colors.success }]}
                  onPress={() => handleDischarge(item)}
                >
                  <Ionicons name="exit-outline" size={16} color="#fff" />
                  <Text style={styles.dischargeBtnText}>Discharge</Text>
                </TouchableOpacity>
              )}
              {tab === 'defaulters' && (
                <View style={[styles.defaulterBadge, { backgroundColor: colors.danger + '10' }]}>
                  <Ionicons name="warning-outline" size={14} color={colors.danger} />
                  <Text style={[styles.defaulterText, { color: colors.danger }]}>Potential Defaulter</Text>
                </View>
              )}
              {tab === 'history' && item.outcome && (
                <View style={[styles.outcomeBadge, { backgroundColor: colors.textMuted + '15' }]}>
                  <Text style={[styles.outcomeText, { color: colors.textSecondary }]}>{item.status}: {item.outcome}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  tabRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  caseCard: { marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  caseCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  caseName: { fontSize: 15, fontWeight: '700' },
  caseReg: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '700' },
  caseCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metaText: { fontSize: 12, fontWeight: '500' },
  dischargeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  dischargeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  defaulterBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 4 },
  defaulterText: { fontSize: 12, fontWeight: '600' },
  outcomeBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 4 },
  outcomeText: { fontSize: 12, fontWeight: '600' },
});
