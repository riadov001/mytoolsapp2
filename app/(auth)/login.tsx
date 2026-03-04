import React, { useState, useEffect } from "react";
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
import Colors from "@/constants/colors";
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
        setTimeout(() => {
          router.replace("/(main)/(tabs)" as any);
        }, 50);
      } else {
        setBiometricAvailable(false);
        showAlert({ type: "error", title: "Session expirée", message: "Votre session a expiré. Veuillez vous reconnecter avec vos identifiants. La biométrie sera de nouveau disponible après.", buttons: [{ text: "OK", style: "primary" }] });
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert({ type: 'error', title: 'Erreur', message: 'Veuillez remplir tous les champs.', buttons: [{ text: 'OK', style: 'primary' }] });
      return;
    }
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      setTimeout(() => {
        router.replace("/(main)/(tabs)" as any);
      }, 50);
    } catch (err: any) {
      showAlert({ type: 'error', title: 'Erreur de connexion', message: err.message || 'Identifiants incorrects.', buttons: [{ text: 'OK', style: 'primary' }] });
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: "#FFFFFF" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 40 : insets.top + 40,
            paddingBottom: Platform.OS === "web" ? 34 + 20 : insets.bottom + 20,
            backgroundColor: "#FFFFFF",
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
              contentFit="cover"
            />
          </View>
          <Text style={styles.subtitle}>MyTools — Built for Performance</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="votre@email.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Votre mot de passe"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>
            <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && styles.loginBtnPressed,
              loading && styles.loginBtnDisabled,
            ]}
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
            style={({ pressed }) => [styles.registerBtn, pressed && styles.registerBtnPressed]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.registerBtnText}>Créer un compte</Text>
          </Pressable>

          {biometricAvailable && (
            <Pressable
              style={({ pressed }) => [styles.biometricBtn, pressed && styles.biometricBtnPressed]}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Ionicons name="finger-print" size={22} color={Colors.primary} />
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoWrapper: {
    width: 240,
    height: 120,
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#000",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#000000",
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#000000",
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
    color: Colors.primary,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  resendBtn: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
  },
  resendBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  registerBtn: {
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  registerBtnPressed: {
    backgroundColor: Colors.surface,
  },
  registerBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 12,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  biometricBtnPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  biometricBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 24,
    opacity: 0.5,
  },
  versionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
