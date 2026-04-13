import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Switch,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { getBackendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Step = "siret" | "form" | "success";

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  siret: string;
  siren: string;
  legalForm: string;
  tvaNumber: string;
}

function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pwd) return { level: 0, label: "", color: "transparent" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, label: "Faible", color: "#EF4444" };
  if (score === 2) return { level: 2, label: "Moyen", color: "#F59E0B" };
  return { level: 3, label: "Fort", color: "#10B981" };
}

export default function GarageRegisterScreen() {
  const params = useLocalSearchParams();
  const prefillEmail = Array.isArray(params.email) ? params.email[0] : (params.email as string || "");
  const prefillName = Array.isArray(params.displayName) ? params.displayName[0] : (params.displayName as string || "");
  const firebaseUid = Array.isArray(params.firebaseUid) ? params.firebaseUid[0] : (params.firebaseUid as string || "");
  const idToken = Array.isArray(params.idToken) ? params.idToken[0] : (params.idToken as string || "");
  const isGoogleFlow = !!firebaseUid;

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const { socialLogin } = useAuth();

  const [step, setStep] = useState<Step>("siret");
  const [loading, setLoading] = useState(false);

  // SIRET search
  const [siretInput, setSiretInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const siretLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual entry
  const [manualEntry, setManualEntry] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualPostalCode, setManualPostalCode] = useState("");
  const [manualSiret, setManualSiret] = useState("");
  const [manualSiren, setManualSiren] = useState("");
  const [manualLegalForm, setManualLegalForm] = useState("");
  const [manualTvaNumber, setManualTvaNumber] = useState("");

  // Certification consent (step 1 — company data accuracy)
  const [certificationConsent, setCertificationConsent] = useState(false);

  // Personal info
  const nameParts = prefillName.split(" ");
  const [firstName, setFirstName] = useState(nameParts[0] || "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [garageName, setGarageName] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pwdStrength = getPasswordStrength(password);
  const apiBase = getBackendUrl();
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const mapGovResult = useCallback((item: any, query: string): CompanyInfo => {
    const siege = item?.siege || item?.matching_etablissements?.[0] || {};
    const address = siege?.adresse || [siege?.numero_voie, siege?.type_voie, siege?.libelle_voie].filter(Boolean).join(" ");
    const siret = siege?.siret || item?.siret || (query.replace(/\D/g, "").length === 14 ? query.replace(/\D/g, "") : "");
    const siren = item?.siren || siret.slice(0, 9) || "";
    return {
      name: item?.nom_complet || item?.nom_raison_sociale || "",
      address: address || "",
      city: siege?.libelle_commune || siege?.ville || "",
      postalCode: siege?.code_postal || "",
      siret,
      siren,
      legalForm: item?.nature_juridique || "",
      tvaNumber: siren ? `FR${siren}` : "",
    };
  }, []);

  const safeParseJson = useCallback(async (res: Response): Promise<any | null> => {
    try {
      const text = await res.text();
      if (!text || text.trim() === "") return null;
      if (text.trim().startsWith("<")) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }, []);

  const doLookup = useCallback(async (query: string, isSiret: boolean) => {
    setLoading(true);
    setSearchAttempted(true);
    try {
      const param = isSiret ? `siret=${encodeURIComponent(query)}` : `name=${encodeURIComponent(query)}`;
      const reqHeaders: Record<string, string> = { Accept: "application/json" };
      if (idToken) reqHeaders["Authorization"] = `Bearer ${idToken}`;

      let data: any = null;

      try {
        const res = await fetch(`${apiBase}/api/mobile/company/search?${param}`, {
          headers: reqHeaders,
        });
        if (res.ok) {
          data = await safeParseJson(res);
        } else if (res.status === 503) {
          showAlert({
            type: "error",
            title: "Service indisponible",
            message: "Le service de recherche d'entreprise est temporairement indisponible.\n\nVous pouvez saisir vos informations manuellement.",
            buttons: [
              { text: "Saisir manuellement", style: "primary", onPress: () => setManualEntry(true) },
              { text: "Réessayer", style: "cancel" },
            ],
          });
          return;
        } else {
          const err = await safeParseJson(res);
          if (err?.requiresManualEntry) { setManualEntry(true); return; }
        }
      } catch {}

      if (!data || (!data.name && !data.companyName)) {
        try {
          const govRes = await fetch(
            `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=1`,
            { headers: { Accept: "application/json" } }
          );
          if (govRes.ok) {
            const govData = await govRes.json();
            const first = govData?.results?.[0];
            if (first) data = mapGovResult(first, query);
          }
        } catch {}
      }

      if (!data || (!data.name && !data.companyName)) {
        showAlert({
          type: "error",
          title: "Entreprise introuvable",
          message: "Aucune entreprise trouvée pour cette recherche.\n\nVous pouvez saisir les informations manuellement.",
          buttons: [
            { text: "Saisir manuellement", style: "primary", onPress: () => setManualEntry(true) },
            { text: "Réessayer", style: "cancel" },
          ],
        });
        return;
      }

      setCompany({
        name: data.name || data.companyName || "",
        address: data.address || "",
        city: data.city || "",
        postalCode: data.postalCode || "",
        siret: data.siret || query,
        siren: data.siren || "",
        legalForm: data.legalForm || "",
        tvaNumber: data.tvaNumber || "",
      });
      if (!garageName && (data.name || data.companyName)) setGarageName(data.name || data.companyName);
      setManualEntry(false);
    } catch (err: any) {
      setCompany(null);
      showAlert({
        type: "error",
        title: "Entreprise introuvable",
        message: `${err.message || "Impossible de trouver l'entreprise."}\n\nVous pouvez saisir les informations manuellement.`,
        buttons: [
          { text: "Saisir manuellement", style: "primary", onPress: () => setManualEntry(true) },
          { text: "Réessayer", style: "cancel" },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [garageName, apiBase, idToken, mapGovResult, safeParseJson]);

  const handleSiretChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 14);
    setSiretInput(digits);
    setCompany(null);
    setSearchAttempted(false);
    if (siretLookupTimer.current) clearTimeout(siretLookupTimer.current);
    if (digits.length === 14) {
      siretLookupTimer.current = setTimeout(() => doLookup(digits, true), 300);
    }
  }, [doLookup]);

  const lookupManual = useCallback(async () => {
    const query = siretInput.trim() || nameInput.trim();
    if (!query) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez saisir un SIRET ou un nom d'entreprise.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    await doLookup(query, !!siretInput.trim());
  }, [siretInput, nameInput, doLookup]);

  const checkEmailAndProceed = useCallback(async () => {
    if (manualEntry) {
      // Validate all required manual fields
      if (!manualName.trim()) {
        showAlert({ type: "error", title: "Champ requis", message: "La raison sociale est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!manualAddress.trim()) {
        showAlert({ type: "error", title: "Champ requis", message: "L'adresse est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!manualCity.trim()) {
        showAlert({ type: "error", title: "Champ requis", message: "La ville est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!manualPostalCode.trim() || !/^\d{5}$/.test(manualPostalCode.trim())) {
        showAlert({ type: "error", title: "Champ requis", message: "Le code postal doit contenir exactement 5 chiffres.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!certificationConsent) {
        showAlert({ type: "error", title: "Certification requise", message: "Vous devez certifier l'exactitude des informations renseignées.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      // Build company from manual fields
      setCompany({
        name: manualName.trim(),
        address: manualAddress.trim(),
        city: manualCity.trim(),
        postalCode: manualPostalCode.trim(),
        siret: manualSiret.trim(),
        siren: manualSiren.trim(),
        legalForm: manualLegalForm.trim(),
        tvaNumber: manualTvaNumber.trim(),
      });
      if (!garageName) setGarageName(manualName.trim());
      setStep("form");
      return;
    }
    if (!company) return;
    if (!certificationConsent) {
      showAlert({ type: "error", title: "Certification requise", message: "Vous devez certifier l'exactitude des informations renseignées.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setStep("form");
  }, [company, manualEntry, manualName, manualAddress, manualCity, manualPostalCode, manualSiret, manualSiren, manualLegalForm, manualTvaNumber, certificationConsent, garageName]);

  const handleRegister = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Prénom et nom requis.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!email.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Email requis.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!isGoogleFlow) {
      if (!password || password.length < 8) {
        showAlert({ type: "error", title: "Erreur", message: "Le mot de passe doit contenir au moins 8 caractères.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (password !== confirmPassword) {
        showAlert({ type: "error", title: "Erreur", message: "Les mots de passe ne correspondent pas.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
    }
    if (!legalConsent) {
      showAlert({ type: "error", title: "Erreur", message: "Vous devez accepter les conditions générales.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    setLoading(true);
    try {
      try {
        const checkRes = await fetch(`${apiBase}/api/users/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
          headers: { Accept: "application/json" },
        });
        if (checkRes.ok) {
          const checkData = await safeParseJson(checkRes);
          if (checkData?.exists) {
            showAlert({ type: "info", title: "Compte existant", message: "Un compte existe déjà avec cette adresse email. Veuillez vous connecter.", buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }] });
            setLoading(false);
            return;
          }
        }
      } catch {}

      const body: any = {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        garageName: garageName.trim() || company?.name || "",
        companyName: company?.name || "",
        siret: company?.siret || "",
        siren: company?.siren || "",
        address: company?.address || "",
        city: company?.city || "",
        postalCode: company?.postalCode || "",
        tvaNumber: company?.tvaNumber || "",
        legalForm: company?.legalForm || "",
        smsConsent,
        certificationConsent: true,
      };
      if (isGoogleFlow) {
        body.firebaseUid = firebaseUid;
      } else {
        body.password = password;
      }

      const res = await fetch(`${apiBase}/api/mobile/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await safeParseJson(res) ?? {};
        console.error("[Register] API error:", res.status, JSON.stringify(err));
        throw new Error(err?.message || err?.error || "Inscription échouée. Veuillez réessayer.");
      }

      if (isGoogleFlow && idToken) {
        try {
          const loginResult = await socialLogin(idToken, "google");
          if (loginResult.status === "authenticated") {
            setStep("success");
            return;
          }
          // Firebase login not available on backend — guide user to set a password via "forgot password"
          showAlert({
            type: "info",
            title: "Compte créé",
            message: "Votre compte a été créé. La connexion Google n'est pas encore disponible — utilisez « Mot de passe oublié » sur l'écran de connexion pour définir un mot de passe.",
            buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }],
          });
          setLoading(false);
          return;
        } catch (loginErr: any) {
          console.error("[Register] Auto-login after registration failed:", loginErr.message);
          showAlert({
            type: "info",
            title: "Compte créé",
            message: "Votre compte a été créé. Utilisez « Mot de passe oublié » sur l'écran de connexion pour définir un mot de passe et vous connecter.",
            buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }],
          });
          setLoading(false);
          return;
        }
      }

      setStep("success");
    } catch (err: any) {
      const msg: string = err.message || "Inscription échouée.";
      const emailTaken = /déjà utilisé|already (exists|taken|registered)|email.*exist/i.test(msg);
      if (emailTaken && isGoogleFlow) {
        showAlert({
          type: "info",
          title: "Compte existant",
          message: "Un compte existe déjà avec cette adresse email. Utilisez « Mot de passe oublié » sur l'écran de connexion si vous ne vous souvenez pas de votre mot de passe.",
          buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }],
        });
      } else {
        showAlert({ type: "error", title: "Erreur", message: msg, buttons: [{ text: "OK", style: "primary" }] });
      }
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, email, password, confirmPassword, garageName, smsConsent, legalConsent, company, firebaseUid, isGoogleFlow, idToken, socialLogin, apiBase, safeParseJson]);

  const renderCertificationCheckbox = () => (
    <Pressable
      style={[styles.certRow, certificationConsent && { borderColor: theme.primary + "60", backgroundColor: theme.primary + "08" }]}
      onPress={() => setCertificationConsent(!certificationConsent)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: certificationConsent }}
    >
      <View style={[styles.certCheckbox, certificationConsent && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
        {certificationConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.certLabel}>
        <Text style={{ fontFamily: "Inter_600SemiBold" }}>Je certifie sur l'honneur</Text> que les informations renseignées sont exactes et j'autorise MyTools à les vérifier auprès des autorités compétentes si nécessaire.
      </Text>
    </Pressable>
  );

  const renderManualEntryForm = () => (
    <View style={styles.manualContainer}>
      <View style={[styles.manualHeader, { backgroundColor: theme.warning + "15" || "#F59E0B15" }]}>
        <Ionicons name="create-outline" size={18} color={theme.warning || "#F59E0B"} />
        <Text style={[styles.manualHeaderText, { color: theme.warning || "#F59E0B" }]}>
          Saisie manuelle des informations
        </Text>
      </View>

      <Text style={styles.label}>Raison sociale <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={manualName}
        onChangeText={setManualName}
        placeholder="Ex: Garage Dupont SARL"
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Adresse <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={manualAddress}
        onChangeText={setManualAddress}
        placeholder="Ex: 12 rue de la Paix"
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="words"
      />

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>Ville <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={manualCity}
            onChangeText={setManualCity}
            placeholder="Paris"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Code postal <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={manualPostalCode}
            onChangeText={(t) => setManualPostalCode(t.replace(/\D/g, "").slice(0, 5))}
            placeholder="75001"
            placeholderTextColor={theme.textTertiary}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
      </View>

      <Text style={styles.label}>Numéro SIRET</Text>
      <TextInput
        style={styles.input}
        value={manualSiret}
        onChangeText={(t) => setManualSiret(t.replace(/\D/g, "").slice(0, 14))}
        placeholder="14 chiffres (recommandé)"
        placeholderTextColor={theme.textTertiary}
        keyboardType="number-pad"
        maxLength={14}
      />
      {manualSiret.length > 0 && manualSiret.length < 14 && (
        <Text style={styles.siretHint}>{manualSiret.length}/14 chiffres</Text>
      )}

      <Text style={styles.label}>Numéro SIREN</Text>
      <TextInput
        style={styles.input}
        value={manualSiren}
        onChangeText={(t) => setManualSiren(t.replace(/\D/g, "").slice(0, 9))}
        placeholder="9 chiffres (optionnel)"
        placeholderTextColor={theme.textTertiary}
        keyboardType="number-pad"
        maxLength={9}
      />

      <Text style={styles.label}>Forme juridique</Text>
      <TextInput
        style={styles.input}
        value={manualLegalForm}
        onChangeText={setManualLegalForm}
        placeholder="Ex: SARL, SAS, EI, EURL..."
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>N° TVA Intracommunautaire</Text>
      <TextInput
        style={styles.input}
        value={manualTvaNumber}
        onChangeText={setManualTvaNumber}
        placeholder="Ex: FR12345678901 (optionnel)"
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="characters"
      />

      {renderCertificationCheckbox()}

      <Pressable
        style={[styles.primaryBtn, (!certificationConsent || !manualName.trim() || !manualAddress.trim() || !manualCity.trim() || manualPostalCode.length !== 5) && { opacity: 0.5 }]}
        onPress={checkEmailAndProceed}
        disabled={!certificationConsent || !manualName.trim() || !manualAddress.trim() || !manualCity.trim() || manualPostalCode.length !== 5}
      >
        <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Continuer avec ces informations</Text>
      </Pressable>

      <Pressable style={styles.backStepBtn} onPress={() => setManualEntry(false)}>
        <Ionicons name="search" size={16} color={theme.textSecondary} />
        <Text style={styles.backStepText}>Réessayer la recherche</Text>
      </Pressable>
    </View>
  );

  const renderSiretStep = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: theme.primary + "20" }]}>
          <Ionicons name="business-outline" size={28} color={theme.primary} />
        </View>
        <Text style={styles.stepTitle}>Recherche d'entreprise</Text>
        <Text style={styles.stepDesc}>
          Recherchez votre garage par numéro SIRET ou par nom d'entreprise.
        </Text>
      </View>

      {isGoogleFlow && (
        <View style={[styles.companyBadge, { backgroundColor: "#10B98115", marginBottom: 16 }]}>
          <Ionicons name="logo-google" size={16} color="#10B981" />
          <Text style={[styles.companyBadgeText, { color: "#10B981" }]}>
            Connecté via Google ({prefillEmail})
          </Text>
        </View>
      )}

      {!manualEntry ? (
        <>
          <Text style={styles.label}>Numéro SIRET</Text>
          <TextInput
            style={styles.input}
            value={siretInput}
            onChangeText={handleSiretChange}
            placeholder="Ex: 12345678901234"
            placeholderTextColor={theme.textTertiary}
            keyboardType="number-pad"
            maxLength={14}
            autoCapitalize="none"
          />
          {siretInput.length > 0 && siretInput.length < 14 && (
            <Text style={styles.siretHint}>{siretInput.length}/14 chiffres</Text>
          )}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>ou</Text>
            <View style={styles.orLine} />
          </View>

          <Text style={styles.label}>Nom de l'entreprise</Text>
          <TextInput
            style={styles.input}
            value={nameInput}
            onChangeText={(t) => { setNameInput(t); setCompany(null); setSearchAttempted(false); }}
            placeholder="Ex: Mon Garage Auto"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
          />

          <Pressable
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={lookupManual}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Rechercher</Text>
              </>
            )}
          </Pressable>

          {searchAttempted && !company && !loading && (
            <Pressable style={styles.manualEntryBtn} onPress={() => setManualEntry(true)}>
              <Ionicons name="create-outline" size={16} color={theme.primary} />
              <Text style={styles.manualEntryBtnText}>Saisir manuellement mes informations</Text>
            </Pressable>
          )}

          {!searchAttempted && (
            <Pressable style={styles.manualEntryBtn} onPress={() => setManualEntry(true)}>
              <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.manualEntryBtnText, { color: theme.textSecondary }]}>
                Mon entreprise n'est pas dans la base de données
              </Text>
            </Pressable>
          )}

          {company && (
            <View style={styles.companyCard}>
              <Text style={styles.companyName}>{company.name}</Text>
              <View style={styles.companyRow}>
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <Text style={styles.companyDetail}>{company.address}, {company.postalCode} {company.city}</Text>
              </View>
              {company.siret ? (
                <View style={styles.companyRow}>
                  <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.companyDetail}>SIRET: {company.siret}</Text>
                </View>
              ) : null}
              {company.tvaNumber ? (
                <View style={styles.companyRow}>
                  <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.companyDetail}>TVA: {company.tvaNumber}</Text>
                </View>
              ) : null}
              {company.legalForm ? (
                <View style={styles.companyRow}>
                  <Ionicons name="briefcase-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.companyDetail}>{company.legalForm}</Text>
                </View>
              ) : null}

              {renderCertificationCheckbox()}

              <Pressable
                style={[styles.confirmBtn, !certificationConsent && { opacity: 0.5 }]}
                onPress={checkEmailAndProceed}
                disabled={!certificationConsent}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>C'est mon entreprise — Continuer</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        renderManualEntryForm()
      )}
    </>
  );

  const renderFormStep = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: "#10B98120" }]}>
          <Ionicons name="person-outline" size={28} color="#10B981" />
        </View>
        <Text style={styles.stepTitle}>Vos informations</Text>
        <Text style={styles.stepDesc}>
          {isGoogleFlow
            ? "Complétez les informations de votre garage."
            : "Complétez vos informations pour créer votre compte garage."}
        </Text>
      </View>

      {isGoogleFlow && (
        <View style={[styles.companyBadge, { backgroundColor: "#10B98115", marginBottom: 12 }]}>
          <Ionicons name="logo-google" size={16} color="#10B981" />
          <Text style={[styles.companyBadgeText, { color: "#10B981" }]}>
            Connecté via Google — aucun mot de passe requis
          </Text>
        </View>
      )}

      {company && (
        <View style={styles.companyBadge}>
          <Ionicons name="business" size={16} color={theme.primary} />
          <Text style={styles.companyBadgeText}>{company.name}</Text>
          {!company.siret && (
            <View style={[styles.manualBadge, { backgroundColor: "#F59E0B20" }]}>
              <Ionicons name="create-outline" size={11} color="#F59E0B" />
              <Text style={{ fontSize: 10, color: "#F59E0B", fontFamily: "Inter_500Medium" }}>Manuel</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.label}>Nom du garage</Text>
      <TextInput
        style={styles.input}
        value={garageName}
        onChangeText={setGarageName}
        placeholder="Nom affiché pour vos clients"
        placeholderTextColor={theme.textTertiary}
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Prénom <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Jean"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
            editable={!isGoogleFlow || !nameParts[0]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Nom <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Dupont"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
            editable={!isGoogleFlow || !nameParts.slice(1).join(" ")}
          />
        </View>
      </View>

      <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, isGoogleFlow && { opacity: 0.7, backgroundColor: theme.surface }]}
        value={email}
        onChangeText={setEmail}
        placeholder="contact@garage.com"
        placeholderTextColor={theme.textTertiary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isGoogleFlow}
      />

      {!isGoogleFlow && (
        <>
          <Text style={styles.label}>Mot de passe <Text style={styles.required}>*</Text></Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="8 caractères minimum"
              placeholderTextColor={theme.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textTertiary} />
            </Pressable>
          </View>
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    { backgroundColor: i <= pwdStrength.level ? pwdStrength.color : theme.border },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: pwdStrength.color }]}>{pwdStrength.label}</Text>
            </View>
          )}

          <Text style={styles.label}>Confirmer le mot de passe <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, confirmPassword.length > 0 && password !== confirmPassword && { borderColor: "#EF4444" }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirmez votre mot de passe"
            placeholderTextColor={theme.textTertiary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={styles.fieldError}>Les mots de passe ne correspondent pas</Text>
          )}
        </>
      )}

      <View style={styles.switchRow}>
        <Switch
          value={smsConsent}
          onValueChange={setSmsConsent}
          trackColor={{ false: theme.border, true: theme.primary + "60" }}
          thumbColor={smsConsent ? theme.primary : theme.textTertiary}
        />
        <Text style={styles.switchLabel}>J'accepte de recevoir des notifications SMS</Text>
      </View>

      <Pressable style={styles.checkboxRow} onPress={() => setLegalConsent(!legalConsent)}>
        <View style={[styles.checkbox, legalConsent && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
          {legalConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>
          J'accepte les{" "}
          <Text style={{ color: theme.primary }} onPress={() => router.push("/legal" as any)}>
            conditions générales d'utilisation
          </Text>
          {" "}et la{" "}
          <Text style={{ color: theme.primary }} onPress={() => router.push("/privacy" as any)}>
            politique de confidentialité
          </Text>
          {" "}<Text style={styles.required}>*</Text>
        </Text>
      </Pressable>

      <Pressable
        style={[styles.primaryBtn, (loading || !legalConsent) && { opacity: 0.6 }]}
        onPress={handleRegister}
        disabled={loading || !legalConsent}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="rocket-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Créer mon compte</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.backStepBtn} onPress={() => { setStep("siret"); setCertificationConsent(false); }}>
        <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
        <Text style={styles.backStepText}>Modifier l'entreprise</Text>
      </Pressable>
    </>
  );

  const renderSuccessStep = () => (
    <View style={styles.successContainer}>
      <View style={[styles.stepIcon, { backgroundColor: "#10B98120", width: 80, height: 80, borderRadius: 24 }]}>
        <Ionicons name={isGoogleFlow ? "checkmark-circle-outline" : "mail-outline"} size={40} color="#10B981" />
      </View>
      <Text style={styles.successTitle}>
        {isGoogleFlow ? "Inscription réussie !" : "Vérifiez votre email"}
      </Text>
      <Text style={styles.successDesc}>
        {isGoogleFlow ? (
          <>
            Votre compte garage a été créé avec succès.{"\n\n"}
            Vous pouvez maintenant vous connecter avec Google.
          </>
        ) : (
          <>
            Un email de vérification a été envoyé à{"\n"}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: theme.text }}>{email}</Text>
            {"\n\n"}
            Cliquez sur le lien dans l'email pour activer votre compte, puis connectez-vous.
          </>
        )}
      </Text>
      <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(auth)/login")}>
        <Ionicons name="log-in-outline" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Aller à la connexion</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => step === "form" ? setStep("siret") : router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === "siret" ? "Inscription garage" : step === "form" ? "Vos informations" : "Inscription"}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {step === "siret" && (
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
      )}
      {step === "form" && (
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
      )}
      {step === "success" && (
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === "siret" && renderSiretStep()}
          {step === "form" && renderFormStep()}
          {step === "success" && renderSuccessStep()}
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: theme.text },
  stepIndicator: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, paddingBottom: 8,
  },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: theme.border,
  },
  stepDotActive: { backgroundColor: theme.primary, width: 12, height: 12, borderRadius: 6 },
  stepDotDone: { backgroundColor: "#10B981" },
  stepLine: { flex: 1, height: 2, backgroundColor: theme.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#10B981" },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  stepHeader: { alignItems: "center", marginBottom: 24 },
  stepIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: theme.text, marginBottom: 6 },
  stepDesc: { fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.textSecondary, marginBottom: 6, marginTop: 12 },
  required: { color: "#EF4444", fontSize: 13 },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.text,
    fontFamily: "Inter_400Regular",
    marginBottom: 0,
  },
  fieldError: { fontSize: 12, color: "#EF4444", marginTop: 4, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 10 },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: theme.border },
  orText: { fontSize: 13, color: theme.textTertiary, marginHorizontal: 12, fontFamily: "Inter_400Regular" },
  siretHint: { fontSize: 11, color: theme.textTertiary, marginTop: 4, fontFamily: "Inter_400Regular" },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: theme.primary, borderRadius: 12,
    paddingVertical: 14, gap: 8, marginTop: 16,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  manualEntryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, marginTop: 8,
  },
  manualEntryBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: theme.primary },
  companyCard: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, padding: 16, marginTop: 16,
  },
  companyName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: theme.text, marginBottom: 8 },
  companyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  companyDetail: { fontSize: 13, color: theme.textSecondary, flex: 1, fontFamily: "Inter_400Regular" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#10B981", borderRadius: 10,
    paddingVertical: 12, gap: 8, marginTop: 12,
  },
  confirmBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  companyBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.primary + "15",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
    flexWrap: "wrap",
  },
  companyBadgeText: { fontSize: 13, fontFamily: "Inter_500Medium", color: theme.primary, flex: 1 },
  manualBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  certRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1.5, borderColor: theme.border,
    borderRadius: 10, padding: 14, marginTop: 16,
  },
  certCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.border,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 1,
  },
  certLabel: {
    flex: 1, fontSize: 13, color: theme.textSecondary,
    lineHeight: 19, fontFamily: "Inter_400Regular",
  },
  manualContainer: { marginTop: 4 },
  manualHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 4,
  },
  manualHeaderText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 0, marginBottom: 0 },
  eyeBtn: { padding: 12, marginLeft: -50 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },
  switchRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, marginTop: 8,
  },
  switchLabel: { flex: 1, fontSize: 14, color: theme.textSecondary, fontFamily: "Inter_400Regular" },
  checkboxRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.border,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 1,
  },
  checkboxLabel: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20, fontFamily: "Inter_400Regular" },
  backStepBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, marginTop: 4,
  },
  backStepText: { fontSize: 14, color: theme.textSecondary, fontFamily: "Inter_400Regular" },
  successContainer: { alignItems: "center", paddingTop: 40, gap: 12 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: theme.text, textAlign: "center" },
  successDesc: { fontSize: 15, color: theme.textSecondary, textAlign: "center", lineHeight: 22, fontFamily: "Inter_400Regular" },
});
