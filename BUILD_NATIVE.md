# BidBlitz Native Build & App-Store Submission Guide

> Step-by-step für iOS (App Store) und Android (Google Play) auf Basis von **Capacitor**.
> Alle Voraussetzungen für den Web-Build sind bereits im Repository konfiguriert (siehe `capacitor.config.ts`).

---

## 0) Voraussetzungen

| Plattform | Tooling | Mindestversion |
|-----------|---------|----------------|
| **iOS**   | macOS + Xcode + Apple Developer Account (99 USD/Jahr) | Xcode 15+, iOS 13+ |
| **Android** | Android Studio + Google Play Console Account (25 USD einmalig) | AS Hedgehog, SDK 34 |
| **Beide** | Node 20, Yarn, Capacitor CLI | `npm i -g @capacitor/cli` |

Klone das Repo lokal:
```bash
git clone <repo-url> bidblitz
cd bidblitz/frontend
yarn install
```

---

## 1) Production Web-Build erzeugen

```bash
cd frontend
# Frontend gegen die echte Production-Backend-URL kompilieren
REACT_APP_BACKEND_URL=https://api.bidblitz.com yarn build
# Output: frontend/build/
```

Vergewissere dich, dass folgende ENV-Vars im `.env.production` (oder via Build-Pipeline) gesetzt sind:
- `REACT_APP_BACKEND_URL`
- `REACT_APP_MAPBOX_TOKEN`
- `REACT_APP_ONESIGNAL_APP_ID` (Push)
- ggf. `REACT_APP_STRIPE_PUBLISHABLE_KEY`

> ⚠️ **NIE** lokale `.env` (mit Preview-URL) zum Native-Build verwenden.

---

## 2) Capacitor Sync

Nach jedem Web-Build:

```bash
npx cap sync
# kopiert frontend/build → ios/App/App/public + android/app/src/main/assets/public
# aktualisiert native plugins (push, geolocation, nfc, etc.)
```

Wenn neue Capacitor-Plugins hinzugefügt wurden:
```bash
npx cap update ios
npx cap update android
```

---

## 3) iOS — App Store Submission

### 3.1 Xcode öffnen
```bash
npx cap open ios
```

### 3.2 Signing & Capabilities
- **Bundle ID**: `com.bidblitz.app` (im Apple Developer Portal registrieren)
- **Team**: Dein Apple Developer Team
- **Signing**: Automatic (Xcode → Signing & Capabilities)
- **Capabilities** (an-/abhaken):
  - ✅ Push Notifications
  - ✅ Background Modes → *Location updates*, *Remote notifications*, *Background fetch*
  - ✅ Sign in with Apple (optional)
  - ✅ Associated Domains: `applinks:bidblitz.com` (für Deep-Links)

### 3.3 Icons & Splash
- App-Icon: `frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/` (1024×1024 + Generated)
- Splash: `frontend/ios/App/App/Assets.xcassets/Splash.imageset/`
- Generiere alle Varianten mit:
  ```bash
  npm i -g @capacitor/assets
  npx capacitor-assets generate --iconBackgroundColor "#0A0A0A" --splashBackgroundColor "#0A0A0A"
  ```

### 3.4 Info.plist Berechtigungen (Pflichttexte!)
In `ios/App/App/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>BidBlitz nutzt deinen Standort, um dir Taxis in der Nähe zu zeigen und Schicht-Einstempelungen am richtigen Ort zu ermöglichen.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Erlaube Hintergrund-Standort, damit dein Taxi dich auch beim Sperrbildschirm finden kann.</string>
<key>NSCameraUsageDescription</key>
<string>BidBlitz nutzt die Kamera zum Scannen von QR-Codes (Schicht-Einstempelung).</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Damit du Belege und Schicht-Fotos hochladen kannst.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Für die Voice-Notizen im Live-Chat mit deinem Fahrer.</string>
<key>NFCReaderUsageDescription</key>
<string>BidBlitz nutzt NFC zum kontaktlosen Einstempeln am Terminal.</string>
```

### 3.5 Build & Archive
1. Schema-Auswahl oben in Xcode: **Any iOS Device (arm64)**
2. Menü: **Product → Archive**
3. Nach Abschluss erscheint Organizer → **Distribute App → App Store Connect → Upload**
4. Auf https://appstoreconnect.apple.com:
   - App anlegen (Bundle ID, Name, Sprache, Kategorie *Productivity*)
   - Screenshots: 6.7" iPhone (1290×2796) — mind. 3 Stück
   - App-Beschreibung (DE + EN), Keywords, Support-URL, Datenschutz-URL
   - Build auswählen → **Submit for Review**
- Review-Dauer: 24-72h (manchmal länger).

---

## 4) Android — Google Play Submission

### 4.1 Android Studio öffnen
```bash
npx cap open android
```

### 4.2 build.gradle anpassen
`android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "com.bidblitz.app"
    minSdkVersion 24      // Android 7.0+
    targetSdkVersion 34
    versionCode 1
    versionName "1.0.0"
}
```

