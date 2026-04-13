# MyTools Admin — Launch Ecosystem

Cet écosystème de lancement a été généré pour accompagner la mise en production de **MyTools Admin**.

---

## Structure complète

```
/
├── branding/
│   └── brand-guidelines.md           # Charte graphique complète
│
├── docs/
│   └── app-store/
│       ├── APP_STORE_METADATA.md     # Textes Apple/Google (FR + EN)
│       ├── APP_STORE_METADATA.json   # Métadonnées structurées
│       ├── APP_REVIEW_NOTES.md       # Notes pour les reviewers Apple
│       ├── PRIVACY_POLICY_TEMPLATE.md # Politique de confidentialité RGPD
│       └── IOS_PRIVACY_MANIFEST_TEMPLATE.xcprivacy # Manifeste iOS privacy
│
├── app-store-assets/
│   ├── README.md                     # Guide de création des screenshots
│   └── templates/
│       ├── iphone-67.html            # Template screenshot iPhone 6.7" (1290×2796)
│       ├── iphone-65.html            # Template screenshot iPhone 6.5" (1242×2688)
│       └── iphone-55.html            # Template screenshot iPhone 5.5" (1242×2208)
│
├── launch-kit/
│   ├── product-hunt/
│   │   ├── product-description.md   # Description complète produit
│   │   ├── launch-post.md           # Post de lancement Product Hunt
│   │   └── tagline-options.md       # Options de taglines (A/B)
│   └── press/
│       ├── press-release.md         # Communiqué de presse
│       ├── founder-story.md         # Histoire fondateur / vision
│       └── product-overview.md      # Fiche produit technique et commerciale
│
└── marketing-site/                  # Site marketing Next.js
    ├── app/
    │   ├── page.tsx                 # Page d'accueil
    │   ├── privacy/page.tsx         # Politique de confidentialité
    │   └── support/page.tsx         # Support & FAQ
    ├── components/
    │   ├── Navbar.tsx               # Navigation
    │   ├── Hero.tsx                 # Section héro + mockup
    │   ├── Features.tsx             # 6 fonctionnalités
    │   ├── HowItWorks.tsx           # 3 étapes
    │   ├── Screenshots.tsx          # Aperçu de l'app
    │   ├── CTA.tsx                  # Appel à l'action
    │   └── Footer.tsx               # Pied de page
    └── public/
        └── og-image.html            # Générateur d'image OG
```

---

## Checklist de lancement

### App Store (iOS)

- [ ] Compte Apple Developer actif
- [ ] Bundle ID configuré : `eu.mytoolsgroup.mytools-admin`
- [ ] Icône 1024×1024 (assets/images/icon.png) ✅
- [ ] Screenshots iPhone 6.7" — générer via `app-store-assets/templates/iphone-67.html`
- [ ] Screenshots iPhone 6.5" — générer via `app-store-assets/templates/iphone-65.html`
- [ ] Screenshots iPhone 5.5" — générer via `app-store-assets/templates/iphone-55.html`
- [ ] Description et mots-clés — copier depuis `docs/app-store/APP_STORE_METADATA.md`
- [ ] URL de confidentialité : https://www.mytoolsgroup.eu/privacy
- [ ] URL de support : https://www.mytoolsgroup.eu/support
- [ ] Notes de review — copier depuis `docs/app-store/APP_REVIEW_NOTES.md`
- [ ] Compte demo pour la review (review@mytoolsgroup.eu / Review2024!)
- [ ] Privacy manifest : `docs/app-store/IOS_PRIVACY_MANIFEST_TEMPLATE.xcprivacy`
- [ ] Build via EAS Build : `npx eas build --platform ios`
- [ ] Soumission via EAS Submit : `npx eas submit --platform ios`

### Google Play (Android)

- [ ] Compte Google Play Console actif
- [ ] Package configuré : `eu.mytoolsgroup.mytoolsadmin`
- [ ] Build APK/AAB : `npx eas build --platform android`
- [ ] Feature graphic 1024×500
- [ ] Screenshots Android 1080×1920
- [ ] Description — copier depuis `docs/app-store/APP_STORE_METADATA.md`
- [ ] URL de confidentialité configurée

### Marketing Site

- [ ] Installer les dépendances : `cd marketing-site && npm install`
- [ ] Tester en local : `npm run dev`
- [ ] Générer OG image depuis `public/og-image.html` → sauvegarder comme `public/og-image.png`
- [ ] Copier le favicon : `assets/images/favicon.png` → `marketing-site/public/favicon.ico`
- [ ] Build : `npm run build`
- [ ] Déployer sur Vercel ou hébergeur statique

### Product Hunt

- [ ] Créer le produit sur producthunt.com
- [ ] Utiliser le texte de `launch-kit/product-hunt/launch-post.md`
- [ ] Tagline recommandée : "Quotes. Invoices. Clients. Done in seconds."
- [ ] Préparer les assets visuels (screenshots + logo)
- [ ] Planifier le lancement un mardi ou mercredi à 12h01 PT

### Presse

- [ ] Envoyer le communiqué `launch-kit/press/press-release.md` aux journalistes tech
- [ ] Préparer le press kit (logo + screenshots + overview) en ZIP
- [ ] Cibler : journaux auto professionnels, tech B2B, presse startup française

---

## Identité visuelle

| Élément          | Valeur              |
|------------------|---------------------|
| Couleur principale | `#DC2626`         |
| Fond              | `#0A0A0A`          |
| Typographie titre | Michroma            |
| Typographie corps | Inter               |
| Ton               | Sombre, Apple-style, Performance |
| Langue principale | Français            |
