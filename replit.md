# MyTools Admin - Application Mobile

## Overview
Application mobile Expo React Native **exclusivement réservée aux administrateurs de garages partenaires** MyTools. L'app permet la gestion complète des devis, factures, réservations, clients et services via le back-office MyTools Group. Les comptes admin sont créés uniquement par le service client.

## Architecture
- **Frontend**: Expo React Native (Expo Router, file-based routing)
- **Backend**: API externe hébergée sur `apps.mytoolsgroup.eu`
- **Auth**: Dual auth — Bearer token (admin `/api/mobile/*`) + cookie sessions (client)
- **State**: React Query pour les données serveur, React Context pour l'auth
- **Admin API**: `lib/admin-api.ts` — Bearer token auth, auto-refresh, 401/403 handling

## Design
- **Futuristic iPhone-style**: iOS Settings-style grouped lists, Michroma font for titles, Inter for body
- **Primary color**: `#DC2626` (light) / `#EF4444` (dark)
- **Logo**: `assets/images/logo_new.png` (also used as app icon)
- **First launch**: GDPR consent screen (`app/consent.tsx`) shown once, saved in AsyncStorage `consent_given`

## API Backend
Base URL: Configurable via `EXTERNAL_API_URL` env var (default: `https://apps.mytoolsgroup.eu/api`)

### Endpoints saas` - Inscription (email, password, firstName, lastName, role, etc.)
- `POST /api/login` - Connexion (email, password) → retourne user + cookie session
- `POST /api/logout` - Déconnexion
- `GET /api/auth/user` - Profil utilisateur authentifié
- `GET /api/services` - Liste des services (auth requise)
- `GET /api/quotes` - Liste des devis de l'utilisateur (auth requise)
- `POST /api/quotes` - Créer une demande de devis
- `POST /api/support/contact` - Formulaire de contact
- `DELETE /api/users/me` - Suppression permanente du compte utilisateur

### Admin API Endpoints (Bearer token auth)
- `POST /api/mobile/auth/login` - Admin login → `{ accessToken, refreshToken, user }`
- `POST /api/mobile/auth/refresh` - Refresh token
- `GET /api/mobile/auth/me` - Current user profile
- `GET /api/mobile/admin/analytics` - Dashboard KPIs + revenue chart
- `GET/POST/PATCH/DELETE /api/mobile/admin/quotes` - Quotes CRUD
- `PATCH /api/mobile/admin/quotes/:id/status` - Quote status change
- `GET/POST/PATCH/DELETE /api/mobile/admin/invoices` - Invoices CRUD
- `GET/POST/PATCH/DELETE /api/mobile/admin/reservations` - Reservations CRUD
- `PATCH /api/mobile/admin/reservations/:id/status` - Reservation status change
- `GET/POST/PATCH/DELETE /api/mobile/admin/clients` - Clients CRUD
- `GET /api/admin/logs` - Server logs (circular buffer, 200 entries, optional `?since=` filter)

### Roles utilisateur
- `root_admin` / `root` - Root admin (all admin features + server logs)
- `admin` - Full access (admin interface, all CRUD + delete)
- `employe` - Admin interface, no delete permissions
- `client` - Particulier (client interface)
- `client_professionnel` - Professionnel (client interface)

## Suppression de compte
- Accessible depuis l'onglet Paramètres > "Supprimer mon compte" → ouvre une page de confirmation
- Écran `app/(admin)/delete-account.tsx` : 2 étapes de confirmation
- API endpoint: `DELETE /api/users/me`
- Après suppression: déconnexion et redirection vers la connexion
- **Aucun lien externe** dans l'app (politique des App Store/Play Store)

