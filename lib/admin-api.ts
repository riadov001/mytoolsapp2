import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";
import { router } from "expo-router";
import { getSessionCookie, setSessionCookie } from "./api";

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
    setSessionCookie(xSessionCookie);
  }

  if (res.status === 401) {
    if (refreshTokenValue) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        fetchHeaders["Authorization"] = `Bearer ${accessToken}`;
        const retryRes = await expoFetch(url, { ...fetchOptions, headers: fetchHeaders });
        if (retryRes.ok) return parseResponse<T>(retryRes);
      }
    }
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

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshTokenValue) return false;
  try {
    const res = await expoFetch(`${API_BASE}/api/mobile/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        accessToken = data.accessToken;
        if (data.refreshToken) refreshTokenValue = data.refreshToken;
        return true;
      }
    }
  } catch {}
  return false;
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
  const res = await expoFetch(`${API_BASE}/api/mobile/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errMsg = await parseError(res);
    throw new Error(errMsg);
  }

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    setSessionCookie(xSessionCookie);
  }

  const data = await res.json();

  if (data.accessToken) {
    accessToken = data.accessToken;
    refreshTokenValue = data.refreshToken || null;
  }

  let user = data.user || data.data || data;
  if (!user?.id && !user?.email) {
    if (data.accessToken) {
      try {
        const meRes = await expoFetch(`${API_BASE}/api/mobile/auth/me`, {
          headers: { Authorization: `Bearer ${data.accessToken}`, Accept: "application/json" },
        });
        if (meRes.ok) user = await meRes.json();
      } catch {}
    }
  }

  try {
    const cookieRes = await expoFetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({ email, password }),
    });
    const xCookie = cookieRes.headers.get("x-session-cookie");
    if (xCookie) {
      setSessionCookie(xCookie);
    }
  } catch {}

  return { user, accessToken: data.accessToken || null, refreshToken: data.refreshToken || null };
}

export async function adminGetMe(): Promise<any> {
  if (!accessToken) return null;
  try {
    const res = await expoFetch(`${API_BASE}/api/mobile/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export const adminAnalytics = {
  get: () => adminApiCall<any>("/api/mobile/admin/analytics"),
  getAdvanced: () => adminApiCall<any>("/api/mobile/admin/advanced-analytics"),
};

export const adminQuotes = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/quotes"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/quotes", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}`, { method: "DELETE" }),
  convertToInvoice: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}/convert-to-invoice`, { method: "POST" }),
};

export const adminInvoices = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/invoices"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/invoices", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}`, { method: "DELETE" }),
};

export const adminReservations = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/reservations"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/reservations", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}`, { method: "DELETE" }),
};

export const adminClients = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/users"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/users/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/users", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/users/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/users/${id}`, { method: "DELETE" }),
};

export const adminServices = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/services"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/services/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/services", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/services/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/services/${id}`, { method: "DELETE" }),
};

export const adminProfile = {
  get: () => adminApiCall<any>("/api/mobile/admin/settings"),
  update: (data: any) => adminApiCall<any>("/api/mobile/admin/settings", { method: "PATCH", body: data }),
};

export const adminNotifications = {
  getAll: () => adminApiCall<any[]>("/api/notifications"),
  getUnreadCount: () => adminApiCall<{ count: number }>("/api/notifications/unread-count"),
  markRead: (id: string) => adminApiCall<any>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => adminApiCall<any>("/api/notifications/read-all", { method: "POST" }),
};
