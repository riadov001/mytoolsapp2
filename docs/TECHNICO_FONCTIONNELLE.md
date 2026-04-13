# MyTools Mobile — Documentation Technico-Fonctionnelle

**Version** : 2.0.1  
**Date** : 25/03/2026  
**Bundle ID** : `app.mytoolsmobile.mytoolsgroup.eu`  
**Expo SDK** : 54 | **React Native** : 0.76.x  
**Backend externe** : `https://saas2.mytoolsgroup.eu/api`  
**Serveur proxy** : Express (port 5000)  
**Frontend** : Expo Router (port 8081)

---

## 1. Architecture mobile complète

```
┌─────────────────────────────────────────────────────────┐
│                    EXPO GO / Build natif                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  app/_layout.tsx (Root)                            │  │
│  │  ├─ ErrorBoundary                                 │  │
│  │  ├─ QueryClientProvider (@tanstack/react-query)   │  │
│  │  ├─ GestureHandlerRootView (try/catch)            │  │
│  │  ├─ KeyboardProvider (try/catch)                  │  │
│  │  ├─ ThemeProvider (light/dark)                    │  │
│  │  └─ AuthProvider (token + session)                │  │
│  │      ├─ app/index.tsx → redirection               │  │
│  │      ├─ app/(auth)/ → login, register             │  │
│  │      ├─ app/(admin)/ → interface admin/employé    │  │
│  │      └─ app/(main)/ → interface client            │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│              fetch() via lib/api.ts                      │
│              fetch() via lib/admin-api.ts                │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS
              ┌────────────▼────────────┐
              │  Serveur Express (5000) │
              │  server/routes.ts       │
              │  ├─ Proxy /api/* → API  │
              │  ├─ Auth social/Firebase│
              │  ├─ OCR Gemini AI       │
              │  └─ PostgreSQL local    │
              └────────────┼────────────┘
                           │ HTTPS
              ┌────────────▼────────────┐
              │  saas2.mytoolsgroup.eu  │
              │  API REST backend       │
              │  (MongoDB, auth, CRUD)  │
              └─────────────────────────┘
```

### Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime mobile | Expo SDK | 54 |
| Framework | React Native | 0.76.x |
| Routage | expo-router (file-based) | 4.x |
| State serveur | @tanstack/react-query | 5.x |
| Auth côté client | expo-secure-store + AsyncStorage | — |
| Auth Firebase | firebase/auth (client) + firebase-admin (serveur) | — |
| Polices | @expo-google-fonts/inter, michroma | npm |
| Icônes | @expo/vector-icons (Ionicons, Feather) | — |
| Serveur | Express + TypeScript (tsx) | — |
| BDD locale | PostgreSQL (Replit) | — |
| IA/OCR | Gemini 2.5 Flash | — |

---

## 2. Flux de démarrage détaillé

```
1. Module _layout.tsx chargé
   ├─ [STARTUP] DEV_SECRETS_KEYS parsing (web only)
   ├─ [STARTUP] GestureHandlerRootView → require() try/catch
   ├─ [STARTUP] KeyboardProvider → require() try/catch
   ├─ [STARTUP] Fonts (Inter + Michroma) → require() try/catch
   ├─ [STARTUP] SplashScreen.preventAutoHideAsync() → try/catch
   └─ [STARTUP] Module-level init complete

2. RootLayout() monté
   ├─ useFonts() → charge les polices Google Fonts
   ├─ useEffect[] → log "RootLayout mounted"
   ├─ useEffect[fontsLoaded, fontError] → 200ms → setAppReady(true)
   ├─ useEffect[] fallback → 2500ms → force setAppReady(true)
   └─ SplashScreen.hideAsync()

3. AuthProvider monté (lib/auth-context.tsx)
   ├─ checkAuth() → lit tokens depuis SecureStore/AsyncStorage
   ├─ Si token présent → adminGetMe() ou authApi.getUser()
   ├─ Si valide → setUser(userData)
   └─ Si invalide → nettoyage tokens, isLoading=false

4. IndexScreen (app/index.tsx)
   ├─ Vérifie consent_given (AsyncStorage)
   ├─ Si !consent → router.replace("/consent")
   ├─ Si authenticated + admin → router.replace("/(admin)")
   ├─ Si authenticated + client → router.replace("/(main)")
   └─ Si !authenticated → router.replace("/(auth)/login")
```

