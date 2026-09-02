import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../lib/theme';
import { useSyncStore } from '../lib/sync-store';
import { useAuthStore } from '../lib/store';

export function SyncStatusBanner() {
  const { colors } = useTheme();
  const ownerId = String(useAuthStore((state) => state.user?.id) || '');
  const { queue: allQueue, isSyncing, lastSyncAt, sync } = useSyncStore();
  const queue = allQueue.filter((item) => !item.ownerId || item.ownerId === ownerId);
  const [online, setOnline] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setOnline(netState.isConnected === true && netState.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  const handleSync = async () => {
    if (!online || isSyncing) return;
    setLastError(null);
    try {
      const before = queue.length;
      await sync(ownerId);
      const after = useSyncStore.getState().queue.filter((item) => !item.ownerId || item.ownerId === ownerId).length;
      if (after > 0) setLastError(`${after} of ${before} requests failed`);
    } catch (e: any) {
      setLastError(e.message || 'Sync failed');
    }
  };

  const hasPending = queue.length > 0;
  const showBanner = !online || hasPending || !!lastError;

  if (!showBanner && !showDetails) return null;

  let backgroundColor = colors.success + '20';
  let textColor = colors.success;
  let iconName: keyof typeof Ionicons.glyphMap = 'cloud-done-outline';
  let message = 'All changes synced';

  if (!online) {
    backgroundColor = colors.warning + '20';
    textColor = colors.warning;
    iconName = 'cloud-offline-outline';
    message = 'Offline mode';
  } else if (isSyncing) {
    backgroundColor = colors.primary + '20';
    textColor = colors.primary;
    iconName = 'sync-outline';
    message = 'Syncing...';
  } else if (lastError) {
    backgroundColor = colors.error + '20';
    textColor = colors.error;
    iconName = 'warning-outline';
    message = 'Sync failed';
  } else if (hasPending) {
    backgroundColor = colors.info + '20';
    textColor = colors.info;
    iconName = 'time-outline';
    message = `${queue.length} pending changes`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={[styles.banner, { backgroundColor }]}
        onPress={() => setShowDetails(!showDetails)}
        activeOpacity={0.8}
      >
        <Ionicons name={iconName} size={18} color={textColor} />
        <Text style={[styles.message, { color: textColor }]}>{message}</Text>
        {isSyncing ? (
          <ActivityIndicator size="small" color={textColor} style={styles.action} />
        ) : hasPending && online ? (
          <TouchableOpacity onPress={handleSync} style={styles.action}>
            <Ionicons name="sync-outline" size={18} color={textColor} />
          </TouchableOpacity>
        ) : (
          <Ionicons 
            name={showDetails ? 'chevron-up-outline' : 'chevron-down-outline'} 
            size={16} 
            color={textColor} 
            style={styles.action}
          />
        )}
      </TouchableOpacity>

      {showDetails && (
        <View style={[styles.details, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DetailRow label="Status" value={online ? 'Online' : 'Offline'} />
          <DetailRow label="Pending" value={queue.length.toString()} />
          <DetailRow 
            label="Last Sync" 
            value={lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Never'} 
          />
          {lastError && (
            <DetailRow label="Error" value={lastError} isError />
          )}
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value, isError }: { label: string; value: string; isError?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}:</Text>
      <Text 
        style={[styles.detailValue, { color: isError ? colors.error : colors.textPrimary }]} 
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  action: {
    marginLeft: 8,
  },
  details: {
    padding: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
});
