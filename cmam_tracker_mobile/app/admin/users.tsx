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
import { sendOrQueue } from '../../lib/offlineQueue';

interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  role: { role_name: string; role_level: number; region_name: string | null; district_name: string | null; facility_name: string | null } | null;
  created_at: string | null;
}

export default function UsersListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/v1/users/', { params: search ? { search } : {} });
      setUsers(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = (user: UserItem) => {
    Alert.alert('Deactivate User', `Deactivate ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          try {
            const res = await sendOrQueue(`/v1/users/${user.id}/delete/`, 'delete', null, `Deactivate ${user.name}`);
            if (res !== null) {
              Alert.alert('Success', 'User deactivated');
              fetchUsers();
            }
          } catch {
            Alert.alert('Error', 'Failed to deactivate user');
          }
        },
      },
    ]);
  };

  const getRoleBadge = (user: UserItem) => {
    if (user.is_superuser) return { label: 'Super Admin', color: colors.danger };
    if (user.is_staff) return { label: 'Staff', color: colors.warning };
    if (user.role) return { label: user.role.role_name, color: colors.primary };
    return { label: 'No Role', color: colors.textMuted };
  };

  const getLocationText = (user: UserItem) => {
    if (!user.role) return '';
    const parts = [user.role.facility_name, user.role.district_name, user.role.region_name].filter(Boolean);
    return parts.join(' • ');
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
        <Text style={styles.headerTitle}>User Management</Text>
        <TouchableOpacity onPress={() => router.push('/admin/user-create')} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search users..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={fetchUsers}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.countText, { color: colors.textMuted }]}>{users.length} users</Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} colors={[colors.primary]} />}
      >
        {users.map((user) => {
          const badge = getRoleBadge(user);
          const loc = getLocationText(user);
          return (
            <TouchableOpacity
              key={user.id}
              style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/admin/user-detail', params: { id: String(user.id) } })}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: badge.color + '20' }]}>
                  <Text style={[styles.avatarText, { color: badge.color }]}>{user.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.userName, { color: colors.textPrimary }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.textMuted }]}>{user.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.rolePill, { backgroundColor: badge.color + '15' }]}>
                    <Text style={[styles.roleText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: user.is_active ? '#dcfce7' : '#fee2e2' }]}>
                    <View style={[styles.statusDot, { backgroundColor: user.is_active ? '#16a34a' : '#dc2626' }]} />
                    <Text style={[styles.statusText, { color: user.is_active ? '#15803d' : '#b91c1c' }]}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
                {loc ? <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}><Ionicons name="location-outline" size={12} /> {loc}</Text> : null}
                {user.phone ? <Text style={[styles.phoneText, { color: colors.textMuted }]}><Ionicons name="call-outline" size={12} /> {user.phone}</Text> : null}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary + '10' }]} onPress={() => router.push({ pathname: '/admin/user-detail', params: { id: String(user.id) } })}>
                  <Ionicons name="eye-outline" size={16} color={colors.secondary} />
                  <Text style={[styles.actionText, { color: colors.secondary }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '10' }]} onPress={() => router.push({ pathname: '/admin/user-edit', params: { id: String(user.id) } })}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger + '10' }]} onPress={() => handleDelete(user)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
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
  userCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  locationText: { fontSize: 12, fontWeight: '500' },
  phoneText: { fontSize: 12, fontWeight: '500' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },
});
