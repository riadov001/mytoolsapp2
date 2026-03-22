# Configuration Apple Sign-In

## Étapes de configuration

### 1. Apple Developer
Dans **Certificates, Identifiers & Profiles** > **Services IDs** > **com.mytools.app.auth** :

Configurez les domaines et URLs de retour pour web :

**Domaines et sous-domaines :**
```
2af285d8-8e25-4134-8854-258d6d500fd1-00-1amwvjjo35spu.kirk.replit.dev
```

**Return URLs :**
```
https://2af285d8-8e25-4134-8854-258d6d500fd1-00-1amwvjjo35spu.kirk.replit.dev/auth/callback
```

### 2. Firebase Console
**Project Settings** > **Your apps** > **Web app**

Copiez ces 4 valeurs :
- `apiKey` → `EXPO_PUBLIC_FIREBASE_API_KEY`
- `authDomain` → `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `projectId` → `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `appId` → `EXPO_PUBLIC_FIREBASE_APP_ID`

### 3. Variables d'environnement à configurer

**Frontend (Replit Secrets) :**
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (pour Google Sign-In)
- `EXPO_PUBLIC_FACEBOOK_APP_ID` (pour Facebook)
- `EXPO_PUBLIC_TWITTER_CLIENT_ID` (pour Twitter/X)

**Backend (Replit Secrets) :**
- `FIREBASE_WEB_API_KEY` (même valeur que EXPO_PUBLIC_FIREBASE_API_KEY)
- `SOCIAL_JWT_SECRET` (générez une clé secrète longue et aléatoire)

## Test d'Apple Sign-In

1. Build sur un vrai appareil iOS
2. Utilisez `eas build --platform ios` ou `npx expo run:ios`
3. Vous verrez le bouton "Apple" uniquement sur iOS

Pour web/Android, seuls Google, Facebook et Twitter s'affichent.

## Architecture

- **Frontend** : `expo-apple-authentication` sur iOS + Firebase Auth JS SDK
- **Backend** : Valide le token Firebase et retourne un JWT social
- **DB** : Table `social_users` stocke le profil et l'état d'onboarding
