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
import { adminClients } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const ROOT_ROLES = ["root", "root_admin"];
const SUPER_ROLES = ["super_admin", "superadmin"];
const ADMIN_HIDDEN_ROLES = [...ROOT_ROLES, ...SUPER_ROLES];

function canEditUser(loggedRole: string, targetRole: string): boolean {
  if (ROOT_ROLES.includes(loggedRole)) return true;
  if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole);
  return !ADMIN_HIDDEN_ROLES.includes(targetRole);
}

export default function AdminClientsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { isAdmin, user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const loggedRole = (user?.role || "").toLowerCase();
  const loggedGarageId = (user as any)?.garageId || null;

  const { data: clients = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminClients.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const confirmDelete = (id: string, name: string) => {
    showAlert({
      type: "warning",
      title: "Supprimer ce client ?",
      message: `Le client ${name} et toutes ses données seront supprimés définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const arr = Array.isArray(clients) ? clients : [];

  const roleFiltered = arr.filter((c: any) => {
    const targetRole = (c.role || "").toLowerCase();
    if (ROOT_ROLES.includes(loggedRole)) return true;
    if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole);
    if (loggedRole === "admin") {
      if (ADMIN_HIDDEN_ROLES.includes(targetRole)) return false;
      if (loggedGarageId && c.garageId && c.garageId !== loggedGarageId) return false;
      return true;
    }
    return true;
  });

  const filtered = roleFiltered.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
    return name.includes(s) || (c.email || "").toLowerCase().includes(s) || (c.phone || "").includes(s);
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const name = `${item.firstName || ""} ${item.lastName || ""}`.trim() || item.email;
    const itemRole = (item.role || "").toLowerCase();
    const isPro = item.role === "client_professionnel";
    const isAdminRole = [...ROOT_ROLES, ...SUPER_ROLES, "admin"].includes(itemRole);
    const canEdit = canEditUser(loggedRole, itemRole);
    const initials = [item.firstName?.[0], item.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
    const roleBadgeColor = isAdminRole ? "#8B5CF6" : (isPro ? "#F59E0B" : theme.primary);
    const roleLabel = ROOT_ROLES.includes(itemRole) ? "Root" : SUPER_ROLES.includes(itemRole) ? "SuperAdmin" : itemRole === "admin" ? "Admin" : isPro ? "Pro" : "Particulier";
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, !canEdit && { opacity: 0.6 }]}
        onPress={() => canEdit ? router.push({ pathname: "/(admin)/client-form", params: { id: item.id } } as any) : null}
      >
        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: isAdminRole ? "#8B5CF620" : theme.primary + "20" }]}>
            <Text style={[styles.avatarText, { color: isAdminRole ? "#8B5CF6" : theme.primary }]}>{initials}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{name}</Text>
            <Text style={styles.cardEmail}>{item.email}</Text>
            {item.phone && <Text style={styles.cardPhone}>{item.phone}</Text>}
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + "20" }]}>
              <Text style={[styles.roleText, { color: roleBadgeColor }]}>{roleLabel}</Text>
            </View>
            {isAdmin && canEdit && (
              <Pressable
                style={[styles.deleteBtn]}
                onPress={() => confirmDelete(item.id, name)}
                accessibilityLabel="Supprimer"
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  }, [theme, isAdmin, loggedRole]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        <Text style={styles.screenTitle}>Clients</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} client{filtered.length !== 1 ? "s" : ""}</Text>
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
              <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun client trouvé</Text>
            </View>
          }
        />
      )}
      {AlertComponent}
      {isAdmin && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              { bottom: Platform.OS === "web" ? 34 + 130 : insets.bottom + 130 },
              pressed && styles.fabPressed,
            ]}
            onPress={() => router.push("/(admin)/client-form" as any)}
            accessibilityLabel="Nouveau client"
          >
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  headerLogo: { width: 36, height: 36, borderRadius: 10 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Michroma_400Regular", color: theme.text, letterSpacing: 0.5 },
  fab: {
    position: "absolute", right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: theme.primary, justifyContent: "center", alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 6px 16px rgba(0,0,0,0.22)" } as any,
      default: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 },
    }),
    zIndex: 100,
  },
  fabPressed: { backgroundColor: theme.primaryDark, transform: [{ scale: 0.92 }] },
  searchRow: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.surface,
    borderRadius: 14, borderWidth: 1.5, borderColor: theme.border, paddingHorizontal: 14, height: 48,
    shadowColor: theme.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text },
  countRow: { paddingHorizontal: 22, marginBottom: 10 },
  countText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textTertiary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 10,
    shadowColor: theme.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: theme.text },
  cardEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary, marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 10 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  roleText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  deleteBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EF444415", justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: theme.textTertiary },
});
