# BidBlitz Mobile App Build (Capacitor)

**Stack:** React PWA → Capacitor → Native iOS/Android

## Prerequisites

| OS | iOS | Android |
|----|-----|---------|
| macOS | Xcode 15+, CocoaPods | Android Studio, JDK 17 |
| Linux / Windows | — | Android Studio, JDK 17 |

```bash
# One-time setup
cd /app/frontend
yarn install           # installs Capacitor CLI + plugins
```

## Development (Live-Reload against Preview URL)

```bash
cd /app/frontend
./build-mobile.sh dev
yarn cap open android       # or: yarn cap open ios
# Run on device/emulator from Android Studio / Xcode
```

The LIVE-RELOAD config (`capacitor.config.live.ts`) points the WebView
at `https://qr-checkout-20.preview.emergentagent.com` so code changes
reflect instantly without rebuilding the native bundle.

## Production Build

```bash
cd /app/frontend
# Make sure REACT_APP_BACKEND_URL in .env points to production (https://bidblitz.ae)
./build-mobile.sh prod
```

Then open each native project and build/archive normally:

```bash
yarn cap open android   # Android Studio → Build → Generate Signed Bundle/APK
yarn cap open ios       # Xcode → Product → Archive
```

## Quick APK (for internal testing)

```bash
./build-mobile.sh apk
# → android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Sign the APK
```bash
# 1) Create upload key (one-time)
keytool -genkey -v -keystore bidblitz-upload.jks -alias bidblitz \
        -keyalg RSA -keysize 2048 -validity 10000

# 2) Sign
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore bidblitz-upload.jks \
  android/app/build/outputs/apk/release/app-release-unsigned.apk bidblitz

# 3) Align
"$ANDROID_HOME"/build-tools/<ver>/zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  /tmp/bidblitz-release.apk
```

## Permissions

All required permissions are declared:

- **Android** → `android/app/src/main/AndroidManifest.xml`
  `INTERNET`, `ACCESS_NETWORK_STATE`, `CAMERA`, `ACCESS_FINE_LOCATION`,
  `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `VIBRATE`,
  `USE_BIOMETRIC`, `USE_FINGERPRINT`, `READ/WRITE_EXTERNAL_STORAGE`.

- **iOS** → `ios/App/App/Info.plist`
  `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
  `NSPhotoLibraryAddUsageDescription`, `NSLocationWhenInUseUsageDescription`,
  `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSFaceIDUsageDescription`.

## Installed Capacitor Plugins

```
@capacitor/app           — app lifecycle events
@capacitor/splash-screen — launch splash
@capacitor/status-bar    — styled status bar
@capawesome/capacitor-app-update — in-app update prompts
```

Add more as needed:
```bash
yarn add @capacitor/camera @capacitor/geolocation \
         @capacitor/push-notifications @capacitor/local-notifications
yarn cap sync
```

## App ID & Name

- **appId**: `com.bidblitz.app`
- **appName**: `BidBlitz`
- **webDir**: `build`

Change in `capacitor.config.ts` if you need a separate Play/App-Store listing.

## Play Store / App Store Submission

### Android (Google Play)
1. Produce **Android App Bundle (AAB)** — Android Studio → Build → Generate Signed Bundle.
2. Upload to Google Play Console.
3. Fill in store listing (screenshots 1080×1920, feature graphic 1024×500).
4. `applicationId` = `com.bidblitz.app`.

### iOS (App Store)
1. Xcode → Product → Archive.
2. Distribute App → App Store Connect.
3. App-Name, Beschreibung, Screenshots auf App Store Connect hochladen.
4. `Bundle Identifier` = `com.bidblitz.app`.

## Troubleshooting

| Problem | Fix |
|--------|-----|
| `cap sync` fails with "no native project" | `yarn cap add android && yarn cap add ios` |
| iOS build: "No provisioning profile" | Xcode → Signing & Capabilities → select Team |
| White screen on launch | Check `REACT_APP_BACKEND_URL` in .env reaches your prod API |
| QR scanner black | Ensure `CAMERA` permission granted in Android Settings |
