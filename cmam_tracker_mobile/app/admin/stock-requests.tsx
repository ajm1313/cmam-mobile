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
import { sendOrReject } from '../../lib/offlineQueue';
import EmptyState from '../../components/EmptyState';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StockRequestItem {
  id: number;
  request_number: string;
  facility_name: string;
  requested_by_name: string;
  status: string;
  priority: string;
  created_at: string;
  items: { id: number; item_name: string; quantity_requested: number; quantity_approved: number | null; quantity_fulfilled: number | null }[];
  notes: string;
}

export default function StockRequestsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<StockRequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchRequests = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/v1/inventory/requests/', { params });
      setRequests(res.data.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load stock requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('stock_requests_filter');
        if (saved) setStatusFilter(saved);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('stock_requests_filter', statusFilter).catch(() => {});
  }, [statusFilter]);

  const updateStatus = (req: StockRequestItem, action: string, label: string) => {
    Alert.alert('Update Status', `Set ${req.request_number} to ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await sendOrReject(`/v1/inventory/requests/${req.id}/`, 'put', { action }, `Stock Request: ${label}`);
            Alert.alert('Success', `Request ${label}`);
            fetchRequests();
          } catch (e: any) {
            if (e.message?.includes('internet connection')) return;
            Alert.alert('Error', 'Failed to update request');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'pending': colors.warning, 'approved': colors.success, 'rejected': colors.danger,
      'fulfilled': colors.primary, 'partially_fulfilled': colors.secondary,
      'cancelled': colors.textMuted,
    };
    return map[status] || colors.textMuted;
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'Pending', 'approved': 'Approved', 'rejected': 'Rejected',
      'fulfilled': 'Fulfilled', 'partially_fulfilled': 'Partially Fulfilled',
      'cancelled': 'Cancelled',
    };
    return map[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = { 'High': colors.danger, 'Medium': colors.warning, 'Low': colors.success, 'Emergency': colors.danger };
    return map[priority] || colors.textMuted;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const [shipReq, setShipReq] = useState<StockRequestItem | null>(null);
  const [shipQtys, setShipQtys] = useState<Record<string, string>>({});
  const [shipSaving, setShipSaving] = useState(false);

  const openShip = (req: StockRequestItem) => {
    const initial: Record<string, string> = {};
    req.items.forEach((item) => {
      const approved = item.quantity_approved ?? item.quantity_requested;
      const fulfilled = item.quantity_fulfilled ?? 0;
      const remaining = Math.max(0, approved - fulfilled);
      initial[item.id.toString()] = remaining.toString();
    });
    setShipReq(req);
    setShipQtys(initial);
  };

  const submitShip = () => {
    if (!shipReq) return;
    const shipped: { id: string; name: string; qty: number }[] = [];
    for (const item of shipReq.items) {
      const qty = parseInt(shipQtys[item.id.toString()] || '0', 10);
      if (qty > 0) shipped.push({ id: item.id.toString(), name: item.item_name, qty });
    }
    if (shipped.length === 0) {
      Alert.alert('Validation', 'Enter at least one quantity to ship');
      return;
    }
    const lines = shipped.map((s) => `• ${s.name}: ${s.qty}`).join('\n');
    Alert.alert('Confirm Shipment', `You are about to ship from request ${shipReq.request_number}:\n\n${lines}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Ship', onPress: () => doSubmit(shipped) },
    ]);
  };

  const doSubmit = async (shipped: { id: string; qty: number }[]) => {
    setShipSaving(true);
    try {
      const shippedMap = Object.fromEntries(shipped.map((s) => [s.id, s.qty]));
      await sendOrReject(`/v1/inventory/requests/${shipReq!.id}/`, 'put', { action: 'fulfill', shipped_quantities: shippedMap }, `Stock Request: Ship`);
      setShipReq(null);
      Alert.alert('Success', 'Stock shipped');
      fetchRequests();
    } catch (e: any) {
      if (e.message?.includes('internet connection')) return;
      Alert.alert('Error', e.response?.data?.message || 'Failed to ship stock');
    } finally {
      setShipSaving(false);
    }
  };

  const filters = ['all', 'pending', 'approved', 'rejected', 'partially_fulfilled', 'fulfilled', 'cancelled'];

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Requests</Text>
        <TouchableOpacity onPress={() => router.push('/admin/stock-request-create' as any)} style={styles.backBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, { backgroundColor: statusFilter === f ? colors.primary : colors.surface, borderColor: statusFilter === f ? colors.primary : colors.border, borderWidth: 1 }]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterText, { color: statusFilter === f ? '#fff' : colors.textPrimary }]}>{f === 'all' ? 'All' : getStatusLabel(f)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.countText, { color: colors.textMuted }]}>{requests.length} requests</Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} colors={[colors.primary]} />}
      >
        {requests.length === 0 ? (
          <EmptyState icon="document-outline" title="No requests found" subtitle="Create a new stock request to get started." />
        ) : (
          requests.map((req) => {
            const sColor = getStatusColor(req.status);
            const pColor = getPriorityColor(req.priority);
            return (
              <View key={req.id} style={[styles.reqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reqNumber, { color: colors.textPrimary }]}>{req.request_number}</Text>
                    <Text style={[styles.reqFacility, { color: colors.textMuted }]}>{req.facility_name}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: sColor + '15' }]}>
                    <View style={[styles.dot, { backgroundColor: sColor }]} />
                    <Text style={[styles.statusText, { color: sColor }]}>{getStatusLabel(req.status)}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={[styles.priorityPill, { backgroundColor: pColor + '15' }]}>
                    <Text style={[styles.priorityText, { color: pColor }]}>{req.priority}</Text>
                  </View>
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDate(req.created_at)}</Text>
                  <Text style={[styles.byText, { color: colors.textSecondary }]}>by {req.requested_by_name}</Text>
                </View>

                {req.items && req.items.length > 0 && (
                  <View style={[styles.itemsList, { borderTopColor: colors.border }]}>
                    {req.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.item_name}</Text>
                        <Text style={[styles.itemQty, { color: colors.textSecondary }]}>
                          {item.quantity_approved !== null
                            ? (item.quantity_fulfilled !== null && item.quantity_fulfilled > 0
                                ? `${item.quantity_fulfilled} / ${item.quantity_approved} shipped`
                                : `${item.quantity_approved} / ${item.quantity_requested} approved`)
                            : item.quantity_requested}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {req.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => updateStatus(req, 'approve', 'Approved')}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => updateStatus(req, 'reject', 'Rejected')}>
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(req.status === 'approved' || req.status === 'partially_fulfilled') && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => openShip(req)}>
                      <Ionicons name="cube" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Ship</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Ship Modal */}
      <Modal visible={!!shipReq} transparent animationType="slide" onRequestClose={() => setShipReq(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ship Request {shipReq?.request_number}</Text>
              <TouchableOpacity onPress={() => setShipReq(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {shipReq?.items.map((item) => {
                const approved = item.quantity_approved ?? item.quantity_requested;
                const fulfilled = item.quantity_fulfilled ?? 0;
                const remaining = Math.max(0, approved - fulfilled);
                return (
                  <View key={item.id} style={styles.shipRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{item.item_name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{remaining} remaining to ship</Text>
                    </View>
                    <TextInput
                      style={[styles.shipInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      keyboardType="numeric"
                      value={shipQtys[item.id.toString()] || '0'}
                      onChangeText={(v) => setShipQtys((p) => ({ ...p, [item.id.toString()]: v }))}
                    />
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[styles.submitShip, { backgroundColor: colors.primary, opacity: shipSaving ? 0.7 : 1 }]} onPress={submitShip} disabled={shipSaving}>
              {shipSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Ship Stock</Text>}
            </TouchableOpacity>
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
  filterRow: { marginTop: 12, maxHeight: 50 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '600' },
  countText: { fontSize: 12, fontWeight: '600', marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  reqCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reqNumber: { fontSize: 15, fontWeight: '700' },
  reqFacility: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  dateText: { fontSize: 12, fontWeight: '500' },
  byText: { fontSize: 12, fontWeight: '500' },
  itemsList: { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { fontSize: 13, fontWeight: '500' },
  itemQty: { fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { padding: 16, paddingBottom: 30, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalBody: { maxHeight: 400 },
  shipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  shipInput: { width: 70, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, textAlign: 'center' },
  submitShip: { marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
