import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { authApi, UserProfile, LoginData, RegisterData, setSessionCookie, getSessionCookie } from "./api";
import { adminLogin, adminGetMe, setAdminTokens, setOnTokenExpired, getAdminAccessToken } from "./admin-api";
import { registerForPushNotificationsAsync, startNotificationPolling, stopNotificationPolling, addNotificationResponseListener, requestWebNotificationPermission } from "./push-notifications";
import { adminNotifications } from "./admin-api";

let LocalAuthentication: any = null;
if (Platform.OS !== "web") {
  try {
    LocalAuthentication = require("expo-local-authentication");
  } catch {}
}

const ADMIN_ROLES = ["admin", "super_admin", "superadmin", "root_admin", "root", "ROOT", "ROOT_ADMIN", "SUPER_ADMIN", "superAdmin"];
const EMPLOYEE_ROLES = ["employe", "employee", "manager", "EMPLOYE", "EMPLOYEE", "MANAGER"];

function detectIsAdmin(user: any): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  if (["admin", "super_admin", "superadmin", "root_admin", "root"].includes(role)) return true;
  if (user.isAdmin === true || user.is_admin === true) return true;
  return false;
}

function detectIsEmployee(user: any): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  if (["employe", "employee", "manager"].includes(role)) return true;
  if (user.isEmployee === true || user.is_employee === true) return true;
  return false;
}

