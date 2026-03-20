# MyTools Admin - Application Mobile

## Overview
This is a mobile application built with Expo React Native, exclusively for administrators of MyTools partner garages. It enables comprehensive management of quotes, invoices, reservations, clients, and services through the MyTools Group back-office. The primary purpose is to provide a dedicated mobile interface for garage administrators to efficiently manage their operations.

## User Preferences
- Language: Français
- Interface entièrement en français
- Design professionnel automobile (thème sombre: noir #0A0A0A, rouge #DC2626, blanc)
- Font: Inter (Google Fonts)
- Logo: cropped-Logo-2-1-768x543 intégré dans l'app

## System Architecture
The application is built using Expo React Native with file-based routing via Expo Router for the frontend. It consumes an external API hosted on `apps.mytoolsgroup.eu`. Authentication is handled via a dual system: Bearer tokens for admin API calls and cookie sessions for client-side interactions. State management utilizes React Query for server data and React Context for authentication.

The design adheres to a futuristic iPhone-style, featuring iOS Settings-style grouped lists, Michroma font for titles, and Inter for body text. The primary color scheme uses `#DC2626` (light) and `#EF4444` (dark). A GDPR consent screen is displayed on the first launch.

Key features include:
- Role-based routing, directing `admin`/`employe` users to the `(admin)` interface and `client` users to the `(main)` interface.
- Admin interface provides a dashboard with KPIs and CRUD operations for quotes, invoices, reservations, and clients.
- Admin authentication uses Bearer tokens stored in SecureStore.
- Client authentication uses cookie-based sessions stored in SecureStore.
- Account deletion functionality is available within the app.
- Biometric authentication is supported for clearing expired session credentials.
- OCR scanning functionality for admin forms (invoice-create, quote-create) to extract information from documents using Gemini Vision.
- Auto-refresh polling for data: quotes every 30s, invoices/reservations every 60s.
- Robust API response handling with auto-unwrapping and extensive field name fallbacks for amounts and line items.
- Quote status flows from `pending` to `sent`, `approved`, and `accepted`, with appropriate UI actions.
- Invoice creation is integrated with quotes via a "Générer facture" button in quote detail, requiring photo upload for quotes.
- Numeric conversion and sanitization of items array for API payloads.

## External Dependencies
- **Backend API**: `apps.mytoolsgroup.eu` (configurable via `EXTERNAL_API_URL`)
- **Authentication**: Bearer tokens and cookie sessions managed by the external API.
- **Data Storage**: AsyncStorage for GDPR consent, SecureStore for authentication tokens and session cookies.
- **OCR**: Gemini Vision via `/api/ocr/analyze` endpoint for document scanning.
- **Push Notifications**: Integrated for user notifications.
- **EAS (Expo Application Services)**: Used for build and distribution workflows, including `eas build` and `eas submit`.