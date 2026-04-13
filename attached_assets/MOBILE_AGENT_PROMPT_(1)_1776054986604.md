# Prompt — Agent Replit Mobile (React Native / Expo)

## Règles de travail impératives (LIRE EN PREMIER)

Avant chaque modification :
1. **Vérifier l'existant** — lire le fichier/composant cible avant de le modifier
2. **Ne jamais réécrire** ce qui fonctionne déjà — modifier le strict minimum
3. **Tester par le backend** — chaque endpoint doit être testé via `curl` ou l'app avant de valider
4. **Ne pas créer** un écran/composant qui existe déjà sous un autre nom
5. **Pas de mock data** — toutes les données viennent du backend réel
6. **Tester après chaque modification** — s'assurer qu'aucune régression n'est introduite

---

## Contexte du projet

Application mobile **MyTools** (React Native / Expo), compagnon de la plateforme de gestion de garage automobile **mytoolsgroup.eu**. Le backend est opérationnel. L'objectif est de synchroniser l'app avec les routes exactes ci-dessous et satisfaire les exigences Apple App Store / Google Play.

---

## URL du backend

```
PROD:  https://backend.mytoolsgroup.eu/api
DEV:   https://<votre-replit-url>/api
```

Toutes les requêtes authentifiées utilisent :
```
Authorization: Bearer <accessToken>
```

---

## Comptes de test (CORRECTS — testés et validés)

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| `admin@mytools.com` | `Demo1234!` | admin (garage) |
| `reviewer@apple.com` | `Demo1234!` | client (pour Apple Review) |
| `rootadmin@mytools.com` | `Demo1234!` | rootadmin |
| `technicien@mytools.com` | `Demo1234!` | employé |
| `alice.dubois@gmail.com` | `Demo1234!` | client |

> **App Store Connect → App Review Information** :
> Email : `reviewer@apple.com` / Mot de passe : `Demo1234!`

---

## Routes API — Liste exhaustive et vérifiée

### AUTH (pas de token requis sauf indication)

| Méthode | Route | Body | Réponse |
|---------|-------|------|---------|
| POST | `/api/mobile/auth/login` | `{email, password}` | `{accessToken, refreshToken, tokenType:"Bearer", emailVerified, user:{id,email,role,garageId,...}}` |
| POST | `/api/mobile/auth/register` | `{email, password, firstName, lastName, companyName, siret?, address?, city?, postalCode?}` | `{message, user:{email,role,garageId}}` — crée garage + admin |
| POST | `/api/mobile/auth/logout` | _(vide)_ | `{success:true, message}` — aussi accepté sans token |
| POST | `/api/mobile/auth/forgot-password` | `{email}` | `{message, sent:true}` — toujours 200, rate-limit 5/h/IP |
| POST | `/api/mobile/auth/verify-reset-code` | `{email, code}` | `{valid:true, resetToken}` ou `{valid:false, message}` |
| POST | `/api/mobile/auth/reset-password` | `{resetToken, newPassword}` | `{success:true, message}` |
| POST | `/api/mobile/auth/change-password` | `{currentPassword, newPassword}` | `{success:true, message}` — **token requis** |
| POST | `/api/mobile/auth/resend-verification` | `{email}` | `{message}` |
| POST | `/api/mobile/refresh-token` | `{refreshToken}` | `{accessToken, refreshToken, tokenType:"Bearer"}` — ⚠️ pas de champ `user` |
| GET | `/api/auth/verify-email?token=xxx` | — | redirige ou confirme ⚠️ préfixe `/api/auth/` pas `/api/mobile/auth/` |
| GET | `/api/mobile/auth/me` | — | `{user:{...}}` — **token requis** |

### PROFIL UTILISATEUR (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/profile` | Profil complet |
| PATCH | `/api/mobile/profile` | Mise à jour profil |
| DELETE | `/api/mobile/profile` | Suppression définitive du compte (RGPD) |
| POST | `/api/mobile/profile/avatar` | Upload avatar (multipart) |

