import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import EmptyState from '../../components/EmptyState';
import type { IpcCase, IpcCaseStatus } from '../../lib/types';

const STATUS_COLORS: Record<IpcCaseStatus, string> = {
  Admitted: '#10b981',
  Discharged: '#3b82f6',
  Death: '#ef4444',
  Defaulted: '#f59e0b',
  Transfer: '#8b5cf6',
};

export default function IpcDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<IpcCase | null>(null);

  const fetchCase = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await api.get(`/v1/ipc/cases/${params.id}/`);
      setCaseData(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load IPC case');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: '#7c3aed', paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>IPC Case</Text>
            <View style={{ width: 22 }} />
          </View>
        </View>
        <EmptyState icon="medkit-outline" title="Case Not Found" subtitle="This IPC case may have been removed." />
      </View>
    );
  }

  const statusColor = STATUS_COLORS[caseData.status] || colors.textMuted;

  const Row = ({ label, value }: { label: string; value: string | number | null }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{value ?? '—'}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: '#7c3aed', paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>IPC Case Detail</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
              {caseData.patient_name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor }}>{caseData.status}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Patient Information</Text>
            <Row label="Age" value={`${caseData.patient_age} months`} />
            <Row label="Gender" value={caseData.gender} />
            <Row label="Facility" value={caseData.facility_name} />
            <Row label="Admission Date" value={caseData.admission_date} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Anthropometry</Text>
            <Row label="Weight" value={`${caseData.weight} kg`} />
            <Row label="Height" value={`${caseData.height} cm`} />
            <Row label="MUAC" value={caseData.muac != null ? `${caseData.muac} cm` : '—'} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Metadata</Text>
            <Row label="Created" value={caseData.created_at} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13, fontWeight: '500' },
  rowValue: { fontSize: 13, fontWeight: '600' },
});
