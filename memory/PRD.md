# BidBlitz Super-App - PRD

## Übersicht
BidBlitz ist eine Super-App mit Auktionen, Mining, Games, Mobilität und vielen Services.

## Implementierte Features (März 2026)

### ✅ Kernsystem
- **Backend:** FastAPI mit MongoDB (PERSISTENT!)
- **Frontend:** React mit TailwindCSS
- **Auth:** JWT-basiert mit Demo-User Support

### ✅ Mining System (mit VIP Bonus!)
- 5 Miner-Tiers (Nano → Ultra)
- 10 Upgrade-Level pro Miner
- Daily Claim (24h Cooldown)
- Mining Stats & History
- Globale Pool-Statistiken
- **VIP 2+:** +10% Mining Profit
- **VIP 3+:** +20% Mining Profit

### ✅ Games (10 Spiele!)
- **Lucky Wheel** - bis zu 100 Coins
- **Slot Machine** - -50 bis +150 Coins
- **Reaction Game** - bis zu 20 Coins
- **Daily Bonus** - 50 Coins
- **Dice** - bis zu 60 Coins
- **Coin Flip** - +30 oder -10 Coins
- **Bomb Game** - +100 oder -50 Coins
- **Jackpot** - bis zu 500 Coins
- **Puzzle** - 20 Coins
- **Boost Game** - bis zu 150 Coins
- **Match-3 Puzzle** (`/match3`)
- **Glücksrad** (`/spin-wheel`)
- **Schatzsuche** (`/treasure-hunt`)

### ✅ VIP Exclusive Games (`/vip-games`)
- **VIP 5 erforderlich** (20.000+ Coins)
- **Diamond Rush** - 500-1500 Coins
- **Gold Strike** - 300-1100 Coins
- **Crown Jackpot** - 0-2000 Coins
- **VIP Slots** - 10x Multiplikator

### ✅ Mobilität (NEU!)
- **🚕 Taxi** (`/taxi`) - Buchung mit Coins
  - Abholort & Ziel eingeben
  - Kostenvoranschlag
  - Fahrer-Details bei Buchung
  - 80% Erstattung bei Stornierung
- **🛴 E-Scooter** (`/scooter`) - Mieten mit Coins
  - Verfügbare Scooter in der Nähe
  - Batterie-Anzeige
  - Entsperrung: 5 Coins
  - Pro Minute: 2 Coins

### ✅ VIP System (`/app-vip`)
| Level | Coins | Benefit |
|-------|-------|---------|
| VIP 1 | 0-2.000 | Normal Rewards |
| VIP 2 | 2.001-5.000 | +10% Mining Profit |
| VIP 3 | 5.001-10.000 | +20% Mining Profit |
| VIP 4 | 10.001-20.000 | -10% Marketplace Fees |
| VIP 5 | 20.001+ | Exclusive Games |

### ✅ Platform Statistics (`/app-statistics`)
- Total Users
- Online Users
- Total Coins
- Mining Power
- Games Played
- Marketplace Volume
- "Generate Activity" Simulation

### ✅ Profile (`/app-profile`)
- User Stats Card (Coins, Miners, Games, Referrals)
- Level System (Bronze → Platinum)
- XP Progress Bar
- Quick Actions

### ✅ Social Features
- **Referral System** (`/app-referral`)
- **Leaderboard** (`/app-leaderboard`)
- **Admin Panel** (`/app-admin`)

## Navigation

### Bottom Navigation (5 Tabs)
| Tab | Emoji | Route |
|-----|-------|-------|
| Home | 🏠 | `/super-app` |
| Wallet | 💰 | `/app-wallet` |
| Games | 🎮 | `/games` |
| Mining | ⛏️ | `/miner` |
| Friends | 👥 | `/app-referral` |

### Home Menu (8 Items)
| Item | Emoji | Route |
|------|-------|-------|
| Taxi | 🚕 | `/taxi` |
| Scooter | 🛴 | `/scooter` |
| Games | 🎮 | `/games` |
| Mining | ⛏️ | `/miner` |
| Marketplace | 🛍️ | `/miner-market` |
| Rewards | 🎁 | `/daily` |
| Referral | 👥 | `/app-referral` |
| Settings | ⚙️ | `/app-profile` |

## API Endpoints

### Neue Endpoints
- `GET /api/app/platform/stats` - Platform-Statistiken
- `POST /api/app/taxi/book` - Taxi buchen
- `POST /api/app/scooter/rent` - Scooter mieten
- `POST /api/app/scooter/end` - Fahrt beenden

## Changelog

### 2026-03-06 (Update 2)
- ✅ Taxi Buchung implementiert
- ✅ E-Scooter Rental implementiert
- ✅ VIP Benefits in Mining integriert (+10%/+20% Bonus)
- ✅ VIP Exclusive Games (nur VIP 5)
- ✅ Platform Statistics Seite
- ✅ 10 Mini-Games im Game Center

### 2026-03-06 (Update 1)
- ✅ Referral-Link in Bottom Navigation
- ✅ Schatzsuche Mini-Game
- ✅ Admin Panel
- ✅ Leaderboard
- ✅ Profile Seite mit Level System
- ✅ VIP Status Seite

## Nächste Schritte (Backlog)
- [ ] Push-Benachrichtigungen
- [ ] Sound-Effekte für Games
- [ ] Achievements/Badges System
- [ ] Chat-System zwischen Usern
- [ ] Marketplace mit Auktionen

## Tech Stack
- React + TailwindCSS (Frontend)
- FastAPI + Python (Backend)
- MongoDB Atlas (Database)