### DEVIS CLIENT (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/quotes` | Liste des devis |
| POST | `/api/mobile/quotes` | Créer un devis |
| GET | `/api/mobile/quotes/:id` | Détail devis |
| PATCH | `/api/mobile/quotes/:id` | Modifier devis |
| DELETE | `/api/mobile/quotes/:id` | Supprimer devis |
| GET | `/api/mobile/quotes/:id/media` | Médias attachés |
| GET | `/api/mobile/quotes/:id/pdf-data` | Données PDF |
| POST | `/api/mobile/quotes/:id/convert-to-invoice` | Convertir en facture |
| POST | `/api/mobile/quotes/:id/create-reservation` | Créer RDV depuis devis |

### FACTURES CLIENT (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/invoices` | Liste des factures |
| POST | `/api/mobile/invoices` | Créer une facture |
| GET | `/api/mobile/invoices/:id` | Détail facture |
| PATCH | `/api/mobile/invoices/:id` | Modifier facture |
| DELETE | `/api/mobile/invoices/:id` | Supprimer facture |
| GET | `/api/mobile/invoices/:id/media` | Médias attachés |
| GET | `/api/mobile/invoices/:id/pdf-data` | Données PDF |

### RÉSERVATIONS CLIENT (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/reservations` | Liste des RDV |
| POST | `/api/mobile/reservations` | Créer un RDV |
| GET | `/api/mobile/reservations/:id` | Détail RDV |
| PATCH | `/api/mobile/reservations/:id` | Modifier RDV |
| DELETE | `/api/mobile/reservations/:id` | Annuler RDV |

### NOTIFICATIONS (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/notifications` | Liste des notifications |
| GET | `/api/mobile/notifications/unread-count` | Nombre non lus |
| PATCH | `/api/mobile/notifications/:id/read` | Marquer comme lu |
| POST | `/api/mobile/notifications/mark-all-read` | Tout marquer comme lu |

### SUPPORT (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/support/messages` | Historique messages support |
| POST | `/api/mobile/support/messages` | Envoyer un message au support |

Body POST : `{message: "texte"}`
Réponse : `{success:true, message, messageId, conversationId}`

### SERVICES & PLANS (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/services` | Liste des services du garage |
| GET | `/api/mobile/plans` | Plans d'abonnement disponibles |

### FEATURES AVANCÉES (token requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/wheel-simulator/config` | Config simulateur de jantes |
| POST | `/api/mobile/wheel-simulator/analyze` | Analyse image jante |
| POST | `/api/mobile/ar/detect-wheels` | Détection AR des roues |
| POST | `/api/mobile/ai/assistant` | Assistant IA |

### LÉGAL & PUBLIC (pas de token)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/legal/terms` | CGU + mentions légales + politique |
| GET | `/api/mobile/public/terms` | Conditions d'utilisation |
| GET | `/api/mobile/public/privacy-policy` | Politique de confidentialité |
| GET | `/api/mobile/public/legal` | URLs légales `{privacyPolicyUrl, termsUrl, supportEmail, gdprCompliant:true}` |
| GET | `/api/mobile/health` | Health check |
| GET | `/api/mobile/routes` | Liste toutes les routes disponibles |

### ADMIN — DASHBOARD & STATS (token Admin requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/dashboard` | Statistiques du tableau de bord |
| GET | `/api/mobile/admin/stats` | Stats détaillées |
| GET | `/api/mobile/admin/quotas` | Quotas consommés |
| GET | `/api/mobile/admin/quota-sync` | Sync quotas `{plan, garageId, period, quotas:{ai,sms,ocr}}` |

### ADMIN — PARAMÈTRES GARAGE (token Admin) ⚠️ ROUTE CORRECTE

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/settings` | Paramètres du garage ⚠️ PAS `/admin/garage/settings` |
| PATCH | `/api/mobile/admin/settings` | Modifier les paramètres |

### ADMIN — UTILISATEURS (token Admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/users` | Liste des utilisateurs du garage |
| POST | `/api/mobile/admin/users` | Créer un client (seul moyen de créer un client) |
| GET | `/api/mobile/admin/users/:id` | Détail utilisateur |
| PATCH | `/api/mobile/admin/users/:id` | Modifier utilisateur |
| DELETE | `/api/mobile/admin/users/:id` | Supprimer utilisateur |
| PATCH | `/api/mobile/admin/users/:id/password` | Changer mot de passe utilisateur |

