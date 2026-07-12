import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface Batch {
  id: number; item_name: string; item_code: string;
  batch_number: string; quantity: number;
  manufacture_date: string | null; expiry_date: string | null;
  days_until_expiry: number | null; is_expired: boolean;
  facility_name: string;
}

type FilterType = 'all' | 'expired' | 'expiring_soon' | 'valid';

export default function ExpiryManagementScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/v1/inventory/batches/', { params: { filter } });
      setBatches(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load batch data');
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getExpiryInfo = (b: Batch) => {
    if (b.is_expired) return { label: 'Expired', color: colors.danger, icon: 'close-circle' as const };
    if (b.days_until_expiry !== null && b.days_until_expiry <= 30) return { label: `${b.days_until_expiry}d left`, color: colors.danger, icon: 'warning' as const };
    if (b.days_until_expiry !== null && b.days_until_expiry <= 90) return { label: `${b.days_until_expiry}d left`, color: colors.warning, icon: 'time' as const };
    return { label: 'Valid', color: colors.success, icon: 'checkmark-circle' as const };
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const expiredCount = batches.filter((b) => b.is_expired).length;
  const soonCount = batches.filter((b) => !b.is_expired && b.days_until_expiry !== null && b.days_until_expiry <= 90).length;
  const validCount = batches.filter((b) => !b.is_expired && (b.days_until_expiry === null || b.days_until_expiry > 90)).length;

  const FILTERS: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: batches.length, color: colors.primary },
    { key: 'expired', label: 'Expired', count: expiredCount, color: colors.danger },
    { key: 'expiring_soon', label: 'Expiring Soon', count: soonCount, color: colors.warning },
    { key: 'valid', label: 'Valid', count: validCount, color: colors.success },
  ];

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expiry Management</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary Row */}
      <View style={[styles.summaryRow, { backgroundColor: colors.surface }]}>
        <SummaryCard icon="close-circle" label="Expired" value={expiredCount} color={colors.danger} colors={colors} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryCard icon="warning" label="≤90d" value={soonCount} color={colors.warning} colors={colors} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryCard icon="checkmark-circle" label="Valid" value={validCount} color={colors.success} colors={colors} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryCard icon="layers" label="Total" value={batches.length} color={colors.primary} colors={colors} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, { backgroundColor: filter === f.key ? f.color : colors.surface, borderColor: f.color, borderWidth: 1 }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, { color: filter === f.key ? '#fff' : f.color }]}>{f.label}</Text>
            <View style={[styles.badge, { backgroundColor: filter === f.key ? 'rgba(255,255,255,0.25)' : f.color + '20' }]}>
              <Text style={[styles.badgeText, { color: filter === f.key ? '#fff' : f.color }]}>{f.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
      >
        {batches.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No batches found</Text>
          </View>
        ) : (
          batches.map((b) => {
            const info = getExpiryInfo(b);
            return (
              <View key={b.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: b.is_expired ? colors.danger + '40' : colors.border, borderWidth: b.is_expired ? 1.5 : 1 }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.batchIcon, { backgroundColor: info.color + '15' }]}>
                    <Ionicons name={info.icon} size={20} color={info.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemName, { color: colors.textPrimary }]}>{b.item_name}</Text>
                    <Text style={[styles.itemSub, { color: colors.textMuted }]}>{b.item_code} • Batch: {b.batch_number || '—'}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: info.color + '15' }]}>
                    <Text style={[styles.statusText, { color: info.color }]}>{info.label}</Text>
                  </View>
                </View>

                <View style={[styles.dateRow, { borderTopColor: colors.border }]}>
                  <DateCell icon="calendar-outline" label="Manufactured" value={formatDate(b.manufacture_date)} colors={colors} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <DateCell icon="alarm-outline" label="Expires" value={formatDate(b.expiry_date)} colors={colors} highlight={info.color} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <DateCell icon="cube-outline" label="Quantity" value={String(b.quantity)} colors={colors} />
                </View>

                <View style={styles.facilityRow}>
                  <Ionicons name="business-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.facilityText, { color: colors.textMuted }]}>{b.facility_name}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ icon, label, value, color, colors }: any) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.summaryLbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function DateCell({ icon, label, value, colors, highlight }: any) {
  return (
    <View style={styles.dateCell}>
      <Ionicons name={icon} size={13} color={highlight || colors.textMuted} />
      <Text style={[styles.dateLbl, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.dateVal, { color: highlight || colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4 },
  summaryDivider: { width: 1, height: 28 },
  summaryCard: { flex: 1, alignItems: 'center', gap: 2 },
  summaryIconWrap: { width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginBottom: 1 },
  summaryVal: { fontSize: 15, fontWeight: '800' },
  summaryLbl: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2 },
  filterRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 12, fontWeight: '600' },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  card: { marginHorizontal: 12, marginTop: 8, borderRadius: 16, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  batchIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  dateRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10, marginBottom: 8 },
  dateCell: { flex: 1, alignItems: 'center', gap: 3 },
  dateLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  dateVal: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  divider: { width: 1, marginVertical: 4 },
  facilityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  facilityText: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});
