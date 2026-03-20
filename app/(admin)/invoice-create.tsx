import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert,
  TextInput, ActivityIndicator, FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminInvoices, adminClients, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import OCRScannerModal, { OCRResult } from "@/components/OCRScannerModal";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
}

const TVA_OPTIONS = ["0", "10", "20"];

const PAYMENT_METHODS: { key: string; label: string }[] = [
  { key: "wire_transfer", label: "Virement bancaire" },
  { key: "card", label: "Carte bancaire" },
  { key: "cash", label: "Espèces" },
  { key: "sepa", label: "Prélèvement SEPA" },
  { key: "stripe", label: "Stripe" },
  { key: "klarna", label: "Klarna" },
  { key: "alma", label: "Alma" },
];

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


export default function InvoiceCreateScreen() {
  const params = useLocalSearchParams();
  const paramClientId = Array.isArray(params.clientId) ? params.clientId[0] : (params.clientId as string || "");

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(paramClientId || null);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [photos, setPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [showOCRModal, setShowOCRModal] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 10 * 60 * 1000,
  });


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

  const selectedPaymentLabel = paymentMethod
    ? PAYMENT_METHODS.find(p => p.key === paymentMethod)?.label || paymentMethod
    : "Sélectionner un mode de paiement";

  const servicesArr = Array.isArray(services) ? services : [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => adminInvoices.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: "Facture créée",
        message: "La facture a été créée avec succès.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible de créer la facture.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    },
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const handleOCRResult = (result: OCRResult) => {
    if (result.notes) setNotes(result.notes);
    if (result.paymentMethod) setPaymentMethod(result.paymentMethod);
    if (result.items && result.items.length > 0) {
      setLineItems(result.items.map(it => ({
        description: it.description || "",
        quantity: it.quantity || "1",
        unitPrice: it.unitPrice || "",
        tvaRate: it.tvaRate || "20",
      })));
    }
    if ((result.clientName || result.clientEmail) && clientsArr.length > 0) {
      const name = (result.clientName || "").toLowerCase();
      const email = (result.clientEmail || "").toLowerCase();
      const matched = clientsArr.find((c: any) => {
        const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().trim();
        return (email && c.email?.toLowerCase() === email) || (name && fullName.includes(name));
      });
      if (matched) setSelectedClientId((matched as any).id);
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { description: "", quantity: "1", unitPrice: "", tvaRate: "20" }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: keyof LineItem, val: string) => {
    setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const { totalHT, totalTVA, totalTTC } = calcTotals(lineItems);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission requise", "Acceptez l'accès à votre galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultiple: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map((a: any) => ({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}`,
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleSubmit = () => {
    if (!selectedClientId) {
      showAlert({ type: "warning", title: "Attention", message: "Veuillez sélectionner un client.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    if (photos.length === 0) {
      showAlert({ type: "warning", title: "Attention", message: "Au moins une photo est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    const validItems = lineItems.filter(it => it.description.trim() && it.unitPrice?.trim() && parseFloat(it.unitPrice) > 0);
    if (validItems.length === 0) {
      showAlert({ type: "warning", title: "Attention", message: "Veuillez remplir toutes les prestations avec une description et un prix.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    const mappedItems = validItems.map(it => {
      const qty = parseFloat(it.quantity) || 1;
      const price = parseFloat(it.unitPrice) || 0;
      const tax = parseFloat(it.tvaRate) || 0;
      return {
        description: it.description.trim(),
        quantity: qty,
        unitPrice: price.toString(),
        priceExcludingTax: price.toString(),
        taxRate: tax.toString(),
      };
    });

    const dominantTva = validItems.length > 0
      ? (parseFloat(validItems[0].tvaRate) || 20).toString()
      : "20";

    const payload: any = {
      clientId: selectedClientId,
      status: "pending",
      items: mappedItems,
      totalHT: totalHT.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      tvaRate: dominantTva,
    };

    if (notes.trim()) payload.notes = notes.trim();
    payload.issueDate = new Date().toISOString().split("T")[0];
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    payload.dueDate = dueDate.toISOString().split("T")[0];
    if (paymentMethod) payload.paymentMethod = paymentMethod;

    console.log("[INVOICE-CREATE] Payload items:", mappedItems.length, "photos:", photos.length, "totalTTC:", totalTTC);
    createMutation.mutate(payload);
  };

  return (
    <View style={styles.container}>
      {AlertComponent}
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouvelle facture</Text>
        <Pressable
          style={[styles.submitHeaderBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitHeaderText}>Créer</Text>}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* OCR Scanner Banner */}
        <Pressable
          style={[styles.ocrBanner, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "40" }]}
          onPress={() => setShowOCRModal(true)}
        >
          <View style={[styles.ocrIconBg, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="scan-outline" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ocrBannerTitle, { color: theme.primary }]}>Scanner un document</Text>
            <Text style={[styles.ocrBannerSub, { color: theme.textSecondary }]}>Pré-remplir le formulaire par OCR</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </Pressable>

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

        {/* Mode de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode de paiement (optionnel)</Text>
          <Pressable style={styles.pickerBtn} onPress={() => setShowPaymentPicker(!showPaymentPicker)}>
            <Text style={[styles.pickerText, !paymentMethod && { color: theme.textTertiary }]}>
              {selectedPaymentLabel}
            </Text>
            <Ionicons name={showPaymentPicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
          </Pressable>
          {showPaymentPicker && (
            <View style={[styles.clientDropdown, { marginTop: 4 }]}>
              {PAYMENT_METHODS.map(p => (
                <Pressable
                  key={p.key}
                  style={[styles.clientOption, paymentMethod === p.key && { backgroundColor: theme.primary + "20" }]}
                  onPress={() => {
                    setPaymentMethod(p.key);
                    setShowPaymentPicker(false);
                  }}
                >
                  <Text style={[styles.clientOptionName, paymentMethod === p.key && { color: theme.primary }]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.clientOption}
                onPress={() => {
                  setPaymentMethod(null);
                  setShowPaymentPicker(false);
                }}
              >
                <Text style={[styles.clientOptionName, { color: theme.textTertiary }]}>Non spécifié</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes / Description</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Description ou remarques..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Services disponibles */}
        {servicesArr.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services disponibles</Text>
            <FlatList
              scrollEnabled={false}
              data={servicesArr}
              keyExtractor={(s: any) => s.id}
              renderItem={({ item: service }: { item: any }) => {
                const servicePrice = service.price || service.unitPrice || service.basePrice || service.priceHT || service.priceExcludingTax || service.hourlyRate || service.rate || 0;
                return (
                  <Pressable
                    style={styles.serviceOption}
                    onPress={() => {
                      setLineItems(prev => [...prev, {
                        description: service.name || service.label || "",
                        quantity: "1",
                        unitPrice: String(servicePrice),
                        tvaRate: "20",
                      }]);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceName}>{service.name || service.label}</Text>
                      {service.description ? <Text style={styles.serviceDesc}>{service.description}</Text> : null}
                    </View>
                    <Text style={styles.servicePrice}>{fmtEur(parseFloat(String(servicePrice)))} HT</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* Photos (obligatoire) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos * (1 minimum)</Text>
          {photos.length > 0 ? (
            <FlatList
              scrollEnabled={false}
              data={photos}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.photoItem}>
                  <ExpoImage source={{ uri: item.uri }} style={styles.photoThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  {photos.length > 1 && (
                    <Pressable onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              )}
            />
          ) : null}
          {photos.length < 3 && (
            <Pressable style={styles.addPhotoBtn} onPress={pickPhoto}>
              <Ionicons name="image-outline" size={18} color={theme.primary} />
              <Text style={styles.addPhotoBtnText}>Ajouter des photos ({photos.length}/3)</Text>
            </Pressable>
          )}
        </View>

        {/* Prestations */}
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
                editable
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
                    editable
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
                    editable
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
              <Text style={styles.lineTotalCalc}>Total TTC : {fmtEur(calcTTC(item))}</Text>
            </View>
          ))}
          <Pressable style={styles.addLineBtn} onPress={addLineItem}>
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <Text style={styles.addLineBtnText}>Ajouter une prestation</Text>
          </Pressable>
        </View>

        {/* Totaux */}
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
      </ScrollView>

      <OCRScannerModal
        visible={showOCRModal}
        mode="invoice"
        onResult={handleOCRResult}
        onClose={() => setShowOCRModal(false)}
      />
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: theme.text, flex: 1, textAlign: "center" },
    submitHeaderBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    submitHeaderText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    section: { gap: 8 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: theme.text },
    pickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.cardBackground,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text },
    clientDropdown: {
      marginTop: 6,
      backgroundColor: theme.cardBackground,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    clientSearch: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    clientSearchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: theme.text,
    },
    clientOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 2,
    },
    clientOptionName: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text },
    clientOptionEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary },
    noClient: { paddingHorizontal: 12, paddingVertical: 12, color: theme.textTertiary },
    input: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.cardBackground,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: theme.text,
    },
    textarea: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.cardBackground,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: theme.text,
      minHeight: 80,
    },
    serviceOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.cardBackground,
      borderRadius: 6,
      marginVertical: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    serviceName: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text, flex: 1 },
    serviceDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textTertiary, marginTop: 2 },
    servicePrice: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.primary },
    photoItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.cardBackground,
      borderRadius: 6,
      marginVertical: 4,
    },
    photoThumb: { width: 50, height: 50, borderRadius: 6 },
    photoName: { fontSize: 13, fontFamily: "Inter_400Regular", color: theme.text, flex: 1 },
    addPhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      backgroundColor: theme.primary + "10",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      marginVertical: 8,
    },
    addPhotoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.primary },
    lineItemCard: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.cardBackground,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    lineItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lineItemLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.text },
    lineItemRow: {
      flexDirection: "row",
      gap: 10,
    },
    fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary, marginBottom: 4 },
    tvaSelector: {
      flexDirection: "row",
      gap: 4,
    },
    tvaBtn: {
      flex: 1,
      paddingVertical: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      alignItems: "center",
    },
    tvaBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: theme.text },
    lineTotalCalc: { fontSize: 12, fontFamily: "Inter_500Medium", color: theme.primary, marginTop: 4 },
    addLineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      backgroundColor: theme.primary + "10",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      marginVertical: 8,
    },
    addLineBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.primary },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.textTertiary },
    totalValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.text },
    ocrBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    ocrIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    ocrBannerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    ocrBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  });
}
