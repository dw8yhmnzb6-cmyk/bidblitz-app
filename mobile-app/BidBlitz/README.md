# BidBlitz Mobile App

Native Mobile App für iOS und Android, entwickelt mit React Native und Expo.

## 🚀 Features

- **Login & Registrierung** - Sichere Authentifizierung mit Token-basiertem Login
- **Live Auktionen** - Echtzeit-Auktionsansicht mit automatischen Updates
- **Bieten** - Direkt in der App bieten
- **Gebote kaufen** - In-App-Käufe über Stripe
- **Profil** - Benutzerprofil mit Statistiken und Einstellungen
- **Push-Benachrichtigungen** - Benachrichtigungen bei Auktionsende und Gewinnen

## 📱 Screens

| Screen | Beschreibung |
|--------|--------------|
| `LoginScreen` | Anmeldung mit E-Mail und Passwort |
| `RegisterScreen` | Neues Konto erstellen mit Bonus-Geboten |
| `HomeScreen` | Dashboard mit Live-Auktionen und Jackpot |
| `AuctionsScreen` | Alle Auktionen durchsuchen und filtern |
| `AuctionDetailScreen` | Einzelne Auktion mit Bieten-Funktion |
| `BuyBidsScreen` | Gebote-Pakete kaufen |
| `ProfileScreen` | Benutzerprofil und Einstellungen |

## 🛠️ Technologie-Stack

- **React Native** - Cross-Platform Framework
- **Expo** - Development Toolkit
- **React Navigation** - Navigation und Routing
- **Axios** - HTTP Client für API-Aufrufe
- **Expo Secure Store** - Sichere Token-Speicherung
- **Expo Linear Gradient** - Gradient-Effekte
- **Expo Notifications** - Push-Benachrichtigungen

## 📦 Installation

```bash
# In das Mobile App Verzeichnis wechseln
cd /app/mobile-app/BidBlitz

# Dependencies installieren
yarn install

# Expo starten
yarn start
```

## 🧪 Testen

### Web (für schnelles Testen)
```bash
yarn web
```

### iOS Simulator (macOS erforderlich)
```bash
yarn ios
```

### Android Emulator
```bash
yarn android
```

### Physisches Gerät
1. Expo Go App installieren
2. QR-Code scannen

## 🔧 Konfiguration

Die API-URL wird in `/src/services/api.js` konfiguriert:

```javascript
const API_BASE_URL = 'https://bidstorm-1.preview.emergentagent.com/api';
```

## 📂 Projektstruktur

```
BidBlitz/
├── App.js                 # App Entry Point
├── app.json               # Expo Konfiguration
├── package.json           # Dependencies
└── src/
    ├── components/        # Wiederverwendbare Komponenten
    ├── context/
    │   └── AuthContext.js # Authentication State
    ├── navigation/
    │   └── AppNavigator.js # Navigation Setup
    ├── screens/
    │   ├── HomeScreen.js
    │   ├── LoginScreen.js
    │   ├── RegisterScreen.js
    │   ├── AuctionsScreen.js
    │   ├── AuctionDetailScreen.js
    │   ├── BuyBidsScreen.js
    │   └── ProfileScreen.js
    └── services/
        └── api.js         # API Client
```

## 🚀 Deployment

### iOS (App Store)
1. Apple Developer Account erforderlich
2. `eas build --platform ios`
3. Upload via App Store Connect

### Android (Play Store)
1. Google Play Developer Account erforderlich
2. `eas build --platform android`
3. Upload via Google Play Console

## 🔐 Test-Credentials

- **Admin:** `admin@bidblitz.de` / `Admin123!`

## 📝 Nächste Schritte

- [ ] Push Notifications integrieren
- [ ] Apple Pay / Google Pay hinzufügen
- [ ] Offline-Modus implementieren
- [ ] Deep Linking einrichten
- [ ] App Store Deployment
