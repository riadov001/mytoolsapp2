import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Mentions Légales</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Éditeur du site et de l'application</Text>
        <Text style={styles.text}>
          L'application mobile MyTools est éditée par la société MyTools, spécialisée dans la rénovation et la personnalisation de jantes automobiles.
        </Text>
        <Text style={styles.text}>Email : contact@mytoolsgroup.eu</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Hébergement</Text>
        <Text style={styles.text}>
          L'application et les données associées sont hébergées par des prestataires professionnels garantissant la sécurité et la disponibilité des services.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Propriété intellectuelle</Text>
        <Text style={styles.text}>
          L'ensemble des éléments constituant l'application MyTools (textes, images, logos, icônes, sons, logiciels, etc.) sont la propriété exclusive de MyTools ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments de l'application, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable de MyTools.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Limitation de responsabilité</Text>
        <Text style={styles.text}>
          MyTools s'efforce de fournir des informations aussi précises que possible. Toutefois, elle ne pourra être tenue responsable des omissions, des inexactitudes et des carences dans la mise à jour, qu'elles soient de son fait ou du fait des tiers partenaires qui lui fournissent ces informations.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Droit applicable</Text>
        <Text style={styles.text}>
          Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Fonctionnalités de l'application</Text>
        <Text style={styles.text}>
          L'application MyTools permet la consultation de vos devis et factures en lecture seule. Aucun paiement ne peut être effectué depuis l'application. Pour tout règlement, veuillez vous rendre sur votre espace client sécurisé accessible via notre site internet.
        </Text>
        <Text style={styles.text}>
          La modification de vos informations personnelles et de votre mot de passe s'effectue exclusivement depuis votre espace client sur notre site internet, pour des raisons de sécurité.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7. Contact</Text>
        <Text style={styles.text}>
          Pour toute question relative aux mentions légales, vous pouvez nous contacter à l'adresse : contact@mytoolsgroup.eu
        </Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
});
