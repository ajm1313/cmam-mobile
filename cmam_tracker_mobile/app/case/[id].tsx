import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../lib/config';
import { useTheme } from '../../lib/theme';
import api from '../../lib/api';
import { sendOrQueue } from '../../lib/offlineQueue';
import { useAuthStore } from '../../lib/store';
import type { OpcCaseDetail, OpcVisit } from '../../lib/types';
import WHOGrowthChart from '../../components/WHOGrowthChart';
import OfflineBanner from '../../components/OfflineBanner';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const isSuper = user?.is_superuser === true;
  const [caseData, setCaseData] = useState<OpcCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCase = useCallback(async () => {
    try {
      const res = await api.get(`/v1/cases/${id}/`);
      setCaseData(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load case details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchCase();
    }, [fetchCase])
  );

  const onRefresh = () => { setRefreshing(true); fetchCase(); };

  const processDischarge = async (outcome: string) => {
    try {
      const res = await sendOrQueue(`/v1/cases/${id}/discharge/`, 'post', { outcome }, `Discharge: ${outcome}`);
      if (res) {
        Alert.alert('Success', `Case discharged: ${outcome}`);
        fetchCase();
      } else {
        Alert.alert('Saved Offline', `Discharge (${outcome}) saved and will sync when online.`);
      }
    } catch {
      Alert.alert('Error', 'Failed to process discharge');
    }
  };

  const reverseDischarge = async () => {
    try {
      const res = await sendOrQueue(`/v1/cases/${id}/reverse-discharge/`, 'post', null, 'Reverse Discharge');
      if (res) {
        Alert.alert('Success', 'Case reactivated successfully.');
        fetchCase();
      } else {
        Alert.alert('Saved Offline', 'Reverse discharge saved and will sync when online.');
      }
    } catch {
      Alert.alert('Error', 'Failed to reverse discharge');
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading case...</Text>
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.danger }]}>Case not found</Text>
      </View>
    );
  }

  const isSAM = caseData.malnutrition_type === 'SAM';
  const typeColor = isSAM ? colors.sam : colors.mam;
  const isActive = caseData.status === 'Active';

  const statusColor = isActive ? colors.success :
    caseData.status === 'Discharged' ? colors.secondary :
    caseData.status === 'Defaulted' ? colors.danger : colors.textMuted;

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const latestVisit: OpcVisit | null = caseData.visits?.length > 0
    ? caseData.visits[caseData.visits.length - 1] : null;

  return (
    <>
      <OfflineBanner isStale={false} />
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* Hero Header */}
      <View style={[styles.heroCard, { backgroundColor: typeColor }]}>
        <View style={styles.heroTop}>
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.typeBadgeText}>{caseData.malnutrition_type}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '30', borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{caseData.status}</Text>
          </View>
        </View>
        <Text style={styles.heroName}>{caseData.child_name}</Text>
        <Text style={styles.heroReg}>{caseData.registration_number}</Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaItem}>
            <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.heroMetaText}>{caseData.child_gender} • {caseData.age_months}m</Text>
          </View>
          <View style={styles.heroMetaItem}>
            <Ionicons name="business-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.heroMetaText}>{caseData.facility_name}</Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Weight" value={`${caseData.weight_kg} kg`} icon="scale-outline" color={colors.primary} bg={colors.surface} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
        <StatCard label="Height" value={`${caseData.height_cm} cm`} icon="resize-outline" color={colors.secondary} bg={colors.surface} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
        <StatCard label="MUAC" value={caseData.muac_cm ? `${caseData.muac_cm} cm` : '—'} icon="fitness-outline" color={isSAM ? colors.danger : colors.warning} bg={colors.surface} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
        <StatCard label="Visits" value={`${caseData.visit_count}`} icon="documents-outline" color={colors.success} bg={colors.surface} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
      </View>

      {/* Action Buttons */}
      {isActive && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/visit/[caseId]', params: { caseId: String(caseData.id), caseName: caseData.child_name, caseType: caseData.malnutrition_type, caseAge: String(caseData.age_months), admissionWeight: String(caseData.weight_kg), visitNumber: String(caseData.visit_count + 1) } })}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Record Visit</Text>
          </TouchableOpacity>
          {caseData.is_visit_due && (
            <View style={[styles.dueBadge, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '30' }]}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.dueText, { color: colors.danger }]}>Visit Due</Text>
            </View>
          )}
        </View>
      )}

      {/* Management Actions */}
      <View style={[styles.mgmtRow, { marginHorizontal: 12, marginTop: 12, gap: 8 }]}>
        {isSuper && (
        <TouchableOpacity
          style={[styles.mgmtBtn, { backgroundColor: colors.surface, borderColor: colors.primary + '30', borderWidth: 1 }]}
          onPress={() => router.push({ pathname: '/case/edit', params: { id: String(caseData.id) } })}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={[styles.mgmtBtnText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        )}
        {!isActive && isSuper && (
          <TouchableOpacity
            style={[styles.mgmtBtn, { backgroundColor: colors.surface, borderColor: colors.success + '30', borderWidth: 1 }]}
            onPress={() => {
              Alert.alert('Reactivate Case', 'Reverse discharge and set case back to Active?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reactivate', onPress: reverseDischarge },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-circle-outline" size={18} color={colors.success} />
            <Text style={[styles.mgmtBtnText, { color: colors.success }]}>Reactivate</Text>
          </TouchableOpacity>
        )}
        {isActive && (
          <TouchableOpacity
            style={[styles.mgmtBtn, { backgroundColor: colors.surface, borderColor: colors.warning + '30', borderWidth: 1 }]}
            onPress={() => {
              Alert.alert('Discharge', `Select outcome for ${caseData.child_name}`, [
                { text: 'Cured', onPress: () => processDischarge('Cured') },
                { text: 'Defaulted', onPress: () => processDischarge('Defaulted') },
                { text: 'Non-Response', onPress: () => processDischarge('Non-Response') },
                { text: 'Transfer', onPress: () => processDischarge('Transfer') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="exit-outline" size={18} color={colors.warning} />
            <Text style={[styles.mgmtBtnText, { color: colors.warning }]}>Discharge</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.mgmtBtn, { backgroundColor: colors.surface, borderColor: '#7c3aed' + '30', borderWidth: 1 }]}
          onPress={() => router.push({ pathname: '/case/transfer', params: { caseId: String(caseData.id), caseName: caseData.child_name } })}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color="#7c3aed" />
          <Text style={[styles.mgmtBtnText, { color: '#7c3aed' }]}>Transfer</Text>
        </TouchableOpacity>
        {isSuper && (
        <TouchableOpacity
          style={[styles.mgmtBtn, { backgroundColor: colors.surface, borderColor: colors.danger + '30', borderWidth: 1 }]}
          onPress={() => {
            Alert.alert('Close Case', `Are you sure you want to close this case?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Close', style: 'destructive',
                onPress: async () => {
                  try {
                    const res = await sendOrQueue(`/v1/cases/${id}/delete/`, 'delete', null, 'Case Closure');
                    if (res !== null) {
                      Alert.alert('Success', 'Case closed', [{ text: 'OK', onPress: () => router.back() }]);
                    } else {
                      Alert.alert('Saved Offline', 'Case closure saved and will sync when online.', [{ text: 'OK', onPress: () => router.back() }]);
                    }
                  } catch { Alert.alert('Error', 'Failed to close case'); }
                },
              },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
          <Text style={[styles.mgmtBtnText, { color: colors.danger }]}>Close</Text>
        </TouchableOpacity>
        )}
      </View>

      {/* Child Photo */}
      {caseData.child_photo ? (
        <View style={[styles.photoCard, { backgroundColor: colors.surface }]}>
          <Image source={{ uri: caseData.child_photo }} style={styles.childPhoto} resizeMode="cover" />
        </View>
      ) : null}

      {/* Child Information */}
      <SectionCard title="Child Information" icon="person-outline" colors={colors}>
        <InfoRow label="Full Name" value={caseData.child_name} colors={colors} />
        <InfoRow label="Gender" value={caseData.child_gender} colors={colors} />
        <InfoRow label="Date of Birth" value={formatDate(caseData.date_of_birth)} colors={colors} />
        <InfoRow label="Age" value={`${caseData.age_months} months`} colors={colors} />
        <InfoRow label="Admission Date" value={formatDate(caseData.admission_date)} colors={colors} />
        <InfoRow label="Admission Type" value={caseData.admission_type || '—'} colors={colors} />
        <InfoRow label="Admission Criteria" value={caseData.admission_criteria || '—'} colors={colors} />
      </SectionCard>

      {/* Caregiver */}
      <SectionCard title="Caregiver" icon="people-outline" colors={colors}>
        <InfoRow label="Name" value={caseData.caregiver_name || '—'} colors={colors} />
        <InfoRow label="Phone" value={caseData.caregiver_phone || '—'} colors={colors} />
        <InfoRow label="Relationship" value={caseData.caregiver_relationship || '—'} colors={colors} />
        <InfoRow label="Address" value={caseData.address || '—'} colors={colors} />
      </SectionCard>

      {/* Anthropometry at Registration */}
      <SectionCard title="Anthropometry (Registration)" icon="body-outline" colors={colors}>
        <InfoRow label="Weight" value={`${caseData.weight_kg} kg`} colors={colors} />
        <InfoRow label="Height" value={`${caseData.height_cm} cm`} colors={colors} />
        <InfoRow label="MUAC" value={caseData.muac_cm ? `${caseData.muac_cm} cm` : '—'} colors={colors} />
        <InfoRow label="WFH Z-score" value={caseData.z_score_wfh ? `${caseData.z_score_wfh}` : '—'} colors={colors} />
        <InfoRow label="Oedema" value={caseData.oedema || 'None'} colors={colors} />
      </SectionCard>

      {/* Weight Progression Chart */}
      {caseData.visits && caseData.visits.length > 0 && (
        <WeightProgressChart
          visits={caseData.visits}
          regWeight={caseData.weight_kg}
          regDate={caseData.admission_date}
          colors={colors}
          typeColor={typeColor}
        />
      )}

      {/* WHO Growth Chart — Weight-for-Length/Height */}
      <WHOGrowthChart
        gender={caseData.child_gender}
        regWeight={caseData.weight_kg}
        regHeight={caseData.height_cm}
        regDate={caseData.admission_date}
        visits={caseData.visits || []}
        colors={colors}
        typeColor={typeColor}
      />

      {/* Latest Visit Summary */}
      {latestVisit && (
        <SectionCard title="Latest Visit" icon="pulse-outline" colors={colors}>
          <InfoRow label="Visit #" value={`${latestVisit.visit_number}`} colors={colors} />
          <InfoRow label="Date" value={formatDate(latestVisit.visit_date)} colors={colors} />
          <InfoRow label="Weight" value={`${latestVisit.weight_kg} kg`} colors={colors} />
          {latestVisit.weight_change !== null && (
            <InfoRow
              label="Weight Change"
              value={`${latestVisit.weight_change > 0 ? '+' : ''}${latestVisit.weight_change} kg`}
              valueColor={latestVisit.weight_change > 0 ? colors.success : latestVisit.weight_change < 0 ? colors.danger : colors.textSecondary}
              colors={colors}
            />
          )}
          <InfoRow label="MUAC" value={latestVisit.muac_cm ? `${latestVisit.muac_cm} cm` : '—'} colors={colors} />
          <InfoRow label="Outcome" value={latestVisit.visit_outcome || '—'} colors={colors} />
        </SectionCard>
      )}

      {/* Enrollment Medicines & RUTF */}
      {(caseData.rutf_sachets_given || caseData.amoxicillin_date || caseData.vitamin_a_date || caseData.deworming_date || caseData.measles_vaccine_date || caseData.folic_acid_date || caseData.malaria_test_date || caseData.antimalarial_date) && (
        <SectionCard title="Enrollment Medicines & RUTF" icon="medkit-outline" colors={colors}>
          {caseData.rutf_sachets_given ? <InfoRow label="RUTF Sachets" value={`${caseData.rutf_sachets_given}`} colors={colors} /> : null}
          {caseData.rutf_ration_per_day ? <InfoRow label="RUTF Ration/day" value={`${caseData.rutf_ration_per_day}`} colors={colors} /> : null}
          {caseData.amoxicillin_date ? <InfoRow label="Amoxicillin" value={`${formatDate(caseData.amoxicillin_date)}${caseData.amoxicillin_dosage ? ' — ' + caseData.amoxicillin_dosage : ''}`} colors={colors} /> : null}
          {caseData.vitamin_a_date ? <InfoRow label="Vitamin A" value={`${formatDate(caseData.vitamin_a_date)}${caseData.vitamin_a_dosage ? ' — ' + caseData.vitamin_a_dosage : ''}`} colors={colors} /> : null}
          {caseData.folic_acid_date ? <InfoRow label="Folic Acid" value={`${formatDate(caseData.folic_acid_date)}${caseData.folic_acid_dosage ? ' — ' + caseData.folic_acid_dosage : ''}`} colors={colors} /> : null}
          {caseData.deworming_date ? <InfoRow label="Deworming" value={`${formatDate(caseData.deworming_date)}${caseData.deworming_dosage ? ' — ' + caseData.deworming_dosage : ''}`} colors={colors} /> : null}
          {caseData.measles_vaccine_date ? <InfoRow label="Measles Vaccine" value={`${formatDate(caseData.measles_vaccine_date)}${caseData.measles_vaccine_dosage ? ' — ' + caseData.measles_vaccine_dosage : ''}`} colors={colors} /> : null}
          {caseData.malaria_test_date ? <InfoRow label="Malaria Test" value={`${formatDate(caseData.malaria_test_date)}${caseData.malaria_test_result ? ' — ' + caseData.malaria_test_result : ''}`} colors={colors} /> : null}
          {caseData.antimalarial_date ? <InfoRow label="Antimalarial" value={`${formatDate(caseData.antimalarial_date)}${caseData.antimalarial_dosage ? ' — ' + caseData.antimalarial_dosage : ''}`} colors={colors} /> : null}
          {caseData.additional_notes ? <InfoRow label="Notes" value={caseData.additional_notes} colors={colors} /> : null}
        </SectionCard>
      )}

      {/* Visit History Timeline */}
      {caseData.visits && caseData.visits.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Visit History</Text>
            <View style={[styles.visitCountPill, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.visitCountText, { color: colors.primary }]}>{caseData.visits.length}</Text>
            </View>
          </View>
          {[...caseData.visits].reverse().map((v, idx) => (
            <View key={v.id} style={[styles.timelineItem, idx === 0 && styles.timelineFirst]}>
              <View style={styles.timelineDotCol}>
                <View style={[styles.timelineDot, idx === 0 ? { backgroundColor: colors.primary } : { backgroundColor: colors.border }]} />
                {idx < caseData.visits.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <TouchableOpacity
                style={[styles.timelineCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, idx === 0 && { backgroundColor: colors.primary + '08', borderColor: colors.primary + '30' }]}
                onPress={() => {
                  if (isSuper) {
                    router.push({ pathname: '/visit/edit/[id]', params: { id: String(v.id), caseId: String(caseData.id) } });
                  } else {
                    Alert.alert('Restricted', 'Only super administrators can edit visits.');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.timelineCardHeader}>
                  <Text style={[styles.timelineVisitNum, { color: colors.textPrimary }]}>Visit {v.visit_number}</Text>
                  <Text style={[styles.timelineDate, { color: colors.textMuted }]}>{formatDate(v.visit_date)}</Text>
                </View>
                <View style={styles.timelineMetrics}>
                  <MiniMetric label="Wt" value={`${v.weight_kg}kg`} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  {v.muac_cm && <MiniMetric label="MUAC" value={`${v.muac_cm}cm`} textColor={colors.textPrimary} mutedColor={colors.textMuted} />}
                  {v.weight_change !== null && (
                    <MiniMetric
                      label="Δ"
                      value={`${v.weight_change > 0 ? '+' : ''}${v.weight_change}kg`}
                      color={v.weight_change > 0 ? colors.success : v.weight_change < 0 ? colors.danger : colors.textMuted}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textMuted}
                    />
                  )}
                  <MiniMetric label="Status" value={v.visit_outcome || '—'} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                </View>
                {(v.rutf_sachets_given || v.csb_plus_given || v.oil_given || v.food_product_type) && (
                  <View style={[styles.timelineMetrics, { marginTop: 6, paddingTop: 6, borderTopColor: colors.border, borderTopWidth: 1 }]}>
                    {v.rutf_sachets_given ? <MiniMetric label="RUTF" value={`${v.rutf_sachets_given}`} textColor={colors.textPrimary} mutedColor={colors.textMuted} /> : null}
                    {v.csb_plus_given ? <MiniMetric label="CSB+" value={`${v.csb_plus_given}`} textColor={colors.textPrimary} mutedColor={colors.textMuted} /> : null}
                    {v.oil_given ? <MiniMetric label="Oil" value={`${v.oil_given}`} textColor={colors.textPrimary} mutedColor={colors.textMuted} /> : null}
                    {v.food_product_type ? <MiniMetric label="FP" value={v.food_product_type} textColor={colors.textPrimary} mutedColor={colors.textMuted} /> : null}
                  </View>
                )}
                <View style={[styles.visitTapHint, { borderTopColor: colors.border }]}>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  <Text style={[styles.visitTapText, { color: colors.textMuted }]}>Tap to view/edit</Text>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Next Visit */}
      {isActive && caseData.next_visit_date && (
        <View style={[styles.section, styles.nextVisitCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="calendar" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.nextVisitLabel, { color: colors.textMuted }]}>Next Visit Due</Text>
            <Text style={[styles.nextVisitDate, { color: colors.textPrimary }]}>{formatDate(caseData.next_visit_date)}</Text>
          </View>
          {caseData.is_visit_due && (
            <View style={[styles.overdueChip, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.overdueText, { color: colors.danger }]}>OVERDUE</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface ChartPoint { label: string; weight: number; visitNum: number | null; }

function WeightProgressChart({ visits, regWeight, regDate, colors, typeColor }: {
  visits: OpcVisit[]; regWeight: number; regDate: string; colors: any; typeColor: string;
}) {
  const formatShort = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return d; }
  };

  const allPoints: ChartPoint[] = [
    { label: formatShort(regDate), weight: regWeight, visitNum: null },
    ...[...visits].sort((a, b) => a.visit_number - b.visit_number).map(v => ({
      label: formatShort(v.visit_date), weight: v.weight_kg, visitNum: v.visit_number,
    })),
  ];

  const weights = allPoints.map(p => p.weight);
  const minW = Math.max(0, Math.min(...weights) - 0.5);
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;
  const CHART_H = 120;
  const BAR_W = 40;
  const ITEM_W = 64;

  const latest = allPoints[allPoints.length - 1].weight;
  const first = allPoints[0].weight;
  const trend = latest - first;

  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: typeColor + '15' }]}>
          <Ionicons name="trending-up-outline" size={16} color={typeColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Weight Progression</Text>
        <View style={{ backgroundColor: (trend >= 0 ? colors.success : colors.danger) + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: trend >= 0 ? colors.success : colors.danger }}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)} kg
          </Text>
        </View>
      </View>

      {/* Y-axis labels */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: CHART_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
          <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600' }}>{maxW.toFixed(1)}</Text>
          <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600' }}>{((maxW + minW) / 2).toFixed(1)}</Text>
          <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600' }}>{minW.toFixed(1)}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ position: 'relative', height: CHART_H, flexDirection: 'row', alignItems: 'flex-end' }}>
            {/* Horizontal grid lines */}
            {[0, 0.5, 1].map((frac) => (
              <View key={frac} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: frac * CHART_H, height: 1, backgroundColor: colors.border, opacity: 0.4 }} />
            ))}

            {allPoints.map((point, idx) => {
              const barH = Math.max(4, ((point.weight - minW) / range) * CHART_H);
              const isReg = point.visitNum === null;
              const prevWeight = idx > 0 ? allPoints[idx - 1].weight : point.weight;
              const improved = point.weight >= prevWeight;
              const barColor = isReg ? colors.primary : improved ? colors.success : colors.danger;
              return (
                <View key={idx} style={{ width: ITEM_W, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H }}>
                  {/* Weight label above bar */}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: barColor, marginBottom: 2 }}>{point.weight}kg</Text>
                  {/* Bar */}
                  <View style={{ width: BAR_W, height: barH, backgroundColor: barColor + '30', borderRadius: 6, borderTopWidth: 3, borderTopColor: barColor, justifyContent: 'center', alignItems: 'center' }} />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* X-axis labels */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: 36, marginTop: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          {allPoints.map((point, idx) => (
            <View key={idx} style={{ width: ITEM_W, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textAlign: 'center' }}>
                {point.visitNum === null ? 'Reg' : `V${point.visitNum}`}
              </Text>
              <Text style={{ fontSize: 8, color: colors.textMuted, textAlign: 'center' }}>{point.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>Registration</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.success }} />
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>Weight Gain</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.danger }} />
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>Weight Loss</Text>
        </View>
      </View>
    </View>
  );
}

function StatCard({ label, value, icon, color, bg, textColor, mutedColor }: { label: string; value: string; icon: any; color: string; bg: string; textColor: string; mutedColor: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children, colors }: { title: string; icon: any; children: React.ReactNode; colors: any }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value, valueColor, colors }: { label: string; value: string; valueColor?: string; colors: any }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function MiniMetric({ label, value, color, textColor, mutedColor }: { label: string; value: string; color?: string; textColor?: string; mutedColor?: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={[styles.miniLabel, mutedColor ? { color: mutedColor } : null]}>{label}</Text>
      <Text style={[styles.miniValue, { color: color ?? textColor ?? '#0f172a' }]}>{value}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textMuted, marginTop: 8 },
  errorText: { fontSize: 16, color: COLORS.danger, fontWeight: '600' },
  photoCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, overflow: 'hidden', alignItems: 'center' },
  childPhoto: { width: '100%', height: 200, borderRadius: 16 },

  // Hero
  heroCard: {
    paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  typeBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  typeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginBottom: 4 },
  heroReg: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 12 },
  heroMetaRow: { flexDirection: 'row', gap: 20 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: -8, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 12, gap: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: COLORS.danger + '12', borderWidth: 1, borderColor: COLORS.danger + '30',
  },
  dueText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },

  // Management actions
  mgmtRow: { flexDirection: 'row' },
  mgmtBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
  },
  mgmtBtnText: { fontSize: 13, fontWeight: '700' },

  // Section
  section: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconWrap: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  visitCountPill: {
    backgroundColor: COLORS.primary + '15', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  visitCountText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  // Info rows
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  infoLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, maxWidth: '55%', textAlign: 'right' },

  // Timeline
  timelineItem: { flexDirection: 'row', marginTop: 0 },
  timelineFirst: {},
  timelineDotCol: { width: 24, alignItems: 'center', paddingTop: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 2 },
  timelineCard: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 8, marginLeft: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  timelineCardActive: { backgroundColor: COLORS.primary + '08', borderColor: COLORS.primary + '30' },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  timelineVisitNum: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  timelineDate: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  timelineMetrics: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  miniMetric: { alignItems: 'center' },
  miniLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginTop: 1 },

  // Visit tap hint
  visitTapHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1,
  },
  visitTapText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },

  // Next visit
  nextVisitCard: { flexDirection: 'row', alignItems: 'center' },
  nextVisitLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextVisitDate: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  overdueChip: {
    backgroundColor: COLORS.danger + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  overdueText: { fontSize: 10, fontWeight: '800', color: COLORS.danger, letterSpacing: 1 },
});
