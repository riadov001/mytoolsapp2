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

### Endpoints principaux
- `POST /api/register` - Inscription (email, password, firstName, lastName, role, etc.)
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

## Apple App Store Compliance (5.1.1(v))
- All AI screens, services, and imports removed (chatbot, OCR scanner)
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
- **Environment variable**: `APP_REVIEW_MODE=true` enables the reviewer demo account bypass
- **Demo credentials**: `review@testapp.com` / `Test123456` (admin role)
- All admin CRUD endpoints return synthetic data when using the reviewer token
- Disable by removing or setting `APP_REVIEW_MODE=false` in production after review
- See `APP_REVIEW_NOTES.md` for full reviewer instructions

## Network Resilience
- `lib/api.ts` and `lib/admin-api.ts` use 15s `AbortController` timeout + 1 retry on network errors
- User-friendly French error messages on timeout/unavailability

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
