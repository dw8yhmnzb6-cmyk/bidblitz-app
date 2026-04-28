# BidBlitz — Native Mobile Apps via Capacitor

Mit diesem Setup erzeugst du **echte iOS- und Android-Apps** aus dem React-Web-Code,
ohne ihn umzuschreiben. Das Web-Bundle läuft in einem nativen WebView mit Zugriff
auf alle Geräte-APIs (Kamera, NFC, Bluetooth, Push, Biometrie, Stempeluhr-GPS, …).

---

## 1. Voraussetzungen

| Plattform | Lokales Toolchain |
|-----------|-------------------|
| iOS       | macOS · Xcode 15+ · CocoaPods (`sudo gem install cocoapods`) |
| Android   | Android Studio · JDK 17 · Android SDK 34 |

> **Hinweis:** Das hier auf dem Server liegende Capacitor-Setup ist vorbereitet,
> aber das tatsächliche `xcodebuild` / `gradlew assembleRelease` läuft nur lokal,
> da Apple- und Google-Signing-Zertifikate nicht in CI sein dürfen.

---

## 2. Web-Build erzeugen

```bash
cd /app/frontend
yarn build              # erstellt /app/frontend/build (Capacitor liest hier rein)
```

## 3. Native Plattformen einmalig hinzufügen

```bash
cd /app/frontend
npx cap add ios
npx cap add android
```

Dadurch entstehen die Verzeichnisse `ios/` und `android/` mit den nativen Projekten.

## 4. Web-Code synchronisieren

Nach jeder Änderung am React-Code:

```bash
cd /app/frontend
yarn build && npx cap sync
```

## 5. App auf dem Gerät / Simulator öffnen

### iOS
```bash
cd /app/frontend
npx cap open ios
```
Dann in Xcode: Team auswählen → Run (▶︎). Auf physischem iPhone: Apple-Developer-
Account erforderlich (99 €/Jahr).

### Android
```bash
cd /app/frontend
npx cap open android
```
Dann in Android Studio: Run ▶︎. APK exportieren via *Build → Build Bundle/APK*.

---

## 6. App-Store-Releases

### iOS App Store
1. Xcode → *Product → Archive*
2. Window → *Organizer* → *Distribute App* → *App Store Connect*
3. Auf [App Store Connect](https://appstoreconnect.apple.com) Build freigeben.

### Google Play Store
1. Android Studio → *Build → Generate Signed Bundle / APK → Android App Bundle*
2. Upload nach [Play Console](https://play.google.com/console) → *Production track*

---

## 7. Empfohlene Native-Plugins

```bash
yarn add @capacitor/camera          # Kamera für Lieferschein-OCR
yarn add @capacitor/geolocation     # Stempeluhr GPS
yarn add @capacitor/push-notifications
yarn add @capacitor/local-notifications
yarn add @capacitor/haptics         # Vibration beim Bezahlen
yarn add @capacitor-community/barcode-scanner   # Barcode-Scanning nativ
yarn add @capacitor-community/bluetooth-le      # ESC/POS Bonprinter direkt nativ
```

> **NFC** funktioniert in nativen iOS/Android-Apps automatisch besser als im Web,
> weil Apple Web-NFC API NICHT auf iOS-Safari unterstützt — als native App
> kannst du die Capacitor-Plugin-Bridge zur Apple Core NFC-API nutzen.

---

## 8. Live-Reload während der Entwicklung

Für die schnellste Dev-Erfahrung am physischen Gerät:

```ts
// capacitor.config.ts
server: {
  url: 'https://kids-premium-live.preview.emergentagent.com',
  cleartext: false,
}
```

Dann läuft der WebView gegen die Live-Preview-URL → Code-Änderungen sind sofort
auf dem Phone sichtbar, ohne neu zu bauen.

---

## 9. Versionierung

```bash
# iOS
ios/App/App.xcodeproj  → Version + Build-Number erhöhen
# Android
android/app/build.gradle → versionCode und versionName erhöhen
```

---

## 10. Permissions

Apple/Google verlangen Begründungen für Berechtigungen:

`ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Für Barcode-Scanning und Lieferschein-OCR</string>
<key>NSMicrophoneUsageDescription</key>
<string>Für Sprach-Befehle an die Kasse</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Für die Mitarbeiter-Stempeluhr und nahegelegene Filialen</string>
<key>NFCReaderUsageDescription</key>
<string>Für kontaktlose Zahlungen mit BidBlitz Wallet</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Verbindet zum Bonprinter</string>
```

`android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## 11. Release-Checkliste

- [ ] Icon + Splash für alle iOS- und Android-Größen generiert (z. B. via [capacitor-resources](https://github.com/ionic-team/capacitor-resources))
- [ ] Universal-Link-Verknüpfung für `bidblitz.com` (Apple App Site Association + Android assetlinks.json) gesetzt
- [ ] Push-Notification-Zertifikat (APNs) bei Apple konfiguriert + Firebase Cloud Messaging eingerichtet
- [ ] Datenschutz-URL und Beschreibung in App-Store / Play-Console hinterlegt
- [ ] Erst in TestFlight / Internal Testing rollen, dann öffentlich

---

## 12. Status

✅ Capacitor 7 in `package.json` installiert
✅ `capacitor.config.ts` angelegt
☐ `npx cap add ios` & `npx cap add android` (lokal ausführen)
☐ Apple & Google Developer-Accounts hinterlegt
☐ Erstes Build hochgeladen
