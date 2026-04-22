# Prompt de synchronisation — Agent Backend MyToolsApp

> Ce fichier est un prompt structuré à copier-coller à un agent IA ou développeur backend pour synchroniser l'état de l'API externe (`app-backend.mytoolsgroup.eu`) avec les besoins du frontend mobile MyToolsApp v2.

---

## Contexte du projet

**Frontend :** Application mobile Expo React Native (iOS + Android), SDK 54, TypeScript.  
**Backend proxy local :** Express.js sur port 5000 (`server/routes.ts`), sert de proxy vers l'API externe.  
**API externe :** `https://app-backend.mytoolsgroup.eu/api` — c'est le backend dont tu es responsable.  
**Utilisateurs :** Administrateurs de garages partenaires MyTools Group.  
**Langue de l'interface :** Français professionnel.

---

## Architecture de communication

```
[App Mobile / Web]
       ↓  HTTP
[Proxy Express :5000]   ← server/routes.ts
       ↓  HTTPS
[app-backend.mytoolsgroup.eu/api]  ← TON API
```

Le proxy essaie toujours `/mobile/admin/{endpoint}` en premier, puis `/admin/{endpoint}` en fallback.  
Les tokens d'authentification sont transmis via le header `Authorization: Bearer <token>`.

---

## Endpoints requis par l'application mobile

### AUTH

| Méthode | Endpoint | Corps | Réponse attendue |
|---------|----------|-------|-----------------|
| POST | `/mobile/auth/login` | `{ email, password }` | `{ accessToken, refreshToken, user: { id, email, firstName, lastName, role, garageId } }` |
| POST | `/mobile/auth/register` | `{ email, password, firstName, lastName, garageName, ... }` | `{ accessToken, refreshToken, user }` |
| POST | `/mobile/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/mobile/auth/social` | `{ idToken, provider: "google"\|"apple" }` | `{ accessToken, refreshToken, user }` |
| GET | `/mobile/auth/me` | — | `{ id, email, firstName, lastName, role, garageId }` |
| DELETE | `/api/users/me` | — | `{ success: true }` |

---

### DEVIS (Quotes)

| Méthode | Endpoint | Corps | Réponse attendue |
|---------|----------|-------|-----------------|
| GET | `/mobile/admin/quotes` | — | `Array<Quote>` |
| GET | `/mobile/admin/quotes/:id` | — | `Quote` |
| POST | `/mobile/admin/quotes` | `QuoteBody` | `Quote` (avec `id`) |
| PATCH | `/mobile/admin/quotes/:id` | `Partial<QuoteBody>` | `Quote` ou `{ success: true }` |
| DELETE | `/mobile/admin/quotes/:id` | — | `{ success: true }` |
| POST | `/mobile/admin/quotes/:id/media` | `FormData (media[])` | `{ success: true, urls: string[] }` |
| GET | `/mobile/admin/quotes/:id/pdf` | — | `application/pdf` |

**Structure `QuoteBody`** (tous les champs doivent être persistés) :
```typescript
{
  clientId: string;
  status?: "draft" | "sent" | "accepted" | "rejected";
  quoteAmount?: number;           // TTC
  priceExcludingTax?: number;     // HT
  total_excluding_tax?: number;   // HT (alias)
  total_including_tax?: number;   // TTC (alias)
  amount?: number;                // TTC (alias)
  taxRate?: number;
  serviceId?: string;
  notes?: string;
  items?: LineItem[];             // CRITIQUE: doit être persisté !
  lineItems?: LineItem[];         // alias de items
}
```

**Structure `LineItem`** :
```typescript
{
  description: string;
  quantity: number;
  unit_price_excluding_tax: string;  // ou unitPriceExcludingTax
  tax_rate: string;                   // ou taxRate (pourcentage : "20")
  total_excluding_tax?: string;
  total_including_tax?: string;
  tax_amount?: string;
}
```

**Structure `Quote` retournée** :
```typescript
{
  id: string | number;
  clientId: string;
  clientFirstName?: string;
  clientLastName?: string;
  status: string;
  quoteNumber?: string;
  quoteAmount: string | number;       // TTC
  priceExcludingTax: string | number; // HT
  items: LineItem[];                  // CRITIQUE: doit être retourné !
  lineItems: LineItem[];              // alias
  createdAt: string;                  // ISO 8601
  updatedAt: string;
}
```

