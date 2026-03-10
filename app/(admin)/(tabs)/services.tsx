import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl,
  TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminServices } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

interface ServiceForm {
  name: string;
  description: string;
  price: string;
  duration: string;
}

const emptyForm: ServiceForm = { name: "", description: "", price: "", duration: "" };

export default function AdminServicesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { isAdmin } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: services = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminServices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => {
      showAlert({ type: "error", title: "Erreur", message: e.message || "Impossible de supprimer.", buttons: [{ text: "OK", style: "primary" }] });
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      price: item.basePrice != null ? String(item.basePrice) : "",
      duration: item.estimatedDuration != null ? String(item.estimatedDuration) : "",
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Le nom du service est requis.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        basePrice: form.price ? parseFloat(form.price) : undefined,
        estimatedDuration: form.duration ? parseInt(form.duration) : undefined,
      };
      if (editingId) {
        await adminServices.update(editingId, body);
      } else {
        await adminServices.create(body);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      closeModal();
    } catch (e: any) {
      showAlert({ type: "error", title: "Erreur", message: e.message || "Une erreur est survenue.", buttons: [{ text: "OK", style: "primary" }] });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string, name: string) => {
    showAlert({
      type: "warning",
      title: "Supprimer ce service ?",
      message: `Le service "${name}" sera supprimé définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const arr = Array.isArray(services) ? services : [];
  const filtered = arr.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q);
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const price = item.basePrice != null ? `${Number(item.basePrice).toFixed(2)} €` : null;
    const duration = item.estimatedDuration != null ? `${item.estimatedDuration} min` : null;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => isAdmin && openEdit(item)}
        testID={`service-item-${item.id}`}
      >
        <View style={styles.cardRow}>
          <View style={styles.iconBox}>
            <Ionicons name="construct-outline" size={22} color={theme.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.cardMeta}>
              {price && (
                <View style={styles.metaChip}>
                  <Ionicons name="pricetag-outline" size={12} color={theme.primary} />
                  <Text style={[styles.metaText, { color: theme.primary }]}>{price}</Text>
                </View>
              )}
              {duration && (
                <View style={styles.metaChip}>
                  <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                  <Text style={styles.metaText}>{duration}</Text>
                </View>
              )}
            </View>
          </View>
          {isAdmin && (
            <View style={styles.cardActions}>
              <Pressable
                style={styles.editBtn}
                onPress={() => openEdit(item)}
                accessibilityLabel="Modifier"
              >
                <Ionicons name="pencil-outline" size={16} color={theme.primary} />
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => confirmDelete(item.id, item.name)}
                accessibilityLabel="Supprimer"
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>
            </View>
          )}
        </View>
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
        <Text style={styles.screenTitle}>Services</Text>
        {isAdmin && (
          <Pressable
            style={styles.addBtn}
            onPress={openAdd}
            accessibilityLabel="Nouveau service"
            testID="add-service-btn"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un service..."
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
        <Text style={styles.countText}>{filtered.length} service{filtered.length !== 1 ? "s" : ""}</Text>
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
          scrollEnabled={filtered.length > 0}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun service trouvé</Text>
              {isAdmin && (
                <Pressable style={styles.emptyAddBtn} onPress={openAdd}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.emptyAddText}>Ajouter un service</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={[styles.modalSheet, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "Modifier le service" : "Nouveau service"}</Text>
              <Pressable onPress={closeModal} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Nom du service *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Ex: Changement de pneus"
                  placeholderTextColor={theme.textTertiary}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldTextarea]}
                  placeholder="Description du service..."
                  placeholderTextColor={theme.textTertiary}
                  value={form.description}
                  onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Prix (€)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="0.00"
                    placeholderTextColor={theme.textTertiary}
                    value={form.price}
                    onChangeText={v => setForm(f => ({ ...f, price: v }))}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Durée (min)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="60"
                    placeholderTextColor={theme.textTertiary}
                    value={form.duration}
                    onChangeText={v => setForm(f => ({ ...f, duration: v }))}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                testID="save-service-btn"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? "Enregistrer" : "Créer le service"}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  countRow: { paddingHorizontal: 20, marginBottom: 8 },
  countText: { fontSize: 12, fontFamily: "Inter_500Medium", color: theme.textTertiary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primary + "20", justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  cardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 3 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_500Medium", color: theme.textTertiary },
  cardActions: { gap: 8, alignItems: "center" },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + "20", justifyContent: "center", alignItems: "center" },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EF444420", justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.textTertiary },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  emptyAddText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, maxHeight: "85%" },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: theme.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" },
  formField: { marginBottom: 16 },
  formRow: { flexDirection: "row", gap: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldInput: { backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text },
  fieldTextarea: { minHeight: 80, paddingTop: 12 },
  saveBtn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 8 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