### Protection contre le blocage splash

| Mécanisme | Délai | Détail |
|-----------|-------|--------|
| Résolution polices | ~200ms après chargement | SplashScreen.hideAsync() |
| Fallback timeout | 2500ms | Force appReady même si polices échouent |
| try/catch preventAutoHideAsync | immédiat | Évite crash si l'API splash n'est pas disponible |
| Font modules en require() | immédiat | Fallback si npm packages absents |

---

## 3. Endpoints API

### 3.1 Authentification

| Méthode | Route proxy | Route API externe | Payload | Retour | Description |
|---------|------------|-------------------|---------|--------|-------------|
| POST | /api/login | /mobile/auth/login | `{email, password}` | `{accessToken, refreshToken, user}` | Connexion email/mot de passe |
| POST | /api/register | /mobile/auth/register | `{firstName, lastName, email, password, phone}` | `{message, userId}` | Inscription client |
| POST | /api/auth/social | Firebase Admin SDK | `{token, provider}` | `{accessToken, user}` ou `{needsRegistration}` | Auth Google/Apple |
| POST | /api/logout | /mobile/auth/logout | — | `{message}` | Déconnexion |
| GET | /api/auth/user | /mobile/profile puis /mobile/auth/me | — | `{id, email, role, ...}` | Profil utilisateur |
| PUT | /api/auth/user | PATCH /mobile/profile | `{firstName, lastName, phone}` | User mis à jour | Mise à jour profil |
| POST | /api/auth/change-password | PATCH /user/password | `{currentPassword, newPassword}` | `{message}` | Changement mot de passe |
| DELETE | /api/users/me | DELETE /mobile/profile + /admin/users/:id | — | `{message}` | Suppression compte |

### 3.2 Devis (Quotes)

| Méthode | Route proxy | Route API externe | Payload | Retour | Description |
|---------|------------|-------------------|---------|--------|-------------|
| GET | /api/quotes | /mobile/quotes | — | `[{id, clientName, status, items, ...}]` | Liste des devis |
| GET | /api/quotes/:id | /mobile/quotes/:id | — | `{id, clientName, items, status}` | Détail d'un devis |
| POST | /api/quotes/:id/accept | /mobile/quotes/:id/accept | — | `{message}` | Accepter un devis |
| POST | /api/quotes/:id/reject | /mobile/quotes/:id/reject | — | `{message}` | Refuser un devis |
| POST | /api/quotes/:id/create-reservation | /mobile/quotes/:id/create-reservation | `{date, time, ...}` | `{reservation}` | Créer RDV depuis devis |

### 3.3 Factures (Invoices)

| Méthode | Route proxy | Route API externe | Payload | Retour | Description |
|---------|------------|-------------------|---------|--------|-------------|
| GET | /api/invoices | /mobile/invoices | — | `[{id, clientName, total, status}]` | Liste des factures |
| GET | /api/invoices/:id | /mobile/invoices/:id | — | `{id, items, total, paidAt}` | Détail facture |

### 3.4 Réservations

| Méthode | Route proxy | Route API externe | Payload | Retour | Description |
|---------|------------|-------------------|---------|--------|-------------|
| GET | /api/reservations | /mobile/reservations | — | `[{id, date, time, status}]` | Liste réservations |
| GET | /api/reservations/:id | /mobile/reservations/:id | — | `{id, date, service, vehicle}` | Détail réservation |

### 3.5 Services

| Méthode | Route proxy | Route API externe | Payload | Retour | Description |
|---------|------------|-------------------|---------|--------|-------------|
| GET | /api/services | /mobile/services | — | `[{id, name, price, duration}]` | Liste services garage |

