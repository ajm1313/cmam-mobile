import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { useIsSuperAdmin } from '../../lib/useSuperAdmin';

interface FacilityItem {
  id: number;
  name: string;
  code: string | null;
  facility_type: string;
  region_name: string | null;
  district_name: string | null;
  sub_district_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  is_active: boolean;
  capacity: number | null;
  expected_sam_cases: number | null;
  sam_target: number | null;
}

export default function FacilitiesListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isSuper = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [search, setSearch] = useState('');

  const fetchFacilities = useCallback(async () => {
    try {
      const res = await api.get('/v1/facilities/', { params: search ? { search } : {} });
      setFacilities(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load facilities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  const handleDelete = (fac: FacilityItem) => {
    Alert.alert('Delete Facility', `Deactivate ${fac.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/v1/facilities/${fac.id}/delete/`);
            Alert.alert('Success', 'Facility deactivated');
            fetchFacilities();
          } catch {
            Alert.alert('Error', 'Failed to deactivate facility');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facilities</Text>
        <TouchableOpacity onPress={() => router.push('/admin/facility-create')} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search facilities..." placeholderTextColor={colors.textMuted}
          value={search} onChangeText={setSearch} onSubmitEditing={fetchFacilities} returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.countText, { color: colors.textMuted }]}>{facilities.length} facilities</Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFacilities(); }} colors={[colors.primary]} />}
      >
        {facilities.map((fac) => {
          const typeColor = fac.facility_type === 'OPC' ? colors.primary : colors.secondary;
          return (
            <TouchableOpacity
              key={fac.id}
              style={[styles.facCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/facility/[id]', params: { id: String(fac.id) } })}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: typeColor + '15' }]}>
                  <Ionicons name="business" size={20} color={typeColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.facName, { color: colors.textPrimary }]}>{fac.name}</Text>
                  {fac.code ? <Text style={[styles.facCode, { color: colors.textMuted }]}>{fac.code}</Text> : null}
                  <Text style={[styles.facLoc, { color: colors.textMuted }]}>
                    {[fac.district_name, fac.region_name].filter(Boolean).join(' • ') || '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.typePill, { backgroundColor: typeColor + '15' }]}>
                    <Text style={[styles.typeText, { color: typeColor }]}>{fac.facility_type}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: fac.is_active ? '#dcfce7' : '#fee2e2' }]}>
                    <View style={[styles.statusDot, { backgroundColor: fac.is_active ? '#16a34a' : '#dc2626' }]} />
                    <Text style={[styles.statusText, { color: fac.is_active ? '#15803d' : '#b91c1c' }]}>
                      {fac.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
                {fac.contact_person && (
                  <View style={styles.metaChip}>
                    <Ionicons name="person-outline" size={11} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{fac.contact_person}</Text>
                  </View>
                )}
                {fac.expected_sam_cases != null && (
                  <View style={styles.metaChip}>
                    <Text style={[styles.metaLabel, { color: colors.textMuted }]}>SAM Burden: </Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{fac.expected_sam_cases}</Text>
                  </View>
                )}
                {fac.sam_target != null && (
                  <View style={[styles.metaChip, { backgroundColor: '#fffbeb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                    <Text style={[styles.metaLabel, { color: '#92400e' }]}>SAM Target: </Text>
                    <Text style={[styles.metaValue, { color: '#b45309', fontWeight: '700' }]}>{fac.sam_target}</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary + '10' }]} onPress={() => router.push({ pathname: '/admin/facility-detail', params: { id: String(fac.id) } } as any)}>
                  <Ionicons name="eye-outline" size={15} color={colors.secondary} />
                  <Text style={[styles.actionText, { color: colors.secondary }]}>View</Text>
                </TouchableOpacity>
                {isSuper && (
                  <>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '10' }]} onPress={() => router.push({ pathname: '/admin/facility-edit', params: { id: String(fac.id) } } as any)}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger + '10' }]} onPress={() => handleDelete(fac)}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  countText: { fontSize: 12, fontWeight: '600', marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
  facCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  facName: { fontSize: 15, fontWeight: '700' },
  facLoc: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '700' },
  facCode: { fontSize: 11, fontWeight: '600', fontFamily: 'monospace', marginTop: 1, color: '#6b7280' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, fontWeight: '500' },
  metaLabel: { fontSize: 11, fontWeight: '500' },
  metaValue: { fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },
});
