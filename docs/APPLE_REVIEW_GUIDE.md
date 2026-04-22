# Guide complet de soumission App Store — MyToolsApp v2

> Objectif : approbation au premier passage, zéro rejet.  
> Révisé le : Avril 2026 — SDK Expo 54, iOS 17+

---

## 1. Récapitulatif des points critiques (résumé exécutif)

| Priorité | Sujet | Statut |
|----------|-------|--------|
| 🔴 CRITIQUE | `NSFaceIDUsageDescription` dans Info.plist | ✅ Ajouté (app.json) |
| 🔴 CRITIQUE | Plugin `expo-local-authentication` déclaré | ✅ Ajouté (app.json) |
| 🔴 CRITIQUE | Flux suppression de compte accessible | ✅ `/(admin)/delete-account.tsx` présent |
| 🔴 CRITIQUE | Sign in with Apple obligatoire si Google Sign-In présent | ⚠️ Vérifier — voir §6 |
| 🟠 IMPORTANT | Privacy Manifest (PrivacyInfo.xcprivacy) | ⚠️ Vérifier présence dans build EAS |
| 🟠 IMPORTANT | Compte démo pour les reviewers Apple | ⚠️ À préparer — voir §10 |
| 🟠 IMPORTANT | Paiements externes non promus dans l'appli | ✅ App B2B admin uniquement |
| 🟡 MOYEN | Toutes les descriptions d'usage en français | ✅ Présentes |
| 🟡 MOYEN | `ITSAppUsesNonExemptEncryption = NO` | ✅ Déclaré |

---

## 2. Prérequis avant soumission

### 2.1 Compte Apple Developer
- Membership actif (99 $/an)
- App créée dans App Store Connect avec bundle ID : `app.mytoolsmobile.mytoolsgroup.eu`
- Certificats de distribution iOS valides dans EAS (ou Xcode)
- Provisioning profile "App Store Distribution" lié au bundle ID

### 2.2 Build EAS
```bash
eas build --platform ios --profile production
```
Profil `production` dans `eas.json` doit avoir :
```json
"production": {
  "distribution": "store",
  "ios": { "buildConfiguration": "Release" }
}
```

### 2.3 Vérifier la version et le build number
- `version` dans app.json : `"2.0.5"` (doit correspondre à App Store Connect)
- `buildNumber` dans app.json : `"18"` (doit être supérieur au build précédent soumis)

---

## 3. Info.plist — Descriptions d'utilisation des permissions

Toutes ces clés sont déclarées dans `app.json → ios.infoPlist`. Vérifier qu'elles sont présentes dans le `.ipa` généré.

| Clé Info.plist | Statut | Texte (FR) |
|----------------|--------|------------|
| `NSCameraUsageDescription` | ✅ | "MyTools Admin utilise l'appareil photo pour photographier les véhicules et pièces dans le cadre des devis." |
| `NSPhotoLibraryUsageDescription` | ✅ | "MyTools Admin accède à la galerie pour joindre des photos aux devis et demandes de service." |
| `NSPhotoLibraryAddUsageDescription` | ✅ | "MyTools Admin peut enregistrer des photos dans votre bibliothèque." |
| `NSCalendarsUsageDescription` | ✅ | "MyTools synchronise vos rendez-vous avec votre calendrier natif." |
| `NSFaceIDUsageDescription` | ✅ | "MyTools utilise Face ID pour sécuriser l'accès à votre compte administrateur." |
| `NSUserNotificationsUsageDescription` | ✅ | "MyTools vous envoie des notifications pour les mises à jour de devis, nouvelles factures et rappels de rendez-vous." |
| `ITSAppUsesNonExemptEncryption` | ✅ | `NO` (évite le questionnaire EAR) |

> **Comment vérifier après le build EAS :**  
> Télécharger le `.ipa`, le renommer en `.zip`, l'extraire, ouvrir `Payload/MyToolsApp.app/Info.plist` et vérifier que toutes les clés ci-dessus sont présentes.

---

## 4. Privacy Manifest (PrivacyInfo.xcprivacy)

Depuis iOS 17 / Spring 2024, Apple exige un Privacy Manifest pour toute app utilisant des APIs "required reason". Expo SDK 54 le génère automatiquement mais il faut vérifier.

