import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import type { OpcCaseDetail } from '../../lib/types';

const GENDER_OPTIONS = ['Male', 'Female'];
const ADMISSION_CRITERIA = ['MUAC <11.5cm', 'WFH/WFL <-3SD', 'Bilateral Oedema', 'MUAC 11.5-12.4cm', 'WFH/WFL <-2SD'];
const ADMISSION_TYPES = ['New Admission', 'Readmission', 'Transfer In'];

export default function CaseEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchedUpdatedAt, setFetchedUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState({
    child_name: '', child_gender: '', date_of_birth: '', age_months: '',
    caregiver_name: '', caregiver_phone: '', caregiver_relationship: '', address: '',
    weight_kg: '', height_cm: '', muac_cm: '', oedema: '',
    admission_criteria: '', admission_type: '', appetite_test: '',
    complications_notes: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/v1/cases/${id}/`);
        const c: OpcCaseDetail = res.data.data;
        setFetchedUpdatedAt(c.updated_at ?? null);
        setForm({
          child_name: c.child_name || '',
          child_gender: c.child_gender || '',
          date_of_birth: c.date_of_birth || '',
          age_months: c.age_months?.toString() || '',
          caregiver_name: c.caregiver_name || '',
          caregiver_phone: c.caregiver_phone || '',
          caregiver_relationship: c.caregiver_relationship || '',
          address: c.address || '',
          weight_kg: c.weight_kg?.toString() || '',
          height_cm: c.height_cm?.toString() || '',
          muac_cm: c.muac_cm?.toString() || '',
          oedema: c.oedema || '',
          admission_criteria: c.admission_criteria || '',
          admission_type: c.admission_type || '',
          appetite_test: c.appetite_test || '',
          complications_notes: c.complications_notes || '',
        });
      } catch {
        Alert.alert('Error', 'Failed to load case');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    if (!form.child_name.trim()) {
      Alert.alert('Validation', 'Child name is required');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/v1/cases/${id}/edit/`, {
        ...form,
        age_months: form.age_months ? parseInt(form.age_months) : undefined,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : undefined,
        muac_cm: form.muac_cm ? parseFloat(form.muac_cm) : undefined,
        ...(fetchedUpdatedAt ? { _updated_at: fetchedUpdatedAt } : {}),
      });
      Alert.alert('Success', 'Case updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update case');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Case</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Child Information */}
        <SectionHeader title="Child Information" icon="person-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="Child Name *" value={form.child_name} onChangeText={(v: string) => setForm({ ...form, child_name: v })} colors={colors} />
          <PickerField label="Gender" value={form.child_gender} options={GENDER_OPTIONS} onSelect={(v: string) => setForm({ ...form, child_gender: v })} colors={colors} />
          <FormField label="Date of Birth" value={form.date_of_birth} onChangeText={(v: string) => setForm({ ...form, date_of_birth: v })} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Age (months)" value={form.age_months} onChangeText={(v: string) => setForm({ ...form, age_months: v })} keyboardType="numeric" colors={colors} />
        </View>

        {/* Caregiver */}
        <SectionHeader title="Caregiver" icon="people-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="Caregiver Name" value={form.caregiver_name} onChangeText={(v: string) => setForm({ ...form, caregiver_name: v })} colors={colors} />
          <FormField label="Phone" value={form.caregiver_phone} onChangeText={(v: string) => setForm({ ...form, caregiver_phone: v })} keyboardType="phone-pad" colors={colors} />
          <FormField label="Relationship" value={form.caregiver_relationship} onChangeText={(v: string) => setForm({ ...form, caregiver_relationship: v })} colors={colors} />
          <FormField label="Address" value={form.address} onChangeText={(v: string) => setForm({ ...form, address: v })} multiline colors={colors} />
        </View>

        {/* Anthropometry */}
        <SectionHeader title="Anthropometry" icon="body-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="Weight (kg)" value={form.weight_kg} onChangeText={(v: string) => setForm({ ...form, weight_kg: v })} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Height (cm)" value={form.height_cm} onChangeText={(v: string) => setForm({ ...form, height_cm: v })} keyboardType="decimal-pad" colors={colors} />
          <FormField label="MUAC (cm)" value={form.muac_cm} onChangeText={(v: string) => setForm({ ...form, muac_cm: v })} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Oedema" value={form.oedema} onChangeText={(v: string) => setForm({ ...form, oedema: v })} colors={colors} />
        </View>

        {/* Admission */}
        <SectionHeader title="Admission Details" icon="clipboard-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PickerField label="Admission Criteria" value={form.admission_criteria} options={ADMISSION_CRITERIA} onSelect={(v: string) => setForm({ ...form, admission_criteria: v })} colors={colors} />
          <PickerField label="Admission Type" value={form.admission_type} options={ADMISSION_TYPES} onSelect={(v: string) => setForm({ ...form, admission_type: v })} colors={colors} />
          <FormField label="Appetite Test" value={form.appetite_test} onChangeText={(v: string) => setForm({ ...form, appetite_test: v })} colors={colors} />
          <FormField label="Complications Notes" value={form.complications_notes} onChangeText={(v: string) => setForm({ ...form, complications_notes: v })} multiline colors={colors} />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ title, icon, colors }: { title: string; icon: any; colors: any }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, colors }: any) {
  return (
    <View style={[styles.fieldWrap, { borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function PickerField({ label, value, options, onSelect, colors }: { label: string; value: string; options: string[]; onSelect: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.fieldWrap, { borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg }]} onPress={() => setOpen(!open)}>
        <Text style={[styles.pickerBtnText, { color: value ? colors.textPrimary : colors.textMuted }]}>{value || 'Select...'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {options.map((opt) => (
            <TouchableOpacity key={opt} style={[styles.optionItem, value === opt && { backgroundColor: colors.primary + '15' }]} onPress={() => { onSelect(opt); setOpen(false); }}>
              <Text style={[styles.optionText, { color: value === opt ? colors.primary : colors.textPrimary }]}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  card: { marginHorizontal: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldWrap: { marginBottom: 16, borderBottomWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { fontSize: 15, fontWeight: '500' },
  optionsList: { borderRadius: 10, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  optionText: { fontSize: 14, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 14, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
