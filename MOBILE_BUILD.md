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
  url: 'https://kassensystem-preview.preview.emergentagent.com',
  cleartext: true,
}
```
Nach Aktivierung: `npx cap sync && npx cap run android` — App lädt direkt von der Preview-URL.

## Production-Konfiguration

`capacitor.config.ts` ist bereits auf statisches `webDir: 'build'` gestellt. App läuft komplett offline (außer API-Calls).

App-Name: **BidBlitz** · App-ID: `com.bidblitz.pos` · Theme: dunkel `#060810` mit Cyan-Splash `#00C2FF`.

## App-Icons / Splash-Screens

Die Default-Capacitor-Icons sind temporär. Für Release:
1. Icon 1024x1024 → in `android/app/src/main/res/` (verschiedene Größen) und `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
2. Splash 2732x2732 → `android/app/src/main/res/drawable/splash.png` und `ios/App/App/Assets.xcassets/Splash.imageset/`
3. Tool: https://capacitor-assets.com oder `npx @capacitor/assets generate`

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
