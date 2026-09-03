import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface Region { id: number; name: string; code: string; district_count?: number }
interface District { id: number; name: string; code: string; region_id: number; region_name: string; sub_district_count?: number }
interface SubDistrict { id: number; name: string; code: string; district_id: number; district_name: string }

type Tab = 'regions' | 'districts' | 'sub_districts';

export default function LocationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('regions');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);
  const [canManage, setCanManage] = useState<Record<Tab, boolean>>({
    regions: false, districts: false, sub_districts: false,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [regRes, distRes, subRes] = await Promise.all([
        api.get('/v1/locations/regions/'),
        api.get('/v1/locations/districts/'),
        api.get('/v1/locations/sub-districts/'),
      ]);
      setRegions(regRes.data.data || []);
      setDistricts(distRes.data.data || []);
      setSubDistricts(subRes.data.data || []);
      setCanManage({
        regions: !!regRes.data.can_create,
        districts: !!distRes.data.can_create,
        sub_districts: !!subRes.data.can_create,
      });
    } catch {
      Alert.alert('Error', 'Failed to load locations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditItem(null);
    setFormName('');
    setFormCode('');
    setFormParentId('');
    setModalVisible(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setFormName(item.name || '');
    setFormCode(item.code || '');
    setFormParentId(item.region_id ? String(item.region_id) : item.district_id ? String(item.district_id) : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCode.trim()) {
      Alert.alert('Validation', 'Name and code are required');
      return;
    }
    if (tab !== 'regions' && !formParentId) {
      Alert.alert('Validation', `Please select a ${tab === 'districts' ? 'region' : 'district'}`);
      return;
    }
    setSaving(true);
    try {
      const body: any = { name: formName, code: formCode };
      if (tab === 'districts') body.region_id = formParentId ? parseInt(formParentId) : undefined;
      if (tab === 'sub_districts') body.district_id = formParentId ? parseInt(formParentId) : undefined;

      if (editItem) {
        const endpoint = tab === 'regions' ? `/v1/locations/regions/${editItem.id}/` :
          tab === 'districts' ? `/v1/locations/districts/${editItem.id}/` :
          `/v1/locations/sub-districts/${editItem.id}/`;
        await api.put(endpoint, body);
        Alert.alert('Success', 'Updated');
      } else {
        const endpoint = tab === 'regions' ? '/v1/locations/regions/' :
          tab === 'districts' ? '/v1/locations/districts/' :
          '/v1/locations/sub-districts/';
        await api.post(endpoint, body);
        Alert.alert('Success', 'Created');
      }
      setModalVisible(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    const endpoint = tab === 'regions' ? `/v1/locations/regions/${item.id}/` :
      tab === 'districts' ? `/v1/locations/districts/${item.id}/` :
      `/v1/locations/sub-districts/${item.id}/`;
    Alert.alert('Delete', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(endpoint);
            Alert.alert('Success', 'Deleted');
            fetchData();
          } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'regions', label: 'Regions', count: regions.length },
    { key: 'districts', label: 'Districts', count: districts.length },
    { key: 'sub_districts', label: 'Sub-Dist.', count: subDistricts.length },
  ];

  const currentList = tab === 'regions' ? regions : tab === 'districts' ? districts : subDistricts;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location Management</Text>
        {canManage[tab] ? (
          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#3b82f615' }]}>
            <Ionicons name="globe-outline" size={18} color='#3b82f6' />
          </View>
          <Text style={[styles.statNum, { color: colors.textPrimary }]}>{regions.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Regions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#16a34a15' }]}>
            <Ionicons name="location-outline" size={18} color='#16a34a' />
          </View>
          <Text style={[styles.statNum, { color: colors.textPrimary }]}>{districts.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Districts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#7c3aed15' }]}>
            <Ionicons name="business-outline" size={18} color='#7c3aed' />
          </View>
          <Text style={[styles.statNum, { color: colors.textPrimary }]}>{subDistricts.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sub-Districts</Text>
        </View>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.textMuted }]}>{t.label}</Text>
            <View style={[styles.tabBadge, { backgroundColor: tab === t.key ? colors.primary : colors.textMuted + '30' }]}>
              <Text style={[styles.tabBadgeText, { color: tab === t.key ? '#fff' : colors.textMuted }]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
      >
        {currentList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No items</Text>
          </View>
        ) : (
          currentList.map((item: any) => (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.itemTop}>
                <View style={[styles.locIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="location" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.itemCode, { color: colors.textMuted }]}>
                    {item.code || '—'}
                    {item.region_name ? ` • ${item.region_name}` : ''}
                    {item.district_name ? ` • ${item.district_name}` : ''}
                  </Text>
                </View>
              </View>
              {canManage[tab] && <View style={styles.itemActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '10' }]} onPress={() => openEdit(item)}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger + '10' }]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{editItem ? 'Edit' : 'Create'} {tab === 'regions' ? 'Region' : tab === 'districts' ? 'District' : 'Sub-District'}</Text>
            <View style={styles.modalField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name *</Text>
              <TextInput style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={formName} onChangeText={setFormName} placeholder="Name" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.modalField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Code</Text>
              <TextInput style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={formCode} onChangeText={setFormCode} placeholder="Code" placeholderTextColor={colors.textMuted} />
            </View>
            {tab === 'districts' && (
              <View style={styles.modalField}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Region</Text>
                <ScrollView style={[styles.parentList, { borderColor: colors.border }]} nestedScrollEnabled>
                  {regions.map((r) => (
                    <TouchableOpacity key={r.id} style={[styles.parentItem, formParentId === String(r.id) && { backgroundColor: colors.primary + '15' }]} onPress={() => setFormParentId(String(r.id))}>
                      <Text style={[styles.parentText, { color: formParentId === String(r.id) ? colors.primary : colors.textPrimary }]}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {tab === 'sub_districts' && (
              <View style={styles.modalField}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>District</Text>
                <ScrollView style={[styles.parentList, { borderColor: colors.border }]} nestedScrollEnabled>
                  {districts.map((d) => (
                    <TouchableOpacity key={d.id} style={[styles.parentItem, formParentId === String(d.id) && { backgroundColor: colors.primary + '15' }]} onPress={() => setFormParentId(String(d.id))}>
                      <Text style={[styles.parentText, { color: formParentId === String(d.id) ? colors.primary : colors.textPrimary }]}>{d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.textMuted + '20' }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  statsRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, gap: 8 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  tabText: { fontSize: 12, fontWeight: '600' },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  itemCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  locIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemCode: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  modalContent: { borderRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalField: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  parentList: { maxHeight: 150, borderRadius: 10, borderWidth: 1 },
  parentItem: { paddingHorizontal: 14, paddingVertical: 10 },
  parentText: { fontSize: 14, fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
