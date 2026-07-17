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
import DatePickerField from '../../components/DatePickerField';

const OUTCOME_OPTIONS = ['Continue', 'Absent', 'Cured', 'Defaulted', 'Death', 'Referral', 'Non-Response', 'Home-Visit', 'Transfer-to-IPC'];
const APPETITE_OPTIONS = ['Good', 'Fair', 'Poor'];
const RUTF_OPTIONS = ['Passed', 'Failed'];

// ponytail: RUTF calculator - same as register
const calcRutf = (w: number): number | null => {
  if (w < 4) return null;
  if (w < 5) return 11;
  if (w < 7) return 14;
  if (w < 8.5) return 18;
  if (w < 9.5) return 21;
  if (w < 10.5) return 25;
  if (w < 12) return 28;
  return 32;
};

const RUTF_GUIDE = [
  { weight: '4.0 – 4.9', week: 11, day: '1½' },
  { weight: '5.0 – 6.9', week: 14, day: '2' },
  { weight: '7.0 – 8.4', week: 18, day: '2½' },
  { weight: '8.5 – 9.4', week: 21, day: '3' },
  { weight: '9.5 – 10.4', week: 25, day: '3½' },
  { weight: '10.5 – 11.9', week: 28, day: '4' },
  { weight: '12+', week: 32, day: '4½' },
];

