import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getAdminAccessToken } from "./admin-api";
import { getSessionCookie } from "./api";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAdminAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const cookie = getSessionCookie();
  if (cookie) headers["Cookie"] = cookie;
  return headers;
}

export async function downloadPdfFile(
  url: string,
  fileName: string = "document.pdf"
): Promise<boolean> {
  try {
    const cleanUrl = url.split("#")[0];
    const authHeaders = getAuthHeaders();

    if (Platform.OS === "web") {
      try {
        const response = await fetch(cleanUrl, {
          method: "GET",
          headers: { Accept: "application/pdf", ...authHeaders },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          throw new Error("PDF vide reçu");
        }

        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

        return true;
      } catch (err) {
        console.error("[PDF-DL-WEB] Error:", err);
        Alert.alert(
          "Erreur",
          "Impossible d'ouvrir le PDF.",
          [{ text: "OK" }]
        );
        return false;
      }
    }

    try {
      const fileName_safe = fileName.replace(/[^a-z0-9._-]/gi, "_");
      const filePath = `${FileSystem.documentDirectory}${fileName_safe}`;

      const result = await FileSystem.downloadAsync(cleanUrl, filePath, {
        headers: { Accept: "application/pdf", ...authHeaders },
      });

      if (result.status !== 200) {
        throw new Error(`HTTP ${result.status}`);
      }

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
        throw new Error("PDF vide reçu");
      }

      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: fileName_safe,
      });

      return true;
    } catch (err: any) {
      console.error("[PDF-DL-MOBILE] Error:", err);
      Alert.alert(
        "Erreur",
        err?.message || "Impossible d'ouvrir le PDF.",
        [{ text: "OK" }]
      );
      return false;
    }
  } catch (err: any) {
    console.error("[PDF-DL] Error:", err);
    Alert.alert(
      "Erreur",
      err?.message || "Impossible d'ouvrir le PDF.",
      [{ text: "OK" }]
    );
    return false;
  }
}
