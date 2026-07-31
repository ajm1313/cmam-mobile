import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../lib/store';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import { useSyncStore } from '../../lib/sync-store';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, mode: themeMode, setMode: setThemeMode } = useTheme();
  const { logout } = useAuthStore();
  const { queue } = useSyncStore();
  const insets = useSafeAreaInsets();

  const [apiUrl, setApiUrl] = useState('');
  const [cacheTtl, setCacheTtl] = useState('10');
  const [syncInterval, setSyncInterval] = useState('5');
  const [biometric, setBiometric] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const url = await AsyncStorage.getItem('cmam_api_url');
        const ttl = await AsyncStorage.getItem('cmam_cache_ttl');
        const interval = await AsyncStorage.getItem('cmam_sync_interval');
        const bio = await AsyncStorage.getItem('cmam_biometric');
        setApiUrl(url || '');
        setCacheTtl(ttl || '10');
        setSyncInterval(interval || '5');
        setBiometric(bio === 'true');
      } catch (e: any) { console.warn('Failed to load settings', e?.message); }
      setLoaded(true);
    })();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    try { await AsyncStorage.setItem(key, value); } catch (e: any) { console.warn('Failed to save setting', key, e?.message); }
  };

  const handleSave = () => {
    saveSetting('cmam_cache_ttl', cacheTtl);
    saveSetting('cmam_sync_interval', syncInterval);
    Alert.alert('Saved', 'Settings updated successfully.');
  };

  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'Remove all cached data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          const keys = await AsyncStorage.getAllKeys();
          const cacheKeys = keys.filter(k => k.startsWith('cache_') || k.startsWith('cases_') || k.startsWith('reports_') || k.startsWith('inventory_') || k.startsWith('dashboard_'));
          await AsyncStorage.multiRemove(cacheKeys as string[]);
          Alert.alert('Done', `Cleared ${cacheKeys.length} cache entries.`);
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="moon-outline" size={20} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
            </View>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>System Theme</Text>
            </View>
            <Switch
              value={themeMode === 'system'}
              onValueChange={(v) => setThemeMode(v ? 'system' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* Data & Sync */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DATA & SYNC</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/admin/offline-sync' as any)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Offline Sync Queue</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>
                  {queue.length} item(s) pending
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Cache TTL (minutes)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                value={cacheTtl}
                onChangeText={setCacheTtl}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Auto-sync Interval (minutes)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                value={syncInterval}
                onChangeText={setSyncInterval}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.settingLabel, { color: colors.danger }]}>Clear Cache</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SECURITY</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/change-password')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="key-outline" size={20} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Biometric Login</Text>
            </View>
            <Switch
              value={biometric}
              onValueChange={(v) => { setBiometric(v); saveSetting('cmam_biometric', String(v)); }}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Version</Text>
            </View>
            <Text style={[styles.settingValue, { color: colors.textMuted }]}>1.0.0</Text>
          </View>
          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="server-outline" size={20} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>API Server</Text>
            </View>
            <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={1}>nutri.pharn.org</Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.danger + '40' }]} onPress={() => { logout(); router.replace('/login'); }} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  section: { marginHorizontal: 12, borderRadius: 14, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingLabel: { fontSize: 14, fontWeight: '600' },
  settingSub: { fontSize: 11, marginTop: 2 },
  settingValue: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, marginTop: 6, width: 80 },
  saveBtn: { marginHorizontal: 12, marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  logoutBtn: { marginHorizontal: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5 },
  logoutBtnText: { fontSize: 14, fontWeight: '700' },
});
