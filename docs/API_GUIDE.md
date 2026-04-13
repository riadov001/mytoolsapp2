# MyTools App — API Usage Guide

**Last Updated**: March 20, 2026  
**Status**: V1 (Stable) + V2 (In Development)

---

## Overview

MyTools App provides two API versions:
- **V1 API** (`/api/*`): Stable, production-ready, 335+ routes
- **V2 API** (`/api/v2/*`): Modern clean architecture (in development)

Both run simultaneously. V1 is fully backward-compatible; V2 is being built alongside.

---

## V1 API (Production-Ready)

### Authentication

#### Web Sessions
```bash
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

Returns: Session cookie + user object

#### Mobile JWT
```bash
POST /api/mobile/auth/login
POST /api/mobile/login  # Alias
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

Returns:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "emailVerified": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin|client|employe",
    "garageId": "uuid",
    "isEmailVerified": boolean
  }
}
```

#### Token Refresh
```bash
POST /api/mobile/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

### Core Routes

#### Quotes
- `GET /api/mobile/quotes` — List user's quotes (paginated)
- `POST /api/mobile/quotes` — Create quote with images
- `GET /api/mobile/quotes/:id` — Get quote details
- `PATCH /api/mobile/quotes/:id` — Update quote
- `DELETE /api/mobile/quotes/:id` — Delete quote
- `POST /api/mobile/quotes/:id/convert-to-invoice` — Convert quote to invoice

#### Invoices
- `GET /api/mobile/invoices` — List invoices
- `POST /api/mobile/invoices` — Create invoice
- `GET /api/mobile/invoices/:id` — Get invoice
- `PATCH /api/mobile/invoices/:id` — Update invoice
- `DELETE /api/mobile/invoices/:id` — Delete invoice
- `GET /api/mobile/invoices/:id/pdf-data` — PDF export data

#### Admin Routes (70+ endpoints)
- **Quotes Admin**: `GET /api/mobile/admin/quotes/*`
- **Invoices Admin**: `GET /api/mobile/admin/invoices/*`
- **Reservations Admin**: `GET /api/mobile/admin/reservations/*`
- **OCR Scanner**: `POST /api/mobile/admin/ocr/scan*`
- **AI Analysis**: `POST /api/mobile/admin/ai/*`
- **Reviews**: `GET /api/mobile/admin/reviews/*`
- **Clients**: `GET /api/mobile/admin/clients/*`

### Error Format (V1)

V1 errors vary by endpoint. Common:

```json
{
  "message": "Error description"
}
```

HTTP Status Codes:
- `200` — Success
- `400` — Bad Request
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Not Found
- `500` — Server Error

---

## V2 API (Development)

### Status: ⚠️ In Development

V2 is being built to modernize the codebase with:
- Clean architecture (controllers, services, repositories)
- Consistent error handling
- Type-safe endpoints
- Enforced tenant isolation

**Current Issues (Under Review)**:
1. Auth endpoint response format mismatch
2. Refresh token validation needs fixing (token-type confusion vulnerability)
3. Type safety gaps (excessive `as any` casts)
4. Tenant middleware not consistently applied

### Architecture

```
server/v2/
├── controllers/      — Thin HTTP handlers
├── services/         — Business logic
├── repositories/     — Data access (via storage layer)
├── routes/           — Express route registration
├── middlewares/       — Auth, errors, rate limiting
├── validators/       — Zod input validation
├── types/            — TypeScript DTOs
└── utils/            — Helpers (paginate, numerify)
```

### Authentication

```bash
POST /api/v2/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin|client",
    "garageId": "uuid"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer"
}
```

### Registration

```bash
POST /api/v2/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MinimumEightChars",
  "firstName": "John",
  "lastName": "Doe",
  "garageId": "uuid",  # Optional
  "smsConsent": false
}
```

### Get Current User

```bash
GET /api/v2/auth/me
Authorization: Bearer eyJ...
```

