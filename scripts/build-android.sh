#!/bin/bash
set -e

echo "================================================"
echo "  Build Android APK (EAS preview profile)"
echo "================================================"

if [ -z "$EXPO_TOKEN" ]; then
  echo "ERROR: EXPO_TOKEN secret is missing."
  echo "Add it via the Secrets panel and retry."
  exit 1
fi

PROFILE="${EAS_PROFILE:-preview}"
PLATFORM="android"

echo "Profile : $PROFILE"
echo "Platform: $PLATFORM"
echo "Owner   : mytoolsgroup"
echo

echo "[1/3] Verifying EAS authentication..."
EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest whoami

echo
echo "[2/3] Submitting build to EAS (non-interactive, --no-wait)..."
echo "      The build runs on Expo's servers; this command exits as soon as"
echo "      the job is queued. Track progress at the URL printed below."
echo

EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest build \
  --platform "$PLATFORM" \
  --profile "$PROFILE" \
  --non-interactive \
  --no-wait

echo
echo "[3/3] Build queued."
echo "View status: https://expo.dev/accounts/mytoolsgroup/projects/mytoolsapp/builds"
