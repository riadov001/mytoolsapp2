import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { quotesApi, invoicesApi, reservationsApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

type FilterType = "all" | "quotes" | "invoices" | "reservations";

interface HistoryItem {
  id: string;
  type: "quote" | "invoice" | "reservation";
  reference: string;
  date: string;
  status: string;
  amount?: number;
  raw: any;
}

function getQuoteStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente") return { label: "En attente", color: "#6B7280", bg: "#F3F4F6" };
  if (s === "approved" || s === "approuvé" || s === "approuve") return { label: "Approuvé", color: "#16A34A", bg: "#DCFCE7" };
  if (s === "accepted" || s === "accepté" || s === "accepte") return { label: "Accepté", color: "#2563EB", bg: "#DBEAFE" };
  if (s === "rejected" || s === "refusé" || s === "refuse") return { label: "Refusé", color: "#DC2626", bg: "#FEE2E2" };
  if (s === "completed" || s === "terminé" || s === "termine") return { label: "Terminé", color: "#7C3AED", bg: "#EDE9FE" };
  if (s === "sent" || s === "envoyé" || s === "envoye") return { label: "Envoyé", color: "#0891B2", bg: "#CFFAFE" };
  return { label: status || "Inconnu", color: "#888", bg: "#F0F0F0" };
}

function getInvoiceStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente") return { label: "En attente", color: "#D97706", bg: "#FEF3C7" };
  if (s === "paid" || s === "payée" || s === "payé") return { label: "Payée", color: "#16A34A", bg: "#DCFCE7" };
  if (s === "overdue" || s === "en_retard") return { label: "En retard", color: "#DC2626", bg: "#FEE2E2" };
  if (s === "cancelled" || s === "annulée") return { label: "Annulée", color: "#6B7280", bg: "#F3F4F6" };
  return { label: status || "Inconnu", color: "#888", bg: "#F0F0F0" };
}

function getReservationStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente") return { label: "En attente", color: "#6B7280", bg: "#F3F4F6" };
  if (s === "confirmed" || s === "confirmée" || s === "confirmé") return { label: "Confirmé", color: "#2563EB", bg: "#DBEAFE" };
  if (s === "completed" || s === "terminée" || s === "terminé") return { label: "Terminé", color: "#16A34A", bg: "#DCFCE7" };
  if (s === "cancelled" || s === "annulée" || s === "annulé") return { label: "Annulé", color: "#DC2626", bg: "#FEE2E2" };
  return { label: status || "Inconnu", color: "#888", bg: "#F0F0F0" };
}

function getTypeBadge(type: "quote" | "invoice" | "reservation") {
  if (type === "quote") return { label: "Devis", color: "#7C3AED", bg: "#EDE9FE", icon: "document-text-outline" as const };
  if (type === "invoice") return { label: "Facture", color: "#0891B2", bg: "#CFFAFE", icon: "receipt-outline" as const };
  return { label: "Réservation", color: "#D97706", bg: "#FEF3C7", icon: "calendar-outline" as const };
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "quotes", label: "Devis" },
  { id: "invoices", label: "Factures" },
  { id: "reservations", label: "Réservations" },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data: quotes = [], refetch: refetchQuotes, isLoading: loadingQuotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: quotesApi.getAll,
  });

  const { data: invoices = [], refetch: refetchInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesApi.getAll,
  });

  const { data: reservations = [], refetch: refetchReservations, isLoading: loadingReservations } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationsApi.getAll,
  });

  const isLoading = loadingQuotes || loadingInvoices || loadingReservations;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchQuotes(), refetchInvoices(), refetchReservations()]);
    setRefreshing(false);
  }, [refetchQuotes, refetchInvoices, refetchReservations]);

  const allItems: HistoryItem[] = [
    ...(Array.isArray(quotes) ? quotes : []).map((q: any) => ({
      id: q.id,
      type: "quote" as const,
      reference: q.quoteNumber || q.reference || q.id,
      date: q.createdAt || q.date || "",
      status: q.status || "",
      amount: parseFloat(q.totalTTC || q.total_ttc || q.totalHT || q.total_ht || "0") || undefined,
      raw: q,
    })),
    ...(Array.isArray(invoices) ? invoices : []).map((inv: any) => ({
      id: inv.id,
      type: "invoice" as const,
      reference: inv.invoiceNumber || inv.reference || inv.id,
      date: inv.createdAt || inv.date || "",
      status: inv.status || "",
      amount: parseFloat(inv.totalTTC || inv.total_ttc || inv.totalHT || inv.total_ht || "0") || undefined,
      raw: inv,
    })),
    ...(Array.isArray(reservations) ? reservations : []).map((r: any) => ({
      id: r.id,
      type: "reservation" as const,
      reference: r.reservationNumber || r.reference || r.id,
      date: r.createdAt || r.scheduledDate || r.date || "",
      status: r.status || "",
      raw: r,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = allItems.filter(item => {
    if (filter === "all") return true;
    if (filter === "quotes") return item.type === "quote";
    if (filter === "invoices") return item.type === "invoice";
    if (filter === "reservations") return item.type === "reservation";
    return true;
  });

  const handlePress = (item: HistoryItem) => {
    if (item.type === "quote") router.push(`/(main)/quote-detail?id=${item.id}`);
    else if (item.type === "invoice") router.push(`/(main)/invoice-detail?id=${item.id}`);
    else router.push(`/(main)/reservation-detail?id=${item.id}`);
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const typeBadge = getTypeBadge(item.type);
    const statusInfo = item.type === "quote"
      ? getQuoteStatusInfo(item.status)
      : item.type === "invoice"
      ? getInvoiceStatusInfo(item.status)
      : getReservationStatusInfo(item.status);

    const formattedDate = item.date
      ? new Date(item.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
      : "—";

    const shortRef = item.reference.length > 16
      ? `${item.reference.substring(0, 8)}…`
      : item.reference;

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.typeIconWrapper, { backgroundColor: typeBadge.bg }]}>
          <Ionicons name={typeBadge.icon} size={20} color={typeBadge.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeBadge.bg }]}>
              <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>{typeBadge.label}</Text>
            </View>
            <Text style={styles.cardDate}>{formattedDate}</Text>
          </View>

          <Text style={styles.cardRef}>{shortRef}</Text>

          <View style={styles.cardBottomRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
            {item.amount !== undefined && item.amount > 0 && (
              <Text style={styles.cardAmount}>{item.amount.toFixed(2)} €</Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Historique</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.id}
            style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterChipText, filter === f.id && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => `${item.type}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          scrollEnabled={filtered.length > 0}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={56} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune activité</Text>
              <Text style={styles.emptySubtitle}>Votre historique apparaîtra ici</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: theme.background,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: theme.text,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: theme.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: theme.surfaceSecondary,
  },
  typeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  cardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.textTertiary,
  },
  cardRef: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  cardAmount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: theme.textSecondary,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textTertiary,
  },
});
