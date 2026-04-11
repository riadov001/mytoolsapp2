import { Platform } from "react-native";

const CONFIG_ENDPOINT = "https://backend.mytoolsgroup.eu/api/public/mobile-api-url";

const DEFAULT_MOBILE_API_URL =
  process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://backend.mytoolsgroup.eu";
const DEFAULT_FALLBACK_URL =
  process.env.EXPO_PUBLIC_EXTERNAL_API_FALLBACK_URL || "https://backend.mytoolsgroup.eu";

let _mobileApiUrl: string = DEFAULT_MOBILE_API_URL;

export async function initApiConfig(): Promise<void> {
  try {
    const res = await fetch(CONFIG_ENDPOINT);
    const data = await res.json();
    if (data?.mobileApiUrl) {
      _mobileApiUrl = data.mobileApiUrl;
      console.log("[CONFIG] mobileApiUrl loaded:", _mobileApiUrl);
    }
  } catch (e) {
    console.warn("[CONFIG] Could not fetch mobile API URL, using default:", DEFAULT_MOBILE_API_URL);
  }
}

export function getMobileApiUrl(): string {
  return _mobileApiUrl;
}

export const NATIVE_BACKEND_URLS = [DEFAULT_MOBILE_API_URL, DEFAULT_FALLBACK_URL].filter(
  (v, i, a) => a.indexOf(v) === i,
);

export function getNativeApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin.includes("localhost:8081") || origin.includes("127.0.0.1:8081")) {
      return origin.replace(/:8081\b/, ":5000");
    }
    return origin;
  }
  return _mobileApiUrl;
}

export const EXTERNAL_API_PRIMARY = DEFAULT_MOBILE_API_URL;
export const EXTERNAL_API_FALLBACK = DEFAULT_FALLBACK_URL;