export default function VisitEditScreen() {
  const { caseId, visitId } = useLocalSearchParams<{ caseId: string; visitId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchedUpdatedAt, setFetchedUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    visit_date: '', weight_kg: '', height_cm: '', muac_cm: '', oedema: '',
    diarrhoea_days: '', vomiting_days: '', fever_days: '', cough_days: '',
    temperature: '', respiratory_rate: '',
    appetite: '', rutf_test: '', rutf_sachets_given: '',
    visit_outcome: '', outcome_notes: '', medical_notes: '',
    // Commodity fields
    csb_plus_given: '', oil_given: '', other_supplies: '', other_medication: '',
    food_product_type: '', food_product_quantity: '',
    // Clinical fields
    z_score_wfh: '', z_score_wfa: '', z_score_hfa: '',
    breastfeeding_status: '', general_condition: '', complications_notes: '',
    counseling_topics: '', caregiver_understanding: '', next_visit_date: '',
    treatment_response: '', staff_name: '',
    weight_lost: '', dehydrated: '', anaemia_palmar_pallor: '', skin_infection: '',
    has_complications: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/v1/cases/${caseId}/visits/`);
        const visits = res.data.data || [];
        const visit = visits.find((v: any) => v.id === parseInt(visitId));
        if (visit) {
          setFetchedUpdatedAt(visit.updated_at ?? null);
          setForm({
            visit_date: visit.visit_date || '',
            weight_kg: visit.weight_kg?.toString() || '',
            height_cm: visit.height_cm?.toString() || '',
            muac_cm: visit.muac_cm?.toString() || '',
            oedema: visit.oedema || '',
            diarrhoea_days: visit.diarrhoea_days?.toString() || '',
            vomiting_days: visit.vomiting_days?.toString() || '',
            fever_days: visit.fever_days?.toString() || '',
            cough_days: visit.cough_days?.toString() || '',
            temperature: visit.temperature?.toString() || '',
            respiratory_rate: visit.respiratory_rate?.toString() || '',
            appetite: visit.appetite || '',
            rutf_test: visit.rutf_test || '',
            rutf_sachets_given: visit.rutf_sachets_given?.toString() || '',
            visit_outcome: visit.visit_outcome || '',
            outcome_notes: visit.outcome_notes || '',
            medical_notes: visit.medical_notes || '',
            csb_plus_given: visit.csb_plus_given?.toString() || '',
            oil_given: visit.oil_given?.toString() || '',
            other_supplies: visit.other_supplies || '',
            other_medication: visit.other_medication || '',
            food_product_type: visit.food_product_type || '',
            food_product_quantity: visit.food_product_quantity?.toString() || '',
            z_score_wfh: visit.z_score_wfh?.toString() || '',
            z_score_wfa: visit.z_score_wfa?.toString() || '',
            z_score_hfa: visit.z_score_hfa?.toString() || '',
            breastfeeding_status: visit.breastfeeding_status || '',
            general_condition: visit.general_condition || '',
            complications_notes: visit.complications_notes || '',
            counseling_topics: visit.counseling_topics || '',
            caregiver_understanding: visit.caregiver_understanding || '',
            next_visit_date: visit.next_visit_date || '',
            treatment_response: visit.treatment_response || '',
            staff_name: visit.staff_name || '',
            weight_lost: visit.weight_lost?.toString() || '',
            dehydrated: visit.dehydrated?.toString() || '',
            anaemia_palmar_pallor: visit.anaemia_palmar_pallor?.toString() || '',
            skin_infection: visit.skin_infection?.toString() || '',
            has_complications: visit.has_complications?.toString() || '',
          });
        }
      } catch {
        Alert.alert('Error', 'Failed to load visit');
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId, visitId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== '' && v != null) {
          if (['weight_kg','height_cm','muac_cm','temperature','csb_plus_given','oil_given','food_product_quantity'].includes(k)) payload[k] = parseFloat(v);
          else if (['diarrhoea_days','vomiting_days','fever_days','cough_days','respiratory_rate','rutf_sachets_given'].includes(k)) payload[k] = parseInt(v);
          else if (['weight_lost','dehydrated','anaemia_palmar_pallor','skin_infection','has_complications'].includes(k)) payload[k] = v === 'true' || v === 'True' || v === '1';
          else payload[k] = v;
        }
      }
      if (fetchedUpdatedAt) payload._updated_at = fetchedUpdatedAt;
      await api.put(`/v1/cases/${caseId}/visits/${visitId}/edit/`, payload);
      Alert.alert('Success', 'Visit updated', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update visit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const update = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Visit</Text>
          <View style={{ width: 40 }} />
        </View>

        <SectionHeader title="Visit Details" icon="calendar-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>VISIT DATE</Text>
          <DatePickerField label="Visit Date" value={form.visit_date} onChange={(v: string) => update('visit_date', v)} colors={colors} maxDate={new Date().toISOString().slice(0, 10)} />
          <PickerRow label="Outcome" value={form.visit_outcome} options={OUTCOME_OPTIONS} onSelect={(v: string) => update('visit_outcome', v)} colors={colors} />
          <Field label="Outcome Notes" value={form.outcome_notes} onChangeText={(v: string) => update('outcome_notes', v)} multiline colors={colors} />
        </View>

        <SectionHeader title="Anthropometry" icon="body-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Weight (kg)" value={form.weight_kg} onChangeText={(v: string) => {
            update('weight_kg', v);
            const w = parseFloat(v);
            const sachets = calcRutf(w);
            if (sachets) update('rutf_sachets_given', sachets.toString());
          }} keyboardType="decimal-pad" colors={colors} />
          <Field label="Height (cm)" value={form.height_cm} onChangeText={(v: string) => update('height_cm', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="MUAC (cm)" value={form.muac_cm} onChangeText={(v: string) => update('muac_cm', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Oedema" value={form.oedema} onChangeText={(v: string) => update('oedema', v)} colors={colors} />
        </View>

        <SectionHeader title="Medical History" icon="medkit-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Diarrhoea (days)" value={form.diarrhoea_days} onChangeText={(v: string) => update('diarrhoea_days', v)} keyboardType="numeric" colors={colors} />
          <Field label="Vomiting (days)" value={form.vomiting_days} onChangeText={(v: string) => update('vomiting_days', v)} keyboardType="numeric" colors={colors} />
          <Field label="Fever (days)" value={form.fever_days} onChangeText={(v: string) => update('fever_days', v)} keyboardType="numeric" colors={colors} />
          <Field label="Cough (days)" value={form.cough_days} onChangeText={(v: string) => update('cough_days', v)} keyboardType="numeric" colors={colors} />
          <Field label="Temperature (°C)" value={form.temperature} onChangeText={(v: string) => update('temperature', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Respiratory Rate" value={form.respiratory_rate} onChangeText={(v: string) => update('respiratory_rate', v)} keyboardType="numeric" colors={colors} />
        </View>

        <SectionHeader title="Feeding & Treatment" icon="nutrition-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PickerRow label="Appetite" value={form.appetite} options={APPETITE_OPTIONS} onSelect={(v: string) => update('appetite', v)} colors={colors} />
          <PickerRow label="RUTF Test" value={form.rutf_test} options={RUTF_OPTIONS} onSelect={(v: string) => update('rutf_test', v)} colors={colors} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>RUTF Sachets Given</Text>
            <TouchableOpacity onPress={() => Alert.alert('RUTF Dosage Guide', RUTF_GUIDE.map(r => `${r.weight} kg → ${r.week}/week (${r.day}/day)`).join('\n'), [{ text: 'OK' }])} activeOpacity={0.7}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>📊 Guide</Text>
            </TouchableOpacity>
          </View>
          {form.weight_kg && calcRutf(parseFloat(form.weight_kg)) && (
            <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 4 }}>Suggested: {calcRutf(parseFloat(form.weight_kg))} sachets/week</Text>
          )}
          <Field label="" value={form.rutf_sachets_given} onChangeText={(v: string) => update('rutf_sachets_given', v)} keyboardType="numeric" colors={colors} />
          <Field label="CSB+ Given" value={form.csb_plus_given} onChangeText={(v: string) => update('csb_plus_given', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Oil Given" value={form.oil_given} onChangeText={(v: string) => update('oil_given', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Other Supplies" value={form.other_supplies} onChangeText={(v: string) => update('other_supplies', v)} colors={colors} />
          <Field label="Other Medication" value={form.other_medication} onChangeText={(v: string) => update('other_medication', v)} colors={colors} />
          <Field label="Food Product Type" value={form.food_product_type} onChangeText={(v: string) => update('food_product_type', v)} colors={colors} />
          <Field label="Food Product Quantity" value={form.food_product_quantity} onChangeText={(v: string) => update('food_product_quantity', v)} keyboardType="numeric" colors={colors} />
          <Field label="Medical Notes" value={form.medical_notes} onChangeText={(v: string) => update('medical_notes', v)} multiline colors={colors} />
        </View>

        <SectionHeader title="Clinical Assessment" icon="pulse-outline" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Field label="Z-Score WFH" value={form.z_score_wfh} onChangeText={(v: string) => update('z_score_wfh', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Z-Score WFA" value={form.z_score_wfa} onChangeText={(v: string) => update('z_score_wfa', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Z-Score HFA" value={form.z_score_hfa} onChangeText={(v: string) => update('z_score_hfa', v)} keyboardType="decimal-pad" colors={colors} />
          <Field label="Breastfeeding Status" value={form.breastfeeding_status} onChangeText={(v: string) => update('breastfeeding_status', v)} colors={colors} />
          <Field label="General Condition" value={form.general_condition} onChangeText={(v: string) => update('general_condition', v)} colors={colors} />
          <Field label="Complications Notes" value={form.complications_notes} onChangeText={(v: string) => update('complications_notes', v)} multiline colors={colors} />
          <Field label="Counseling Topics" value={form.counseling_topics} onChangeText={(v: string) => update('counseling_topics', v)} multiline colors={colors} />
          <Field label="Caregiver Understanding" value={form.caregiver_understanding} onChangeText={(v: string) => update('caregiver_understanding', v)} colors={colors} />
          <Field label="Treatment Response" value={form.treatment_response} onChangeText={(v: string) => update('treatment_response', v)} colors={colors} />
          <Field label="Next Visit Date" value={form.next_visit_date} onChangeText={(v: string) => update('next_visit_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
          <Field label="Staff Name" value={form.staff_name} onChangeText={(v: string) => update('staff_name', v)} colors={colors} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
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

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, colors }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder || ''} placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType} multiline={multiline}
      />
    </View>
  );
}

function PickerRow({ label, value, options, onSelect, colors }: { label: string; value: string; options: string[]; onSelect: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg }]} onPress={() => setOpen(!open)}>
        <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textMuted }]}>{value || 'Select...'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {options.map((opt) => (
            <TouchableOpacity key={opt} style={[styles.optionItem, value === opt && { backgroundColor: colors.primary + '15' }]} onPress={() => { onSelect(opt); setOpen(false); }}>
              <Text style={[styles.optionText, { color: value === opt ? colors.primary : colors.textPrimary }]}>{opt}</Text>
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
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15, fontWeight: '500' },
  optionsList: { borderRadius: 10, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  optionItem: { paddingHorizontal: 14, paddingVertical: 11 },
  optionText: { fontSize: 14, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
