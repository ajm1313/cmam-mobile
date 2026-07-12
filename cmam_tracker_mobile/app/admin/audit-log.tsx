import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import EmptyState from '../../components/EmptyState';
import { CardSkeleton } from '../../components/LoadingSkeleton';

interface AuditEntry {
  id: number;
  user: string;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: '#16a34a',
  update: '#2563eb',
  delete: '#dc2626',
  login: '#7c3aed',
  logout: '#64748b',
  export: '#d97706',
  import: '#0891b2',
  view: '#6b7280',
  other: '#6b7280',
};

const ACTION_ICONS: Record<string, string> = {
  create: 'add-circle-outline',
  update: 'create-outline',
  delete: 'trash-outline',
  login: 'log-in-outline',
  logout: 'log-out-outline',
  export: 'download-outline',
  import: 'cloud-upload-outline',
  view: 'eye-outline',
  other: 'ellipsis-horizontal-outline',
};

export default function AuditLogScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get('/v1/audit-log/');
      setLogs(res.data.data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }, [fetchLogs]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter);
  const actions = ['all', ...new Set(logs.map(l => l.action))];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity Log</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {actions.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.filterChip, { backgroundColor: filter === a ? colors.primary : colors.surface, borderColor: filter === a ? colors.primary : colors.border }]}
              onPress={() => setFilter(a)}
            >
              <Text style={[styles.filterChipText, { color: filter === a ? '#fff' : colors.textMuted }]}>
                {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {loading ? (
          <View style={{ paddingTop: 8 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : filtered.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No activity" subtitle="No audit log entries found." />
        ) : (
          filtered.map((log) => {
            const actionColor = ACTION_COLORS[log.action] || colors.textMuted;
            const actionIcon = ACTION_ICONS[log.action] || 'ellipsis-horizontal-outline';
            return (
              <View key={log.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.actionIcon, { backgroundColor: actionColor + '15' }]}>
                    <Ionicons name={actionIcon as any} size={16} color={actionColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardUser, { color: colors.textPrimary }]}>{log.user}</Text>
                    <Text style={[styles.cardAction, { color: actionColor, fontWeight: '700', textTransform: 'capitalize' }]}>
                      {log.action} • {log.resource_type}
                    </Text>
                  </View>
                  <Text style={[styles.cardTime, { color: colors.textMuted }]}>{formatTime(log.created_at)}</Text>
                </View>
                {log.details && (
                  <Text style={[styles.cardDetails, { color: colors.textSecondary }]} numberOfLines={3}>
                    {log.details}
                  </Text>
                )}
                {log.ip_address && (
                  <View style={styles.cardFooter}>
                    <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>{log.ip_address}</Text>
                  </View>
                )}
              </View>
            );
          })
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
  filterScroll: { maxHeight: 50, paddingTop: 10 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  card: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardUser: { fontSize: 14, fontWeight: '700' },
  cardAction: { fontSize: 12, marginTop: 2 },
  cardTime: { fontSize: 10, fontWeight: '500' },
  cardDetails: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerText: { fontSize: 10, fontWeight: '500' },
});
