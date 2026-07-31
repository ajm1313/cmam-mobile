import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../lib/store';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import { setCache, getCacheFallback } from '../../lib/cache';
import OfflineBanner from '../../components/OfflineBanner';
import { SyncStatusBanner } from '../../components/SyncStatus';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import type { StockLevel, InventoryItem } from '../../lib/types';

function QuickLink({ icon, label, color, bg, onPress }: { icon: string; label: string; color: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.quickBtn, { backgroundColor: bg + '12', borderColor: bg + '30' }]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.quickLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function InventoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const userFacilityId = user?.location?.facility_id;
  const isAdmin = !userFacilityId;

  const [adminFacilities, setAdminFacilities] = useState<{ id: number; name: string }[]>([]);
  const [selectedAdminFacility, setSelectedAdminFacility] = useState<{ id: number; name: string } | null>(null);
  const [facilityPickerVisible, setFacilityPickerVisible] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/v1/facilities/').then(res => {
        const list = (res.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }));
        setAdminFacilities(list);
      }).catch(() => {});
    }
  }, [isAdmin]);

  const facilityId = isAdmin ? selectedAdminFacility?.id : userFacilityId;

  const [stock, setStock] = useState<StockLevel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [search, setSearch] = useState('');
  const [showConsume, setShowConsume] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockLevel | null>(null);
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeNote, setConsumeNote] = useState('');
  const [consuming, setConsuming] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cacheKey = `inventory_${facilityId ?? 'all'}`;

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, stockRes] = await Promise.all([
        api.get('/v1/inventory/items/'),
        facilityId ? api.get(`/v1/inventory/facility/${facilityId}/stock/`) : Promise.resolve({ data: { data: [] } }),
      ]);
      const freshItems = itemsRes.data.data ?? [];
      const freshStock = stockRes.data.data ?? [];
      setItems(freshItems);
      setStock(freshStock);
      setIsStale(false);
      await setCache(cacheKey, { items: freshItems, stock: freshStock }, 10 * 60 * 1000);
    } catch {
      const cached = await getCacheFallback<{ items: InventoryItem[]; stock: StockLevel[] }>(cacheKey);
      if (cached) {
        setItems(cached.data.items);
        setStock(cached.data.stock);
        setIsStale(true);
      } else {
        setStock([]);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [facilityId, cacheKey]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const openConsume = (item: StockLevel) => {
    setSelectedItem(item);
    setConsumeQty('');
    setConsumeNote('');
    setShowConsume(true);
  };

  const handleConsume = async () => {
    if (!selectedItem || !facilityId) return;
    const qty = parseFloat(consumeQty);
    if (!qty || qty <= 0) {
      Alert.alert('Error', 'Enter a valid quantity.');
      return;
    }
    if (qty > selectedItem.current_balance) {
      Alert.alert('Error', `Quantity exceeds stock balance (${selectedItem.current_balance}).`);
      return;
    }
    setConsuming(true);
    try {
      const res = await sendOrQueue('/v1/inventory/consumption/', 'post', {
        inventory_item_id: selectedItem.inventory_item.id,
        facility_id: facilityId,
        quantity: qty,
        notes: consumeNote,
      }, 'Consumption Record');
      if (res) {
        Alert.alert('Success', 'Consumption recorded successfully.');
        setShowConsume(false);
        fetchData();
      } else {
        setShowConsume(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to record consumption.');
    } finally {
      setConsuming(false);
    }
  };

  const handleExport = async (format: 'excel' | 'csv') => {
    setExporting(true);
    try {
      const params: Record<string, string> = { format };
      if (facilityId) params.facility_id = String(facilityId);

      const res = await api.get('/v1/export/inventory/', {
        params,
        responseType: 'arraybuffer',
      });

      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const mimeType = format === 'excel' ?
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
        'text/csv';
      const fileName = `inventory_${Date.now()}.${ext}`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const base64 = btoa(
        new Uint8Array(res.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: 'Export Inventory' });
      } else {
        Alert.alert('Export Complete', `File saved: ${fileName}`);
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'Could not export inventory.');
    } finally {
      setExporting(false);
    }
  };

  const filtered = stock.filter((s) =>
    s.inventory_item?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = filtered.filter((s) => s.current_balance <= (s.inventory_item?.reorder_level ?? 0));
  const adequate = filtered.filter((s) => s.current_balance > (s.inventory_item?.reorder_level ?? 0));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={isStale} />
      <SyncStatusBanner />

      {/* Inventory Management Quick Actions */}
      <View style={styles.quickRow}>
        <QuickLink icon="add-circle-outline" label="Receive" color={colors.success} bg={colors.success} onPress={() => router.push('/admin/receive-stock' as any)} />
        <QuickLink icon="swap-horizontal-outline" label="Transfer" color={colors.primary} bg={colors.primary} onPress={() => router.push('/admin/distribute-stock' as any)} />
        <QuickLink icon="document-text-outline" label="Requests" color={colors.warning} bg={colors.warning} onPress={() => router.push('/admin/stock-requests' as any)} />
        <QuickLink icon="layers-outline" label="All Stock" color={colors.secondary} bg={colors.secondary} onPress={() => router.push('/admin/stock-levels' as any)} />
      </View>
      <View style={styles.quickRow}>
        {user?.is_superuser && <QuickLink icon="pulse-outline" label="Movements" color={colors.secondary} bg={colors.secondary} onPress={() => router.push('/admin/stock-movements' as any)} />}
        <QuickLink icon="time-outline" label="Expiry" color={colors.danger} bg={colors.danger} onPress={() => router.push('/admin/expiry-management' as any)} />
        <QuickLink icon="bar-chart-outline" label="Reports" color={colors.primary} bg={colors.primary} onPress={() => router.push('/admin/inventory-reports' as any)} />
      </View>

      {/* Export Buttons */}
      <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.exportBtn, { borderColor: colors.success + '40', backgroundColor: colors.success + '10' }]}
          onPress={() => handleExport('excel')}
          disabled={exporting}
          activeOpacity={0.7}
        >
          {exporting ? (
            <ActivityIndicator size={14} color={colors.success} />
          ) : (
            <Ionicons name="download-outline" size={14} color={colors.success} />
          )}
          <Text style={[styles.exportBtnText, { color: colors.success }]}>Export Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, { borderColor: colors.secondary + '40', backgroundColor: colors.secondary + '10' }]}
          onPress={() => handleExport('csv')}
          disabled={exporting}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={14} color={colors.secondary} />
          <Text style={[styles.exportBtnText, { color: colors.secondary }]}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search inventory..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isAdmin && (
        <TouchableOpacity
          style={[styles.facilitySelector, { backgroundColor: colors.surface, borderColor: facilityId ? colors.primary : colors.border }]}
          onPress={() => setFacilityPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="business-outline" size={16} color={facilityId ? colors.primary : colors.textMuted} />
          <Text style={[styles.facilitySelectorText, { color: facilityId ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>
            {selectedAdminFacility?.name ?? 'Select a facility to view stock'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {loading ? (
          <View style={{ paddingTop: 8 }}>{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</View>
        ) : facilityId ? (
          filtered.length === 0 ? (
            <EmptyState icon="cube-outline" title="No stock found" subtitle="No inventory items match your search." />
          ) : (
            <>
              {lowStock.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="warning-outline" size={15} color={colors.danger} />
                  <Text style={[styles.sectionTitle, { color: colors.danger }]}>Low Stock ({lowStock.length})</Text>
                </View>
              )}
              {lowStock.map((s) => (
                <StockCard key={s.id} item={s} onConsume={() => openConsume(s)} canConsume={!!facilityId} colors={colors} />
              ))}
              {adequate.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                  <Text style={[styles.sectionTitle, { color: colors.success }]}>Adequate Stock ({adequate.length})</Text>
                </View>
              )}
              {adequate.map((s) => (
                <StockCard key={s.id} item={s} onConsume={() => openConsume(s)} canConsume={!!facilityId} colors={colors} />
              ))}
            </>
          )
        ) : (
          items.length === 0 ? (
            <EmptyState icon="cube-outline" title="No items found" />
          ) : (
            items
              .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
              .map((item) => <ItemCard key={item.id} item={item} colors={colors} />)
          )
        )}
      </ScrollView>

      {/* Consume Modal */}
      <Modal visible={showConsume} transparent animationType="slide" onRequestClose={() => setShowConsume(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Record Consumption</Text>
              <TouchableOpacity onPress={() => setShowConsume(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedItem && (
              <>
                <Text style={[styles.modalItemName, { color: colors.primary }]}>{selectedItem.inventory_item.name}</Text>
                <Text style={[styles.modalBalance, { color: colors.textSecondary }]}>
                  Current Balance: <Text style={{ fontWeight: '700', color: colors.primary }}>{selectedItem.current_balance} {selectedItem.inventory_item.unit}</Text>
                </Text>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Quantity Used</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]}
                  value={consumeQty}
                  onChangeText={setConsumeQty}
                  keyboardType="numeric"
                  placeholder={`Max: ${selectedItem.current_balance}`}
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 70, textAlignVertical: 'top', borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]}
                  value={consumeNote}
                  onChangeText={setConsumeNote}
                  multiline
                  placeholder="e.g. Weekly RUTF distribution"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  style={[styles.consumeBtn, { backgroundColor: colors.primary }, consuming && { opacity: 0.6 }]}
                  onPress={handleConsume}
                  disabled={consuming}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.consumeBtnText}>{consuming ? 'Saving...' : 'Record Consumption'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Facility Picker Modal */}
      <Modal visible={facilityPickerVisible} animationType="slide" transparent onRequestClose={() => setFacilityPickerVisible(false)}>
        <View style={styles.facilityModalOverlay}>
          <View style={[styles.facilitySheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.facilitySheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.facilitySheetTitle, { color: colors.textPrimary }]}>Select Facility</Text>
              <TouchableOpacity onPress={() => setFacilityPickerVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={adminFacilities}
              keyExtractor={(f) => String(f.id)}
              renderItem={({ item: f }) => (
                <TouchableOpacity
                  style={[styles.facilitySheetItem, { borderBottomColor: colors.border, backgroundColor: selectedAdminFacility?.id === f.id ? colors.primary + '10' : 'transparent' }]}
                  onPress={() => { setSelectedAdminFacility(f); setFacilityPickerVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="business-outline" size={16} color={selectedAdminFacility?.id === f.id ? colors.primary : colors.textMuted} />
                  <Text style={[styles.facilitySheetItemText, { color: selectedAdminFacility?.id === f.id ? colors.primary : colors.textPrimary, fontWeight: selectedAdminFacility?.id === f.id ? '700' : '500' }]}>{f.name}</Text>
                  {selectedAdminFacility?.id === f.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StockCard({ item, onConsume, canConsume, colors }: { item: StockLevel; onConsume: () => void; canConsume: boolean; colors: any }) {
  const isLow = item.current_balance <= (item.inventory_item?.reorder_level ?? 0);
  const statusColor = isLow ? colors.danger : colors.success;
  const pct = item.inventory_item?.reorder_level
    ? Math.min(100, (item.current_balance / (item.inventory_item.reorder_level * 2)) * 100)
    : 50;
  const catIcon = getCategoryIcon(item.inventory_item?.category);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* Accent strip */}
      <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
      <View style={styles.cardInner}>
        {/* Top row: icon + name + badge */}
        <View style={styles.cardTop}>
          <View style={[styles.cardIconWrap, { backgroundColor: statusColor + '12' }]}>
            <Ionicons name={catIcon as any} size={20} color={statusColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.inventory_item?.name}</Text>
            <Text style={[styles.itemCategory, { color: colors.textMuted }]}>{item.inventory_item?.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '14', borderColor: statusColor + '30' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>{isLow ? 'Low Stock' : 'Adequate'}</Text>
          </View>
        </View>

        {/* Balance display */}
        <View style={[styles.balanceRow, { backgroundColor: colors.inputBg }]}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[styles.balanceValue, { color: colors.textPrimary }]}>{item.current_balance}</Text>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Current ({item.inventory_item?.unit})</Text>
          </View>
          <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[styles.balanceReorder, { color: colors.textSecondary }]}>{item.inventory_item?.reorder_level}</Text>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Reorder Level</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressBg, { backgroundColor: colors.border + '60' }]}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: statusColor }]} />
          </View>
          <Text style={[styles.progressPct, { color: colors.textMuted }]}>{Math.round(pct)}%</Text>
        </View>

        {/* Consume button */}
        {canConsume && (
          <TouchableOpacity style={[styles.consumeRowBtn, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]} onPress={onConsume} activeOpacity={0.7}>
            <Ionicons name="remove-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.consumeRowText, { color: colors.primary, flex: 1 }]}>Record Consumption</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function getCategoryIcon(category?: string) {
  const map: Record<string, string> = {
    'RUTF': 'nutrition-outline', 'RUSF': 'restaurant-outline', 'Medication': 'medkit-outline',
    'Equipment': 'construct-outline', 'Supplement': 'flask-outline',
  };
  return map[category ?? ''] || 'cube-outline';
}

function ItemCard({ item, colors }: { item: InventoryItem; colors: any }) {
  const catIcon = getCategoryIcon(item.category);
  const catColor = getCatColor(item.category, colors);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.cardAccent, { backgroundColor: catColor }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <View style={[styles.cardIconWrap, { backgroundColor: catColor + '12' }]}>
            <Ionicons name={catIcon as any} size={20} color={catColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.itemCategory, { color: colors.textMuted }]}>{item.category} • {item.unit}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: catColor + '14', borderColor: catColor + '30' }]}>
            <Text style={[styles.statusLabel, { color: catColor }]}>{item.category}</Text>
          </View>
        </View>
        <View style={[styles.itemInfoRow, { borderTopColor: colors.border }]}>
          <Ionicons name="repeat-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.itemInfoText, { color: colors.textMuted }]}>Reorder at <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{item.reorder_level}</Text> {item.unit}</Text>
        </View>
      </View>
    </View>
  );
}

function getCatColor(category: string, colors: any) {
  const map: Record<string, string> = {
    'RUTF': colors.danger, 'RUSF': colors.warning, 'Medication': colors.primary,
    'Equipment': colors.secondary, 'Supplement': colors.success,
  };
  return map[category] || colors.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  quickRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  quickLabel: { fontSize: 10, fontWeight: '700' },
  exportRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
  },
  exportBtnText: { fontSize: 12, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', margin: 12, borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.secondary + '14', marginHorizontal: 12, marginBottom: 8,
    padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.secondary + '30',
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.secondary, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  card: {
    marginHorizontal: 12, marginBottom: 10, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardAccent: { height: 3, width: '100%' },
  cardInner: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemCategory: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 12 },
  balanceValue: { fontSize: 24, fontWeight: '800' },
  balanceReorder: { fontSize: 18, fontWeight: '700' },
  balanceLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  balanceDivider: { width: 1, height: 32, marginHorizontal: 12 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  progressBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPct: { fontSize: 10, fontWeight: '700', width: 30, textAlign: 'right' },
  consumeRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  consumeRowText: { fontSize: 13, fontWeight: '600' },
  itemInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1 },
  itemInfoText: { fontSize: 12, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  modalItemName: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  modalBalance: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: '#f8fafc',
  },
  consumeBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, marginTop: 20,
  },
  consumeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  facilitySelector: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  facilitySelectorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  facilityModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  facilitySheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  facilitySheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  facilitySheetTitle: { fontSize: 16, fontWeight: '700' },
  facilitySheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  facilitySheetItemText: { flex: 1, fontSize: 14 },
});
