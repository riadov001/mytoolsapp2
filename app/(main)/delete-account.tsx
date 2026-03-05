import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { apiCall } from "@/lib/api";
import { useCustomAlert } from "@/components/CustomAlert";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

async function clearAllStorage() {
  try {
    await AsyncStorage.clear();
  } catch {}
  if (Platform.OS !== "web") {
    try {
      await SecureStore.deleteItemAsync("session_cookie");
      await SecureStore.deleteItemAsync("biometric_enabled");
    } catch {}
  }
}

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [modalVisible, setModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiCall("/api/users/me", { method: "DELETE" });
      setModalVisible(false);
      await clearAllStorage();
      showAlert({
        type: "success",
        title: "Compte supprimé",
        message: "Votre compte a été définitivement supprimé.",
        buttons: [
          {
            text: "OK",
            style: "primary",
            onPress: () => {
              router.replace("/(auth)/login");
            },
          },
        ],
      });
    } catch (err: any) {
      setModalVisible(false);
      showAlert({
        type: "error",
        title: "Erreur",
        message: err.message || "Impossible de supprimer le compte. Veuillez réessayer.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16 },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Supprimer mon compte</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.warningCard}>
          <View style={styles.warningIconContainer}>
            <Ionicons name="warning" size={40} color="#EF4444" />
          </View>
          <Text style={styles.warningTitle}>Suppression du compte</Text>
          <Text style={styles.warningText}>
            La suppression de votre compte est une action irréversible. Toutes vos données personnelles, devis, factures et historique seront définitivement supprimés.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.infoText}>Vos données personnelles seront supprimées</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.infoText}>Vos devis et factures seront supprimés</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.infoText}>Vos réservations seront annulées</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.infoText}>Cette action est irréversible</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteBtnText}>Supprimer mon compte</Text>
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Supprimer le compte</Text>
            <Text style={styles.modalMessage}>
              Êtes-vous sûr(e) ? Cette action est définitive et irréversible.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalDeleteBtn, pressed && { opacity: 0.7 }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalDeleteText}>Supprimer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  warningCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF444430",
    marginBottom: 24,
  },
  warningIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EF444415",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    flex: 1,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    height: 52,
  },
  deleteBtnPressed: {
    backgroundColor: "#DC2626",
  },
  deleteBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalIconContainer: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
  },
  modalDeleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EF4444",
  },
  modalDeleteText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
