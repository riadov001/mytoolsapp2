import type { Express, Request, Response } from "express";

const EXTERNAL_API = "https://saas2.mytoolsgroup.eu/api";

let adminApp: any = null;

function getAdminAuth() {
  if (adminApp) return adminApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON non configuré sur le serveur"
    );
  }

  try {
    const admin = require("firebase-admin");
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
    throw new Error(`Erreur init Firebase Admin: ${err.message}`);
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);

  return {
    uid: decoded.uid,
    email: decoded.email || undefined,
    displayName: decoded.name || decoded.display_name || undefined,
    photoUrl: decoded.picture || undefined,
  };
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

      let firebaseUser: {
        uid: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
      };

      try {
        firebaseUser = await verifyFirebaseIdToken(token);
      } catch (err: any) {
        console.error("[SocialAuth] Firebase verify error:", err.message);
        return res.status(401).json({ message: "Token Firebase invalide" });
      }

      if (!firebaseUser.email) {
        return res.status(403).json({
          message: "Aucune adresse email associée à ce compte. Connexion refusée.",
        });
      }

      const externalRes = await fetch(
        `${EXTERNAL_API}/mobile/auth/login-with-firebase`,
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

      const contentType = externalRes.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.error("[SocialAuth] External API returned non-JSON response");
        return res.status(503).json({
          message: "Service temporairement indisponible. Veuillez réessayer.",
        });
      }

      const externalData = await externalRes.json();

      if (externalRes.status === 404) {
        console.log("[SocialAuth] User not found, needs registration:", {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          firebaseUid: firebaseUser.uid,
        });
        return res.status(404).json({
          message: externalData?.message || "Aucun compte trouvé avec cette adresse email.",
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || null,
          firebaseUid: firebaseUser.uid,
          needsRegistration: true,
        });
      }

      if (!externalRes.ok) {
        return res.status(externalRes.status).json({
          message: externalData?.message || "Authentification échouée",
        });
      }

      const setCookieHeaders = externalRes.headers.getSetCookie?.() || [];
      for (const cookie of setCookieHeaders) {
        res.appendHeader("set-cookie", cookie);
      }

      return res.json({
        accessToken: externalData.accessToken,
        refreshToken: externalData.refreshToken,
        user: externalData.user,
        firebaseUid: firebaseUser.uid,
      });
    } catch (err: any) {
      console.error("[SocialAuth] Error:", err.message);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return res.status(503).json({
          message: "Service temporairement indisponible. Veuillez réessayer.",
        });
      }
      return res
        .status(401)
        .json({ message: err.message || "Authentification sociale échouée" });
    }
  });
}
