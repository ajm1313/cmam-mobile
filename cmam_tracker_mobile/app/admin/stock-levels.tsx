import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface StockLevel {
  id: number; item_id: number; item_name: string; item_code: string;
  facility_id: number; facility_name: string;
  current_stock: number; reserved_stock: number;
  available_stock: number; reorder_level: number; is_low: boolean;
}
interface InventoryItem { id: number; name: string; }
interface Facility { id: number; name: string; }

const MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'];

export default function StockLevelsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [filterLow, setFilterLow] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ item_id: '', facility_id: '', quantity: '', movement_type: 'ADJUSTMENT', notes: '' });
  const [selectedItem, setSelectedItem] = useState<StockLevel | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [lvlRes, itemRes, facRes] = await Promise.all([
        api.get('/v1/inventory/stock-levels/'),
        api.get('/v1/inventory/items/'),
        api.get('/v1/facilities/'),
      ]);
      setLevels(lvlRes.data.data || []);
      setItems(itemRes.data.data || []);
      setFacilities(facRes.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load stock levels');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdjust = (sl: StockLevel) => {
    setSelectedItem(sl);
    setForm({ item_id: String(sl.item_id), facility_id: String(sl.facility_id), quantity: '', movement_type: 'ADJUSTMENT', notes: '' });
    setModalVisible(true);
  };

  const openNew = () => {
    setSelectedItem(null);
    setForm({ item_id: '', facility_id: '', quantity: '', movement_type: 'IN', notes: '' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.item_id || !form.facility_id || !form.quantity) {
      Alert.alert('Validation', 'Item, facility and quantity are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/v1/inventory/stock-levels/update/', {
        item_id: parseInt(form.item_id),
        facility_id: parseInt(form.facility_id),
        quantity: parseInt(form.quantity),
        movement_type: form.movement_type,
        notes: form.notes,
      });
      Alert.alert('Success', 'Stock updated');
      setModalVisible(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update stock');
    } finally { setSaving(false); }
  };

  const getStockStatus = (sl: StockLevel) => {
    if (sl.current_stock === 0) return { label: 'Out of Stock', color: colors.danger };
    if (sl.is_low) return { label: 'Low Stock', color: colors.warning };
    return { label: 'Normal', color: colors.success };
  };

  const displayed = filterLow ? levels.filter((l) => l.is_low || l.current_stock === 0) : levels;

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const lowCount = levels.filter((l) => l.is_low || l.current_stock === 0).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Levels</Text>
        <TouchableOpacity onPress={openNew} style={styles.backBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={[styles.summaryRow, { backgroundColor: colors.surface }]}>
        <SummaryChip icon="layers-outline" label="Total" value={levels.length} color={colors.primary} colors={colors} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryChip icon="warning-outline" label="Low / Out" value={lowCount} color={colors.danger} colors={colors} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryChip icon="checkmark-circle-outline" label="Normal" value={levels.length - lowCount} color={colors.success} colors={colors} />
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: !filterLow ? colors.primary : colors.surface, borderColor: colors.primary, borderWidth: 1 }]}
          onPress={() => setFilterLow(false)}>
          <Text style={[styles.filterText, { color: !filterLow ? '#fff' : colors.primary }]}>All ({levels.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: filterLow ? colors.danger : colors.surface, borderColor: colors.danger, borderWidth: 1 }]}
          onPress={() => setFilterLow(true)}>
          <Text style={[styles.filterText, { color: filterLow ? '#fff' : colors.danger }]}>Low / Out ({lowCount})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
      >
        {displayed.length === 0 ? (
          <View style={styles.empty}><Ionicons name="cube-outline" size={48} color={colors.textMuted} /><Text style={[styles.emptyText, { color: colors.textMuted }]}>No stock records</Text></View>
        ) : (
          displayed.map((sl) => {
            const status = getStockStatus(sl);
            const pct = sl.reorder_level > 0 ? Math.min(100, Math.round((sl.current_stock / (sl.reorder_level * 3)) * 100)) : 100;
            return (
              <View key={sl.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.itemIcon, { backgroundColor: status.color + '15' }]}>
                    <Ionicons name="cube" size={18} color={status.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemName, { color: colors.textPrimary }]}>{sl.item_name}</Text>
                    <Text style={[styles.itemSub, { color: colors.textMuted }]}>{sl.facility_name} • {sl.item_code}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: status.color + '15' }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.stockRow}>
                  <StockStat label="Current" value={sl.current_stock} color={colors.textPrimary} colors={colors} />
                  <StockStat label="Available" value={sl.available_stock} color={colors.success} colors={colors} />
                  <StockStat label="Reserved" value={sl.reserved_stock} color={colors.warning} colors={colors} />
                  <StockStat label="Reorder At" value={sl.reorder_level} color={colors.danger} colors={colors} />
                </View>

                <View style={[styles.barBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: pct < 33 ? colors.danger : pct < 66 ? colors.warning : colors.success }]} />
                </View>

                <TouchableOpacity style={[styles.adjustBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30', borderWidth: 1 }]} onPress={() => openAdjust(sl)}>
                  <Ionicons name="swap-vertical-outline" size={15} color={colors.primary} />
                  <Text style={[styles.adjustText, { color: colors.primary }]}>Adjust Stock</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedItem ? `Adjust: ${selectedItem.item_name}` : 'Update Stock'}</Text>

              {!selectedItem && (
                <>
                  <ModalLabel label="Item *" colors={colors} />
                  <ScrollView style={[styles.pickList, { borderColor: colors.border }]} nestedScrollEnabled>
                    {items.map((i) => (
                      <TouchableOpacity key={i.id} style={[styles.pickItem, form.item_id === String(i.id) && { backgroundColor: colors.primary + '15' }]} onPress={() => setForm({ ...form, item_id: String(i.id) })}>
                        <Text style={[styles.pickText, { color: form.item_id === String(i.id) ? colors.primary : colors.textPrimary }]}>{i.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <ModalLabel label="Facility *" colors={colors} />
                  <ScrollView style={[styles.pickList, { borderColor: colors.border }]} nestedScrollEnabled>
                    {facilities.map((f) => (
                      <TouchableOpacity key={f.id} style={[styles.pickItem, form.facility_id === String(f.id) && { backgroundColor: colors.primary + '15' }]} onPress={() => setForm({ ...form, facility_id: String(f.id) })}>
                        <Text style={[styles.pickText, { color: form.facility_id === String(f.id) ? colors.primary : colors.textPrimary }]}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <ModalLabel label="Movement Type" colors={colors} />
              <View style={styles.chipRow}>
                {MOVEMENT_TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, { backgroundColor: form.movement_type === t ? colors.primary + '20' : colors.inputBg, borderColor: form.movement_type === t ? colors.primary : colors.border, borderWidth: 1 }]} onPress={() => setForm({ ...form, movement_type: t })}>
                    <Text style={[styles.chipText, { color: form.movement_type === t ? colors.primary : colors.textPrimary }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ModalLabel label="Quantity *" colors={colors} />
              <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} keyboardType="numeric" placeholder="Enter quantity" placeholderTextColor={colors.textMuted} />

              <ModalLabel label="Notes" colors={colors} />
              <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, height: 72, textAlignVertical: 'top' }]} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline placeholder="Optional notes" placeholderTextColor={colors.textMuted} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setModalVisible(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Update</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SummaryChip({ icon, label, value, color, colors }: any) {
  return (
    <View style={styles.summaryChip}>
      <View style={[styles.summaryIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <View>
        <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

function StockStat({ label, value, color, colors }: any) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.stockVal, { color }]}>{value}</Text>
      <Text style={[styles.stockLbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ModalLabel({ label, colors }: any) {
  return <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6 },
  summaryDivider: { width: 1, height: 28 },
  summaryChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  summaryIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  summaryValue: { fontSize: 15, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '600' },
  card: { marginHorizontal: 12, marginTop: 8, borderRadius: 16, padding: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  stockRow: { flexDirection: 'row', marginBottom: 10 },
  stockVal: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  stockLbl: { fontSize: 10, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', marginTop: 2 },
  barBg: { height: 6, borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  adjustBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  adjustText: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { borderRadius: 20, padding: 22, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  modalLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  pickList: { maxHeight: 130, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  pickItem: { paddingHorizontal: 14, paddingVertical: 10 },
  pickText: { fontSize: 14, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
