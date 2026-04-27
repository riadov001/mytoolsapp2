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
import { SocialLoginButtons } from "@/components/SocialLoginButtons";

let LocalAuthentication: any = null;
if (Platform.OS !== "web") {
  try {
    LocalAuthentication = require("expo-local-authentication");
  } catch {}
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, logout, biometricLogin, socialLogin, appleLogin } = useAuth();
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

  const ADMIN_ROLES = ["admin", "super_admin", "superadmin", "root_admin", "root"];
  const EMPLOYEE_ROLES = ["employe", "employee", "manager"];

  const isAuthorizedUser = (userData: any) => {
    const role = (userData?.role || "").toLowerCase();
    return (
      ADMIN_ROLES.includes(role) ||
      EMPLOYEE_ROLES.includes(role) ||
      userData?.isAdmin === true ||
      userData?.is_admin === true ||
      userData?.isEmployee === true ||
      userData?.is_employee === true
    );
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const success = await biometricLogin();
      if (success) {
        setLoading(false);
        setTimeout(() => router.replace("/(admin)" as any), 100);
      } else {
        setBiometricAvailable(false);
        showAlert({ type: "error", title: "Session expirée", message: "Veuillez vous reconnecter avec vos identifiants.", buttons: [{ text: "OK", style: "primary" }] });
        setLoading(false);
      }
    } catch { setLoading(false); }
  };

  const handleSocialLogin = async (idToken: string, provider: string) => {
    setLoading(true);
    try {
      const result = await socialLogin(idToken, provider);

      if (result.status === "needs_registration") {
        setLoading(false);
        setTimeout(() => {
          router.push({
            pathname: "/(auth)/register" as any,
            params: {
              email: result.email || "",
              displayName: result.displayName || "",
              firebaseUid: result.firebaseUid || "",
              idToken: idToken,
            },
          });
        }, 100);
        return;
      }

      const u = result.user;
      const role = ((u as any)?.role || "").toLowerCase();
      const isAdminOrEmp =
        ["admin", "super_admin", "superadmin", "root_admin", "root"].includes(role) ||
        (u as any)?.isAdmin === true || (u as any)?.is_admin === true ||
        ["employe", "employee", "manager"].includes(role) ||
        (u as any)?.isEmployee === true || (u as any)?.is_employee === true;
      setTimeout(() => {
        router.replace(isAdminOrEmp ? "/(admin)" as any : "/(main)" as any);
      }, 100);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur de connexion",
        message: err.message || "Authentification sociale échouée.",
        buttons: [{ text: "OK", style: "primary" }],
      });
      setLoading(false);
    }
  };

  const handleAppleDirectLogin = async (idToken: string, rawNonce: string) => {
    setLoading(true);
    try {
      const result = await appleLogin(idToken, rawNonce);

      if (result.status === "needs_registration") {
        setLoading(false);
        setTimeout(() => {
          router.push({
            pathname: "/(auth)/register" as any,
            params: {
              email: result.email || "",
              displayName: result.displayName || "",
              firebaseUid: result.firebaseUid || "",
              idToken,
            },
          });
        }, 100);
        return;
      }

      const u = result.user;
      const role = ((u as any)?.role || "").toLowerCase();
      const isAdminOrEmp =
        ["admin", "super_admin", "superadmin", "root_admin", "root"].includes(role) ||
        (u as any)?.isAdmin === true || (u as any)?.is_admin === true ||
        ["employe", "employee", "manager"].includes(role) ||
        (u as any)?.isEmployee === true || (u as any)?.is_employee === true;
      setTimeout(() => {
        router.replace(isAdminOrEmp ? "/(admin)" as any : "/(main)" as any);
      }, 100);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur de connexion",
        message: err.message || "Authentification Apple échouée.",
        buttons: [{ text: "OK", style: "primary" }],
      });
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
      const userData = await login({ email: email.trim().toLowerCase(), password });
      if (!isAuthorizedUser(userData)) {
        await logout();
        showAlert({
          type: "error",
          title: "Accès refusé",
          message: "Cette application est réservée aux administrateurs et employés de garage. Contactez le service client pour obtenir un accès.",
          buttons: [{ text: "OK", style: "primary" }],
        });
        setLoading(false);
        return;
      }
      setTimeout(() => router.replace("/(admin)" as any), 100);
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
              source={require("@/assets/images/logo_new.png")}
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

          <SocialLoginButtons
            onIdToken={handleSocialLogin}
            onAppleAuth={handleAppleDirectLogin}
            onError={(msg) =>
              showAlert({
                type: "error",
                title: "Erreur",
                message: msg,
                buttons: [{ text: "OK", style: "primary" }],
              })
            }
          />

          <View style={styles.accessInfoBox}>
            <Ionicons name="lock-closed-outline" size={14} color="#666" />
            <Text style={styles.accessInfoText}>
              Cette application est réservée aux administrateurs de garage partenaires MyTools.
            </Text>
          </View>

          <Pressable
            style={styles.registerLink}
            onPress={() => router.push("/(auth)/register" as any)}
          >
            <Text style={styles.registerLinkText}>Vous êtes un nouveau garage ?{" "}
              <Text style={{ color: theme.primary, fontWeight: "600" }}>S'inscrire</Text>
            </Text>
          </Pressable>

          <View style={styles.legalRow}>
            <Pressable onPress={() => router.push("/privacy" as any)}>
              <Text style={styles.legalLink}>Politique de confidentialité</Text>
            </Pressable>
            <Text style={styles.legalSep}>·</Text>
            <Pressable onPress={() => router.push("/legal" as any)}>
              <Text style={styles.legalLink}>Mentions légales</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/support" as any)} style={styles.supportLink}>
            <Ionicons name="help-circle-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.supportLinkText}>Besoin d'aide ? Contacter le support</Text>
          </Pressable>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>v2.0.5</Text>
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
  accessInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    marginTop: 8,
  },
  accessInfoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#666",
    lineHeight: 17,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    opacity: 0.5,
  },
  legalLink: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    textDecorationLine: "underline",
  },
  legalSep: {
    fontSize: 11,
    color: theme.textTertiary,
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
  registerLink: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  registerLinkText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    opacity: 0.5,
  },
  supportLinkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    textDecorationLine: "underline",
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
