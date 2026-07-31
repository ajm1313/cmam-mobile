import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import DatePickerField from '../../components/DatePickerField';

interface Facility { id: number; name: string; }

export default function IpcRegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ caseId?: string; caseName?: string }>();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    patient_name: params.caseName || '',
    patient_age: '',
    gender: '',
    admission_date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    muac: '',
    facility_id: '',
    status: 'Admitted',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    api.get('/v1/facilities/').then(r => {
      const list = (r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }));
      setFacilities(list);
    }).catch(() => {});
  }, []);

  const s = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.patient_name) missing.push('Patient Name');
    if (!form.gender) missing.push('Gender');
    if (!form.admission_date) missing.push('Admission Date');
    if (!form.weight) missing.push('Weight');
    if (!form.height) missing.push('Height');
    if (!form.facility_id) missing.push('Facility');
    if (missing.length) { Alert.alert('Missing Fields', missing.join(', ')); return; }

    setSubmitting(true);
    try {
      const toInt = (v: string) => { const n = parseInt(v, 10); return Number.isNaN(n) ? undefined : n; };
      const toFloat = (v: string) => { const n = parseFloat(v); return Number.isNaN(n) ? undefined : n; };
      const payload: Record<string, any> = {
        patient_name: form.patient_name,
        patient_age: toInt(form.patient_age) ?? 0,
        gender: form.gender,
        admission_date: form.admission_date,
        weight: toFloat(form.weight),
        height: toFloat(form.height),
        facility_id: toInt(form.facility_id),
        status: form.status,
      };
      if (form.muac) { const n = toFloat(form.muac); if (n !== undefined) payload.muac = n; }

      await sendOrQueue('/v1/ipc/cases/', 'post', payload, 'IPC Case Registration');

      if (params.caseId) {
        await sendOrQueue(`/v1/cases/${params.caseId}/transfer/`, 'post', {
          transfer_type: 'ipc',
          target_facility_id: toInt(form.facility_id),
          reason: form.reason,
          notes: form.notes,
        }, 'IPC Transfer').catch(() => {});
      }

      Alert.alert('Success', 'IPC case registered successfully.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not register IPC case.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp: any = { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 10 };
  const lbl: any = { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: '#7c3aed', paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>IPC Registration</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.infoBanner, { backgroundColor: '#7c3aed' + '12', borderColor: '#7c3aed' + '30' }]}>
          <Ionicons name="information-circle-outline" size={18} color="#7c3aed" />
          <Text style={styles.infoText}>Inpatient Care — Stabilization Center for children with severe acute malnutrition and medical complications.</Text>
        </View>

        {params.caseName && (
          <View style={[styles.referralBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="arrow-redo-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.referralText, { color: colors.textSecondary }]}>Referring: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{params.caseName}</Text></Text>
          </View>
        )}

        <Text style={[lbl, { color: colors.textPrimary, fontSize: 14, marginBottom: 12 }]}>Patient Information</Text>
        <Text style={lbl}>Patient Name *</Text>
        <TextInput style={inp} value={form.patient_name} onChangeText={(v: string) => s('patient_name', v)} placeholder="Child's full name" placeholderTextColor={colors.textMuted} />

        <Text style={lbl}>Age (months)</Text>
        <TextInput style={inp} value={form.patient_age} onChangeText={(v: string) => s('patient_age', v)} keyboardType="numeric" placeholder="e.g. 24" placeholderTextColor={colors.textMuted} />

        <Text style={lbl}>Gender *</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {['Male', 'Female'].map(g => (
            <TouchableOpacity key={g} style={[styles.chip, { borderColor: form.gender === g ? '#7c3aed' : colors.border, backgroundColor: form.gender === g ? '#7c3aed' + '15' : colors.surface }]} onPress={() => s('gender', g)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: form.gender === g ? '#7c3aed' : colors.textMuted }}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={lbl}>Admission Date *</Text>
        <DatePickerField label="Admission Date" value={form.admission_date} onChange={(v: string) => s('admission_date', v)} colors={colors} maxDate={new Date().toISOString().slice(0, 10)} />

        <Text style={[lbl, { color: colors.textPrimary, fontSize: 14, marginBottom: 12, marginTop: 16 }]}>Anthropometry</Text>
        <Text style={lbl}>Weight (kg) *</Text>
        <TextInput style={inp} value={form.weight} onChangeText={(v: string) => s('weight', v)} keyboardType="decimal-pad" placeholder="e.g. 5.5" placeholderTextColor={colors.textMuted} />

        <Text style={lbl}>Height (cm) *</Text>
        <TextInput style={inp} value={form.height} onChangeText={(v: string) => s('height', v)} keyboardType="decimal-pad" placeholder="e.g. 62.0" placeholderTextColor={colors.textMuted} />

        <Text style={lbl}>MUAC (cm)</Text>
        <TextInput style={inp} value={form.muac} onChangeText={(v: string) => s('muac', v)} keyboardType="decimal-pad" placeholder="e.g. 10.5" placeholderTextColor={colors.textMuted} />

        <Text style={[lbl, { color: colors.textPrimary, fontSize: 14, marginBottom: 12, marginTop: 16 }]}>Facility</Text>
        <Text style={lbl}>IPC Facility *</Text>
        <View style={[inp, { paddingVertical: 0 }]}>
          {facilities.length === 0 ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 12 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {facilities.map((f) => (
                  <TouchableOpacity key={f.id} style={[styles.chip, { borderColor: String(form.facility_id) === String(f.id) ? '#7c3aed' : colors.border, backgroundColor: String(form.facility_id) === String(f.id) ? '#7c3aed' + '15' : colors.surface }]} onPress={() => s('facility_id', String(f.id))}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: String(form.facility_id) === String(f.id) ? '#7c3aed' : colors.textMuted }}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {params.caseId && (
          <>
            <Text style={[lbl, { color: colors.textPrimary, fontSize: 14, marginBottom: 12, marginTop: 16 }]}>Referral Details</Text>
            <Text style={lbl}>Reason for Referral</Text>
            <TextInput style={[inp, { minHeight: 60 }]} value={form.reason} onChangeText={(v: string) => s('reason', v)} multiline placeholder="e.g. Failed appetite test, severe complications" placeholderTextColor={colors.textMuted} />
            <Text style={lbl}>Additional Notes</Text>
            <TextInput style={[inp, { minHeight: 60 }]} value={form.notes} onChangeText={(v: string) => s('notes', v)} multiline placeholder="Clinical observations..." placeholderTextColor={colors.textMuted} />
          </>
        )}

        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#7c3aed' }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.7}>
          {submitting ? <ActivityIndicator size={20} color="#fff" /> : <Text style={styles.submitBtnText}>Register IPC Case</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  infoText: { fontSize: 12, color: '#7c3aed', flex: 1, lineHeight: 18, fontWeight: '500' },
  referralBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  referralText: { fontSize: 13, flex: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
