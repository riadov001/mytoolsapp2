import type { Express, Request, Response } from "express";

const ALLOWED_API_DOMAIN = "backend.mytoolsgroup.eu";

function sanitizeSocialApiUrl(raw: string | undefined, fallback: string): string {
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

const DEFAULT_API = `https://${ALLOWED_API_DOMAIN}/api`;
const EXTERNAL_API = sanitizeSocialApiUrl(process.env.EXTERNAL_API_URL, DEFAULT_API);
const EXTERNAL_API_FALLBACK = sanitizeSocialApiUrl(process.env.EXTERNAL_API_FALLBACK_URL, DEFAULT_API);
const EXTERNAL_APIS = [EXTERNAL_API, EXTERNAL_API_FALLBACK].filter((v, i, a) => a.indexOf(v) === i);

async function fetchExternalWithFallback(path: string, options: RequestInit): Promise<globalThis.Response> {
  let lastErr: any;
  let lastResponse: globalThis.Response | null = null;
  for (const base of EXTERNAL_APIS) {
    try {
      const hostHeader = new URL(base).host;
      const updatedHeaders = { ...(options.headers as any), host: hostHeader };
      const res = await fetch(`${base}${path}`, { ...options, headers: updatedHeaders });
      if (res.status >= 500) {
        console.warn(`[SocialAuth] ${base} returned ${res.status}, trying next...`);
        lastResponse = res;
        continue;
      }
      return res;
    } catch (err: any) {
      lastErr = err;
      const isNet = err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" ||
        err?.code === "ETIMEDOUT" || err?.message?.includes("fetch");
      if (!isNet) throw err;
      console.warn(`[SocialAuth] Backend ${base} unreachable, trying fallback...`);
    }
  }
  if (lastResponse) return lastResponse;
  throw lastErr;
}

let adminApp: any = null;
let firebaseAdminModule: any = null;
let adminInitFailed = false;

async function getAdminAuth(): Promise<any | null> {
  if (adminInitFailed) return null;
  if (adminApp) return adminApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.warn("[SocialAuth] FIREBASE_SERVICE_ACCOUNT_KEY not set — local token verification disabled, forwarding to backend.");
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
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.app();
    }

    adminApp = admin.auth();
    return adminApp;
  } catch (err: any) {
    console.error(`[SocialAuth] Firebase Admin init failed: ${err.message} — forwarding to backend for verification.`);
    adminInitFailed = true;
    return null;
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
} | null> {
  const auth = await getAdminAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || undefined,
      displayName: decoded.name || decoded.display_name || undefined,
      photoUrl: decoded.picture || undefined,
    };
  } catch (err: any) {
    console.error("[SocialAuth] Firebase verify error:", err.message);
    throw new Error("Token Firebase invalide ou expiré");
  }
}

export function registerSocialAuthRoutes(app: Express) {
  app.post("/api/auth/social", async (req: Request, res: Response) => {
    try {
      const { token, provider } = req.body as {
        token: string;
        provider: "google" | "apple" | "facebook" | "twitter";
      };

      if (!token || !provider) {
        return res.status(400).json({ message: "token et provider requis" });
      }

      if (!["google", "apple", "facebook", "twitter"].includes(provider)) {
        return res.status(400).json({ message: "Provider non supporté" });
      }

      let firebaseUser: {
        uid: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
      } | null = null;

      try {
        firebaseUser = await verifyFirebaseIdToken(token);
      } catch (err: any) {
        return res.status(401).json({ message: "Token Firebase invalide ou expiré. Veuillez vous reconnecter." });
      }

      // Decode JWT payload locally as fallback for when Admin SDK is unavailable
      // (no verification — only used to extract email/uid for display, not for auth)
      let jwtPayload: any = null;
      if (!firebaseUser) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const padLen = (4 - (padded.length % 4)) % 4;
            jwtPayload = JSON.parse(Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf-8"));
          }
        } catch {}
        console.log("[SocialAuth] Forwarding token to backend for verification (local Admin SDK not configured)",
          jwtPayload?.email ? `(email from JWT: ${jwtPayload.email})` : "(no email in JWT payload)");
      } else if (!firebaseUser.email) {
        return res.status(403).json({
          message: "Aucune adresse email associée à ce compte. Veuillez utiliser un compte avec une adresse email vérifiée.",
        });
      }

      const externalRes = await fetchExternalWithFallback(
        "/mobile/auth/login-with-firebase",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ idToken: token }),
          signal: AbortSignal.timeout(15000),
        }
      );

      const rawText = await externalRes.text();
      const contentType = externalRes.headers.get("content-type") || "";

      let externalData: any = {};
      try {
        externalData = JSON.parse(rawText);
      } catch {
        if (!contentType.includes("application/json")) {
          console.error("[SocialAuth] External API returned non-JSON response:", rawText.substring(0, 200));
          return res.status(503).json({
            message: "Service temporairement indisponible. Veuillez réessayer dans quelques instants.",
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
            message: "Impossible de récupérer votre adresse email. Veuillez utiliser un compte avec une adresse email vérifiée.",
          });
        }

        return res.status(404).json({
          message: externalData?.message || "Aucun compte trouvé avec cette adresse email.",
          email,
          displayName,
          firebaseUid: uid,
          needsRegistration: true,
        });
      }

      if (!externalRes.ok) {
        const msg = externalData?.message || "Authentification échouée. Veuillez réessayer.";
        return res.status(externalRes.status).json({ message: msg });
      }

      const setCookieHeaders = externalRes.headers.getSetCookie?.() || [];
      for (const cookie of setCookieHeaders) {
        res.appendHeader("set-cookie", cookie);
      }

      // Normalize response — different backends use different field names
      const accessToken =
        externalData.accessToken ||
        externalData.token ||
        externalData.jwt ||
        externalData.access_token ||
        null;

      const user =
        externalData.user ||
        externalData.data?.user ||
        externalData.profile ||
        externalData.data ||
        null;

      const refreshToken =
        externalData.refreshToken ||
        externalData.refresh_token ||
        externalData.data?.refreshToken ||
        null;

      console.log("[SocialAuth] Login success, token present:", !!accessToken, "user present:", !!user);

      return res.json({
        accessToken,
        refreshToken,
        user,
        firebaseUid: firebaseUser?.uid || externalData?.firebaseUid,
      });
    } catch (err: any) {
      console.error("[SocialAuth] Error:", err.message);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return res.status(503).json({
          message: "Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.",
        });
      }
      return res.status(500).json({
        message: "Une erreur inattendue s'est produite. Veuillez réessayer.",
      });
    }
  });
}
