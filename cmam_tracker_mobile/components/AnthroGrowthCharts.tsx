import { useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
  TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ChartType = 'wfh' | 'wfa' | 'hfa';

interface AnthroGrowthChartsProps {
  gender: string;
  weight: number;   // kg
  height: number;   // cm
  ageMonths: number;
  colors: any;
}

// Calibration per chart type: maps data coords to percentage positions on the WHO image
interface CalSet {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  pxLeft: number; pxRight: number;
  pyTop: number; pyBottom: number;
}

const CAL: Record<ChartType, CalSet> = {
  // Weight-for-Height: X=height 45-120cm, Y=weight 2-34kg
  wfh: {
    xMin: 45, xMax: 120, yMin: 2, yMax: 34,
    pxLeft: 8.05, pxRight: 91.50, pyTop: 9.80, pyBottom: 82.80,
  },
  // Weight-for-Age (0-5): X=age 0-60mo, Y=weight 0-30kg
  wfa: {
    xMin: 0, xMax: 60, yMin: 0, yMax: 30,
    pxLeft: 10.5, pxRight: 91.0, pyTop: 7.0, pyBottom: 85.0,
  },
  // Height-for-Age (0-5): X=age 0-60mo, Y=height 45-120cm
  hfa: {
    xMin: 0, xMax: 60, yMin: 45, yMax: 120,
    pxLeft: 10.5, pxRight: 91.0, pyTop: 7.0, pyBottom: 85.0,
  },
};

const CHART_META: Record<ChartType, { title: string; shortLabel: string; xLabel: string; yLabel: string }> = {
  wfh: { title: 'Weight-for-Height', shortLabel: 'WFH', xLabel: 'Height', yLabel: 'Weight' },
  wfa: { title: 'Weight-for-Age', shortLabel: 'WFA', xLabel: 'Age (mo)', yLabel: 'Weight' },
  hfa: { title: 'Height-for-Age', shortLabel: 'HFA', xLabel: 'Age (mo)', yLabel: 'Height' },
};

function getChartImage(type: ChartType, isBoy: boolean) {
  switch (type) {
    case 'wfh':
      return isBoy
        ? require('../assets/cht-wflh-boys-z-0-5.jpg')
        : require('../assets/cht-wflh-girls-z-0-5.jpg');
    case 'wfa':
      return isBoy
        ? require('../assets/cht-wfa-boys-z-0-5.jpg')
        : require('../assets/cht-wfa-girls-z-0-5.jpg');
    case 'hfa':
      return isBoy
        ? require('../assets/cht-lhfa-boys-z-0-5.jpg')
        : require('../assets/cht-lhfa-girls-z-0-5.jpg');
  }
}

function dataToPercent(type: ChartType, xVal: number, yVal: number) {
  const c = CAL[type];
  const xPct = c.pxLeft + (xVal - c.xMin) / (c.xMax - c.xMin) * (c.pxRight - c.pxLeft);
  const yPct = c.pyBottom - (yVal - c.yMin) / (c.yMax - c.yMin) * (c.pyBottom - c.pyTop);
  return { x: Math.max(0, Math.min(100, xPct)), y: Math.max(0, Math.min(100, yPct)) };
}

function getPointCoords(type: ChartType, weight: number, height: number, ageMonths: number) {
  switch (type) {
    case 'wfh':
      if (!weight || !height) return null;
      return dataToPercent('wfh', height, weight);
    case 'wfa':
      if (!weight || ageMonths < 0) return null;
      return dataToPercent('wfa', ageMonths, weight);
    case 'hfa':
      if (!height || ageMonths < 0) return null;
      return dataToPercent('hfa', ageMonths, height);
  }
}

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

// ─── Single Mini Chart ───────────────────────────────────────────
const MINI_CHART_W = 236;
const MINI_CHART_H = 180;

function MiniChart({
  type, isBoy, weight, height, ageMonths, colors, onPress,
}: {
  type: ChartType; isBoy: boolean; weight: number; height: number;
  ageMonths: number; colors: any; onPress: () => void;
}) {
  const chartImage = getChartImage(type, isBoy);
  const source = Image.resolveAssetSource(chartImage);
  const meta = CHART_META[type];

  const pt = getPointCoords(type, weight, height, ageMonths);
  const hasData = pt !== null;

  const contentSize = source?.width
    ? computeContainSize(source.width, source.height, MINI_CHART_W, MINI_CHART_H)
    : { width: MINI_CHART_W, height: MINI_CHART_H };

  return (
    <View style={[miniStyles.container, { backgroundColor: colors.surface }]}>
      <View style={miniStyles.header}>
        <Text style={[miniStyles.title, { color: colors.textPrimary }]}>{meta.shortLabel}</Text>
        <Text style={[miniStyles.subtitle, { color: colors.textMuted }]}>{isBoy ? 'Boys' : 'Girls'}</Text>
        <TouchableOpacity onPress={onPress} style={[miniStyles.expandBtn, { backgroundColor: colors.border + '30' }]}>
          <Ionicons name="expand-outline" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {hasData ? (
        <View style={{ alignItems: 'center', height: MINI_CHART_H }}>
          {contentSize.width > 0 && (
            <View style={{ position: 'relative', width: contentSize.width, height: contentSize.height }}>
              <Image
                source={chartImage}
                style={{ width: contentSize.width, height: contentSize.height }}
                resizeMode="stretch"
              />
              {/* Plot point — small black dot with thin red circle */}
              {(() => {
                const px = pt!.x / 100 * contentSize.width;
                const py = pt!.y / 100 * contentSize.height;
                const dotSize = 5;
                const ringSize = 14;
                return (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* Thin red circle */}
                    <View style={{
                      position: 'absolute',
                      left: px - ringSize / 2, top: py - ringSize / 2,
                      width: ringSize, height: ringSize,
                      borderRadius: ringSize / 2,
                      borderWidth: 1.5, borderColor: '#ef4444',
                      backgroundColor: 'transparent',
                    }} />
                    {/* Small black dot */}
                    <View style={{
                      position: 'absolute',
                      left: px - dotSize / 2, top: py - dotSize / 2,
                      width: dotSize, height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: '#000000',
                    }} />
                    {/* Label */}
                    <View style={{
                      position: 'absolute',
                      left: px - 55, top: py - ringSize / 2 - 20,
                      width: 110, alignItems: 'center',
                    }}>
                      <View style={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        paddingHorizontal: 5, paddingVertical: 1,
                        borderRadius: 4, borderWidth: 0.5,
                        borderColor: 'rgba(239,68,68,0.3)',
                      }}>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#b91c1c', textAlign: 'center' }}>
                          {type === 'wfh' ? `${height}cm/${weight}kg` : type === 'wfa' ? `${ageMonths}mo/${weight}kg` : `${ageMonths}mo/${height}cm`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      ) : (
        <View style={[miniStyles.emptyBox, { backgroundColor: colors.background }]}>
          <Ionicons name="bar-chart-outline" size={20} color={colors.textMuted} />
          <Text style={[miniStyles.emptyText, { color: colors.textMuted }]}>
            {type === 'wfh' ? 'Weight & height needed' : type === 'wfa' ? 'Weight & age needed' : 'Height & age needed'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Fullscreen Zoom Modal ───────────────────────────────────────
function FullscreenChart({
  type, isBoy, weight, height, ageMonths, onClose,
}: {
  type: ChartType; isBoy: boolean; weight: number; height: number;
  ageMonths: number; onClose: () => void;
}) {
  const chartImage = getChartImage(type, isBoy);
  const source = Image.resolveAssetSource(chartImage);
  const meta = CHART_META[type];
  const pt = getPointCoords(type, weight, height, ageMonths);

  // Use a large base size so zooming in shows detail
  const BASE_W = 1400;
  const BASE_H = source ? Math.round(1400 * source.height / source.width) : 2000;

  const size = { width: BASE_W, height: BASE_H };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={fsStyles.header}>
          <Text style={fsStyles.title}>
            {meta.title} — {isBoy ? 'Boys' : 'Girls'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginLeft: 8 }}>
            Pinch to zoom · Drag to pan
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose} style={fsStyles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ width: size.width, height: size.height }}
          maximumZoomScale={6}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          <View style={{ position: 'relative', width: size.width, height: size.height }}>
            <Image
              source={chartImage}
              style={{ width: size.width, height: size.height }}
              resizeMode="stretch"
            />
            {pt && (() => {
              const px = pt.x / 100 * size.width;
              const py = pt.y / 100 * size.height;
              const dotSize = 8;
              const ringSize = 22;
              return (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {/* Thin red circle */}
                  <View style={{
                    position: 'absolute',
                    left: px - ringSize / 2, top: py - ringSize / 2,
                    width: ringSize, height: ringSize,
                    borderRadius: ringSize / 2,
                    borderWidth: 2, borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                  }} />
                  {/* Small black dot */}
                  <View style={{
                    position: 'absolute',
                    left: px - dotSize / 2, top: py - dotSize / 2,
                    width: dotSize, height: dotSize,
                    borderRadius: dotSize / 2,
                    backgroundColor: '#000000',
                  }} />
                  {/* Label */}
                  <View style={{
                    position: 'absolute',
                    left: px - 80, top: py - ringSize / 2 - 32,
                    width: 160, alignItems: 'center',
                  }}>
                    <View style={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      paddingHorizontal: 10, paddingVertical: 3,
                      borderRadius: 6, borderWidth: 1,
                      borderColor: 'rgba(239,68,68,0.4)',
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#b91c1c', textAlign: 'center' }}>
                        {type === 'wfh' ? `${height} cm / ${weight} kg` : type === 'wfa' ? `${ageMonths} mo / ${weight} kg` : `${ageMonths} mo / ${height} cm`}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function AnthroGrowthCharts({ gender, weight, height, ageMonths, colors }: AnthroGrowthChartsProps) {
  const [fullscreenType, setFullscreenType] = useState<ChartType | null>(null);
  const isBoy = gender === 'Male';

  const types: ChartType[] = ['wfh', 'wfa', 'hfa'];

  return (
    <View>
      <View style={styles.sectionHeader}>
        <View style={[styles.iconWrap, { backgroundColor: colors.border + '30' }]}>
          <Ionicons name="analytics-outline" size={16} color={colors.textSecondary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>WHO Growth Charts</Text>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>{isBoy ? 'Boys' : 'Girls'}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 8 }}
      >
        {types.map((type) => (
          <View key={type} style={{ width: 260, marginRight: 12 }}>
            <MiniChart
              type={type}
              isBoy={isBoy}
              weight={weight}
              height={height}
              ageMonths={ageMonths}
              colors={colors}
              onPress={() => setFullscreenType(type)}
            />
          </View>
        ))}
      </ScrollView>

      {fullscreenType && (
        <FullscreenChart
          type={fullscreenType}
          isBoy={isBoy}
          weight={weight}
          height={height}
          ageMonths={ageMonths}
          onClose={() => setFullscreenType(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2,
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionSub: { fontSize: 11, flex: 1 },
});

const miniStyles = StyleSheet.create({
  container: {
    borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  title: { fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 10, flex: 1 },
  expandBtn: {
    width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center',
  },
  emptyBox: {
    height: 180, justifyContent: 'center', alignItems: 'center', borderRadius: 10, gap: 6,
  },
  emptyText: { fontSize: 11, textAlign: 'center' },
});

const fsStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.85)',
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  closeBtn: { padding: 4 },
  zoomBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  zoomText: { color: '#fff', fontSize: 13, fontWeight: '700', minWidth: 30, textAlign: 'center' },
});
