import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';

interface AdminMenuItem {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
  requiresAdmin?: boolean;
}

export default function AdminHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.is_superuser || user?.is_staff;

  const menuSections: { title: string; items: AdminMenuItem[] }[] = [
    {
      title: 'Case Management',
      items: [
        { title: 'Due Visits', subtitle: 'View and manage due visits', icon: 'alarm-outline', route: '/case/due-visits', color: colors.danger },
        { title: 'Discharge Management', subtitle: 'Manage discharges & defaulters', icon: 'exit-outline', route: '/case/discharge', color: colors.warning },
      ],
    },
    {
      title: 'User & Access Management',
      items: [
        { title: 'User Management', subtitle: 'Create, edit and manage users', icon: 'people-outline', route: '/admin/users', color: colors.primary, requiresAdmin: true },
        { title: 'Access Control', subtitle: 'Manage role permissions', icon: 'shield-checkmark-outline', route: '/admin/access-control', color: '#7c3aed', requiresAdmin: true },
      ],
    },
    {
      title: 'Facility & Locations',
      items: [
        { title: 'Facility Management', subtitle: 'View, create and edit facilities', icon: 'business-outline', route: '/admin/facilities', color: colors.secondary, requiresAdmin: true },
        { title: 'Location Management', subtitle: 'Regions, districts, sub-districts', icon: 'location-outline', route: '/admin/locations', color: colors.success, requiresAdmin: true },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { title: 'Inventory Items', subtitle: 'Manage items catalog', icon: 'cube-outline', route: '/admin/inventory-items', color: colors.primary },
        { title: 'Stock Levels', subtitle: 'View and adjust stock per facility', icon: 'layers-outline', route: '/admin/stock-levels', color: '#0369a1' },
        { title: 'Stock Movements', subtitle: 'Track and record stock movements', icon: 'swap-vertical-outline', route: '/admin/stock-movements', color: colors.secondary },
        { title: 'Stock Requests', subtitle: 'View and process stock requests', icon: 'document-text-outline', route: '/admin/stock-requests', color: colors.warning },
        { title: 'New Stock Request', subtitle: 'Submit a new stock request', icon: 'add-circle-outline', route: '/admin/stock-request-create', color: colors.success },
        { title: 'Expiry Management', subtitle: 'Batch tracking and expiry alerts', icon: 'calendar-outline', route: '/admin/expiry-management', color: colors.danger },
      ],
    },
    {
      title: 'Reports & Analytics',
      items: [
        { title: 'Reports Dashboard', subtitle: 'Overview of all key metrics', icon: 'stats-chart-outline', route: '/admin/reports', color: colors.primary },
        { title: 'Weekly Tally Sheet', subtitle: 'SAM/MAM weekly health facility tally', icon: 'calendar-outline', route: '/admin/weekly-report', color: '#0369a1' },
        { title: 'Monthly Facility Report', subtitle: 'Monthly performance summary', icon: 'bar-chart-outline', route: '/admin/monthly-report', color: colors.secondary },
      ],
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin & Tools</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Welcome Card */}
      <View style={[styles.welcomeCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.welcomeIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="settings" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.welcomeName, { color: colors.textPrimary }]}>Welcome, {user?.name || 'Admin'}</Text>
          <Text style={[styles.welcomeRole, { color: colors.textMuted }]}>
            {user?.is_superuser ? 'Super Admin' : user?.is_staff ? 'Staff' : user?.role?.role_name || 'User'}
          </Text>
        </View>
      </View>

      {menuSections.map((section) => {
        const visibleItems = section.items.filter((item) => !item.requiresAdmin || isAdmin);
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
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
