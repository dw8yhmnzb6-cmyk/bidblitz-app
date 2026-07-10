# Capacitor Native Build Guide

## Setup für iOS & Android Native Apps

### 1. Capacitor Installation

```bash
cd /app/frontend

# Capacitor installieren
yarn add @capacitor/core @capacitor/cli
yarn add @capacitor/ios @capacitor/android

# Capacitor initialisieren
npx cap init BidBlitz com.bidblitz.app
```

### 2. Capacitor Config

Erstelle `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bidblitz.app',
  appName: 'BidBlitz',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#030303",
      androidSplashResourceName: "splash",
      iosSplashResourceName: "Splash",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
  }
};

export default config;
```

### 3. Build für Native

```bash
# Frontend bauen
yarn build

# iOS Platform hinzufügen
npx cap add ios

# Android Platform hinzufügen
npx cap add android

# Assets kopieren
npx cap sync
```

### 4. iOS Build (macOS erforderlich)

```bash
# Xcode öffnen
npx cap open ios

# In Xcode:
# 1. Signing & Capabilities → Team auswählen
# 2. Bundle Identifier: com.bidblitz.app
# 3. Product → Archive → Distribute App
```

### 5. Android Build

```bash
# Android Studio öffnen
npx cap open android

# In Android Studio:
# 1. Build → Generate Signed Bundle / APK
# 2. Keystore erstellen (falls nicht vorhanden)
# 3. Release APK / AAB generieren
```

### 6. Native Plugins (Optional)

```bash
# Geolocation
yarn add @capacitor/geolocation

# Camera
yarn add @capacitor/camera

# Push Notifications
yarn add @capacitor/push-notifications

# Sync nach Plugin-Installation
npx cap sync
```

### 7. App Store Submission

**iOS (App Store Connect):**
1. Apple Developer Account ($99/Jahr)
2. App Store Connect → Neue App erstellen
3. Screenshots, Beschreibung, Keywords
4. Xcode Archive hochladen
5. Zur Prüfung einreichen

**Android (Google Play Console):**
1. Google Play Developer Account ($25 einmalig)
2. Play Console → App erstellen
3. Store Listing ausfüllen
4. Release → Production → AAB hochladen
5. Prüfung & Veröffentlichung

### 8. Testing

```bash
# iOS Simulator
npx cap run ios

# Android Emulator
npx cap run android

# Live Reload für Development
npx cap run ios --livereload --external
npx cap run android --livereload --external
```

### 9. Update Workflow

```bash
# Code-Änderungen
yarn build

# Native Plattformen aktualisieren
npx cap sync

# App neu bauen
npx cap open ios  # oder android
```

### 10. Wichtige Dateien

```
/app/frontend/
  ├── capacitor.config.ts       # Capacitor Konfiguration
  ├── ios/                      # iOS Native Project
  ├── android/                  # Android Native Project
  ├── public/
  │   ├── splash.png           # Splash Screen (2732x2732)
  │   └── icon.png             # App Icon (1024x1024)
  └── resources/               # Native Icons & Splash
```

### 11. Environment Variables

In Native Apps keine process.env - nutze:

```typescript
// capacitor.config.ts
server: {
  url: 'https://swipe-match-chat-8.preview.emergentagent.com',
  cleartext: true
}
```

### 12. Problembehebung

**iOS Build Fehler:**
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`
- Pod Install: `cd ios/App && pod install`

**Android Build Fehler:**
- Java Version prüfen: `java -version` (JDK 11+)
- Android SDK installieren via Android Studio
- Gradle Sync in Android Studio

---

## Nächste Schritte

1. **Local Build testen** (erfordert macOS für iOS)
2. **App Icons & Splash Screens** erstellen
3. **App Store Accounts** einrichten
4. **Beta-Testing** via TestFlight (iOS) / Internal Testing (Android)
5. **Production Deployment**

---

## Support

Bei Problemen:
- Capacitor Docs: https://capacitorjs.com
- iOS Guidelines: https://developer.apple.com
- Android Guidelines: https://developer.android.com
