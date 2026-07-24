# BidBlitz Mobile Build Package - READY ✅

**Status:** Build package preparation COMPLETE  
**Date:** 2026-05-03  
**Bundle ID:** `com.bidblitz.app`

---

## Files Created/Updated

### ✅ Build Scripts
- `/app/frontend/build-mobile-final.sh` — Main build preparation script

### ✅ Android Signing
- `/app/frontend/android/keystore.properties.template` — Keystore config template (already existed)
- `/app/frontend/deploy/ANDROID_SIGNING_STEPS.md` — Complete Android signing guide

### ✅ iOS Release
- `/app/frontend/deploy/IOS_RELEASE_STEPS.md` — Complete iOS release guide

### ✅ Deep Links Configuration
- `/app/frontend/public/.well-known/assetlinks.json` — Android App Links ✅
- `/app/frontend/public/.well-known/apple-app-site-association` — iOS Universal Links ✅

### ✅ Bundle ID Verification
- `/app/frontend/capacitor.config.ts` → `appId: 'com.bidblitz.app'` ✅
- `/app/frontend/android/app/build.gradle` → `applicationId: 'com.bidblitz.app'` ✅
- `/app/frontend/ios/App/App.xcodeproj/project.pbxproj` → `PRODUCT_BUNDLE_IDENTIFIER: 'com.bidblitz.app'` ✅

---

## Build Preparation Status

| Component | Status |
|-----------|--------|
| Capacitor config | ✅ `com.bidblitz.app` |
| Android applicationId | ✅ `com.bidblitz.app` |
| Android namespace | ✅ `com.bidblitz.app` |
| iOS Bundle ID | ✅ `com.bidblitz.app` |
| Android App Links | ✅ `assetlinks.json` exists |
| iOS Universal Links | ✅ `apple-app-site-association` exists |
| Build script | ✅ Executable |
| Android signing guide | ✅ Complete |
| iOS release guide | ✅ Complete |

---

## Transfer Package to Local Machine

**Copy the entire `/app/frontend/` folder to your local machine.**

You can:
1. Use `scp` to download the folder
2. Use Emergent's "Download Code" feature
3. Push to GitHub and clone locally

---

## Exact Commands to Run

### 🚀 STEP 1: Prepare Build Package (Run on server/container)

```bash
cd /app/frontend
./build-mobile-final.sh
```

**This will:**
- Install dependencies (if needed)
- Build production web assets
- Sync to Android project
- Sync to iOS project
- Display next steps

---

### 📱 STEP 2: Android Build (Run on local machine)

#### Debug APK (for testing)

```bash
cd /path/to/frontend/android
./gradlew assembleDebug
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

**Install:**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

#### Release AAB (for Google Play Store)

**Prerequisites:**
```bash
cd /path/to/frontend/android

# 1. Generate keystore (ONE TIME - keep forever)
keytool -genkeypair -v \
  -keystore bidblitz-upload.jks \
  -alias bidblitz \
  -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS

# 2. Create keystore.properties
cp keystore.properties.template keystore.properties
# Edit keystore.properties with your passwords

# 3. Extract SHA256 fingerprint
keytool -list -v -keystore bidblitz-upload.jks -alias bidblitz
# Copy SHA256 → paste into ../public/.well-known/assetlinks.json
```

**Build AAB:**
```bash
cd /path/to/frontend/android
./gradlew bundleRelease
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

**📖 Full guide:** `/app/frontend/deploy/ANDROID_SIGNING_STEPS.md`

---

### 🍎 STEP 3: iOS Build (Run on macOS)

**Prerequisites:**
```bash
# 1. Get Apple Team ID from https://developer.apple.com/account
# 2. Paste Team ID into public/.well-known/apple-app-site-association
#    (replace all 3 instances of REPLACE_TEAMID)

# 3. Rebuild frontend with updated Team ID
cd /path/to/frontend
yarn build
npx cap sync ios
```

**Open Xcode:**
```bash
cd /path/to/frontend
npx cap open ios
```

