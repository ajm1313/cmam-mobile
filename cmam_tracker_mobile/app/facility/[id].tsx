import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import type { StockLevel } from '../../lib/types';

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: colors.primary, alignItems: 'center',
    padding: 28, paddingBottom: 32,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    marginBottom: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  headerIcon: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  facilityName: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  facilityCode: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '600', letterSpacing: 0.5 },
  headerChips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  headerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
  },
  headerChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  section: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: colors.textPrimary,
    marginBottom: 14, letterSpacing: -0.2,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statMini: {
    width: '47%', backgroundColor: '#f8fafc', borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statMiniValue: { fontSize: 22, fontWeight: '800' },
  statMiniLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  viewCasesBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  viewCasesBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primary + '10', justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 1 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  stockSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stockSummaryCard: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  stockSummaryValue: { fontSize: 24, fontWeight: '800' },
  stockSummaryLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  stockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  stockDot: { width: 10, height: 10, borderRadius: 5 },
  stockName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  stockCategory: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  stockQty: { fontSize: 15, fontWeight: '800' },
  stockUnit: { fontSize: 11, fontWeight: '400', color: colors.textMuted },
});
interface FacilityData {
  id: number;
  name: string;
  code: string;
  type: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  district_name?: string;
  region_name?: string;
  sub_district_name?: string;
  stats: {
    total_cases: number;
    active_sam: number;
    active_mam: number;
    discharged: number;
    defaulted: number;
  };
}

export default function FacilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [facRes, stockRes] = await Promise.all([
        api.get(`/v1/facilities/${id}/`).catch(() => null),
        api.get(`/v1/inventory/facility/${id}/stock/`).catch(() => ({ data: { data: [] } })),
      ]);
      if (facRes?.data?.data) setFacility(facRes.data.data);
      setStock(stockRes.data.data ?? []);
    } catch {
      setStock([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const lowStock = stock.filter((s) => s.current_balance <= (s.inventory_item?.reorder_level ?? 0));
  const stats = facility?.stats;
  const typeLabel = facility?.type === 'OPC' ? 'Outpatient Care' : facility?.type === 'IPC' ? 'Inpatient Care' : facility?.type ?? '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
        <View style={styles.headerIcon}>
          <Ionicons name="business" size={28} color="#fff" />
        </View>
        <Text style={styles.facilityName}>{facility?.name ?? `Facility #${id}`}</Text>
        {facility?.code && <Text style={styles.facilityCode}>{facility.code}</Text>}
        <View style={styles.headerChips}>
          <View style={[styles.headerChip, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="medkit-outline" size={11} color="rgba(255,255,255,0.9)" />
            <Text style={styles.headerChipText}>{typeLabel}</Text>
          </View>
          <View style={[styles.headerChip, { backgroundColor: facility?.is_active ? colors.success : colors.danger }]}>
            <Text style={styles.headerChipText}>{facility?.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
      </View>

      {/* Case Stats */}
      {stats && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Case Overview</Text>
          <View style={styles.statsGrid}>
            <StatMini label="Active SAM" value={stats.active_sam} color={colors.sam} bg={colors.surfaceSecondary} borderColor={colors.border} mutedColor={colors.textMuted} />
            <StatMini label="Active MAM" value={stats.active_mam} color={colors.mam} bg={colors.surfaceSecondary} borderColor={colors.border} mutedColor={colors.textMuted} />
            <StatMini label="Discharged" value={stats.discharged} color={colors.success} bg={colors.surfaceSecondary} borderColor={colors.border} mutedColor={colors.textMuted} />
            <StatMini label="Defaulted" value={stats.defaulted} color={colors.danger} bg={colors.surfaceSecondary} borderColor={colors.border} mutedColor={colors.textMuted} />
          </View>
          <TouchableOpacity
            style={[styles.viewCasesBtn, { borderTopColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/cases')}
          >
            <Text style={[styles.viewCasesBtnText, { color: colors.primary }]}>View All Cases ({stats.total_cases})</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Facility Info */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Facility Information</Text>
        {facility?.district_name && <InfoRow icon="map-outline" label="District" value={facility.district_name} colors={colors} />}
        {facility?.region_name && <InfoRow icon="globe-outline" label="Region" value={facility.region_name} colors={colors} />}
        {facility?.sub_district_name && <InfoRow icon="navigate-outline" label="Sub-District" value={facility.sub_district_name} colors={colors} />}
        {facility?.address && <InfoRow icon="location-outline" label="Address" value={facility.address} colors={colors} />}
        {facility?.contact_person && <InfoRow icon="person-outline" label="Contact" value={facility.contact_person} colors={colors} />}
        {facility?.phone && (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${facility.phone}`)}>
            <InfoRow icon="call-outline" label="Phone" value={facility.phone} colors={colors} />
          </TouchableOpacity>
        )}
        {facility?.email && (
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${facility.email}`)}>
            <InfoRow icon="mail-outline" label="Email" value={facility.email} colors={colors} />
          </TouchableOpacity>
        )}
        {facility?.capacity && <InfoRow icon="people-outline" label="Capacity" value={String(facility.capacity)} colors={colors} />}
      </View>

      {/* Stock Summary */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Stock Summary</Text>
        {stock.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No stock data available.</Text>
        ) : (
          <>
            <View style={styles.stockSummaryRow}>
              <View style={[styles.stockSummaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.stockSummaryValue, { color: colors.primary }]}>{stock.length}</Text>
                <Text style={[styles.stockSummaryLabel, { color: colors.textMuted }]}>Total Items</Text>
              </View>
              <View style={[styles.stockSummaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.stockSummaryValue, { color: colors.danger }]}>{lowStock.length}</Text>
                <Text style={[styles.stockSummaryLabel, { color: colors.textMuted }]}>Low Stock</Text>
              </View>
              <View style={[styles.stockSummaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.stockSummaryValue, { color: colors.success }]}>{stock.length - lowStock.length}</Text>
                <Text style={[styles.stockSummaryLabel, { color: colors.textMuted }]}>Adequate</Text>
              </View>
            </View>
            {stock.map((s) => {
              const isLow = s.current_balance <= (s.inventory_item?.reorder_level ?? 0);
              return (
                <View key={s.id} style={[styles.stockRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.stockDot, { backgroundColor: isLow ? colors.danger : colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stockName, { color: colors.textPrimary }]}>{s.inventory_item?.name}</Text>
                    <Text style={[styles.stockCategory, { color: colors.textMuted }]}>{s.inventory_item?.category}</Text>
                  </View>
                  <Text style={[styles.stockQty, { color: isLow ? colors.danger : colors.success }]}>
                    {s.current_balance}
                    <Text style={[styles.stockUnit, { color: colors.textMuted }]}> {s.inventory_item?.unit}</Text>
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function StatMini({ label, value, color, bg, borderColor, mutedColor }: { label: string; value: number; color: string; bg: string; borderColor: string; mutedColor: string }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.statMini, { backgroundColor: bg, borderColor }]}>
      <Text style={[styles.statMiniValue, { color }]}>{value}</Text>
      <Text style={[styles.statMiniLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: any; label: string; value: string; colors: any }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.infoIcon, { backgroundColor: colors.primary + '10' }]}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}


