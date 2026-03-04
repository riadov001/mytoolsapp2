import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

const getApiBase = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "https://appmyjantes1.mytoolsgroup.eu";
};

const API_BASE = getApiBase();

export function getBackendUrl() {
  return API_BASE;
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
    if (cookie.includes("myjantes.sid") || cookie.includes("connect.sid")) {
      sessionCookie = cookie.split(";")[0];
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
    // On web, we also want to allow the browser to manage cookies if possible
    if (Platform.OS === "web") {
      // expo-fetch on web might need credentials: "include" to send/receive cookies
    }
  }

  const url = `${API_BASE}${endpoint}`;

  let res: Response;

  if (isFormData) {
    const formHeaders: Record<string, string> = {};
    if (sessionCookie) {
      formHeaders["Cookie"] = sessionCookie;
    }

    res = await globalThis.fetch(url, {
      method,
      headers: formHeaders,
      body: body,
      credentials: "include" as const,
    });
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
    res = await expoFetch(url, fetchOptions);
  }

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const cookies = setCookie.split(",").map(c => c.trim());
    const sessionCookieValue = cookies.find(c => c.startsWith("myjantes.sid=") || c.startsWith("connect.sid="));
    if (sessionCookieValue) {
      const cookiePart = sessionCookieValue.split(";")[0];
      sessionCookie = cookiePart;
    } else {
      // Fallback if the cookie name doesn't match expected patterns but we want to capture it
      const cookiePart = setCookie.split(";")[0];
      sessionCookie = cookiePart;
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
    const debugEndpoints = ["/api/invoices", "/api/quotes", "/api/reservations"];
    if (debugEndpoints.some(ep => endpoint.startsWith(ep))) {
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[API DEBUG] ${endpoint} => Array[${parsed.length}], first keys:`, Object.keys(parsed[0]), "sample:", JSON.stringify(parsed[0]).substring(0, 500));
      } else if (parsed && typeof parsed === "object") {
        console.log(`[API DEBUG] ${endpoint} => Object keys:`, Object.keys(parsed), "sample:", JSON.stringify(parsed).substring(0, 500));
      }
    }
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
  role: "client" | "client_professionnel" | "admin" | "super_admin" | "superadmin";
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
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string;
}

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
    apiCall("/api/notifications/" + id + "/read", { method: "PATCH" }),
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

export const adminQuotesApi = {
  getAll: () => apiCall<any[]>("/api/admin/quotes"),
  getById: (id: string) => apiCall<any>(`/api/admin/quotes/${id}`),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/quotes/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/quotes/${id}`, { method: "DELETE" }),
};

export const adminInvoicesApi = {
  getAll: () => apiCall<any[]>("/api/admin/invoices"),
  getById: (id: string) => apiCall<any>(`/api/admin/invoices/${id}`),
  create: (data: any) =>
    apiCall<any>("/api/admin/invoices", { method: "POST", body: data }),
  createDirect: (data: any) =>
    apiCall<any>("/api/admin/invoices/direct", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/invoices/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/invoices/${id}`, { method: "DELETE" }),
};

export const adminClientsApi = {
  getAll: () => apiCall<any[]>("/api/admin/clients"),
  getById: (id: string) => apiCall<any>(`/api/admin/clients/${id}`),
  create: (data: any) =>
    apiCall<any>("/api/admin/clients", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/clients/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/clients/${id}`, { method: "DELETE" }),
};

export const adminServicesApi = {
  getAll: () => apiCall<Service[]>("/api/admin/services"),
  getById: (id: string) => apiCall<Service>(`/api/admin/services/${id}`),
  create: (data: any) =>
    apiCall<Service>("/api/admin/services", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<Service>(`/api/admin/services/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/services/${id}`, { method: "DELETE" }),
};

export const adminUsersApi = {
  getAll: () => apiCall<any[]>("/api/admin/users"),
  getById: (id: string) => apiCall<any>(`/api/admin/users/${id}`),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/users/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/users/${id}`, { method: "DELETE" }),
};

export const adminAnalyticsApi = {
  get: () => apiCall<any>("/api/admin/analytics"),
};

export const adminReservationsApi = {
  getAll: () => apiCall<any[]>("/api/admin/reservations"),
  getById: (id: string) => apiCall<any>(`/api/admin/reservations/${id}`),
  create: (data: any) =>
    apiCall<any>("/api/admin/reservations", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/reservations/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/reservations/${id}`, { method: "DELETE" }),
};


export const adminSettingsApi = {
  get: () => apiCall<any>("/api/admin/settings"),
  update: (data: any) =>
    apiCall<any>("/api/admin/settings", { method: "PUT", body: data }),
  getGarageLegal: () => apiCall<any>("/api/admin/garage-legal"),
  updateGarageLegal: (data: any) =>
    apiCall<any>("/api/admin/garage-legal", { method: "PUT", body: data }),
};

export const adminRepairOrdersApi = {
  getAll: () => apiCall<any[]>("/api/admin/repair-orders"),
  getById: (id: string) => apiCall<any>(`/api/admin/repair-orders/${id}`),
  create: (data: any) =>
    apiCall<any>("/api/admin/repair-orders", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/repair-orders/${id}`, { method: "PUT", body: data }),
};

export const adminCreditNotesApi = {
  getAll: () => apiCall<any[]>("/api/admin/credit-notes"),
  getById: (id: string) => apiCall<any>(`/api/admin/credit-notes/${id}`),
  create: (data: any) =>
    apiCall<any>("/api/admin/credit-notes", { method: "POST", body: data }),
};

export const adminDeliveryNotesApi = {
  getAll: () => apiCall<any[]>("/api/admin/delivery-notes"),
  getById: (id: string) => apiCall<any>(`/api/admin/delivery-notes/${id}`),
  create: (data: any) =>
    apiCall<any>("/api/admin/delivery-notes", { method: "POST", body: data }),
};

export const adminExpensesApi = {
  getAll: () => apiCall<any[]>("/api/admin/expenses"),
  getCategories: () => apiCall<any[]>("/api/admin/expense-categories"),
  create: (data: any) =>
    apiCall<any>("/api/admin/expenses", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/expenses/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/expenses/${id}`, { method: "DELETE" }),
};

export const adminAccountingApi = {
  getProfitLoss: (params?: string) =>
    apiCall<any>(`/api/admin/accounting/profit-loss${params ? `?${params}` : ""}`),
  getTvaReport: (params?: string) =>
    apiCall<any>(`/api/admin/accounting/tva-report${params ? `?${params}` : ""}`),
  getCashFlow: (params?: string) =>
    apiCall<any>(`/api/admin/accounting/cash-flow${params ? `?${params}` : ""}`),
  getEntries: (params?: string) =>
    apiCall<any[]>(`/api/admin/accounting/entries${params ? `?${params}` : ""}`),
  exportFec: (params?: string) =>
    apiCall<any>(`/api/admin/accounting/fec-export${params ? `?${params}` : ""}`),
};

export const adminReviewsApi = {
  getAll: () => apiCall<any[]>("/api/admin/reviews"),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/reviews/${id}`, { method: "PUT", body: data }),
  delete: (id: string) =>
    apiCall(`/api/admin/reviews/${id}`, { method: "DELETE" }),
};

export const adminExportApi = {
  exportData: (data: any) =>
    apiCall<any>("/api/admin/export-data", { method: "POST", body: data }),
  exportDatabase: () =>
    apiCall<any>("/api/admin/export-database", { method: "POST" }),
};

export const adminAuditLogsApi = {
  getAll: () => apiCall<any[]>("/api/admin/audit-logs"),
};

export const adminEngagementsApi = {
  getAll: () => apiCall<any[]>("/api/admin/engagements"),
  getSummary: () => apiCall<any>("/api/admin/engagements/summary"),
  create: (data: any) =>
    apiCall<any>("/api/admin/engagements", { method: "POST", body: data }),
  update: (id: string, data: any) =>
    apiCall<any>(`/api/admin/engagements/${id}`, { method: "PUT", body: data }),
};

export const superAdminApi = {
  getGarages: () => apiCall<any[]>("/api/superadmin/garages"),
  getGarageById: (id: string) => apiCall<any>(`/api/superadmin/garages/${id}`),
  createGarage: (data: any) =>
    apiCall<any>("/api/superadmin/garages", { method: "POST", body: data }),
  updateGarage: (id: string, data: any) =>
    apiCall<any>(`/api/superadmin/garages/${id}`, { method: "PUT", body: data }),
  deleteGarage: (id: string) =>
    apiCall(`/api/superadmin/garages/${id}`, { method: "DELETE" }),
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

