import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const API_BASE = "https://saas3.mytoolsgroup.eu";

export default function ApplyConsentScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedData, setAcceptedData] = useState(false);

  const allAccepted = acceptedTerms && acceptedPrivacy && acceptedData;

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/mobile/client-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          clientId: user?.id,
          consents: { terms: acceptedTerms, privacy: acceptedPrivacy, dataProcessing: acceptedData },
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Application failed");
      const data = await res.json();
      return data;
    },
    onSuccess: async () => {
      await AsyncStorage.setItem("client_application_sent", "true");
      await AsyncStorage.setItem("client_application_date", new Date().toISOString());
      showAlert({
        type: "success",
        title: "Application envoyée",
        message: "Votre candidature a été envoyée avec succès. Vous recevrez une réponse dans les prochains jours.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible d'envoyer votre candidature. Veuillez réessayer.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    },
  });

  const CheckRow = ({
    checked, onToggle, label, sub,
  }: { checked: boolean; onToggle: () => void; label: string; sub: string }) => (
    <Pressable style={styles.checkRow} onPress={onToggle}>
      <View style={[styles.checkbox, checked && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <View style={styles.checkText}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkSub}>{sub}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === "web" ? 34 + 80 : insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        <Text style={styles.title}>Demande d'adhésion</Text>
        <Text style={styles.subtitle}>
          Complétez votre profil et acceptez nos conditions pour finaliser votre inscription.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={22} color={theme.primary} />
            <Text style={styles.cardTitle}>Vos informations</Text>
          </View>
          <Text style={styles.cardText}>
            {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || "Non renseigné"}
          </Text>
          <Text style={styles.cardSub}>Email: {user?.email || "Non renseigné"}</Text>
          {user?.phone && <Text style={styles.cardSub}>Téléphone: {user.phone}</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={22} color="#3B82F6" />
            <Text style={styles.cardTitle}>Conditions d'adhésion</Text>
          </View>
          <Text style={styles.cardText}>
            Vous devez accepter nos conditions d'utilisation et notre politique de confidentialité pour rejoindre notre communauté.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Consentements obligatoires</Text>
          <View style={styles.checkGroup}>
            <CheckRow
              checked={acceptedTerms}
              onToggle={() => setAcceptedTerms(v => !v)}
              label="Conditions d'utilisation"
              sub="J'accepte les conditions d'utilisation et les règles de la communauté"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedPrivacy}
              onToggle={() => setAcceptedPrivacy(v => !v)}
              label="Politique de confidentialité"
              sub="J'accepte la politique de confidentialité et le traitement de mes données"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedData}
              onToggle={() => setAcceptedData(v => !v)}
              label="Traitement des données"
              sub="J'accepte que mes données soient traitées pour gérer ma candidature"
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
          <Text style={styles.infoText}>
            Après l'envoi de votre candidature, notre équipe l'examinera et vous contactera dans les prochains jours.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 + 16 : insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.applyBtn,
            !allAccepted && styles.applyBtnDisabled,
            pressed && allAccepted && { opacity: 0.85 },
          ]}
          onPress={() => applyMutation.mutate()}
          disabled={!allAccepted || applyMutation.isPending}
        >
          {applyMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.applyBtnText}>Envoyer ma candidature</Text>
            </>
          )}
        </Pressable>
        {!allAccepted && (
          <Text style={styles.footerHint}>Veuillez cocher les 3 cases obligatoires pour continuer</Text>
        )}
      </View>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  backBtn: { marginBottom: 16 },
  logoContainer: { alignItems: "center", marginBottom: 20 },
  logo: { width: 80, height: 80, borderRadius: 16 },
  title: {
    fontSize: 26, fontFamily: "Michroma_400Regular",
    color: theme.text, textAlign: "center", marginBottom: 8, letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: theme.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24,
  },
  card: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 12, gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  cardText: { fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textSecondary, lineHeight: 20 },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },
  checkGroup: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, overflow: "hidden",
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.border,
    justifyContent: "center", alignItems: "center", marginTop: 1,
    backgroundColor: theme.surface,
  },
  checkText: { flex: 1 },
  checkLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.text, marginBottom: 3 },
  checkSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, lineHeight: 18 },
  divider: { height: 1, backgroundColor: theme.border, marginLeft: 14 },
  infoBox: {
    flexDirection: "row", gap: 12, backgroundColor: theme.primary + "10",
    borderRadius: 12, borderWidth: 1, borderColor: theme.primary + "30",
    padding: 14, alignItems: "flex-start",
  },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", color: theme.text, flex: 1, lineHeight: 19 },
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
    backgroundColor: theme.background, gap: 8,
  },
  applyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 14, height: 52,
  },
  applyBtnDisabled: { backgroundColor: theme.border },
  applyBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  footerHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary, textAlign: "center" },
});
