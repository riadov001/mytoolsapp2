#!/bin/bash
set -e

echo "================================================"
echo "  Submit latest EAS build(s) to the stores"
echo "================================================"

if [ -z "$EXPO_TOKEN" ]; then
  echo "ERROR: EXPO_TOKEN secret is missing."
  exit 1
fi

PLATFORM="${SUBMIT_PLATFORM:-all}"

echo "Platform: $PLATFORM"
echo "Owner   : mytoolsgroup"
echo

submit_android() {
  echo
  echo "------------------------------------------------"
  echo "  Submitting latest Android build to Play Store"
  echo "------------------------------------------------"
  if [ -z "$GOOGLE_SERVICE_ACCOUNT_KEY" ] || [ ! -f "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
    echo "WARNING: GOOGLE_SERVICE_ACCOUNT_KEY is not set or the file does not"
    echo "         exist. The Play Console service-account JSON path is required"
    echo "         (see eas.json -> submit.production.android.serviceAccountKeyPath)."
    echo "         The submission will likely fail; continuing anyway so EAS can"
    echo "         report the precise error."
  fi

  EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest submit \
    --platform android \
    --latest \
    --non-interactive \
    --no-wait || {
      echo "Android submission failed. Common causes:"
      echo "  • The latest Android build is an APK (preview profile) — Play Store"
      echo "    requires an AAB. Re-run with EAS_PROFILE=production scripts/build-android.sh"
      echo "  • Service-account JSON missing or lacks Play Console permissions."
      return 1
    }
}

submit_ios() {
  echo
  echo "------------------------------------------------"
  echo "  Submitting latest iOS build to App Store Connect"
  echo "------------------------------------------------"

  EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest submit \
    --platform ios \
    --latest \
    --non-interactive \
    --no-wait || {
      echo "iOS submission failed. Common causes:"
      echo "  • The latest iOS build is a Simulator build (preview profile) —"
      echo "    App Store Connect needs a signed IPA. Re-run with"
      echo "    EAS_PROFILE=production bash scripts/build-ios.sh"
      echo "  • App Store Connect API key not configured. Run once:"
      echo "      EXPO_TOKEN=\$EXPO_TOKEN npx eas-cli credentials --platform ios"
      return 1
    }
}

echo "[1/2] Verifying EAS authentication..."
EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest whoami

echo
echo "[2/2] Submitting..."
case "$PLATFORM" in
  android) submit_android ;;
  ios)     submit_ios ;;
  all)
    submit_android || true
    submit_ios     || true
    ;;
  *)
    echo "ERROR: SUBMIT_PLATFORM must be one of: android, ios, all (got: $PLATFORM)"
    exit 1
    ;;
esac

echo
echo "Done. Track submission status at:"
echo "  https://expo.dev/accounts/mytoolsgroup/projects/mytoolsapp/submissions"
