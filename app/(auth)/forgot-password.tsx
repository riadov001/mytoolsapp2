import React, { useState, useMemo } from "react";
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSendLink = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !validateEmail(trimmedEmail)) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(trimmedEmail);
    } catch {}
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Platform.OS === "web" ? 67 + 40 : insets.top + 40,
              paddingBottom: Platform.OS === "web" ? 34 + 20 : insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.sentContainer}>
            <View style={styles.sentIconCircle}>
              <Ionicons name="mail-unread-outline" size={40} color={theme.primary} />
            </View>

            <Text style={styles.sentTitle}>Email envoyé</Text>

            <Text style={styles.sentMessage}>
              Un lien de réinitialisation sécurisé a été envoyé à l'adresse :
            </Text>
            <Text style={styles.sentEmail}>{email.trim()}</Text>

            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Étapes à suivre :</Text>
              <View style={styles.instructionRow}>
                <View style={styles.instructionBullet}>
                  <Text style={styles.instructionNum}>1</Text>
                </View>
                <Text style={styles.instructionText}>Ouvrez l'email reçu (vérifiez aussi les spams)</Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.instructionBullet}>
                  <Text style={styles.instructionNum}>2</Text>
                </View>
                <Text style={styles.instructionText}>Cliquez sur le lien de réinitialisation dans l'email</Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.instructionBullet}>
                  <Text style={styles.instructionNum}>3</Text>
                </View>
                <Text style={styles.instructionText}>Suivez la procédure pour choisir votre nouveau mot de passe</Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.instructionBullet}>
                  <Text style={styles.instructionNum}>4</Text>
                </View>
                <Text style={styles.instructionText}>Revenez dans l'application et connectez-vous</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Retour à la connexion</Text>
            </Pressable>

            <Pressable
              style={styles.resendBtn}
              onPress={() => { setSent(false); }}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.primary} />
              <Text style={styles.resendBtnText}>Renvoyer l'email</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 20 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 34 + 20 : insets.bottom + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.iconHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-open-outline" size={32} color={theme.primary} />
          </View>
        </View>
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Saisissez votre adresse email pour recevoir un lien de réinitialisation sécurisé par email.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              testID="forgot-email-input"
            />
          </View>
        </View>

        {email.trim().length > 0 && !validateEmail(email.trim()) && (
          <Text style={styles.errorHint}>Adresse email invalide</Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && styles.actionBtnPressed,
            (!email.trim() || !validateEmail(email.trim()) || loading) && styles.actionBtnDisabled,
          ]}
          onPress={handleSendLink}
          disabled={!email.trim() || !validateEmail(email.trim()) || loading}
          testID="forgot-send-btn"
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Envoyer le lien</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.supportLink} onPress={() => router.push("/support")}>
          <Ionicons name="help-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.supportLinkText}>Besoin d'aide ? Contacter le support</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 20,
  },
  inputGroup: {
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: theme.text,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
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
    color: theme.text,
    height: "100%",
  },
  errorHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.error,
    marginLeft: 4,
    marginBottom: 8,
  },
  actionBtn: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  actionBtnPressed: {
    backgroundColor: theme.primaryDark,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 32,
    paddingVertical: 8,
  },
  supportLinkText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
  },
  sentContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 20,
  },
  sentIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 20,
  },
  sentTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 12,
    textAlign: "center",
  },
  sentMessage: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  sentEmail: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: theme.primary,
    marginBottom: 24,
    textAlign: "center",
  },
  instructionsCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    width: "100%",
    marginBottom: 28,
    gap: 12,
  },
  instructionsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
    marginBottom: 4,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  instructionBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  instructionNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  instructionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  resendBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: theme.primary,
  },
});
