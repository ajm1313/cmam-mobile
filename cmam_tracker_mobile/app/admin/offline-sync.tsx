import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import { useSyncStore, type SyncQueueItem } from '../../lib/sync-store';
import EmptyState from '../../components/EmptyState';
import ConflictResolutionModal from '../../components/ConflictResolutionModal';

export default function OfflineSyncScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { queue, isSyncing, lastSyncAt, sync, removeItem, clear, resolveConflict } = useSyncStore();
  const [refreshing, setRefreshing] = useState(false);
  const [conflictItem, setConflictItem] = useState<SyncQueueItem | null>(null);

  const handleSync = useCallback(async () => {
    if (queue.length === 0) {
      Alert.alert('Nothing to Sync', 'The queue is empty.');
      return;
    }
    await sync();
    const remaining = useSyncStore.getState().queue.length;
    const synced = queue.length - remaining;
    Alert.alert(
      'Sync Complete',
      `${synced} item(s) synced successfully.${remaining > 0 ? `\n${remaining} item(s) failed — will retry.` : ''}`
    );
  }, [queue, sync]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await handleSync();
    setRefreshing(false);
  }, [handleSync]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Offline Sync Queue</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: queue.length > 0 ? colors.warning + '15' : colors.success + '15' }]}>
              <Ionicons name={queue.length > 0 ? 'cloud-upload-outline' : 'checkmark-circle-outline'} size={24} color={queue.length > 0 ? colors.warning : colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                {queue.length > 0 ? `${queue.length} item(s) pending` : 'All synced'}
              </Text>
              <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                {lastSyncAt ? `Last sync: ${formatTime(lastSyncAt)}` : 'No sync performed yet'}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.syncBtn, { backgroundColor: colors.primary, opacity: isSyncing || queue.length === 0 ? 0.5 : 1 }]}
              onPress={handleSync}
              disabled={isSyncing || queue.length === 0}
              activeOpacity={0.7}
            >
              {isSyncing ? <ActivityIndicator size={18} color="#fff" /> : <Ionicons name="sync-outline" size={18} color="#fff" />}
              <Text style={styles.syncBtnText}>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
            </TouchableOpacity>
            {queue.length > 0 && (
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: colors.danger + '40' }]}
                onPress={() => Alert.alert('Clear Queue', 'Remove all pending items?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: clear },
                ])}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Queue Items */}
        {queue.length === 0 ? (
          <EmptyState icon="cloud-done-outline" title="Queue empty" subtitle="No pending data to sync. All your changes are saved." />
        ) : (
          queue.map((item) => (
            <View
              key={item.id}
              style={[
                styles.queueItem,
                { backgroundColor: colors.surface, borderWidth: item.conflict ? 1.5 : 0, borderColor: item.conflict ? colors.danger : 'transparent' },
              ]}
            >
              {item.conflict && (
                <TouchableOpacity
                  style={[styles.conflictBanner, { backgroundColor: colors.danger + '12' }]}
                  onPress={() => setConflictItem(item)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                  <Text style={[styles.conflictText, { color: colors.danger }]}>
                    Conflict detected — tap to review and resolve
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.danger} />
                </TouchableOpacity>
              )}
              <View style={styles.queueHeader}>
                <View style={[styles.methodBadge, { backgroundColor: item.method === 'DELETE' ? colors.danger + '15' : item.method === 'PATCH' ? colors.warning + '15' : colors.success + '15' }]}>
                  <Text style={[styles.methodText, { color: item.method === 'DELETE' ? colors.danger : item.method === 'PATCH' ? colors.warning : colors.success }]}>
                    {item.method}
                  </Text>
                </View>
                <Text style={[styles.queueLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                {!item.conflict && item.retries > 0 && (
                  <View style={[styles.retryBadge, { backgroundColor: colors.danger + '15' }]}>
                    <Text style={[styles.retryText, { color: colors.danger }]}>{item.retries} retries</Text>
                  </View>
                )}
              </View>
              <View style={styles.queueFooter}>
                <Text style={[styles.queueUrl, { color: colors.textMuted }]}>{item.url}</Text>
                <Text style={[styles.queueTime, { color: colors.textMuted }]}>{formatTime(item.timestamp)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.removeBtn, { borderColor: item.conflict ? colors.danger + '40' : colors.border }]}
                onPress={() => removeItem(item.id)}
              >
                <Text style={[styles.removeBtnText, { color: item.conflict ? colors.danger : colors.textMuted }]}>
                  {item.conflict ? 'Discard' : 'Remove'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <ConflictResolutionModal
        item={conflictItem}
        onResolve={resolveConflict}
        onClose={() => setConflictItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statusCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  statusIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  statusSub: { fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  syncBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  clearBtnText: { fontSize: 13, fontWeight: '700' },
  queueItem: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  methodText: { fontSize: 10, fontWeight: '800' },
  queueLabel: { fontSize: 14, fontWeight: '700', flex: 1 },
  retryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  retryText: { fontSize: 10, fontWeight: '700' },
  queueFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  queueUrl: { fontSize: 11, fontFamily: 'monospace' },
  queueTime: { fontSize: 11 },
  removeBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  removeBtnText: { fontSize: 11, fontWeight: '600' },
  conflictBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 8, borderRadius: 8, marginBottom: 8 },
  conflictText: { fontSize: 11, fontWeight: '600', flex: 1 },
});
