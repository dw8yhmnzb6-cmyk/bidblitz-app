# 📱 BidBlitz App - App Store Veröffentlichung

## ✅ Capacitor Setup abgeschlossen

Die BidBlitz Web-App wurde erfolgreich für native App-Veröffentlichung vorbereitet:
- ✅ Capacitor Core & CLI installiert
- ✅ iOS Projekt erstellt (`/app/frontend/ios/`)
- ✅ Android Projekt erstellt (`/app/frontend/android/`)

---

## 🍎 Apple App Store (iOS)

### Voraussetzungen:
1. **Apple Developer Account** - €99/Jahr
   - Registrieren: https://developer.apple.com/programs/enroll/
2. **Mac Computer** mit Xcode installiert
3. **Apple Developer Zertifikate**

### Schritte zur Veröffentlichung:

#### 1. Projekt auf Mac übertragen
```bash
# Den gesamten frontend-Ordner auf Ihren Mac kopieren
# Oder per Git klonen
```

#### 2. iOS-Projekt in Xcode öffnen
```bash
cd frontend/ios
open App.xcworkspace
```

#### 3. In Xcode konfigurieren:
- **Team**: Ihr Apple Developer Team auswählen
- **Bundle Identifier**: `com.bidblitz.app`
- **Version**: 1.0.0
- **Build**: 1

#### 4. App Icons hinzufügen
- Öffnen Sie `Assets.xcassets > AppIcon`
- Fügen Sie Icons in allen erforderlichen Größen hinzu
- Empfohlen: https://appicon.co/ zum Generieren

#### 5. App archivieren und hochladen
- Product > Archive
- Distribute App > App Store Connect
- Upload

#### 6. In App Store Connect
- https://appstoreconnect.apple.com
- App-Informationen ausfüllen
- Screenshots hochladen
- Zur Prüfung einreichen

---

## 🤖 Google Play Store (Android)

### Voraussetzungen:
1. **Google Play Developer Account** - €25 einmalig
   - Registrieren: https://play.google.com/console/signup
2. **Android Studio** (optional, für Debugging)

### Schritte zur Veröffentlichung:

#### 1. Signierter Release-Build erstellen

```bash
cd frontend/android

# Release APK erstellen
./gradlew assembleRelease

# Oder Release Bundle (empfohlen für Play Store)
./gradlew bundleRelease
```

#### 2. App signieren

Erstellen Sie einen Keystore:
```bash
keytool -genkey -v -keystore bidblitz-release-key.keystore \
  -alias bidblitz \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

#### 3. In `android/app/build.gradle` konfigurieren:
```gradle
android {
    signingConfigs {
        release {
            storeFile file('bidblitz-release-key.keystore')
            storePassword 'IHR_PASSWORT'
            keyAlias 'bidblitz'
            keyPassword 'IHR_PASSWORT'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### 4. In Google Play Console hochladen
- https://play.google.com/console
- Neue App erstellen
- App-Bundle (.aab) hochladen
- Store-Eintrag ausfüllen
- Zur Prüfung einreichen

---

## 🔄 App aktualisieren

Nach Änderungen an der Web-App:

```bash
cd frontend

# Web-App neu builden
yarn build

# Native Projekte aktualisieren
npx cap sync
```

---

## 📋 Checkliste vor Veröffentlichung

### Für beide Stores:
- [ ] App-Name: BidBlitz
- [ ] App-Beschreibung (kurz & lang)
- [ ] Keywords/Tags
- [ ] Kategorie: Shopping / Lifestyle
- [ ] Altersfreigabe festlegen
- [ ] Datenschutzerklärung URL
- [ ] Support-E-Mail

### Screenshots benötigt:
- [ ] iPhone 6.5" (1284 x 2778 px)
- [ ] iPhone 5.5" (1242 x 2208 px)
- [ ] iPad 12.9" (2048 x 2732 px)
- [ ] Android Phone (1080 x 1920 px)
- [ ] Android Tablet (optional)

### App-Icon:
- [ ] 1024x1024 px (für App Store)
- [ ] 512x512 px (für Play Store)

---

## 💡 Tipps

1. **Testflug (iOS)**: Nutzen Sie TestFlight für Beta-Tests
2. **Interne Tests (Android)**: Nutzen Sie den Internal Testing Track
3. **Review-Zeit**: 
   - Apple: 1-7 Tage
   - Google: 1-3 Tage
4. **Ablehnung vermeiden**: 
   - Keine Placeholder-Inhalte
   - Funktionierende Links
   - Datenschutzerklärung

---

## 📞 Support

Bei Fragen zur Veröffentlichung:
- Apple: https://developer.apple.com/support/
- Google: https://support.google.com/googleplay/android-developer/