---

### FACTURES (Invoices)

Même structure que les devis, remplacer `quotes` par `invoices` dans les endpoints.

Champs supplémentaires :
```typescript
{
  paymentMethod?: "wire_transfer" | "card" | "cash" | "sepa" | "stripe" | "klarna" | "alma";
  dueDate?: string;     // ISO 8601
  issueDate?: string;   // ISO 8601
  paidAt?: string;      // ISO 8601
}
```

---

### RÉSERVATIONS (Reservations)

| Méthode | Endpoint | Corps | Réponse attendue |
|---------|----------|-------|-----------------|
| GET | `/mobile/admin/reservations` | — | `Array<Reservation>` |
| GET | `/mobile/admin/reservations/:id` | — | `Reservation` |
| POST | `/mobile/admin/reservations` | `ReservationBody` | `Reservation` (avec `id`) |
| PATCH | `/mobile/admin/reservations/:id` | `Partial<ReservationBody>` | `Reservation` ou `{ success: true }` |
| DELETE | `/mobile/admin/reservations/:id` | — | `{ success: true }` |
| PATCH | `/mobile/admin/reservations/:id/status` | `{ status: string }` | `Reservation` |
| GET | `/mobile/admin/reservations/:id/services` | — | `Array<Service>` |

**Structure `ReservationBody`** :
```typescript
{
  clientId: string;
  serviceId?: string;
  serviceIds?: string[];
  scheduledDate: string;      // ISO 8601 — CRITIQUE: format datetime complet
  date?: string;              // alias scheduledDate
  estimatedEndDate?: string;  // ISO 8601
  endDate?: string;           // alias estimatedEndDate
  status?: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string;
  quoteId?: string;
  serviceType?: string;
}
```

**Structure `Reservation` retournée** :
```typescript
{
  id: string | number;
  clientId: string;
  clientFirstName?: string;
  clientLastName?: string;
  serviceId?: string;
  serviceIds?: string[];
  scheduledDate: string;     // ISO 8601 — CRITIQUE: format ISO obligatoire
  estimatedEndDate?: string; // ISO 8601
  status: string;
  notes?: string;
  quoteId?: string;
  quoteReference?: string;
  serviceType?: string;
  createdAt: string;
}
```

> ⚠️ **CRITIQUE — Dates de réservation :**  
> Les dates `scheduledDate` et `estimatedEndDate` doivent être retournées au format **ISO 8601 complet** : `"2026-04-22T09:00:00.000Z"`.  
> Un format non-ISO (timestamp Unix, format `DD/MM/YYYY`, etc.) provoque une erreur `toISOString is not a function` dans l'application.

---

### CLIENTS

| Méthode | Endpoint | Corps |
|---------|----------|-------|
| GET | `/mobile/admin/clients` | — |
| GET | `/mobile/admin/clients/:id` | — |
| POST | `/mobile/admin/clients` | `ClientBody` |
| PATCH | `/mobile/admin/clients/:id` | `Partial<ClientBody>` |
| DELETE | `/mobile/admin/clients/:id` | — |
| GET | `/mobile/admin/clients/:id/reservations` | — |

**Structure `Client`** :
```typescript
{
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt: string;
}
```

---

### SERVICES

| Méthode | Endpoint |
|---------|----------|
| GET | `/mobile/admin/services` |
| GET | `/mobile/admin/services/:id` |
| POST | `/mobile/admin/services` |
| PATCH | `/mobile/admin/services/:id` |
| DELETE | `/mobile/admin/services/:id` |

**Structure `Service`** :
```typescript
{
  id: string | number;
  name: string;
  description?: string;
  price?: number;
  duration?: number; // minutes
}
```

---

### UTILISATEURS / ÉQUIPE

| Méthode | Endpoint |
|---------|----------|
| GET | `/mobile/admin/users` |
| GET | `/mobile/admin/users/:id` |
| POST | `/mobile/admin/users` |
| PATCH | `/mobile/admin/users/:id` |
| DELETE | `/mobile/admin/users/:id` |

---

### ANALYTICS / TABLEAU DE BORD

