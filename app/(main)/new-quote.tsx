import React, { useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { servicesApi, Service, apiCall } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { useCustomAlert } from "@/components/CustomAlert";

interface UploadedPhoto { uri: string; key: string; }

export default function NewQuoteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ serviceId?: string }>();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [selectedServices, setSelectedServices] = useState<string[]>(params.serviceId ? [params.serviceId] : []);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.getAll,
  });

  const MAX_PHOTOS = 3;

  const toggleService = (id: string) => {
    setSelectedServices((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pickImages = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert({ type: "warning", title: "Permission requise", message: "Veuillez autoriser l'accès à votre galerie.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: remaining > 1,
      quality: 0.7,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newPhotos: UploadedPhoto[] = result.assets.map((asset) => ({
        uri: asset.uri,
        key: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showAlert({ type: "warning", title: "Permission requise", message: "Veuillez autoriser l'accès à la caméra.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      const photo: UploadedPhoto = { uri: result.assets[0].uri, key: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      setPhotos((prev) => [...prev, photo].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez sélectionner au moins un service.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (photos.length < MAX_PHOTOS) {
      showAlert({ type: "warning", title: "Photos requises", message: `Veuillez ajouter ${MAX_PHOTOS} photos de vos jantes (${photos.length}/${MAX_PHOTOS} ajoutées).`, buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      for (const photo of photos) {
        if (Platform.OS === "web") {
          const response = await globalThis.fetch(photo.uri);
          const blob = await response.blob();
          formData.append("images", blob, `photo_${Date.now()}.jpg`);
        } else {
          formData.append("images", { uri: photo.uri, name: `photo_${Date.now()}.jpg`, type: "image/jpeg" } as any);
        }
      }
      formData.append("serviceId", selectedServices[0]);
      formData.append("paymentMethod", "wire_transfer");
      formData.append("requestDetails", notes.trim() || "Demande via application mobile");
      formData.append("vehicleInfo", JSON.stringify({ notes }));

      await apiCall("/api/mobile/quotes", { method: "POST", body: formData, isFormData: true });

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: "Demande envoyée !",
        message: "Votre demande de devis a été envoyée avec succès. Nous vous recontacterons rapidement.",
        buttons: [{ text: "OK", onPress: () => router.push("/(main)/(tabs)/quotes"), style: "primary" }],
      });
    } catch (err: any) {
      showAlert({ type: "error", title: "Erreur", message: err.message || "Impossible d'envoyer la demande.", buttons: [{ text: "OK", style: "primary" }] });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedServices.length > 0 && photos.length >= MAX_PHOTOS && !submitting;
  const safeServices = Array.isArray(services) ? services : [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouveau devis</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 34 + 120 : insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Choisir un ou plusieurs services</Text>
          </View>
          {loadingServices ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <View style={styles.servicesContainer}>
              {safeServices.filter((s: Service) => s.isActive).map((service: Service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <Pressable
                    key={service.id}
                    style={[styles.serviceItem, isSelected && styles.serviceItemSelected]}
                    onPress={() => toggleService(service.id)}
                  >
                    <View style={styles.serviceCheck}>
                      {isSelected
                        ? <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                        : <Ionicons name="ellipse-outline" size={22} color={theme.textTertiary} />}
                    </View>
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceItemName, isSelected && styles.serviceItemNameSelected]}>
                        {(service.name || "").trim()}
                      </Text>
                      {parseFloat(service.basePrice || "0") > 0 && (
                        <Text style={styles.serviceItemPrice}>{parseFloat(service.basePrice || "0").toFixed(2)} € HT</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>
              Photos de vos jantes <Text style={styles.required}>({MAX_PHOTOS} requises)</Text>
            </Text>
          </View>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <Pressable style={styles.photoRemoveBtn} onPress={() => removePhoto(index)}>
                  <Ionicons name="close-circle" size={22} color={theme.primary} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <Pressable
                  style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]}
                  onPress={pickImages}
                >
                  <Ionicons name="images-outline" size={24} color={theme.primary} />
                  <Text style={styles.addPhotoText}>Galerie</Text>
                </Pressable>
                {Platform.OS !== "web" && (
                  <Pressable
                    style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]}
                    onPress={takePhoto}
                  >
                    <Ionicons name="camera-outline" size={24} color={theme.primary} />
                    <Text style={styles.addPhotoText}>Photo</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
          <Text style={[styles.photoHint, photos.length >= MAX_PHOTOS && styles.photoHintOk]}>
            {photos.length >= MAX_PHOTOS
              ? `✓ ${MAX_PHOTOS} photos ajoutées`
              : `${photos.length}/${MAX_PHOTOS} photos — ${MAX_PHOTOS - photos.length} photo${MAX_PHOTOS - photos.length > 1 ? "s" : ""} manquante${MAX_PHOTOS - photos.length > 1 ? "s" : ""}`}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Notes complémentaires</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Décrivez votre besoin, l'état de vos jantes, etc."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Vos informations</Text>
          </View>
          <View style={styles.userInfoCard}>
            <View style={styles.userInfoRow}>
              <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.userInfoText}>{user?.email}</Text>
            </View>
            {user?.firstName && (
              <View style={styles.userInfoRow}>
                <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
                <Text style={styles.userInfoText}>{user.firstName} {user.lastName}</Text>
              </View>
            )}
            {user?.phone && (
              <View style={styles.userInfoRow}>
                <Ionicons name="call-outline" size={16} color={theme.textSecondary} />
                <Text style={styles.userInfoText}>{user.phone}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 10 }]}>
        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && canSubmit && { opacity: 0.9 }, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : (<>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Envoyer la demande</Text>
              </>)
          }
        </Pressable>
      </View>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: theme.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: theme.text },
  required: { fontSize: 13, fontFamily: "Inter_400Regular", color: theme.primary },
  servicesContainer: { gap: 6 },
  serviceItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: theme.border,
  },
  serviceItemSelected: { borderColor: theme.primary, backgroundColor: theme.primary + "12" },
  serviceCheck: { marginRight: 12 },
  serviceInfo: { flex: 1 },
  serviceItemName: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.text },
  serviceItemNameSelected: { fontFamily: "Inter_600SemiBold", color: theme.primary },
  serviceItemPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 2 },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoItem: { width: 100, height: 100, borderRadius: 10, overflow: "hidden" },
  photoImage: { width: "100%", height: "100%" },
  photoRemoveBtn: { position: "absolute", top: 2, right: 2, backgroundColor: theme.background, borderRadius: 11 },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: 10,
    backgroundColor: theme.surface, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: theme.border, borderStyle: "dashed" as any, gap: 4,
  },
  addPhotoBtnPressed: { backgroundColor: theme.surfaceSecondary },
  addPhotoText: { fontSize: 11, fontFamily: "Inter_500Medium", color: theme.primary },
  photoHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textSecondary, marginTop: 8 },
  photoHintOk: { color: "#22C55E" },
  notesInput: {
    backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1,
    borderColor: theme.border, padding: 14, fontSize: 15,
    fontFamily: "Inter_400Regular", color: theme.text, minHeight: 100,
  },
  userInfoCard: {
    backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1,
    borderColor: theme.border, padding: 14, gap: 8,
  },
  userInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userInfoText: { fontSize: 14, fontFamily: "Inter_400Regular", color: theme.text },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
    paddingHorizontal: 20, paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: theme.primary, borderRadius: 12, height: 52,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