## Structure du projet
```
app/
  _layout.tsx           # Root layout (providers, fonts)
  index.tsx             # Redirect basé sur auth
  (auth)/               # Flux d'authentification
    _layout.tsx
    login.tsx           # Login (pas de bouton créer compte)
    register.tsx        # Remplacé par page légale/confidentialité
    forgot-password.tsx
  (main)/               # App principale (authentifié)
    _layout.tsx
    (tabs)/
      _layout.tsx       # Tab navigation
      index.tsx         # Accueil + liste services
      quotes.tsx        # Historique des devis
      invoices.tsx      # Historique des factures
      reservations.tsx  # Historique des réservations
      messages.tsx      # Conversations chat
      notifications.tsx # Centre de notifications
      profile.tsx       # Profil utilisateur (3 tabs: Infos, Sécurité, Notifications) + lien suppression compte
      more.tsx          # Menu: support, mentions légales, confidentialité
    new-quote.tsx       # Formulaire nouveau devis
    quote-detail.tsx    # Détail d'un devis
    invoice-detail.tsx  # Détail d'une facture
    reservation-detail.tsx # Détail d'une réservation (confirmer uniquement)
    chat-detail.tsx     # Conversation chat (texte uniquement)
    request-reservation.tsx # Demande de réservation
    support-history.tsx # Historique des demandes support
    delete-account.tsx  # Suppression permanente du compte (Apple 5.1.1(v))
  (admin)/              # Interface admin (admin/employe)
    _layout.tsx         # Stack admin (includes guide + support-history modals)
    (tabs)/
      _layout.tsx       # Tab navigation admin (6 tabs)
      index.tsx         # Dashboard KPIs + chart + activité récente
      quotes.tsx        # Liste devis avec recherche/filtres/CRUD
      invoices.tsx      # Liste factures avec recherche/filtres/CRUD
      reservations.tsx  # Liste RDV avec recherche/filtres/CRUD
      clients.tsx       # Liste clients avec recherche
      settings.tsx      # Paramètres: profil, notifications, support, légal, guide, déconnexion, suppression compte
    guide.tsx           # Guide admin: fonctionnalités en accordéon (dashboard, devis, factures, RDV, clients, support)
    support-history.tsx # Historique des demandes support (admin)
    quote-detail.tsx    # Détail devis (lecture seule, PDF)
    invoice-detail.tsx  # Détail facture (lecture seule, PDF)
    reservation-detail.tsx # Détail rendez-vous (lecture seule)
    logs.tsx            # Logs serveur en temps réel (root_admin/root uniquement)
    client-form.tsx     # Formulaire créer/modifier client
  support.tsx           # Formulaire de support
  legal.tsx             # Mentions légales
  privacy.tsx           # Politique de confidentialité
components/
  FloatingSupport.tsx   # Bouton flottant support
  ErrorBoundary.tsx     # Error boundary
  CustomAlert.tsx       # Alerte personnalisée glassmorphism
lib/
  api.ts                # Client API complet (cookie auth)
  admin-api.ts          # Admin API (Bearer token auth, CRUD helpers)
  auth-context.tsx      # Dual auth context (Bearer + cookie), role detection, biometry
  query-client.ts       # React Query config
constants/
  colors.ts             # Thème sombre (noir/rouge/blanc)
server/
  routes.ts             # Proxy API vers backend externe
  index.ts              # Express server (port 5000)
```

