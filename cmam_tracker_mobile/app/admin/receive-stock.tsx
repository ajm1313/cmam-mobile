import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface InventoryItem { id: number; name: string; code: string; unit: string; }
interface Loc { id: number; name: string; }

export default function ReceiveStockScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [regions, setRegions] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [facilities, setFacilities] = useState<Loc[]>([]);

  // Form state
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selRegion, setSelRegion] = useState<Loc | null>(null);
  const [selDistrict, setSelDistrict] = useState<Loc | null>(null);
  const [selFacility, setSelFacility] = useState<Loc | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [itemRes, regRes] = await Promise.all([
        api.get('/v1/inventory/items/'),
        api.get('/v1/locations/regions/'),
      ]);
      setItems(itemRes.data.data || []);
      setRegions(regRes.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cascading: load districts when region changes
  useEffect(() => {
    if (selRegion) {
      api.get('/v1/locations/districts/', { params: { region: selRegion.id } })
        .then(r => setDistricts(r.data.data ?? []))
        .catch(() => setDistricts([]));
    } else {
      setDistricts([]);
      setSelDistrict(null);
    }
  }, [selRegion]);

  // Cascading: load facilities when district changes
  useEffect(() => {
    if (selDistrict) {
      api.get('/v1/facilities/', { params: { district: selDistrict.id } })
        .then(r => {
          const list = (r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }));
          setFacilities(list);
        })
        .catch(() => setFacilities([]));
    } else {
      setFacilities([]);
      setSelFacility(null);
    }
  }, [selDistrict]);

  const getDestinationType = () => {
    if (selFacility) return 'facility';
    if (selDistrict) return 'district';
    if (selRegion) return 'regional';
    return 'national';
  };

  const getLocationLabel = () => {
    if (selFacility) return selFacility.name;
    if (selDistrict) return `${selDistrict.name} District`;
    if (selRegion) return `${selRegion.name} Region`;
    return 'National Store';
  };

  const handleSubmit = async () => {
    if (!selectedItem) { Alert.alert('Validation', 'Select an item'); return; }
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { Alert.alert('Validation', 'Enter a valid quantity'); return; }

    setSaving(true);
    try {
      await api.post('/v1/inventory/movements/create/', {
        item_id: selectedItem.id,
        movement_type: 'IN',
        quantity: qty,
        destination_type: getDestinationType(),
        destination_region_id: selRegion?.id || null,
        destination_district_id: selDistrict?.id || null,
        destination_facility_id: selFacility?.id || null,
        reference_number: referenceNumber,
        notes: notes || `Received ${qty} ${selectedItem.unit} at ${getLocationLabel()}`,
      });
      Alert.alert('Success', `Received ${qty} ${selectedItem.unit} of ${selectedItem.name} at ${getLocationLabel()}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to receive stock');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    i.code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.success, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive Stock</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Item Selection */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Select Item</Text>
        {selectedItem ? (
          <View style={[styles.selectedCard, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.selectedName, { color: colors.textPrimary }]}>{selectedItem.name}</Text>
              <Text style={[styles.selectedCode, { color: colors.textMuted }]}>{selectedItem.code} • {selectedItem.unit}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Ionicons name="close-circle" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.pickerWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.searchRow, { borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search items..."
                placeholderTextColor={colors.textMuted}
                value={itemSearch}
                onChangeText={setItemSearch}
              />
            </View>
            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
              {filteredItems.map(item => (
                <TouchableOpacity key={item.id} style={styles.pickItem} onPress={() => { setSelectedItem(item); setItemSearch(''); }}>
                  <Text style={[styles.pickText, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.pickSub, { color: colors.textMuted }]}>{item.code} • {item.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quantity */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>2. Quantity & Reference</Text>
        <View style={[styles.row, { gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Quantity *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Reference #</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="WB-2026-001"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Batch Info */}
        <View style={[styles.row, { gap: 12, marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Batch / Lot #</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={batchNumber}
              onChangeText={setBatchNumber}
              placeholder="LOT-2026-A1"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Expiry (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={expiryDate}
              onChangeText={setExpiryDate}
              placeholder="2027-12-31"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Destination Location */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>3. Receiving Location</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Select Region → District → Facility. Leave lower levels blank to receive at a higher level.
        </Text>

        <View style={[styles.locCard, { backgroundColor: colors.success + '08', borderColor: colors.success + '30' }]}>
          <Text style={[styles.locLabel, { color: colors.success }]}>Current Level: <Text style={{ fontWeight: '800' }}>{getDestinationType().charAt(0).toUpperCase() + getDestinationType().slice(1)}</Text></Text>
        </View>

        {/* Region */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>Region</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <TouchableOpacity
            style={[styles.chip, !selRegion && styles.chipActive, { borderColor: colors.success }]}
            onPress={() => { setSelRegion(null); setSelDistrict(null); setSelFacility(null); }}
          >
            <Text style={[styles.chipText, { color: !selRegion ? '#fff' : colors.textPrimary }]}>National</Text>
          </TouchableOpacity>
          {regions.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, selRegion?.id === r.id && styles.chipActive, { borderColor: colors.success }]}
              onPress={() => { setSelRegion(r); setSelDistrict(null); setSelFacility(null); }}
            >
              <Text style={[styles.chipText, { color: selRegion?.id === r.id ? '#fff' : colors.textPrimary }]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* District */}
        {selRegion && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>District</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, !selDistrict && styles.chipActive, { borderColor: colors.success }]}
                onPress={() => { setSelDistrict(null); setSelFacility(null); }}
              >
                <Text style={[styles.chipText, { color: !selDistrict ? '#fff' : colors.textPrimary }]}>Regional Level</Text>
              </TouchableOpacity>
              {districts.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chip, selDistrict?.id === d.id && styles.chipActive, { borderColor: colors.success }]}
                  onPress={() => { setSelDistrict(d); setSelFacility(null); }}
                >
                  <Text style={[styles.chipText, { color: selDistrict?.id === d.id ? '#fff' : colors.textPrimary }]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Facility */}
        {selDistrict && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>Facility</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, !selFacility && styles.chipActive, { borderColor: colors.success }]}
                onPress={() => setSelFacility(null)}
              >
                <Text style={[styles.chipText, { color: !selFacility ? '#fff' : colors.textPrimary }]}>District Level</Text>
              </TouchableOpacity>
              {facilities.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.chip, selFacility?.id === f.id && styles.chipActive, { borderColor: colors.success }]}
                  onPress={() => setSelFacility(f)}
                >
                  <Text style={[styles.chipText, { color: selFacility?.id === f.id ? '#fff' : colors.textPrimary }]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Notes */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>Notes</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, height: 70, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Additional information..."
          placeholderTextColor={colors.textMuted}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.success, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Receive Stock</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  hint: { fontSize: 12, marginBottom: 10, fontStyle: 'italic' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  row: { flexDirection: 'row' },
  selectedCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 4 },
  selectedName: { fontSize: 15, fontWeight: '700' },
  selectedCode: { fontSize: 12, marginTop: 2 },
  pickerWrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  pickItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  pickText: { fontSize: 14, fontWeight: '600' },
  pickSub: { fontSize: 11, marginTop: 2 },
  locCard: { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 4 },
  locLabel: { fontSize: 13, fontWeight: '600' },
  chipScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8, backgroundColor: 'transparent' },
  chipActive: { backgroundColor: '#16a34a' },
  chipText: { fontSize: 13, fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
