import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { getGaragePlan, adminAnalytics } from "@/lib/admin-api";
import OCRScannerModal from "@/components/OCRScannerModal";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 90;

  const [ocrVisible, setOcrVisible] = useState(false);
  const [ocrMode, setOcrMode] = useState<"quote" | "invoice">("quote");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiType, setAiType] = useState<string>("");

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ["garage-plan"],
    queryFn: getGaragePlan,
    staleTime: 10 * 60 * 1000,
  });

  const features = planData?.features || ["reservations", "ocr"];
  const hasAI = features.includes("ai_analytics");

  const handleAIAnalysis = async (type: string) => {
    setAiLoading(type);
    setAiResult(null);
    setAiType(type);
    try {
      const data = await adminAnalytics.getAdvanced();
      setAiResult(data);
    } catch (err: any) {
      setAiResult({ error: err?.message || "Erreur lors de l'analyse" });
    } finally {
      setAiLoading(null);
    }
  };

  const handleOCR = (mode: "quote" | "invoice") => {
    setOcrMode(mode);
    setOcrVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleOCRResult = (result: any) => {
    setOcrVisible(false);
    if (ocrMode === "quote") {
      router.push({ pathname: "/(admin)/quote-create", params: { ocrData: JSON.stringify(result) } } as any);
    } else {
      router.push({ pathname: "/(admin)/invoice-create", params: { ocrData: JSON.stringify(result) } } as any);
    }
  };

  const featureItems = [
    {
      id: "reservations",
      icon: "calendar-outline" as const,
      label: "Rendez-vous",
      sub: "Gérer les rendez-vous",
      color: "#22C55E",
      always: true,
      onPress: () => router.push("/(admin)/(tabs)/reservations" as any),
    },
    {
      id: "ocr_quote",
      icon: "scan-outline" as const,
      label: "Scanner un devis",
      sub: "OCR intelligent avec IA",
      color: "#8B5CF6",
      always: true,
      onPress: () => handleOCR("quote"),
    },
    {
      id: "ocr_invoice",
      icon: "document-attach-outline" as const,
      label: "Scanner une facture",
      sub: "OCR intelligent avec IA",
      color: "#3B82F6",
      always: true,
      onPress: () => handleOCR("invoice"),
    },
    {
      id: "ai_global",
      icon: "analytics-outline" as const,
      label: "Analyse globale IA",
      sub: "Vue d'ensemble de votre activité",
      color: "#F59E0B",
      always: false,
      onPress: () => handleAIAnalysis("ai_global"),
    },
    {
      id: "ai_commercial",
      icon: "trending-up-outline" as const,
      label: "Analyse commerciale",
      sub: "Performance et chiffre d'affaires",
      color: "#10B981",
      always: false,
      onPress: () => handleAIAnalysis("ai_commercial"),
    },
    {
      id: "ai_growth",
      icon: "rocket-outline" as const,
      label: "Analyse croissance",
      sub: "Tendances et prévisions",
      color: "#EC4899",
      always: false,
      onPress: () => handleAIAnalysis("ai_growth"),
    },
  ];

  const visibleFeatures = featureItems.filter(f => f.always || hasAI);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.headerTitle}>Fonctionnalités</Text>
        {planData?.plan && planData.plan !== "free" ? (
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{planData.plan.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {planLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            {visibleFeatures.map((feat) => (
              <Pressable
                key={feat.id}
                style={({ pressed }) => [styles.featureCard, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  feat.onPress();
                }}
                disabled={!!aiLoading}
              >
                <View style={[styles.featureIcon, { backgroundColor: feat.color + "18" }]}>
                  {aiLoading === feat.id ? (
                    <ActivityIndicator size="small" color={feat.color} />
                  ) : (
                    <Ionicons name={feat.icon} size={24} color={feat.color} />
                  )}
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureLabel}>{feat.label}</Text>
                  <Text style={styles.featureSub}>{feat.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </Pressable>
            ))}

            {!hasAI && (
              <View style={styles.proBanner}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.proTitle}>Analyses IA</Text>
                  <Text style={styles.proSub}>Passez au plan Pro pour accéder aux analyses avancées IA</Text>
                </View>
              </View>
            )}
          </>
        )}

        {aiResult && !aiResult.error ? (
          <View style={styles.aiResultCard}>
            <View style={styles.aiResultHeader}>
              <Ionicons name="sparkles" size={20} color={theme.primary} />
              <Text style={styles.aiResultTitle}>
                {aiType === "ai_global" ? "Analyse globale" : aiType === "ai_commercial" ? "Analyse commerciale" : "Analyse croissance"}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
              {aiResult.summary ? <Text style={styles.aiText}>{aiResult.summary}</Text> : null}
              {aiResult.insights && Array.isArray(aiResult.insights) ? (
                aiResult.insights.map((insight: string, i: number) => (
                  <Text key={i} style={styles.aiText}>• {insight}</Text>
                ))
              ) : null}
              {typeof aiResult === "object" && !aiResult.summary && !aiResult.insights ? (
                <Text style={styles.aiText}>{JSON.stringify(aiResult, null, 2)}</Text>
              ) : null}
            </ScrollView>
          </View>
        ) : aiResult?.error ? (
          <View style={[styles.aiResultCard, { borderColor: "#EF4444" }]}>
            <Text style={[styles.aiText, { color: "#EF4444" }]}>{aiResult.error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <OCRScannerModal
        visible={ocrVisible}
        onClose={() => setOcrVisible(false)}
        onResult={handleOCRResult}
        mode={ocrMode}
      />
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    planBadge: {
      backgroundColor: theme.primary + "20",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    planText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: theme.primary,
    },
    featureCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    featureText: { flex: 1 },
    featureLabel: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
    },
    featureSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: theme.textSecondary,
      marginTop: 2,
    },
    proBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 8,
    },
    proTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: theme.textSecondary,
    },
    proSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: theme.textTertiary,
      marginTop: 2,
    },
    aiResultCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.primary + "40",
      marginTop: 12,
    },
    aiResultHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    aiResultTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
    },
    aiText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 4,
    },
  });
}
