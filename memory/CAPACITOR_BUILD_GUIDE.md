# BidBlitz Native (Capacitor) — Build & Submission Guide

## 1. Voraussetzungen
- **macOS** für iOS Builds (Xcode 15+, Apple Developer Account 99 €/Jahr)
- **Beliebiges OS** für Android (Android Studio + JDK 17)
- Node 18+ und Yarn

## 2. Initiale Plattform-Erstellung (einmalig)

```bash
cd /app/frontend

# Plattformen hinzufügen (erzeugt /ios und /android Ordner)
npx cap add ios
npx cap add android

# Plugins (für Push, NFC, Geolocation, Camera)
yarn add @capacitor/push-notifications @capacitor/geolocation @capacitor/camera @capacitor/local-notifications
yarn add onesignal-cordova-plugin    # OneSignal Native SDK
npx cap sync
```

## 3. Build & Sync (jedes Mal vor Release)

```bash
cd /app/frontend
yarn build               # Erzeugt /build/ mit allen Assets
npx cap sync             # Kopiert /build/ nach iOS + Android
npx cap open ios         # öffnet Xcode
npx cap open android     # öffnet Android Studio
```

## 4. iOS Release-Build

1. Xcode öffnen via `npx cap open ios`
2. **Bundle Identifier** = `com.bidblitz.app` (bereits gesetzt)
3. **Signing & Capabilities** → Team auswählen, "Automatically manage signing"
4. **Capabilities** hinzufügen:
   - Push Notifications
   - Background Modes (Remote notifications, Background fetch)
   - Associated Domains (für `/staff/invite` Deep-Links): `applinks:app.bidblitz.com`
5. `Product → Archive` → Upload to App Store Connect
6. App Store Connect: Beschreibung aus `/app/memory/app_store_descriptions.md` einfügen

## 5. Android Release-Build

1. Android Studio öffnen via `npx cap open android`
2. **applicationId** = `com.bidblitz.app`
3. `android/app/build.gradle`: `versionCode` + `versionName` hochsetzen
4. Signing Key erstellen: `keytool -genkey -v -keystore bidblitz.jks -alias bidblitz -keyalg RSA -keysize 2048 -validity 10000`
5. `Build → Generate Signed Bundle / APK → Android App Bundle`
6. Upload zu Google Play Console

## 6. OneSignal Native Setup

### iOS
1. OneSignal Dashboard → "Apple iOS (APNs)" → APNs Key (.p8) hochladen
2. Xcode: Notification Service Extension hinzufügen (rechtsklick auf Projekt)
3. `AppDelegate.swift` initialisieren:
   ```swift
   OneSignal.initialize("YOUR_APP_ID", withLaunchOptions: launchOptions)
   OneSignal.Notifications.requestPermission({ accepted in })
   ```

### Android
1. OneSignal Dashboard → "Google Android (FCM)" → FCM Server Key
2. `android/app/build.gradle`: Firebase + OneSignal Dependencies
3. `google-services.json` aus Firebase Console nach `android/app/` kopieren

### Player ID an Backend senden
```ts
import OneSignal from 'onesignal-cordova-plugin';

OneSignal.User.pushSubscription.addEventListener('change', async (event) => {
  if (event.current.id) {
    await fetch(`${API}/api/staff/push/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: event.current.id, platform: 'ios' }),
    });
  }
});
OneSignal.login(staffId);  // External User ID = staff_id
```

## 7. App Store Assets (alle ablegen unter `/app/app_store_assets/`)

| Asset | Größe | Anzahl |
|---|---|---|
| iOS Icon | 1024×1024 | 1 |
| iOS Screenshots | 6.7", 6.5", 5.5" | je 3-5 |
| iPad Screenshots | 12.9" | 3-5 |
| Android Icon | 512×512 | 1 |
| Android Screenshots | 16:9 oder 9:16 | 3-8 |
| Android Feature Graphic | 1024×500 | 1 |

## 8. Deep-Linking für Magic-Link / Invites

iOS `ios/App/App/App.entitlements`:
```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:app.bidblitz.com</string>
</array>
```

Android `android/app/src/main/AndroidManifest.xml` (innerhalb `<activity>`):
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="app.bidblitz.com" />
</intent-filter>
```

## 9. Submission Checklist

- [ ] App Icon 1024×1024 (iOS) + 512×512 (Android)
- [ ] Mindestens 3 Screenshots pro Plattform
- [ ] App Description DE + EN (siehe `app_store_descriptions.md`)
- [ ] Datenschutz-Link: `https://app.bidblitz.com/privacy`
- [ ] AGB-Link: `https://app.bidblitz.com/terms`
- [ ] Support-E-Mail: `support@bidblitz.com`
- [ ] Versionsnummer + Build-Nummer hochgezählt
- [ ] OneSignal Player-ID Test erfolgreich (Test-Push)
- [ ] Deep-Link Test erfolgreich (`/staff/invite?token=...`)
- [ ] Apple App Review Notes: Demo-Account (`mitarbeiter@bidblitz.com` / `test123`)

## 10. Build-Versionierung

Setze in CI:
```bash
export BUILD_VERSION="1.0.0-build.$(date +%Y%m%d%H%M)"
```
Das landet im Backend unter `GET /api/staff/version`.
