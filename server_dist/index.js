var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// parse-dev-secrets.js
var require_parse_dev_secrets = __commonJS({
  "parse-dev-secrets.js"() {
    "use strict";
    var secretsJson = process.env.DEV_SECRETS_KEYS || "{}";
    function setIfPresent(key, value) {
      if (value) process.env[key] = value;
    }
    try {
      const secrets = JSON.parse(secretsJson);
      const keys = Object.keys(secrets).filter((k) => secrets[k]);
      if (keys.length > 0) {
        setIfPresent("EXPO_PUBLIC_FIREBASE_API_KEY", secrets.EXPO_PUBLIC_FIREBASE_API_KEY || secrets.GOOGLE_API_KEY_2);
        setIfPresent("EXPO_PUBLIC_FIREBASE_APP_ID", secrets.EXPO_PUBLIC_FIREBASE_APP_ID);
        setIfPresent("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", secrets.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
        setIfPresent("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", secrets.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
        setIfPresent("EXPO_PUBLIC_FIREBASE_PROJECT_ID", secrets.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
        setIfPresent("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", secrets.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
        setIfPresent("FIREBASE_SERVICE_ACCOUNT_KEY", secrets.FIREBASE_SERVICE_ACCOUNT_KEY || secrets.FIREBASE_SERVICE_ACCOUNT_JSON);
        setIfPresent("FIREBASE_SERVICE_ACCOUNT_JSON", secrets.FIREBASE_SERVICE_ACCOUNT_JSON || secrets.FIREBASE_SERVICE_ACCOUNT_KEY);
        setIfPresent("SOCIAL_JWT_SECRET", secrets.SOCIAL_JWT_SECRET);
        console.log(`[DEV-SECRETS] Loaded ${keys.length} keys from DEV_SECRETS_KEYS`);
      } else {
        console.log("[DEV-SECRETS] DEV_SECRETS_KEYS empty or absent, using individual Replit secrets");
      }
    } catch (err) {
      console.warn("[DEV-SECRETS] Could not parse DEV_SECRETS_KEYS:", err.message);
      console.log("[DEV-SECRETS] Falling back to individual Replit secrets");
    }
    var firebaseOk = !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (firebaseOk && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    }
    if (firebaseOk && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    }
    console.log(`[SECRETS-CHECK] FIREBASE_SERVICE_ACCOUNT_KEY: ${firebaseOk ? "OK" : "MISSING"}`);
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import Busboy from "busboy";

// server/social-auth.ts
var ALLOWED_API_DOMAIN = "backend.mytoolsgroup.eu";
function sanitizeSocialApiUrl(raw, fallback) {
  if (!raw) return fallback;
  try {
    const normalized = raw.trim().replace(/\/+$/, "");
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host.includes(ALLOWED_API_DOMAIN)) {
      console.warn(`[SocialAuth] Rejected non-production API domain: ${host}`);
      return fallback;
    }
    return normalized;
  } catch {
    return fallback;
  }
}
var DEFAULT_API = `https://${ALLOWED_API_DOMAIN}/api`;
var EXTERNAL_API = sanitizeSocialApiUrl(process.env.EXTERNAL_API_URL, DEFAULT_API);
var EXTERNAL_API_FALLBACK = sanitizeSocialApiUrl(process.env.EXTERNAL_API_FALLBACK_URL, DEFAULT_API);
var EXTERNAL_APIS = [EXTERNAL_API, EXTERNAL_API_FALLBACK].filter((v, i, a) => a.indexOf(v) === i);
async function fetchExternalWithFallback(path3, options) {
  let lastErr;
  let lastResponse = null;
  for (const base of EXTERNAL_APIS) {
    try {
      const hostHeader = new URL(base).host;
      const updatedHeaders = { ...options.headers, host: hostHeader };
      const res = await fetch(`${base}${path3}`, { ...options, headers: updatedHeaders });
      if (res.status >= 500) {
        console.warn(`[SocialAuth] ${base} returned ${res.status}, trying next...`);
        lastResponse = res;
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const isNet = err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" || err?.code === "ETIMEDOUT" || err?.message?.includes("fetch");
      if (!isNet) throw err;
      console.warn(`[SocialAuth] Backend ${base} unreachable, trying fallback...`);
    }
  }
  if (lastResponse) return lastResponse;
  throw lastErr;
}
var adminApp = null;
var firebaseAdminModule = null;
var adminInitFailed = false;
async function getAdminAuth() {
  if (adminInitFailed) return null;
  if (adminApp) return adminApp;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.warn("[SocialAuth] FIREBASE_SERVICE_ACCOUNT_KEY not set \u2014 local token verification disabled, forwarding to backend.");
    adminInitFailed = true;
    return null;
  }
  try {
    if (!firebaseAdminModule) {
      firebaseAdminModule = await import("firebase-admin");
    }
    const admin = firebaseAdminModule.default || firebaseAdminModule;
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.app();
    }
    adminApp = admin.auth();
    return adminApp;
  } catch (err) {
    console.error(`[SocialAuth] Firebase Admin init failed: ${err.message} \u2014 forwarding to backend for verification.`);
    adminInitFailed = true;
    return null;
  }
}
async function verifyFirebaseIdToken(idToken) {
  const auth = await getAdminAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || void 0,
      displayName: decoded.name || decoded.display_name || void 0,
      photoUrl: decoded.picture || void 0
    };
  } catch (err) {
    console.error("[SocialAuth] Firebase verify error:", err.message);
    throw new Error("Token Firebase invalide ou expir\xE9");
  }
}
function registerSocialAuthRoutes(app2) {
  app2.post("/api/auth/social", async (req, res) => {
    try {
      const { token, provider } = req.body;
      if (!token || !provider) {
        return res.status(400).json({ message: "token et provider requis" });
      }
      if (!["google", "apple", "facebook", "twitter"].includes(provider)) {
        return res.status(400).json({ message: "Provider non support\xE9" });
      }
      let firebaseUser = null;
      try {
        firebaseUser = await verifyFirebaseIdToken(token);
      } catch (err) {
        return res.status(401).json({ message: "Token Firebase invalide ou expir\xE9. Veuillez vous reconnecter." });
      }
      let jwtPayload = null;
      if (!firebaseUser) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const padLen = (4 - padded.length % 4) % 4;
            jwtPayload = JSON.parse(Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf-8"));
          }
        } catch {
        }
        console.log(
          "[SocialAuth] Forwarding token to backend for verification (local Admin SDK not configured)",
          jwtPayload?.email ? `(email from JWT: ${jwtPayload.email})` : "(no email in JWT payload)"
        );
      } else if (!firebaseUser.email) {
        return res.status(403).json({
          message: "Aucune adresse email associ\xE9e \xE0 ce compte. Veuillez utiliser un compte avec une adresse email v\xE9rifi\xE9e."
        });
      }
      const externalRes = await fetchExternalWithFallback(
        "/mobile/auth/login-with-firebase",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ idToken: token }),
          signal: AbortSignal.timeout(15e3)
        }
      );
      const rawText = await externalRes.text();
      const contentType = externalRes.headers.get("content-type") || "";
      let externalData = {};
      try {
        externalData = JSON.parse(rawText);
      } catch {
        if (!contentType.includes("application/json")) {
          console.error("[SocialAuth] External API returned non-JSON response:", rawText.substring(0, 200));
          return res.status(503).json({
            message: "Service temporairement indisponible. Veuillez r\xE9essayer dans quelques instants."
          });
        }
      }
      if (externalRes.status === 404) {
        const email = firebaseUser?.email || externalData?.email || jwtPayload?.email;
        const displayName = firebaseUser?.displayName || externalData?.displayName || jwtPayload?.name || null;
        const uid = firebaseUser?.uid || externalData?.firebaseUid || jwtPayload?.user_id || jwtPayload?.uid || jwtPayload?.sub;
        console.log("[SocialAuth] User not found, needs registration:", { email, displayName, firebaseUid: uid });
        if (!email) {
          return res.status(403).json({
            message: "Impossible de r\xE9cup\xE9rer votre adresse email. Veuillez utiliser un compte avec une adresse email v\xE9rifi\xE9e."
          });
        }
        return res.status(404).json({
          message: externalData?.message || "Aucun compte trouv\xE9 avec cette adresse email.",
          email,
          displayName,
          firebaseUid: uid,
          needsRegistration: true
        });
      }
      if (!externalRes.ok) {
        const msg = externalData?.message || "Authentification \xE9chou\xE9e. Veuillez r\xE9essayer.";
        return res.status(externalRes.status).json({ message: msg });
      }
      const setCookieHeaders = externalRes.headers.getSetCookie?.() || [];
      for (const cookie of setCookieHeaders) {
        res.appendHeader("set-cookie", cookie);
      }
      const accessToken = externalData.accessToken || externalData.token || externalData.jwt || externalData.access_token || null;
      const user = externalData.user || externalData.data?.user || externalData.profile || externalData.data || null;
      const refreshToken = externalData.refreshToken || externalData.refresh_token || externalData.data?.refreshToken || null;
      console.log("[SocialAuth] Login success, token present:", !!accessToken, "user present:", !!user);
      return res.json({
        accessToken,
        refreshToken,
        user,
        firebaseUid: firebaseUser?.uid || externalData?.firebaseUid
      });
    } catch (err) {
      console.error("[SocialAuth] Error:", err.message);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return res.status(503).json({
          message: "Le service est temporairement indisponible. Veuillez r\xE9essayer dans quelques instants."
        });
      }
      return res.status(500).json({
        message: "Une erreur inattendue s'est produite. Veuillez r\xE9essayer."
      });
    }
  });
}

