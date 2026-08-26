#!/bin/bash
# BidBlitz Mobile Build Package Preparation
# ==========================================
# Prepares Android/iOS projects for external builds (outside Emergent).
# Run this ONCE before transferring the /app/frontend folder to your local machine.

set -e

echo "🚀 BidBlitz Mobile Build Package - Final Preparation"
echo "====================================================="
echo ""

# 1. Install dependencies
echo "📦 [1/4] Installing dependencies..."
if [ ! -d "node_modules" ]; then
  yarn install
else
  echo "✓ node_modules exists, skipping yarn install (run 'yarn install' manually if needed)"
fi
echo ""

# 2. Build production web assets
echo "🔨 [2/4] Building production web assets..."
yarn build
echo "✓ Web build complete → build/"
echo ""

# 3. Sync to Android
echo "🤖 [3/4] Syncing web assets to Android..."
npx cap sync android
echo "✓ Android project ready → android/"
echo ""

# 4. Sync to iOS
echo "🍎 [4/4] Syncing web assets to iOS..."
npx cap sync ios
echo "✓ iOS project ready → ios/"
echo ""

echo "✅ BUILD PACKAGE READY"
echo "======================="
echo ""
echo "📁 TRANSFER THE FOLLOWING FOLDER TO YOUR LOCAL MACHINE:"
echo "   /app/frontend/"
echo ""
echo "🔧 NEXT STEPS (on your local machine):"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 ANDROID BUILD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Generate upload keystore (ONE TIME - keep forever):"
echo "    cd android"
echo "    keytool -genkeypair -v \\"
echo "      -keystore bidblitz-upload.jks \\"
echo "      -alias bidblitz \\"
echo "      -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS"
echo ""
echo "2️⃣  Create keystore.properties:"
echo "    cp keystore.properties.template keystore.properties"
echo "    # Edit keystore.properties with your passwords"
echo ""
echo "3️⃣  Extract SHA256 fingerprint:"
echo "    keytool -list -v -keystore bidblitz-upload.jks -alias bidblitz"
echo "    # Copy SHA256 → paste into public/.well-known/assetlinks.json"
echo ""
echo "4️⃣  Build release AAB (for Google Play):"
echo "    cd android"
echo "    ./build-release-aab.sh"
echo "    # Output: android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "5️⃣  Build debug APK (for testing):"
echo "    ./gradlew assembleDebug"
echo "    # Output: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "📖 Full guide: deploy/ANDROID_SIGNING_STEPS.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🍎 iOS BUILD (macOS + Xcode required)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Get Apple Team ID:"
echo "    → https://developer.apple.com/account → Membership Details"
echo ""
echo "2️⃣  Paste Team ID into:"
echo "    public/.well-known/apple-app-site-association"
echo "    (replace REPLACE_TEAMID with your actual Team ID)"
echo ""
echo "3️⃣  Open Xcode project:"
echo "    npx cap open ios"
echo ""
echo "4️⃣  In Xcode:"
echo "    - Select App target"
echo "    - Signing & Capabilities → select Team"
echo "    - Add capability: Associated Domains"
echo "      • applinks:bidblitz.ae"
echo "      • webcredentials:bidblitz.ae"
echo "    - Product → Archive"
echo "    - Distribute App → App Store Connect → Upload"
echo ""
echo "📖 Full guide: deploy/IOS_RELEASE_STEPS.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BUNDLE ID VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Capacitor appId:       com.bidblitz.app"
echo "  Android applicationId: com.bidblitz.app"
echo "  iOS Bundle ID:         com.bidblitz.app"
echo ""
echo "🎯 READY TO BUILD!"
