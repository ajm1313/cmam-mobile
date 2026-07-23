import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrReject } from '../../lib/offlineQueue';
import DatePickerField from '../../components/DatePickerField';

const CATEGORIES = ['RUTF', 'RUSF', 'Medication', 'Equipment', 'Supplement', 'Other'];
const UNITS = ['Sachet', 'Carton', 'Piece', 'Bottle', 'Pack', 'Tablet', 'kg', 'Litre'];
const STORAGE_CONDITIONS = ['Room Temperature', 'Refrigerated', 'Frozen', 'Dry Storage', 'Cool Dry Place'];
const YES_NO = ['Yes', 'No'];
const ACTIVE_OPTIONS = ['Active', 'Inactive'];

export default function InventoryEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState<{ field: string; options: string[] } | null>(null);

  const [form, setForm] = useState({
    name: '', code: '', category: '', unit_of_measure: '', unit_cost: '',
    initial_stock: '', batch_number: '', manufacture_date: '', expiry_date: '',
    manufacturer: '', supplier: '', storage_conditions: '',
    reorder_level: '', min_stock_level: '', max_stock_level: '',
    has_expiry: 'No', is_active: 'Active', description: '',
  });

  const update = useCallback((key: string, val: string) => setForm((p) => ({ ...p, [key]: val })), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/v1/inventory/items/${id}/`);
        const item = res.data.data;
        setForm({
          name: item.name || '',
          code: item.code || '',
          category: item.category || '',
          unit_of_measure: item.unit || item.unit_of_measure || '',
          unit_cost: item.unit_cost?.toString() || '',
          initial_stock: item.initial_stock?.toString() || '',
          batch_number: item.batch_number || '',
          manufacture_date: item.manufacture_date || '',
          expiry_date: item.expiry_date || '',
          manufacturer: item.manufacturer || '',
          supplier: item.supplier || '',
          storage_conditions: item.storage_conditions || '',
          reorder_level: item.reorder_level?.toString() || '',
          min_stock_level: item.min_stock_level?.toString() || '',
          max_stock_level: item.max_stock_level?.toString() || '',
          has_expiry: item.has_expiry ? 'Yes' : 'No',
          is_active: item.is_active !== false ? 'Active' : 'Inactive',
          description: item.description || '',
        });
      } catch {
        Alert.alert('Error', 'Failed to load inventory item');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'Item name is required'); return; }
    if (!form.category) { Alert.alert('Validation', 'Category is required'); return; }
    if (!form.unit_of_measure) { Alert.alert('Validation', 'Unit of measure is required'); return; }
    if (!form.reorder_level) { Alert.alert('Validation', 'Reorder level is required'); return; }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        code: form.code.toUpperCase(),
        category: form.category,
        unit_of_measure: form.unit_of_measure,
        unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : undefined,
        initial_stock: form.initial_stock ? parseInt(form.initial_stock) : 0,
        batch_number: form.batch_number || undefined,
        manufacture_date: form.manufacture_date || undefined,
        expiry_date: form.expiry_date || undefined,
        manufacturer: form.manufacturer || undefined,
        supplier: form.supplier || undefined,
        storage_conditions: form.storage_conditions || undefined,
        reorder_level: parseInt(form.reorder_level),
        min_stock_level: form.min_stock_level ? parseInt(form.min_stock_level) : undefined,
        max_stock_level: form.max_stock_level ? parseInt(form.max_stock_level) : undefined,
        has_expiry: form.has_expiry === 'Yes',
        is_active: form.is_active === 'Active',
        description: form.description || undefined,
      };
      await sendOrReject(`/v1/inventory/items/${id}/edit/`, 'put', payload, 'Inventory Edit');
      Alert.alert('Success', 'Item updated', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      if (e.message?.includes('internet connection')) return;
      Alert.alert('Error', e.response?.data?.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const openPicker = (field: string, options: string[]) => setPickerVisible({ field, options });
  const pickerField = pickerVisible?.field;
  const pickerOptions = pickerVisible?.options || [];
  const pickerValue = pickerField ? (form as any)[pickerField] : '';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Inventory Item</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Basic Information */}
        <SectionHeader title="Basic Information" icon="cube-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Item Name *" value={form.name} onChangeText={(v: string) => update('name', v)} colors={colors} />
          <Field label="Item Code *" value={form.code} onChangeText={(v: string) => update('code', v.toUpperCase())} autoCapitalize="characters" colors={colors} />
          <PickerRow label="Category *" value={form.category} onPress={() => openPicker('category', CATEGORIES)} colors={colors} />
          <PickerRow label="Unit of Measure *" value={form.unit_of_measure} onPress={() => openPicker('unit_of_measure', UNITS)} colors={colors} />
          <Field label="Unit Cost" value={form.unit_cost} onChangeText={(v: string) => update('unit_cost', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Initial Stock Quantity" value={form.initial_stock} onChangeText={(v: string) => update('initial_stock', v)} keyboardType="numeric" colors={colors} />
        </View>

        {/* Batch & Expiry */}
        <SectionHeader title="Batch & Expiry Information" icon="calendar-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Batch/Lot Number" value={form.batch_number} onChangeText={(v: string) => update('batch_number', v)} colors={colors} />
          <DatePickerField label="Manufacture Date" value={form.manufacture_date} onChange={(v: string) => update('manufacture_date', v)} colors={colors} />
          <DatePickerField label="Expiry Date" value={form.expiry_date} onChange={(v: string) => update('expiry_date', v)} colors={colors} />
        </View>

        {/* Supplier Information */}
        <SectionHeader title="Supplier Information" icon="business-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Manufacturer" value={form.manufacturer} onChangeText={(v: string) => update('manufacturer', v)} colors={colors} />
          <Field label="Supplier" value={form.supplier} onChangeText={(v: string) => update('supplier', v)} colors={colors} />
        </View>

        {/* Storage & Reorder */}
        <SectionHeader title="Storage & Reorder Settings" icon="settings-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PickerRow label="Storage Conditions" value={form.storage_conditions} onPress={() => openPicker('storage_conditions', STORAGE_CONDITIONS)} colors={colors} />
          <Field label="Reorder Level *" value={form.reorder_level} onChangeText={(v: string) => update('reorder_level', v)} keyboardType="numeric" colors={colors} hint="Minimum stock level before reorder alert" />
          <Field label="Min Stock Level" value={form.min_stock_level} onChangeText={(v: string) => update('min_stock_level', v)} keyboardType="numeric" colors={colors} hint="Critical threshold below which stock is urgent" />
          <Field label="Max Stock Level" value={form.max_stock_level} onChangeText={(v: string) => update('max_stock_level', v)} keyboardType="numeric" colors={colors} hint="Maximum storage capacity" />
          <PickerRow label="Has Expiry Date?" value={form.has_expiry} onPress={() => openPicker('has_expiry', YES_NO)} colors={colors} />
          <PickerRow label="Status" value={form.is_active} onPress={() => openPicker('is_active', ACTIVE_OPTIONS)} colors={colors} />
        </View>

        {/* Description */}
        <SectionHeader title="Description" icon="document-text-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Description" value={form.description} onChangeText={(v: string) => update('description', v)} multiline colors={colors} placeholder="Additional notes about this item..." />
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Item'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modal */}
      <Modal visible={!!pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Option</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {pickerOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.modalItem, { backgroundColor: pickerValue === opt ? colors.primary + '15' : 'transparent' }]}
                  onPress={() => { if (pickerField) update(pickerField, opt); setPickerVisible(null); }}
                >
                  <Text style={[styles.modalItemText, { color: pickerValue === opt ? colors.primary : colors.textPrimary }]}>{opt}</Text>
                  {pickerValue === opt && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.textMuted + '30' }]} onPress={() => setPickerVisible(null)}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ title, icon, colors }: { title: string; icon: string; colors: any }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, autoCapitalize, colors, hint }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, height: multiline ? 80 : 46 }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType} autoCapitalize={autoCapitalize || 'none'} multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {hint && <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>{hint}</Text>}
    </View>
  );
}

function PickerRow({ label, value, onPress, colors }: { label: string; value: string; onPress: () => void; colors: any }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg }]} onPress={onPress} activeOpacity={0.7}>
        <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textMuted }]}>{value || 'Select...'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  card: { marginHorizontal: 16, borderRadius: 14, padding: 14, gap: 12 },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  fieldInput: { borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, height: 46 },
  pickerText: { fontSize: 15 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  modalItemText: { fontSize: 15, fontWeight: '500' },
  modalCancel: { marginTop: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
});
