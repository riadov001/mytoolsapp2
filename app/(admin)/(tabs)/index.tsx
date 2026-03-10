import React, { useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { adminAnalytics } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#22C55E",
  rejected: "#EF4444",
  converted: "#3B82F6",
  paid: "#22C55E",
  cancelled: "#EF4444",
  overdue: "#EF4444",
  confirmed: "#22C55E",
  completed: "#3B82F6",
};

function formatCurrency(val: number | undefined) {
  if (!val && val !== 0) return "0 \u20AC";
  return val.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: adminAnalytics.get,
    staleTime: 60000,
  });

  const s = data?.summary || {};
  const revenueChart = data?.revenueChart || [];

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 100 : insets.bottom + 100;

  const maxRevenue = Math.max(...revenueChart.map((r: any) => r.revenue || 0), 1);

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
        <View style={styles.headerRow}>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.firstName || "Admin"}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel="Se déconnecter">
            <Ionicons name="log-out-outline" size={22} color={theme.primary} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Indicateurs clés</Text>
        <View style={styles.kpiGrid}>
          <KPICard theme={theme} icon="cash-outline" color="#22C55E" label="CA du mois" value={formatCurrency(s.monthlyRevenue)} />
          <KPICard theme={theme} icon="trending-up-outline" color="#3B82F6" label="CA total" value={formatCurrency(s.totalRevenue)} />
          <KPICard theme={theme} icon="people-outline" color="#8B5CF6" label="Clients" value={String(s.totalClients || 0)} />
          <KPICard theme={theme} icon="document-text-outline" color="#F59E0B" label="Devis en attente" value={String(s.pendingQuotes || 0)} />
          <KPICard theme={theme} icon="alert-circle-outline" color="#EF4444" label="Factures impayées" value={String(s.pendingInvoices || 0)} />
          <KPICard theme={theme} icon="calendar-outline" color="#06B6D4" label="RDV ce mois" value={String(s.reservationsThisMonth || 0)} />
        </View>

        {revenueChart.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Chiffre d'affaires</Text>
            <View style={styles.chartCard}>
              <View style={styles.chartContainer}>
                {revenueChart.map((item: any, i: number) => {
                  const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 120 : 0;
                  return (
                    <View key={i} style={styles.chartBarCol}>
                      <Text style={styles.chartBarValue}>{Math.round(item.revenue / 1000)}k</Text>
                      <View style={[styles.chartBar, { height: Math.max(height, 4), backgroundColor: theme.primary }]} />
                      <Text style={styles.chartBarLabel}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {data?.recentQuotes?.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Derniers devis</Text>
              <Pressable onPress={() => router.push("/(admin)/(tabs)/quotes" as any)}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            </View>
            <View style={styles.listCard}>
              {data.recentQuotes.slice(0, 5).map((q: any, i: number) => (
                <View key={q.id || i} style={[styles.listItem, i < data.recentQuotes.length - 1 && styles.listItemBorder]}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{q.client?.firstName} {q.client?.lastName}</Text>
                    <Text style={styles.listItemSub}>{formatCurrency(q.quoteAmount || q.amount)}</Text>
                  </View>
                  <StatusBadge status={q.status} theme={theme} />
                </View>
              ))}
            </View>
          </>
        )}

        {data?.recentInvoices?.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Dernières factures</Text>
              <Pressable onPress={() => router.push("/(admin)/(tabs)/invoices" as any)}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            </View>
            <View style={styles.listCard}>
              {data.recentInvoices.slice(0, 5).map((inv: any, i: number) => (
                <View key={inv.id || i} style={[styles.listItem, i < data.recentInvoices.length - 1 && styles.listItemBorder]}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{inv.client?.firstName} {inv.client?.lastName}</Text>
                    <Text style={styles.listItemSub}>{inv.invoiceNumber || ""} - {formatCurrency(inv.amount)}</Text>
                  </View>
                  <StatusBadge status={inv.status} theme={theme} />
                </View>
              ))}
            </View>
          </>
        )}

        {data?.recentReservations?.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Prochains rendez-vous</Text>
              <Pressable onPress={() => router.push("/(admin)/(tabs)/reservations" as any)}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            </View>
            <View style={styles.listCard}>
              {data.recentReservations.slice(0, 5).map((r: any, i: number) => (
                <View key={r.id || i} style={[styles.listItem, i < data.recentReservations.length - 1 && styles.listItemBorder]}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{r.client?.firstName} {r.client?.lastName}</Text>
                    <Text style={styles.listItemSub}>
                      {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString("fr-FR") : ""}
                    </Text>
                  </View>
                  <StatusBadge status={r.status} theme={theme} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KPICard({ theme, icon, color, label, value }: { theme: ThemeColors; icon: any; color: string; label: string; value: string }) {
  const styles = useMemo(() => getStyles(theme), [theme]);
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status, theme }: { status: string; theme: ThemeColors }) {
  const color = STATUS_COLORS[status?.toLowerCase()] || theme.textTertiary;
  const labels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Rejeté",
    converted: "Converti",
    paid: "Payée",
    cancelled: "Annulée",
    overdue: "En retard",
    confirmed: "Confirmé",
    completed: "Terminé",
  };
  return (
    <View style={{ backgroundColor: color + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
      <Text style={{ color, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
        {labels[status?.toLowerCase()] || status}
      </Text>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  headerLogo: { width: 38, height: 38, borderRadius: 10 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.textSecondary },
  userName: { fontSize: 24, fontFamily: "Michroma_400Regular", color: theme.text, letterSpacing: 0.5 },
  logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.border },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.primary },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  kpiCard: { width: "48%", flexGrow: 1, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 6 },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kpiValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: theme.text },
  kpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary },
  chartCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 24 },
  chartContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 160 },
  chartBarCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  chartBar: { width: 24, borderRadius: 6, minHeight: 4 },
  chartBarValue: { fontSize: 10, fontFamily: "Inter_500Medium", color: theme.textTertiary },
  chartBarLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: theme.textTertiary },
  listCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: "hidden", marginBottom: 24 },
  listItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
  listItemLeft: { flex: 1 },
  listItemTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text },
  listItemSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
});
