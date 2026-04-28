let expoFetch: typeof globalThis.fetch;
try { expoFetch = require("expo/fetch").fetch; } catch { expoFetch = globalThis.fetch; }
import { Platform } from "react-native";
import { NATIVE_BACKEND_URLS, getNativeApiBase } from "./config";

const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

export function getBackendUrl() {
  return getNativeApiBase();
}

function isNetworkError(err: any): boolean {
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return true;
  if (err instanceof TimeoutError) return true;
  if (err?.name === "TypeError" && err?.message?.includes("Network")) return true;
  if (err?.message?.includes("fetch") || err?.message?.includes("network")) return true;
  return false;
}

class TimeoutError extends Error {
  constructor() {
    super("Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez.");
    this.name = "TimeoutError";
  }
}

async function fetchWithTimeout(
  url: string,
  options: any,
  useGlobal = false,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchFn = useGlobal ? globalThis.fetch : expoFetch;
    const res = await fetchFn(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new TimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(
  url: string,
  options: any,
  useGlobal = false,
  retries = 1
): Promise<Response> {
  try {
    return await fetchWithTimeout(url, options, useGlobal);
  } catch (err: any) {
    if (retries > 0 && isNetworkError(err)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, useGlobal, retries - 1);
    }
    if (isNetworkError(err) && !(err instanceof TimeoutError)) {
      throw new Error("Erreur réseau. Vérifiez votre connexion et réessayez.");
    }
    throw err;
  }
}

async function fetchWithNativeFallback(endpoint: string, options: any, useGlobal = false): Promise<Response> {
  if (Platform.OS === "web" || NATIVE_BACKEND_URLS.length <= 1) {
    return fetchWithRetry(`${getNativeApiBase()}${endpoint}`, options, useGlobal);
  }
  let lastErr: any;
  for (const base of NATIVE_BACKEND_URLS) {
    try {
      const res = await fetchWithTimeout(`${base}${endpoint}`, options, useGlobal);
      return res;
    } catch (err: any) {
      lastErr = err;
      if (isNetworkError(err) && !(err instanceof TimeoutError)) {
        console.warn(`[API] Backend ${base} unreachable, trying fallback...`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

let sessionCookie: string | null = null;
let apiAccessToken: string | null = null;
let apiRefreshToken: string | null = null;
let apiOnTokensRefreshed: ((access: string, refresh: string | null) => void) | null = null;

export function setApiAccessToken(token: string | null) {
  apiAccessToken = token;
}

export function getApiAccessToken() {
  return apiAccessToken;
}

export function setApiRefreshToken(token: string | null) {
  apiRefreshToken = token;
}

export function setApiOnTokensRefreshed(cb: (access: string, refresh: string | null) => void) {
  apiOnTokensRefreshed = cb;
}

async function tryRefreshApiToken(): Promise<boolean> {
  if (!apiRefreshToken) return false;
  try {
    const res = await fetchWithRetry(`${getNativeApiBase()}/api/mobile/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: apiRefreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        apiAccessToken = data.accessToken;
        if (data.refreshToken) apiRefreshToken = data.refreshToken;
        if (apiOnTokensRefreshed) {
          apiOnTokensRefreshed(data.accessToken, data.refreshToken || null);
        }
        return true;
      }
    }
  } catch {}
  return false;
}

export function setSessionCookie(cookie: string | null) {
  if (cookie) {
    if (cookie.includes("=")) {
      sessionCookie = cookie;
    } else {
      sessionCookie = `myjantes.sid=${cookie}`;
    }
  } else {
    sessionCookie = null;
  }
}

export function getSessionCookie() {
  return sessionCookie;
}

export async function apiCall<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  const fetchHeaders: Record<string, string> = {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...headers,
  };

  if (!isFormData && body) {
    fetchHeaders["Content-Type"] = "application/json";
  }

  if (apiAccessToken) {
    fetchHeaders["Authorization"] = `Bearer ${apiAccessToken}`;
  } else if (sessionCookie) {
    fetchHeaders["Cookie"] = sessionCookie;
  }

  let res: Response;

  if (isFormData) {
    const formHeaders: Record<string, string> = {};
    if (apiAccessToken) {
      formHeaders["Authorization"] = `Bearer ${apiAccessToken}`;
    } else if (sessionCookie) {
      formHeaders["Cookie"] = sessionCookie;
    }

    res = await fetchWithNativeFallback(endpoint, {
      method,
      headers: formHeaders,
      body: body,
      credentials: "include" as const,
    }, true);
  } else {
    const fetchOptions: any = {
      method,
      headers: fetchHeaders,
      credentials: "include" as const,
    };
    if (body) {
      if (typeof body === 'object') {
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = String(body);
      }
    }
    res = await fetchWithNativeFallback(endpoint, fetchOptions, false);
  }

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    sessionCookie = xSessionCookie;
  } else {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const sessionNames = ["myjantes.sid", "connect.sid", "laravel_session", "phpsessid"];
      const nameValuePart = setCookie.split(";")[0]?.trim() || "";
      const cookieName = nameValuePart.split("=")[0]?.toLowerCase() || "";
      const isSession = sessionNames.some(n => cookieName === n) ||
        cookieName.includes("session") || cookieName.includes("sid");
      if (isSession && nameValuePart) {
        sessionCookie = nameValuePart;
      }
    }
  }

  if (res.status === 429) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
  }

  if (res.status === 401 && apiRefreshToken) {
    const refreshed = await tryRefreshApiToken();
    if (refreshed) {
      if (isFormData) {
        const retryFormHeaders: Record<string, string> = {
          Authorization: `Bearer ${apiAccessToken}`,
        };
        res = await fetchWithNativeFallback(endpoint, {
          method,
          headers: retryFormHeaders,
          body,
          credentials: "include" as const,
        }, true);
      } else {
        fetchHeaders["Authorization"] = `Bearer ${apiAccessToken}`;
        const retryOptions: any = {
          method,
          headers: fetchHeaders,
          credentials: "include" as const,
        };
        if (body) {
          retryOptions.body = typeof body === "object" ? JSON.stringify(body) : String(body);
        }
        res = await fetchWithNativeFallback(endpoint, retryOptions, false);
      }
    }
  }

  if (!res.ok) {
    let errorMessage = `Erreur ${res.status}`;
    try {
      const text = await res.text();
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        if (text) errorMessage = text.substring(0, 200);
      }
    } catch {}
    throw new Error(errorMessage);
  }

  const text = await res.text();
  if (!text || text.trim() === "") return {} as T;
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("Service temporairement indisponible. Veuillez réessayer.");
  }
  try {
    const parsed = JSON.parse(text);
    return parsed as T;
  } catch {
    return {} as T;
  }
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  profileImageUrl: string | null;
  role: "client" | "client_professionnel" | "admin" | "super_admin" | "superadmin" | "root_admin" | "root" | "ROOT" | "employe" | "employee" | "manager";
  garageId: string | null;
  companyName: string | null;
  siret: string | null;
  tvaNumber: string | null;
  companyAddress: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  garageId: string | null;
  name: string;
  description: string;
  basePrice: string;
  category: string;
  isActive: boolean;
  estimatedDuration: string | null;
  imageUrl: string | null;
  customFormFields: any;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  quoteNumber: string | null;
  clientId: string;
  status: string;
  totalAmount: string | null;
  notes: string | null;
  items: any[];
  photos: any[];
  createdAt: string;
  updatedAt: string;
  services?: Service[];
  vehicleInfo?: any;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  role: "client" | "client_professionnel";
  garageId?: string;
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string;
}

export interface Garage {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

export const garagesApi = {
  getAll: async (): Promise<Garage[]> => {
    try {
      const result = await apiCall<any>("/api/public/garages");
      if (Array.isArray(result)) return result;
      if (result?.data && Array.isArray(result.data)) return result.data;
      return [];
    } catch {
      return [];
    }
  },
};

export interface LoginData {
  email: string;
  password: string;
}

export interface SupportContactData {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    apiCall<{ message: string; userId: string }>("/api/mobile/auth/register", {
      method: "POST",
      body: data,
    }),

  login: async (data: LoginData) => {
    const result = await apiCall<any>("/api/mobile/auth/login", {
      method: "POST",
      body: data,
    });
    if (result?.user) return { user: result.user };
    if (result?.id || result?.email) return { user: result };
    if (result?.data?.id || result?.data?.email) return { user: result.data };
    return result;
  },

  logout: () =>
    apiCall("/api/mobile/auth/logout", { method: "POST" }),

  getUser: async () => {
    const result = await apiCall<any>("/api/mobile/auth/me");
    if (result?.user) return result.user as UserProfile;
    if (result?.id || result?.email) return result as UserProfile;
    if (result?.data) return result.data as UserProfile;
    return result as UserProfile;
  },

  updateUser: (data: Partial<UserProfile>) =>
    apiCall<UserProfile>("/api/mobile/profile", {
      method: "PATCH",
      body: data,
    }),

  forgotPassword: (email: string) =>
    apiCall<{ message: string; sent?: boolean }>("/api/mobile/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),

  verifyResetCode: (email: string, code: string) =>
    apiCall<{ valid: boolean; resetToken?: string; message?: string }>("/api/mobile/auth/verify-reset-code", {
      method: "POST",
      body: { email, code },
    }),

  resetPassword: (resetToken: string, newPassword: string) =>
    apiCall("/api/mobile/auth/reset-password", {
      method: "POST",
      body: { resetToken, newPassword },
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall("/api/mobile/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  resendVerification: (email: string) =>
    apiCall<{ message: string }>("/api/mobile/auth/resend-verification", {
      method: "POST",
      body: { email },
    }),

  updateNotificationPreferences: (preferences: { push?: boolean; email?: boolean; sms?: boolean }) =>
    apiCall("/api/mobile/profile", {
      method: "PATCH",
      body: preferences,
    }),

  getNotificationPreferences: () =>
    apiCall<{ push: boolean; email: boolean; sms: boolean }>("/api/mobile/profile"),

  deleteAccount: () =>
    apiCall("/api/mobile/auth/account", { method: "DELETE" }),
};

export const devicesApi = {
  register: (token: string, platform: "ios" | "android") =>
    apiCall("/api/mobile/devices", {
      method: "POST",
      body: { token, platform },
    }),
  unregister: (token: string) =>
    apiCall(`/api/mobile/devices/${encodeURIComponent(token)}`, { method: "DELETE" }),
  getAll: () => apiCall<any[]>("/api/mobile/devices"),
};

export const profileApi = {
  get: async () => {
    const result = await apiCall<any>("/api/mobile/profile");
    if (result?.user) return result.user as UserProfile;
    if (result?.id || result?.email) return result as UserProfile;
    return result as UserProfile;
  },
  update: (data: Partial<UserProfile>) =>
    apiCall<UserProfile>("/api/mobile/profile", { method: "PATCH", body: data }),
  delete: () =>
    apiCall("/api/mobile/auth/account", { method: "DELETE" }),
  uploadAvatar: (formData: FormData) =>
    apiCall<any>("/api/mobile/profile/avatar", { method: "POST", body: formData, isFormData: true }),
};

export const legalApi = {
  getTerms: () => apiCall<any>("/api/mobile/legal/terms"),
  getCompliance: () => apiCall<any>("/api/mobile/legal/compliance"),
  getPrivacyPolicy: () => apiCall<any>("/api/mobile/public/privacy-policy"),
  getPublicTerms: () => apiCall<any>("/api/mobile/public/terms"),
  getLegalUrls: () => apiCall<{ privacyPolicyUrl: string; termsUrl: string; supportEmail: string; gdprCompliant: boolean }>("/api/mobile/public/legal"),
};

export const servicesApi = {
  getAll: async () => unwrapList<Service>(await apiCall("/api/mobile/services")),
};

export interface Invoice {
  id: string;
  quoteId: string | null;
  clientId: string;
  invoiceNumber: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  tvaAmount: string;
  tvaRate: string;
  dueDate: string | null;
  paidAt: string | null;
  items: any[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  quoteId: string | null;
  serviceId: string | null;
  reference: string | null;
  date: string;
  scheduledDate: string | null;
  estimatedEndDate: string | null;
  timeSlot: string | null;
  status: string;
  notes: string | null;
  vehicleInfo: any;
  wheelCount: number | null;
  diameter: string | null;
  priceExcludingTax: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  productDetails: string | null;
  assignedEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
}

function unwrapList<T>(result: any): T[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const arr = result.data || result.results || result.items || result.rows || result.records;
    if (Array.isArray(arr)) return arr;
    for (const key of Object.keys(result)) {
      if (Array.isArray(result[key]) && result[key].length > 0) {
        return result[key];
      }
    }
  }
  return [];
}

function unwrapSingle<T>(result: any, idField?: string): T {
  if (!result || typeof result !== "object") return result;
  if (result.id || result._id) return result as T;
  const inner = result.data || result.result || result.item || result.record;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as T;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && typeof val === "object" && !Array.isArray(val) && (val.id || val._id)) {
      return val as T;
    }
  }
  return result as T;
}

export const quotesApi = {
  getAll: async () => unwrapList<Quote>(await apiCall("/api/mobile/quotes")),
  getById: async (id: string) => unwrapSingle<Quote>(await apiCall(`/api/mobile/quotes/${id}`)),
  getMedia: (id: string) => apiCall<any[]>(`/api/mobile/quotes/${id}/media`),
  getPdfData: (id: string) => apiCall<any>(`/api/mobile/quotes/${id}/pdf-data`),

  create: (data: any) =>
    apiCall<Quote>("/api/mobile/quotes", { method: "POST", body: data }),

  update: (id: string, data: any) =>
    apiCall<Quote>(`/api/mobile/quotes/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) =>
    apiCall(`/api/mobile/quotes/${id}`, { method: "DELETE" }),

  convertToInvoice: (id: string) =>
    apiCall(`/api/mobile/quotes/${id}/convert-to-invoice`, { method: "POST" }),

  createReservation: (id: string, data: any) =>
    apiCall(`/api/mobile/quotes/${id}/create-reservation`, { method: "POST", body: data }),

  accept: async (id: string) =>
    apiCall(`/api/mobile/quotes/${id}`, { method: "PATCH", body: { status: "accepted" } }),

  reject: async (id: string) =>
    apiCall(`/api/mobile/quotes/${id}`, { method: "PATCH", body: { status: "rejected" } }),
};

export const invoicesApi = {
  getAll: async () => unwrapList<Invoice>(await apiCall("/api/mobile/invoices")),
  getById: async (id: string) => unwrapSingle<Invoice>(await apiCall(`/api/mobile/invoices/${id}`)),
  getMedia: (id: string) => apiCall<any[]>(`/api/mobile/invoices/${id}/media`),
  getPdfData: (id: string) => apiCall<any>(`/api/mobile/invoices/${id}/pdf-data`),

  create: (data: any) =>
    apiCall<Invoice>("/api/mobile/invoices", { method: "POST", body: data }),

  update: (id: string, data: any) =>
    apiCall<Invoice>(`/api/mobile/invoices/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) =>
    apiCall(`/api/mobile/invoices/${id}`, { method: "DELETE" }),
};

export const reservationsApi = {
  getAll: async () => unwrapList<Reservation>(await apiCall("/api/mobile/reservations")),
  getById: async (id: string) => unwrapSingle<Reservation>(await apiCall(`/api/mobile/reservations/${id}`)),
  getServices: async (id: string) => unwrapList<any>(await apiCall(`/api/mobile/reservations/${id}/services`)),

  create: (data: {
    quoteId?: string;
    serviceId?: string;
    scheduledDate: string;
    date?: string;
    timeSlot: string;
    time_slot?: string;
    notes?: string;
    vehicleInfo?: any;
  }) => apiCall<Reservation>("/api/mobile/reservations", { method: "POST", body: data }),

  update: (id: string, data: any) =>
    apiCall<Reservation>(`/api/mobile/reservations/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) =>
    apiCall(`/api/mobile/reservations/${id}`, { method: "DELETE" }),
};

export interface Notification {
  id: string;
  userId: string;
  type: "quote" | "invoice" | "reservation" | "service" | "chat";
  title: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdById: string;
  isArchived: boolean;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  participants?: any[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: { id: string; firstName: string; lastName: string; role: string };
}

export const notificationsApi = {
  getAll: async () => unwrapList<Notification>(await apiCall("/api/mobile/notifications")),
  getUnreadCount: () =>
    apiCall<{ count: number }>("/api/mobile/notifications/unread-count"),
  markRead: (id: string) =>
    apiCall("/api/mobile/notifications/" + id + "/read", { method: "PATCH" }),
  markAllRead: () =>
    apiCall("/api/mobile/notifications/mark-all-read", { method: "POST" }),
};

export const chatApi = {
  getConversations: async () => unwrapList<ChatConversation>(await apiCall("/api/chat/conversations")),
  getMessages: async (conversationId: string) =>
    unwrapList<ChatMessage>(await apiCall(`/api/chat/conversations/${conversationId}/messages`)),
  sendMessage: (conversationId: string, content: string) =>
    apiCall<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { content },
    }),
  getUsers: () => apiCall<any[]>("/api/chat/users"),
};

export const supportApi = {
  sendMessage: (message: string) =>
    apiCall<{ success: boolean; message: string; messageId?: string; conversationId?: string }>(
      "/api/mobile/support/messages",
      { method: "POST", body: { message } }
    ),
  getHistory: async () => {
    try {
      const result = await apiCall<any>("/api/mobile/support/messages");
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.data)) return result.data;
      if (result && Array.isArray(result.messages)) return result.messages;
      return [];
    } catch {
      return [];
    }
  },
  contact: (data: SupportContactData) => {
    const formatted = `[${data.category}] ${data.subject}\n\nDe : ${data.name} (${data.email})\n\n${data.message}`;
    return apiCall<{ success: boolean; message: string }>("/api/mobile/support/messages", {
      method: "POST",
      body: { message: formatted },
    });
  },
};
