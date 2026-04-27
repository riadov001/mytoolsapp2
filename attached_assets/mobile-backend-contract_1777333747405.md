# Mobile backend contract

Ce document résume ce que l’application mobile doit utiliser pour fonctionner correctement avec le backend, sans modifier l’app plus que nécessaire.

## Authentification
- `POST /api/mobile/auth/login`
- `POST /api/mobile/auth/apple`
- `POST /api/mobile/refresh-token`
- `GET /api/mobile/auth/me`
- `DELETE /api/mobile/auth/account`

## Données métier
- `GET /api/mobile/quotes`
- `GET /api/mobile/quotes/:id`
- `PATCH /api/mobile/quotes/:id`
- `DELETE /api/mobile/quotes/:id`
- `POST /api/mobile/quotes/:id/convert-to-invoice`
- `GET /api/mobile/invoices`
- `GET /api/mobile/invoices/:id`
- `PATCH /api/mobile/invoices/:id`
- `DELETE /api/mobile/invoices/:id`
- `GET /api/mobile/reservations`
- `GET /api/mobile/reservations/:id`
- `PATCH /api/mobile/reservations/:id`
- `DELETE /api/mobile/reservations/:id`

## Push / appareils
- `POST /api/mobile/devices`
- `GET /api/mobile/devices`
- `DELETE /api/mobile/devices/:token`

## Conformité / info app
- `GET /api/mobile/legal/compliance`
- `GET /api/mobile/health`
- `GET /api/mobile/routes`

## Règles côté app mobile
- Envoyer `Authorization: Bearer <token>` sur les routes protégées.
- Garder et renouveler le `refreshToken`.
- Envoyer du JSON uniquement.
- Sur les `PATCH`, n’envoyer que les champs autorisés par l’API.
- Gérer proprement les codes `400`, `401`, `403`, `409`.
- Pour Apple Sign In, envoyer `idToken` et `nonce` si demandé.
- Pour les devices push, enregistrer le token à la connexion et le supprimer à la déconnexion.
- Pour la suppression de compte, appeler `DELETE /api/mobile/auth/account`.
