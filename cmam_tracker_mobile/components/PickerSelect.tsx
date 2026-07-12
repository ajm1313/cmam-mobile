import { TouchableOpacity, Text, View, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

interface PickerItem {
  label: string;
  value: string;
}

interface PickerSelectProps {
  placeholder: { label: string; value: string };
  value: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
  colors: any;
  disabled?: boolean;
}

export default function PickerSelect({ placeholder, value, onValueChange, items, colors, disabled }: PickerSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = items.find(i => i.value === value);
  const displayText = selected ? selected.label : placeholder.label;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { borderColor: colors.border, backgroundColor: colors.inputBg }, disabled && styles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={[styles.text, { color: selected ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent={true} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <FlatList
              data={[{ label: placeholder.label, value: '' }, ...items]}
              keyExtractor={(item, idx) => item.value || `placeholder-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && { backgroundColor: colors.primary + '12' }]}
                  onPress={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, { color: item.value === value ? colors.primary : colors.textPrimary }]}>
                    {item.label}
                  </Text>
                  {item.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 13, minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, flex: 1, marginRight: 8 },
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', padding: 40,
  },
  sheet: {
    width: '100%', maxHeight: 400, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 10,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 18,
  },
  optionText: { fontSize: 15, fontWeight: '500' },
});