| Méthode | Endpoint | Réponse |
|---------|----------|---------|
| GET | `/mobile/admin/analytics` | `{ totalRevenue, monthlyRevenue, pendingQuotes, pendingInvoices, todayReservations, ... }` |
| GET | `/mobile/admin/analytics/revenue` | `Array<{ month: string, amount: number }>` |

---

## Règles de comportement API critiques

### 1. Format des montants
- Retourner les montants en `string` ou `number` — le frontend accepte les deux.
- Champs prioritaires : `quoteAmount` (TTC), `priceExcludingTax` (HT), `amount` (TTC alias).
- Ne **pas** retourner `0` ou `null` si les montants sont définis — cela déclenche le fallback vers la base locale.

### 2. Persistence des lignes (`items`)
- Quand un PATCH sur `/quotes/:id` ou `/invoices/:id` inclut un champ `items` ou `lineItems`, ce tableau **doit** être persisté et retourné dans les GETs suivants.
- C'est la fonctionnalité la plus critique de l'app (modification de devis/factures).

### 3. Format des dates
- **Toujours ISO 8601** : `"2026-04-22T09:00:00.000Z"` ou `"2026-04-22T09:00:00+02:00"`.
- Jamais de timestamps Unix (nombre), jamais de `DD/MM/YYYY`.

### 4. IDs
- L'app accepte `string` ou `number` mais préfère les avoir consistent.
- Après un POST, l'objet retourné **doit** contenir un champ `id`.

### 5. Réponses d'erreur
```typescript
// Format attendu pour les erreurs 4xx/5xx :
{
  message: string;  // message d'erreur lisible
  errors?: Record<string, string[]>;  // détails de validation
}
```

### 6. Headers CORS
L'app en développement tourne sur `localhost:8081`. S'assurer que CORS autorise :
- `Origin: http://localhost:8081`
- `Origin: https://*.replit.app`
- `Origin: https://*.replit.dev`
- Et l'origine de production si applicable

---

## Points de friction connus (à corriger côté backend)

| Problème observé | Cause suspectée | Fix |
|----------------|----------------|-----|
| Items de devis/facture non sauvegardés | PATCH retourne du non-JSON (ex: `"Updated"`) | Retourner toujours du JSON : `{ "id": 123, "status": "ok" }` |
| Erreur `toISOString` sur réservations | `scheduledDate` retourné en format non-ISO | Forcer ISO 8601 sur toutes les dates |
| Montants à 0 après modification | PATCH ne retourne pas l'objet mis à jour | Retourner l'objet complet après PATCH |
| Chargement infini sur listes | Endpoint retourne `{ data: [] }` au lieu de `[]` | Les deux formats sont supportés — vérifier `data.data || data` |

---

## Variables d'environnement (proxy local)

Ces variables sont dans `server/routes.ts` / `lib/config.ts` :

```
EXPO_PUBLIC_API_URL=       # Surchargé pour pointer vers une URL custom
```

L'URL par défaut est `https://app-backend.mytoolsgroup.eu`. Fallback statique : `https://mytoolsapp-backend.mytoolsgroup.eu`.

---

## Commandes utiles (côté proxy local)

```bash
# Démarrer le backend proxy
npm run server:dev

# Voir les logs du proxy (filtrer sur les erreurs admin)
# Dans les logs du workflow "Start Backend", chercher :
# [MOBILE-ADMIN] PATCH /quotes/123 => 200
# [AMOUNTS] Saved quote 123: HT=... TTC=... items=3
# [MOBILE-ADMIN-ERR] => 4xx: ...
```

---

## Checklist de synchronisation

```
[ ] Tous les endpoints /mobile/admin/* sont implémentés
[ ] PATCH /quotes/:id et /invoices/:id retournent du JSON (même minimal)
[ ] scheduledDate dans les réservations est en ISO 8601
[ ] Les items/lineItems sont persistés et retournés dans les GETs
[ ] Après un POST, l'objet retourné contient un champ `id`
[ ] Les montants (amount, quoteAmount, priceExcludingTax) sont présents et non nuls
[ ] DELETE /api/users/me est implémenté (obligatoire Apple App Store)
[ ] Les headers CORS sont configurés pour les origines du frontend
[ ] Le refresh token fonctionne (POST /mobile/auth/refresh)
[ ] L'Apple Sign In (provider: "apple") est supporté dans POST /mobile/auth/social
```
