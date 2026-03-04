import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/(main)" as any);
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image
          source={require("@/assets/images/logo_rounded.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
      <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
      <Text style={styles.versionText}>v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  logoWrapper: {
    width: 240,
    height: 240,
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  loader: {
    marginBottom: 40,
  },
  versionText: {
    position: "absolute",
    bottom: 40,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    opacity: 0.6,
  },
});