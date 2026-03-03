import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { authApi, UserProfile, LoginData, RegisterData, setSessionCookie } from "./api";
import { registerForPushNotificationsAsync, startNotificationPolling, stopNotificationPolling, addNotificationResponseListener } from "./push-notifications";

let LocalAuthentication: any = null;
if (Platform.OS !== "web") {
  try {
    LocalAuthentication = require("expo-local-authentication");
  } catch {}
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  biometricLogin: () => Promise<boolean>;
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
  const notificationListenerRef = useRef<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && Platform.OS !== "web") {
      registerForPushNotificationsAsync().catch(() => {});
      startNotificationPolling(30000);

      notificationListenerRef.current = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "quote" && data?.relatedId) {
          router.push({ pathname: "/(main)/quote-detail", params: { id: data.relatedId as string } });
        } else if (data?.type === "invoice" && data?.relatedId) {
          router.push({ pathname: "/(main)/invoice-detail", params: { id: data.relatedId as string } });
        } else if (data?.type === "reservation" && data?.relatedId) {
          router.push({ pathname: "/(main)/reservation-detail", params: { id: data.relatedId as string } });
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

  const checkAuth = async () => {
    try {
      const savedCookie = await getToken("session_cookie");
      if (savedCookie) {
        setSessionCookie(savedCookie);
        const userData = await authApi.getUser();
        setUser(userData);
      }
    } catch {
      await removeToken("session_cookie");
      setSessionCookie(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginData) => {
    try {
      const result = await authApi.login(data);
      if (result?.user) {
        setUser(result.user);
      } else if ((result as any)?.id) {
        setUser(result as any);
      }
      const { getSessionCookie } = require("./api");
      const cookie = getSessionCookie();
      if (cookie) {
        await storeToken("session_cookie", cookie);
      }
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
    await removeToken("session_cookie");
    setSessionCookie(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getUser();
      setUser(userData);
    } catch {}
  };

  const biometricLogin = async (): Promise<boolean> => {
    if (Platform.OS === "web" || !LocalAuthentication) return false;
    try {
      const biometricSetting = await getToken("biometric_enabled");
      if (biometricSetting !== "true") return false;

      const savedCookie = await getToken("session_cookie");
      if (!savedCookie) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Connexion à MyJantes",
        cancelLabel: "Annuler",
        disableDeviceFallback: false,
      });

      if (result.success) {
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
      return false;
    } catch {
      return false;
    }
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
      biometricLogin,
    }),
    [user, isLoading]
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