## User Preferences
- Language: Français
- Interface entièrement en français
- Design professionnel automobile (thème sombre: noir #0A0A0A, rouge #DC2626, blanc)
- Font: Inter (Google Fonts)
- Logo: cropped-Logo-2-1-768x543 intégré dans l'app

## Key Technical Notes
- No AI functionality in mobile app (Apple 5.1.1(v) compliance)
- Role-based routing: admin/employe → `(admin)`, client → `(main)`
- Admin interface: Dashboard with KPIs, CRUD for quotes/invoices/reservations/clients
- Admin auth: Bearer token stored in SecureStore (`access_token`, `refresh_token`)
- Client auth: Cookie-based sessions stored in SecureStore (`session_cookie`)
- Account deletion available via Profile → Paramètres → Supprimer mon compte
- Biometric auth auto-clears expired session credentials
- All domain references point to `saas2.mytoolsgroup.eu`
- Data auto-refreshes: quotes every 30s, invoices/reservations every 60s, notifications every 30s
- **Production mode enabled**: APP_REVIEW_MODE now requires explicit `APP_REVIEW_MODE=true` env var (no auto-activation in dev)

## OCR Scanner (Admin Only)
- Admin forms (invoice-create, quote-create) include an OCR banner "Scanner un document"
- OCR uses Gemini Vision via `/api/ocr/analyze` endpoint (POST)
- Accepts: `imageBase64`, `mimeType`, `mode` (invoice | quote)
- Extracts: client name/email, items (description, quantity, unitPrice, tvaRate), vehicle info (quotes), paymentMethod (invoices), notes
- Pre-fills form fields automatically; attempts client matching by name/email
- Component: `components/OCRScannerModal.tsx` (camera + gallery picker)

## Apple App Store Compliance (5.1.1(v))
- OCR scanner is admin-only (role-gated, not visible to end users)
- Admin interface is role-gated (only visible to admin/employe users)
- Account deletion implemented: DELETE /api/users/me
- No third-party AI data sharing from mobile app

## App Store Compliance Notes
- Profile screen is READ-ONLY (no editing, no password change) — redirects to web portal
- No payment functionality in the app — invoices are read-only consultation only
- Delete account page fully translated to French
- Privacy policy: no Stripe/payment mention
- Legal page: section about read-only features and web portal for modifications
- Onboarding screen accessible from More > Guide de l'application

## API Response Handling
- API responses are auto-unwrapped: `unwrapList()` and `unwrapSingle()` in `lib/api.ts` handle wrapped responses (`{ data: [...] }`, `{ results: [...] }`, etc.)
- Invoice/quote amounts use extensive field name fallbacks (camelCase + snake_case): `totalHT`, `total_ht`, `totalTTC`, `total_ttc`, `tvaAmount`, `tva_amount`, etc.
- PDF token detection checks 7 field names + direct URL fallback
- Invoice line items check 10 field name variants
- Quote accept/reject: dedicated server routes try 4 external endpoints, then store locally in DB
- Reservation confirm: dedicated server route tries 3 external endpoints, then stores locally in DB
- Support tickets: stored locally in DB when submitted, retrieved by user email
- GET /api/quotes and /api/reservations merge local status overrides into external API data (scoped by user cookie)
- Proxy catch-all returns 404 for HTML/SPA fallback responses (no more false success)

## Quote Status Flow
- `pending` → `sent` → `approved` (admin approved) → `accepted` (client accepted)
- `canRespond` shows Accept/Reject buttons for any non-final, non-pending status
- Final statuses (no accept/reject): accepted, rejected, completed, cancelled (+ French equivalents)
- `isAccepted` shows "Demander une réservation" for: `accepted`, `accepté`, `confirmed`, `confirmé`

## Removed Features (non-functional buttons cleaned up)
- Chat: image/photo attach button removed (text-only messaging)
- Chat: uploadApi and sendMessageWithImage removed from lib/api.ts
- Reservation detail: "Modifier" and "Annuler" buttons removed
- Reservation detail: "Refuser" button removed (only "Confirmer" remains for pending client action)

## App Review Mode
- **Environment variable**: `APP_REVIEW_MODE=true` enables the reviewer demo account bypass (auto-enabled in development)
- **Demo credentials**: `review@mytools.eu` / `000000` (admin role)
- All admin CRUD endpoints return synthetic data when using the reviewer token
- Disable by removing or setting `APP_REVIEW_MODE=false` in production after review
- See `APP_REVIEW_NOTES.md` for full reviewer instructions

## Network Resilience
- `lib/api.ts` and `lib/admin-api.ts` use 15s `AbortController` timeout + 1 retry on network errors
- User-friendly French error messages on timeout/unavailability

## Build & Distribution (EAS)

### Configuration
- **EAS Project ID**: `45e48f45-e421-4f67-9d02-d84a678fdfc5` (owner: `lastmytools`)
- **Bundle ID**: `com.mytools.app` (iOS + Android)
- **Profiles**: `development` (APK interne), `preview` (APK + simulateur iOS), `production` (AAB + App Store)

### Commandes manuelles
```bash
# Build iOS uniquement
eas build --platform ios --profile production

# Build Android uniquement
eas build --platform android --profile production

# Build les deux plateformes
eas build --platform all --profile production

# Soumettre iOS à l'App Store
eas submit --platform ios --profile production

# Soumettre Android au Google Play Store
eas submit --platform android --profile production
```

### Workflow CI automatisé
Le fichier `.eas/workflows/build-and-submit.yml` déclenche automatiquement (push sur `main`) :
1. Build iOS + Build Android en parallèle
2. Submit iOS (App Store) + Submit Android (Google Play) après les builds

### Prérequis avant le premier build Android
1. **google-services.json** : Remplacer le fichier placeholder à la racine par le vrai fichier téléchargé depuis la Firebase Console (Project Settings > General > Your apps > Android app `com.mytools.app`).
2. **EAS Secret GOOGLE_SERVICE_ACCOUNT_KEY** (obligatoire pour `eas submit` Android) :
   - Créer un service account dans Google Cloud Console avec le rôle "Service Account User" et l'API Google Play Android Developer activée.
   - Télécharger la clé JSON du service account.
   - Enregistrer la clé comme secret EAS de type **file** :
     ```
     eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY --type file --value ./chemin/vers/cle.json
     ```
   - `eas.json` référence automatiquement ce secret via `"serviceAccountKeyPath": "$GOOGLE_SERVICE_ACCOUNT_KEY"`. Ne jamais committer la clé dans le dépôt.
   - **Champ optionnel** `applicationId` dans `eas.json > submit.production.android` : déjà défini à `com.mytools.app` (doit correspondre au `package` dans `app.json`). Modifier si le bundle ID change.
3. **Keystore Android** : Géré automatiquement par EAS Build (première build génère et stocke la clé). Pour utiliser une clé existante, configurer via `eas credentials`.

### Prérequis avant le premier build iOS
1. Remplacer les placeholders dans `eas.json` > `submit.production.ios` : `appleId`, `ascAppId`, `appleTeamId`
2. Certificats et provisioning profiles gérés automatiquement par EAS

## Recent Changes
- Feb 2026: Initial build of MyJantes mobile app
- Feb 2026: Thème sombre complet (noir/rouge/blanc)
- Feb 2026: Push notifications, biometric auth
- Feb 25 2026: Apple 5.1.1(v) compliance: removed all AI features, admin screens, role-based UI; added permanent account deletion
- Mar 2026: Profile editing disabled, password change removed — web portal redirect message added
- Mar 2026: Removed adminPaymentsApi and paymentLink from api.ts
- Mar 2026: Privacy policy updated (removed Stripe section 8)
- Mar 2026: Legal page updated with section 6 about app functionality (no payments, read-only)
- Mar 2026: delete-account.tsx fully translated to French
- Mar 2026: Onboarding screen created with 5 slides explaining app features
- Mar 2026: "Guide de l'application" link added to More menu
- Mar 3 2026: API response unwrapping (unwrapList/unwrapSingle) to handle wrapped API responses
- Mar 3 2026: Quote accept/reject with multi-endpoint fallbacks
- Mar 3 2026: Invoice/quote amount field name fallbacks (camelCase + snake_case)
- Mar 3 2026: Server proxy debug logging to /tmp/api_debug_*.json
- Mar 4 2026: Backend URL switched to saas2.mytoolsgroup.eu
- Mar 4 2026: Removed all non-functional buttons (image attach, Modifier, Annuler, Refuser)
- Mar 4 2026: Removed uploadApi and sendMessageWithImage from lib/api.ts
- Mar 4 2026: Auto-refresh polling added (quotes 30s, invoices/reservations 60s)
- Mar 4 2026: PDF token detection expanded (7 field names + direct URL fallback)
- Mar 4 2026: Invoice line items check 10 field name variants
- Mar 4 2026: canRespond logic simplified (any non-final, non-pending status)
- Mar 13 2026: Admin UX improvements — bell notification icon on dashboard, notifications screen, FilterChip with count badge support, KPI filter navigation, quote reference in reservations, FloatingSupport on all admin screens, tab layout simplified (no badge polling)
- Mar 11 2026: Marketing site redesign (Next.js `/marketing-site`)
  - Hero: Reduced font size (text-3xl/sm:text-4xl/md:text-5xl), centered, removed store badges
  - Screenshots: JSX mockups of 5 screens (Login, Dashboard, Reservations, Services, Devis) with MyTools logo visible in each
  - Footer: Ultra-compact single line with official MyTools logo, copyright, and essential links (Privacy, Support, PWA Live)
- Mar 19 2026: **Version 2.0.0 Released**
  - **Published to Apple App Store**
  - Android APK v2.0.0 built on EAS (account: mytoolslast, project: mytoolsapp)
  - **Invoice creation simplified**: Removed FAB "Ajouter facture" button and dedicated invoice-create screen — invoices now created only from quotes via "Générer facture" button in quote detail
  - **Photo mandatory for quotes**: Photo upload required in quote-create form; validation prevents submission without photos
  - **Quote-to-invoice generation**: New dedicated `POST /api/mobile/quotes/:id/convert-to-invoice` server route with 3-tier fallback:
    1. Try 3 external convert-to-invoice endpoints (mobile/admin, admin, mobile segments)
    2. If all fail, fetch quote data and manually create invoice via external invoices endpoint
    3. If everything fails, return 502 error instead of synthetic success
  - **Error handling**: Filter "Unexpected" responses from external API using safe string guards; fixed empty POST body issue causing unexpected errors
  - **Amount computation robustness**: Enhanced fallback logic to search multiple field name variants (unitPrice, price, priceExcludingTax, basePrice, hourlyRate, etc.) when computing totals from items[]
  - **JSON payloads**: Switched from FormData multipart to JSON payloads for quote/invoice creation; all monetary fields included (totalHT, totalTTC, amount, etc.)
  - **Data persistence**: All monetary data persists to backend via improved API payload structure
- Mar 19 2026: **Invoice/Quote API payload cleanup**
  - **Items sanitization**: Clean items array to only include spec fields: `description`, `quantity`, `unitPrice`, `tvaRate`
  - **Numeric conversion**: Convert `quantity`, `unitPrice`, `tvaRate` in items and root `totalHT`, `totalTTC`, `tvaRate` to proper numbers (not strings)
  - **Removed extra fields**: Strip `unitPriceExcludingTax`, `taxRate`, `totalPrice`, `totalIncludingTax`, `totalExcludingTax` from items
  - **Review mode**: Auto-enable `APP_REVIEW_MODE` in development; reviewer credentials updated to `review@mytools.eu` / `000000`
  - **Known issues**: External API returns empty quotes list; invoice creation still receives `toISOString` error from API (requires external API investigation)
