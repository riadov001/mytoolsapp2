const secretsJson = process.env.DEV_SECRETS_KEYS || "{}";

function setIfPresent(key, value) {
  if (value) process.env[key] = value;
}

try {
  const secrets = JSON.parse(secretsJson);
  const keys = Object.keys(secrets).filter(k => secrets[k]);

  if (keys.length > 0) {
    setIfPresent("EXPO_PUBLIC_FIREBASE_API_KEY", secrets.EXPO_PUBLIC_FIREBASE_API_KEY || secrets.GOOGLE_API_KEY_2);
    setIfPresent("EXPO_PUBLIC_FIREBASE_APP_ID", secrets.EXPO_PUBLIC_FIREBASE_APP_ID);
    setIfPresent("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", secrets.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
    setIfPresent("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", secrets.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
    setIfPresent("EXPO_PUBLIC_FIREBASE_PROJECT_ID", secrets.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
    setIfPresent("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", secrets.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
    setIfPresent("FIREBASE_SERVICE_ACCOUNT_JSON", secrets.FIREBASE_SERVICE_ACCOUNT_JSON);
    setIfPresent("SOCIAL_JWT_SECRET", secrets.SOCIAL_JWT_SECRET);
    console.log(`[DEV-SECRETS] Loaded ${keys.length} keys from DEV_SECRETS_KEYS`);
  } else {
    console.log("[DEV-SECRETS] DEV_SECRETS_KEYS empty or absent, using individual Replit secrets");
  }
} catch (err) {
  console.warn("[DEV-SECRETS] Could not parse DEV_SECRETS_KEYS:", err.message);
  console.log("[DEV-SECRETS] Falling back to individual Replit secrets");
}

const firebaseOk = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
console.log(`[SECRETS-CHECK] FIREBASE_SERVICE_ACCOUNT_JSON: ${firebaseOk ? "OK" : "MISSING"}`);
