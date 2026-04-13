# MyTools - Guide de soumission Apple App Store

## Informations generales de l'application

| Champ | Valeur |
|-------|--------|
| Nom de l'app | MyTools |
| Bundle ID | `com.mytools.app` |
| Version | 1.0.0 |
| Plateforme | iOS (iPhone + iPad) |
| Categorie principale | Economie et entreprise (Business) |
| Categorie secondaire | Utilitaires (Utilities) |
| Classification d'age | 4+ (Pas de contenu sensible) |
| Langues | Francais |
| Editeur / Owner | lastmytools |
| EAS Project ID | `45e48f45-e421-4f67-9d02-d84a678fdfc5` |

---

## Description de l'application

### Description courte (max 30 caracteres)
```
Portail client MyJantes
```

### Sous-titre App Store (max 30 caracteres)
```
Devis, factures et rendez-vous
```

### Description longue (App Store)
```
MyTools est l'application mobile officielle du reseau MyJantes, specialise dans la renovation et la personnalisation de jantes automobiles.

Avec MyTools, gerez l'ensemble de vos interactions avec votre garage MyJantes directement depuis votre telephone :

DEVIS EN LIGNE
- Demandez un devis gratuit en quelques clics
- Selectionnez vos services (peinture, reparation, personnalisation)
- Envoyez des photos de vos jantes pour un devis precis
- Suivez le statut de vos demandes en temps reel
- Acceptez ou refusez les devis directement depuis l'application

GESTION DES RENDEZ-VOUS
- Prenez rendez-vous en ligne apres acceptation de votre devis
- Choisissez votre creneau horaire prefere
- Suivez vos rendez-vous a venir et passes

FACTURES ET DOCUMENTS
- Consultez l'historique complet de vos factures
- Telechargez vos factures en PDF
- Gardez une trace de tous vos documents

MESSAGERIE INTEGREE
- Communiquez directement avec votre garage
- Posez vos questions et recevez des reponses rapides

SECURITE ET CONFIDENTIALITE
- Connexion securisee avec Face ID / Touch ID
- Protection de vos donnees conformement au RGPD
- Notifications push pour ne rien manquer

L'application est disponible pour les particuliers et les professionnels.
```

### Mots-cles (max 100 caracteres, separes par des virgules)
```
jantes,renovation,peinture,reparation,automobile,devis,garage,voiture,roues,carrosserie
```

---

## Compte de demonstration pour la review Apple

> **IMPORTANT** : Apple exige un compte de demonstration fonctionnel. Vous devez fournir des identifiants valides dans App Store Connect.

| Champ | Valeur |
|-------|--------|
| Email | *(creer un compte demo sur votre backend)* |
| Mot de passe | *(mot de passe du compte demo)* |

### Comment creer le compte demo :
1. Allez sur `https://apps.mytoolsgroup.eu`
2. Creez un compte avec un email de type `review@mytools.app`
3. Ajoutez quelques donnees de test :
   - Au moins 1 devis (avec statuts varies : en attente, accepte)
   - Au moins 1 facture
   - Au moins 1 rendez-vous
   - Quelques messages dans la messagerie
4. Renseignez ces identifiants dans App Store Connect > App Review Information > Sign-In Information

### Notes pour le reviewer (App Review Information > Notes)
```
MyTools est un portail client pour le reseau de garages MyJantes, specialise dans la renovation de jantes automobiles. L'application necessite un compte client existant. Un compte de demonstration est fourni ci-dessus.

L'application utilise les permissions suivantes :
- Camera : pour photographier les jantes lors d'une demande de devis (3 photos requises)
- Photos : pour selectionner des photos existantes de jantes
- Face ID : optionnel, pour connexion biometrique rapide
- Notifications : pour alerter l'utilisateur des mises a jour de devis, factures et rendez-vous

L'application ne collecte aucune donnee a des fins publicitaires. Aucun tracking utilisateur n'est effectue.
```

---

## Flux de l'application (parcours du reviewer)

### Premier lancement
1. **Ecran de consentement RGPD** s'affiche automatiquement
   - 3 cases a cocher obligatoires (confidentialite, cookies, traitement des donnees)
   - Liens vers les mentions legales et la politique de confidentialite
   - Le bouton "Accepter et continuer" n'est actif que lorsque les 3 cases sont cochees
2. Apres acceptation, redirection vers l'ecran de connexion

### Connexion
1. Saisir email et mot de passe du compte demo
2. Appuyer sur "Se connecter"
3. Redirection vers le tableau de bord (Accueil)

### Ecrans principaux (onglets)
1. **Accueil** : Tableau de bord avec statistiques rapides et liste des services
2. **Devis** : Liste des devis avec filtres par statut
3. **Factures** : Historique des factures avec telechargement PDF
4. **RDV** : Calendrier et liste des rendez-vous
5. **Messages** : Messagerie avec le garage
6. **Profil** : Informations du compte, parametres, securite

