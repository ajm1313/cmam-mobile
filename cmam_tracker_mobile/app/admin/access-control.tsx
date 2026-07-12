import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface Role { id: number; name: string; display_name: string; level: number; description: string; }
interface Feature { id: number; key: string; name: string; category: string; is_core: boolean; }
interface Permission { id: number; role_level: number; feature_id: number; feature_key: string; is_enabled: boolean; access_level: string; }

const LEVEL_COLOR: Record<number, string> = { 0: '#7c3aed', 1: '#1e3a8a', 2: '#0369a1', 3: '#0f766e', 4: '#15803d', 5: '#92400e' };
const ACCESS_LEVELS = ['limited', 'full', 'read_only'];

export default function AccessControlScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(2);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { is_enabled: boolean; access_level: string }>>({});

  const fetchData = useCallback(async () => {
    try {
      const [rolesRes, aclRes] = await Promise.all([
        api.get('/v1/roles/'),
        api.get('/v1/access-control/'),
      ]);
      setRoles(rolesRes.data.data || []);
      setFeatures(aclRes.data.data?.features || []);
      setPermissions(aclRes.data.data?.permissions || []);
    } catch {
      Alert.alert('Error', 'Failed to load access control data');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getPermKey = (feature_id: number) => `${selectedLevel}_${feature_id}`;

  const getPerm = (feature: Feature): { is_enabled: boolean; access_level: string } => {
    const key = getPermKey(feature.id);
    if (pendingChanges[key]) return pendingChanges[key];
    const p = permissions.find((p) => p.role_level === selectedLevel && p.feature_id === feature.id);
    return p ? { is_enabled: p.is_enabled, access_level: p.access_level } : { is_enabled: false, access_level: 'limited' };
  };

  const toggleEnabled = (feature: Feature) => {
    if (feature.is_core) return;
    const key = getPermKey(feature.id);
    const cur = getPerm(feature);
    setPendingChanges({ ...pendingChanges, [key]: { ...cur, is_enabled: !cur.is_enabled } });
  };

  const setAccessLevel = (feature: Feature, level: string) => {
    if (feature.is_core) return;
    const key = getPermKey(feature.id);
    const cur = getPerm(feature);
    setPendingChanges({ ...pendingChanges, [key]: { ...cur, access_level: level } });
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const handleSave = async () => {
    if (!hasPendingChanges) return;
    setSaving(true);
    try {
      const updates = features.map((f) => {
        const perm = getPerm(f);
        return { role_level: selectedLevel, feature_id: f.id, is_enabled: perm.is_enabled, access_level: perm.access_level };
      });
      await api.put('/v1/access-control/update/', { updates });
      Alert.alert('Success', 'Permissions saved');
      setPendingChanges({});
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save permissions');
    } finally { setSaving(false); }
  };

  const categorized = features.reduce<Record<string, Feature[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const selectedRole = roles.find((r) => r.level === selectedLevel);
  const roleColor = LEVEL_COLOR[selectedLevel] || colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Access Control</Text>
        {hasPendingChanges ? (
          <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        ) : <View style={{ width: 56 }} />}
      </View>

      {/* Role Selector */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Select Role Level</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 4 }}>
        {roles.filter((r) => r.level > 0).map((r) => {
          const rc = LEVEL_COLOR[r.level] || colors.primary;
          const sel = selectedLevel === r.level;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.roleChip, { backgroundColor: sel ? rc : colors.surface, borderColor: rc, borderWidth: 1.5 }]}
              onPress={() => { setSelectedLevel(r.level); setPendingChanges({}); }}
            >
              <Text style={[styles.roleChipText, { color: sel ? '#fff' : rc }]}>{r.display_name || r.name}</Text>
              <View style={[styles.levelBadge, { backgroundColor: sel ? 'rgba(255,255,255,0.25)' : rc + '20' }]}>
                <Text style={[styles.levelBadgeText, { color: sel ? '#fff' : rc }]}>L{r.level}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedRole && (
        <View style={[styles.roleInfo, { backgroundColor: roleColor + '10', borderColor: roleColor + '30', borderWidth: 1 }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={roleColor} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.roleInfoName, { color: roleColor }]}>{selectedRole.display_name}</Text>
            {selectedRole.description ? <Text style={[styles.roleInfoDesc, { color: colors.textMuted }]}>{selectedRole.description}</Text> : null}
          </View>
          {hasPendingChanges && (
            <View style={[styles.unsavedDot, { backgroundColor: colors.warning }]}>
              <Text style={styles.unsavedText}>Unsaved</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
      >
        {Object.entries(categorized).map(([category, featureList]) => (
          <View key={category}>
            <Text style={[styles.catLabel, { color: colors.textMuted }]}>{category}</Text>
            <View style={[styles.categoryCard, { backgroundColor: colors.surface }]}>
              {featureList.map((feature, idx) => {
                const perm = getPerm(feature);
                const isLast = idx === featureList.length - 1;
                return (
                  <View key={feature.id} style={[styles.featureRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={styles.featureLeft}>
                      <View style={[styles.featureIcon, { backgroundColor: feature.is_core ? colors.success + '15' : colors.primary + '15' }]}>
                        <Ionicons name={feature.is_core ? 'lock-closed' : 'key-outline'} size={15} color={feature.is_core ? colors.success : colors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.featureNameRow}>
                          <Text style={[styles.featureName, { color: colors.textPrimary }]}>{feature.name}</Text>
                          {feature.is_core && (
                            <View style={[styles.corePill, { backgroundColor: colors.success + '15' }]}>
                              <Text style={[styles.coreText, { color: colors.success }]}>Core</Text>
                            </View>
                          )}
                        </View>
                        {/* Access level selector */}
                        {!feature.is_core && perm.is_enabled && (
                          <View style={styles.accessRow}>
                            {ACCESS_LEVELS.map((al) => (
                              <TouchableOpacity
                                key={al}
                                style={[styles.alChip, { backgroundColor: perm.access_level === al ? roleColor + '20' : colors.inputBg, borderColor: perm.access_level === al ? roleColor : colors.border, borderWidth: 1 }]}
                                onPress={() => setAccessLevel(feature, al)}
                              >
                                <Text style={[styles.alText, { color: perm.access_level === al ? roleColor : colors.textMuted }]}>{al.replace('_', ' ')}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={feature.is_core ? true : perm.is_enabled}
                      onValueChange={() => toggleEnabled(feature)}
                      disabled={feature.is_core}
                      trackColor={{ false: colors.border, true: roleColor + '60' }}
                      thumbColor={perm.is_enabled || feature.is_core ? roleColor : colors.textMuted}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {hasPendingChanges && (
        <View style={[styles.saveBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.saveBarText, { color: colors.textMuted }]}>You have unsaved changes</Text>
          <TouchableOpacity style={[styles.saveBarBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBarBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  roleChipText: { fontSize: 13, fontWeight: '700' },
  levelBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  levelBadgeText: { fontSize: 11, fontWeight: '800' },
  roleInfo: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 12, padding: 12 },
  roleInfoName: { fontSize: 14, fontWeight: '700' },
  roleInfoDesc: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  unsavedDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  unsavedText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  catLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 6 },
  categoryCard: { marginHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  featureLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  featureIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  featureNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureName: { fontSize: 14, fontWeight: '600' },
  corePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  coreText: { fontSize: 10, fontWeight: '700' },
  accessRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  alChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  alText: { fontSize: 10, fontWeight: '600' },
  saveBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  saveBarText: { fontSize: 13, fontWeight: '500' },
  saveBarBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  saveBarBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
