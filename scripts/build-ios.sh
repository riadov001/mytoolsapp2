#!/bin/bash
set -e

echo "================================================"
echo "  Build iOS (EAS)"
echo "================================================"

if [ -z "$EXPO_TOKEN" ]; then
  echo "ERROR: EXPO_TOKEN secret is missing."
  echo "Add it via the Secrets panel and retry."
  exit 1
fi

PROFILE="${EAS_PROFILE:-preview}"
PLATFORM="ios"

echo "Profile : $PROFILE"
echo "Platform: $PLATFORM"
echo "Owner   : mytoolsgroup"
echo

case "$PROFILE" in
  preview|development)
    echo "Note: '$PROFILE' produces an iOS Simulator build (.app, no signing)."
    echo "      To build a signed IPA for TestFlight / App Store, run:"
    echo "        EAS_PROFILE=production bash scripts/build-ios.sh"
    ;;
  production)
    echo "Note: 'production' profile builds a signed IPA for App Store."
    echo "      First time only: run interactively in the Shell to set up"
    echo "      Apple credentials (Distribution Certificate + Provisioning"
    echo "      Profile). EAS will store them remotely after that."
    echo "        EXPO_TOKEN=\$EXPO_TOKEN npx eas-cli credentials --platform ios"
    echo
    if [ -z "$EXPO_APPLE_ID" ] && [ -z "$ASC_API_KEY_PATH" ]; then
      echo "WARNING: EXPO_APPLE_ID / ASC_API_KEY_PATH not set — non-interactive"
      echo "         signing will fail if remote credentials are not yet"
      echo "         provisioned for this project. The build will still be"
      echo "         queued; check the EAS dashboard for the actual outcome."
    fi
    ;;
  *)
    echo "Note: using custom profile '$PROFILE'."
    ;;
esac
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

if [ "$PROFILE" = "production" ]; then
  echo
  echo "After the build completes, submit to App Store Connect with:"
  echo "  EXPO_TOKEN=\$EXPO_TOKEN npx eas-cli submit --platform ios --latest --non-interactive"
fi
