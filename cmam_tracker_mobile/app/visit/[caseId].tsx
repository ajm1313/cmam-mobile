import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { createClientUid, sendOrQueue } from '../../lib/offlineQueue';
import { getCacheFallback, setCache } from '../../lib/cache';
import { logger } from '../../lib/logger';
import DatePickerField from '../../components/DatePickerField';
import { checkVisitActions, getAlertColors, type AutomationResult } from '../../lib/samOpcAutomation';
import OfflineBanner from '../../components/OfflineBanner';
import WHOGrowthChart from '../../components/WHOGrowthChart';
import { calcRutf, RUTF_GUIDE } from '../../lib/rutf';

type Step = 'anthropometry' | 'medical' | 'treatment' | 'outcome';
const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'anthropometry', label: 'Measurements', icon: 'body-outline' },
  { key: 'medical', label: 'Medical', icon: 'medkit-outline' },
  { key: 'treatment', label: 'Treatment', icon: 'nutrition-outline' },
  { key: 'outcome', label: 'Outcome', icon: 'checkmark-circle-outline' },
];

const VISIT_TYPES = ['Routine', 'Follow-up', 'Unscheduled'];
const APPETITE_OPTIONS = ['Pass', 'Fail'];
const SAM_OUTCOME_OPTIONS = ['Continue', 'Absent', 'Defaulted', 'Referral', 'Refused-Referral', 'Cured', 'Non-Response', 'Home-Visit', 'Death', 'Transfer-to-IPC'];
const MAM_OUTCOME_OPTIONS = ['Continue', 'Absent', 'Cured', 'Death', 'Defaulted', 'Non-Response', 'Referral'];
const TREATMENT_RESPONSE_OPTIONS = ['Good', 'Moderate', 'Poor', 'No-Response'];
const BREASTFEEDING_OPTIONS = ['BFW', 'BFC', 'NBF'];
const Z_SCORE_OPTIONS = ['< -3 SD', '-3 to < -2 SD', '-2 to +1 SD', '> +1 to +2 SD', '> +2 SD'];
const FOOD_PRODUCT_OPTIONS = ['RUSF', 'CSB++', 'CSB+', 'Fortified Oil', 'Other'];
const ANTHROPOMETRY_VISITS = [4, 8, 12, 16];