### 4.1 APIs concernées dans MyToolsApp
- `expo-secure-store` → accès au trousseau (NSPrivacyAccessedAPICategoryUserDefaults ou Keychain)
- `AsyncStorage` → `NSPrivacyAccessedAPICategoryUserDefaults`  
- `expo-local-authentication` → aucune "required reason API" directe, mais déclare l'usage de biométrie

### 4.2 Vérification post-build
Après `eas build`, Apple envoie un email si le manifest est manquant. Sinon, vérifier via :
```bash
# Extraire le .ipa → .zip → Payload/
find Payload/ -name "PrivacyInfo.xcprivacy" 
```

### 4.3 Si le manifest est absent
Créer `ios/PrivacyInfo.xcprivacy` (à placer dans le dossier `ios/` avant le build natif) :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
</dict>
</plist>
```
Puis dans `app.json → ios.privacyManifests` ou via un plugin EAS custom.

---

## 5. App Tracking Transparency (ATT)

MyToolsApp est une **application B2B interne** (gestion de garage). Elle ne fait pas de publicité ciblée, ne collecte pas d'IDFA, et n'utilise pas de SDK publicitaires.

**Conclusion : ATT n'est pas requis.**

> ⚠️ Si Firebase Analytics ou un SDK tiers collecte l'IDFA (Advertising Identifier), il faudra ajouter `expo-tracking-transparency` et demander la permission avant toute collecte. Vérifier dans Firebase Console que "Advertising ID" est désactivé.

---

## 6. Sign in with Apple — Conformité obligatoire

### Règle Apple (Guideline 4.8)
Si l'app propose **un système de connexion social tiers** (Google, Facebook, etc.) pour créer un compte, elle **doit** également proposer Sign in with Apple.

### État actuel
- Google Sign-In est implémenté (`expo-web-browser` + Firebase) ✅
- Sign in with Apple est importé (`expo-apple-authentication`) ✅
- Le plugin est déclaré dans app.json ✅

### Vérifications à faire

1. **Le bouton Apple est-il visible sur l'écran de connexion ?**  
   Ouvrir `app/(auth)/login.tsx` et chercher `AppleAuthentication`. S'il est présent mais masqué sur iOS, cela peut bloquer l'approbation.

2. **Le bouton doit respecter les guidelines visuelles Apple :**
   - Fond noir ou blanc uniquement (pas de rouge #DC2626)
   - Texte "Sign in with Apple" ou "Continuer avec Apple" (en français : "Continuer avec Apple")
   - Taille minimum : 44pt de hauteur
   - Ne pas modifier le logo Apple

3. **Gestion de la déconnexion Apple :**  
   Si un utilisateur se connecte via Apple et supprime son compte, Apple doit être notifié via `revokeAsync`. Vérifier dans `delete-account.tsx` et dans `auth-context.tsx → logout`.

### Code de vérification (à ajouter si absent)
```typescript
// Dans logout() ou handleDeleteAccount() :
import * as AppleAuthentication from 'expo-apple-authentication';
if (Platform.OS === 'ios') {
  try {
    const credential = await AppleAuthentication.getCredentialStateAsync(appleUserId);
    if (credential === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) {
      await AppleAuthentication.refreshAsync({ user: appleUserId, requestedScopes: [] });
    }
  } catch {}
}
```

---

## 7. Flux de suppression de compte

Apple exige (Guideline 5.1.1(v)) que toute app permettant la création de compte **doit** offrir la suppression du compte depuis l'application.

### État actuel
- `app/(admin)/delete-account.tsx` : ✅ Présent et fonctionnel
- Le flux supprime via `DELETE /api/users/me` puis déconnecte l'utilisateur
- Confirmation en 2 étapes (confirm → final) ✅

### Vérifications
1. **La page est-elle accessible depuis les paramètres ?**  
   Chercher dans `app/(admin)/settings.tsx` ou équivalent un lien vers `delete-account`. Si absent, ajouter un bouton "Supprimer mon compte" dans les paramètres de l'utilisateur.

2. **Délai de suppression :**  
   Apple accepte un délai raisonnable (jusqu'à 30 jours) pour la suppression effective des données, **à condition que ce délai soit clairement communiqué** à l'utilisateur dans l'interface. Ajouter un message si nécessaire : "Votre compte sera supprimé définitivement dans les 24 heures."

3. **URL de politique de suppression :**  
   App Store Connect demande une URL vers la page de suppression de compte. Préparer cette URL (ex: `https://mytoolsgroup.eu/supprimer-mon-compte`).

