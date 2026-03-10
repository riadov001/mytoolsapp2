import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl, TextInput, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminInvoices } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const STATUSES = ["all", "pending", "paid", "cancelled"] as const;
const STATUS_LABELS: Record<string, string> = { all: "Tous", pending: "En attente", paid: "Payée", cancelled: "Annulée", overdue: "En retard" };
const STATUS_COLORS: Record<string, string> = { pending: "#F59E0B", paid: "#22C55E", cancelled: "#EF4444", overdue: "#EF4444" };

export default function AdminInvoicesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { isAdmin } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data: invoices = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: adminInvoices.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminInvoices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const confirmDelete = (id: string, label: string) => {
    showAlert({
      type: "warning",
      title: "Supprimer cette facture ?",
      message: `La facture ${label} sera supprimée définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const arr = Array.isArray(invoices) ? invoices : [];
  const filtered = arr.filter((inv: any) => {
    if (filter !== "all" && inv.status?.toLowerCase() !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = `${inv.client?.firstName || ""} ${inv.client?.lastName || ""}`.toLowerCase();
      return name.includes(s) || (inv.invoiceNumber || "").toLowerCase().includes(s);
    }
    return true;
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const color = STATUS_COLORS[item.status?.toLowerCase()] || theme.textTertiary;
    const clientName = `${item.client?.firstName || ""} ${item.client?.lastName || ""}`.trim() || "Client";
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: "/(admin)/invoice-form", params: { id: item.id } } as any)}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>{clientName}</Text>
            <Text style={styles.cardSub}>{item.invoiceNumber || "N° en attente"}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + "20" }]}>
            <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[item.status?.toLowerCase()] || item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.cardAmount}>
            {(item.amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
          </Text>
          <Text style={styles.cardDate}>
            {item.dueDate ? `Échéance: ${new Date(item.dueDate).toLocaleDateString("fr-FR")}` : ""}
          </Text>
        </View>
        {isAdmin && (
          <View style={styles.cardActions}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#EF444420" }]}
              onPress={() => confirmDelete(item.id, item.invoiceNumber || clientName)}
              accessibilityLabel="Supprimer"
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  }, [theme, isAdmin]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        <Text style={styles.screenTitle}>Factures</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/(admin)/invoice-form" as any)}
          accessibilityLabel="Nouvelle facture"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {STATUSES.map(s => (
          <Pressable key={s} style={[styles.filterChip, filter === s && { backgroundColor: theme.primary }]} onPress={() => setFilter(s)}>
            <Text style={[styles.filterText, filter === s && { color: "#fff" }]}>{STATUS_LABELS[s]}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucune facture trouvée</Text>
            </View>
          }
        />
      )}
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Michroma_400Regular", color: theme.text, letterSpacing: 0.5 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
  searchRow: { paddingHorizontal: 16, marginBottom: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 10, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardAmount: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text },
  cardDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary },
  cardActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  actionBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.textTertiary },
});
