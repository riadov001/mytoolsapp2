import { initializeApp, getApps } from "firebase/app";
import { Platform } from "react-native";

let firebaseApp: any = null;
let firebaseAuth: any = null;
let initAttempted = false;

export function isFirebaseConfigured(): boolean {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  return !!(apiKey && projectId && appId);
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  if (firebaseApp) return firebaseApp;

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      "crud-ae9d9.firebaseapp.com",
    databaseURL: "https://crud-ae9d9.firebaseio.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      "crud-ae9d9.firebasestorage.app",
    messagingSenderId: "129808585113",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  firebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return firebaseApp;
}

export function getFirebaseAuth() {
  if (initAttempted) return firebaseAuth;
  initAttempted = true;

  if (!isFirebaseConfigured()) {
    console.log("[Firebase] Not configured, skipping initialization");
    return null;
  }

  try {
    const app = getFirebaseApp();
    if (!app) return null;

    if (Platform.OS === "web") {
      const { getAuth, browserLocalPersistence, setPersistence } =
        require("firebase/auth");
      firebaseAuth = getAuth(app);
      setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});
    } else {
      try {
        const { initializeAuth, getReactNativePersistence } =
          require("firebase/auth");
        const ReactNativeAsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        firebaseAuth = initializeAuth(app, {
          persistence: getReactNativePersistence(ReactNativeAsyncStorage),
        });
      } catch {
        const { getAuth } = require("firebase/auth");
        firebaseAuth = getAuth(app);
      }
    }

    return firebaseAuth;
  } catch (err: any) {
    console.error("[Firebase] Init failed:", err?.message);
    firebaseApp = null;
    firebaseAuth = null;
    initAttempted = false;
    return null;
  }
}