### ADMIN — CLIENTS (token Admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/clients` | Liste clients avec infos complètes |
| POST | `/api/mobile/admin/clients` | Créer client |
| GET | `/api/mobile/admin/clients/:id` | Détail client |
| GET | `/api/mobile/admin/clients/:id/quotes` | Devis du client |
| GET | `/api/mobile/admin/clients/:id/invoices` | Factures du client |
| GET | `/api/mobile/admin/clients/:id/reservations` | RDV du client |

### ADMIN — DEVIS (token Admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/quotes` | Tous les devis du garage |
| POST | `/api/mobile/admin/quotes` | Créer devis |
| GET | `/api/mobile/admin/quotes/:id` | Détail |
| PATCH | `/api/mobile/admin/quotes/:id` | Modifier |
| DELETE | `/api/mobile/admin/quotes/:id` | Supprimer |
| PATCH | `/api/mobile/admin/quotes/:id/status` | Changer statut |
| GET | `/api/mobile/admin/quotes/:id/items` | Articles du devis |
| POST | `/api/mobile/admin/quotes/:id/items` | Ajouter article |
| PATCH | `/api/mobile/admin/quotes/:id/items/:itemId` | Modifier article |
| DELETE | `/api/mobile/admin/quotes/:id/items/:itemId` | Supprimer article |
| GET | `/api/mobile/admin/quotes/:id/media` | Médias |
| POST | `/api/mobile/admin/quotes/:id/send-email` | Envoyer par email |
| POST | `/api/mobile/admin/quotes/:id/convert-to-invoice` | Convertir en facture |

### ADMIN — FACTURES (token Admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/invoices` | Toutes les factures |
| POST | `/api/mobile/admin/invoices` | Créer facture |
| POST | `/api/mobile/admin/invoices/direct` | Facture directe (sans devis) |
| GET | `/api/mobile/admin/invoices/:id` | Détail |
| PATCH | `/api/mobile/admin/invoices/:id` | Modifier |
| DELETE | `/api/mobile/admin/invoices/:id` | Supprimer |
| PATCH | `/api/mobile/admin/invoices/:id/status` | Changer statut |
| GET | `/api/mobile/admin/invoices/:id/items` | Articles |
| POST | `/api/mobile/admin/invoices/:id/items` | Ajouter article |
| PATCH | `/api/mobile/admin/invoices/:id/items/:itemId` | Modifier article |
| DELETE | `/api/mobile/admin/invoices/:id/items/:itemId` | Supprimer article |
| GET | `/api/mobile/admin/invoices/:id/media` | Médias |
| POST | `/api/mobile/admin/invoices/:id/send-email` | Envoyer par email |

### ADMIN — RÉSERVATIONS, AVIS, SMS, EXPORTS (token Admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/mobile/admin/reservations` | Toutes les réservations |
| POST | `/api/mobile/admin/reservations` | Créer RDV |
| GET | `/api/mobile/admin/reservations/:id` | Détail |
| PATCH | `/api/mobile/admin/reservations/:id` | Modifier |
| DELETE | `/api/mobile/admin/reservations/:id` | Annuler |
| PATCH | `/api/mobile/admin/reservations/:id/status` | Changer statut |
| GET | `/api/mobile/admin/reviews` | Avis clients |
| DELETE | `/api/mobile/admin/reviews/:id` | Supprimer avis |
| PATCH | `/api/mobile/admin/reviews/:id/approve` | Approuver avis |
| POST | `/api/mobile/admin/sms/send` | Envoyer SMS |
| GET | `/api/mobile/admin/sms/logs` | Historique SMS |
| GET | `/api/mobile/admin/export/quotes` | Export CSV devis |
| GET | `/api/mobile/admin/export/invoices` | Export CSV factures |
| GET | `/api/mobile/admin/expenses` | Dépenses du garage |
| POST | `/api/mobile/admin/expenses` | Créer dépense |
| GET | `/api/mobile/admin/expenses/:id` | Détail dépense |
| PATCH | `/api/mobile/admin/expenses/:id` | Modifier dépense |
| DELETE | `/api/mobile/admin/expenses/:id` | Supprimer dépense |
| POST | `/api/mobile/admin/services` | Créer service |
| PATCH | `/api/mobile/admin/services/:id` | Modifier service |
| DELETE | `/api/mobile/admin/services/:id` | Supprimer service |

