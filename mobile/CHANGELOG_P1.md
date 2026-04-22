# 📱 BidBlitz Mobile App - P1 Update

## ✅ Neu hinzugefügte Screens

### 1. HomeScreen (`/screens/Home/HomeScreen.js`)
- Wallet Balance Anzeige
- Quick Actions (Auctions, Taxi, Food, Wallet)
- Live Auctions Preview (Top 5)
- Pull-to-Refresh

### 2. AuctionsScreen (`/screens/Auctions/AuctionsScreen.js`)
- Liste aller aktiven & beendeten Auktionen
- Filter Tabs (Live / Beendet)
- Countdown Timer für jede Auktion
- Bid Count & Winner Display
- Pull-to-Refresh

### 3. ServicesScreen (`/screens/Services/ServicesScreen.js`)
- 20+ Service-Karten
- Kategoriefilter (Mobilität, Shopping, Essen, Finanzen, Kids, Social, Händler)
- Grid Layout mit Icons
- Navigation zu allen Sub-Services

### 4. ProfileScreen (`/screens/Profile/ProfileScreen.js`)
- Benutzer-Info (Name, Email, Avatar)
- Stats (Balance, Gewonnene Auktionen, Empfehlungen)
- Settings (Benachrichtigungen, Dark Mode, Biometric)
- Menu Items (Edit Profile, Wallet, History, Rewards, Referral, Help, Legal)
- Logout Funktion

## 🛠️ Installation & Test

```bash
cd /app/mobile

# Dependencies installieren
yarn install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

## 🎨 Design System
- **Farben**: #00D4FF (Primary), #00FFA3 (Success), #FFB800 (Warning), #FF6B6B (Danger)
- **Background**: #0A0A0F (Dark)
- **Typography**: System Fonts, Weights 400-700

## 📋 Nächste Schritte
1. AuctionDetailScreen implementieren (Bidding UI)
2. Backend API Integration testen
3. Push Notifications einrichten
4. Stores (App Store, Play Store) vorbereiten
