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

interface StockRequestItem {
  id: number;
  request_number: string;
  facility_name: string;
  requested_by_name: string;
  status: string;
  priority: string;
  created_at: string;
  items: { item_name: string; quantity_requested: number; quantity_approved: number | null }[];
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

  const updateStatus = (req: StockRequestItem, newStatus: string) => {
    Alert.alert('Update Status', `Set ${req.request_number} to ${newStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await api.put(`/v1/inventory/requests/${req.id}/`, { status: newStatus });
            Alert.alert('Success', `Request ${newStatus}`);
            fetchRequests();
          } catch {
            Alert.alert('Error', 'Failed to update request');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'Pending': colors.warning, 'Approved': colors.success, 'Rejected': colors.danger,
      'Fulfilled': colors.primary, 'Partially Fulfilled': colors.secondary,
    };
    return map[status] || colors.textMuted;
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = { 'High': colors.danger, 'Medium': colors.warning, 'Low': colors.success, 'Emergency': colors.danger };
    return map[priority] || colors.textMuted;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const filters = ['all', 'Pending', 'Approved', 'Rejected', 'Fulfilled'];

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
            <Text style={[styles.filterText, { color: statusFilter === f ? '#fff' : colors.textPrimary }]}>{f === 'all' ? 'All' : f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.countText, { color: colors.textMuted }]}>{requests.length} requests</Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} colors={[colors.primary]} />}
      >
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No requests found</Text>
          </View>
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
                    <Text style={[styles.statusText, { color: sColor }]}>{req.status}</Text>
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
                          {item.quantity_approved !== null ? `${item.quantity_approved}/${item.quantity_requested}` : item.quantity_requested}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {req.status === 'Pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => updateStatus(req, 'Approved')}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => updateStatus(req, 'Rejected')}>
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
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
});
