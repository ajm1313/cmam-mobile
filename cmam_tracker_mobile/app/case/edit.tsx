import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
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
  const [form, setForm] = useState<Record<string, string>>({
    child_name: '', child_gender: '', date_of_birth: '', age_months: '',
    caregiver_name: '', caregiver_phone: '', caregiver_relationship: '', address: '',
    weight_kg: '', height_cm: '', muac_cm: '', oedema: '',
    admission_criteria: '', admission_type: '', appetite_test: '',
    complications_notes: '',
    z_score_wfh: '', z_score_wfa: '', z_score_hfa: '',
    // Medical History
    diarrhoea: '', stool_frequency: '', vomiting: '', cough: '', passing_urine: '',
    oedema_duration_days: '', breastfeeding_status: '', breastfeeding_prospect: '',
    immunization_status: '', g6pd_status: '', additional_medical_history: '',
    // Physical Examination
    respiratory_rate: '', temperature_celsius: '', chest_indrawing: '',
    eyes_condition: '', conjunctiva: '', ears_condition: '', mouth_condition: '',
    lymph_nodes: '', hands_feet: '', skin_changes: '',
    disability: '', disability_details: '', physical_exam_notes: '',
    // Medicines
    amoxicillin_date: '', amoxicillin_dosage: '',
    vitamin_a_date: '', vitamin_a_dosage: '',
    folic_acid_date: '', folic_acid_dosage: '',
    deworming_date: '', deworming_dosage: '',
    measles_vaccine_date: '', measles_vaccine_dosage: '',
    malaria_test_date: '', malaria_test_result: '',
    antimalarial_date: '', antimalarial_dosage: '',
    // RUTF
    rutf_sachets_given: '', rutf_ration_per_day: '', next_visit_date: '',
    // Other drugs
    other_drug_1: '', other_drug_1_date: '', other_drug_1_dosage: '',
    other_drug_2: '', other_drug_2_date: '', other_drug_2_dosage: '',
    other_drug_3: '', other_drug_3_date: '', other_drug_3_dosage: '',
    additional_notes: '',
  });
  const s = useCallback((k: string, v: string) => setForm((p) => ({ ...p, [k]: v })), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/v1/cases/${id}/`);
        const c: OpcCaseDetail = res.data.data;
        setFetchedUpdatedAt(c.updated_at ?? null);
        const fields: (keyof OpcCaseDetail)[] = [
          'child_name','child_gender','date_of_birth','caregiver_name','caregiver_phone',
          'caregiver_relationship','address','oedema','admission_criteria','admission_type',
          'appetite_test','complications_notes','z_score_wfh','z_score_wfa','z_score_hfa',
          'diarrhoea','stool_frequency','vomiting','cough','passing_urine','oedema_duration_days',
          'breastfeeding_status','breastfeeding_prospect','immunization_status','g6pd_status',
          'additional_medical_history','respiratory_rate','temperature_celsius','chest_indrawing',
          'eyes_condition','conjunctiva','ears_condition','mouth_condition','lymph_nodes',
          'hands_feet','skin_changes','disability','disability_details','physical_exam_notes',
          'amoxicillin_date','amoxicillin_dosage','vitamin_a_date','vitamin_a_dosage',
          'folic_acid_date','folic_acid_dosage','deworming_date','deworming_dosage',
          'measles_vaccine_date','measles_vaccine_dosage','malaria_test_date','malaria_test_result',
          'antimalarial_date','antimalarial_dosage','rutf_sachets_given','rutf_ration_per_day',
          'next_visit_date','other_drug_1','other_drug_1_date','other_drug_1_dosage',
          'other_drug_2','other_drug_2_date','other_drug_2_dosage',
          'other_drug_3','other_drug_3_date','other_drug_3_dosage','additional_notes',
        ];
        const next: Record<string, string> = {};
        for (const k of fields) {
          next[k] = c[k] != null ? String(c[k]) : '';
        }
        next.age_months = c.age_months?.toString() || '';
        next.weight_kg = c.weight_kg?.toString() || '';
        next.height_cm = c.height_cm?.toString() || '';
        next.muac_cm = c.muac_cm?.toString() || '';
        setForm(next);
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
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== '' && v != null) {
          if (['age_months','rutf_sachets_given'].includes(k)) payload[k] = parseInt(v);
          else if (['weight_kg','height_cm','muac_cm','rutf_ration_per_day'].includes(k)) payload[k] = parseFloat(v);
          else payload[k] = v;
        }
      }
      if (fetchedUpdatedAt) payload._updated_at = fetchedUpdatedAt;
      const res = await sendOrQueue(`/v1/cases/${id}/edit/`, 'put', payload, 'Case Edit');
      if (res) {
        Alert.alert('Success', 'Case updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Saved Offline', 'Case edit saved and will sync when online.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
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
          <FormField label="Weight (kg)" value={form.weight_kg} onChangeText={(v: string) => s('weight_kg', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Height (cm)" value={form.height_cm} onChangeText={(v: string) => s('height_cm', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="MUAC (cm)" value={form.muac_cm} onChangeText={(v: string) => s('muac_cm', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Oedema" value={form.oedema} onChangeText={(v: string) => s('oedema', v)} colors={colors} />
          <FormField label="Z-Score WFH" value={form.z_score_wfh} onChangeText={(v: string) => s('z_score_wfh', v)} colors={colors} />
          <FormField label="Z-Score WFA" value={form.z_score_wfa} onChangeText={(v: string) => s('z_score_wfa', v)} colors={colors} />
          <FormField label="Z-Score HFA" value={form.z_score_hfa} onChangeText={(v: string) => s('z_score_hfa', v)} colors={colors} />
        </View>

        {/* Admission */}
        <SectionHeader title="Admission Details" icon="clipboard-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PickerField label="Admission Criteria" value={form.admission_criteria} options={ADMISSION_CRITERIA} onSelect={(v: string) => s('admission_criteria', v)} colors={colors} />
          <PickerField label="Admission Type" value={form.admission_type} options={ADMISSION_TYPES} onSelect={(v: string) => s('admission_type', v)} colors={colors} />
          <FormField label="Appetite Test" value={form.appetite_test} onChangeText={(v: string) => s('appetite_test', v)} colors={colors} />
          <FormField label="Complications Notes" value={form.complications_notes} onChangeText={(v: string) => s('complications_notes', v)} multiline colors={colors} />
        </View>

        {/* Medical History */}
        <SectionHeader title="Medical History" icon="medkit-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="Diarrhoea" value={form.diarrhoea} onChangeText={(v: string) => s('diarrhoea', v)} colors={colors} />
          <FormField label="Stool Frequency" value={form.stool_frequency} onChangeText={(v: string) => s('stool_frequency', v)} colors={colors} />
          <FormField label="Vomiting" value={form.vomiting} onChangeText={(v: string) => s('vomiting', v)} colors={colors} />
          <FormField label="Cough" value={form.cough} onChangeText={(v: string) => s('cough', v)} colors={colors} />
          <FormField label="Passing Urine" value={form.passing_urine} onChangeText={(v: string) => s('passing_urine', v)} colors={colors} />
          <FormField label="Oedema Duration (days)" value={form.oedema_duration_days} onChangeText={(v: string) => s('oedema_duration_days', v)} keyboardType="numeric" colors={colors} />
          <FormField label="Breastfeeding Status" value={form.breastfeeding_status} onChangeText={(v: string) => s('breastfeeding_status', v)} colors={colors} />
          <FormField label="Breastfeeding Prospect" value={form.breastfeeding_prospect} onChangeText={(v: string) => s('breastfeeding_prospect', v)} colors={colors} />
          <FormField label="Immunization Status" value={form.immunization_status} onChangeText={(v: string) => s('immunization_status', v)} colors={colors} />
          <FormField label="G6PD Status" value={form.g6pd_status} onChangeText={(v: string) => s('g6pd_status', v)} colors={colors} />
          <FormField label="Additional Medical History" value={form.additional_medical_history} onChangeText={(v: string) => s('additional_medical_history', v)} multiline colors={colors} />
        </View>

        {/* Physical Examination */}
        <SectionHeader title="Physical Examination" icon="fitness-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="Respiratory Rate" value={form.respiratory_rate} onChangeText={(v: string) => s('respiratory_rate', v)} keyboardType="numeric" colors={colors} />
          <FormField label="Temperature (°C)" value={form.temperature_celsius} onChangeText={(v: string) => s('temperature_celsius', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Chest Indrawing" value={form.chest_indrawing} onChangeText={(v: string) => s('chest_indrawing', v)} colors={colors} />
          <FormField label="Eyes Condition" value={form.eyes_condition} onChangeText={(v: string) => s('eyes_condition', v)} colors={colors} />
          <FormField label="Conjunctiva" value={form.conjunctiva} onChangeText={(v: string) => s('conjunctiva', v)} colors={colors} />
          <FormField label="Ears Condition" value={form.ears_condition} onChangeText={(v: string) => s('ears_condition', v)} colors={colors} />
          <FormField label="Mouth Condition" value={form.mouth_condition} onChangeText={(v: string) => s('mouth_condition', v)} colors={colors} />
          <FormField label="Lymph Nodes" value={form.lymph_nodes} onChangeText={(v: string) => s('lymph_nodes', v)} colors={colors} />
          <FormField label="Hands & Feet" value={form.hands_feet} onChangeText={(v: string) => s('hands_feet', v)} colors={colors} />
          <FormField label="Skin Changes" value={form.skin_changes} onChangeText={(v: string) => s('skin_changes', v)} colors={colors} />
          <FormField label="Disability" value={form.disability} onChangeText={(v: string) => s('disability', v)} colors={colors} />
          <FormField label="Disability Details" value={form.disability_details} onChangeText={(v: string) => s('disability_details', v)} colors={colors} />
          <FormField label="Physical Exam Notes" value={form.physical_exam_notes} onChangeText={(v: string) => s('physical_exam_notes', v)} multiline colors={colors} />
        </View>

        {/* Medicines at Enrollment */}
        <SectionHeader title="Medicines at Enrollment" icon="pill-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="Amoxicillin Date" value={form.amoxicillin_date} onChangeText={(v: string) => s('amoxicillin_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Amoxicillin Dosage" value={form.amoxicillin_dosage} onChangeText={(v: string) => s('amoxicillin_dosage', v)} colors={colors} />
          <FormField label="Vitamin A Date" value={form.vitamin_a_date} onChangeText={(v: string) => s('vitamin_a_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Vitamin A Dosage" value={form.vitamin_a_dosage} onChangeText={(v: string) => s('vitamin_a_dosage', v)} colors={colors} />
          <FormField label="Folic Acid Date" value={form.folic_acid_date} onChangeText={(v: string) => s('folic_acid_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Folic Acid Dosage" value={form.folic_acid_dosage} onChangeText={(v: string) => s('folic_acid_dosage', v)} colors={colors} />
          <FormField label="Deworming Date" value={form.deworming_date} onChangeText={(v: string) => s('deworming_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Deworming Dosage" value={form.deworming_dosage} onChangeText={(v: string) => s('deworming_dosage', v)} colors={colors} />
          <FormField label="Measles Vaccine Date" value={form.measles_vaccine_date} onChangeText={(v: string) => s('measles_vaccine_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Measles Vaccine Dosage" value={form.measles_vaccine_dosage} onChangeText={(v: string) => s('measles_vaccine_dosage', v)} colors={colors} />
          <FormField label="Malaria Test Date" value={form.malaria_test_date} onChangeText={(v: string) => s('malaria_test_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Malaria Test Result" value={form.malaria_test_result} onChangeText={(v: string) => s('malaria_test_result', v)} colors={colors} />
          <FormField label="Antimalarial Date" value={form.antimalarial_date} onChangeText={(v: string) => s('antimalarial_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <FormField label="Antimalarial Dosage" value={form.antimalarial_dosage} onChangeText={(v: string) => s('antimalarial_dosage', v)} colors={colors} />
        </View>

        {/* RUTF & Other Supplies */}
        <SectionHeader title="RUTF & Other Supplies" icon="nutrition-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FormField label="RUTF Sachets Given" value={form.rutf_sachets_given} onChangeText={(v: string) => s('rutf_sachets_given', v)} keyboardType="numeric" colors={colors} />
          <FormField label="RUTF Ration/day" value={form.rutf_ration_per_day} onChangeText={(v: string) => s('rutf_ration_per_day', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Next Visit Date" value={form.next_visit_date} onChangeText={(v: string) => s('next_visit_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
        </View>

        {/* Other Medicines */}
        <SectionHeader title="Other Medicines" icon="thermometer-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {[1,2,3].map((i) => (
            <View key={i}>
              <FormField label={`Drug ${i} Name`} value={form[`other_drug_${i}`]} onChangeText={(v: string) => s(`other_drug_${i}`, v)} colors={colors} />
              <FormField label={`Drug ${i} Date`} value={form[`other_drug_${i}_date`]} onChangeText={(v: string) => s(`other_drug_${i}_date`, v)} placeholder="YYYY-MM-DD" colors={colors} />
              <FormField label={`Drug ${i} Dosage`} value={form[`other_drug_${i}_dosage`]} onChangeText={(v: string) => s(`other_drug_${i}_dosage`, v)} colors={colors} />
            </View>
          ))}
          <FormField label="Additional Notes" value={form.additional_notes} onChangeText={(v: string) => s('additional_notes', v)} multiline colors={colors} />
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
