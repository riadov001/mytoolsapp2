#!/bin/bash
set -e

echo "================================================"
echo "  MyToolsApp - Build Android APK (Preview)"
echo "================================================"

if [ -z "$EXPO_TOKEN" ]; then
  echo "EXPO_TOKEN manquant. Ajoutez-le dans les secrets Replit."
  exit 1
fi

ANDROID_OWNER="mytoolsapps"
ANDROID_PROJECT_ID="184bb31c-8fb0-42ce-b71f-8408a91225b3"
IOS_OWNER="mytoolsgroup"
IOS_PROJECT_ID="2429ee3a-9dd5-4767-9532-175f1db29ff3"

echo "Incrémentation du build Android..."
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('app.json','utf8'));
const old = j.expo.android.versionCode || 1;
j.expo.android.versionCode = old + 1;
fs.writeFileSync('app.json', JSON.stringify(j, null, 2) + '\n');
console.log('Android versionCode: ' + old + ' → ' + (old+1));
"

echo "Basculement vers le projet Android (mytoolsapps)..."
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('app.json','utf8'));
j.expo.owner = '$ANDROID_OWNER';
j.expo.extra.eas.projectId = '$ANDROID_PROJECT_ID';
fs.writeFileSync('app.json', JSON.stringify(j, null, 2) + '\n');
"

restore_ios() {
  echo "Restauration de la config iOS (mytoolsgroup)..."
  node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('app.json','utf8'));
j.expo.owner = '$IOS_OWNER';
j.expo.extra.eas.projectId = '$IOS_PROJECT_ID';
fs.writeFileSync('app.json', JSON.stringify(j, null, 2) + '\n');
"
  echo "Config iOS restaurée."
}

trap restore_ios EXIT

echo "Lancement du build Android sur EAS..."
EAS_NO_VCS=1 npx eas build --platform android --profile preview --non-interactive --no-wait

echo ""
echo "Build Android lancé avec succès !"
echo "Suivez l'avancement sur https://expo.dev/accounts/mytoolsapps/projects/mytoolsapp/builds"
echo "================================================"
