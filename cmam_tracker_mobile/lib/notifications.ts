import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from './logger';

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
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('visit-reminders', {
      name: 'Visit Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1e3a8a',
      sound: 'default',
    });
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
  return scheduled.length;
}
