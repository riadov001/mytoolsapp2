import React, { useMemo, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, RefreshControl, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { adminAnalytics, adminProfile } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

function formatCurrency(val: number | undefined | null) {
  if (val === undefined || val === null) return "0 €";
  return Number(val).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [isPremium, setIsPremium] = useState(false);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 100 : insets.bottom + 100;

  // Fetch profile to check subscription
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const profile = await adminProfile.get();
        const plan = (profile?.plan || profile?.subscription || "").toLowerCase();
        setIsPremium(plan.includes("pro") || plan.includes("premium") || plan.includes("entreprise"));
      } catch {}
    };
    checkSubscription();
  }, []);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: adminAnalytics.get,
    staleTime: 0,
  });

  const { data: advancedData, isLoading: loadingAdvanced } = useQuery({
    queryKey: ["admin-analytics-advanced"],
    queryFn: isPremium ? adminAnalytics.getAdvanced : async () => null,
    enabled: isPremium,
    staleTime: 0,
  });

  const cm = (data as any)?.currentMonth || {};
  const qStats = (data as any)?.quoteStatusStats || {};
  const invStats = (data as any)?.invoiceStatusStats || {};

  const kpis = {
    monthlyRevenue: Number(cm.revenue) || 0,
    pendingRevenue: Number((data as any)?.pendingRevenue) || 0,
    globalRevenue: Number((data as any)?.globalRevenue) || 0,
    totalClients: Array.isArray((data as any)?.clients) ? (data as any).clients.length : 0,
    pendingQuotes: (Number(qStats.pending) || 0) + (Number(qStats.approved) || 0),
    pendingInvoices: Number(invStats.pending) || 0,
    totalReservations: Number((data as any)?.totalReservations) || 0,
    totalInvoices: Number((data as any)?.totalInvoices) || 0,
    totalQuotes: Number((data as any)?.totalQuotes) || 0,
    conversionRate: parseFloat(String((data as any)?.conversionRate || "0")),
    avgInvoice: Number((data as any)?.avgInvoiceAmount) || 0,
  };

  // Advanced analytics
  const advanced = {
    prediction: (advancedData as any)?.prediction || null,
    trend: (advancedData as any)?.trend || null,
    insights: Array.isArray((advancedData as any)?.insights) ? (advancedData as any).insights : [],
    recommendations: Array.isArray((advancedData as any)?.recommendations) ? (advancedData as any).recommendations : [],
  };

  const rawChart: any[] = Array.isArray((data as any)?.monthlyRevenue)
    ? (data as any).monthlyRevenue.slice(-6)
    : [];
  const revenueChart = rawChart.map((m: any) => ({
    revenue: Number(m.total) || 0,
    label: String(m.name || "").split(".")[0],
  }));
  const maxRevenue = Math.max(...revenueChart.map(r => r.revenue), 1);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="analytics-outline" size={24} color={theme.primary} />
          <Text style={styles.headerTitle}>Analyse</Text>
          {isPremium && <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>Pro</Text></View>}
        </View>

        {/* KPI Grid */}
        <Text style={styles.sectionLabel}>KPI — {cm.monthName || "Ce mois"}</Text>
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderColor: "#22C55E" }]}>
            <Ionicons name="cash-outline" size={24} color="#22C55E" />
            <Text style={styles.kpiValue}>{formatCurrency(kpis.monthlyRevenue)}</Text>
            <Text style={styles.kpiLabel}>CA encaissé</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: "#F59E0B" }]}>
            <Ionicons name="time-outline" size={24} color="#F59E0B" />
            <Text style={styles.kpiValue}>{formatCurrency(kpis.pendingRevenue)}</Text>
            <Text style={styles.kpiLabel}>CA en attente</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: "#8B5CF6" }]}>
            <Ionicons name="document-text-outline" size={24} color="#8B5CF6" />
            <Text style={styles.kpiValue}>{String(kpis.pendingQuotes)}</Text>
            <Text style={styles.kpiLabel}>Devis actifs</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: "#EF4444" }]}>
            <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
            <Text style={styles.kpiValue}>{String(kpis.pendingInvoices)}</Text>
            <Text style={styles.kpiLabel}>Factures impayées</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: "#3B82F6" }]}>
            <Ionicons name="people-outline" size={24} color="#3B82F6" />
            <Text style={styles.kpiValue}>{String(kpis.totalClients)}</Text>
            <Text style={styles.kpiLabel}>Clients</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: "#06B6D4" }]}>
            <Ionicons name="stats-chart-outline" size={24} color="#06B6D4" />
            <Text style={styles.kpiValue}>{kpis.conversionRate.toFixed(0)}%</Text>
            <Text style={styles.kpiLabel}>Conversion</Text>
          </View>
        </View>

        {/* Revenue Chart */}
        <Text style={styles.sectionLabel}>Revenus — 6 derniers mois</Text>
        <View style={styles.chartCard}>
          {revenueChart.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="bar-chart-outline" size={32} color={theme.textTertiary} />
              <Text style={{ color: theme.textTertiary, marginTop: 8, fontSize: 13 }}>Aucune donnée</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              {revenueChart.map((item, i) => {
                const barH = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 4;
                const hasValue = item.revenue > 0;
                return (
                  <View key={i} style={styles.chartBarCol}>
                    {hasValue && (
                      <Text style={styles.chartBarValue}>
                        {item.revenue >= 1000 ? Math.round(item.revenue / 1000) + "k" : String(Math.round(item.revenue))}
                      </Text>
                    )}
                    <View style={[styles.chartBar, { height: Math.max(barH, 4), backgroundColor: hasValue ? theme.primary : theme.border }]} />
                    <Text style={styles.chartBarLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Premium Analytics */}
        {isPremium ? (
          <>
            {loadingAdvanced ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ color: theme.textTertiary, marginTop: 12 }}>Chargement analyse IA...</Text>
              </View>
            ) : (
              <>
                {/* Prediction */}
                {advanced.prediction && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
                      <Text style={styles.sectionTitle}>Prédiction IA</Text>
                    </View>
                    <View style={styles.predictionCard}>
                      <Text style={styles.predictionValue}>{advanced.prediction.nextMonthRevenue ? formatCurrency(advanced.prediction.nextMonthRevenue) : "—"}</Text>
                      <Text style={styles.predictionLabel}>Revenus estimés mois prochain</Text>
                      {advanced.prediction.trend && (
                        <View style={styles.trendBadge}>
                          <Ionicons
                            name={advanced.prediction.trend === "up" ? "arrow-up-outline" : advanced.prediction.trend === "down" ? "arrow-down-outline" : "remove-outline"}
                            size={14}
                            color={advanced.prediction.trend === "up" ? "#22C55E" : advanced.prediction.trend === "down" ? "#EF4444" : theme.textSecondary}
                          />
                          <Text style={[styles.trendText, { color: advanced.prediction.trend === "up" ? "#22C55E" : advanced.prediction.trend === "down" ? "#EF4444" : theme.textSecondary }]}>
                            {advanced.prediction.percentChange ? Math.abs(parseFloat(String(advanced.prediction.percentChange))).toFixed(1) + "%" : "—"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Insights */}
                {advanced.insights.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="lightbulb-outline" size={18} color={theme.primary} />
                      <Text style={styles.sectionTitle}>Insights commerciaux</Text>
                    </View>
                    {advanced.insights.map((insight: any, i: number) => (
                      <View key={i} style={styles.insightCard}>
                        <Text style={styles.insightTitle}>{insight.title || insight.label}</Text>
                        <Text style={styles.insightDesc}>{insight.description || insight.value}</Text>
                        {insight.recommendation && <Text style={styles.insightRec}>💡 {insight.recommendation}</Text>}
                      </View>
                    ))}
                  </View>
                )}

                {/* Recommendations */}
                {advanced.recommendations.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="checkmark-done-outline" size={18} color={theme.primary} />
                      <Text style={styles.sectionTitle}>Recommandations</Text>
                    </View>
                    {advanced.recommendations.map((rec: any, i: number) => (
                      <View key={i} style={styles.recCard}>
                        <View style={styles.recIcon}>
                          <Ionicons name="arrow-forward-outline" size={16} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recTitle}>{rec.title || rec.action}</Text>
                          <Text style={styles.recDesc}>{rec.description || rec.details}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <View style={styles.upgradeCard}>
            <Ionicons name="star-outline" size={32} color={theme.primary} />
            <Text style={styles.upgradeTitle}>Débloquez l'analyse IA</Text>
            <Text style={styles.upgradeDesc}>Obtenez des prédictions, insights et recommandations personnalisées</Text>
            <Pressable style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.upgradeBtnText}>Passer à Pro</Text>
            </Pressable>
          </View>
        )}

        {/* Summary Stats */}
        <Text style={styles.sectionLabel}>Résumé global</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{kpis.totalQuotes}</Text>
            <Text style={styles.summaryLabel}>Devis total</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{kpis.totalInvoices}</Text>
            <Text style={styles.summaryLabel}>Factures</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{formatCurrency(kpis.globalRevenue)}</Text>
            <Text style={styles.summaryLabel}>CA total</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{formatCurrency(kpis.avgInvoice)}</Text>
            <Text style={styles.summaryLabel}>Ticket moyen</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { paddingHorizontal: 16, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: theme.text, flex: 1 },
  premiumBadge: { backgroundColor: theme.primary + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  premiumBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.primary, textTransform: "uppercase" },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { flex: 1, minWidth: 160, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 2, padding: 14, alignItems: "center", gap: 6 },
  kpiValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: theme.text },
  kpiLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: theme.textTertiary, textAlign: "center" },

  chartCard: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16 },
  chartEmpty: { alignItems: "center", paddingVertical: 40 },
  chartContainer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 160, gap: 8 },
  chartBarCol: { flex: 1, alignItems: "center", gap: 6 },
  chartBarValue: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: theme.text },
  chartBar: { width: "100%", backgroundColor: theme.primary, borderRadius: 4 },
  chartBarLabel: { fontSize: 9, fontFamily: "Inter_500Medium", color: theme.textTertiary },

  section: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 },
  predictionCard: { backgroundColor: theme.background, borderRadius: 8, padding: 12, alignItems: "center", gap: 8 },
  predictionValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: theme.primary },
  predictionLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: theme.textSecondary, textAlign: "center" },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.primary + "10", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  trendText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  insightCard: { backgroundColor: theme.background, borderRadius: 8, padding: 12, gap: 4, borderLeftWidth: 3, borderLeftColor: theme.primary },
  insightTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.text },
  insightDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, lineHeight: 16 },
  insightRec: { fontSize: 11, fontFamily: "Inter_500Medium", color: theme.primary, marginTop: 4 },

  recCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: theme.background, borderRadius: 8, padding: 12 },
  recIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.primary + "10", justifyContent: "center", alignItems: "center", marginTop: 2 },
  recTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.text },
  recDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2, lineHeight: 14 },

  upgradeCard: { backgroundColor: theme.primary + "08", borderRadius: 12, borderWidth: 1, borderColor: theme.primary + "30", padding: 24, alignItems: "center", gap: 12 },
  upgradeTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text },
  upgradeDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textSecondary, textAlign: "center" },
  upgradeBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  upgradeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryStat: { flex: 1, minWidth: 130, backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 12, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: theme.textTertiary, textAlign: "center" },
});
