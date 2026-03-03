import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import Colors from "@/constants/colors";
import { FloatingSupport } from "@/components/FloatingSupport";
import { useCustomAlert } from "@/components/CustomAlert";

const WEB_PORTAL_URL = "https://appmyjantes1.mytoolsgroup.eu";
const SECURITY_MESSAGE = "Pour des raisons de sécurité, cette action est disponible uniquement depuis votre espace client sécurisé accessible via notre site internet.";

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function setStoredValue(key: string, value: string) {
  if (Platform.OS === "web") await AsyncStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [activeSection, setActiveSection] = useState<"info" | "security" | "notifications">("info");

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState("");

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(true);

  const isPro = user?.role === "client_professionnel";
  const roleName = isPro ? "Professionnel" : "Particulier";

  useEffect(() => {
    checkBiometrics();
    loadNotificationPreferences();
  }, []);

  const checkBiometrics = async () => {
    if (Platform.OS === "web") return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("Face ID");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("Empreinte digitale");
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType("Iris");
        }
      }
      const stored = await getStoredValue("biometric_enabled");
      setBiometricEnabled(stored === "true");
    } catch {}
  };

  const loadNotificationPreferences = async () => {
    try {
      const prefs = await authApi.getNotificationPreferences();
      if (prefs && typeof prefs.push === "boolean") {
        setPushEnabled(prefs.push);
        setEmailNotifEnabled(prefs.email);
      }
    } catch {
      const stored = await getStoredValue("notif_push");
      if (stored !== null) setPushEnabled(stored === "true");
      const storedEmail = await getStoredValue("notif_email");
      if (storedEmail !== null) setEmailNotifEnabled(storedEmail === "true");
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Activez l'authentification biométrique",
        cancelLabel: "Annuler",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setBiometricEnabled(true);
        await setStoredValue("biometric_enabled", "true");
        showAlert({ type: "success", title: "Activé", message: `${biometricType || "Biométrie"} activé(e) pour la connexion.`, buttons: [{ text: "OK", style: "primary" }] });
      }
    } else {
      setBiometricEnabled(false);
      await setStoredValue("biometric_enabled", "false");
    }
  };

  const updateNotifPref = async (key: "push" | "email", value: boolean) => {
    const prev = { push: pushEnabled, email: emailNotifEnabled };
    if (key === "push") setPushEnabled(value);
    if (key === "email") setEmailNotifEnabled(value);

    await setStoredValue(`notif_${key}`, value ? "true" : "false");

    try {
      await authApi.updateNotificationPreferences({ ...prev, [key]: value });
    } catch {}
  };

  const handleLogout = () => {
    showAlert({
      type: "warning",
      title: "Déconnexion",
      message: "Voulez-vous vous déconnecter ?",
      buttons: [
        { text: "Annuler" },
        { text: "Déconnexion", style: "primary", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
      ],
    });
  };

  const openWebPortal = () => {
    Linking.openURL(WEB_PORTAL_URL);
  };

  const renderField = (
    label: string,
    value: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Ionicons name={icon} size={18} color={Colors.textSecondary} />
        <Text style={[styles.fieldValue, !value && styles.fieldValueEmpty]}>
          {value || "Non renseigné"}
        </Text>
      </View>
    </View>
  );

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  const TabButton = ({ id, label, icon }: { id: "info" | "security" | "notifications"; label: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <Pressable
      style={[styles.tabBtn, activeSection === id && styles.tabBtnActive]}
      onPress={() => setActiveSection(id)}
    >
      <Ionicons name={icon} size={18} color={activeSection === id ? Colors.primary : Colors.textSecondary} />
      <Text style={[styles.tabBtnText, activeSection === id && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{roleName}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton id="info" label="Infos" icon="person-outline" />
          <TabButton id="security" label="Sécurité" icon="shield-checkmark-outline" />
          <TabButton id="notifications" label="Notifs" icon="notifications-outline" />
        </View>

        {activeSection === "info" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations personnelles</Text>
              {renderField("Email", user?.email || "", () => {}, "mail-outline", { editable: false })}
              {renderField("Prénom", firstName, setFirstName, "person-outline")}
              {renderField("Nom", lastName, setLastName, "person-outline")}
              {renderField("Téléphone", phone, setPhone, "call-outline", { keyboardType: "phone-pad" })}
              {renderField("Adresse", address, setAddress, "location-outline")}
              {renderField("Code postal", postalCode, setPostalCode, "navigate-outline", { keyboardType: "numeric", maxLength: 5 })}
              {renderField("Ville", city, setCity, "business-outline")}
            </View>

            {isPro && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Informations société</Text>
                {renderField("Nom entreprise", companyName, setCompanyName, "business-outline")}
                {renderField("SIRET", siret, setSiret, "document-text-outline", { maxLength: 14 })}
                {renderField("N° TVA", tvaNumber, setTvaNumber, "receipt-outline")}
                {renderField("Adresse société", companyAddress, setCompanyAddress, "location-outline")}
                {renderField("CP société", companyPostalCode, setCompanyPostalCode, "navigate-outline", { keyboardType: "numeric", maxLength: 5 })}
                {renderField("Ville société", companyCity, setCompanyCity, "business-outline")}
                {renderField("Pays société", companyCountry, setCompanyCountry, "globe-outline")}
              </View>
            )}

            {editing && (
              <Pressable style={styles.cancelBtn} onPress={() => {
                setFirstName(user?.firstName || "");
                setLastName(user?.lastName || "");
                setPhone(user?.phone || "");
                setAddress(user?.address || "");
                setPostalCode(user?.postalCode || "");
                setCity(user?.city || "");
                setCompanyName(user?.companyName || "");
                setSiret(user?.siret || "");
                setTvaNumber(user?.tvaNumber || "");
                setCompanyAddress(user?.companyAddress || "");
                setCompanyPostalCode(user?.companyPostalCode || "");
                setCompanyCity(user?.companyCity || "");
                setCompanyCountry(user?.companyCountry || "France");
                setEditing(false);
              }}>
                <Text style={styles.cancelBtnText}>Annuler les modifications</Text>
              </Pressable>
            )}
          </>
        )}

        {activeSection === "security" && (
          <>
            {Platform.OS !== "web" && biometricAvailable && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Authentification forte</Text>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIconContainer, { backgroundColor: "#3B82F620" }]}>
                      <Ionicons name="finger-print" size={22} color="#3B82F6" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingTitle}>{biometricType || "Biométrie"}</Text>
                      <Text style={styles.settingDesc}>Connexion rapide et sécurisée</Text>
                    </View>
                  </View>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={toggleBiometric}
                    trackColor={{ false: Colors.surfaceSecondary, true: Colors.primary + "60" }}
                    thumbColor={biometricEnabled ? Colors.primary : Colors.textTertiary}
                  />
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Modifier le mot de passe</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe actuel</Text>
                <View style={styles.passwordInputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Mot de passe actuel"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
                <View style={styles.passwordInputContainer}>
                  <Ionicons name="lock-open-outline" size={18} color={Colors.textSecondary} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmer</Text>
                <View style={styles.passwordInputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {newPassword.length > 0 && (
                <View style={styles.strengthBox}>
                  <View style={styles.strengthItem}>
                    <Ionicons name={newPassword.length >= 8 ? "checkmark-circle" : "ellipse-outline"} size={14} color={newPassword.length >= 8 ? Colors.success : Colors.textTertiary} />
                    <Text style={[styles.strengthText, newPassword.length >= 8 && { color: Colors.success }]}>8+ caractères</Text>
                  </View>
                  <View style={styles.strengthItem}>
                    <Ionicons name={/[A-Z]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[A-Z]/.test(newPassword) ? Colors.success : Colors.textTertiary} />
                    <Text style={[styles.strengthText, /[A-Z]/.test(newPassword) && { color: Colors.success }]}>Majuscule</Text>
                  </View>
                  <View style={styles.strengthItem}>
                    <Ionicons name={/[0-9]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[0-9]/.test(newPassword) ? Colors.success : Colors.textTertiary} />
                    <Text style={[styles.strengthText, /[0-9]/.test(newPassword) && { color: Colors.success }]}>Chiffre</Text>
                  </View>
                  <View style={styles.strengthItem}>
                    <Ionicons name={newPassword === confirmPassword && confirmPassword.length > 0 ? "checkmark-circle" : "ellipse-outline"} size={14} color={newPassword === confirmPassword && confirmPassword.length > 0 ? Colors.success : Colors.textTertiary} />
                    <Text style={[styles.strengthText, newPassword === confirmPassword && confirmPassword.length > 0 && { color: Colors.success }]}>Identiques</Text>
                  </View>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [styles.changePasswordBtn, pressed && { backgroundColor: Colors.primaryDark }, changingPassword && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.changePasswordBtnText}>Modifier le mot de passe</Text>}
              </Pressable>
            </View>
          </>
        )}

        {activeSection === "notifications" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Préférences de notification</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIconContainer, { backgroundColor: "#EF444420" }]}>
                  <Ionicons name="notifications" size={20} color={Colors.primary} />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Notifications push</Text>
                  <Text style={styles.settingDesc}>Alertes sur votre téléphone</Text>
                </View>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={(v) => updateNotifPref("push", v)}
                trackColor={{ false: Colors.surfaceSecondary, true: Colors.primary + "60" }}
                thumbColor={pushEnabled ? Colors.primary : Colors.textTertiary}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIconContainer, { backgroundColor: "#10B98120" }]}>
                  <Ionicons name="mail" size={20} color="#10B981" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Notifications email</Text>
                  <Text style={styles.settingDesc}>Récapitulatifs et suivis par email</Text>
                </View>
              </View>
              <Switch
                value={emailNotifEnabled}
                onValueChange={(v) => updateNotifPref("email", v)}
                trackColor={{ false: Colors.surfaceSecondary, true: "#10B98160" }}
                thumbColor={emailNotifEnabled ? "#10B981" : Colors.textTertiary}
              />
            </View>

            <View style={styles.notifInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.notifInfoText}>
                Les notifications push requièrent l'autorisation sur votre appareil. Les emails sont envoyés pour les événements importants (devis, facture, rendez-vous).
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && { backgroundColor: Colors.surfaceSecondary }]}
            onPress={() => router.push("/(main)/(tabs)/more")}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIconContainer, { backgroundColor: "#6366F120" }]}>
                <Ionicons name="settings-outline" size={20} color="#6366F1" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Paramètres</Text>
                <Text style={styles.settingDesc}>Mentions légales, support, version</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && { backgroundColor: Colors.surfaceSecondary }]}
            onPress={() => router.push("/(main)/delete-account" as any)}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIconContainer, { backgroundColor: "#EF444420" }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingTitle, { color: "#EF4444" }]}>Supprimer mon compte</Text>
                <Text style={styles.settingDesc}>Suppression définitive et irréversible</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
          <Text style={styles.logoutBtnText}>Déconnexion</Text>
        </Pressable>
      </ScrollView>
      {AlertComponent}
      <FloatingSupport />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  avatarName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.surfaceSecondary,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  fieldContainer: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    marginLeft: 4,
  },
  fieldInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    height: 44,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  fieldValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  fieldValueEmpty: {
    color: Colors.textTertiary,
  },
  cancelBtn: {
    alignItems: "center",
    marginBottom: 16,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  settingDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    marginLeft: 4,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  eyeBtn: {
    height: "100%",
    width: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  strengthBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
  strengthItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  strengthText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  changePasswordBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  changePasswordBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  notifInfoBox: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
    alignItems: "flex-start",
    marginTop: 4,
  },
  notifInfoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: 8,
  },
  logoutBtnPressed: {
    backgroundColor: Colors.errorLight,
  },
  logoutBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
});
