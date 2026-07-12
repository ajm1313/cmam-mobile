import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';

interface MenuItem {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
  requiresSuperuser?: boolean;
}

export default function AdminTabScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  // Matches webapp: Admin dropdown shown when `not user.is_facility_level_only`
  // Fallback: if is_facility_level_only not yet in API response, use is_superuser/is_staff
  const isAdmin = user?.is_superuser || user?.is_staff || user?.is_facility_level_only === false;
  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'User Management',
      items: [
        { title: 'Users', subtitle: 'Create, edit and manage users', icon: 'people-outline', route: '/admin/users', color: colors.primary },
      ],
    },
    {
      title: 'Facility & Location',
      items: [
        { title: 'Facilities', subtitle: 'Manage health facilities', icon: 'business-outline', route: '/admin/facilities', color: colors.secondary },
        { title: 'Locations', subtitle: 'Regions, districts, sub-districts', icon: 'location-outline', route: '/admin/locations', color: colors.success },
      ],
    },
    {
      title: 'Access Control',
      items: [
        { title: 'Roles & Permissions', subtitle: 'Manage feature access by role', icon: 'shield-checkmark-outline', route: '/admin/access-control', color: colors.primary, requiresSuperuser: true },
      ],
    },
    {
      title: 'System',
      items: [
        { title: 'Settings', subtitle: 'App config, theme, cache, sync', icon: 'settings-outline', route: '/admin/settings', color: colors.textMuted },
        { title: 'Activity Log', subtitle: 'User audit trail & actions', icon: 'document-text-outline', route: '/admin/audit-log', color: colors.secondary, requiresSuperuser: true },
        { title: 'Offline Sync', subtitle: 'Pending data queue', icon: 'cloud-upload-outline', route: '/admin/offline-sync', color: colors.warning },
      ],
    },
  ];

  if (!isAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.lockedCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.lockedIcon, { backgroundColor: colors.danger + '15' }]}>
            <Ionicons name="lock-closed" size={32} color={colors.danger} />
          </View>
          <Text style={[styles.lockedTitle, { color: colors.textPrimary }]}>Admin Access Required</Text>
          <Text style={[styles.lockedSub, { color: colors.textMuted }]}>
            This section is only available to administrators. Contact your system admin if you need access.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Welcome Card */}
      <View style={[styles.welcomeCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.welcomeIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="settings" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.welcomeName, { color: colors.textPrimary }]}>Welcome, {user?.name || 'Admin'}</Text>
          <Text style={[styles.welcomeRole, { color: colors.textMuted }]}>
            {user?.is_superuser ? 'Super Admin' : 'Staff'}
          </Text>
        </View>
      </View>

      {menuSections.map((section) => {
        const visibleItems = section.items.filter((item) => !item.requiresSuperuser || user?.is_superuser);
        if (visibleItems.length === 0) return null;
        return (
          <View key={section.title}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
              {visibleItems.map((item, idx) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.menuItem, idx < visibleItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockedCard: { borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340 },
  lockedIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  lockedTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  lockedSub: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  welcomeCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16 },
  welcomeIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  welcomeName: { fontSize: 17, fontWeight: '700' },
  welcomeRole: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  sectionCard: { marginHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuTitle: { fontSize: 15, fontWeight: '600' },
  menuSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});
