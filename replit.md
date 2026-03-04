# MyJantes - Application Mobile

## Overview
Application mobile Expo React Native pour MyJantes, un service professionnel de rénovation et personnalisation de jantes automobiles. L'app permet aux particuliers et professionnels de demander des devis gratuits en ligne.

## Architecture
- **Frontend**: Expo React Native (Expo Router, file-based routing)
- **Backend**: API externe hébergée sur `appmyjantes2.mytoolsgroup.eu`
- **Auth**: Sessions avec cookies (stockés via expo-secure-store / AsyncStorage)
- **State**: React Query pour les données serveur, React Context pour l'auth

## API Backend
Base URL: Configurable via `EXTERNAL_API_URL` env var (default: `https://appmyjantes2.mytoolsgroup.eu/api`)

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

### Roles utilisateur
- `client` - Particulier
- `client_professionnel` - Professionnel (+ infos société)

## Structure du projet
```
app/
  _layout.tsx           # Root layout (providers, fonts)
  index.tsx             # Redirect basé sur auth
  (auth)/               # Flux d'authentification
    _layout.tsx
    login.tsx
    register.tsx
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
  support.tsx           # Formulaire de support
  legal.tsx             # Mentions légales
  privacy.tsx           # Politique de confidentialité
components/
  FloatingSupport.tsx   # Bouton flottant support
  ErrorBoundary.tsx     # Error boundary
  CustomAlert.tsx       # Alerte personnalisée glassmorphism
lib/
  api.ts                # Client API complet
  auth-context.tsx      # Context d'authentification + biométrie
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
- No admin-only screens or role-based UI in mobile app
- Account deletion available via Profile → Paramètres → Supprimer mon compte
- Detail pages use client API endpoints only
- Biometric auth auto-clears expired session credentials
- All domain references point to `appmyjantes2.mytoolsgroup.eu`
- Data auto-refreshes: quotes every 30s, invoices/reservations every 60s, notifications every 30s

## Apple App Store Compliance (5.1.1(v))
- All AI screens, services, and imports removed (chatbot, OCR scanner)
- All admin-only screens removed (20 admin screens deleted)
- No role-based conditional UI remains in mobile
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
- Quote accept/reject tries multiple endpoint patterns: `/accept`, `/respond`, and PUT status update as fallbacks
- Reservation confirm tries fallback PUT status update
- Server proxy logs all API responses to `/tmp/api_debug_*.json` files for debugging

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
- Mar 4 2026: Backend URL switched to appmyjantes2.mytoolsgroup.eu
- Mar 4 2026: Removed all non-functional buttons (image attach, Modifier, Annuler, Refuser)
- Mar 4 2026: Removed uploadApi and sendMessageWithImage from lib/api.ts
- Mar 4 2026: Auto-refresh polling added (quotes 30s, invoices/reservations 60s)
- Mar 4 2026: PDF token detection expanded (7 field names + direct URL fallback)
- Mar 4 2026: Invoice line items check 10 field name variants
- Mar 4 2026: canRespond logic simplified (any non-final, non-pending status)
