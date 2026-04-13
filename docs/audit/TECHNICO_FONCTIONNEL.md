# MyTools Mobile — Documentation Technico-Fonctionnelle pour Audit

**Version** : 1.0.0
**Date** : 24/03/2026
**Bundle ID** : `app.mytoolsmobile.mytoolsgroup.eu`
**Plateforme** : iOS / Android / Web (Expo SDK 54, React Native)
**Backend externe** : `https://saas2.mytoolsgroup.eu`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Rôles utilisateurs et routage](#3-rôles-utilisateurs-et-routage)
4. [Authentification](#4-authentification)
5. [API consommées (externe → saas2.mytoolsgroup.eu)](#5-api-consommées-externe)
6. [API fournies (serveur Express local)](#6-api-fournies-serveur-express-local)
7. [Base de données locale (PostgreSQL)](#7-base-de-données-locale-postgresql)
8. [Modèles de données](#8-modèles-de-données)
9. [Intégrations tierces](#9-intégrations-tierces)
10. [Stockage et persistance côté client](#10-stockage-et-persistance-côté-client)
11. [Notifications push](#11-notifications-push)
12. [OCR et intelligence artificielle](#12-ocr-et-intelligence-artificielle)
13. [Gestion des PDF](#13-gestion-des-pdf)
14. [Sécurité et conformité RGPD](#14-sécurité-et-conformité-rgpd)
15. [Variables d'environnement](#15-variables-denvironnement)
16. [Écrans de l'application](#16-écrans-de-lapplication)
17. [Annexe : Correspondance routes proxy → API externe](#17-annexe--correspondance-routes-proxy--api-externe)

---

## 1. Vue d'ensemble

MyTools est l'application mobile officielle du réseau MyTools Group (MyJantes), destinée à la gestion des garages partenaires spécialisés en rénovation et personnalisation de jantes automobiles.

L'application sert deux populations :
- **Administrateurs / Employés** : gestion complète (devis, factures, réservations, clients, services, analytics, OCR)
- **Clients** : consultation de devis/factures, prise de rendez-vous, messagerie, notifications

L'app ne stocke aucune donnée métier de manière autonome. Elle consomme intégralement l'API REST externe hébergée sur `saas2.mytoolsgroup.eu`. Le serveur Express local sert de **proxy intelligent** : il intercepte, enrichit et normalise les requêtes/réponses entre le frontend mobile et l'API externe.

---

## 2. Architecture technique

```
┌──────────────────────────────────┐
│  Frontend Expo React Native      │
│  (port 8081)                     │
│  ├── lib/api.ts        (client)  │
│  ├── lib/admin-api.ts  (admin)   │
│  ├── lib/auth-context.tsx        │
│  ├── lib/push-notifications.ts   │
│  ├── lib/pdf-download.ts         │
│  └── lib/query-client.ts         │
└──────────┬───────────────────────┘
           │ HTTP (fetch / expo-fetch)
           ▼
┌──────────────────────────────────┐
│  Serveur Express (port 5000)     │
│  ├── server/routes.ts            │
│  ├── server/social-auth.ts       │
│  ├── PostgreSQL local (Replit)   │
│  └── Uploads locale (/uploads)   │
└──────────┬───────────────────────┘
           │ HTTP proxy (fetch)
           ▼
┌──────────────────────────────────┐
│  API Externe                     │
│  saas2.mytoolsgroup.eu/api       │
│  (Laravel / PHP)                 │
└──────────────────────────────────┘
```

**Fichiers clés** :
| Fichier | Rôle |
|---------|------|
| `lib/api.ts` | Client API pour l'interface client (cookie session) |
| `lib/admin-api.ts` | Client API pour l'interface admin (Bearer token) |
| `lib/auth-context.tsx` | Contexte React d'authentification, gestion tokens |
| `lib/firebase.ts` | Initialisation Firebase Auth (Google/Apple sign-in) |
| `lib/push-notifications.ts` | Enregistrement et polling des notifications |
| `lib/pdf-download.ts` | Téléchargement et partage de PDF |
| `lib/query-client.ts` | QueryClient React Query + helpers URL |
| `server/routes.ts` | Toutes les routes proxy et routes locales |
| `server/social-auth.ts` | Authentification sociale Firebase |

---

## 3. Rôles utilisateurs et routage

| Rôle | Interface | Détection |
|------|-----------|-----------|
| `admin` | `(admin)` | `role` ∈ {admin, super_admin, superadmin, root_admin, root} |
| `employe` / `employee` / `manager` | `(admin)` | `role` ∈ {employe, employee, manager} |
| `client` / `client_professionnel` | `(main)` | Tout autre rôle |

**Hiérarchie des droits admin** :
- `root_admin` : accès total (logs système, gestion utilisateurs sans restriction)
- `super_admin` : gestion utilisateurs (sauf root_admin), CRUD complet
- `admin` : CRUD standard (devis, factures, réservations, clients)
- `employe` / `employee` : accès lecture + actions limitées

---

## 4. Authentification

### 4.1 Flux email/mot de passe

```
Client                    Express (local)              API externe
  │                           │                            │
  ├─ POST /api/login ────────►│                            │
  │  {email, password}        ├─ POST /mobile/auth/login ─►│
  │                           │◄─ {accessToken,            │
  │                           │    refreshToken, user}     │
  │                           │                            │
  │  Vérification deleted_accounts (DB locale)             │
  │◄─ {accessToken,           │                            │
  │    refreshToken, user}    │                            │
  │                           │                            │
  │  Stockage SecureStore:    │                            │
  │  - access_token           │                            │
  │  - refresh_token          │                            │
  │  - session_cookie         │                            │
```

### 4.2 Flux social (Google / Apple via Firebase)

```
Client                    Express (local)              API externe
  │                           │                            │
  │  Firebase signInWithPopup │                            │
  │  → obtient idToken        │                            │
  │                           │                            │
  ├─ POST /api/auth/social ──►│                            │
  │  {token, provider}        │                            │
  │                           ├─ Firebase Admin:           │
  │                           │  verifyIdToken(token) ────►│ Firebase
  │                           │◄─ {uid, email, name}       │
  │                           │                            │
  │                           ├─ POST /mobile/auth/        │
  │                           │  login-with-firebase ─────►│
  │                           │◄─ 200: {accessToken, user} │
  │                           │   ou 404: needsRegistration│
  │                           │                            │
  │◄─ 200 → authenticated    │                            │
  │   ou 404 → needs_registration                          │
```

**Si 404 (utilisateur inconnu)** : redirection vers `/(auth)/register` avec pré-remplissage email + displayName + firebaseUid.

### 4.3 Inscription multi-étapes

1. Saisie SIRET → `GET /api/mobile/public/siret-lookup` (auto-lookup à 14 chiffres)
2. Formulaire pré-rempli (société, contact)
3. `POST /api/mobile/auth/register` → champs à plat (siret, companyName, address, etc.)
4. Connexion automatique post-inscription

### 4.4 Rafraîchissement de token

```
POST /api/refresh → proxy vers POST /mobile/refresh-token
Body: { refreshToken }
Réponse: { accessToken, refreshToken? }
```

### 4.5 Restauration de session

Au démarrage de l'app (`checkAuth` dans `auth-context.tsx`) :
1. Lecture `access_token`, `refresh_token`, `session_cookie` depuis SecureStore
2. Si `access_token` présent → `GET /api/auth/me` (Bearer)
3. Sinon si `session_cookie` → `GET /api/auth/user` (Cookie)
4. Si échec → nettoyage complet des tokens stockés

### 4.6 Biométrie (Face ID / Touch ID)

- Utilise `expo-local-authentication`
- Vérifie que `biometric_enabled === "true"` dans SecureStore
- Après validation biométrique, restaure les tokens stockés et appelle `/api/auth/user`

---

## 5. API consommées (externe)

Toutes les routes ci-dessous sont consommées sur `https://saas2.mytoolsgroup.eu/api`.

### 5.1 Authentification

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| POST | `/mobile/auth/login` | `adminLogin()`, proxy `/api/login` | Connexion email/mdp |
| POST | `/mobile/auth/login-with-firebase` | `social-auth.ts` | Connexion sociale Firebase |
| POST | `/mobile/auth/register` | proxy catch-all | Inscription nouveau compte |
| GET | `/mobile/auth/me` | `adminGetMe()`, proxy `/api/auth/me` | Profil utilisateur courant |
| POST | `/mobile/refresh-token` | proxy `/api/refresh` | Rafraîchissement JWT |
| POST | `/logout` | proxy catch-all | Déconnexion |
| GET | `/mobile/public/siret-lookup` | proxy catch-all | Recherche SIRET |

### 5.2 Admin — Devis

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/quotes` | `adminQuotes.getAll()` via proxy `/api/admin/*` | Liste devis admin |
| GET | `/mobile/admin/quotes/:id` | `adminQuotes.getById()` | Détail d'un devis |
| POST | `/mobile/admin/quotes` | `adminQuotes.create()` | Création devis |
| PATCH | `/mobile/admin/quotes/:id` | `adminQuotes.update()` / `updateStatus()` | Modification / changement statut |
| DELETE | `/mobile/admin/quotes/:id` | `adminQuotes.delete()` | Suppression devis |
| POST | `/mobile/admin/quotes/:id/items` | `adminQuotes.addItem()` | Ajout ligne de devis |
| POST | `/mobile/admin/quotes/:id/media` | `adminQuotes.addMedia()` | Upload photo devis |
| POST | `/mobile/quotes/:id/convert-to-invoice` | `adminQuotes.convertToInvoice()` | Conversion devis → facture |
| POST | `/mobile/admin/quotes/:id/create-reservation` | `adminQuotes.createReservationFromQuote()` | Créer RDV depuis devis |

### 5.3 Admin — Factures

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/invoices` | `adminInvoices.getAll()` | Liste factures admin |
| GET | `/mobile/admin/invoices/:id` | `adminInvoices.getById()` | Détail facture |
| POST | `/mobile/admin/invoices` | `adminInvoices.create()` | Création facture |
| PATCH | `/mobile/admin/invoices/:id` | `adminInvoices.update()` / `updateStatus()` | Modification |
| DELETE | `/mobile/admin/invoices/:id` | `adminInvoices.delete()` | Suppression |
| POST | `/mobile/admin/invoices/:id/items` | `adminInvoices.addItem()` | Ajout ligne |
| POST | `/mobile/admin/invoices/:id/media` | `adminInvoices.addMedia()` | Upload photo |

### 5.4 Admin — Réservations

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/reservations` | `adminReservations.getAll()` | Liste RDV admin |
| GET | `/mobile/admin/reservations/:id` | `adminReservations.getById()` | Détail RDV |
| POST | `/mobile/admin/reservations` | `adminReservations.create()` | Création RDV |
| PATCH | `/mobile/admin/reservations/:id` | `adminReservations.update()` / `updateStatus()` | Modification |
| DELETE | `/mobile/admin/reservations/:id` | `adminReservations.delete()` | Suppression |
| GET | `/mobile/admin/reservations/:id/services` | `adminReservations.getServices()` | Services associés |

### 5.5 Admin — Utilisateurs / Clients

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/users` | `adminClients.getAll()` | Liste utilisateurs |
| GET | `/mobile/admin/users/:id` | `adminClients.getById()` | Détail utilisateur |
| POST | `/mobile/admin/users` | `adminClients.create()` | Création utilisateur |
| PATCH | `/mobile/admin/users/:id` | `adminClients.update()` | Modification |
| DELETE | `/mobile/admin/users/:id` | `adminClients.delete()` | Suppression |

### 5.6 Admin — Services

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/services` | `adminServices.getAll()` | Liste services |
| GET | `/mobile/admin/services/:id` | `adminServices.getById()` | Détail service |
| POST | `/mobile/admin/services` | `adminServices.create()` | Création |
| PATCH | `/mobile/admin/services/:id` | `adminServices.update()` | Modification |
| DELETE | `/mobile/admin/services/:id` | `adminServices.delete()` | Suppression |

### 5.7 Admin — Paramètres

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/settings` | `adminProfile.get()` | Profil garage |
| PATCH | `/mobile/admin/settings` | `adminProfile.update()` | Mise à jour profil |

### 5.8 Admin — Analytics

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/admin/analytics` | `adminAnalytics.get()` | KPIs dashboard |
| GET | `/mobile/admin/advanced-analytics` | `adminAnalytics.getAdvanced()` | Analytics IA (Pro+) |

### 5.9 Client — Devis

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/quotes` | `quotesApi.getAll()` via proxy | Liste devis client |
| GET | `/quotes` (filtré localement) | `quotesApi.getById()` via proxy | Détail devis |
| POST | `/quotes` | `quotesApi.create()` via proxy | Création demande devis |
| POST | `/quotes/:id/accept` | `quotesApi.accept()` | Acceptation devis |
| POST | `/quotes/:id/reject` | `quotesApi.reject()` | Refus devis |

### 5.10 Client — Factures

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/invoices` | `invoicesApi.getAll()` via proxy | Liste factures |
| GET | `/invoices` (filtré localement) | `invoicesApi.getById()` via proxy | Détail facture |

### 5.11 Client — Réservations

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/reservations` | `reservationsApi.getAll()` via proxy | Liste RDV |
| GET | `/reservations` (filtré) | `reservationsApi.getById()` via proxy | Détail RDV |
| POST | `/mobile/reservations` | `reservationsApi.create()` via proxy | Création RDV |
| GET | `/reservations/:id/services` | `reservationsApi.getServices()` | Services associés |

### 5.12 Notifications

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/notifications` | `notificationsApi.getAll()` / `adminNotifications.getAll()` | Liste notifications |
| POST | `/notifications/:id/read` | Proxy | Marquer comme lu |
| POST | `/notifications/read-all` | Proxy | Tout marquer lu |
| GET | `/notifications/unread-count` | `adminNotifications.getUnreadCount()` | Compteur non lus |

### 5.13 Messagerie (Chat)

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/chat/conversations` | `chatApi.getConversations()` via proxy catch-all | Liste conversations |
| GET | `/chat/conversations/:id/messages` | `chatApi.getMessages()` | Messages |
| POST | `/chat/conversations/:id/messages` | `chatApi.sendMessage()` | Envoi message |
| GET | `/chat/users` | `chatApi.getUsers()` | Utilisateurs chat |

### 5.14 Profil client

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/auth/user` | `authApi.getUser()` via proxy catch-all | Profil client |
| PUT | `/auth/user` | `authApi.updateUser()` | Mise à jour profil |
| POST | `/auth/forgot-password` | `authApi.forgotPassword()` | Mot de passe oublié |
| POST | `/auth/reset-password` | `authApi.resetPassword()` | Réinitialisation mdp |
| POST | `/auth/change-password` | `authApi.changePassword()` | Changement mdp |
| GET | `/auth/notification-preferences` | `authApi.getNotificationPreferences()` | Préférences notifs |
| PUT | `/auth/notification-preferences` | `authApi.updateNotificationPreferences()` | Mise à jour préf. |

### 5.15 Services publics

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/services` | `servicesApi.getAll()` via proxy catch-all | Liste services (client) |
| GET | `/public/garages` (+ fallbacks) | `garagesApi.getAll()` via proxy `/api/public/garages` | Liste garages |

### 5.16 Support

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| POST | `/support/contact` | `supportApi.contact()` via proxy | Contact support |

### 5.17 PDF

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/mobile/quotes/:id/pdf` | `getMobilePdfUrl()` | Téléchargement PDF devis |
| GET | `/mobile/invoices/:id/pdf` | `getMobilePdfUrl()` | Téléchargement PDF facture |

### 5.18 Suppression de compte

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| DELETE | `/admin/users/:id` | Proxy `DELETE /api/users/me` | Suppression sur API externe |

### 5.19 Swagger

| Méthode | Endpoint externe | Utilisé par | Description |
|---------|-----------------|-------------|-------------|
| GET | `/swagger/spec` | Proxy `/api/admin/swagger-spec` | Spécification OpenAPI |

---

## 6. API fournies (serveur Express local)

Le serveur Express écoute sur le port 5000 et fournit les routes suivantes.

### 6.1 Routes dédiées (logique locale)

| Méthode | Route locale | Type | Description |
|---------|-------------|------|-------------|
| POST | `/api/login` | Proxy enrichi | Login + vérification deleted_accounts DB locale |
| POST | `/api/auth/social` | Route propre | Auth sociale Firebase (verify token + proxy externe) |
| GET | `/api/auth/me` | Proxy | Profil utilisateur via `/mobile/auth/me` |
| POST | `/api/refresh` | Proxy | Refresh token via `/mobile/refresh-token` |
| DELETE | `/api/users/me` | Route propre | Suppression compte (DB locale + API externe) |
| GET | `/api/public/garages` | Proxy multi-fallback | Liste garages (3 endpoints tentés) |
| POST | `/api/quotes/:id/accept` | Proxy multi-fallback | Acceptation devis (4 endpoints tentés + DB locale) |
| POST | `/api/quotes/:id/reject` | Proxy multi-fallback | Refus devis (4 endpoints tentés + DB locale) |
| GET | `/api/quotes` | Proxy enrichi | Liste devis + enrichissement statut local |
| GET | `/api/quotes/:id` | Proxy enrichi | Détail devis + statut local |
| GET | `/api/invoices` | Proxy | Liste factures |
| GET | `/api/invoices/:id` | Proxy | Détail facture (filtré depuis liste) |
| GET | `/api/reservations` | Proxy enrichi | Liste RDV + enrichissement statut local |
| GET | `/api/reservations/:id` | Proxy enrichi | Détail RDV + statut local |
| POST | `/api/reservations` | Proxy multi-fallback | Création RDV (6 endpoints tentés) |
| PUT | `/api/reservations/:id` | Proxy multi-fallback | Modification RDV |
| POST | `/api/reservations/:id/confirm` | Proxy multi-fallback | Confirmation RDV |
| POST | `/api/reservations/:id/cancel` | Proxy multi-fallback | Annulation RDV |
| GET | `/api/notifications` | Proxy enrichi | Notifications + read-state DB locale |
| POST | `/api/notifications/:id/read` | Proxy + local | Marquer notification lue |
| POST | `/api/notifications/read-all` | Proxy + local | Tout marquer lu |
| POST | `/api/support/contact` | Proxy + local | Contact support (stocké localement aussi) |
| GET | `/api/support/tickets` | Route propre | Historique tickets (DB locale) |
| POST | `/api/ocr/analyze` | Route propre | Analyse OCR via Gemini Vision |
| GET | `/api/admin/logs` | Route propre | Logs système (root_admin only) |
| GET | `/api/admin/logs/export` | Route propre | Export logs JSON/CSV |
| DELETE | `/api/admin/logs` | Route propre | Vidage logs |
| GET | `/api/admin/swagger-spec` | Proxy | Spécification Swagger externe |
| GET | `/api/admin/reservations/:id/services` | Proxy multi-fallback | Services d'une réservation |
| POST | `/api/admin/quotes/:docId/media` | Route propre + proxy | Upload photos devis |
| POST | `/api/admin/invoices/:docId/media` | Route propre + proxy | Upload photos factures |

### 6.2 Proxy générique admin `/api/admin/*`

Toute requête non capturée par une route spécifique sous `/api/admin/*` est proxiée :
1. D'abord vers `saas2.mytoolsgroup.eu/api/mobile/admin/*`
2. En fallback vers `saas2.mytoolsgroup.eu/api/admin/*`

Avec :
- Normalisation des montants (camelCase ↔ snake_case) sur les mutations devis/factures
- Enrichissement des réponses avec montants et photos stockés localement
- Duplication `items` ↔ `lineItems` pour compatibilité API

### 6.3 Proxy CRUD mobile `/api/quotes`, `/api/invoices`, `/api/reservations`

Pour les méthodes non-GET, proxy séquentiel :
1. `mobile/{entity}` (primaire)
2. `mobile/admin/{entity}` (fallback)
3. `admin/{entity}` (fallback)

### 6.4 Proxy catch-all `/api/*`

Toute route non matchée est proxiée directement vers `saas2.mytoolsgroup.eu/api/*` avec transfert complet des headers (auth, cookies, content-type).

### 6.5 Pages statiques

| Route | Description |
|-------|-------------|
| `/` | Landing page HTML (`server/templates/landing-page.html`) |
| `/uploads/*` | Fichiers uploadés (photos devis/factures) |

---

## 7. Base de données locale (PostgreSQL)

Le serveur utilise une base PostgreSQL (Replit) pour stocker des données complémentaires. **Ces tables n'existent pas sur l'API externe** — elles sont propres au proxy local.

### 7.1 Tables

| Table | Colonnes | Description |
|-------|----------|-------------|
| `deleted_accounts` | `id`, `external_user_id`, `email`, `user_data` (JSONB), `created_at` | Comptes supprimés (RGPD art. 17). Bloque la reconnexion. |
| `document_amounts` | `id`, `doc_id` (UNIQUE), `doc_type`, `price_excluding_tax`, `total_including_tax`, `tax_amount`, `items` (JSONB), `created_at`, `updated_at` | Montants et lignes sauvegardés localement car l'API peut retourner 0 |
| `document_photos` | `id`, `doc_id`, `doc_type`, `photo_uri`, `created_at` | URIs des photos uploadées localement |
| `quote_responses` | `id`, `quote_id`, `user_cookie`, `action`, `created_at` | Réponses client (accepted/rejected) stockées localement |
| `reservation_confirmations` | `id`, `reservation_id`, `user_cookie`, `action`, `created_at` | Confirmations/annulations de RDV stockées localement |
| `notification_reads` | `id`, `notification_id`, `user_cookie`, `created_at`, UNIQUE(notification_id, user_cookie) | État de lecture des notifications |
| `support_tickets` | `id`, `user_cookie`, `user_email`, `name`, `category`, `subject`, `message`, `status`, `created_at` | Tickets support stockés localement |

### 7.2 Justification du stockage local

L'API externe ne supporte pas toujours les opérations granulaires (acceptation de devis, read-state des notifications, montants avec certains formats). Le proxy maintient un état local qui enrichit les réponses de l'API externe.

---

## 8. Modèles de données

### 8.1 UserProfile

```typescript
interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  profileImageUrl: string | null;
  role: "client" | "client_professionnel" | "admin" | "super_admin" |
        "superadmin" | "root_admin" | "root" | "ROOT" | "employe" |
        "employee" | "manager";
  garageId: string | null;
  companyName: string | null;
  siret: string | null;
  tvaNumber: string | null;
  companyAddress: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string;
  createdAt: string;
  updatedAt: string;
}
```

### 8.2 Quote (Devis)

```typescript
interface Quote {
  id: string;
  quoteNumber: string | null;
  clientId: string;
  status: string; // pending, sent, approved, accepted, rejected
  totalAmount: string | null;
  notes: string | null;
  items: any[];
  photos: any[];
  createdAt: string;
  updatedAt: string;
  services?: Service[];
  vehicleInfo?: any;
}
```

### 8.3 Invoice (Facture)

```typescript
interface Invoice {
  id: string;
  quoteId: string | null;
  clientId: string;
  invoiceNumber: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  tvaAmount: string;
  tvaRate: string;
  dueDate: string | null;
  paidAt: string | null;
  items: any[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 8.4 Reservation (Rendez-vous)

```typescript
interface Reservation {
  id: string;
  clientId: string;
  quoteId: string | null;
  serviceId: string | null;
  reference: string | null;
  date: string;
  scheduledDate: string | null;
  estimatedEndDate: string | null;
  timeSlot: string | null;
  status: string;
  notes: string | null;
  vehicleInfo: any;
  wheelCount: number | null;
  diameter: string | null;
  priceExcludingTax: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  productDetails: string | null;
  assignedEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 8.5 Service

```typescript
interface Service {
  id: string;
  garageId: string | null;
  name: string;
  description: string;
  basePrice: string;
  category: string;
  isActive: boolean;
  estimatedDuration: string | null;
  imageUrl: string | null;
  customFormFields: any;
  createdAt: string;
  updatedAt: string;
}
```

### 8.6 Notification

```typescript
interface Notification {
  id: string;
  userId: string;
  type: "quote" | "invoice" | "reservation" | "service" | "chat";
  title: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}
```

### 8.7 ChatConversation / ChatMessage

```typescript
interface ChatConversation {
  id: string;
  title: string;
  createdById: string;
  isArchived: boolean;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  participants?: any[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: { id: string; firstName: string; lastName: string; role: string };
}
```

---

## 9. Intégrations tierces

| Service | Utilisation | Configuration |
|---------|-------------|---------------|
| **Firebase Auth** | Authentification sociale (Google, Apple) | Projet `crud-ae9d9`, Web App ID `1:129808585113:web:03c4b7847847bf4e9b4308` |
| **Firebase Admin SDK** | Vérification des tokens Firebase côté serveur | Variable `FIREBASE_SERVICE_ACCOUNT_JSON` |
| **Google Gemini AI** | OCR (analyse de documents via vision) | Via Replit AI Integrations (`AI_INTEGRATIONS_GEMINI_API_KEY`) |
| **Expo Push Notifications** | Notifications push iOS/Android | Via `expo-notifications`, project ID EAS |
| **AsyncStorage** | Stockage persistant RGPD consent, préférences | `@react-native-async-storage/async-storage` |
| **SecureStore** | Stockage sécurisé tokens d'authentification | `expo-secure-store` |
| **expo-local-authentication** | Biométrie (Face ID / Touch ID) | Natif uniquement |

---

## 10. Stockage et persistance côté client

| Clé | Stockage | Contenu |
|-----|----------|---------|
| `access_token` | SecureStore (natif) / AsyncStorage (web) | JWT Bearer token admin |
| `refresh_token` | SecureStore / AsyncStorage | Token de rafraîchissement |
| `session_cookie` | SecureStore / AsyncStorage | Cookie de session client |
| `biometric_enabled` | SecureStore / AsyncStorage | Activation biométrie |
| `consent_accepted` | AsyncStorage | Consentement RGPD |
| `consent_notifications` | AsyncStorage | Consentement notifications |

---

## 11. Notifications push

### Fonctionnement

1. **Enregistrement** : `registerForPushNotificationsAsync()` → obtient un Expo Push Token
2. **Polling** : toutes les 15 secondes, appel à `GET /api/notifications`
3. **Détection nouveaux** : comparaison avec `knownNotificationIds` (Set en mémoire)
4. **Affichage local** : `Notifications.scheduleNotificationAsync()` pour les nouvelles notifications
5. **Badge** : `Notifications.setBadgeCountAsync(unreadCount)`

### Web

- Utilise l'API `Notification` du navigateur
- `requestWebNotificationPermission()` demande la permission

### Navigation sur tap

Le listener de réponse aux notifications redirige vers :
- `/quote-detail?id=X` si `type === "quote"`
- `/invoice-detail?id=X` si `type === "invoice"`
- `/reservation-detail?id=X` si `type === "reservation"`

---

## 12. OCR et intelligence artificielle

### Endpoint

`POST /api/ocr/analyze` (route locale, non proxiée)

### Payload

```json
{
  "imageBase64": "...",
  "mimeType": "image/jpeg",
  "mode": "invoice" | "quote"
}
```

### Traitement

- Utilise **Gemini 2.5 Flash** (vision) via `@google/genai` SDK
- Température 0.1, max 2048 tokens
- Prompt structuré demandant un JSON avec : clientName, clientEmail, notes, items[], vehicleInfo (mode quote), paymentMethod (mode invoice)
- Fallback vers template vide si extraction échoue

### Réponse

```json
{
  "success": true,
  "data": {
    "clientName": "...",
    "items": [{"description": "...", "quantity": "1", "unitPrice": "...", "tvaRate": "20"}]
  }
}
```

### AI Analytics

- `GET /api/admin/advanced-analytics` — analytics IA avancées
- Conditionné au plan garage (Pro+) via `getGaragePlan()`
- Détection du plan via champs `garage.plan`, `garage.subscriptionPlan`, `garage.subscription.plan`

---

## 13. Gestion des PDF

### Endpoints

| Type | URL | Auth |
|------|-----|------|
| Devis | `GET {API_BASE}/api/mobile/quotes/:id/pdf` | Bearer token ou Cookie |
| Facture | `GET {API_BASE}/api/mobile/invoices/:id/pdf` | Bearer token ou Cookie |

### Comportement par plateforme

| Plateforme | Méthode |
|------------|---------|
| **Web** | `fetch` → blob → `URL.createObjectURL` → lien de téléchargement |
| **iOS / Android** | `FileSystem.downloadAsync` → `Sharing.shareAsync` (ouvre la feuille de partage) |

### Partage direct

`sharePdfDirect()` partage l'URL du PDF :
- **Natif** : `Share.share({ message: url })`
- **Web** : `navigator.share()` ou copie dans le presse-papier

---

## 14. Sécurité et conformité RGPD

### 14.1 Authentification

- **Dual auth** : Bearer token (admin/employé) + Cookie session (client)
- **Token refresh automatique** : sur 401, tente un rafraîchissement avant de déconnecter
- **Stockage sécurisé** : SecureStore (Keychain iOS, Keystore Android) pour les tokens
- **Biométrie optionnelle** : Face ID / Touch ID via expo-local-authentication

### 14.2 Conformité RGPD

| Exigence | Implémentation |
|----------|----------------|
| Consentement explicite | Écran de consentement obligatoire (`consent.tsx`) avec 3 checkboxes |
| Droit d'accès (art. 15) | Profil consultable dans l'onglet Réglages/Profil |
| Droit à l'effacement (art. 17) | Suppression en 2 étapes (`delete-account.tsx`) avec confirmation checkbox + mention légale |
| Registre des suppressions | Table `deleted_accounts` avec données user archivées |
| Blocage post-suppression | Vérification `deleted_accounts` à chaque login |
| Politique de confidentialité | Accessible depuis le profil et l'écran de consentement |
| Mentions légales | Accessible depuis le profil et l'écran de consentement |
| Pas de tracking | Aucun SDK publicitaire, `NSUserTrackingUsageDescription` déclaré mais ATT non appelé |

### 14.3 Permissions système

| Permission | Clé iOS | Usage |
|------------|---------|-------|
| Caméra | `NSCameraUsageDescription` | Photos de jantes pour devis + OCR |
| Bibliothèque photos (lecture) | `NSPhotoLibraryUsageDescription` | Sélection photos existantes |
| Bibliothèque photos (écriture) | `NSPhotoLibraryAddUsageDescription` | Sauvegarde photos |
| Face ID | `NSFaceIDUsageDescription` | Connexion biométrique |
| Notifications | Géré par expo-notifications | Alertes devis/factures/RDV |
| Chiffrement | `ITSAppUsesNonExemptEncryption = NO` | HTTPS standard uniquement |

---

## 15. Variables d'environnement

### 15.1 Frontend (EXPO_PUBLIC_*)

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `EXPO_PUBLIC_DOMAIN` | Domaine de l'API (ex: `saas2.mytoolsgroup.eu`) | Oui (prod) |
| `EXPO_PUBLIC_API_URL` | URL complète API (override) | Non |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Clé API Firebase | Oui |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domaine auth Firebase | Oui |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | ID projet Firebase (`crud-ae9d9`) | Oui |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | App ID Firebase web | Oui |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID OAuth Google | Oui |

### 15.2 Backend

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `DATABASE_URL` | Connexion PostgreSQL Replit | Oui |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON du service account Firebase Admin | Oui |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Clé API Gemini (Replit AI Integrations) | Oui (OCR) |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Base URL Gemini (Replit AI Integrations) | Oui (OCR) |
| `EXTERNAL_API_URL` | Override de l'URL API externe | Non |

### 15.3 EAS Build

| Variable | Profil | Valeur |
|----------|--------|--------|
| `EXPO_PUBLIC_DOMAIN` | development, preview, production | `saas2.mytoolsgroup.eu` |
| `EXPO_PUBLIC_FIREBASE_*` | Tous | Valeurs Firebase |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Tous | Client ID OAuth |

---

## 16. Écrans de l'application

### 16.1 Écrans communs

| Fichier | Route | Description |
|---------|-------|-------------|
| `consent.tsx` | `/consent` | Consentement RGPD (3 checkboxes) |
| `onboarding.tsx` | `/onboarding` | Écran d'accueil |
| `legal.tsx` | `/legal` | Mentions légales |
| `privacy.tsx` | `/privacy` | Politique de confidentialité |
| `support.tsx` | `/support` | Contact support |

### 16.2 Interface Auth

| Fichier | Route | Description |
|---------|-------|-------------|
| `login.tsx` | `/(auth)/login` | Connexion (email + social) |
| `register.tsx` | `/(auth)/register` | Inscription multi-étapes (SIRET) |
| `forgot-password.tsx` | `/(auth)/forgot-password` | Mot de passe oublié |

### 16.3 Interface Admin `(admin)`

| Fichier | Route | Description |
|---------|-------|-------------|
| `(tabs)/index.tsx` | Dashboard | Accueil avec KPIs et graphiques |
| `(tabs)/quotes.tsx` | Devis | Liste devis avec filtres |
| `(tabs)/invoices.tsx` | Factures | Liste factures |
| `(tabs)/create.tsx` | Créer | Modal de création (+ central) |
| `(tabs)/more.tsx` | Plus | Menu fonctionnalités |
| `(tabs)/clients.tsx` | Clients | Liste clients |
| `(tabs)/settings.tsx` | Réglages | Paramètres et profil |
| `quote-detail.tsx` | Détail devis | Vue détaillée + actions statut |
| `quote-create.tsx` | Création devis | Formulaire création devis |
| `invoice-detail.tsx` | Détail facture | Vue détaillée facture |
| `invoice-create.tsx` | Création facture | Formulaire création facture |
| `reservation-detail.tsx` | Détail RDV | Vue détaillée réservation |
| `reservation-create.tsx` | Création RDV | Formulaire création RDV |
| `client-form.tsx` | Création client | Formulaire ajout client |
| `service-create.tsx` | Création service | Formulaire ajout service |
| `notifications.tsx` | Notifications | Centre de notifications |
| `users.tsx` | Utilisateurs | Gestion staff (super_admin+) |
| `admin-logs.tsx` | Logs | Logs système (root_admin) |
| `delete-account.tsx` | Suppression | Suppression compte (RGPD) |
| `guide.tsx` | Guide | Guide utilisateur |
| `support-history.tsx` | Historique support | Tickets support |
| `logs.tsx` | Logs | Vue logs |

### 16.4 Interface Client `(main)`

| Fichier | Route | Description |
|---------|-------|-------------|
| `(tabs)/index.tsx` | Accueil | Dashboard client |
| `(tabs)/quotes.tsx` | Devis | Liste devis client |
| `(tabs)/invoices.tsx` | Factures | Liste factures |
| `(tabs)/reservations.tsx` | RDV | Liste réservations |
| `(tabs)/messages.tsx` | Messages | Messagerie |
| `(tabs)/profile.tsx` | Profil | Paramètres profil |
| `quote-detail.tsx` | Détail devis | Détail + accepter/refuser |
| `invoice-detail.tsx` | Détail facture | Détail + PDF |
| `reservation-detail.tsx` | Détail RDV | Détail + annuler |
| `new-quote.tsx` | Nouveau devis | Demande de devis |
| `request-reservation.tsx` | Nouveau RDV | Demande de RDV |
| `chat-detail.tsx` | Conversation | Détail messagerie |
| `history.tsx` | Historique | Historique complet |
| `delete-account.tsx` | Suppression | Suppression compte |
| `support-history.tsx` | Historique support | Tickets support |

---

## 17. Annexe : Correspondance routes proxy → API externe

| Route locale | Cible externe principale | Fallback(s) |
|-------------|--------------------------|-------------|
| `POST /api/login` | `/mobile/auth/login` | — |
| `POST /api/auth/social` | `/mobile/auth/login-with-firebase` | — |
| `GET /api/auth/me` | `/mobile/auth/me` | — |
| `POST /api/refresh` | `/mobile/refresh-token` | — |
| `DELETE /api/users/me` | `/mobile/auth/me` (lecture) + `/admin/users/:id` (suppression) | — |
| `GET /api/public/garages` | `/garages` | `/superadmin/garages`, `/public/garages` |
| `POST /api/quotes/:id/accept` | `/quotes/:id/accept` | `/quotes/:id/respond`, `PUT /quotes/:id`, `PATCH /quotes/:id` |
| `POST /api/quotes/:id/reject` | `/quotes/:id/reject` | `/quotes/:id/respond`, `PUT /quotes/:id`, `PATCH /quotes/:id` |
| `POST /api/reservations/:id/confirm` | `/reservations/:id/confirm` | `PUT /reservations/:id`, `PATCH /reservations/:id` |
| `POST /api/reservations/:id/cancel` | `/reservations/:id/cancel` | `PUT /reservations/:id`, `PATCH /reservations/:id` |
| `POST /api/reservations` (create) | `/mobile/reservations` | `/mobile/reservation`, `/reservations/store`, `/reservation`, `/bookings`, `/appointments` |
| `PUT /api/reservations/:id` | `/reservations/:id` (PUT) | `/reservations/:id` (PATCH), `/mobile/reservations/:id` (PUT/PATCH) |
| `/api/admin/*` | `/mobile/admin/*` | `/admin/*` |
| `POST /api/admin/quotes/:id/media` | `/mobile/admin/quotes/:id/media` | Stockage local (`/uploads`) |
| `POST /api/admin/invoices/:id/media` | `/mobile/admin/invoices/:id/media` | Stockage local (`/uploads`) |
| `/api/quotes` (CRUD non-GET) | `/mobile/quotes` | `/mobile/admin/quotes`, `/admin/quotes` |
| `/api/invoices` (CRUD non-GET) | `/mobile/invoices` | `/mobile/admin/invoices`, `/admin/invoices` |
| `/api/reservations` (CRUD non-GET) | `/mobile/reservations` | `/mobile/admin/reservations`, `/admin/reservations` |
| `/api/*` (catch-all) | `/*` (même chemin) | — |

---

*Document généré le 24/03/2026 — MyTools Mobile v1.0.0*
*Destiné à l'audit technico-fonctionnel interne.*
