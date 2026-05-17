#!/usr/bin/env bash
#
# BidBlitz — Android Release AAB Build (Auto-SDK-Install + Sign)
#
# Run this LOCALLY on macOS or Linux. NOT in the Emergent container (no Android SDK).
#
# Output: app/build/outputs/bundle/release/app-release.aab
#         (signed with bidblitz-upload.jks, ready for Play Console)
#

set -e

ANDROID_DIR="$(dirname "$(readlink -f "$0")")/android"
SDK_DIR="${ANDROID_HOME:-$HOME/Android/sdk}"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "❌ android/ folder not found. Run this script from /app/frontend/"
  exit 1
fi

# ── 1. Auto-install Android SDK if missing ──
if [ ! -d "$SDK_DIR/platforms" ]; then
  echo "⚠️  Android SDK not found at $SDK_DIR"
  echo "Installing minimal SDK (~3 GB)..."
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install android-commandlinetools || true
    SDK_DIR="$HOME/Library/Android/sdk"
  else
    mkdir -p "$SDK_DIR/cmdline-tools"
    cd "$SDK_DIR/cmdline-tools"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
      curl -L https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o tools.zip
    fi
    unzip -q tools.zip
    mv cmdline-tools latest
    rm tools.zip
  fi
  
  export ANDROID_HOME="$SDK_DIR"
  export PATH="$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"
  
  yes | sdkmanager --licenses > /dev/null
  sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools" "ndk;26.1.10909125"
fi

export ANDROID_HOME="$SDK_DIR"
KEYSTORE_PATH="${ANDROID_KEYSTORE_FILE:-$ANDROID_DIR/bidblitz-upload.jks}"
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"

# ── 2. local.properties (Gradle finds SDK) ──
echo "sdk.dir=$SDK_DIR" > "$ANDROID_DIR/local.properties"

# ── 3. Verify keystore exists ──
if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "❌ Keystore not found: $KEYSTORE_PATH"
  echo "Restore it from your secure vault or provide ANDROID_KEYSTORE_FILE."
  exit 1
fi

if [ ! -f "$KEYSTORE_PROPS" ]; then
  if [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ] && [ -n "${ANDROID_KEY_ALIAS:-}" ] && [ -n "${ANDROID_KEY_PASSWORD:-}" ]; then
    cat > "$KEYSTORE_PROPS" <<EOF
storeFile=$KEYSTORE_PATH
storePassword=${ANDROID_KEYSTORE_PASSWORD}
keyAlias=${ANDROID_KEY_ALIAS}
keyPassword=${ANDROID_KEY_PASSWORD}
EOF
    trap 'rm -f "$KEYSTORE_PROPS"' EXIT
  else
    echo "❌ keystore.properties fehlt und ANDROID_* Secrets sind unvollständig"
    exit 1
  fi
fi

# ── 4. Web-build + Capacitor sync ──
cd "$(dirname "$ANDROID_DIR")"
echo "→ Building web bundle..."
yarn install --frozen-lockfile
yarn build

echo "→ Capacitor sync android..."
npx cap sync android

# ── 5. Gradle Release Build ──
cd "$ANDROID_DIR"
echo "→ Gradle bundleRelease (~5 Min)..."
./gradlew bundleRelease --no-daemon

AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

if [ ! -f "$AAB" ]; then
  echo "❌ Build failed. AAB not produced."
  exit 1
fi

# ── 6. Output Summary ──
echo ""
echo "✅ Production AAB built successfully!"
echo "   File: $AAB"
echo "   Size: $(du -h "$AAB" | cut -f1)"
echo ""
echo "→ SHA256: $(sha256sum "$AAB" | cut -d' ' -f1)"
echo ""
echo "Next: Upload to Play Console → Internal Testing Track"
echo "      https://play.google.com/console"
