import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ZScorePoint {
  label: string;
  zScore: number | null;
  visitNum: number | null;
  weight: number;
  height: number | null;
}

interface ZScoreChartProps {
  visits: any[];
  regWeight: number;
  regHeight: number;
  regZScore: number | null;
  regDate: string;
  colors: any;
  typeColor: string;
}

export default function ZScoreChart({ visits, regWeight, regHeight, regZScore, regDate, colors, typeColor }: ZScoreChartProps) {
  const formatShort = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return d; }
  };

  const sortedVisits = [...visits].sort((a, b) => a.visit_number - b.visit_number);

  const allPoints: ZScorePoint[] = [
    {
      label: formatShort(regDate),
      zScore: regZScore,
      visitNum: null,
      weight: regWeight,
      height: regHeight,
    },
    ...sortedVisits.map(v => ({
      label: formatShort(v.visit_date),
      zScore: v.z_score_wfh,
      visitNum: v.visit_number,
      weight: v.weight_kg,
      height: v.height_cm,
    })),
  ];

  // Only show points that have a z-score
  const pointsWithZ = allPoints.filter(p => p.zScore !== null && p.zScore !== undefined);
  const hasData = pointsWithZ.length > 0;

  if (!hasData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: typeColor + '15' }]}>
            <Ionicons name="analytics-outline" size={16} color={typeColor} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>WHO Z-Score Trajectory</Text>
        </View>
        <Text style={[styles.emptyMsg, { color: colors.textMuted }]}>
          Z-score data not available. Continue recording visits with weight and height to track progress.
        </Text>
      </View>
    );
  }

  // Chart dimensions
  const CHART_H = 200;
  const CHART_W = Math.max(pointsWithZ.length * 70, 280);
  const ITEM_W = 70;
  const LABEL_AREA_H = 40;
  const TOTAL_H = CHART_H + LABEL_AREA_H;

  // Z-score range: -4 to +2
  const Z_MIN = -4;
  const Z_MAX = 2;
  const Z_RANGE = Z_MAX - Z_MIN;

  // Map z-score to Y position (inverted: higher z = higher on chart)
  const zToY = (z: number) => {
    const clamped = Math.max(Z_MIN, Math.min(Z_MAX, z));
    return CHART_H - ((clamped - Z_MIN) / Z_RANGE) * CHART_H;
  };

  // Zone boundaries
  const yNormal = zToY(-2);   // > -2SD = normal/green
  const yMam = zToY(-3);      // -2 to -3SD = MAM/yellow
  const ySam = zToY(-4);      // < -3SD = SAM/red

  // Latest z-score for status badge
  const latestZ = pointsWithZ[pointsWithZ.length - 1].zScore!;
  const latestStatus = latestZ >= -2 ? 'Normal' : latestZ >= -3 ? 'MAM' : 'SAM';
  const latestColor = latestZ >= -2 ? colors.success : latestZ >= -3 ? colors.warning : colors.danger;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: typeColor + '15' }]}>
          <Ionicons name="analytics-outline" size={16} color={typeColor} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>WHO Z-Score Trajectory</Text>
        <View style={[styles.statusBadge, { backgroundColor: latestColor + '20', borderColor: latestColor + '40' }]}>
          <Text style={[styles.statusText, { color: latestColor }]}>{latestZ.toFixed(2)} SD</Text>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Weight-for-Height/Length z-scores (WHO reference)
      </Text>

      {/* Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
        <View style={{ width: CHART_W }}>
          {/* Z-score axis labels */}
          <View style={{ flexDirection: 'row', height: TOTAL_H }}>
            {/* Y-axis */}
            <View style={{ width: 40, height: CHART_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
              <Text style={[styles.axisLabel, { color: colors.textMuted }]}>+2</Text>
              <Text style={[styles.axisLabel, { color: colors.textMuted }]}>0</Text>
              <Text style={[styles.axisLabel, { color: colors.warning, fontWeight: '700' }]}>-2</Text>
              <Text style={[styles.axisLabel, { color: colors.danger, fontWeight: '700' }]}>-3</Text>
              <Text style={[styles.axisLabel, { color: colors.danger }]}>-4</Text>
            </View>

            {/* Chart area */}
            <View style={{ flex: 1, position: 'relative' }}>
              {/* Z-score zones (background) */}
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: yNormal, backgroundColor: colors.success + '08' }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: yNormal, height: yMam - yNormal, backgroundColor: colors.warning + '0C' }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: yMam, height: CHART_H - yMam, backgroundColor: colors.danger + '0A' }} />

              {/* Z-score reference lines */}
              <View style={{ position: 'absolute', left: 0, right: 0, top: zToY(0), height: 1, backgroundColor: colors.border }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: yNormal, height: 1.5, backgroundColor: colors.warning + '60' }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: yMam, height: 1.5, backgroundColor: colors.danger + '60' }} />

              {/* Zone labels (right side) */}
              <Text style={{ position: 'absolute', right: 4, top: 4, fontSize: 8, color: colors.success, fontWeight: '700', opacity: 0.6 }}>NORMAL</Text>
              <Text style={{ position: 'absolute', right: 4, top: yNormal + 4, fontSize: 8, color: colors.warning, fontWeight: '700', opacity: 0.6 }}>MAM</Text>
              <Text style={{ position: 'absolute', right: 4, top: yMam + 4, fontSize: 8, color: colors.danger, fontWeight: '700', opacity: 0.6 }}>SAM</Text>

              {/* Data points and connecting lines */}
              {pointsWithZ.map((point, idx) => {
                const x = idx * ITEM_W + ITEM_W / 2;
                const y = zToY(point.zScore!);
                const prevPoint = idx > 0 ? pointsWithZ[idx - 1] : null;
                const prevX = prevPoint ? (idx - 1) * ITEM_W + ITEM_W / 2 : null;
                const prevY = prevPoint ? zToY(prevPoint.zScore!) : null;
                const dotColor = point.zScore! >= -2 ? colors.success : point.zScore! >= -3 ? colors.warning : colors.danger;
                const isReg = point.visitNum === null;

                return (
                  <View key={idx}>
                    {/* Connecting line segment */}
                    {prevX !== null && prevY !== null && (
                      <View
                        style={{
                          position: 'absolute',
                          left: prevX,
                          top: Math.min(prevY, y),
                          width: Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2)),
                          height: 2,
                          backgroundColor: typeColor + '40',
                          transform: [
                            { rotate: `${Math.atan2(y - prevY, x - prevX) * 180 / Math.PI}deg` },
                          ],
                          transformOrigin: 'left center',
                        }}
                      />
                    )}
                    {/* Data point dot */}
                    <View
                      style={{
                        position: 'absolute',
                        left: x - 7,
                        top: y - 7,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: dotColor,
                        borderWidth: 2,
                        borderColor: colors.surface,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.3,
                        shadowRadius: 2,
                        elevation: 2,
                      }}
                    />
                    {/* Z-score value label */}
                    <Text
                      style={{
                        position: 'absolute',
                        left: x - 20,
                        top: y - 24,
                        width: 40,
                        fontSize: 10,
                        fontWeight: '800',
                        color: dotColor,
                        textAlign: 'center',
                      }}
                    >
                      {point.zScore!.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* X-axis labels */}
          <View style={{ flexDirection: 'row', marginLeft: 40, marginTop: 6 }}>
            {pointsWithZ.map((point, idx) => (
              <View key={idx} style={{ width: ITEM_W, alignItems: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' }}>
                  {point.visitNum === null ? 'Reg' : `V${point.visitNum}`}
                </Text>
                <Text style={{ fontSize: 8, color: colors.textMuted, textAlign: 'center' }}>{point.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Normal ({'>'}-2SD)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>MAM (-2 to -3SD)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>SAM ({'<'}-3SD)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  subtitle: { fontSize: 11, marginBottom: 4 },
  axisLabel: { fontSize: 9, fontWeight: '600' },
  emptyMsg: { fontSize: 13, paddingVertical: 20, textAlign: 'center', lineHeight: 20 },
  legendRow: {
    flexDirection: 'row', gap: 14, marginTop: 12, justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, fontWeight: '600' },
});
