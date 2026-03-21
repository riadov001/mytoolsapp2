import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator, Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminClients } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { setPendingNewClientId } from "@/lib/new-client-store";

const ROLE_OPTIONS = [
  { value: "client", label: "Particulier" },
  { value: "client_professionnel", label: "Professionnel" },
];

export default function ClientFormScreen() {
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (typeof rawId === "string" ? rawId : "");
  const isEdit = id.length > 0;
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : (params.returnTo as string || "");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [role, setRole] = useState("client");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: existing, isLoading: loadingExisting, error: loadingError } = useQuery({
    queryKey: ["admin-client", id],
    queryFn: () => adminClients.getById(id),
    enabled: isEdit,
    retry: 1,
  });

  useEffect(() => {
    if (existing && isEdit) {
      setEmail(existing.email || "");
      setFirstName(existing.firstName || "");
      setLastName(existing.lastName || "");
      setPhone(existing.phone || "");
      setAddress(existing.address || "");
      setCity(existing.city || "");
      setPostalCode(existing.postalCode || "");
      setRole(existing.role || "client");
      setCompanyName(existing.companyName || "");
    }
  }, [existing]);

  const handleSave = async () => {
    if (!email.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "L'email est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Le prénom et le nom sont obligatoires.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!isEdit && !password.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Le mot de passe est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!isEdit && password.length < 8) {
      showAlert({ type: "error", title: "Erreur", message: "Le mot de passe doit contenir au moins 8 caractères.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!isEdit && password !== passwordConfirm) {
      showAlert({ type: "error", title: "Erreur", message: "Les mots de passe ne correspondent pas.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        role,
      };
      if (role === "client_professionnel" && companyName.trim()) {
        body.companyName = companyName.trim();
      }
      if (!isEdit && password.trim()) {
        body.password = password.trim();
      }
      if (isEdit) {
        await adminClients.update(id, body);
      } else {
        const result = await adminClients.create(body);
        if (returnTo && result?.id) {
          setPendingNewClientId(String(result.id));
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["admin-client", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      router.back();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || "Impossible de sauvegarder le client.";
      showAlert({ type: "error", title: "Erreur", message: errMsg, buttons: [{ text: "OK", style: "primary" }] });
    } finally {
      setSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

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
          Impossible de charger les données du client.
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
        <Text style={styles.headerTitle}>{isEdit ? "Modifier le client" : "Nouveau client"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Type de client</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map(r => (
            <Pressable key={r.value} style={[styles.roleChip, role === r.value && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setRole(r.value)}>
              <Text style={[styles.roleChipText, role === r.value && { color: "#fff" }]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        {role === "client_professionnel" && (
          <>
            <Text style={styles.label}>Nom de l'entreprise</Text>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Nom de l'entreprise" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />
          </>
        )}

        <Text style={styles.sectionTitle}>Informations personnelles</Text>

        <Text style={styles.label}>Prénom</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Prénom" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

        <Text style={styles.label}>Nom</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Nom" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@exemple.com" placeholderTextColor={theme.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

        {!isEdit && (
          <>
            <Text style={styles.label}>Mot de passe *</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min. 8 caractères" placeholderTextColor={theme.textTertiary} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Confirmer le mot de passe *</Text>
            <TextInput style={styles.input} value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="Confirmez le mot de passe" placeholderTextColor={theme.textTertiary} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          </>
        )}

        <Text style={styles.label}>Téléphone</Text>
        <View style={styles.phoneRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={phone} onChangeText={setPhone} placeholder="06 12 34 56 78" placeholderTextColor={theme.textTertiary} keyboardType="phone-pad" />
          {isEdit && phone.trim() && (
            <Pressable
              style={[styles.callBtn, { backgroundColor: theme.primary }]}
              onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
              accessibilityLabel="Appeler le client"
            >
              <Ionicons name="call" size={18} color="#fff" />
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>Adresse</Text>

        <Text style={styles.label}>Adresse</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Rue..." placeholderTextColor={theme.textTertiary} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Code postal</Text>
            <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="75000" placeholderTextColor={theme.textTertiary} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Ville</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Paris" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{isEdit ? "Mettre à jour" : "Créer le client"}</Text>
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: theme.text },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  sectionTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: theme.text,
    marginTop: 24, marginBottom: 4, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  label: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 6,
  },
  input: {
    backgroundColor: theme.inputBg || theme.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: theme.inputBorder || theme.border, paddingHorizontal: 16, height: 52,
    fontSize: 15, fontFamily: "Inter_400Regular", color: theme.text,
  },
  roleRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  roleChip: {
    flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
    borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center",
  },
  roleChipText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: theme.textSecondary },
  row: { flexDirection: "row", gap: 12 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  callBtn: {
    width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center",
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: theme.primary, borderRadius: 16, height: 56, marginTop: 32,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
