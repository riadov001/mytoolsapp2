import React, { useState, useCallback } from "react";
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
import { invoicesApi, Invoice } from "@/lib/api";
import Colors from "@/constants/colors";
import { FloatingSupport } from "@/components/FloatingSupport";

function getInvoiceStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "paid" || s === "payée" || s === "payé")
    return { label: "Payée", color: "#16A34A", bg: "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "pending" || s === "en_attente")
    return { label: "En attente", color: "#D97706", bg: "#FEF3C7", icon: "time-outline" as const };
  if (s === "overdue" || s === "en_retard")
    return { label: "En retard", color: "#DC2626", bg: "#FEE2E2", icon: "alert-circle-outline" as const };
  if (s === "cancelled" || s === "annulée")
    return { label: "Annulée", color: Colors.textTertiary, bg: Colors.surfaceSecondary, icon: "close-circle-outline" as const };
  if (s === "draft" || s === "brouillon")
    return { label: "Brouillon", color: Colors.textSecondary, bg: Colors.surfaceSecondary, icon: "create-outline" as const };
  if (s === "sent" || s === "envoyée")
    return { label: "Envoyée", color: "#3B82F6", bg: "#DBEAFE", icon: "send-outline" as const };
  return { label: status || "Inconnu", color: Colors.textSecondary, bg: Colors.surfaceSecondary, icon: "help-outline" as const };
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const statusInfo = getInvoiceStatusInfo(invoice.status);
  const date = new Date(invoice.createdAt);
  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const inv = invoice as any;
  const totalTTC = invoice.totalTTC || inv.total_ttc || inv.totalIncludingTax || inv.total_including_tax || inv.totalAmountIncludingTax || inv.totalWithTax || inv.montantTTC || inv.montant_ttc || inv.amount || inv.totalAmount || inv.total_amount || inv.total || "0";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/(main)/invoice-detail", params: { id: invoice.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.invoiceIdRow}>
          <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber || invoice.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formattedDate}</Text>
        </View>
        {invoice.dueDate && (
          <View style={styles.detailRow}>
            <Ionicons name="hourglass-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.detailText}>
              Échéance : {new Date(invoice.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}
        {invoice.notes && (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>{invoice.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amountLabel}>Montant TTC</Text>
          <Text style={styles.amountValue}>
            {parseFloat(totalTTC).toFixed(2)} €
          </Text>
        </View>
        <View style={styles.viewDetailRow}>
          <Text style={styles.viewDetailText}>Voir détails</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: invoicesRaw, isLoading, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesApi.getAll,
    retry: 1,
    refetchInterval: 60000,
  });

  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerContainer,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Text style={styles.headerTitle}>Mes Factures</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={[...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InvoiceCard invoice={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune facture</Text>
              <Text style={styles.emptyText}>
                Vos factures apparaîtront ici une fois vos devis acceptés et traités.
              </Text>
            </View>
          }
        />
      )}
      <FloatingSupport />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  invoiceNumber: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  cardBody: {
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  amountValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  viewDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
