# MyToolsApp — Documentation Technique & Fonctionnelle

## Présentation générale

Application mobile **Expo React Native** dédiée aux administrateurs des garages partenaires MyTools Group. Elle permet la gestion complète des devis, factures, réservations, clients et utilisateurs via une interface professionnelle en français.

- **Nom** : MyToolsApp | **Slug** : mytoolsapp | **Scheme** : mytools
- **Bundle ID** : `app.mytoolsmobile.mytoolsgroup.eu`
- **EAS Project** : `2429ee3a-9dd5-4767-9532-175f1db29ff3`
- **Apple Team** : `GP593F562X`
- **Version SDK** : Expo SDK 54 / React 19 / TypeScript

---

## Préférences utilisateur

- Langue : **Français** (interface entièrement en français)
- Thème : professionnel automobile — fond noir `#0A0A0A`, rouge `#DC2626`, blanc
- Fonts : **Inter** (UI), **Michroma** (titres/logo)
- Logo : `cropped-Logo-2-1-768x543` intégré dans l'app

---

## Architecture générale

### Frontend

- **Expo Router** (file-based routing) avec trois groupes : `(auth)`, `(main)` (client), `(admin)` (administrateur)
- **TanStack Query** pour le cache et la synchronisation des données serveur
- **React Context** (`lib/auth-context.tsx`) pour l'état d'authentification global
- **Drizzle ORM** pour la définition du schéma de la base de données locale

### Backend (proxy Express)

Le serveur local (`server/`) agit comme un **proxy intelligent** entre l'app et l'API externe de production. Il enrichit également les réponses avec des données stockées en local (items de devis/factures).

```
App mobile
   │
   ├── Web (navigateur) → proxy local (port 5000) → API externe
   └── Native (iOS/Android) → API externe directement
                             backend-saas.mytoolsgroup.eu
```

> **Important** : Sur mobile natif, les appels API passent directement par `backend-saas.mytoolsgroup.eu`, sans passer par le proxy local. Les enrichissements locaux (items) ne s'appliquent donc qu'en Web.

### Base de données locale (PostgreSQL)

Table principale : `document_amounts` — stocke les lignes (items) et montants des devis/factures créés via l'app. Cette table est la **source de vérité** pour les items, car le backend externe ne les persiste pas toujours de manière fiable.

---

## Navigation

### Interface Client `(main)/(tabs)`

| Tab | Description |
|-----|-------------|
| Accueil | Récapitulatif d'activité |
| Devis | Consultation et acceptation des devis |
| Factures | Accès aux documents de facturation |
| RDV | Réservations et rendez-vous |
| Messages | Chat avec l'administrateur |
| Profil | Paramètres du compte |

### Interface Admin `(admin)/(tabs)`

| Tab | Description |
|-----|-------------|
| Accueil | Tableau de bord KPIs + graphiques |
| Devis | Gestion CRUD des devis |
| Factures | Gestion CRUD des factures |
| + (Create) | Bouton central — création rapide |
| Plus | Menu fonctionnalités (RDV, Analytics, Utilisateurs, Logs) |
| Clients | Gestion de la base clients |
| Réglages | Paramètres de l'application |

---

## Authentification

### Email / Mot de passe

- Login : `POST /api/mobile/auth/login` → retourne `{accessToken, refreshToken, user}`
- Rafraîchissement : `POST /api/mobile/auth/refresh` avec `{refreshToken}`
- Réinitialisation : envoi d'un email de reset (pas de saisie de token dans l'app)

### Authentification sociale (Google / Apple)

- **Google** : Firebase `signInWithPopup` (web) ou `expo-auth-session` (natif)
- **Apple** : `expo-apple-authentication` avec nonce via `expo-crypto`
- Le token Firebase ID est envoyé à `POST /api/auth/social` (proxy local) qui transmet à `POST /api/mobile/auth/login-with-firebase` (API externe)

**Résultats possibles :**
- `200` → utilisateur existant → `{accessToken, refreshToken, user}` → navigation admin/main
- `404` → utilisateur inconnu → redirection vers `/(auth)/register` avec `email`, `displayName`, `firebaseUid`, `idToken` en paramètres

### Inscription (multi-étapes)

1. **Recherche SIRET** : saisie du SIRET (14 chiffres, lookup automatique) ou du nom de société → `GET /api/mobile/public/siret-lookup`
2. **Formulaire** : informations entreprise pré-remplies depuis le SIRET + informations personnelles. Mot de passe uniquement pour l'inscription email (pas Google)
3. **Soumission** : `POST /api/mobile/auth/register` avec tous les champs à la racine (`siret`, `companyName`, `address`, etc.)
4. **Après inscription Google** : auto-login via `POST /api/mobile/auth/login-with-firebase`

### Tokens et stockage

