import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminQuotes, adminClients } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
}

const TVA_OPTIONS = ["0", "10", "20"];

function calcTTC(item: LineItem): number {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const tva = parseFloat(item.tvaRate) || 0;
  return qty * price * (1 + tva / 100);
}

function calcTotals(items: LineItem[]): { totalHT: number; totalTVA: number; totalTTC: number } {
  let totalHT = 0;
  let totalTTC = 0;
  for (const it of items) {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPrice) || 0;
    const tva = parseFloat(it.tvaRate) || 0;
    totalHT += qty * price;
    totalTTC += qty * price * (1 + tva / 100);
  }
  return { totalHT, totalTVA: totalTTC - totalHT, totalTTC };
}

function fmtEur(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function QuoteCreateScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", tvaRate: "20" },
  ]);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const clientsArr = Array.isArray(clients) ? clients : [];
  const filteredClients = clientsArr.filter((c: any) => {
    if (!clientSearch) return true;
    const s = clientSearch.toLowerCase();
    const name = `${c.firstName || ""} ${c.lastName || ""} ${c.email || ""}`.toLowerCase();
    return name.includes(s);
  });

  const selectedClient = clientsArr.find((c: any) => c.id === selectedClientId);
  const selectedClientLabel = selectedClient
    ? `${selectedClient.firstName || ""} ${selectedClient.lastName || ""}`.trim() || selectedClient.email
    : "Sélectionner un client";

  const createMutation = useMutation({
    mutationFn: (payload: any) => adminQuotes.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (err: any) => {
      Alert.alert("Erreur", err?.message || "Impossible de créer le devis.");
    },
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const addLineItem = () => {
    setLineItems(prev => [...prev, { description: "", quantity: "1", unitPrice: "", tvaRate: "20" }]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: keyof LineItem, val: string) => {
    setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const { totalHT, totalTVA, totalTTC } = calcTotals(lineItems);

  const handleSubmit = () => {
    if (!selectedClientId) {
      Alert.alert("Attention", "Veuillez sélectionner un client.");
      return;
    }
    const validItems = lineItems.filter(it => it.description.trim() && it.unitPrice);
    if (validItems.length === 0) {
      Alert.alert("Attention", "Ajoutez au moins une prestation avec une description et un prix.");
      return;
    }

    const payload: any = {
      clientId: selectedClientId,
      status: "pending",
      notes: notes.trim() || undefined,
      description: notes.trim() || undefined,
      items: validItems.map(it => ({
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice) || 0,
        unitPriceExcludingTax: parseFloat(it.unitPrice) || 0,
        taxRate: parseFloat(it.tvaRate) || 0,
        tvaRate: parseFloat(it.tvaRate) || 0,
        totalPrice: calcTTC(it),
        totalIncludingTax: calcTTC(it),
      })),
      lineItems: validItems.map(it => ({
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice) || 0,
        unitPriceExcludingTax: parseFloat(it.unitPrice) || 0,
        taxRate: parseFloat(it.tvaRate) || 0,
        tvaRate: parseFloat(it.tvaRate) || 0,
        totalPrice: calcTTC(it),
        totalIncludingTax: calcTTC(it),
      })),
      totalHT: totalHT.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      quoteAmount: totalTTC.toFixed(2),
      amount: totalTTC.toFixed(2),
      total: totalTTC.toFixed(2),
      priceExcludingTax: totalHT.toFixed(2),
      taxAmount: totalTVA.toFixed(2),
    };

    if (vehicleBrand || vehicleModel || vehiclePlate) {
      payload.vehicleInfo = {
        brand: vehicleBrand.trim() || undefined,
        model: vehicleModel.trim() || undefined,
        plate: vehiclePlate.trim() || undefined,
      };
    }

    createMutation.mutate(payload);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouveau devis</Text>
        <Pressable
          style={[styles.submitBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitText}>Créer</Text>}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Client Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client *</Text>
          <Pressable style={styles.pickerBtn} onPress={() => setShowClientPicker(!showClientPicker)}>
            <Text style={[styles.pickerText, !selectedClient && { color: theme.textTertiary }]}>
              {selectedClientLabel}
            </Text>
            <Ionicons name={showClientPicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
          </Pressable>

          {showClientPicker && (
            <View style={styles.clientDropdown}>
              <View style={styles.clientSearch}>
                <Ionicons name="search" size={15} color={theme.textTertiary} />
                <TextInput
                  style={styles.clientSearchInput}
                  placeholder="Rechercher..."
                  placeholderTextColor={theme.textTertiary}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  autoCapitalize="none"
                />
              </View>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {clientsLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ padding: 12 }} />
                ) : filteredClients.length === 0 ? (
                  <Text style={styles.noClient}>Aucun client trouvé</Text>
                ) : (
                  filteredClients.map((c: any) => (
                    <Pressable
                      key={c.id}
                      style={[styles.clientOption, selectedClientId === c.id && { backgroundColor: theme.primary + "20" }]}
                      onPress={() => {
                        setSelectedClientId(c.id);
                        setShowClientPicker(false);
                        setClientSearch("");
                      }}
                    >
                      <Text style={[styles.clientOptionName, selectedClientId === c.id && { color: theme.primary }]}>
                        {`${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email}
                      </Text>
                      <Text style={styles.clientOptionEmail}>{c.email}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes / Description</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Description des travaux..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Véhicule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Véhicule (optionnel)</Text>
          <View style={styles.vehicleRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Marque" placeholderTextColor={theme.textTertiary} value={vehicleBrand} onChangeText={setVehicleBrand} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Modèle" placeholderTextColor={theme.textTertiary} value={vehicleModel} onChangeText={setVehicleModel} />
          </View>
          <TextInput style={styles.input} placeholder="Immatriculation" placeholderTextColor={theme.textTertiary} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prestations *</Text>
          {lineItems.map((item, idx) => (
            <View key={idx} style={[styles.lineItemCard, idx > 0 && { marginTop: 10 }]}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemLabel}>Prestation {idx + 1}</Text>
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeLineItem(idx)}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Description de la prestation"
                placeholderTextColor={theme.textTertiary}
                value={item.description}
                onChangeText={v => updateLineItem(idx, "description", v)}
              />
              <View style={styles.lineItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Qté</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={theme.textTertiary}
                    value={item.quantity}
                    onChangeText={v => updateLineItem(idx, "quantity", v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Prix HT (€)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={theme.textTertiary}
                    value={item.unitPrice}
                    onChangeText={v => updateLineItem(idx, "unitPrice", v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.fieldLabel}>TVA %</Text>
                  <View style={styles.tvaSelector}>
                    {TVA_OPTIONS.map(t => (
                      <Pressable
                        key={t}
                        style={[styles.tvaBtn, item.tvaRate === t && { backgroundColor: theme.primary }]}
                        onPress={() => updateLineItem(idx, "tvaRate", t)}
                      >
                        <Text style={[styles.tvaBtnText, item.tvaRate === t && { color: "#fff" }]}>{t}%</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.lineTotalCalc}>
                Total TTC : {fmtEur(calcTTC(item))}
              </Text>
            </View>
          ))}
          <Pressable style={styles.addLineBtn} onPress={addLineItem}>
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <Text style={styles.addLineBtnText}>Ajouter une prestation</Text>
          </Pressable>
        </View>

        {/* Totaux */}
        {totalTTC > 0 ? (
          <View style={[styles.section, { gap: 6 }]}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalValue}>{fmtEur(totalHT)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA</Text>
              <Text style={styles.totalValue}>{fmtEur(totalTVA)}</Text>
            </View>
            <View style={[styles.totalRow, { paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
              <Text style={[styles.totalLabel, { fontFamily: "Inter_700Bold", color: theme.text }]}>Total TTC</Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: theme.primary }}>{fmtEur(totalTTC)}</Text>
            </View>
          </View>
        ) : null}

        {/* Submit */}
        <Pressable
          style={[styles.createBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.createBtnText}>Créer le devis</Text>
              </>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: theme.text },
  submitBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: theme.primary, justifyContent: "center", alignItems: "center", minWidth: 60,
  },
  submitText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  section: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  pickerBtn: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: theme.background,
  },
  pickerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text, flex: 1 },
  clientDropdown: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    backgroundColor: theme.background, overflow: "hidden",
  },
  clientSearch: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  clientSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text },
  clientOption: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  clientOptionName: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text },
  clientOptionEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary, marginTop: 2 },
  noClient: { padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", color: theme.textTertiary, textAlign: "center" },
  textarea: {
    minHeight: 72, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text,
    backgroundColor: theme.background,
  },
  vehicleRow: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text,
    backgroundColor: theme.background,
  },
  lineItemCard: { backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 8 },
  lineItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineItemLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase" },
  lineItemRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: theme.textTertiary, marginBottom: 4 },
  tvaSelector: { flexDirection: "row", gap: 4 },
  tvaBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: theme.border,
    justifyContent: "center", alignItems: "center", backgroundColor: theme.surface,
  },
  tvaBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.textSecondary },
  lineTotalCalc: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.primary, textAlign: "right" },
  addLineBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 10 },
  addLineBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.primary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  totalValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.text },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: theme.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20,
  },
  createBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