### 3.6 Notifications

| Méthode | Route proxy | Route API externe | Payload | Retour | Description |
|---------|------------|-------------------|---------|--------|-------------|
| GET | /api/notifications | /mobile/notifications | — | `[{id, title, message, type, isRead}]` | Liste notifications |
| PATCH | /api/notifications/:id/read | /mobile/notifications/:id/read | — | `{message}` | Marquer lue |
| POST | /api/notifications/mark-all-read | /mobile/notifications/mark-all-read | — | `{message}` | Tout marquer lu |

### 3.7 Admin — Proxy catch-all

Toutes les routes `/api/admin/*` sont proxifiées automatiquement vers :
1. `/mobile/admin/*` (prioritaire, spec API)
2. `/admin/*` (fallback legacy)

| Route admin | Description |
|-------------|-------------|
| GET /api/admin/dashboard | Tableau de bord analytics |
| GET /api/admin/quotes | Liste devis (admin) |
| POST /api/admin/quotes | Créer devis |
| PATCH /api/admin/quotes/:id | Modifier devis |
| PATCH /api/admin/quotes/:id/status | Changer statut |
| POST /api/admin/quotes/:id/convert-to-invoice | Convertir en facture |
| GET /api/admin/invoices | Liste factures (admin) |
| POST /api/admin/invoices | Créer facture |
| GET /api/admin/reservations | Liste RDV (admin) |
| PATCH /api/admin/reservations/:id | Modifier RDV |
| GET /api/admin/clients | Liste clients |
| GET /api/admin/services | Liste services |

### 3.8 OCR / IA

| Méthode | Route | Payload | Retour | Description |
|---------|-------|---------|--------|-------------|
| POST | /api/ocr/analyze | `{imageBase64, mimeType, mode}` | `{items, clientName, ...}` | Extraction OCR via Gemini |

---

## 4. Gestion des erreurs et fallbacks

### Startup

| Composant | Erreur possible | Fallback |
|-----------|----------------|----------|
| `expo/fetch` | Module non disponible | `globalThis.fetch` |
| `react-native-gesture-handler` | Module non lié | `View` comme wrapper |
| `react-native-keyboard-controller` | Module non lié | Passthrough `<>{children}</>` |
| Google Fonts (Inter, Michroma) | Réseau indisponible | Polices système après 2.5s |
| `SplashScreen.preventAutoHideAsync` | API indisponible | try/catch silencieux |
| `expo-local-authentication` | Pas sur appareil | Chargement conditionnel Platform.OS |
| `expo-notifications` | Module absent | `try { require() } catch {}` |

### Runtime

| Erreur | Gestion |
|--------|---------|
| Crash React | `ErrorBoundary` → écran "Something went wrong" + bouton restart |
| Token expiré | `setOnTokenExpired()` → nettoyage tokens → redirection login |
| API 401 | Nettoyage session + redirection login |
| API 502 | Message "Erreur de connexion" |
| HTML retourné par API | Détection `<!DOCTYPE` → réponse JSON d'erreur |
| Proxy fallback | Essai `/mobile/*` → fallback route legacy |

### Proxy intelligent (server/routes.ts)

Pour chaque route, le proxy applique cette stratégie :
1. Essayer d'abord l'endpoint `/mobile/` (conforme à la spec API)
2. Si réponse HTML ou erreur → fallback vers l'endpoint legacy
3. Si les deux échouent → retourner erreur JSON structurée

---

## 5. Variables d'environnement

### Secrets (requis)

| Variable | Usage | Statut |
|----------|-------|--------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Client Firebase Auth | Configuré |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Client Firebase Auth | Configuré |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client Firebase Auth | Configuré |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Client Firebase Auth | Configuré |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client Firebase Storage | Configuré |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Serveur — vérification tokens | Configuré |
| `GOOGLE_API_KEY` | Google APIs | Configuré |
| `RESEND_API_KEY` | Envoi emails transactionnels | Configuré |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | OCR Gemini AI | Configuré |
| `DATABASE_URL` | PostgreSQL local | Auto (Replit) |
| `SESSION_SECRET` | Sessions Express | Configuré |