### 4.3 AndroidManifest.xml — Permissions
`android/app/src/main/AndroidManifest.xml` (Auszug):
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.NFC"/>
<uses-permission android:name="android.permission.VIBRATE"/>
```

### 4.4 Signed AAB erstellen
1. Erstelle Upload-Keystore (einmalig):
   ```bash
   keytool -genkey -v -keystore bidblitz-upload-key.keystore -alias bidblitz -keyalg RSA -keysize 2048 -validity 10000
   ```
   ⚠️ **Speichere das Passwort sicher!** Verloren = keine Updates möglich.
2. In `~/.gradle/gradle.properties` eintragen:
   ```
   BIDBLITZ_RELEASE_STORE_FILE=/path/to/bidblitz-upload-key.keystore
   BIDBLITZ_RELEASE_STORE_PASSWORD=...
   BIDBLITZ_RELEASE_KEY_ALIAS=bidblitz
   BIDBLITZ_RELEASE_KEY_PASSWORD=...
   ```
3. In `android/app/build.gradle` `signingConfigs` ergänzen (siehe Capacitor-Doku).
4. Build:
   ```bash
   cd android
   ./gradlew bundleRelease
   # Output: android/app/build/outputs/bundle/release/app-release.aab
   ```

### 4.5 Google Play Console
1. https://play.google.com/console → **Create App** (Name, Sprache, Kategorie *Business* oder *Productivity*)
2. **Setup → App Content**: Datenschutz, Werbung, Inhaltsbewertung, Zielgruppe
3. **Setup → Pricing**: kostenlos
4. **Production → Create new release** → AAB hochladen
5. Screenshots: 6,7" Smartphone (mind. 2), Tablet (optional)
6. Feature-Grafik 1024×500 (Cover)
7. Beschreibung (DE + EN), Kurz-Beschreibung (80 Zeichen)
8. **Submit for Review** → Review-Dauer 1-7 Tage.

---

## 5) Push-Notifications (OneSignal)

OneSignal ist via `@capacitor/push-notifications` integriert. Setup auf https://app.onesignal.com:
1. **iOS**: APNs Auth-Key (Apple Developer → Keys) hochladen.
2. **Android**: Firebase Server-Key (Firebase Console → Project Settings → Cloud Messaging) hochladen.
3. `REACT_APP_ONESIGNAL_APP_ID` und (Backend) `ONESIGNAL_REST_API_KEY` in `.env` setzen.

---

## 6) Update-Strategie (OTA für Web-Layer)

Code-Push (Bug-Fixes ohne App-Store-Review) ist über die **Web-Schicht** möglich:
- Web-Build hochladen auf den Production-Server → bei nächstem Start lädt Capacitor automatisch die neuen Assets.
- Nur native Plugin-Updates erfordern einen Store-Release.

---

## 7) Checkliste vor Submission

- [ ] App-Icon 1024×1024 (iOS) + 512×512 (Play Store)
- [ ] Screenshots (3-5) für jede Geräte-Größe
- [ ] Datenschutzerklärung-URL (https://bidblitz.com/privacy)
- [ ] Support-URL / E-Mail
- [ ] Inhaltsbewertung (iOS: 4+, Android: PEGI 3)
- [ ] Demo-Account für Apple/Google Review (z.B. `review@bidblitz.com / Demo2026!`)
- [ ] App testen auf realem Gerät (NICHT nur Simulator)
- [ ] Offline-Verhalten testen (Flugmodus)
- [ ] Push-Notifications testen
- [ ] Standort-Permission-Flow getestet
- [ ] AGB & Datenschutz in der App verlinkt (z.B. Profile-Tab)

---

## 8) Häufige Rejections & Fixes

| Grund | Fix |
|-------|-----|
| **Guideline 4.2** (Minimum Functionality) | Stelle sicher dass die App ohne Login-Wand was zeigt (Demo-Modus auf `/` oder `/taxi`) |
| **Guideline 5.1.1** (Datenschutz fehlt) | Sichtbar in Profile-Tab + Onboarding |
| **Standort-Hintergrund nicht erklärt** | Detailliere im `NSLocation...UsageDescription` warum Background-Standort nötig ist |
| **Apple Sign-In fehlt** | Wenn andere Login-Methoden (Google) verfügbar sind, MUSS auch Apple-Login angeboten werden |
| **Crash auf Launch** | Teste mit Production-Build auf physischem Gerät — Sourcemap-Symbolicate via Xcode/Crashlytics |

---

## 9) Post-Launch Monitoring

- **Crashlytics** (Firebase) integrieren für Crash-Reports
- **App Store Connect → Analytics** für Downloads/Conversion
- **Google Play Console → Vitals** für ANRs und Crash-Rate
- **OneSignal Dashboard** für Push-Delivery-Quote

---

## 10) Continuous Delivery (optional)

`fastlane`-Konfiguration für automatische Builds:
```bash
gem install fastlane
# in frontend/ios:
fastlane init
# Lanes: beta (TestFlight), release (App Store)
```

Für Android: GitHub Actions mit `r0adkll/upload-google-play@v1`.

---

📝 **Wichtige Dateien im Repo:**
- `frontend/capacitor.config.ts` — Bundle-ID, App-Name
- `frontend/ios/App/App/Info.plist` — iOS-Berechtigungen
- `frontend/android/app/src/main/AndroidManifest.xml` — Android-Berechtigungen
- `frontend/android/app/build.gradle` — Versions-Codes
- `/app/memory/PRD.md` — Produkt-Spezifikation

Bei Fragen: Capacitor-Docs https://capacitorjs.com/docs/ios/configuration
