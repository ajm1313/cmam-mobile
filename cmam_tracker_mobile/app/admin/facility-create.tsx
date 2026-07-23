import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import * as Location from 'expo-location';

const FACILITY_TYPES = ['OPC', 'IPC'];

const OPC_DAY_OPTIONS = [
  { key: '0', label: 'Monday' },
  { key: '1', label: 'Tuesday' },
  { key: '2', label: 'Wednesday' },
  { key: '3', label: 'Thursday' },
  { key: '4', label: 'Friday' },
  { key: '5', label: 'Saturday' },
  { key: '6', label: 'Sunday' },
];

interface LocationOption { id: number; name: string }

export default function FacilityCreateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [regions, setRegions] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [subDistricts, setSubDistricts] = useState<LocationOption[]>([]);

  const [form, setForm] = useState({
    name: '', code: '', facility_type: '', district_id: '', sub_district_id: '',
    contact_person: '', contact_phone: '', contact_email: '',
    address: '', capacity: '', region_id: '', opc_day: '',
    population: '', sam_prevalence: '', latitude: '', longitude: '',
  });

  useEffect(() => {
    api.get('/v1/locations/regions/').then((res) => setRegions(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.region_id) {
      api.get('/v1/locations/districts/', { params: { region_id: form.region_id } })
        .then((res) => setDistricts(res.data.data || [])).catch(() => {});
    } else { setDistricts([]); }
  }, [form.region_id]);

  useEffect(() => {
    if (form.district_id) {
      api.get('/v1/locations/sub-districts/', { params: { district_id: form.district_id } })
        .then((res) => setSubDistricts(res.data.data || [])).catch(() => {});
    } else { setSubDistricts([]); }
  }, [form.district_id]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.facility_type) {
      Alert.alert('Validation', 'Name and facility type are required');
      return;
    }
    if (!form.code.trim()) {
      Alert.alert('Validation', 'Facility code is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/v1/facilities/create/', {
        name: form.name, code: form.code.toUpperCase(), facility_type: form.facility_type,
        district_id: form.district_id ? parseInt(form.district_id) : undefined,
        sub_district_id: form.sub_district_id ? parseInt(form.sub_district_id) : undefined,
        contact_person: form.contact_person, contact_phone: form.contact_phone,
        contact_email: form.contact_email, address: form.address,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        opc_day: form.facility_type === 'OPC' && form.opc_day !== '' ? parseInt(form.opc_day) : null,
        population: form.population ? parseInt(form.population) : undefined,
        sam_prevalence: form.sam_prevalence ? parseFloat(form.sam_prevalence) : undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      });
      Alert.alert('Success', 'Facility created', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create facility');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const getLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to get coordinates.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      update('latitude', pos.coords.latitude.toFixed(6));
      update('longitude', pos.coords.longitude.toFixed(6));
      Alert.alert('Location Captured', `Lat: ${pos.coords.latitude.toFixed(6)}\nLng: ${pos.coords.longitude.toFixed(6)}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to get location. Check GPS/permissions.');
    } finally {
      setGettingLocation(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Facility</Text>
          <View style={{ width: 40 }} />
        </View>

        <SectionHeader title="Basic Info" icon="business-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Facility Name *" value={form.name} onChangeText={(v: string) => update('name', v)} colors={colors} />
          <Field label="Facility Code *" value={form.code} onChangeText={(v: string) => update('code', v.toUpperCase())} autoCapitalize="characters" colors={colors} hint="Unique identifier code (e.g. OPC-001)" />
          <PickerField label="Facility Type *" value={form.facility_type} options={FACILITY_TYPES.map((t) => ({ key: t, label: `${t} (${t === 'OPC' ? 'Outpatient Care' : 'Inpatient Care'})` }))} onSelect={(v: string) => { update('facility_type', v); if (v !== 'OPC') update('opc_day', ''); }} colors={colors} />
          {form.facility_type === 'OPC' && (
            <PickerField label="OPC Visit Day *" value={form.opc_day} options={OPC_DAY_OPTIONS} onSelect={(v: string) => update('opc_day', v)} colors={colors} hint="Weekly day when SAM & MAM OPC visits are scheduled" />
          )}
          <Field label="Capacity" value={form.capacity} onChangeText={(v: string) => update('capacity', v)} keyboardType="numeric" colors={colors} />
          <Field label="Catchment Population" value={form.population} onChangeText={(v: string) => update('population', v)} keyboardType="numeric" colors={colors} hint="Total population served by this facility" />
          <Field label="SAM Prevalence (%)" value={form.sam_prevalence} onChangeText={(v: string) => update('sam_prevalence', v)} keyboardType="decimal-pad" colors={colors} hint="Regional SAM prevalence rate from nutrition surveys" />
          {form.population && form.sam_prevalence && parseFloat(form.population) > 0 && parseFloat(form.sam_prevalence) > 0 && (() => {
            const pop = parseFloat(form.population);
            const prev = parseFloat(form.sam_prevalence);
            const expected = Math.ceil(pop * 0.17 * (prev / 100) * 2.6);
            const target = Math.ceil(expected * 0.80);
            return (
              <View style={{ marginTop: 4, padding: 12, backgroundColor: colors.inputBg, borderRadius: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>SAM Burden (auto-calculated)</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>Expected: {expected.toLocaleString()} cases/year</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#d97706' }}>Target (80%): {target.toLocaleString()} cases/year</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>Population × 17% (U5) × Prevalence × 2.6 (incidence)</Text>
              </View>
            );
          })()}
          <Field label="Latitude" value={form.latitude} onChangeText={(v: string) => update('latitude', v)} keyboardType="decimal-pad" colors={colors} placeholder="e.g. 5.6037" />
          <Field label="Longitude" value={form.longitude} onChangeText={(v: string) => update('longitude', v)} keyboardType="decimal-pad" colors={colors} placeholder="e.g. -0.1870" />
          <TouchableOpacity onPress={getLocation} disabled={gettingLocation} style={[styles.locBtn, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '0A' }]} activeOpacity={0.7}>
            {gettingLocation ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="locate" size={18} color={colors.primary} />
            )}
            <Text style={[styles.locBtnText, { color: colors.primary }]}>{gettingLocation ? 'Getting location...' : 'Use My Current Location'}</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="Location" icon="location-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PickerField label="Region" value={form.region_id} options={regions.map((r) => ({ key: String(r.id), label: r.name }))} onSelect={(v: string) => { update('region_id', v); update('district_id', ''); update('sub_district_id', ''); }} colors={colors} />
          {districts.length > 0 && (
            <PickerField label="District" value={form.district_id} options={districts.map((d) => ({ key: String(d.id), label: d.name }))} onSelect={(v: string) => { update('district_id', v); update('sub_district_id', ''); }} colors={colors} />
          )}
          {subDistricts.length > 0 && (
            <PickerField label="Sub-District" value={form.sub_district_id} options={subDistricts.map((s) => ({ key: String(s.id), label: s.name }))} onSelect={(v: string) => update('sub_district_id', v)} colors={colors} />
          )}
          <Field label="Address" value={form.address} onChangeText={(v: string) => update('address', v)} multiline colors={colors} />
        </View>

        <SectionHeader title="Contact" icon="call-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Contact Person" value={form.contact_person} onChangeText={(v: string) => update('contact_person', v)} colors={colors} />
          <Field label="Contact Phone" value={form.contact_phone} onChangeText={(v: string) => update('contact_phone', v)} keyboardType="phone-pad" colors={colors} />
          <Field label="Contact Email" value={form.contact_email} onChangeText={(v: string) => update('contact_email', v)} keyboardType="email-address" autoCapitalize="none" colors={colors} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Creating...' : 'Create Facility'}</Text>
        </TouchableOpacity>
      </ScrollView>
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

function Field({ label, value, onChangeText, keyboardType, autoCapitalize, multiline, colors, hint, placeholder }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType} autoCapitalize={autoCapitalize} multiline={multiline}
      />
      {hint && <Text style={[styles.hintText, { color: colors.textMuted }]}>{hint}</Text>}
    </View>
  );
}

function PickerField({ label, value, options, onSelect, colors, hint }: { label: string; value: string; options: { key: string; label: string }[]; onSelect: (v: string) => void; colors: any; hint?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg }]} onPress={() => setOpen(!open)}>
        <Text style={[styles.pickerText, { color: selected ? colors.textPrimary : colors.textMuted }]}>{selected?.label || 'Select...'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <ScrollView style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
          {options.map((opt) => (
            <TouchableOpacity key={opt.key} style={[styles.optionItem, value === opt.key && { backgroundColor: colors.primary + '15' }]} onPress={() => { onSelect(opt.key); setOpen(false); }}>
              <Text style={[styles.optionText, { color: value === opt.key ? colors.primary : colors.textPrimary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {hint && <Text style={[styles.hintText, { color: colors.textMuted }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  card: { marginHorizontal: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15, fontWeight: '500' },
  optionsList: { borderRadius: 10, borderWidth: 1, marginTop: 4, maxHeight: 200 },
  optionItem: { paddingHorizontal: 14, paddingVertical: 11 },
  optionText: { fontSize: 14, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hintText: { fontSize: 11, marginTop: 4 },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  locBtnText: { fontSize: 14, fontWeight: '600' },
});
