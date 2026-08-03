import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
  TouchableOpacity, Modal, Animated, Easing,
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
}

// Calibration: maps data coords to percentage positions on the WHO image
const CAL = {
  xMin: 45, xMax: 120,
  yMin: 2, yMax: 34,
  pxLeft: 8.05, pxRight: 91.50,
  pyTop: 9.80, pyBottom: 82.80,
};

function dataToPercent(heightCm: number, weightKg: number) {
  const xPct = CAL.pxLeft + (heightCm - CAL.xMin) / (CAL.xMax - CAL.xMin) * (CAL.pxRight - CAL.pxLeft);
  const yPct = CAL.pyBottom - (weightKg - CAL.yMin) / (CAL.yMax - CAL.yMin) * (CAL.pyBottom - CAL.pyTop);
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

export default function WHOGrowthChart({ gender, regWeight, regHeight, regDate, visits, colors, typeColor }: WHOGrowthChartProps) {
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [fsContainer, setFsContainer] = useState({ width: 0, height: 0 });
  const [fsContentSize, setFsContentSize] = useState({ width: 0, height: 0 });
  const [scaleIndex, setScaleIndex] = useState(0);

  const isBoy = gender === 'Male';
  const chartImage = isBoy
    ? require('../assets/cht-wflh-boys-z-0-5.jpg')
    : require('../assets/cht-wflh-girls-z-0-5.jpg');

  const source = Image.resolveAssetSource(chartImage);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const scales = [1, 1.5, 2, 2.5, 3, 4];

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: scales[scaleIndex],
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [scaleIndex, scaleAnim, scales]);

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
          const dotColor = pt.isAdmission ? '#2563eb' : '#10b981';
          const dotSize = pt.isAdmission ? 14 : 11;
          return (
            <View key={`dot-${idx}`}>
              {/* Outer glow */}
              <View style={{
                position: 'absolute',
                left: pt.x - dotSize / 2 - 5,
                top: pt.y - dotSize / 2 - 5,
                width: dotSize + 10,
                height: dotSize + 10,
                borderRadius: (dotSize + 10) / 2,
                backgroundColor: pt.isAdmission ? 'rgba(37, 99, 235, 0.20)' : 'rgba(16, 185, 129, 0.20)',
              }} />
              {/* White border */}
              <View style={{
                position: 'absolute',
                left: pt.x - dotSize / 2 - 2,
                top: pt.y - dotSize / 2 - 2,
                width: dotSize + 4,
                height: dotSize + 4,
                borderRadius: (dotSize + 4) / 2,
                backgroundColor: '#ffffff',
              }} />
              {/* Dot */}
              <View style={{
                position: 'absolute',
                left: pt.x - dotSize / 2,
                top: pt.y - dotSize / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: dotColor,
                borderWidth: 2,
                borderColor: '#ffffff',
              }} />
              {/* Label */}
              <View style={{
                position: 'absolute',
                left: pt.x - 52,
                top: pt.y - dotSize / 2 - 24,
                width: 104,
                alignItems: 'center',
              }}>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  borderWidth: 0.5,
                  borderColor: pt.isAdmission ? 'rgba(37,99,235,0.3)' : 'rgba(16,185,129,0.3)',
                }}>
                  <Text style={{
                    fontSize: 8,
                    fontWeight: '700',
                    color: pt.isAdmission ? '#1e40af' : '#047857',
                    textAlign: 'center',
                  }}>
                    {pt.isAdmission ? 'Adm' : `V${pt.visitNum}`}
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
          Weight and height data needed to display the growth chart. Height and weight are collected at registration and every 3rd visit (3, 6, 9, 12, 15).
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
            style={{ marginTop: 8 }}
            onLayout={(e) => setImgLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            {imgLayout.width > 0 && chartContent(
              { width: imgLayout.width, height: imgLayout.height },
              () => {},
              { width: 200, height: 285 }
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
            <View style={[styles.legendLine, { backgroundColor: 'rgba(59, 130, 246, 0.65)' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Trajectory</Text>
          </View>
        </View>

        {/* Data points table */}
        <View style={{ marginTop: 8 }}>
          {points.map((pt, idx) => (
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
                backgroundColor: pt.isAdmission ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              }]}>
                <Text style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: pt.isAdmission ? '#1e40af' : '#047857',
                }}>
                  {pt.isAdmission ? 'Adm' : `V${pt.visitNum}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Fullscreen zoomable modal */}
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setFsContainer({ width, height });
          const size = source?.width
            ? computeContainSize(source.width, source.height, width - 20, height - 120)
            : { width: Math.max(width - 20, 340), height: Math.max(height - 120, 480) };
          setFsContentSize(size);
        }}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>
              WHO Growth Chart — {isBoy ? 'Boys' : 'Girls'} WFL/H
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => setScaleIndex(Math.max(0, scaleIndex - 1))} style={styles.zoomBtn}>
                <Ionicons name="remove-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.zoomText}>{scales[scaleIndex]}x</Text>
              <TouchableOpacity onPress={() => setScaleIndex(Math.min(scales.length - 1, scaleIndex + 1))} style={styles.zoomBtn}>
                <Ionicons name="add-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setScaleIndex(0); setFullscreen(false); }} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, padding: 10 }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                {fsContentSize.width > 0 && chartContent(
                  { width: fsContainer.width, height: fsContainer.height },
                  () => {},
                  { width: fsContentSize.width, height: fsContentSize.height }
                )}
              </Animated.View>
            </ScrollView>
          </ScrollView>
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
