import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/store';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import EmptyState from '../../components/EmptyState';
import { CardSkeleton } from '../../components/LoadingSkeleton';

interface FacilityOption {
  id: number;
  name: string;
}

type Tab = 'stock' | 'movement';

interface StockRow {
  id: number;
  inventory_item: { id: number; name: string; unit: string; category: string };
  current_balance: number;
  location_type: string;
  last_updated: string;
}

interface MovementRow {
  id: number;
  inventory_item: { id: number; name: string; unit: string };
  movement_type: string;
  quantity: number;
  notes: string;
  movement_date: string;
  created_by_name?: string;
  source?: string;
  destination?: string;
}

export default function InventoryReportsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const userFacilityId = user?.location?.facility_id;
  const isAdmin = !userFacilityId;

  const [tab, setTab] = useState<Tab>('stock');
  const [stockData, setStockData] = useState<StockRow[]>([]);
  const [movementData, setMovementData] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityOption | null>(null);
  const [facilityPickerVisible, setFacilityPickerVisible] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/v1/facilities/').then(res => {
        const list: FacilityOption[] = (res.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }));
        setFacilities(list);
        if (list.length > 0) setSelectedFacility(list[0]);
      }).catch(() => {});
    }
  }, [isAdmin]);

  const activeFacilityId = isAdmin ? selectedFacility?.id : userFacilityId;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeFacilityId) {
        const [stockRes, moveRes] = await Promise.all([
          api.get(`/v1/inventory/facility/${activeFacilityId}/stock/`).catch(() => ({ data: { data: [] } })),
          api.get(`/v1/inventory/facility/${activeFacilityId}/movements/`).catch(() => ({ data: { data: [] } })),
        ]);
        setStockData(stockRes.data.data ?? []);
        setMovementData(moveRes.data.data ?? []);
      } else {
        const [stockRes, moveRes] = await Promise.all([
          api.get('/v1/inventory/stock-levels/').catch(() => ({ data: { data: [] } })),
          api.get('/v1/inventory/movements/').catch(() => ({ data: { data: [] } })),
        ]);
        setStockData(stockRes.data.data ?? []);
        setMovementData(moveRes.data.data ?? []);
      }
    } catch {
      setStockData([]);
      setMovementData([]);
    } finally {
      setLoading(false);
    }
  }, [activeFacilityId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const totalStockValue = stockData.length;
  const lowStockCount = stockData.filter(s => s.current_balance <= 0).length;
  const totalMovements = movementData.length;
  const inMovements = movementData.filter(m => m.movement_type === 'in' || m.movement_type === 'receipt').length;
  const outMovements = movementData.filter(m => m.movement_type === 'out' || m.movement_type === 'consumption' || m.movement_type === 'distribution').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inventory Reports</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      {/* Facility Selector (admin only) */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.facilitySelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setFacilityPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="business-outline" size={16} color={colors.primary} />
          <Text style={[styles.facilityLabel, { color: colors.textPrimary }]} numberOfLines={1}>
            {selectedFacility?.name ?? 'Select Facility'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'stock' && { borderBottomColor: colors.primary }]}
          onPress={() => setTab('stock')}
          activeOpacity={0.7}
        >
          <Ionicons name="cube-outline" size={16} color={tab === 'stock' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, { color: tab === 'stock' ? colors.primary : colors.textMuted }]}>Stock Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'movement' && { borderBottomColor: colors.primary }]}
          onPress={() => setTab('movement')}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal-outline" size={16} color={tab === 'movement' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, { color: tab === 'movement' ? colors.primary : colors.textMuted }]}>Movement Report</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        {tab === 'stock' ? (
          <>
            <SummaryCard label="Total Items" value={totalStockValue} color={colors.primary} bg={colors.surface} />
            <SummaryCard label="Out of Stock" value={lowStockCount} color={colors.danger} bg={colors.surface} />
            <SummaryCard label="Adequate" value={totalStockValue - lowStockCount} color={colors.success} bg={colors.surface} />
          </>
        ) : (
          <>
            <SummaryCard label="Total" value={totalMovements} color={colors.primary} bg={colors.surface} />
            <SummaryCard label="Incoming" value={inMovements} color={colors.success} bg={colors.surface} />
            <SummaryCard label="Outgoing" value={outMovements} color={colors.warning} bg={colors.surface} />
          </>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {loading ? (
          <View style={{ paddingTop: 8 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : tab === 'stock' ? (
          stockData.length === 0 ? (
            <EmptyState icon="cube-outline" title="No stock data" subtitle="No inventory stock records found." />
          ) : (
            stockData.map((item) => {
              const isLow = item.current_balance <= 0;
              const statusColor = isLow ? colors.danger : colors.success;
              return (
                <View key={item.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.inventory_item?.name ?? 'Unknown'}</Text>
                      <Text style={[styles.cardSub, { color: colors.textMuted }]}>{item.inventory_item?.category} • {item.inventory_item?.unit}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {item.current_balance} {item.inventory_item?.unit}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                      Updated: {item.last_updated ? new Date(item.last_updated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </Text>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                      {item.location_type}
                    </Text>
                  </View>
                </View>
              );
            })
          )
        ) : (
          movementData.length === 0 ? (
            <EmptyState icon="swap-horizontal-outline" title="No movements" subtitle="No stock movements recorded." />
          ) : (
            movementData.map((m) => {
              const isIn = m.movement_type === 'in' || m.movement_type === 'receipt';
              const typeColor = isIn ? colors.success : m.movement_type === 'transfer' ? colors.primary : colors.warning;
              return (
                <View key={m.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{m.inventory_item?.name ?? 'Unknown'}</Text>
                      <Text style={[styles.cardSub, { color: colors.textMuted }]}>{m.movement_type.toUpperCase()} • {m.quantity} {m.inventory_item?.unit}</Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: typeColor + '15', borderColor: typeColor + '40' }]}>
                      <Ionicons
                        name={isIn ? 'arrow-down-circle-outline' : m.movement_type === 'transfer' ? 'swap-horizontal-outline' : 'arrow-up-circle-outline'}
                        size={14}
                        color={typeColor}
                      />
                      <Text style={[styles.typeText, { color: typeColor }]}>{m.movement_type}</Text>
                    </View>
                  </View>
                  {m.notes ? (
                    <Text style={[styles.notes, { color: colors.textSecondary }]}>{m.notes}</Text>
                  ) : null}
                  <View style={styles.cardFooter}>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                      {m.movement_date ? new Date(m.movement_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </Text>
                    {m.created_by_name && (
                      <Text style={[styles.footerText, { color: colors.textMuted }]}>by {m.created_by_name}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )
        )}
      </ScrollView>
      {/* Facility Picker Modal */}
      <Modal visible={facilityPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Select Facility</Text>
              <TouchableOpacity onPress={() => setFacilityPickerVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={facilities}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border, backgroundColor: selectedFacility?.id === item.id ? colors.primary + '10' : 'transparent' }]}
                  onPress={() => { setSelectedFacility(item); setFacilityPickerVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="business-outline" size={16} color={selectedFacility?.id === item.id ? colors.primary : colors.textMuted} />
                  <Text style={[styles.pickerItemText, { color: selectedFacility?.id === item.id ? colors.primary : colors.textPrimary, fontWeight: selectedFacility?.id === item.id ? '700' : '500' }]}>{item.name}</Text>
                  {selectedFacility?.id === item.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: bg, borderTopColor: color }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  summaryCard: {
    flex: 1, borderRadius: 12, padding: 12, alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  card: {
    marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSub: { fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '800' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  typeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  notes: { fontSize: 12, marginBottom: 8, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  footerText: { fontSize: 11, fontWeight: '500' },
  facilitySelector: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  facilityLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '700' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  pickerItemText: { flex: 1, fontSize: 14 },
});