### Fonctionnalites a tester
- **Demande de devis** : Accueil > Nouveau devis > Selectionner services > Prendre/choisir 3 photos > Envoyer
- **Detail d'un devis** : Devis > Appuyer sur un devis > Voir details et statut
- **Detail d'une facture** : Factures > Appuyer sur une facture > Telecharger PDF
- **Messagerie** : Messages > Ouvrir une conversation > Envoyer un message
- **Profil** : Profil > Voir informations > Tester les toggles notifications
- **Suppression de compte** : Profil > Zone critique > Supprimer mon compte (ne pas confirmer la suppression)

---

## Declarations de confidentialite (App Privacy)

### Data Types collectes

Dans App Store Connect > App Privacy, declarer les types de donnees suivants :

#### 1. Coordonnees (Contact Info)
| Type | Utilisation | Lie a l'identite | Suivi |
|------|-------------|-------------------|-------|
| Nom | Fonctionnalite de l'app | Oui | Non |
| Adresse email | Fonctionnalite de l'app | Oui | Non |
| Numero de telephone | Fonctionnalite de l'app | Oui | Non |
| Adresse physique | Fonctionnalite de l'app | Oui | Non |

#### 2. Contenu utilisateur (User Content)
| Type | Utilisation | Lie a l'identite | Suivi |
|------|-------------|-------------------|-------|
| Photos | Fonctionnalite de l'app | Oui | Non |

#### 3. Identifiants (Identifiers)
| Type | Utilisation | Lie a l'identite | Suivi |
|------|-------------|-------------------|-------|
| User ID | Fonctionnalite de l'app | Oui | Non |

#### 4. Donnees d'utilisation (Usage Data)
| Type | Utilisation | Lie a l'identite | Suivi |
|------|-------------|-------------------|-------|
| Interaction avec le produit | Analyse | Non | Non |

### Ce que l'app ne collecte PAS
- Donnees de localisation
- Donnees financieres ou de paiement
- Donnees de sante ou de forme physique
- Historique de navigation
- Historique de recherche
- Diagnostics
- Donnees publicitaires

---

## Permissions systeme (Usage Descriptions)

Les descriptions suivantes sont configurees dans `app.json` et s'affichent automatiquement dans les alertes iOS :

| Permission | Cle infoPlist | Description affichee |
|------------|---------------|----------------------|
| Camera | NSCameraUsageDescription | MyTools necessite l'acces a l'appareil photo pour vous permettre de prendre des photos de vos jantes lors de vos demandes de devis. |
| Photos (lecture) | NSPhotoLibraryUsageDescription | MyTools necessite l'acces a votre bibliotheque de photos pour vous permettre de selectionner des photos de vos jantes pour vos demandes de devis. |
| Photos (ecriture) | NSPhotoLibraryAddUsageDescription | MyTools souhaite enregistrer des photos dans votre bibliotheque. |
| Face ID | NSFaceIDUsageDescription | MyTools utilise Face ID pour vous permettre de vous connecter de maniere securisee et rapide a votre compte. |
| Notifications | Gere par expo-notifications | Alertes pour les mises a jour de devis, factures et rendez-vous. |
| Tracking (ATT) | NSUserTrackingUsageDescription | MyTools n'effectue aucun suivi publicitaire. Votre vie privee est notre priorite. |
| Microphone | NSMicrophoneUsageDescription | MyTools n'utilise pas le microphone. |
| Localisation | NSLocationWhenInUseUsageDescription | MyTools n'utilise pas votre localisation. |

### Chiffrement
| Cle | Valeur | Raison |
|-----|--------|--------|
| ITSAppUsesNonExemptEncryption | NO | L'application utilise uniquement HTTPS standard (TLS/SSL) pour les communications reseau, ce qui est exempt. |

---

## Conformite RGPD

L'application est conforme au RGPD (Reglement General sur la Protection des Donnees) :

1. **Consentement explicite** : Ecran de consentement obligatoire au premier lancement avec 3 checkboxes distinctes
2. **Droit d'acces** : L'utilisateur peut consulter toutes ses donnees dans l'onglet Profil
3. **Droit a l'effacement (Article 17)** : Suppression de compte avec processus en 2 etapes :
   - Etape 1 : Liste explicite de toutes les donnees qui seront supprimees
   - Etape 2 : Confirmation par checkbox avec mention legale RGPD
4. **Politique de confidentialite** : Accessible depuis le profil et l'ecran de consentement
5. **Mentions legales** : Accessibles depuis le profil et l'ecran de consentement
6. **Pas de tracking publicitaire** : Aucun SDK publicitaire, aucun suivi utilisateur
5
---

