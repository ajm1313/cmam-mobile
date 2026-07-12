import React, { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import type { SyncQueueItem } from '../lib/sync-store';

interface Props {
  item: SyncQueueItem | null;
  onResolve: (id: string, resolution: 'mine' | 'server') => Promise<void>;
  onClose: () => void;
}

const HUMAN_LABELS: Record<string, string> = {
  child_name: 'Child Name', child_gender: 'Gender', date_of_birth: 'Date of Birth',
  age_months: 'Age (months)', caregiver_name: 'Caregiver', caregiver_phone: 'Phone',
  address: 'Address', weight_kg: 'Weight (kg)', height_cm: 'Height (cm)',
  muac_cm: 'MUAC (cm)', oedema: 'Oedema', admission_type: 'Admission Type',
  visit_date: 'Visit Date', visit_outcome: 'Outcome', appetite: 'Appetite',
  rutf_sachets_given: 'RUTF Sachets', medical_notes: 'Medical Notes',
};

function label(key: string) {
  return HUMAN_LABELS[key] ?? key.replace(/_/g, ' ');
}

function DiffRow({ field, local, server, colors }: {
  field: string; local: any; server: any; colors: any;
}) {
  const differs = String(local ?? '') !== String(server ?? '');
  return (
    <View style={[styles.row, differs && { backgroundColor: colors.warning + '10' }]}>
      <Text style={[styles.fieldName, { color: colors.textMuted }]}>{label(field)}</Text>
      <View style={styles.values}>
        <View style={[styles.valueBox, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '08' }]}>
          <Text style={[styles.valueLabel, { color: colors.primary }]}>Mine</Text>
          <Text style={[styles.valueText, { color: colors.textPrimary }]}>{String(local ?? '—')}</Text>
        </View>
        <View style={[styles.valueBox, differs && { borderColor: colors.warning + '80', backgroundColor: colors.warning + '08' }]}>
          <Text style={[styles.valueLabel, { color: differs ? colors.warning : colors.textMuted }]}>Server</Text>
          <Text style={[styles.valueText, { color: colors.textPrimary }]}>{String(server ?? '—')}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ConflictResolutionModal({ item, onResolve, onClose }: Props) {
  const { colors } = useTheme();
  const [resolving, setResolving] = useState<'mine' | 'server' | null>(null);

  if (!item) return null;

  const local = item.data ?? {};
  const server = item.serverData ?? {};

  // Only show fields present in local data (the editable ones), skip internal fields
  const fields = Object.keys(local).filter((k) => !['_updated_at', 'id'].includes(k));

  const handleResolve = async (resolution: 'mine' | 'server') => {
    setResolving(resolution);
    await onResolve(item.id, resolution);
    setResolving(null);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={[styles.headerIcon, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="git-merge-outline" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Resolve Conflict</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            This record was changed on the server while you were offline. Review the differences below and choose which version to keep.
          </Text>

          {/* Diff table */}
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
            {fields.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>No field data available for comparison.</Text>
            ) : (
              fields.map((f) => (
                <DiffRow key={f} field={f} local={local[f]} server={server[f]} colors={colors} />
              ))
            )}
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: resolving ? 0.6 : 1 }]}
              onPress={() => handleResolve('mine')}
              disabled={!!resolving}
            >
              {resolving === 'mine'
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="phone-portrait-outline" size={16} color="#fff" />}
              <Text style={styles.btnText}>Keep Mine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, opacity: resolving ? 0.6 : 1 }]}
              onPress={() => handleResolve('server')}
              disabled={!!resolving}
            >
              {resolving === 'server'
                ? <ActivityIndicator size="small" color={colors.textPrimary} />
                : <Ionicons name="cloud-outline" size={16} color={colors.textPrimary} />}
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>Keep Server</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  hint: { fontSize: 12, lineHeight: 18, marginHorizontal: 16, marginVertical: 10 },
  scroll: { maxHeight: 360 },
  row: { marginHorizontal: 12, marginVertical: 4, borderRadius: 10, padding: 10 },
  fieldName: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  values: { flexDirection: 'row', gap: 8 },
  valueBox: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
  valueLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  valueText: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
