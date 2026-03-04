import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { FloatingSupport } from "@/components/FloatingSupport";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconColor?: string;
}

function MenuItem({ icon, title, subtitle, onPress, iconColor }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, iconColor ? { backgroundColor: `${iconColor}20` } : {}]}>
        <Ionicons name={icon} size={20} color={iconColor || Colors.primary} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();

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
          <MenuItem
            icon="list-outline"
            title="Historique complet"
            subtitle="Devis, factures et réservations"
            onPress={() => router.push("/(main)/history")}
            iconColor="#2563EB"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          <MenuItem
            icon="chatbubbles-outline"
            title="Nous contacter"
            subtitle="Envoyer un message à l'équipe"
            onPress={() => router.push("/support")}
          />
          <MenuItem
            icon="time-outline"
            title="Historique des demandes"
            subtitle="Voir toutes vos demandes support"
            onPress={() => router.push("/(main)/support-history")}
            iconColor="#8B5CF6"
          />
          <MenuItem
            icon="mail-outline"
            title="Email"
            subtitle="contact@mytoolsgroup.eu"
            onPress={() => Linking.openURL("mailto:contact@mytoolsgroup.eu")}
            iconColor="#22C55E"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Informations légales</Text>
          <MenuItem
            icon="document-text-outline"
            title="Mentions légales"
            onPress={() => router.push("/legal")}
            iconColor="#818CF8"
          />
          <MenuItem
            icon="shield-checkmark-outline"
            title="Politique de confidentialité"
            onPress={() => router.push("/privacy")}
            iconColor="#A78BFA"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Application</Text>
          <MenuItem
            icon="book-outline"
            title="Guide de l'application"
            subtitle="Découvrir les fonctionnalités"
            onPress={() => router.push("/onboarding")}
            iconColor="#F59E0B"
          />
          <MenuItem
            icon="information-circle-outline"
            title="Version"
            subtitle="1.0"
            onPress={() => {}}
            iconColor={Colors.textSecondary}
          />
        </View>

        <View style={styles.footer}>
          <Image
            source={require("@/assets/images/logo_rounded.png")}
            style={styles.footerLogo}
            contentFit="contain"
          />
          <Text style={styles.footerSubtext}>MyTools — Built for Performance</Text>
        </View>
      </ScrollView>
      <FloatingSupport />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 20,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 20,
  },
  footerLogo: {
    width: 120,
    height: 120,
    marginBottom: 6,
  },
  footerSubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
