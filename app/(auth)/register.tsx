import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const topPad = Platform.OS === "web" ? 67 + 20 : insets.top + 20;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Informations légales</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.accessCard}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="shield-checkmark-outline" size={32} color={theme.primary} />
          </View>
          <Text style={styles.accessTitle}>Application réservée</Text>
          <Text style={styles.accessDesc}>
            MyTools Admin est une application professionnelle exclusivement réservée aux administrateurs de garages partenaires.
            {"\n\n"}Les comptes sont créés et gérés par notre service client. L'auto-inscription n'est pas disponible.
          </Text>
          <Pressable
            style={styles.contactBtn}
            onPress={() => Linking.openURL("mailto:contact@mytoolsgroup.eu")}
          >
            <Ionicons name="mail-outline" size={18} color="#fff" />
            <Text style={styles.contactBtnText}>Contacter le service client</Text>
          </Pressable>
          <Pressable
            style={styles.websiteBtn}
            onPress={() => Linking.openURL("https://www.mytoolsgroup.eu")}
          >
            <Ionicons name="globe-outline" size={18} color={theme.primary} />
            <Text style={styles.websiteBtnText}>www.mytoolsgroup.eu</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Politique de confidentialité</Text>
        <View style={styles.legalCard}>
          <Text style={styles.legalText}>
            <Text style={styles.legalBold}>Responsable du traitement{"\n"}</Text>
            MyTools Group — contact@mytoolsgroup.eu{"\n\n"}

            <Text style={styles.legalBold}>Données collectées{"\n"}</Text>
            L'application collecte uniquement les données nécessaires à la gestion de l'activité du garage : informations clients, devis, factures et rendez-vous. Ces données sont exclusivement utilisées dans le cadre de la relation commerciale garage-client.{"\n\n"}

            <Text style={styles.legalBold}>Hébergement et sécurité{"\n"}</Text>
            Les données sont hébergées sur des serveurs sécurisés en Union Européenne. Les communications sont chiffrées via HTTPS/TLS.{"\n\n"}

            <Text style={styles.legalBold}>Droits des utilisateurs{"\n"}</Text>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez : contact@mytoolsgroup.eu{"\n\n"}

            <Text style={styles.legalBold}>Durée de conservation{"\n"}</Text>
            Les données sont conservées pendant la durée de la relation contractuelle, puis archivées selon les obligations légales en vigueur.{"\n\n"}

            <Text style={styles.legalBold}>Pas de suivi publicitaire{"\n"}</Text>
            L'application ne procède à aucun suivi publicitaire, ne collecte pas de données biométriques, et ne partage pas vos données avec des tiers à des fins commerciales.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Mentions légales</Text>
        <View style={styles.legalCard}>
          <Text style={styles.legalText}>
            <Text style={styles.legalBold}>Éditeur{"\n"}</Text>
            MyTools Group{"\n"}
            contact@mytoolsgroup.eu{"\n"}
            www.mytoolsgroup.eu{"\n\n"}

            <Text style={styles.legalBold}>Utilisation{"\n"}</Text>
            Cette application est un outil professionnel de gestion destiné aux administrateurs de garages. Toute utilisation non autorisée est strictement interdite.{"\n\n"}

            <Text style={styles.legalBold}>Propriété intellectuelle{"\n"}</Text>
            L'application MyTools Admin, son logo, et l'ensemble de ses contenus sont protégés par les lois sur la propriété intellectuelle. Toute reproduction est interdite sans autorisation écrite préalable.
          </Text>
        </View>

        <Text style={styles.lastUpdated}>Dernière mise à jour : mars 2026</Text>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: theme.text },
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 8 },
  accessCard: {
    backgroundColor: theme.surface,
    borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    padding: 20, alignItems: "center", gap: 12, marginBottom: 8,
  },
  iconBadge: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  accessTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: theme.text, textAlign: "center",
  },
  accessDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: theme.textSecondary,
    textAlign: "center", lineHeight: 21,
  },
  contactBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 4, width: "100%",
    justifyContent: "center",
  },
  contactBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  websiteBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.border, width: "100%", justifyContent: "center",
  },
  websiteBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.primary },
  sectionTitle: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginLeft: 2,
  },
  legalCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 16,
  },
  legalText: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textSecondary, lineHeight: 20,
  },
  legalBold: { fontFamily: "Inter_600SemiBold", color: theme.text },
  lastUpdated: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textTertiary,
    textAlign: "center", marginTop: 16,
  },
});
