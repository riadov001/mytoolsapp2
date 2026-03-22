import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useTheme } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

export interface SocialLoginButtonsProps {
  onIdToken: (idToken: string, provider: string) => Promise<void>;
  onError: (message: string) => void;
}

let AppleAuthentication: any = null;
if (Platform.OS === "ios") {
  try {
    AppleAuthentication = require("expo-apple-authentication");
  } catch {}
}

// ── Inner component: hooks only run when Firebase IS configured ──────────────
function SocialLoginButtonsInner({ onIdToken, onError }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // Lazy-load expo-auth-session providers so hooks are always called in the
  // same order, but only when this component (inner) is actually mounted.
  const Google = require("expo-auth-session/providers/google");
  const Facebook = require("expo-auth-session/providers/facebook");

  const redirectUri = makeRedirectUri({ scheme: "mytools", path: "auth/callback" });

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "placeholder",
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "placeholder",
    redirectUri,
  });

  const [, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "placeholder",
    redirectUri,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      handleGoogleResponse(
        googleResponse.authentication?.idToken ?? null,
        googleResponse.authentication?.accessToken ?? null
      );
    } else if (googleResponse?.type === "error" || googleResponse?.type === "dismiss") {
      setLoading(null);
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === "success") {
      handleFacebookResponse(fbResponse.authentication?.accessToken ?? null);
    } else if (fbResponse?.type === "error" || fbResponse?.type === "dismiss") {
      setLoading(null);
    }
  }, [fbResponse]);

  const handleGoogleResponse = async (googleIdToken?: string | null, accessToken?: string | null) => {
    if (!googleIdToken && !accessToken) { setLoading(null); return; }
    try {
      const { getFirebaseAuth } = require("@/lib/firebase");
      const { signInWithCredential, GoogleAuthProvider } = await import("firebase/auth");
      const fbAuth = getFirebaseAuth();
      if (!fbAuth) throw new Error("Firebase non configuré");
      const credential = GoogleAuthProvider.credential(googleIdToken, accessToken);
      const result = await signInWithCredential(fbAuth, credential);
      await onIdToken(await result.user.getIdToken(), "google");
    } catch (err: any) {
      onError(err?.message || "Erreur Google Sign-In");
    } finally {
      setLoading(null);
    }
  };

  const handleFacebookResponse = async (fbAccessToken?: string | null) => {
    if (!fbAccessToken) { setLoading(null); return; }
    try {
      const { getFirebaseAuth } = require("@/lib/firebase");
      const { signInWithCredential, FacebookAuthProvider } = await import("firebase/auth");
      const fbAuth = getFirebaseAuth();
      if (!fbAuth) throw new Error("Firebase non configuré");
      const credential = FacebookAuthProvider.credential(fbAccessToken);
      const result = await signInWithCredential(fbAuth, credential);
      await onIdToken(await result.user.getIdToken(), "facebook");
    } catch (err: any) {
      onError(err?.message || "Erreur Facebook Sign-In");
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      onError("Google Sign-In non configuré (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID manquant).");
      return;
    }
    setLoading("google");
    try { await googlePromptAsync(); } catch (err: any) {
      onError(err?.message || "Erreur Google");
      setLoading(null);
    }
  };

  const handleApple = async () => {
    if (!AppleAuthentication) {
      onError("Apple Sign-In n'est disponible que sur iOS.");
      return;
    }
    setLoading("apple");
    try {
      const { getFirebaseAuth } = require("@/lib/firebase");
      const { signInWithCredential, OAuthProvider } = await import("firebase/auth");
      const fbAuth = getFirebaseAuth();
      if (!fbAuth) throw new Error("Firebase non configuré");

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!appleCredential.identityToken) throw new Error("Aucun token Apple reçu");

      const provider = new OAuthProvider("apple.com");
      const firebaseCredential = provider.credential({ idToken: appleCredential.identityToken });
      const result = await signInWithCredential(fbAuth, firebaseCredential);
      await onIdToken(await result.user.getIdToken(), "apple");
    } catch (err: any) {
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        onError(err?.message || "Erreur Apple Sign-In");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleFacebook = async () => {
    if (!process.env.EXPO_PUBLIC_FACEBOOK_APP_ID) {
      onError("Facebook Sign-In non configuré (EXPO_PUBLIC_FACEBOOK_APP_ID manquant).");
      return;
    }
    setLoading("facebook");
    try { await fbPromptAsync(); } catch (err: any) {
      onError(err?.message || "Erreur Facebook");
      setLoading(null);
    }
  };

  const handleTwitter = async () => {
    if (!process.env.EXPO_PUBLIC_TWITTER_CLIENT_ID) {
      onError("Twitter Sign-In non configuré (EXPO_PUBLIC_TWITTER_CLIENT_ID manquant).");
      return;
    }
    setLoading("twitter");
    try {
      const { startAsync } = await import("expo-auth-session");
      const twitterRedirect = makeRedirectUri({ scheme: "mytools", path: "auth/twitter" });
      const state = Math.random().toString(36).slice(2);
      const result = await (startAsync as any)({
        authUrl:
          `https://twitter.com/i/oauth2/authorize?response_type=code` +
          `&client_id=${process.env.EXPO_PUBLIC_TWITTER_CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(twitterRedirect)}` +
          `&scope=tweet.read%20users.read%20offline.access` +
          `&state=${state}&code_challenge=challenge&code_challenge_method=plain`,
      });
      if (result?.type === "success" && result.params?.code) {
        await onIdToken(result.params.code, "twitter");
      }
    } catch (err: any) {
      onError(err?.message || "Erreur Twitter Sign-In");
    } finally {
      setLoading(null);
    }
  };

  const buttons = [
    { key: "google", label: "Google", icon: "logo-google" as const, color: "#4285F4", onPress: handleGoogle },
    ...(Platform.OS === "ios"
      ? [{ key: "apple", label: "Apple", icon: "logo-apple" as const, color: "#fff", onPress: handleApple }]
      : []),
    // Facebook et Twitter configurés mais masqués pour plus tard
    // { key: "facebook", label: "Facebook", icon: "logo-facebook" as const, color: "#1877F2", onPress: handleFacebook },
    // { key: "twitter", label: "Twitter / X", icon: "logo-twitter" as const, color: "#1DA1F2", onPress: handleTwitter },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou continuer avec</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.buttonsGrid}>
        {buttons.map((btn) => (
          <Pressable
            key={btn.key}
            testID={`social-btn-${btn.key}`}
            style={({ pressed }) => [
              styles.socialBtn,
              pressed && styles.socialBtnPressed,
              loading === btn.key && styles.socialBtnLoading,
            ]}
            onPress={btn.onPress}
            disabled={!!loading}
          >
            {loading === btn.key ? (
              <ActivityIndicator size="small" color={btn.color} />
            ) : (
              <Ionicons name={btn.icon} size={20} color={btn.color} />
            )}
            <Text style={[styles.socialBtnText, { color: btn.color }]}>{btn.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Outer component: guard — no hooks from providers run if not configured ──
export function SocialLoginButtons(props: SocialLoginButtonsProps) {
  // On web, env vars might not be available yet during build. Show buttons anyway.
  const isConfigured = isFirebaseConfigured();
  
  if (!isConfigured && Platform.OS !== "web") {
    return (
      <View style={styles.notConfigured}>
        <Ionicons name="information-circle-outline" size={14} color="#888" />
        <Text style={styles.notConfiguredText}>
          Connexion sociale non configurée (Firebase requis)
        </Text>
      </View>
    );
  }
  
  return <SocialLoginButtonsInner {...props} />;
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText: {
    fontSize: 11,
    color: "#666",
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  buttonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    minWidth: 130,
    flex: 1,
    justifyContent: "center",
  },
  socialBtnPressed: { opacity: 0.75, backgroundColor: "rgba(255,255,255,0.08)" },
  socialBtnLoading: { opacity: 0.6 },
  socialBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  notConfigured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    opacity: 0.5,
  },
  notConfiguredText: {
    fontSize: 11,
    color: "#888",
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
