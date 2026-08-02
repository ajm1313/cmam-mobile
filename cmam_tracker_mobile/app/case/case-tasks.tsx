import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import EmptyState from '../../components/EmptyState';

interface CaseTaskItem {
  id: number;
  task_type: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  cancelled: '#6b7280',
  overdue: '#ef4444',
};

const TASK_ICONS: Record<string, string> = {
  ipc_referral: 'medkit-outline',
  home_visit: 'home-outline',
  appetite_test: 'restaurant-outline',
  amoxicillin_treatment: 'medication-outline',
  malaria_test: 'bug-outline',
  deworming: 'thermometer-outline',
  measles_vaccine: 'syringe-outline',
  medical_investigation: 'search-outline',
  discharge_counseling: 'exit-outline',
  community_linkage: 'people-outline',
  nutrition_education: 'book-outline',
  immunization_check: 'shield-checkmark-outline',
  rutf_ration: 'cube-outline',
  weight_monitoring: 'scale-outline',
  oedema_check: 'body-outline',
};

export default function CaseTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ caseId?: string; caseName?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<CaseTaskItem[]>([]);

  const fetchTasks = useCallback(async () => {
    if (!params.caseId) return;
    try {
      const res = await api.get(`/v1/cases/${params.caseId}/tasks/`);
      setTasks(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.caseId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const onRefresh = () => { setRefreshing(true); fetchTasks(); };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Case Tasks</Text>
            {params.caseName && (
              <Text style={styles.headerSubtitle}>{params.caseName}</Text>
            )}
          </View>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="No Tasks"
            subtitle="No tasks have been generated for this case yet."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {tasks.map((task) => {
              const statusColor = STATUS_COLORS[task.status] || colors.textMuted;
              const iconName = TASK_ICONS[task.task_type] || 'list-outline';
              return (
                <View
                  key={task.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: statusColor + '15' }]}>
                      <Ionicons name={iconName as any} size={20} color={statusColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                        {task.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        {task.task_type.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>
                        {task.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                  {task.description ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 18 }}>
                      {task.description}
                    </Text>
                  ) : null}
                  <View style={styles.cardFooter}>
                    {task.due_date && (
                      <View style={styles.footerItem}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                        <Text style={[styles.footerText, { color: colors.textMuted }]}>Due: {task.due_date}</Text>
                      </View>
                    )}
                    {task.completed_at && (
                      <View style={styles.footerItem}>
                        <Ionicons name="checkmark-circle-outline" size={12} color="#10b981" />
                        <Text style={[styles.footerText, { color: '#10b981' }]}>Done: {task.completed_at.split('T')[0]}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: '#ffffff99', marginTop: 2 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cardFooter: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 11, fontWeight: '500' },
});