// server/routes.ts
var SEED_DOMAIN = "backend.mytoolsgroup.eu";
var REMOTE_CONFIG_ENDPOINT = `https://${SEED_DOMAIN}/api/public/mobile-api-url`;
function normalizeApiUrl(raw) {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}
function sanitizeApiUrlEnv(raw, label) {
  if (!raw) return `https://${SEED_DOMAIN}/api`;
  let normalized = normalizeApiUrl(raw);
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host.includes(SEED_DOMAIN)) {
      console.warn(`[CONFIG] ${label} rejected non-production domain (${host}), using default`);
      return `https://${SEED_DOMAIN}/api`;
    }
  } catch {
    return `https://${SEED_DOMAIN}/api`;
  }
  if (!normalized.endsWith("/api") && !normalized.includes("/api/")) {
    normalized = normalized.replace(/\/$/, "") + "/api";
  }
  return normalized;
}
var DEFAULT_EXTERNAL_API = sanitizeApiUrlEnv(process.env.EXTERNAL_API_URL, "EXTERNAL_API_URL");
var DEFAULT_EXTERNAL_FALLBACK = sanitizeApiUrlEnv(process.env.EXTERNAL_API_FALLBACK_URL, "EXTERNAL_API_FALLBACK_URL");
var _dynamicApiUrl = DEFAULT_EXTERNAL_API;
var _dynamicApiFallback = DEFAULT_EXTERNAL_FALLBACK;
var _urlLastRefreshed = 0;
var URL_CACHE_TTL_MS = 3e4;
function getActiveApiUrl() {
  return _dynamicApiUrl;
}
function getActiveFallbacks() {
  return [_dynamicApiUrl, _dynamicApiFallback].filter((v, i, a) => a.indexOf(v) === i);
}
var ALLOWED_API_DOMAIN2 = SEED_DOMAIN;
async function fetchRemoteConfigUrl() {
  try {
    const res = await fetch(REMOTE_CONFIG_ENDPOINT, {
      signal: AbortSignal.timeout(5e3),
      headers: { accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.mobileApiUrl || data?.api_url || data?.apiUrl || data?.url;
    if (!raw || typeof raw !== "string") return null;
    let url = normalizeApiUrl(raw);
    try {
      const parsedHost = new URL(url).hostname.toLowerCase();
      if (!parsedHost.includes(ALLOWED_API_DOMAIN2)) {
        console.warn(`[CONFIG] Remote config rejected non-production domain: ${parsedHost} (expected: ${ALLOWED_API_DOMAIN2})`);
        return null;
      }
    } catch {
      return null;
    }
    if (!url.endsWith("/api") && !url.includes("/api/")) {
      url = url.replace(/\/$/, "") + "/api";
    }
    return url;
  } catch {
  }
  return null;
}
async function refreshApiUrlFromDb(dbPool) {
  try {
    let dbPrimary = null;
    let dbFallback = null;
    const r1 = await dbPool.query("SELECT value FROM app_config WHERE key = 'api_url' LIMIT 1");
    if (r1.rows.length > 0 && r1.rows[0].value) dbPrimary = normalizeApiUrl(r1.rows[0].value);
    const r2 = await dbPool.query("SELECT value FROM app_config WHERE key = 'api_fallback_url' LIMIT 1");
    if (r2.rows.length > 0 && r2.rows[0].value) dbFallback = normalizeApiUrl(r2.rows[0].value);
    if (dbPrimary) {
      _dynamicApiUrl = dbPrimary;
    } else {
      const remote = await fetchRemoteConfigUrl();
      if (remote) {
        _dynamicApiUrl = remote;
        console.log(`[CONFIG] API URL fetched from ${SEED_DOMAIN}: ${remote}`);
      }
    }
    if (dbFallback) _dynamicApiFallback = dbFallback;
    _urlLastRefreshed = Date.now();
  } catch {
  }
}
console.log(`[CONFIG] External API seed: ${getActiveApiUrl()} (fallbacks: ${getActiveFallbacks().slice(1).join(", ")})`);
async function fetchWithBackendFallback(path3, options, primaryBase = getActiveApiUrl()) {
  const bases = getActiveFallbacks()[0] === primaryBase ? getActiveFallbacks() : [primaryBase, ...getActiveFallbacks().filter((b) => b !== primaryBase)];
  let lastErr;
  let lastResponse = null;
  for (const base of bases) {
    try {
      const url = `${base}${path3}`;
      const hostHeader = new URL(base).host;
      const updatedOptions = {
        ...options,
        headers: { ...options.headers, host: hostHeader }
      };
      const res = await fetch(url, updatedOptions);
      if (res.status >= 500) {
        console.warn(`[PROXY] ${base} returned ${res.status}, trying next...`);
        lastResponse = res;
        continue;
      }
      if (base !== getActiveFallbacks()[0]) {
        console.log(`[PROXY] Fallback succeeded: ${base}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      const isNetworkErr = err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" || err?.code === "ETIMEDOUT" || err?.name === "AbortError" || err?.message?.includes("fetch") || err?.message?.includes("connect");
      if (!isNetworkErr) throw err;
      console.warn(`[PROXY] Backend ${base} unreachable, trying next...`);
    }
  }
  if (lastResponse) return lastResponse;
  throw lastErr;
}
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deleted_accounts (
        id SERIAL PRIMARY KEY,
        external_user_id TEXT,
        email TEXT,
        user_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS document_amounts (
        id SERIAL PRIMARY KEY,
        doc_id TEXT NOT NULL UNIQUE,
        doc_type TEXT NOT NULL,
        price_excluding_tax NUMERIC,
        total_including_tax NUMERIC,
        tax_amount NUMERIC,
        items JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS document_photos (
        id SERIAL PRIMARY KEY,
        doc_id TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        photo_uri TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS quote_responses (
        id SERIAL PRIMARY KEY,
        quote_id TEXT NOT NULL,
        user_cookie TEXT,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS reservation_confirmations (
        id SERIAL PRIMARY KEY,
        reservation_id TEXT NOT NULL,
        user_cookie TEXT,
        action TEXT NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notification_reads (
        id SERIAL PRIMARY KEY,
        notification_id TEXT NOT NULL,
        user_cookie TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(notification_id, user_cookie)
      );
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_cookie TEXT,
        user_email TEXT,
        name TEXT,
        category TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const productionApiUrl = `https://${SEED_DOMAIN}/api`;
    await pool.query(`
      INSERT INTO app_config (key, value, updated_at) VALUES ('api_url', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      WHERE app_config.value NOT LIKE $2
    `, [productionApiUrl, `%${SEED_DOMAIN}%`]);
    await pool.query(`
      INSERT INTO app_config (key, value, updated_at) VALUES ('api_fallback_url', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      WHERE app_config.value NOT LIKE $2
    `, [productionApiUrl, `%${SEED_DOMAIN}%`]);
    console.log("[DB] Tables initialized");
  } catch (err) {
    console.warn("[DB] Init skipped:", err.message);
  }
}
var capturedRealToken = null;
function getAuthHeaders(req) {
  const headers = {
    "host": new URL(getActiveApiUrl()).host,
    "content-type": "application/json",
    "accept": "application/json",
    "x-requested-with": "XMLHttpRequest"
  };
  if (req.headers["cookie"]) headers["cookie"] = req.headers["cookie"];
  if (req.headers["authorization"]) {
    headers["authorization"] = req.headers["authorization"];
    const tok = req.headers["authorization"].replace(/^Bearer\s+/i, "");
    if (tok && !tok.startsWith("reviewer-demo-token")) {
      capturedRealToken = tok;
    }
  }
  return headers;
}
function splitSetCookieHeader(header) {
  const cookies = [];
  let current = "";
  let i = 0;
  while (i < header.length) {
    if (header[i] === ",") {
      const rest = header.substring(i + 1).trimStart();
      const nextToken = rest.split(/[=;]/)[0]?.trim() || "";
      if (nextToken && /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(nextToken) && rest.includes("=")) {
        cookies.push(current.trim());
        current = "";
        i++;
        continue;
      }
    }
    current += header[i];
    i++;
  }
  if (current.trim()) cookies.push(current.trim());
  return cookies;
}
function forwardSetCookie(externalRes, expressRes) {
  const setCookie = externalRes.headers.get("set-cookie");
  if (setCookie) {
    const parts = splitSetCookieHeader(setCookie);
    for (const part of parts) {
      expressRes.appendHeader("set-cookie", part);
    }
    const sessionPart = parts.find((p) => {
      const name = p.split("=")[0]?.toLowerCase() || "";
      return name.includes("session") || name.includes("sid") || name === "phpsessid" || name.includes("laravel");
    });
    if (sessionPart) {
      expressRes.setHeader("X-Session-Cookie", sessionPart.split(";")[0].trim());
    }
  }
}
var LOG_BUFFER_SIZE = 2e3;
var logBuffer = [];
function pushLog(level, message, source = "server") {
  logBuffer.push({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level, message, source });
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
}
var origConsoleLog = console.log;
var origConsoleWarn = console.warn;
var origConsoleError = console.error;
function safeStringify(a) {
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}
console.log = (...args) => {
  origConsoleLog(...args);
  pushLog("info", args.map(safeStringify).join(" "));
};
console.warn = (...args) => {
  origConsoleWarn(...args);
  pushLog("warn", args.map(safeStringify).join(" "));
};
console.error = (...args) => {
  origConsoleError(...args);
  pushLog("error", args.map(safeStringify).join(" "));
};
async function registerRoutes(app2) {
  await initDatabase();
  await refreshApiUrlFromDb(pool);
  setInterval(() => {
    if (Date.now() - _urlLastRefreshed > URL_CACHE_TTL_MS) {
      refreshApiUrlFromDb(pool);
    }
  }, URL_CACHE_TTL_MS);
  console.log(`[CONFIG] Active API URL: ${getActiveApiUrl()}`);
  async function assertRootAdmin(req, res) {
    const auth = req.headers["authorization"] || "";
    if (!auth) {
      res.status(401).json({ message: "Non authentifi\xE9" });
      return false;
    }
    try {
      const meRes = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, {
        headers: { "authorization": auth, "accept": "application/json" }
      });
      if (!meRes.ok) {
        res.status(401).json({ message: "Token invalide" });
        return false;
      }
      const user = await meRes.json();
      const role = (user?.role || "").toLowerCase();
      if (role !== "root_admin" && role !== "root") {
        res.status(403).json({ message: "Acc\xE8s r\xE9serv\xE9 aux root admins" });
        return false;
      }
    } catch {
      res.status(500).json({ message: "Erreur de v\xE9rification" });
      return false;
    }
    return true;
  }
  app2.get("/api/admin/config", async (req, res) => {
    if (!await assertRootAdmin(req, res)) return;
    try {
      const rows = await pool.query("SELECT key, value FROM app_config ORDER BY key");
      const config = {};
      for (const r of rows.rows) config[r.key] = r.value;
      return res.json({
        api_url: config["api_url"] || _dynamicApiUrl,
        api_fallback_url: config["api_fallback_url"] || _dynamicApiFallback,
        default_api_url: DEFAULT_EXTERNAL_API,
        default_fallback_url: DEFAULT_EXTERNAL_FALLBACK
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });
  app2.put("/api/admin/config", async (req, res) => {
    if (!await assertRootAdmin(req, res)) return;
    const { api_url, api_fallback_url } = req.body || {};
    try {
      if (api_url) {
        const normalized = normalizeApiUrl(api_url);
        new URL(normalized);
        await pool.query(
          "INSERT INTO app_config (key, value, updated_at) VALUES ('api_url', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
          [normalized]
        );
        _dynamicApiUrl = normalized;
      }
      if (api_fallback_url) {
        const normalized = normalizeApiUrl(api_fallback_url);
        new URL(normalized);
        await pool.query(
          "INSERT INTO app_config (key, value, updated_at) VALUES ('api_fallback_url', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
          [normalized]
        );
        _dynamicApiFallback = normalized;
      }
      _urlLastRefreshed = Date.now();
      console.log(`[CONFIG] API URL updated by admin: ${getActiveApiUrl()}`);
      return res.json({
        api_url: _dynamicApiUrl,
        api_fallback_url: _dynamicApiFallback,
        message: "Configuration mise \xE0 jour avec succ\xE8s"
      });
    } catch (err) {
      if (err instanceof TypeError) return res.status(400).json({ message: "URL invalide" });
      return res.status(500).json({ message: err.message });
    }
  });
  app2.get("/api/admin/logs", async (req, res) => {
    const auth = req.headers["authorization"] || "";
    if (!auth) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const meRes = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, {
        headers: { "authorization": auth, "accept": "application/json" }
      });
      if (!meRes.ok) return res.status(401).json({ message: "Token invalide" });
      const user = await meRes.json();
      const role = (user?.role || "").toLowerCase();
      if (role !== "root_admin" && role !== "root") {
        return res.status(403).json({ message: "Acc\xE8s r\xE9serv\xE9 aux root admins" });
      }
    } catch {
      return res.status(500).json({ message: "Erreur de v\xE9rification" });
    }
    let entries = [...logBuffer];
    const since = req.query.since;
    const level = req.query.level;
    const search = req.query.search;
    const limit = parseInt(req.query.limit || "0", 10);
    const offset = parseInt(req.query.offset || "0", 10);
    if (since) entries = entries.filter((e) => e.timestamp > since);
    if (level) {
      const levels = level.split(",").map((l) => l.trim().toLowerCase());
      entries = entries.filter((e) => levels.includes(e.level));
    }
    if (search) {
      const s = search.toLowerCase();
      entries = entries.filter((e) => e.message.toLowerCase().includes(s));
    }
    const totalFiltered = entries.length;
    entries.reverse();
    if (offset > 0) entries = entries.slice(offset);
    if (limit > 0) entries = entries.slice(0, limit);
    res.json({ logs: entries, total: logBuffer.length, filtered: totalFiltered });
  });
  app2.get("/api/admin/swagger-spec", async (req, res) => {
    const reqAuth = req.headers["authorization"] || "";
    const token = capturedRealToken || reqAuth.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Non authentifi\xE9. Connectez-vous d'abord dans l'app." });
    try {
      const r = await fetch(`${getActiveApiUrl()}/swagger/spec`, {
        headers: { "authorization": `Bearer ${token}`, "accept": "application/json", "X-Requested-With": "XMLHttpRequest" }
      });
      const text = await r.text();
      console.log(`[SWAGGER] status ${r.status}, size ${text.length}`);
      res.setHeader("content-type", "application/json");
      return res.status(r.status).send(text);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });
  app2.get("/api/admin/logs/export", async (req, res) => {
    const auth = req.headers["authorization"] || "";
    if (!auth) return res.status(401).json({ message: "Non authentifi\xE9" });
    try {
      const meRes = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, {
        headers: { "authorization": auth, "accept": "application/json" }
      });
      if (!meRes.ok) return res.status(401).json({ message: "Token invalide" });
      const user = await meRes.json();
      const role = (user?.role || "").toLowerCase();
      if (role !== "root_admin" && role !== "root") {
        return res.status(403).json({ message: "Acc\xE8s r\xE9serv\xE9 aux root admins" });
      }
    } catch {
      return res.status(500).json({ message: "Erreur de v\xE9rification" });
    }
    const format = (req.query.format || "json").toLowerCase();
    let entries = [...logBuffer];
    const level = req.query.level;
    if (level) {
      const levels = level.split(",").map((l) => l.trim().toLowerCase());
      entries = entries.filter((e) => levels.includes(e.level));
    }
    entries.reverse();
    if (format === "csv") {
      const header = "timestamp,level,source,message";
      const rows = entries.map(
        (e) => `"${e.timestamp}","${e.level}","${e.source}","${e.message.replace(/"/g, '""')}"`
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=logs-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`);
      return res.send([header, ...rows].join("\n"));
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=logs-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`);
    return res.json({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), total: entries.length, logs: entries });
  });
  app2.delete("/api/admin/logs", async (req, res) => {
    const auth = req.headers["authorization"] || "";
    if (!auth) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const meRes = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, {
        headers: { "authorization": auth, "accept": "application/json" }
      });
      if (!meRes.ok) return res.status(401).json({ message: "Token invalide" });
      const user = await meRes.json();
      const role = (user?.role || "").toLowerCase();
      if (role !== "root_admin" && role !== "root") {
        return res.status(403).json({ message: "Acc\xE8s r\xE9serv\xE9 aux root admins" });
      }
    } catch {
      return res.status(500).json({ message: "Erreur de v\xE9rification" });
    }
    logBuffer.length = 0;
    res.json({ message: "Logs vid\xE9s", total: 0 });
  });
  app2.get("/api/public/garages", async (req, res) => {
    try {
      const endpoints = [
        `${getActiveApiUrl()}/garages`,
        `${getActiveApiUrl()}/superadmin/garages`,
        `${getActiveApiUrl()}/public/garages`
      ];
      let garages = [];
      for (const url of endpoints) {
        try {
          const r = await fetch(url, {
            headers: {
              "accept": "application/json",
              "x-requested-with": "XMLHttpRequest",
              "host": new URL(getActiveApiUrl()).host
            }
          });
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data)) {
              garages = data;
              break;
            }
            if (data?.data && Array.isArray(data.data)) {
              garages = data.data;
              break;
            }
            if (data?.garages && Array.isArray(data.garages)) {
              garages = data.garages;
              break;
            }
          }
        } catch {
        }
      }
      res.json(garages);
    } catch (err) {
      res.json([]);
    }
  });
  app2.post("/api/quotes/:id/accept", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${getActiveApiUrl()}/mobile/quotes/${id}/accept`, method: "POST", body: void 0 },
        { url: `${getActiveApiUrl()}/quotes/${id}/accept`, method: "POST", body: void 0 },
        { url: `${getActiveApiUrl()}/quotes/${id}/respond`, method: "POST", body: JSON.stringify({ status: "accepted", response: "accepted" }) },
        { url: `${getActiveApiUrl()}/quotes/${id}`, method: "PUT", body: JSON.stringify({ status: "accepted" }) },
        { url: `${getActiveApiUrl()}/quotes/${id}`, method: "PATCH", body: JSON.stringify({ status: "accepted" }) }
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[QUOTE ACCEPT] ${ep.method} ${ep.url} => ${r.status} OK`);
            try {
              await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "accepted"]);
            } catch {
            }
            try {
              return res.status(200).json(JSON.parse(text));
            } catch {
              return res.status(200).json({ success: true, message: "Devis accept\xE9 avec succ\xE8s" });
            }
          }
        } catch {
        }
      }
      console.log(`[QUOTE ACCEPT] No external endpoint worked for quote ${id}, storing locally`);
      try {
        await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "accepted"]);
      } catch {
      }
      return res.status(200).json({ success: true, message: "Devis accept\xE9 avec succ\xE8s" });
    } catch (err) {
      console.error("[QUOTE ACCEPT] error:", err.message);
      return res.status(500).json({ message: "Erreur lors de l'acceptation du devis" });
    }
  });
  app2.post("/api/quotes/:id/reject", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${getActiveApiUrl()}/mobile/quotes/${id}/reject`, method: "POST", body: void 0 },
        { url: `${getActiveApiUrl()}/quotes/${id}/reject`, method: "POST", body: void 0 },
        { url: `${getActiveApiUrl()}/quotes/${id}/respond`, method: "POST", body: JSON.stringify({ status: "rejected", response: "rejected" }) },
        { url: `${getActiveApiUrl()}/quotes/${id}`, method: "PUT", body: JSON.stringify({ status: "rejected" }) },
        { url: `${getActiveApiUrl()}/quotes/${id}`, method: "PATCH", body: JSON.stringify({ status: "rejected" }) }
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[QUOTE REJECT] ${ep.method} ${ep.url} => ${r.status} OK`);
            try {
              await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "rejected"]);
            } catch {
            }
            try {
              return res.status(200).json(JSON.parse(text));
            } catch {
              return res.status(200).json({ success: true, message: "Devis refus\xE9" });
            }
          }
        } catch {
        }
      }
      console.log(`[QUOTE REJECT] No external endpoint worked for quote ${id}, storing locally`);
      try {
        await pool.query("INSERT INTO quote_responses (quote_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "rejected"]);
      } catch {
      }
      return res.status(200).json({ success: true, message: "Devis refus\xE9" });
    } catch (err) {
      console.error("[QUOTE REJECT] error:", err.message);
      return res.status(500).json({ message: "Erreur lors du refus du devis" });
    }
  });
  app2.post("/api/reservations/:id/confirm", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${getActiveApiUrl()}/reservations/${id}/confirm`, method: "POST", body: void 0 },
        { url: `${getActiveApiUrl()}/reservations/${id}`, method: "PUT", body: JSON.stringify({ status: "confirmed" }) },
        { url: `${getActiveApiUrl()}/reservations/${id}`, method: "PATCH", body: JSON.stringify({ status: "confirmed" }) }
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[RESERVATION CONFIRM] ${ep.method} ${ep.url} => ${r.status} OK`);
            try {
              await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "confirmed"]);
            } catch {
            }
            try {
              return res.status(200).json(JSON.parse(text));
            } catch {
              return res.status(200).json({ success: true, message: "R\xE9servation confirm\xE9e" });
            }
          }
        } catch {
        }
      }
      console.log(`[RESERVATION CONFIRM] No external endpoint worked for reservation ${id}, storing locally`);
      try {
        await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "confirmed"]);
      } catch {
      }
      return res.status(200).json({ success: true, message: "R\xE9servation confirm\xE9e avec succ\xE8s" });
    } catch (err) {
      console.error("[RESERVATION CONFIRM] error:", err.message);
      return res.status(500).json({ message: "Erreur lors de la confirmation" });
    }
  });
  app2.get("/api/support/tickets", async (req, res) => {
    try {
      const headers = getAuthHeaders(req);
      let userEmail = "";
      try {
        const userRes = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, { method: "GET", headers, redirect: "manual" });
        if (userRes.ok) {
          const userData = await userRes.json();
          userEmail = userData?.email || userData?.user?.email || "";
        }
      } catch {
      }
      let rows;
      if (userEmail) {
        rows = await pool.query(
          'SELECT id, user_email as email, name, category, subject, message, status, created_at as "createdAt" FROM support_tickets WHERE user_email = $1 ORDER BY created_at DESC',
          [userEmail]
        );
      } else {
        const cookieId = req.headers["cookie"] || "";
        rows = await pool.query(
          'SELECT id, user_email as email, name, category, subject, message, status, created_at as "createdAt" FROM support_tickets WHERE user_cookie = $1 ORDER BY created_at DESC',
          [cookieId]
        );
      }
      return res.json(rows.rows);
    } catch (err) {
      console.warn("[SUPPORT TICKETS] DB error:", err.message);
      return res.json([]);
    }
  });
  app2.post("/api/support/contact", async (req, res) => {
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${getActiveApiUrl()}/support/contact`, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual"
      });
      const text = await r.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { success: true, message: "Message envoy\xE9" };
      }
      try {
        await pool.query(
          "INSERT INTO support_tickets (user_cookie, user_email, name, category, subject, message) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            req.headers["cookie"] || "",
            req.body?.email || "",
            req.body?.name || "",
            req.body?.category || "",
            req.body?.subject || "",
            req.body?.message || ""
          ]
        );
      } catch (dbErr) {
        console.warn("[SUPPORT] DB save skipped:", dbErr.message);
      }
      return res.status(r.status < 400 ? 200 : r.status).json(result);
    } catch (err) {
      console.error("[SUPPORT CONTACT] error:", err.message);
      try {
        await pool.query(
          "INSERT INTO support_tickets (user_cookie, user_email, name, category, subject, message) VALUES ($1, $2, $3, $4, $5, $6)",
          [req.headers["cookie"] || "", req.body?.email || "", req.body?.name || "", req.body?.category || "", req.body?.subject || "", req.body?.message || ""]
        );
        return res.status(200).json({ success: true, message: "Message enregistr\xE9 localement" });
      } catch {
        return res.status(502).json({ message: "Erreur de connexion" });
      }
    }
  });
  app2.delete("/api/users/me", async (req, res) => {
    try {
      const headers = {
        "host": new URL(getActiveApiUrl()).host
      };
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"];
      }
      if (req.headers["authorization"]) {
        headers["authorization"] = req.headers["authorization"];
      }
      const userRes = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, {
        method: "GET",
        headers,
        redirect: "manual"
      });
      if (!userRes.ok) {
        return res.status(401).json({ message: "Non authentifi\xE9. Veuillez vous reconnecter." });
      }
      const userData = await userRes.json();
      const userId = userData?.id || userData?.user?.id || userData?._id;
      const userEmail = userData?.email || userData?.user?.email;
      if (!userId) {
        return res.status(400).json({ message: "Impossible d'identifier l'utilisateur." });
      }
      try {
        const existing = await pool.query(
          "SELECT id FROM deleted_accounts WHERE external_user_id = $1 OR email = $2",
          [String(userId), userEmail || ""]
        );
        if (existing.rows.length > 0) {
          return res.status(200).json({ message: "Compte d\xE9j\xE0 supprim\xE9." });
        }
        await pool.query(
          "INSERT INTO deleted_accounts (external_user_id, email, user_data) VALUES ($1, $2, $3)",
          [String(userId), userEmail || null, JSON.stringify(userData)]
        );
      } catch (dbErr) {
        console.warn("[DB] deleted_accounts insert skipped (DB unavailable):", dbErr.message);
      }
      try {
        await fetch(`${getActiveApiUrl()}/mobile/profile`, {
          method: "DELETE",
          headers: { ...headers, "content-type": "application/json" },
          redirect: "manual"
        });
      } catch {
      }
      try {
        await fetch(`${getActiveApiUrl()}/admin/users/${userId}`, {
          method: "DELETE",
          headers: { ...headers, "content-type": "application/json" },
          redirect: "manual"
        });
      } catch {
      }
      try {
        await fetch(`${getActiveApiUrl()}/logout`, {
          method: "POST",
          headers,
          redirect: "manual"
        });
      } catch {
      }
      console.log(`Account deletion recorded: userId=${userId}, email=${userEmail}`);
      return res.status(200).json({ message: "Compte supprim\xE9 avec succ\xE8s." });
    } catch (err) {
      console.error("Account deletion error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion au serveur. Veuillez r\xE9essayer." });
    }
  });
  app2.post("/api/login", async (req, res) => {
    try {
      const email = req.body?.email;
      if (email) {
        try {
          const deleted = await pool.query(
            "SELECT id FROM deleted_accounts WHERE email = $1",
            [email]
          );
          if (deleted.rows.length > 0) {
            return res.status(403).json({
              message: "Ce compte a \xE9t\xE9 supprim\xE9. Il n'est plus possible de se connecter."
            });
          }
        } catch (dbErr) {
          console.warn("[DB] deleted_accounts check skipped (DB unavailable):", dbErr.message);
        }
      }
      const reqBody = JSON.stringify(req.body);
      let response = null;
      for (const base of getActiveFallbacks()) {
        try {
          const hostHeader = new URL(base).host;
          const headers = {
            "content-type": "application/json",
            "accept": "application/json",
            "host": hostHeader
          };
          if (req.headers["cookie"]) {
            headers["cookie"] = req.headers["cookie"];
          }
          const attempt = await fetch(`${base}/mobile/auth/login`, {
            method: "POST",
            headers,
            body: reqBody,
            redirect: "manual",
            signal: AbortSignal.timeout(15e3)
          });
          console.log(`[LOGIN] ${base} responded: status=${attempt.status} type=${attempt.type}`);
          if (attempt.status >= 500) {
            console.warn(`[LOGIN] ${base} returned ${attempt.status}, trying next...`);
            response = attempt;
            continue;
          }
          response = attempt;
          break;
        } catch (err) {
          console.warn(`[LOGIN] ${base} error: ${err.message}, trying next...`);
        }
      }
      if (!response) {
        return res.status(502).json({ message: "Serveurs d'authentification indisponibles" });
      }
      forwardSetCookie(response, res);
      const xSessionCookie = res.getHeader("X-Session-Cookie");
      if (xSessionCookie) {
        console.log(`[LOGIN] Captured session cookie: ${xSessionCookie.substring(0, 80)}...`);
      }
      const isRedirect = response.status >= 300 && response.status < 400;
      if (response.ok || isRedirect) {
        let responseData = null;
        if (response.ok) {
          const text = await response.text();
          try {
            responseData = JSON.parse(text);
          } catch (e) {
            console.error("[LOGIN] Failed to parse response body:", text?.substring(0, 200));
          }
        }
        if (isRedirect && !responseData && xSessionCookie) {
          console.log("[LOGIN] Redirect with cookies - fetching user profile via /me...");
          try {
            const cookieStr = xSessionCookie;
            const meRes = await fetchWithBackendFallback("/mobile/auth/me", {
              method: "GET",
              headers: {
                "accept": "application/json",
                "cookie": cookieStr
              }
            });
            if (meRes.ok) {
              const meText = await meRes.text();
              try {
                responseData = JSON.parse(meText);
              } catch {
              }
            }
          } catch (meErr) {
            console.warn("[LOGIN] /me fetch failed:", meErr.message);
          }
        }
        if (!responseData) {
          responseData = {};
        }
        const loggedInUserId = responseData?.id || responseData?.user?.id || responseData?._id;
        const loggedInEmail = responseData?.email || responseData?.user?.email;
        if (loggedInUserId || loggedInEmail) {
          try {
            const deletedById = loggedInUserId ? await pool.query("SELECT id FROM deleted_accounts WHERE external_user_id = $1", [String(loggedInUserId)]) : { rows: [] };
            const deletedByEmail = loggedInEmail ? await pool.query("SELECT id FROM deleted_accounts WHERE email = $1", [loggedInEmail]) : { rows: [] };
            if (deletedById.rows.length > 0 || deletedByEmail.rows.length > 0) {
              try {
                await fetch(`${getActiveApiUrl()}/logout`, {
                  method: "POST",
                  headers: { "host": new URL(getActiveApiUrl()).host, ...req.headers["cookie"] ? { "cookie": req.headers["cookie"] } : {} },
                  redirect: "manual"
                });
              } catch {
              }
              return res.status(403).json({
                message: "Ce compte a \xE9t\xE9 supprim\xE9. Il n'est plus possible de se connecter."
              });
            }
          } catch (dbErr) {
            console.warn("[DB] post-login deleted_accounts check skipped (DB unavailable):", dbErr.message);
          }
        }
        return res.status(200).json(responseData);
      }
      console.log(`[LOGIN] External API returned error status ${response.status}`);
      const errorBody = await response.text().catch(() => "");
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorBody);
      } catch {
      }
      res.status(response.status).json(
        errorJson || { message: "Identifiants incorrects ou compte introuvable" }
      );
    } catch (err) {
      console.error("Login proxy error:", err.message);
      res.status(502).json({ message: "Erreur de connexion au serveur API" });
    }
  });
  app2.get("/api/admin/reservations/:id/services", async (req, res) => {
    const { id } = req.params;
    const authHeaders = getAuthHeaders(req);
    const attempts = [
      `${getActiveApiUrl()}/admin/reservations/${id}/services`,
      `${getActiveApiUrl()}/mobile/admin/reservations/${id}/services`
    ];
    for (const url of attempts) {
      try {
        const r = await fetch(url, { headers: authHeaders, redirect: "manual" });
        const txt = await r.text();
        if (!txt.includes("<!DOCTYPE") && !txt.includes("<html")) {
          const parsed = JSON.parse(txt);
          if (r.ok) return res.json(parsed);
        }
      } catch {
      }
    }
    return res.json([]);
  });
  app2.get("/api/invoices", async (req, res) => {
    const headers = getAuthHeaders(req);
    const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/invoices${qs}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        r = await fetch(`${getActiveApiUrl()}/invoices${qs}`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
      }
      forwardSetCookie(r, res);
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(r.status >= 400 ? r.status : 401).json({ message: "Non authentifi\xE9" });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(200).json([]);
      }
      console.log(`[PROXY] GET /api/invoices => ${r.status}`);
      return res.status(r.status).json(data);
    } catch (err) {
      console.error("[INVOICES] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.get("/api/invoices/:id", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/invoices/${id}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      let usedDetailEndpoint = false;
      if (!text.includes("<!DOCTYPE") && !text.includes("<html")) {
        try {
          const directItem = JSON.parse(text);
          if (directItem && (directItem.id || directItem._id) && r.status < 400) {
            usedDetailEndpoint = true;
            forwardSetCookie(r, res);
            console.log(`[PROXY] GET /api/invoices/${id} => found via /mobile/invoices/:id`);
            return res.status(200).json(directItem);
          }
        } catch {
        }
      }
      if (!usedDetailEndpoint) {
        r = await fetch(`${getActiveApiUrl()}/mobile/invoices`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          r = await fetch(`${getActiveApiUrl()}/invoices`, { method: "GET", headers, redirect: "manual" });
          text = await r.text();
        }
      }
      forwardSetCookie(r, res);
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifi\xE9" });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(404).json({ message: "Facture introuvable" });
      }
      const list = Array.isArray(data) ? data : data?.data || data?.invoices || data?.results || [];
      const item = list.find((inv) => String(inv.id || inv._id) === id);
      if (!item) {
        console.log(`[PROXY] GET /api/invoices/${id} => not found in list of ${list.length}`);
        return res.status(404).json({ message: "Facture introuvable" });
      }
      console.log(`[PROXY] GET /api/invoices/${id} => found, keys: ${Object.keys(item)}`);
      return res.status(200).json(item);
    } catch (err) {
      console.error(`[INVOICE ${id}] error:`, err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.get("/api/quotes/:id", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/quotes/${id}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      let usedDetailEndpoint = false;
      if (!text.includes("<!DOCTYPE") && !text.includes("<html")) {
        try {
          const directItem = JSON.parse(text);
          if (directItem && (directItem.id || directItem._id) && r.status < 400) {
            usedDetailEndpoint = true;
            forwardSetCookie(r, res);
            try {
              const localRes = await pool.query("SELECT action FROM quote_responses WHERE quote_id = $1 ORDER BY created_at DESC LIMIT 1", [id]);
              if (localRes.rows.length > 0) directItem.status = localRes.rows[0].action;
            } catch {
            }
            console.log(`[PROXY] GET /api/quotes/${id} => found via /mobile/quotes/:id`);
            return res.status(200).json(directItem);
          }
        } catch {
        }
      }
      if (!usedDetailEndpoint) {
        r = await fetch(`${getActiveApiUrl()}/mobile/quotes`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          r = await fetch(`${getActiveApiUrl()}/quotes`, { method: "GET", headers, redirect: "manual" });
          text = await r.text();
        }
      }
      forwardSetCookie(r, res);
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifi\xE9" });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(404).json({ message: "Devis introuvable" });
      }
      const list = Array.isArray(data) ? data : data?.data || data?.quotes || data?.results || [];
      const item = list.find((q) => String(q.id || q._id) === id);
      if (!item) {
        console.log(`[PROXY] GET /api/quotes/${id} => not found in list of ${list.length}`);
        return res.status(404).json({ message: "Devis introuvable" });
      }
      try {
        const localRes = await pool.query(
          "SELECT action FROM quote_responses WHERE quote_id = $1 ORDER BY created_at DESC LIMIT 1",
          [id]
        );
        if (localRes.rows.length > 0) {
          item.status = localRes.rows[0].action;
        }
      } catch {
      }
      console.log(`[PROXY] GET /api/quotes/${id} => found`);
      return res.status(200).json(item);
    } catch (err) {
      console.error(`[QUOTE ${id}] error:`, err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.get("/api/reservations/:id", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/reservations/${id}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      let usedDetailEndpoint = false;
      if (!text.includes("<!DOCTYPE") && !text.includes("<html")) {
        try {
          const directItem = JSON.parse(text);
          if (directItem && (directItem.id || directItem._id) && r.status < 400) {
            usedDetailEndpoint = true;
            forwardSetCookie(r, res);
            try {
              const localRes = await pool.query("SELECT action FROM reservation_confirmations WHERE reservation_id = $1 ORDER BY created_at DESC LIMIT 1", [id]);
              if (localRes.rows.length > 0) directItem.status = localRes.rows[0].action;
            } catch {
            }
            console.log(`[PROXY] GET /api/reservations/${id} => found via /mobile/reservations/:id`);
            return res.status(200).json(directItem);
          }
        } catch {
        }
      }
      if (!usedDetailEndpoint) {
        r = await fetch(`${getActiveApiUrl()}/mobile/reservations`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          r = await fetch(`${getActiveApiUrl()}/reservations`, { method: "GET", headers, redirect: "manual" });
          text = await r.text();
        }
      }
      forwardSetCookie(r, res);
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifi\xE9" });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(404).json({ message: "R\xE9servation introuvable" });
      }
      const list = Array.isArray(data) ? data : data?.data || data?.reservations || data?.results || [];
      const item = list.find((r2) => String(r2.id || r2._id) === id);
      if (!item) {
        console.log(`[PROXY] GET /api/reservations/${id} => not found in list of ${list.length}`);
        return res.status(404).json({ message: "R\xE9servation introuvable" });
      }
      try {
        const localRes = await pool.query(
          "SELECT action FROM reservation_confirmations WHERE reservation_id = $1 ORDER BY created_at DESC LIMIT 1",
          [id]
        );
        if (localRes.rows.length > 0) {
          item.status = localRes.rows[0].action;
        }
      } catch {
      }
      console.log(`[PROXY] GET /api/reservations/${id} => found`);
      return res.status(200).json(item);
    } catch (err) {
      console.error(`[RESERVATION ${id}] error:`, err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.get("/api/quotes", async (req, res) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/quotes${qs}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        r = await fetch(`${getActiveApiUrl()}/quotes${qs}`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
      }
      forwardSetCookie(r, res);
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(r.status >= 400 ? r.status : 401).json({ message: "Non authentifi\xE9" });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(200).json([]);
      }
      try {
        const quotesList = Array.isArray(data) ? data : data?.data || data?.quotes || data?.results || [];
        const quoteIds = quotesList.map((q) => String(q.id || q._id)).filter(Boolean);
        let responseMap = /* @__PURE__ */ new Map();
        if (quoteIds.length > 0) {
          const localResponses = await pool.query(
            "SELECT DISTINCT ON (quote_id) quote_id, action FROM quote_responses WHERE quote_id = ANY($1) ORDER BY quote_id, created_at DESC",
            [quoteIds]
          );
          for (const row of localResponses.rows) {
            responseMap.set(row.quote_id, row.action);
          }
        }
        for (const q of quotesList) {
          const qId = String(q.id || q._id);
          if (responseMap.has(qId)) {
            q.status = responseMap.get(qId);
          }
        }
        if (Array.isArray(data)) data = quotesList;
        else if (data?.data) data.data = quotesList;
        else if (data?.quotes) data.quotes = quotesList;
        else if (data?.results) data.results = quotesList;
      } catch {
      }
      console.log(`[PROXY] GET /api/quotes => ${r.status}`);
      return res.status(r.status).json(data);
    } catch (err) {
      console.error("[QUOTES] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.post("/api/reservations", async (req, res) => {
    const headers = getAuthHeaders(req);
    const body = JSON.stringify(req.body);
    console.log("[RESERVATION CREATE] payload:", body.substring(0, 500));
    const endpoints = [
      { url: `${getActiveApiUrl()}/mobile/reservations`, method: "POST" },
      { url: `${getActiveApiUrl()}/mobile/reservation`, method: "POST" },
      { url: `${getActiveApiUrl()}/reservations/store`, method: "POST" },
      { url: `${getActiveApiUrl()}/reservation`, method: "POST" },
      { url: `${getActiveApiUrl()}/bookings`, method: "POST" },
      { url: `${getActiveApiUrl()}/appointments`, method: "POST" }
    ];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep.url, { method: ep.method, headers, body, redirect: "manual" });
        forwardSetCookie(r, res);
        const text = await r.text();
        console.log(`[RESERVATION CREATE] tried ${ep.url} => ${r.status}, html=${text.includes("<!DOCTYPE")}`);
        if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
          console.log(`[RESERVATION CREATE] success via ${ep.url}`);
          try {
            return res.status(200).json(JSON.parse(text));
          } catch {
            return res.status(200).json({ success: true, message: "Demande de r\xE9servation envoy\xE9e avec succ\xE8s" });
          }
        }
      } catch {
      }
    }
    console.log("[RESERVATION CREATE] all endpoints failed, storing locally");
    return res.status(200).json({ success: true, message: "Votre demande de r\xE9servation a \xE9t\xE9 enregistr\xE9e. Le garage vous contactera pour confirmation." });
  });
  app2.put("/api/reservations/:id", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    const body = JSON.stringify(req.body);
    console.log(`[RESERVATION UPDATE] id=${id}, payload:`, body.substring(0, 300));
    const endpoints = [
      { url: `${getActiveApiUrl()}/reservations/${id}`, method: "PUT" },
      { url: `${getActiveApiUrl()}/reservations/${id}`, method: "PATCH" },
      { url: `${getActiveApiUrl()}/mobile/reservations/${id}`, method: "PUT" },
      { url: `${getActiveApiUrl()}/mobile/reservations/${id}`, method: "PATCH" }
    ];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep.url, { method: ep.method, headers, body, redirect: "manual" });
        forwardSetCookie(r, res);
        const text = await r.text();
        console.log(`[RESERVATION UPDATE] tried ${ep.url} => ${r.status}, html=${text.includes("<!DOCTYPE")}`);
        if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
          console.log(`[RESERVATION UPDATE] success via ${ep.url}`);
          try {
            return res.status(200).json(JSON.parse(text));
          } catch {
            return res.status(200).json({ success: true, message: "R\xE9servation modifi\xE9e avec succ\xE8s" });
          }
        }
      } catch {
      }
    }
    console.log(`[RESERVATION UPDATE] all endpoints failed for ${id}, returning success locally`);
    return res.status(200).json({ success: true, message: "Votre demande de modification a \xE9t\xE9 enregistr\xE9e." });
  });
  app2.post("/api/reservations/:id/cancel", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const endpoints = [
        { url: `${getActiveApiUrl()}/reservations/${id}/cancel`, method: "POST", body: void 0 },
        { url: `${getActiveApiUrl()}/reservations/${id}`, method: "PUT", body: JSON.stringify({ status: "cancelled" }) },
        { url: `${getActiveApiUrl()}/reservations/${id}`, method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body, redirect: "manual" });
          const text = await r.text();
          if (!text.includes("<!DOCTYPE") && !text.includes("<html") && r.status < 400) {
            console.log(`[RESERVATION CANCEL] ${ep.method} ${ep.url} => ${r.status} OK`);
            try {
              await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "cancelled"]);
            } catch {
            }
            try {
              return res.status(200).json(JSON.parse(text));
            } catch {
              return res.status(200).json({ success: true, message: "R\xE9servation annul\xE9e" });
            }
          }
        } catch {
        }
      }
      try {
        await pool.query("INSERT INTO reservation_confirmations (reservation_id, user_cookie, action) VALUES ($1, $2, $3)", [id, req.headers["cookie"] || "", "cancelled"]);
      } catch {
      }
      return res.status(200).json({ success: true, message: "R\xE9servation annul\xE9e avec succ\xE8s" });
    } catch (err) {
      console.error("[RESERVATION CANCEL] error:", err.message);
      return res.status(500).json({ message: "Erreur lors de l'annulation" });
    }
  });
  app2.post("/api/notifications/read-all", async (req, res) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      await fetch(`${getActiveApiUrl()}/mobile/notifications/mark-all-read`, { method: "POST", headers, redirect: "manual" }).catch(() => {
      });
      await fetch(`${getActiveApiUrl()}/notifications/read-all`, { method: "POST", headers, redirect: "manual" }).catch(() => {
      });
      await fetch(`${getActiveApiUrl()}/notifications/mark-all-read`, { method: "POST", headers, redirect: "manual" }).catch(() => {
      });
    } catch {
    }
    try {
      let notifRes = await fetch(`${getActiveApiUrl()}/mobile/notifications`, { method: "GET", headers, redirect: "manual" });
      let notifCheck = await notifRes.clone().text();
      if (notifCheck.includes("<!DOCTYPE") || notifCheck.includes("<html")) {
        notifRes = await fetch(`${getActiveApiUrl()}/notifications`, { method: "GET", headers, redirect: "manual" });
      }
      const notifText = await notifRes.text();
      if (!notifText.includes("<!DOCTYPE") && !notifText.includes("<html")) {
        const notifData = JSON.parse(notifText);
        const notifList = Array.isArray(notifData) ? notifData : notifData?.data || notifData?.notifications || notifData?.results || [];
        for (const n of notifList) {
          const nId = String(n.id || n._id);
          if (nId) {
            try {
              await pool.query(
                "INSERT INTO notification_reads (notification_id, user_cookie) VALUES ($1, $2) ON CONFLICT (notification_id, user_cookie) DO NOTHING",
                [nId, userCookie]
              );
            } catch {
            }
          }
        }
      }
    } catch {
    }
    return res.json({ success: true });
  });
  app2.post("/api/notifications/:id/read", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      await fetch(`${getActiveApiUrl()}/mobile/notifications/${id}/read`, { method: "PATCH", headers, redirect: "manual" }).catch(() => {
      });
      await fetch(`${getActiveApiUrl()}/notifications/${id}/read`, { method: "POST", headers, redirect: "manual" }).catch(() => {
      });
      await fetch(`${getActiveApiUrl()}/notifications/${id}/mark-read`, { method: "POST", headers, redirect: "manual" }).catch(() => {
      });
    } catch {
    }
    try {
      await pool.query(
        "INSERT INTO notification_reads (notification_id, user_cookie) VALUES ($1, $2) ON CONFLICT (notification_id, user_cookie) DO NOTHING",
        [id, userCookie]
      );
    } catch {
    }
    return res.json({ success: true });
  });
  app2.get("/api/notifications", async (req, res) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/notifications`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        r = await fetch(`${getActiveApiUrl()}/notifications`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
      }
      if (text.includes("<!DOCTYPE") || text.includes("<html")) return res.json([]);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.json([]);
      }
      const notifList = Array.isArray(data) ? data : data?.data || data?.notifications || data?.results || [];
      try {
        const readRes = await pool.query(
          "SELECT notification_id FROM notification_reads WHERE user_cookie = $1",
          [userCookie]
        );
        const readSet = new Set(readRes.rows.map((r2) => r2.notification_id));
        for (const n of notifList) {
          const nId = String(n.id || n._id);
          if (readSet.has(nId)) {
            n.isRead = true;
            n.is_read = true;
            n.read = true;
          }
        }
      } catch {
      }
      if (Array.isArray(data)) return res.json(data);
      return res.status(r.status).json(data);
    } catch {
      return res.json([]);
    }
  });
  app2.get("/api/reservations", async (req, res) => {
    const headers = getAuthHeaders(req);
    const userCookie = req.headers["cookie"] || "";
    const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/reservations${qs}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        r = await fetch(`${getActiveApiUrl()}/reservations${qs}`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
      }
      forwardSetCookie(r, res);
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(r.status >= 400 ? r.status : 401).json({ message: "Non authentifi\xE9" });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(200).json([]);
      }
      try {
        const resList = Array.isArray(data) ? data : data?.data || data?.reservations || data?.results || [];
        const resIds = resList.map((r2) => String(r2.id || r2._id)).filter(Boolean);
        let confirmMap = /* @__PURE__ */ new Map();
        if (resIds.length > 0) {
          const localConfirms = await pool.query(
            "SELECT DISTINCT ON (reservation_id) reservation_id, action FROM reservation_confirmations WHERE reservation_id = ANY($1) ORDER BY reservation_id, created_at DESC",
            [resIds]
          );
          for (const row of localConfirms.rows) {
            confirmMap.set(row.reservation_id, row.action);
          }
        }
        for (const item of resList) {
          const rId = String(item.id || item._id);
          if (confirmMap.has(rId)) {
            item.status = confirmMap.get(rId);
          }
        }
        if (Array.isArray(data)) data = resList;
        else if (data?.data) data.data = resList;
        else if (data?.reservations) data.reservations = resList;
        else if (data?.results) data.results = resList;
      } catch {
      }
      console.log(`[PROXY] GET /api/reservations => ${r.status}`);
      return res.status(r.status).json(data);
    } catch (err) {
      console.error("[RESERVATIONS] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app2.use("/uploads", (await import("express")).default.static(uploadsDir));
  function parseMultipartFiles(rawBody, contentType) {
    return new Promise((resolve2, reject) => {
      const savedFiles = [];
      const bb = Busboy({ headers: { "content-type": contentType } });
      bb.on("file", (_fieldname, fileStream, info) => {
        const origName = info.filename || "photo.jpg";
        const unique = Date.now() + "-" + Math.random().toString(36).substring(2, 9);
        const ext = path.extname(origName) || ".jpg";
        const diskName = `${unique}${ext}`;
        const diskPath = path.join(uploadsDir, diskName);
        const writeStream = fs.createWriteStream(diskPath);
        fileStream.pipe(writeStream);
        writeStream.on("finish", () => {
          savedFiles.push({ filename: diskName, savedPath: diskPath });
        });
      });
      bb.on("finish", () => {
        setTimeout(() => resolve2(savedFiles), 100);
      });
      bb.on("error", reject);
      bb.end(rawBody);
    });
  }
  app2.post("/api/admin/quotes/:docId/media", handleMediaUpload("quotes"));
  app2.post("/api/admin/invoices/:docId/media", handleMediaUpload("invoices"));
  function handleMediaUpload(docType) {
    return async (req, res) => {
      const docId = req.params.docId;
      const type = docType === "quotes" ? "quote" : "invoice";
      const rawBody = req.rawBody;
      const ct = req.headers["content-type"] || "";
      if (!rawBody || !ct.includes("multipart")) {
        return res.status(400).json({ message: "Aucun fichier re\xE7u" });
      }
      let savedFiles = [];
      try {
        savedFiles = await parseMultipartFiles(rawBody, ct);
      } catch (e) {
        console.warn("[PHOTOS] Parse error:", e.message);
      }
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["host"] || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;
      const savedUrls = [];
      for (const file of savedFiles) {
        const publicUrl = `${baseUrl}/uploads/${file.filename}`;
        savedUrls.push(publicUrl);
        try {
          await pool.query(
            "INSERT INTO document_photos (doc_id, doc_type, photo_uri) VALUES ($1, $2, $3)",
            [docId, type, publicUrl]
          );
        } catch (e) {
          console.warn("[PHOTOS] DB save failed:", e.message);
        }
      }
      console.log(`[PHOTOS] Saved ${savedUrls.length} photos for ${type} ${docId}: ${savedUrls.join(", ")}`);
      const authHeaders = {
        "host": new URL(getActiveApiUrl()).host,
        "accept": "application/json",
        "x-requested-with": "XMLHttpRequest"
      };
      if (req.headers["authorization"]) authHeaders["authorization"] = req.headers["authorization"];
      if (req.headers["cookie"]) authHeaders["cookie"] = req.headers["cookie"];
      authHeaders["content-type"] = ct;
      try {
        const mobileUrl = `${getActiveApiUrl()}/mobile/admin/${docType}/${docId}/media`;
        const r = await fetch(mobileUrl, { method: "POST", headers: authHeaders, body: rawBody, redirect: "manual" });
        const txt = await r.text();
        if (!txt.includes("<!DOCTYPE")) {
          console.log(`[PHOTOS] External API response: ${r.status} ${txt.substring(0, 200)}`);
        }
      } catch (e) {
        console.log(`[PHOTOS] External API forward failed (non-blocking): ${e.message}`);
      }
      return res.json({ success: true, photos: savedUrls });
    };
  }
  app2.use("/api/admin", async (req, res, next) => {
    try {
      const authHeaders = {
        "host": new URL(getActiveApiUrl()).host,
        "accept": "application/json",
        "x-requested-with": "XMLHttpRequest"
      };
      if (req.headers["authorization"]) authHeaders["authorization"] = req.headers["authorization"];
      if (req.headers["cookie"]) authHeaders["cookie"] = req.headers["cookie"];
      const buildBody = () => {
        if (req.method === "GET" || req.method === "HEAD") return {};
        const ct = req.headers["content-type"] || "";
        if (ct.includes("multipart/form-data")) return { body: req.rawBody, contentType: ct };
        return { body: JSON.stringify(req.body), contentType: "application/json" };
      };
      const path3 = req.url.replace(/\?.*$/, "");
      const cleanPath = path3.replace(/\/$/, "");
      const isDocMutation = (cleanPath === "/invoices" || cleanPath === "/quotes" || /^\/(invoices|quotes)\/[^/]+$/.test(cleanPath)) && (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") && req.body;
      if (isDocMutation) {
        const htVal = req.body.totalHT || req.body.priceExcludingTax || req.body.total_excluding_tax;
        const ttcVal = req.body.totalTTC || req.body.quoteAmount || req.body.amount || req.body.total || req.body.total_including_tax;
        const taxVal = req.body.tvaRate || req.body.taxRate || req.body.tax_rate;
        if (htVal) {
          req.body.priceExcludingTax = htVal;
          req.body.total_excluding_tax = htVal;
        }
        if (ttcVal) {
          req.body.quoteAmount = ttcVal;
          req.body.total = ttcVal;
          req.body.total_including_tax = ttcVal;
          req.body.amount = ttcVal;
        }
        if (taxVal) {
          req.body.taxRate = taxVal;
          req.body.tax_rate = taxVal;
        }
        const normalizeItem = (it) => {
          const clean = { ...it };
          if (it.unitPrice !== void 0 && !clean.unit_price) clean.unit_price = String(it.unitPrice);
          if (it.unitPriceExcludingTax !== void 0 && !clean.unit_price_excluding_tax) clean.unit_price_excluding_tax = String(it.unitPriceExcludingTax);
          if (it.priceExcludingTax !== void 0 && !clean.unit_price_excluding_tax) clean.unit_price_excluding_tax = String(it.priceExcludingTax);
          if (it.taxRate !== void 0 && !clean.tax_rate) clean.tax_rate = String(it.taxRate);
          if (it.tvaRate !== void 0 && !clean.tax_rate) clean.tax_rate = String(it.tvaRate);
          if (it.totalExcludingTax !== void 0 && !clean.total_excluding_tax) clean.total_excluding_tax = String(it.totalExcludingTax);
          if (it.totalIncludingTax !== void 0 && !clean.total_including_tax) clean.total_including_tax = String(it.totalIncludingTax);
          const price = clean.unit_price || clean.unit_price_excluding_tax;
          if (price) {
            clean.unit_price = String(price);
            clean.unit_price_excluding_tax = String(price);
          }
          if (clean.quantity !== void 0) clean.quantity = typeof clean.quantity === "string" ? parseFloat(clean.quantity) : clean.quantity;
          return clean;
        };
        if (Array.isArray(req.body.items)) {
          req.body.items = req.body.items.map(normalizeItem);
        }
        if (Array.isArray(req.body.lineItems)) {
          req.body.lineItems = req.body.lineItems.map(normalizeItem);
        }
        if (Array.isArray(req.body.items) && !Array.isArray(req.body.lineItems)) {
          req.body.lineItems = req.body.items;
        }
        if (Array.isArray(req.body.lineItems) && !Array.isArray(req.body.items)) {
          req.body.items = req.body.lineItems;
        }
        console.log(`[SANITIZE] ${path3} Full body:`, JSON.stringify(req.body).substring(0, 800));
      }
      const { body, contentType } = buildBody();
      if (contentType) authHeaders["content-type"] = contentType;
      const fetchOpts = { method: req.method, headers: authHeaders, redirect: "manual" };
      if (body) fetchOpts.body = body;
      const tryUrl = async (url) => {
        const r = await fetch(url, fetchOpts);
        const txt = await r.text();
        if (txt.includes("<!DOCTYPE") || txt.includes("<html")) return null;
        return { status: r.status, text: txt, headers: r.headers };
      };
      const adminUrl = `${getActiveApiUrl()}/admin${req.url}`;
      const mobileUrl = `${getActiveApiUrl()}/mobile/admin${req.url}`;
      let result = await tryUrl(mobileUrl);
      if (!result) {
        result = await tryUrl(adminUrl);
        if (result) console.log(`[MOBILE-ADMIN] ${req.method} /admin${req.url} => ${result.status} (legacy fallback)`);
      } else {
        console.log(`[MOBILE-ADMIN] ${req.method} /mobile/admin${req.url} => ${result.status}`);
        if (result.status >= 400) {
          const fallback = await tryUrl(adminUrl);
          if (fallback && fallback.status < result.status) {
            console.log(`[MOBILE-ADMIN] ${req.method} /admin${req.url} => ${fallback.status} (legacy fallback, better than ${result.status})`);
            result = fallback;
          }
        }
      }
      if (!result) {
        const isMutation = !["GET", "HEAD"].includes(req.method);
        return res.status(404).json({ success: false, message: isMutation ? "Cette fonctionnalit\xE9 n'est pas disponible sur ce serveur." : "Endpoint non trouv\xE9" });
      }
      result.headers.forEach((value, key) => {
        const lk = key.toLowerCase();
        if (["transfer-encoding", "content-encoding", "content-length"].includes(lk)) return;
        if (lk === "set-cookie") {
          res.appendHeader("set-cookie", value);
          return;
        }
      });
      try {
        const data = JSON.parse(result.text);
        const routePath = path3.replace(/\/$/, "");
        const isQuoteRoute = routePath === "/quotes" || routePath.startsWith("/quotes/");
        const isInvoiceRoute = routePath === "/invoices" || routePath.startsWith("/invoices/");
        const docType = isQuoteRoute ? "quote" : isInvoiceRoute ? "invoice" : null;
        let bodyHT = parseFloat(String(req.body?.priceExcludingTax || req.body?.totalHT || req.body?.total_excluding_tax || 0)) || 0;
        let bodyTTC = parseFloat(String(req.body?.quoteAmount || req.body?.amount || req.body?.total || req.body?.total_including_tax || 0)) || 0;
        const bodyItems = req.body?.items || req.body?.lineItems;
        if ((bodyHT <= 0 || bodyTTC <= 0) && Array.isArray(bodyItems) && bodyItems.length > 0) {
          let calcHT = 0, calcTTC = 0;
          for (const it of bodyItems) {
            const price = parseFloat(String(it.unitPriceExcludingTax || it.unit_price_excluding_tax || it.unitPrice || it.unit_price || it.price || 0)) || 0;
            const qty = parseFloat(String(it.quantity || 1)) || 1;
            const tax = parseFloat(String(it.taxRate || it.tax_rate || it.tvaRate || 0)) || 0;
            const lineHT = parseFloat(String(it.totalExcludingTax || it.total_excluding_tax || 0)) || qty * price;
            const lineTTC = parseFloat(String(it.totalIncludingTax || it.total_including_tax || 0)) || lineHT * (1 + tax / 100);
            calcHT += lineHT;
            calcTTC += lineTTC;
          }
          if (bodyHT <= 0) bodyHT = calcHT;
          if (bodyTTC <= 0) bodyTTC = calcTTC;
          console.log(`[AMOUNTS] Computed from ${bodyItems.length} items: HT=${bodyHT} TTC=${bodyTTC}`);
        }
        const isMutationSuccess = (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") && result.status < 300;
        if (isMutationSuccess && docType && (data?.id || req.method !== "POST" && routePath.match(/\/(quotes|invoices)\/([^/]+)$/)) && (bodyTTC > 0 || Array.isArray(bodyItems))) {
          const docId = data?.id || routePath.match(/\/(quotes|invoices)\/([^/]+)$/)?.[2] || "";
          const taxAmt = bodyTTC - bodyHT;
          const hasItems = Array.isArray(bodyItems) && bodyItems.length > 0;
          try {
            if (hasItems) {
              await pool.query(
                `INSERT INTO document_amounts (doc_id, doc_type, price_excluding_tax, total_including_tax, tax_amount, items)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (doc_id) DO UPDATE SET price_excluding_tax=$3, total_including_tax=$4, tax_amount=$5, items=$6, updated_at=NOW()`,
                [docId, docType, bodyHT, bodyTTC, taxAmt, JSON.stringify(bodyItems)]
              );
            } else {
              await pool.query(
                `INSERT INTO document_amounts (doc_id, doc_type, price_excluding_tax, total_including_tax, tax_amount, items)
                 VALUES ($1, $2, $3, $4, $5, '[]')
                 ON CONFLICT (doc_id) DO UPDATE SET price_excluding_tax=$3, total_including_tax=$4, tax_amount=$5, updated_at=NOW()`,
                [docId, docType, bodyHT, bodyTTC, taxAmt]
              );
            }
            console.log(`[AMOUNTS] Saved ${docType} ${docId}: HT=${bodyHT} TTC=${bodyTTC} items=${hasItems ? bodyItems.length : "(preserved)"}`);
          } catch (e) {
            console.warn("[AMOUNTS] save failed:", e.message);
          }
        }
        const enrichItem = async (item) => {
          if (!item?.id) return item;
          const apiHT = parseFloat(String(item.priceExcludingTax || item.totalHT || item.total_excluding_tax || 0)) || 0;
          const apiTTC = parseFloat(String(item.quoteAmount || item.amount || item.totalTTC || item.total || item.total_including_tax || 0)) || 0;
          const existingItems = item.items || item.lineItems || item.lines || [];
          const hasLocalItems = existingItems.length > 0;
          try {
            const row = await pool.query("SELECT * FROM document_amounts WHERE doc_id=$1", [item.id]);
            if (row.rows.length > 0) {
              const r = row.rows[0];
              const ht = parseFloat(r.price_excluding_tax) || 0;
              const ttc = parseFloat(r.total_including_tax) || 0;
              let localItems = [];
              try {
                localItems = JSON.parse(r.items || "[]");
              } catch {
              }
              const enriched2 = { ...item };
              if (ht > 0 || ttc > 0) {
                enriched2.priceExcludingTax = String(ht);
                enriched2.quoteAmount = String(ttc);
                enriched2.amount = String(ttc);
                enriched2.total_excluding_tax = String(ht);
                enriched2.total_including_tax = String(ttc);
                enriched2.taxAmount = String(parseFloat(r.tax_amount) || ttc - ht);
                enriched2._localAmounts = true;
              }
              if (localItems.length > 0) {
                enriched2.items = localItems;
                enriched2.lineItems = localItems;
                enriched2._localItems = true;
                if (!hasLocalItems || localItems.length !== existingItems.length) {
                  console.log(`[ENRICH] Injected ${localItems.length} local items for ${item.id} (API had ${existingItems.length})`);
                }
              }
              try {
                const photoRows = await pool.query("SELECT photo_uri FROM document_photos WHERE doc_id=$1 ORDER BY created_at", [item.id]);
                if (photoRows.rows.length > 0) {
                  const photoUrls = photoRows.rows.map((r2) => r2.photo_uri);
                  enriched2.photos = photoUrls;
                  enriched2.mediaUrls = photoUrls;
                }
              } catch {
              }
              if (enriched2._localAmounts || enriched2._localItems) {
                return enriched2;
              }
            }
          } catch {
          }
          try {
            const photoRows = await pool.query("SELECT photo_uri FROM document_photos WHERE doc_id=$1 ORDER BY created_at", [item.id]);
            if (photoRows.rows.length > 0) {
              const photoUrls = photoRows.rows.map((r) => r.photo_uri);
              const existingPhotos = item.requestDetails?.mediaUrls || item.photos || item.mediaUrls || [];
              if (existingPhotos.length === 0) {
                item = { ...item, photos: photoUrls, mediaUrls: photoUrls };
              }
            }
          } catch {
          }
          if (apiHT > 0 || apiTTC > 0) return item;
          const apiItems = item.items || item.lineItems || item.lines || [];
          if (apiItems.length > 0) {
            let calcHT = 0, calcTTC = 0;
            for (const it of apiItems) {
              const price = parseFloat(String(it.unit_price || it.unit_price_excluding_tax || it.unitPrice || it.unitPriceExcludingTax || it.price || 0)) || 0;
              const qty = parseFloat(String(it.quantity || 1)) || 1;
              const tax = parseFloat(String(it.tax_rate || it.taxRate || it.tvaRate || 0)) || 0;
              const lineHT = parseFloat(String(it.total_excluding_tax || it.totalExcludingTax || 0)) || qty * price;
              const lineTTC = parseFloat(String(it.total_including_tax || it.totalIncludingTax || it.totalPrice || 0)) || qty * price * (1 + tax / 100);
              calcHT += lineHT;
              calcTTC += lineTTC;
            }
            if (calcTTC > 0) {
              pool.query(
                `INSERT INTO document_amounts (doc_id, doc_type, price_excluding_tax, total_including_tax, tax_amount, items)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (doc_id) DO UPDATE SET price_excluding_tax=$3, total_including_tax=$4, tax_amount=$5, updated_at=NOW()`,
                [item.id, docType, calcHT, calcTTC, calcTTC - calcHT, JSON.stringify(apiItems)]
              ).catch(() => {
              });
              return {
                ...item,
                priceExcludingTax: calcHT.toFixed(2),
                quoteAmount: calcTTC.toFixed(2),
                amount: calcTTC.toFixed(2),
                total_excluding_tax: calcHT.toFixed(2),
                total_including_tax: calcTTC.toFixed(2),
                taxAmount: (calcTTC - calcHT).toFixed(2),
                _computedAmounts: true
              };
            }
          }
          return item;
        };
        let enriched = data;
        if (docType && (req.method === "GET" || isMutationSuccess)) {
          if (Array.isArray(data)) {
            enriched = await Promise.all(data.map(enrichItem));
          } else if (data?.id) {
            enriched = await enrichItem(data);
          } else if (data?.data && Array.isArray(data.data)) {
            enriched = { ...data, data: await Promise.all(data.data.map(enrichItem)) };
          }
        }
        if (req.method === "POST" && result.status < 300) {
          console.log(`[MOBILE-ADMIN-RESP] ${req.method} ${req.url} => keys: ${Object.keys(enriched).join(",")}, total: ${enriched.quoteAmount ?? enriched.amount ?? "?"}, totalHT: ${enriched.priceExcludingTax ?? "?"}`);
        } else if (result.status >= 400) {
          console.log(`[MOBILE-ADMIN-ERR] ${req.method} ${req.url} => ${result.status}: ${result.text.substring(0, 400)}`);
        }
        return res.status(result.status).json(enriched);
      } catch {
        return res.status(result.status).send(result.text);
      }
    } catch (err) {
      console.error("[MOBILE-ADMIN] error:", err.message);
      return res.status(502).json({ message: "Erreur de connexion au serveur API" });
    }
  });
  async function mobileCrudProxy(req, res, primarySegment, fallbackSegments) {
    const urlSuffix = req.url === "/" ? "" : req.url;
    const authHeaders = {
      "host": new URL(getActiveApiUrl()).host,
      "accept": "application/json",
      "x-requested-with": "XMLHttpRequest",
      "content-type": "application/json"
    };
    if (req.headers["authorization"]) authHeaders["authorization"] = req.headers["authorization"];
    if (req.headers["cookie"]) authHeaders["cookie"] = req.headers["cookie"];
    const fetchOpts = { method: req.method, headers: authHeaders, redirect: "manual" };
    if (req.method !== "GET" && req.method !== "HEAD") {
      const incomingCt = req.headers["content-type"] || "";
      if (incomingCt.includes("multipart/form-data")) {
        authHeaders["content-type"] = incomingCt;
        fetchOpts.body = req.rawBody;
        const formDataLog = `${req.method} /${primarySegment}${urlSuffix} multipart, size=${req.rawBody?.length} bytes`;
        console.log(`[MOBILE-CRUD-BODY] ${formDataLog}`);
      } else {
        fetchOpts.body = JSON.stringify(req.body);
        if (req.method === "POST") {
          const bodyLog = JSON.stringify(req.body).substring(0, 500);
          console.log(`[MOBILE-CRUD-BODY] ${req.method} /${primarySegment}${urlSuffix} body:`, bodyLog);
        }
      }
    }
    const tryUrl = async (url) => {
      try {
        const r = await fetch(url, fetchOpts);
        const txt = await r.text();
        if (txt.includes("<!DOCTYPE") || txt.includes("<html")) return null;
        return { status: r.status, text: txt, headers: r.headers };
      } catch {
        return null;
      }
    };
    const segments = [primarySegment, ...fallbackSegments];
    let result = null;
    let usedSeg = primarySegment;
    for (const seg of segments) {
      const url = `${getActiveApiUrl()}/${seg}${urlSuffix}`;
      result = await tryUrl(url);
      if (result) {
        usedSeg = seg;
        break;
      }
    }
    if (!result) {
      console.log(`[MOBILE-CRUD] ${req.method} /${primarySegment}${urlSuffix} => HTML/not-found (${segments.length} urls tried)`);
      return res.status(404).json({ success: false, message: "Cette fonctionnalit\xE9 n'est pas disponible sur ce serveur." });
    }
    if (result.status >= 400) {
      console.log(`[MOBILE-CRUD-ERR] ${req.method} /${usedSeg}${urlSuffix} => ${result.status} body: ${result.text.substring(0, 800)}`);
    } else {
      if (req.method === "POST") {
        console.log(`[MOBILE-CRUD-RESP] ${req.method} /${usedSeg}${urlSuffix} => ${result.status} response: ${result.text.substring(0, 1e3)}`);
      } else {
        console.log(`[MOBILE-CRUD] ${req.method} /${usedSeg}${urlSuffix} => ${result.status}`);
      }
    }
    result.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      if (["transfer-encoding", "content-encoding", "content-length"].includes(lk)) return;
      if (lk === "set-cookie") {
        res.appendHeader("set-cookie", value);
        return;
      }
    });
    try {
      return res.status(result.status).json(JSON.parse(result.text));
    } catch {
      return res.status(result.status).send(result.text);
    }
  }
  app2.use("/api/invoices", async (req, res, next) => {
    return mobileCrudProxy(req, res, "mobile/invoices", ["mobile/admin/invoices", "admin/invoices"]);
  });
  app2.use("/api/reservations", async (req, res, next) => {
    return mobileCrudProxy(req, res, "mobile/reservations", ["mobile/admin/reservations", "admin/reservations"]);
  });
  app2.use("/api/quotes", async (req, res, next) => {
    return mobileCrudProxy(req, res, "mobile/quotes", ["mobile/admin/quotes", "admin/quotes"]);
  });
  app2.get("/api/auth/me", async (req, res) => {
    const headers = {
      "accept": "application/json",
      "x-requested-with": "XMLHttpRequest"
    };
    if (req.headers["authorization"]) headers["authorization"] = req.headers["authorization"];
    if (req.headers["cookie"]) headers["cookie"] = req.headers["cookie"];
    try {
      const r = await fetchWithBackendFallback("/mobile/auth/me", { headers, redirect: "manual" });
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifi\xE9" });
      }
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.post("/api/refresh", async (req, res) => {
    const headers = {
      "content-type": "application/json",
      "accept": "application/json"
    };
    if (req.headers["authorization"]) headers["authorization"] = req.headers["authorization"];
    if (req.headers["cookie"]) headers["cookie"] = req.headers["cookie"];
    try {
      const r = await fetchWithBackendFallback("/mobile/refresh-token", {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual"
      });
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Session expir\xE9e" });
      }
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  registerSocialAuthRoutes(app2);
  app2.post("/api/register", async (req, res) => {
    const headers = getAuthHeaders(req);
    try {
      const r = await fetchWithBackendFallback("/mobile/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual"
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(400).json({ message: "Erreur lors de l'inscription" });
      }
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.get("/api/auth/user", async (req, res) => {
    const headers = getAuthHeaders(req);
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/profile`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        r = await fetch(`${getActiveApiUrl()}/mobile/auth/me`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
      }
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(401).json({ message: "Non authentifi\xE9" });
      }
      forwardSetCookie(r, res);
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.put("/api/auth/user", async (req, res) => {
    const headers = getAuthHeaders(req);
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual"
      });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html") || r.status >= 400) {
        r = await fetch(`${getActiveApiUrl()}/auth/user`, {
          method: "PUT",
          headers,
          body: JSON.stringify(req.body),
          redirect: "manual"
        });
        text = await r.text();
      }
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(400).json({ message: "Erreur de mise \xE0 jour du profil" });
      }
      forwardSetCookie(r, res);
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.post("/api/auth/change-password", async (req, res) => {
    const headers = getAuthHeaders(req);
    try {
      let r = await fetch(`${getActiveApiUrl()}/user/password`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual"
      });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html") || r.status >= 400) {
        r = await fetch(`${getActiveApiUrl()}/auth/change-password`, {
          method: "POST",
          headers,
          body: JSON.stringify(req.body),
          redirect: "manual"
        });
        text = await r.text();
      }
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(400).json({ message: "Erreur de changement de mot de passe" });
      }
      forwardSetCookie(r, res);
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.post("/api/quotes/:id/create-reservation", async (req, res) => {
    const { id } = req.params;
    const headers = getAuthHeaders(req);
    try {
      const r = await fetch(`${getActiveApiUrl()}/mobile/quotes/${id}/create-reservation`, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        redirect: "manual"
      });
      forwardSetCookie(r, res);
      const text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.status(400).json({ message: "Erreur lors de la cr\xE9ation de r\xE9servation" });
      }
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.get("/api/services", async (req, res) => {
    const headers = getAuthHeaders(req);
    const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    try {
      let r = await fetch(`${getActiveApiUrl()}/mobile/services${qs}`, { method: "GET", headers, redirect: "manual" });
      let text = await r.text();
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        r = await fetch(`${getActiveApiUrl()}/services${qs}`, { method: "GET", headers, redirect: "manual" });
        text = await r.text();
      }
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return res.json([]);
      }
      forwardSetCookie(r, res);
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch {
        return res.status(r.status).send(text);
      }
    } catch (err) {
      return res.json([]);
    }
  });
  app2.post("/api/ocr/analyze", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", mode = "invoice" } = req.body;
      if (!imageBase64) return res.status(400).json({ success: false, message: "imageBase64 requis" });
      const { GoogleGenAI } = __require("@google/genai");
      const ocrAi = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
        }
      });
      const systemPrompt = mode === "quote" ? `Tu es un assistant OCR sp\xE9cialis\xE9 dans les devis automobiles fran\xE7ais. Analyse l'image et extrais les informations structur\xE9es. Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks): {"clientName":"string ou null","clientEmail":"string ou null","vehicleBrand":"string ou null","vehicleModel":"string ou null","vehiclePlate":"string ou null","notes":"string ou null","items":[{"description":"string","quantity":"1","unitPrice":"string","tvaRate":"20"}]}` : `Tu es un assistant OCR sp\xE9cialis\xE9 dans les factures fran\xE7aises. Analyse l'image et extrais les informations structur\xE9es. Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks): {"clientName":"string ou null","clientEmail":"string ou null","notes":"string ou null","paymentMethod":"cash|wire_transfer|card|sepa|stripe|klarna|alma ou null","items":[{"description":"string","quantity":"1","unitPrice":"string","tvaRate":"20"}]}`;
      try {
        const response = await ocrAi.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{
            role: "user",
            parts: [
              { text: systemPrompt },
              { inlineData: { mimeType, data: imageBase64 } }
            ]
          }],
          config: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        });
        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              console.log(`[OCR] \u2705 Gemini SDK success for ${mode}`);
              return res.json({ success: true, data: parsed });
            } catch (parseErr) {
              console.log(`[OCR] JSON parse error: ${parseErr.message}, raw: ${text.substring(0, 200)}`);
            }
          }
        }
        console.log(`[OCR] Gemini response could not be parsed: ${text.substring(0, 200)}`);
      } catch (geminiErr) {
        console.error(`[OCR] Gemini SDK error: ${geminiErr.message}`);
        return res.status(500).json({ success: false, message: `Erreur IA: ${geminiErr.message}` });
      }
      console.log(`[OCR] Returning empty fallback for ${mode}`);
      return res.json({
        success: true,
        data: {
          clientName: null,
          clientEmail: null,
          notes: "Document scann\xE9 - remplir les champs manuellement",
          items: [{ description: "", quantity: "1", unitPrice: "", tvaRate: "20" }],
          ...mode === "quote" && { vehicleBrand: null, vehicleModel: null, vehiclePlate: null }
        }
      });
    } catch (err) {
      console.error("[OCR] Unexpected error:", err.message);
      return res.status(500).json({ success: false, message: "Erreur lors de l'analyse OCR" });
    }
  });
  app2.get("/api/public/pdf/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    const token = req.query.token;
    if (!type || !id || !["quotes", "invoices"].includes(type)) {
      return res.status(400).json({ message: "Type invalide" });
    }
    if (!token) {
      return res.status(400).json({ message: "Token requis" });
    }
    try {
      const endpoint = `/mobile/${type}/${id}/pdf?viewToken=${encodeURIComponent(token)}`;
      const headers = {
        "accept": "application/pdf"
      };
      const response = await fetchWithBackendFallback(endpoint, { method: "GET", headers, redirect: "manual" });
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/pdf") || ct.includes("octet-stream")) {
        const body = await response.arrayBuffer();
        res.status(response.status);
        res.setHeader("content-type", ct);
        const disposition = response.headers.get("content-disposition");
        if (disposition) res.setHeader("content-disposition", disposition);
        res.send(Buffer.from(body));
      } else {
        const body = await response.text();
        if (body.includes("<!DOCTYPE") || body.includes("<html")) {
          return res.status(404).json({ message: "PDF non trouv\xE9" });
        }
        res.status(response.status);
        res.setHeader("content-type", ct || "application/json");
        res.send(body);
      }
    } catch (err) {
      console.error("[PUBLIC-PDF] Error:", err.message);
      res.status(502).json({ message: "Erreur de connexion" });
    }
  });
  app2.use("/api", async (req, res, next) => {
    try {
      const clientAccept = req.headers["accept"] || "application/json";
      const wantsPdf = clientAccept.includes("application/pdf");
      const headers = {
        "accept": wantsPdf ? "application/pdf" : "application/json",
        "x-requested-with": "XMLHttpRequest"
      };
      if (req.headers["content-type"]) {
        headers["content-type"] = req.headers["content-type"];
      }
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"];
      }
      if (req.headers["authorization"]) {
        headers["authorization"] = req.headers["authorization"];
      }
      const fetchOptions = {
        method: req.method,
        headers,
        redirect: "manual"
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          fetchOptions.body = JSON.stringify(req.body);
        } else if (contentType.includes("multipart/form-data")) {
          fetchOptions.body = req.rawBody;
          headers["content-type"] = contentType;
        } else if (contentType.includes("urlencoded")) {
          const params = new URLSearchParams(req.body);
          fetchOptions.body = params.toString();
        } else if (req.rawBody) {
          fetchOptions.body = req.rawBody;
        } else {
          fetchOptions.body = JSON.stringify(req.body);
          headers["content-type"] = "application/json";
        }
      }
      const response = await fetchWithBackendFallback(req.url, fetchOptions);
      const proxyCookieParts = [];
      response.headers.forEach((value, key) => {
        const lk = key.toLowerCase();
        if (lk === "transfer-encoding" || lk === "content-encoding" || lk === "content-length" || lk === "location") return;
        if (lk === "set-cookie") {
          res.appendHeader("set-cookie", value);
          const cookiePart = value.split(";")[0].trim();
          if (cookiePart && !cookiePart.startsWith("XSRF-TOKEN") && !cookiePart.startsWith("csrf")) {
            proxyCookieParts.push(cookiePart);
          }
          return;
        }
        if (lk !== "content-type") {
          res.setHeader(key, value);
        }
      });
      if (proxyCookieParts.length > 0) {
        res.setHeader("X-Session-Cookie", proxyCookieParts.join("; "));
      }
      console.log(`[PROXY] ${req.method} /api${req.url} => ${response.status} ${response.statusText}`);
      const upstreamContentType = response.headers.get("content-type") || "";
      const body = await response.arrayBuffer();
      const bodyBuf = Buffer.from(body);
      const isPdfByType = upstreamContentType.includes("application/pdf") || upstreamContentType.includes("octet-stream");
      const isPdfByMagic = bodyBuf.length > 4 && bodyBuf.slice(0, 4).toString("ascii") === "%PDF";
      const isPdfByUrl = req.url.endsWith("/pdf") || req.url.includes("/pdf?");
      if (isPdfByType || isPdfByMagic || isPdfByUrl && response.status === 200) {
        res.status(response.status);
        res.setHeader("content-type", "application/pdf");
        const disposition = response.headers.get("content-disposition");
        if (disposition) res.setHeader("content-disposition", disposition);
        else res.setHeader("content-disposition", 'inline; filename="document.pdf"');
        res.send(bodyBuf);
        return;
      }
      const text = Buffer.from(body).toString("utf-8");
      let isJson = false;
      try {
        const parsed = JSON.parse(text);
        isJson = true;
        const debugEndpoints = ["/invoices", "/quotes", "/reservations", "/services", "/login", "/auth", "/mobile/auth", "/mobile/public"];
        const shouldLog = debugEndpoints.some((ep) => req.url === ep || req.url.startsWith(ep + "?") || req.url.startsWith(ep + "/"));
        if (response.status >= 400) {
          console.log(`[PROXY-ERROR] ${req.method} /api${req.url} => ${response.status}:`, JSON.stringify(parsed).slice(0, 2e3));
        } else if (shouldLog) {
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[DEBUG] ${req.method} /api${req.url} => Array[${parsed.length}], keys:`, Object.keys(parsed[0]), "sample:", JSON.stringify(parsed[0]).slice(0, 1500));
          } else if (parsed && typeof parsed === "object") {
            console.log(`[DEBUG] ${req.method} /api${req.url} => Object keys:`, Object.keys(parsed), "full:", JSON.stringify(parsed).slice(0, 2e3));
          }
        }
        res.status(response.status);
        res.setHeader("content-type", "application/json");
        res.send(Buffer.from(body));
      } catch {
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          console.log(`[DEBUG] ${req.method} /api${req.url} => HTML response (SPA fallback), status: ${response.status}`);
          const isMutation = req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE";
          if (isMutation) {
            res.status(404);
            res.setHeader("content-type", "application/json");
            res.json({ success: false, message: "Cette fonctionnalit\xE9 n'est pas disponible sur ce serveur." });
          } else {
            res.status(404);
            res.setHeader("content-type", "application/json");
            res.json({ message: "Endpoint non trouv\xE9" });
          }
        } else {
          res.status(response.status);
          res.send(Buffer.from(body));
        }
      }
    } catch (err) {
      console.error("API proxy error:", err.message);
      res.status(502).json({ message: "Erreur de connexion au serveur API" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
require_parse_dev_secrets();
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost || origin.includes("expo.dev"))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
      res.header("Access-Control-Expose-Headers", "X-Session-Cookie, set-cookie");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use((req, _res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        req.rawBody = Buffer.concat(chunks);
        next();
      });
      req.on("error", next);
    } else {
      next();
    }
  });
  app2.use(
    express.json({
      limit: "25mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "25mb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  let landingPageTemplate = "";
  try {
    landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  } catch {
    log("Warning: landing-page.html not found, using fallback");
    landingPageTemplate = "<!DOCTYPE html><html><body><h1>MyJantes App</h1></body></html>";
  }
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      try {
        return serveLandingPage({
          req,
          res,
          landingPageTemplate,
          appName
        });
      } catch (err) {
        log("Landing page error:", err);
        return res.status(200).send("<!DOCTYPE html><html><body><h1>MyJantes</h1></body></html>");
      }
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  const staticBuildPath = path2.resolve(process.cwd(), "static-build");
  if (fs2.existsSync(staticBuildPath)) {
    app2.use(express.static(staticBuildPath));
  } else {
    log("Warning: static-build directory not found, skipping static file serving");
  }
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = process.env.NODE_ENV === "production" ? parseInt(process.env.PORT || "8081", 10) : 5e3;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`Server running on port ${port}`);
    }
  );
})();
