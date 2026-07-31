import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import { useAuthStore } from '../../lib/store';

interface Movement {
  id: number; item_name: string; item_code: string;
  movement_type: string; quantity: number;
  source: string; destination: string;
  notes: string; created_by_name: string | null;
  movement_date: string | null; reference_number: string;
  batch_number: string | null;
}
interface InventoryItem { id: number; name: string; code: string; }
interface Facility { id: number; name: string; }
interface Loc { id: number; name: string; }

const MOVEMENT_TYPES = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'CONSUMPTION', 'RETURN', 'EXPIRED'];

const TYPE_META: Record<string, { icon: string; color: string }> = {
  IN: { icon: 'arrow-down-circle', color: '#16a34a' },
  OUT: { icon: 'arrow-up-circle', color: '#dc2626' },
  TRANSFER: { icon: 'swap-horizontal', color: '#2563eb' },
  ADJUSTMENT: { icon: 'settings', color: '#7c3aed' },
  CONSUMPTION: { icon: 'remove-circle', color: '#0891b2' },
  RETURN: { icon: 'return-down-back', color: '#d97706' },
  EXPIRED: { icon: 'close-circle', color: '#9f1239' },
};

export default function StockMovementsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = !!user?.is_superuser;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Loc[]>([]);
  const [srcDistricts, setSrcDistricts] = useState<Loc[]>([]);
  const [srcFacilities, setSrcFacilities] = useState<Loc[]>([]);
  const [destDistricts, setDestDistricts] = useState<Loc[]>([]);
  const [destFacilities, setDestFacilities] = useState<Loc[]>([]);
  const [form, setForm] = useState({
    item_id: '', movement_type: 'IN', quantity: '',
    source_type: 'national', source_region_id: '', source_district_id: '', source_facility_id: '',
    destination_type: 'national', destination_region_id: '', destination_district_id: '', destination_facility_id: '',
    notes: '', reference_number: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (filterType !== 'all') params.movement_type = filterType;
      const [movRes, itemRes, facRes, regRes] = await Promise.all([
        api.get('/v1/inventory/movements/', { params }),
        api.get('/v1/inventory/items/'),
        api.get('/v1/facilities/'),
        api.get('/v1/locations/regions/'),
      ]);
      setMovements(movRes.data.data || []);
      setItems(itemRes.data.data || []);
      setFacilities(facRes.data.data || []);
      setRegions(regRes.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load movements');
    } finally { setLoading(false); setRefreshing(false); }
  }, [filterType]);

  // Cascading for source
  useEffect(() => {
    if (form.source_region_id) {
      api.get('/v1/locations/districts/', { params: { region_id: form.source_region_id } })
        .then(r => setSrcDistricts(r.data.data ?? []))
        .catch(() => setSrcDistricts([]));
    } else { setSrcDistricts([]); }
  }, [form.source_region_id]);

  useEffect(() => {
    if (form.source_district_id) {
      api.get('/v1/facilities/', { params: { district: form.source_district_id } })
        .then(r => setSrcFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setSrcFacilities([]));
    } else { setSrcFacilities([]); }
  }, [form.source_district_id]);

  // Cascading for destination
  useEffect(() => {
    if (form.destination_region_id) {
      api.get('/v1/locations/districts/', { params: { region_id: form.destination_region_id } })
        .then(r => setDestDistricts(r.data.data ?? []))
        .catch(() => setDestDistricts([]));
    } else { setDestDistricts([]); }
  }, [form.destination_region_id]);

  useEffect(() => {
    if (form.destination_district_id) {
      api.get('/v1/facilities/', { params: { district: form.destination_district_id } })
        .then(r => setDestFacilities((r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }))))
        .catch(() => setDestFacilities([]));
    } else { setDestFacilities([]); }
  }, [form.destination_district_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getLocType = (regionId: string, districtId: string, facilityId: string) => {
    if (facilityId) return 'facility';
    if (districtId) return 'district';
    if (regionId) return 'regional';
    return 'national';
  };

  const handleCreate = async () => {
    if (!form.item_id || !form.quantity || !form.movement_type) {
      Alert.alert('Validation', 'Item, type and quantity are required'); return;
    }
    setSaving(true);
    try {
      const res = await sendOrQueue('/v1/inventory/movements/create/', 'post', {
        item_id: parseInt(form.item_id),
        movement_type: form.movement_type,
        quantity: parseInt(form.quantity),
        source_type: getLocType(form.source_region_id, form.source_district_id, form.source_facility_id),
        source_region_id: form.source_region_id ? parseInt(form.source_region_id) : null,
        source_district_id: form.source_district_id ? parseInt(form.source_district_id) : null,
        source_facility_id: form.source_facility_id ? parseInt(form.source_facility_id) : null,
        destination_type: getLocType(form.destination_region_id, form.destination_district_id, form.destination_facility_id),
        destination_region_id: form.destination_region_id ? parseInt(form.destination_region_id) : null,
        destination_district_id: form.destination_district_id ? parseInt(form.destination_district_id) : null,
        destination_facility_id: form.destination_facility_id ? parseInt(form.destination_facility_id) : null,
        notes: form.notes,
        reference_number: form.reference_number,
      }, 'Stock Movement');
      if (res) {
        Alert.alert('Success', 'Movement recorded');
        setModalVisible(false);
        setForm({ item_id: '', movement_type: 'IN', quantity: '', source_type: 'national', source_region_id: '', source_district_id: '', source_facility_id: '', destination_type: 'national', destination_region_id: '', destination_district_id: '', destination_facility_id: '', notes: '', reference_number: '' });
        fetchData();
      } else {
        setModalVisible(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create movement');
    } finally { setSaving(false); }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDelete = (m: Movement) => {
    Alert.alert(
      'Delete Movement',
      `Delete ${m.movement_type} of ${m.quantity} — ${m.item_name}?\n\nThis will reverse the stock level changes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/v1/inventory/movements/${m.id}/delete/`);
              Alert.alert('Success', 'Movement deleted');
              fetchData();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to delete movement');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (m: Movement) => {
    Alert.alert(
      'Edit Movement',
      `Editing: ${m.item_name} — ${m.movement_type} (${m.quantity})\n\nUse the webapp for full edit functionality.`,
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const allFilters = ['all', ...MOVEMENT_TYPES];
  const countByType = (t: string) => movements.filter((m) => m.movement_type === t).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Movements</Text>
        {isSuperAdmin ? (
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.backBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Summary Cards */}
      <View style={[styles.summaryRow, { backgroundColor: colors.surface }]}>
        {[
          { label: 'Total', value: movements.length, color: colors.textSecondary, icon: 'swap-vertical-outline' },
          { label: 'Receipts', value: countByType('IN'), color: colors.success, icon: 'arrow-down-circle-outline' },
          { label: 'Issues', value: countByType('OUT'), color: colors.danger, icon: 'arrow-up-circle-outline' },
          { label: 'Transfers', value: countByType('TRANSFER'), color: colors.primary, icon: 'swap-horizontal-outline' },
          { label: 'Consumed', value: countByType('CONSUMPTION'), color: colors.secondary, icon: 'remove-circle-outline' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconWrap, { backgroundColor: s.color + '15' }]}>
                <Ionicons name={s.icon as any} size={13} color={s.color} />
              </View>
              <Text style={[styles.summaryNum, { color: colors.textPrimary }]}>{s.value}</Text>
              <Text style={[styles.summaryLbl, { color: colors.textMuted }]}>{s.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 8 }}>
        {allFilters.map((f) => {
          const meta = TYPE_META[f];
          const active = filterType === f;
          const chipColor = meta?.color || colors.primary;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, { backgroundColor: active ? chipColor : colors.surface, borderColor: chipColor, borderWidth: 1 }]}
              onPress={() => setFilterType(f)}
            >
              {meta && <Ionicons name={meta.icon as any} size={12} color={active ? '#fff' : meta.color} />}
              <Text style={[styles.filterText, { color: active ? '#fff' : chipColor }]}>{f === 'all' ? 'All' : f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
      >
        {movements.length === 0 ? (
          <View style={styles.empty}><Ionicons name="swap-vertical-outline" size={48} color={colors.textMuted} /><Text style={[styles.emptyText, { color: colors.textMuted }]}>No movements found</Text></View>
        ) : (
          movements.map((m) => {
            const meta = TYPE_META[m.movement_type] || { icon: 'ellipse', color: colors.textMuted };
            return (
              <View key={m.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeIcon, { backgroundColor: meta.color + '15' }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.itemName, { color: colors.textPrimary }]}>{m.item_name}</Text>
                      <View style={[styles.typePill, { backgroundColor: meta.color + '15' }]}>
                        <Text style={[styles.typeText, { color: meta.color }]}>{m.movement_type}</Text>
                      </View>
                    </View>
                    <Text style={[styles.itemCode, { color: colors.textMuted }]}>{m.item_code}{m.batch_number ? ` · Batch: ${m.batch_number}` : ''}</Text>
                  </View>
                  <Text style={[styles.qty, { color: meta.color }]}>
                    {['OUT', 'EXPIRED'].includes(m.movement_type) ? '-' : '+'}{m.quantity}
                  </Text>
                </View>

                <View style={[styles.routeRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.routeLabel, { color: colors.textMuted }]}>FROM</Text>
                    <Text style={[styles.routeValue, { color: colors.textPrimary }]}>{m.source || '—'}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} style={{ marginHorizontal: 8 }} />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.routeLabel, { color: colors.textMuted }]}>TO</Text>
                    <Text style={[styles.routeValue, { color: colors.textPrimary }]}>{m.destination || '—'}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{formatDate(m.movement_date)}</Text>
                  {m.created_by_name && <>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}> • </Text>
                    <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>{m.created_by_name}</Text>
                  </>}
                  {m.reference_number && <Text style={[styles.metaText, { color: colors.textMuted }]}> • #{m.reference_number}</Text>}
                </View>
                {m.notes ? <Text style={[styles.notes, { color: colors.textSecondary }]}>{m.notes}</Text> : null}
                {isSuperAdmin && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity onPress={() => handleEdit(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Record Movement</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
              </View>

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Item *</Text>
              <ScrollView style={[styles.pickList, { borderColor: colors.border, maxHeight: 120 }]} nestedScrollEnabled>
                {items.map((i) => (
                  <TouchableOpacity key={i.id} style={[styles.pickItem, form.item_id === String(i.id) && { backgroundColor: colors.primary + '15' }]} onPress={() => setForm({ ...form, item_id: String(i.id) })}>
                    <Text style={[styles.pickText, { color: form.item_id === String(i.id) ? colors.primary : colors.textPrimary }]}>{i.name} <Text style={{ color: colors.textMuted, fontSize: 12 }}>({i.code})</Text></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Movement Type *</Text>
              <View style={styles.chipRow}>
                {MOVEMENT_TYPES.map((t) => {
                  const m = TYPE_META[t];
                  const sel = form.movement_type === t;
                  return (
                    <TouchableOpacity key={t} style={[styles.chip, { backgroundColor: sel ? m.color + '20' : colors.inputBg, borderColor: sel ? m.color : colors.border, borderWidth: 1 }]} onPress={() => setForm({ ...form, movement_type: t })}>
                      <Text style={[styles.chipText, { color: sel ? m.color : colors.textPrimary }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Source Location</Text>
              <View style={[styles.pickList, { borderColor: colors.border, padding: 8 }]}>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' }}>REGION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  <TouchableOpacity style={[styles.chip, !form.source_region_id && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]} onPress={() => setForm({ ...form, source_region_id: '', source_district_id: '', source_facility_id: '' })}>
                    <Text style={[styles.chipText, { color: !form.source_region_id ? colors.danger : colors.textPrimary }]}>National</Text>
                  </TouchableOpacity>
                  {regions.map(r => (
                    <TouchableOpacity key={r.id} style={[styles.chip, form.source_region_id === String(r.id) && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]} onPress={() => setForm({ ...form, source_region_id: String(r.id), source_district_id: '', source_facility_id: '' })}>
                      <Text style={[styles.chipText, { color: form.source_region_id === String(r.id) ? colors.danger : colors.textPrimary }]}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {form.source_region_id && srcDistricts.length > 0 && (<>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' }}>DISTRICT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                    <TouchableOpacity style={[styles.chip, !form.source_district_id && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]} onPress={() => setForm({ ...form, source_district_id: '', source_facility_id: '' })}>
                      <Text style={[styles.chipText, { color: !form.source_district_id ? colors.danger : colors.textPrimary }]}>Regional</Text>
                    </TouchableOpacity>
                    {srcDistricts.map(d => (
                      <TouchableOpacity key={d.id} style={[styles.chip, form.source_district_id === String(d.id) && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]} onPress={() => setForm({ ...form, source_district_id: String(d.id), source_facility_id: '' })}>
                        <Text style={[styles.chipText, { color: form.source_district_id === String(d.id) ? colors.danger : colors.textPrimary }]}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>)}
                {form.source_district_id && srcFacilities.length > 0 && (<>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' }}>FACILITY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity style={[styles.chip, !form.source_facility_id && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]} onPress={() => setForm({ ...form, source_facility_id: '' })}>
                      <Text style={[styles.chipText, { color: !form.source_facility_id ? colors.danger : colors.textPrimary }]}>District</Text>
                    </TouchableOpacity>
                    {srcFacilities.map(f => (
                      <TouchableOpacity key={f.id} style={[styles.chip, form.source_facility_id === String(f.id) && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]} onPress={() => setForm({ ...form, source_facility_id: String(f.id) })}>
                        <Text style={[styles.chipText, { color: form.source_facility_id === String(f.id) ? colors.danger : colors.textPrimary }]}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>)}
              </View>

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Destination Location</Text>
              <View style={[styles.pickList, { borderColor: colors.border, padding: 8 }]}>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' }}>REGION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  <TouchableOpacity style={[styles.chip, !form.destination_region_id && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setForm({ ...form, destination_region_id: '', destination_district_id: '', destination_facility_id: '' })}>
                    <Text style={[styles.chipText, { color: !form.destination_region_id ? colors.success : colors.textPrimary }]}>National</Text>
                  </TouchableOpacity>
                  {regions.map(r => (
                    <TouchableOpacity key={r.id} style={[styles.chip, form.destination_region_id === String(r.id) && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setForm({ ...form, destination_region_id: String(r.id), destination_district_id: '', destination_facility_id: '' })}>
                      <Text style={[styles.chipText, { color: form.destination_region_id === String(r.id) ? colors.success : colors.textPrimary }]}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {form.destination_region_id && destDistricts.length > 0 && (<>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' }}>DISTRICT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                    <TouchableOpacity style={[styles.chip, !form.destination_district_id && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setForm({ ...form, destination_district_id: '', destination_facility_id: '' })}>
                      <Text style={[styles.chipText, { color: !form.destination_district_id ? colors.success : colors.textPrimary }]}>Regional</Text>
                    </TouchableOpacity>
                    {destDistricts.map(d => (
                      <TouchableOpacity key={d.id} style={[styles.chip, form.destination_district_id === String(d.id) && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setForm({ ...form, destination_district_id: String(d.id), destination_facility_id: '' })}>
                        <Text style={[styles.chipText, { color: form.destination_district_id === String(d.id) ? colors.success : colors.textPrimary }]}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>)}
                {form.destination_district_id && destFacilities.length > 0 && (<>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' }}>FACILITY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity style={[styles.chip, !form.destination_facility_id && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setForm({ ...form, destination_facility_id: '' })}>
                      <Text style={[styles.chipText, { color: !form.destination_facility_id ? colors.success : colors.textPrimary }]}>District</Text>
                    </TouchableOpacity>
                    {destFacilities.map(f => (
                      <TouchableOpacity key={f.id} style={[styles.chip, form.destination_facility_id === String(f.id) && { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => setForm({ ...form, destination_facility_id: String(f.id) })}>
                        <Text style={[styles.chipText, { color: form.destination_facility_id === String(f.id) ? colors.success : colors.textPrimary }]}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>)}
              </View>

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Quantity *</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Reference #</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg }]} value={form.reference_number} onChangeText={(v) => setForm({ ...form, reference_number: v })} placeholder="Optional reference number" placeholderTextColor={colors.textMuted} />

              <Text style={[styles.mLabel, { color: colors.textMuted }]}>Notes</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, height: 70, textAlignVertical: 'top' }]} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline placeholder="Optional notes" placeholderTextColor={colors.textMuted} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setModalVisible(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={handleCreate} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Record</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, marginBottom: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryIconWrap: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 1 },
  summaryDivider: { width: 1, height: 28 },
  summaryNum: { fontSize: 14, fontWeight: '800' },
  summaryLbl: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2 },
  filterScroll: { flexShrink: 0 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 11, fontWeight: '700' },
  card: { marginHorizontal: 12, marginTop: 8, borderRadius: 16, padding: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  typeIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 15, fontWeight: '700', flex: 1 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: '800' },
  itemCode: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  qty: { fontSize: 20, fontWeight: '800' },
  routeRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginBottom: 8 },
  routeLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '500' },
  notes: { fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { borderRadius: 20, padding: 22 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  mLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  pickList: { borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  pickItem: { paddingHorizontal: 14, paddingVertical: 10 },
  pickText: { fontSize: 14, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 6 },
  chipText: { fontSize: 12, fontWeight: '600' },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