**In Xcode:**
1. Select **App** target
2. **Signing & Capabilities** → select your Team
3. Add capability: **Associated Domains**
   - `applinks:bidblitz.ae`
   - `webcredentials:bidblitz.ae`
4. **Product → Archive**
5. **Distribute App → App Store Connect → Upload**

**📖 Full guide:** `/app/frontend/deploy/IOS_RELEASE_STEPS.md`

---

## Remaining Manual Steps

### 🔐 Android - Security (CRITICAL)

1. **Generate keystore** using the `keytool` command above
2. **Back up `bidblitz-upload.jks`** to a safe off-site location (losing it means you can never update the app)
3. **Create `keystore.properties`** from template with your passwords
4. **Extract SHA256** and paste into `public/.well-known/assetlinks.json`
5. **Deploy updated `assetlinks.json`** to production at `https://bidblitz.ae/.well-known/assetlinks.json`

### 🍎 iOS - Apple Developer Setup

1. **Get Apple Team ID** from https://developer.apple.com/account → Membership Details
2. **Paste Team ID** into `public/.well-known/apple-app-site-association` (3 places: replace `REPLACE_TEAMID`)
3. **Deploy updated file** to production at `https://bidblitz.ae/.well-known/apple-app-site-association`
4. **Rebuild frontend** (`yarn build && npx cap sync ios`) with updated Team ID
5. **Configure signing in Xcode** (Team selection, Associated Domains)
6. **Create App Store listing** at https://appstoreconnect.apple.com
7. **Provide screenshots** (6.7" and 6.5" iPhone sizes required)
8. **Submit for review**

### 🌐 Deep Links Deployment

**Both platforms require the `.well-known` files to be live BEFORE first install:**

- `https://bidblitz.ae/.well-known/assetlinks.json` (Android)
- `https://bidblitz.ae/.well-known/apple-app-site-association` (iOS)

**Verify files are accessible:**
```bash
curl https://bidblitz.ae/.well-known/assetlinks.json
curl https://bidblitz.ae/.well-known/apple-app-site-association
```

---

## Quick Reference

| Task | Command | Output |
|------|---------|--------|
| **Prepare build** | `./build-mobile-final.sh` | Web assets → Android/iOS |
| **Android debug APK** | `cd android && ./gradlew assembleDebug` | `app/build/outputs/apk/debug/app-debug.apk` |
| **Android release AAB** | `cd android && ./gradlew bundleRelease` | `app/build/outputs/bundle/release/app-release.aab` |
| **iOS Xcode project** | `npx cap open ios` | Opens Xcode |
| **Generate keystore** | `keytool -genkeypair -v -keystore bidblitz-upload.jks ...` | `bidblitz-upload.jks` |
| **Extract SHA256** | `keytool -list -v -keystore bidblitz-upload.jks -alias bidblitz` | SHA256 fingerprint |

---

## Build Package Contents

```
/app/frontend/
├── build-mobile-final.sh          # Main preparation script ✅
├── capacitor.config.ts             # appId: com.bidblitz.app ✅
├── android/
│   ├── app/build.gradle            # applicationId: com.bidblitz.app ✅
│   └── keystore.properties.template # Keystore config template ✅
├── ios/
│   └── App/App.xcodeproj/
│       └── project.pbxproj         # PRODUCT_BUNDLE_IDENTIFIER: com.bidblitz.app ✅
├── deploy/
│   ├── ANDROID_SIGNING_STEPS.md    # Complete Android guide ✅
│   └── IOS_RELEASE_STEPS.md        # Complete iOS guide ✅
└── public/.well-known/
    ├── assetlinks.json              # Android App Links config ✅
    └── apple-app-site-association   # iOS Universal Links config ✅
```

---

## ✅ BUILD PACKAGE READY

**All files prepared. Transfer `/app/frontend/` folder to local machine and follow the guides.**

**Android:** `deploy/ANDROID_SIGNING_STEPS.md`  
**iOS:** `deploy/IOS_RELEASE_STEPS.md`
