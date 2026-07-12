import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/store';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { CardSkeleton } from '../../components/LoadingSkeleton';

interface Stats {
  total_sam: number;
  total_mam: number;
  active_sam: number;
  active_mam: number;
  discharged_this_month: number;
  defaulters: number;
  facilities_count: number;
  total_cases: number;
  active_cases: number;
}

interface Analytics {
  monthly_trends: { month: string; sam: number; mam: number }[];
  outcomes: { cured: number; defaulted: number; died: number; transferred: number; active: number };
  stock_levels: { facility: string; total_items: number; low_stock: number }[];
}

export default function CaseManagementDashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        api.get('/v1/dashboard/stats/').catch(() => ({ data: { data: null } })),
        api.get('/v1/dashboard/analytics/').catch(() => ({ data: { data: null } })),
      ]);
      setStats(statsRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Performance indicators (WHO Sphere standards)
  const outcomes = analytics?.outcomes;
  const totalExited = outcomes ? outcomes.cured + outcomes.defaulted + outcomes.died + outcomes.transferred : 0;
  const cureRate = totalExited > 0 ? ((outcomes?.cured ?? 0) / totalExited * 100) : 0;
  const defaulterRate = totalExited > 0 ? ((outcomes?.defaulted ?? 0) / totalExited * 100) : 0;
  const deathRate = totalExited > 0 ? ((outcomes?.died ?? 0) / totalExited * 100) : 0;
  const transferRate = totalExited > 0 ? ((outcomes?.transferred ?? 0) / totalExited * 100) : 0;

  // WHO Sphere standard thresholds
  const cureGood = cureRate >= 75;
  const defaulterGood = defaulterRate < 15;
  const deathGood = deathRate < 10;

  const maxTrend = Math.max(...(analytics?.monthly_trends?.map(t => t.sam + t.mam) ?? [1]), 1);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Case Management Dashboard</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {loading ? (
          <View style={{ paddingTop: 12 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : (
          <>
            {/* Key Stats */}
            <View style={styles.statsGrid}>
              <KPI icon="people-outline" label="Total Cases" value={stats?.total_cases ?? 0} color={colors.primary} bg={colors.surface} />
              <KPI icon="pulse-outline" label="Active" value={stats?.active_cases ?? 0} color={colors.success} bg={colors.surface} />
              <KPI icon="flame-outline" label="SAM" value={stats?.total_sam ?? 0} color={colors.danger} bg={colors.surface} />
              <KPI icon="water-outline" label="MAM" value={stats?.total_mam ?? 0} color={colors.warning} bg={colors.surface} />
            </View>

            {/* Performance Indicators */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Performance Indicators</Text>
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>WHO Sphere Standards</Text>

              <IndicatorBar
                label="Cure Rate"
                value={cureRate}
                target={75}
                good={cureGood}
                color={colors.success}
                colors={colors}
                description="Target: >75%"
              />
              <IndicatorBar
                label="Defaulter Rate"
                value={defaulterRate}
                target={15}
                good={defaulterGood}
                color={colors.warning}
                colors={colors}
                description="Target: <15%"
                inverse
              />
              <IndicatorBar
                label="Death Rate"
                value={deathRate}
                target={10}
                good={deathGood}
                color={colors.danger}
                colors={colors}
                description="Target: <10%"
                inverse
              />
              <IndicatorBar
                label="Transfer Rate"
                value={transferRate}
                target={100}
                good={true}
                color={colors.primary}
                colors={colors}
                description="Transferred out"
              />
            </View>

            {/* Case Outcomes */}
            {outcomes && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Case Outcomes</Text>
                <View style={styles.outcomeRow}>
                  <OutcomeDot label="Cured" value={outcomes.cured} color={colors.success} />
                  <OutcomeDot label="Active" value={outcomes.active} color={colors.primary} />
                  <OutcomeDot label="Defaulted" value={outcomes.defaulted} color={colors.warning} />
                  <OutcomeDot label="Died" value={outcomes.died} color={colors.danger} />
                  <OutcomeDot label="Transferred" value={outcomes.transferred} color={colors.secondary} />
                </View>
              </View>
            )}

            {/* Admission Trends (6 months) */}
            {analytics?.monthly_trends && analytics.monthly_trends.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Admission Trends (6 Months)</Text>
                <View style={styles.trendChart}>
                  {analytics.monthly_trends.map((t, i) => {
                    const total = t.sam + t.mam;
                    const barH = (total / maxTrend) * 120;
                    const samH = total > 0 ? (t.sam / total) * barH : 0;
                    const mamH = barH - samH;
                    return (
                      <View key={i} style={styles.trendBar}>
                        <Text style={styles.trendValue}>{total}</Text>
                        <View style={{ height: barH, justifyContent: 'flex-end' }}>
                          <View style={{ height: samH, backgroundColor: colors.danger + '80', width: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                          <View style={{ height: mamH, backgroundColor: colors.warning + '80', width: 24 }} />
                        </View>
                        <Text style={styles.trendLabel}>{t.month.split(' ')[0]}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.trendLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>SAM</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>MAM</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Additional Stats */}
            <View style={styles.statsGrid}>
              <KPI icon="checkmark-done-outline" label="Discharged (Month)" value={stats?.discharged_this_month ?? 0} color={colors.success} bg={colors.surface} />
              <KPI icon="alert-circle-outline" label="Defaulters" value={stats?.defaulters ?? 0} color={colors.danger} bg={colors.surface} />
              <KPI icon="business-outline" label="Facilities" value={stats?.facilities_count ?? 0} color={colors.primary} bg={colors.surface} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KPI({ icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg, borderTopColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function IndicatorBar({ label, value, target, good, color, colors, description, inverse }: {
  label: string; value: number; target: number; good: boolean; color: string; colors: any; description: string; inverse?: boolean;
}) {
  return (
    <View style={styles.indicatorRow}>
      <View style={{ flex: 1 }}>
        <View style={styles.indicatorHeader}>
          <Text style={[styles.indicatorLabel, { color: colors.textPrimary }]}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.indicatorValue, { color: good ? colors.success : colors.danger }]}>
              {value.toFixed(1)}%
            </Text>
            <Ionicons name={good ? 'checkmark-circle' : 'alert-circle'} size={14} color={good ? colors.success : colors.danger} />
          </View>
        </View>
        <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { width: `${Math.min(value, 100)}%`, backgroundColor: good ? colors.success : colors.danger }]} />
          <View style={[styles.barTarget, { left: `${target}%` }]} />
        </View>
        <Text style={[styles.indicatorDesc, { color: colors.textMuted }]}>{description}</Text>
      </View>
    </View>
  );
}

function OutcomeDot({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.outcomeItem}>
      <View style={[styles.outcomeDot, { backgroundColor: color }]}>
        <Text style={styles.outcomeDotValue}>{value}</Text>
      </View>
      <Text style={styles.outcomeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  kpiCard: {
    width: '48%', borderRadius: 12, padding: 14, alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  kpiValue: { fontSize: 24, fontWeight: '800', marginTop: 6 },
  kpiLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  section: {
    marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sectionSub: { fontSize: 11, marginBottom: 14 },
  indicatorRow: { marginBottom: 16 },
  indicatorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  indicatorLabel: { fontSize: 13, fontWeight: '600' },
  indicatorValue: { fontSize: 15, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'visible', position: 'relative' },
  barFill: { height: '100%', borderRadius: 4 },
  barTarget: { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: '#000', opacity: 0.3 },
  indicatorDesc: { fontSize: 10, marginTop: 4 },
  outcomeRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  outcomeItem: { alignItems: 'center', gap: 6 },
  outcomeDot: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  outcomeDotValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  outcomeLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  trendChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160, paddingTop: 20 },
  trendBar: { alignItems: 'center', flex: 1 },
  trendValue: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  trendLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' },
  trendLegend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, fontWeight: '600' },
});
