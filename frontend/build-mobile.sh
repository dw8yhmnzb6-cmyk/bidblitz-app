#!/usr/bin/env bash
# BidBlitz - Mobile (Capacitor) Build Helper
# =========================================
# Usage:
#   ./build-mobile.sh prod              # Build web + sync Android + iOS
#   ./build-mobile.sh dev                # Live-reload against preview URL
#   ./build-mobile.sh android            # Build web + sync Android only
#   ./build-mobile.sh ios                # Build web + sync iOS only
#   ./build-mobile.sh apk                # Build unsigned release APK (Android)
#
# Requirements:
#   - Node 18+, Yarn
#   - Android Studio / JDK 17 for Android builds
#   - Xcode 15+ for iOS builds (macOS only)

set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-prod}"

echo "──────────────────────────────────────────────────"
echo " BidBlitz Capacitor Build — mode: $MODE"
echo "──────────────────────────────────────────────────"

case "$MODE" in
  dev|live)
    echo "▶ Using LIVE-RELOAD config (loads from preview URL)"
    cp capacitor.config.live.ts capacitor.config.ts
    yarn cap sync
    ;;

  prod|all|android|ios)
    # Always restore the production static config (no server.url)
    git checkout capacitor.config.ts 2>/dev/null || true
    echo "▶ Web build (yarn build) ..."
    REACT_APP_BACKEND_URL="${REACT_APP_BACKEND_URL:-$(grep '^REACT_APP_BACKEND_URL=' .env | cut -d= -f2-)}" \
      yarn build
    if [[ "$MODE" == "prod" || "$MODE" == "all" ]]; then
      echo "▶ cap sync (Android + iOS) ..."
      yarn cap sync
    elif [[ "$MODE" == "android" ]]; then
      echo "▶ cap sync android ..."
      yarn cap sync android
    elif [[ "$MODE" == "ios" ]]; then
      echo "▶ cap sync ios ..."
      yarn cap sync ios
    fi
    ;;

  apk)
    git checkout capacitor.config.ts 2>/dev/null || true
    yarn build
    yarn cap sync android
    echo "▶ Gradle assembleRelease ..."
    (cd android && ./gradlew assembleRelease)
    APK="android/app/build/outputs/apk/release/app-release-unsigned.apk"
    if [[ -f "$APK" ]]; then
      echo "✅ APK built: $APK"
      echo "   Sign it with: jarsigner + zipalign (see deploy/MOBILE_BUILD.md)"
    else
      echo "❌ APK build failed"
      exit 1
    fi
    ;;

  *)
    echo "Unknown mode: $MODE"
    echo "Valid: prod | dev | android | ios | apk"
    exit 2
    ;;
esac

echo
echo "✅ Done."
echo "Next steps:"
echo "   Android:  yarn cap open android     (→ Android Studio)"
echo "   iOS:      yarn cap open ios         (→ Xcode)"