- **Admin** : Bearer tokens stockés dans `SecureStore`
- **Client** : Sessions cookie stockées dans `SecureStore`
- **GDPR consent** : stocké dans `AsyncStorage`
- **Biométrie** : `expo-local-authentication` (Face ID / Touch ID)

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `lib/firebase.ts` | Initialisation Firebase App + Auth |
| `lib/auth-context.tsx` | Context auth — `socialLogin()` retourne une union discriminée |
| `components/SocialLoginButtons.tsx` | UI boutons Google / Apple |
| `server/social-auth.ts` | Route `POST /api/auth/social` — proxie vers l'API externe |
| `app/(auth)/register.tsx` | Inscription multi-étapes |

### Variables d'environnement requises

**Frontend (préfixe `EXPO_PUBLIC_`) :**
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

**Backend (secrets Replit) :**
```
FIREBASE_SERVICE_ACCOUNT_KEY   ← variable principale (JSON du compte de service Firebase Admin)
FIREBASE_SERVICE_ACCOUNT_JSON  ← alias secondaire, synchronisé automatiquement au démarrage
EXTERNAL_API_URL               ← URL de l'API externe (défaut: https://backend-saas.mytoolsgroup.eu/api)
```

> `parse-dev-secrets.js` est exécuté au démarrage du serveur. Il synchronise `FIREBASE_SERVICE_ACCOUNT_KEY` et `FIREBASE_SERVICE_ACCOUNT_JSON` dans les deux sens si l'un est absent.

**OAuth Client IDs :**
```
iOS     : 129808585113-q81uhog8n2eivfpgg924tdfrh3s3ifau.apps.googleusercontent.com
Android : ...fs2ovorj3vl39...apps.googleusercontent.com
Web     : ...atcn4gnb3jund8ttee1nubc1gr3kt2ln.apps.googleusercontent.com
```

---

## Devis et Factures

### Architecture de persistance des items

Les items (lignes de devis/facture) suivent ce chemin :

1. **Création** : POST avec les items dans le corps → sauvegarde dans `document_amounts` (DB locale) ET transmission à l'API externe
2. **PATCH immédiat** : après le POST, un PATCH est immédiatement envoyé avec les items pour garantir la persistance
3. **Récupération (GET)** : la réponse de l'API externe est enrichie avec les items de `document_amounts` si disponibles
4. **PATCH sans items** : les mises à jour de statut (sans items dans le corps) ne **jamais** écrasent les items existants

> **Bug corrigé** : Avant, tout PATCH sans items (ex. changement de statut) écrasait les items en base locale avec `[]`. Désormais, le serveur utilise deux requêtes SQL distinctes selon la présence ou non d'items dans le corps de la requête.

### Filtrage des items vides

L'API externe crée systématiquement une ligne vide (`description=""`, `price=0`) lors de la première sauvegarde d'un document. Les formulaires d'édition (`quote-create.tsx`, `invoice-create.tsx`) filtrent ces lignes vides avant de peupler l'état du formulaire.

### Statuts des devis

`pending` → `sent` → `approved` → `accepted`

### Génération de facture depuis un devis

Bouton "Générer facture" dans le détail d'un devis → création d'une facture liée.

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `app/(admin)/quote-create.tsx` | Création et édition de devis |
| `app/(admin)/invoice-create.tsx` | Création et édition de factures |
| `app/(admin)/quote-detail.tsx` | Détail d'un devis |
| `app/(admin)/invoice-detail.tsx` | Détail d'une facture |
| `server/routes.ts` | Proxy + enrichissement local + logique PATCH items |
| `lib/admin-api.ts` | Wrappers d'appel API admin |

---

## PDF

Fonction `viewPdf()` dans `lib/pdf-download.ts`.

| Cas | Comportement |
|-----|-------------|
| Avec `viewToken` (privilégié) | URL publique `saas.mytoolsgroup.eu/api/public/pdf/{type}/{id}?token=xxx` — aucune auth requise. Web : nouvel onglet. Natif : `expo-web-browser` |
| Sans `viewToken` (fallback) | Web : fetch via proxy avec Bearer+Cookie → blob → `window.open`. Natif : `FileSystem.downloadAsync` → `Sharing.shareAsync` |

---

## Tableau de bord admin

- Endpoint principal : `GET /api/admin/dashboard`
- Si l'endpoint retourne des données vides ou partielles, les KPIs sont calculés localement à partir des réponses individuelles (devis, factures, clients, réservations)
- Graphique mensuel recalculé côté client si absent de la réponse

---

## Réservations

- Écran : `app/(admin)/reservation-create.tsx`
- Support multi-services : `selectedServiceIds: string[]`
- Payload : `serviceId` (premier élément, rétrocompatibilité) + `serviceIds` (tableau complet)

---

## Gestion des utilisateurs

