#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

detect_java_home() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    echo "$JAVA_HOME"
    return 0
  fi
  for candidate in \
    /usr/lib/jvm/java-17-openjdk-arm64 \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/java-17-openjdk; do
    if [ -x "$candidate/bin/java" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

print_header() {
  echo "📦 BidBlitz Android Release Doctor"
  echo "================================="
}

print_header

ARCH="$(uname -m)"
JAVA_HOME="$(detect_java_home || true)"
ANDROID_SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [ -z "$ANDROID_SDK_DIR" ] && [ -f "$ROOT_DIR/local.properties" ]; then
  ANDROID_SDK_DIR="$(sed -n 's/^sdk.dir=//p' "$ROOT_DIR/local.properties" | head -n 1)"
fi

if [ -z "$JAVA_HOME" ]; then
  echo "❌ Java 17 nicht gefunden. Bitte JAVA_HOME auf ein JDK 17 setzen."
  exit 1
fi

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

VERSION_CODE="${ANDROID_VERSION_CODE:-$(sed -n 's/.*readEnvOrProp('\''ANDROID_VERSION_CODE'\'', '\''\([0-9][0-9]*\)'\'').*/\1/p' "$ROOT_DIR/app/build.gradle" | head -n 1)}"
VERSION_NAME="${ANDROID_VERSION_NAME:-$(sed -n 's/.*readEnvOrProp('\''ANDROID_VERSION_NAME'\'', '\''\([^'\'']*\)'\'').*/\1/p' "$ROOT_DIR/app/build.gradle" | head -n 1)}"

if [ -z "$ANDROID_SDK_DIR" ] || [ ! -d "$ANDROID_SDK_DIR" ]; then
  echo "❌ Android SDK nicht gefunden. Bitte ANDROID_SDK_ROOT/ANDROID_HOME setzen oder local.properties pflegen."
  exit 1
fi

if [ ! -f "$ROOT_DIR/keystore.properties" ]; then
  echo "❌ keystore.properties fehlt unter frontend/android/."
  echo "   Für Google Play App Signing: Vorlage kopieren und Upload-Key eintragen."
  exit 1
fi

if grep -q 'CHANGE_ME' "$ROOT_DIR/keystore.properties"; then
  echo "❌ keystore.properties enthält noch Platzhalterwerte."
  exit 1
fi

if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  echo "⚠️  Container-Architektur: $ARCH"
  echo "⚠️  Bekannter Blocker: Android Gradle Plugin 8.7.2 lädt hier nur x86_64-AAPT2-Binaries."
  echo "⚠️  Erwartetes Symptom: mergeReleaseResources / AAPT2 Syntax error / Exec format error."
fi

echo "• Java: $(java -version 2>&1 | head -n 1)"
echo "• JAVA_HOME: $JAVA_HOME"
echo "• Android SDK: $ANDROID_SDK_DIR"
echo "• Architektur: $ARCH"
echo "• VersionCode: ${VERSION_CODE:-unbekannt}"
echo "• VersionName: ${VERSION_NAME:-unbekannt}"

cd "$PROJECT_ROOT"
echo "• Web-Build startet ..."
yarn build >/tmp/bidblitz-android-web-build.log 2>&1 || {
  echo "❌ Frontend-Build fehlgeschlagen. Log: /tmp/bidblitz-android-web-build.log"
  exit 1
}

echo "• Capacitor Sync startet ..."
npx cap sync android >/tmp/bidblitz-android-cap-sync.log 2>&1 || {
  echo "❌ Capacitor Sync fehlgeschlagen. Log: /tmp/bidblitz-android-cap-sync.log"
  exit 1
}

cd "$ROOT_DIR"
echo "• Gradle bundleRelease startet ..."
if ./gradlew bundleRelease >/tmp/bidblitz-android-bundle.log 2>&1; then
  echo "✅ Release-AAB erfolgreich gebaut"
  echo "📍 Ausgabe: $ROOT_DIR/app/build/outputs/bundle/release/"
  exit 0
fi

if grep -Eq 'AAPT2|Exec format error|Syntax error: "\(" unexpected' /tmp/bidblitz-android-bundle.log; then
  echo "❌ Build blockiert durch bekannten ARM64/AAPT2-Containerfehler."
  echo "   Bitte denselben Befehl auf x86_64 (Android Studio / Linux CI / Mac) ausführen."
  echo "   Log: /tmp/bidblitz-android-bundle.log"
  exit 2
fi

echo "❌ bundleRelease fehlgeschlagen. Log: /tmp/bidblitz-android-bundle.log"
exit 1