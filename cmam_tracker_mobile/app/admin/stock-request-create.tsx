import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import OfflineBanner from '../../components/OfflineBanner';

interface InventoryItem { id: number; name: string; code: string; unit: string; }
interface Facility { id: number; name: string; }
interface Loc { id: number; name: string; }

interface RequestItem { item_id: number; item_name: string; item_unit: string; quantity: string; notes: string; }

const PRIORITIES = ['low', 'normal', 'high', 'emergency'];
const PRIORITY_COLOR: Record<string, string> = { low: '#16a34a', normal: '#2563eb', high: '#d97706', emergency: '#dc2626' };

export default function StockRequestCreateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'requesting' | 'supplier' | 'item'>('item');
  const [requestingFacility, setRequestingFacility] = useState<Facility | null>(null);
  const [supplierFacility, setSupplierFacility] = useState<Facility | null>(null);
  const [regions, setRegions] = useState<Loc[]>([]);
  // Requesting location cascade
  const [reqRegion, setReqRegion] = useState<Loc | null>(null);
  const [reqDistrict, setReqDistrict] = useState<Loc | null>(null);
  const [reqDistricts, setReqDistricts] = useState<Loc[]>([]);
  const [reqFacilities, setReqFacilities] = useState<Facility[]>([]);
  // Supplier location cascade
  const [supRegion, setSupRegion] = useState<Loc | null>(null);
  const [supDistrict, setSupDistrict] = useState<Loc | null>(null);
  const [supDistricts, setSupDistricts] = useState<Loc[]>([]);
  const [supFacilities, setSupFacilities] = useState<Facility[]>([]);
  const [priority, setPriority] = useState('normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [itemRes, facRes, regRes] = await Promise.all([
        api.get('/v1/inventory/items/'),
        api.get('/v1/facilities/'),
        api.get('/v1/locations/regions/'),
      ]);
      setItems(itemRes.data.data || []);
      setFacilities(facRes.data.data || []);
      setRegions(regRes.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Requesting location cascading
  useEffect(() => {
    if (reqRegion) {
      api.get('/v1/locations/districts/', { params: { region_id: reqRegion.id } })
        .then(r => setReqDistricts(r.data.data ?? []))
        .catch(() => setReqDistricts([]));
    } else { setReqDistricts([]); setReqDistrict(null); setRequestingFacility(null); }
  }, [reqRegion]);

  useEffect(() => {
    if (reqDistrict) {
      api.get('/v1/facilities/', { params: { district: reqDistrict.id } })
        .then(r => setReqFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setReqFacilities([]));
    } else { setReqFacilities([]); setRequestingFacility(null); }
  }, [reqDistrict]);

  // Supplier location cascading
  useEffect(() => {
    if (supRegion) {
      api.get('/v1/locations/districts/', { params: { region_id: supRegion.id } })
        .then(r => setSupDistricts(r.data.data ?? []))
        .catch(() => setSupDistricts([]));
    } else { setSupDistricts([]); setSupDistrict(null); setSupplierFacility(null); }
  }, [supRegion]);

  useEffect(() => {
    if (supDistrict && requestingFacility) {
      api.get('/v1/inventory/supplier-facilities/', { params: { requesting_facility_id: requestingFacility.id } })
        .then(r => setSupFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setSupFacilities([]));
    } else if (supDistrict) {
      api.get('/v1/facilities/', { params: { district: supDistrict.id } })
        .then(r => setSupFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setSupFacilities([]));
    } else { setSupFacilities([]); setSupplierFacility(null); }
  }, [supDistrict, requestingFacility]);

  // Auto-route facility requests to their parent district and show available supplier facilities
  useEffect(() => {
    if (requestingFacility && reqDistrict && reqRegion) {
      setSupRegion(reqRegion);
      setSupDistrict(reqDistrict);
      setSupplierFacility(null); // default to district store unless user picks a facility
    }
  }, [requestingFacility, reqDistrict, reqRegion]);

  const addItem = (item: InventoryItem) => {
    if (requestItems.find((ri) => ri.item_id === item.id)) {
      Alert.alert('Info', 'Item already added'); return;
    }
    setRequestItems([...requestItems, { item_id: item.id, item_name: item.name, item_unit: item.unit, quantity: '', notes: '' }]);
    setPickerVisible(false);
    setItemSearch('');
  };

  const removeItem = (idx: number) => {
    setRequestItems(requestItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: 'quantity' | 'notes', value: string) => {
    const updated = [...requestItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setRequestItems(updated);
  };

  const handleSubmit = async () => {
    if (!requestingFacility && !reqDistrict && !reqRegion) {
      Alert.alert('Validation', 'Select a requesting location (at least region level)');
      return;
    }
    if (requestItems.length === 0) { Alert.alert('Validation', 'Add at least one item'); return; }
    const invalidItem = requestItems.find((i) => !i.quantity || parseInt(i.quantity) <= 0);
    if (invalidItem) { Alert.alert('Validation', `Enter a valid quantity for ${invalidItem.item_name}`); return; }

    setSaving(true);
    try {
      const res = await sendOrQueue('/v1/inventory/requests/create/', 'post', {
        requesting_facility_id: requestingFacility?.id || null,
        requesting_region_id: reqRegion?.id || null,
        requesting_district_id: reqDistrict?.id || null,
        supplier_facility_id: supplierFacility?.id || null,
        supplier_region_id: supRegion?.id || null,
        supplier_district_id: supDistrict?.id || null,
        priority,
        required_date: requiredDate || null,
        justification,
        notes,
        items: requestItems.map((i) => ({
          item_id: i.item_id,
          quantity: parseInt(i.quantity),
          notes: i.notes,
        })),
      }, 'Stock Request');
      if (res) {
        Alert.alert('Success', 'Stock request submitted', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Saved Offline', 'Stock request saved and will sync when online.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create request');
    } finally { setSaving(false); }
  };

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    i.code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Stock Request</Text>
        <View style={{ width: 40 }} />
      </View>

      <OfflineBanner />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Section: Requesting Location */}
        <SectionHeader title="Requesting From" icon="business-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Region *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {regions.map(r => (
              <TouchableOpacity key={r.id} style={[styles.locChip, reqRegion?.id === r.id && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => { setReqRegion(r); setReqDistrict(null); setRequestingFacility(null); }}>
                <Text style={[styles.locChipText, { color: reqRegion?.id === r.id ? colors.primary : colors.textPrimary }]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {reqRegion && reqDistricts.length > 0 && (<>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>District</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <TouchableOpacity style={[styles.locChip, !reqDistrict && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => { setReqDistrict(null); setRequestingFacility(null); }}>
                <Text style={[styles.locChipText, { color: !reqDistrict ? colors.primary : colors.textPrimary }]}>Regional Level</Text>
              </TouchableOpacity>
              {reqDistricts.map(d => (
                <TouchableOpacity key={d.id} style={[styles.locChip, reqDistrict?.id === d.id && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => { setReqDistrict(d); setRequestingFacility(null); }}>
                  <Text style={[styles.locChipText, { color: reqDistrict?.id === d.id ? colors.primary : colors.textPrimary }]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>)}

          {reqDistrict && reqFacilities.length > 0 && (<>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Facility</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
              <TouchableOpacity style={[styles.locChip, !requestingFacility && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => setRequestingFacility(null)}>
                <Text style={[styles.locChipText, { color: !requestingFacility ? colors.primary : colors.textPrimary }]}>District Level</Text>
              </TouchableOpacity>
              {reqFacilities.map(f => (
                <TouchableOpacity key={f.id} style={[styles.locChip, requestingFacility?.id === f.id && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => setRequestingFacility(f)}>
                  <Text style={[styles.locChipText, { color: requestingFacility?.id === f.id ? colors.primary : colors.textPrimary }]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>)}
        </View>

        {/* Section: Supplier Location */}
        <SectionHeader title="Supplier (Optional)" icon="arrow-down-circle-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Region</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <TouchableOpacity style={[styles.locChip, !supRegion && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => { setSupRegion(null); setSupDistrict(null); setSupplierFacility(null); }}>
              <Text style={[styles.locChipText, { color: !supRegion ? colors.success : colors.textPrimary }]}>National</Text>
            </TouchableOpacity>
            {regions.map(r => (
              <TouchableOpacity key={r.id} style={[styles.locChip, supRegion?.id === r.id && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => { setSupRegion(r); setSupDistrict(null); setSupplierFacility(null); }}>
                <Text style={[styles.locChipText, { color: supRegion?.id === r.id ? colors.success : colors.textPrimary }]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {supRegion && supDistricts.length > 0 && (<>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>District</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <TouchableOpacity style={[styles.locChip, !supDistrict && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => { setSupDistrict(null); setSupplierFacility(null); }}>
                <Text style={[styles.locChipText, { color: !supDistrict ? colors.success : colors.textPrimary }]}>Regional Level</Text>
              </TouchableOpacity>
              {supDistricts.map(d => (
                <TouchableOpacity key={d.id} style={[styles.locChip, supDistrict?.id === d.id && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => { setSupDistrict(d); setSupplierFacility(null); }}>
                  <Text style={[styles.locChipText, { color: supDistrict?.id === d.id ? colors.success : colors.textPrimary }]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>)}

          {supDistrict && supFacilities.length > 0 && (<>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Facility</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
              <TouchableOpacity style={[styles.locChip, !supplierFacility && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setSupplierFacility(null)}>
                <Text style={[styles.locChipText, { color: !supplierFacility ? colors.success : colors.textPrimary }]}>District Level</Text>
              </TouchableOpacity>
              {supFacilities.map(f => (
                <TouchableOpacity key={f.id} style={[styles.locChip, supplierFacility?.id === f.id && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setSupplierFacility(f)}>
                  <Text style={[styles.locChipText, { color: supplierFacility?.id === f.id ? colors.success : colors.textPrimary }]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>)}
        </View>

        {/* Section: Priority & Date */}
        <SectionHeader title="Details" icon="options-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => {
              const pc = PRIORITY_COLOR[p];
              const sel = priority === p;
              return (
                <TouchableOpacity key={p} style={[styles.priorityChip, { backgroundColor: sel ? pc + '20' : colors.inputBg, borderColor: sel ? pc : colors.border, borderWidth: 1 }]} onPress={() => setPriority(p)}>
                  <View style={[styles.dot, { backgroundColor: pc }]} />
                  <Text style={[styles.chipText, { color: sel ? pc : colors.textPrimary }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>Required By Date</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg }]}
            value={requiredDate} onChangeText={setRequiredDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>Justification</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, height: 80, textAlignVertical: 'top' }]}
            value={justification} onChangeText={setJustification}
            multiline placeholder="Reason for request..." placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>Additional Notes</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, height: 60, textAlignVertical: 'top' }]}
            value={notes} onChangeText={setNotes}
            multiline placeholder="Optional notes..." placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Section: Items */}
        <View style={styles.itemsHeader}>
          <SectionHeader title={`Items (${requestItems.length})`} icon="cube-outline" colors={colors} />
          <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: colors.primary }]} onPress={() => { setPickerMode('item'); setPickerVisible(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addItemText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {requestItems.length === 0 ? (
          <View style={[styles.emptyItems, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="cube-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyItemsText, { color: colors.textMuted }]}>No items added yet</Text>
          </View>
        ) : (
          requestItems.map((ri, idx) => (
            <View key={ri.item_id} style={[styles.requestItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.riTop}>
                <View style={[styles.riIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="cube" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.riName, { color: colors.textPrimary }]}>{ri.item_name}</Text>
                <TouchableOpacity onPress={() => removeItem(idx)} style={styles.riRemove}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
              <View style={styles.riFields}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.riLabel, { color: colors.textMuted }]}>Quantity *</Text>
                  <TextInput
                    style={[styles.riInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }]}
                    value={ri.quantity} onChangeText={(v) => updateItem(idx, 'quantity', v)}
                    keyboardType="numeric" placeholder={`in ${ri.item_unit}`} placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 2, marginLeft: 10 }}>
                  <Text style={[styles.riLabel, { color: colors.textMuted }]}>Notes</Text>
                  <TextInput
                    style={[styles.riInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }]}
                    value={ri.notes} onChangeText={(v) => updateItem(idx, 'notes', v)}
                    placeholder="Optional" placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </View>
          ))
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSubmit} disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Item Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Item</Text>
              <TouchableOpacity onPress={() => { setPickerVisible(false); setItemSearch(''); }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              value={itemSearch} onChangeText={setItemSearch}
              placeholder="Search items..." placeholderTextColor={colors.textMuted}
            />

            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {filteredItems.map((i) => (
                <TouchableOpacity key={i.id} style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => addItem(i)}>
                  <View style={[styles.riIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="cube" size={14} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.piName, { color: colors.textPrimary }]}>{i.name}</Text>
                    <Text style={[styles.piSub, { color: colors.textMuted }]}>{i.code} • {i.unit}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ title, icon, colors }: any) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { marginHorizontal: 12, borderRadius: 16, padding: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  pickerText: { fontSize: 15, fontWeight: '500', flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '600' },
  locChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', marginRight: 8 },
  locChipText: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 12 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  addItemText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyItems: { marginHorizontal: 12, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed' as any },
  emptyItemsText: { fontSize: 14, fontWeight: '500' },
  requestItemCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  riTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  riIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  riName: { fontSize: 15, fontWeight: '600', flex: 1, marginLeft: 10 },
  riRemove: { padding: 2 },
  riFields: { flexDirection: 'row' },
  riLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  riInput: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 12, marginTop: 24, paddingVertical: 16, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  searchInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 10 },
  pickerList: { maxHeight: 360 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1 },
  piName: { fontSize: 15, fontWeight: '600' },
  piSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});
