# BidBlitz Mobile App Build (Android + iOS)

## Setup-Status (29.04.2026)

- ✅ Capacitor 7 installiert + konfiguriert
- ✅ `android/` Plattform initialisiert (`/app/frontend/android/`)
- ✅ `ios/` Plattform initialisiert (`/app/frontend/ios/`)
- ✅ Production-Build (`build/`) erstellt
- ✅ `npx cap sync` ausgeführt — Web-Assets in beide native Projekte kopiert

## Voraussetzungen lokal

| Plattform | Tool | Min. Version |
|-----------|------|--------------|
| Android   | Android Studio + Android SDK | 2024.1 |
| Android   | Java JDK | 17 |
| iOS       | Xcode | 15+ (nur macOS) |
| iOS       | CocoaPods | `sudo gem install cocoapods` |

## Workflow lokal

```bash
# Bei jeder Code-Änderung:
cd /app/frontend
yarn build
npx cap sync

# Android öffnen + bauen:
npx cap open android
# → Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# iOS öffnen + bauen:
npx cap open ios
# → Xcode: Product → Archive (für TestFlight) ODER ⌘R für Simulator
```

## Live-Reload (Development)

In `capacitor.config.ts`:
```ts
server: {
  url: 'https://ocpp-csms-platform.preview.emergentagent.com',
  cleartext: true,
}
```
Nach Aktivierung: `npx cap sync && npx cap run android` — App lädt direkt von der Preview-URL.

## Production-Konfiguration

`capacitor.config.ts` ist bereits auf statisches `webDir: 'build'` gestellt. App läuft komplett offline (außer API-Calls).

App-Name: **BidBlitz** · App-ID: `com.bidblitz.pos` · Theme: dunkel `#060810` mit Cyan-Splash `#00C2FF`.

## App-Icons / Splash-Screens

✅ **Bereits generiert (29.04.2026)**:
- 100 Android-Assets (`android/app/src/main/res/mipmap-*` + `drawable-*-splash.png`)
- 13 iOS-Assets (`ios/App/App/Assets.xcassets/AppIcon.appiconset` + `Splash.imageset`)
- PWA-Icons (`public/icons/icon-*.png`, `apple-touch-icon.png`, `favicon-*`)
- Source: `resources/icon.png` (1024×1024) + `resources/splash.png` (2732×2732)

Logo: stylisiertes "B" in Cyan `#00C2FF` mit Lightning-Bolt-Akzent (Gold) auf dunklem Hintergrund `#060810`.

Re-Generate (z.B. nach Logo-Änderung):
```bash
cd frontend
# resources/icon.png + resources/splash.png aktualisieren, dann:
npx @capacitor/assets generate \
  --android --ios \
  --iconBackgroundColor "#060810" \
  --iconBackgroundColorDark "#060810" \
  --splashBackgroundColor "#060810" \
  --splashBackgroundColorDark "#060810"
yarn build && npx cap sync
```

## Live-Reload (Development) ⚡

Schnelles Mobile-Iterieren ohne `yarn build && npx cap sync` bei jedem Code-Change:

```bash
cd /app/frontend
cp capacitor.config.live.ts capacitor.config.ts   # aktiviert Server-URL Mode
npx cap sync
npx cap run android   # oder ios

# Code änderen → die App auf dem Handy lädt automatisch neu
# (lädt von https://ocpp-csms-platform.preview.emergentagent.com)

# Vor Release zurück:
git checkout capacitor.config.ts
yarn build && npx cap sync
```

## Permissions

Aktuell keine speziellen Permissions deklariert. Bei Voice/Camera/Location:

**Android** `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
```

**iOS** `ios/App/App/Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Voice-Commands für Taxi/Food</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Standort für Taxi/Scooter</string>
<key>NSCameraUsageDescription</key>
<string>QR-Code-Scan und AR-Scooter-Finder</string>
```

## Release / Stores

- **Google Play**: Signed AAB via `./gradlew bundleRelease` (im `android/`-Ordner)
- **App Store**: Xcode → Product → Archive → Distribute App → App Store Connect

## Common Issues

- **Build schlägt mit "TypeScript not found" fehl** → `yarn add -D typescript` (✅ bereits installiert)
- **iOS pod install schlägt fehl** → `sudo gem install cocoapods` lokal
- **App weiß / blank** → Vergiss nicht `yarn build` VOR `npx cap sync`
- **API-Calls scheitern** → `REACT_APP_BACKEND_URL` muss eine HTTPS-URL sein (kein localhost), CORS-Config im Backend prüfen
