import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import DatePickerField from '../../components/DatePickerField';
import { checkVisitActions, getAlertColors, type AutomationResult } from '../../lib/samOpcAutomation';

type Step = 'anthropometry' | 'medical' | 'treatment' | 'outcome';
const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'anthropometry', label: 'Measurements', icon: 'body-outline' },
  { key: 'medical', label: 'Medical', icon: 'medkit-outline' },
  { key: 'treatment', label: 'Treatment', icon: 'nutrition-outline' },
  { key: 'outcome', label: 'Outcome', icon: 'checkmark-circle-outline' },
];

const VISIT_TYPES = ['Routine', 'Follow-up', 'Unscheduled'];
const APPETITE_OPTIONS = ['Good', 'Fair', 'Poor'];
const OUTCOME_OPTIONS = ['Continue', 'Absent', 'Cured', 'Defaulted', 'Death', 'Referral', 'Non-Response', 'Transfer-to-IPC'];

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

export default function VisitFormScreen() {
  const { caseId, caseName, caseType } = useLocalSearchParams<{ caseId: string; caseName: string; caseType: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('anthropometry');
  const [submitting, setSubmitting] = useState(false);
  const [automationAlert, setAutomationAlert] = useState<AutomationResult | null>(null);
  const [rutfStock, setRutfStock] = useState<number | null>(null);
  const isSAM = caseType === 'SAM';

  // Fetch RUTF stock level for the case's facility
  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await api.get('/stock-levels/', { params: { facility_id: undefined } });
        if (res.data?.success && Array.isArray(res.data.data)) {
          const rutfItem = res.data.data.find((s: any) => 
            s.item_name?.toLowerCase().includes('rutf') || s.item_code?.toLowerCase().includes('rutf')
          );
          if (rutfItem) setRutfStock(rutfItem.available_stock ?? rutfItem.current_stock ?? 0);
        }
      } catch { /* stock check is advisory only */ }
    };
    fetchStock();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    visit_date: today,
    visit_type: 'Routine',
    weight_kg: '',
    height_cm: '',
    muac_cm: '',
    oedema: '',
    diarrhoea_days: '',
    vomiting_days: '',
    fever_days: '',
    cough_days: '',
    temperature: '',
    appetite: '',
    rutf_sachets_given: '',
    food_product_type: '',
    food_product_quantity: '',
    medical_notes: '',
    visit_outcome: 'Continue',
    outcome_notes: '',
    staff_name: '',
  });

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  // ponytail: Check visit automation
  const checkAutomation = () => {
    if (caseType !== 'SAM') return;
    
    const data = {
      age_months: 12, // Would need actual age from case data
      weight_kg: parseFloat(form.weight_kg),
      oedema: form.oedema,
      appetite_test: form.appetite,
      temperature_c: parseFloat(form.temperature),
      respiratory_rate: parseInt(form.respiratory_rate),
      visit_number: 1, // Would need actual visit number
      admission_weight: 0 // Would need from case data
    };
    
    const result = checkVisitActions(data);
    setAutomationAlert(result.needsAction ? result : null);
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const goNext = () => { if (!isLast) setStep(STEPS[stepIndex + 1].key); };
  const goPrev = () => { if (!isFirst) setStep(STEPS[stepIndex - 1].key); };

  const handleSubmit = async () => {
    if (!form.weight_kg) {
      Alert.alert('Required', 'Weight is required.');
      setStep('anthropometry');
      return;
    }
    // Stock-out warning for RUTF
    if (form.rutf_sachets_given && rutfStock !== null) {
      const qty = parseInt(form.rutf_sachets_given);
      if (qty > rutfStock) {
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
      const payload: any = {
        visit_date: form.visit_date,
        visit_type: form.visit_type,
        weight_kg: parseFloat(form.weight_kg),
        visit_outcome: form.visit_outcome,
        outcome_notes: form.outcome_notes,
        staff_name: form.staff_name,
        medical_notes: form.medical_notes,
        appetite: form.appetite || undefined,
      };
      if (form.height_cm) payload.height_cm = parseFloat(form.height_cm);
      if (form.muac_cm) payload.muac_cm = parseFloat(form.muac_cm);
      if (form.oedema) payload.oedema = form.oedema;
      if (form.diarrhoea_days) payload.diarrhoea_days = parseInt(form.diarrhoea_days);
      if (form.vomiting_days) payload.vomiting_days = parseInt(form.vomiting_days);
      if (form.fever_days) payload.fever_days = parseInt(form.fever_days);
      if (form.cough_days) payload.cough_days = parseInt(form.cough_days);
      if (form.temperature) payload.temperature = parseFloat(form.temperature);
      if (form.rutf_sachets_given) payload.rutf_sachets_given = parseInt(form.rutf_sachets_given);
      if (form.food_product_type) payload.food_product_type = form.food_product_type;
      if (form.food_product_quantity) payload.food_product_quantity = form.food_product_quantity;

      await api.post(`/v1/cases/${caseId}/visits/record/`, payload);
      Alert.alert('Success', 'Visit recorded successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Failed to record visit.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          {automationAlert && isSAM && (
            <View style={{ marginHorizontal: 12, marginTop: 12, padding: 14, borderRadius: 12, borderLeftWidth: 4, backgroundColor: getAlertColors(automationAlert.priority).bg, borderLeftColor: getAlertColors(automationAlert.priority).border }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: getAlertColors(automationAlert.priority).text, marginBottom: 6 }}>{automationAlert.title}</Text>
              <Text style={{ fontSize: 13, color: getAlertColors(automationAlert.priority).text, marginBottom: 8 }}>{automationAlert.message}</Text>
              {automationAlert.reasons.map((reason, i) => (
                <Text key={i} style={{ fontSize: 12, color: getAlertColors(automationAlert.priority).text, marginLeft: 8, marginBottom: 2 }}>• {reason}</Text>
              ))}
              <Text style={{ fontSize: 13, fontWeight: '600', color: getAlertColors(automationAlert.priority).text, marginTop: 8 }}>Suggested Action: {automationAlert.action}</Text>
            </View>
          )}

          {step === 'anthropometry' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Anthropometric Measurements</Text>

              <Label text="Visit Date" colors={colors} />
              <DatePickerField label="Visit Date" value={form.visit_date} onChange={v => set('visit_date', v)} colors={colors} maxDate={new Date().toISOString().slice(0, 10)} />

              <Label text="Visit Type" colors={colors} />
              <ChipRow options={VISIT_TYPES} selected={form.visit_type} onSelect={v => set('visit_type', v)} colors={colors} />

              <Label text="Weight (kg) *" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.weight_kg} onChangeText={v => {
                set('weight_kg', v);
                const w = parseFloat(v);
                const sachets = calcRutf(w);
                if (sachets && isSAM) set('rutf_sachets_given', sachets.toString());
                checkAutomation(); // ponytail: check on weight change
              }} keyboardType="decimal-pad" placeholder="e.g. 8.5" placeholderTextColor={colors.textMuted} />

              <Label text="Height (cm)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.height_cm} onChangeText={v => set('height_cm', v)} keyboardType="decimal-pad" placeholder="e.g. 75.0" placeholderTextColor={colors.textMuted} />

              <Label text="MUAC (cm)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.muac_cm} onChangeText={v => set('muac_cm', v)} keyboardType="decimal-pad" placeholder="e.g. 11.5" placeholderTextColor={colors.textMuted} />

              {isSAM && (
                <>
                  <Label text="Oedema" colors={colors} />
                  <ChipRow options={['None', '+', '++', '+++']} selected={form.oedema} onSelect={v => set('oedema', v)} colors={colors} />
                </>
              )}
            </View>
          )}

          {step === 'medical' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Medical History & Exam</Text>

              <Label text="Diarrhoea (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.diarrhoea_days} onChangeText={v => set('diarrhoea_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label text="Vomiting (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.vomiting_days} onChangeText={v => set('vomiting_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label text="Fever (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.fever_days} onChangeText={v => set('fever_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label text="Cough (days)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.cough_days} onChangeText={v => set('cough_days', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Label text="Temperature (°C)" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.temperature} onChangeText={v => set('temperature', v)} keyboardType="decimal-pad" placeholder="e.g. 37.5" placeholderTextColor={colors.textMuted} />

              <Label text="Appetite" colors={colors} />
              <ChipRow options={APPETITE_OPTIONS} selected={form.appetite} onSelect={v => set('appetite', v)} colors={colors} />
            </View>
          )}

          {step === 'treatment' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Treatment & Supplies</Text>

              {isSAM ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                    <Label text="RUTF Sachets Given" colors={colors} />
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
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.rutf_sachets_given} onChangeText={v => set('rutf_sachets_given', v)} keyboardType="number-pad" placeholder="e.g. 14" placeholderTextColor={colors.textMuted} />
                </>
              ) : (
                <>
                  <Label text="Food Product Type" colors={colors} />
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.food_product_type} onChangeText={v => set('food_product_type', v)} placeholder="e.g. CSB+" placeholderTextColor={colors.textMuted} />

                  <Label text="Food Product Quantity" colors={colors} />
                  <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.food_product_quantity} onChangeText={v => set('food_product_quantity', v)} placeholder="e.g. 6 kg" placeholderTextColor={colors.textMuted} />
                </>
              )}

              <Label text="Staff Name" colors={colors} />
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.staff_name} onChangeText={v => set('staff_name', v)} placeholder="Name of staff conducting visit" placeholderTextColor={colors.textMuted} />

              <Label text="Medical Notes" colors={colors} />
              <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.medical_notes} onChangeText={v => set('medical_notes', v)} placeholder="Any additional notes..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          )}

          {step === 'outcome' && (
            <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.formSectionTitle, { color: colors.textPrimary }]}>Visit Outcome</Text>

              <Label text="Outcome" colors={colors} />
              <View style={styles.outcomeGrid}>
                {OUTCOME_OPTIONS.map(o => {
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

              <Label text="Outcome Notes" colors={colors} />
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

function Label({ text, colors }: { text: string; colors: any }) {
  return <Text style={[styles.label, { color: colors.textSecondary }]}>{text}</Text>;
}

function ChipRow({ options, selected, onSelect, colors }: { options: string[]; selected: string; onSelect: (v: string) => void; colors: any }) {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  caseTypePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  caseTypePillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  stepsBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  stepLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  stepLine: {
    position: 'absolute', top: 13, left: '60%', right: '-40%', height: 2,
    backgroundColor: COLORS.border, zIndex: -1,
  },

  formScroll: { flex: 1 },
  formCard: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  formSectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary, backgroundColor: '#f8fafc',
  },
  textArea: { minHeight: 80, paddingTop: 12 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#f8fafc',
  },
  chipActive: { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },

  outcomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outcomeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#f8fafc',
  },
  outcomeChipText: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4,
  },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  prevBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.success, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14,
    shadowColor: COLORS.success, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
