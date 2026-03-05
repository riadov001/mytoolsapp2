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

  useEffect(() => { checkBiometricAvailability(); }, []);

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
          setBiometricType(
            types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
              ? "Face ID" : "Empreinte"
          );
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
    } catch { setLoading(false); }
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 32 : insets.top + 32,
            paddingBottom: Platform.OS === "web" ? 34 + 24 : insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo section with glow */}
        <View style={styles.header}>
          <View style={styles.logoGlowWrap}>
            <View style={styles.glowRingOuter} />
            <View style={styles.glowRingInner} />
            <Image
              source={require("@/assets/images/logo_rounded.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          <View style={styles.brandRow}>
            <View style={styles.redLine} />
            <Text style={styles.appName}>MYTOOLS</Text>
            <View style={styles.redLine} />
          </View>
          <Text style={styles.subtitle}>BUILT FOR PERFORMANCE</Text>
        </View>

        {/* Form */}
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
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textTertiary} />
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Se connecter</Text>}
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
  flex: { flex: 1, backgroundColor: theme.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoGlowWrap: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  glowRingOuter: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(220,38,38,0.07)",
  },
  glowRingInner: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(220,38,38,0.06)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.15)",
  },
  logo: {
    width: 160,
    height: 160,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  redLine: {
    width: 28,
    height: 1.5,
    backgroundColor: theme.primary,
    opacity: 0.7,
  },
  appName: {
    fontSize: 24,
    fontFamily: "Michroma_400Regular",
    color: theme.text,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "Michroma_400Regular",
    color: theme.textTertiary,
    letterSpacing: 3,
  },
  form: { gap: 14 },
  inputGroup: { gap: 7 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: theme.textSecondary,
    marginLeft: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
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
  inputIcon: { marginRight: 10 },
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
    fontSize: 15,
    fontFamily: "Michroma_400Regular",
    letterSpacing: 2,
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
    fontSize: 12,
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
    fontSize: 15,
    fontFamily: "Michroma_400Regular",
    letterSpacing: 1,
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    height: 52,
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
    opacity: 0.35,
  },
  versionText: {
    fontSize: 10,
    fontFamily: "Michroma_400Regular",
    color: theme.textTertiary,
    letterSpacing: 3,
  },
});
