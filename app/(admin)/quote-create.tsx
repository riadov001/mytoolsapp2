import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Alert, FlatList,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminQuotes, adminClients, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
  fromServiceId?: string;
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
  const [photos, setPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showServicesPicker, setShowServicesPicker] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", tvaRate: "20" },
  ]);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 10 * 60 * 1000,
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

  const servicesArr = Array.isArray(services) ? services : [];

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSelection = prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId];
      
      if (newSelection.length > 0) {
        const selectedServiceObjs = servicesArr.filter((s: any) => newSelection.includes(s.id));
        const serviceItems: LineItem[] = selectedServiceObjs.map((s: any) => ({
          description: s.name || s.label || "",
          quantity: "1",
          unitPrice: String(s.price || s.unitPrice || s.basePrice || s.priceHT || s.priceExcludingTax || s.hourlyRate || s.rate || 0),
          tvaRate: String(s.taxRate || s.tvaRate || "20"),
          fromServiceId: s.id,
        }));
        setLineItems(prev => {
          const freeFormItems = prev.filter(it => !it.fromServiceId && it.description.trim());
          return [...serviceItems, ...freeFormItems];
        });
      } else if (newSelection.length === 0) {
        setLineItems(prev => {
          const freeFormItems = prev.filter(it => !it.fromServiceId && it.description.trim());
          return freeFormItems.length > 0 ? freeFormItems : [{ description: "", quantity: "1", unitPrice: "", tvaRate: "20" }];
        });
      }
      return newSelection;
    });
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
      Alert.alert("Attention", "Veuillez sélectionner un client.");
      return;
    }
    if (photos.length > 3) {
      Alert.alert("Attention", "Maximum 3 photos autorisées.");
      return;
    }
    const validItems = lineItems.filter(it => it.description.trim() && it.unitPrice?.trim() && parseFloat(it.unitPrice) > 0);
    if (validItems.length === 0) {
      Alert.alert("Attention", "Ajoutez au moins une prestation avec une description et un prix.");
      return;
    }

    const payload: any = {
      clientId: selectedClientId,
      serviceId: selectedServices[0],
      status: "pending",
      notes: notes.trim() || undefined,
      description: notes.trim() || undefined,
      items: validItems.map(it => {
        const qty = parseFloat(it.quantity) || 1;
        const price = parseFloat(it.unitPrice) || 0;
        const tax = parseFloat(it.tvaRate) || 0;
        const totalHT = qty * price;
        const totalTTCItem = totalHT * (1 + tax / 100);
        return {
          description: it.description.trim(),
          quantity: qty,
          unitPrice: price,
          unitPriceExcludingTax: price,
          taxRate: tax,
          tvaRate: tax,
          totalPrice: totalTTCItem,
          totalIncludingTax: totalTTCItem,
          totalExcludingTax: totalHT,
        };
      }),
      lineItems: validItems.map(it => {
        const qty = parseFloat(it.quantity) || 1;
        const price = parseFloat(it.unitPrice) || 0;
        const tax = parseFloat(it.tvaRate) || 0;
        const totalHT = qty * price;
        const totalTTCItem = totalHT * (1 + tax / 100);
        return {
          description: it.description.trim(),
          quantity: qty,
          unitPrice: price,
          unitPriceExcludingTax: price,
          taxRate: tax,
          tvaRate: tax,
          totalPrice: totalTTCItem,
          totalIncludingTax: totalTTCItem,
          totalExcludingTax: totalHT,
        };
      }),
      totalHT: totalHT.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      totalAmount: totalTTC.toFixed(2),
      quoteAmount: totalTTC.toFixed(2),
      amount: totalTTC.toFixed(2),
      total: totalTTC.toFixed(2),
      priceExcludingTax: totalHT.toFixed(2),
      totalExcludingTax: totalHT.toFixed(2),
      taxAmount: totalTVA.toFixed(2),
    };

    if (vehicleBrand || vehicleModel || vehiclePlate) {
      payload.vehicleInfo = {
        brand: vehicleBrand.trim() || undefined,
        model: vehicleModel.trim() || undefined,
        plate: vehiclePlate.trim() || undefined,
      };
    }

    if (photos.length > 0) {
      payload.photos = photos.map(p => p.uri);
      payload.attachments = photos;
    }

    if (selectedServices.length > 0) {
      payload.selectedServices = selectedServices;
      payload.services = servicesArr.filter((s: any) => selectedServices.includes(s.id));
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
          <TextInput style={styles.input} placeholder="Marque" placeholderTextColor={theme.textTertiary} value={vehicleBrand} onChangeText={setVehicleBrand} />
          <TextInput style={styles.input} placeholder="Modèle" placeholderTextColor={theme.textTertiary} value={vehicleModel} onChangeText={setVehicleModel} />
          <TextInput style={styles.input} placeholder="Immatriculation" placeholderTextColor={theme.textTertiary} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
        </View>

        {/* Services */}
        {servicesArr.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services *</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowServicesPicker(!showServicesPicker)}>
              <Text style={[styles.pickerText, selectedServices.length === 0 && { color: theme.textTertiary }]}>
                {selectedServices.length === 0 ? "Sélectionner des services" : `${selectedServices.length} service(s) sélectionné(s)`}
              </Text>
              <Ionicons name={showServicesPicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
            </Pressable>
            {showServicesPicker && (
              <FlatList
                scrollEnabled={false}
                data={servicesArr}
                keyExtractor={(s: any) => s.id}
                renderItem={({ item: service }: { item: any }) => {
                  const servicePrice = service.price || service.unitPrice || service.basePrice || service.priceHT || service.priceExcludingTax || service.hourlyRate || service.rate || 0;
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <Pressable
                      style={[styles.serviceOption, isSelected && { backgroundColor: theme.primary + "20" }]}
                      onPress={() => toggleService(service.id)}
                    >
                      <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={18} color={isSelected ? theme.primary : theme.textTertiary} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.serviceName, isSelected && { color: theme.primary }, { flex: 1 }]}>{service.name || service.label}</Text>
                          <Text style={[styles.servicePrice, isSelected && { color: theme.primary }]}>
                            {fmtEur(parseFloat(String(servicePrice)))} HT
                          </Text>
                        </View>
                        {service.description ? <Text style={styles.serviceDesc}>{service.description}</Text> : null}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        ) : null}

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos (optionnel, maximum 3)</Text>
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

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prestations *</Text>
          {lineItems.map((item, idx) => {
            const isLocked = !!item.fromServiceId;
            return (
              <View key={idx} style={[styles.lineItemCard, idx > 0 && { marginTop: 10 }]}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.lineItemLabel}>
                    Prestation {idx + 1}
                    {isLocked ? "  " : ""}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {isLocked && (
                      <Ionicons name="lock-closed" size={13} color={theme.textTertiary} />
                    )}
                    <Pressable onPress={() => {
                      if (isLocked) {
                        setSelectedServices(prev => prev.filter(id => id !== item.fromServiceId));
                      }
                      removeLineItem(idx);
                    }}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
                {isLocked ? (
                  <Text style={styles.lockedText}>{item.description}</Text>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder="Description de la prestation"
                    placeholderTextColor={theme.textTertiary}
                    value={item.description}
                    onChangeText={v => updateLineItem(idx, "description", v)}
                  />
                )}
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
                    {isLocked ? (
                      <Text style={styles.lockedFieldValue}>{item.unitPrice} €</Text>
                    ) : (
                      <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        placeholderTextColor={theme.textTertiary}
                        value={item.unitPrice}
                        onChangeText={v => updateLineItem(idx, "unitPrice", v)}
                        keyboardType="decimal-pad"
                      />
                    )}
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.fieldLabel}>TVA %</Text>
                    {isLocked ? (
                      <Text style={styles.lockedFieldValue}>{item.tvaRate}%</Text>
                    ) : (
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
                    )}
                  </View>
                </View>
                <Text style={styles.lineTotalCalc}>
                  Total TTC : {fmtEur(calcTTC(item))}
                </Text>
              </View>
            );
          })}
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
  serviceOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  serviceName: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text },
  serviceDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
  servicePrice: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: theme.textSecondary, marginLeft: 8 },
  lockedText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
  },
  lockedFieldValue: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
  },
  photoItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, marginVertical: 4, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 8 },
  photoThumb: { width: 50, height: 50, borderRadius: 6 },
  photoName: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 10, marginTop: 8 },
  addPhotoBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.primary },
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
