import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Modal, FlatList, ActivityIndicator, Share, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { setCache, getCacheFallback } from '../../lib/cache';
import OfflineBanner from '../../components/OfflineBanner';
import { SyncStatusBanner } from '../../components/SyncStatus';
import { CardSkeleton } from '../../components/LoadingSkeleton';

interface Loc { id: number; name: string; }
interface CaseBreakdown { total: number; active: number; cured: number; defaulted: number; deaths: number; transferred: number; new_admissions: number; }
interface ReportSummary {
  period: { month: number; year: number };
  facility_count: number;
  sam_summary: CaseBreakdown;
  mam_summary: CaseBreakdown;
  visits: { total: number; sam_visits: number; mam_visits: number };
  inventory: { total_items: number; total_stock: number; low_stock: number; out_of_stock: number };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function ReportsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const now = new Date();

  // Filters
  const [regions, setRegions] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [subDistricts, setSubDistricts] = useState<Loc[]>([]);
  const [facilities, setFacilities] = useState<Loc[]>([]);
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
  const [monthModal, setMonthModal] = useState(false);
  const [yearModal, setYearModal] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);

  // Data
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Load location cascades
  useEffect(() => { api.get('/v1/locations/regions/').then(r => setRegions(r.data.data ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    if (selRegion) api.get('/v1/locations/districts/', { params: { region_id: selRegion.id } }).then(r => setDistricts(r.data.data ?? [])).catch(() => {});
    else { setDistricts([]); setSelDistrict(null); }
  }, [selRegion]);
  useEffect(() => {
    if (selDistrict) api.get('/v1/locations/sub-districts/', { params: { district_id: selDistrict.id } }).then(r => setSubDistricts(r.data.data ?? [])).catch(() => {});
    else { setSubDistricts([]); setSelSubDistrict(null); }
  }, [selDistrict]);
  useEffect(() => {
    const p: any = {};
    if (selSubDistrict) p.sub_district = selSubDistrict.id;
    else if (selDistrict) p.district = selDistrict.id;
    else if (selRegion) p.region = selRegion.id;
    api.get('/v1/facilities/', { params: p }).then(r => {
      const list = (r.data.data ?? []).map((f: any) => ({ id: f.id, name: f.name }));
      setFacilities(list);
    }).catch(() => {});
  }, [selRegion, selDistrict, selSubDistrict]);

  const cacheKey = `reports_summary_${selRegion?.id ?? ''}_${selDistrict?.id ?? ''}_${selSubDistrict?.id ?? ''}_${selFacility?.id ?? ''}_${selMonth}_${selYear}`;

  const fetchData = useCallback(async () => {
    const params: any = { month: selMonth, year: selYear };
    if (selFacility) params.facility = selFacility.id;
    else if (selSubDistrict) params.sub_district = selSubDistrict.id;
    else if (selDistrict) params.district = selDistrict.id;
    else if (selRegion) params.region = selRegion.id;
    try {
      const res = await api.get('/v1/reports/summary/', { params });
      setData(res.data.data);
      setIsStale(false);
      await setCache(cacheKey, res.data.data, 10 * 60 * 1000);
    } catch {
      const cached = await getCacheFallback<ReportSummary>(cacheKey);
      if (cached) { setData(cached.data); setIsStale(true); }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selRegion, selDistrict, selSubDistrict, selFacility, selMonth, selYear, cacheKey]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [fetchData]));

  const sam = data?.sam_summary;
  const mam = data?.mam_summary;
  const vis = data?.visits;
  const inv = data?.inventory;

  const hasFilter = !!(selRegion || selDistrict || selSubDistrict || selFacility);
  const clearFilters = () => { setSelRegion(null); setSelDistrict(null); setSelSubDistrict(null); setSelFacility(null); };

  const handleSharePDF = async () => {
    if (!data) return;
    setSharing(true);
    try {
      const periodLabel = `${MONTHS[selMonth - 1]} ${selYear}`;
      const locLabel = selFacility?.name || selSubDistrict?.name || selDistrict?.name || selRegion?.name || 'All Locations';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: -apple-system, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
        h1 { font-size: 22px; color: #1e3a8a; margin: 0 0 4px; }
        h2 { font-size: 14px; color: #64748b; margin: 0 0 24px; font-weight: 400; }
        .meta { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #475569; }
        .meta span { margin-right: 16px; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6366f1; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .stats { display: flex; gap: 12px; margin-bottom: 16px; }
        .stat-card { flex: 1; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0; }
        .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .stat-value { font-size: 28px; font-weight: 800; margin: 4px 0; }
        .stat-sub { font-size: 11px; color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; padding: 8px 12px; background: #1e3a8a; color: #fff; font-weight: 600; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        td.num { text-align: right; font-weight: 700; }
        .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style></head><body>
        <h1>CMAM Tracker Report</h1>
        <h2>Comprehensive Management of Acute Malnutrition</h2>
        <div class="meta"><span><b>Period:</b> ${periodLabel}</span><span><b>Location:</b> ${locLabel}</span><span><b>Facilities:</b> ${data.facility_count}</span></div>

        <div class="section">
          <div class="section-title">Summary Statistics</div>
          <div class="stats">
            <div class="stat-card" style="border-color:#fecaca"><div class="stat-label">SAM Cases</div><div class="stat-value" style="color:#dc2626">${data.sam_summary.total}</div><div class="stat-sub">${data.sam_summary.active} active</div></div>
            <div class="stat-card" style="border-color:#fde68a"><div class="stat-label">MAM Cases</div><div class="stat-value" style="color:#d97706">${data.mam_summary.total}</div><div class="stat-sub">${data.mam_summary.active} active</div></div>
            <div class="stat-card" style="border-color:#bfdbfe"><div class="stat-label">Total Visits</div><div class="stat-value" style="color:#2563eb">${data.visits.total}</div><div class="stat-sub">SAM ${data.visits.sam_visits} · MAM ${data.visits.mam_visits}</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Case Breakdown</div>
          <table><thead><tr><th>Type</th><th class="num">Active</th><th class="num">Cured</th><th class="num">Defaulted</th><th class="num">Deaths</th><th class="num">Transferred</th><th class="num">New Adm.</th></tr></thead>
          <tbody>
            <tr><td style="color:#dc2626;font-weight:700">SAM</td><td class="num">${data.sam_summary.active}</td><td class="num">${data.sam_summary.cured}</td><td class="num">${data.sam_summary.defaulted}</td><td class="num">${data.sam_summary.deaths}</td><td class="num">${data.sam_summary.transferred}</td><td class="num">${data.sam_summary.new_admissions}</td></tr>
            <tr><td style="color:#d97706;font-weight:700">MAM</td><td class="num">${data.mam_summary.active}</td><td class="num">${data.mam_summary.cured}</td><td class="num">${data.mam_summary.defaulted}</td><td class="num">${data.mam_summary.deaths}</td><td class="num">${data.mam_summary.transferred}</td><td class="num">${data.mam_summary.new_admissions}</td></tr>
          </tbody></table>
        </div>

        <div class="section">
          <div class="section-title">Inventory Summary</div>
          <table><thead><tr><th>Metric</th><th class="num">Value</th></tr></thead><tbody>
            <tr><td>Total Items Tracked</td><td class="num">${data.inventory.total_items}</td></tr>
            <tr><td>Total Stock Units</td><td class="num">${data.inventory.total_stock}</td></tr>
            <tr><td>Low Stock Items</td><td class="num">${data.inventory.low_stock}</td></tr>
            <tr><td>Out of Stock</td><td class="num">${data.inventory.out_of_stock}</td></tr>
          </tbody></table>
        </div>

        <div class="footer">Generated by CMAM Tracker on ${new Date().toLocaleString('en-GB')}</div>
      </body></html>`;

      const { uri: pdfUri } = await Print.printToFileAsync({ html });

      const fileName = `report_${selMonth}_${selYear}_${Date.now()}.pdf`;
      const finalUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: pdfUri, to: finalUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Share.share({
          message: `CMAM Report - ${periodLabel} (${locLabel})\nSAM: ${data.sam_summary.total} | MAM: ${data.mam_summary.total} | Visits: ${data.visits.total}`,
          title: 'CMAM Tracker Report',
        });
      }
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message || 'Could not share report.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={isStale} />
      <SyncStatusBanner />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Ionicons name="bar-chart-outline" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Reports & Analytics</Text>
              <Text style={styles.headerSub}>Comprehensive data insights</Text>
            </View>
            {data && (
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleSharePDF}
                disabled={sharing}
                activeOpacity={0.7}
              >
                {sharing ? (
                  <ActivityIndicator size={18} color="#fff" />
                ) : (
                  <Ionicons name="share-outline" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerBadges}>
            <View style={styles.badge}><Text style={styles.badgeText}>{data?.facility_count ?? 0} Facilities</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{MONTHS[selMonth - 1]} {selYear}</Text></View>
          </View>
        </View>

        {/* Filter Toggle */}
        <TouchableOpacity
          style={[styles.filterToggle, { backgroundColor: colors.surface, borderColor: hasFilter ? colors.primary : colors.border }]}
          onPress={() => setFilterVisible(!filterVisible)}
        >
          <Ionicons name="funnel-outline" size={16} color={hasFilter ? colors.primary : colors.textMuted} />
          <Text style={[styles.filterToggleText, { color: hasFilter ? colors.primary : colors.textSecondary }]}>
            Filter Reports {hasFilter ? '(Active)' : ''}
          </Text>
          {hasFilter && (
            <TouchableOpacity onPress={clearFilters} style={{ marginLeft: 'auto' }}>
              <Ionicons name="close-circle" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          <Ionicons name={filterVisible ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} style={{ marginLeft: hasFilter ? 8 : 'auto' }} />
        </TouchableOpacity>

        {filterVisible && (
          <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Location Filters */}
            <Text style={[styles.filterSectionTitle, { color: colors.textMuted }]}>LOCATION</Text>
            <View style={styles.filterRow}>
              <FilterPicker label="Region" value={selRegion?.name} onPress={() => setRegionModal(true)} colors={colors} />
              <FilterPicker label="District" value={selDistrict?.name} onPress={() => setDistrictModal(true)} colors={colors} disabled={!selRegion} />
            </View>
            <View style={styles.filterRow}>
              <FilterPicker label="Sub-District" value={selSubDistrict?.name} onPress={() => setSubDistrictModal(true)} colors={colors} disabled={!selDistrict} />
              <FilterPicker label="Facility" value={selFacility?.name} onPress={() => setFacilityModal(true)} colors={colors} />
            </View>
            {/* Period Filters */}
            <Text style={[styles.filterSectionTitle, { color: colors.textMuted, marginTop: 12 }]}>PERIOD</Text>
            <View style={styles.filterRow}>
              <FilterPicker label="Month" value={MONTHS[selMonth - 1]} onPress={() => setMonthModal(true)} colors={colors} />
              <FilterPicker label="Year" value={String(selYear)} onPress={() => setYearModal(true)} colors={colors} />
            </View>
          </View>
        )}

        {loading ? (
          <View style={{ padding: 12 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : (
          <>
            {/* Summary Stats */}
            <View style={styles.statsRow}>
              <StatCard label="SAM Cases" value={sam?.total ?? 0} sub={`${sam?.active ?? 0} active`} color="#dc2626" bgColor="#fef2f2" colors={colors} icon="person-outline" />
              <StatCard label="MAM Cases" value={mam?.total ?? 0} sub={`${mam?.active ?? 0} active`} color="#d97706" bgColor="#fffbeb" colors={colors} icon="people-outline" />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Total Visits" value={vis?.total ?? 0} sub={`SAM ${vis?.sam_visits ?? 0} · MAM ${vis?.mam_visits ?? 0}`} color="#2563eb" bgColor="#eff6ff" colors={colors} icon="calendar-outline" />
              <StatCard label="Inventory" value={inv?.total_items ?? 0} sub={inv?.low_stock ? `${inv.low_stock} low stock` : 'All stocked'} color="#7c3aed" bgColor="#f5f3ff" colors={colors} icon="cube-outline" subColor={inv?.low_stock ? '#dc2626' : '#16a34a'} />
            </View>

            {/* Case Breakdown */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                <View style={[styles.sectionDot, { backgroundColor: '#6366f1' }]} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>CASE BREAKDOWN</Text>
              </View>
              <View style={{ padding: 14 }}>
                <View style={styles.breakdownLabel}>
                  <View style={[styles.typeBadge, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#b91c1c' }}>SAM</Text>
                  </View>
                  <Text style={[styles.breakdownHint, { color: colors.textMuted }]}>Status breakdown</Text>
                </View>
                <View style={styles.breakdownGrid}>
                  <BreakdownCell label="Active" value={sam?.active ?? 0} color="#16a34a" colors={colors} />
                  <BreakdownCell label="Cured" value={sam?.cured ?? 0} color="#2563eb" colors={colors} />
                  <BreakdownCell label="Defaulted" value={sam?.defaulted ?? 0} color="#d97706" colors={colors} />
                  <BreakdownCell label="Deaths" value={sam?.deaths ?? 0} color="#dc2626" colors={colors} />
                  <BreakdownCell label="Transferred" value={sam?.transferred ?? 0} color="#7c3aed" colors={colors} />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.breakdownLabel}>
                  <View style={[styles.typeBadge, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e' }}>MAM</Text>
                  </View>
                  <Text style={[styles.breakdownHint, { color: colors.textMuted }]}>Status breakdown</Text>
                </View>
                <View style={styles.breakdownGrid}>
                  <BreakdownCell label="Active" value={mam?.active ?? 0} color="#16a34a" colors={colors} />
                  <BreakdownCell label="Cured" value={mam?.cured ?? 0} color="#2563eb" colors={colors} />
                  <BreakdownCell label="Defaulted" value={mam?.defaulted ?? 0} color="#d97706" colors={colors} />
                  <BreakdownCell label="Deaths" value={mam?.deaths ?? 0} color="#dc2626" colors={colors} />
                  <BreakdownCell label="Transferred" value={mam?.transferred ?? 0} color="#7c3aed" colors={colors} />
                </View>
              </View>
            </View>

            {/* Inventory & Visits */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                <View style={[styles.sectionDot, { backgroundColor: '#7c3aed' }]} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>INVENTORY & VISITS</Text>
              </View>
              <View style={{ padding: 14 }}>
                <DetailRow label="Total Items Tracked" value={String(inv?.total_items ?? 0)} colors={colors} />
                <DetailRow label="Total Stock Units" value={String(inv?.total_stock ?? 0)} colors={colors} />
                <DetailRow label="Low Stock Items" value={String(inv?.low_stock ?? 0)} colors={colors} valueColor="#d97706" />
                <DetailRow label="Out of Stock" value={String(inv?.out_of_stock ?? 0)} colors={colors} valueColor="#dc2626" />
                <DetailRow label="SAM Visits" value={String(vis?.sam_visits ?? 0)} colors={colors} valueColor="#dc2626" />
                <DetailRow label="MAM Visits" value={String(vis?.mam_visits ?? 0)} colors={colors} valueColor="#d97706" last />
              </View>
            </View>

            {/* Detailed Report Links */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                <View style={[styles.sectionDot, { backgroundColor: '#16a34a' }]} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>DETAILED REPORTS</Text>
              </View>
              <View style={{ padding: 14, gap: 10 }}>
                <ReportLink title="Weekly SAM Report" subtitle="Health Facility Tally Sheet" color="#dc2626" bg={'#dc2626' + '10'} borderColor={'#dc2626' + '25'} icon="document-text-outline"
                  onPress={() => router.push({ pathname: '/admin/weekly-report', params: { defaultType: 'SAM' } })} />
                <ReportLink title="Weekly MAM Report" subtitle="Health Facility Tally Sheet" color="#d97706" bg={'#d97706' + '10'} borderColor={'#d97706' + '25'} icon="document-text-outline"
                  onPress={() => router.push({ pathname: '/admin/weekly-report', params: { defaultType: 'MAM' } })} />
                <ReportLink title="Monthly Facility Report" subtitle="Combined SAM & MAM" color="#4f46e5" bg={'#4f46e5' + '10'} borderColor={'#4f46e5' + '25'} icon="document-text-outline"
                  onPress={() => router.push('/admin/monthly-report')} />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Picker Modals */}
      <ListModal visible={regionModal} title="Select Region" data={regions} onSelect={(r: Loc) => { setSelRegion(r); setSelDistrict(null); setSelSubDistrict(null); setSelFacility(null); setRegionModal(false); }} onClose={() => setRegionModal(false)} colors={colors} />
      <ListModal visible={districtModal} title="Select District" data={districts} onSelect={(d: Loc) => { setSelDistrict(d); setSelSubDistrict(null); setSelFacility(null); setDistrictModal(false); }} onClose={() => setDistrictModal(false)} colors={colors} />
      <ListModal visible={subDistrictModal} title="Select Sub-District" data={subDistricts} onSelect={(s: Loc) => { setSelSubDistrict(s); setSelFacility(null); setSubDistrictModal(false); }} onClose={() => setSubDistrictModal(false)} colors={colors} />
      <ListModal visible={facilityModal} title="Select Facility" data={facilities} onSelect={(f: Loc) => { setSelFacility(f); setFacilityModal(false); }} onClose={() => setFacilityModal(false)} colors={colors} />
      <ListModal visible={monthModal} title="Select Month" data={MONTHS.map((m, i) => ({ id: i + 1, name: m }))} onSelect={(m: Loc) => { setSelMonth(m.id); setMonthModal(false); }} onClose={() => setMonthModal(false)} colors={colors} />
      <ListModal visible={yearModal} title="Select Year" data={YEARS.map(y => ({ id: y, name: String(y) }))} onSelect={(y: Loc) => { setSelYear(y.id); setYearModal(false); }} onClose={() => setYearModal(false)} colors={colors} />
    </View>
  );
}

/* ── Sub-components ── */

function FilterPicker({ label, value, onPress, colors, disabled }: { label: string; value?: string; onPress: () => void; colors: any; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.filterPicker, { backgroundColor: colors.background, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.filterPickerLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.filterPickerValue, { color: value ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>{value || `All ${label}s`}</Text>
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function StatCard({ label, value, sub, color, bgColor, colors, icon, subColor }: { label: string; value: number; sub: string; color: string; bgColor: string; colors: any; icon: string; subColor?: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: bgColor }]}>
      <View style={styles.statCardHead}>
        <View style={[styles.statCardIcon, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={[styles.statCardLabel, { color }]}>{label.toUpperCase()}</Text>
      </View>
      <Text style={[styles.statCardValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statCardSub, { color: subColor || '#16a34a' }]}>{sub}</Text>
    </View>
  );
}

function BreakdownCell({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  return (
    <View style={[styles.bdCell, { backgroundColor: colors.background }]}>
      <Text style={[styles.bdCellLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.bdCellValue, { color }]}>{value}</Text>
    </View>
  );
}

function DetailRow({ label, value, colors, valueColor, last }: { label: string; value: string; colors: any; valueColor?: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border + '40' }]}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor || colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function ReportLink({ title, subtitle, color, bg, borderColor, icon, onPress }: { title: string; subtitle: string; color: string; bg: string; borderColor: string; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.reportLink, { backgroundColor: bg, borderColor }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.reportLinkIcon, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.reportLinkTitle, { color }]}>{title}</Text>
        <Text style={[styles.reportLinkSub, { color: color + '99' }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color + '80'} />
    </TouchableOpacity>
  );
}

function ListModal({ visible, title, data, onSelect, onClose, colors }: { visible: boolean; title: string; data: Loc[]; onSelect: (item: Loc) => void; onClose: () => void; colors: any }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
          </View>
          {data.length === 0 ? (
            <Text style={[styles.modalEmpty, { color: colors.textMuted }]}>No items available</Text>
          ) : (
            <FlatList data={data} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.modalItem, { borderBottomColor: colors.border }]} onPress={() => onSelect(item)}>
                <Text style={[styles.modalItemText, { color: colors.textPrimary }]}>{item.name}</Text>
              </TouchableOpacity>
            )} />
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  shareBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerBadges: { flexDirection: 'row', gap: 8, marginTop: 10 },
  badge: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  filterToggleText: { fontSize: 13, fontWeight: '600' },
  filterPanel: { marginHorizontal: 12, marginTop: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  filterSectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterPicker: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 8, flexDirection: 'column' },
  filterPickerLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  filterPickerValue: { fontSize: 12, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginTop: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  statCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statCardIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statCardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statCardValue: { fontSize: 26, fontWeight: '800' },
  statCardSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  section: { marginHorizontal: 12, marginTop: 14, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  sectionDot: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  breakdownLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  breakdownHint: { fontSize: 11 },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bdCell: { width: '48%', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bdCellLabel: { fontSize: 12 },
  bdCellValue: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '700' },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  reportLinkIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  reportLinkTitle: { fontSize: 13, fontWeight: '700' },
  reportLinkSub: { fontSize: 11, marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalEmpty: { padding: 30, textAlign: 'center', fontSize: 14 },
  modalItem: { padding: 16, borderBottomWidth: 1 },
  modalItemText: { fontSize: 15 },
});
