import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import { createClientUid, sendOrQueue } from '../../lib/offlineQueue';
import { useSyncStore } from '../../lib/sync-store';
import type { Facility } from '../../lib/types';
import { fetchFacilities } from '../../lib/facilities';
import { ageMonthsFromDob, dobFromAgeMonths } from '../../lib/age';
import { calcRutf, calcRutfPerDay, RUTF_GUIDE } from '../../lib/rutf';
import { checkIpcReferral, getAlertColors, getAdmissionType, getReportingCategory, type AutomationResult } from '../../lib/samOpcAutomation';
import DatePickerField from '../../components/DatePickerField';
import OfflineBanner from '../../components/OfflineBanner';
import AnthroGrowthCharts from '../../components/AnthroGrowthCharts';
import { autoZScoresFromPlot } from '../../lib/whoReference';

// ── Constants ────────────────────────────────────────────────────────────────
type CaseType = 'SAM' | 'MAM' | 'IPC';

// Auto-compute Z-score categories from plot position on chart
const autoZScores = (weight: string, height: string, ageMonths: string, gender: string) => {
  return autoZScoresFromPlot(weight, height, ageMonths, gender);
};
const SAM_STEPS = ['Child Info','Photo & Location','Anthropometry','Medical History','Physical Exam','Medicines','RUTF & Other','Notes','Review'];
const MAM_STEPS = ['Child Info','Photo & Location','Anthropometry','Medical','Medicines & Feeding','Review'];
const IPC_STEPS = ['Child & Facility','Admission','Anthropometry','Clinical & Danger','Review'];

const GENDER_OPTS = ['Male', 'Female'];
const YES_NO = ['Yes', 'No'];
const YES_NO_UNK = ['Yes', 'No', 'Unknown'];
const OEDEMA_OPTS = ['None', '+', '++', '+++'];
const CAREGIVER_REL = ['Mother','Father','Grandmother','Grandfather','Aunt','Uncle','Sibling','Other'];
const SAM_REFERRAL = ['Direct from community','Referred from health facility','Referred from IPC','Re-enrolment/relapse'];
const SAM_ENROL = ['MUAC < 11.5cm','WFH < -3SD','Bilateral oedema','MUAC < 11.0cm infant','WFA < -3SD infant'];
const WFH_Z = ['< -3 SD','-3 to < -2 SD','-2 to +1 SD','> +1 to +2 SD','> +2 SD'];
const WFA_Z = ['< -3 SD','-3 to < -2 SD','-2 to +2 SD','> +2 SD'];
const HFA_Z = ['< -3 SD','-3 to < -2 SD','-2 to +3 SD','> +3 SD'];
const STOOL_FREQ = ['1-3','4-5','>5'];
const APPETITE_SAM = ['Pass','Fail'];
const APPETITE_SIMPLE = ['Pass','Fail'];
const BF_PROSPECT = ['Good','Poor','None'];
const IMMUN_STATUS = ['Complete for Age','Not Complete for Age'];
const G6PD_OPTS = ['No Defect','Partial Defect','Full Defect'];
const RESP_RATE = ['<30','30-39','40-49','50-59','>=60'];
const EYE_COND = ['Normal','Sunken','Discharge'];
const CONJ_OPTS = ['Normal','Mild Pallor','Moderate Pallor','Severe Pallor'];
const EAR_COND = ['Normal','Discharge'];
const MOUTH_COND = ['Normal','Thrush','Sores'];
const LYMPH_OPTS = ['None','Neck','Axilla','Groin','Multiple'];
const HANDS_FEET = ['Normal','Cold'];
const SKIN_OPTS = ['None','Stained/Discolored','Peeling','Ulcers/Torn','Abscess'];
const MALARIA_RES = ['Positive','Negative','Not Done'];
const MAM_TYPES = ['High-risk MAM','Other MAM'];
const MAM_ENTRY = ['Direct New Enrolment','Referred from other MAM-OPC','Re-enrolment after defaulting'];
const MAM_ZSCORE = ['< -3 SD', '-3 to < -2 SD', '-2 to +1 SD', '> +1 to +2 SD', '> +2 SD'];
const FOOD_PROD = ['RUSF','CSB','Fortified Oil','Micronutrient Powder'];
const IPC_REF = ['Direct from community','Referred from health facility','Referred from OPC','Transfer from other IPC'];
const DANGER_SIGNS = ['Convulsions','Unconscious','Severe dehydration','Very high fever','Severe pneumonia','Severe anemia','Hypothermia','Hypoglycemia'];
const TC: Record<CaseType, string> = { SAM: '#dc2626', MAM: '#d97706', IPC: '#7c3aed' };

