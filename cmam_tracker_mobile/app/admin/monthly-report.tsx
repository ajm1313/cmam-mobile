import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';

interface PeriodStats {
  new_admissions: number; active: number; cured: number; defaulted: number;
  deaths: number; transfers: number; total: number;
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
interface FacilityReport { facility_name: string; facility_code: string; sam: PeriodStats; mam: PeriodStats; }
interface CoverageData {
  expected_sam_cases: number;
  expected_mam_cases: number;
  sam_target: number;
  mam_target: number;
  sam_total: number;
  mam_total: number;
  sam_coverage: number;
  mam_coverage: number;
}
interface CommodityData {
  rutf_start: number;
  rutf_received: number;
  rutf_issued_sam: number;
  rutf_issued_mam: number;
  rutf_balance: number;
}
interface MonthlyData {
  month: number; year: number; date_from: string; date_to: string;
  facilities: FacilityReport[];
  coverage?: CoverageData;
  commodity?: CommodityData;
}
interface Loc { id: number; name: string; }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPTY: PeriodStats = {
  new_admissions: 0, active: 0, cured: 0, defaulted: 0, deaths: 0, transfers: 0, total: 0,
  start_of_period: 0, new_cases_under6_at_risk: 0, new_cases_6_59_muac: 0, new_cases_6_59_oedema: 0,
  other_new_cases: 0, old_cases: 0, total_enrolment: 0,
  cured_under6: 0, cured_6_59: 0, died_under6: 0, died_6_59: 0,
  defaulted_under6: 0, defaulted_6_59: 0, non_recovered_under6: 0, non_recovered_6_59: 0,
  total_discharges: 0, referrals: 0, other_exits: 0, total_exits: 0, end_of_period: 0,
  new_males_under6: 0, new_females_under6: 0, new_males_6_59: 0, new_females_6_59: 0,
};
const addP = (a: PeriodStats, b: PeriodStats): PeriodStats => {
  const r: any = {};
  for (const k in a) (r as any)[k] = (a as any)[k] + (b as any)[k];
  return r as PeriodStats;
};

function perfRate(num: number, denom: number) {
  return denom > 0 ? (num / denom) * 100 : 0;
}

export default function MonthlyReportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [filterVisible, setFilterVisible] = useState(false);
  const [periodModal, setPeriodModal] = useState(false);
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

