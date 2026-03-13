import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

interface GuideSection {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  items: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "dashboard",
    icon: "grid-outline",
    iconColor: "#DC2626",
    title: "Tableau de bord",
    items: [
      "Consultez les indicateurs clés : chiffre d'affaires, devis actifs, factures impayées, nombre de clients et rendez-vous.",
      "Le graphique affiche l'évolution du CA sur les 6 derniers mois.",
      "Les statuts des devis et factures sont résumés en bas de page.",
      "Tirez vers le bas pour rafraîchir les données.",
    ],
  },
  {
    id: "quotes",
    icon: "document-text-outline",
    iconColor: "#3B82F6",
    title: "Devis",
    items: [
      "Consultez tous les devis avec leur statut, montant et client associé.",
      "Changez le statut d'un devis : en attente, approuvé, rejeté ou annulé.",
      "Appuyez sur un devis pour voir le détail : lignes, totaux HT/TTC et PDF.",
      "Filtrez par statut ou recherchez par nom de client ou numéro.",
    ],
  },
  {
    id: "invoices",
    icon: "receipt-outline",
    iconColor: "#22C55E",
    title: "Factures",
    items: [
      "Consultez toutes les factures avec le montant TTC, l'échéance et le statut (payée, en attente, annulée).",
      "Filtrez par statut ou recherchez par nom de client ou numéro de facture.",
      "Appuyez sur une facture pour voir le détail complet : lignes, totaux et informations client.",
      "L'email et le téléphone du client s'affichent directement sur chaque carte.",
    ],
  },
  {
    id: "reservations",
    icon: "calendar-outline",
    iconColor: "#8B5CF6",
    title: "Rendez-vous",
    items: [
      "Basculez entre la vue calendrier (agenda) et la vue liste.",
      "En vue agenda, sélectionnez un jour pour voir les rendez-vous planifiés.",
      "Confirmez un rendez-vous en attente avec le bouton vert, ou marquez-le comme terminé.",
      "Filtrez par statut : en attente, confirmé, terminé ou annulé.",
      "La recherche fonctionne par nom de client ou marque de véhicule.",
    ],
  },
  {
    id: "clients",
    icon: "people-outline",
    iconColor: "#F59E0B",
    title: "Clients",
    items: [
      "Consultez la liste de tous les clients avec leurs coordonnées (email, téléphone).",
      "Recherchez un client par nom ou email.",
      "Appuyez sur un client pour voir sa fiche détaillée.",
      "Créez un nouveau client avec le bouton « + ».",
    ],
  },
  {
    id: "notifications",
    icon: "notifications-outline",
    iconColor: "#EF4444",
    title: "Notifications",
    items: [
      "Recevez une alerte à chaque nouveau devis, facture ou rendez-vous.",
      "Les notifications s'affichent en temps réel sur votre appareil.",
      "Appuyez sur une notification pour accéder directement à l'élément concerné.",
      "Gérez vos préférences dans Paramètres > Notifications.",
    ],
  },
  {
    id: "support",
    icon: "chatbubbles-outline",
    iconColor: "#06B6D4",
    title: "Support",
    items: [
      "Contactez l'équipe MyTools depuis l'onglet Paramètres > Nous contacter.",
      "Consultez l'historique de vos demandes dans Paramètres > Historique des demandes.",
      "Vous pouvez également nous écrire à contact@mytoolsgroup.eu.",
    ],
  },
];

export default function AdminGuideScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [expandedId, setExpandedId] = useState<string | null>("dashboard");

  const toggleSection = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Guide de l'application</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Ionicons name="book" size={32} color={theme.primary} />
          <Text style={styles.introTitle}>Bienvenue dans MyTools Admin</Text>
          <Text style={styles.introText}>
            Ce guide vous présente toutes les fonctionnalités de l'application de gestion pour votre garage. Appuyez sur chaque section pour en savoir plus.
          </Text>
        </View>

        {GUIDE_SECTIONS.map(section => {
          const isExpanded = expandedId === section.id;
          return (
            <View key={section.id} style={styles.sectionCard}>
              <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
                <View style={[styles.sectionIcon, { backgroundColor: section.iconColor + "20" }]}>
                  <Ionicons name={section.icon} size={22} color={section.iconColor} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
              </Pressable>
              {isExpanded && (
                <View style={styles.sectionBody}>
                  {section.items.map((item, i) => (
                    <View key={i} style={styles.guideItem}>
                      <View style={styles.bullet}>
                        <Text style={styles.bulletNumber}>{i + 1}</Text>
                      </View>
                      <Text style={styles.guideText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.footerCard}>
          <Ionicons name="help-circle-outline" size={24} color={theme.textTertiary} />
          <Text style={styles.footerText}>
            Besoin d'aide supplémentaire ? Contactez notre support depuis l'onglet Paramètres.
          </Text>
        </View>
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
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  introCard: {
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1,
    borderColor: theme.border, padding: 20, alignItems: "center", gap: 10,
  },
  introTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: theme.text, textAlign: "center" },
  introText: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: theme.textSecondary,
    textAlign: "center", lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", padding: 14, gap: 12,
  },
  sectionIcon: {
    width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  sectionTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  sectionBody: {
    paddingHorizontal: 14, paddingBottom: 14, gap: 8,
    borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12,
  },
  guideItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.primary + "15", justifyContent: "center", alignItems: "center",
    marginTop: 1,
  },
  bulletNumber: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.primary },
  guideText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textSecondary, lineHeight: 19 },
  footerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 16, marginTop: 4,
  },
  footerText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textTertiary, lineHeight: 18 },
});
