let expoFetch: typeof globalThis.fetch;
try { expoFetch = require("expo/fetch").fetch; } catch { expoFetch = globalThis.fetch; }
import { Platform } from "react-native";

const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

const NATIVE_BACKEND_URLS = [
  "https://saas.mytoolsgroup.eu",
  "https://pwa.mytoolsgroup.eu",
];

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
  return NATIVE_BACKEND_URLS[0];
};

const API_BASE = getApiBase();

export function getBackendUrl() {
  return API_BASE;
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
    return fetchWithRetry(`${API_BASE}${endpoint}`, options, useGlobal);
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

  if (sessionCookie) {
    fetchHeaders["Cookie"] = sessionCookie;
  }

  let res: Response;

  if (isFormData) {
    const formHeaders: Record<string, string> = {};
    if (sessionCookie) {
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
    apiCall<{ message: string; userId: string }>("/api/register", {
      method: "POST",
      body: data,
    }),

  login: async (data: LoginData) => {
    const result = await apiCall<any>("/api/login", {
      method: "POST",
      body: data,
    });
    if (result?.user) return { user: result.user };
    if (result?.id || result?.email) return { user: result };
    if (result?.data?.id || result?.data?.email) return { user: result.data };
    return result;
  },

  logout: () =>
    apiCall("/api/logout", { method: "POST" }),

  getUser: async () => {
    const result = await apiCall<any>("/api/auth/user");
    if (result?.id || result?.email) return result as UserProfile;
    if (result?.user) return result.user as UserProfile;
    if (result?.data) return result.data as UserProfile;
    return result as UserProfile;
  },

  updateUser: (data: Partial<UserProfile>) =>
    apiCall<UserProfile>("/api/auth/user", {
      method: "PUT",
      body: data,
    }),

  forgotPassword: (email: string) =>
    apiCall<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    apiCall("/api/auth/reset-password", {
      method: "POST",
      body: { email, token, newPassword },
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  updateNotificationPreferences: (preferences: { push?: boolean; email?: boolean; sms?: boolean }) =>
    apiCall("/api/auth/notification-preferences", {
      method: "PUT",
      body: preferences,
    }),

  getNotificationPreferences: () =>
    apiCall<{ push: boolean; email: boolean; sms: boolean }>("/api/auth/notification-preferences"),
};

export const servicesApi = {
  getAll: async () => unwrapList<Service>(await apiCall("/api/services")),
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
  getAll: async () => unwrapList<Quote>(await apiCall("/api/quotes")),
  getById: async (id: string) => unwrapSingle<Quote>(await apiCall(`/api/quotes/${id}`)),

  create: (data: any) =>
    apiCall<Quote>("/api/quotes", {
      method: "POST",
      body: data,
    }),

  accept: async (id: string, viewToken?: string) => {
    return apiCall(`/api/quotes/${id}/accept`, { method: "POST" });
  },

  reject: async (id: string, viewToken?: string) => {
    return apiCall(`/api/quotes/${id}/reject`, { method: "POST" });
  },
};

export const invoicesApi = {
  getAll: async () => unwrapList<Invoice>(await apiCall("/api/invoices")),
  getById: async (id: string) => unwrapSingle<Invoice>(await apiCall(`/api/invoices/${id}`)),
};

export const reservationsApi = {
  getAll: async () => unwrapList<Reservation>(await apiCall("/api/reservations")),
  getById: async (id: string) => unwrapSingle<Reservation>(await apiCall(`/api/reservations/${id}`)),
  getServices: async (id: string) => unwrapList<any>(await apiCall(`/api/reservations/${id}/services`)),
  create: (data: {
    quoteId?: string;
    serviceId?: string;
    scheduledDate: string;
    date?: string;
    timeSlot: string;
    time_slot?: string;
    notes?: string;
    vehicleInfo?: any;
  }) => apiCall<Reservation>("/api/reservations", { method: "POST", body: data }),
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
  getAll: async () => unwrapList<Notification>(await apiCall("/api/notifications")),
  markRead: (id: string) =>
    apiCall("/api/notifications/" + id + "/read", { method: "POST" }),
  markAllRead: () =>
    apiCall("/api/notifications/read-all", { method: "POST" }),
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
  contact: (data: SupportContactData) =>
    apiCall<{ success: boolean; message: string }>("/api/support/contact", {
      method: "POST",
      body: data,
    }),
  getHistory: async () => {
    try {
      const result = await apiCall<any>("/api/support/tickets");
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.data)) return result.data;
      if (result && Array.isArray(result.tickets)) return result.tickets;
      return [];
    } catch {
      return [];
    }
  },
};