---

## 8. Paiements et achats in-app

### Règle Apple (Guideline 3.1.1)
Les apps **ne peuvent pas** promouvoir, rediriger ou faciliter des paiements hors App Store pour des biens/services numériques consommés dans l'app.

### Exemption applicable : B2B / Entreprise
MyToolsApp est une app de **gestion interne** (devis, factures, rendez-vous) pour des garages partenaires. Elle ne vend **pas** de contenu numérique aux utilisateurs. Elle génère des documents commerciaux B2B.

**Cette app est exemptée de la règle IAP.** Les paiements Stripe/Klarna/Alma apparaissant dans les factures sont des transactions B2B entre le garage et ses clients finaux, pas des achats in-app.

> ⚠️ **Attention :** Ne jamais inclure de bouton "Payer maintenant" ou lien vers Stripe Checkout accessible depuis l'app, même pour des clients finaux. Si un tel flux existe, le cacher sur iOS ou passer par IAP.

---

## 9. Métadonnées App Store Connect

### 9.1 Catégorie
- Catégorie principale : **Business**
- Sous-catégorie : **Productivity** (ou Finance)

### 9.2 Âge minimum
- **4+** (application professionnelle sans contenu sensible)

### 9.3 Description (à utiliser comme base)
```
MyTools Admin est l'application de gestion exclusive pour les administrateurs des garages partenaires MyTools Group.

Gérez votre activité depuis votre iPhone :
• Créez et envoyez des devis professionnels en quelques secondes
• Générez des factures et suivez les paiements
• Planifiez et gérez les rendez-vous de vos clients
• Consultez vos tableaux de bord et statistiques en temps réel
• Gérez votre base clients

Application réservée aux professionnels. Un compte administrateur MyTools Group est requis.
```

### 9.4 Mots-clés (100 caractères max)
```
gestion garage,devis,facture,rendez-vous,administrateur,professionnel,atelier,réparation
```

### 9.5 URL de support
`https://mytoolsgroup.eu/support`

### 9.6 URL de politique de confidentialité
`https://mytoolsgroup.eu/politique-confidentialite`
(Obligatoire — doit mentionner : données collectées, durée de conservation, droits RGPD)

---

## 10. Compte démo pour les reviewers Apple

> **C'est l'une des raisons de rejet les plus fréquentes.** Si Apple ne peut pas se connecter, l'app est rejetée.

### Ce qu'Apple demande
- Email et mot de passe fonctionnels pour un compte démo
- Le compte doit avoir accès à toutes les fonctionnalités testables
- Les données doivent être préchargées (clients, devis, factures, RDV exemples)

### Compte à préparer
Créer un compte administrateur sur `app-backend.mytoolsgroup.eu` avec :
- Email : `reviewer@mytoolsgroup.eu` (ou similar)
- Mot de passe : `AppleReview2026!` (exemple — à changer)
- Garage de démo préchargé avec 3-5 clients fictifs, 2-3 devis, 2-3 factures, 2-3 RDV

### Dans la fiche App Store Connect
Section "Notes for reviewers" :
```
This is a B2B admin application for MyTools Group partner garages. 
An admin account is required to access the app.

Demo credentials:
Email: reviewer@mytoolsgroup.eu
Password: [votre mot de passe]

The demo account has full access to all features including quotes, 
invoices, reservations, and client management.
Note: This app is in French (professional B2B tool for French garages).
```

---

## 11. Captures d'écran requises

### Tailles obligatoires
| Appareil | Résolution | Quantité |
|----------|-----------|---------|
| iPhone 6.9" (Pro Max) | 1320×2868 | 3 minimum |
| iPhone 6.7" (Pro Max précédent) | 1290×2796 | 3 minimum |
| iPad Pro 13" (si `supportsTablet: true`) | 2064×2752 | 3 minimum |