- Écran : `app/(admin)/users.tsx` — accessible uniquement aux rôles `super_admin` et `root_admin`
- Hiérarchie des rôles :
  - `root_admin` : accès total, peut créer des `super_admin`
  - `super_admin` : peut gérer `admin` et `employe`, ne peut pas créer de `super_admin`
- Codes couleur des rôles : Root Admin=rouge, Super Admin=violet, Admin=bleu, Employé=vert

---

## Logs système

- Écran : `app/(admin)/admin-logs.tsx` — `root_admin` uniquement
- `GET /api/admin/logs` avec paramètres `?level=`, `?search=`, `?limit=`, `?offset=`
- Export : `GET /api/admin/logs/export?format=json|csv`
- Purge : `DELETE /api/admin/logs`
- Buffer : 2 000 entrées en mémoire, ordre chronologique inversé
- Auto-refresh : 5s / 10s / 30s (configurable)

---

## Upload de photos

- Devis et factures : processus en deux étapes
  1. Création du document (POST)
  2. Upload des médias via `POST /api/admin/quotes/{id}/media` ou `POST /api/admin/invoices/{id}/media`
- Les photos sont affichées dans les écrans de détail

---

## Fonctionnalités IA

- Chat IA : Google Gemini via l'intégration Replit (`server/replit_integrations/chat`)
- Analytics IA : `GET /api/admin/advanced-analytics` (global, commercial, croissance)
- Accès conditionnel selon le plan du garage (Pro+)
- Détection du plan via `getGaragePlan()` dans `lib/admin-api.ts` → `GET /api/auth/me`

---

## Notifications push

- Intégrées via `lib/push-notifications.ts`
- Polling de secours si les notifications push échouent

---

## Configuration dynamique de l'API

Le backend peut mettre à jour dynamiquement l'URL de l'API externe via :
- `GET https://backend-saas.mytoolsgroup.eu/api/public/mobile-api-url` (remote config)
- Cache TTL : 30 secondes
- Sécurité : seules les URLs pointant vers `backend-saas.mytoolsgroup.eu` sont acceptées

---

## Compatibilité des packages Expo

Tous les packages Expo doivent être compatibles avec **SDK 54**. Commandes de vérification :

```bash
npx expo install --check      # vérifier les incompatibilités
npx expo install --fix        # corriger automatiquement
```

Packages critiques (versions SDK 54) :
- `expo-apple-authentication` → `~8.0.8`
- `expo-auth-session` → `~7.0.10`
- `expo-clipboard` → `~8.0.8`

---

## Build et déploiement

### Web (Replit)

```bash
node scripts/build.js    # build Expo web statique
npm run server:dev       # démarrer le serveur backend
```

### iOS (TestFlight / App Store)

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

> Un nouveau build EAS est **obligatoire** pour que les correctifs de l'authentification native (Google/Apple) soient actifs sur TestFlight.

### Android (APK)

```bash
bash scripts/build-android.sh
```

### Firebase Admin SDK

Le SDK Firebase Admin est initialisé au premier appel de vérification de token. Il lit `FIREBASE_SERVICE_ACCOUNT_KEY` (principal) ou `FIREBASE_SERVICE_ACCOUNT_JSON` (alias). Les deux sont synchronisés au démarrage par `parse-dev-secrets.js`.

---

## Dépendances externes

| Service | Usage |
|---------|-------|
| `backend-saas.mytoolsgroup.eu` | API de production — toutes les données métier |
| Firebase (projet `crud-ae9d9`) | Authentification sociale Google / Apple |
| `saas.mytoolsgroup.eu` | URLs publiques pour les PDFs |
| PostgreSQL (Replit) | Persistance locale des items et logs |
| Gemini AI | Analytics et chat IA |
| Resend | Emails transactionnels |
| Cloudflare R2 | Stockage objets (médias) |

---

## Fichiers de configuration clés

| Fichier | Rôle |
|---------|------|
| `eas.json` | Profils de build EAS (development, preview, production) |
| `app.json` | Configuration Expo (bundle ID, permissions, plugins) |
| `parse-dev-secrets.js` | Synchronisation des secrets au démarrage |
| `server/index.ts` | Point d'entrée du serveur Express |
| `server/routes.ts` | Toutes les routes proxy + logique d'enrichissement |
| `server/social-auth.ts` | Vérification Firebase + proxy login social |
| `lib/auth-context.tsx` | Contexte d'authentification global |
| `lib/admin-api.ts` | Wrappers API admin (avec retry et fallback) |
| `lib/api.ts` | Wrappers API client |
| `lib/firebase.ts` | Initialisation Firebase |
| `lib/pdf-download.ts` | Logique de visualisation PDF |
| `lib/theme.tsx` | Système de thème (couleurs, fonts, spacing) |
