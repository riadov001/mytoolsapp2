// Load DEV_SECRETS_KEYS JSON config for development (only override if value is non-empty)
if (typeof window !== "undefined") {
  try {
    const secretsJson = process.env.DEV_SECRETS_KEYS || "{}";
    const secrets = JSON.parse(secretsJson);
    const apiKey = secrets.EXPO_PUBLIC_FIREBASE_API_KEY || secrets.GOOGLE_API_KEY_2;
    const appId = secrets.EXPO_PUBLIC_FIREBASE_APP_ID;
    const clientId = secrets.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (apiKey) process.env.EXPO_PUBLIC_FIREBASE_API_KEY = apiKey;
    if (appId) process.env.EXPO_PUBLIC_FIREBASE_APP_ID = appId;
    if (clientId) process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = clientId;
  } catch {
    // Ignore parse errors — EXPO_PUBLIC_ vars already set via Replit secrets
  }
}

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

// Suppress uncaught font-loading timeout errors (FontFaceObserver)
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || "";
    if (msg.includes("timeout exceeded") || msg.includes("FontFace") || msg.includes("font")) {
      event.preventDefault();
    }
  });
}

function RootLayoutNav() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.headerBg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: theme.fontSemiBold, color: theme.text },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="legal" options={{ presentation: "modal", headerShown: true, title: "Mentions Légales" }} />
      <Stack.Screen name="privacy" options={{ presentation: "modal", headerShown: true, title: "Politique de Confidentialité" }} />
      <Stack.Screen name="onboarding" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="support" options={{ presentation: "formSheet", sheetAllowedDetents: [0.75], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="consent" options={{ headerShown: false, animation: "fade", gestureEnabled: false }} />
    </Stack>
  );
}

function SplashView() {
  const theme = useTheme();
  return (
    <View style={[styles.splashContainer, { backgroundColor: theme.background }]}>
      <View style={styles.logoWrapper}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.splashLogo}
          contentFit="contain"
        />
      </View>
      <View style={styles.versionBottom}>
        <Text style={[styles.versionTextSplash, { color: theme.textTertiary, fontFamily: theme.fontTitle }]}>
          v1.0
        </Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Michroma_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      const timer = setTimeout(() => {
        setAppReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, fontError]);

  // Safety fallback: if fonts take more than 8s (e.g. network timeout), proceed anyway
  useEffect(() => {
    const fallback = setTimeout(() => {
      setAppReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 8000);
    return () => clearTimeout(fallback);
  }, []);

  if (!fontsLoaded && !fontError && !appReady) return null;

  if (!appReady) {
    return (
      <ThemeProvider>
        <SplashView />
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrapper: {
    width: 240,
    height: 240,
    justifyContent: "center",
    alignItems: "center",
  },
  splashLogo: {
    width: "100%",
    height: "100%",
  },
  versionBottom: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
  },
  versionTextSplash: {
    fontSize: 12,
    opacity: 0.5,
    letterSpacing: 2,
  },
});
