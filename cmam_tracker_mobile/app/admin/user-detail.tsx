import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface UserDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  role: {
    id: number; role_id: number; role_name: string; role_level: number;
    region_id: number | null; region_name: string | null;
    district_id: number | null; district_name: string | null;
    sub_district_id: number | null; sub_district_name: string | null;
    facility_id: number | null; facility_name: string | null;
  } | null;
  created_at: string | null;
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<UserDetail | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get(`/v1/users/${id}/`);
      setUser(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load user');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.danger }]}>User not found</Text>
      </View>
    );
  }

  const statusColor = user.is_active ? colors.success : colors.danger;
  const roleLabel = user.is_superuser ? 'Super Admin' : user.is_staff ? 'Staff' : user.role?.role_name || 'No Role';
  const roleColor = user.is_superuser ? colors.danger : user.is_staff ? colors.warning : colors.primary;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUser(); }} colors={[colors.primary]} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Detail</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/admin/user-edit', params: { id: String(user.id) } })} style={styles.editBtn}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.avatarLg, { backgroundColor: roleColor + '20' }]}>
          <Text style={[styles.avatarLgText, { color: roleColor }]}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.profileName, { color: colors.textPrimary }]}>{user.name}</Text>
        <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{user.email}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: roleColor + '15' }]}>
            <Ionicons name="shield-checkmark" size={12} color={roleColor} />
            <Text style={[styles.badgeText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '15' }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>{user.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
      </View>

      {/* Info Section */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account Info</Text>
        </View>
        <InfoRow label="Phone" value={user.phone || '—'} colors={colors} />
        <InfoRow label="Created" value={user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} colors={colors} />
        <InfoRow label="Staff" value={user.is_staff ? 'Yes' : 'No'} colors={colors} />
        <InfoRow label="Superuser" value={user.is_superuser ? 'Yes' : 'No'} colors={colors} />
      </View>

      {/* Role & Location */}
      {user.role && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-outline" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Role & Location</Text>
          </View>
          <InfoRow label="Role" value={user.role.role_name} colors={colors} />
          <InfoRow label="Level" value={`Level ${user.role.role_level}`} colors={colors} />
          {user.role.region_name && <InfoRow label="Region" value={user.role.region_name} colors={colors} />}
          {user.role.district_name && <InfoRow label="District" value={user.role.district_name} colors={colors} />}
          {user.role.sub_district_name && <InfoRow label="Sub-District" value={user.role.sub_district_name} colors={colors} />}
          {user.role.facility_name && <InfoRow label="Facility" value={user.role.facility_name} colors={colors} />}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push({ pathname: '/admin/user-edit', params: { id: String(user.id) } })}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Edit User</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  editBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  profileCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 24, alignItems: 'center' },
  avatarLg: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarLgText: { fontSize: 28, fontWeight: '800' },
  profileName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  profileEmail: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  section: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontWeight: '500' },
  infoValue: { fontSize: 13, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  actionsRow: { marginHorizontal: 12, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
