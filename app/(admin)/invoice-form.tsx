import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminInvoices, adminClients } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

interface LineItem {
  key: string;
  description: string;
  quantity: string;
  unitPriceExcludingTax: string;
  taxRate: string;
}

function genKey() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function InvoiceFormScreen() {
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
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ key: genKey(), description: "", quantity: "1", unitPriceExcludingTax: "", taxRate: "20" }]);
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients"], queryFn: adminClients.getAll });
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["admin-invoice", id],
    queryFn: () => adminInvoices.getById(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing && isEdit) {
      setClientId(String(existing.clientId || existing.client?.id || ""));
      setStatus(existing.status || "pending");
      setPaymentMethod(existing.paymentMethod || "");
      setDueDate(existing.dueDate ? existing.dueDate.split("T")[0] : "");
      setNotes(existing.notes || "");
      if (existing.items?.length) {
        setItems(existing.items.map((it: any) => ({
          key: genKey(),
          description: it.description || "",
          quantity: String(it.quantity || 1),
          unitPriceExcludingTax: String(it.unitPriceExcludingTax || ""),
          taxRate: String(it.taxRate || 20),
        })));
      }
    }
  }, [existing]);

  const calcItem = (it: LineItem) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPriceExcludingTax) || 0;
    const rate = parseFloat(it.taxRate) || 0;
    const totalHT = qty * price;
    const tax = totalHT * (rate / 100);
    return { totalHT, tax, totalTTC: totalHT + tax };
  };

  const totals = items.reduce((acc, it) => {
    const c = calcItem(it);
    return { ht: acc.ht + c.totalHT, tax: acc.tax + c.tax, ttc: acc.ttc + c.totalTTC };
  }, { ht: 0, tax: 0, ttc: 0 });

  const updateItem = (key: string, field: keyof LineItem, value: string) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, { key: genKey(), description: "", quantity: "1", unitPriceExcludingTax: "", taxRate: "20" }]);
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const handleSave = async () => {
    if (!clientId) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez sélectionner un client.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSaving(true);
    try {
      const builtItems = items.map(it => {
        const c = calcItem(it);
        return {
          description: it.description,
          quantity: parseFloat(it.quantity) || 0,
          unitPriceExcludingTax: parseFloat(it.unitPriceExcludingTax) || 0,
          totalExcludingTax: c.totalHT,
          taxRate: parseFloat(it.taxRate) || 0,
          taxAmount: c.tax,
          totalIncludingTax: c.totalTTC,
        };
      });
      const body: any = {
        clientId: clientId,
        status,
        amount: totals.ttc,
        priceExcludingTax: totals.ht,
        taxRate: 20,
        taxAmount: totals.tax,
        paymentMethod,
        notes,
        items: builtItems,
      };
      if (dueDate) body.dueDate = dueDate;
      if (isEdit) await adminInvoices.update(id, body);
      else await adminInvoices.create(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      router.back();
    } catch (err: any) {
      showAlert({ type: "error", title: "Erreur", message: err.message || "Impossible de sauvegarder.", buttons: [{ text: "OK", style: "primary" }] });
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
        <Text style={styles.headerTitle}>{isEdit ? "Modifier la facture" : "Nouvelle facture"}</Text>
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
          {[{ v: "pending", l: "En attente" }, { v: "paid", l: "Payée" }, { v: "cancelled", l: "Annulée" }].map(s => (
            <Pressable key={s.v} style={[styles.statusChip, status === s.v && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setStatus(s.v)}>
              <Text style={[styles.statusChipText, status === s.v && { color: "#fff" }]}>{s.l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Date d'échéance (AAAA-MM-JJ)</Text>
        <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-04-15" placeholderTextColor={theme.textTertiary} keyboardType="default" />

        <Text style={styles.label}>Moyen de paiement</Text>
        <TextInput style={styles.input} value={paymentMethod} onChangeText={setPaymentMethod} placeholder="CB, virement, chèque..." placeholderTextColor={theme.textTertiary} />

        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>Lignes de facture</Text>
          <Pressable style={styles.addItemBtn} onPress={addItem} accessibilityLabel="Ajouter une ligne">
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={styles.addItemText}>Ajouter</Text>
          </Pressable>
        </View>

        {items.map((item, idx) => (
          <View key={item.key} style={styles.itemCard}>
            <View style={styles.itemHeaderRow}>
              <Text style={styles.itemNumber}>Ligne {idx + 1}</Text>
              {items.length > 1 && (
                <Pressable onPress={() => removeItem(item.key)} accessibilityLabel="Supprimer la ligne">
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </Pressable>
              )}
            </View>
            <TextInput style={styles.input} placeholder="Description" placeholderTextColor={theme.textTertiary} value={item.description} onChangeText={v => updateItem(item.key, "description", v)} />
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Qté</Text>
                <TextInput style={styles.input} value={item.quantity} onChangeText={v => updateItem(item.key, "quantity", v)} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Prix HT</Text>
                <TextInput style={styles.input} value={item.unitPriceExcludingTax} onChangeText={v => updateItem(item.key, "unitPriceExcludingTax", v)} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>TVA %</Text>
                <TextInput style={styles.input} value={item.taxRate} onChangeText={v => updateItem(item.key, "taxRate", v)} keyboardType="decimal-pad" />
              </View>
            </View>
            <Text style={styles.itemTotal}>TTC: {calcItem(item).totalTTC.toFixed(2)} \u20AC</Text>
          </View>
        ))}

        <View style={styles.totalCard}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total HT</Text><Text style={styles.totalVal}>{totals.ht.toFixed(2)} \u20AC</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>TVA</Text><Text style={styles.totalVal}>{totals.tax.toFixed(2)} \u20AC</Text></View>
          <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 }]}><Text style={styles.totalLabelBold}>Total TTC</Text><Text style={styles.totalValBold}>{totals.ttc.toFixed(2)} \u20AC</Text></View>
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Notes..." placeholderTextColor={theme.textTertiary} multiline />

        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{isEdit ? "Mettre à jour" : "Créer la facture"}</Text>
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
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  miniLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: theme.textTertiary, marginBottom: 2 },
  input: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text, justifyContent: "center" },
  selectGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  selectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  selectChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.text },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  statusChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  addItemBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: theme.primary + "15" },
  addItemText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.primary },
  itemCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 8, marginTop: 8 },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemNumber: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary },
  itemRow: { flexDirection: "row", gap: 8 },
  itemTotal: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.primary, textAlign: "right" },
  totalCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 6, marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.textSecondary },
  totalVal: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text },
  totalLabelBold: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text },
  totalValBold: { fontSize: 16, fontFamily: "Inter_700Bold", color: theme.primary },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.primary, borderRadius: 14, height: 52, marginTop: 20 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
