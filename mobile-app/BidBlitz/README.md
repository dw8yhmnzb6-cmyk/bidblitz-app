# BidBlitz Mobile App

Eine React Native App für die BidBlitz Penny Auction Plattform.

## 🚀 Lokale Installation

### Voraussetzungen
- Node.js 18+ 
- npm oder yarn
- Expo Go App auf deinem Smartphone (iOS/Android)

### Installation

```bash
# In den App-Ordner wechseln
cd /app/mobile-app/BidBlitz

# Dependencies installieren
yarn install

# oder mit npm
npm install
```

### App starten

```bash
# Expo starten
npx expo start

# Oder für spezifische Plattform:
npx expo start --ios
npx expo start --android
```

### Mit Expo Go verbinden

1. Öffne die **Expo Go** App auf deinem Smartphone
2. Scanne den QR-Code aus dem Terminal
3. Die App lädt automatisch

## 📱 Features

- **Auktionen**: Live-Auktionen mit Echtzeit-Updates
- **Bieten**: One-Tap Bieten mit Haptic Feedback
- **Profil**: Benutzerstatistiken und gewonnene Auktionen
- **Gebote kaufen**: In-App Gebotspakete kaufen
- **Push-Benachrichtigungen**: Über ablaufende Auktionen informiert werden
- **Glücksrad**: Tägliche Belohnungen
- **Mystery Boxes**: Überraschungsboxen öffnen
- **Achievements**: Erfolge und Abzeichen sammeln

## 🔧 Konfiguration

Die API-URL ist in `/src/services/api.js` konfiguriert:

```javascript
const API_BASE_URL = 'https://bidblitz-penny-2.preview.emergentagent.com/api';
```

Für lokale Entwicklung ändern zu:
```javascript
const API_BASE_URL = 'http://localhost:8001/api';
```

## 📁 Projektstruktur

```
BidBlitz/
├── App.js                 # Haupt-App-Komponente
├── src/
│   ├── components/        # Wiederverwendbare UI-Komponenten
│   ├── context/           # React Context (Auth, Notifications)
│   ├── navigation/        # React Navigation Setup
│   ├── screens/           # App-Screens
│   └── services/          # API-Services
├── assets/                # App-Icons und Splash-Screens
└── package.json
```

## 🛠 Technologie-Stack

- **React Native** 0.81
- **Expo** 54
- **React Navigation** 7
- **Axios** für API-Calls
- **Expo Secure Store** für Token-Speicherung

## 📝 Hinweise

- Die App benötigt eine aktive Internetverbindung
- Für Push-Benachrichtigungen muss die App auf einem physischen Gerät laufen
- Test-Account: `spinner@bidblitz.de` / `Spinner123!`