  const fetchReport = useCallback(async () => {
    try {
      const facParam = selFacility ? { facility_id: selFacility.id } : {};
      const res = await api.get('/v1/reports/monthly/', { params: { month: selMonth, year: selYear, ...facParam } });
      setData(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load monthly report');
    } finally { setLoading(false); setRefreshing(false); }
  }, [selMonth, selYear, selFacility]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const facs = data?.facilities || [];
  const sam = facs.reduce((a, f) => addP(a, f.sam), { ...EMPTY });
  const mam = facs.reduce((a, f) => addP(a, f.mam), { ...EMPTY });

  const samOut = sam.cured_under6 + sam.cured_6_59 + sam.died_under6 + sam.died_6_59 + sam.defaulted_under6 + sam.defaulted_6_59 + sam.non_recovered_under6 + sam.non_recovered_6_59;
  const mamOut = mam.cured_under6 + mam.cured_6_59 + mam.died_under6 + mam.died_6_59 + mam.defaulted_under6 + mam.defaulted_6_59 + mam.non_recovered_under6 + mam.non_recovered_6_59;
  const samCuredTotal = sam.cured_under6 + sam.cured_6_59;
  const samDiedTotal = sam.died_under6 + sam.died_6_59;
  const samDefaultedTotal = sam.defaulted_under6 + sam.defaulted_6_59;
  const mamCuredTotal = mam.cured_under6 + mam.cured_6_59;
  const mamDiedTotal = mam.died_under6 + mam.died_6_59;
  const mamDefaultedTotal = mam.defaulted_under6 + mam.defaulted_6_59;
  const samCureRate = perfRate(samCuredTotal, samOut);
  const samDeathRate = perfRate(samDiedTotal, samOut);
  const samDefaultRate = perfRate(samDefaultedTotal, samOut);
  const mamCureRate = perfRate(mamCuredTotal, mamOut);
  const mamDeathRate = perfRate(mamDiedTotal, mamOut);
  const mamDefaultRate = perfRate(mamDefaultedTotal, mamOut);
  const samTotalDischarges = sam.total_discharges;
  const mamTotalDischarges = mam.total_discharges;
  const samTotalExits = sam.total_exits;
  const mamTotalExits = mam.total_exits;
  const isCurrent = selYear === now.getFullYear() && selMonth >= now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Theme-aware row backgrounds
  const bgAlt = colors.background;
  const bgSamTint = '#dc2626' + '12';
  const bgMamTint = '#d97706' + '12';
  const bgTotal = colors.textMuted + '18';
  const bgFinal = colors.textMuted + '30';

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 50 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReport(); }} colors={[colors.primary]} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Monthly Facility Report</Text>
          <Text style={styles.headerSub}>Health Facility Monthly Management of SAM and MAM</Text>
        </View>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => setFilterVisible(v => !v)}>
          <Ionicons name="options-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Panel */}
      {filterVisible && (
        <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.filterPanelHdr}>
            <Text style={[styles.filterPanelTitle, { color: colors.textPrimary }]}>Filter Report</Text>
            {(selRegion || selFacility) && (
              <TouchableOpacity onPress={() => { setSelRegion(null); setSelDistrict(null); setSelSubDistrict(null); setSelFacility(null); }}>
                <Text style={[styles.clearText, { color: colors.primary }]}>✕ Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterGrid}>
            <MLoc label="Region" value={selRegion?.name} onPress={() => setRegionModal(true)} colors={colors} />
            <MLoc label="District" value={selDistrict?.name} onPress={() => selRegion ? setDistrictModal(true) : null} colors={colors} disabled={!selRegion} />
            <MLoc label="Sub-District" value={selSubDistrict?.name} onPress={() => selDistrict ? setSubDistrictModal(true) : null} colors={colors} disabled={!selDistrict} />
            <MLoc label="Facility" value={selFacility?.name} onPress={() => setFacilityModal(true)} colors={colors} />
          </View>
        </View>
      )}

      {/* Period Navigator */}
      <View style={[styles.periodNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => {
          if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); } else setSelMonth(m => m - 1);
        }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setPeriodModal(true)}>
          <Text style={[styles.navMonth, { color: colors.textPrimary }]}>{MONTHS[selMonth - 1]} {selYear}</Text>
          <Text style={[styles.navSub, { color: colors.textMuted }]}>
            {data?.date_from ? `${data.date_from}  –  ${data.date_to}` : 'Combined SAM & MAM'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => {
          if (isCurrent) return;
          if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1); } else setSelMonth(m => m + 1);
        }} disabled={isCurrent}>
          <Ionicons name="chevron-forward" size={22} color={isCurrent ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Info Bar */}
      <View style={[styles.infoBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ICell label="Region" value={selRegion?.name || '—'} colors={colors} />
          <ICell label="District" value={selDistrict?.name || '—'} colors={colors} />
          <ICell label="Sub-District" value={selSubDistrict?.name || '—'} colors={colors} />
          <ICell label="Health Facility" value={selFacility?.name || 'All Facilities'} colors={colors} />
          <ICell label="Period" value={`${MONTHS[selMonth - 1]} ${selYear}`} highlight colors={colors} />
          <ICell label="Facilities" value={`${facs.length}`} colors={colors} />
        </ScrollView>
      </View>

      {/* ── Monthly SAM Report ── */}
      <TallySection title="MONTHLY SAM REPORT" color='#dc2626' colors={colors}>
        <TallyRow code="A" label="Start of month (carried forward from previous)" value={sam.start_of_period} colors={colors} bg={bgAlt} />
        <TallyRow code="B1" label="New SAM cases (< 6 months at risk) MUAC <11cm, WAZ<-2SD, WFL<-2SD" value={sam.new_cases_under6_at_risk} colors={colors} bg={bgSamTint} />
        <TallyRow code="B2" label="New SAM cases (6–59 months MUAC < 11.5 cm or WFL/WFH <-3 SD)" value={sam.new_cases_6_59_muac} colors={colors} bg={bgSamTint} />
        <TallyRow code="B3" label="New SAM cases (6–59 months oedema)" value={sam.new_cases_6_59_oedema} colors={colors} bg={bgSamTint} />
        <TallyRow code="C" label="Other new SAM cases (≥ 5 yrs, adolescents)" value={sam.other_new_cases} colors={colors} />
        <TallyRow code="D" label="Old cases (returned defaulters / referrals)" value={sam.old_cases} colors={colors} />
        <TallyRow code="E" label="TOTAL ENROLMENT (B1+B2+B3+C+D)" value={sam.total_enrolment} colors={colors} bold bg={bgTotal} />
        <TallyRow code="F1a" label="Discharged Cured (< 6 months)" value={sam.cured_under6} colors={colors} />
        <TallyRow code="F1b" label="Discharged Cured (6–59 months)" value={sam.cured_6_59} colors={colors} />
        <TallyRow code="F2a" label="Discharged Died (< 6 months)" value={sam.died_under6} colors={colors} />
        <TallyRow code="F2b" label="Discharged Died (6–59 months)" value={sam.died_6_59} colors={colors} />
        <TallyRow code="F3a" label="Discharged Defaulted (< 6 months)" value={sam.defaulted_under6} colors={colors} />
        <TallyRow code="F3b" label="Discharged Defaulted (6–59 months)" value={sam.defaulted_6_59} colors={colors} />
        <TallyRow code="F4a" label="Non-recovered (< 6 months)" value={sam.non_recovered_under6} colors={colors} />
        <TallyRow code="F4b" label="Non-recovered (6–59 months)" value={sam.non_recovered_6_59} colors={colors} />
        <TallyRow code="F" label="Total Discharges (F1+F2+F3+F4)" value={sam.total_discharges} colors={colors} bold bg={bgTotal} />
        <TallyRow code="G" label="Referrals to other outpatient / inpatient" value={sam.referrals} colors={colors} />
        <TallyRow code="H" label="Total Exits Other (≥ 5 yrs, adolescents)" value={sam.other_exits} colors={colors} />
        <TallyRow code="I" label="TOTAL EXITS (F+G+H)" value={sam.total_exits} colors={colors} bold bg={bgTotal} />
        <TallyRow code="J" label="End of month (A + E − I)" value={sam.end_of_period} colors={colors} bold bg={bgFinal} />
      </TallySection>

      {/* ── Monthly MAM Report ── */}
      <TallySection title="MONTHLY MAM REPORT (HIGH-RISK MAM)" color='#d97706' colors={colors}>
        <TallyRow code="A" label="Start of month (carried forward from previous)" value={mam.start_of_period} colors={colors} bg={bgAlt} />
        <TallyRow code="B" label="New MAM cases (MUAC 12.0–12.4 cm)" value={mam.new_cases_6_59_muac} colors={colors} bg={bgMamTint} />
        <TallyRow code="C" label="New cases high risk (MUAC 11.5–11.9 cm + aggravating factor)" value={mam.new_cases_6_59_oedema} colors={colors} bg={bgMamTint} />
        <TallyRow code="D" label="Old cases (returned defaulters / referrals)" value={mam.old_cases} colors={colors} />
        <TallyRow code="E" label="TOTAL ENROLMENT (B+C+D)" value={mam.total_enrolment} colors={colors} bold bg={bgTotal} />
        <TallyRow code="F1" label="Discharged Cured" value={mam.cured_under6 + mam.cured_6_59} colors={colors} />
        <TallyRow code="F2" label="Discharged Died" value={mam.died_under6 + mam.died_6_59} colors={colors} />
        <TallyRow code="F3" label="Discharged Defaulted" value={mam.defaulted_under6 + mam.defaulted_6_59} colors={colors} />
        <TallyRow code="F" label="Total Discharges (F1+F2+F3)" value={mam.total_discharges} colors={colors} bold bg={bgTotal} />
        <TallyRow code="G" label="Referrals to SAM programme" value={mam.referrals} colors={colors} />
        <TallyRow code="H" label="TOTAL EXITS (F+G)" value={mam.total_exits} colors={colors} bold bg={bgTotal} />
        <TallyRow code="I" label="End of month (A + E − H)" value={mam.end_of_period} colors={colors} bold bg={bgFinal} />
      </TallySection>

      {/* ── Performance Indicators ── */}
      <SecHdr title="Performance Indicators" colors={colors} />
      <View style={[styles.perfCard, { backgroundColor: colors.surface }]}>
        <View style={styles.perfSubHdr}>
          <View style={[styles.perfPill, { backgroundColor: '#dc2626' + '15', borderColor: '#dc2626' + '30' }]}>
            <Text style={[styles.perfPillText, { color: '#dc2626' }]}>SAM</Text>
          </View>
        </View>
        <PerfBar label="Cure Rate" value={samCureRate} target={75} targetLabel="≥ 75%" good={samCureRate >= 75} colors={colors} color='#16a34a' />
        <PerfBar label="Death Rate" value={samDeathRate} target={10} targetLabel="≤ 10%" good={samDeathRate <= 10} colors={colors} color='#dc2626' />
        <PerfBar label="Default Rate" value={samDefaultRate} target={15} targetLabel="≤ 15%" good={samDefaultRate <= 15} colors={colors} color='#d97706' />
        <View style={[styles.perfSubHdr, { marginTop: 14 }]}>
          <View style={[styles.perfPill, { backgroundColor: '#d97706' + '15', borderColor: '#d97706' + '30' }]}>
            <Text style={[styles.perfPillText, { color: '#d97706' }]}>MAM</Text>
          </View>
        </View>
        <PerfBar label="Cure Rate" value={mamCureRate} target={75} targetLabel="≥ 75%" good={mamCureRate >= 75} colors={colors} color='#16a34a' />
        <PerfBar label="Death Rate" value={mamDeathRate} target={10} targetLabel="≤ 10%" good={mamDeathRate <= 10} colors={colors} color='#dc2626' />
        <PerfBar label="Default Rate" value={mamDefaultRate} target={15} targetLabel="≤ 15%" good={mamDefaultRate <= 15} colors={colors} color='#d97706' />
      </View>

      {/* ── Target / Coverage Estimation ── */}
      <SecHdr title="Target / Coverage Estimation" colors={colors} />
      <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
        <LRow label="Estimated SAM cases in catchment area" value={data?.coverage ? String(data.coverage.expected_sam_cases) : '—'} colors={colors} />
        <LRow label="Estimated MAM cases in catchment area" value={data?.coverage ? String(data.coverage.expected_mam_cases) : '—'} colors={colors} />
        <LRow label="SAM Programme Coverage (%)" value={data?.coverage ? `${data.coverage.sam_coverage.toFixed(1)}%` : '—'} colors={colors} />
        <LRow label="MAM Programme Coverage (%)" value={data?.coverage ? `${data.coverage.mam_coverage.toFixed(1)}%` : '—'} colors={colors} last />
      </View>

      {/* ── Commodity Management ── */}
      <SecHdr title="Commodity Management (RUTF)" colors={colors} />
      <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
        <LRow label="Opening Stock (packets)" value={data?.commodity ? String(data.commodity.rutf_start) : '—'} colors={colors} />
        <LRow label="Received during month" value={data?.commodity ? String(data.commodity.rutf_received) : '—'} colors={colors} />
        <LRow label="Issued for SAM (packets)" value={data?.commodity ? String(data.commodity.rutf_issued_sam) : '—'} colors={colors} />
        <LRow label="Issued for MAM (packets)" value={data?.commodity ? String(data.commodity.rutf_issued_mam) : '—'} colors={colors} />
        <LRow label="Closing Balance (packets)" value={data?.commodity ? String(data.commodity.rutf_balance) : '—'} colors={colors} last />
      </View>

      {/* ── Per-Facility Breakdown ── */}
      <SecHdr title="Per-Facility Breakdown" colors={colors} />
      {!facs.length ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
          <Ionicons name="document-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No facility data for this period</Text>
        </View>
      ) : (
        facs.map((fac, idx) => (
          <View key={idx} style={[styles.facCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.facHdr}>
              <View style={[styles.facIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="business" size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.facName, { color: colors.textPrimary }]}>{fac.facility_name}</Text>
                <Text style={[styles.facCode, { color: colors.textMuted }]}>{fac.facility_code}</Text>
              </View>
            </View>
            <View style={[styles.facRow, { borderTopColor: colors.border }]}>
              <FacStat title="SAM" s={fac.sam} color='#dc2626' colors={colors} />
              <View style={[styles.facDivider, { backgroundColor: colors.border }]} />
              <FacStat title="MAM" s={fac.mam} color='#d97706' colors={colors} />
            </View>
          </View>
        ))
      )}

      {/* Location Modals */}
      <MModal visible={regionModal} title="Select Region" items={regions} onSelect={(r: Loc) => { setSelRegion(r); setRegionModal(false); }} onClose={() => setRegionModal(false)} onClear={() => { setSelRegion(null); setRegionModal(false); }} colors={colors} />
      <MModal visible={districtModal} title="Select District" items={districts} onSelect={(d: Loc) => { setSelDistrict(d); setDistrictModal(false); }} onClose={() => setDistrictModal(false)} onClear={() => { setSelDistrict(null); setDistrictModal(false); }} colors={colors} />
      <MModal visible={subDistrictModal} title="Select Sub-District" items={subDistricts} onSelect={(s2: Loc) => { setSelSubDistrict(s2); setSubDistrictModal(false); }} onClose={() => setSubDistrictModal(false)} onClear={() => { setSelSubDistrict(null); setSubDistrictModal(false); }} colors={colors} />
      <MModal visible={facilityModal} title="Select Facility" items={facilityList} onSelect={(f: Loc) => { setSelFacility(f); setFacilityModal(false); }} onClose={() => setFacilityModal(false)} onClear={() => { setSelFacility(null); setFacilityModal(false); }} colors={colors} />

      {/* Period Modal */}
      <Modal visible={periodModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHdr}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Period</Text>
              <TouchableOpacity onPress={() => setPeriodModal(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>Month</Text>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity key={m} style={[styles.monthCell, { backgroundColor: selMonth === i + 1 ? colors.primary : colors.inputBg, borderColor: selMonth === i + 1 ? colors.primary : colors.border }]} onPress={() => setSelMonth(i + 1)}>
                  <Text style={[styles.monthCellText, { color: selMonth === i + 1 ? '#fff' : colors.textMuted }]}>{m.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 12 }]}>Year</Text>
            <View style={styles.yearRow}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[styles.yearCell, { backgroundColor: selYear === y ? colors.primary : colors.inputBg, borderColor: selYear === y ? colors.primary : colors.border }]} onPress={() => setSelYear(y)}>
                  <Text style={[styles.yearCellText, { color: selYear === y ? '#fff' : colors.textMuted }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={() => setPeriodModal(false)}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function TallySection({ title, color, colors, children }: any) {
  return (
    <View style={{ marginTop: 16, marginHorizontal: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: 620 }}>
          <View style={[styles.tallySectionHdr, { backgroundColor: color }]}>
            <Text style={styles.tallySectionTitle}>{title}</Text>
          </View>
          <View style={[styles.tallyTable, { backgroundColor: colors.surface }]}>{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}

function TallyRow({ code, label, value, colors, bold, bg }: any) {
  return (
    <View style={[styles.tallyRow, { borderBottomColor: colors.border }, bg ? { backgroundColor: bg } : { backgroundColor: colors.surface }]}>
      <View style={styles.tallyLeft}>
        {code ? <Text style={[styles.tallyCode, { color: colors.textMuted }]}>{code}</Text> : null}
        <Text style={[styles.tallyLabel, bold && styles.tallyLabelBold, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Text style={[styles.tallyValue, bold && styles.tallyValueBold, { color: bold ? colors.textPrimary : colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

function SecHdr({ title, colors }: any) {
  return (
    <View style={styles.secHdr}>
      <Text style={[styles.secHdrText, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

function ICell({ label, value, highlight, colors }: any) {
  return (
    <View style={[styles.iCell, { borderRightColor: colors.border }, highlight && { backgroundColor: colors.primary + '12' }]}>
      <Text style={[styles.iCellLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.iCellValue, { color: colors.textSecondary }, highlight && { color: colors.primary, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function LRow({ label, value, colors, last }: any) {
  return (
    <View style={[styles.lRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.lLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.lValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function PerfBar({ label, value, target, targetLabel, good, colors, color }: any) {
  return (
    <View style={styles.perfBarRow}>
      <View style={styles.perfBarTop}>
        <Text style={[styles.perfBarLabel, { color: colors.textPrimary }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.perfBarValue, { color }]}>{value.toFixed(1)}%</Text>
          <View style={[styles.perfStatus, { backgroundColor: good ? '#16a34a' + '18' : '#dc2626' + '18' }]}>
            <Text style={[styles.perfStatusText, { color: good ? '#16a34a' : '#dc2626' }]}>{good ? '✓' : '✗'} Target {targetLabel}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.perfBarBg, { backgroundColor: colors.border }]}>
        <View style={[styles.perfBarFill, { backgroundColor: color, width: `${Math.min(value, 100)}%` as any }]} />
      </View>
    </View>
  );
}

function MLoc({ label, value, onPress, colors, disabled }: any) {
  return (
    <TouchableOpacity style={[styles.locBtn, { backgroundColor: colors.inputBg, borderColor: value ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1 }]} onPress={onPress}>
      <Text style={[styles.locBtnLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.locBtnValue, { color: value ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>{value || `All ${label}s`}</Text>
    </TouchableOpacity>
  );
}

function FacStat({ title, s, color, colors }: { title: string; s: PeriodStats; color: string; colors: any }) {
  return (
    <View style={styles.facStatCol}>
      <Text style={[styles.facStatTitle, { color }]}>{title}</Text>
      <Text style={[styles.facStatLine, { color: colors.textPrimary }]}>New: <Text style={{ fontWeight: '700' }}>{s.new_admissions}</Text></Text>
      <Text style={[styles.facStatLine, { color: '#16a34a' }]}>Cured: <Text style={{ fontWeight: '700' }}>{s.cured}</Text></Text>
      <Text style={[styles.facStatLine, { color: '#d97706' }]}>Defaulted: <Text style={{ fontWeight: '700' }}>{s.defaulted}</Text></Text>
      <Text style={[styles.facStatLine, { color: '#dc2626' }]}>Deaths: <Text style={{ fontWeight: '700' }}>{s.deaths}</Text></Text>
      <Text style={[styles.facStatLine, { color: colors.textMuted }]}>Transfers: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{s.transfers}</Text></Text>
    </View>
  );
}

function MModal({ visible, title, items, onSelect, onClose, onClear, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHdr}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 380 }} nestedScrollEnabled>
            <TouchableOpacity style={[styles.mItem, { borderBottomColor: colors.border }]} onPress={onClear}>
              <Text style={[styles.mItemText, { color: colors.primary }]}>All (Clear Selection)</Text>
            </TouchableOpacity>
            {items.map((item: Loc) => (
              <TouchableOpacity key={item.id} style={[styles.mItem, { borderBottomColor: colors.border }]} onPress={() => onSelect(item)}>
                <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.mItemText, { color: colors.textPrimary }]}>{item.name}</Text>
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
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  filterIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  filterPanel: { margin: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
  filterPanelHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterPanelTitle: { fontSize: 13, fontWeight: '700' },
  clearText: { fontSize: 13, fontWeight: '600' },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locBtn: { width: '47%', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  locBtnLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locBtnValue: { fontSize: 12, fontWeight: '600' },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
  navBtn: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navMonth: { fontSize: 17, fontWeight: '800' },
  navSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  infoBar: { marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  iCell: { paddingHorizontal: 14, paddingVertical: 10, borderRightWidth: 1, minWidth: 110 },
  iCellLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  iCellValue: { fontSize: 11, fontWeight: '600' },
  tallySectionHdr: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  tallySectionTitle: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  tallyTable: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' },
  tallyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  tallyLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 8 },
  tallyCode: { fontSize: 10, fontWeight: '800', minWidth: 30, paddingTop: 1 },
  tallyLabel: { flex: 1, fontSize: 12, lineHeight: 16 },
  tallyLabelBold: { fontWeight: '700' },
  tallyValue: { fontSize: 13, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  tallyValueBold: { fontSize: 14, fontWeight: '800' },
  secHdr: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  secHdrText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  perfCard: { marginHorizontal: 12, borderRadius: 14, padding: 14 },
  perfSubHdr: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  perfPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  perfPillText: { fontSize: 12, fontWeight: '800' },
  perfBarRow: { marginBottom: 12 },
  perfBarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  perfBarLabel: { fontSize: 13, fontWeight: '600' },
  perfBarValue: { fontSize: 15, fontWeight: '800' },
  perfStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  perfStatusText: { fontSize: 10, fontWeight: '700' },
  perfBarBg: { height: 7, borderRadius: 4, overflow: 'hidden' },
  perfBarFill: { height: '100%', borderRadius: 4 },
  listCard: { marginHorizontal: 12, borderRadius: 14, overflow: 'hidden' },
  lRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  lLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  lValue: { fontSize: 14, fontWeight: '700' },
  facCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  facHdr: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  facIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  facName: { fontSize: 13, fontWeight: '700' },
  facCode: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  facRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10 },
  facDivider: { width: 1, marginHorizontal: 10 },
  facStatCol: { flex: 1 },
  facStatTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  facStatLine: { fontSize: 12, fontWeight: '400', marginBottom: 3 },
  emptyBox: { marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 28, alignItems: 'center', gap: 8 },
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
  mItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1 },
  mItemText: { fontSize: 15, fontWeight: '500' },
});
