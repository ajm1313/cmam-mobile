import { useEffect, useRef } from 'react';
import { View, LogBox } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../lib/store';
import { setOnUnauthorized } from '../lib/api';
import { ThemeProvider, useTheme } from '../lib/theme';
import ErrorBoundary from '../components/ErrorBoundary';

const isExpoGo = Constants.appOwnership === 'expo';

// Suppress known Expo Go push-notification warning (not supported since SDK 53)
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    setOnUnauthorized(async () => {
      // ponytail: never force-logout while the device is offline — cached session
      // must remain visible so the user doesn't lose their data display.
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) return;

      const staleToken = useAuthStore.getState().token;
      const currentToken = await SecureStore.getItemAsync('auth_token');
      if (currentToken && currentToken === staleToken) {
        logout();
      }
    });
    loadToken();

    // Register for push notifications (skip in Expo Go — not supported since SDK 53)
    if (!isExpoGo) {
      import('../lib/notifications').then(({ registerForPushNotifications }) => {
        registerForPushNotifications().then((token) => {
          if (token) {
            import('../lib/api').then(({ default: api }) => {
              api.post('/v1/push-token/', { push_token: token }).catch(() => {});
            });
          }
        });
      });
      import('expo-notifications').then((Notifications) => {
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (data?.caseId && (
            data.type === 'visit_reminder' || data.type === 'visit_today' ||
            data.type === 'new_case' || data.type === 'discharge_eligible' ||
            data.type === 'sam_transition'
          )) {
            router.push({ pathname: '/case/[id]', params: { id: String(data.caseId) } });
          } else if (data?.type === 'stock_critical' || data?.type === 'stock_low') {
            router.push('/admin/inventory-reports');
          }
        });
      });
    }

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'light'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.headerBg },
            headerTintColor: colors.headerText,
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
            headerShadowVisible: true,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="case/[id]" options={{ title: 'Case Details' }} />
          <Stack.Screen name="case/register" options={{ title: 'Register Case', headerShown: false }} />
          <Stack.Screen name="case/edit" options={{ title: 'Edit Case', headerShown: false }} />
          <Stack.Screen name="case/discharge" options={{ title: 'Discharge Management', headerShown: false }} />
          <Stack.Screen name="case/due-visits" options={{ title: 'Due Visits', headerShown: false }} />
          <Stack.Screen name="visit/[caseId]" options={{ title: 'Record Visit', headerShown: false }} />
          <Stack.Screen name="visit/edit" options={{ title: 'Edit Visit', headerShown: false }} />
          <Stack.Screen name="facility/[id]" options={{ title: 'Facility Details' }} />
          <Stack.Screen name="change-password" options={{ title: 'Change Password', presentation: 'modal' }} />
          <Stack.Screen name="admin/index" options={{ title: 'Admin & Tools', headerShown: false }} />
          <Stack.Screen name="admin/users" options={{ title: 'Users', headerShown: false }} />
          <Stack.Screen name="admin/user-create" options={{ title: 'Create User', headerShown: false }} />
          <Stack.Screen name="admin/user-detail" options={{ title: 'User Detail', headerShown: false }} />
          <Stack.Screen name="admin/user-edit" options={{ title: 'Edit User', headerShown: false }} />
          <Stack.Screen name="admin/facilities" options={{ title: 'Facilities', headerShown: false }} />
          <Stack.Screen name="admin/facility-create" options={{ title: 'Create Facility', headerShown: false }} />
          <Stack.Screen name="admin/facility-edit" options={{ title: 'Edit Facility', headerShown: false }} />
          <Stack.Screen name="admin/locations" options={{ title: 'Locations', headerShown: false }} />
          <Stack.Screen name="admin/inventory-items" options={{ title: 'Inventory Items', headerShown: false }} />
          <Stack.Screen name="admin/facility-detail" options={{ title: 'Facility Detail', headerShown: false }} />
          <Stack.Screen name="admin/stock-requests" options={{ title: 'Stock Requests', headerShown: false }} />
          <Stack.Screen name="admin/stock-levels" options={{ title: 'Stock Levels', headerShown: false }} />
          <Stack.Screen name="admin/stock-movements" options={{ title: 'Stock Movements', headerShown: false }} />
          <Stack.Screen name="admin/stock-request-create" options={{ title: 'New Stock Request', headerShown: false }} />
          <Stack.Screen name="admin/expiry-management" options={{ title: 'Expiry Management', headerShown: false }} />
          <Stack.Screen name="admin/access-control" options={{ title: 'Access Control', headerShown: false }} />
          <Stack.Screen name="admin/reports" options={{ title: 'Reports', headerShown: false }} />
          <Stack.Screen name="admin/weekly-report" options={{ title: 'Weekly Report', headerShown: false }} />
          <Stack.Screen name="admin/monthly-report" options={{ title: 'Monthly Report', headerShown: false }} />
        </Stack>
      </View>
    </ErrorBoundary>
  );
}
