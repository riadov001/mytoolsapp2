import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { notificationsApi, Notification as AppNotification } from "@/lib/api";

let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
} catch {}

// Initialize notification handler if available
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowInForeground: true,
    }),
  });
}

let lastCheckedAt: string | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) return null;
  if (Platform.OS === "web") return null;

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MyTools",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#DC2626",
      sound: "default",
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.slug;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return token.data;
  } catch {
    return null;
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case "quote": return "Devis";
    case "invoice": return "Facture";
    case "reservation": return "Reservation";
    case "chat": return "Message";
    case "service": return "Service";
    default: return "MyTools";
  }
}

async function showLocalNotification(notification: AppNotification) {
  if (!Notifications) return;
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.message,
      data: {
        type: notification.type,
        relatedId: notification.relatedId,
        notificationId: notification.id,
      },
      sound: "default",
      subtitle: getNotificationIcon(notification.type),
    },
    trigger: null,
  });
}

export async function checkForNewNotifications() {
  try {
    const notifications = await notificationsApi.getAll();
    if (!Array.isArray(notifications)) return;

    const unread = notifications.filter((n) => !n.isRead);

    if (lastCheckedAt) {
      const lastDate = new Date(lastCheckedAt);
      const newNotifs = unread.filter(
        (n) => new Date(n.createdAt) > lastDate
      );

      for (const notif of newNotifs) {
        await showLocalNotification(notif);
      }
    }

    if (notifications.length > 0) {
      const newest = notifications.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b
      );
      lastCheckedAt = newest.createdAt;
    } else if (!lastCheckedAt) {
      lastCheckedAt = new Date().toISOString();
    }

    if (Notifications) {
      await Notifications.setBadgeCountAsync(unread.length);
    }
  } catch {}
}

export function startNotificationPolling(intervalMs = 30000) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  checkForNewNotifications();

  pollingInterval = setInterval(() => {
    checkForNewNotifications();
  }, intervalMs);
}

export function stopNotificationPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function addNotificationResponseListener(
  callback: (response: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}
