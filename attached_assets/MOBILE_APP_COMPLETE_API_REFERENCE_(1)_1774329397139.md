# Documentation Complète API Mobile — MyTools App

> **Version 4.0 — Mars 2026**
> Base URL de production : `https://dd20d7f3-9c98-493c-8f24-3ef35da74c15-00-2rlisv3hu3wjz.kirk.replit.dev`
> Toutes les requêtes authentifiées nécessitent le header : `Authorization: Bearer <accessToken>`

---

## Table des matières

1. [Architecture & Principes](#1-architecture--principes)
2. [Authentification](#2-authentification)
3. [Profil Utilisateur](#3-profil-utilisateur)
4. [Services](#4-services)
5. [Devis (Quotes)](#5-devis-quotes)
6. [Factures (Invoices)](#6-factures-invoices)
7. [Réservations](#7-réservations)
8. [Notifications](#8-notifications)
9. [Chat & Messagerie](#9-chat--messagerie)
10. [Dashboard & Statistiques Admin](#10-dashboard--statistiques-admin)
11. [Gestion des Utilisateurs Admin](#11-gestion-des-utilisateurs-admin)
12. [Gestion des Services Admin](#12-gestion-des-services-admin)
13. [Workshop & Workflows](#13-workshop--workflows)
14. [Comptabilité & Dépenses](#14-comptabilité--dépenses)
15. [OCR & Scan de Documents](#15-ocr--scan-de-documents)
16. [IA & Analyses](#16-ia--analyses)
17. [Galerie Média](#17-galerie-média)
18. [SMS](#18-sms)
19. [Avis Clients (Reviews)](#19-avis-clients-reviews)
20. [Exports](#20-exports)
21. [Quotas & Abonnements](#21-quotas--abonnements)
22. [Paramètres & Configuration](#22-paramètres--configuration)
23. [Garage Management (Superadmin)](#23-garage-management-superadmin)
24. [Routes Publiques (Sans Auth)](#24-routes-publiques-sans-auth)
25. [Upload de Fichiers](#25-upload-de-fichiers)
26. [WebSocket (Temps Réel)](#26-websocket-temps-réel)
27. [Modèles de Données](#27-modèles-de-données)
28. [Gestion des Erreurs](#28-gestion-des-erreurs)
29. [CORS & Sécurité](#29-cors--sécurité)
30. [Guide d'Implémentation Mobile (React Native)](#30-guide-dimplémentation-mobile-react-native)

---

## 1. Architecture & Principes

### Rôles Utilisateurs

| Rôle | Code | Accès |
|------|------|-------|
| Client particulier | `client` | Ses propres devis, factures, réservations, chat |
| Client professionnel | `client_professionnel` | Idem + champs entreprise (SIRET, TVA, etc.) |
| Employé | `employe` | Accès admin limité (pas de comptabilité) |
| Administrateur | `admin` | Accès complet au garage assigné |
| Super administrateur | `superadmin` | Gestion multi-garages |
| Root administrateur | `rootadmin` | Accès total plateforme + abonnements + logs |

### Préfixes d'API

| Préfixe | Usage | Auth |
|---------|-------|------|
| `/api/mobile/...` | Endpoints optimisés mobile (JWT) | Bearer Token |
| `/api/mobile/admin/...` | Endpoints admin via mobile | Bearer Token + rôle admin+ |
| `/api/admin/...` | Endpoints admin (web + mobile) | Bearer Token + rôle admin+ |
| `/api/public/...` | Endpoints publics | Aucune |
| `/api/v2/...` | API v2 (Controller/Service/Repository) | Bearer Token |

### Headers Standards

```
Content-Type: application/json
Authorization: Bearer <accessToken>
```

Pour les uploads de fichiers :
```
Content-Type: multipart/form-data
Authorization: Bearer <accessToken>
```

---

## 2. Authentification

### 2.1 Login (Connexion)

```http
POST /api/mobile/auth/login
Content-Type: application/json
```

**Body :**
```json
{
  "email": "admin@mongarage.fr",
  "password": "motdepasse"
}
```

**Réponse 200 :**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "emailVerified": true,
  "user": {
    "id": "uuid-xxx",
    "email": "admin@mongarage.fr",
    "firstName": "Jean",
    "lastName": "Dupont",
    "phone": "06 12 34 56 78",
    "role": "admin",
    "garageId": "uuid-garage",
    "profileImageUrl": null,
    "isEmailVerified": true,
    "createdAt": "2026-03-01T10:00:00.000Z"
  }
}
```

**Erreurs :**

| Code | Message |
|------|---------|
| 400 | `Email et mot de passe requis` |
| 401 | `Email ou mot de passe incorrect` |

### 2.2 Refresh Token

```http
POST /api/mobile/refresh-token
Content-Type: application/json
```

**Body :**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Réponse 200 :**
```json
{
  "accessToken": "nouveau_access_token...",
  "refreshToken": "nouveau_refresh_token...",
  "user": {
    "id": "uuid-xxx",
    "email": "admin@mongarage.fr",
    "firstName": "Jean",
    "lastName": "Dupont",
    "phone": "06 12 34 56 78",
    "role": "admin",
    "garageId": "uuid-garage",
    "isEmailVerified": true,
    "profileImageUrl": null
  }
}
```

> Les deux tokens sont renouvelés. Sauvegardez impérativement les deux.

**Erreurs :**

| Code | Message |
|------|---------|
| 400 | `Refresh token requis` |
| 401 | `Token invalide` ou `Token expiré, veuillez vous reconnecter` |

### 2.3 Inscription (Register)

```http
POST /api/mobile/auth/register
Content-Type: application/json
```

**Body :**
```json
{
  "email": "nouveau@garage.fr",
  "password": "MotDePasse123!",
  "firstName": "Jean",
  "lastName": "Dupont",
  "siret": "12345678901234",
  "companyName": "Mon Garage SAS",
  "companyAddress": "12 Rue de la Paix, 75001 Paris",
  "garageName": "Mon Garage",
  "smsConsent": true
}
```

> L'inscription crée automatiquement un garage et assigne l'utilisateur comme admin. Un email de vérification est envoyé.

**Réponse 201 :**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "emailVerified": false,
  "user": { "..." }
}
```

### 2.4 Login Firebase (Google Sign-In)

```http
POST /api/mobile/auth/login-with-firebase
Content-Type: application/json
```

**Body :**
```json
{
  "idToken": "firebase_id_token_from_google_signin"
}
```

### 2.5 Vérification Email

```http
GET /api/auth/verify-email?token=<verification_token>
```

### 2.6 Renvoi Email de Vérification

```http
POST /api/auth/resend-verification
Content-Type: application/json
```

**Body :**
```json
{
  "email": "user@example.fr"
}
```

### 2.7 Mot de Passe Oublié

```http
POST /api/auth/forgot-password
Content-Type: application/json
```

**Body :**
```json
{
  "email": "user@example.fr"
}
```

### 2.8 Réinitialiser le Mot de Passe

```http
POST /api/auth/reset-password
Content-Type: application/json
```

**Body :**
```json
{
  "token": "reset_token_from_email",
  "password": "NouveauMotDePasse123!"
}
```

### 2.9 Vérifier Email Existant

```http
GET /api/users/check-email?email=user@example.fr
```

**Réponse :**
```json
{ "exists": true }
```

### 2.10 Lookup SIRET (Public)

```http
GET /api/mobile/public/siret-lookup?siret=12345678901234
```

**Réponse :** Données entreprise INSEE (nom, adresse, forme juridique, code NAF, etc.)

### 2.11 Configuration Firebase (Public)

```http
GET /api/mobile/public/firebase-config
```

**Réponse :** Configuration Firebase Web pour initialiser le SDK côté client.

### Durée des Tokens

| Token | Durée | Payload |
|-------|-------|---------|
| `accessToken` | 7 jours | `{ userId, email, role }` |
| `refreshToken` | 30 jours | `{ userId, email, role, type: "refresh" }` |

---

## 3. Profil Utilisateur

### 3.1 Obtenir Mon Profil

```http
GET /api/mobile/profile
Authorization: Bearer <token>
```

**Réponse 200 :** Objet utilisateur complet (sans password).

### 3.2 Mettre à Jour Mon Profil

```http
PATCH /api/mobile/profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**
```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "phone": "06 12 34 56 78",
  "address": "12 Rue de la Paix",
  "postalCode": "75001",
  "city": "Paris"
}
```

### 3.3 Changer Mon Mot de Passe

```http
PATCH /api/user/password
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**
```json
{
  "currentPassword": "ancien_mdp",
  "newPassword": "nouveau_mdp"
}
```

### 3.4 Upload Avatar

```http
POST /api/mobile/profile/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData :**
- `avatar` : fichier image (JPG, PNG, WebP, HEIC — max 10 Mo)

**Réponse :**
```json
{
  "profileImageUrl": "/objects/uploads/uuid-xxx"
}
```

### 3.5 Supprimer Mon Compte

```http
DELETE /api/mobile/profile
Authorization: Bearer <token>
```

---

## 4. Services

### 4.1 Lister les Services (Client)

```http
GET /api/mobile/services
Authorization: Bearer <token>
```

**Réponse :** Liste des services actifs et visibles pour les clients.

```json
[
  {
    "id": "uuid-svc",
    "name": "Réparation de jantes",
    "description": "Service complet de réparation",
    "basePrice": "80.00",
    "category": "reparation",
    "estimatedDuration": 180,
    "isActive": true,
    "isVisibleToClients": true,
    "imageUrl": null,
    "customFormFields": null
  }
]
```

### 4.2 Configuration Simulateur de Jantes

```http
GET /api/mobile/wheel-simulator/config
Authorization: Bearer <token>
```

**Réponse :** Configuration du simulateur (prix, couleurs, options).

---

## 5. Devis (Quotes)

### 5.1 Mes Devis (Client)

```http
GET /api/mobile/quotes
Authorization: Bearer <token>
```

**Réponse :** Liste des devis du client connecté.

```json
[
  {
    "id": "uuid-quote",
    "reference": "DEV-03-00001",
    "serviceId": "uuid-svc",
    "status": "pending",
    "quoteAmount": "192.00",
    "priceExcludingTax": "160.00",
    "taxRate": "20.00",
    "taxAmount": "32.00",
    "vehicleMake": "BMW",
    "vehicleModel": "Série 3",
    "vehicleRegistration": "AB-123-CD",
    "productDetails": "Réparation de 2 jantes",
    "validUntil": "2026-04-10T00:00:00.000Z",
    "createdAt": "2026-03-15T10:00:00.000Z",
    "service": { "name": "Réparation de jantes" },
    "client": { "firstName": "Jean", "lastName": "Martin" }
  }
]
```

### 5.2 Détail d'un Devis

```http
GET /api/mobile/quotes/:id
Authorization: Bearer <token>
```

### 5.3 Créer un Devis (Client)

```http
POST /api/mobile/quotes
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData :**
- `serviceId` : ID du service
- `vehicleRegistration` : immatriculation (ex: `AB-123-CD`)
- `vehicleMake` : marque (ex: `BMW`)
- `vehicleModel` : modèle (ex: `Série 3`)
- `notes` : commentaires libres
- `paymentMethod` : `cash` | `wire_transfer` | `card` | `stripe` | `sepa` | `klarna` | `alma`
- `images` : fichiers images (1 à 10 photos, JPG/PNG/WebP/HEIC)

### 5.4 Modifier un Devis

```http
PATCH /api/mobile/quotes/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### 5.5 Supprimer un Devis

```http
DELETE /api/mobile/quotes/:id
Authorization: Bearer <token>
```

### 5.6 Médias d'un Devis

```http
GET /api/mobile/quotes/:id/media
Authorization: Bearer <token>
```

### 5.7 PDF d'un Devis

```http
GET /api/mobile/quotes/:id/pdf
Authorization: Bearer <token>
```

**Réponse :** Fichier PDF (`Content-Type: application/pdf`)

### 5.8 Admin — Lister Tous les Devis

```http
GET /api/mobile/admin/quotes
Authorization: Bearer <token>  (admin+)
```

### 5.9 Admin — Créer un Devis

```http
POST /api/mobile/admin/quotes
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "clientId": "uuid-client",
  "serviceId": "uuid-service",
  "vehicleRegistration": "AB-123-CD",
  "vehicleMake": "Renault",
  "vehicleModel": "Clio",
  "paymentMethod": "wire_transfer",
  "notes": "Commentaire libre",
  "items": [
    {
      "description": "Main d'oeuvre",
      "quantity": "2",
      "unitPriceExcludingTax": "50.00",
      "taxRate": "20.00"
    }
  ]
}
```

### 5.10 Admin — Changer Statut d'un Devis

```http
PATCH /api/mobile/admin/quotes/:id/status
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "status": "approved"
}
```

**Statuts possibles :** `pending` → `approved` → `accepted` → `completed` | `rejected`

### 5.11 Admin — Convertir Devis en Facture

```http
POST /api/mobile/admin/quotes/:quoteId/convert-to-invoice
Authorization: Bearer <token>  (admin+)
```

### 5.12 Admin — Supprimer un Devis

```http
DELETE /api/mobile/admin/quotes/:id
Authorization: Bearer <token>  (admin+)
```

### 5.13 Admin — Lignes de Devis (Items)

```http
GET /api/admin/quotes/:id/items
Authorization: Bearer <token>  (admin+)
```

```http
POST /api/admin/quotes/:id/items
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "items": [
    {
      "description": "Prestation réparation",
      "quantity": "1",
      "unitPriceExcludingTax": "80.00",
      "taxRate": "20.00"
    }
  ]
}
```

```http
PATCH /api/admin/quote-items/:id
DELETE /api/admin/quote-items/:id
```

### 5.14 Admin — Upload Média sur Devis

```http
POST /api/admin/quotes/:id/media
Authorization: Bearer <token>  (admin+)
Content-Type: multipart/form-data
```

**FormData :**
- `files` : fichiers images/vidéos

### 5.15 Admin — Envoyer Devis par Email

```http
POST /api/admin/quotes/:id/send-email
Authorization: Bearer <token>  (admin+)
```

### 5.16 Admin — Télécharger ZIP des Photos

```http
GET /api/admin/quotes/:id/media/download-zip
Authorization: Bearer <token>  (admin+)
```

---

## 6. Factures (Invoices)

### 6.1 Mes Factures (Client)

```http
GET /api/mobile/invoices
Authorization: Bearer <token>
```

### 6.2 Détail d'une Facture

```http
GET /api/mobile/invoices/:id
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "id": "uuid-invoice",
  "invoiceNumber": "FAC-03-00001",
  "clientId": "uuid-client",
  "quoteId": "uuid-quote",
  "amount": "192.00",
  "priceExcludingTax": "160.00",
  "taxRate": "20.00",
  "taxAmount": "32.00",
  "status": "pending",
  "paymentMethod": "wire_transfer",
  "productDetails": "Réparation 2 jantes",
  "dueDate": "2026-04-15T00:00:00.000Z",
  "paidAt": null,
  "paymentLink": null,
  "createdAt": "2026-03-15T10:00:00.000Z",
  "client": { "firstName": "Jean", "lastName": "Martin", "email": "jean@email.fr" },
  "items": [
    {
      "id": "uuid-item",
      "description": "Main d'oeuvre",
      "quantity": "1",
      "unitPriceExcludingTax": "80.00",
      "totalExcludingTax": "80.00",
      "taxRate": "20.00",
      "taxAmount": "16.00",
      "totalIncludingTax": "96.00"
    }
  ]
}
```

### 6.3 Médias d'une Facture

```http
GET /api/mobile/invoices/:id/media
Authorization: Bearer <token>
```

### 6.4 PDF d'une Facture

```http
GET /api/mobile/invoices/:id/pdf
Authorization: Bearer <token>
```

### 6.5 Admin — Lister Toutes les Factures

```http
GET /api/mobile/admin/invoices
Authorization: Bearer <token>  (admin+)
```

### 6.6 Admin — Créer une Facture Directe

```http
POST /api/mobile/invoices
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "clientId": "uuid-client",
  "paymentMethod": "card",
  "productDetails": "Prestation réparation jantes",
  "items": [
    {
      "description": "Réparation 2 jantes avant",
      "quantity": "1",
      "unitPriceExcludingTax": "120.00",
      "taxRate": "20.00"
    }
  ],
  "notes": "Facture directe"
}
```

### 6.7 Admin — Changer Statut Facture

```http
PATCH /api/mobile/admin/invoices/:id/status
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "status": "paid"
}
```

**Statuts possibles :** `pending` | `paid` | `overdue` | `cancelled`

### 6.8 Admin — Modifier Facture

```http
PATCH /api/mobile/invoices/:id
Authorization: Bearer <token>  (admin+)
```

### 6.9 Admin — Supprimer Facture

```http
DELETE /api/mobile/invoices/:id
Authorization: Bearer <token>  (admin+)
```

---

## 7. Réservations

### 7.1 Mes Réservations (Client)

```http
GET /api/mobile/reservations
Authorization: Bearer <token>
```

**Réponse :**
```json
[
  {
    "id": "uuid-res",
    "reference": "RES-03-00001",
    "scheduledDate": "2026-03-28T09:00:00.000Z",
    "estimatedEndDate": "2026-03-28T12:00:00.000Z",
    "status": "confirmed",
    "priceExcludingTax": "160.00",
    "taxRate": "20.00",
    "taxAmount": "32.00",
    "notes": "BMW Série 3 - 2 jantes avant",
    "service": { "name": "Réparation de jantes" },
    "client": { "firstName": "Jean", "lastName": "Martin" }
  }
]
```

### 7.2 Détail d'une Réservation

```http
GET /api/mobile/reservations/:id
Authorization: Bearer <token>
```

### 7.3 Admin — Créer une Réservation

```http
POST /api/mobile/reservations
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "clientId": "uuid-client",
  "serviceId": "uuid-service",
  "scheduledDate": "2026-04-01T09:00:00.000Z",
  "estimatedEndDate": "2026-04-01T12:00:00.000Z",
  "assignedEmployeeId": "uuid-employee",
  "notes": "Réparation jante avant gauche",
  "priceExcludingTax": "80.00",
  "taxRate": "20.00"
}
```

### 7.4 Admin — Créer Réservation depuis Devis

```http
POST /api/mobile/quotes/:id/create-reservation
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "scheduledDate": "2026-04-01T09:00:00.000Z",
  "estimatedEndDate": "2026-04-01T12:00:00.000Z",
  "assignedEmployeeId": "uuid-employee"
}
```

### 7.5 Admin — Modifier Réservation

```http
PATCH /api/mobile/reservations/:id
Authorization: Bearer <token>  (admin+)
```

**Statuts possibles :** `pending` | `confirmed` | `completed` | `cancelled`

### 7.6 Admin — Supprimer Réservation

```http
DELETE /api/mobile/reservations/:id
Authorization: Bearer <token>  (admin+)
```

### 7.7 Admin — Lister Réservations

```http
GET /api/mobile/admin/reservations
Authorization: Bearer <token>  (admin+)
```

---

## 8. Notifications

### 8.1 Lister Mes Notifications

```http
GET /api/mobile/notifications
Authorization: Bearer <token>
```

**Réponse :**
```json
[
  {
    "id": "uuid-notif",
    "type": "quote",
    "title": "Devis approuvé",
    "message": "Votre devis DEV-03-00001 a été approuvé.",
    "relatedId": "uuid-quote",
    "isRead": false,
    "createdAt": "2026-03-20T10:00:00.000Z"
  }
]
```

**Types :** `quote` | `invoice` | `reservation` | `service` | `chat`

### 8.2 Compteur Non-Lus

```http
GET /api/mobile/notifications/unread-count
Authorization: Bearer <token>
```

**Réponse :**
```json
{ "count": 5 }
```

### 8.3 Marquer une Notification comme Lue

```http
PATCH /api/mobile/notifications/:id/read
Authorization: Bearer <token>
```

### 8.4 Tout Marquer comme Lu

```http
POST /api/mobile/notifications/mark-all-read
Authorization: Bearer <token>
```

---

## 9. Chat & Messagerie

### 9.1 Lister les Conversations

```http
GET /api/chat/conversations
Authorization: Bearer <token>
```

### 9.2 Créer une Conversation

```http
POST /api/chat/conversations
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**
```json
{
  "title": "Question sur mon devis",
  "type": "client",
  "participantIds": ["uuid-admin"]
}
```

### 9.3 Messages d'une Conversation

```http
GET /api/chat/conversations/:id/messages
Authorization: Bearer <token>
```

### 9.4 Envoyer un Message

```http
POST /api/chat/conversations/:id/messages
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**
```json
{
  "content": "Bonjour, j'ai une question sur mon devis."
}
```

### 9.5 Modifier un Message

```http
PATCH /api/chat/messages/:id
Authorization: Bearer <token>
```

### 9.6 Supprimer un Message

```http
DELETE /api/chat/messages/:id
Authorization: Bearer <token>
```

### 9.7 Marquer Conversation comme Lue

```http
PATCH /api/chat/conversations/:id/read
Authorization: Bearer <token>
```

### 9.8 Upload Pièce Jointe Chat

```http
POST /api/chat/conversations/:id/attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

---

## 10. Dashboard & Statistiques Admin

### 10.1 Dashboard Principal

```http
GET /api/mobile/admin/dashboard
Authorization: Bearer <token>  (admin+)
```

**Réponse :**
```json
{
  "totalQuotes": 25,
  "totalInvoices": 18,
  "totalReservations": 12,
  "totalClients": 45,
  "totalRevenue": 15420.50,
  "pendingRevenue": 3280.00,
  "monthRevenue": 5200.00,
  "todayRevenue": 480.00,
  "recentQuotes": [...],
  "recentInvoices": [...],
  "pendingReservations": [...]
}
```

### 10.2 Statistiques Avancées

```http
GET /api/mobile/admin/stats
Authorization: Bearer <token>  (admin+)
```

### 10.3 Analytics

```http
GET /api/admin/analytics
Authorization: Bearer <token>  (admin+)
```

**Query params optionnels :**
- `period` : `week` | `month` | `quarter` | `year`

### 10.4 Analytics Avancées

```http
GET /api/admin/advanced-analytics
Authorization: Bearer <token>  (admin+)
```

---

## 11. Gestion des Utilisateurs Admin

### 11.1 Lister les Utilisateurs

```http
GET /api/mobile/admin/users
Authorization: Bearer <token>  (admin+)
```

### 11.2 Détail d'un Utilisateur

```http
GET /api/mobile/admin/users/:id
Authorization: Bearer <token>  (admin+)
```

### 11.3 Créer un Utilisateur

```http
POST /api/mobile/admin/users
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "email": "client@example.fr",
  "password": "MotDePasse123!",
  "firstName": "Marie",
  "lastName": "Dupont",
  "phone": "06 12 34 56 78",
  "role": "client",
  "address": "12 Rue de la Paix",
  "postalCode": "75001",
  "city": "Paris"
}
```

### 11.4 Modifier un Utilisateur

```http
PATCH /api/mobile/admin/users/:id
Authorization: Bearer <token>  (admin+)
```

### 11.5 Supprimer un Utilisateur

```http
DELETE /api/mobile/admin/users/:id
Authorization: Bearer <token>  (admin+)
```

### 11.6 Créer un Client (Admin)

```http
POST /api/mobile/admin/clients
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

### 11.7 Documents d'un Client

```http
GET /api/mobile/admin/clients/:id/quotes
GET /api/mobile/admin/clients/:id/invoices
GET /api/mobile/admin/clients/:id/reservations
Authorization: Bearer <token>  (admin+)
```

---

## 12. Gestion des Services Admin

### 12.1 Lister Tous les Services

```http
GET /api/mobile/admin/services
Authorization: Bearer <token>  (admin+)
```

### 12.2 Créer un Service

```http
POST /api/mobile/admin/services
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "name": "Nouveau service",
  "description": "Description du service",
  "basePrice": "100.00",
  "estimatedDuration": 120,
  "category": "reparation",
  "isActive": true,
  "isVisibleToClients": true
}
```

### 12.3 Modifier un Service

```http
PATCH /api/mobile/admin/services/:id
Authorization: Bearer <token>  (admin+)
```

### 12.4 Supprimer un Service

```http
DELETE /api/mobile/admin/services/:id
Authorization: Bearer <token>  (admin+)
```

---

## 13. Workshop & Workflows

### 13.1 Lister les Workflows

```http
GET /api/admin/workflows
Authorization: Bearer <token>  (admin+)
```

### 13.2 Workshop Tasks (Suivi atelier)

```http
GET /api/admin/workshop/tasks/:reservationId
Authorization: Bearer <token>  (admin+)
```

### 13.3 Mettre à Jour une Tâche

```http
PATCH /api/workshop/tasks/:taskId
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "isCompleted": true,
  "comment": "Étape terminée avec succès"
}
```

---

## 14. Comptabilité & Dépenses

### 14.1 Lister les Dépenses

```http
GET /api/mobile/admin/expenses
Authorization: Bearer <token>  (admin+)
```

### 14.2 Détail d'une Dépense

```http
GET /api/mobile/admin/expenses/:id
Authorization: Bearer <token>  (admin+)
```

### 14.3 Créer une Dépense

```http
POST /api/mobile/admin/expenses
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "description": "Achat de peinture",
  "amount": "150.00",
  "amountHT": "125.00",
  "tvaAmount": "25.00",
  "tvaRate": "20.00",
  "categoryId": "uuid-category",
  "date": "2026-03-20",
  "paymentMethod": "card",
  "supplier": "Fournisseur XYZ",
  "notes": "Peinture pour jantes"
}
```

### 14.4 Modifier une Dépense

```http
PATCH /api/mobile/admin/expenses/:id
Authorization: Bearer <token>  (admin+)
```

### 14.5 Supprimer une Dépense

```http
DELETE /api/mobile/admin/expenses/:id
Authorization: Bearer <token>  (admin+)
```

### 14.6 Écritures Comptables

```http
GET /api/admin/accounting/entries
POST /api/admin/accounting/entries
PATCH /api/admin/accounting/entries/:id/validate
Authorization: Bearer <token>  (admin+)
```

### 14.7 Rapport TVA

```http
GET /api/admin/accounting/tva-report?year=2026&quarter=1
Authorization: Bearer <token>  (admin+)
```

### 14.8 Compte de Résultat (P&L)

```http
GET /api/admin/accounting/profit-loss?year=2026
Authorization: Bearer <token>  (admin+)
```

### 14.9 Export FEC

```http
POST /api/admin/accounting/fec-export
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "year": 2026,
  "startMonth": 1,
  "endMonth": 12
}
```

---

## 15. OCR & Scan de Documents

### 15.1 Scanner un Document (Mindee)

```http
POST /api/ocr/scan
Authorization: Bearer <token>  (admin+)
Content-Type: multipart/form-data
```

**FormData :**
- `file` : fichier image ou PDF

### 15.2 Scanner avec Vision AI (Gemini)

```http
POST /api/ocr/scan-vision
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### 15.3 Scanner une Carte Grise

```http
POST /api/ocr/scan-carte-grise
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData :**
- `file` : photo de la carte grise

**Réponse :**
```json
{
  "vehicleRegistration": "AB-123-CD",
  "vehicleMake": "Renault",
  "vehicleModel": "Clio",
  "vehicleVin": "VF1...",
  "vehicleColor": "Gris",
  "vehicleFuelType": "Essence",
  "vehicleFiscalPower": "5",
  "vehicleFirstRegDate": "15/03/2020"
}
```

### 15.4 Scanner une Plaque d'Immatriculation

```http
POST /api/ocr/scan-license-plate
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### 15.5 Historique OCR

```http
GET /api/mobile/admin/ocr/history
Authorization: Bearer <token>  (admin+)
```

### 15.6 Supprimer un Scan OCR

```http
DELETE /api/mobile/admin/ocr/history/:id
Authorization: Bearer <token>  (admin+)
```

### 15.7 Créer un Document depuis OCR

```http
POST /api/admin/ocr/create-quote
POST /api/admin/ocr/create-invoice
POST /api/admin/ocr/create-expense
Authorization: Bearer <token>  (admin+)
```

---

## 16. IA & Analyses

### 16.1 Analyse Globale (Devis, CA, Clients, Marges)

```http
POST /api/mobile/admin/ai/analyse
Authorization: Bearer <token>  (admin+)
```

**Réponse :** Analyse complète par l'IA avec recommandations.

### 16.2 Analyse Commerciale

```http
POST /api/mobile/admin/ai/commercial
Authorization: Bearer <token>  (admin+)
```

### 16.3 Analyse Croissance

```http
POST /api/mobile/admin/ai/growth
Authorization: Bearer <token>  (admin+)
```

### 16.4 Diagnostic Jante par Photo

```http
POST /api/mobile/admin/ai/wheel
Authorization: Bearer <token>  (admin+)
Content-Type: multipart/form-data
```

**FormData :**
- `image` : photo de la jante (JPG, PNG, WebP, HEIC — max 10 Mo)

**Réponse :**
```json
{
  "diagnosis": "Rayures profondes et éclats sur la surface",
  "servicesRequis": ["Réparation de jantes", "Peinture jantes"],
  "prixTotalEstime": "150.00",
  "recommandation": "Réparation recommandée avant dégradation"
}
```

### 16.5 Inspection Multi-Photos

```http
POST /api/mobile/admin/ai/wheel/multi
Authorization: Bearer <token>  (admin+)
Content-Type: multipart/form-data
```

**FormData :**
- `images` : plusieurs photos (max 4)

---

## 17. Galerie Média

### 17.1 Lister la Galerie

```http
GET /api/gallery?page=1&limit=20&type=image
Authorization: Bearer <token>  (admin+)
```

### 17.2 Suppression en Masse

```http
POST /api/gallery/bulk-delete
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "ids": ["uuid-1", "uuid-2"]
}
```

### 17.3 Upload Multiple

```http
POST /api/gallery/bulk-upload
Authorization: Bearer <token>  (admin+)
Content-Type: multipart/form-data
```

**FormData :**
- `files` : jusqu'à 20 fichiers

### 17.4 Assigner Média à une Entité

```http
POST /api/gallery/assign
Authorization: Bearer <token>  (admin+)
```

### 17.5 Export Galerie (ZIP)

```http
GET /api/gallery/export
Authorization: Bearer <token>  (admin+)
```

### 17.6 Import Galerie (ZIP)

```http
POST /api/gallery/import
Authorization: Bearer <token>  (admin+)
Content-Type: multipart/form-data
```

---

## 18. SMS

### 18.1 Historique SMS

```http
GET /api/mobile/admin/sms/logs
Authorization: Bearer <token>  (admin+)
```

### 18.2 Envoyer un SMS

```http
POST /api/mobile/admin/sms/send
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

**Body :**
```json
{
  "to": "+33612345678",
  "message": "Votre véhicule est prêt !"
}
```

---

## 19. Avis Clients (Reviews)

### 19.1 Lister les Avis (Admin)

```http
GET /api/mobile/admin/reviews
Authorization: Bearer <token>  (admin+)
```

### 19.2 Approuver un Avis

```http
PATCH /api/mobile/admin/reviews/:id/approve
Authorization: Bearer <token>  (admin+)
```

### 19.3 Supprimer un Avis

```http
DELETE /api/mobile/admin/reviews/:id
Authorization: Bearer <token>  (admin+)
```

### 19.4 Soumettre un Avis (Public)

```http
POST /api/public/reviews/:token
Content-Type: application/json
```

**Body :**
```json
{
  "rating": 5,
  "comment": "Excellent travail, jantes comme neuves !",
  "clientName": "Jean Martin"
}
```

---

## 20. Exports

### 20.1 Exporter les Devis (CSV)

```http
GET /api/mobile/admin/export/quotes?format=csv
Authorization: Bearer <token>  (admin+)
```

### 20.2 Exporter les Factures (CSV)

```http
GET /api/mobile/admin/export/invoices?format=csv
Authorization: Bearer <token>  (admin+)
```

---

## 21. Quotas & Abonnements

### 21.1 Statut Quotas du Garage

```http
GET /api/mobile/admin/quotas
Authorization: Bearer <token>  (admin+)
```

**Réponse :**
```json
{
  "plan": {
    "name": "Pro",
    "slug": "pro",
    "quotas": {
      "storageGb": 20,
      "aiCredits": 500,
      "smsMonthly": 200,
      "ocrMonthly": 100
    }
  },
  "usage": {
    "storageGb": 3.5,
    "aiCredits": 42,
    "smsMonthly": 15,
    "ocrMonthly": 8
  }
}
```

### 21.2 Lister les Plans (Public)

```http
GET /api/mobile/plans
```

---

## 22. Paramètres & Configuration

### 22.1 Obtenir les Paramètres

```http
GET /api/admin/settings
Authorization: Bearer <token>  (admin+)
```

**Réponse :**
```json
{
  "id": "uuid",
  "defaultTaxRate": "20.00",
  "companyName": "MyTools",
  "companyTagline": "Spécialiste jantes",
  "companyAddress": "12 Rue de la Paix",
  "companyCity": "Paris",
  "companyPhone": "01 23 45 67 89",
  "companyEmail": "contact@mytools-app.com",
  "companyWebsite": "https://mytoolsgroup.eu",
  "companySiret": "12345678901234",
  "companyTvaNumber": "FR12345678901",
  "customFields": [...]
}
```

### 22.2 Mettre à Jour les Paramètres

```http
PATCH /api/mobile/admin/settings
Authorization: Bearer <token>  (admin+)
Content-Type: application/json
```

### 22.3 Configuration du Garage

```http
GET /api/admin/garage
PATCH /api/admin/garage
Authorization: Bearer <token>  (admin+)
```

**Champs modifiables :**
- `stripePublishableKey`, `stripeSecretKey`, `stripeWebhookSecret`
- `resendApiKey`, `resendFromEmail`
- `twilioAccountSid`, `twilioAuthToken`, `twilioPhoneNumber`
- `mindeeApiKey`
- `googleReviewsPlaceId`, `googleReviewsApiKey`
- `activityType` : `jantes` | `mecanique` | `carrosserie` | `detailing` | `pneus` | `multiservice`
- `isPilot` : `true` | `false`

---

## 23. Garage Management (Superadmin)

### 23.1 Lister les Garages

```http
GET /api/superadmin/garages
Authorization: Bearer <token>  (superadmin+)
```

### 23.2 Créer un Garage

```http
POST /api/superadmin/garages
Authorization: Bearer <token>  (superadmin+)
```

### 23.3 Modifier un Garage

```http
PATCH /api/superadmin/garages/:id
Authorization: Bearer <token>  (superadmin+)
```

### 23.4 Supprimer un Garage

```http
DELETE /api/superadmin/garages/:id
Authorization: Bearer <token>  (superadmin+)
```

### 23.5 Utilisateurs d'un Garage

```http
GET /api/superadmin/garages/:id/users
Authorization: Bearer <token>  (superadmin+)
```

### 23.6 Assigner Utilisateur à un Garage

```http
POST /api/superadmin/garages/:garageId/users/:userId
Authorization: Bearer <token>  (superadmin+)
```

### 23.7 Retirer Utilisateur d'un Garage

```http
DELETE /api/superadmin/garages/:garageId/users/:userId
Authorization: Bearer <token>  (superadmin+)
```

### 23.8 Statistiques Multi-Garages

```http
GET /api/superadmin/garage-stats
Authorization: Bearer <token>  (superadmin+)
```

### 23.9 Sélectionner un Garage (Session)

```http
POST /api/superadmin/select-garage
Authorization: Bearer <token>  (superadmin+)
Content-Type: application/json
```

**Body :**
```json
{ "garageId": "uuid-garage" }
```

### 23.10 Abonnement d'un Garage

```http
PUT /api/superadmin/garages/:id/subscription
Authorization: Bearer <token>  (superadmin+)
Content-Type: application/json
```

**Body :**
```json
{
  "subscriptionPlanId": "uuid-plan",
  "featureOverrides": { "ai": true, "sms": false }
}
```

### 23.11 Plans d'Abonnement (Rootadmin)

```http
GET /api/superadmin/subscription-plans
POST /api/rootadmin/subscription-plans
PATCH /api/rootadmin/subscription-plans/:id
DELETE /api/rootadmin/subscription-plans/:id
```

### 23.12 Logs Applicatifs (Rootadmin)

```http
GET /api/rootadmin/app-logs?limit=200&offset=0&entityType=quote&action=created
Authorization: Bearer <token>  (rootadmin)
```

### 23.13 Changer le Rôle d'un Utilisateur (Rootadmin)

```http
PATCH /api/rootadmin/users/:userId/role
Authorization: Bearer <token>  (rootadmin)
Content-Type: application/json
```

**Body :**
```json
{ "role": "superadmin" }
```

---

## 24. Routes Publiques (Sans Auth)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/public/garages` | Liste des garages actifs (id, name, city, slug) |
| GET | `/api/public/plans` | Plans d'abonnement actifs |
| GET | `/api/public/quotes/:token` | Voir un devis via lien public |
| POST | `/api/public/quotes/:token/accept` | Accepter un devis |
| GET | `/api/public/invoices/:token` | Voir une facture via lien public |
| POST | `/api/public/reviews/:token` | Soumettre un avis client |
| GET | `/api/users/check-email?email=...` | Vérifier si un email existe |
| GET | `/api/mobile/public/siret-lookup?siret=...` | Recherche SIRET |
| GET | `/api/mobile/public/firebase-config` | Config Firebase |
| GET | `/api/mobile/plans` | Plans d'abonnement |

---

## 25. Upload de Fichiers

### 25.1 Upload Générique

```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData :**
- `file` : fichier (max 10 Mo)
- `folder` : dossier de destination (optionnel)

**Réponse :**
```json
{
  "url": "/objects/uploads/uuid-xxx",
  "fileName": "photo.jpg",
  "fileSize": 245000
}
```

### 25.2 Upload via API v2

```http
POST /api/v2/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### 25.3 Accéder à un Fichier

```http
GET /uploads/:filename
GET /r2/*
GET /objects/:path
```

---

## 26. WebSocket (Temps Réel)

### 26.1 Obtenir un Token WebSocket

```http
POST /api/ws/auth-token
Authorization: Bearer <token>
```

**Réponse :**
```json
{ "token": "ws_auth_token_xxx" }
```

### 26.2 Connexion WebSocket

```javascript
const ws = new WebSocket('wss://BASE_URL');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'ws_auth_token_xxx'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'notification':
      // Nouvelle notification
      break;
    case 'chat_message':
      // Nouveau message chat
      break;
    case 'quote_update':
      // Mise à jour d'un devis
      break;
  }
};
```

---

## 27. Modèles de Données

### User (Utilisateur)

```typescript
{
  id: string;              // UUID
  email: string;           // Unique
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  profileImageUrl?: string;
  role: "client" | "client_professionnel" | "employe" | "admin" | "superadmin" | "rootadmin";
  garageId?: string;       // UUID du garage rattaché
  companyName?: string;    // Pour client_professionnel
  siret?: string;
  tvaNumber?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string; // Défaut: "FR"
  smsConsent: boolean;
  is2FAEnabled: boolean;
  isEmailVerified: boolean;
  createdAt: string;       // ISO 8601
  updatedAt: string;
}
```

### Garage

```typescript
{
  id: string;
  name: string;
  slug: string;             // URL-friendly (unique)
  logo?: string;
  primaryColor: string;     // Défaut: "#dc2626"
  secondaryColor: string;   // Défaut: "#1f2937"
  tagline?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  siren?: string;
  siret?: string;
  tvaNumber?: string;
  iban?: string;
  swift?: string;
  bankName?: string;
  legalForm?: string;
  country: string;          // Défaut: "FR"
  trigramme: string;        // 3 lettres (ex: "AJP")
  defaultTaxRate: string;   // Défaut: "20.00"
  activityType: string;     // "jantes" | "mecanique" | etc.
  isPilot: boolean;
  isActive: boolean;
  subscriptionPlanId?: string;
  simulatorSettings: object;
  createdAt: string;
  updatedAt: string;
}
```

### Quote (Devis)

```typescript
{
  id: string;
  garageId?: string;
  reference: string;        // Format: "DEV-MM-NNNNN"
  clientId: string;
  serviceId: string;
  status: "pending" | "approved" | "accepted" | "rejected" | "completed";
  paymentMethod: "cash" | "wire_transfer" | "card" | "stripe" | "sepa" | "klarna" | "alma";
  quoteAmount?: string;     // Montant TTC
  priceExcludingTax?: string;
  taxRate?: string;
  taxAmount?: string;
  productDetails?: string;
  notes?: string;
  validUntil?: string;
  viewToken?: string;
  vehicleRegistration?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleVin?: string;
  vehicleColor?: string;
  customFieldValues?: object;
  createdAt: string;
  updatedAt: string;
}
```

### QuoteItem / InvoiceItem (Ligne)

```typescript
{
  id: string;
  quoteId: string;          // ou invoiceId
  description: string;
  quantity: string;          // Décimal
  unitPriceExcludingTax: string;
  totalExcludingTax: string;
  taxRate: string;
  taxAmount: string;
  totalIncludingTax: string;
}
```

### Invoice (Facture)

```typescript
{
  id: string;
  garageId?: string;
  quoteId?: string;
  clientId: string;
  invoiceNumber: string;    // Format: "FAC-MM-NNNNN"
  amount: string;           // Montant TTC
  paymentMethod: "cash" | "wire_transfer" | "card" | "stripe" | "sepa" | "klarna" | "alma";
  priceExcludingTax?: string;
  taxRate?: string;
  taxAmount?: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  dueDate?: string;
  paidAt?: string;
  paymentLink?: string;
  viewToken?: string;
  notes?: string;
  customFieldValues?: object;
  createdAt: string;
  updatedAt: string;
}
```

### Reservation

```typescript
{
  id: string;
  reference: string;        // Format: "RES-MM-NNNNN"
  garageId?: string;
  quoteId?: string;
  clientId: string;
  serviceId: string;
  assignedEmployeeId?: string;
  scheduledDate: string;     // ISO 8601
  estimatedEndDate?: string;
  priceExcludingTax?: string;
  taxRate?: string;
  taxAmount?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Notification

```typescript
{
  id: string;
  userId: string;
  type: "quote" | "invoice" | "reservation" | "service" | "chat";
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}
```

### Service

```typescript
{
  id: string;
  garageId?: string;
  name: string;
  description?: string;
  basePrice?: string;
  category?: string;
  isActive: boolean;
  isVisibleToClients: boolean;
  estimatedDuration?: number; // En minutes
  imageUrl?: string;
  customFormFields?: object;
  createdAt: string;
  updatedAt: string;
}
```

### SubscriptionPlan

```typescript
{
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: string;
  billingPeriod: string;     // "monthly" | "yearly"
  features: {
    quotes: boolean;
    invoices: boolean;
    calendar: boolean;
    ai: boolean;
    chat: boolean;
    sms: boolean;
    analytics: boolean;
    multiGarage: boolean;
  };
  quotas: {
    storageGb: number;
    aiCredits: number;
    smsMonthly: number;
    ocrMonthly: number;
  };
  sortOrder: number;
  isActive: boolean;
}
```

---

## 28. Gestion des Erreurs

### Codes HTTP

| Code | Signification | Action recommandée |
|------|--------------|-------------------|
| 200 | Succès | Traiter la réponse |
| 201 | Créé avec succès | Traiter la réponse |
| 400 | Données invalides | Vérifier le body |
| 401 | Non authentifié / token expiré | Refresh → si échec → login |
| 403 | Accès refusé (rôle insuffisant) | Vérifier les permissions |
| 404 | Ressource introuvable | Vérifier l'ID |
| 422 | Validation Zod échouée | Corriger les champs |
| 500 | Erreur serveur | Réessayer |

### Format d'Erreur Standard

```json
{
  "message": "Description de l'erreur en français"
}
```

### Erreurs de Validation (Zod)

```json
{
  "message": "Invalid data",
  "errors": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["email"],
      "message": "Required"
    }
  ]
}
```

---

## 29. CORS & Sécurité

### Domaines Autorisés

| Domaine | Statut |
|---------|--------|
| `*.replit.dev` / `*.replit.app` | Autorisé |
| `*.mytoolsgroup.eu` | Autorisé |
| `*mytoolsgroup*` | Autorisé |
| `localhost` / `127.0.0.1` | Autorisé (dev) |
| `CORS_ALLOWED_ORIGINS` (env var) | Autorisé |

### Recommandations Mobile

- Stocker les tokens dans `SecureStore` (Expo) ou `Keychain` (iOS) / `EncryptedSharedPreferences` (Android)
- Implémenter le refresh automatique en intercepteur HTTP
- Ne jamais logger les tokens en production
- Utiliser HTTPS uniquement

---

## 30. Guide d'Implémentation Mobile (React Native)

### 30.1 Structure de Projet Recommandée

```
mobile-app/
├── src/
│   ├── api/
│   │   ├── client.ts         # Client HTTP avec intercepteur JWT
│   │   ├── auth.ts           # Login, register, refresh
│   │   ├── quotes.ts         # CRUD devis
│   │   ├── invoices.ts       # CRUD factures
│   │   ├── reservations.ts   # CRUD réservations
│   │   ├── services.ts       # Liste services
│   │   ├── notifications.ts  # Notifications
│   │   ├── users.ts          # Gestion utilisateurs (admin)
│   │   ├── dashboard.ts      # Stats admin
│   │   ├── ai.ts             # Analyse IA
│   │   ├── ocr.ts            # Scan documents
│   │   └── chat.ts           # Messagerie
│   ├── contexts/
│   │   ├── AuthContext.tsx    # État auth global
│   │   └── NotificationContext.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── client/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── QuotesScreen.tsx
│   │   │   ├── InvoicesScreen.tsx
│   │   │   ├── ReservationsScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   ├── admin/
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── QuoteManagementScreen.tsx
│   │   │   ├── InvoiceManagementScreen.tsx
│   │   │   ├── CalendarScreen.tsx
│   │   │   ├── UserManagementScreen.tsx
│   │   │   ├── AIAnalysisScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── shared/
│   │       ├── NotificationsScreen.tsx
│   │       └── ChatScreen.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useQuotes.ts
│   │   └── useNotifications.ts
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── ClientNavigator.tsx
│   │   └── AdminNavigator.tsx
│   └── utils/
│       ├── storage.ts        # SecureStore wrapper
│       └── formatters.ts     # Format dates, montants
├── app.json
└── package.json
```

### 30.2 Client HTTP avec Intercepteur JWT

```typescript
// src/api/client.ts
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://dd20d7f3-9c98-493c-8f24-3ef35da74c15-00-2rlisv3hu3wjz.kirk.replit.dev';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export async function initTokens() {
  accessToken = await SecureStore.getItemAsync('accessToken');
  refreshToken = await SecureStore.getItemAsync('refreshToken');
}

export async function saveTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  await SecureStore.setItemAsync('accessToken', access);
  await SecureStore.setItemAsync('refreshToken', refresh);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/api/mobile/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await clearTokens();
    throw new Error('Session expired');
  }

  const data = await res.json();
  await saveTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function apiRequest<T = any>(
  method: string,
  path: string,
  body?: any,
  isFormData = false
): Promise<T> {
  const headers: Record<string, string> = {};

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Token expiré : refresh et retry
  if (res.status === 401 && refreshToken) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        refreshQueue.forEach(cb => cb(newToken));
        refreshQueue = [];
      } catch {
        isRefreshing = false;
        refreshQueue = [];
        throw new Error('Session expired');
      }
    } else {
      // Attendre le refresh en cours
      await new Promise<string>(resolve => refreshQueue.push(resolve));
    }

    headers['Authorization'] = `Bearer ${accessToken}`;
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Error ${res.status}` }));
    throw { status: res.status, message: error.message, data: error };
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Raccourcis
export const api = {
  get: <T = any>(path: string) => apiRequest<T>('GET', path),
  post: <T = any>(path: string, body?: any) => apiRequest<T>('POST', path, body),
  patch: <T = any>(path: string, body?: any) => apiRequest<T>('PATCH', path, body),
  delete: <T = any>(path: string) => apiRequest<T>('DELETE', path),
  upload: <T = any>(path: string, formData: FormData) =>
    apiRequest<T>('POST', path, formData, true),
};
```

### 30.3 Contexte d'Authentification

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, saveTokens, clearTokens, initTokens } from '../api/client';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  garageId?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await initTokens();
      try {
        const profile = await api.get('/api/mobile/profile');
        setUser(profile);
      } catch {
        // Pas connecté
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/mobile/auth/login', { email, password });
    await saveTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await clearTokens();
    setUser(null);
  };

  const isAdmin = ['admin', 'superadmin', 'rootadmin'].includes(user?.role || '');

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 30.4 Hook pour les Devis

```typescript
// src/hooks/useQuotes.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function useQuotes() {
  const { isAdmin } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const path = isAdmin ? '/api/mobile/admin/quotes' : '/api/mobile/quotes';
      const data = await api.get(path);
      setQuotes(data);
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/api/mobile/admin/quotes/${id}/status`, { status });
    await fetchQuotes();
  };

  const convertToInvoice = async (quoteId: string) => {
    const result = await api.post(`/api/mobile/admin/quotes/${quoteId}/convert-to-invoice`);
    await fetchQuotes();
    return result;
  };

  return { quotes, loading, fetchQuotes, updateStatus, convertToInvoice };
}
```

### 30.5 Navigation par Rôle

```typescript
// src/navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { ClientNavigator } from './ClientNavigator';
import { AdminNavigator } from './AdminNavigator';
import { LoadingScreen } from '../screens/shared/LoadingScreen';

export function AppNavigator() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : isAdmin ? (
        <AdminNavigator />
      ) : (
        <ClientNavigator />
      )}
    </NavigationContainer>
  );
}
```

### 30.6 Dépendances Recommandées

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-camera": "~16.0.0",
    "expo-file-system": "~18.0.0",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "@react-navigation/stack": "^7.0.0",
    "react-native-safe-area-context": "^5.0.0",
    "react-native-screens": "^4.0.0",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^4.0.0",
    "react-native-reanimated": "^3.0.0"
  }
}
```

### 30.7 Checklist Fonctionnalités par Rôle

#### Client
- [ ] Login / Register / Mot de passe oublié
- [ ] Voir mon profil + modifier + avatar
- [ ] Lister mes devis + détail + PDF
- [ ] Créer un devis avec photos
- [ ] Lister mes factures + détail + PDF
- [ ] Lister mes réservations + détail
- [ ] Notifications (badge + liste + marquer lu)
- [ ] Chat avec le garage
- [ ] Scanner carte grise (OCR)
- [ ] Simulateur jantes

#### Admin
- [ ] Dashboard avec stats
- [ ] CRUD complet devis (créer, modifier, statut, email, items, media)
- [ ] CRUD complet factures (créer directe, convertir devis, statut, items)
- [ ] CRUD réservations + calendrier
- [ ] Gestion utilisateurs (créer, modifier, supprimer)
- [ ] Gestion services
- [ ] Workshop / suivi atelier
- [ ] Dépenses / comptabilité
- [ ] OCR documents
- [ ] IA : analyse globale, commerciale, croissance, diagnostic jante
- [ ] SMS : envoi + historique
- [ ] Avis clients : approuver, supprimer
- [ ] Galerie média
- [ ] Paramètres garage
- [ ] Exports CSV

#### Superadmin
- [ ] Gestion multi-garages
- [ ] Sélection garage actif
- [ ] Statistiques cross-garages
- [ ] Gestion abonnements
- [ ] Assignation utilisateurs aux garages

---

## Comptes de Démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| `rootadmin@mytools-app.com` | `Root@2024!` | rootadmin |
| `superadmin@mytools-app.com` | `Super@2024!` | superadmin |
| `admin.paris@autojantes.fr` | `Admin@Paris2024!` | admin (Paris) |
| `admin.lyon@jantesco.fr` | `Admin@Lyon2024!` | admin (Lyon) |
| `admin.bordeaux@elitewheels.fr` | `Admin@Bordeaux2024!` | admin (Bordeaux) |
| `technicien@autojantes-paris.fr` | `Employe@2024!` | employe |
| `jean.martin@email.fr` | `Client@2024!` | client |
| `sophie.dubois@email.fr` | `Client@2024!` | client |
| `pro@autocenter.fr` | `Client@2024!` | client_professionnel |

---

## API v2 (Endpoints Alternatifs)

L'API v2 est disponible sous `/api/v2` et suit un pattern Controller/Service/Repository.

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/health` | Status API (version, timestamp) |
| POST | `/api/v2/auth/login` | Login (rate limited) |
| POST | `/api/v2/auth/refresh` | Refresh token |
| GET | `/api/v2/auth/me` | Profil connecté |
| GET/POST | `/api/v2/quotes` | Liste / Créer devis |
| GET/PATCH/DELETE | `/api/v2/quotes/:id` | Détail / Modifier / Supprimer |
| PATCH | `/api/v2/quotes/:id/status` | Changer statut |
| POST/DELETE | `/api/v2/quotes/:id/items` | Ajouter / Supprimer item |
| GET/POST | `/api/v2/invoices` | Liste / Créer factures |
| GET/PATCH/DELETE | `/api/v2/invoices/:id` | Détail / Modifier / Supprimer |
| PATCH | `/api/v2/invoices/:id/status` | Changer statut |
| GET | `/api/v2/reservations` | Liste réservations |
| GET | `/api/v2/reservations/:id` | Détail réservation |
| GET | `/api/v2/notifications` | Liste notifications |
| GET | `/api/v2/notifications/unread-count` | Compteur non-lus |
| PATCH | `/api/v2/notifications/:id/read` | Marquer lue |
| POST | `/api/v2/uploads` | Upload fichier |

---

*MyTools App — Documentation API Mobile Complète v4.0 — Mars 2026*
*JWT Bearer | CORS multi-domaine | Refresh automatique | WebSocket temps réel*
