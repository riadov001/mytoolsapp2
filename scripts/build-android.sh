#!/bin/bash
set -e

echo "================================================"
echo "  MyToolsApp - Build Android APK (Preview)"
echo "================================================"

if [ -z "$EXPO_TOKEN" ]; then
  echo "❌ EXPO_TOKEN manquant. Ajoutez-le dans les secrets Replit."
  echo "   → expo.dev > Account Settings > Access Tokens"
  exit 1
fi

echo "📦 Incrémentation du numéro de build..."
node scripts/increment-build.js

echo ""
echo "🤖 Lancement du build Android APK (profil: preview)..."
npx eas build --platform android --profile preview --non-interactive --no-wait

echo ""
echo "✅ Build Android lancé sur EAS !"
echo "   Suivez l'avancement sur https://expo.dev"
echo "================================================"
