# MyTools Admin — App Review Notes

## Demo Account (Apple / Google Reviewer)

| Field    | Value              |
| -------- | ------------------ |
| Email    | review@testapp.com |
| Password | Test123456         |

This account is pre-configured as an `admin` role and returns synthetic data so the reviewer can explore every screen without requiring a live garage subscription. The demo account is only active when the `APP_REVIEW_MODE=true` environment variable is set on the server.

## Key Screens to Test

1. **Login** — Enter the credentials above.
2. **Dashboard** — Shows analytics cards (revenue, clients, quotes, invoices, reservations).
3. **Devis (Quotes)** — Full CRUD: list, view details, create, edit status, delete.
4. **Factures (Invoices)** — Full CRUD: list, view details, create, edit status, delete.
5. **Réservations** — Full CRUD: list, view details, create, edit status, delete.
6. **Clients** — List and view client profiles.
7. **Services** — List and manage garage services.
8. **Profil / Paramètres** — View and edit admin profile, change password, notification preferences.
9. **Supprimer mon compte** — Account deletion flow (two-step confirmation, GDPR-compliant).

## Privacy & Data

- Privacy Policy: https://www.mytoolsgroup.eu/privacy
- No third-party tracking SDKs are used.
- `NSUserTrackingUsageDescription` is declared; the app does **not** call `requestTrackingAuthorization()` or use ATT.
- The microphone permission (`NSMicrophoneUsageDescription`) has been removed; the app does not record audio.
- Camera and photo library access is used solely for attaching vehicle photos to quotes.

## Network

- API requests made via the admin and client API wrappers use a 15-second timeout with one automatic retry on network failure.
- The app displays user-friendly French error messages on timeout or server unavailability.

## Account Deletion

- `DELETE /api/users/me` logs the deletion in a local database, attempts to remove the account from the external API, and invalidates the session.
- Deleted accounts are blocked from future login attempts.
