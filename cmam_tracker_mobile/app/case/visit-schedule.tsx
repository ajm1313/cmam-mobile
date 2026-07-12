import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import OfflineBanner from '../../components/OfflineBanner';
import EmptyState from '../../components/EmptyState';
import { CardSkeleton } from '../../components/LoadingSkeleton';

interface DueVisit {
  id: number;
  child_name: string;
  registration_number: string;
  malnutrition_type: string;
  facility_name: string;
  last_visit_date: string | null;
  next_due_date: string | null;
  days_overdue: number;
}

interface CaseTask {
  id: number;
  task_type: string;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function VisitScheduleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [dueVisits, setDueVisits] = useState<DueVisit[]>([]);
  const [tasks, setTasks] = useState<Record<number, CaseTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [visitsRes] = await Promise.all([
        api.get('/v1/cases/due-visits/').catch(() => ({ data: { data: { due_visits: [] } } })),
      ]);
      const visits: DueVisit[] = visitsRes.data.data?.due_visits ?? [];
      setDueVisits(visits);

      // Fetch tasks for each due visit case
      if (visits.length > 0) {
        const taskResults = await Promise.all(
          visits.map(v =>
            api.get(`/v1/cases/${v.id}/tasks/`).then(r => ({ caseId: v.id, tasks: r.data.data ?? [] })).catch(() => ({ caseId: v.id, tasks: [] }))
          )
        );
        const taskMap: Record<number, CaseTask[]> = {};
        taskResults.forEach(r => { taskMap[r.caseId] = r.tasks; });
        setTasks(taskMap);
      } else {
        setTasks({});
      }
    } catch {
      setDueVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const requestNotifications = async () => {
    if (!Device.isDevice) {
      Alert.alert('Not Available', 'Notifications only work on physical devices.');
      return;
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Denied', 'Notification permissions were denied.');
      return;
    }
    setNotifEnabled(true);
    scheduleVisitReminders(dueVisits);
    Alert.alert('Enabled', `Visit reminders scheduled for ${dueVisits.length} due cases.`);
  };

  const scheduleVisitReminders = async (visits: DueVisit[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const v of visits) {
      if (v.next_due_date) {
        const dueDate = new Date(v.next_due_date);
        const trigger = new Date(dueDate.getTime() - 9 * 60 * 60 * 1000); // 9am on due date
        if (trigger > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Visit Due',
              body: `${v.child_name} (${v.malnutrition_type}) — visit due today at ${v.facility_name}`,
              data: { caseId: v.id },
            },
            trigger: trigger as any,
          });
        }
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const overdue = dueVisits.filter(v => v.days_overdue > 0);
  const dueToday = dueVisits.filter(v => v.days_overdue === 0);
  const upcoming = dueVisits.filter(v => v.days_overdue < 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={false} />
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visit Schedule & Reminders</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Notification Toggle */}
        <TouchableOpacity
          style={[styles.notifCard, { backgroundColor: colors.surface, borderColor: notifEnabled ? colors.success + '40' : colors.border }]}
          onPress={requestNotifications}
          activeOpacity={0.7}
        >
          <View style={[styles.notifIcon, { backgroundColor: notifEnabled ? colors.success + '15' : colors.primary + '15' }]}>
            <Ionicons name={notifEnabled ? 'notifications' : 'notifications-off-outline'} size={20} color={notifEnabled ? colors.success : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>
              {notifEnabled ? 'Reminders Active' : 'Enable Visit Reminders'}
            </Text>
            <Text style={[styles.notifSub, { color: colors.textMuted }]}>
              {notifEnabled ? `${dueVisits.length} reminders scheduled` : 'Get notified when visits are due'}
            </Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <SummaryPill label="Overdue" value={overdue.length} color={colors.danger} bg={colors.surface} />
          <SummaryPill label="Due Today" value={dueToday.length} color={colors.warning} bg={colors.surface} />
          <SummaryPill label="Upcoming" value={upcoming.length} color={colors.success} bg={colors.surface} />
        </View>

        {loading ? (
          <View style={{ paddingTop: 8 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : dueVisits.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No due visits" subtitle="All caught up! No visits are currently due." />
        ) : (
          <>
            {overdue.length > 0 && (
              <SectionHeader title="Overdue" count={overdue.length} color={colors.danger} />
            )}
            {overdue.map(v => (
              <VisitCard key={v.id} visit={v} colors={colors} taskCount={tasks[v.id]?.length ?? 0} onPress={() => router.push({ pathname: `/case/${v.id}` })} />
            ))}

            {dueToday.length > 0 && (
              <SectionHeader title="Due Today" count={dueToday.length} color={colors.warning} />
            )}
            {dueToday.map(v => (
              <VisitCard key={v.id} visit={v} colors={colors} taskCount={tasks[v.id]?.length ?? 0} onPress={() => router.push({ pathname: `/case/${v.id}` })} />
            ))}

            {upcoming.length > 0 && (
              <SectionHeader title="Upcoming" count={upcoming.length} color={colors.success} />
            )}
            {upcoming.map(v => (
              <VisitCard key={v.id} visit={v} colors={colors} taskCount={tasks[v.id]?.length ?? 0} onPress={() => router.push({ pathname: `/case/${v.id}` })} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: bg, borderTopColor: color }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionBadge, { backgroundColor: color + '15' }]}>
        <Text style={[styles.sectionBadgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

function VisitCard({ visit, colors, taskCount, onPress }: { visit: DueVisit; colors: any; taskCount?: number; onPress: () => void }) {
  const typeColor = visit.malnutrition_type === 'SAM' ? colors.danger : colors.warning;
  const isOverdue = visit.days_overdue > 0;
  const statusColor = isOverdue ? colors.danger : visit.days_overdue === 0 ? colors.warning : colors.success;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{visit.child_name}</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>{visit.registration_number} • {visit.facility_name}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '15', borderColor: typeColor + '40' }]}>
          <Text style={[styles.typeText, { color: typeColor }]}>{visit.malnutrition_type}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={13} color={statusColor} />
          <Text style={[styles.footerText, { color: statusColor, fontWeight: '700' }]}>
            {isOverdue ? `${visit.days_overdue}d overdue` : visit.days_overdue === 0 ? 'Due today' : `In ${Math.abs(visit.days_overdue)}d`}
          </Text>
        </View>
        {visit.last_visit_date && (
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Last: {new Date(visit.last_visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </Text>
        )}
        {!!taskCount && taskCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="checkbox-outline" size={12} color={colors.primary} />
            <Text style={[styles.footerText, { color: colors.primary, fontWeight: '600' }]}>{taskCount} task{taskCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  notifCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, marginTop: 12, borderRadius: 14, padding: 14, borderWidth: 1.5 },
  notifIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '700' },
  notifSub: { fontSize: 11, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  summaryPill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' },
  card: { marginHorizontal: 12, marginTop: 6, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSub: { fontSize: 11, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  typeText: { fontSize: 10, fontWeight: '800' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  footerText: { fontSize: 11, fontWeight: '500' },
});
