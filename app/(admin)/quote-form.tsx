import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminQuotes, adminClients } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente", color: "#F59E0B" },
  { value: "approved", label: "Approuvé", color: "#22C55E" },
  { value: "rejected", label: "Rejeté", color: "#EF4444" },
  { value: "converted", label: "Converti", color: "#3B82F6" },
];

export default function QuoteFormScreen() {
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
  const [quoteAmount, setQuoteAmount] = useState("");
  const [priceExcludingTax, setPriceExcludingTax] = useState("");
  const [taxRate, setTaxRate] = useState("20");
  const [notes, setNotes] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients"], queryFn: adminClients.getAll });
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["admin-quote", id],
    queryFn: () => adminQuotes.getById(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing && isEdit) {
      setClientId(String(existing.clientId || existing.client?.id || ""));
      setStatus(existing.status || "pending");
      setQuoteAmount(String(existing.quoteAmount || existing.amount || ""));
      setPriceExcludingTax(String(existing.priceExcludingTax || ""));
      setTaxRate(String(existing.taxRate || "20"));
      setNotes(existing.notes || "");
      setVehicleRegistration(existing.vehicleRegistration || "");
      setVehicleMake(existing.vehicleMake || "");
      setVehicleModel(existing.vehicleModel || "");
    }
  }, [existing]);

  useEffect(() => {
    const ht = parseFloat(priceExcludingTax) || 0;
    const rate = parseFloat(taxRate) || 0;
    const taxAmt = ht * (rate / 100);
    setQuoteAmount((ht + taxAmt).toFixed(2));
  }, [priceExcludingTax, taxRate]);

  const handleSave = async () => {
    if (!clientId) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez sélectionner un client.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!priceExcludingTax || parseFloat(priceExcludingTax) <= 0) {
      showAlert({ type: "error", title: "Erreur", message: "Le montant HT doit être supérieur à 0.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSaving(true);
    try {
      const ht = parseFloat(priceExcludingTax) || 0;
      const rate = parseFloat(taxRate) || 0;
      const taxAmount = ht * (rate / 100);
      const body = {
        clientId: clientId,
        status,
        quoteAmount: ht + taxAmount,
        priceExcludingTax: ht,
        taxRate: rate,
        taxAmount,
        notes,
        vehicleRegistration,
        vehicleMake,
        vehicleModel,
      };
      if (isEdit) {
        await adminQuotes.update(id!, body);
      } else {
        await adminQuotes.create(body);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      router.back();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || "Impossible de sauvegarder le devis.";
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
        <Text style={styles.headerTitle}>{isEdit ? "Modifier le devis" : "Nouveau devis"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Client</Text>
        <View style={styles.selectGroup}>
          {clientsArr.slice(0, 50).map((c: any) => (
            <Pressable
              key={c.id}
              style={[styles.selectChip, clientId === String(c.id) && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setClientId(String(c.id))}
            >
              <Text style={[styles.selectChipText, clientId === String(c.id) && { color: "#fff" }]}>
                {c.firstName} {c.lastName}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Statut</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map(s => (
            <Pressable
              key={s.value}
              style={[styles.statusChip, status === s.value && { backgroundColor: s.color + "20", borderColor: s.color }]}
              onPress={() => setStatus(s.value)}
            >
              <Text style={[styles.statusChipText, status === s.value && { color: s.color }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Montant HT (\u20AC)</Text>
        <TextInput style={styles.input} value={priceExcludingTax} onChangeText={setPriceExcludingTax} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.textTertiary} />

        <Text style={styles.label}>Taux TVA (%)</Text>
        <TextInput style={styles.input} value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" placeholder="20" placeholderTextColor={theme.textTertiary} />

        <Text style={styles.label}>Montant TTC (\u20AC)</Text>
        <View style={[styles.input, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: theme.text }}>{quoteAmount}</Text>
        </View>

        <Text style={styles.sectionTitle}>Véhicule</Text>
        <Text style={styles.label}>Immatriculation</Text>
        <TextInput style={styles.input} value={vehicleRegistration} onChangeText={setVehicleRegistration} placeholder="AA-123-BB" placeholderTextColor={theme.textTertiary} autoCapitalize="characters" />

        <Text style={styles.label}>Marque</Text>
        <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake} placeholder="BMW, Audi..." placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

        <Text style={styles.label}>Modèle</Text>
        <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Série 3, A4..." placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 100, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Notes internes..." placeholderTextColor={theme.textTertiary} multiline />

        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{isEdit ? "Mettre à jour" : "Créer le devis"}</Text>
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
  statusRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  statusChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.primary, borderRadius: 14, height: 52, marginTop: 20 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
