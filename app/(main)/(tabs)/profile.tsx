import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform, Switch, Linking,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { authApi, quotesApi, invoicesApi, reservationsApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";
import { useCustomAlert } from "@/components/CustomAlert";

const WEB_PORTAL_URL = "https://saas2.mytoolsgroup.eu";
const SECURITY_MESSAGE = "Pour des raisons de sécurité, cette action est disponible uniquement depuis votre espace client sécurisé accessible via notre site internet.";

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function setStoredValue(key: string, value: string) {
  if (Platform.OS === "web") await AsyncStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [activeSection, setActiveSection] = useState<"info" | "security" | "notifications">("info");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState("");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(true);

  const isPro = user?.role === "client_professionnel";
  const roleName = isPro ? "Professionnel" : "Particulier";

  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: quotesApi.getAll });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.getAll });
  const { data: reservations = [] } = useQuery({ queryKey: ["reservations"], queryFn: reservationsApi.getAll });

  const quotesArr = Array.isArray(quotes) ? quotes : [];
  const invoicesArr = Array.isArray(invoices) ? invoices : [];
  const reservationsArr = Array.isArray(reservations) ? reservations : [];

  const totalQuotes = quotesArr.length;
  const acceptedQuotes = quotesArr.filter((q: any) => {
    const s = (q.status || "").toLowerCase();
    return s === "accepted" || s === "accepté" || s === "accepte" || s === "approved" || s === "approuvé";
  }).length;
  const totalInvoices = invoicesArr.length;
  const paidInvoices = invoicesArr.filter((inv: any) => ["paid", "payée", "payé"].includes((inv.status || "").toLowerCase())).length;
  const totalReservations = reservationsArr.length;
  const confirmedReservations = reservationsArr.filter((r: any) => {
    const s = (r.status || "").toLowerCase();
    return s === "confirmed" || s === "confirmée" || s === "confirmé" || s === "completed" || s === "terminé";
  }).length;

  const allItems = [
    ...quotesArr.map((q: any) => q.createdAt),
    ...invoicesArr.map((inv: any) => inv.createdAt),
    ...reservationsArr.map((r: any) => r.createdAt),
  ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const lastActivity = allItems[0]
    ? new Date(allItems[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  useEffect(() => { checkBiometrics(); loadNotificationPreferences(); }, []);

  const checkBiometrics = async () => {
    if (Platform.OS === "web") return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setBiometricType("Face ID");
        else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setBiometricType("Empreinte digitale");
        else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) setBiometricType("Iris");
      }
      const stored = await getStoredValue("biometric_enabled");
      setBiometricEnabled(stored === "true");
    } catch {}
  };

  const loadNotificationPreferences = async () => {
    try {
      const prefs = await authApi.getNotificationPreferences();
      if (prefs && typeof prefs.push === "boolean") { setPushEnabled(prefs.push); setEmailNotifEnabled(prefs.email); }
    } catch {
      const stored = await getStoredValue("notif_push");
      if (stored !== null) setPushEnabled(stored === "true");
      const storedEmail = await getStoredValue("notif_email");
      if (storedEmail !== null) setEmailNotifEnabled(storedEmail === "true");
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Activez l'authentification biométrique", cancelLabel: "Annuler", disableDeviceFallback: false });
      if (result.success) {
        setBiometricEnabled(true);
        await setStoredValue("biometric_enabled", "true");
        showAlert({ type: "success", title: "Activé", message: `${biometricType || "Biométrie"} activé(e) pour la connexion.`, buttons: [{ text: "OK", style: "primary" }] });
      }
    } else {
      setBiometricEnabled(false);
      await setStoredValue("biometric_enabled", "false");
    }
  };

  const updateNotifPref = async (key: "push" | "email", value: boolean) => {
    const prev = { push: pushEnabled, email: emailNotifEnabled };
    if (key === "push") setPushEnabled(value);
    if (key === "email") setEmailNotifEnabled(value);
    await setStoredValue(`notif_${key}`, value ? "true" : "false");
    try { await authApi.updateNotificationPreferences({ ...prev, [key]: value }); } catch {}
  };

  const handleLogout = () => {
    showAlert({
      type: "warning",
      title: "Déconnexion",
      message: "Voulez-vous vous déconnecter ?",
      buttons: [
        { text: "Annuler" },
        { text: "Déconnexion", style: "primary", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
      ],
    });
  };

  const renderField = (label: string, value: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Ionicons name={icon} size={18} color={theme.textSecondary} />
        <Text style={[styles.fieldValue, !value && styles.fieldValueEmpty]}>{value || "Non renseigné"}</Text>
      </View>
    </View>
  );

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  const TabButton = ({ id, label, icon }: { id: "info" | "security" | "notifications"; label: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <Pressable style={[styles.tabBtn, activeSection === id && styles.tabBtnActive]} onPress={() => setActiveSection(id)}>
      <Ionicons name={icon} size={18} color={activeSection === id ? theme.primary : theme.textSecondary} />
      <Text style={[styles.tabBtnText, activeSection === id && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
          paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100,
        }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Mon Profil</Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>
            {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{roleName}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton id="info" label="Infos" icon="person-outline" />
          <TabButton id="security" label="Sécurité" icon="shield-checkmark-outline" />
          <TabButton id="notifications" label="Notifs" icon="notifications-outline" />
        </View>

        {activeSection === "info" && (
          <>
            <View style={styles.statsCard}>
              <Text style={styles.statsSectionTitle}>Mon activité</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalQuotes}</Text>
                  <Text style={styles.statLabel}>Devis</Text>
                  {acceptedQuotes > 0 && <Text style={styles.statSub}>{acceptedQuotes} acceptés</Text>}
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalInvoices}</Text>
                  <Text style={styles.statLabel}>Factures</Text>
                  {paidInvoices > 0 && <Text style={styles.statSub}>{paidInvoices} payées</Text>}
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalReservations}</Text>
                  <Text style={styles.statLabel}>RDV</Text>
                  {confirmedReservations > 0 && <Text style={styles.statSub}>{confirmedReservations} confirmés</Text>}
                </View>
              </View>
              {lastActivity && <Text style={styles.statsLastActivity}>Dernière activité : {lastActivity}</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations personnelles</Text>
              {renderField("Email", user?.email || "", "mail-outline")}
              {renderField("Prénom", user?.firstName || "", "person-outline")}
              {renderField("Nom", user?.lastName || "", "person-outline")}
              {renderField("Téléphone", user?.phone || "", "call-outline")}
              {renderField("Adresse", user?.address || "", "location-outline")}
              {renderField("Code postal", user?.postalCode || "", "navigate-outline")}
              {renderField("Ville", user?.city || "", "business-outline")}
            </View>

            {isPro && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Informations société</Text>
                {renderField("Nom entreprise", user?.companyName || "", "business-outline")}
                {renderField("SIRET", user?.siret || "", "document-text-outline")}
                {renderField("N° TVA", user?.tvaNumber || "", "receipt-outline")}
                {renderField("Adresse société", user?.companyAddress || "", "location-outline")}
                {renderField("CP société", user?.companyPostalCode || "", "navigate-outline")}
                {renderField("Ville société", user?.companyCity || "", "business-outline")}
                {renderField("Pays société", user?.companyCountry || "", "globe-outline")}
              </View>
            )}

            <View style={styles.webPortalCard}>
              <View style={styles.webPortalIconContainer}>
                <Ionicons name="information-circle" size={24} color={theme.primary} />
              </View>
              <Text style={styles.webPortalMessage}>{SECURITY_MESSAGE}</Text>
              <Pressable
                style={({ pressed }) => [styles.webPortalBtn, pressed && { opacity: 0.8 }]}
                onPress={() => Linking.openURL(WEB_PORTAL_URL)}
              >
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.webPortalBtnText}>Accéder à l'espace client</Text>
              </Pressable>
            </View>
          </>
        )}

        {activeSection === "security" && (
          <>
            {Platform.OS !== "web" && biometricAvailable && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Authentification forte</Text>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIconContainer, { backgroundColor: "#3B82F620" }]}>
                      <Ionicons name="finger-print" size={22} color="#3B82F6" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingTitle}>{biometricType || "Biométrie"}</Text>
                      <Text style={styles.settingDesc}>Connexion rapide et sécurisée</Text>
                    </View>
                  </View>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={toggleBiometric}
                    trackColor={{ false: theme.surfaceSecondary, true: theme.primary + "60" }}
                    thumbColor={biometricEnabled ? theme.primary : theme.textTertiary}
                  />
                </View>
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mot de passe</Text>
              <View style={styles.webPortalCard}>
                <View style={styles.webPortalIconContainer}>
                  <Ionicons name="lock-closed" size={24} color={theme.primary} />
                </View>
                <Text style={styles.webPortalMessage}>{SECURITY_MESSAGE}</Text>
                <Pressable
                  style={({ pressed }) => [styles.webPortalBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => Linking.openURL(WEB_PORTAL_URL)}
                >
                  <Ionicons name="open-outline" size={18} color="#fff" />
                  <Text style={styles.webPortalBtnText}>Modifier sur le site</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {activeSection === "notifications" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Préférences de notification</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIconContainer, { backgroundColor: theme.primary + "20" }]}>
                  <Ionicons name="notifications" size={20} color={theme.primary} />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Notifications push</Text>
                  <Text style={styles.settingDesc}>Alertes sur votre téléphone</Text>
                </View>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={(v) => updateNotifPref("push", v)}
                trackColor={{ false: theme.surfaceSecondary, true: theme.primary + "60" }}
                thumbColor={pushEnabled ? theme.primary : theme.textTertiary}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIconContainer, { backgroundColor: "#10B98120" }]}>
                  <Ionicons name="mail" size={20} color="#10B981" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Notifications email</Text>
                  <Text style={styles.settingDesc}>Récapitulatifs et suivis par email</Text>
                </View>
              </View>
              <Switch
                value={emailNotifEnabled}
                onValueChange={(v) => updateNotifPref("email", v)}
                trackColor={{ false: theme.surfaceSecondary, true: "#10B98160" }}
                thumbColor={emailNotifEnabled ? "#10B981" : theme.textTertiary}
              />
            </View>
            <View style={styles.notifInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.notifInfoText}>
                Les notifications push requièrent l'autorisation sur votre appareil. Les emails sont envoyés pour les événements importants (devis, facture, rendez-vous).
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.push("/(main)/(tabs)/more")}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIconContainer, { backgroundColor: "#6366F120" }]}>
                <Ionicons name="settings-outline" size={20} color="#6366F1" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Paramètres</Text>
                <Text style={styles.settingDesc}>Mentions légales, support, version</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.push("/(main)/delete-account" as any)}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIconContainer, { backgroundColor: "#EF444420" }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingTitle, { color: "#EF4444" }]}>Supprimer mon compte</Text>
                <Text style={styles.settingDesc}>Suppression définitive et irréversible</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.primary} />
          <Text style={styles.logoutBtnText}>Déconnexion</Text>
        </Pressable>
      </ScrollView>
      {AlertComponent}
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { paddingHorizontal: 20 },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Michroma_400Regular",
    color: theme.text,
    letterSpacing: 1,
    marginBottom: 20,
  },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.primary,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarName: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: theme.text, marginBottom: 6 },
  roleBadge: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: theme.border,
  },
  roleText: { fontSize: 12, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  tabRow: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: theme.surfaceSecondary },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  tabBtnTextActive: { color: theme.primary, fontFamily: "Inter_600SemiBold" },
  statsCard: {
    backgroundColor: theme.card,
    borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 20,
  },
  statsSectionTitle: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12,
  },
  statsGrid: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 40, backgroundColor: theme.border },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: theme.text },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  statSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: theme.primary },
  statsLastActivity: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary,
    marginTop: 12, textAlign: "center",
  },
  section: { marginBottom: 24, gap: 8 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.text, marginBottom: 4 },
  fieldContainer: { gap: 4 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: theme.textTertiary, marginLeft: 4, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  fieldValueRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 12, height: 44,
  },
  fieldValue: { fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text },
  fieldValueEmpty: { color: theme.textTertiary },
  webPortalCard: {
    backgroundColor: theme.card, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 20, alignItems: "center", gap: 12,
  },
  webPortalIconContainer: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.primary + "15",
    justifyContent: "center", alignItems: "center",
  },
  webPortalMessage: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textSecondary,
    textAlign: "center", lineHeight: 20,
  },
  webPortalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 10, height: 44, paddingHorizontal: 20, width: "100%",
  },
  webPortalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  settingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14,
  },
  settingInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  settingIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  settingTextContainer: { flex: 1 },
  settingTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  settingDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
  notifInfoBox: {
    flexDirection: "row", backgroundColor: theme.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border, padding: 12, gap: 8,
    alignItems: "flex-start", marginTop: 4,
  },
  notifInfoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, lineHeight: 17 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.primary, marginTop: 8,
  },
  logoutBtnPressed: { backgroundColor: theme.primary + "15" },
  logoutBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.primary },
  settingsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14,
  },
});