### ADMIN — IA (token Admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/mobile/admin/ai/analyse` | Analyse IA générale |
| POST | `/api/mobile/admin/ai/commercial` | Suggestions commerciales |
| POST | `/api/mobile/admin/ai/growth` | Analyse croissance |
| POST | `/api/mobile/admin/ai/wheel` | Analyse jante IA |
| GET | `/api/mobile/admin/ocr/history` | Historique OCR |
| DELETE | `/api/mobile/admin/ocr/history/:id` | Supprimer historique OCR |

---

## Codes d'erreur HTTP — Comportement obligatoire

```javascript
// Intercepteur à implémenter sur TOUTES les requêtes API
switch (response.status) {
  case 400: showError(data.message || "Données invalides");         break;
  case 401: clearToken(); navigateTo("Login");                       break; // Session expirée
  case 403: showError("Accès non autorisé");                         break;
  case 429: showError("Trop de tentatives. Réessayez dans quelques minutes."); break;
  case 500: showError("Erreur serveur. Réessayez plus tard.");        break;
  default:  if (!response.ok) showError(data.message || "Erreur réseau"); break;
}
// Pas de connexion réseau :
// showError("Vérifiez votre connexion internet.")
```

---

## Refresh token automatique (intercepteur Axios)

```javascript
// POST /api/mobile/refresh-token
// Body: { refreshToken: "eyJ..." }
// Réponse: { accessToken, refreshToken, tokenType: "Bearer" }
// ⚠️ La réponse NE contient PAS de champ "user"

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const { data } = await axios.post('/api/mobile/refresh-token',
          { refreshToken: getStoredRefreshToken() });
        saveTokens(data.accessToken, data.refreshToken);
        error.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosInstance(error.config);
      } catch {
        logout(); // Redirect to login
      }
    }
    return Promise.reject(error);
  }
);
```

---

## Flux de réinitialisation de mot de passe (3 étapes)

```
1. POST /api/mobile/auth/forgot-password  { email }
   → Toujours HTTP 200, même si l'email n'existe pas (anti-énumération)
   → Rate-limit : 5 requêtes/heure par IP → HTTP 429

2. POST /api/mobile/auth/verify-reset-code  { email, code }
   → Succès : { valid: true, resetToken: "eyJ..." }  (JWT valable 15 min)
   → Échec  : { valid: false, message: "Code invalide ou expiré" }

3. POST /api/mobile/auth/reset-password  { resetToken, newPassword }
   → Succès : { success: true, message: "Mot de passe réinitialisé avec succès" }
   → Erreur : 400 si mot de passe < 8 caractères
   → ⚠️ Aucun header Authorization requis
```

**Écrans requis :**
- `ForgotPasswordScreen` — saisie email
- `VerifyOtpScreen` — code 6 chiffres + countdown 15 min + bouton "Renvoyer"
- `ResetPasswordScreen` — nouveau mot de passe + confirmation

---

## Pages légales (obligatoires Apple/RGPD)

| Contenu | URL web publique |
|---------|-----------------|
| Politique de confidentialité | `https://backend.mytoolsgroup.eu/privacy` |
| Conditions d'utilisation | `https://backend.mytoolsgroup.eu/terms` |
| Support | `https://backend.mytoolsgroup.eu/support` |

**API in-app :**
```
GET /api/mobile/public/privacy-policy   → { version, url, content:{fr:{...}} }
GET /api/mobile/public/terms            → { version, url, content:{fr:{...}} }
GET /api/mobile/public/legal            → { privacyPolicyUrl, termsUrl, supportEmail, gdprCompliant:true }
GET /api/mobile/legal/terms             → contenu combiné (CGU + mentions + politique)
```

**À implémenter :**
1. Écran d'inscription : "En vous inscrivant vous acceptez nos [CGU] et [Politique de confidentialité]"
2. Paramètres → "Informations légales" avec liens vers les 3 pages
3. Utiliser `Linking.openURL()` ou WebView in-app

