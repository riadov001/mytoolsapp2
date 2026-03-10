import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";
import { router } from "expo-router";
import { getSessionCookie } from "./api";

const getApiBase = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
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
  return "https://saas.mytoolsgroup.eu";
};

const API_BASE = getApiBase();

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let onTokenExpired: (() => void) | null = null;

export function setAdminTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshTokenValue = refresh;
}

export function getAdminAccessToken() {
  return accessToken;
}

export function setOnTokenExpired(cb: () => void) {
  onTokenExpired = cb;
}

interface AdminApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function adminApiCall<T = any>(
  endpoint: string,
  options: AdminApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const fetchHeaders: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...headers,
  };

  if (accessToken) {
    fetchHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  const cookie = getSessionCookie();
  if (cookie) {
    fetchHeaders["Cookie"] = cookie;
  }

  const url = `${API_BASE}${endpoint}`;

  const fetchOptions: any = {
    method,
    headers: fetchHeaders,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await expoFetch(url, fetchOptions);

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    const { setSessionCookie } = require("./api");
    setSessionCookie(xSessionCookie);
  }

  if (res.status === 401) {
    if (onTokenExpired) onTokenExpired();
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  if (res.status === 403) {
    throw new Error("Accès refusé. Vous n'avez pas les permissions nécessaires.");
  }

  if (!res.ok) {
    const errMsg = await parseError(res);
    throw new Error(errMsg);
  }

  return parseResponse<T>(res);
}

async function parseError(res: Response): Promise<string> {
  let errorMessage = `Erreur ${res.status}`;
  try {
    const text = await res.text();
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      if (text && !text.startsWith("<!DOCTYPE")) errorMessage = text.substring(0, 200);
    }
  } catch {}
  return errorMessage;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || text.trim() === "") return {} as T;
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function adminLogin(email: string, password: string) {
  const cookie = getSessionCookie();
  const loginHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (cookie) {
    loginHeaders["Cookie"] = cookie;
  }

  const res = await expoFetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: loginHeaders,
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errMsg = await parseError(res);
    throw new Error(errMsg);
  }

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    const { setSessionCookie } = require("./api");
    setSessionCookie(xSessionCookie);
  }

  const data = await res.json();

  if (data.accessToken) {
    accessToken = data.accessToken;
    refreshTokenValue = data.refreshToken || null;
  }

  let user = data;
  if (data.user) user = data.user;
  else if (data.data) user = data.data;

  return { user, accessToken: data.accessToken || null, refreshToken: data.refreshToken || null };
}

export const adminAnalytics = {
  get: () => adminApiCall<any>("/api/admin/analytics"),
  getAdvanced: () => adminApiCall<any>("/api/admin/advanced-analytics"),
};

export const adminQuotes = {
  getAll: () => adminApiCall<any[]>("/api/admin/quotes"),
  getById: (id: string) => adminApiCall<any>(`/api/admin/quotes/${id}`),
  create: (data: any) => adminApiCall<any>("/api/admin/quotes", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/admin/quotes/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/admin/quotes/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/admin/quotes/${id}`, { method: "DELETE" }),
};

export const adminInvoices = {
  getAll: () => adminApiCall<any[]>("/api/admin/invoices"),
  getById: (id: string) => adminApiCall<any>(`/api/admin/invoices/${id}`),
  create: (data: any) => adminApiCall<any>("/api/admin/invoices", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/admin/invoices/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/admin/invoices/${id}`, { method: "DELETE" }),
};

export const adminReservations = {
  getAll: () => adminApiCall<any[]>("/api/admin/reservations"),
  getById: (id: string) => adminApiCall<any>(`/api/admin/reservations/${id}`),
  create: (data: any) => adminApiCall<any>("/api/admin/reservations", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/admin/reservations/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/admin/reservations/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/admin/reservations/${id}`, { method: "DELETE" }),
};

export const adminClients = {
  getAll: () => adminApiCall<any[]>("/api/admin/users"),
  getById: (id: string) => adminApiCall<any>(`/api/admin/users/${id}`),
  create: (data: any) => adminApiCall<any>("/api/admin/users", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/admin/users/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/admin/users/${id}`, { method: "DELETE" }),
};

export const adminServices = {
  getAll: () => adminApiCall<any[]>("/api/admin/services"),
  getById: (id: string) => adminApiCall<any>(`/api/admin/services/${id}`),
  create: (data: any) => adminApiCall<any>("/api/admin/services", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/admin/services/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/admin/services/${id}`, { method: "DELETE" }),
};

export const adminProfile = {
  get: () => adminApiCall<any>("/api/user/profile"),
  update: (data: any) => adminApiCall<any>("/api/user/profile", { method: "PATCH", body: data }),
};

export const adminNotifications = {
  getAll: () => adminApiCall<any[]>("/api/notifications"),
  getUnreadCount: () => adminApiCall<{ count: number }>("/api/notifications/unread-count"),
  markRead: (id: string) => adminApiCall<any>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => adminApiCall<any>("/api/notifications/read-all", { method: "POST" }),
};