// ── Main Component ───────────────────────────────────────────────────────────
export default function CaseRegisterScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);

  const [caseType, setCaseType] = useState<CaseType>('SAM');
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilitiesFromCache, setFacilitiesFromCache] = useState(false);
  const [childPhoto, setChildPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [dangerSigns, setDangerSigns] = useState<string[]>([]);
  const [automationAlert, setAutomationAlert] = useState<AutomationResult | null>(null);
  const [autoAdmissionType, setAutoAdmissionType] = useState<string>('');
  const [autoReportingCategory, setAutoReportingCategory] = useState<string>('');
  const [regNumberPreview, setRegNumberPreview] = useState<string>('');

  const [f, setF] = useState<Record<string, string>>({
    facility_id: user?.location?.facility_id ? String(user.location.facility_id) : '',
    admission_date: today, child_name: '', child_gender: '', date_of_birth: '', age_months: '', age_weeks: '',
    malnutrition_type: 'SAM', mam_type: '', admission_type: 'New Admission',
    // MAM aggravating factors
    previous_sam_episode: '', failed_counselling_only: '', hiv_tb_status: 'None',
    poor_maternal_health: '', mother_deceased: '', household_vulnerability: 'None',
    community: '', house_location: '', travel_time: '',
    father_alive: '', mother_alive: '',
    caregiver_name: '', caregiver_phone: '', caregiver_relationship: '', total_household_members: '', referral_source: '',
    registration_latitude: '', registration_longitude: '',
    weight_kg: '', height_cm: '', muac_cm: '', oedema: '',
    z_score_wfh: '', z_score_wfa: '', z_score_hfa: '', enrolment_criteria: '',
    diarrhoea: '', stool_frequency: '', vomiting: '', cough: '',
    passing_urine: '', oedema_duration_days: '', appetite_test: '',
    breastfeeding_status: '', breastfeeding_prospect: '', effective_suckling: '', relactation_needed: '', visible_severe_wasting: '',
    immunization_status: '', g6pd_status: '', additional_medical_history: '',
    respiratory_rate: '', temperature_celsius: '', chest_indrawing: '',
    intractable_vomiting_sign: '', convulsions: '', lethargic_or_not_alert: '',
    unconscious: '', severe_dehydration: '', very_pale_or_severe_palmar_pallor: '',
    eyes_condition: '', conjunctiva: '', ears_condition: '', mouth_condition: '',
    lymph_nodes: '', hands_feet: '', skin_changes: '',
    disability: '', disability_details: '', physical_exam_notes: '',
    amoxicillin_date: '', amoxicillin_dosage: '',
    vitamin_a_date: '', vitamin_a_dosage: '',
    folic_acid_date: '', folic_acid_dosage: '',
    deworming_date: '', deworming_dosage: '',
    measles_vaccine_date: '', measles_vaccine_dosage: '',
    malaria_test_date: '', malaria_test_result: '',
    antimalarial_date: '', antimalarial_dosage: '',
    rutf_sachets_given: '', rutf_ration_per_day: '', next_visit_date: '',
    other_drug_1: '', other_drug_1_date: '', other_drug_1_dosage: '',
    other_drug_2: '', other_drug_2_date: '', other_drug_2_dosage: '',
    other_drug_3: '', other_drug_3_date: '', other_drug_3_dosage: '',
    additional_notes: '',
    entry_criteria: '', z_score_value: '', immunization_action: '',
    mebendazole_date: '', measles_vaccination_date: '', other_medicines: '',
    food_product_type: '', food_product_quantity: '', counselling: '',
    admission_time: '', referring_facility: '',
    wfh_zscore: '', bilateral_pitting_oedema: '', oedema_grade: '',
    medical_complications: '', complications_details: '', time_to_travel_minutes: '',
  });

  const s = useCallback((k: string, v: string) => setF((p: Record<string, string>) => ({ ...p, [k]: v })), []);

  // ponytail: fetch registration number preview when facility + type are set
  useEffect(() => {
    if (!f.facility_id) { setRegNumberPreview(''); return; }
    api.get(`/v1/cases/next-reg-number/?facility_id=${f.facility_id}&type=${caseType}`)
      .then((r: any) => setRegNumberPreview(r.data?.data?.registration_number ?? ''))
      .catch(() => setRegNumberPreview(''));
  }, [f.facility_id, caseType]);
  const steps = caseType === 'SAM' ? SAM_STEPS : caseType === 'MAM' ? MAM_STEPS : IPC_STEPS;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;
  const accent = TC[caseType];
  const inp: any = [styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }];

  const facilityType = caseType === 'IPC' ? 'IPC' : 'OPC';
  // Loads from network when online and falls back to the cached list offline,
  // so non-facility-level users can still pick a facility without a connection.
  useEffect(() => {
    let cancelled = false;
    fetchFacilities(facilityType).then(({ facilities: list, fromCache }) => {
      if (cancelled) return;
      setFacilities(list);
      setFacilitiesFromCache(fromCache);
    });
    return () => { cancelled = true; };
  }, [facilityType]);

  // Age is derived from the enrolment date, not today, so back-dated
  // registrations record the age the child was when actually enrolled.
  useEffect(() => {
    const months = ageMonthsFromDob(f.date_of_birth, f.admission_date);
    if (months !== null && months < 120) s('age_months', String(months));
  }, [f.date_of_birth, f.admission_date, s]);

  const ageToDoB = (v: string) => {
    const dob = dobFromAgeMonths(v, f.admission_date);
    if (dob) s('date_of_birth', dob);
  };

  const onTypeChange = (t: CaseType) => { setCaseType(t); setStepIdx(0); s('malnutrition_type', t); };

  // ponytail: Check automation rules including infant-specific IPC criteria
  const checkAutomation = useCallback(() => {
    if (caseType !== 'SAM') return;
    
    const ageMonths = parseInt(f.age_months, 10) || 0;
    
    const data = {
      age_months: ageMonths,
      weight_kg: parseFloat(f.weight_kg),
      oedema: f.oedema,
      appetite_test: f.appetite_test,
      temperature_c: parseFloat(f.temperature_celsius),
      respiratory_rate: parseInt(f.respiratory_rate),
      intractable_vomiting: f.intractable_vomiting_sign === 'Yes',
      convulsions: f.convulsions === 'Yes',
      lethargic: f.lethargic_or_not_alert === 'Yes',
      unconscious: f.unconscious === 'Yes',
      chest_indrawing: f.chest_indrawing === 'Yes',
      severe_dehydration: f.severe_dehydration === 'Yes',
      severe_pallor: f.very_pale_or_severe_palmar_pallor === 'Yes',
      // Infant-specific criteria
      breastfeeding_prospect: f.breastfeeding_prospect,
      effective_suckling: f.effective_suckling,
      relactation_needed: f.relactation_needed === 'Yes',
      visible_severe_wasting: f.visible_severe_wasting === 'Yes',
    };
    
    const result = checkIpcReferral(data);
    
    // Additional infant-specific validation
    if (ageMonths < 6) {
      const infantIpcReasons: string[] = [];
      
      if (f.oedema && f.oedema !== 'None') {
        infantIpcReasons.push(`Oedema present (${f.oedema}) - infants <6 months require IPC`);
      }
      if (f.visible_severe_wasting === 'Yes') {
        infantIpcReasons.push('Visible severe wasting - requires inpatient care');
      }
      if (f.effective_suckling === 'No') {
        infantIpcReasons.push('No effective suckling - cannot breastfeed');
      }
      if (f.breastfeeding_prospect === 'None' || f.breastfeeding_prospect === 'Poor' || f.breastfeeding_prospect === 'No') {
        infantIpcReasons.push('No prospect of breastfeeding - IPC referral required');
      }
      if (f.relactation_needed === 'Yes') {
        infantIpcReasons.push('Relactation needed - requires IPC support');
      }
      if (!f.breastfeeding_prospect && f.breastfeeding_status === 'Yes') {
        infantIpcReasons.push('⚠️ Breastfeeding prospect assessment required for infants <6 months');
      }
      
      if (infantIpcReasons.length > 0) {
        setAutomationAlert({
          needsAction: true,
          actionType: 'IPC_REFERRAL',
          title: '🚨 IPC Referral Required (Infant <6 months)',
          message: 'This infant should NOT be admitted to SAM OPC. Refer to IPC immediately.',
          reasons: infantIpcReasons,
          severity: 'critical'
        });
        return;
      }
    }
    
    setAutomationAlert(result.needsAction ? result : null);
  }, [caseType, f.age_months, f.weight_kg, f.oedema, f.appetite_test, f.temperature_celsius,
    f.respiratory_rate, f.intractable_vomiting_sign, f.convulsions, f.lethargic_or_not_alert,
    f.unconscious, f.chest_indrawing, f.severe_dehydration, f.very_pale_or_severe_palmar_pallor,
    f.breastfeeding_prospect, f.effective_suckling, f.relactation_needed, f.visible_severe_wasting,
    f.breastfeeding_status]);

  // Run automation check whenever relevant fields change (fixes stale state bug)
  useEffect(() => { checkAutomation(); }, [checkAutomation]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission', 'Location permission required'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      s('registration_latitude', loc.coords.latitude.toFixed(6));
      s('registration_longitude', loc.coords.longitude.toFixed(6));
      Alert.alert('Location', 'GPS coordinates captured');
    } catch { Alert.alert('Error', 'Unable to get location'); }
  };

  const toggleDanger = (sign: string) => setDangerSigns((p: string[]) => p.includes(sign) ? p.filter((x: string) => x !== sign) : [...p, sign]);
  const facilityName = facilities.find((fc: Facility) => String(fc.id) === f.facility_id)?.name || (user?.location?.facility_name ?? '—');

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!f.child_name) missing.push('Child Name');
    if (!f.child_gender) missing.push('Gender');
    if (!f.date_of_birth) missing.push('Date of Birth');
    if (!f.weight_kg) missing.push('Weight');
    if (!f.height_cm) missing.push('Height');
    if (!f.muac_cm) missing.push('MUAC');
    if (!f.facility_id) missing.push('Facility');
    if (!f.admission_date) missing.push('Admission Date');
    if (missing.length) { Alert.alert('Missing Fields', missing.join(', ')); return; }

    // MUAC range validation
    const muacVal = parseFloat(f.muac_cm);
    if (Number.isNaN(muacVal) || muacVal < 5 || muacVal > 30) {
      Alert.alert('Invalid MUAC', 'MUAC must be between 5 and 30 cm.'); return;
    }
    if (caseType === 'SAM' && muacVal >= 11.5 && f.oedema === 'None') {
      Alert.alert('MUAC Inconsistent', 'SAM requires MUAC < 11.5cm unless bilateral oedema is present.'); return;
    }
    if (caseType === 'MAM' && (muacVal < 11.5 || muacVal >= 12.5)) {
      Alert.alert('MUAC Inconsistent', 'MAM requires MUAC between 11.5 and 12.4 cm.'); return;
    }
    
    // CRITICAL: Block MAM admission for infants <6 months
    if (caseType === 'MAM' && parseInt(f.age_months || '0', 10) < 6) {
      Alert.alert(
        '🚨 MAM Exclusion',
        'Infants under 6 months cannot be admitted for MAM management.\n\n' +
        '• If complications or poor suckling → Refer to Hospital/IPC\n' +
        '• If no complications, breastfeeding possible → Manage via SAM OPC infant-at-risk pathway',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }
    
    setSubmitting(true);
    try {
      // Client-side duplicate check: scan offline queue for an identical pending registration
      const currentOwner = String(user?.id || '');
      const pendingQueue = useSyncStore.getState().queue.filter((q) => !q.ownerId || q.ownerId === currentOwner);
      const dup = pendingQueue.find((q) => {
        const expectedUrl = caseType === 'IPC' ? '/v1/ipc/cases/' : '/v1/cases/create/';
        if (q.url !== expectedUrl || q.method !== 'POST') return false;
        const d = q.data || {};
        const queuedName = d.child_name ?? d.patient_name;
        const queuedGender = d.child_gender ?? d.gender;
        return queuedName?.toString().trim().toLowerCase() === f.child_name.trim().toLowerCase()
          && String(d.facility_id) === String(f.facility_id)
          && d.admission_date === f.admission_date
          && (caseType === 'IPC'
            ? queuedGender === f.child_gender
            : d.date_of_birth === f.date_of_birth
              && (d.caregiver_name ?? '').toString().trim().toLowerCase() === (f.caregiver_name ?? '').trim().toLowerCase());
      });
      if (dup) {
        Alert.alert(
          'Duplicate Registration',
          `A case for "${f.child_name}" with the same caregiver, date of birth, and enrolment date is already pending sync for this facility. Please wait for it to sync before registering again.`,
        );
        return;
      }

      const toInt = (v: string) => { const n = parseInt(v, 10); return Number.isNaN(n) ? undefined : n; };
      const toFloat = (v: string) => { const n = parseFloat(v); return Number.isNaN(n) ? undefined : n; };
      const payload: Record<string, any> = {
        child_name: f.child_name, child_gender: f.child_gender, date_of_birth: f.date_of_birth,
        age_months: toInt(f.age_months) ?? 0, malnutrition_type: caseType,
        admission_date: f.admission_date, weight_kg: toFloat(f.weight_kg),
        height_cm: toFloat(f.height_cm), facility_id: toInt(f.facility_id),
        caregiver_name: f.caregiver_name, caregiver_phone: f.caregiver_phone,
        caregiver_relationship: f.caregiver_relationship, address: f.community,
        admission_type: f.admission_type || 'New Admission',
      };
      const clientUid = createClientUid();
      payload.client_uid = clientUid;
      payload.total_household_members = toInt(f.total_household_members);
      payload.muac_cm = toFloat(f.muac_cm);
      if (f.oedema) payload.oedema = f.oedema;
      if (f.appetite_test) payload.appetite_test = f.appetite_test;
      if (f.mam_type) payload.mam_type = f.mam_type;
      if (f.enrolment_criteria) payload.admission_criteria = f.enrolment_criteria;
      if (f.z_score_wfh) payload.z_score_wfh = f.z_score_wfh;
      if (f.z_score_wfa) payload.z_score_wfa = f.z_score_wfa;
      if (f.z_score_hfa) payload.z_score_hfa = f.z_score_hfa;
      if (f.registration_latitude) payload.registration_latitude = f.registration_latitude;
      if (f.registration_longitude) payload.registration_longitude = f.registration_longitude;
      if (f.medical_complications === 'Yes') payload.medical_complications = true;
      if (f.complications_details) { payload.complications_details = f.complications_details; payload.complications_notes = f.complications_details; }

      // Demographic/social fields
      if (f.father_alive) payload.father_alive = f.father_alive;
      if (f.mother_alive) payload.mother_alive = f.mother_alive;
      if (f.house_location) payload.house_location = f.house_location;
      if (f.travel_time) payload.travel_time = f.travel_time;
      if (f.referral_source) payload.referral_source = f.referral_source;

      // Additional admission/clinical detail fields
      if (f.admission_time) payload.admission_time = f.admission_time;
      if (f.referring_facility) payload.referring_facility = f.referring_facility;
      if (f.bilateral_pitting_oedema) payload.bilateral_pitting_oedema = f.bilateral_pitting_oedema;
      if (f.oedema_grade) payload.oedema_grade = f.oedema_grade;
      if (f.time_to_travel_minutes) payload.time_to_travel_minutes = parseInt(f.time_to_travel_minutes, 10);

      // Medical History
      if (f.diarrhoea) payload.diarrhoea = f.diarrhoea;
      if (f.stool_frequency) payload.stool_frequency = f.stool_frequency;
      if (f.vomiting) payload.vomiting = f.vomiting;
      if (f.cough) payload.cough = f.cough;
      if (f.passing_urine) payload.passing_urine = f.passing_urine;
      if (f.oedema_duration_days) payload.oedema_duration_days = f.oedema_duration_days;
      if (f.breastfeeding_status) payload.breastfeeding_status = f.breastfeeding_status;
      if (f.breastfeeding_prospect) payload.breastfeeding_prospect = f.breastfeeding_prospect;
      // Infant Under 6 Months Assessment
      if (f.age_weeks) payload.age_weeks = parseInt(f.age_weeks, 10);
      if (f.effective_suckling) payload.effective_suckling = f.effective_suckling;
      if (f.relactation_needed) payload.relactation_needed = f.relactation_needed === 'Yes';
      if (f.visible_severe_wasting) payload.visible_severe_wasting = f.visible_severe_wasting === 'Yes';
      if (f.immunization_status) payload.immunization_status = f.immunization_status;
      if (f.g6pd_status) payload.g6pd_status = f.g6pd_status;
      if (f.additional_medical_history) payload.additional_medical_history = f.additional_medical_history;

      // Physical Examination
      if (f.respiratory_rate) payload.respiratory_rate = f.respiratory_rate;
      if (f.temperature_celsius) payload.temperature_celsius = f.temperature_celsius;
      if (f.chest_indrawing) payload.chest_indrawing = f.chest_indrawing;
      if (f.intractable_vomiting_sign) payload.intractable_vomiting = f.intractable_vomiting_sign === 'Yes';
      if (f.convulsions) payload.convulsions = f.convulsions === 'Yes';
      if (f.lethargic_or_not_alert) payload.lethargic_or_not_alert = f.lethargic_or_not_alert === 'Yes';
      if (f.unconscious) payload.unconscious = f.unconscious === 'Yes';
      if (f.severe_dehydration) payload.severe_dehydration = f.severe_dehydration === 'Yes';
      if (f.very_pale_or_severe_palmar_pallor) payload.very_pale_or_severe_palmar_pallor = f.very_pale_or_severe_palmar_pallor === 'Yes';
      if (f.eyes_condition) payload.eyes_condition = f.eyes_condition;
      if (f.conjunctiva) payload.conjunctiva = f.conjunctiva;
      if (f.ears_condition) payload.ears_condition = f.ears_condition;
      if (f.mouth_condition) payload.mouth_condition = f.mouth_condition;
      if (f.lymph_nodes) payload.lymph_nodes = f.lymph_nodes;
      if (f.hands_feet) payload.hands_feet = f.hands_feet;
      if (f.skin_changes) payload.skin_changes = f.skin_changes;
      if (f.disability) payload.disability = f.disability;
      if (f.disability_details) payload.disability_details = f.disability_details;
      if (f.physical_exam_notes) payload.physical_exam_notes = f.physical_exam_notes;

      // Medicines at Enrollment
      if (f.amoxicillin_date) payload.amoxicillin_date = f.amoxicillin_date;
      if (f.amoxicillin_dosage) payload.amoxicillin_dosage = f.amoxicillin_dosage;
      if (f.vitamin_a_date) payload.vitamin_a_date = f.vitamin_a_date;
      if (f.vitamin_a_dosage) payload.vitamin_a_dosage = f.vitamin_a_dosage;
      if (f.folic_acid_date) payload.folic_acid_date = f.folic_acid_date;
      if (f.folic_acid_dosage) payload.folic_acid_dosage = f.folic_acid_dosage;
      if (f.deworming_date) payload.deworming_date = f.deworming_date;
      if (f.deworming_dosage) payload.deworming_dosage = f.deworming_dosage;
      if (f.measles_vaccine_date) payload.measles_vaccine_date = f.measles_vaccine_date;
      if (f.measles_vaccine_dosage) payload.measles_vaccine_dosage = f.measles_vaccine_dosage;
      if (f.malaria_test_date) payload.malaria_test_date = f.malaria_test_date;
      if (f.malaria_test_result) payload.malaria_test_result = f.malaria_test_result;
      if (f.antimalarial_date) payload.antimalarial_date = f.antimalarial_date;
      if (f.antimalarial_dosage) payload.antimalarial_dosage = f.antimalarial_dosage;

      // RUTF and Other Supplies
      if (f.rutf_sachets_given) { const n = toInt(f.rutf_sachets_given); if (n !== undefined) payload.rutf_sachets_given = n; }
      if (f.rutf_ration_per_day) { const n = toFloat(f.rutf_ration_per_day); if (n !== undefined) payload.rutf_ration_per_day = n; }
      if (f.next_visit_date) payload.next_visit_date = f.next_visit_date;

      // Other Medicines
      if (f.other_drug_1) payload.other_drug_1 = f.other_drug_1;
      if (f.other_drug_1_date) payload.other_drug_1_date = f.other_drug_1_date;
      if (f.other_drug_1_dosage) payload.other_drug_1_dosage = f.other_drug_1_dosage;
      if (f.other_drug_2) payload.other_drug_2 = f.other_drug_2;
      if (f.other_drug_2_date) payload.other_drug_2_date = f.other_drug_2_date;
      if (f.other_drug_2_dosage) payload.other_drug_2_dosage = f.other_drug_2_dosage;
      if (f.other_drug_3) payload.other_drug_3 = f.other_drug_3;
      if (f.other_drug_3_date) payload.other_drug_3_date = f.other_drug_3_date;
      if (f.other_drug_3_dosage) payload.other_drug_3_dosage = f.other_drug_3_dosage;

      // Additional Notes
      if (f.additional_notes) payload.additional_notes = f.additional_notes;
      
      // MAM-specific fields
      if (caseType === 'MAM') {
        if (f.entry_criteria) payload.admission_criteria = f.entry_criteria;
        if (f.previous_sam_episode) payload.previous_sam_episode = f.previous_sam_episode === 'Yes';
        if (f.failed_counselling_only) payload.failed_counselling_only = f.failed_counselling_only === 'Yes';
        if (f.hiv_tb_status) payload.hiv_tb_status = f.hiv_tb_status;
        if (f.poor_maternal_health) payload.poor_maternal_health = f.poor_maternal_health === 'Yes';
        if (f.mother_deceased) payload.mother_deceased = f.mother_deceased === 'Yes';
        if (f.household_vulnerability) payload.household_vulnerability = f.household_vulnerability;
        if (f.immunization_action) payload.immunization_action = f.immunization_action;
        if (f.food_product_type) payload.food_product_type = f.food_product_type;
        if (f.food_product_quantity) payload.food_product_quantity = f.food_product_quantity;
        if (f.counselling) payload.counselling = f.counselling;
        if (f.mebendazole_date) payload.mebendazole_date = f.mebendazole_date;
        if (f.measles_vaccination_date) payload.measles_vaccine_date = f.measles_vaccination_date;
        if (f.other_medicines) payload.other_medicines = f.other_medicines;
        if (f.disability === 'Yes') {
          payload.disability = 'Yes';
          if (f.disability_details) payload.disability_details = f.disability_details;
        }
      }
      const endpoint = caseType === 'IPC' ? '/v1/ipc/cases/' : '/v1/cases/create/';
      const submissionPayload = caseType === 'IPC' ? {
        client_uid: clientUid,
        patient_name: f.child_name,
        patient_age: toInt(f.age_months) ?? 0,
        gender: f.child_gender,
        admission_date: f.admission_date,
        weight: toFloat(f.weight_kg),
        height: toFloat(f.height_cm),
        muac: toFloat(f.muac_cm),
        facility_id: toInt(f.facility_id),
        status: 'Admitted',
      } : payload;
      let res;
      if (childPhoto && caseType !== 'IPC') {
        const fd = new FormData();
        Object.entries(submissionPayload).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); });
        fd.append('child_photo', { uri: childPhoto.uri, name: 'child_photo.jpg', type: childPhoto.mimeType || 'image/jpeg' } as any);
        res = await sendOrQueue(endpoint, 'post', fd, 'Case Registration');
      } else {
        res = await sendOrQueue(endpoint, 'post', submissionPayload, `${caseType} Case Registration`);
      }
      if (res) {
        const newId = res.data.data?.id;
        const stockWarnings: string[] = res.data.stock_warnings || [];
        const buttons = [{ text: 'Done', onPress: () => router.back() }];
        if (newId) {
          buttons.unshift({ text: 'View Case', onPress: () => router.replace({ pathname: '/case/[id]', params: { id: String(newId) } }) });
        }
        const message = stockWarnings.length > 0
          ? `Case registered successfully.\n\nStock warnings:\n${stockWarnings.join('\n')}`
          : 'Case registered successfully.';
        Alert.alert('Success', message, buttons);
      } else {
        const buttons: any[] = [{ text: 'Done', onPress: () => router.back() }];
        if (caseType !== 'IPC') {
          buttons.unshift({
            text: 'Record First Visit',
            onPress: () => router.replace({
              pathname: '/visit/[caseId]',
              params: {
                caseId: clientUid,
                caseClientUid: clientUid,
                caseName: f.child_name,
                caseType,
                caseAge: f.age_months,
                admissionWeight: f.weight_kg,
                facilityId: f.facility_id,
                visitNumber: '1',
              },
            }),
          });
        }
        Alert.alert('Saved Offline', 'The registration is safely stored and will sync automatically.', buttons);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to register case.');
    } finally { setSubmitting(false); }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accent, paddingTop: insets.top + 10 }]}>  
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>New Case Registration</Text>
            <Text style={styles.headerSub}>{facilityName}</Text>
          </View>
        </View>

        <OfflineBanner />

        {/* Type Tabs */}
        <View style={[styles.typeTabs, { backgroundColor: colors.surface }]}>
          {(['SAM','MAM','IPC'] as CaseType[]).map((t: CaseType) => {
            const active = caseType === t;
            return (
              <TouchableOpacity key={t} style={[styles.typeTab, active && { borderBottomColor: TC[t], borderBottomWidth: 3 }]} onPress={() => onTypeChange(t)} activeOpacity={0.7}>
                <Text style={[styles.typeTabText, { color: active ? TC[t] : colors.textMuted }]}>{t}</Text>
                <Text style={[styles.typeTabSub, { color: active ? TC[t] : colors.textMuted }]}>
                  {t === 'SAM' ? 'Severe Acute' : t === 'MAM' ? 'Moderate Acute' : 'Inpatient Care'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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

          {/* Automation Alert (ponytail: IPC referral warning) */}
          {automationAlert && caseType === 'SAM' && (() => {
            const ac = getAlertColors(automationAlert.priority ?? 'normal');
            return (
              <View style={{ marginHorizontal: 12, marginTop: 12, padding: 14, borderRadius: 12, borderLeftWidth: 4, backgroundColor: ac.bg, borderLeftColor: ac.border }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: ac.text, marginBottom: 6 }}>{automationAlert.title}</Text>
                <Text style={{ fontSize: 13, color: ac.text, marginBottom: 8 }}>{automationAlert.message}</Text>
                {automationAlert.reasons.map((reason, i) => (
                  <Text key={i} style={{ fontSize: 12, color: ac.text, marginLeft: 8, marginBottom: 2 }}>• {reason}</Text>
                ))}
                <Text style={{ fontSize: 13, fontWeight: '600', color: ac.text, marginTop: 8 }}>Suggested Action: {automationAlert.action}</Text>
              </View>
            );
          })()}

          {/* ══════════════════ SAM FORM ══════════════════ */}
          {caseType === 'SAM' && stepIdx === 0 && (
            <Card c={colors} title="1. Child's Information" accent={accent}>
              <Lbl text="Facility *" c={colors} />
              <FacilityPicker facilities={facilities} value={f.facility_id} onChange={(v: string) => s('facility_id', v)} colors={colors} fromCache={facilitiesFromCache} />
              {regNumberPreview ? (
                <View style={{ marginBottom: 10, padding: 12, backgroundColor: accent + '12', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: accent }}>
                  <Text style={{ fontSize: 11, color: accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Auto-Generated Registration #</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: accent, marginTop: 2, letterSpacing: 0.5 }}>{regNumberPreview}</Text>
                </View>
              ) : null}
              <Lbl text="Date of Enrolment *" c={colors} />
              <DatePickerField label="Date of Enrolment" value={f.admission_date} onChange={(v: string) => s('admission_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Child Name *" c={colors} />
              <TextInput style={inp} value={f.child_name} onChangeText={(v: string) => s('child_name', v)} placeholder="Enter child's name" placeholderTextColor={colors.textMuted} />
              <Lbl text="Date of Birth *" c={colors} />
              <DatePickerField label="Date of Birth" value={f.date_of_birth} onChange={(v: string) => s('date_of_birth', v)} colors={colors} maxDate={today} />
              <Lbl text="Age (months) *" c={colors} />
              <TextInput style={inp} value={f.age_months} onChangeText={(v: string) => { s('age_months', v); ageToDoB(v); const zs = autoZScores(f.weight_kg, f.height_cm, v, f.child_gender); if (zs.wfa) s('z_score_wfa', zs.wfa); if (zs.hfa) s('z_score_hfa', zs.hfa); }} keyboardType="number-pad" placeholder="Auto-calculated or enter" placeholderTextColor={colors.textMuted} />
              <Lbl text="Sex *" c={colors} />
              <Chips opts={GENDER_OPTS} val={f.child_gender} set={(v: string) => { s('child_gender', v); const zs = autoZScores(f.weight_kg, f.height_cm, f.age_months, v); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.wfa) s('z_score_wfa', zs.wfa); if (zs.hfa) s('z_score_hfa', zs.hfa); }} accent={accent} c={colors} />
              <Lbl text="Community/Locality *" c={colors} />
              <TextInput style={inp} value={f.community} onChangeText={(v: string) => s('community', v)} placeholder="Community or locality" placeholderTextColor={colors.textMuted} />
              <Lbl text="House Location" c={colors} />
              <TextInput style={inp} value={f.house_location} onChangeText={(v: string) => s('house_location', v)} placeholder="House location" placeholderTextColor={colors.textMuted} />
              <Lbl text="Time to Travel to Site" c={colors} />
              <TextInput style={inp} value={f.travel_time} onChangeText={(v: string) => s('travel_time', v)} placeholder="e.g. 30 mins" placeholderTextColor={colors.textMuted} />
              <Lbl text="Father Alive" c={colors} />
              <Chips opts={YES_NO_UNK} val={f.father_alive} set={(v: string) => s('father_alive', v)} accent={accent} c={colors} />
              <Lbl text="Mother Alive" c={colors} />
              <Chips opts={YES_NO_UNK} val={f.mother_alive} set={(v: string) => s('mother_alive', v)} accent={accent} c={colors} />
              <Lbl text="Caregiver Name *" c={colors} />
              <TextInput style={inp} value={f.caregiver_name} onChangeText={(v: string) => s('caregiver_name', v)} placeholder="Caregiver's name" placeholderTextColor={colors.textMuted} />
              <Lbl text="Caregiver Phone" c={colors} />
              <TextInput style={inp} value={f.caregiver_phone} onChangeText={(v: string) => s('caregiver_phone', v)} keyboardType="phone-pad" placeholder="e.g. 0201234567" placeholderTextColor={colors.textMuted} />
              <Lbl text="Caregiver Relationship" c={colors} />
              <Chips opts={CAREGIVER_REL} val={f.caregiver_relationship} set={(v: string) => s('caregiver_relationship', v)} accent={accent} c={colors} />
              <Lbl text="Total Number in Household" c={colors} />
              <TextInput style={inp} value={f.total_household_members} onChangeText={(v: string) => s('total_household_members', v)} keyboardType="number-pad" placeholder="e.g. 6" placeholderTextColor={colors.textMuted} />
              <Lbl text="Referral Source *" c={colors} />
              <Chips opts={SAM_REFERRAL} val={f.referral_source} set={(v: string) => {
                s('referral_source', v);
                const sourceMap: Record<string, string> = {
                  'Direct from community': 'community',
                  'Referred from health facility': 'health_facility_referral',
                  'Referred from IPC': 'inpatient_care_referral',
                  'Re-enrolment/relapse': 'relapse_after_cure',
                };
                const sourceValue = sourceMap[v] || 'community';
                const result = getAdmissionType(sourceValue);
                setAutoAdmissionType(result.admissionType);
                const category = getReportingCategory({
                  age_months: parseInt(f.age_months) || 0,
                  registration_source: sourceValue,
                  oedema: f.oedema
                });
                setAutoReportingCategory(category);
              }} accent={accent} c={colors} />
              {autoAdmissionType && (
                <View style={{ marginTop: 8, padding: 10, backgroundColor: colors.surface, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#3b82f6' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Auto-Selected Admission Type:</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{autoAdmissionType}</Text>
                </View>
              )}
              {autoReportingCategory && (
                <View style={{ marginTop: 8, padding: 10, backgroundColor: colors.surface, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#10b981' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Reporting Category:</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{autoReportingCategory}</Text>
                </View>
              )}
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 1 && (
            <Card c={colors} title="Photo & Registration Location" accent={accent}>
              <Lbl text="Child Photo" c={colors} />
              <PhotoPicker photo={childPhoto} onPick={setChildPhoto} colors={colors} />
              <Lbl text="Registration Location" c={colors} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[inp, { flex: 1 }]} value={f.registration_latitude} onChangeText={(v: string) => s('registration_latitude', v)} placeholder="Latitude" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                <TextInput style={[inp, { flex: 1 }]} value={f.registration_longitude} onChangeText={(v: string) => s('registration_longitude', v)} placeholder="Longitude" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              </View>
              <TouchableOpacity style={styles.gpsBtn} onPress={getLocation} activeOpacity={0.7}>
                <Ionicons name="navigate-outline" size={16} color="#16a34a" />
                <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 13 }}>Get Current Location</Text>
              </TouchableOpacity>
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 2 && (
            <Card c={colors} title="2. Anthropometry" accent={accent}>
              <Lbl text="Weight (kg) *" c={colors} />
              <TextInput style={inp} value={f.weight_kg} onChangeText={(v: string) => {
                s('weight_kg', v);
                const w = parseFloat(v);
                const sachets = calcRutf(w);
                if (sachets) s('rutf_sachets_given', sachets.toString());
                const perDay = calcRutfPerDay(w);
                if (perDay) s('rutf_ration_per_day', perDay.toString());
                const zs = autoZScores(v, f.height_cm, f.age_months, f.child_gender);
                if (zs.wfh) s('z_score_wfh', zs.wfh);
                if (zs.wfa) s('z_score_wfa', zs.wfa);
              }} keyboardType="decimal-pad" placeholder="e.g. 7.5" placeholderTextColor={colors.textMuted} />
              <Lbl text="Length/Height (cm) *" c={colors} />
              <TextInput style={inp} value={f.height_cm} onChangeText={(v: string) => {
                s('height_cm', v);
                const zs = autoZScores(f.weight_kg, v, f.age_months, f.child_gender);
                if (zs.wfh) s('z_score_wfh', zs.wfh);
                if (zs.hfa) s('z_score_hfa', zs.hfa);
              }} keyboardType="decimal-pad" placeholder="Length if <24mo, Height if ≥24mo" placeholderTextColor={colors.textMuted} />
              <Lbl text="MUAC (cm) *" c={colors} />
              <TextInput style={inp} value={f.muac_cm} onChangeText={(v: string) => s('muac_cm', v)} keyboardType="decimal-pad" placeholder="< 11.5 cm for SAM" placeholderTextColor={colors.textMuted} />
              <Lbl text="Bilateral Oedema" c={colors} />
              <Chips opts={OEDEMA_OPTS} val={f.oedema} set={(v: string) => { s('oedema', v); if (v === 'None') s('oedema_duration_days', ''); }} accent={accent} c={colors} />

              {/* WHO Growth Charts — gender-specific, clickable for zoom */}
              {f.child_gender && (parseFloat(f.weight_kg) > 0 || parseFloat(f.height_cm) > 0) && (
                <View style={{ marginTop: 12, marginBottom: 4 }}>
                  <AnthroGrowthCharts
                    gender={f.child_gender}
                    weight={parseFloat(f.weight_kg) || 0}
                    height={parseFloat(f.height_cm) || 0}
                    ageMonths={parseInt(f.age_months, 10) || 0}
                    colors={colors}
                  />
                </View>
              )}

              <Lbl text="Weight-for-Height Z-score" c={colors} />
              <Chips opts={WFH_Z} val={f.z_score_wfh} set={(v: string) => s('z_score_wfh', v)} accent={accent} c={colors} />
              <Lbl text="Weight-for-Age Z-score" c={colors} />
              <Chips opts={WFA_Z} val={f.z_score_wfa} set={(v: string) => s('z_score_wfa', v)} accent={accent} c={colors} />
              <Lbl text="Height-for-Age Z-score" c={colors} />
              <Chips opts={HFA_Z} val={f.z_score_hfa} set={(v: string) => s('z_score_hfa', v)} accent={accent} c={colors} />
              <Lbl text="Enrolment Criteria" c={colors} />
              <Chips opts={SAM_ENROL} val={f.enrolment_criteria} set={(v: string) => s('enrolment_criteria', v)} accent={accent} c={colors} />
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 3 && (
            <Card c={colors} title="3. Medical History" accent={accent}>
              <Lbl text="Diarrhoea" c={colors} />
              <Chips opts={YES_NO} val={f.diarrhoea} set={(v: string) => { s('diarrhoea', v); if (v !== 'Yes') s('stool_frequency', ''); }} accent={accent} c={colors} />
              {f.diarrhoea === 'Yes' && (
                <>
                  <Lbl text="Stool Frequency/Day" c={colors} />
                  <Chips opts={STOOL_FREQ} val={f.stool_frequency} set={(v: string) => s('stool_frequency', v)} accent={accent} c={colors} />
                </>
              )}
              <Lbl text="Vomiting" c={colors} />
              <Chips opts={YES_NO} val={f.vomiting} set={(v: string) => s('vomiting', v)} accent={accent} c={colors} />
              <Lbl text="Cough" c={colors} />
              <Chips opts={YES_NO} val={f.cough} set={(v: string) => s('cough', v)} accent={accent} c={colors} />
              <Lbl text="Passing Urine" c={colors} />
              <Chips opts={YES_NO} val={f.passing_urine} set={(v: string) => s('passing_urine', v)} accent={accent} c={colors} />
              {f.oedema && f.oedema !== 'None' && (
                <>
                  <Lbl text="Oedema Duration (days)" c={colors} />
                  <TextInput style={inp} value={f.oedema_duration_days} onChangeText={(v: string) => s('oedema_duration_days', v)} keyboardType="number-pad" placeholder="If oedema present" placeholderTextColor={colors.textMuted} />
                </>
              )}
              <Lbl text="Appetite (RUTF Test)" c={colors} />
              <Chips opts={APPETITE_SAM} val={f.appetite_test} set={(v: string) => s('appetite_test', v)} accent={accent} c={colors} />
              <Lbl text="Breastfeeding Status" c={colors} />
              <Chips opts={YES_NO} val={f.breastfeeding_status} set={(v: string) => s('breastfeeding_status', v)} accent={accent} c={colors} />
              {f.breastfeeding_status === 'Yes' && (
                <><Lbl text="Prospect of Breastfeeding" c={colors} />
                <Chips opts={BF_PROSPECT} val={f.breastfeeding_prospect} set={(v: string) => s('breastfeeding_prospect', v)} accent={accent} c={colors} /></>
              )}
              
              {/* INFANT UNDER 6 MONTHS SPECIFIC FIELDS */}
              {parseInt(f.age_months || '0', 10) < 6 && (
                <>
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>⚠️ Infant Under 6 Months Assessment</Text>
                  </View>
                  <Lbl text="Age in Weeks" c={colors} />
                  <TextInput style={inp} value={f.age_weeks} onChangeText={(v: string) => s('age_weeks', v)} keyboardType="number-pad" placeholder="Required for infants <6 months" placeholderTextColor={colors.textMuted} />
                  <Lbl text="Effective Suckling" c={colors} />
                  <Chips opts={['Yes', 'Poor', 'No']} val={f.effective_suckling} set={(v: string) => s('effective_suckling', v)} accent={accent} c={colors} />
                  <Lbl text="Relactation Needed" c={colors} />
                  <Chips opts={YES_NO} val={f.relactation_needed} set={(v: string) => s('relactation_needed', v)} accent={accent} c={colors} />
                  <Lbl text="Visible Severe Wasting" c={colors} />
                  <Chips opts={YES_NO} val={f.visible_severe_wasting} set={(v: string) => s('visible_severe_wasting', v)} accent={accent} c={colors} />
                </>
              )}
              
              <Lbl text="Immunization Status" c={colors} />
              <Chips opts={IMMUN_STATUS} val={f.immunization_status} set={(v: string) => s('immunization_status', v)} accent={accent} c={colors} />
              <Lbl text="G6PD Status" c={colors} />
              <Chips opts={G6PD_OPTS} val={f.g6pd_status} set={(v: string) => s('g6pd_status', v)} accent={accent} c={colors} />
              <Lbl text="Additional Medical History" c={colors} />
              <TextInput style={[inp, styles.textArea]} value={f.additional_medical_history} onChangeText={(v: string) => s('additional_medical_history', v)} multiline placeholder="Any relevant medical info..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 4 && (
            <Card c={colors} title="4. Physical Examination" accent={accent}>
              <Lbl text="Respiratory Rate (/min)" c={colors} />
              <Chips opts={RESP_RATE} val={f.respiratory_rate} set={(v: string) => s('respiratory_rate', v)} accent={accent} c={colors} />
              <Lbl text="Temperature (°C)" c={colors} />
              <TextInput style={inp} value={f.temperature_celsius} onChangeText={(v: string) => s('temperature_celsius', v)} keyboardType="decimal-pad" placeholder="e.g. 37.5" placeholderTextColor={colors.textMuted} />
              <Lbl text="Chest Indrawing" c={colors} />
              <Chips opts={YES_NO} val={f.chest_indrawing} set={(v: string) => s('chest_indrawing', v)} accent={accent} c={colors} />
              <Lbl text="Intractable Vomiting" c={colors} />
              <Chips opts={YES_NO} val={f.intractable_vomiting_sign} set={(v: string) => s('intractable_vomiting_sign', v)} accent={accent} c={colors} />
              <Lbl text="Convulsions" c={colors} />
              <Chips opts={YES_NO} val={f.convulsions} set={(v: string) => s('convulsions', v)} accent={accent} c={colors} />
              <Lbl text="Lethargic / Not Alert" c={colors} />
              <Chips opts={YES_NO} val={f.lethargic_or_not_alert} set={(v: string) => s('lethargic_or_not_alert', v)} accent={accent} c={colors} />
              <Lbl text="Unconscious" c={colors} />
              <Chips opts={YES_NO} val={f.unconscious} set={(v: string) => s('unconscious', v)} accent={accent} c={colors} />
              <Lbl text="Severe Dehydration" c={colors} />
              <Chips opts={YES_NO} val={f.severe_dehydration} set={(v: string) => s('severe_dehydration', v)} accent={accent} c={colors} />
              <Lbl text="Very Pale / Severe Palmar Pallor" c={colors} />
              <Chips opts={YES_NO} val={f.very_pale_or_severe_palmar_pallor} set={(v: string) => s('very_pale_or_severe_palmar_pallor', v)} accent={accent} c={colors} />
              <Lbl text="Eyes" c={colors} />
              <Chips opts={EYE_COND} val={f.eyes_condition} set={(v: string) => s('eyes_condition', v)} accent={accent} c={colors} />
              <Lbl text="Conjunctiva (Pallor)" c={colors} />
              <Chips opts={CONJ_OPTS} val={f.conjunctiva} set={(v: string) => s('conjunctiva', v)} accent={accent} c={colors} />
              <Lbl text="Ears" c={colors} />
              <Chips opts={EAR_COND} val={f.ears_condition} set={(v: string) => s('ears_condition', v)} accent={accent} c={colors} />
              <Lbl text="Mouth" c={colors} />
              <Chips opts={MOUTH_COND} val={f.mouth_condition} set={(v: string) => s('mouth_condition', v)} accent={accent} c={colors} />
              <Lbl text="Enlarged Lymph Nodes" c={colors} />
              <Chips opts={LYMPH_OPTS} val={f.lymph_nodes} set={(v: string) => s('lymph_nodes', v)} accent={accent} c={colors} />
              <Lbl text="Hands & Feet" c={colors} />
              <Chips opts={HANDS_FEET} val={f.hands_feet} set={(v: string) => s('hands_feet', v)} accent={accent} c={colors} />
              <Lbl text="Skin Changes" c={colors} />
              <Chips opts={SKIN_OPTS} val={f.skin_changes} set={(v: string) => s('skin_changes', v)} accent={accent} c={colors} />
              <Lbl text="Disability" c={colors} />
              <Chips opts={YES_NO} val={f.disability} set={(v: string) => s('disability', v)} accent={accent} c={colors} />
              {f.disability === 'Yes' && (
                <><Lbl text="Specify Disability" c={colors} />
                <TextInput style={inp} value={f.disability_details} onChangeText={(v: string) => s('disability_details', v)} placeholder="Type of disability" placeholderTextColor={colors.textMuted} /></>
              )}
              <Lbl text="Additional Notes" c={colors} />
              <TextInput style={[inp, styles.textArea]} value={f.physical_exam_notes} onChangeText={(v: string) => s('physical_exam_notes', v)} multiline placeholder="Findings..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 5 && (
            <Card c={colors} title="5. Routine Medicines at Enrolment" accent={accent}>
              <MedRow label="Amoxicillin" dk="amoxicillin_date" dosK="amoxicillin_dosage" f={f} s={s} inp={inp} c={colors} />
              <MedRow label="Vitamin A" dk="vitamin_a_date" dosK="vitamin_a_dosage" f={f} s={s} inp={inp} c={colors} />
              <MedRow label="Folic Acid" dk="folic_acid_date" dosK="folic_acid_dosage" f={f} s={s} inp={inp} c={colors} />
              <MedRow label="Albendazole/Mebendazole" dk="deworming_date" dosK="deworming_dosage" f={f} s={s} inp={inp} c={colors} />
              <MedRow label="Measles Vaccine" dk="measles_vaccine_date" dosK="measles_vaccine_dosage" f={f} s={s} inp={inp} c={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Lbl text="Malaria Test Date" c={colors} />
              <DatePickerField label="Malaria Test Date" value={f.malaria_test_date} onChange={(v: string) => s('malaria_test_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Malaria Test Result" c={colors} />
              <Chips opts={MALARIA_RES} val={f.malaria_test_result} set={(v: string) => s('malaria_test_result', v)} accent={accent} c={colors} />
              {f.malaria_test_result === 'Positive' && (
                <MedRow label="Antimalarial" dk="antimalarial_date" dosK="antimalarial_dosage" f={f} s={s} inp={inp} c={colors} />
              )}
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 6 && (
            <Card c={colors} title="6. RUTF Ration & 7. Other Medicines" accent={accent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Lbl text="RUTF Sachets Given" c={colors} />
                <TouchableOpacity onPress={() => Alert.alert('RUTF Dosage Guide', RUTF_GUIDE.map(r => `${r.weight} kg → ${r.week}/week (${r.day}/day)`).join('\n'), [{ text: 'OK' }])} activeOpacity={0.7}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>📊 Guide</Text>
                </TouchableOpacity>
              </View>
              {f.weight_kg && calcRutf(parseFloat(f.weight_kg)) && (
                <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 6 }}>Suggested: {calcRutf(parseFloat(f.weight_kg))} sachets/week ({calcRutfPerDay(parseFloat(f.weight_kg))}/day)</Text>
              )}
              <TextInput style={inp} value={f.rutf_sachets_given} onChangeText={(v: string) => s('rutf_sachets_given', v)} keyboardType="number-pad" placeholder="Number of sachets" placeholderTextColor={colors.textMuted} />
              <Lbl text="RUTF Ration (sachets/day)" c={colors} />
              <TextInput style={[inp, { backgroundColor: colors.background, color: colors.textMuted }]} value={f.rutf_ration_per_day} editable={false} placeholder="Auto-calculated from weight" placeholderTextColor={colors.textMuted} />
              <Lbl text="Next Visit Date" c={colors} />
              <DatePickerField label="Next Visit Date" value={f.next_visit_date} onChange={(v: string) => s('next_visit_date', v)} colors={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.subHead, { color: colors.textPrimary }]}>Other Medicines</Text>
              {[1,2,3].map((i: number) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput style={[inp, { flex: 2 }]} value={f[`other_drug_${i}`]} onChangeText={(v: string) => s(`other_drug_${i}`, v)} placeholder={`Drug ${i} name`} placeholderTextColor={colors.textMuted} />
                    <TextInput style={[inp, { flex: 1 }]} value={f[`other_drug_${i}_dosage`]} onChangeText={(v: string) => s(`other_drug_${i}_dosage`, v)} placeholder="Dosage" placeholderTextColor={colors.textMuted} />
                  </View>
                  <DatePickerField label={`Drug ${i} Date`} value={f[`other_drug_${i}_date`]} onChange={(v: string) => s(`other_drug_${i}_date`, v)} colors={colors} />
                </View>
              ))}
            </Card>
          )}

          {caseType === 'SAM' && stepIdx === 7 && (
            <Card c={colors} title="8. Additional Notes" accent={accent}>
              <Lbl text="Comments / Additional Information" c={colors} />
              <TextInput style={[inp, { minHeight: 120 }]} value={f.additional_notes} onChangeText={(v: string) => s('additional_notes', v)} multiline placeholder="Any additional information about the case..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
            </Card>
          )}

          {/* ══════════════════ MAM FORM ══════════════════ */}
          {caseType === 'MAM' && stepIdx === 0 && (
            <Card c={colors} title="Child Information" accent={accent}>
              <Lbl text="Name of Outpatient Care Site *" c={colors} />
              <FacilityPicker facilities={facilities} value={f.facility_id} onChange={(v: string) => s('facility_id', v)} colors={colors} fromCache={facilitiesFromCache} />
              {regNumberPreview ? (
                <View style={{ marginBottom: 10, padding: 12, backgroundColor: accent + '12', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: accent }}>
                  <Text style={{ fontSize: 11, color: accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Auto-Generated Registration #</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: accent, marginTop: 2, letterSpacing: 0.5 }}>{regNumberPreview}</Text>
                </View>
              ) : null}
              <Lbl text="Date of Enrolment *" c={colors} />
              <DatePickerField label="Date of Enrolment" value={f.admission_date} onChange={(v: string) => s('admission_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Type of MAM Treatment" c={colors} />
              <Chips opts={MAM_TYPES} val={f.mam_type} set={(v: string) => s('mam_type', v)} accent={accent} c={colors} />
              <Lbl text="Name of Child *" c={colors} />
              <TextInput style={inp} value={f.child_name} onChangeText={(v: string) => s('child_name', v)} placeholder="Enter child's name" placeholderTextColor={colors.textMuted} />
              <Lbl text="Date of Birth *" c={colors} />
              <DatePickerField label="Date of Birth" value={f.date_of_birth} onChange={(v: string) => s('date_of_birth', v)} colors={colors} maxDate={today} />
              <Lbl text="Age (months) *" c={colors} />
              <TextInput style={inp} value={f.age_months} onChangeText={(v: string) => { s('age_months', v); ageToDoB(v); const zs = autoZScores(f.weight_kg, f.height_cm, v, f.child_gender); if (zs.wfa) s('z_score_wfa', zs.wfa); if (zs.hfa) s('z_score_hfa', zs.hfa); }} keyboardType="number-pad" placeholder="6-59" placeholderTextColor={colors.textMuted} />
              <Lbl text="Sex *" c={colors} />
              <Chips opts={GENDER_OPTS} val={f.child_gender} set={(v: string) => { s('child_gender', v); const zs = autoZScores(f.weight_kg, f.height_cm, f.age_months, v); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.wfa) s('z_score_wfa', zs.wfa); if (zs.hfa) s('z_score_hfa', zs.hfa); }} accent={accent} c={colors} />
              <Lbl text="Caregiver's Name *" c={colors} />
              <TextInput style={inp} value={f.caregiver_name} onChangeText={(v: string) => s('caregiver_name', v)} placeholder="Caregiver's name" placeholderTextColor={colors.textMuted} />
              <Lbl text="Caregiver's Phone" c={colors} />
              <TextInput style={inp} value={f.caregiver_phone} onChangeText={(v: string) => s('caregiver_phone', v)} keyboardType="phone-pad" placeholder="e.g. 0201234567" placeholderTextColor={colors.textMuted} />
              <Lbl text="Caregiver's Relationship" c={colors} />
              <Chips opts={CAREGIVER_REL} val={f.caregiver_relationship} set={(v: string) => s('caregiver_relationship', v)} accent={accent} c={colors} />
              <Lbl text="Total Number in Household" c={colors} />
              <TextInput style={inp} value={f.total_household_members} onChangeText={(v: string) => s('total_household_members', v)} keyboardType="number-pad" placeholder="e.g. 6" placeholderTextColor={colors.textMuted} />
              <Lbl text="Community *" c={colors} />
              <TextInput style={inp} value={f.community} onChangeText={(v: string) => s('community', v)} placeholder="Community name" placeholderTextColor={colors.textMuted} />
            </Card>
          )}

          {caseType === 'MAM' && stepIdx === 1 && (
            <Card c={colors} title="Photo & Registration Location" accent={accent}>
              <Lbl text="Child Photo" c={colors} />
              <PhotoPicker photo={childPhoto} onPick={setChildPhoto} colors={colors} />
              <Lbl text="Registration Location" c={colors} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[inp, { flex: 1 }]} value={f.registration_latitude} onChangeText={(v: string) => s('registration_latitude', v)} placeholder="Latitude" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                <TextInput style={[inp, { flex: 1 }]} value={f.registration_longitude} onChangeText={(v: string) => s('registration_longitude', v)} placeholder="Longitude" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              </View>
              <TouchableOpacity style={styles.gpsBtn} onPress={getLocation} activeOpacity={0.7}>
                <Ionicons name="navigate-outline" size={16} color="#16a34a" />
                <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 13 }}>Get Current Location</Text>
              </TouchableOpacity>
            </Card>
          )}

          {caseType === 'MAM' && stepIdx === 2 && (
            <Card c={colors} title="Entry Criteria & Anthropometry" accent={accent}>
              {/* INFANT <6 MONTHS EXCLUSION WARNING */}
              {parseInt(f.age_months || '0', 10) < 6 && (
                <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#dc2626' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626', marginBottom: 4 }}>🚨 MAM Exclusion: Infant Under 6 Months</Text>
                  <Text style={{ fontSize: 12, color: '#991b1b', lineHeight: 18 }}>
                    Infants less than 6 months are NOT admitted for MAM management.{'\n'}
                    • If complications or poor suckling → Refer to Hospital/IPC{'\n'}
                    • If no complications, breastfeeding possible → Manage via SAM OPC infant-at-risk pathway
                  </Text>
                </View>
              )}
              
              <Lbl text="Entry Criteria" c={colors} />
              <Chips opts={MAM_ENTRY} val={f.entry_criteria} set={(v: string) => s('entry_criteria', v)} accent={accent} c={colors} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.subHead, { color: colors.textPrimary }]}>Anthropometric Measurements</Text>
              <Lbl text="Weight (kg) *" c={colors} />
              <TextInput style={inp} value={f.weight_kg} onChangeText={(v: string) => { s('weight_kg', v); const zs = autoZScores(v, f.height_cm, f.age_months, f.child_gender); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.wfa) s('z_score_wfa', zs.wfa); }} keyboardType="decimal-pad" placeholder="e.g. 8.0" placeholderTextColor={colors.textMuted} />
              <Lbl text="Height (cm) *" c={colors} />
              <TextInput style={inp} value={f.height_cm} onChangeText={(v: string) => { s('height_cm', v); const zs = autoZScores(f.weight_kg, v, f.age_months, f.child_gender); if (zs.wfh) s('z_score_wfh', zs.wfh); if (zs.hfa) s('z_score_hfa', zs.hfa); }} keyboardType="decimal-pad" placeholder="e.g. 72.0" placeholderTextColor={colors.textMuted} />

              {/* WHO Growth Charts — gender-specific, clickable for zoom */}
              {f.child_gender && (parseFloat(f.weight_kg) > 0 || parseFloat(f.height_cm) > 0) && (
                <View style={{ marginTop: 12, marginBottom: 4 }}>
                  <AnthroGrowthCharts
                    gender={f.child_gender}
                    weight={parseFloat(f.weight_kg) || 0}
                    height={parseFloat(f.height_cm) || 0}
                    ageMonths={parseInt(f.age_months, 10) || 0}
                    colors={colors}
                  />
                </View>
              )}

              <Lbl text="WFL/H Z-Score" c={colors} />
              <Chips opts={MAM_ZSCORE} val={f.z_score_wfh} set={(v: string) => s('z_score_wfh', v)} accent={accent} c={colors} />
              <Lbl text="MUAC (cm) *" c={colors} />
              <TextInput style={inp} value={f.muac_cm} onChangeText={(v: string) => s('muac_cm', v)} keyboardType="decimal-pad" placeholder="11.5 - 12.4 cm for MAM" placeholderTextColor={colors.textMuted} />
              
              {/* AGGRAVATING FACTORS ASSESSMENT */}
              {parseInt(f.age_months || '0', 10) >= 6 && (
                <>
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                      📋 Aggravating Factors Assessment (for High-risk MAM classification)
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 18 }}>
                      Check if any of the following factors are present. These determine if child should be classified as High-risk MAM vs Other MAM.
                    </Text>
                  </View>
                  
                  <Lbl text="Previous SAM Episode" c={colors} />
                  <Chips opts={YES_NO} val={f.previous_sam_episode} set={(v: string) => s('previous_sam_episode', v)} accent={accent} c={colors} />
                  
                  <Lbl text="Failed to Recover with Counselling Only" c={colors} />
                  <Chips opts={YES_NO} val={f.failed_counselling_only} set={(v: string) => s('failed_counselling_only', v)} accent={accent} c={colors} />
                  
                  <Lbl text="HIV/TB Status" c={colors} />
                  <Chips opts={['None', 'HIV Positive', 'TB Positive', 'HIV+TB', 'Suspected']} val={f.hiv_tb_status} set={(v: string) => s('hiv_tb_status', v)} accent={accent} c={colors} />
                  
                  <Lbl text="Poor Maternal Health" c={colors} />
                  <Chips opts={YES_NO} val={f.poor_maternal_health} set={(v: string) => s('poor_maternal_health', v)} accent={accent} c={colors} />
                  
                  <Lbl text="Mother Deceased" c={colors} />
                  <Chips opts={YES_NO} val={f.mother_deceased} set={(v: string) => s('mother_deceased', v)} accent={accent} c={colors} />
                  
                  <Lbl text="Household Vulnerability Level" c={colors} />
                  <Chips opts={['None', 'Low', 'Moderate', 'High', 'Severe']} val={f.household_vulnerability} set={(v: string) => s('household_vulnerability', v)} accent={accent} c={colors} />
                  
                  <Lbl text="Disability" c={colors} />
                  <Chips opts={YES_NO} val={f.disability} set={(v: string) => s('disability', v)} accent={accent} c={colors} />
                  {f.disability === 'Yes' && (
                    <><Lbl text="Specify Disability" c={colors} />
                    <TextInput style={inp} value={f.disability_details} onChangeText={(v: string) => s('disability_details', v)} placeholder="Type of disability" placeholderTextColor={colors.textMuted} /></>
                  )}
                </>
              )}
            </Card>
          )}

          {caseType === 'MAM' && stepIdx === 3 && (
            <Card c={colors} title="Medical Assessment" accent={accent}>
              <Lbl text="Immunization Status" c={colors} />
              <Chips opts={IMMUN_STATUS} val={f.immunization_status} set={(v: string) => s('immunization_status', v)} accent={accent} c={colors} />
              {f.immunization_status === 'Not Complete for Age' && (
                <><Lbl text="Action Taken if Not Complete" c={colors} />
                <TextInput style={inp} value={f.immunization_action} onChangeText={(v: string) => s('immunization_action', v)} placeholder="Describe action taken" placeholderTextColor={colors.textMuted} /></>
              )}
              <Lbl text="Appetite Test" c={colors} />
              <Chips opts={APPETITE_SIMPLE} val={f.appetite_test} set={(v: string) => s('appetite_test', v)} accent={accent} c={colors} />
            </Card>
          )}

          {caseType === 'MAM' && stepIdx === 4 && (
            <Card c={colors} title="Routine Medicines & Feeding" accent={accent}>
              <Text style={[styles.subHead, { color: colors.textPrimary }]}>Routine Medicines</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>Record date when each medicine is given</Text>
              <Lbl text="Vitamin A (date)" c={colors} />
              <DatePickerField label="Vitamin A Date" value={f.vitamin_a_date} onChange={(v: string) => s('vitamin_a_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Mebendazole (date)" c={colors} />
              <DatePickerField label="Mebendazole Date" value={f.mebendazole_date} onChange={(v: string) => s('mebendazole_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Measles Vaccination (date)" c={colors} />
              <DatePickerField label="Measles Vaccination Date" value={f.measles_vaccination_date} onChange={(v: string) => s('measles_vaccination_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Other Medicines" c={colors} />
              <TextInput style={[inp, styles.textArea]} value={f.other_medicines} onChangeText={(v: string) => s('other_medicines', v)} multiline placeholder="Record any other medicines given" placeholderTextColor={colors.textMuted} textAlignVertical="top" />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.subHead, { color: colors.textPrimary }]}>Therapeutic Feeding / Counselling</Text>
              <Lbl text="Food Product Type" c={colors} />
              <Chips opts={FOOD_PROD} val={f.food_product_type} set={(v: string) => s('food_product_type', v)} accent={accent} c={colors} />
              <Lbl text="Quantity" c={colors} />
              <TextInput style={inp} value={f.food_product_quantity} onChangeText={(v: string) => s('food_product_quantity', v)} placeholder="e.g. 500g, 2 sachets" placeholderTextColor={colors.textMuted} />
              <Lbl text="Counselling" c={colors} />
              <TextInput style={inp} value={f.counselling} onChangeText={(v: string) => s('counselling', v)} placeholder="e.g. Feeding practices" placeholderTextColor={colors.textMuted} />
            </Card>
          )}

          {/* ══════════════════ IPC FORM ══════════════════ */}
          {caseType === 'IPC' && stepIdx === 0 && (
            <Card c={colors} title="Facility & Child Information" accent={accent}>
              <Lbl text="IPC Facility *" c={colors} />
              <FacilityPicker facilities={facilities} value={f.facility_id} onChange={(v: string) => s('facility_id', v)} colors={colors} fromCache={facilitiesFromCache} />
              <Lbl text="Child Name *" c={colors} />
              <TextInput style={inp} value={f.child_name} onChangeText={(v: string) => s('child_name', v)} placeholder="Enter child's name" placeholderTextColor={colors.textMuted} />
              <Lbl text="Date of Birth *" c={colors} />
              <DatePickerField label="Date of Birth" value={f.date_of_birth} onChange={(v: string) => s('date_of_birth', v)} colors={colors} maxDate={today} />
              <Lbl text="Age (months) *" c={colors} />
              <TextInput style={inp} value={f.age_months} onChangeText={(v: string) => { s('age_months', v); ageToDoB(v); }} keyboardType="number-pad" placeholder="6-59" placeholderTextColor={colors.textMuted} />
              <Lbl text="Gender *" c={colors} />
              <Chips opts={GENDER_OPTS} val={f.child_gender} set={(v: string) => s('child_gender', v)} accent={accent} c={colors} />
              <Lbl text="Caregiver Name *" c={colors} />
              <TextInput style={inp} value={f.caregiver_name} onChangeText={(v: string) => s('caregiver_name', v)} placeholder="Caregiver's name" placeholderTextColor={colors.textMuted} />
              <Lbl text="Caregiver Phone" c={colors} />
              <TextInput style={inp} value={f.caregiver_phone} onChangeText={(v: string) => s('caregiver_phone', v)} keyboardType="phone-pad" placeholder="e.g. 0201234567" placeholderTextColor={colors.textMuted} />
              <Lbl text="House Location" c={colors} />
              <TextInput style={inp} value={f.house_location} onChangeText={(v: string) => s('house_location', v)} placeholder="House location" placeholderTextColor={colors.textMuted} />
              <Lbl text="Time to Travel (minutes)" c={colors} />
              <TextInput style={inp} value={f.time_to_travel_minutes} onChangeText={(v: string) => s('time_to_travel_minutes', v)} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor={colors.textMuted} />
            </Card>
          )}

          {caseType === 'IPC' && stepIdx === 1 && (
            <Card c={colors} title="Admission Information" accent={accent}>
              <Lbl text="Admission Date *" c={colors} />
              <DatePickerField label="Admission Date" value={f.admission_date} onChange={(v: string) => s('admission_date', v)} colors={colors} maxDate={today} />
              <Lbl text="Admission Time" c={colors} />
              <TextInput style={inp} value={f.admission_time} onChangeText={(v: string) => s('admission_time', v)} placeholder="HH:MM (24hr)" placeholderTextColor={colors.textMuted} />
              <Lbl text="Referral Source *" c={colors} />
              <Chips opts={IPC_REF} val={f.referral_source} set={(v: string) => s('referral_source', v)} accent={accent} c={colors} />
              <Lbl text="Referring Facility" c={colors} />
              <TextInput style={inp} value={f.referring_facility} onChangeText={(v: string) => s('referring_facility', v)} placeholder="Type facility name..." placeholderTextColor={colors.textMuted} />
            </Card>
          )}

          {caseType === 'IPC' && stepIdx === 2 && (
            <Card c={colors} title="Anthropometric Measurements" accent={accent}>
              <Lbl text="Weight (kg) *" c={colors} />
              <TextInput style={inp} value={f.weight_kg} onChangeText={(v: string) => s('weight_kg', v)} keyboardType="decimal-pad" placeholder="e.g. 5.5" placeholderTextColor={colors.textMuted} />
              <Lbl text="Height (cm) *" c={colors} />
              <TextInput style={inp} value={f.height_cm} onChangeText={(v: string) => s('height_cm', v)} keyboardType="decimal-pad" placeholder="e.g. 60.0" placeholderTextColor={colors.textMuted} />
              <Lbl text="MUAC (cm)" c={colors} />
              <TextInput style={inp} value={f.muac_cm} onChangeText={(v: string) => s('muac_cm', v)} keyboardType="decimal-pad" placeholder="e.g. 10.5" placeholderTextColor={colors.textMuted} />
              <Lbl text="W/H Z-Score" c={colors} />
              <TextInput style={inp} value={f.wfh_zscore} onChangeText={(v: string) => s('wfh_zscore', v)} keyboardType="decimal-pad" placeholder="e.g. -3.5" placeholderTextColor={colors.textMuted} />
              <Lbl text="Bilateral Pitting Oedema *" c={colors} />
              <Chips opts={YES_NO} val={f.bilateral_pitting_oedema} set={(v: string) => s('bilateral_pitting_oedema', v)} accent={accent} c={colors} />
              <Lbl text="Oedema Grade" c={colors} />
              <Chips opts={OEDEMA_OPTS} val={f.oedema_grade} set={(v: string) => s('oedema_grade', v)} accent={accent} c={colors} />
            </Card>
          )}

          {caseType === 'IPC' && stepIdx === 3 && (
            <Card c={colors} title="Clinical Assessment & Danger Signs" accent={accent}>
              <Lbl text="Appetite Test" c={colors} />
              <Chips opts={APPETITE_SIMPLE} val={f.appetite_test} set={(v: string) => s('appetite_test', v)} accent={accent} c={colors} />
              <Lbl text="Medical Complications *" c={colors} />
              <Chips opts={YES_NO} val={f.medical_complications} set={(v: string) => s('medical_complications', v)} accent={accent} c={colors} />
              <Lbl text="Complications Details" c={colors} />
              <TextInput style={[inp, styles.textArea]} value={f.complications_details} onChangeText={(v: string) => s('complications_details', v)} multiline placeholder="Describe any medical complications..." placeholderTextColor={colors.textMuted} textAlignVertical="top" />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#dc2626', marginBottom: 10 }}>Danger Signs (Check all that apply)</Text>
              <View style={styles.dangerGrid}>
                {DANGER_SIGNS.map((sign: string) => {
                  const on = dangerSigns.includes(sign);
                  return (
                    <TouchableOpacity key={sign} style={[styles.dangerItem, { borderColor: on ? '#dc2626' : colors.border, backgroundColor: on ? '#fef2f2' : colors.inputBg }]} onPress={() => toggleDanger(sign)} activeOpacity={0.7}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? '#dc2626' : colors.textMuted} />
                      <Text style={{ fontSize: 12, fontWeight: '500', color: on ? '#dc2626' : colors.textSecondary, flex: 1 }}>{sign}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          )}

          {/* ══════════════════ REVIEW (all types) ══════════════════ */}
          {stepIdx === steps.length - 1 && (
            <Card c={colors} title="Review & Submit" accent={accent}>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>Please verify all information before submitting.</Text>
              <RR l="Case Type" v={caseType} hl accent={accent} c={colors} />
              <RR l="Facility" v={facilityName} c={colors} />
              <RR l="Child Name" v={f.child_name} c={colors} />
              <RR l="Gender" v={f.child_gender} c={colors} />
              <RR l="DOB" v={f.date_of_birth} c={colors} />
              <RR l="Age" v={f.age_months ? `${f.age_months} months` : '—'} c={colors} />
              <RR l="Admission Date" v={f.admission_date} c={colors} />
              {caseType === 'MAM' && f.mam_type ? <RR l="MAM Type" v={f.mam_type} c={colors} /> : null}
              <View style={[styles.reviewDiv, { backgroundColor: colors.border }]} />
              <RR l="Caregiver" v={f.caregiver_name} c={colors} />
              <RR l="Phone" v={f.caregiver_phone} c={colors} />
              <RR l="Community" v={f.community || f.house_location || '—'} c={colors} />
              <View style={[styles.reviewDiv, { backgroundColor: colors.border }]} />
              <RR l="Weight" v={f.weight_kg ? `${f.weight_kg} kg` : '—'} c={colors} />
              <RR l="Height" v={f.height_cm ? `${f.height_cm} cm` : '—'} c={colors} />
              <RR l="MUAC" v={f.muac_cm ? `${f.muac_cm} cm` : '—'} c={colors} />
              {f.oedema ? <RR l="Oedema" v={f.oedema} c={colors} /> : null}
              {f.appetite_test ? <RR l="Appetite" v={f.appetite_test} c={colors} /> : null}
              {f.z_score_wfh ? <RR l="WFH Z" v={f.z_score_wfh} c={colors} /> : null}
              {f.enrolment_criteria ? <RR l="Enrolment" v={f.enrolment_criteria} c={colors} /> : null}
              {f.registration_latitude ? <RR l="GPS" v={`${f.registration_latitude}, ${f.registration_longitude}`} c={colors} /> : null}
              {caseType === 'IPC' && dangerSigns.length > 0 && <RR l="Danger Signs" v={dangerSigns.join(', ')} c={colors} />}
              {childPhoto && (
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <Image source={{ uri: childPhoto.uri }} style={{ width: 100, height: 100, borderRadius: 12 }} />
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Photo attached</Text>
                </View>
              )}
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
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: accent }, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.submitBtnText}>Register</Text></>
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

// ── Sub-components ───────────────────────────────────────────────────────────

function Lbl({ text, c }: { text: string; c: any }) {
  return <Text style={[styles.label, { color: c.textSecondary }]}>{text}</Text>;
}

function Card({ children, c, title, accent }: { children: React.ReactNode; c: any; title: string; accent: string }) {
  return (
    <View style={[styles.formCard, { backgroundColor: c.surface }]}>
      <View style={[styles.cardHeader, { borderLeftColor: accent }]}>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
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

function FacilityPicker({ facilities, value, onChange, colors, fromCache }: { facilities: Facility[]; value: string; onChange: (v: string) => void; colors: any; fromCache?: boolean }) {
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
      {fromCache && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -6, marginBottom: 10 }}>
          <Ionicons name="cloud-offline-outline" size={12} color={colors.textMuted} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Offline — using saved facility list</Text>
        </View>
      )}
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
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', padding: 20, color: colors.textMuted }}>
                  {facilities.length === 0
                    ? 'No facilities available offline yet. Connect to the internet once to download your facility list.'
                    : 'No facilities found'}
                </Text>
              }
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

function PhotoPicker({ photo, onPick, colors }: { photo: ImagePicker.ImagePickerAsset | null; onPick: (a: ImagePicker.ImagePickerAsset | null) => void; colors: any }) {
  const pick = async (src: 'camera' | 'library') => {
    const fn = src === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const r = await fn({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets[0]) onPick(r.assets[0]);
  };
  return (
    <TouchableOpacity style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
      onPress={() => Alert.alert('Add Photo', 'Choose a source', [
        { text: 'Camera', onPress: () => pick('camera') },
        { text: 'Photo Library', onPress: () => pick('library') },
        ...(photo ? [{ text: 'Remove', style: 'destructive' as const, onPress: () => onPick(null) }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ])} activeOpacity={0.7}>
      {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} /> : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>Tap to add photo</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function RR({ l, v, hl, accent, c }: { l: string; v: string; hl?: boolean; accent?: string; c: any }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, { color: c.textMuted }]}>{l}</Text>
      <Text style={[styles.reviewValue, { color: c.textPrimary }, hl && { color: accent || c.primary, fontWeight: '800' }]}>{v || '—'}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 14 },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#ffffffcc', marginTop: 2 },
  typeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  typeTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  typeTabText: { fontSize: 16, fontWeight: '800' },
  typeTabSub: { fontSize: 9, marginTop: 1 },
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
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#dcfce7' },
  divider: { height: 1, marginVertical: 16 },
  subHead: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  dangerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dangerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, width: '48%' as any },
  photoBox: { width: 110, height: 110, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  reviewLabel: { fontSize: 13, fontWeight: '500' },
  reviewValue: { fontSize: 13, fontWeight: '600', maxWidth: '55%' as any, textAlign: 'right' },
  reviewDiv: { height: 1, marginVertical: 8 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4 },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  prevBtnText: { fontSize: 15, fontWeight: '600' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
