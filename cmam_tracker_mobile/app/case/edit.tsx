import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image,
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
import type { Facility } from '../../lib/types';

const GENDER_OPTIONS = ['Male', 'Female'];
const YES_NO = ['Yes', 'No'];
const YES_NO_UNK = ['Yes', 'No', 'Unknown'];
const OEDEMA_OPTS = ['None', '+', '++', '+++'];
const ADMISSION_CRITERIA = ['MUAC < 11.5cm', 'WFH < -3SD', 'Bilateral oedema', 'MUAC < 11.0cm infant', 'WFA < -3SD infant'];
const ADMISSION_TYPES = ['New Admission', 'Readmission', 'Transfer In'];
const WFH_Z = ['< -3 SD', '-3 to < -2 SD', '-2 to +1 SD', '> +1 to +2 SD', '> +2 SD'];
const WFA_Z = ['< -3 SD', '-3 to < -2 SD', '-2 to +1 SD', '> +1 SD'];
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
const RUTF_GUIDE = [
  { weight: '4.0 – 4.9', week: 11, day: '1½' },
  { weight: '5.0 – 6.9', week: 14, day: '2' },
  { weight: '7.0 – 8.4', week: 18, day: '2½' },
  { weight: '8.5 – 9.4', week: 21, day: '3' },
  { weight: '9.5 – 10.4', week: 25, day: '3½' },
  { weight: '10.5 – 11.9', week: 28, day: '4' },
  { weight: '12+', week: 32, day: '4½' },
];

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
  const accent = isMAM ? '#ca8a04' : isSAM ? '#dc2626' : '#7c3aed';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accent, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Case</Text>
          <View style={{ width: 40 }} />
        </View>

        <OfflineBanner />

        {/* Child Information */}
        <Card title="Child Information" accent={accent} colors={colors}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Facility</Text>
          <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg }]} onPress={() => {
            const opts = facilities.map(fac => `${fac.id}:${fac.name}`);
            Alert.alert('Select Facility', undefined, [
              ...facilities.map(fac => ({ text: fac.name, onPress: () => s('facility_id', String(fac.id)) })),
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}>
            <Text style={[styles.pickerBtnText, { color: form.facility_id ? colors.textPrimary : colors.textMuted }]}>
              {form.facility_id ? facilities.find(fac => String(fac.id) === form.facility_id)?.name || form.facility_id : 'Select...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <FormField label="Registration Number" value={form.registration_number} onChangeText={(_v: string) => {}} colors={colors} placeholder="Auto-generated" />
          <DatePickerField label="Admission Date" value={form.admission_date} onChange={(v: string) => s('admission_date', v)} colors={colors} />
          <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 8 }]}>Child Photo</Text>
          <TouchableOpacity style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
            onPress={() => Alert.alert('Child Photo', 'Choose', [
              { text: 'Camera', onPress: async () => { const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 }); if (!r.canceled && r.assets[0]) { setChildPhotoUri(r.assets[0].uri); setChildPhotoChanged(true); } } },
              { text: 'Photo Library', onPress: async () => { const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 }); if (!r.canceled && r.assets[0]) { setChildPhotoUri(r.assets[0].uri); setChildPhotoChanged(true); } } },
              ...(childPhotoUri ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => { setChildPhotoUri(null); setChildPhotoChanged(true); } }] : []),
              { text: 'Cancel', style: 'cancel' as const },
            ])}
          >
            {childPhotoUri ? (
              <Image source={{ uri: childPhotoUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>Tap to add photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <FormField label="Child Name *" value={form.child_name} onChangeText={(v: string) => s('child_name', v)} colors={colors} />
          <PickerField label="Gender" value={form.child_gender} options={GENDER_OPTIONS} onSelect={(v: string) => s('child_gender', v)} colors={colors} />
          <DatePickerField label="Date of Birth" value={form.date_of_birth} onChange={(v: string) => s('date_of_birth', v)} colors={colors} />
          <FormField label="Age (months)" value={form.age_months} onChangeText={(v: string) => s('age_months', v)} keyboardType="numeric" colors={colors} />
          <FormField label="Community" value={form.address} onChangeText={(v: string) => s('address', v)} colors={colors} />
          <FormField label="House Location" value={form.house_location} onChangeText={(v: string) => s('house_location', v)} colors={colors} />
          <FormField label="Travel Time to Facility" value={form.travel_time} onChangeText={(v: string) => s('travel_time', v)} colors={colors} />
          <FormField label="Time to Travel (minutes)" value={form.time_to_travel_minutes} onChangeText={(v: string) => s('time_to_travel_minutes', v)} keyboardType="numeric" colors={colors} />
          <PickerField label="Father Alive" value={form.father_alive} options={YES_NO_UNK} onSelect={(v: string) => s('father_alive', v)} colors={colors} />
          <PickerField label="Mother Alive" value={form.mother_alive} options={YES_NO_UNK} onSelect={(v: string) => s('mother_alive', v)} colors={colors} />
          <PickerField label="Referral Source" value={form.referral_source} options={SAM_REFERRAL} onSelect={(v: string) => s('referral_source', v)} colors={colors} />
          <FormField label="Registration Latitude" value={form.registration_latitude} onChangeText={(v: string) => s('registration_latitude', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Registration Longitude" value={form.registration_longitude} onChangeText={(v: string) => s('registration_longitude', v)} keyboardType="decimal-pad" colors={colors} />
        </Card>

        {/* Caregiver */}
        <Card title="Caregiver" accent={accent} colors={colors}>
          <FormField label="Caregiver Name" value={form.caregiver_name} onChangeText={(v: string) => s('caregiver_name', v)} colors={colors} />
          <FormField label="Phone" value={form.caregiver_phone} onChangeText={(v: string) => s('caregiver_phone', v)} keyboardType="phone-pad" colors={colors} />
          <PickerField label="Relationship" value={form.caregiver_relationship} options={CAREGIVER_REL} onSelect={(v: string) => s('caregiver_relationship', v)} colors={colors} />
          <FormField label="Total Number in Household" value={form.total_household_members} onChangeText={(v: string) => s('total_household_members', v)} keyboardType="number-pad" colors={colors} />
        </Card>

        {/* Anthropometry */}
        <Card title="Anthropometry" accent={accent} colors={colors}>
          <FormField label="Weight (kg)" value={form.weight_kg} onChangeText={(v: string) => s('weight_kg', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="Height (cm)" value={form.height_cm} onChangeText={(v: string) => s('height_cm', v)} keyboardType="decimal-pad" colors={colors} />
          <FormField label="MUAC (cm)" value={form.muac_cm} onChangeText={(v: string) => s('muac_cm', v)} keyboardType="decimal-pad" colors={colors} />
          <PickerField label="Bilateral Pitting Oedema" value={form.oedema} options={OEDEMA_OPTS} onSelect={(v: string) => { s('oedema', v); if (v === 'None') s('oedema_duration_days', ''); }} colors={colors} />
          <PickerField label="Oedema Grade" value={form.oedema_grade} options={['+', '++', '+++']} onSelect={(v: string) => s('oedema_grade', v)} colors={colors} />
          <PickerField label="Z-Score WFH" value={form.z_score_wfh} options={WFH_Z} onSelect={(v: string) => s('z_score_wfh', v)} colors={colors} />
          <PickerField label="Z-Score WFA" value={form.z_score_wfa} options={WFA_Z} onSelect={(v: string) => s('z_score_wfa', v)} colors={colors} />
          <PickerField label="Z-Score HFA" value={form.z_score_hfa} options={HFA_Z} onSelect={(v: string) => s('z_score_hfa', v)} colors={colors} />
        </Card>

        {/* ════ SAM-SPECIFIC SECTIONS ════ */}
        {isSAM && (
          <>
            {/* Admission Details */}
            <Card title="Admission Details" accent={accent} colors={colors}>
              <PickerField label="Admission Criteria" value={form.admission_criteria} options={ADMISSION_CRITERIA} onSelect={(v: string) => s('admission_criteria', v)} colors={colors} />
              <PickerField label="Admission Type" value={form.admission_type} options={ADMISSION_TYPES} onSelect={(v: string) => s('admission_type', v)} colors={colors} />
              <PickerField label="Appetite Test" value={form.appetite_test} options={APPETITE_SAM} onSelect={(v: string) => s('appetite_test', v)} colors={colors} />
              <PickerField label="Medical Complications" value={form.medical_complications} options={YES_NO} onSelect={(v: string) => s('medical_complications', v)} colors={colors} />
              <FormField label="Complications Details" value={form.complications_details} onChangeText={(v: string) => s('complications_details', v)} multiline colors={colors} />
              <FormField label="Complications Notes" value={form.complications_notes} onChangeText={(v: string) => s('complications_notes', v)} multiline colors={colors} />
              <FormField label="Admission Time" value={form.admission_time} onChangeText={(v: string) => s('admission_time', v)} colors={colors} />
              <FormField label="Referring Facility" value={form.referring_facility} onChangeText={(v: string) => s('referring_facility', v)} colors={colors} />
            </Card>
          </>
        )}

        {/* ════ MAM-SPECIFIC SECTIONS ════ */}
        {isMAM && (
          <>
            {/* MAM Details */}
            <Card title="MAM Details" accent={accent} colors={colors}>
              <PickerField label="MAM Type" value={form.mam_type} options={MAM_TYPES} onSelect={(v: string) => s('mam_type', v)} colors={colors} />
              <PickerField label="Enrolment Criteria" value={form.admission_criteria} options={MAM_ENTRY} onSelect={(v: string) => s('admission_criteria', v)} colors={colors} />
              <PickerField label="Food Product Type" value={form.food_product_type} options={FOOD_PROD} onSelect={(v: string) => s('food_product_type', v)} colors={colors} />
              <FormField label="Food Product Quantity" value={form.food_product_quantity} onChangeText={(v: string) => s('food_product_quantity', v)} colors={colors} />
              <FormField label="Counselling" value={form.counselling} onChangeText={(v: string) => s('counselling', v)} multiline colors={colors} />
            </Card>

            {/* Aggravating Factors Assessment */}
            <Card title="Aggravating Factors Assessment" accent={accent} colors={colors}>
              <PickerField label="HIV/TB Status" value={form.hiv_tb_status} options={HIV_TB_OPTS} onSelect={(v: string) => s('hiv_tb_status', v)} colors={colors} />
              <PickerField label="Household Vulnerability" value={form.household_vulnerability} options={VULN_OPTS} onSelect={(v: string) => s('household_vulnerability', v)} colors={colors} />
              <PickerField label="Previous SAM Episode" value={form.previous_sam_episode} options={YES_NO} onSelect={(v: string) => s('previous_sam_episode', v)} colors={colors} />
              <PickerField label="Failed Counselling Only" value={form.failed_counselling_only} options={YES_NO} onSelect={(v: string) => s('failed_counselling_only', v)} colors={colors} />
              <PickerField label="Poor Maternal Health" value={form.poor_maternal_health} options={YES_NO} onSelect={(v: string) => s('poor_maternal_health', v)} colors={colors} />
              <PickerField label="Mother Deceased" value={form.mother_deceased} options={YES_NO} onSelect={(v: string) => s('mother_deceased', v)} colors={colors} />
              <PickerField label="Disability" value={form.disability} options={YES_NO} onSelect={(v: string) => s('disability', v)} colors={colors} />
              {form.disability === 'Yes' && (
                <FormField label="Disability Details" value={form.disability_details} onChangeText={(v: string) => s('disability_details', v)} colors={colors} />
              )}
            </Card>

            {/* Medical Assessment */}
            <Card title="Medical Assessment" accent={accent} colors={colors}>
              <PickerField label="Immunization Status" value={form.immunization_status} options={IMMUN_STATUS} onSelect={(v: string) => s('immunization_status', v)} colors={colors} />
              {form.immunization_status === 'Not Complete for Age' && (
                <FormField label="Action Taken if Not Complete" value={form.immunization_action} onChangeText={(v: string) => s('immunization_action', v)} colors={colors} />
              )}
              <PickerField label="Appetite Test" value={form.appetite_test} options={APPETITE_SIMPLE} onSelect={(v: string) => s('appetite_test', v)} colors={colors} />
            </Card>

            {/* Routine Medicines & Feeding */}
            <Card title="Routine Medicines & Feeding" accent={accent} colors={colors}>
              <DatePickerField label="Vitamin A Date" value={form.vitamin_a_date} onChange={(v: string) => s('vitamin_a_date', v)} colors={colors} />
              <DatePickerField label="Mebendazole Date" value={form.mebendazole_date} onChange={(v: string) => s('mebendazole_date', v)} colors={colors} />
              <DatePickerField label="Measles Vaccine Date" value={form.measles_vaccine_date} onChange={(v: string) => s('measles_vaccine_date', v)} colors={colors} />
              <FormField label="Other Medicines" value={form.other_medicines} onChangeText={(v: string) => s('other_medicines', v)} multiline colors={colors} />
              <FormField label="Additional Notes" value={form.additional_notes} onChangeText={(v: string) => s('additional_notes', v)} multiline colors={colors} />
            </Card>
          </>
        )}

        {/* Medical History (SAM only) */}
        {isSAM && (
          <Card title="Medical History" accent={accent} colors={colors}>
            <PickerField label="Diarrhoea" value={form.diarrhoea} options={YES_NO} onSelect={(v: string) => { s('diarrhoea', v); if (v !== 'Yes') s('stool_frequency', ''); }} colors={colors} />
            {form.diarrhoea === 'Yes' && (
              <PickerField label="Stool Frequency" value={form.stool_frequency} options={STOOL_FREQ} onSelect={(v: string) => s('stool_frequency', v)} colors={colors} />
            )}
            <PickerField label="Vomiting" value={form.vomiting} options={YES_NO} onSelect={(v: string) => s('vomiting', v)} colors={colors} />
            <PickerField label="Cough" value={form.cough} options={YES_NO} onSelect={(v: string) => s('cough', v)} colors={colors} />
            <PickerField label="Passing Urine" value={form.passing_urine} options={YES_NO} onSelect={(v: string) => s('passing_urine', v)} colors={colors} />
            {form.oedema && form.oedema !== 'None' && (
              <FormField label="Oedema Duration (days)" value={form.oedema_duration_days} onChangeText={(v: string) => s('oedema_duration_days', v)} keyboardType="numeric" colors={colors} />
            )}
            <PickerField label="Breastfeeding Status" value={form.breastfeeding_status} options={YES_NO} onSelect={(v: string) => { s('breastfeeding_status', v); if (v !== 'Yes') s('breastfeeding_prospect', ''); }} colors={colors} />
            {form.breastfeeding_status === 'Yes' && (
              <PickerField label="Breastfeeding Prospect" value={form.breastfeeding_prospect} options={BF_PROSPECT} onSelect={(v: string) => s('breastfeeding_prospect', v)} colors={colors} />
            )}
            {parseInt(form.age_months || '0', 10) < 6 && (
              <>
                <FormField label="Age in Weeks" value={form.age_weeks} onChangeText={(v: string) => s('age_weeks', v)} keyboardType="numeric" colors={colors} />
                <PickerField label="Effective Suckling" value={form.effective_suckling} options={['Yes', 'Poor', 'No']} onSelect={(v: string) => s('effective_suckling', v)} colors={colors} />
                <PickerField label="Relactation Needed" value={form.relactation_needed} options={YES_NO} onSelect={(v: string) => s('relactation_needed', v)} colors={colors} />
                <PickerField label="Visible Severe Wasting" value={form.visible_severe_wasting} options={YES_NO} onSelect={(v: string) => s('visible_severe_wasting', v)} colors={colors} />
              </>
            )}
            <PickerField label="Immunization Status" value={form.immunization_status} options={IMMUN_STATUS} onSelect={(v: string) => s('immunization_status', v)} colors={colors} />
            {form.immunization_status === 'Not Complete for Age' && (
              <FormField label="Action Taken if Not Complete" value={form.immunization_action} onChangeText={(v: string) => s('immunization_action', v)} colors={colors} />
            )}
            <PickerField label="G6PD Status" value={form.g6pd_status} options={G6PD_OPTS} onSelect={(v: string) => s('g6pd_status', v)} colors={colors} />
            <FormField label="Additional Medical History" value={form.additional_medical_history} onChangeText={(v: string) => s('additional_medical_history', v)} multiline colors={colors} />
          </Card>
        )}

        {/* Clinical Signs (SAM only) */}
        {isSAM && (
          <Card title="Clinical Signs (IPC Referral)" accent={accent} colors={colors}>
            <PickerField label="Intractable Vomiting" value={form.intractable_vomiting} options={YES_NO} onSelect={(v: string) => s('intractable_vomiting', v)} colors={colors} />
            <PickerField label="Convulsions" value={form.convulsions} options={YES_NO} onSelect={(v: string) => s('convulsions', v)} colors={colors} />
            <PickerField label="Lethargic / Not Alert" value={form.lethargic_or_not_alert} options={YES_NO} onSelect={(v: string) => s('lethargic_or_not_alert', v)} colors={colors} />
            <PickerField label="Unconscious" value={form.unconscious} options={YES_NO} onSelect={(v: string) => s('unconscious', v)} colors={colors} />
            <PickerField label="Chest Indrawing" value={form.chest_indrawing} options={YES_NO} onSelect={(v: string) => s('chest_indrawing', v)} colors={colors} />
            <PickerField label="Severe Dehydration" value={form.severe_dehydration} options={YES_NO} onSelect={(v: string) => s('severe_dehydration', v)} colors={colors} />
            <PickerField label="Very Pale / Severe Palmar Pallor" value={form.very_pale_or_severe_palmar_pallor} options={YES_NO} onSelect={(v: string) => s('very_pale_or_severe_palmar_pallor', v)} colors={colors} />
          </Card>
        )}

        {/* Physical Examination (SAM only) */}
        {isSAM && (
          <Card title="Physical Examination" accent={accent} colors={colors}>
            <PickerField label="Respiratory Rate" value={form.respiratory_rate} options={RESP_RATE} onSelect={(v: string) => s('respiratory_rate', v)} colors={colors} />
            <FormField label="Temperature (°C)" value={form.temperature_celsius} onChangeText={(v: string) => s('temperature_celsius', v)} keyboardType="decimal-pad" colors={colors} />
            <PickerField label="Eyes" value={form.eyes_condition} options={EYE_COND} onSelect={(v: string) => s('eyes_condition', v)} colors={colors} />
            <PickerField label="Conjunctiva (Pallor)" value={form.conjunctiva} options={CONJ_OPTS} onSelect={(v: string) => s('conjunctiva', v)} colors={colors} />
            <PickerField label="Ears" value={form.ears_condition} options={EAR_COND} onSelect={(v: string) => s('ears_condition', v)} colors={colors} />
            <PickerField label="Mouth" value={form.mouth_condition} options={MOUTH_COND} onSelect={(v: string) => s('mouth_condition', v)} colors={colors} />
            <PickerField label="Enlarged Lymph Nodes" value={form.lymph_nodes} options={LYMPH_OPTS} onSelect={(v: string) => s('lymph_nodes', v)} colors={colors} />
            <PickerField label="Hands & Feet" value={form.hands_feet} options={HANDS_FEET} onSelect={(v: string) => s('hands_feet', v)} colors={colors} />
            <PickerField label="Skin Changes" value={form.skin_changes} options={SKIN_OPTS} onSelect={(v: string) => s('skin_changes', v)} colors={colors} />
            <PickerField label="Disability" value={form.disability} options={YES_NO} onSelect={(v: string) => s('disability', v)} colors={colors} />
            {form.disability === 'Yes' && (
              <FormField label="Disability Details" value={form.disability_details} onChangeText={(v: string) => s('disability_details', v)} colors={colors} />
            )}
            <FormField label="Physical Exam Notes" value={form.physical_exam_notes} onChangeText={(v: string) => s('physical_exam_notes', v)} multiline colors={colors} />
          </Card>
        )}

        {/* Medicines at Enrollment (SAM only) */}
        {isSAM && (
          <Card title="Medicines at Enrollment" accent={accent} colors={colors}>
            <DatePickerField label="Amoxicillin Date" value={form.amoxicillin_date} onChange={(v: string) => s('amoxicillin_date', v)} colors={colors} />
            <FormField label="Amoxicillin Dosage" value={form.amoxicillin_dosage} onChangeText={(v: string) => s('amoxicillin_dosage', v)} colors={colors} />
            <DatePickerField label="Vitamin A Date" value={form.vitamin_a_date} onChange={(v: string) => s('vitamin_a_date', v)} colors={colors} />
            <FormField label="Vitamin A Dosage" value={form.vitamin_a_dosage} onChangeText={(v: string) => s('vitamin_a_dosage', v)} colors={colors} />
            <DatePickerField label="Folic Acid Date" value={form.folic_acid_date} onChange={(v: string) => s('folic_acid_date', v)} colors={colors} />
            <FormField label="Folic Acid Dosage" value={form.folic_acid_dosage} onChangeText={(v: string) => s('folic_acid_dosage', v)} colors={colors} />
            <DatePickerField label="Deworming Date" value={form.deworming_date} onChange={(v: string) => s('deworming_date', v)} colors={colors} />
            <FormField label="Deworming Dosage" value={form.deworming_dosage} onChangeText={(v: string) => s('deworming_dosage', v)} colors={colors} />
            <DatePickerField label="Measles Vaccine Date" value={form.measles_vaccine_date} onChange={(v: string) => s('measles_vaccine_date', v)} colors={colors} />
            <FormField label="Measles Vaccine Dosage" value={form.measles_vaccine_dosage} onChangeText={(v: string) => s('measles_vaccine_dosage', v)} colors={colors} />
            <DatePickerField label="Mebendazole Date" value={form.mebendazole_date} onChange={(v: string) => s('mebendazole_date', v)} colors={colors} />
            <DatePickerField label="Malaria Test Date" value={form.malaria_test_date} onChange={(v: string) => s('malaria_test_date', v)} colors={colors} />
            <PickerField label="Malaria Test Result" value={form.malaria_test_result} options={MALARIA_RES} onSelect={(v: string) => s('malaria_test_result', v)} colors={colors} />
            <DatePickerField label="Antimalarial Date" value={form.antimalarial_date} onChange={(v: string) => s('antimalarial_date', v)} colors={colors} />
            <FormField label="Antimalarial Dosage" value={form.antimalarial_dosage} onChangeText={(v: string) => s('antimalarial_dosage', v)} colors={colors} />
          </Card>
        )}

        {/* RUTF & Other Supplies (SAM only) */}
        {isSAM && (
          <Card title="RUTF & Other Supplies" accent={accent} colors={colors}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>RUTF Dosage Guide</Text>
              <TouchableOpacity onPress={() => Alert.alert('RUTF Dosage Guide', RUTF_GUIDE.map(r => `${r.weight} kg → ${r.week}/week (${r.day}/day)`).join('\n'), [{ text: 'OK' }])} activeOpacity={0.7}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>📊 Show Guide</Text>
              </TouchableOpacity>
            </View>
            <FormField label="Weight (kg) for RUTF Calc" value={form.weight_kg} onChangeText={(v: string) => { s('weight_kg', v); const w = parseFloat(v); const sachets = calcRutf(w); if (sachets) s('rutf_sachets_given', sachets.toString()); }} keyboardType="decimal-pad" colors={colors} />
            {form.weight_kg && calcRutf(parseFloat(form.weight_kg)) && (
              <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 8 }}>Suggested: {calcRutf(parseFloat(form.weight_kg))} sachets/week</Text>
            )}
            <FormField label="RUTF Sachets Given" value={form.rutf_sachets_given} onChangeText={(v: string) => s('rutf_sachets_given', v)} keyboardType="numeric" colors={colors} />
            <FormField label="RUTF Ration/day" value={form.rutf_ration_per_day} onChangeText={(v: string) => s('rutf_ration_per_day', v)} keyboardType="decimal-pad" colors={colors} />
            <DatePickerField label="Next Visit Date" value={form.next_visit_date} onChange={(v: string) => s('next_visit_date', v)} colors={colors} />
            <FormField label="Other Medicines" value={form.other_medicines} onChangeText={(v: string) => s('other_medicines', v)} multiline colors={colors} />
          </Card>
        )}

        {/* Other Medicines (SAM only) */}
        {isSAM && (
          <Card title="Other Medicines" accent={accent} colors={colors}>
            {[1,2,3].map((i) => (
              <View key={i}>
                <FormField label={`Drug ${i} Name`} value={form[`other_drug_${i}`]} onChangeText={(v: string) => s(`other_drug_${i}`, v)} colors={colors} />
                <DatePickerField label={`Drug ${i} Date`} value={form[`other_drug_${i}_date`]} onChange={(v: string) => s(`other_drug_${i}_date`, v)} colors={colors} />
                <FormField label={`Drug ${i} Dosage`} value={form[`other_drug_${i}_dosage`]} onChangeText={(v: string) => s(`other_drug_${i}_dosage`, v)} colors={colors} />
              </View>
            ))}
            <FormField label="Additional Notes" value={form.additional_notes} onChangeText={(v: string) => s('additional_notes', v)} multiline colors={colors} />
          </Card>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.7 : 1 }]}
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
  formCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeader: { borderLeftWidth: 4, paddingLeft: 10, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  card: { marginHorizontal: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldWrap: { marginBottom: 16, borderBottomWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { fontSize: 15, fontWeight: '500' },
  photoBox: { width: 110, height: 110, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', marginTop: 4, marginBottom: 16 },
  optionsList: { borderRadius: 10, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  optionText: { fontSize: 14, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: 14, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