## Configuration technique

### Build avec EAS (Expo Application Services)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Se connecter
eas login

# Configurer le projet (si premier build)
eas build:configure

# Build iOS pour soumission
eas build --platform ios --profile production

# Soumettre a l'App Store
eas submit --platform ios
```

### eas.json (configuration recommandee)

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "autoIncrement": true
      },
      "android": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "VOTRE_APPLE_ID",
        "ascAppId": "VOTRE_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "VOTRE_TEAM_ID"
      }
    }
  }
}
```

### Variables d'environnement requises

| Variable | Description | Ou la configurer |
|----------|-------------|------------------|
| EXTERNAL_API_URL | URL de l'API backend | Secret Replit / EAS Secrets |

---

## Checklist avant soumission

### App Store Connect
- [ ] Compte Apple Developer actif (99 $/an)
- [ ] App creee dans App Store Connect
- [ ] Identifiants de demo renseignes dans "App Review Information"
- [ ] Screenshots fournies (iPhone 6.7", iPhone 6.1", iPad si applicable)
- [ ] Icone de l'app (1024x1024 PNG sans transparence)
- [ ] Description, sous-titre et mots-cles renseignes
- [ ] Categorie selectionnee (Economie et entreprise)
- [ ] URL de politique de confidentialite renseignee
- [ ] URL de support renseignee
- [ ] Privacy labels (App Privacy) remplis comme decrit ci-dessus
- [ ] Classification d'age selectionnee (4+)

### Technique
- [ ] Build de production cree avec `eas build --platform ios`
- [ ] Build uploade avec `eas submit --platform ios`
- [ ] L'API backend (`apps.mytoolsgroup.eu`) est accessible et fonctionnelle
- [ ] Le compte de demo fonctionne correctement
- [ ] Toutes les permissions ont des descriptions claires en francais
- [ ] `ITSAppUsesNonExemptEncryption` est defini sur `NO`
- [ ] Pas de crash au lancement
- [ ] Le consentement RGPD s'affiche au premier lancement

### Conformite Apple
- [ ] L'app ne mentionne pas Android ou Google Play
- [ ] L'app ne contient pas de contenu de test ou placeholder visible
- [ ] Tous les liens (mentions legales, confidentialite) fonctionnent
- [ ] L'ecran de suppression de compte est fonctionnel (requis par Apple depuis 2022)
- [ ] L'app fonctionne en mode avion (affiche un message d'erreur clair, ne crash pas)
- [ ] L'app supporte le mode sombre et le mode clair
- [ ] L'app respecte les Safe Areas (encoche, Dynamic Island)

### Screenshots requises

Fournir des captures d'ecran pour les tailles suivantes :
- **iPhone 6.7"** (iPhone 15 Pro Max / 16 Pro Max) : 1290 x 2796 px
- **iPhone 6.1"** (iPhone 15 / 16) : 1179 x 2556 px
- **iPad 12.9"** (si supporte) : 2048 x 2732 px

Screenshots recommandees (dans l'ordre) :
1. Ecran de connexion avec le logo
2. Tableau de bord (Accueil) avec les statistiques
3. Liste des devis
4. Formulaire de demande de devis (avec photo)
5. Onglet Profil (style iOS Settings)
6. Ecran de consentement RGPD

---

## Raisons courantes de rejet et comment les eviter

| Motif de rejet | Solution implementee |
|----------------|---------------------|
| Pas de compte demo | Fournir des identifiants dans App Review Information |
| Pas de suppression de compte | Ecran de suppression en 2 etapes dans Profil > Zone critique |
| Descriptions de permissions vagues | Descriptions detaillees en francais expliquant pourquoi chaque permission est necessaire |
| Pas de politique de confidentialite | Ecran accessible dans l'app + URL a renseigner dans App Store Connect |
| Crash au lancement | ErrorBoundary global avec bouton de relance |
| Contenu uniquement web | L'app offre une experience native complete avec navigation par onglets, camera, notifications |
| Metadata incorrecte | Verifier que nom, description et screenshots sont coherents |

---

## URLs importantes

| Ressource | URL |
|-----------|-----|
| API Backend | `https://apps.mytoolsgroup.eu/api` |
| Espace client web | `https://apps.mytoolsgroup.eu` |
| Apple Developer | `https://developer.apple.com` |
| App Store Connect | `https://appstoreconnect.apple.com` |
| EAS Dashboard | `https://expo.dev` |

---

## Support et contact

Pour toute question technique liee a la soumission :
- Verifier les logs EAS : `eas build:list`
- Consulter le statut de review dans App Store Connect
- En cas de rejet, lire attentivement le message d'Apple et ajuster en consequence

---

*Document genere le 06/03/2026 - MyTools v1.0.0*
