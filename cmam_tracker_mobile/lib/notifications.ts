import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from './logger';
import api, { storage } from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request push notification permissions and get the Expo push token.
 * Returns the token string or null if permissions denied / not a device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    logger.warn('Push notifications require a physical device');
    return null;
  }

  await configureNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
    });
    return tokenData.data;
  } catch (e) {
    logger.warn('Push token registration failed (expected in Expo Go)', e);
    return null;
  }
}

export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const channels = [
    ['case-updates', 'Case Updates', '#1e3a8a'],
    ['visit-reminders', 'Visit Reminders', '#2563eb'],
    ['inventory-alerts', 'Inventory Alerts', '#dc2626'],
  ] as const;
  await Promise.all(channels.map(([id, name, lightColor]) =>
    Notifications.setNotificationChannelAsync(id, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor,
      sound: 'default',
    })
  ));
}

/** Register the current device only after an authenticated session exists. */
export async function syncPushToken(): Promise<boolean> {
  const token = await registerForPushNotifications();
  if (!token) return false;
  await api.post('/v1/push-token/', { push_token: token });
  await storage.setItem('notification_push_token', token);
  return true;
}

/** Remove this device's token during sign-out without clearing another device. */
export async function unregisterPushToken(): Promise<void> {
  const token = await storage.getItem('notification_push_token');
  if (token) {
    await api.delete('/v1/push-token/', { data: { push_token: token } });
    await storage.deleteItem('notification_push_token');
  }
}

export async function getNotificationPermissionStatus(): Promise<string> {
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.status;
}

/**
 * Schedule a local notification for a visit reminder.
 * @param caseId    - ID of the case
 * @param childName - Name of the child
 * @param visitDate - Date of the scheduled visit (Date object)
 * @param facilityName - Name of the facility
 */
export async function scheduleVisitReminder(
  caseId: number,
  childName: string,
  visitDate: Date,
  facilityName?: string,
): Promise<string | null> {
  // Schedule reminder for 8 AM on the day before the visit
  const reminderDate = new Date(visitDate);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(8, 0, 0, 0);

  // Don't schedule if the reminder time is in the past
  if (reminderDate.getTime() <= Date.now()) {
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Visit Reminder',
      body: `${childName} has a scheduled visit tomorrow${facilityName ? ` at ${facilityName}` : ''}.`,
      data: { caseId, type: 'visit_reminder' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'visit-reminders' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });

  return id;
}

/**
 * Schedule a same-day morning reminder for a visit.
 */
export async function scheduleSameDayReminder(
  caseId: number,
  childName: string,
  visitDate: Date,
): Promise<string | null> {
  const morningOf = new Date(visitDate);
  morningOf.setHours(7, 0, 0, 0);

  if (morningOf.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Visit Today',
      body: `${childName} has a visit scheduled today. Don't forget to record the visit.`,
      data: { caseId, type: 'visit_today' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'visit-reminders' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: morningOf,
    },
  });

  return id;
}

export interface SchedulableVisit {
  id: number;
  child_name: string;
  facility_name?: string;
  next_due_date: string | null;
}

function localDate(value: string): Date | null {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export async function clearVisitReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ids = scheduled
    .filter(item => ['visit_reminder', 'visit_today'].includes(String(item.content.data?.type ?? '')))
    .map(item => item.identifier);
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
}

/** Replace only visit reminders, preserving every unrelated scheduled notification. */
export async function scheduleDueVisitReminders(visits: SchedulableVisit[]): Promise<number> {
  await configureNotificationChannels();
  await clearVisitReminders();
  let count = 0;
  for (const visit of visits) {
    if (!visit.next_due_date) continue;
    const dueDate = localDate(visit.next_due_date);
    if (!dueDate) continue;
    if (await scheduleVisitReminder(visit.id, visit.child_name, dueDate, visit.facility_name)) count += 1;
    if (await scheduleSameDayReminder(visit.id, visit.child_name, dueDate)) count += 1;
  }
  return count;
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get count of all pending scheduled notifications.
 */
export async function getPendingRemindersCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(item =>
    ['visit_reminder', 'visit_today'].includes(String(item.content.data?.type ?? ''))
  ).length;
}
