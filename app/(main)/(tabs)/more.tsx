import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconColor?: string;
  theme: ThemeColors;
  styles: any;
}

function MenuItem({ icon, title, subtitle, onPress, iconColor, theme, styles }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: `${iconColor || theme.primary}20` }]}>
        <Ionicons name={icon} size={20} color={iconColor || theme.primary} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const itemProps = { theme, styles };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Plus</Text>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Mon activité</Text>
          <MenuItem {...itemProps} icon="list-outline" title="Historique complet" subtitle="Devis, factures et réservations" onPress={() => router.push("/(main)/history")} iconColor="#2563EB" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          <MenuItem {...itemProps} icon="chatbubbles-outline" title="Nous contacter" subtitle="Envoyer un message à l'équipe" onPress={() => router.push("/support")} />
          <MenuItem {...itemProps} icon="time-outline" title="Historique des demandes" subtitle="Voir toutes vos demandes support" onPress={() => router.push("/(main)/support-history")} iconColor="#8B5CF6" />
          <MenuItem {...itemProps} icon="mail-outline" title="Email" subtitle="contact@mytoolsgroup.eu" onPress={() => Linking.openURL("mailto:contact@mytoolsgroup.eu")} iconColor="#22C55E" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Informations légales</Text>
          <MenuItem {...itemProps} icon="document-text-outline" title="Mentions légales" onPress={() => router.push("/legal")} iconColor="#818CF8" />
          <MenuItem {...itemProps} icon="shield-checkmark-outline" title="Politique de confidentialité" onPress={() => router.push("/privacy")} iconColor="#A78BFA" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Application</Text>
          <MenuItem {...itemProps} icon="book-outline" title="Guide de l'application" subtitle="Découvrir les fonctionnalités" onPress={() => router.push("/onboarding")} iconColor="#F59E0B" />
          <MenuItem {...itemProps} icon="information-circle-outline" title="Version" subtitle="1.0" onPress={() => {}} iconColor={theme.textSecondary} />
        </View>

        <View style={styles.footer}>
          <Image source={require("@/assets/images/logo_rounded.png")} style={styles.footerLogo} contentFit="contain" />
          <Text style={styles.footerBrand}>MYTOOLS</Text>
          <Text style={styles.footerSubtext}>Built for Performance</Text>
        </View>
      </ScrollView>
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
    marginBottom: 24,
  },
  menuSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: theme.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  menuItemPressed: { backgroundColor: theme.surfaceSecondary },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  menuSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 1 },
  footer: {
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 24,
  },
  footerLogo: { width: 100, height: 100, marginBottom: 8 },
  footerBrand: {
    fontSize: 14,
    fontFamily: "Michroma_400Regular",
    color: theme.textTertiary,
    letterSpacing: 5,
    marginBottom: 4,
  },
  footerSubtext: { fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textTertiary, opacity: 0.6 },
});
