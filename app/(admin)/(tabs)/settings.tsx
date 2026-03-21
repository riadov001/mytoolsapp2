import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Switch, Linking } from "react-native";
import { Image } from "expo-image";
import { router, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconColor?: string;
  theme: ThemeColors;
  styles: any;
  danger?: boolean;
}

function MenuItem({ icon, title, subtitle, onPress, iconColor, theme, styles, danger }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: `${danger ? "#EF4444" : iconColor || theme.primary}20` }]}>
        <Ionicons name={icon} size={20} color={danger ? "#EF4444" : iconColor || theme.primary} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={[styles.menuTitle, danger && { color: "#EF4444" }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, logout } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [notifConsent, setNotifConsent] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("consent_notifications").then(v => {
      setNotifConsent(v === "true");
    }).catch(() => {});
  }, []);

  const toggleNotifConsent = async (val: boolean) => {
    setNotifConsent(val);
    try {
      await AsyncStorage.setItem("consent_notifications", val ? "true" : "false");
    } catch {}
  };

  const handleLogout = () => {
    showAlert({
      type: "warning",
      title: "Se déconnecter",
      message: "Êtes-vous sûr de vouloir vous déconnecter ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Déconnexion",
          style: "primary",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    });
  };

  const handleDeleteAccount = () => {
    showAlert({
      type: "warning",
      title: "Supprimer le compte",
      message: "Cette action est irréversible. Toutes vos données seront supprimées définitivement.",
      buttons: [
        { text: "Annuler" },
        { text: "Continuer", style: "primary", onPress: () => router.push("/(admin)/delete-account" as Href) },
      ],
    });
  };

  const itemProps = { theme, styles };
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 100 : insets.bottom + 100;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Image source={require("@/assets/images/logo_new.png")} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Paramètres</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={28} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {user?.firstName || user?.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Administrateur"}
            </Text>
            <Text style={styles.profileEmail}>{user?.email || ""}</Text>
            <Text style={styles.profileRole}>{(user?.role || "admin").replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.toggleRow}>
            <View style={[styles.menuIconContainer, { backgroundColor: `${theme.primary}20` }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Notifications push</Text>
              <Text style={styles.menuSubtitle}>Devis, factures et rendez-vous</Text>
            </View>
            <Switch
              value={notifConsent}
              onValueChange={toggleNotifConsent}
              trackColor={{ false: theme.border, true: theme.primary + "80" }}
              thumbColor={notifConsent ? theme.primary : "#ccc"}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          <MenuItem {...itemProps} icon="chatbubbles-outline" title="Nous contacter" subtitle="Envoyer un message à l'équipe" onPress={() => router.push("/support" as Href)} />
          <MenuItem {...itemProps} icon="time-outline" title="Historique des demandes" subtitle="Voir vos demandes support" onPress={() => router.push("/(admin)/support-history" as Href)} iconColor="#8B5CF6" />
          <MenuItem {...itemProps} icon="mail-outline" title="Email" subtitle="contact@mytoolsgroup.eu" onPress={() => Linking.openURL("mailto:contact@mytoolsgroup.eu")} iconColor="#22C55E" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Informations légales</Text>
          <MenuItem {...itemProps} icon="document-text-outline" title="Mentions légales" onPress={() => router.push("/legal" as Href)} iconColor="#818CF8" />
          <MenuItem {...itemProps} icon="shield-checkmark-outline" title="Politique de confidentialité" onPress={() => router.push("/privacy" as Href)} iconColor="#A78BFA" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Application</Text>
          <MenuItem {...itemProps} icon="book-outline" title="Guide de l'application" subtitle="Découvrir les fonctionnalités" onPress={() => router.push("/(admin)/guide" as Href)} iconColor="#F59E0B" />
          <MenuItem {...itemProps} icon="information-circle-outline" title="Version" subtitle="1.0" onPress={() => {}} iconColor={theme.textSecondary} />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <MenuItem {...itemProps} icon="trash-outline" title="Supprimer mon compte" subtitle="Suppression définitive et irréversible" onPress={handleDeleteAccount} danger />
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </Pressable>

        <View style={styles.footer}>
          <Image source={require("@/assets/images/logo_new.png")} style={styles.footerLogo} contentFit="contain" />
          <Text style={styles.footerBrand}>MYTOOLS</Text>
          <Text style={styles.footerSubtext}>Built for Performance</Text>
        </View>
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  headerLogo: { width: 36, height: 36, borderRadius: 10 },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Michroma_400Regular", color: theme.text, letterSpacing: 0.5 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1,
    borderColor: theme.border, padding: 18, marginBottom: 28,
    shadowColor: theme.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  profileAvatar: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: theme.primary + "12", justifyContent: "center", alignItems: "center",
  },
  profileName: { fontSize: 17, fontFamily: "Inter_700Bold", color: theme.text },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 3 },
  profileRole: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.primary, marginTop: 3, textTransform: "capitalize" },
  menuSection: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10, marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  menuItemPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  menuIconContainer: {
    width: 42, height: 42, borderRadius: 14,
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  menuSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#EF444408", borderRadius: 16, borderWidth: 1.5,
    borderColor: "#EF444430", height: 56, marginBottom: 28,
  },
  logoutBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#EF4444" },
  footer: { alignItems: "center", marginTop: 12, paddingVertical: 28 },
  footerLogo: { width: 80, height: 80, marginBottom: 10 },
  footerBrand: {
    fontSize: 14, fontFamily: "Michroma_400Regular", color: theme.textTertiary,
    letterSpacing: 5, marginBottom: 4,
  },
  footerSubtext: { fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textTertiary, opacity: 0.6 },
});
