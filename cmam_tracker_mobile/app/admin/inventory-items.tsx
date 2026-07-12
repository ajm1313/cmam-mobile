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

interface InventoryItemData {
  id: number;
  name: string;
  code: string | null;
  category: string;
  unit: string;
  min_stock_level: number | null;
  reorder_level: number;
  max_stock_level: number | null;
  description: string;
  is_active: boolean;
  has_expiry: boolean;
}

const CATEGORIES = ['RUTF', 'RUSF', 'Medication', 'Equipment', 'Supplement', 'Other'];
const UNITS = ['Sachet', 'Carton', 'Piece', 'Bottle', 'Pack', 'Tablet', 'kg', 'Litre'];

export default function InventoryItemsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItemData | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', unit: '', reorder_level: '', description: '' });

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get('/v1/inventory/items/');
      setItems(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load inventory items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', category: '', unit: '', reorder_level: '', description: '' });
    setModalVisible(true);
  };

  const openEdit = (item: InventoryItemData) => {
    setEditItem(item);
    setForm({
      name: item.name, category: item.category, unit: item.unit,
      reorder_level: item.reorder_level?.toString() || '', description: item.description || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name, category: form.category, unit: form.unit,
        reorder_level: form.reorder_level ? parseInt(form.reorder_level) : 0,
        description: form.description,
      };
      if (editItem) {
        await api.put(`/v1/inventory/items/${editItem.id}/edit/`, body);
        Alert.alert('Success', 'Item updated');
      } else {
        await api.post('/v1/inventory/items/create/', body);
        Alert.alert('Success', 'Item created');
      }
      setModalVisible(false);
      fetchItems();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (item: InventoryItemData) => {
    Alert.alert('Delete Item', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/v1/inventory/items/${item.id}/delete/`);
            Alert.alert('Success', 'Item deleted');
            fetchItems();
          } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = { 'RUTF': colors.danger, 'RUSF': colors.warning, 'Medication': colors.primary, 'Equipment': colors.secondary, 'Supplement': colors.success };
    return map[cat] || colors.textMuted;
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory Items</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.countText, { color: colors.textMuted }]}>{items.length} items</Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} colors={[colors.primary]} />}
      >
        {items.map((item) => {
          const catColor = getCategoryColor(item.category);
          const activeColor = item.is_active ? colors.success : colors.danger;
          const catIcon: Record<string, string> = { 'RUTF': 'nutrition-outline', 'RUSF': 'restaurant-outline', 'Medication': 'medkit-outline', 'Equipment': 'construct-outline', 'Supplement': 'flask-outline' };
          return (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.cardAccent, { backgroundColor: catColor }]} />
              <View style={styles.cardBody}>
                {/* Header row */}
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: catColor + '12' }]}>
                    <Ionicons name={(catIcon[item.category] || 'cube-outline') as any} size={22} color={catColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                    {item.code ? <Text style={[styles.itemCode, { color: colors.textMuted }]}>{item.code}</Text> : null}
                    <Text style={[styles.itemMeta, { color: colors.textMuted }]}>{item.unit}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <View style={[styles.catPill, { backgroundColor: catColor + '12', borderColor: catColor + '30' }]}>
                      <Text style={[styles.catText, { color: catColor }]}>{item.category}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: activeColor + '12', borderColor: activeColor + '30' }]}>
                      <View style={[styles.statusDot, { backgroundColor: activeColor }]} />
                      <Text style={[styles.statusLabel, { color: activeColor }]}>{item.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                {item.description ? <Text style={[styles.descText, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}

                {/* Stock level indicators */}
                <View style={[styles.metaRow, { backgroundColor: colors.inputBg }]}>
                  {item.min_stock_level != null && (
                    <View style={styles.metaItem}>
                      <Text style={[styles.metaNum, { color: colors.textPrimary }]}>{item.min_stock_level}</Text>
                      <Text style={[styles.metaCaption, { color: colors.textMuted }]}>Min</Text>
                    </View>
                  )}
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaNum, { color: catColor }]}>{item.reorder_level}</Text>
                    <Text style={[styles.metaCaption, { color: colors.textMuted }]}>Reorder</Text>
                  </View>
                  {item.max_stock_level != null && (
                    <View style={styles.metaItem}>
                      <Text style={[styles.metaNum, { color: colors.textPrimary }]}>{item.max_stock_level}</Text>
                      <Text style={[styles.metaCaption, { color: colors.textMuted }]}>Max</Text>
                    </View>
                  )}
                  <View style={[styles.metaItem, { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 14 }]}>
                    <Ionicons name={item.has_expiry ? 'time-outline' : 'infinite-outline'} size={16} color={item.has_expiry ? colors.warning : colors.textMuted} />
                    <Text style={[styles.metaCaption, { color: item.has_expiry ? colors.warning : colors.textMuted }]}>{item.has_expiry ? 'Expires' : 'No Expiry'}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '0A', borderColor: colors.primary + '20' }]} onPress={() => openEdit(item)} activeOpacity={0.7}>
                    <Ionicons name="create-outline" size={15} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger + '0A', borderColor: colors.danger + '20' }]} onPress={() => handleDelete(item)} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{editItem ? 'Edit' : 'Create'} Item</Text>
              <ModalField label="Name *" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} colors={colors} />
              <ModalPicker label="Category" value={form.category} options={CATEGORIES} onSelect={(v: string) => setForm({ ...form, category: v })} colors={colors} />
              <ModalPicker label="Unit" value={form.unit} options={UNITS} onSelect={(v: string) => setForm({ ...form, unit: v })} colors={colors} />
              <ModalField label="Reorder Level" value={form.reorder_level} onChangeText={(v: string) => setForm({ ...form, reorder_level: v })} keyboardType="numeric" colors={colors} />
              <ModalField label="Description" value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} multiline colors={colors} />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.textMuted + '20' }]} onPress={() => setModalVisible(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function ModalField({ label, value, onChangeText, keyboardType, multiline, colors }: any) {
  return (
    <View style={styles.modalField}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChangeText} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} multiline={multiline}
      />
    </View>
  );
}

function ModalPicker({ label, value, options, onSelect, colors }: { label: string; value: string; options: string[]; onSelect: (v: string) => void; colors: any }) {
  return (
    <View style={styles.modalField}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity key={opt} style={[styles.chip, { backgroundColor: value === opt ? colors.primary + '20' : colors.inputBg, borderColor: value === opt ? colors.primary : colors.border, borderWidth: 1 }]} onPress={() => onSelect(opt)}>
            <Text style={[styles.chipText, { color: value === opt ? colors.primary : colors.textPrimary }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  countText: { fontSize: 12, fontWeight: '600', marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  itemCard: { marginHorizontal: 12, marginTop: 10, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardAccent: { height: 3, width: '100%' },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  catPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  catText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  descText: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  itemCode: { fontSize: 11, fontWeight: '600', fontFamily: 'monospace', marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, padding: 10, borderRadius: 10 },
  metaItem: { alignItems: 'center', gap: 2 },
  metaNum: { fontSize: 16, fontWeight: '800' },
  metaCaption: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  actionText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  modalContent: { borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalField: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