> `supportsTablet: true` est activé dans app.json — les captures iPad sont donc **obligatoires**.

### Contenu des captures (recommandé)
1. Dashboard / accueil avec KPIs
2. Liste des devis ou création d'un devis
3. Agenda / liste des rendez-vous
4. Formulaire client
5. Génération de facture

### Outils
- Simulateur Xcode : iPhone 16 Pro Max (6.9") + iPad Pro M4 13"
- Ou service en ligne : [appscreens.com](https://appscreens.com) / [screenshots.guru](https://screenshots.guru)

---

## 12. Checklist finale avant soumission

```
TECHNIQUE
[ ] Build EAS production réussi sans warnings critiques
[ ] .ipa vérifié : toutes les clés NSUsageDescription présentes
[ ] PrivacyInfo.xcprivacy présent dans le bundle
[ ] expo-apple-authentication : bouton visible sur écran login iOS
[ ] Biométrie : NSFaceIDUsageDescription présent (ajouté ✅)
[ ] expo-local-authentication plugin déclaré (ajouté ✅)
[ ] Flux suppression de compte fonctionnel et accessible depuis les paramètres
[ ] Test sur appareil physique (pas seulement simulateur)
[ ] Pas de crash sur iPhone SE (petit écran) ni iPad

APP STORE CONNECT
[ ] Version 2.0.5 créée dans App Store Connect
[ ] Build number 18 uploadé via EAS Submit ou Transporter
[ ] Catégorie : Business
[ ] Âge : 4+
[ ] Description en français (et anglais si voulu)
[ ] Captures d'écran iPhone 6.9" uploadées
[ ] Captures d'écran iPad Pro 13" uploadées
[ ] URL politique de confidentialité renseignée
[ ] URL de suppression de compte renseignée
[ ] Compte démo reviewer renseigné dans "Notes for reviewers"
[ ] Export Compliance : "Does your app use encryption?" → NO (ou YES si HTTPS — répondre selon guide Apple)
[ ] Questionnaire IDFA : No (pas d'Advertising ID utilisé)

CONTENU
[ ] Pas de contenu adulte / violent / politique
[ ] Pas de liens externes vers paiements Stripe/Checkout accessibles aux clients finaux
[ ] Logo Apple Sign In conforme (noir/blanc, taille min 44pt)
```

---

## 13. Questions fréquentes (FAQ Review)

**Q : Apple va-t-il rejeter parce que l'app nécessite un compte professionnel ?**  
R : Non, si la mention est claire dans la description. Ajouter : "Réservé aux professionnels — Compte administrateur MyTools Group requis."

**Q : L'app utilise-t-elle des frameworks privés Apple ?**  
R : Non. Expo SDK 54 utilise uniquement des APIs publiques iOS.

**Q : Y a-t-il des APIs "required reason" non déclarées ?**  
R : `expo-secure-store` et `AsyncStorage` utilisent `UserDefaults` → déclarés dans PrivacyInfo. Vérifier le build.

**Q : Firebase est-il acceptable ?**  
R : Oui. Firebase est largement utilisé et approuvé. S'assurer que `Advertising ID` est désactivé dans Firebase Console (Analytics → Privacy → Disable advertising ID).

**Q : Le chiffrement HTTPS est-il un problème ?**  
R : HTTPS standard (TLS) est exempt de déclaration EAR. `ITSAppUsesNonExemptEncryption = NO` est correct.

---

## 14. En cas de rejet

### Délai de réponse Apple
- Première révision : 24-48h en général
- Après réponse à un rejet : 24h

### Template de réponse à un rejet
```
Dear App Review Team,

Thank you for your detailed feedback. We have addressed the issue as follows:

[Issue X] - [Description de la correction appliquée]

We have updated the build and resubmitted. The demo credentials remain:
Email: reviewer@mytoolsgroup.eu  
Password: [votre mot de passe]

Please let us know if you need any additional information.

Best regards,
MyTools Group Team
```

### Escalade
Si un rejet semble injustifié : utiliser le bouton "Appeal" dans App Store Connect (Resolution Center → Appeal).
