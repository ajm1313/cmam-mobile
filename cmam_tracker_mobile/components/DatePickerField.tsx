import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerFieldProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  colors: any;
  maxDate?: string; // YYYY-MM-DD
  minDate?: string; // YYYY-MM-DD
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function buildYears(minDate?: string, maxDate?: string): number[] {
  const max = maxDate ? parseInt(maxDate.slice(0, 4)) : new Date().getFullYear();
  const min = minDate ? parseInt(minDate.slice(0, 4)) : max - 120;
  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);
  return years;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const ITEM_H = 44;

// ponytail: DatePickerField — modal scroll-wheel date selector, no external library required
export default function DatePickerField({ label, value, onChange, colors, maxDate, minDate }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? { y: parseInt(value.slice(0, 4)), m: parseInt(value.slice(5, 7)), d: parseInt(value.slice(8, 10)) }
    : (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; })();

  const [selYear, setSelYear] = useState(parsed.y);
  const [selMonth, setSelMonth] = useState(parsed.m);
  const [selDay, setSelDay] = useState(parsed.d);

  const years = buildYears(minDate, maxDate);
  const maxDays = daysInMonth(selYear, selMonth);
  const safeDay = Math.min(selDay, maxDays);
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  const formatted = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Select date';

  const yScrollRef = useRef<ScrollView>(null);
  const mScrollRef = useRef<ScrollView>(null);
  const dScrollRef = useRef<ScrollView>(null);

  const openPicker = () => {
    const p = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? { y: parseInt(value.slice(0, 4)), m: parseInt(value.slice(5, 7)), d: parseInt(value.slice(8, 10)) }
      : (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; })();
    setSelYear(p.y); setSelMonth(p.m); setSelDay(p.d);
    setOpen(true);
    // Scroll to selected values after render
    setTimeout(() => {
      const yi = years.indexOf(p.y);
      if (yi >= 0) yScrollRef.current?.scrollTo({ y: yi * ITEM_H, animated: false });
      mScrollRef.current?.scrollTo({ y: (p.m - 1) * ITEM_H, animated: false });
      dScrollRef.current?.scrollTo({ y: (p.d - 1) * ITEM_H, animated: false });
    }, 50);
  };

  const confirm = () => {
    const d = Math.min(safeDay, daysInMonth(selYear, selMonth));
    const yy = String(selYear);
    const mm = String(selMonth).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onChange(`${yy}-${mm}-${dd}`);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={17} color={colors.textMuted} />
        <Text style={[styles.triggerText, { color: value ? colors.textPrimary : colors.textMuted }]}>{formatted}</Text>
        <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{label ?? 'Select Date'}</Text>
              <TouchableOpacity onPress={confirm} style={styles.doneBtn} activeOpacity={0.7}>
                <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: colors.primary + '12' }]}>
              <Text style={[styles.previewText, { color: colors.primary }]}>
                {String(safeDay).padStart(2, '0')} {MONTHS[selMonth - 1]} {selYear}
              </Text>
            </View>

            {/* Columns */}
            <View style={styles.columns}>
              {/* Day */}
              <View style={styles.col}>
                <Text style={[styles.colLabel, { color: colors.textMuted }]}>Day</Text>
                <View style={[styles.wheelWrap, { borderColor: colors.border }]}>
                  <View pointerEvents="none" style={[styles.selector, { borderColor: colors.primary + '40' }]} />
                  <ScrollView
                    ref={dScrollRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_H}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                      setSelDay(days[Math.max(0, Math.min(idx, days.length - 1))]);
                    }}
                  >
                    {days.map((d) => (
                      <TouchableOpacity key={d} style={styles.item} onPress={() => { setSelDay(d); dScrollRef.current?.scrollTo({ y: (d - 1) * ITEM_H, animated: true }); }}>
                        <Text style={[styles.itemText, { color: d === safeDay ? colors.primary : colors.textPrimary }, d === safeDay && styles.itemSelected]}>{String(d).padStart(2, '0')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Month */}
              <View style={[styles.col, { flex: 2 }]}>
                <Text style={[styles.colLabel, { color: colors.textMuted }]}>Month</Text>
                <View style={[styles.wheelWrap, { borderColor: colors.border }]}>
                  <View pointerEvents="none" style={[styles.selector, { borderColor: colors.primary + '40' }]} />
                  <ScrollView
                    ref={mScrollRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_H}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                      setSelMonth(Math.max(1, Math.min(idx + 1, 12)));
                    }}
                  >
                    {MONTHS.map((name, idx) => {
                      const m = idx + 1;
                      return (
                        <TouchableOpacity key={m} style={styles.item} onPress={() => { setSelMonth(m); mScrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true }); }}>
                          <Text style={[styles.itemText, { color: m === selMonth ? colors.primary : colors.textPrimary }, m === selMonth && styles.itemSelected]}>{name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Year */}
              <View style={styles.col}>
                <Text style={[styles.colLabel, { color: colors.textMuted }]}>Year</Text>
                <View style={[styles.wheelWrap, { borderColor: colors.border }]}>
                  <View pointerEvents="none" style={[styles.selector, { borderColor: colors.primary + '40' }]} />
                  <ScrollView
                    ref={yScrollRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_H}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                      setSelYear(years[Math.max(0, Math.min(idx, years.length - 1))]);
                    }}
                  >
                    {years.map((y, idx) => (
                      <TouchableOpacity key={y} style={styles.item} onPress={() => { setSelYear(y); yScrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true }); }}>
                        <Text style={[styles.itemText, { color: y === selYear ? colors.primary : colors.textPrimary }, y === selYear && styles.itemSelected]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            {/* Confirm button */}
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={confirm} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.confirmText}>Select Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4,
  },
  triggerText: { flex: 1, fontSize: 15, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  cancelText: { fontSize: 16, fontWeight: '500' },
  doneBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  doneText: { fontSize: 16, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  preview: { marginHorizontal: 20, marginVertical: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  previewText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  columns: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, height: ITEM_H * 5 + 4 },
  col: { flex: 1, gap: 4 },
  colLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  wheelWrap: { flex: 1, borderWidth: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  selector: { position: 'absolute', top: ITEM_H * 2, left: 8, right: 8, height: ITEM_H, borderRadius: 8, borderWidth: 2, zIndex: 1, pointerEvents: 'none' },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  itemText: { fontSize: 16, fontWeight: '500' },
  itemSelected: { fontWeight: '800', fontSize: 18 },
  confirmBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16, paddingVertical: 14, borderRadius: 14,
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
