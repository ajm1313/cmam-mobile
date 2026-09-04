import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, Platform, Image as RNImage, ActivityIndicator, Linking,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../lib/store';

import { useTheme, type ThemeMode } from '../../lib/theme';
import { useSyncStore } from '../../lib/sync-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { storage } from '../../lib/api';
import { appConfig } from '../../lib/config';
import { getNotificationPermissionStatus, syncPushToken } from '../../lib/notifications';

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroCard: {
    backgroundColor: colors.primary, alignItems: 'center',
    paddingTop: 36, paddingBottom: 32, paddingHorizontal: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginBottom: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)',
    marginBottom: 14,
  },
  avatarWrap: { marginBottom: 14, position: 'relative' },
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)' },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, marginBottom: 14 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  section: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1,
  },
  editPillText: { fontSize: 12, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  infoIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
  },
  actionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  actionHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 16, paddingVertical: 15,
    backgroundColor: colors.danger + '10', borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.danger + '30',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.danger },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: 24, paddingHorizontal: 24 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#f8fafc',
  },
  themeChipActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  themeChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  themeChipTextActive: { color: '#fff' },
  dataRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  dataIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  dataLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  dataHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  syncBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  spin: { transform: [{ rotate: '45deg' }] },
  dataActionBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  dataActionText: { fontSize: 13, fontWeight: '600' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#f8fafc',
  },
});
const THEME_OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const canImportExport = !!user?.can_import_export;
  const { mode, setMode } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const { queue: syncQueue, isSyncing: syncing, sync: runSync } = useSyncStore();
  const [cacheSize, setCacheSize] = useState('0 KB');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('undetermined');
  const [savingPreference, setSavingPreference] = useState<string | null>(null);

  useEffect(() => {
    calculateCacheSize();
    loadAvatar();
    getNotificationPermissionStatus().then(setNotificationStatus).catch(() => {});
  }, []);

  const enableDeviceNotifications = async () => {
    try {
      const enabled = await syncPushToken();
      const status = await getNotificationPermissionStatus();
      setNotificationStatus(status);
      if (enabled) Alert.alert('Notifications enabled', 'This device is registered for CMAM alerts.');
      else Alert.alert('Permission required', 'Allow notifications in your device settings, then try again.');
    } catch {
      Alert.alert('Could not enable notifications', 'Check your connection and try again.');
    }
  };

  const updateNotificationPreference = async (
    field: 'notify_visits' | 'notify_discharge' | 'notify_stock',
    value: boolean,
  ) => {
    if (!user || savingPreference) return;
    const previous = user;
    setSavingPreference(field);
    setUser({ ...user, [field]: value });
    try {
      const response = await api.patch('/v1/profile/update/', { [field]: value });
      const updated = response.data.data;
      setUser(updated);
      await storage.setItem('auth_user', JSON.stringify(updated));
    } catch {
      setUser(previous);
      Alert.alert('Update failed', 'Your notification preference was not saved.');
    } finally {
      setSavingPreference(null);
    }
  };

  const loadAvatar = async () => {
    try {
      const saved = await AsyncStorage.getItem('cmam_avatar_uri');
      if (saved) setAvatarUri(saved);
    } catch {}
  };

  const pickImage = async (fromCamera: boolean) => {
    const permissionResult = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', `${fromCamera ? 'Camera' : 'Photo library'} access is required.`);
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    await AsyncStorage.setItem('cmam_avatar_uri', uri);
    setUploading(true);
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        const formData = new FormData();
        formData.append('avatar', {
          uri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        } as any);
        await api.patch('/v1/profile/update/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch(() => {});
      }
    } catch {
      // Avatar saved locally even if upload fails
    } finally {
      setUploading(false);
    }
  };

  const showAvatarOptions = () => {
    Alert.alert('Change Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => pickImage(true) },
      { text: 'Gallery', onPress: () => pickImage(false) },
      { text: 'Remove Photo', style: 'destructive', onPress: async () => { setAvatarUri(null); await AsyncStorage.removeItem('cmam_avatar_uri'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const stores = await AsyncStorage.multiGet(keys);
      let total = 0;
      stores.forEach(([_, value]) => {
        if (value) total += value.length;
      });
      setCacheSize(formatBytes(total));
    } catch {
      setCacheSize('Unknown');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleManualSync = async () => {
    if (syncing) return;
    try {
      await runSync();
      Alert.alert('Success', 'Sync completed successfully');
    } catch {
      Alert.alert('Error', 'Sync failed. Please try again.');
    }
  };

  const handleExportData = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const data: Record<string, any> = {};
      
      for (const key of keys) {
        if (key.startsWith('case_') || key.startsWith('visit_') || key === 'offline_queue') {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            try {
              data[key] = JSON.parse(value);
            } catch {
              data[key] = value;
            }
          }
        }
      }

      const exportContent = JSON.stringify(data, null, 2);
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (Platform.OS === 'web') {
        const blob = new Blob([exportContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cmam_backup_${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: exportContent,
          title: `CMAM Backup ${timestamp}`,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached data. Pending sync items will be preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(k => 
                k.startsWith('cache_') || k.startsWith('list_') || k === 'theme'
              );
              await AsyncStorage.multiRemove(cacheKeys);
              await calculateCacheSize();
              Alert.alert('Success', 'Cache cleared');
            } catch {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            router.replace('/login');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const roleName = user?.role?.name ?? '—';
  const roleLevel = user?.role?.level;
  const facilityName = user?.location?.facility_name;
  const districtName = user?.location?.district_name;
  const regionName = user?.location?.region_name;

  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const roleColor = roleLevel === 0 ? colors.danger :
    roleLevel === 1 ? colors.primary :
    roleLevel === 2 ? colors.secondary : colors.success;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Avatar Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
        <TouchableOpacity style={styles.avatarWrap} onPress={showAvatarOptions} activeOpacity={0.8}>
          {avatarUri ? (
            <RNImage source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            {uploading ? (
              <ActivityIndicator size={12} color="#fff" />
            ) : (
              <Ionicons name="camera" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name ?? '—'}</Text>
        <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>
        <View style={[styles.rolePill, { backgroundColor: roleColor + '22', borderColor: roleColor + '44' }]}>
          <Ionicons name="shield-checkmark-outline" size={12} color={roleColor} />
          <Text style={[styles.rolePillText, { color: roleColor }]}>{roleName}</Text>
        </View>
      </View>

      {/* Location Info */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Assignment</Text>
        {facilityName && <InfoRow icon="business-outline" label="Facility" value={facilityName} colors={colors} />}
        {districtName && <InfoRow icon="map-outline" label="District" value={districtName} colors={colors} />}
        {regionName && <InfoRow icon="globe-outline" label="Region" value={regionName} colors={colors} />}
        {!facilityName && !districtName && !regionName && (
          <InfoRow icon="earth-outline" label="Level" value="National" colors={colors} />
        )}
      </View>

      {/* Account Info */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account Details</Text>
          <TouchableOpacity
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
            style={[styles.editPill, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
          >
            <Ionicons name="create-outline" size={13} color={colors.primary} />
            <Text style={[styles.editPillText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} colors={colors} />
        <InfoRow icon="person-outline" label="Name" value={user?.name ?? '—'} colors={colors} />
        {user?.phone ? (
          <InfoRow icon="call-outline" label="Phone" value={user.phone} colors={colors} />
        ) : null}
        {user?.created_at && (
          <InfoRow
            icon="calendar-outline"
            label="Member Since"
            value={new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            colors={colors}
          />
        )}
      </View>

      {/* App Info */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Application</Text>
        <InfoRow icon="phone-portrait-outline" label="Version" value="1.4.0" colors={colors} />
        <InfoRow icon="server-outline" label="API" value="cmam-tracker-django-production.up.railway.app" colors={colors} />
        <InfoRow icon="information-circle-outline" label="App" value="CMAM Tracker" colors={colors} />
        <InfoRow icon="code-working-outline" label="Developer" value="AJM Solutions" colors={colors} />
        <InfoRow icon="call-outline" label="Contact" value="+233 24 150 9312" colors={colors} />
      </View>

      {/* Actions */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Security</Text>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/change-password')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="key-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Change Password</Text>
            <Text style={[styles.actionHint, { color: colors.textMuted }]}>Update your account password</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* DHIMS2 Integration */}
      {!user?.is_facility_level_only && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Integrations</Text>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              const baseUrl = appConfig.apiBaseUrl.replace('/api', '');
              Linking.openURL(`${baseUrl}/manage/dhis2/`);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>DHIMS2 Integration</Text>
              <Text style={[styles.actionHint, { color: colors.textMuted }]}>Configure DHIMS2 mappings & push reports</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notifications</Text>
          <TouchableOpacity
            onPress={enableDeviceNotifications}
            style={[styles.editPill, {
              backgroundColor: notificationStatus === 'granted' ? colors.success + '12' : colors.primary + '12',
              borderColor: notificationStatus === 'granted' ? colors.success + '30' : colors.primary + '30',
            }]}
          >
            <Ionicons
              name={notificationStatus === 'granted' ? 'checkmark-circle-outline' : 'notifications-outline'}
              size={13}
              color={notificationStatus === 'granted' ? colors.success : colors.primary}
            />
            <Text style={[styles.editPillText, { color: notificationStatus === 'granted' ? colors.success : colors.primary }]}>
              {notificationStatus === 'granted' ? 'Device enabled' : 'Enable device'}
            </Text>
          </TouchableOpacity>
        </View>
        <NotificationPreferenceRow
          icon="calendar-outline" label="Visit reminders"
          hint="Due, overdue and programme transition alerts"
          value={user?.notify_visits ?? true}
          disabled={savingPreference !== null}
          onValueChange={value => updateNotificationPreference('notify_visits', value)}
          colors={colors}
        />
        <NotificationPreferenceRow
          icon="checkmark-done-outline" label="Discharge alerts"
          hint="Children who become eligible for discharge"
          value={user?.notify_discharge ?? true}
          disabled={savingPreference !== null}
          onValueChange={value => updateNotificationPreference('notify_discharge', value)}
          colors={colors}
        />
        <NotificationPreferenceRow
          icon="cube-outline" label="Stock alerts"
          hint="Critical, low-stock and reorder warnings"
          value={user?.notify_stock ?? false}
          disabled={savingPreference !== null}
          onValueChange={value => updateNotificationPreference('notify_stock', value)}
          colors={colors}
        />
      </View>

      {/* Appearance */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.themeChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setMode(opt.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={opt.icon as any} size={16} color={active ? '#fff' : colors.textSecondary} />
                <Text style={[styles.themeChipText, { color: colors.textSecondary }, active && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Data & Sync */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Data & Sync</Text>
        
        {/* Sync Status */}
        <View style={styles.dataRow}>
          <View style={[styles.dataIconWrap, { backgroundColor: colors.success + '10' }]}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataLabel, { color: colors.textPrimary }]}>Pending Sync</Text>
            <Text style={[styles.dataHint, { color: colors.textMuted }]}>{syncQueue.length} items waiting</Text>
          </View>
          {syncQueue.length > 0 && (
            <TouchableOpacity
              style={[styles.syncBtn, { backgroundColor: colors.primary }, syncing && { opacity: 0.6 }]}
              onPress={handleManualSync}
              disabled={syncing}
            >
              <Ionicons name={syncing ? "sync" : "sync-outline"} size={16} color="#fff" style={syncing && styles.spin} />
              <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sync Queue Detail Link */}
        <TouchableOpacity style={[styles.dataRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/admin/offline-sync' as any)} activeOpacity={0.7}>
          <View style={[styles.dataIconWrap, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="list-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataLabel, { color: colors.textPrimary }]}>Sync Queue</Text>
            <Text style={[styles.dataHint, { color: colors.textMuted }]}>View pending items & conflicts</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Cache Size */}
        <View style={[styles.dataRow, { borderBottomWidth: 0 }]}>
          <View style={[styles.dataIconWrap, { backgroundColor: colors.secondary + '10' }]}>
            <Ionicons name="save-outline" size={16} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataLabel, { color: colors.textPrimary }]}>Storage Used</Text>
            <Text style={[styles.dataHint, { color: colors.textMuted }]}>{cacheSize}</Text>
          </View>
          <TouchableOpacity
            style={[styles.dataActionBtn, { borderColor: colors.border }]}
            onPress={handleClearCache}
          >
            <Text style={[styles.dataActionText, { color: colors.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {canImportExport && (
          <>
            {/* Import Data */}
            <TouchableOpacity style={styles.dataRow} onPress={() => router.push('/import-data')} activeOpacity={0.7}>
              <View style={[styles.dataIconWrap, { backgroundColor: colors.info + '10' }]}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dataLabel, { color: colors.textPrimary }]}>Import Data</Text>
                <Text style={[styles.dataHint, { color: colors.textMuted }]}>Bulk import cases or inventory</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Export Data */}
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportData} activeOpacity={0.7}>
              <View style={[styles.dataIconWrap, { backgroundColor: colors.warning + '10' }]}>
                <Ionicons name="download-outline" size={16} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dataLabel, { color: colors.textPrimary }]}>Export Local Data</Text>
                <Text style={[styles.dataHint, { color: colors.textMuted }]}>Backup cases & visits</Text>
              </View>
              <Ionicons name="share-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }, loggingOut && { opacity: 0.6 }]}
        onPress={handleLogout}
        disabled={loggingOut}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>{loggingOut ? 'Signing out...' : 'Sign Out'}</Text>
      </TouchableOpacity>

      <Text style={[styles.footer, { color: colors.textMuted }]}>CMAM Tracker v1.4.0 • Developed by AJM Solutions • +233 24 150 9312</Text>
    </ScrollView>
  );


}

function InfoRow({ icon, label, value, colors }: { icon: any; label: string; value: string; colors: any }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.infoIconWrap, { backgroundColor: colors.primary + '10' }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

function NotificationPreferenceRow({ icon, label, hint, value, disabled, onValueChange, colors }: {
  icon: any; label: string; hint: string; value: boolean; disabled: boolean;
  onValueChange: (value: boolean) => void; colors: any;
}) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.actionRow}>
      <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '10' }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.actionHint, { color: colors.textMuted }]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : '#f8fafc'}
      />
    </View>
  );
}
