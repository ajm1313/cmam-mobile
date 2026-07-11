import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface WeeklySummary {
  new_admissions: number; total_visits: number; active_cases: number;
  cured: number; defaulted: number; deaths: number; transfers: number;
  // Detailed breakdown
  start_of_period: number;
  new_cases_under6_at_risk: number;
  new_cases_6_59_muac: number;
  new_cases_6_59_oedema: number;
  other_new_cases: number;
  old_cases: number;
  total_enrolment: number;
  cured_under6: number; cured_6_59: number;
  died_under6: number; died_6_59: number;
  defaulted_under6: number; defaulted_6_59: number;
  non_recovered_under6: number; non_recovered_6_59: number;
  total_discharges: number;
  referrals: number;
  other_exits: number;
  total_exits: number;
  end_of_period: number;
  new_males_under6: number; new_females_under6: number;
  new_males_6_59: number; new_females_6_59: number;
}
interface FacilityRow { facility_name: string; facility_code: string; new_admissions: number; total_visits: number; active: number; cured: number; defaulted: number; deaths: number; }
interface WeeklyData { report_type: string; date_from: string; date_to: string; summary: WeeklySummary; facilities: FacilityRow[]; }
interface Loc { id: number; name: string; }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getWeekBounds(month: number, year: number, week: number) {
  // week 0 = entire month, week 1-5 = specific week
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  if (week === 0) return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(week * 7, lastDay);
  return {
    from: `${year}-${mm}-${String(startDay).padStart(2, '0')}`,
    to: `${year}-${mm}-${String(endDay).padStart(2, '0')}`,
  };
}

function getWeekCount(month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return Math.ceil(lastDay / 7);
}

