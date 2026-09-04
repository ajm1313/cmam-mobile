import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { getCacheFallback, setCache } from '../../lib/cache';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';
import EmptyState from '../../components/EmptyState';
import OfflineBanner from '../../components/OfflineBanner';
import StrategicReportFilters, { StrategicFilters } from '../../components/StrategicReportFilters';

interface MonthRow {
  month: number;
  label: string;
  sam: number;
  high_risk_mam: number;
  other_mam: number;
  cured: number;
  defaulted: number;
  deaths: number;
  transfers: number;
  non_recovered: number;
  sam_visits: number;
  high_risk_mam_visits: number;
  other_mam_visits: number;
  rutf_issued: number;
  active_caseload: number;
}

interface AnalyticsData {
  year: number;
  month: number | null;
  focus_label: string;
  facility_count: number;
  kpis: {
    admissions: number; visits: number; exits: number; active: number;
    cure_rate: number; default_rate: number; death_rate: number;
  };
  monthly: MonthRow[];
}

interface Series { key: keyof MonthRow; label: string; color: string }

const currentYear = String(new Date().getFullYear());
const EMPTY_FILTERS: StrategicFilters = {
  region: '', district: '', sub_district: '', facility: '', year: currentYear,
  month: '', date_from: '', date_to: '',
};

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore(state => state.user);
  const allowed = !!user && (user.is_superuser || user.is_staff || (user.role?.level ?? 99) <= 2);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState('');

  const cacheKey = useMemo(() => `strategic_analytics_${[
    filters.region, filters.district, filters.sub_district, filters.facility,
    filters.year, filters.month,
  ].join('_')}`, [filters]);

  const load = useCallback(async () => {
    if (!allowed) return;
    const params: Record<string, string> = {};
    for (const key of ['region', 'district', 'sub_district', 'facility', 'year', 'month'] as const) {
      if (filters[key]) params[key] = filters[key];
    }
    try {
      const response = await api.get('/v1/reports/strategic/analytics/', { params });
      setData(response.data.data);
      setIsStale(false);
      setError('');
      await setCache(cacheKey, response.data.data, 30 * 60 * 1000);
    } catch (requestError: any) {
      const cached = await getCacheFallback<AnalyticsData>(cacheKey);
      if (cached) {
        setData(cached.data);
        setIsStale(true);
        setError('');
      } else {
        setError(requestError?.response?.data?.message || 'Analytics could not be loaded.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed, cacheKey, filters]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="lock-closed-outline" title="Restricted dashboard" subtitle="This dashboard is available to regional, national and super administrator users." />
        <TouchableOpacity onPress={() => router.back()} style={[styles.backLink, { backgroundColor: colors.primary }]}>
          <Text style={styles.backLinkText}>Back to reports</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rows = data?.monthly ?? [];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner isStale={isStale} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 18) }]}>
          <View style={styles.heroRow}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={21} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>STRATEGIC INTELLIGENCE</Text>
              <Text style={styles.heroTitle}>Annual Analytics</Text>
              <Text style={styles.heroSub}>Jan–Dec trend analysis for every core CMAM indicator</Text>
            </View>
            <View style={styles.yearBadge}><Text style={styles.yearBadgeText}>{data?.year ?? filters.year}</Text></View>
          </View>
          <View style={styles.heroMeta}>
            <View><Text style={styles.heroMetaValue}>{data?.facility_count ?? 0}</Text><Text style={styles.heroMetaLabel}>FACILITIES</Text></View>
            <View style={styles.heroDivider} />
            <View style={{ flex: 1 }}><Text style={styles.heroMetaValue}>{data?.focus_label ?? filters.year}</Text><Text style={styles.heroMetaLabel}>KPI FOCUS</Text></View>
          </View>
        </View>

        <StrategicReportFilters value={filters} mode="analytics" colors={colors} onApply={setFilters} />

        {loading && !data ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.loadingText, { color: colors.textMuted }]}>Building twelve-month trends…</Text></View>
        ) : error ? (
          <TouchableOpacity style={[styles.errorCard, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }]} onPress={load}>
            <Ionicons name="cloud-offline-outline" size={24} color={colors.danger} />
            <Text style={[styles.errorTitle, { color: colors.danger }]}>{error}</Text>
            <Text style={[styles.errorHint, { color: colors.textMuted }]}>Tap to retry</Text>
          </TouchableOpacity>
        ) : data ? (
          <>
            <View style={styles.kpiGrid}>
              <Kpi icon="person-add-outline" label="Admissions" value={data.kpis.admissions} color="#4338ca" colors={colors} />
              <Kpi icon="calendar-outline" label="Visits" value={data.kpis.visits} color="#2563eb" colors={colors} />
              <Kpi icon="exit-outline" label="Exits" value={data.kpis.exits} color="#7c3aed" colors={colors} />
              <Kpi icon="people-outline" label="Active" value={data.kpis.active} color="#0f766e" colors={colors} />
            </View>
            <View style={[styles.rateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Rate label="Cure rate" value={data.kpis.cure_rate} color="#16a34a" colors={colors} />
              <View style={[styles.rateDivider, { backgroundColor: colors.border }]} />
              <Rate label="Default rate" value={data.kpis.default_rate} color="#d97706" colors={colors} />
              <View style={[styles.rateDivider, { backgroundColor: colors.border }]} />
              <Rate label="Death rate" value={data.kpis.death_rate} color="#dc2626" colors={colors} />
            </View>

            <TrendChart
              title="Monthly admissions" subtitle="New programme enrolments"
              rows={rows} colors={colors}
              series={[
                { key: 'sam', label: 'SAM', color: '#dc2626' },
                { key: 'high_risk_mam', label: 'High-Risk MAM', color: '#d97706' },
                { key: 'other_mam', label: 'Other MAM', color: '#2563eb' },
              ]}
            />
            <TrendChart
              title="Monthly outcomes" subtitle="Recorded exits by outcome"
              rows={rows} colors={colors}
              series={[
                { key: 'cured', label: 'Cured', color: '#16a34a' },
                { key: 'defaulted', label: 'Defaulted', color: '#d97706' },
                { key: 'deaths', label: 'Deaths', color: '#dc2626' },
                { key: 'transfers', label: 'Transfers', color: '#7c3aed' },
                { key: 'non_recovered', label: 'Non-Recovered', color: '#64748b' },
              ]}
            />
            <TrendChart
              title="Monthly follow-up visits" subtitle="Service delivery by programme"
              rows={rows} colors={colors}
              series={[
                { key: 'sam_visits', label: 'SAM', color: '#dc2626' },
                { key: 'high_risk_mam_visits', label: 'High-Risk MAM', color: '#d97706' },
                { key: 'other_mam_visits', label: 'Other MAM', color: '#2563eb' },
              ]}
            />
            <TrendChart
              title="Active caseload" subtitle="Children active at each month end"
              rows={rows} colors={colors}
              series={[{ key: 'active_caseload', label: 'Active', color: '#0f766e' }]}
            />
            <TrendChart
              title="RUTF issued" subtitle="Registration and visit sachets combined"
              rows={rows} colors={colors}
              series={[{ key: 'rutf_issued', label: 'Sachets', color: '#7c3aed' }]}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Kpi({ icon, label, value, color, colors }: { icon: any; label: string; value: number; color: string; colors: any }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '12' }]}><Ionicons name={icon} size={17} color={color} /></View>
      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Rate({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  return (
    <View style={styles.rate}>
      <Text style={[styles.rateValue, { color }]}>{value.toFixed(1)}%</Text>
      <Text style={[styles.rateLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function TrendChart({ title, subtitle, rows, series, colors }: {
  title: string; subtitle: string; rows: MonthRow[]; series: Series[]; colors: any;
}) {
  const max = Math.max(1, ...rows.flatMap(row => series.map(item => Number(row[item.key]) || 0)));
  const barWidth = series.length === 1 ? 24 : series.length <= 3 ? 8 : 5;
  return (
    <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.chartSub, { color: colors.textMuted }]}>{subtitle}</Text>
      <View style={styles.legend}>
        {series.map(item => (
          <View key={String(item.key)} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
        {rows.map(row => (
          <View key={row.month} style={styles.monthGroup}>
            <View style={[styles.bars, { borderBottomColor: colors.border }]}>
              {series.map(item => {
                const value = Number(row[item.key]) || 0;
                const height = value === 0 ? 2 : Math.max(6, (value / max) * 112);
                return (
                  <View
                    key={String(item.key)}
                    accessible accessibilityLabel={`${row.label} ${item.label}: ${value}`}
                    style={[styles.bar, { width: barWidth, height, backgroundColor: item.color, opacity: value === 0 ? 0.22 : 1 }]}
                  />
                );
              })}
            </View>
            <Text style={[styles.monthLabel, { color: colors.textMuted }]}>{row.label}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={[styles.scaleHint, { color: colors.textMuted }]}>Peak: {max.toLocaleString()} • Swipe to review all 12 months</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center' },
  hero: { paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 }, heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 },
  yearBadge: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 9 }, yearBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroMeta: { flexDirection: 'row', gap: 14, marginTop: 18, paddingTop: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' }, heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)' }, heroMetaValue: { color: '#fff', fontSize: 15, fontWeight: '800' }, heroMetaLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 8, fontWeight: '800', marginTop: 2, letterSpacing: 0.8 },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { fontSize: 12 },
  errorCard: { margin: 12, minHeight: 180, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24 }, errorTitle: { fontSize: 13, fontWeight: '700', marginTop: 10, textAlign: 'center' }, errorHint: { fontSize: 11, marginTop: 5 },
  kpiGrid: { paddingHorizontal: 12, marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.8%', borderWidth: 1, borderRadius: 15, padding: 12 }, kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, kpiValue: { fontSize: 24, fontWeight: '900' }, kpiLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  rateCard: { marginHorizontal: 12, marginTop: 8, flexDirection: 'row', borderWidth: 1, borderRadius: 15, paddingVertical: 14 }, rate: { flex: 1, alignItems: 'center' }, rateValue: { fontSize: 17, fontWeight: '900' }, rateLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 }, rateDivider: { width: 1 },
  chartCard: { marginHorizontal: 12, marginTop: 12, borderWidth: 1, borderRadius: 16, paddingTop: 14, overflow: 'hidden' }, chartTitle: { fontSize: 14, fontWeight: '900', marginHorizontal: 14 }, chartSub: { fontSize: 10, marginHorizontal: 14, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 14, marginTop: 10 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendDot: { width: 7, height: 7, borderRadius: 2 }, legendText: { fontSize: 9, fontWeight: '600' },
  chartScroll: { paddingHorizontal: 10, paddingTop: 14 }, monthGroup: { width: 52, alignItems: 'center' }, bars: { height: 120, width: 44, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }, bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 }, monthLabel: { fontSize: 9, fontWeight: '700', marginTop: 6 }, scaleHint: { fontSize: 9, marginHorizontal: 14, marginTop: 8, marginBottom: 12 },
  backLink: { alignSelf: 'center', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }, backLinkText: { color: '#fff', fontWeight: '800' },
});
