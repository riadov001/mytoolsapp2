import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getApiUrl } from "./query-client";

export async function downloadPdfFile(
  url: string,
  fileName: string = "document.pdf"
): Promise<boolean> {
  try {
    const cleanUrl = url.split("#")[0];

    if (Platform.OS === "web") {
      // Web: trigger browser download
      try {
        const response = await fetch(cleanUrl, {
          method: "GET",
          headers: { Accept: "application/pdf" },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          throw new Error("PDF vide reçu");
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        Alert.alert(
          "Succès",
          `${fileName} a été téléchargé.`,
          [{ text: "OK" }]
        );
        return true;
      } catch (err) {
        console.error("[PDF-DL-WEB] Error:", err);
        Alert.alert(
          "Erreur",
          "Impossible de télécharger le PDF.",
          [{ text: "OK" }]
        );
        return false;
      }
    }

    // Mobile (iOS/Android): download and share
    try {
      const fileName_safe = fileName.replace(/[^a-z0-9._-]/gi, "_");
      const filePath = `${FileSystem.documentDirectory}${fileName_safe}`;

      // Download file
      const result = await FileSystem.downloadAsync(cleanUrl, filePath, {
        headers: { Accept: "application/pdf" },
      });

      if (result.status !== 200) {
        throw new Error(`HTTP ${result.status}`);
      }

      // Check if file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
        throw new Error("PDF vide reçu");
      }

      // Share the file
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: fileName_safe,
      });

      Alert.alert(
        "Succès",
        `${fileName_safe} téléchargé avec succès.`,
        [{ text: "OK" }]
      );
      return true;
    } catch (err: any) {
      console.error("[PDF-DL-MOBILE] Error:", err);
      Alert.alert(
        "Erreur",
        err?.message || "Impossible de télécharger le PDF.",
        [{ text: "OK" }]
      );
      return false;
    }
  } catch (err: any) {
    console.error("[PDF-DL] Error:", err);
    Alert.alert(
      "Erreur",
      err?.message || "Impossible de télécharger le PDF.",
      [{ text: "OK" }]
    );
    return false;
  }
}
