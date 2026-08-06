import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image, Modal, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import DatePickerField from '../../components/DatePickerField';
import OfflineBanner from '../../components/OfflineBanner';
import AnthroGrowthCharts from '../../components/AnthroGrowthCharts';
import { autoZScoresFromPlot } from '../../lib/whoReference';
import type { Facility } from '../../lib/types';

const GENDER_OPTIONS = ['Male', 'Female'];
const YES_NO = ['Yes', 'No'];
const YES_NO_UNK = ['Yes', 'No', 'Unknown'];
const OEDEMA_OPTS = ['None', '+', '++', '+++'];
const ADMISSION_CRITERIA = ['MUAC < 11.5cm', 'WFH < -3SD', 'Bilateral oedema', 'MUAC < 11.0cm infant', 'WFA < -3SD infant'];
const ADMISSION_TYPES = ['New Admission', 'Readmission', 'Transfer In'];
const WFH_Z = ['< -3 SD', '-3 to < -2 SD', '-2 to +1 SD', '> +1 to +2 SD', '> +2 SD'];
const WFA_Z = ['< -3 SD', '-3 to < -2 SD', '-2 to +2 SD', '> +2 SD'];
const HFA_Z = ['< -3 SD', '-3 to < -2 SD', '-2 to +3 SD', '> +3 SD'];
const STOOL_FREQ = ['1-3', '4-5', '>5'];
const APPETITE_SAM = ['Pass', 'Fail'];
const APPETITE_SIMPLE = ['Pass', 'Fail'];
const BF_PROSPECT = ['Good', 'Poor', 'None'];
const IMMUN_STATUS = ['Complete for Age', 'Not Complete for Age'];
const G6PD_OPTS = ['No Defect', 'Partial Defect', 'Full Defect'];
const RESP_RATE = ['<30', '30-39', '40-49', '50-59', '>=60'];
const EYE_COND = ['Normal', 'Sunken', 'Discharge'];
const CONJ_OPTS = ['Normal', 'Mild Pallor', 'Moderate Pallor', 'Severe Pallor'];
const EAR_COND = ['Normal', 'Discharge'];
const MOUTH_COND = ['Normal', 'Thrush', 'Sores'];
const LYMPH_OPTS = ['None', 'Neck', 'Axilla', 'Groin', 'Multiple'];
const HANDS_FEET = ['Normal', 'Cold'];
const SKIN_OPTS = ['None', 'Stained/Discolored', 'Peeling', 'Ulcers/Torn', 'Abscess'];
const MALARIA_RES = ['Positive', 'Negative', 'Not Done'];
const MAM_TYPES = ['High-risk MAM', 'Other MAM'];
const MAM_ENTRY = ['Direct New Enrolment', 'Referred from other MAM-OPC', 'Re-enrolment after defaulting'];
const FOOD_PROD = ['RUSF', 'CSB', 'Fortified Oil', 'Micronutrient Powder'];
const CAREGIVER_REL = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Sibling', 'Other'];
const SAM_REFERRAL = ['Direct from community', 'Referred from health facility', 'Referred from IPC', 'Re-enrolment/relapse'];
const HIV_TB_OPTS = ['None', 'HIV Positive', 'TB Positive', 'HIV+TB', 'Suspected'];
const VULN_OPTS = ['None', 'Low', 'Moderate', 'High', 'Severe'];
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