---

## Suppression de compte (Apple Guideline 5.1.1(v) — OBLIGATOIRE)

```
DELETE /api/mobile/profile
Headers: Authorization: Bearer <token>
Réponse: {
  success: true,
  message: "Compte définitivement supprimé. Toutes vos données ont été effacées.",
  deletedAt: "2026-..."
}
```

**Exigences :**
1. Bouton "Supprimer mon compte" dans **Paramètres → Mon compte** (pas caché)
2. Dialogue de confirmation : "Cette action est irréversible. Toutes vos données seront définitivement supprimées."
3. Après suppression : effacer tokens + retourner à l'écran d'accueil
4. Fonctionnel sans contacter le support (testable par l'évaluateur Apple)

---

## Politique de mot de passe (validée côté backend)

- Minimum **8 caractères**
- Validation identique côté mobile et backend
- Afficher un message d'erreur si les mots de passe ne correspondent pas
- Champ "Confirmer le mot de passe" sur tous les formulaires création/modification

---

## Politique d'auto-inscription

- **Les clients ne peuvent PAS s'auto-inscrire** — `POST /api/mobile/auth/register` crée un garage + un compte admin uniquement (nécessite SIRET ou nom d'entreprise)
- **Les clients sont créés par l'admin** via `POST /api/mobile/admin/users`
- En cas d'inscription sans SIRET : fournir `companyName` + `city` (fallback gracieux)

---

## Notes importantes

### Firebase / Apple Sign-In
- Il n'existe **pas** de route `POST /api/mobile/auth/login-with-firebase` dans ce backend
- L'authentification Firebase doit passer par un token vérifié côté serveur si implémentée
- Si l'app propose Google Sign-In ou Facebook Login, Apple **exige** que Sign-In with Apple soit aussi proposé

### Email de vérification
- La route de vérification est `GET /api/auth/verify-email?token=xxx` (**sans** `/mobile/`)
- Les emails de vérification ne fonctionnent qu'en production (domaine vérifié sur Resend)
- Pour les tests : récupérer le code OTP directement dans les logs serveur

### In-App Purchases
- Si les abonnements (Starter 29€, Pro 79€, Business 149€, VIP 299€) sont achetables depuis iOS, ils **doivent** passer par Apple IAP — pas Stripe directement
- Si la gestion se fait uniquement via le web admin, Stripe est acceptable

### Permissions iOS/Android
- Camera / Photo Library → upload photos véhicules (devis, OCR)
- Notifications push → `expo-notifications`
- Ne pas demander de permissions non utilisées

---

## Checklist de validation avant soumission

Tester chaque point via le backend réel (pas de mock) :

- [ ] `POST /api/mobile/auth/login` → accessToken + refreshToken reçus
- [ ] `POST /api/mobile/refresh-token` → nouveau accessToken sans champ `user`
- [ ] `POST /api/mobile/auth/forgot-password` → HTTP 200 même si email inconnu
- [ ] `POST /api/mobile/auth/verify-reset-code` → `{valid:true, resetToken}`
- [ ] `POST /api/mobile/auth/reset-password` → connexion OK avec nouveau mot de passe
- [ ] `POST /api/mobile/auth/logout` → tokens effacés, retour Login
- [ ] `POST /api/mobile/auth/change-password` → nouveau mot de passe fonctionne
- [ ] `DELETE /api/mobile/profile` → dialogue confirme → compte supprimé → retour accueil
- [ ] `GET /api/mobile/legal/terms` → contenu légal affiché
- [ ] `POST /api/mobile/support/messages` → message envoyé au support
- [ ] HTTP 429 → message "Trop de tentatives" affiché (pas de crash)
- [ ] HTTP 401 sur token expiré → refresh automatique ou retour Login
- [ ] Perte réseau → message "Vérifiez votre connexion" (pas de crash)
- [ ] `GET /api/mobile/admin/settings` (**pas** `/admin/garage/settings`) → paramètres garage
- [ ] `reviewer@apple.com` / `Demo1234!` → connexion client fonctionnelle
- [ ] Liens CGU et Politique de confidentialité ouvrent les bonnes URLs