### Env vars (workflow)

| Variable | Valeur | Usage |
|----------|--------|-------|
| `EXPO_PACKAGER_PROXY_URL` | `https://$REPLIT_DEV_DOMAIN` | Proxy Metro pour Expo Go |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | `$REPLIT_DEV_DOMAIN` | Hostname Metro |
| `EXPO_PUBLIC_DOMAIN` | `$REPLIT_DEV_DOMAIN:5000` | URL API côté client |
| `PORT` | 8081 | Port Metro/frontend |

---

## 6. Checklist pour audit

### Sécurité

- [x] Tokens stockés dans SecureStore (natif) / AsyncStorage (web)
- [x] Pas de secrets hardcodés côté client
- [x] Firebase Admin SDK pour vérification tokens côté serveur
- [x] Session cookie httpOnly pour l'auth classique
- [x] Suppression de compte (RGPD) avec enregistrement en BDD locale
- [x] Écran de consentement RGPD au premier lancement
- [x] Politique de confidentialité accessible (route /privacy)

### Stabilité

- [x] ErrorBoundary global avec bouton restart
- [x] Tous les imports critiques protégés par try/catch
- [x] Fallback 2.5s pour le splash screen
- [x] `expo/fetch` protégé dans 4 fichiers (query-client, api, admin-api, OCRScanner)
- [x] Proxy avec double fallback (mobile → legacy)
- [x] Détection HTML dans les réponses API
- [x] Logs [STARTUP] à chaque étape du démarrage

### Fonctionnel

- [x] Login email/mot de passe
- [x] Login social (Google, Apple via Firebase)
- [x] Biométrie (Face ID / Touch ID)
- [x] Deux interfaces : admin/(tabs) et main/(tabs)
- [x] CRUD complet devis/factures/réservations (admin)
- [x] Consultation devis/factures/RDV (client)
- [x] OCR pour extraction automatique de documents
- [x] Notifications push (polling 15s)
- [x] Téléchargement PDF
- [x] Thème clair/sombre automatique

### Build & Deploy

- [x] app.json configuré (bundleIdentifier, plugins, EAS)
- [x] google-services.json présent pour Android
- [x] eas.json avec profils development/preview/production
- [x] Workflow Start Backend (port 5000)
- [x] Workflow Start Frontend (port 8081, CI=1)

### Problèmes connus

| Problème | Impact | Statut |
|----------|--------|--------|
| Toutes les images assets identiques (même hash) | Cosmétique — pas de crash | À améliorer |
| Pas de dossier assets/fonts/ | Normal — polices via npm | OK |
| EAS Apple submit : appleId/ascAppId placeholder | Bloque le submit App Store | À configurer |
| `newArchEnabled: false` dans app.json | Désactive la New Architecture | Intentionnel (compatibilité) |

---

## 7. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `app/_layout.tsx` | Root layout, providers, splash screen |
| `app/index.tsx` | Écran de redirection (consent → auth → admin/main) |
| `lib/auth-context.tsx` | AuthProvider, login/logout/register/socialLogin |
| `lib/api.ts` | Appels API client (cookie session) |
| `lib/admin-api.ts` | Appels API admin (Bearer token) |
| `lib/query-client.ts` | QueryClient + getApiUrl() + apiRequest() |
| `lib/firebase.ts` | Init Firebase client-side |
| `lib/theme.tsx` | ThemeProvider (light/dark) |
| `lib/push-notifications.ts` | Notifications push + polling |
| `server/routes.ts` | Proxy Express — toutes les routes API |
| `server/social-auth.ts` | Auth Firebase Admin (vérification tokens) |
| `server/index.ts` | Point d'entrée serveur |
| `constants/theme.ts` | Thèmes LightTheme / DarkTheme |
| `components/ErrorBoundary.tsx` | Error boundary React |
| `components/ErrorFallback.tsx` | UI de fallback erreur |
