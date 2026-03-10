import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator,
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

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente", color: "#F59E0B" },
  { value: "confirmed", label: "Confirmé", color: "#22C55E" },
  { value: "cancelled", label: "Annulé", color: "#EF4444" },
  { value: "completed", label: "Terminé", color: "#3B82F6" },
];

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
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
  const [status, setStatus] = useState("pending");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients"], queryFn: adminClients.getAll });
  const { data: services = [] } = useQuery({ queryKey: ["admin-services"], queryFn: adminServices.getAll });
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["admin-reservation", id],
    queryFn: () => adminReservations.getById(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing && isEdit) {
      setClientId(String(existing.clientId || existing.client?.id || ""));
      setStatus(existing.status || "pending");
      if (existing.scheduledDate) {
        const d = new Date(existing.scheduledDate);
        setScheduledDate(d.toISOString().split("T")[0]);
        const h = d.getHours().toString().padStart(2, "0");
        const m = d.getMinutes().toString().padStart(2, "0");
        setScheduledTime(`${h}:${m}`);
      }
      setNotes(existing.notes || "");
      setVehicleRegistration(existing.vehicleRegistration || "");
      setVehicleMake(existing.vehicleMake || "");
      setVehicleModel(existing.vehicleModel || "");
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
      showAlert({ type: "error", title: "Erreur", message: "Veuillez indiquer une date.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSaving(true);
    try {
      let dateStr = scheduledDate;
      if (scheduledTime) dateStr += `T${scheduledTime}:00`;
      const servicesArr = Array.isArray(services) ? services : [];
      const fallbackServiceId = servicesArr[0]?.id || serviceId;
      const body: any = {
        clientId: clientId,
        status,
        scheduledDate: dateStr,
        notes,
        vehicleRegistration,
        vehicleMake,
        vehicleModel,
        serviceType,
      };
      if (fallbackServiceId) body.serviceId = fallbackServiceId;
      if (isEdit) await adminReservations.update(id, body);
      else await adminReservations.create(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      router.back();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || "Impossible de sauvegarder la réservation.";
      showAlert({ type: "error", title: "Erreur", message: errMsg, buttons: [{ text: "OK", style: "primary" }] });
    } finally {
      setSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;
  const clientsArr = Array.isArray(clients) ? clients : [];

  if (isEdit && loadingExisting) {
    return <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
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

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Client</Text>
        <View style={styles.selectGroup}>
          {clientsArr.slice(0, 50).map((c: any) => (
            <Pressable key={c.id} style={[styles.selectChip, clientId === String(c.id) && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setClientId(String(c.id))}>
              <Text style={[styles.selectChipText, clientId === String(c.id) && { color: "#fff" }]}>{c.firstName} {c.lastName}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Statut</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map(s => (
            <Pressable key={s.value} style={[styles.statusChip, status === s.value && { backgroundColor: s.color + "20", borderColor: s.color }]} onPress={() => setStatus(s.value)}>
              <Text style={[styles.statusChipText, status === s.value && { color: s.color }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Date (AAAA-MM-JJ)</Text>
        <TextInput style={styles.input} value={scheduledDate} onChangeText={setScheduledDate} placeholder="2026-04-15" placeholderTextColor={theme.textTertiary} />

        <Text style={styles.label}>Créneau horaire</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map(t => (
            <Pressable key={t} style={[styles.timeChip, scheduledTime === t && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setScheduledTime(t)}>
              <Text style={[styles.timeText, scheduledTime === t && { color: "#fff" }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Type de service</Text>
        <TextInput style={styles.input} value={serviceType} onChangeText={setServiceType} placeholder="Changement pneus, vidange..." placeholderTextColor={theme.textTertiary} />

        <Text style={styles.sectionTitle}>Véhicule</Text>
        <Text style={styles.label}>Immatriculation</Text>
        <TextInput style={styles.input} value={vehicleRegistration} onChangeText={setVehicleRegistration} placeholder="AA-123-BB" placeholderTextColor={theme.textTertiary} autoCapitalize="characters" />

        <Text style={styles.label}>Marque</Text>
        <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake} placeholder="BMW, Audi..." placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

        <Text style={styles.label}>Modèle</Text>
        <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Série 3, A4..." placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 100, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Notes..." placeholderTextColor={theme.textTertiary} multiline />

        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} onPress={handleSave} disabled={saving}>
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
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: theme.text },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text, marginTop: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  input: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text, justifyContent: "center" },
  selectGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  selectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  selectChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.text },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  statusChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  timeText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.primary, borderRadius: 14, height: 52, marginTop: 20 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
