import { useEffect, useRef } from 'react';
import { View, LogBox, AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../lib/store';
import { setOnUnauthorized } from '../lib/api';
import { ThemeProvider, useTheme } from '../lib/theme';
import { useOfflineSync } from '../lib/useOfflineSync';
import ErrorBoundary from '../components/ErrorBoundary';
import { logger } from '../lib/logger';

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const responseListener = useRef<{ remove(): void } | null>(null);
  const lastNotificationId = useRef<string | null>(null);
  const lastPushSync = useRef(0);
  const wasAuthenticated = useRef(false);

  useOfflineSync();

  // Global auth watcher: whenever an active session ends (token expiry,
  // interceptor logout, etc.), redirect to the login screen. Without this,
  // the user stays on the current screen with user=null, showing "User"
  // instead of their real name until they manually log out and back in.
  useEffect(() => {
    if (isAuthenticated) {
      wasAuthenticated.current = true;
    } else if (wasAuthenticated.current && !isLoading) {
      wasAuthenticated.current = false;
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    setOnUnauthorized(async () => {
      // ponytail: never force-logout while the device is offline — cached session
      // must remain visible so the user doesn't lose their data display.
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) return;

      const staleToken = useAuthStore.getState().token;
      const currentToken = await SecureStore.getItemAsync('auth_token');
      if (currentToken && currentToken === staleToken) {
        await logout();
        // Navigate immediately — the global auth watcher above is a backup,
        // but an explicit redirect guarantees the user lands on login.
        router.replace('/login');
      }
    });
    loadToken();

    // Re-validate auth when app returns from background
    // This proactively refreshes expired tokens instead of waiting for a 401
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const { isAuthenticated, token } = useAuthStore.getState();
        if (isAuthenticated && token) {
          // Token exists — silently re-validate by fetching profile
          // The interceptor will auto-refresh if the token is expired
          loadToken();
        }
      }
    });

    // Route both warm and cold-start notification taps.
    if (!isExpoGo) {
      import('expo-notifications').then((Notifications) => {
        const routeResponse = (response: any) => {
          if (!response || response.notification.request.identifier === lastNotificationId.current) return;
          lastNotificationId.current = response.notification.request.identifier;
          const data = response.notification.request.content.data;
          const caseId = data?.caseId ?? data?.case_id;
          const ipcCaseId = data?.ipcCaseId ?? data?.ipc_case_id;
          if (caseId && (
            data.type === 'visit_reminder' || data.type === 'visit_today' ||
            data.type === 'new_case' || data.type === 'discharge_eligible' ||
            data.type === 'sam_transition' || data.type === 'visit_overdue'
          )) {
            router.push({ pathname: '/case/[id]', params: { id: String(caseId) } });
          } else if (ipcCaseId) {
            router.push({ pathname: '/case/ipc-detail', params: { id: String(ipcCaseId) } });
          } else if (
            data?.type === 'stock_critical' || data?.type === 'stock_low' ||
            data?.type === 'reorder_recommended'
          ) {
            router.push('/admin/inventory-reports');
          }
          Notifications.setBadgeCountAsync(0).catch(() => {});
        };
        responseListener.current = Notifications.addNotificationResponseReceivedListener(routeResponse);
        Notifications.getLastNotificationResponseAsync().then(routeResponse).catch(() => {});
      });
    }

    return () => {
      if (responseListener.current) responseListener.current.remove();
      if (appStateSub) appStateSub.remove();
    };
  }, []);

  // Push registration must wait for restored/login auth; otherwise the first POST is
  // rejected with 401 and the device never receives remote notifications.
  useEffect(() => {
    if (isExpoGo || !isAuthenticated || !token) return;
    let active = true;

    const syncNotifications = async (force = false) => {
      if (!active || (!force && Date.now() - lastPushSync.current < 10 * 60 * 1000)) return;
      try {
        const { syncPushToken } = await import('../lib/notifications');
        if (await syncPushToken()) lastPushSync.current = Date.now();
      } catch (error) {
        logger.warn('Push notification registration failed', error);
      }
    };

    syncNotifications(true);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNotifications();
    });
    return () => {
      active = false;
      appStateSub.remove();
    };
  }, [isAuthenticated, token]);

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
          <Stack.Screen name="case/ipc-list" options={{ title: 'IPC Cases', headerShown: false }} />
          <Stack.Screen name="case/ipc-detail" options={{ title: 'IPC Case Detail', headerShown: false }} />
          <Stack.Screen name="case/ipc-register" options={{ title: 'IPC Registration', headerShown: false }} />
          <Stack.Screen name="case/case-tasks" options={{ title: 'Case Tasks', headerShown: false }} />
          <Stack.Screen name="visit/[caseId]" options={{ title: 'Record Visit', headerShown: false }} />
          <Stack.Screen name="visit/edit/[id]" options={{ title: 'Edit Visit', headerShown: false }} />
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
          <Stack.Screen name="reports/case-linelist" options={{ title: 'Case Line List', headerShown: false }} />
          <Stack.Screen name="reports/analytics" options={{ title: 'Analytics', headerShown: false }} />
        </Stack>
      </View>
    </ErrorBoundary>
  );
}
