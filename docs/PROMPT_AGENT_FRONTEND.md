# Prompt Agent Replit — Frontend Mobile MyJantes

Le backend est hébergé à : `https://appmyjantes1.mytoolsgeoup.eu/api`  
Toutes les routes protégées utilisent : `Authorization: Bearer <accessToken>`

---

## 1. RÉSERVATIONS — Devis accepté obligatoire

La route `POST /mobile/reservations` renvoie désormais une erreur 403 si le client n'a pas de devis accepté :
```json
{
  "code": "NO_ACCEPTED_QUOTE",
  "message": "Vous devez avoir un devis accepté pour effectuer une demande de réservation."
}
```

**À faire :**
- Sur l'écran de création de réservation, avant d'afficher le formulaire, vérifier que le client a au moins un devis avec `status === "approved"` (via `GET /mobile/quotes` puis filtrage local)
- Si aucun devis accepté n'existe, afficher un message clair : *"Vous devez d'abord avoir un devis accepté pour prendre rendez-vous."* avec un bouton **"Voir mes devis"** qui redirige vers la liste des devis
- Lors de la création, inclure le champ `quoteId` dans le body (ID du devis accepté lié à la réservation)
- Afficher les erreurs spécifiques renvoyées par le serveur (`NO_ACCEPTED_QUOTE`, etc.)

---

## 2. TÉLÉCHARGEMENT PDF — Devis et Factures

Deux nouvelles routes sont disponibles (authentifiées JWT, réservées au client propriétaire) :
- `GET /mobile/quotes/:id/pdf` → retourne le PDF du devis (`Content-Type: application/pdf`)
- `GET /mobile/invoices/:id/pdf` → retourne le PDF de la facture (`Content-Type: application/pdf`)

**À faire :**
- Sur l'écran de détail d'un devis : ajouter un bouton **"Télécharger le PDF"** qui appelle `GET /mobile/quotes/:id/pdf` avec le Bearer token, puis ouvre ou partage le fichier PDF (utiliser `expo-file-system` + `expo-sharing` ou `expo-print` selon la stack)
- Sur l'écran de détail d'une facture : même logique avec `GET /mobile/invoices/:id/pdf`
- Afficher un indicateur de chargement pendant la génération du PDF
- Gérer les erreurs (403 = accès refusé, 404 = non trouvé, 500 = erreur serveur)

---

## 3. HISTORIQUE COMPLET DES DEMANDES CLIENT

Ajouter un écran **"Historique"** dans la navigation principale (onglet ou section dédiée).

Cet écran affiche dans une seule vue toute l'activité du client :
- Ses demandes de devis (`GET /mobile/quotes`) — trié par date décroissante
- Ses factures (`GET /mobile/invoices`) — trié par date décroissante
- Ses réservations (`GET /mobile/reservations`) — trié par date décroissante

**Design :**
- Une barre de filtres en haut : **"Tout"**, **"Devis"**, **"Factures"**, **"Réservations"**
- Chaque élément affiche : type (badge coloré), référence, date, statut (badge avec couleur selon statut), montant si applicable
- Tap sur un élément → navigation vers l'écran de détail correspondant
- Pull-to-refresh pour recharger
- État vide : message *"Aucune activité pour l'instant"* avec illustration

**Statuts et couleurs :**
- Devis : `pending`=gris, `approved`=vert, `accepted`=bleu, `rejected`=rouge, `completed`=violet
- Factures : `pending`=orange, `paid`=vert, `overdue`=rouge, `cancelled`=gris
- Réservations : `pending`=gris, `confirmed`=bleu, `completed`=vert, `cancelled`=rouge

---

## 4. ESPACE CLIENT — Résumé dans le profil mobile

L'écran de profil mobile doit afficher un résumé de l'activité du client :
- Nombre de devis (total et acceptés)
- Nombre de factures (total et payées)
- Nombre de réservations (total et confirmées)
- Dernière activité (date du dernier élément créé)

Ces données sont calculées localement depuis les appels API déjà disponibles (`/mobile/quotes`, `/mobile/invoices`, `/mobile/reservations`).

---

## 5. ENVOI DE PHOTO DANS LE CHAT/SUPPORT (sécurisé)

**Route d'upload disponible :**
```
POST /mobile/upload
multipart/form-data, champ "files"
Max : 10 fichiers, 25 Mo/fichier
Formats acceptés : JPG, PNG, WEBP, HEIC, GIF
Retourne : { urls: string[] }
Authentification : Bearer token requis
```

**Route de support existante :**
```
POST /mobile/support/messages
Body : { subject: string, message: string, category?: string }
```

**À faire :**
- Sur l'écran de support/messages, ajouter un bouton **"Joindre une photo"** (icône trombone ou appareil photo)
- Permettre de sélectionner 1 à 3 photos depuis la galerie ou l'appareil photo (utiliser `expo-image-picker`)
- Les photos sont d'abord uploadées via `POST /mobile/upload` avec le Bearer token
- Les URLs retournées sont ajoutées dans le message : `\n[Photo jointe]: https://...`
- Afficher un aperçu des photos sélectionnées avant envoi, avec possibilité de les supprimer individuellement
- Indicateur de progression pendant l'upload
- Sécurité : l'upload est protégé par le Bearer token (`mobileClientOnly`), seul le client authentifié peut uploader

---

## 6. SDK À METTRE À JOUR (`Mobile/SDK/myjantes-sdk.ts`)

Ajouter/mettre à jour les méthodes suivantes dans `MyJantesClient` :

```typescript
// Télécharger le PDF d'un devis (retourne un Blob)
async downloadQuotePdf(quoteId: string): Promise<Blob> {
  const res = await fetch(`${this.baseUrl}/mobile/quotes/${quoteId}/pdf`, {
    headers: { Authorization: `Bearer ${this.accessToken}` },
  });
  if (!res.ok) throw new Error(`PDF error: ${res.status}`);
  return res.blob();
}

// Télécharger le PDF d'une facture (retourne un Blob)
async downloadInvoicePdf(invoiceId: string): Promise<Blob> {
  const res = await fetch(`${this.baseUrl}/mobile/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${this.accessToken}` },
  });
  if (!res.ok) throw new Error(`PDF error: ${res.status}`);
  return res.blob();
}

// Upload de fichiers (photos)
async uploadFiles(formData: FormData): Promise<string[]> {
  const res = await fetch(`${this.baseUrl}/mobile/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.accessToken}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload error: ${res.status}`);
  const data = await res.json();
  return data.urls || [];
}

// Créer une réservation (avec quoteId obligatoire si devis accepté disponible)
async createReservation(data: {
  serviceId: string;
  scheduledDate: string;
  quoteId?: string;
  notes?: string;
  wheelCount?: number;
  diameter?: string;
}): Promise<Reservation> {
  return this.request('/mobile/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

---

## CONTRAINTES TECHNIQUES

- Stocker les tokens JWT dans `expo-secure-store` (iOS Keychain / Android Keystore), jamais en `AsyncStorage` non chiffré
- Gérer le refresh automatique des tokens : `401` → `POST /mobile/refresh-token` → réessayer la requête
- Tous les uploads passent par le Bearer token (aucune route publique pour les fichiers client)
- Respecter les guidelines Apple App Store (guideline 5.1.1(v) : suppression de compte disponible dans profil)
- Base URL de production : `https://appmyjantes1.mytoolsgeoup.eu/api`
