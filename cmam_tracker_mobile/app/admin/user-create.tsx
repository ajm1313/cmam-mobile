import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrReject } from '../../lib/offlineQueue';

interface RoleOption { id: number; name: string; display_name: string; level: number }
interface LocationOption { id: number; name: string; code: string }

export default function UserCreateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [regions, setRegions] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [subDistricts, setSubDistricts] = useState<LocationOption[]>([]);
  const [facilities, setFacilities] = useState<{ id: number; name: string }[]>([]);

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    role_id: '', region_id: '', district_id: '', sub_district_id: '', facility_id: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [rolesRes, regionsRes, facilitiesRes] = await Promise.all([
          api.get('/v1/roles/'),
          api.get('/v1/locations/regions/'),
          api.get('/v1/facilities/'),
        ]);
        setRoles(rolesRes.data.data || []);
        setRegions(regionsRes.data.data || []);
        setFacilities((facilitiesRes.data.data || []).map((f: any) => ({ id: f.id, name: f.name })));
      } catch (e: any) {
        console.warn('[UserCreate] Failed to load form data:', e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (form.region_id) {
      api.get('/v1/locations/districts/', { params: { region_id: form.region_id } })
        .then((res) => setDistricts(res.data.data || []))
        .catch(() => {});
    } else {
      setDistricts([]);
    }
    setForm(prev => ({ ...prev, district_id: '', sub_district_id: '' }));
  }, [form.region_id]);

  useEffect(() => {
    if (form.district_id) {
      api.get('/v1/locations/sub-districts/', { params: { district_id: form.district_id } })
        .then((res) => setSubDistricts(res.data.data || []))
        .catch(() => {});
    } else {
      setSubDistricts([]);
    }
    setForm(prev => ({ ...prev, sub_district_id: '' }));
  }, [form.district_id]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert('Validation', 'Name, email, and password are required');
      return;
    }
    setSaving(true);
    try {
      await sendOrReject('/v1/users/create/', 'post', {
        name: form.name, email: form.email, password: form.password, phone: form.phone,
        role_id: form.role_id ? parseInt(form.role_id) : undefined,
        region_id: form.region_id ? parseInt(form.region_id) : undefined,
        district_id: form.district_id ? parseInt(form.district_id) : undefined,
        sub_district_id: form.sub_district_id ? parseInt(form.sub_district_id) : undefined,
        facility_id: form.facility_id ? parseInt(form.facility_id) : undefined,
      }, 'User Creation');
      Alert.alert('Success', 'User created', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      if (e.message?.includes('internet connection')) return;
      Alert.alert('Error', e.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create User</Text>
          <View style={{ width: 40 }} />
        </View>

        <SectionHeader title="Account" icon="person-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Full Name *" value={form.name} onChangeText={(v: string) => update('name', v)} colors={colors} />
          <Field label="Email *" value={form.email} onChangeText={(v: string) => update('email', v)} keyboardType="email-address" autoCapitalize="none" colors={colors} />
          <Field label="Password *" value={form.password} onChangeText={(v: string) => update('password', v)} secureTextEntry colors={colors} />
          <Field label="Phone" value={form.phone} onChangeText={(v: string) => update('phone', v)} keyboardType="phone-pad" colors={colors} />
        </View>

        <SectionHeader title="Role & Location" icon="shield-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <ListPickerField label="Role" value={form.role_id} options={roles.map((r) => ({ key: String(r.id), label: r.display_name || r.name }))} onSelect={(v: string) => update('role_id', v)} colors={colors} />
          <ListPickerField label="Region" value={form.region_id} options={regions.map((r) => ({ key: String(r.id), label: r.name }))} onSelect={(v: string) => update('region_id', v)} colors={colors} />
          {districts.length > 0 && (
            <ListPickerField label="District" value={form.district_id} options={districts.map((d) => ({ key: String(d.id), label: d.name }))} onSelect={(v: string) => update('district_id', v)} colors={colors} />
          )}
          {subDistricts.length > 0 && (
            <ListPickerField label="Sub-District" value={form.sub_district_id} options={subDistricts.map((s) => ({ key: String(s.id), label: s.name }))} onSelect={(v: string) => update('sub_district_id', v)} colors={colors} />
          )}
          <ListPickerField label="Facility" value={form.facility_id} options={facilities.map((f) => ({ key: String(f.id), label: f.name }))} onSelect={(v: string) => update('facility_id', v)} colors={colors} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Creating...' : 'Create User'}</Text>
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

function Field({ label, value, onChangeText, keyboardType, secureTextEntry, autoCapitalize, colors }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }]}
        value={value} onChangeText={onChangeText} placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function ListPickerField({ label, value, options, onSelect, colors }: { label: string; value: string; options: { key: string; label: string }[]; onSelect: (v: string) => void; colors: any }) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg }]} onPress={() => setVisible(true)}>
        <Text style={[styles.pickerText, { color: selected ? colors.textPrimary : colors.textMuted }]}>{selected?.label || `Select ${label}...`}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHdr}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select {label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={() => { onSelect(''); setVisible(false); }}>
                <Text style={[styles.optionText, { color: colors.primary }]}>— Clear Selection —</Text>
              </TouchableOpacity>
              {options.map((opt) => (
                <TouchableOpacity key={opt.key} style={[styles.optionItem, { borderBottomWidth: 1, borderBottomColor: colors.border }, value === opt.key && { backgroundColor: colors.primary + '15' }]} onPress={() => { onSelect(opt.key); setVisible(false); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={value === opt.key ? 'radio-button-on' : 'radio-button-off'} size={18} color={value === opt.key ? colors.primary : colors.textMuted} />
                    <Text style={[styles.optionText, { color: value === opt.key ? colors.primary : colors.textPrimary }]}>{opt.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, maxHeight: '70%' },
  modalHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  optionItem: { paddingHorizontal: 16, paddingVertical: 14 },
  optionText: { fontSize: 15, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
