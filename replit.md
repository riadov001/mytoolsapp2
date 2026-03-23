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

## PDF Download

PDF files are downloaded directly from the API (binary response, `Content-Type: application/pdf`). No redirect to PWA.

### Endpoints
- **Devis**: `GET /api/mobile/quotes/:id/pdf` (auth JWT required)
- **Facture**: `GET /api/mobile/invoices/:id/pdf` (auth JWT required)

### Implementation
- Web: `fetch` with `Authorization: Bearer` header → blob → `URL.createObjectURL` → download link
- Native: `FileSystem.downloadAsync` with auth headers → `Sharing.shareAsync`
- Admin share: `sharePdfDirect()` in `lib/admin-api.ts` shares the direct API URL

## System Architecture
The application is built using Expo React Native with file-based routing via Expo Router for the frontend. It consumes an external API hosted on `saas3.mytoolsgroup.eu`. Authentication is handled via a dual system: Bearer tokens for admin API calls and cookie sessions for client-side interactions. State management utilizes React Query for server data and React Context for authentication.

Key features include:
- Role-based routing, directing `admin`/`employe` users to the `(admin)` interface and `client` users to the `(main)` interface.
- Admin interface provides a dashboard with KPIs and CRUD operations for quotes, invoices, reservations, and clients.
- Admin authentication uses Bearer tokens stored in SecureStore.
- Client authentication uses cookie-based sessions stored in SecureStore.
- OCR scanning functionality for admin forms (invoice-create, quote-create) to extract information from documents using Gemini Vision.
- Auto-refresh polling for data: quotes every 30s, invoices/reservations every 60s.
- Robust API response handling with auto-unwrapping and extensive field name fallbacks for amounts and line items.
- Quote status flows from `pending` to `sent`, `approved`, and `accepted`, with appropriate UI actions.
- Invoice creation is integrated with quotes via a "Générer facture" button in quote detail, requiring photo upload for quotes.
- Numeric conversion and sanitization of items array for API payloads.
- PDF sharing via PWA URLs (saas3.mytoolsgroup.eu/quotes/view/{viewToken} or /invoices/view/{viewToken}).
- Client creation is re-enabled with a "+" button in the Clients tab header. Only client (particulier/professionnel) roles can be created from this screen.

## Tab Navigation
The admin tab bar has the following tabs:
- **Accueil** — Dashboard with KPIs and charts
- **Devis** — Quotes management
- **Factures** — Invoices management
- **+ (Create)** — Center button opening creation modal
- **Plus** — Features menu (RDV, OCR Scanner, AI Analytics)
- **Clients** — Client management
- **Réglages** — Settings

The "Plus" tab replaced the previous "RDV" tab and provides access to:
- Rendez-vous (reservations) — always available
- Utilisateurs — visible only for super_admin and root_admin roles. CRUD management of garage staff.
- OCR Scanner (quote/invoice) — always available
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

## OCR
- Uses Gemini 2.5 Flash vision model via `/api/ocr/analyze` endpoint (registered before catch-all proxy)
- Supports both camera capture and gallery import
- Extracts structured data: client info, vehicle info (quotes), line items, payment method (invoices)
- 30-second timeout for AI analysis
- Fallback to empty template if extraction fails

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
- **Backend API**: `saas3.mytoolsgroup.eu` (configurable via `EXTERNAL_API_URL`)
- **Authentication**: Bearer tokens and cookie sessions managed by the external API.
- **Data Storage**: AsyncStorage for GDPR consent, SecureStore for authentication tokens and session cookies.
- **OCR**: Gemini Vision via `@google/genai` SDK (Replit AI Integrations) at `/api/ocr/analyze` endpoint for document scanning.
- **AI Analytics**: Via `/api/admin/advanced-analytics` endpoint.
- **Push Notifications**: Integrated for user notifications.
