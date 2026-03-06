# BidBlitz Super-App - PRD

## Übersicht
BidBlitz ist eine Super-App mit Auktionen, Mining, Games, und vielen Services.

## Implementierte Features (März 2026)

### ✅ Kernsystem
- **Backend:** FastAPI mit MongoDB (PERSISTENT!)
- **Frontend:** React mit TailwindCSS
- **Auth:** JWT-basiert mit Demo-User Support

### ✅ Mining System
- 5 Miner-Tiers (Nano → Ultra)
- 10 Upgrade-Level pro Miner
- Daily Claim (24h Cooldown)
- Mining Stats & History
- Globale Pool-Statistiken

### ✅ Games
- **Match-3 Puzzle** (`/match3`)
- **Glücksrad** (`/spin-wheel`)
- **Schatzsuche** (`/treasure-hunt`) - NEU!
- **Quick Play** (10-50 Coins)
- **Slot Machine**
- **Daily Reward**

### ✅ Economy
- Wallet System mit Coins
- Jackpot System (wachsender Pot)
- VIP Levels (5 Stufen: Bronze → Diamond)
- Daily Rewards (7-Tage Streak)

### ✅ Social Features
- **Referral System** (`/app-referral`)
- Invite Codes generieren
- 100 Coins pro Einladung
- 50 Coins Bonus für neue User
- **Leaderboard** (`/app-leaderboard`) - NEU!
  - Top Miner (nach Hashrate)
  - Top Spieler (nach Coins)
  - Top Werber (nach Freunden)

### ✅ Admin Panel (`/app-admin`) - NEU!
- Benutzer-Coins verwalten (hinzufügen/abziehen)
- Plattform-Statistiken anzeigen
- User-Details abrufen

## Design System

### Farben
- **Background:** `#0c0f22`
- **Cards:** `#1c213f`
- **Accent:** `#6c63ff`
- **Gold Coin:** `linear-gradient(135deg, #ffd700, #ffae00)`

### Bottom Navigation (Emoji)
| Tab | Emoji | Route |
|-----|-------|-------|
| Home | 🏠 | `/super-app` |
| Wallet | 💰 | `/app-wallet` |
| Games | 🎮 | `/games` |
| Mining | ⛏️ | `/miner` |
| Friends | 👥 | `/app-referral` |

## API Endpoints

### Wallet
- `GET /api/app/wallet/balance` - Guthaben abrufen
- `POST /api/app/wallet/add-coins` - Coins hinzufügen

### Mining
- `GET /api/app/miners/catalog` - Miner-Katalog
- `GET /api/app/miners/my` - Eigene Miner
- `POST /api/app/miner/buy` - Miner kaufen
- `POST /api/app/miner/upgrade` - Miner upgraden
- `GET /api/app/miner/claim` - Rewards abholen
- `GET /api/app/mining/stats` - Mining-Statistiken
- `GET /api/app/pool/stats` - Pool-Statistiken

### Games
- `POST /api/app/games/play` - Spiel spielen
- `GET /api/app/games/history` - Spielhistorie
- `GET /api/app/spin/status` - Spin-Status
- `POST /api/app/spin/claim` - Spin-Preis abholen

### Daily Rewards
- `GET /api/app/daily-reward/status` - Status
- `POST /api/app/daily-reward/claim` - Abholen

### Referral
- `GET /api/app/referral/my-code` - Eigener Code
- `POST /api/app/referral/use-code` - Code einlösen

### Leaderboard
- `GET /api/app/leaderboard/miners` - Top Miner
- `GET /api/app/leaderboard/players` - Top Spieler
- `GET /api/app/leaderboard/referrals` - Top Werber

### Admin (NEU)
- `GET /api/app/admin/stats` - Plattform-Statistiken
- `POST /api/app/admin/coins` - Coins verwalten
- `GET /api/app/admin/user/{user_id}` - User-Details

## Nächste Schritte (Backlog)
- [ ] Slot Machine verbessern
- [ ] Push-Benachrichtigungen
- [ ] Sound-Effekte für Games
- [ ] Animationen für Seitenübergänge
- [ ] Achievements/Badges System
- [ ] Chat-System zwischen Usern

## Changelog

### 2026-03-06
- ✅ Referral-Link in Bottom Navigation hinzugefügt (👥)
- ✅ Schatzsuche Mini-Game implementiert
- ✅ Admin Panel für Coins-Management erstellt
- ✅ Leaderboard-Seite mit 3 Tabs
- ✅ Backend-Endpoints für Admin-Funktionen

### 2026-03-05
- ✅ MongoDB-Integration für alle Features
- ✅ Mining System komplett
- ✅ Games Hub mit Multiple Games
- ✅ Referral System
- ✅ VIP Levels
- ✅ Daily Rewards

## Tech Stack
- React + TailwindCSS (Frontend)
- FastAPI + Python (Backend)
- MongoDB Atlas (Database)
- Canvas API für Animationen
