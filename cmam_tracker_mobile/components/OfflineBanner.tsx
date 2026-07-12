import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { useNetworkStatus } from '../lib/useNetworkStatus';

interface Props {
  isStale?: boolean;
}

export default function OfflineBanner({ isStale }: Props) {
  const { isConnected } = useNetworkStatus();
  const { colors } = useTheme();

  if (isConnected && !isStale) return null;

  const offline = !isConnected;
  const bgColor = offline ? colors.danger + '15' : colors.warning + '15';
  const borderColor = offline ? colors.danger + '40' : colors.warning + '40';
  const textColor = offline ? colors.danger : colors.warning;
  const icon = offline ? 'cloud-offline-outline' : 'time-outline';
  const message = offline
    ? 'You are offline. Showing cached data.'
    : 'Showing cached data. Pull to refresh.';

  return (
    <View style={[styles.banner, { backgroundColor: bgColor, borderColor }]}>
      <Ionicons name={icon as any} size={14} color={textColor} />
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