export default function WeeklyReportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ defaultType?: string }>();
  const now = new Date();

  const [tab, setTab] = useState<'SAM' | 'MAM'>((params.defaultType as 'MAM') || 'SAM');
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selWeek, setSelWeek] = useState(0); // 0 = All weeks
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<WeeklyData | null>(null);

  // Location filters
  const [regions, setRegions] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [subDistricts, setSubDistricts] = useState<Loc[]>([]);
  const [facilityList, setFacilityList] = useState<Loc[]>([]);
  const [selRegion, setSelRegion] = useState<Loc | null>(null);
  const [selDistrict, setSelDistrict] = useState<Loc | null>(null);
  const [selSubDistrict, setSelSubDistrict] = useState<Loc | null>(null);
  const [selFacility, setSelFacility] = useState<Loc | null>(null);
  const [regionModal, setRegionModal] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);
  const [subDistrictModal, setSubDistrictModal] = useState(false);
  const [facilityModal, setFacilityModal] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [monthModal, setMonthModal] = useState(false);

  useEffect(() => {
    api.get('/v1/locations/regions/').then(r => setRegions(r.data.data || [])).catch(() => {});
    api.get('/v1/facilities/').then(r => setFacilityList(r.data.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (selRegion) api.get('/v1/locations/districts/', { params: { region: selRegion.id } }).then(r => setDistricts(r.data.data || [])).catch(() => {});
    else setDistricts([]);
    setSelDistrict(null); setSelSubDistrict(null);
  }, [selRegion]);
  useEffect(() => {
    if (selDistrict) api.get('/v1/locations/sub-districts/', { params: { district: selDistrict.id } }).then(r => setSubDistricts(r.data.data || [])).catch(() => {});
    else setSubDistricts([]);
    setSelSubDistrict(null);
  }, [selDistrict]);

  const weekCount = getWeekCount(selMonth, selYear);
  const { from, to } = getWeekBounds(selMonth, selYear, selWeek);

  const fetchReport = useCallback(async () => {
    try {
      const facParam = selFacility ? { facility_id: selFacility.id } : {};
      const res = await api.get('/v1/reports/weekly/', { params: { type: tab, date_from: from, date_to: to, ...facParam } });
      setData(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load weekly report');
    } finally { setLoading(false); setRefreshing(false); }
  }, [tab, from, to, selFacility]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const s = data?.summary;
  const totalDischarges = (s?.cured ?? 0) + (s?.deaths ?? 0) + (s?.defaulted ?? 0);
  const totalExits = totalDischarges + (s?.transfers ?? 0);
  const typeColor = tab === 'SAM' ? '#dc2626' : '#d97706';
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Theme-aware row backgrounds
  const bgAlt = colors.background;
  const bgTint = typeColor + '12';
  const bgTotal = colors.textMuted + '18';
  const bgFinal = colors.textMuted + '30';

  // SAM tally rows matching webapp exactly
  const samRows: { label: string; code: string; value: string | number; bold?: boolean; bg?: string }[] = [
    { label: 'Total start of period', code: 'A', value: s?.start_of_period ?? 0, bg: bgAlt },
    { label: 'New SAM cases (<6 months at risk) MUAC <11cm, WAZ<-2SD, WFL<-2SD', code: 'B1', value: s?.new_cases_under6_at_risk ?? 0, bg: bgTint },
    { label: 'New Cases 6-59 months (MUAC < 11.5 cm or WFL/WFH <-3 SD)', code: 'B2', value: s?.new_cases_6_59_muac ?? 0, bg: bgTint },
    { label: 'New Cases 6-59 months (oedema/Marasmic kwashiorkor)', code: 'B3', value: s?.new_cases_6_59_oedema ?? 0, bg: bgTint },
    { label: 'Other new SAM cases (≥5 years, adolescents, adults)', code: 'C', value: s?.other_new_cases ?? 0 },
    { label: 'Old Cases: Referred/returned defaulter', code: 'D', value: s?.old_cases ?? 0 },
    { label: 'TOTAL ENROLMENT (E = B1+B2+B3+C+D)', code: 'E', value: s?.total_enrolment ?? 0, bold: true, bg: bgTotal },
    { label: 'Discharged Cured (<6 months at risk)', code: 'F1a', value: s?.cured_under6 ?? 0 },
    { label: 'Discharged Cured (6-59 months)', code: 'F1b', value: s?.cured_6_59 ?? 0 },
    { label: 'Discharged Died (<6 months at risk)', code: 'F2a', value: s?.died_under6 ?? 0 },
    { label: 'Discharged Died (6-59 months)', code: 'F2b', value: s?.died_6_59 ?? 0 },
    { label: 'Discharged Defaulted (<6 months at risk)', code: 'F3a', value: s?.defaulted_under6 ?? 0 },
    { label: 'Discharged Defaulted (6-59 months)', code: 'F3b', value: s?.defaulted_6_59 ?? 0 },
    { label: 'Non-recovered (<6 months at risk)', code: 'F4a', value: s?.non_recovered_under6 ?? 0 },
    { label: 'Non-recovered (6-59 months)', code: 'F4b', value: s?.non_recovered_6_59 ?? 0 },
    { label: 'Total Discharges (F = F1+F2+F3+F4)', code: 'F', value: s?.total_discharges ?? 0, bold: true, bg: bgTotal },
    { label: 'Referrals to other outpatient/inpatient care', code: 'G', value: s?.referrals ?? 0 },
    { label: 'Exits for Other (≥5 years, adolescents, adults)', code: 'H', value: s?.other_exits ?? 0 },
    { label: 'TOTAL EXITS (I = F+G+H)', code: 'I', value: s?.total_exits ?? 0, bold: true, bg: bgTotal },
    { label: 'Total end of period (J = A + E − I)', code: 'J', value: s?.end_of_period ?? 0, bold: true, bg: bgFinal },
  ];

  // MAM tally rows matching webapp exactly
  const mamRows: { label: string; code: string; value: string | number; bold?: boolean; bg?: string }[] = [
    { label: 'Total high-risk MAM start of period', code: 'A', value: s?.start_of_period ?? 0, bg: bgAlt },
    { label: 'New MAM cases (MUAC 12.0–12.4 cm)', code: 'B', value: s?.new_cases_6_59_muac ?? 0, bg: bgTint },
    { label: 'New cases high risk (MUAC 11.5–11.9 cm with aggravating factor)', code: 'C', value: s?.new_cases_6_59_oedema ?? 0, bg: bgTint },
    { label: 'Old cases: Referred/returned defaulter', code: 'D', value: s?.old_cases ?? 0 },
    { label: 'TOTAL ENROLMENT (E = B+C+D)', code: 'E', value: s?.total_enrolment ?? 0, bold: true, bg: bgTotal },
    { label: 'Number Discharged Cured', code: 'F1', value: (s?.cured_under6 ?? 0) + (s?.cured_6_59 ?? 0) },
    { label: 'Number Discharged Died', code: 'F2', value: (s?.died_under6 ?? 0) + (s?.died_6_59 ?? 0) },
    { label: 'Number Discharged Defaulted', code: 'F3', value: (s?.defaulted_under6 ?? 0) + (s?.defaulted_6_59 ?? 0) },
    { label: 'Total Discharges (F = F1+F2+F3)', code: 'F', value: s?.total_discharges ?? 0, bold: true, bg: bgTotal },
    { label: 'Referrals to other outpatient/inpatient care for SAM', code: 'G', value: s?.referrals ?? 0 },
    { label: 'TOTAL EXITS (H = F+G)', code: 'H', value: s?.total_exits ?? 0, bold: true, bg: bgTotal },
    { label: 'Total end of period (I = A + E − H)', code: 'I', value: s?.end_of_period ?? 0, bold: true, bg: bgFinal },
  ];

  const rows = tab === 'SAM' ? samRows : mamRows;

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 50 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReport(); }} colors={[typeColor]} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: typeColor, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Health Facility Tally Sheet</Text>
          <Text style={styles.headerSub}>Management of {tab === 'SAM' ? 'SAM' : 'High-risk MAM'}</Text>
        </View>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => setFilterVisible(v => !v)}>
          <Ionicons name="options-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* SAM / MAM Toggle */}
      <View style={[styles.toggleWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['SAM', 'MAM'] as const).map(t => {
          const tc = t === 'SAM' ? '#dc2626' : '#d97706';
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[styles.toggleBtn, active && { backgroundColor: tc }]} onPress={() => setTab(t)}>
              <Text style={[styles.toggleText, { color: active ? '#fff' : colors.textMuted }]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Week Selector */}
      <View style={styles.weekRow}>
        <Text style={[styles.weekLabel, { color: colors.textMuted }]}>Week:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <TouchableOpacity
            style={[styles.weekPill, { backgroundColor: selWeek === 0 ? typeColor : colors.surface, borderColor: selWeek === 0 ? typeColor : colors.border }]}
            onPress={() => setSelWeek(0)}
          >
            <Text style={[styles.weekPillText, { color: selWeek === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
          </TouchableOpacity>
          {Array.from({ length: weekCount }, (_, i) => i + 1).map(w => {
            const active = selWeek === w;
            const wb = getWeekBounds(selMonth, selYear, w);
            const dayRange = `${wb.from.slice(-2)}-${wb.to.slice(-2)}`;
            return (
              <TouchableOpacity
                key={w}
                style={[styles.weekPill, { backgroundColor: active ? typeColor : colors.surface, borderColor: active ? typeColor : colors.border }]}
                onPress={() => setSelWeek(w)}
              >
                <Text style={[styles.weekPillText, { color: active ? '#fff' : colors.textSecondary }]}>Wk{w}</Text>
                <Text style={[styles.weekPillSub, { color: active ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>{dayRange}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filter Panel */}
      {filterVisible && (
        <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.filterPanelTitle, { color: colors.textPrimary }]}>Filter</Text>
          <View style={styles.filterGrid}>
            <LocPicker label="Region" value={selRegion?.name} onPress={() => setRegionModal(true)} colors={colors} />
            <LocPicker label="District" value={selDistrict?.name} onPress={() => selRegion ? setDistrictModal(true) : null} colors={colors} disabled={!selRegion} />
            <LocPicker label="Sub-District" value={selSubDistrict?.name} onPress={() => selDistrict ? setSubDistrictModal(true) : null} colors={colors} disabled={!selDistrict} />
            <LocPicker label="Facility" value={selFacility?.name} onPress={() => setFacilityModal(true)} colors={colors} />
          </View>
          <View style={styles.filterPeriodRow}>
            <TouchableOpacity style={[styles.periodPill, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setMonthModal(true)}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={[styles.periodPillText, { color: colors.textPrimary }]}>{MONTHS[selMonth - 1]} {selYear}</Text>
              <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
            </TouchableOpacity>
            {(selRegion || selFacility) && (
              <TouchableOpacity onPress={() => { setSelRegion(null); setSelDistrict(null); setSelSubDistrict(null); setSelFacility(null); }}>
                <Text style={[styles.clearText, { color: colors.primary }]}>✕ Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Info Bar — matches webapp's report header info */}
      <View style={[styles.infoBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
          <InfoCell label="Region" value={selRegion?.name || '—'} colors={colors} />
          <InfoCell label="District" value={selDistrict?.name || '—'} colors={colors} />
          <InfoCell label="Sub-District" value={selSubDistrict?.name || '—'} colors={colors} />
          <InfoCell label="Health Facility" value={selFacility?.name || 'All Facilities'} colors={colors} />
          <InfoCell label="Facility Type" value="Outpatient" colors={colors} />
          <InfoCell label="Month / Year" value={`${MONTHS[selMonth - 1]} ${selYear}`} highlight colors={colors} />
          <InfoCell label="Week" value={selWeek === 0 ? 'All Weeks' : `Week ${selWeek} (${from.slice(-2)}–${to.slice(-2)})`} colors={colors} />
        </ScrollView>
      </View>

      {/* Tally Sheet — horizontally scrollable */}
      <View style={{ marginHorizontal: 12, marginTop: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ minWidth: 620 }}>
            <View style={[styles.tallyHeader, { backgroundColor: typeColor }]}>
              <Text style={styles.tallyHeaderText}>
                {tab === 'SAM'
                  ? 'WEEKLY TALLY SHEET FOR MANAGEMENT OF SAM'
                  : 'WEEKLY TALLY SHEET FOR MANAGEMENT OF HIGH-RISK MAM'}
              </Text>
              <Text style={styles.tallyHeaderSub}>Period: {fmt(from)} – {fmt(to)}</Text>
            </View>
            <View style={[styles.tallyTable, { backgroundColor: colors.surface }]}>
              {rows.map((row, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tallyRow,
                    { borderBottomColor: colors.border },
                    row.bg ? { backgroundColor: row.bg } : { backgroundColor: colors.surface },
                  ]}
                >
                  <View style={styles.tallyRowLeft}>
                    <Text style={[styles.tallyCode, { color: typeColor }]}>{row.code}</Text>
                    <Text style={[styles.tallyLabel, row.bold && styles.tallyLabelBold, { color: colors.textPrimary }]}>{row.label}</Text>
                  </View>
                  <Text style={[styles.tallyValue, row.bold && styles.tallyValueBold, { color: row.bold ? colors.textPrimary : colors.textSecondary }]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Additional Information — horizontally scrollable */}
      <View style={{ marginHorizontal: 12, marginTop: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ minWidth: 620 }}>
            <View style={[styles.addlHeader, { backgroundColor: colors.textMuted }]}>
              <Text style={styles.addlHeaderText}>ADDITIONAL INFORMATION</Text>
            </View>
            <View style={[styles.tallyTable, { backgroundColor: colors.surface }]}>
              {tab === 'SAM' ? (
                <>
                  <TallyAddlRow label={`Number of new males with SAM 6-59 months (B2m + B3m)`} value={s?.new_males_6_59 ?? 0} colors={colors} />
                  <TallyAddlRow label={`Number of new females with SAM 6-59 months (B2f + B3f)`} value={s?.new_females_6_59 ?? 0} colors={colors} />
                  <TallyAddlRow label="RUTF quantity at start of week" value="—" colors={colors} />
                  <TallyAddlRow label="RUTF quantity received" value="—" colors={colors} />
                  <TallyAddlRow label="RUTF issued (SAM) — in packets" value="—" colors={colors} />
                  <TallyAddlRow label="RUTF issued (MAM) — in packets" value="—" colors={colors} />
                  <TallyAddlRow label="RUTF balance at end of week" value="—" colors={colors} last />
                </>
              ) : (
                <>
                  <TallyAddlRow label="Number of Male high-risk MAM (Bm + Cm)" value={s?.new_males_6_59 ?? 0} colors={colors} />
                  <TallyAddlRow label="Number of Female high-risk MAM (Bf + Cf)" value={s?.new_females_6_59 ?? 0} colors={colors} />
                  <TallyAddlRow label="RUTF MAM quantity at start" value="—" colors={colors} />
                  <TallyAddlRow label="RUTF MAM received" value="—" colors={colors} />
                  <TallyAddlRow label="RUTF MAM issued — in packets" value="—" colors={colors} />
                  <TallyAddlRow label="Other commodities issued — in packets" value="—" colors={colors} />
                  <TallyAddlRow label="Balance at end of week" value="—" colors={colors} last />
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Per-Facility Breakdown */}
      <View style={styles.secHdr}>
        <Ionicons name="business-outline" size={13} color={colors.textMuted} />
        <Text style={[styles.secHdrText, { color: colors.textMuted }]}>PER-FACILITY BREAKDOWN</Text>
      </View>
      {!data?.facilities?.length ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
          <Ionicons name="document-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No facility data for this period</Text>
        </View>
      ) : (
        data.facilities.map((fac, idx) => (
          <View key={idx} style={[styles.facCard, { backgroundColor: colors.surface, borderColor: typeColor + '30' }]}>
            <View style={styles.facTop}>
              <View style={[styles.facIcon, { backgroundColor: typeColor + '15' }]}>
                <Ionicons name="business" size={15} color={typeColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.facName, { color: colors.textPrimary }]}>{fac.facility_name}</Text>
                <Text style={[styles.facCode, { color: colors.textMuted }]}>{fac.facility_code}</Text>
              </View>
              <View style={[styles.visitsBadge, { backgroundColor: '#2563eb15' }]}>
                <Text style={[styles.visitsBadgeText, { color: '#2563eb' }]}>{fac.total_visits} visits</Text>
              </View>
            </View>
            <View style={[styles.facGrid, { borderTopColor: colors.border }]}>
              <FacCell label="New" val={fac.new_admissions} color='#16a34a' colors={colors} />
              <FacCell label="Active" val={fac.active} color={typeColor} colors={colors} />
              <FacCell label="Cured" val={fac.cured} color='#2563eb' colors={colors} />
              <FacCell label="Defaulted" val={fac.defaulted} color='#d97706' colors={colors} />
              <FacCell label="Deaths" val={fac.deaths} color='#dc2626' colors={colors} />
            </View>
          </View>
        ))
      )}

      {/* Picker Modals */}
      <ListModal visible={regionModal} title="Select Region" items={regions} onSelect={(r: Loc) => { setSelRegion(r); setRegionModal(false); }} onClose={() => setRegionModal(false)} onClear={() => { setSelRegion(null); setRegionModal(false); }} colors={colors} />
      <ListModal visible={districtModal} title="Select District" items={districts} onSelect={(d: Loc) => { setSelDistrict(d); setDistrictModal(false); }} onClose={() => setDistrictModal(false)} onClear={() => { setSelDistrict(null); setDistrictModal(false); }} colors={colors} />
      <ListModal visible={subDistrictModal} title="Select Sub-District" items={subDistricts} onSelect={(s2: Loc) => { setSelSubDistrict(s2); setSubDistrictModal(false); }} onClose={() => setSubDistrictModal(false)} onClear={() => { setSelSubDistrict(null); setSubDistrictModal(false); }} colors={colors} />
      <ListModal visible={facilityModal} title="Select Facility" items={facilityList} onSelect={(f: Loc) => { setSelFacility(f); setFacilityModal(false); }} onClose={() => setFacilityModal(false)} onClear={() => { setSelFacility(null); setFacilityModal(false); }} colors={colors} />

      {/* Month/Year Modal */}
      <Modal visible={monthModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHdr}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Period</Text>
              <TouchableOpacity onPress={() => setMonthModal(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>Month</Text>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity key={m} style={[styles.monthCell, { backgroundColor: selMonth === i + 1 ? typeColor : colors.inputBg, borderColor: selMonth === i + 1 ? typeColor : colors.border }]} onPress={() => { setSelMonth(i + 1); setSelWeek(0); }}>
                  <Text style={[styles.monthCellText, { color: selMonth === i + 1 ? '#fff' : colors.textMuted }]}>{m.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 12 }]}>Year</Text>
            <View style={styles.yearRow}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[styles.yearCell, { backgroundColor: selYear === y ? typeColor : colors.inputBg, borderColor: selYear === y ? typeColor : colors.border }]} onPress={() => { setSelYear(y); setSelWeek(0); }}>
                  <Text style={[styles.yearCellText, { color: selYear === y ? '#fff' : colors.textMuted }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: typeColor }]} onPress={() => setMonthModal(false)}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function LocPicker({ label, value, onPress, colors, disabled }: any) {
  return (
    <TouchableOpacity style={[styles.locPicker, { backgroundColor: colors.inputBg, borderColor: value ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1 }]} onPress={onPress}>
      <Text style={[styles.locPickerLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.locPickerValue, { color: value ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>{value || `All ${label}s`}</Text>
    </TouchableOpacity>
  );
}

function InfoCell({ label, value, highlight, colors }: any) {
  return (
    <View style={[styles.infoCell, { borderRightColor: colors.border }, highlight && { backgroundColor: colors.primary + '12' }]}>
      <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoCellValue, { color: colors.textSecondary }, highlight && { color: colors.primary, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function TallyAddlRow({ label, value, colors, last }: any) {
  return (
    <View style={[styles.tallyRow, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }, { backgroundColor: colors.surface }]}>
      <View style={styles.tallyRowLeft}>
        <Text style={[styles.tallyLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Text style={[styles.tallyValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

function FacCell({ label, val, color, colors }: any) {
  return (
    <View style={styles.facCell}>
      <Text style={[styles.facCellVal, { color }]}>{val}</Text>
      <Text style={[styles.facCellLbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ListModal({ visible, title, items, onSelect, onClose, onClear, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHdr}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 380 }} nestedScrollEnabled>
            <TouchableOpacity style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={onClear}>
              <Text style={[styles.listItemText, { color: colors.primary }]}>All (Clear Selection)</Text>
            </TouchableOpacity>
            {items.map((item: Loc) => (
              <TouchableOpacity key={item.id} style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => onSelect(item)}>
                <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  filterIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  toggleWrap: { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, borderRadius: 12, padding: 4, borderWidth: 1, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '700' },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, gap: 8 },
  weekLabel: { fontSize: 12, fontWeight: '700' },
  weekPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center', minWidth: 52 },
  weekPillText: { fontSize: 12, fontWeight: '700' },
  weekPillSub: { fontSize: 9, fontWeight: '500', marginTop: 1 },
  filterPanel: { margin: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
  filterPanelTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  locPicker: { width: '47%', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  locPickerLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locPickerValue: { fontSize: 12, fontWeight: '600' },
  filterPeriodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  periodPillText: { fontSize: 13, fontWeight: '600' },
  clearText: { fontSize: 13, fontWeight: '600' },
  infoBar: { marginHorizontal: 12, marginTop: 10, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  infoCell: { paddingHorizontal: 14, paddingVertical: 10, borderRightWidth: 1, minWidth: 110 },
  infoCellLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoCellValue: { fontSize: 11, fontWeight: '600' },
  tallyHeader: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  tallyHeaderText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  tallyHeaderSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  tallyTable: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' },
  tallyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  tallyRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 8 },
  tallyCode: { fontSize: 10, fontWeight: '800', minWidth: 28, paddingTop: 1 },
  tallyLabel: { flex: 1, fontSize: 12, fontWeight: '400', lineHeight: 16 },
  tallyLabelBold: { fontWeight: '700' },
  tallyValue: { fontSize: 14, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  tallyValueBold: { fontSize: 15, fontWeight: '800' },
  addlHeader: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  addlHeaderText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  secHdr: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  secHdrText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  facCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  facTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  facIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  facName: { fontSize: 13, fontWeight: '700' },
  facCode: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  visitsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  visitsBadgeText: { fontSize: 11, fontWeight: '700' },
  facGrid: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10 },
  facCell: { alignItems: 'center', flex: 1 },
  facCellVal: { fontSize: 15, fontWeight: '800' },
  facCellLbl: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  emptyBox: { marginHorizontal: 12, borderRadius: 14, padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  subLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthCell: { width: '22%', paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  monthCellText: { fontSize: 12, fontWeight: '600' },
  yearRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  yearCell: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  yearCellText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { marginTop: 16, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1 },
  listItemText: { fontSize: 15, fontWeight: '500' },
});
