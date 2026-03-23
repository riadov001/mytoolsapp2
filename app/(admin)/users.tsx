import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
  Alert, TextInput, Modal,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminClients } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", role: "user" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminClients.getAll(),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminClients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreateModal(false);
      setFormData({ firstName: "", lastName: "", email: "", role: "user" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ type: "success", title: "Utilisateur créé", message: "L'utilisateur a été créé avec succès.", buttons: [{ text: "OK", style: "primary" }] });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de créer l'utilisateur.", buttons: [{ text: "OK" }] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => adminClients.update(editingUser.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
      setFormData({ firstName: "", lastName: "", email: "", role: "user" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ type: "success", title: "Utilisateur modifié", message: "L'utilisateur a été modifié avec succès.", buttons: [{ text: "OK", style: "primary" }] });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de modifier l'utilisateur.", buttons: [{ text: "OK" }] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminClients.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ type: "success", title: "Utilisateur supprimé", message: "L'utilisateur a été supprimé.", buttons: [{ text: "OK", style: "primary" }] });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de supprimer l'utilisateur.", buttons: [{ text: "OK" }] });
    },
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const handleSubmit = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      Alert.alert("Attention", "Veuillez remplir tous les champs.");
      return;
    }
    if (editingUser) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setFormData({ firstName: user.firstName || "", lastName: user.lastName || "", email: user.email, role: user.role });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingUser(null);
    setFormData({ firstName: "", lastName: "", email: "", role: "user" });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const usersArr = Array.isArray(users) ? users : [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.title}>Utilisateurs</Text>
        <Pressable style={styles.addBtn} onPress={() => { setEditingUser(null); setFormData({ firstName: "", lastName: "", email: "", role: "user" }); setShowCreateModal(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 8 }}>
        {usersArr.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
            <Text style={styles.emptyText}>Aucun utilisateur</Text>
          </View>
        ) : (
          usersArr.map((user: any) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userRole}>{user.role === "admin" ? "Administrateur" : "Utilisateur"}</Text>
              </View>
              <View style={styles.userActions}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(user)}>
                  <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: "#EF4444" }]} onPress={() => {
                  Alert.alert("Supprimer l'utilisateur ?", "Cette action est irréversible.", [
                    { text: "Annuler" },
                    { text: "Supprimer", style: "destructive", onPress: () => deleteMutation.mutate(user.id) },
                  ]);
                }}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top + 16 }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{editingUser ? "Modifier" : "Créer"} un utilisateur</Text>
              <Pressable onPress={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                <Text style={[styles.modalSubmit, { color: theme.primary }]}>
                  {createMutation.isPending || updateMutation.isPending ? "..." : "Valider"}
                </Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 32 }}>
              <View style={styles.field}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput style={styles.input} placeholder="Prénom" value={formData.firstName} onChangeText={(v) => setFormData({ ...formData, firstName: v })} placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Nom</Text>
                <TextInput style={styles.input} placeholder="Nom" value={formData.lastName} onChangeText={(v) => setFormData({ ...formData, lastName: v })} placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} placeholder="Email" value={formData.email} onChangeText={(v) => setFormData({ ...formData, email: v })} placeholderTextColor={theme.textTertiary} keyboardType="email-address" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Rôle</Text>
                <View style={styles.roleSelector}>
                  <Pressable style={[styles.roleOption, formData.role === "user" && styles.roleOptionActive]} onPress={() => setFormData({ ...formData, role: "user" })}>
                    <Text style={formData.role === "user" ? styles.roleOptionTextActive : styles.roleOptionText}>Utilisateur</Text>
                  </Pressable>
                  <Pressable style={[styles.roleOption, formData.role === "admin" && styles.roleOptionActive]} onPress={() => setFormData({ ...formData, role: "admin" })}>
                    <Text style={formData.role === "admin" ? styles.roleOptionTextActive : styles.roleOptionText}>Admin</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: theme.text },
  addBtn: { backgroundColor: theme.primary, width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyText: { fontSize: 14, color: theme.textSecondary },
  userCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: theme.border },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  userEmail: { fontSize: 12, color: theme.textSecondary },
  userRole: { fontSize: 11, color: theme.primary, fontFamily: "Inter_500Medium" },
  userActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.primary + "20", justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: theme.text },
  modalSubmit: { fontFamily: "Inter_600SemiBold" },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase" },
  input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, fontFamily: "Inter_400Regular", fontSize: 14 },
  roleSelector: { flexDirection: "row", gap: 8 },
  roleOption: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center" },
  roleOptionActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  roleOptionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  roleOptionTextActive: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#fff" },
});
