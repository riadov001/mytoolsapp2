# Product Overview — MyTools Admin

## What Is MyTools Admin?

MyTools Admin is a mobile application for iOS and Android that gives garage administrators and employees real-time access to their business operations. It connects directly to the MyTools Group back-office platform, making it the mobile companion to the MyTools web dashboard.

---

## Target User

**Primary:** Garage owner / administrator  
**Secondary:** Garage employee with admin rights  
**Market:** France  
**Industry:** Automotive services  
**Access:** Closed — invite-only via MyTools Group customer service

---

## Core Modules

### 1. Analytics Dashboard
The home screen of MyTools Admin. Displays:
- Monthly revenue (encaissé / pending)
- Global cumulative revenue
- 6-month revenue trend chart (bar chart)
- Invoice status breakdown (paid / pending / overdue / cancelled)
- Quote status breakdown (pending / approved / rejected / completed)
- Reservation count

### 2. Quotes (Devis)
Full quote lifecycle management:
- List view with status badges and client names
- Create new quote (client, service, amount, description, photo)
- Edit existing quotes
- Status management (pending → approved/rejected → completed)
- Photo attachment via camera or photo library

### 3. Invoices (Factures)
Invoice tracking and management:
- List view with status and amount display
- Create new invoice (linked to quote or standalone)
- Status management (pending → paid / overdue / cancelled)
- ⚠️ Note: `dueDate` field is not sent to avoid a known API 500 error

### 4. Reservations (Rendez-vous)
Appointment management:
- Calendar-based date picker (custom month-grid UI)
- List and calendar view options
- Status management (pending → confirmed / cancelled / completed)
- Client and service selection

### 5. Clients
Customer database:
- Searchable full client list
- Create and edit client records (name, email, phone, address)
- View complete client details

---

## Technical Architecture

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | Expo React Native (Expo Router)         |
| Backend   | Express.js (TypeScript) proxy server    |
| External  | MyTools Group REST API (saas.mytoolsgroup.eu) |
| Auth      | JWT Bearer token + Session cookie (dual auth) |
| State     | React Query + React Context             |
| Storage   | AsyncStorage (local preferences)        |
| Fonts     | Michroma (title) + Inter (body)         |
| Icons     | Ionicons (@expo/vector-icons)           |

---

## Platform Support

| Platform    | Status  | Min Version |
|-------------|---------|-------------|
| iOS         | ✅ Live | iOS 13.0+   |
| Android     | ✅ Live | Android 8.0+|
| Web (admin) | ✅ Expo | Modern browsers |

---

## Security Features

- JWT authentication with automatic token refresh
- Encrypted session cookies (HttpOnly, Secure, SameSite=None)
- No data stored locally beyond auth tokens
- Account deletion available in-app (two-step confirmation)
- Closed access: no public registration
- GDPR-compliant consent screen on first launch
- All data processed on EU servers

---

## Key Differentiators

1. **Mobile-first design** — built for field use, not desktop replication
2. **Dark-first theme** — readable in garage environments
3. **Single sign-on to MyTools ecosystem** — same credentials as web portal
4. **No subscription tiers** — included with MyTools Group partner agreement
5. **French market focus** — French-first UX, RGPD compliant, CNIL-ready

---

## Pricing & Access

MyTools Admin is included as part of the MyTools Group partner agreement. There are no additional costs or subscription fees for authorized users.

To request access: **contact@mytoolsgroup.eu**

---

## Key Metrics (Target for Launch)

| Metric              | Target   |
|---------------------|----------|
| Partner garages     | 50+      |
| Active users        | 100+     |
| App Store rating    | 4.5+     |
| Avg. sessions/day   | 5+ per user |

---

## Contact

**MyTools Group**  
Website: www.mytoolsgroup.eu  
Email: contact@mytoolsgroup.eu  
Support: www.mytoolsgroup.eu/support
