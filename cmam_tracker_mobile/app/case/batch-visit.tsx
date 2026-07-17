import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import OfflineBanner from '../../components/OfflineBanner';
import EmptyState from '../../components/EmptyState';
import { CardSkeleton } from '../../components/LoadingSkeleton';

interface DueVisit {
  id: number;
  child_name: string;
  registration_number: string;
  malnutrition_type: string;
  facility_name: string;
  days_overdue: number;
}

interface VisitEntry {
  caseId: number;
  weight: string;
  muac: string;
  notes: string;
  selected: boolean;
}

export default function BatchVisitScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [dueVisits, setDueVisits] = useState<DueVisit[]>([]);
  const [entries, setEntries] = useState<Record<number, VisitEntry>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/v1/cases/due-visits/', { params: { type: 'SAM' } });
      const visits: DueVisit[] = res.data.data?.due_visits ?? [];
      setDueVisits(visits);
      const init: Record<number, VisitEntry> = {};
      visits.forEach((v: DueVisit) => {
        init[v.id] = { caseId: v.id, weight: '', muac: '', notes: '', selected: true };
      });
      setEntries(init);
    } catch {
      setDueVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const updateEntry = (caseId: number, field: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [caseId]: { ...prev[caseId], [field]: value },
    }));
  };

  const toggleSelect = (caseId: number) => {
    setEntries(prev => ({
      ...prev,
      [caseId]: { ...prev[caseId], selected: !prev[caseId].selected },
    }));
  };

  const selectedEntries = Object.values(entries).filter(e => e.selected);
  const validEntries = selectedEntries.filter(e => e.weight || e.muac);

  const handleSubmit = async () => {
    if (validEntries.length === 0) {
      Alert.alert('No Data', 'Please enter at least weight or MUAC for selected cases.');
      return;
    }

    Alert.alert(
      'Confirm Batch Visit',
      `Record visits for ${validEntries.length} case(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            let success = 0;
            let failed = 0;
            for (const entry of validEntries) {
              try {
                const payload: Record<string, any> = {};
                if (entry.weight) payload.weight_kg = parseFloat(entry.weight);
                if (entry.muac) payload.muac_cm = parseFloat(entry.muac);
                if (entry.notes) payload.notes = entry.notes;
                await api.post(`/v1/cases/${entry.caseId}/visits/record/`, payload);
                success++;
              } catch (e: any) {
                console.warn('Batch visit failed for case', entry.caseId, e?.message);
                failed++;
              }
            }
            setSubmitting(false);
            Alert.alert(
              'Batch Complete',
              `${success} visit(s) recorded successfully.${failed > 0 ? `\n${failed} failed.` : ''}`,
              [{ text: 'OK', onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  const inp: any = { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.textPrimary, width: 70 };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={false} />
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Batch Visit Entry</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Enter weight and/or MUAC for due cases. Only selected cases with data will be submitted.
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 8 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : dueVisits.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" title="No due visits" subtitle="All visits are up to date." />
        ) : (
          dueVisits.map((v) => {
            const entry = entries[v.id];
            if (!entry) return null;
            const typeColor = v.malnutrition_type === 'SAM' ? colors.danger : colors.warning;
            return (
              <View key={v.id} style={[styles.card, { backgroundColor: colors.surface, opacity: entry.selected ? 1 : 0.5 }]}>
                <View style={styles.cardHeader}>
                  <TouchableOpacity onPress={() => toggleSelect(v.id)} style={styles.checkbox}>
                    <Ionicons name={entry.selected ? 'checkbox' : 'square-outline'} size={20} color={entry.selected ? colors.primary : colors.textMuted} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.textPrimary }]}>{v.child_name}</Text>
                    <Text style={[styles.cardSub, { color: colors.textMuted }]}>{v.registration_number} • {v.malnutrition_type}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor + '15' }]}>
                    <Text style={[styles.typeText, { color: typeColor }]}>{v.malnutrition_type}</Text>
                  </View>
                </View>
                {entry.selected && (
                  <View style={styles.cardBody}>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Weight (kg)</Text>
                      <TextInput style={inp} value={entry.weight} onChangeText={(val: string) => updateEntry(v.id, 'weight', val)} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.textMuted} />
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MUAC (cm)</Text>
                      <TextInput style={inp} value={entry.muac} onChangeText={(val: string) => updateEntry(v.id, 'muac', val)} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.textMuted} />
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Submit Bar */}
      {validEntries.length > 0 && (
        <View style={[styles.submitBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.submitBarText, { color: colors.textSecondary }]}>
            {validEntries.length} ready to submit
          </Text>
          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.7}>
            {submitting ? <ActivityIndicator size={18} color="#fff" /> : <Text style={styles.submitBtnText}>Submit All</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 12, marginTop: 12, borderRadius: 10, padding: 12, borderWidth: 1 },
  infoText: { fontSize: 12, flex: 1, lineHeight: 17 },
  card: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { padding: 2 },
  cardName: { fontSize: 14, fontWeight: '700' },
  cardSub: { fontSize: 11, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: '800' },
  cardBody: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  fieldGroup: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  submitBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  submitBarText: { fontSize: 13, fontWeight: '600' },
  submitBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
