import { Platform } from "react-native";

export const EXTERNAL_API_PRIMARY =
  process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://saas.mytoolsgroup.eu";

export const EXTERNAL_API_FALLBACK =
  process.env.EXPO_PUBLIC_EXTERNAL_API_FALLBACK_URL || "https://pwa.mytoolsgroup.eu";

export const NATIVE_BACKEND_URLS = [
  EXTERNAL_API_PRIMARY,
  EXTERNAL_API_FALLBACK,
].filter((v, i, a) => a.indexOf(v) === i);

export function getNativeApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin.includes("localhost:8081") || origin.includes("127.0.0.1:8081")) {
      return origin.replace(/:8081\b/, ":5000");
    }
    return origin;
  }
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return EXTERNAL_API_PRIMARY;
}
