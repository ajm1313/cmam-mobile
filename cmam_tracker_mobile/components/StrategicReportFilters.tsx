import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import PickerSelect from './PickerSelect';

interface Option { id: number; name: string }

export interface StrategicFilters {
  region: string;
  district: string;
  sub_district: string;
  facility: string;
  year: string;
  month: string;
  date_from: string;
  date_to: string;
}

interface Props {
  value: StrategicFilters;
  mode: 'analytics' | 'linelist';
  colors: any;
  onApply: (filters: StrategicFilters) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function StrategicReportFilters({ value, mode, colors, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [regions, setRegions] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [subDistricts, setSubDistricts] = useState<Option[]>([]);
  const [facilities, setFacilities] = useState<Option[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    api.get('/v1/locations/regions/')
      .then(response => setRegions(response.data.data ?? []))
      .catch(() => setRegions([]));
  }, []);
  useEffect(() => {
    if (!draft.region) {
      setDistricts([]);
      return;
    }
    api.get('/v1/locations/districts/', { params: { region_id: draft.region } })
      .then(response => setDistricts(response.data.data ?? []))
      .catch(() => setDistricts([]));
  }, [draft.region]);
  useEffect(() => {
    if (!draft.district) {
      setSubDistricts([]);
      return;
    }
    api.get('/v1/locations/sub-districts/', { params: { district_id: draft.district } })
      .then(response => setSubDistricts(response.data.data ?? []))
      .catch(() => setSubDistricts([]));
  }, [draft.district]);
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draft.sub_district) params.sub_district = draft.sub_district;
    else if (draft.district) params.district = draft.district;
    else if (draft.region) params.region = draft.region;
    setLoadingLocations(true);
    api.get('/v1/facilities/', { params: { ...params, page_size: 500 } })
      .then(response => setFacilities(
        (response.data.data ?? []).map((facility: any) => ({ id: facility.id, name: facility.name }))
      ))
      .catch(() => setFacilities([]))
      .finally(() => setLoadingLocations(false));
  }, [draft.region, draft.district, draft.sub_district]);

  const apply = () => {
    if (mode === 'linelist') {
      const values = [draft.date_from, draft.date_to].filter(Boolean);
      if (values.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(item))) {
        Alert.alert('Check dates', 'Use the YYYY-MM-DD format for both dates.');
        return;
      }
      if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
        Alert.alert('Check dates', 'The start date cannot be after the end date.');
        return;
      }
    }
    onApply(draft);
    setOpen(false);
  };

  const clear = () => {
    const cleared: StrategicFilters = {
      region: '', district: '', sub_district: '', facility: '',
      year: mode === 'analytics' ? String(new Date().getFullYear()) : '',
      month: '', date_from: '', date_to: '',
    };
    setDraft(cleared);
    onApply(cleared);
  };

  const activeCount = [value.region, value.district, value.sub_district, value.facility,
    value.month, value.date_from, value.date_to].filter(Boolean).length +
    (mode === 'analytics' && value.year !== String(new Date().getFullYear()) ? 1 : 0);
  const years = Array.from({ length: Math.max(1, new Date().getFullYear() - 2019) }, (_, index) =>
    String(new Date().getFullYear() - index)
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: activeCount ? colors.primary : colors.border }]}>
      <TouchableOpacity style={styles.toggle} onPress={() => setOpen(current => !current)} activeOpacity={0.75}>
        <View style={[styles.icon, { backgroundColor: colors.primary + '12' }]}>
          <Ionicons name="options-outline" size={17} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Report filters</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {activeCount ? `${activeCount} optional filter${activeCount === 1 ? '' : 's'} active` : 'All permitted locations'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={[styles.body, { borderTopColor: colors.border }]}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>LOCATION</Text>
          <View style={styles.grid}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Region</Text>
              <PickerSelect
                placeholder={{ label: 'All regions', value: '' }} value={draft.region}
                onValueChange={region => setDraft(current => ({ ...current, region, district: '', sub_district: '', facility: '' }))}
                items={regions.map(item => ({ label: item.name, value: String(item.id) }))} colors={colors}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>District</Text>
              <PickerSelect
                placeholder={{ label: 'All districts', value: '' }} value={draft.district}
                onValueChange={district => setDraft(current => ({ ...current, district, sub_district: '', facility: '' }))}
                items={districts.map(item => ({ label: item.name, value: String(item.id) }))} colors={colors}
                disabled={!draft.region}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Sub-District</Text>
              <PickerSelect
                placeholder={{ label: 'All sub-districts', value: '' }} value={draft.sub_district}
                onValueChange={sub_district => setDraft(current => ({ ...current, sub_district, facility: '' }))}
                items={subDistricts.map(item => ({ label: item.name, value: String(item.id) }))} colors={colors}
                disabled={!draft.district}
              />
            </View>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Facility</Text>
                {loadingLocations && <ActivityIndicator size={11} color={colors.primary} />}
              </View>
              <PickerSelect
                placeholder={{ label: 'All facilities', value: '' }} value={draft.facility}
                onValueChange={facility => setDraft(current => ({ ...current, facility }))}
                items={facilities.map(item => ({ label: item.name, value: String(item.id) }))} colors={colors}
              />
            </View>
          </View>

          <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: 16 }]}>PERIOD</Text>
          {mode === 'analytics' ? (
            <View style={styles.grid}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Year</Text>
                <PickerSelect
                  placeholder={{ label: 'Select year', value: '' }} value={draft.year}
                  onValueChange={year => setDraft(current => ({ ...current, year }))}
                  items={years.map(year => ({ label: year, value: year }))} colors={colors}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>KPI month</Text>
                <PickerSelect
                  placeholder={{ label: 'Full year', value: '' }} value={draft.month}
                  onValueChange={month => setDraft(current => ({ ...current, month }))}
                  items={MONTHS.map((label, index) => ({ label, value: String(index + 1) }))} colors={colors}
                />
              </View>
            </View>
          ) : (
            <View style={styles.grid}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Registered from</Text>
                <TextInput
                  value={draft.date_from} onChangeText={date_from => setDraft(current => ({ ...current, date_from }))}
                  placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation" maxLength={10}
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Registered to</Text>
                <TextInput
                  value={draft.date_to} onChangeText={date_to => setDraft(current => ({ ...current, date_to }))}
                  placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation" maxLength={10}
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                />
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.clear, { borderColor: colors.border }]} onPress={clear}>
              <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.apply, { backgroundColor: colors.primary }]} onPress={apply}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.applyText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginTop: 12, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  toggle: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 2 },
  body: { padding: 14, borderTopWidth: 1 },
  groupLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { width: '48%' },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, minHeight: 48, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  clear: { flex: 1, borderWidth: 1.5, borderRadius: 11, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 13, fontWeight: '700' },
  apply: { flex: 2, borderRadius: 11, minHeight: 46, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
