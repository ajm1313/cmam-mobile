import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface PeriodStats { new_admissions: number; active: number; cured: number; defaulted: number; deaths: number; transfers: number; total: number; }
interface FacilityReport { facility_name: string; facility_code: string; sam: PeriodStats; mam: PeriodStats; }
interface StockLevel { is_low: boolean; current_stock: number; }
interface Loc { id: number; name: string; }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPTY: PeriodStats = { new_admissions: 0, active: 0, cured: 0, defaulted: 0, deaths: 0, transfers: 0, total: 0 };
const addP = (a: PeriodStats, b: PeriodStats): PeriodStats => ({
  new_admissions: a.new_admissions + b.new_admissions, active: a.active + b.active,
  cured: a.cured + b.cured, defaulted: a.defaulted + b.defaulted,
  deaths: a.deaths + b.deaths, transfers: a.transfers + b.transfers, total: a.total + b.total,
});

export default function AdminReportsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Location filters
  const [regions, setRegions] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [subDistricts, setSubDistricts] = useState<Loc[]>([]);
  const [facilityList, setFacilityList] = useState<Loc[]>([]);
  const [selRegion, setSelRegion] = useState<Loc | null>(null);
  const [selDistrict, setSelDistrict] = useState<Loc | null>(null);
  const [selSubDistrict, setSelSubDistrict] = useState<Loc | null>(null);
  const [selFacility, setSelFacility] = useState<Loc | null>(null);
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  // Picker modals
  const [regionModal, setRegionModal] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);
  const [subDistrictModal, setSubDistrictModal] = useState(false);
  const [facilityModal, setFacilityModal] = useState(false);
  // Report data
  const [samSummary, setSamSummary] = useState<PeriodStats>({ ...EMPTY });
  const [mamSummary, setMamSummary] = useState<PeriodStats>({ ...EMPTY });
  const [samVisits, setSamVisits] = useState(0);
  const [mamVisits, setMamVisits] = useState(0);
  const [facilityCount, setFacilityCount] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStock, setOutOfStock] = useState(0);

  useEffect(() => {
    api.get('/v1/locations/regions/').then(r => setRegions(r.data.data || [])).catch(() => {});
    api.get('/v1/facilities/').then(r => setFacilityList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selRegion) {
      api.get('/v1/locations/districts/', { params: { region_id: selRegion.id } }).then(r => setDistricts(r.data.data || [])).catch(() => {});
    } else { setDistricts([]); }
    setSelDistrict(null); setSelSubDistrict(null);
  }, [selRegion]);

  useEffect(() => {
    if (selDistrict) {
      api.get('/v1/locations/sub-districts/', { params: { district_id: selDistrict.id } }).then(r => setSubDistricts(r.data.data || [])).catch(() => {});
    } else { setSubDistricts([]); }
    setSelSubDistrict(null);
  }, [selDistrict]);

  const fetchData = useCallback(async () => {
    try {
      const lastDay = new Date(selYear, selMonth, 0).getDate();
      const mm = String(selMonth).padStart(2, '0');
      const dateFrom = `${selYear}-${mm}-01`;
      const dateTo = `${selYear}-${mm}-${String(lastDay).padStart(2, '0')}`;
      const locParams: any = {};
      if (selFacility) locParams.facility_id = selFacility.id;
      else if (selSubDistrict) locParams.sub_district = selSubDistrict.id;
      else if (selDistrict) locParams.district = selDistrict.id;
      else if (selRegion) locParams.region = selRegion.id;
      const [monthlyRes, samVRes, mamVRes, stockRes] = await Promise.all([
        api.get('/v1/reports/monthly/', { params: { month: selMonth, year: selYear, ...locParams } }),
        api.get('/v1/reports/weekly/', { params: { type: 'SAM', date_from: dateFrom, date_to: dateTo, ...locParams } }),
        api.get('/v1/reports/weekly/', { params: { type: 'MAM', date_from: dateFrom, date_to: dateTo, ...locParams } }),
        api.get('/v1/inventory/stock-levels/', { params: { ...locParams } }),
      ]);
      const facs: FacilityReport[] = monthlyRes.data.data?.facilities || [];
      const samAgg = facs.reduce((a, f) => addP(a, f.sam), { ...EMPTY });
      const mamAgg = facs.reduce((a, f) => addP(a, f.mam), { ...EMPTY });
      setSamSummary(samAgg); setMamSummary(mamAgg); setFacilityCount(facs.length);
      setSamVisits(samVRes.data.data?.summary?.total_visits || 0);
      setMamVisits(mamVRes.data.data?.summary?.total_visits || 0);
      const sl: StockLevel[] = stockRes.data.data || [];
      setTotalItems(sl.length);
      setTotalStock(sl.reduce((a, s) => a + (s.current_stock || 0), 0));
      setLowStockCount(sl.filter(s => s.is_low).length);
      setOutOfStock(sl.filter(s => !(s.current_stock)).length);
    } catch {
      Alert.alert('Error', 'Failed to load report data');
    } finally { setLoading(false); setRefreshing(false); }
  }, [selMonth, selYear, selFacility, selRegion, selDistrict, selSubDistrict]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const totalVisits = samVisits + mamVisits;
  const filterActive = !!(selRegion || selDistrict || selSubDistrict || selFacility);

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 50 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.primary]} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Reports & Analytics</Text>
          <Text style={styles.headerSub}>Comprehensive data insights</Text>
        </View>
        <View style={[styles.scopePill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
          <Text style={styles.scopeText}>{facilityCount} Facilities</Text>
        </View>
      </View>

      {/* ── Filter Card ── */}
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: filterActive ? colors.primary : colors.border }]}>
        <View style={styles.filterHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="filter-outline" size={15} color={filterActive ? colors.primary : colors.textMuted} />
            <Text style={[styles.filterTitle, { color: colors.textPrimary }]}>Filter Reports</Text>
            {filterActive && <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}><Text style={styles.activeBadgeText}>Active</Text></View>}
          </View>
          {filterActive && (
            <TouchableOpacity onPress={() => { setSelRegion(null); setSelDistrict(null); setSelSubDistrict(null); setSelFacility(null); }}>
              <Text style={[styles.clearBtn, { color: colors.primary }]}>✕ Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Cascading Location Filters */}
        <View style={styles.filterGrid}>
          <PickerBtn label="Region" value={selRegion?.name} placeholder="All Regions" onPress={() => setRegionModal(true)} colors={colors} />
          <PickerBtn label="District" value={selDistrict?.name} placeholder="All Districts" onPress={() => selRegion ? setDistrictModal(true) : null} colors={colors} disabled={!selRegion} />
          <PickerBtn label="Sub-District" value={selSubDistrict?.name} placeholder="All Sub-Districts" onPress={() => selDistrict ? setSubDistrictModal(true) : null} colors={colors} disabled={!selDistrict} />
          <PickerBtn label="Health Facility" value={selFacility?.name} placeholder="All Facilities" onPress={() => setFacilityModal(true)} colors={colors} />
        </View>
        {/* Period */}
        <View style={[styles.periodSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.filterSubLabel, { color: colors.textMuted }]}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
            {MONTHS.map((m, i) => {
              const active = selMonth === i + 1;
              return (
                <TouchableOpacity key={m} style={[styles.monthChip, { backgroundColor: active ? colors.primary : colors.inputBg, borderColor: active ? colors.primary : colors.border }]} onPress={() => setSelMonth(i + 1)}>
                  <Text style={[styles.monthChipText, { color: active ? '#fff' : colors.textMuted }]}>{m.slice(0, 3)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={[styles.filterSubLabel, { color: colors.textMuted }]}>Year</Text>
          <View style={styles.yearRow}>
            {years.map(y => (
              <TouchableOpacity key={y} style={[styles.yearChip, { backgroundColor: selYear === y ? colors.primary : colors.inputBg, borderColor: selYear === y ? colors.primary : colors.border }]} onPress={() => setSelYear(y)}>
                <Text style={[styles.yearChipText, { color: selYear === y ? '#fff' : colors.textMuted }]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── 4 Summary Cards ── */}
      <View style={styles.summaryGrid}>
        <SCard label="SAM Cases" total={samSummary.new_admissions} sub={`${samSummary.active} active`} icon="alert-circle" color='#dc2626' colors={colors} />
        <SCard label="MAM Cases" total={mamSummary.new_admissions} sub={`${mamSummary.active} active`} icon="warning" color='#d97706' colors={colors} />
        <SCard label="Total Visits" total={totalVisits} sub={`SAM ${samVisits}  ·  MAM ${mamVisits}`} icon="calendar" color='#2563eb' colors={colors} />
        <SCard label="Inventory" total={totalItems} sub={lowStockCount > 0 ? `${lowStockCount} low stock` : 'All stocked'} icon="cube" color='#7c3aed' subColor={lowStockCount > 0 ? '#d97706' : '#16a34a'} colors={colors} />
      </View>

      {/* ── Case Breakdown ── */}
      <SectionHdr title="Case Breakdown" colors={colors} />
      <View style={[styles.breakdownCard, { backgroundColor: colors.surface }]}>
        <CaseBreakdown label="SAM" pill='#fef2f2' pillBorder='#fecaca' textColor='#b91c1c' stats={samSummary} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <CaseBreakdown label="MAM" pill='#fffbeb' pillBorder='#fde68a' textColor='#b45309' stats={mamSummary} colors={colors} />
      </View>

      {/* ── Inventory & Visits ── */}
      <SectionHdr title="Inventory & Visits" colors={colors} />
      <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
        <LRow label="Total Items Tracked" value={totalItems} colors={colors} />
        <LRow label="Total Stock Units" value={totalStock} colors={colors} />
        <LRow label="Low Stock Items" value={lowStockCount} valueColor={lowStockCount > 0 ? '#d97706' : undefined} colors={colors} />
        <LRow label="Out of Stock" value={outOfStock} valueColor={outOfStock > 0 ? '#dc2626' : undefined} colors={colors} />
        <LRow label="SAM Visits" value={samVisits} valueColor='#dc2626' colors={colors} />
        <LRow label="MAM Visits" value={mamVisits} valueColor='#d97706' colors={colors} last />
      </View>

      {/* ── Detailed Reports ── */}
      <SectionHdr title="Detailed Reports" colors={colors} />
      <RLink iconBg='#dc2626' title="Weekly SAM Report" sub="Health Facility Tally Sheet" colors={colors} onPress={() => router.push('/admin/weekly-report' as any)} />
      <RLink iconBg='#d97706' title="Weekly MAM Report" sub="Health Facility Tally Sheet" colors={colors} onPress={() => router.push({ pathname: '/admin/weekly-report', params: { defaultType: 'MAM' } } as any)} />
      <RLink iconBg='#1e3a8a' title="Monthly Facility Report" sub="Combined SAM & MAM" colors={colors} onPress={() => router.push('/admin/monthly-report' as any)} />

      {/* ── Access Note ── */}
      <View style={[styles.accessNote, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
        <Ionicons name="information-circle-outline" size={18} color='#4338ca' />
        <Text style={[styles.accessText, { color: '#3730a3' }]}>
          You can view data for <Text style={{ fontWeight: '700' }}>{facilityCount} facilities</Text> within your scope. Includes aggregated data for {MONTHS[selMonth - 1]} {selYear}.
        </Text>
      </View>

      {/* ── Picker Modals ── */}
      <PickerModal visible={regionModal} title="Select Region" items={regions} onSelect={(r: Loc) => { setSelRegion(r); setRegionModal(false); }} onClose={() => setRegionModal(false)} colors={colors} showAll onSelectAll={() => { setSelRegion(null); setRegionModal(false); }} />
      <PickerModal visible={districtModal} title="Select District" items={districts} onSelect={(d: Loc) => { setSelDistrict(d); setDistrictModal(false); }} onClose={() => setDistrictModal(false)} colors={colors} showAll onSelectAll={() => { setSelDistrict(null); setDistrictModal(false); }} />
      <PickerModal visible={subDistrictModal} title="Select Sub-District" items={subDistricts} onSelect={(s: Loc) => { setSelSubDistrict(s); setSubDistrictModal(false); }} onClose={() => setSubDistrictModal(false)} colors={colors} showAll onSelectAll={() => { setSelSubDistrict(null); setSubDistrictModal(false); }} />
      <PickerModal visible={facilityModal} title="Select Facility" items={facilityList} onSelect={(f: Loc) => { setSelFacility(f); setFacilityModal(false); }} onClose={() => setFacilityModal(false)} colors={colors} showAll onSelectAll={() => { setSelFacility(null); setFacilityModal(false); }} />
    </ScrollView>
  );
}

function PickerBtn({ label, value, placeholder, onPress, colors, disabled }: any) {
  return (
    <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.inputBg, borderColor: value ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1 }]} onPress={onPress}>
      <Text style={[styles.pickerBtnLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.pickerBtnValue, { color: value ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>{value || placeholder}</Text>
      <Ionicons name="chevron-down" size={14} color={value ? colors.primary : colors.textMuted} />
    </TouchableOpacity>
  );
}

function PickerModal({ visible, title, items, onSelect, onClose, colors, showAll, onSelectAll }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
            {showAll && (
              <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={onSelectAll}>
                <Text style={[styles.pickerItemText, { color: colors.primary }]}>All (Clear Selection)</Text>
              </TouchableOpacity>
            )}
            {items.map((item: Loc) => (
              <TouchableOpacity key={item.id} style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => onSelect(item)}>
                <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.pickerItemText, { color: colors.textPrimary }]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SectionHdr({ title, colors }: any) {
  return (
    <View style={styles.sectionHdr}>
      <Text style={[styles.sectionHdrText, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

function SCard({ label, total, sub, icon, color, colors, subColor }: any) {
  return (
    <View style={[styles.scard, { backgroundColor: colors.surface }]}>
      <View style={[styles.scardIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.scardLabel, { color: color }]}>{label}</Text>
      <Text style={[styles.scardTotal, { color: colors.textPrimary }]}>{total}</Text>
      <Text style={[styles.scardSub, { color: subColor || '#16a34a' }]}>{sub}</Text>
    </View>
  );
}

function CaseBreakdown({ label, pill, pillBorder, textColor, stats, colors }: any) {
  return (
    <View style={styles.caseBreakdown}>
      <View style={styles.caseBreakdownHdr}>
        <View style={[styles.casePill, { backgroundColor: pill, borderColor: pillBorder }]}>
          <Text style={[styles.casePillText, { color: textColor }]}>{label}</Text>
        </View>
        <Text style={[styles.caseBreakdownSub, { color: colors.textMuted }]}>Status breakdown</Text>
      </View>
      <View style={styles.case2x2}>
        <StatBox label="Active" value={stats.active} color='#16a34a' colors={colors} />
        <StatBox label="Cured" value={stats.cured} color='#2563eb' colors={colors} />
        <StatBox label="Defaulted" value={stats.defaulted} color='#d97706' colors={colors} />
        <StatBox label="Deaths" value={stats.deaths} color='#dc2626' colors={colors} />
      </View>
    </View>
  );
}

function StatBox({ label, value, color, colors }: any) {
  return (
    <View style={[styles.statBox, { backgroundColor: color + '0d' }]}>
      <Text style={[styles.statBoxVal, { color }]}>{value}</Text>
      <Text style={[styles.statBoxLbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function LRow({ label, value, colors, valueColor, last }: any) {
  return (
    <View style={[styles.lRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.lRowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.lRowValue, { color: valueColor || colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function RLink({ iconBg, title, sub, colors, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.rLink, { backgroundColor: iconBg + '12', borderColor: iconBg + '35' }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.rLinkIcon, { backgroundColor: iconBg }]}>
        <Ionicons name="document-text" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.rLinkTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.rLinkSub, { color: colors.textMuted }]}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={iconBg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  scopePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  scopeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  filterCard: { margin: 12, borderRadius: 16, padding: 14, borderWidth: 1 },
  filterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  filterTitle: { fontSize: 13, fontWeight: '700' },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  clearBtn: { fontSize: 13, fontWeight: '600' },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pickerBtn: { width: '47%', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9 },
  pickerBtnLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  pickerBtnValue: { fontSize: 12, fontWeight: '600' },
  periodSection: { borderTopWidth: 1, paddingTop: 12 },
  filterSubLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  monthChipText: { fontSize: 12, fontWeight: '600' },
  yearRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  yearChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  yearChipText: { fontSize: 13, fontWeight: '600' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 4 },
  scard: { width: '46%', borderRadius: 16, padding: 14 },
  scardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  scardLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  scardTotal: { fontSize: 28, fontWeight: '800' },
  scardSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  sectionHdrText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  breakdownCard: { marginHorizontal: 12, borderRadius: 16, padding: 14 },
  caseBreakdown: { paddingVertical: 4 },
  caseBreakdownHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  casePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  casePillText: { fontSize: 12, fontWeight: '800' },
  caseBreakdownSub: { fontSize: 12, fontWeight: '500' },
  case2x2: { flexDirection: 'row', gap: 6 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statBoxVal: { fontSize: 20, fontWeight: '800' },
  statBoxLbl: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  divider: { height: 1, marginVertical: 14 },
  listCard: { marginHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  lRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  lRowLabel: { fontSize: 14, fontWeight: '500' },
  lRowValue: { fontSize: 15, fontWeight: '700' },
  rLink: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8, borderRadius: 16, padding: 14, borderWidth: 1 },
  rLinkIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rLinkTitle: { fontSize: 14, fontWeight: '700' },
  rLinkSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  accessNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 12, marginTop: 16, borderRadius: 14, padding: 14, borderWidth: 1 },
  accessText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 15, fontWeight: '500' },
});