Returns:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "garageId": "uuid",
    "phone": null,
    "profileImageUrl": null,
    "isEmailVerified": true
  }
}
```

**Issue**: Should return `plan` field and direct UserDTO, not wrapped.

### Refresh Token

```bash
POST /api/v2/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

**Issue**: Currently accepts access tokens; should validate `type === "refresh"`.

### Standard Error Format

All V2 endpoints return:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}  # Optional, for validation errors
  }
}
```

**Error Codes**:
- `UNAUTHORIZED` (401) — No/invalid token
- `FORBIDDEN` (403) — Insufficient permissions
- `NOT_FOUND` (404) — Resource not found
- `VALIDATION_ERROR` (400) — Invalid input
- `INVALID_TRANSITION` (422) — Invalid state change
- `CONFLICT` (409) — Resource already exists
- `QUOTA_EXCEEDED` (429) — Rate limit
- `INTERNAL_ERROR` (500) — Server error

### Pagination

All list endpoints support:

```bash
GET /api/v2/quotes?page=1&limit=10
```

Response:
```json
{
  "data": [
    { "id": "uuid", "reference": "DEV-03-00001", ... }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

### Rate Limiting

Applied globally:
- **Login**: 10 requests / 15 minutes per IP
- **Register**: 5 requests / 15 minutes per IP
- **Global V2**: 200 requests / minute per IP

Rate limit exceeded: `429 RATE_LIMIT_EXCEEDED`

### Quotes

```bash
GET /api/v2/quotes?page=1&limit=10
Authorization: Bearer eyJ...
# List paginated quotes (tenant-scoped)

POST /api/v2/quotes
Authorization: Bearer eyJ...
Content-Type: application/json
{
  "serviceId": "uuid",
  "clientId": "uuid",
  "quoteAmount": 1500.50,
  "taxRate": 20,
  "paymentMethod": "wire_transfer"
}
# Create quote

GET /api/v2/quotes/:id
# Get quote details

PATCH /api/v2/quotes/:id
# Update quote

DELETE /api/v2/quotes/:id
# Delete quote

PATCH /api/v2/quotes/:id/status
Content-Type: application/json
{
  "status": "approved"  # pending → approved → accepted → completed → invoiced → paid
}
# State machine enforced; invalid transitions rejected with INVALID_TRANSITION
```

### Invoices

```bash
GET /api/v2/invoices?page=1&limit=10
Authorization: Bearer eyJ...
# List invoices (tenant-scoped)

POST /api/v2/invoices
# Create invoice (similar to quotes)

GET /api/v2/invoices/:id
PATCH /api/v2/invoices/:id
DELETE /api/v2/invoices/:id
PATCH /api/v2/invoices/:id/status
# Same operations as quotes
```

### Uploads

```bash
POST /api/v2/uploads
Authorization: Bearer eyJ...
Content-Type: multipart/form-data

file: <binary>  # JPEG, PNG, WebP, HEIC, HEIF, PDF
                # Max 10MB

# Response
{
  "id": "uuid",
  "url": "https://...",
  "ownerId": "uuid",
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "size": 2048,
  "createdAt": "2026-03-20T14:00:00Z"
}
```

### Reservations

```bash
GET /api/v2/reservations?page=1&limit=10
Authorization: Bearer eyJ...
# List reservations (read-only)

GET /api/v2/reservations/:id
# Get reservation details
```

### Notifications

```bash
GET /api/v2/notifications?page=1&limit=10
Authorization: Bearer eyJ...
# List notifications (user's own)

GET /api/v2/notifications/unread-count
# Get unread count

PATCH /api/v2/notifications/:id/read
# Mark as read
```

### Health Check

```bash
GET /api/v2/health
# No authentication required

# Response
{
  "status": "ok",
  "version": "2.0.0",
  "timestamp": "2026-03-20T14:00:00.000Z"
}
```

---

## Data Types

### Monetary Values

- **V1**: Returned as strings (e.g., `"1500.50"`)
- **V2**: Returned as numbers (e.g., `1500.50`)

Internally, stored in PostgreSQL as `decimal(10, 2)`. V2 sanitizes all input via `sanitizeDecimal()`.

### Timestamps

ISO 8601 format:
```
2026-03-20T14:00:00.000Z
```

### Statuses

**Quote Status** (V2 state machine):
- `pending` → `approved` → `accepted` → `completed` → `invoiced` → `paid`
- Can reject at any stage (except paid/rejected)

**Invoice Status**:
- `pending` — Awaiting payment
- `paid` — Payment received
- `overdue` — Past due date
- `cancelled` — Void

**Reservation Status**:
- `pending` — Awaiting confirmation
- `confirmed` — Scheduled
- `completed` — Finished
- `cancelled` — Cancelled

---

## Security

### Authentication
- V1: Session cookies (web) + Bearer JWT (mobile)
- V2: Bearer JWT tokens
- Both use `SESSION_SECRET` for signing

### Multi-Tenancy
- All queries filtered by `garageId`
- V2: Tenant middleware validates user's garage association
- **Issue**: Tenant enforcement not consistently applied in V2

### Rate Limiting
- Applied per IP address
- Excess requests: `429 RATE_LIMIT_EXCEEDED`

### CORS
Configured for multi-tenant access; web app at same origin.

---

## Common Use Cases

### 1. Login & Get Profile
```bash
# 1. Login
curl -X POST http://localhost:5000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Extract: accessToken

# 2. Get profile
curl http://localhost:5000/api/v2/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### 2. Create & Approve Quote
```bash
# 1. Create quote
curl -X POST http://localhost:5000/api/v2/quotes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "uuid",
    "quoteAmount": 1500,
    "taxRate": 20,
    "paymentMethod": "wire_transfer"
  }'

# Extract: id

# 2. Approve quote
curl -X PATCH http://localhost:5000/api/v2/quotes/<id>/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'
```

### 3. List Quotes with Pagination
```bash
curl "http://localhost:5000/api/v2/quotes?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

### 4. Handle Errors
```bash
# Invalid email
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "validation": "email",
        "code": "invalid_string",
        "message": "Valid email required",
        "path": ["email"]
      }
    ]
  }
}

# Expired token
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

## Development Notes

### Environment Variables
```bash
SESSION_SECRET=<jwt-secret>        # Used for both V1 & V2
DATABASE_URL=postgresql://...      # PostgreSQL connection
FIREBASE_SERVICE_ACCOUNT_KEY=...   # Optional (media storage)
```

### Running Locally
```bash
npm run dev
# Starts:
# - Backend: http://localhost:5000
# - Frontend (Vite): http://localhost:5000
```

### Testing Auth
**Test Admin Credentials**:
- Email: `contact@myjantes.com`
- Password: `TestMobile2026!`
- Garage: `ca050200-ea54-433e-9e9e-9744699060d6`

---

## Known Issues (Task #3 Code Review)

### 1. Auth Response Structure
- **Current**: `GET /api/v2/auth/me` returns `{ user: {...} }`
- **Expected**: Direct UserDTO
- **Missing**: `plan` field

### 2. Refresh Token Validation
- **Current**: `verifyToken()` accepts both access & refresh tokens
- **Vulnerability**: Access token can refresh session
- **Fix**: Check `type === "refresh"`

### 3. Type Safety
- **Issue**: Pervasive `as any` casts in route files
- **Impact**: TypeScript doesn't catch type errors
- **Fix**: Add explicit type signatures to middleware/routes

### 4. Tenant Isolation
- **Issue**: `v2TenantMiddleware` only checks presence, not enforcement
- **Fix**: Apply middleware to all authenticated routes; add resource ownership checks

---

## Contact & Support

- **GitHub**: [MyTools App Repository]
- **Issues**: Use project task system for bugs/features
- **Documentation**: See `replit.md` for project info, `manuel-utilisateur.md` for user guide

---

**v2.0.0 — March 20, 2026**
