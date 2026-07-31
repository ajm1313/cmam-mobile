import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, LayoutChangeEvent,
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

// Calibration: same as web app — maps data coords to percentage positions on the image
const CAL = {
  xMin: 45, xMax: 120,
  yMin: 2, yMax: 34,
  pxLeft: 8.05, pxRight: 91.50,
  pyTop: 9.80, pyBottom: 82.80,
};

function dataToPercent(heightCm: number, weightKg: number) {
  const xPct = CAL.pxLeft + (heightCm - CAL.xMin) / (CAL.xMax - CAL.xMin) * (CAL.pxRight - CAL.pxLeft);
  const yPct = CAL.pyBottom - (weightKg - CAL.yMin) / (CAL.yMax - CAL.yMin) * (CAL.pyBottom - CAL.pyTop);
  return { x: xPct, y: yPct };
}

export default function WHOGrowthChart({ gender, regWeight, regHeight, regDate, visits, colors, typeColor }: WHOGrowthChartProps) {
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenLayout, setFullscreenLayout] = useState({ width: 0, height: 0 });

  const isBoy = gender === 'Male';
  const chartImage = isBoy
    ? require('../assets/cht-wflh-boys-z-0-5.jpg')
    : require('../assets/cht-wflh-girls-z-0-5.jpg');

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
                height: 2,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}

        {/* Data points */}
        {pixelPoints.map((pt, idx) => {
          const dotColor = pt.isAdmission ? '#2563eb' : '#10b981';
          const dotSize = pt.isAdmission ? 12 : 10;
          return (
            <View key={`dot-${idx}`}>
              {/* Outer glow */}
              <View style={{
                position: 'absolute',
                left: pt.x - dotSize / 2 - 4,
                top: pt.y - dotSize / 2 - 4,
                width: dotSize + 8,
                height: dotSize + 8,
                borderRadius: (dotSize + 8) / 2,
                backgroundColor: pt.isAdmission ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.12)',
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
                borderWidth: 1.5,
                borderColor: '#ffffff',
              }} />
              {/* Label */}
              <View style={{
                position: 'absolute',
                left: pt.x - 50,
                top: pt.y - dotSize / 2 - 22,
                width: 100,
                alignItems: 'center',
              }}>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  borderRadius: 3,
                  borderWidth: 0.5,
                  borderColor: pt.isAdmission ? 'rgba(37,99,235,0.2)' : 'rgba(16,185,129,0.2)',
                }}>
                  <Text style={{
                    fontSize: 7,
                    fontWeight: '600',
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

  const chartContent = (layout: { width: number; height: number }, onLayout: (e: LayoutChangeEvent) => void, imageStyle: any) => (
    <View style={{ position: 'relative', width: '100%' }} onLayout={onLayout}>
      <Image
        source={chartImage}
        style={imageStyle}
        resizeMode="contain"
      />
      {renderOverlay(layout)}
    </View>
  );

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
          Weight and height data needed to display the growth chart. Record visits with weight and height to track progress.
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {chartContent(
            imgLayout,
            (e) => setImgLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }),
            { width: 340, height: 480 }
          )}
        </ScrollView>

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
            <View style={[styles.legendLine, { backgroundColor: 'rgba(59, 130, 246, 0.5)' }]} />
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

      {/* Fullscreen modal */}
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>
              WHO Growth Chart — {isBoy ? 'Boys' : 'Girls'} WFL/H
            </Text>
            <TouchableOpacity onPress={() => setFullscreen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            onLayout={(e) => setFullscreenLayout({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })}
          >
            {chartContent(
              { width: Math.max(fullscreenLayout.width - 20, 340), height: Math.max(fullscreenLayout.height - 80, 480) },
              (e) => setFullscreenLayout({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              }),
              {
                width: Math.max(fullscreenLayout.width - 20, 340),
                height: Math.max(fullscreenLayout.height - 80, 480),
              }
            )}
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
  legendLine: { width: 16, height: 2, borderRadius: 1 },
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
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.8)',
  },
  fullscreenTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  closeBtn: { padding: 4 },
});
