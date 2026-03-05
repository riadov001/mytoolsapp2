import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { supportApi, SupportContactData, apiCall } from "@/lib/api";
import { useCustomAlert } from "@/components/CustomAlert";

const CATEGORIES = [
  "Question générale",
  "Devis / Facturation",
  "Réservation",
  "Problème technique",
  "Autre",
];

const MAX_PHOTOS = 3;

export default function SupportScreen() {
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [name, setName] = useState(
    user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : ""
  );
  const [email, setEmail] = useState(user?.email ?? "");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = !!(name.trim() && email.trim() && subject.trim() && (message.trim() || photos.length > 0));

  const handlePickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      showAlert({
        type: "warning",
        title: "Limite atteinte",
        message: `Vous pouvez joindre au maximum ${MAX_PHOTOS} photos.`,
        buttons: [{ text: "OK", style: "primary" }],
      });
      return;
    }

    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert({
          type: "warning",
          title: "Permission refusée",
          message: "L'accès à la galerie est requis pour joindre des photos.",
          buttons: [{ text: "OK", style: "primary" }],
        });
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (uris: string[]): Promise<string[]> => {
    if (uris.length === 0) return [];
    const urls: string[] = [];
    for (const uri of uris) {
      const filename = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
      const type = filename.endsWith(".png") ? "image/png" : "image/jpeg";
      const formData = new FormData();
      if (Platform.OS === "web") {
        try {
          const response = await globalThis.fetch(uri);
          const blob = await response.blob();
          formData.append("media", blob, filename);
        } catch {
          formData.append("media", { uri, name: filename, type } as any);
        }
      } else {
        formData.append("media", { uri, name: filename, type } as any);
      }
      const result = await apiCall<any>("/api/upload", {
        method: "POST",
        body: formData,
        isFormData: true,
      });
      const url = result?.url || result?.path || result?.objectPath || result?.key || result?.fileUrl || result?.file_url || result?.imageUrl || result?.image_url;
      if (url) urls.push(url);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploading(true);
        try {
          photoUrls = await uploadPhotos(photos);
        } catch (uploadErr: any) {
          console.warn("Photo upload failed:", uploadErr?.message);
        }
        setUploading(false);
      }

      let finalMessage = message.trim();
      if (photoUrls.length > 0) {
        const photoLines = photoUrls.map(url => `\n[Photo jointe]: ${url}`).join("");
        finalMessage = finalMessage ? `${finalMessage}${photoLines}` : `Photos jointes :${photoLines}`;
      }

      const data: SupportContactData = {
        name: name.trim(),
        email: email.trim(),
        category,
        subject: subject.trim(),
        message: finalMessage,
      };
      await supportApi.contact(data);
      showAlert({
        type: "success",
        title: "Message envoyé",
        message: "Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    } catch (err: any) {
      setUploading(false);
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Une erreur est survenue. Veuillez réessayer plus tard.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.grabberBar} />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Nous contacter</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chipContainer}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Sujet</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Objet de votre demande"
              placeholderTextColor={theme.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.messageLabelRow}>
              <Text style={styles.label}>Message</Text>
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.7 }]}
                  onPress={handlePickPhoto}
                  disabled={loading}
                >
                  <Ionicons name="attach" size={18} color={theme.primary} />
                  <Text style={styles.attachBtnText}>Joindre une photo</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Décrivez votre demande..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {photos.length > 0 && (
            <View style={styles.photosField}>
              <Text style={styles.label}>Photos jointes ({photos.length}/{MAX_PHOTOS})</Text>
              <View style={styles.photosRow}>
                {photos.map((uri, index) => (
                  <View key={index} style={styles.photoWrapper}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <Pressable
                      style={styles.photoRemoveBtn}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.primary} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable style={styles.photoAddBtn} onPress={handlePickPhoto}>
                    <Ionicons name="add" size={24} color={theme.textTertiary} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitButtonText}>{uploading ? "Upload photos…" : "Envoi…"}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Envoyer</Text>
            </>
          )}
        </Pressable>
      </View>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  grabberBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.textTertiary,
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  messageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: theme.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
  },
  chipTextSelected: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: `${theme.primary}15`,
  },
  attachBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: theme.primary,
  },
  photosField: {
    marginBottom: 16,
  },
  photosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  photoWrapper: {
    position: "relative",
    width: 90,
    height: 90,
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: theme.surfaceSecondary,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: theme.background,
    borderRadius: 12,
  },
  photoAddBtn: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.surface,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonPressed: {
    backgroundColor: theme.primaryDark,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
