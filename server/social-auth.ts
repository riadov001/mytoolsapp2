import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const SOCIAL_JWT_SECRET =
  process.env.SOCIAL_JWT_SECRET || "social-auth-secret-change-in-production";
const JWT_EXPIRES_IN = "30d";

// ── Firebase Admin SDK (lazy init) ──────────────────────────────────────────
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

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    adminApp = admin.auth();
    return adminApp;
  } catch (err: any) {
    throw new Error(`Erreur init Firebase Admin: ${err.message}`);
  }
}

// ── DB init ──────────────────────────────────────────────────────────────────
async function initSocialUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_users (
      id SERIAL PRIMARY KEY,
      firebase_uid TEXT UNIQUE,
      provider TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      photo_url TEXT,
      onboarding_completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

initSocialUsersTable().catch((err) =>
  console.error("[SocialAuth] DB init error:", err.message)
);

// ── Token verification ───────────────────────────────────────────────────────
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

async function verifyTwitterAccessToken(accessToken: string): Promise<{
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}> {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=id,name,profile_image_url",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error("Token Twitter invalide");

  const data = await res.json();
  const user = data?.data;
  if (!user) throw new Error("Impossible de récupérer l'utilisateur Twitter");

  return {
    uid: `twitter_${user.id}`,
    displayName: user.name,
    photoUrl: user.profile_image_url,
  };
}

// ── DB helpers ───────────────────────────────────────────────────────────────
async function upsertSocialUser(params: {
  firebase_uid: string;
  provider: string;
  email?: string;
  display_name?: string;
  photo_url?: string;
}): Promise<{ id: number; onboarding_completed: boolean; isNew: boolean }> {
  const existing = await pool.query(
    "SELECT id, onboarding_completed FROM social_users WHERE firebase_uid = $1",
    [params.firebase_uid]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE social_users SET
         email = COALESCE($2, email),
         display_name = COALESCE($3, display_name),
         photo_url = COALESCE($4, photo_url),
         updated_at = NOW()
       WHERE firebase_uid = $1`,
      [params.firebase_uid, params.email, params.display_name, params.photo_url]
    );
    return { ...existing.rows[0], isNew: false };
  }

  const result = await pool.query(
    `INSERT INTO social_users (firebase_uid, provider, email, display_name, photo_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, onboarding_completed`,
    [
      params.firebase_uid,
      params.provider,
      params.email,
      params.display_name,
      params.photo_url,
    ]
  );
  return { ...result.rows[0], isNew: true };
}

// ── Routes ───────────────────────────────────────────────────────────────────
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

      if (provider === "twitter") {
        firebaseUser = await verifyTwitterAccessToken(token);
      } else {
        firebaseUser = await verifyFirebaseIdToken(token);
      }

      const socialUser = await upsertSocialUser({
        firebase_uid: firebaseUser.uid,
        provider,
        email: firebaseUser.email,
        display_name: firebaseUser.displayName,
        photo_url: firebaseUser.photoUrl,
      });

      const jwtPayload = {
        id: socialUser.id,
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        name: firebaseUser.displayName || null,
        provider,
        role: "client",
        onboarding_completed: socialUser.onboarding_completed,
      };

      const accessToken = jwt.sign(jwtPayload, SOCIAL_JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return res.json({
        token: accessToken,
        user: jwtPayload,
        isNewUser: socialUser.isNew,
      });
    } catch (err: any) {
      console.error("[SocialAuth] Error:", err.message);
      return res
        .status(401)
        .json({ message: err.message || "Authentification sociale échouée" });
    }
  });

  app.post(
    "/api/auth/social/onboarding-complete",
    async (req: Request, res: Response) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(401).json({ message: "Token manquant" });
        }
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, SOCIAL_JWT_SECRET) as any;

        await pool.query(
          "UPDATE social_users SET onboarding_completed = TRUE WHERE firebase_uid = $1",
          [decoded.uid]
        );

        const newPayload = { ...decoded, onboarding_completed: true };
        const newToken = jwt.sign(newPayload, SOCIAL_JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        });

        return res.json({ token: newToken });
      } catch (err: any) {
        return res.status(401).json({ message: "Token invalide" });
      }
    }
  );
}
