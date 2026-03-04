import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAudioPlayer } from 'expo-audio';
import { notificationsApi, Notification } from "@/lib/api";
import Colors from "@/constants/colors";
import { FloatingSupport } from "@/components/FloatingSupport";

function getTypeIcon(type: Notification["type"]): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "quote":
      return "document-text";
    case "invoice":
      return "receipt";
    case "reservation":
      return "calendar";
    case "service":
      return "construct";
    case "chat":
      return "chatbubble";
    default:
      return "notifications";
  }
}

function getTypeColor(type: Notification["type"]): string {
  switch (type) {
    case "quote":
      return "#3B82F6";
    case "invoice":
      return Colors.pending;
    case "reservation":
      return Colors.accepted;
    case "service":
      return Colors.primary;
    case "chat":
      return "#8B5CF6";
    default:
      return Colors.textSecondary;
  }
}

function getRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function navigateToDetail(type: Notification["type"], relatedId: string | null) {
  if (!relatedId) return;
  switch (type) {
    case "quote":
      router.push({ pathname: "/(main)/quote-detail", params: { id: relatedId } });
      break;
    case "invoice":
      router.push({ pathname: "/(main)/invoice-detail", params: { id: relatedId } });
      break;
    case "reservation":
      router.push({ pathname: "/(main)/reservation-detail", params: { id: relatedId } });
      break;
    case "chat":
      router.push({ pathname: "/(main)/chat-detail", params: { id: relatedId } });
      break;
  }
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  const iconName = getTypeIcon(notification.type);
  const iconColor = getTypeColor(notification.type);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !notification.isRead && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + "1A" }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {notification.title}
          </Text>
          <View style={styles.cardMeta}>
            {!notification.isRead && <View style={styles.unreadDot} />}
            <Text style={styles.cardDate}>{getRelativeDate(notification.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.cardMessage} numberOfLines={2}>
          {notification.message}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notificationsRaw = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.getAll,
    refetchInterval: 30000,
  });

  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      notificationsApi.markAllRead().then(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }).catch(() => {});
    }, [])
  );

  const playNotificationSound = useCallback(() => {
    try {
      const player = createAudioPlayer(require('@/assets/sounds/notification.mp3'));
      player.play();
    } catch (error) {
      if (__DEV__) console.log('Error playing sound:', error);
    }
  }, []);

  const notifications = Array.isArray(notificationsRaw) ? notificationsRaw : [];

  React.useEffect(() => {
    if (notifications.length > 0) {
      const latest = [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      if (lastNotificationId && latest.id !== lastNotificationId && !latest.isRead) {
        playNotificationSound();
      }
      setLastNotificationId(latest.id);
    }
  }, [notifications, lastNotificationId, playNotificationSound]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
  }, []);

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await notificationsApi.markRead(notification.id);
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {}
    }
    navigateToDetail(notification.type, notification.relatedId);
  }, []);

  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerContainer,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread && (
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            onPress={handleMarkAllRead}
          >
            <Ionicons name="checkmark-done-outline" size={24} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={sortedNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={() => handleNotificationPress(item)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>
                Vous n'avez aucune notification pour le moment.
              </Text>
            </View>
          }
        />
      )}
      <FloatingSupport />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    alignItems: "flex-start",
  },
  cardUnread: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.borderLight,
  },
  cardPressed: {
    opacity: 0.8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  cardMessage: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
