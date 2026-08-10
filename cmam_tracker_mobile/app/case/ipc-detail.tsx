import React, { useEffect, useState, useCallback } from 'react';
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

const IPC_COLOR = '#7c3aed';

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingBottom: 14, paddingHorizontal: 16,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    shadowColor: IPC_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  card: {
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13, fontWeight: '500' },
  rowValue: { fontSize: 13, fontWeight: '600' },
});

export default function IpcDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={IPC_COLOR} />
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: IPC_COLOR, paddingTop: Math.max(insets.top, 16) }]}>
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

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const Row = ({ label, value }: { label: string; value: string | number | null }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{value ?? '—'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: IPC_COLOR, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>IPC Case Detail</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
              {caseData.patient_name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{caseData.status}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Patient Information</Text>
            <Row label="Age" value={`${caseData.patient_age} months`} />
            <Row label="Gender" value={caseData.gender} />
            <Row label="Facility" value={caseData.facility_name} />
            <Row label="Admission Date" value={formatDate(caseData.admission_date)} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Anthropometry</Text>
            <Row label="Weight" value={`${caseData.weight} kg`} />
            <Row label="Height" value={`${caseData.height} cm`} />
            <Row label="MUAC" value={caseData.muac != null ? `${caseData.muac} cm` : '—'} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Metadata</Text>
            <Row label="Created" value={formatDate(caseData.created_at)} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