const autoZScores = (weight: string, height: string, ageMonths: string, gender: string) => {
  return autoZScoresFromPlot(weight, height, ageMonths, gender);
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
const SAM_EDIT_STEPS = ['Child Info', 'Photo & Location', 'Anthropometry', 'Admission', 'Medical History', 'Physical Exam', 'Medicines', 'RUTF & Other', 'Notes'];
const MAM_EDIT_STEPS = ['Child Info', 'Photo & Location', 'Anthropometry', 'MAM Details', 'Aggravating Factors', 'Medical', 'Medicines & Feeding'];

export default function CaseEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchedUpdatedAt, setFetchedUpdatedAt] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [childPhotoUri, setChildPhotoUri] = useState<string | null>(null);
  const [childPhotoChanged, setChildPhotoChanged] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({
    facility_id: '', admission_date: '', registration_number: '', malnutrition_type: '',
    child_name: '', child_gender: '', date_of_birth: '', age_months: '',
    caregiver_name: '', caregiver_phone: '', caregiver_relationship: '', total_household_members: '', address: '',
    weight_kg: '', height_cm: '', muac_cm: '', oedema: '',
    admission_criteria: '', admission_type: '', appetite_test: '',
    complications_notes: '',
    z_score_wfh: '', z_score_wfa: '', z_score_hfa: '',
    // Medical History
    diarrhoea: '', stool_frequency: '', vomiting: '', cough: '', passing_urine: '',
    oedema_duration_days: '', breastfeeding_status: '', breastfeeding_prospect: '',
    effective_suckling: '', relactation_needed: '', visible_severe_wasting: '', age_weeks: '',
    immunization_status: '', immunization_action: '', g6pd_status: '', additional_medical_history: '',
    // Clinical signs (IPC referral criteria)
    intractable_vomiting: '', convulsions: '', lethargic_or_not_alert: '',
    unconscious: '', severe_dehydration: '', very_pale_or_severe_palmar_pallor: '',
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
    // MAM-specific fields
    mam_type: '', food_product_type: '', food_product_quantity: '',
    counselling: '', hiv_tb_status: '', household_vulnerability: '',
    previous_sam_episode: '', failed_counselling_only: '',
    poor_maternal_health: '', mother_deceased: '',
    house_location: '', travel_time: '',
    father_alive: '', mother_alive: '', referral_source: '',
    registration_latitude: '', registration_longitude: '',
    // Other fields from web form
    medical_complications: '', complications_details: '', time_to_travel_minutes: '',
    mebendazole_date: '', other_medicines: '',
    bilateral_pitting_oedema: '', oedema_grade: '',
    admission_time: '', referring_facility: '',
  });
  const s = useCallback((k: string, v: string) => setForm((p) => ({ ...p, [k]: v })), []);

  useEffect(() => { api.get('/v1/facilities/').then((r: any) => setFacilities(r.data.data ?? [])).catch(() => {}); }, []);

  const filteredFacilities = form.malnutrition_type === 'IPC'
    ? facilities.filter((f: Facility) => f.type === 'IPC')
    : facilities.filter((f: Facility) => f.type === 'OPC');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/v1/cases/${id}/`);
        const c: any = res.data.data;
        setFetchedUpdatedAt(c.updated_at ?? null);
        const fields: string[] = [
          'facility_id','admission_date','registration_number','malnutrition_type',
          'child_name','child_gender','date_of_birth','caregiver_name','caregiver_phone',
          'caregiver_relationship','total_household_members','address','oedema','admission_criteria','admission_type',
          'appetite_test','complications_notes','z_score_wfh','z_score_wfa','z_score_hfa',
          'diarrhoea','stool_frequency','vomiting','cough','passing_urine','oedema_duration_days',
          'breastfeeding_status','breastfeeding_prospect','effective_suckling','relactation_needed',
          'visible_severe_wasting','age_weeks','immunization_status','immunization_action','g6pd_status','additional_medical_history',
          'intractable_vomiting','convulsions','lethargic_or_not_alert','unconscious',
          'severe_dehydration','very_pale_or_severe_palmar_pallor',
          'respiratory_rate','temperature_celsius','chest_indrawing',
          'eyes_condition','conjunctiva','ears_condition','mouth_condition','lymph_nodes',
          'hands_feet','skin_changes','disability','disability_details','physical_exam_notes',
          'amoxicillin_date','amoxicillin_dosage','vitamin_a_date','vitamin_a_dosage',
          'folic_acid_date','folic_acid_dosage','deworming_date','deworming_dosage',
          'measles_vaccine_date','measles_vaccine_dosage','malaria_test_date','malaria_test_result',
          'antimalarial_date','antimalarial_dosage','rutf_sachets_given','rutf_ration_per_day',
          'next_visit_date','other_drug_1','other_drug_1_date','other_drug_1_dosage',
          'other_drug_2','other_drug_2_date','other_drug_2_dosage',
          'other_drug_3','other_drug_3_date','other_drug_3_dosage','additional_notes',
          'mam_type','food_product_type','food_product_quantity',
          'counselling','hiv_tb_status','household_vulnerability',
          'previous_sam_episode','failed_counselling_only',
          'poor_maternal_health','mother_deceased',
          'house_location','travel_time',
          'father_alive','mother_alive','referral_source',
          'registration_latitude','registration_longitude',
          'medical_complications','complications_details','time_to_travel_minutes',
          'mebendazole_date','other_medicines',
          'bilateral_pitting_oedema','oedema_grade',
          'admission_time','referring_facility',
        ];
        const next: Record<string, string> = {};
        const boolFields = ['medical_complications','intractable_vomiting','convulsions','lethargic_or_not_alert',
          'unconscious','severe_dehydration','very_pale_or_severe_palmar_pallor',
          'relactation_needed','visible_severe_wasting',
          'previous_sam_episode','failed_counselling_only','poor_maternal_health','mother_deceased'];
        for (const k of fields) {
          if (boolFields.includes(k) && typeof c[k] === 'boolean') {
            next[k] = c[k] ? 'Yes' : 'No';
          } else {
            next[k] = c[k] != null ? String(c[k]) : '';
          }
        }
        next.age_months = c.age_months?.toString() || '';
        if (c.child_photo) setChildPhotoUri(c.child_photo);
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
          if (['age_months','rutf_sachets_given','oedema_duration_days','time_to_travel_minutes','total_household_members'].includes(k)) payload[k] = parseInt(v);
          else if (['weight_kg','height_cm','muac_cm','rutf_ration_per_day','food_product_quantity','temperature_celsius'].includes(k)) payload[k] = parseFloat(v);
          else payload[k] = v;
        }
      }
      // Ensure skip-logic-cleared fields are explicitly sent so backend can null them
      if (form.diarrhoea !== 'Yes') payload.stool_frequency = '';
      if (!form.oedema || form.oedema === 'None') payload.oedema_duration_days = '';
      if (fetchedUpdatedAt) payload._updated_at = fetchedUpdatedAt;
      let res;
      if (childPhotoChanged && childPhotoUri) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)); });
        fd.append('child_photo', { uri: childPhotoUri, name: 'child_photo.jpg', type: 'image/jpeg' } as any);
        res = await sendOrQueue(`/v1/cases/${id}/edit/`, 'put', fd, 'Case Edit');
        if (res) res = res.data;
      } else {
        res = await sendOrQueue(`/v1/cases/${id}/edit/`, 'put', payload, 'Case Edit');
      }
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

  const isSAM = form.malnutrition_type === 'SAM';
  const isMAM = form.malnutrition_type === 'MAM';
  const accent = isMAM ? '#d97706' : isSAM ? '#dc2626' : '#7c3aed';
  const inp: any = [styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }];
  const steps = isMAM ? MAM_EDIT_STEPS : SAM_EDIT_STEPS;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accent, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Case</Text>
          <View style={{ width: 40 }} />
        </View>

        <OfflineBanner />

        {/* Step Pills */}
        <View style={[styles.stepsBar, { backgroundColor: colors.surface }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
            {steps.map((label: string, i: number) => {
              const active = i === stepIdx; const done = i < stepIdx;
              return (
                <TouchableOpacity key={label} style={[styles.stepPill, { backgroundColor: colors.inputBg, borderColor: colors.border },
                  active && { backgroundColor: accent + '18', borderColor: accent },
                  done && { backgroundColor: colors.success + '18', borderColor: colors.success },
                ]} onPress={() => setStepIdx(i)} activeOpacity={0.7}>
                  {done && <Ionicons name="checkmark-circle" size={14} color={colors.success} />}
                  <Text style={[styles.stepPillText, { color: colors.textMuted }, active && { color: accent, fontWeight: '700' }, done && { color: colors.success }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Form Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">

        {/* Step 0: Child Information */}
        {stepIdx === 0 && (
          <Card title="1. Child's Information" accent={accent} colors={colors}>
            <Lbl text="Facility" c={colors} />
            <FacilityPicker facilities={filteredFacilities} value={form.facility_id} onChange={(v: string) => s('facility_id', v)} colors={colors} />
            <Lbl text="Registration Number" c={colors} />
            <TextInput style={[inp, { backgroundColor: colors.background, color: colors.textMuted }]} value={form.registration_number} editable={false} placeholder="Auto-generated" placeholderTextColor={colors.textMuted} />
            <Lbl text="Date of Enrolment" c={colors} />
            <DatePickerField label="Date of Enrolment" value={form.admission_date} onChange={(v: string) => s('admission_date', v)} colors={colors} />
            <Lbl text="Child Name *" c={colors} />
            <TextInput style={inp} value={form.child_name} onChangeText={(v: string) => s('child_name', v)} placeholder="Enter child's name" placeholderTextColor={colors.textMuted} />
            <Lbl text="Sex *" c={colors} />
            <Chips opts={GENDER_OPTIONS} val={form.child_gender} set={(v: string) => { s('child_gender', v); const zs = autoZScores(form.weight_kg, form.height_cm, form.age_months, v); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.wfa) s('z_score_wfa', zs.wfa); if (zs.hfa) s('z_score_hfa', zs.hfa); }} accent={accent} c={colors} />
            <Lbl text="Date of Birth" c={colors} />
            <DatePickerField label="Date of Birth" value={form.date_of_birth} onChange={(v: string) => s('date_of_birth', v)} colors={colors} />
            <Lbl text="Age (months)" c={colors} />
            <TextInput style={inp} value={form.age_months} onChangeText={(v: string) => { s('age_months', v); const zs = autoZScores(form.weight_kg, form.height_cm, v, form.child_gender); if (zs.wfa) s('z_score_wfa', zs.wfa); if (zs.hfa) s('z_score_hfa', zs.hfa); }} keyboardType="number-pad" placeholder="Auto-calculated or enter" placeholderTextColor={colors.textMuted} />
            <Lbl text="Community/Locality" c={colors} />
            <TextInput style={inp} value={form.address} onChangeText={(v: string) => s('address', v)} placeholder="Community or locality" placeholderTextColor={colors.textMuted} />
            <Lbl text="House Location" c={colors} />
            <TextInput style={inp} value={form.house_location} onChangeText={(v: string) => s('house_location', v)} placeholder="House location" placeholderTextColor={colors.textMuted} />
            <Lbl text="Time to Travel to Site" c={colors} />
            <TextInput style={inp} value={form.travel_time} onChangeText={(v: string) => s('travel_time', v)} placeholder="e.g. 30 mins" placeholderTextColor={colors.textMuted} />
            <Lbl text="Father Alive" c={colors} />
            <Chips opts={YES_NO_UNK} val={form.father_alive} set={(v: string) => s('father_alive', v)} accent={accent} c={colors} />
            <Lbl text="Mother Alive" c={colors} />
            <Chips opts={YES_NO_UNK} val={form.mother_alive} set={(v: string) => s('mother_alive', v)} accent={accent} c={colors} />
            <Lbl text="Caregiver Name" c={colors} />
            <TextInput style={inp} value={form.caregiver_name} onChangeText={(v: string) => s('caregiver_name', v)} placeholder="Caregiver's name" placeholderTextColor={colors.textMuted} />
            <Lbl text="Caregiver Phone" c={colors} />
            <TextInput style={inp} value={form.caregiver_phone} onChangeText={(v: string) => s('caregiver_phone', v)} keyboardType="phone-pad" placeholder="e.g. 0201234567" placeholderTextColor={colors.textMuted} />
            <Lbl text="Caregiver Relationship" c={colors} />
            <Chips opts={CAREGIVER_REL} val={form.caregiver_relationship} set={(v: string) => s('caregiver_relationship', v)} accent={accent} c={colors} />
            <Lbl text="Total Number in Household" c={colors} />
            <TextInput style={inp} value={form.total_household_members} onChangeText={(v: string) => s('total_household_members', v)} keyboardType="number-pad" placeholder="e.g. 6" placeholderTextColor={colors.textMuted} />
            <Lbl text="Referral Source" c={colors} />
            <Chips opts={SAM_REFERRAL} val={form.referral_source} set={(v: string) => s('referral_source', v)} accent={accent} c={colors} />
          </Card>
        )}

        {/* Step 1: Photo & Registration Location */}
        {stepIdx === 1 && (
          <Card title="Photo & Registration Location" accent={accent} colors={colors}>
            <Lbl text="Child Photo" c={colors} />
            <PhotoPicker photoUri={childPhotoUri} onPick={(uri: string | null) => { setChildPhotoUri(uri); setChildPhotoChanged(true); }} colors={colors} />
            <Lbl text="Registration Location" c={colors} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[inp, { flex: 1 }]} value={form.registration_latitude} onChangeText={(v: string) => s('registration_latitude', v)} placeholder="Latitude" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              <TextInput style={[inp, { flex: 1 }]} value={form.registration_longitude} onChangeText={(v: string) => s('registration_longitude', v)} placeholder="Longitude" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
            </View>
          </Card>
        )}

        {/* Step 2: Anthropometry (both SAM and MAM) */}
        {stepIdx === 2 && (
          <Card title="2. Anthropometry" accent={accent} colors={colors}>
            <Lbl text="Weight (kg) *" c={colors} />
            <TextInput style={inp} value={form.weight_kg} onChangeText={(v: string) => { s('weight_kg', v); const zs = autoZScores(v, form.height_cm, form.age_months, form.child_gender); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.wfa) s('z_score_wfa', zs.wfa); }} keyboardType="decimal-pad" placeholder="e.g. 7.5" placeholderTextColor={colors.textMuted} />
            <Lbl text="Length/Height (cm) *" c={colors} />
            <TextInput style={inp} value={form.height_cm} onChangeText={(v: string) => { s('height_cm', v); const zs = autoZScores(form.weight_kg, v, form.age_months, form.child_gender); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.hfa) s('z_score_hfa', zs.hfa); }} keyboardType="decimal-pad" placeholder="Length if <24mo, Height if ≥24mo" placeholderTextColor={colors.textMuted} />
            <Lbl text="MUAC (cm) *" c={colors} />
            <TextInput style={inp} value={form.muac_cm} onChangeText={(v: string) => s('muac_cm', v)} keyboardType="decimal-pad" placeholder="< 11.5 cm for SAM" placeholderTextColor={colors.textMuted} />
            <Lbl text="Bilateral Oedema" c={colors} />
            <Chips opts={OEDEMA_OPTS} val={form.oedema} set={(v: string) => { s('oedema', v); if (v === 'None') s('oedema_duration_days', ''); }} accent={accent} c={colors} />

            {/* WHO Growth Charts — gender-specific, clickable for zoom */}
            {form.child_gender && (parseFloat(form.weight_kg) > 0 || parseFloat(form.height_cm) > 0) && (
              <View style={{ marginTop: 12, marginBottom: 4 }}>
                <AnthroGrowthCharts
                  gender={form.child_gender}
                  weight={parseFloat(form.weight_kg) || 0}
                  height={parseFloat(form.height_cm) || 0}
                  ageMonths={parseInt(form.age_months, 10) || 0}
                  colors={colors}
                />
              </View>
            )}

            <Lbl text="Weight-for-Height Z-score" c={colors} />
            <Chips opts={WFH_Z} val={form.z_score_wfh} set={(v: string) => s('z_score_wfh', v)} accent={accent} c={colors} />
            <Lbl text="Weight-for-Age Z-score" c={colors} />
            <Chips opts={WFA_Z} val={form.z_score_wfa} set={(v: string) => s('z_score_wfa', v)} accent={accent} c={colors} />
            <Lbl text="Height-for-Age Z-score" c={colors} />
            <Chips opts={HFA_Z} val={form.z_score_hfa} set={(v: string) => s('z_score_hfa', v)} accent={accent} c={colors} />
          </Card>
        )}

        {/* ════ SAM Step 3: Admission Details ════ */}
        {isSAM && stepIdx === 3 && (
          <Card title="Admission Details" accent={accent} colors={colors}>
            <Lbl text="Enrolment Criteria" c={colors} />
            <Chips opts={ADMISSION_CRITERIA} val={form.admission_criteria} set={(v: string) => s('admission_criteria', v)} accent={accent} c={colors} />
            <Lbl text="Admission Type" c={colors} />
            <Chips opts={ADMISSION_TYPES} val={form.admission_type} set={(v: string) => s('admission_type', v)} accent={accent} c={colors} />
            <Lbl text="Appetite (RUTF Test)" c={colors} />
            <Chips opts={APPETITE_SAM} val={form.appetite_test} set={(v: string) => s('appetite_test', v)} accent={accent} c={colors} />
            <Lbl text="Medical Complications" c={colors} />
            <Chips opts={YES_NO} val={form.medical_complications} set={(v: string) => s('medical_complications', v)} accent={accent} c={colors} />
            <Lbl text="Complications Details" c={colors} />
            <TextInput style={[inp, styles.textArea]} value={form.complications_details} onChangeText={(v: string) => s('complications_details', v)} multiline placeholder="Describe any medical complications..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
            <Lbl text="Admission Time" c={colors} />
            <TextInput style={inp} value={form.admission_time} onChangeText={(v: string) => s('admission_time', v)} placeholder="HH:MM (24hr)" placeholderTextColor={colors.textMuted} />
            <Lbl text="Referring Facility" c={colors} />
            <TextInput style={inp} value={form.referring_facility} onChangeText={(v: string) => s('referring_facility', v)} placeholder="Type facility name..." placeholderTextColor={colors.textMuted} />
          </Card>
        )}

        {/* ════ MAM Step 3: MAM Details ════ */}
        {isMAM && stepIdx === 3 && (
          <Card title="MAM Details" accent={accent} colors={colors}>
            <Lbl text="Type of MAM Treatment" c={colors} />
            <Chips opts={MAM_TYPES} val={form.mam_type} set={(v: string) => s('mam_type', v)} accent={accent} c={colors} />
            <Lbl text="Entry Criteria" c={colors} />
            <Chips opts={MAM_ENTRY} val={form.admission_criteria} set={(v: string) => s('admission_criteria', v)} accent={accent} c={colors} />
            <Lbl text="Food Product Type" c={colors} />
            <Chips opts={FOOD_PROD} val={form.food_product_type} set={(v: string) => s('food_product_type', v)} accent={accent} c={colors} />
            <Lbl text="Quantity" c={colors} />
            <TextInput style={inp} value={form.food_product_quantity} onChangeText={(v: string) => s('food_product_quantity', v)} placeholder="e.g. 500g, 2 sachets" placeholderTextColor={colors.textMuted} />
            <Lbl text="Counselling" c={colors} />
            <TextInput style={inp} value={form.counselling} onChangeText={(v: string) => s('counselling', v)} placeholder="e.g. Feeding practices" placeholderTextColor={colors.textMuted} />
          </Card>
        )}

        {/* ════ MAM Step 4: Aggravating Factors Assessment ════ */}
        {isMAM && stepIdx === 4 && (
          <Card title="Aggravating Factors Assessment" accent={accent} colors={colors}>
            <Lbl text="HIV/TB Status" c={colors} />
            <Chips opts={HIV_TB_OPTS} val={form.hiv_tb_status} set={(v: string) => s('hiv_tb_status', v)} accent={accent} c={colors} />
            <Lbl text="Household Vulnerability Level" c={colors} />
            <Chips opts={VULN_OPTS} val={form.household_vulnerability} set={(v: string) => s('household_vulnerability', v)} accent={accent} c={colors} />
            <Lbl text="Previous SAM Episode" c={colors} />
            <Chips opts={YES_NO} val={form.previous_sam_episode} set={(v: string) => s('previous_sam_episode', v)} accent={accent} c={colors} />
            <Lbl text="Failed to Recover with Counselling Only" c={colors} />
            <Chips opts={YES_NO} val={form.failed_counselling_only} set={(v: string) => s('failed_counselling_only', v)} accent={accent} c={colors} />
            <Lbl text="Poor Maternal Health" c={colors} />
            <Chips opts={YES_NO} val={form.poor_maternal_health} set={(v: string) => s('poor_maternal_health', v)} accent={accent} c={colors} />
            <Lbl text="Mother Deceased" c={colors} />
            <Chips opts={YES_NO} val={form.mother_deceased} set={(v: string) => s('mother_deceased', v)} accent={accent} c={colors} />
            <Lbl text="Disability" c={colors} />
            <Chips opts={YES_NO} val={form.disability} set={(v: string) => s('disability', v)} accent={accent} c={colors} />
            {form.disability === 'Yes' && (
              <><Lbl text="Specify Disability" c={colors} />
              <TextInput style={inp} value={form.disability_details} onChangeText={(v: string) => s('disability_details', v)} placeholder="Type of disability" placeholderTextColor={colors.textMuted} /></>
            )}
          </Card>
        )}

        {/* ════ MAM Step 5: Medical Assessment ════ */}
        {isMAM && stepIdx === 5 && (
          <Card title="Medical Assessment" accent={accent} colors={colors}>
            <Lbl text="Immunization Status" c={colors} />
            <Chips opts={IMMUN_STATUS} val={form.immunization_status} set={(v: string) => s('immunization_status', v)} accent={accent} c={colors} />
            {form.immunization_status === 'Not Complete for Age' && (
              <><Lbl text="Action Taken if Not Complete" c={colors} />
              <TextInput style={inp} value={form.immunization_action} onChangeText={(v: string) => s('immunization_action', v)} placeholder="Describe action taken" placeholderTextColor={colors.textMuted} /></>
            )}
            <Lbl text="Appetite Test" c={colors} />
            <Chips opts={APPETITE_SIMPLE} val={form.appetite_test} set={(v: string) => s('appetite_test', v)} accent={accent} c={colors} />
          </Card>
        )}

        {/* ════ MAM Step 6: Routine Medicines & Feeding ════ */}
        {isMAM && stepIdx === 6 && (
          <Card title="Routine Medicines & Feeding" accent={accent} colors={colors}>
            <Text style={[styles.subHead, { color: colors.textPrimary }]}>Routine Medicines</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>Record date when each medicine is given</Text>
            <Lbl text="Vitamin A (date)" c={colors} />
            <DatePickerField label="Vitamin A Date" value={form.vitamin_a_date} onChange={(v: string) => s('vitamin_a_date', v)} colors={colors} />
            <Lbl text="Mebendazole (date)" c={colors} />
            <DatePickerField label="Mebendazole Date" value={form.mebendazole_date} onChange={(v: string) => s('mebendazole_date', v)} colors={colors} />
            <Lbl text="Measles Vaccination (date)" c={colors} />
            <DatePickerField label="Measles Vaccination Date" value={form.measles_vaccine_date} onChange={(v: string) => s('measles_vaccine_date', v)} colors={colors} />
            <Lbl text="Other Medicines" c={colors} />
            <TextInput style={[inp, styles.textArea]} value={form.other_medicines} onChangeText={(v: string) => s('other_medicines', v)} multiline placeholder="Record any other medicines given" placeholderTextColor={colors.textMuted} textAlignVertical="top" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.subHead, { color: colors.textPrimary }]}>Therapeutic Feeding / Counselling</Text>
            <Lbl text="Food Product Type" c={colors} />
            <Chips opts={FOOD_PROD} val={form.food_product_type} set={(v: string) => s('food_product_type', v)} accent={accent} c={colors} />
            <Lbl text="Quantity" c={colors} />
            <TextInput style={inp} value={form.food_product_quantity} onChangeText={(v: string) => s('food_product_quantity', v)} placeholder="e.g. 500g, 2 sachets" placeholderTextColor={colors.textMuted} />
            <Lbl text="Counselling" c={colors} />
            <TextInput style={inp} value={form.counselling} onChangeText={(v: string) => s('counselling', v)} placeholder="e.g. Feeding practices" placeholderTextColor={colors.textMuted} />
          </Card>
        )}

        {/* ════ SAM Step 4: Medical History ════ */}
        {isSAM && stepIdx === 4 && (
          <Card title="3. Medical History" accent={accent} colors={colors}>
            <Lbl text="Diarrhoea" c={colors} />
            <Chips opts={YES_NO} val={form.diarrhoea} set={(v: string) => { s('diarrhoea', v); if (v !== 'Yes') s('stool_frequency', ''); }} accent={accent} c={colors} />
            {form.diarrhoea === 'Yes' && (
              <><Lbl text="Stool Frequency/Day" c={colors} />
              <Chips opts={STOOL_FREQ} val={form.stool_frequency} set={(v: string) => s('stool_frequency', v)} accent={accent} c={colors} /></>
            )}
            <Lbl text="Vomiting" c={colors} />
            <Chips opts={YES_NO} val={form.vomiting} set={(v: string) => s('vomiting', v)} accent={accent} c={colors} />
            <Lbl text="Cough" c={colors} />
            <Chips opts={YES_NO} val={form.cough} set={(v: string) => s('cough', v)} accent={accent} c={colors} />
            <Lbl text="Passing Urine" c={colors} />
            <Chips opts={YES_NO} val={form.passing_urine} set={(v: string) => s('passing_urine', v)} accent={accent} c={colors} />
            {form.oedema && form.oedema !== 'None' && (
              <><Lbl text="Oedema Duration (days)" c={colors} />
              <TextInput style={inp} value={form.oedema_duration_days} onChangeText={(v: string) => s('oedema_duration_days', v)} keyboardType="number-pad" placeholder="If oedema present" placeholderTextColor={colors.textMuted} /></>
            )}
            <Lbl text="Appetite (RUTF Test)" c={colors} />
            <Chips opts={APPETITE_SAM} val={form.appetite_test} set={(v: string) => s('appetite_test', v)} accent={accent} c={colors} />
            <Lbl text="Breastfeeding Status" c={colors} />
            <Chips opts={YES_NO} val={form.breastfeeding_status} set={(v: string) => { s('breastfeeding_status', v); if (v !== 'Yes') s('breastfeeding_prospect', ''); }} accent={accent} c={colors} />
            {form.breastfeeding_status === 'Yes' && (
              <><Lbl text="Prospect of Breastfeeding" c={colors} />
              <Chips opts={BF_PROSPECT} val={form.breastfeeding_prospect} set={(v: string) => s('breastfeeding_prospect', v)} accent={accent} c={colors} /></>
            )}
            {parseInt(form.age_months || '0', 10) < 6 && (
              <>
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>⚠️ Infant Under 6 Months Assessment</Text>
                </View>
                <Lbl text="Age in Weeks" c={colors} />
                <TextInput style={inp} value={form.age_weeks} onChangeText={(v: string) => s('age_weeks', v)} keyboardType="number-pad" placeholder="Required for infants <6 months" placeholderTextColor={colors.textMuted} />
                <Lbl text="Effective Suckling" c={colors} />
                <Chips opts={['Yes', 'Poor', 'No']} val={form.effective_suckling} set={(v: string) => s('effective_suckling', v)} accent={accent} c={colors} />
                <Lbl text="Relactation Needed" c={colors} />
                <Chips opts={YES_NO} val={form.relactation_needed} set={(v: string) => s('relactation_needed', v)} accent={accent} c={colors} />
                <Lbl text="Visible Severe Wasting" c={colors} />
                <Chips opts={YES_NO} val={form.visible_severe_wasting} set={(v: string) => s('visible_severe_wasting', v)} accent={accent} c={colors} />
              </>
            )}
            <Lbl text="Immunization Status" c={colors} />
            <Chips opts={IMMUN_STATUS} val={form.immunization_status} set={(v: string) => s('immunization_status', v)} accent={accent} c={colors} />
            {form.immunization_status === 'Not Complete for Age' && (
              <><Lbl text="Action Taken if Not Complete" c={colors} />
              <TextInput style={inp} value={form.immunization_action} onChangeText={(v: string) => s('immunization_action', v)} placeholder="Describe action taken" placeholderTextColor={colors.textMuted} /></>
            )}
            <Lbl text="G6PD Status" c={colors} />
            <Chips opts={G6PD_OPTS} val={form.g6pd_status} set={(v: string) => s('g6pd_status', v)} accent={accent} c={colors} />
            <Lbl text="Additional Medical History" c={colors} />
            <TextInput style={[inp, styles.textArea]} value={form.additional_medical_history} onChangeText={(v: string) => s('additional_medical_history', v)} multiline placeholder="Any relevant medical info..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
          </Card>
        )}

        {/* ════ SAM Step 5: Physical Examination ════ */}
        {isSAM && stepIdx === 5 && (
          <Card title="4. Physical Examination" accent={accent} colors={colors}>
            <Lbl text="Respiratory Rate (/min)" c={colors} />
            <Chips opts={RESP_RATE} val={form.respiratory_rate} set={(v: string) => s('respiratory_rate', v)} accent={accent} c={colors} />
            <Lbl text="Temperature (°C)" c={colors} />
            <TextInput style={inp} value={form.temperature_celsius} onChangeText={(v: string) => s('temperature_celsius', v)} keyboardType="decimal-pad" placeholder="e.g. 37.5" placeholderTextColor={colors.textMuted} />
            <Lbl text="Chest Indrawing" c={colors} />
            <Chips opts={YES_NO} val={form.chest_indrawing} set={(v: string) => s('chest_indrawing', v)} accent={accent} c={colors} />
            <Lbl text="Intractable Vomiting" c={colors} />
            <Chips opts={YES_NO} val={form.intractable_vomiting} set={(v: string) => s('intractable_vomiting', v)} accent={accent} c={colors} />
            <Lbl text="Convulsions" c={colors} />
            <Chips opts={YES_NO} val={form.convulsions} set={(v: string) => s('convulsions', v)} accent={accent} c={colors} />
            <Lbl text="Lethargic / Not Alert" c={colors} />
            <Chips opts={YES_NO} val={form.lethargic_or_not_alert} set={(v: string) => s('lethargic_or_not_alert', v)} accent={accent} c={colors} />
            <Lbl text="Unconscious" c={colors} />
            <Chips opts={YES_NO} val={form.unconscious} set={(v: string) => s('unconscious', v)} accent={accent} c={colors} />
            <Lbl text="Severe Dehydration" c={colors} />
            <Chips opts={YES_NO} val={form.severe_dehydration} set={(v: string) => s('severe_dehydration', v)} accent={accent} c={colors} />
            <Lbl text="Very Pale / Severe Palmar Pallor" c={colors} />
            <Chips opts={YES_NO} val={form.very_pale_or_severe_palmar_pallor} set={(v: string) => s('very_pale_or_severe_palmar_pallor', v)} accent={accent} c={colors} />
            <Lbl text="Eyes" c={colors} />
            <Chips opts={EYE_COND} val={form.eyes_condition} set={(v: string) => s('eyes_condition', v)} accent={accent} c={colors} />
            <Lbl text="Conjunctiva (Pallor)" c={colors} />
            <Chips opts={CONJ_OPTS} val={form.conjunctiva} set={(v: string) => s('conjunctiva', v)} accent={accent} c={colors} />
            <Lbl text="Ears" c={colors} />
            <Chips opts={EAR_COND} val={form.ears_condition} set={(v: string) => s('ears_condition', v)} accent={accent} c={colors} />
            <Lbl text="Mouth" c={colors} />
            <Chips opts={MOUTH_COND} val={form.mouth_condition} set={(v: string) => s('mouth_condition', v)} accent={accent} c={colors} />
            <Lbl text="Enlarged Lymph Nodes" c={colors} />
            <Chips opts={LYMPH_OPTS} val={form.lymph_nodes} set={(v: string) => s('lymph_nodes', v)} accent={accent} c={colors} />
            <Lbl text="Hands & Feet" c={colors} />
            <Chips opts={HANDS_FEET} val={form.hands_feet} set={(v: string) => s('hands_feet', v)} accent={accent} c={colors} />
            <Lbl text="Skin Changes" c={colors} />
            <Chips opts={SKIN_OPTS} val={form.skin_changes} set={(v: string) => s('skin_changes', v)} accent={accent} c={colors} />
            <Lbl text="Disability" c={colors} />
            <Chips opts={YES_NO} val={form.disability} set={(v: string) => s('disability', v)} accent={accent} c={colors} />
            {form.disability === 'Yes' && (
              <><Lbl text="Specify Disability" c={colors} />
              <TextInput style={inp} value={form.disability_details} onChangeText={(v: string) => s('disability_details', v)} placeholder="Type of disability" placeholderTextColor={colors.textMuted} /></>
            )}
            <Lbl text="Additional Notes" c={colors} />
            <TextInput style={[inp, styles.textArea]} value={form.physical_exam_notes} onChangeText={(v: string) => s('physical_exam_notes', v)} multiline placeholder="Findings..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
          </Card>
        )}

        {/* ════ SAM Step 6: Medicines at Enrollment ════ */}
        {isSAM && stepIdx === 6 && (
          <Card title="5. Routine Medicines at Enrolment" accent={accent} colors={colors}>
            <MedRow label="Amoxicillin" dk="amoxicillin_date" dosK="amoxicillin_dosage" f={form} s={s} inp={inp} c={colors} />
            <MedRow label="Vitamin A" dk="vitamin_a_date" dosK="vitamin_a_dosage" f={form} s={s} inp={inp} c={colors} />
            <MedRow label="Folic Acid" dk="folic_acid_date" dosK="folic_acid_dosage" f={form} s={s} inp={inp} c={colors} />
            <MedRow label="Albendazole/Mebendazole" dk="deworming_date" dosK="deworming_dosage" f={form} s={s} inp={inp} c={colors} />
            <MedRow label="Measles Vaccine" dk="measles_vaccine_date" dosK="measles_vaccine_dosage" f={form} s={s} inp={inp} c={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Lbl text="Malaria Test Date" c={colors} />
            <DatePickerField label="Malaria Test Date" value={form.malaria_test_date} onChange={(v: string) => s('malaria_test_date', v)} colors={colors} />
            <Lbl text="Malaria Test Result" c={colors} />
            <Chips opts={MALARIA_RES} val={form.malaria_test_result} set={(v: string) => s('malaria_test_result', v)} accent={accent} c={colors} />
            {form.malaria_test_result === 'Positive' && (
              <MedRow label="Antimalarial" dk="antimalarial_date" dosK="antimalarial_dosage" f={form} s={s} inp={inp} c={colors} />
            )}
          </Card>
        )}

        {/* ════ SAM Step 7: RUTF & Other Supplies ════ */}
        {isSAM && stepIdx === 7 && (
          <Card title="6. RUTF Ration & 7. Other Medicines" accent={accent} colors={colors}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Lbl text="RUTF Sachets Given" c={colors} />
              <TouchableOpacity onPress={() => Alert.alert('RUTF Dosage Guide', RUTF_GUIDE.map(r => `${r.weight} kg → ${r.week}/week (${r.day}/day)`).join('\n'), [{ text: 'OK' }])} activeOpacity={0.7}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>📊 Guide</Text>
              </TouchableOpacity>
            </View>
            {form.weight_kg && calcRutf(parseFloat(form.weight_kg)) && (
              <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 6 }}>Suggested: {calcRutf(parseFloat(form.weight_kg))} sachets/week</Text>
            )}
            <TextInput style={inp} value={form.rutf_sachets_given} onChangeText={(v: string) => s('rutf_sachets_given', v)} keyboardType="number-pad" placeholder="Number of sachets" placeholderTextColor={colors.textMuted} />
            <Lbl text="RUTF Ration (sachets/day)" c={colors} />
            <TextInput style={[inp, { backgroundColor: colors.background, color: colors.textMuted }]} value={form.rutf_ration_per_day} editable={false} placeholder="Auto-calculated from weight" placeholderTextColor={colors.textMuted} />
            <Lbl text="Next Visit Date" c={colors} />
            <DatePickerField label="Next Visit Date" value={form.next_visit_date} onChange={(v: string) => s('next_visit_date', v)} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.subHead, { color: colors.textPrimary }]}>Other Medicines</Text>
            {[1,2,3].map((i: number) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput style={[inp, { flex: 2 }]} value={form[`other_drug_${i}`]} onChangeText={(v: string) => s(`other_drug_${i}`, v)} placeholder={`Drug ${i} name`} placeholderTextColor={colors.textMuted} />
                  <TextInput style={[inp, { flex: 1 }]} value={form[`other_drug_${i}_dosage`]} onChangeText={(v: string) => s(`other_drug_${i}_dosage`, v)} placeholder="Dosage" placeholderTextColor={colors.textMuted} />
                </View>
                <DatePickerField label={`Drug ${i} Date`} value={form[`other_drug_${i}_date`]} onChange={(v: string) => s(`other_drug_${i}_date`, v)} colors={colors} />
              </View>
            ))}
          </Card>
        )}

        {/* ════ SAM Step 8: Additional Notes ════ */}
        {isSAM && stepIdx === 8 && (
          <Card title="8. Additional Notes" accent={accent} colors={colors}>
            <Lbl text="Comments / Additional Information" c={colors} />
            <TextInput style={[inp, { minHeight: 120 }]} value={form.additional_notes} onChangeText={(v: string) => s('additional_notes', v)} multiline placeholder="Any additional information about the case..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
          </Card>
        )}

        </ScrollView>

        {/* Bottom Navigation */}
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!isFirst ? (
            <TouchableOpacity style={styles.prevBtn} onPress={() => setStepIdx((i: number) => i - 1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={accent} />
              <Text style={[styles.prevBtnText, { color: accent }]}>Back</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{stepIdx + 1} / {steps.length}</Text>
          {isLast ? (
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.submitBtnText}>Save Changes</Text></>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: accent }]} onPress={() => setStepIdx((i: number) => i + 1)} activeOpacity={0.8}>
              <Text style={styles.nextBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Card({ title, accent, colors, children }: { title: string; accent: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.cardHeader, { borderLeftColor: accent }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Lbl({ text, c }: { text: string; c: any }) {
  return <Text style={[styles.label, { color: c.textSecondary }]}>{text}</Text>;
}

function Chips({ opts, val, set, accent, c }: { opts: string[]; val: string; set: (v: string) => void; accent: string; c: any }) {
  return (
    <View style={styles.chipRow}>
      {opts.map((o: string) => {
        const on = val === o;
        return (
          <TouchableOpacity key={o} style={[styles.chip, { borderColor: c.border, backgroundColor: c.inputBg }, on && { backgroundColor: accent + '15', borderColor: accent }]}
            onPress={() => set(o)} activeOpacity={0.7}>
            <Text style={[styles.chipText, { color: c.textSecondary }, on && { color: accent, fontWeight: '700' }]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FacilityPicker({ facilities, value, onChange, colors }: { facilities: Facility[]; value: string; onChange: (v: string) => void; colors: any }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const sel = facilities.find((fc: Facility) => String(fc.id) === value);
  const filtered = search.trim()
    ? facilities.filter((fc: Facility) => fc.name.toLowerCase().includes(search.toLowerCase()) || (fc.code || '').toLowerCase().includes(search.toLowerCase()))
    : facilities;
  return (
    <>
      <TouchableOpacity
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
        onPress={() => { setSearch(''); setVisible(true); }} activeOpacity={0.7}>
        <Text style={{ color: sel ? colors.textPrimary : colors.textMuted, fontSize: 14, flex: 1 }}>{sel ? sel.name : 'Select Facility'}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Select Facility</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: colors.textPrimary }}
                placeholder="Search facilities..." placeholderTextColor={colors.textMuted}
                value={search} onChangeText={setSearch} autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item: Facility) => String(item.id)}
              renderItem={({ item }: { item: Facility }) => (
                <TouchableOpacity
                  style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => { onChange(String(item.id)); setVisible(false); }}
                >
                  <Ionicons name={String(item.id) === value ? 'radio-button-on' : 'radio-button-off'} size={18} color={String(item.id) === value ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: String(item.id) === value ? colors.primary : colors.textPrimary }}>{item.name}</Text>
                    {item.code ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{item.code}</Text> : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20, color: colors.textMuted }}>No facilities found</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function MedRow({ label, dk, dosK, f, s, inp, c }: { label: string; dk: string; dosK: string; f: Record<string, string>; s: (k: string, v: string) => void; inp: any; c: any }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.textPrimary, marginBottom: 6 }}>{label}</Text>
      <DatePickerField label={label} value={f[dk]} onChange={(v: string) => s(dk, v)} colors={c} />
      <View style={{ marginTop: 6 }}>
        <TextInput style={[inp]} value={f[dosK]} onChangeText={(v: string) => s(dosK, v)} placeholder="Dosage" placeholderTextColor={c.textMuted} />
      </View>
    </View>
  );
}

function PhotoPicker({ photoUri, onPick, colors }: { photoUri: string | null; onPick: (uri: string | null) => void; colors: any }) {
  const pick = async (src: 'camera' | 'library') => {
    const fn = src === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const r = await fn({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets[0]) onPick(r.assets[0].uri);
  };
  return (
    <TouchableOpacity style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
      onPress={() => Alert.alert('Add Photo', 'Choose a source', [
        { text: 'Camera', onPress: () => pick('camera') },
        { text: 'Photo Library', onPress: () => pick('library') },
        ...(photoUri ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => onPick(null) }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ])} activeOpacity={0.7}>
      {photoUri ? <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} /> : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>Tap to add photo</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  stepsBar: { paddingVertical: 8 },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  stepPillText: { fontSize: 11, fontWeight: '600' },
  formCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeader: { borderLeftWidth: 4, paddingLeft: 10, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { minHeight: 80, paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: '500' },
  photoBox: { width: 110, height: 110, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', marginTop: 4, marginBottom: 16 },
  divider: { height: 1, marginVertical: 16 },
  subHead: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4 },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  prevBtnText: { fontSize: 15, fontWeight: '600' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
