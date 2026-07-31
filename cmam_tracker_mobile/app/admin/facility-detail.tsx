import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { useIsSuperAdmin } from '../../lib/useSuperAdmin';

interface FacilityData {
  id: number; name: string; code: string; type: string;
  address: string | null; contact_person: string | null;
  phone: string | null; email: string | null;
  capacity: number | null; latitude: number | null; longitude: number | null;
  is_active: boolean; district_name: string | null;
  region_name: string | null; sub_district_name: string | null;
  opc_day: number | null; opc_day_display: string | null;
  stats: { total_cases: number; active_sam: number; active_mam: number; discharged: number; defaulted: number };
}

export default function FacilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isSuper = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [facility, setFacility] = useState<FacilityData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/v1/facilities/${id}/`);
      setFacility(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load facility details');
    } finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !facility) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const typeColor = facility.type === 'OPC' ? colors.primary : facility.type === 'IPC' ? '#7c3aed' : colors.secondary;
  const s = facility.stats;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Facility Details</Text>
        {isSuper && (
        <TouchableOpacity onPress={() => router.push({ pathname: '/admin/facility-edit', params: { id: String(facility.id) } } as any)} style={styles.backBtn}>
          <Ionicons name="create-outline" size={22} color="#fff" />
        </TouchableOpacity>
        )}
      </View>

      {/* Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.typeIcon, { backgroundColor: typeColor + '15' }]}>
          <Ionicons name="business" size={28} color={typeColor} />
        </View>
        <Text style={[styles.facilityName, { color: colors.textPrimary }]}>{facility.name}</Text>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: typeColor + '15' }]}>
            <Text style={[styles.pillText, { color: typeColor }]}>{facility.type}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: facility.is_active ? colors.success + '15' : colors.danger + '15' }]}>
            <View style={[styles.dot, { backgroundColor: facility.is_active ? colors.success : colors.danger }]} />
            <Text style={[styles.pillText, { color: facility.is_active ? colors.success : colors.danger }]}>{facility.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
        <Text style={[styles.facilityCode, { color: colors.textMuted }]}>Code: {facility.code}</Text>
      </View>

      {/* Case Statistics */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Case Statistics</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Total Cases" value={s.total_cases} icon="people" color={colors.primary} colors={colors} />
        <StatCard label="Active SAM" value={s.active_sam} icon="alert-circle" color={colors.danger} colors={colors} />
        <StatCard label="Active MAM" value={s.active_mam} icon="warning" color={colors.warning} colors={colors} />
        <StatCard label="Discharged" value={s.discharged} icon="checkmark-circle" color={colors.success} colors={colors} />
      </View>

      {/* Location Info */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Location</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
        <InfoRow icon="globe-outline" label="Region" value={facility.region_name || '—'} colors={colors} />
        <InfoRow icon="map-outline" label="District" value={facility.district_name || '—'} colors={colors} />
        <InfoRow icon="navigate-outline" label="Sub-District" value={facility.sub_district_name || '—'} colors={colors} />
        <InfoRow icon="location-outline" label="Address" value={facility.address || '—'} colors={colors} last />
      </View>

      {/* Contact Info */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Contact</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
        <InfoRow icon="person-outline" label="Contact Person" value={facility.contact_person || '—'} colors={colors} />
        <InfoRow icon="call-outline" label="Phone" value={facility.phone || '—'} colors={colors}
          onPress={facility.phone ? () => Linking.openURL(`tel:${facility.phone}`) : undefined} />
        <InfoRow icon="mail-outline" label="Email" value={facility.email || '—'} colors={colors} last
          onPress={facility.email ? () => Linking.openURL(`mailto:${facility.email}`) : undefined} />
      </View>

      {/* OPC Schedule Info */}
      {facility.type === 'OPC' && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>OPC Schedule</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            {facility.opc_day_display ? (
              <InfoRow
                icon="calendar-outline"
                label="OPC Visit Day"
                value={`Every ${facility.opc_day_display}`}
                colors={colors}
                last
                hint="SAM & MAM visits are scheduled on this day each week"
              />
            ) : (
              <InfoRow
                icon="warning-outline"
                label="OPC Visit Day"
                value="Not configured — using fixed intervals"
                colors={colors}
                last
                warn
              />
            )}
          </View>
        </>
      )}

      {/* Additional Info */}
      {(facility.capacity || facility.latitude) && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Additional</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            {facility.capacity && <InfoRow icon="resize-outline" label="Capacity" value={String(facility.capacity)} colors={colors} />}
            {facility.latitude && facility.longitude && (
              <InfoRow icon="compass-outline" label="GPS" value={`${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}`} colors={colors} last />
            )}
          </View>
        </>
      )}

      {/* Actions */}
      {isSuper && (
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.primary }]}
          onPress={() => router.push({ pathname: '/admin/facility-edit', params: { id: String(facility.id) } } as any)}>
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.actionCardText}>Edit Facility</Text>
        </TouchableOpacity>
      </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, icon, color, colors }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, colors, last, onPress, hint, warn }: any) {
  const Wrap = onPress ? TouchableOpacity : View;
  const valueColor = warn ? colors.warning : onPress ? colors.primary : colors.textPrimary;
  return (
    <Wrap style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={warn ? colors.warning : colors.textMuted} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: valueColor }]}>{value}</Text>
        {hint && <Text style={[styles.infoHint, { color: colors.textMuted }]}>{hint}</Text>}
      </View>
      {onPress && <Ionicons name="open-outline" size={16} color={colors.primary} />}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  heroCard: { alignItems: 'center', marginHorizontal: 12, marginTop: 12, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  typeIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  facilityName: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  pillText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  facilityCode: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 8, gap: 8 },
  statCard: { width: '47%', borderRadius: 14, padding: 14, alignItems: 'center', marginHorizontal: '1.5%' as any, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoCard: { marginHorizontal: 12, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  actionRow: { marginHorizontal: 12, marginTop: 24 },
  actionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  actionCardText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoHint: { fontSize: 11, marginTop: 2 },
});
