import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import OfflineBanner from '../../components/OfflineBanner';

interface Facility { id: number; name: string; type: string; }

export default function CaseTransferScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ caseId: string; caseName: string }>();

  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [transferType, setTransferType] = useState<'facility' | 'ipc'>('facility');
  const [targetFacility, setTargetFacility] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api.get('/v1/facilities/').then(r => {
      const list = (r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name, type: f.type }));
      setAllFacilities(list);
    }).catch((e: any) => { Alert.alert('Error', 'Could not load facilities.'); });
  }, []);

  const facilities = transferType === 'ipc'
    ? allFacilities.filter(f => f.type === 'IPC')
    : allFacilities.filter(f => f.type === 'OPC');

  const handleSubmit = async () => {
    if (!targetFacility) { Alert.alert('Missing', 'Please select a target facility.'); return; }
    if (!reason) { Alert.alert('Missing', 'Please provide a reason for transfer.'); return; }

    setSubmitting(true);
    try {
      const res = await sendOrQueue(`/v1/cases/${params.caseId}/transfer/`, 'post', {
        transfer_type: transferType,
        target_facility_id: parseInt(targetFacility),
        reason,
        notes,
      }, 'Case Transfer');
      if (res) {
        Alert.alert('Success', `Case ${transferType === 'ipc' ? 'transferred to IPC' : 'transferred'} successfully.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Saved Offline', 'Case transfer saved and will sync when online.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp: any = { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 10 };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transfer / Refer Case</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>
      <OfflineBanner />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.caseBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={20} color={colors.primary} />
          <Text style={[styles.caseText, { color: colors.textSecondary }]}>Transferring: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{params.caseName}</Text></Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Transfer Type</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            style={[styles.typeCard, { borderColor: transferType === 'facility' ? colors.primary : colors.border, backgroundColor: transferType === 'facility' ? colors.primary + '12' : colors.surface }]}
            onPress={() => { setTransferType('facility'); setTargetFacility(''); }}
          >
            <Ionicons name="business-outline" size={22} color={transferType === 'facility' ? colors.primary : colors.textMuted} />
            <Text style={[styles.typeTitle, { color: transferType === 'facility' ? colors.primary : colors.textMuted }]}>To Facility</Text>
            <Text style={[styles.typeSub, { color: colors.textMuted }]}>Transfer to another OPC facility</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeCard, { borderColor: transferType === 'ipc' ? '#7c3aed' : colors.border, backgroundColor: transferType === 'ipc' ? '#7c3aed' + '12' : colors.surface }]}
            onPress={() => { setTransferType('ipc'); setTargetFacility(''); }}
          >
            <Ionicons name="medkit-outline" size={22} color={transferType === 'ipc' ? '#7c3aed' : colors.textMuted} />
            <Text style={[styles.typeTitle, { color: transferType === 'ipc' ? '#7c3aed' : colors.textMuted }]}>To IPC</Text>
            <Text style={[styles.typeSub, { color: colors.textMuted }]}>Refer to stabilization center</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Target Facility *</Text>
        {facilities.length === 0 ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {facilities.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, { borderColor: targetFacility === String(f.id) ? (transferType === 'ipc' ? '#7c3aed' : colors.primary) : colors.border, backgroundColor: targetFacility === String(f.id) ? (transferType === 'ipc' ? '#7c3aed' + '15' : colors.primary + '15') : colors.surface }]}
                onPress={() => setTargetFacility(String(f.id))}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: targetFacility === String(f.id) ? (transferType === 'ipc' ? '#7c3aed' : colors.primary) : colors.textMuted }}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Reason for Transfer *</Text>
        <TextInput style={[inp, { minHeight: 60 }]} value={reason} onChangeText={setReason} multiline placeholder="e.g. Severe complications, failed appetite test, lack of RUTF..." placeholderTextColor={colors.textMuted} />

        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Clinical Notes</Text>
        <TextInput style={[inp, { minHeight: 80 }]} value={notes} onChangeText={setNotes} multiline placeholder="Additional clinical observations or instructions..." placeholderTextColor={colors.textMuted} />

        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: transferType === 'ipc' ? '#7c3aed' : colors.primary }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.7}>
          {submitting ? <ActivityIndicator size={20} color="#fff" /> : <Text style={styles.submitBtnText}>{transferType === 'ipc' ? 'Refer to IPC' : 'Transfer Case'}</Text>}
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
  caseBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1 },
  caseText: { fontSize: 14, flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  typeCard: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1.5 },
  typeTitle: { fontSize: 14, fontWeight: '800' },
  typeSub: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
