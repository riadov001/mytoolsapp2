import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

let LocalAuthentication: any = null;
if (Platform.OS !== "web") {
  try {
    LocalAuthentication = require("expo-local-authentication");
  } catch {}
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, biometricLogin } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("");

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    if (Platform.OS === "web" || !LocalAuthentication) return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (compatible && enrolled) {
        const SecureStore = require("expo-secure-store");
        const biometricSetting = await SecureStore.getItemAsync("biometric_enabled");
        if (biometricSetting === "true") {
          setBiometricAvailable(true);
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType("Face ID");
          } else {
            setBiometricType("Empreinte");
          }
        }
      }
    } catch {}
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const success = await biometricLogin();
      if (success) {
        setTimeout(() => router.replace("/(main)/(tabs)" as any), 50);
      } else {
        setBiometricAvailable(false);
        showAlert({ type: "error", title: "Session expirée", message: "Veuillez vous reconnecter avec vos identifiants.", buttons: [{ text: "OK", style: "primary" }] });
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez remplir tous les champs.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      setTimeout(() => router.replace("/(main)/(tabs)" as any), 50);
    } catch (err: any) {
      showAlert({ type: "error", title: "Erreur de connexion", message: err.message || "Identifiants incorrects.", buttons: [{ text: "OK", style: "primary" }] });
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 40 : insets.top + 40,
            paddingBottom: Platform.OS === "web" ? 34 + 20 : insets.bottom + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("@/assets/images/logo_rounded.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <Text style={styles.appName}>MYTOOLS</Text>
          <Text style={styles.subtitle}>Built for Performance</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="votre@email.com"
                placeholderTextColor={theme.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Votre mot de passe"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={theme.textTertiary}
                />
              </Pressable>
            </View>
            <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Se connecter</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.registerBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.registerBtnText}>Créer un compte</Text>
          </Pressable>

          {biometricAvailable && (
            <Pressable
              style={({ pressed }) => [styles.biometricBtn, pressed && { opacity: 0.8 }]}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Ionicons name="finger-print" size={22} color={theme.primary} />
              <Text style={styles.biometricBtnText}>Se connecter avec {biometricType}</Text>
            </Pressable>
          )}

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>v1.0</Text>
          </View>
        </View>
      </ScrollView>
      {AlertComponent}
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 44,
  },
  logoWrapper: {
    width: 180,
    height: 180,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 26,
    fontFamily: "Michroma_400Regular",
    color: theme.text,
    letterSpacing: 6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: theme.textTertiary,
    letterSpacing: 1,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: theme.textSecondary,
    marginLeft: 2,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: theme.text,
    height: "100%",
  },
  eyeBtn: {
    height: "100%",
    width: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 4,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: theme.primary,
  },
  loginBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: theme.textTertiary,
  },
  registerBtn: {
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.primary,
    backgroundColor: "transparent",
  },
  registerBtnText: {
    color: theme.primary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    height: 54,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  biometricBtnText: {
    color: theme.primary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 24,
    opacity: 0.4,
  },
  versionText: {
    fontSize: 11,
    fontFamily: "Michroma_400Regular",
    color: theme.textTertiary,
    letterSpacing: 2,
  },
});
