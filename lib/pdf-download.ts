import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { getAdminAccessToken, getPublicPdfUrl } from "./admin-api";
import { getSessionCookie } from "./api";

import { EXTERNAL_API_PRIMARY } from "./config";
const DIRECT_API = EXTERNAL_API_PRIMARY;

export async function viewPdf(
  type: "quotes" | "invoices",
  id: string,
  fileName: string = "document.pdf",
  viewToken?: string | null,
): Promise<boolean> {
  try {
    if (viewToken) {
      const publicUrl = getPublicPdfUrl(type, id, viewToken);

      if (Platform.OS === "web") {
        window.open(publicUrl, "_blank");
        return true;
      }

      await WebBrowser.openBrowserAsync(publicUrl);
      return true;
    }

    if (Platform.OS === "web") {
      try {
        const headers: Record<string, string> = { Accept: "application/pdf" };
        const token = getAdminAccessToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const cookie = getSessionCookie();
        if (cookie) headers["Cookie"] = cookie;

        const url = `${window.location.origin}/api/mobile/${type}/${id}/pdf`;
        const response = await fetch(url, {
          method: "GET",
          headers,
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
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        return true;
      } catch (err: any) {
        console.error("[PDF-VIEW-WEB] Error:", err);
        Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
        return false;
      }
    }

    try {
      const fileName_safe = fileName.replace(/[^a-z0-9._-]/gi, "_");
      const filePath = `${FileSystem.documentDirectory}${fileName_safe}`;

      const headers: Record<string, string> = { Accept: "application/pdf" };
      const token = getAdminAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const cookie = getSessionCookie();
      if (cookie) headers["Cookie"] = cookie;

      const directUrl = `${DIRECT_API}/api/mobile/${type}/${id}/pdf`;
      const result = await FileSystem.downloadAsync(directUrl, filePath, { headers });

      if (result.status !== 200) {
        throw new Error(`Erreur ${result.status}`);
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
      console.error("[PDF-VIEW-MOBILE] Error:", err);
      Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
      return false;
    }
  } catch (err: any) {
    console.error("[PDF-VIEW] Error:", err);
    Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
    return false;
  }
}
