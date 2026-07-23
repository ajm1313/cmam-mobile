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
import { sendOrQueue } from '../../lib/offlineQueue';

interface InventoryItem { id: number; name: string; code: string; unit: string; }
interface Loc { id: number; name: string; }

export default function DistributeStockScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [regions, setRegions] = useState<Loc[]>([]);

  // Source cascading
  const [srcDistricts, setSrcDistricts] = useState<Loc[]>([]);
  const [srcFacilities, setSrcFacilities] = useState<Loc[]>([]);
  const [srcRegion, setSrcRegion] = useState<Loc | null>(null);
  const [srcDistrict, setSrcDistrict] = useState<Loc | null>(null);
  const [srcFacility, setSrcFacility] = useState<Loc | null>(null);

  // Destination cascading
  const [destDistricts, setDestDistricts] = useState<Loc[]>([]);
  const [destFacilities, setDestFacilities] = useState<Loc[]>([]);
  const [destRegion, setDestRegion] = useState<Loc | null>(null);
  const [destDistrict, setDestDistrict] = useState<Loc | null>(null);
  const [destFacility, setDestFacility] = useState<Loc | null>(null);

  // Form
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
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

  // Source cascading
  useEffect(() => {
    if (srcRegion) {
      api.get('/v1/locations/districts/', { params: { region_id: srcRegion.id } })
        .then(r => setSrcDistricts(r.data.data ?? []))
        .catch(() => setSrcDistricts([]));
    } else { setSrcDistricts([]); setSrcDistrict(null); }
  }, [srcRegion]);

  useEffect(() => {
    if (srcDistrict) {
      api.get('/v1/facilities/', { params: { district: srcDistrict.id } })
        .then(r => setSrcFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setSrcFacilities([]));
    } else { setSrcFacilities([]); setSrcFacility(null); }
  }, [srcDistrict]);

  // Destination cascading
  useEffect(() => {
    if (destRegion) {
      api.get('/v1/locations/districts/', { params: { region_id: destRegion.id } })
        .then(r => setDestDistricts(r.data.data ?? []))
        .catch(() => setDestDistricts([]));
    } else { setDestDistricts([]); setDestDistrict(null); }
  }, [destRegion]);

  useEffect(() => {
    if (destDistrict) {
      api.get('/v1/facilities/', { params: { district: destDistrict.id } })
        .then(r => setDestFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setDestFacilities([]));
    } else { setDestFacilities([]); setDestFacility(null); }
  }, [destDistrict]);

  const getLocType = (region: Loc | null, district: Loc | null, facility: Loc | null) => {
    if (facility) return 'facility';
    if (district) return 'district';
    if (region) return 'regional';
    return 'national';
  };

  const getLocLabel = (region: Loc | null, district: Loc | null, facility: Loc | null) => {
    if (facility) return facility.name;
    if (district) return `${district.name} District`;
    if (region) return `${region.name} Region`;
    return 'National';
  };

  const handleSubmit = async () => {
    if (!selectedItem) { Alert.alert('Validation', 'Select an item'); return; }
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { Alert.alert('Validation', 'Enter a valid quantity'); return; }

    const srcType = getLocType(srcRegion, srcDistrict, srcFacility);
    const destType = getLocType(destRegion, destDistrict, destFacility);
    const srcLabel = getLocLabel(srcRegion, srcDistrict, srcFacility);
    const destLabel = getLocLabel(destRegion, destDistrict, destFacility);

    // Same location check
    if (srcType === destType && srcRegion?.id === destRegion?.id &&
        srcDistrict?.id === destDistrict?.id && srcFacility?.id === destFacility?.id) {
      Alert.alert('Validation', 'Source and destination cannot be the same location');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_id: selectedItem.id,
        movement_type: 'TRANSFER',
        quantity: qty,
        source_type: srcType,
        source_region_id: srcRegion?.id || null,
        source_district_id: srcDistrict?.id || null,
        source_facility_id: srcFacility?.id || null,
        destination_type: destType,
        destination_region_id: destRegion?.id || null,
        destination_district_id: destDistrict?.id || null,
        destination_facility_id: destFacility?.id || null,
        reference_number: referenceNumber,
        notes: notes || `Transfer ${qty} ${selectedItem.unit} from ${srcLabel} to ${destLabel}`,
      };
      const res = await sendOrQueue('/v1/inventory/movements/create/', 'post', payload, 'Stock Transfer');
      if (res) {
        Alert.alert('Success', `Transferred ${qty} ${selectedItem.unit} of ${selectedItem.name}\n${srcLabel} → ${destLabel}`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Saved Offline', 'Stock transfer saved and will sync when online.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to transfer stock');
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
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transfer / Distribute</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Transfer Flow Guide */}
        <View style={[styles.guideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>Supported Transfer Flows</Text>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#2563eb' }]} />
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>Down: National → Region → District → Facility</Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#16a34a' }]} />
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>Lateral: Region ↔ Region, District ↔ District, Facility ↔ Facility</Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.guideDot, { backgroundColor: '#d97706' }]} />
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>Return Up: Facility → District → Region → National</Text>
          </View>
        </View>

        {/* Item Selection */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Select Item</Text>
        {selectedItem ? (
          <View style={[styles.selectedCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
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

        {/* Quantity & Reference */}
        <View style={[styles.row, { gap: 12, marginTop: 16 }]}>
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

        {/* SOURCE */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>2. FROM (Source)</Text>
        <View style={[styles.locSection, { backgroundColor: '#dc262608', borderColor: '#dc262630' }]}>
          <View style={styles.locHeader}>
            <Ionicons name="arrow-up-circle" size={18} color="#dc2626" />
            <Text style={[styles.locHeaderText, { color: '#dc2626' }]}>Level: {getLocType(srcRegion, srcDistrict, srcFacility).charAt(0).toUpperCase() + getLocType(srcRegion, srcDistrict, srcFacility).slice(1)}</Text>
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>Region</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <TouchableOpacity style={[styles.chip, !srcRegion && styles.chipActiveSrc]} onPress={() => { setSrcRegion(null); setSrcDistrict(null); setSrcFacility(null); }}>
              <Text style={[styles.chipText, { color: !srcRegion ? '#fff' : colors.textPrimary }]}>National</Text>
            </TouchableOpacity>
            {regions.map(r => (
              <TouchableOpacity key={r.id} style={[styles.chip, srcRegion?.id === r.id && styles.chipActiveSrc]} onPress={() => { setSrcRegion(r); setSrcDistrict(null); setSrcFacility(null); }}>
                <Text style={[styles.chipText, { color: srcRegion?.id === r.id ? '#fff' : colors.textPrimary }]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {srcRegion && (
            <>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>District</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, !srcDistrict && styles.chipActiveSrc]} onPress={() => { setSrcDistrict(null); setSrcFacility(null); }}>
                  <Text style={[styles.chipText, { color: !srcDistrict ? '#fff' : colors.textPrimary }]}>Regional</Text>
                </TouchableOpacity>
                {srcDistricts.map(d => (
                  <TouchableOpacity key={d.id} style={[styles.chip, srcDistrict?.id === d.id && styles.chipActiveSrc]} onPress={() => { setSrcDistrict(d); setSrcFacility(null); }}>
                    <Text style={[styles.chipText, { color: srcDistrict?.id === d.id ? '#fff' : colors.textPrimary }]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {srcDistrict && (
            <>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>Facility</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, !srcFacility && styles.chipActiveSrc]} onPress={() => setSrcFacility(null)}>
                  <Text style={[styles.chipText, { color: !srcFacility ? '#fff' : colors.textPrimary }]}>District</Text>
                </TouchableOpacity>
                {srcFacilities.map(f => (
                  <TouchableOpacity key={f.id} style={[styles.chip, srcFacility?.id === f.id && styles.chipActiveSrc]} onPress={() => setSrcFacility(f)}>
                    <Text style={[styles.chipText, { color: srcFacility?.id === f.id ? '#fff' : colors.textPrimary }]}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>

        {/* DESTINATION */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>3. TO (Destination)</Text>
        <View style={[styles.locSection, { backgroundColor: '#16a34a08', borderColor: '#16a34a30' }]}>
          <View style={styles.locHeader}>
            <Ionicons name="arrow-down-circle" size={18} color="#16a34a" />
            <Text style={[styles.locHeaderText, { color: '#16a34a' }]}>Level: {getLocType(destRegion, destDistrict, destFacility).charAt(0).toUpperCase() + getLocType(destRegion, destDistrict, destFacility).slice(1)}</Text>
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>Region</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <TouchableOpacity style={[styles.chip, !destRegion && styles.chipActiveDest]} onPress={() => { setDestRegion(null); setDestDistrict(null); setDestFacility(null); }}>
              <Text style={[styles.chipText, { color: !destRegion ? '#fff' : colors.textPrimary }]}>National</Text>
            </TouchableOpacity>
            {regions.map(r => (
              <TouchableOpacity key={r.id} style={[styles.chip, destRegion?.id === r.id && styles.chipActiveDest]} onPress={() => { setDestRegion(r); setDestDistrict(null); setDestFacility(null); }}>
                <Text style={[styles.chipText, { color: destRegion?.id === r.id ? '#fff' : colors.textPrimary }]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {destRegion && (
            <>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>District</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, !destDistrict && styles.chipActiveDest]} onPress={() => { setDestDistrict(null); setDestFacility(null); }}>
                  <Text style={[styles.chipText, { color: !destDistrict ? '#fff' : colors.textPrimary }]}>Regional</Text>
                </TouchableOpacity>
                {destDistricts.map(d => (
                  <TouchableOpacity key={d.id} style={[styles.chip, destDistrict?.id === d.id && styles.chipActiveDest]} onPress={() => { setDestDistrict(d); setDestFacility(null); }}>
                    <Text style={[styles.chipText, { color: destDistrict?.id === d.id ? '#fff' : colors.textPrimary }]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {destDistrict && (
            <>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>Facility</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, !destFacility && styles.chipActiveDest]} onPress={() => setDestFacility(null)}>
                  <Text style={[styles.chipText, { color: !destFacility ? '#fff' : colors.textPrimary }]}>District</Text>
                </TouchableOpacity>
                {destFacilities.map(f => (
                  <TouchableOpacity key={f.id} style={[styles.chip, destFacility?.id === f.id && styles.chipActiveDest]} onPress={() => setDestFacility(f)}>
                    <Text style={[styles.chipText, { color: destFacility?.id === f.id ? '#fff' : colors.textPrimary }]}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>

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
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Transfer Stock</Text>
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
  guideCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  guideTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  guideDot: { width: 8, height: 8, borderRadius: 4 },
  guideText: { fontSize: 12, flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
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
  locSection: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 4 },
  locHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  locHeaderText: { fontSize: 13, fontWeight: '700' },
  chipScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', marginRight: 8, backgroundColor: 'transparent' },
  chipActiveSrc: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipActiveDest: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 13, fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