export default function VisitFormScreen() {
  const { caseId, caseClientUid, caseName, caseType, caseAge, admissionWeight, visitNumber, facilityId } = useLocalSearchParams<{ caseId: string; caseClientUid?: string; caseName: string; caseType: string; caseAge?: string; admissionWeight?: string; visitNumber?: string; facilityId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('anthropometry');
  const [submitting, setSubmitting] = useState(false);
  const [automationAlert, setAutomationAlert] = useState<AutomationResult | null>(null);
  const [rutfStock, setRutfStock] = useState<number | null>(null);
  const [weeksInProgram, setWeeksInProgram] = useState<number | null>(null);
  const [previousWeight, setPreviousWeight] = useState<number | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const isSAM = caseType === 'SAM';
  const visitNum = parseInt(visitNumber || '1');
  const isAnthropometryVisit = ANTHROPOMETRY_VISITS.includes(visitNum);
  const maxWeeks = isSAM ? 16 : 10;

  // Fetch RUTF stock level and case info for weeks calculation
  useEffect(() => {
    const fetchStock = async () => {
      if (caseClientUid) {
        setPreviousWeight(admissionWeight ? parseFloat(admissionWeight) : null);
        return;
      }
      try {
        const caseRes = await api.get(`/v1/cases/${caseId}/`);
        const caseData = caseRes.data?.data;
        setCaseData(caseData);
        await setCache(`case_detail_${caseId}`, caseData, 10 * 60 * 1000);
        const facilityId = caseData?.facility_id;
        // Calculate weeks in program from registration date
        if (caseData?.registration_date) {
          const regDate = new Date(caseData.registration_date);
          const now = new Date();
          const diffMs = now.getTime() - regDate.getTime();
          const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
          setWeeksInProgram(weeks);
        }
        // Determine previous weight for weight_lost auto-calculation
        const visits = caseData?.visits;
        if (visits && Array.isArray(visits) && visits.length > 0) {
          const lastVisit = visits[visits.length - 1];
          if (lastVisit?.weight_kg) setPreviousWeight(parseFloat(lastVisit.weight_kg));
        } else if (caseData?.weight_kg) {
          setPreviousWeight(parseFloat(caseData.weight_kg));
        }
        const params: { facility_id?: number } = {};
        if (facilityId) params.facility_id = facilityId;
        const res = await api.get('/v1/inventory/stock-levels/', { params });
        if (res.data?.success && Array.isArray(res.data.data)) {
          const rutfItem = res.data.data.find((s: any) => 
            s.item_name?.toLowerCase().includes('rutf') || s.item_code?.toLowerCase().includes('rutf')
          );
          if (rutfItem) setRutfStock(rutfItem.available_stock ?? rutfItem.current_stock ?? 0);
        }
      } catch (e: any) {
        const cached = await getCacheFallback<any>(`case_detail_${caseId}`);
        if (cached) {
          setCaseData(cached.data);
          const cachedVisits = cached.data?.visits || [];
          setPreviousWeight(parseFloat(cachedVisits[cachedVisits.length - 1]?.weight_kg || cached.data?.weight_kg || admissionWeight || '0'));
        }
        logger.warn('Stock check failed', e?.message);
      }
    };
    fetchStock();
  }, [caseId, caseClientUid, admissionWeight, facilityId]);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    visit_date: today,
    visit_type: 'Routine',
    weight_kg: '',
    height_cm: '',
    muac_cm: '',
    z_score_wfh: '',
    oedema: '',
    diarrhoea_days: '',
    vomiting_days: '',
    fever_days: '',
    cough_days: '',
    temperature: '',
    respiratory_rate: '',
    appetite: '',
    rutf_test: '',
    breastfeeding_status: '',
    dehydrated: false,
    anaemia_palmar_pallor: false,
    skin_infection: false,
    weight_lost: false,
    general_condition: '',
    has_complications: false,
    complications_notes: '',
    rutf_sachets_given: '',
    csb_plus_given: '',
    oil_given: '',
    other_supplies: '',
    other_medication: '',
    food_product_type: '',
    food_product_quantity: '',
    counseling_topics: '',
    caregiver_understanding: '',
    next_visit_date: '',
    treatment_response: '',
    medical_notes: '',
    remarks: '',
    visit_outcome: 'Continue',
    outcome_notes: '',
    staff_name: '',
    // IPC referral clinical signs
    intractable_vomiting: false,
    convulsions: false,
    lethargic_or_not_alert: false,
    unconscious: false,
    chest_indrawing: false,
    severe_dehydration: false,
    very_pale_or_severe_palmar_pallor: false,
    // Home visit fields
    action_needed: false,
    home_visit_needed: false,
    home_visit_date: '',
    community_volunteer: '',
    home_visit_notes: '',
  });

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  // ponytail: Check visit automation
  const checkAutomation = () => {
    if (caseType !== 'SAM') return;
    
    const data = {
      age_months: parseInt(caseAge || '12'),
      weight_kg: parseFloat(form.weight_kg),
      oedema: form.oedema,
      appetite_test: form.appetite === 'Fail' ? 'Fail' : form.appetite ? 'Pass' : undefined,
      temperature_c: parseFloat(form.temperature),
      respiratory_rate: parseInt(form.respiratory_rate) || 0,
      visit_number: parseInt(visitNumber || '1'),
      admission_weight: parseFloat(admissionWeight || '0'),
      intractable_vomiting: form.intractable_vomiting,
      convulsions: form.convulsions,
      lethargic: form.lethargic_or_not_alert,
      unconscious: form.unconscious,
      chest_indrawing: form.chest_indrawing,
      severe_dehydration: form.severe_dehydration,
      severe_pallor: form.very_pale_or_severe_palmar_pallor,
    };
    
    const result = checkVisitActions(data);
    setAutomationAlert(result.needsAction ? result : null);
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const goNext = () => { if (!isLast) setStep(STEPS[stepIndex + 1].key); };
  const goPrev = () => { if (!isFirst) setStep(STEPS[stepIndex - 1].key); };

  const isAbsentOrDefaulted = form.visit_outcome === 'Absent' || form.visit_outcome === 'Defaulted';

  const handleSubmit = async () => {
    if (submitting) return;
    if (!isAbsentOrDefaulted) {
      if (!form.weight_kg) {
        Alert.alert('Required', 'Weight is required.');
        setStep('anthropometry');
        return;
      }
      if (!form.muac_cm) {
        Alert.alert('Required', 'MUAC is required.');
        setStep('anthropometry');
        return;
      }
      if (!form.appetite) {
        Alert.alert('Required', 'Appetite Test is required.');
        setStep('medical');
        return;
      }
      // Anthropometry visit validation (visits 4, 8, 12, 16)
      if (isAnthropometryVisit && (!form.height_cm || !form.z_score_wfh)) {
        Alert.alert('Required', 'Height and W/H Z-Score are required for anthropometry visits (visits 4, 8, 12, 16).');
        setStep('anthropometry');
        return;
      }
    }
    // Stock-out warning for RUTF
    if (form.rutf_sachets_given && rutfStock !== null) {
      const qty = parseInt(form.rutf_sachets_given, 10);
      if (!Number.isNaN(qty) && qty > rutfStock) {
        Alert.alert('Stock Warning', `Only ${rutfStock} RUTF sachets in stock. You are dispensing ${qty}. Continue anyway?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', style: 'destructive', onPress: () => doSubmit() },
        ]);
        return;
      }
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, string | number | boolean | undefined> = {
        client_uid: createClientUid(),
        visit_date: form.visit_date,
        visit_type: form.visit_type,
        weight_lost: form.weight_lost,
        visit_outcome: form.visit_outcome,
        outcome_notes: form.outcome_notes,
        staff_name: form.staff_name,
        medical_notes: form.medical_notes,
        appetite: form.appetite || undefined,
        breastfeeding_status: form.breastfeeding_status || undefined,
        general_condition: form.general_condition || undefined,
        has_complications: form.has_complications,
        complications_notes: form.complications_notes || undefined,
        dehydrated: form.dehydrated,
        anaemia_palmar_pallor: form.anaemia_palmar_pallor,
        skin_infection: form.skin_infection,
        counseling_topics: form.counseling_topics || undefined,
        caregiver_understanding: form.caregiver_understanding || undefined,
        treatment_response: form.treatment_response || undefined,
        other_supplies: form.other_supplies || undefined,
        other_medication: form.other_medication || undefined,
        intractable_vomiting: form.intractable_vomiting,
        convulsions: form.convulsions,
        lethargic_or_not_alert: form.lethargic_or_not_alert,
        unconscious: form.unconscious,
        chest_indrawing: form.chest_indrawing,
        severe_dehydration: form.severe_dehydration,
        very_pale_or_severe_palmar_pallor: form.very_pale_or_severe_palmar_pallor,
        action_needed: form.action_needed,
        home_visit_needed: form.home_visit_needed,
        remarks: form.remarks || undefined,
      };
      const toFloat = (v: string) => { const n = parseFloat(v); return Number.isNaN(n) ? undefined : n; };
      const toInt = (v: string) => { const n = parseInt(v, 10); return Number.isNaN(n) ? undefined : n; };
      if (form.weight_kg) payload.weight_kg = toFloat(form.weight_kg);
      if (form.height_cm) payload.height_cm = toFloat(form.height_cm);
      if (form.muac_cm) payload.muac_cm = toFloat(form.muac_cm);
      if (form.z_score_wfh) payload.z_score_wfh = form.z_score_wfh;
      if (form.oedema) payload.oedema = form.oedema;
      if (form.diarrhoea_days) payload.diarrhoea_days = toInt(form.diarrhoea_days);
      if (form.vomiting_days) payload.vomiting_days = toInt(form.vomiting_days);
      if (form.fever_days) payload.fever_days = toInt(form.fever_days);
      if (form.cough_days) payload.cough_days = toInt(form.cough_days);
      if (form.temperature) payload.temperature = toFloat(form.temperature);
      if (form.respiratory_rate) payload.respiratory_rate = toInt(form.respiratory_rate);
      if (form.rutf_sachets_given) payload.rutf_sachets_given = toInt(form.rutf_sachets_given);
      if (form.csb_plus_given) payload.csb_plus_given = toFloat(form.csb_plus_given);
      if (form.oil_given) payload.oil_given = toFloat(form.oil_given);
      if (form.food_product_type) payload.food_product_type = form.food_product_type;
      if (form.food_product_quantity) payload.food_product_quantity = toInt(form.food_product_quantity);
      if (form.next_visit_date) payload.next_visit_date = form.next_visit_date;
      if (form.home_visit_date) payload.home_visit_date = form.home_visit_date;
      if (form.community_volunteer) payload.community_volunteer = form.community_volunteer;
      if (form.home_visit_notes) payload.home_visit_notes = form.home_visit_notes;

      const targetUrl = caseClientUid
        ? `/v1/cases/client/${caseClientUid}/visits/record/`
        : `/v1/cases/${caseId}/visits/record/`;
      const res = await sendOrQueue(targetUrl, 'post', payload, 'Visit Record');
      if (res) {
        const stockWarnings: string[] = res.data.stock_warnings || [];
        const message = stockWarnings.length > 0
          ? `Visit recorded successfully.\n\nStock warnings:\n${stockWarnings.join('\n')}`
          : 'Visit recorded successfully.';
        Alert.alert('Success', message, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Saved Offline', 'Visit record saved and will sync when online.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      const apiMsg = e.response?.data?.message;
      const status = e.response?.status;
      let msg: string;
      if (apiMsg) {
        msg = apiMsg;
      } else if (status === 500) {
        msg = 'Server error. Please try again or contact support.';
      } else if (e.message) {
        msg = e.message;
      } else {
        msg = 'Failed to record visit.';
      }
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Record Visit</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>{caseName} • {caseType}</Text>
          </View>
          <View style={[styles.caseTypePill, { backgroundColor: isSAM ? colors.sam + '20' : colors.mam + '20' }]}>
            <Text style={[styles.caseTypePillText, { color: isSAM ? colors.sam : colors.mam }]}>{caseType}</Text>
          </View>
        </View>

        <OfflineBanner />

        {/* Step Indicator */}
        <View style={[styles.stepsBar, { backgroundColor: colors.surface }]}>
          {STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = i < stepIndex;
            return (
              <TouchableOpacity key={s.key} style={styles.stepItem} onPress={() => setStep(s.key)} activeOpacity={0.7}>
                <View style={[styles.stepDot, { borderColor: colors.border, backgroundColor: colors.surface },
                  isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                  isDone && { backgroundColor: colors.success, borderColor: colors.success },
                ]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : (
                    <Ionicons name={s.icon as any} size={12} color={isActive ? '#fff' : colors.textMuted} />
                  )}
                </View>
                <Text style={[styles.stepLabel, { color: colors.textMuted }, isActive && { color: colors.primary, fontWeight: '700' }]}>{s.label}</Text>
                {i < STEPS.length - 1 && <View style={[styles.stepLine, { backgroundColor: colors.border }, isDone && { backgroundColor: colors.success }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Form Content */}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* Automation Alert (ponytail: visit action warnings) */}
          {automationAlert && isSAM && (() => {
            const ac = getAlertColors(automationAlert.priority || 'normal');
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

          {step === 'anthropometry' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Anthropometric Measurements</Text>

              {/* Weeks in program indicator */}
              {weeksInProgram !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: weeksInProgram >= maxWeeks ? '#fef3c7' : weeksInProgram >= maxWeeks - 4 ? '#dbeafe' : colors.inputBg }}>
                  <Ionicons name="time-outline" size={16} color={weeksInProgram >= maxWeeks ? '#f59e0b' : weeksInProgram >= maxWeeks - 4 ? '#3b82f6' : colors.textMuted} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: weeksInProgram >= maxWeeks ? '#92400e' : weeksInProgram >= maxWeeks - 4 ? '#1e40af' : colors.textSecondary }}>
                    {weeksInProgram} / {maxWeeks} weeks in program
                  </Text>
                  {weeksInProgram >= maxWeeks && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginLeft: 'auto' }}>DISCHARGE DUE</Text>
                  )}
                </View>
              )}

              {/* Anthropometry visit notice */}
              {isAnthropometryVisit && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: '#dbeafe', borderLeftWidth: 3, borderLeftColor: '#3b82f6' }}>
                  <Ionicons name="information-circle" size={16} color="#3b82f6" style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: '#1e40af', flex: 1 }}>Anthropometry Visit (Visit {visitNum}) — Height and W/H Z-Score are required at this visit.</Text>
                </View>
              )}

              <Label styles={styles} text="Visit Date" colors={colors} />
              <DatePickerField label="Visit Date" value={form.visit_date} onChange={v => set('visit_date', v)} colors={colors} maxDate={new Date().toISOString().slice(0, 10)} />

              <Label styles={styles} text="Visit Type" colors={colors} />
              <ChipRow styles={styles} options={VISIT_TYPES} selected={form.visit_type} onSelect={v => set('visit_type', v)} colors={colors} />

              <Label styles={styles} text="Weight (kg) *" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.weight_kg} onChangeText={v => {
                set('weight_kg', v);
                const w = parseFloat(v);
                if (Number.isNaN(w)) { set('rutf_sachets_given', ''); checkAutomation(); return; }
                const sachets = calcRutf(w);
                if (sachets && isSAM) set('rutf_sachets_given', sachets.toString());
                // Auto-calculate weight_lost: true if current weight < previous weight
                if (isSAM && previousWeight !== null) {
                  setForm(p => ({ ...p, weight_lost: w < previousWeight }));
                }
                checkAutomation();
              }} keyboardType="decimal-pad" placeholder="e.g. 8.5" placeholderTextColor={colors.textMuted} />

              {isAnthropometryVisit && (
                <>
                  <Label styles={styles} text="Height (cm) *" colors={colors} />
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.height_cm} onChangeText={v => set('height_cm', v)} keyboardType="decimal-pad" placeholder="e.g. 75.0" placeholderTextColor={colors.textMuted} />
                </>
              )}

              <Label styles={styles} text="MUAC (cm) *" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.muac_cm} onChangeText={v => set('muac_cm', v)} keyboardType="decimal-pad" placeholder="e.g. 11.5" placeholderTextColor={colors.textMuted} />

              {isSAM && (
                <>
                  <Label styles={styles} text="Bilateral Pitting Oedema" colors={colors} />
                  <ChipRow styles={styles} options={['0', '+', '++', '+++']} selected={form.oedema} onSelect={v => { set('oedema', v); checkAutomation(); }} colors={colors} />
                </>
              )}

              {isAnthropometryVisit && (
                <>
                  <Label styles={styles} text="W/H Z-Score *" colors={colors} />
                  <ChipRow styles={styles} options={Z_SCORE_OPTIONS} selected={form.z_score_wfh} onSelect={v => set('z_score_wfh', v)} colors={colors} />
                </>
              )}
              {!isAnthropometryVisit && (
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Height and Z-Score are measured at visits 4, 8, 12, and 16.</Text>
              )}

              {/* WHO WFH Growth Chart with trajectory + live point */}
              {caseData && (
                <View style={{ marginTop: 16 }}>
                  <WHOGrowthChart
                    gender={caseData.child_gender}
                    regWeight={parseFloat(caseData.weight_kg) || 0}
                    regHeight={parseFloat(caseData.height_cm) || 0}
                    regDate={caseData.admission_date || caseData.registration_date || ''}
                    visits={(caseData.visits || []).filter((v: any) => v.visit_number < visitNum)}
                    colors={colors}
                    typeColor={isSAM ? '#ef4444' : '#f59e0b'}
                    liveWeight={parseFloat(form.weight_kg) || 0}
                    liveHeight={parseFloat(form.height_cm) || 0}
                  />
                </View>
              )}
            </View>
          )}

          {step === 'medical' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Medical History & Exam</Text>

              <Label styles={styles} text="Diarrhoea (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.diarrhoea_days} onChangeText={v => set('diarrhoea_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Vomiting (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.vomiting_days} onChangeText={v => set('vomiting_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Fever (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.fever_days} onChangeText={v => set('fever_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Cough (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.cough_days} onChangeText={v => set('cough_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Temperature (°C)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.temperature} onChangeText={v => { set('temperature', v); checkAutomation(); }} keyboardType="decimal-pad" placeholder="e.g. 37.5" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Respiratory Rate (breaths/min)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.respiratory_rate} onChangeText={v => set('respiratory_rate', v)} keyboardType="number-pad" placeholder="e.g. 40" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Appetite Test" colors={colors} />
              <ChipRow styles={styles} options={APPETITE_OPTIONS} selected={form.appetite} onSelect={v => { set('appetite', v); checkAutomation(); }} colors={colors} />

              {isSAM && (
                <>
                  <Label styles={styles} text="Breastfeeding Status" colors={colors} />
                  <ChipRow styles={styles} options={BREASTFEEDING_OPTIONS} selected={form.breastfeeding_status} onSelect={v => set('breastfeeding_status', v)} colors={colors} />
                </>
              )}

              <Label styles={styles} text="General Condition" colors={colors} />
              <ChipRow styles={styles} options={['Good', 'Fair', 'Poor', 'Critical']} selected={form.general_condition} onSelect={v => set('general_condition', v)} colors={colors} />

              {/* Physical exam checkboxes */}
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>Physical Examination</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'dehydrated', label: 'Dehydrated' },
                  { key: 'anaemia_palmar_pallor', label: 'Palmar Pallor' },
                  { key: 'skin_infection', label: 'Skin Infection' },
                  { key: 'weight_lost', label: 'Weight Lost' },
                  { key: 'has_complications', label: 'Has Complications' },
                ].map(item => (
                  <TouchableOpacity key={item.key} onPress={() => setForm(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                    style={[styles.checkboxChip, { borderColor: colors.border, backgroundColor: form[item.key as keyof typeof form] ? colors.danger + '15' : colors.inputBg }]}>
                    <Ionicons name={form[item.key as keyof typeof form] ? 'checkbox' : 'square-outline'} size={16} color={form[item.key as keyof typeof form] ? colors.danger : colors.textMuted} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.has_complications && (
                <>
                  <Label styles={styles} text="Complications Notes" colors={colors} />
                  <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.complications_notes} onChangeText={v => set('complications_notes', v)} placeholder="Describe complications..." placeholderTextColor={colors.textMuted} multiline numberOfLines={2} textAlignVertical="top" />
                </>
              )}

              {/* Clinical Signs (IPC Referral Criteria) - SAM only */}
              {isSAM && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20, marginBottom: 4 }]}>Clinical Signs (IPC Referral Criteria)</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Check any danger signs present. These automatically trigger IPC referral alerts.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { key: 'intractable_vomiting', label: 'Intractable Vomiting' },
                      { key: 'lethargic_or_not_alert', label: 'Lethargic/Not Alert' },
                      { key: 'convulsions', label: 'Convulsions' },
                      { key: 'chest_indrawing', label: 'Chest Indrawing' },
                      { key: 'unconscious', label: 'Unconscious' },
                      { key: 'very_pale_or_severe_palmar_pallor', label: 'Severe Palmar Pallor' },
                      { key: 'severe_dehydration', label: 'Severe Dehydration' },
                    ].map(item => (
                      <TouchableOpacity key={item.key} onPress={() => {
                        setForm(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }));
                        setTimeout(checkAutomation, 0);
                      }}
                        style={[styles.checkboxChip, { borderColor: colors.border, backgroundColor: form[item.key as keyof typeof form] ? colors.danger + '15' : colors.inputBg }]}>
                        <Ionicons name={form[item.key as keyof typeof form] ? 'checkbox' : 'square-outline'} size={16} color={form[item.key as keyof typeof form] ? colors.danger : colors.textMuted} />
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {step === 'treatment' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Treatment & Supplies</Text>

              {isSAM ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                    <Label styles={styles} text="RUTF Sachets Given" colors={colors} />
                    <TouchableOpacity onPress={() => Alert.alert('RUTF Dosage Guide', RUTF_GUIDE.map(r => `${r.weight} kg → ${r.week}/week (${r.day}/day)`).join('\n'), [{ text: 'OK' }])} activeOpacity={0.7}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>📊 Guide</Text>
                    </TouchableOpacity>
                  </View>
                  {form.weight_kg && calcRutf(parseFloat(form.weight_kg)) && (
                    <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 6 }}>Suggested: {calcRutf(parseFloat(form.weight_kg))} sachets/week</Text>
                  )}
                  {rutfStock !== null && (
                    <Text style={{ fontSize: 11, color: rutfStock > 0 ? colors.textMuted : '#dc2626', marginBottom: 4 }}>
                      In stock: {rutfStock} sachets{rutfStock === 0 ? ' — STOCK OUT!' : ''}
                    </Text>
                  )}
                  {rutfStock !== null && rutfStock > 0 && (
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 6, fontStyle: 'italic' }}>
                      The oldest/expiring RUTF batch will be consumed automatically (FEFO/FIFO).
                    </Text>
                  )}
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.rutf_sachets_given} onChangeText={v => set('rutf_sachets_given', v)} keyboardType="number-pad" placeholder="e.g. 14" placeholderTextColor={colors.textMuted} />
                </>
              ) : (
                <>
                  <Label styles={styles} text="Food Product Type" colors={colors} />
                  <ChipRow styles={styles} options={FOOD_PRODUCT_OPTIONS} selected={form.food_product_type} onSelect={v => set('food_product_type', v)} colors={colors} />

                  <Label styles={styles} text="Food Product Quantity" colors={colors} />
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.food_product_quantity} onChangeText={v => set('food_product_quantity', v)} placeholder="e.g. 6 kg" placeholderTextColor={colors.textMuted} />
                </>
              )}

              <Label styles={styles} text="CSB+ Given (kg)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.csb_plus_given} onChangeText={v => set('csb_plus_given', v)} keyboardType="decimal-pad" placeholder="e.g. 3.5" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Oil Given (L)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.oil_given} onChangeText={v => set('oil_given', v)} keyboardType="decimal-pad" placeholder="e.g. 1.0" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Other Supplies" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.other_supplies} onChangeText={v => set('other_supplies', v)} placeholder="e.g. soap, mosquito net" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Other Medication" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.other_medication} onChangeText={v => set('other_medication', v)} placeholder="e.g. paracetamol, zinc" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Counseling Topics" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.counseling_topics} onChangeText={v => set('counseling_topics', v)} placeholder="e.g. nutrition, hygiene" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Caregiver Understanding" colors={colors} />
              <ChipRow styles={styles} options={['Good', 'Fair', 'Poor']} selected={form.caregiver_understanding} onSelect={v => set('caregiver_understanding', v)} colors={colors} />

              <Label styles={styles} text="Treatment Response" colors={colors} />
              <ChipRow styles={styles} options={TREATMENT_RESPONSE_OPTIONS} selected={form.treatment_response} onSelect={v => set('treatment_response', v)} colors={colors} />

              <Label styles={styles} text="Next Visit Date" colors={colors} />
              <DatePickerField label="Next Visit Date" value={form.next_visit_date} onChange={v => set('next_visit_date', v)} colors={colors} />

              <Label styles={styles} text="Staff Name" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.staff_name} onChangeText={v => set('staff_name', v)} placeholder="Name of staff conducting visit" placeholderTextColor={colors.textMuted} />

              <Label styles={styles} text="Medical Notes" colors={colors} />
              <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.medical_notes} onChangeText={v => set('medical_notes', v)} placeholder="Any additional notes..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" />

              {/* MAM Remarks */}
              {!isSAM && (
                <>
                  <Label styles={styles} text="Visit Remarks" colors={colors} />
                  <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.remarks} onChangeText={v => set('remarks', v)} placeholder="Any observations or notes about this visit" placeholderTextColor={colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
                </>
              )}

              {/* Home Visit / Action fields */}
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20, marginBottom: 8 }]}>Action / Follow-up</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'action_needed', label: 'Action Needed' },
                  { key: 'home_visit_needed', label: 'Home Visit Needed' },
                ].map(item => (
                  <TouchableOpacity key={item.key} onPress={() => setForm(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                    style={[styles.checkboxChip, { borderColor: colors.border, backgroundColor: form[item.key as keyof typeof form] ? colors.danger + '15' : colors.inputBg }]}>
                    <Ionicons name={form[item.key as keyof typeof form] ? 'checkbox' : 'square-outline'} size={16} color={form[item.key as keyof typeof form] ? colors.danger : colors.textMuted} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.home_visit_needed && (
                <>
                  <Label styles={styles} text="Home Visit Date" colors={colors} />
                  <DatePickerField label="Home Visit Date" value={form.home_visit_date} onChange={v => set('home_visit_date', v)} colors={colors} />

                  <Label styles={styles} text="Community Volunteer Name" colors={colors} />
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.community_volunteer} onChangeText={v => set('community_volunteer', v)} placeholder="Name of community volunteer" placeholderTextColor={colors.textMuted} />

                  <Label styles={styles} text="Home Visit Notes" colors={colors} />
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.home_visit_notes} onChangeText={v => set('home_visit_notes', v)} placeholder="Notes from home visit" placeholderTextColor={colors.textMuted} />
                </>
              )}
            </View>
          )}

          {step === 'outcome' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Visit Outcome</Text>

              {/* Discharge warning for long-running cases */}
              {weeksInProgram !== null && weeksInProgram >= maxWeeks && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: '#fef3c7', borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
                  <Ionicons name="warning" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: '#92400e', flex: 1 }}>This case has reached {weeksInProgram} weeks since enrollment. Cases are automatically discharged after {maxWeeks} weeks. Please select an appropriate discharge outcome.</Text>
                </View>
              )}

              <Label styles={styles} text="Outcome" colors={colors} />
              <View style={styles.outcomeGrid}>
                {(isSAM ? SAM_OUTCOME_OPTIONS : MAM_OUTCOME_OPTIONS).map(o => {
                  const active = form.visit_outcome === o;
                  const outcomeColor = o === 'Cured' ? colors.success : o === 'Death' ? colors.danger :
                    o === 'Defaulted' ? colors.warning : colors.primary;
                  return (
                    <TouchableOpacity key={o} style={[styles.outcomeChip, { borderColor: colors.border, backgroundColor: colors.inputBg }, active && { backgroundColor: outcomeColor + '18', borderColor: outcomeColor }]}
                      onPress={() => set('visit_outcome', o)} activeOpacity={0.7}>
                      <Text style={[styles.outcomeChipText, { color: colors.textSecondary }, active && { color: outcomeColor, fontWeight: '700' }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Label styles={styles} text="Outcome Notes" colors={colors} />
              <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.outcome_notes} onChangeText={v => set('outcome_notes', v)} placeholder="Additional details..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          )}
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!isFirst ? (
            <TouchableOpacity style={styles.prevBtn} onPress={goPrev} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
              <Text style={[styles.prevBtnText, { color: colors.primary }]}>Back</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}

          {isLast ? (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.success, shadowColor: colors.success }, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Visit</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={goNext} activeOpacity={0.8}>
              <Text style={styles.nextBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Reusable form components ────────────────────────────────────────────────

function Label({ text, colors, styles }: { text: string; colors: any; styles: any }) {
  return <Text style={[styles.label, { color: colors.textSecondary }]}>{text}</Text>;
}

function ChipRow({ options, selected, onSelect, colors, styles }: { options: string[]; selected: string; onSelect: (v: string) => void; colors: any; styles: any }) {
  return (
    <View style={styles.chipRow}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.inputBg }, selected === o && { backgroundColor: colors.primary + '12', borderColor: colors.primary }]}
          onPress={() => onSelect(o)} activeOpacity={0.7}>
          <Text style={[styles.chipText, { color: colors.textSecondary }, selected === o && { color: colors.primary, fontWeight: '700' }]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  caseTypePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  caseTypePillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  stepsBar: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  stepLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  stepLine: {
    position: 'absolute', top: 13, left: '60%', right: '-40%', height: 2,
    backgroundColor: colors.border, zIndex: -1,
  },

  formScroll: { flex: 1 },
  formCard: {
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16,
    shadowColor: colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  formSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },

  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.inputBg,
  },
  textArea: { minHeight: 80, paddingTop: 12 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg,
  },
  chipActive: { backgroundColor: colors.primary + '12', borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  outcomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outcomeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg,
  },
  outcomeChipText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  checkboxChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg,
  },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    shadowColor: colors.cardShadow, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4,
  },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  prevBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextBtnText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14,
    shadowColor: colors.success, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { color: colors.headerText, fontSize: 15, fontWeight: '700' },
});
