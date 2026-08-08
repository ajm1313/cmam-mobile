import { useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
  TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ChartPoint {
  height: number;
  weight: number;
  label: string;
  isAdmission: boolean;
  visitNum: number | null;
  date: string;
  zScore: string;
}

interface WHOGrowthChartProps {
  gender: string;
  regWeight: number;
  regHeight: number;
  regDate: string;
  visits: any[];
  colors: any;
  typeColor: string;
  liveWeight?: number;
  liveHeight?: number;
}

// Multi-point calibration: maps data coords to percentage positions on the WHO image
// Uses linear regression (least-squares) from reference points for better accuracy.
interface CalPoint { val: number; pct: number }

const CAL_REF = {
  x: [{val:45, pct:8.05}, {val:120, pct:91.50}] as CalPoint[],
  y: [{val:0, pct:82.80}, {val:30, pct:9.80}] as CalPoint[],
};

interface LinearFit { a: number; b: number }

function linearFit(points: CalPoint[]): LinearFit {
  const n = points.length;
  if (n === 0) return { a: 0, b: 0 };
  if (n === 1) return { a: 0, b: points[0].pct };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += points[i].val;
    sumY += points[i].pct;
    sumXY += points[i].val * points[i].pct;
    sumXX += points[i].val * points[i].val;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return { a: 0, b: sumY / n };
  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;
  return { a, b };
}

const FIT = { x: linearFit(CAL_REF.x), y: linearFit(CAL_REF.y) };

function dataToPercent(heightCm: number, weightKg: number) {
  const xPct = FIT.x.a * heightCm + FIT.x.b;
  const yPct = FIT.y.a * weightKg + FIT.y.b;
  return { x: Math.max(0, Math.min(100, xPct)), y: Math.max(0, Math.min(100, yPct)) };
}

// Compute the rendered image dimensions for resizeMode="contain" without actually using contain
// so the overlay can be sized exactly to the displayed image.
function computeContainSize(imgW: number, imgH: number, containerW: number, containerH: number) {
  const imgAspect = imgW / imgH;
  const availW = Math.max(containerW, 1);
  const availH = Math.max(containerH, 1);

  let w = availW;
  let h = w / imgAspect;
  if (h > availH) {
    h = availH;
    w = h * imgAspect;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

export default function WHOGrowthChart({ gender, regWeight, regHeight, regDate, visits, colors, typeColor, liveWeight, liveHeight }: WHOGrowthChartProps) {
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [fsLayout, setFsLayout] = useState({ width: 0, height: 0 });

  const isBoy = gender === 'Male';
  const chartImage = isBoy
    ? require('../assets/cht-wflh-boys-z-0-5.jpg')
    : require('../assets/cht-wflh-girls-z-0-5.jpg');

  const source = Image.resolveAssetSource(chartImage);

  // Build chart points from registration + visits
  const points: ChartPoint[] = [];
  if (regWeight && regHeight && regWeight > 0 && regHeight > 0) {
    points.push({
      height: regHeight,
      weight: regWeight,
      label: `Adm (${regHeight}cm, ${regWeight}kg)`,
      isAdmission: true,
      visitNum: null,
      date: regDate,
      zScore: '',
    });
  }
  const sortedVisits = [...visits].sort((a, b) => a.visit_number - b.visit_number);
  for (const v of sortedVisits) {
    if (v.weight_kg && v.height_cm && v.weight_kg > 0 && v.height_cm > 0) {
      points.push({
        height: v.height_cm,
        weight: v.weight_kg,
        label: `V${v.visit_number} (${v.height_cm}cm, ${v.weight_kg}kg)`,
        isAdmission: false,
        visitNum: v.visit_number,
        date: v.visit_date,
        zScore: v.z_score_wfh || '',
      });
    }
  }
  // Live point from current form entry
  if (liveWeight && liveHeight && liveWeight > 0 && liveHeight > 0) {
    points.push({
      height: liveHeight,
      weight: liveWeight,
      label: `Now (${liveHeight}cm, ${liveWeight}kg)`,
      isAdmission: false,
      visitNum: null,
      date: 'Current',
      zScore: '',
    });
  }

  const hasData = points.length > 0;

  const renderOverlay = (layout: { width: number; height: number }) => {
    if (layout.width === 0 || !hasData) return null;

    const pixelPoints = points.map(pt => {
      const pct = dataToPercent(pt.height, pt.weight);
      return {
        ...pt,
        x: pct.x / 100 * layout.width,
        y: pct.y / 100 * layout.height,
      };
    });

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Trajectory lines */}
        {pixelPoints.length > 1 && pixelPoints.map((pt, idx) => {
          if (idx === 0) return null;
          const prev = pixelPoints[idx - 1];
          const dx = pt.x - prev.x;
          const dy = pt.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          return (
            <View
              key={`line-${idx}`}
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y,
                width: length,
                height: 2.5,
                backgroundColor: 'rgba(59, 130, 246, 0.65)',
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}

        {/* Data points */}
        {pixelPoints.map((pt, idx) => {
          const isLive = pt.date === 'Current';
          const dotColor = '#000000';
          const ringColor = isLive ? '#f59e0b' : pt.isAdmission ? '#2563eb' : '#10b981';
          const dotSize = 4;
          const ringSize = isLive ? 13 : 11;
          return (
            <View key={`dot-${idx}`}>
              {/* Thin colored circle */}
              <View style={{
                position: 'absolute',
                left: pt.x - ringSize / 2,
                top: pt.y - ringSize / 2,
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: 1.5,
                borderColor: ringColor,
                backgroundColor: 'transparent',
              }} />
              {/* Small black dot */}
              <View style={{
                position: 'absolute',
                left: pt.x - dotSize / 2,
                top: pt.y - dotSize / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: dotColor,
              }} />
              {/* Label */}
              <View style={{
                position: 'absolute',
                left: pt.x - 52,
                top: pt.y - ringSize / 2 - 22,
                width: 104,
                alignItems: 'center',
              }}>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  borderWidth: 0.5,
                  borderColor: isLive ? 'rgba(245,158,11,0.3)' : pt.isAdmission ? 'rgba(37,99,235,0.3)' : 'rgba(16,185,129,0.3)',
                }}>
                  <Text style={{
                    fontSize: 8,
                    fontWeight: '700',
                    color: isLive ? '#b45309' : pt.isAdmission ? '#1e40af' : '#047857',
                    textAlign: 'center',
                  }}>
                    {isLive ? 'Now' : pt.isAdmission ? 'Adm' : `V${pt.visitNum}`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const chartContent = (container: { width: number; height: number }, setContentSize: (size: { width: number; height: number }) => void, imageStyle: any) => {
    const contentSize = source?.width
      ? computeContainSize(source.width, source.height, container.width, container.height)
      : { width: imageStyle.width, height: imageStyle.height };

    return (
      <View style={{ position: 'relative', width: contentSize.width, height: contentSize.height }}>
        <Image
          source={chartImage}
          style={{ width: contentSize.width, height: contentSize.height }}
          resizeMode="stretch"
          onLoad={() => setContentSize(contentSize)}
        />
        {renderOverlay(contentSize)}
      </View>
    );
  };

  if (!hasData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: typeColor + '15' }]}>
            <Ionicons name="analytics-outline" size={16} color={typeColor} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>WHO Growth Chart</Text>
        </View>
        <Text style={[styles.emptyMsg, { color: colors.textMuted }]}>
          Weight and height data needed to display the growth chart. Height and weight are collected at registration and every 4th visit (4, 8, 12, 16).
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: typeColor + '15' }]}>
            <Ionicons name="analytics-outline" size={16} color={typeColor} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>WHO Growth Chart</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isBoy ? 'Boys' : 'Girls'} · WFL/H z-scores
          </Text>
          <TouchableOpacity
            onPress={() => setFullscreen(true)}
            style={[styles.expandBtn, { backgroundColor: typeColor + '15' }]}
          >
            <Ionicons name="expand-outline" size={16} color={typeColor} />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8, height: 400 }}
            onLayout={(e) => setImgLayout({ width: e.nativeEvent.layout.width, height: 400 })}
          >
            {imgLayout.width > 0 && chartContent(
              { width: imgLayout.width, height: 400 },
              () => {},
              { width: 100, height: 143 }
            )}
          </ScrollView>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Admission</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Visit</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Current</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: 'rgba(59, 130, 246, 0.65)' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Trajectory</Text>
          </View>
        </View>

        {/* Data points table */}
        <View style={{ marginTop: 8 }}>
          {points.map((pt, idx) => {
            const isLive = pt.date === 'Current';
            return (
            <View key={idx} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableCell, { color: colors.textSecondary, fontWeight: '700', width: 24 }]}>
                {idx + 1}
              </Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
                {pt.date}
              </Text>
              <Text style={[styles.tableCell, { color: colors.textPrimary }]}>
                {pt.height} cm
              </Text>
              <Text style={[styles.tableCell, { color: colors.textPrimary }]}>
                {pt.weight} kg
              </Text>
              <Text style={[styles.tableCell, { color: colors.textMuted, fontSize: 9 }]}>
                {pt.zScore || '—'}
              </Text>
              <View style={[styles.badge, {
                backgroundColor: isLive ? 'rgba(245, 158, 11, 0.1)' : pt.isAdmission ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              }]}>
                <Text style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: isLive ? '#b45309' : pt.isAdmission ? '#1e40af' : '#047857',
                }}>
                  {isLive ? 'Now' : pt.isAdmission ? 'Adm' : `V${pt.visitNum}`}
                </Text>
              </View>
            </View>
            );
          })}
        </View>
      </View>

      {/* Fullscreen pinch-to-zoom modal */}
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>
              WHO Growth Chart — {isBoy ? 'Boys' : 'Girls'} WFL/H
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginLeft: 8 }}>
              Pinch to zoom · Drag to pan
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setFullscreen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View
            style={{ flex: 1 }}
            onLayout={(e) => setFsLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
          {fsLayout.width > 0 && source && (() => {
            const fsSize = computeContainSize(source.width, source.height, fsLayout.width, fsLayout.height);
            return (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ width: fsSize.width, height: fsSize.height }}
            maximumZoomScale={6}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            <View style={{ position: 'relative', width: fsSize.width, height: fsSize.height }}>
              <Image
                source={chartImage}
                style={{ width: fsSize.width, height: fsSize.height }}
                resizeMode="stretch"
              />
              {renderOverlay({ width: fsSize.width, height: fsSize.height })}
            </View>
          </ScrollView>
            );
          })()}
          </View>
        </View>
      </Modal>
    </>
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
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 11, flex: 1 },
  expandBtn: {
    width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  emptyMsg: { fontSize: 13, paddingVertical: 20, textAlign: 'center', lineHeight: 20 },
  legendRow: {
    flexDirection: 'row', gap: 14, marginTop: 10, justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLine: { width: 16, height: 2.5, borderRadius: 1 },
  legendText: { fontSize: 10, fontWeight: '600' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: { fontSize: 10, flex: 1 },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  fullscreenHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.85)',
  },
  fullscreenTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  closeBtn: { padding: 4 },
  zoomBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  zoomText: { color: '#fff', fontSize: 13, fontWeight: '700', minWidth: 30, textAlign: 'center' },
});
