import React, { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function IndexScreen() {
  const { isAuthenticated, isLoading, isAdminOrEmployee, user, logout } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading) {
      (async () => {
        const consent = await AsyncStorage.getItem("consent_given");
        if (!consent) {
          router.replace("/consent");
          return;
        }
        if (isAuthenticated) {
          if (isAdminOrEmployee) {
            router.replace("/(admin)" as any);
          }
        } else {
          router.replace("/(auth)/login");
        }
      })();
    }
  }, [isLoading, isAuthenticated, isAdminOrEmployee]);

  if (!isLoading && isAuthenticated && !isAdminOrEmployee) {
    return (
      <View style={[styles.deniedContainer, { paddingTop: Platform.OS === "web" ? 67 : insets.top, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom }]}>
        <View style={styles.deniedCard}>
          <View style={styles.shieldWrap}>
            <Ionicons name="shield-outline" size={56} color={theme.primary} />
          </View>
          <Text style={styles.deniedTitle}>Accès non autorisé</Text>
          <Text style={styles.deniedSub}>
            Cette application est réservée exclusivement aux administrateurs, super admins, administrateurs root et employés de MyTools.
          </Text>
          {user?.email && (
            <Text style={styles.deniedEmail}>{user.email}</Text>
          )}
          <Text style={styles.deniedRole}>
            Rôle détecté : {user?.role || "inconnu"}
          </Text>
          <Pressable
            style={styles.logoutBtn}
            onPress={async () => {
              await logout();
              router.replace("/(auth)/login");
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
      <ActivityIndicator size="small" color={theme.primary} style={styles.loader} />
      <Text style={styles.versionText}>v1.0</Text>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: theme.background,
  },
  logoWrapper: {
    width: 180, height: 180, marginBottom: 32,
    justifyContent: "center", alignItems: "center",
  },
  logo: { width: "100%", height: "100%" },
  loader: { marginBottom: 40 },
  versionText: {
    position: "absolute", bottom: 40,
    fontSize: 11, fontFamily: "Michroma_400Regular",
    color: theme.textTertiary, opacity: 0.5, letterSpacing: 2,
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  deniedCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    width: "100%",
    maxWidth: 360,
  },
  shieldWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${theme.primary}18`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: `${theme.primary}30`,
  },
  deniedTitle: {
    fontSize: 22,
    fontFamily: "Michroma_400Regular",
    color: theme.text,
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 1,
  },
  deniedSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  deniedEmail: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: theme.primary,
    marginBottom: 4,
  },
  deniedRole: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.textTertiary,
    marginBottom: 28,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  logoutText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
