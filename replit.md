# MyTools Admin - Application Mobile

## Overview
This is a mobile application built with Expo React Native, exclusively for administrators of MyTools partner garages. It enables comprehensive management of quotes, invoices, reservations, clients, and services through the MyTools Group back-office. The primary purpose is to provide a dedicated mobile interface for garage administrators to efficiently manage their operations.

## User Preferences
- Language: Français
- Interface entièrement en français
- Design professionnel automobile (thème sombre: noir #0A0A0A, rouge #DC2626, blanc)
- Font: Inter (Google Fonts)
- Logo: cropped-Logo-2-1-768x543 intégré dans l'app

## Social Authentication (Firebase)

Social login with Google and Apple. Uses Firebase Auth JS SDK on the frontend. Backend proxies Firebase ID tokens to the external API.

### Auth Flow
- **Google login**: Firebase `signInWithPopup` → `POST /api/auth/social` (local) → proxied to `POST /api/mobile/auth/login-with-firebase` on external API
  - **200**: User exists → returns `{accessToken, refreshToken, user}` → navigate to admin/main
  - **404**: User not found → redirect to `/(auth)/register` with `email`, `displayName`, `firebaseUid`, `idToken` params
- **Email/password login**: `POST /api/mobile/auth/login` → returns `{accessToken, refreshToken, user}`
- **Token refresh**: `POST /api/mobile/auth/refresh` with `{refreshToken}`

### Registration Flow (multi-step)
1. **SIRET lookup**: User enters SIRET (auto-lookup at 14 digits) or company name → `GET /api/mobile/public/siret-lookup`
2. **Form**: Company info pre-filled from SIRET, personal info (name, email). Password required only for email registration (not Google).
3. **Submit**: `POST /api/mobile/auth/register` with flat fields (`siret`, `companyName`, `address`, etc. at root level)
4. **After registration (Google)**: Auto-login via `POST /api/mobile/auth/login-with-firebase`

### Key files
- `lib/firebase.ts` — Firebase app + auth initialization
- `components/SocialLoginButtons.tsx` — Social login UI
- `server/social-auth.ts` — Backend route: `POST /api/auth/social` (proxies to external API)
- `app/(auth)/register.tsx` — Multi-step garage registration (SIRET + form + success)
- `lib/auth-context.tsx` — Auth context with `socialLogin()` returning discriminated union

### Required environment variables
**Frontend (EXPO_PUBLIC_*):**
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

**Backend:**
- `FIREBASE_SERVICE_ACCOUNT_JSON` (Firebase Admin SDK service account JSON)

## PDF Viewing

PDF viewing uses `viewPdf()` from `lib/pdf-download.ts`. A single "Visualiser le PDF" button with eye icon on all 4 detail screens (admin/client devis/facture).

### Strategy
- **With viewToken** (preferred): Opens public URL `saas.mytoolsgroup.eu/api/public/pdf/{type}/{id}?token=xxx` — no auth needed
  - Web: opens in new tab
  - Native: opens in expo-web-browser
- **Without viewToken** (fallback):
  - Web: fetch via proxy with Bearer+Cookie headers → blob → window.open
  - Native: FileSystem.downloadAsync directly to saas.mytoolsgroup.eu with auth headers → Sharing.shareAsync

### Key files
- `lib/pdf-download.ts` — `viewPdf()` and `getPublicPdfUrl()` functions

## Reservation Multi-Service

The reservation creation screen (`app/(admin)/reservation-create.tsx`) supports selecting multiple services using `selectedServiceIds: string[]`. The payload sends both `serviceId` (first selected, for backward compat) and `serviceIds` (array).

## Dashboard Data

The admin dashboard (`app/(admin)/(tabs)/index.tsx`) fetches from `/api/admin/dashboard` and also loads quotes, invoices, clients, and reservations data. If the dashboard endpoint returns empty/partial data, it computes KPIs locally from the individual API responses (revenue, status counts, conversion rate, monthly chart).

## System Architecture
**App name**: MyToolsApp | **Slug**: mytoolsapp | **Scheme**: mytools

The application is built using Expo React Native with file-based routing via Expo Router for the frontend. It consumes an external API exclusively at `backend.mytoolsgroup.eu` (production API). Authentication is handled via a dual system: Bearer tokens for admin API calls and cookie sessions for client-side interactions. State management utilizes React Query for server data and React Context for authentication.

Key features include:
- Role-based routing, directing `admin`/`employe` users to the `(admin)` interface and `client` users to the `(main)` interface.
- Admin interface provides a dashboard with KPIs and CRUD operations for quotes, invoices, reservations, and clients.
- Admin authentication uses Bearer tokens stored in SecureStore.
- Client authentication uses cookie-based sessions stored in SecureStore.
- Auto-refresh polling for data: quotes every 30s, invoices/reservations every 60s.
- Robust API response handling with auto-unwrapping and extensive field name fallbacks for amounts and line items.
- Quote status flows from `pending` to `sent`, `approved`, and `accepted`, with appropriate UI actions.
- Invoice creation is integrated with quotes via a "Générer facture" button in quote detail.
- Numeric conversion and sanitization of items array for API payloads.
- PDF viewing via public URLs with viewToken (no auth required).
- Password reset via email link (no in-app token entry — user follows email instructions).
- Client creation is re-enabled with a "+" button in the Clients tab header. Only client (particulier/professionnel) roles can be created from this screen.

## Tab Navigation
The admin tab bar has the following tabs:
- **Accueil** — Dashboard with KPIs and charts
- **Devis** — Quotes management
- **Factures** — Invoices management
- **+ (Create)** — Center button opening creation modal
- **Plus** — Features menu (RDV, AI Analytics)
- **Clients** — Client management
- **Réglages** — Settings

The "Plus" tab replaced the previous "RDV" tab and provides access to:
- Rendez-vous (reservations) — always available
- Utilisateurs — visible only for super_admin and root_admin roles. CRUD management of garage staff.
- Logs système — visible only for root_admin. Real-time server log viewer with filtering, search, export (JSON/CSV), and auto-refresh.
- AI Analytics (global, commercial, growth) — conditionally available based on garage plan (Pro+)

## Users Management
- Screen: `app/(admin)/users.tsx` — modal presentation from Plus tab
- Only accessible to super_admin and root_admin (hidden from regular admins in more.tsx)
- Role hierarchy permissions:
  - root_admin: can view/edit/delete all users, can create super_admin
  - super_admin: can view all except root_admin, can edit/delete admin and employee, cannot create super_admin
- Available roles in create form depend on logged-in user's role
- Proper role labels and color coding (Root Admin=red, Super Admin=purple, Admin=blue, Employee=green)

## Admin Logs
- Screen: `app/(admin)/admin-logs.tsx` — root_admin only
- Backend: `GET /api/admin/logs` with `?level=`, `?search=`, `?limit=`, `?offset=` params
- Export: `GET /api/admin/logs/export?format=json|csv`
- Clear: `DELETE /api/admin/logs`
- Buffer: 2000 entries in-memory, reverse chronological order
- Auto-refresh: 5s/10s/30s configurable interval

## Photo Upload
- Quotes: Two-step process — create quote shell, then upload media via POST to `/api/admin/quotes/{id}/media`
- Invoices: Same two-step process — create invoice, then upload media via POST to `/api/admin/invoices/{id}/media`
- Photos are displayed in both quote-detail and invoice-detail screens

## Garage Plan & AI Features
- `getGaragePlan()` in admin-api.ts fetches user info from `/api/auth/me`
- Detects garage plan (free, pro, premium, enterprise, etc.)
- AI analytics features gated behind Pro+ plans
- Custom features array also checked for granular feature enablement

## Package Version Compatibility
All Expo packages must be compatible with the installed SDK version. Use `npx expo install --check` to verify. Key packages that previously caused native crashes due to version mismatch (55.x installed for SDK 54):
- `expo-apple-authentication` → must be `~8.0.8` for SDK 54
- `expo-auth-session` → must be `~7.0.10` for SDK 54
- `expo-clipboard` → must be `~8.0.8` for SDK 54
Always run `npx expo install <package> --fix` or `npx expo install --fix` to auto-resolve version mismatches.

## External Dependencies
- **Backend API**: `backend.mytoolsgroup.eu` (production). All backend routes proxy to this single production endpoint with retry on 5xx errors.
- **Authentication**: Bearer tokens and cookie sessions managed by the external API. Apple Sign-In uses nonce-based verification via `expo-crypto`.
- **Social Auth**: Firebase Admin SDK verifies Google/Apple tokens, then forwards to external API `/mobile/auth/login-with-firebase`.
- **Data Storage**: AsyncStorage for GDPR consent, SecureStore for authentication tokens and session cookies.
- **AI Analytics**: Via `/api/admin/advanced-analytics` endpoint.
- **Push Notifications**: Integrated for user notifications.
- **Company Search**: SIRET lookup via `/api/mobile/public/siret-lookup` (proxied to external API).
