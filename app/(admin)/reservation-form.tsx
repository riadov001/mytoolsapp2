import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform,
  ActivityIndicator, FlatList, Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminReservations, adminClients, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { DateTimeSlotPickerButton } from "./components/DateTimeSlotPicker";

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente", color: "#F59E0B" },
  { value: "confirmed", label: "Confirmé", color: "#22C55E" },
  { value: "cancelled", label: "Annulé", color: "#EF4444" },
  { value: "completed", label: "Terminé", color: "#3B82F6" },
];


export default function ReservationFormScreen() {
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (typeof rawId === "string" ? rawId : "");
  const isEdit = id.length > 0;
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [status, setStatus] = useState("pending");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients"], queryFn: adminClients.getAll });
  const { data: services = [] } = useQuery({ queryKey: ["admin-services"], queryFn: adminServices.getAll });
  const { data: existing, isLoading: loadingExisting, error: loadingError } = useQuery({
    queryKey: ["admin-reservation", id],
    queryFn: async () => {
      try {
        return await adminReservations.getById(id);
      } catch {
        const list = queryClient.getQueryData<any[]>(["admin-reservations"]) || [];
        const found = list.find((r: any) => r.id === id);
        if (found) return found;
        throw new Error("Rendez-vous introuvable");
      }
    },
    enabled: isEdit,
    retry: 0,
  });

  useEffect(() => {
    if (existing && isEdit) {
      setClientId(String(existing.clientId || existing.client?.id || ""));
      setStatus(existing.status || "pending");
      if (existing.scheduledDate) {
        const d = new Date(existing.scheduledDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        setScheduledDate(key);
        setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        const h = d.getHours().toString().padStart(2, "0");
        const m = d.getMinutes().toString().padStart(2, "0");
        setScheduledTime(`${h}:${m}`);
      }
      setNotes(existing.notes || "");
      setVehiclePlate(existing.vehicleInfo?.plate || existing.vehicleRegistration || "");
      setVehicleBrand(existing.vehicleInfo?.brand || existing.vehicleMake || "");
      setVehicleModel(existing.vehicleInfo?.model || existing.vehicleModel || "");
      setVehicleYear(existing.vehicleInfo?.year || "");
      setServiceType(existing.serviceType || "");
      setServiceId(existing.serviceId || "");
    }
  }, [existing]);

  const handleSave = async () => {
    if (!clientId) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez sélectionner un client.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!scheduledDate) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez sélectionner une date.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSaving(true);
    try {
      let dateStr = scheduledDate;
      let timeSlot = "09:00-10:30";
      if (scheduledTime) {
        const [h, m] = scheduledTime.split(":");
        const startTime = scheduledTime;
        const endHour = String(parseInt(h) + 1).padStart(2, "0");
        const endMin = "30";
        timeSlot = `${startTime}-${endHour}:${endMin}`;
        dateStr += `T${scheduledTime}:00`;
      }
      const servicesArr = Array.isArray(services) ? services : [];
      const resolvedServiceId = serviceId || servicesArr[0]?.id || undefined;
      const body: any = {
        clientId,
        status,
        scheduledDate: dateStr,
        timeSlot,
        notes,
        vehicleInfo: {
          brand: vehicleBrand,
          model: vehicleModel,
          plate: vehiclePlate,
          year: vehicleYear ? parseInt(vehicleYear) : undefined,
        },
        serviceType,
      };
      if (resolvedServiceId) body.serviceId = resolvedServiceId;
      if (isEdit) await adminReservations.update(id, body);
      else await adminReservations.create(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["admin-reservation", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      router.back();
    } catch (err: any) {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de sauvegarder la réservation.", buttons: [{ text: "OK", style: "primary" }] });
    } finally {
      setSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;
  const clientsArr = Array.isArray(clients) ? clients : [];
  const servicesArr = Array.isArray(services) ? services : [];
  const selectedClient = clientsArr.find((c: any) => String(c.id) === clientId);
  const filteredClients = clientSearch
    ? clientsArr.filter((c: any) => {
        const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
        return fullName.includes(clientSearch.toLowerCase()) || (c.email || "").toLowerCase().includes(clientSearch.toLowerCase());
      })
    : clientsArr;

  if (isEdit && loadingExisting) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (isEdit && loadingError && !existing) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", gap: 16 }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={{ fontSize: 16, color: theme.text, textAlign: "center", paddingHorizontal: 32 }}>
          Impossible de charger les données du rendez-vous.
        </Text>
        <Pressable style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.primary, borderRadius: 12 }} onPress={() => router.back()}>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Modifier le RDV" : "Nouveau rendez-vous"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Modal visible={showClientList} animationType="slide" onRequestClose={() => setShowClientList(false)}>
        <View style={[styles.container, { paddingTop: topPad }]}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.backBtn} onPress={() => { setShowClientList(false); setClientSearch(""); }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Sélectionner un client</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={theme.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher par nom ou email..."
                placeholderTextColor={theme.textTertiary}
                value={clientSearch}
                onChangeText={setClientSearch}
                autoFocus
              />
              {clientSearch.length > 0 && (
                <Pressable onPress={() => setClientSearch("")}>
                  <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>
          <FlatList
            data={filteredClients}
            keyExtractor={(c: any) => String(c.id)}
            renderItem={({ item }: { item: any }) => {
              const selected = clientId === String(item.id);
              return (
                <Pressable
                  style={[styles.clientRow, selected && { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}
                  onPress={() => { setClientId(String(item.id)); setShowClientList(false); setClientSearch(""); }}
                >
                  <View style={[styles.clientAvatar, { backgroundColor: selected ? theme.primary : theme.primary + "20" }]}>
                    <Text style={[styles.clientAvatarText, { color: selected ? "#fff" : theme.primary }]}>
                      {(item.firstName?.[0] || "").toUpperCase()}{(item.lastName?.[0] || "").toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, selected && { color: theme.primary }]}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.clientEmail}>{item.email}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </Pressable>
              );
            }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad }}
            scrollEnabled={filteredClients.length > 0}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <Ionicons name="people-outline" size={40} color={theme.textTertiary} />
                <Text style={{ color: theme.textTertiary, marginTop: 8 }}>Aucun client trouvé</Text>
              </View>
            }
          />
        </View>
      </Modal>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Client *</Text>
        <Pressable
          style={[styles.selectorBtn, selectedClient && { borderColor: theme.primary }]}
          onPress={() => setShowClientList(true)}
        >
          {selectedClient ? (
            <View style={styles.selectorContent}>
              <View style={[styles.clientAvatar, { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + "20" }]}>
                <Text style={[styles.clientAvatarText, { fontSize: 12, color: theme.primary }]}>
                  {(selectedClient.firstName?.[0] || "").toUpperCase()}{(selectedClient.lastName?.[0] || "").toUpperCase()}
                </Text>
              </View>
              <Text style={styles.selectorText}>{selectedClient.firstName} {selectedClient.lastName}</Text>
            </View>
          ) : (
            <Text style={[styles.selectorText, { color: theme.textTertiary }]}>Sélectionner un client...</Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </Pressable>

        <Text style={styles.label}>Statut</Text>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map(s => (
            <Pressable key={s.value} style={[styles.chip, status === s.value && { backgroundColor: s.color + "20", borderColor: s.color }]} onPress={() => setStatus(s.value)}>
              <Text style={[styles.chipText, status === s.value && { color: s.color }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Date *</Text>
        <DateTimeSlotPickerButton
          selectedDate={scheduledDate}
          selectedTime={scheduledTime}
          onSelect={(date, time) => {
            setScheduledDate(date);
            setScheduledTime(time);
          }}
        />

        {servicesArr.length > 0 && (
          <>
            <Text style={styles.label}>Service</Text>
            <View style={styles.chipRow}>
              {servicesArr.map((svc: any) => (
                <Pressable
                  key={svc.id}
                  style={[styles.chip, serviceId === svc.id && { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}
                  onPress={() => { setServiceId(svc.id); setServiceType(svc.name); }}
                >
                  <Text style={[styles.chipText, serviceId === svc.id && { color: theme.primary }]}>{svc.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Type de service</Text>
        <TextInput
          style={styles.input}
          value={serviceType}
          onChangeText={setServiceType}
          placeholder="Changement pneus, vidange..."
          placeholderTextColor={theme.textTertiary}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Véhicule</Text>
        <TextInput style={styles.input} value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="Immatriculation (AA-123-BB)" placeholderTextColor={theme.textTertiary} autoCapitalize="characters" />
        <TextInput style={[styles.input, { marginTop: 8 }]} value={vehicleBrand} onChangeText={setVehicleBrand} placeholder="Marque (BMW, Audi...)" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />
        <TextInput style={[styles.input, { marginTop: 8 }]} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Modèle (Série 3, A4...)" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />
        <TextInput style={[styles.input, { marginTop: 8 }]} value={vehicleYear} onChangeText={setVehicleYear} placeholder="Année (2021)" placeholderTextColor={theme.textTertiary} keyboardType="number-pad" />

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 100, textAlignVertical: "top", paddingTop: 12 }]} value={notes} onChangeText={setNotes} placeholder="Notes..." placeholderTextColor={theme.textTertiary} multiline />

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{isEdit ? "Mettre à jour" : "Créer le rendez-vous"}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: theme.text },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  input: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text },
  selectorBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, height: 52, marginTop: 4 },
  selectorContent: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  selectorText: { fontSize: 15, fontFamily: "Inter_500Medium", color: theme.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 8 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  clientAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  clientName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text },
  clientEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary, marginTop: 2 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.primary, borderRadius: 14, height: 52, marginTop: 20 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  calNavBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center" },
  calMonthLabel: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: theme.text },
  calDaysHeader: { flexDirection: "row", marginBottom: 4 },
  calDayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, paddingVertical: 6 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.285%", aspectRatio: 1, justifyContent: "center", alignItems: "center" },
  calCellText: { fontSize: 15, fontFamily: "Inter_500Medium", color: theme.text },
});
