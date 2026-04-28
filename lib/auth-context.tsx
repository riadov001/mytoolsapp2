import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { authApi, UserProfile, LoginData, RegisterData, setSessionCookie, getSessionCookie, setApiAccessToken, setApiRefreshToken, setApiOnTokensRefreshed } from "./api";
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
  appleLogin: (idToken: string, rawNonce: string) => Promise<SocialLoginResult>;
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
    setApiOnTokensRefreshed(async (access, refresh) => {
      setStoredAccessToken(access);
      setApiAccessToken(access);
      if (refresh) setApiRefreshToken(refresh);
      try {
        await storeToken("access_token", access);
        if (refresh) await storeToken("refresh_token", refresh);
      } catch {}
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
          registerForPushNotificationsAsync().then(async (token) => {
            if (token) {
              const { registerDevice: regD, storePushToken } = require("./push-devices");
              await storePushToken(token).catch(() => {});
              regD(token).catch(() => {});
            }
          }).catch(() => {});
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
    setApiAccessToken(null);
    setApiRefreshToken(null);
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
        setApiAccessToken(savedAccessToken);
        setApiRefreshToken(savedRefreshToken);
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
          const res = await adminApiCall("/api/mobile/auth/me");
          const userData = res?.user || res;
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

  const login = useCallback(async (data: LoginData): Promise<UserProfile | null> => {
    try {
      const result = await adminLogin(data.email, data.password);
      const resolvedUser = result?.user;

      if (resolvedUser && (resolvedUser.id || resolvedUser.email)) {
        setUser(resolvedUser);

        if (result.accessToken) {
          setStoredAccessToken(result.accessToken);
          setApiAccessToken(result.accessToken);
          setApiRefreshToken(result.refreshToken || null);
          await storeToken("access_token", result.accessToken);
          if (result.refreshToken) {
            await storeToken("refresh_token", result.refreshToken);
          }
        }

        const cookie = getSessionCookie();
        if (cookie) {
          await storeToken("session_cookie", cookie);
        }

        const { registerDevice, getStoredPushToken } = require("./push-devices");
        const pushToken = await getStoredPushToken();
        if (pushToken) registerDevice(pushToken).catch(() => {});

        return resolvedUser as UserProfile;
      }

      throw new Error("Réponse de connexion invalide");
    } catch (error) {
      console.error("Login error:", error instanceof Error ? error.message : error);
      throw error;
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await authApi.register(data);
    await login({ email: data.email, password: data.password });
  }, [login]);

  const logout = useCallback(async () => {
    try {
      const { getStoredPushToken, unregisterDevice } = require("./push-devices");
      const pushToken = await getStoredPushToken();
      if (pushToken) await unregisterDevice(pushToken).catch(() => {});
    } catch {}
    try {
      await authApi.logout();
    } catch {}
    stopNotificationPolling();
    setUser(null);
    setStoredAccessToken(null);
    setAdminTokens(null, null);
    setApiAccessToken(null);
    setApiRefreshToken(null);
    await removeToken("session_cookie");
    await removeToken("access_token");
    await removeToken("refresh_token");
    await removeToken("social_access_token");
    await removeToken("biometric_enabled");
    setSessionCookie(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      if (storedAccessToken) {
        const { adminApiCall } = require("./admin-api");
        const res = await adminApiCall("/api/mobile/auth/me");
        const userData = res?.user || res;
        if (userData && (userData.id || userData.email)) {
          setUser(userData);
          return;
        }
      }
      const userData = await authApi.getUser();
      setUser(userData);
    } catch {}
  }, [storedAccessToken]);

  const socialLogin = useCallback(async (idToken: string, provider: string): Promise<SocialLoginResult> => {
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
      // Native (iOS/Android): call the external backend's Firebase login endpoint directly.
      const { getMobileApiUrl } = require("./config");
      const bases: string[] = [getMobileApiUrl()].filter((v: string) => !!v);
      let lastErr: any = null;
      for (const base of bases) {
        try {
          const attempt = await fetch(`${base}/api/mobile/auth/login-with-firebase`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ idToken }),
          });
          // Skip HTML responses (SPA catch-all — endpoint not implemented on this backend)
          const ct = attempt.headers.get("content-type") || "";
          if (attempt.ok && !ct.includes("application/json")) {
            console.warn(`[SocialLogin] ${base} returned non-JSON — Firebase endpoint unavailable, trying next`);
            continue;
          }
          res = attempt;
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[SocialLogin] ${base} unreachable:`, err.message);
        }
      }

      // Backend Firebase endpoint not available on any server — decode JWT locally
      if (!res) {
        const decoded = decodeFirebaseJwt(idToken);
        const email = decoded?.email || "";
        const uid = decoded?.user_id || decoded?.uid || decoded?.sub || "";
        if (!email) throw new Error("Impossible de récupérer votre email depuis le compte Google/Apple.");
        console.warn("[SocialLogin] Backend Firebase endpoint unavailable — redirecting to registration");
        return {
          status: "needs_registration",
          email,
          displayName: decoded?.name || null,
          firebaseUid: uid,
        };
      }
    }

    // Parse response body safely (backend may return JSON, HTML, or plain text)
    let data: any = {};
    try {
      const rawText = await res!.text();
      const trimmed = rawText.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        data = JSON.parse(trimmed);
      } else if (trimmed.startsWith("<")) {
        // HTML catch-all — backend endpoint not implemented, treat as "no account found"
        const decoded = decodeFirebaseJwt(idToken);
        const email = decoded?.email || "";
        const uid = decoded?.user_id || decoded?.uid || decoded?.sub || "";
        if (!email) throw new Error("Impossible de récupérer votre email depuis le compte Google/Apple.");
        return {
          status: "needs_registration",
          email,
          displayName: decoded?.name || null,
          firebaseUid: uid,
        };
      }
      // Plain text error (e.g. "Internal Server Error") — leave data as {}
    } catch (e: any) {
      // Re-throw our own explicit errors, ignore parse errors
      if ((e as Error).message?.includes("récupérer votre email")) throw e;
    }

    // Handle "user not found — must register" (404)
    if (res!.status === 404) {
      const decoded = decodeFirebaseJwt(idToken);
      return {
        status: "needs_registration",
        email: data.email || decoded?.email || "",
        displayName: data.displayName || decoded?.name || null,
        firebaseUid: data.firebaseUid || decoded?.user_id || decoded?.uid || decoded?.sub || "",
      };
    }

    if (!res!.ok) {
      // Map backend error codes to user-friendly French messages
      const msg: string = data?.message || data?.error || "";
      if (res!.status === 401 || res!.status === 403) {
        throw new Error(msg || "Token Firebase invalide ou expiré. Veuillez réessayer.");
      }
      throw new Error(msg || "Authentification sociale échouée. Veuillez réessayer.");
    }

    // Normalize response — different backends use different field names
    const accessToken =
      data.accessToken || data.token || data.jwt || data.access_token || null;
    const user =
      data.user || data.data?.user || data.profile || data.data || null;
    const refreshToken =
      data.refreshToken || data.refresh_token || data.data?.refreshToken || null;

    if (!accessToken || !user) {
      console.warn("[SocialLogin] Incomplete response:", JSON.stringify(data).slice(0, 300));
      throw new Error("Connexion Google/Apple indisponible. Veuillez utiliser email et mot de passe ou contacter le support.");
    }

    await storeToken("access_token", accessToken);
    setStoredAccessToken(accessToken);
    setAdminTokens(accessToken, refreshToken);
    setApiAccessToken(accessToken);
    setApiRefreshToken(refreshToken);
    if (refreshToken) {
      await storeToken("refresh_token", refreshToken);
    }

    await removeToken("social_access_token");
    setUser(user as UserProfile);

    const { registerDevice: regDev, getStoredPushToken: getPushTok } = require("./push-devices");
    const pushTok = await getPushTok();
    if (pushTok) regDev(pushTok).catch(() => {});

    return {
      status: "authenticated",
      accessToken,
      refreshToken,
      user: user as UserProfile,
    };
  }, []);

  const appleLogin = useCallback(async (idToken: string, rawNonce: string): Promise<SocialLoginResult> => {
    const { adminApiCall } = require("./admin-api");
    let data: any = {};
    try {
      data = await adminApiCall<any>("/api/mobile/auth/apple", {
        method: "POST",
        body: { idToken, nonce: rawNonce },
      });
    } catch (err: any) {
      throw new Error(err?.message || "Connexion Apple échouée. Veuillez réessayer.");
    }

    if (data?.status === "needs_registration" || data?.needsRegistration) {
      return {
        status: "needs_registration",
        email: data.email || "",
        displayName: data.displayName || null,
        firebaseUid: data.uid || data.appleUid || data.sub || "",
      };
    }

    const accessToken =
      data.accessToken || data.token || data.jwt || data.access_token || null;
    const user = data.user || data.data?.user || data.profile || data.data || null;
    const refreshToken =
      data.refreshToken || data.refresh_token || data.data?.refreshToken || null;

    if (!accessToken || !user) {
      throw new Error(
        "Connexion Apple indisponible. Veuillez utiliser email et mot de passe."
      );
    }

    await storeToken("access_token", accessToken);
    setStoredAccessToken(accessToken);
    setAdminTokens(accessToken, refreshToken);
    setApiAccessToken(accessToken);
    setApiRefreshToken(refreshToken);
    if (refreshToken) {
      await storeToken("refresh_token", refreshToken);
    }
    await removeToken("social_access_token");
    setUser(user as UserProfile);

    const { registerDevice: regApple, getStoredPushToken: getApplePush } = require("./push-devices");
    const applePush = await getApplePush();
    if (applePush) regApple(applePush).catch(() => {});

    return {
      status: "authenticated",
      accessToken,
      refreshToken,
      user: user as UserProfile,
    };
  }, []);

  const biometricLogin = useCallback(async (): Promise<boolean> => {
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
          setApiAccessToken(savedAccessToken);
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
  }, []);

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
      appleLogin,
    }),
    [user, isLoading, storedAccessToken, login, register, logout, refreshUser, biometricLogin, socialLogin, appleLogin]
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