interface SocialLoginSuccess {
  status: "authenticated";
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

interface SocialLoginNeedsRegistration {
  status: "needs_registration";
  email: string;
  displayName: string | null;
  firebaseUid: string;
}

type SocialLoginResult = SocialLoginSuccess | SocialLoginNeedsRegistration;

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isAdminOrEmployee: boolean;
  accessToken: string | null;
  login: (data: LoginData) => Promise<UserProfile | null>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  socialLogin: (idToken: string, provider: string) => Promise<SocialLoginResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function storeToken(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getToken(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeToken(key: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storedAccessToken, setStoredAccessToken] = useState<string | null>(null);
  const notificationListenerRef = useRef<any>(null);

  useEffect(() => {
    setOnTokenExpired(() => {
      handleTokenExpired();
    });
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const isAdminOrEmp = detectIsAdmin(user) || detectIsEmployee(user);

      const initNotifications = async () => {
        const consent = await AsyncStorage.getItem("consent_notifications").catch(() => null);
        if (consent === "false") return;

        if (Platform.OS === "web") {
          requestWebNotificationPermission().catch(() => {});
        } else {
          registerForPushNotificationsAsync().catch(() => {});
        }
        const fetchFn = isAdminOrEmp ? adminNotifications.getAll : undefined;
        startNotificationPolling(15000, fetchFn);
      };

      initNotifications();

      notificationListenerRef.current = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data;
        const adminPrefix = isAdminOrEmp ? "/(admin)" : "/(main)";
        if (data?.type === "quote" && data?.relatedId) {
          router.push({ pathname: `${adminPrefix}/quote-detail` as any, params: { id: data.relatedId as string } });
        } else if (data?.type === "invoice" && data?.relatedId) {
          router.push({ pathname: `${adminPrefix}/invoice-detail` as any, params: { id: data.relatedId as string } });
        } else if (data?.type === "reservation" && data?.relatedId) {
          router.push({ pathname: `${adminPrefix}/reservation-detail` as any, params: { id: data.relatedId as string } });
        }
      });

      return () => {
        stopNotificationPolling();
        if (notificationListenerRef.current) {
          notificationListenerRef.current.remove();
        }
      };
    }
  }, [user]);

  const handleTokenExpired = async () => {
    setUser(null);
    setStoredAccessToken(null);
    setAdminTokens(null, null);
    await removeToken("access_token");
    await removeToken("refresh_token");
    await removeToken("session_cookie");
    setSessionCookie(null);
    router.replace("/(auth)/login");
  };

  const checkAuth = async () => {
    try {
      await removeToken("social_access_token");

      const savedAccessToken = await getToken("access_token");
      const savedRefreshToken = await getToken("refresh_token");

      if (savedAccessToken) {
        setAdminTokens(savedAccessToken, savedRefreshToken);
        setStoredAccessToken(savedAccessToken);
      }

      const savedCookie = await getToken("session_cookie");
      if (savedCookie) {
        setSessionCookie(savedCookie);
      }

      if (savedAccessToken || savedCookie) {
        if (savedAccessToken) {
          try {
            const userData = await adminGetMe();
            if (userData && (userData.id || userData.email)) {
              setUser(userData);
              return;
            }
          } catch {}
        }

        try {
          const { adminApiCall } = require("./admin-api");
          const userData = await adminApiCall("/api/auth/user");
          if (userData && (userData.id || userData.email)) {
            setUser(userData);
            return;
          }
        } catch {}

        try {
          const userData = await authApi.getUser();
          if (userData && (userData.id || userData.email)) {
            setUser(userData);
            return;
          }
        } catch {}

        await removeToken("access_token");
        await removeToken("refresh_token");
        await removeToken("session_cookie");
        setAdminTokens(null, null);
        setStoredAccessToken(null);
        setSessionCookie(null);
      }
    } catch {
      await removeToken("session_cookie");
      await removeToken("access_token");
      await removeToken("refresh_token");
      setSessionCookie(null);
      setAdminTokens(null, null);
      setStoredAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginData): Promise<UserProfile | null> => {
    try {
      const result = await adminLogin(data.email, data.password);
      const resolvedUser = result?.user;

      if (resolvedUser && (resolvedUser.id || resolvedUser.email)) {
        setUser(resolvedUser);

        if (result.accessToken) {
          setStoredAccessToken(result.accessToken);
          await storeToken("access_token", result.accessToken);
          if (result.refreshToken) {
            await storeToken("refresh_token", result.refreshToken);
          }
        }

        const cookie = getSessionCookie();
        if (cookie) {
          await storeToken("session_cookie", cookie);
        }

        return resolvedUser as UserProfile;
      }

      throw new Error("Réponse de connexion invalide");
    } catch (error) {
      console.error("Login error:", error instanceof Error ? error.message : error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    await authApi.register(data);
    await login({ email: data.email, password: data.password });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    stopNotificationPolling();
    setUser(null);
    setStoredAccessToken(null);
    setAdminTokens(null, null);
    await removeToken("session_cookie");
    await removeToken("access_token");
    await removeToken("refresh_token");
    await removeToken("social_access_token");
    await removeToken("biometric_enabled");
    setSessionCookie(null);
  };

  const refreshUser = async () => {
    try {
      if (storedAccessToken) {
        const { adminApiCall } = require("./admin-api");
        const userData = await adminApiCall("/api/auth/user");
        if (userData && (userData.id || userData.email)) {
          setUser(userData);
          return;
        }
      }
      const userData = await authApi.getUser();
      setUser(userData);
    } catch {}
  };

  const socialLogin = async (idToken: string, provider: string): Promise<SocialLoginResult> => {
    // Decode Firebase JWT payload client-side (no verification — for extracting email/uid only)
    const decodeFirebaseJwt = (token: string): any => {
      try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const pad = (s: string) => s + "=".repeat((4 - s.length % 4) % 4);
        return JSON.parse(atob(pad(parts[1].replace(/-/g, "+").replace(/_/g, "/"))));
      } catch { return null; }
    };

    const isWeb = Platform.OS === "web" && typeof window !== "undefined";
    let res: globalThis.Response | null = null;

    if (isWeb) {
      // Web: use proxy's /api/auth/social — it handles token verification and normalization
      const origin = window.location.origin;
      const webBase = (origin.includes("localhost:8081") || origin.includes("127.0.0.1:8081"))
        ? origin.replace(/:8081\b/, ":5000")
        : origin;
      try {
        res = await fetch(`${webBase}/api/auth/social`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: idToken, provider }),
        });
      } catch (err: any) {
        throw new Error("Connexion impossible. Vérifiez votre connexion réseau.");
      }
    } else {
      // Native (iOS/Android): /api/auth/social only exists on the proxy server.
      // Call the external backend's Firebase login endpoint directly.
      const { getMobileApiUrl, EXTERNAL_API_FALLBACK } = require("./config");
      const bases: string[] = [getMobileApiUrl(), EXTERNAL_API_FALLBACK]
        .filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i);
      let lastErr: any = null;
      for (const base of bases) {
        try {
          res = await fetch(`${base}/api/mobile/auth/login-with-firebase`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ idToken }),
          });
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[SocialLogin] ${base} unreachable, trying next...`);
        }
      }
      if (!res) throw lastErr || new Error("Authentification sociale échouée");
    }

    let data: any = {};
    try { data = await res.json(); } catch {}

    // Handle "user not found — must register" (404)
    if (res.status === 404) {
      const decoded = decodeFirebaseJwt(idToken);
      return {
        status: "needs_registration",
        email: data.email || decoded?.email || "",
        displayName: data.displayName || decoded?.name || null,
        firebaseUid: data.firebaseUid || decoded?.user_id || decoded?.uid || decoded?.sub || "",
      };
    }

    if (!res.ok) {
      throw new Error(data?.message || "Authentification sociale échouée");
    }

    // Normalize response fields — different backends use different names
    const accessToken =
      data.accessToken || data.token || data.jwt || data.access_token || null;
    const user =
      data.user || data.data?.user || data.profile || data.data || null;
    const refreshToken =
      data.refreshToken || data.refresh_token || data.data?.refreshToken || null;

    if (!accessToken || !user) {
      console.warn("[SocialLogin] Incomplete response:", JSON.stringify(data).slice(0, 300));
      throw new Error("Réponse d'authentification incomplète");
    }

    await storeToken("access_token", accessToken);
    setStoredAccessToken(accessToken);
    setAdminTokens(accessToken, refreshToken);
    if (refreshToken) {
      await storeToken("refresh_token", refreshToken);
    }

    await removeToken("social_access_token");
    setUser(user as UserProfile);

    return {
      status: "authenticated",
      accessToken,
      refreshToken,
      user: user as UserProfile,
    };
  };

  const biometricLogin = async (): Promise<boolean> => {
    if (Platform.OS === "web" || !LocalAuthentication) return false;
    try {
      const biometricSetting = await getToken("biometric_enabled");
      if (biometricSetting !== "true") return false;

      const savedAccessToken = await getToken("access_token");
      const savedCookie = await getToken("session_cookie");
      if (!savedAccessToken && !savedCookie) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Connexion à MyTools",
        cancelLabel: "Annuler",
        disableDeviceFallback: false,
      });

      if (result.success) {
        if (savedAccessToken) {
          const savedRefreshToken = await getToken("refresh_token");
          setAdminTokens(savedAccessToken, savedRefreshToken);
          setStoredAccessToken(savedAccessToken);
          try {
            const { adminApiCall } = require("./admin-api");
            const userData = await adminApiCall("/api/auth/user");
            if (userData && (userData.id || userData.email)) {
              setUser(userData);
              return true;
            }
          } catch {
            await removeToken("access_token");
            await removeToken("refresh_token");
            setAdminTokens(null, null);
            setStoredAccessToken(null);
          }
        }
        if (savedCookie) {
          setSessionCookie(savedCookie);
          try {
            const userData = await authApi.getUser();
            setUser(userData);
            return true;
          } catch {
            await removeToken("session_cookie");
            await removeToken("biometric_enabled");
            setSessionCookie(null);
            return false;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const isAdmin = detectIsAdmin(user);
  const isEmployee = detectIsEmployee(user);
  const isAdminOrEmployee = isAdmin || isEmployee;

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin,
      isEmployee,
      isAdminOrEmployee,
      accessToken: storedAccessToken,
      login,
      register,
      logout,
      refreshUser,
      biometricLogin,
      socialLogin,
    }),
    [user, isLoading, storedAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
