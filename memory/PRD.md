# BidBlitz Super-App - PRD

## Übersicht
BidBlitz ist eine Super-App mit über 50 Seiten und 90+ Routern - eine Enterprise-Grade Plattform für Auktionen, Zahlungen, Transport, Shopping und Services.

## Neue Features (März 2026)

### Minimalistisches Dark-Theme Design (NEU!)
- **Mobile-First UI** mit Bottom Navigation (Home, Mining, Games, Market, Wallet)
- **Farbschema:**
  - Hintergrund: `#0c0f22`
  - Cards: `#1c213f`
  - Accent: `#6c63ff`
- **Neue Seiten:**
  - `/super-app` - Minimalistisches Dashboard
  - `/games` - Games Hub mit Quick Play
  - `/app-wallet` - Coin-Wallet mit Transaktionen

### Mining-System (GoMining-Style)
- **MinerDashboard** (`/miner`): Clean Card-basiertes Dashboard
  - Balance und Stats in kompakter Darstellung
  - Mining Farm mit Miner-Karten
  - VIP-Level System basierend auf Hashrate
  
- **MinerMarket** (`/miner-market`): Miner-Shop
  - 5 Miner-Tiers: Bronze, Silver, Gold, Platinum, Diamond
  - Deals mit Rabatt-Badges
  - ROI-Berechnung

### Backend-Endpoints
- `GET /api/app/wallet/balance` - Coin-Guthaben
- `POST /api/app/wallet/add-coins` - Test-Coins hinzufügen
- `GET /api/app/miners/catalog` - Alle verfügbaren Miner
- `GET /api/app/miners/my` - Eigene Miner
- `POST /api/app/miner/buy` - Miner kaufen
- `POST /api/app/miner/upgrade` - Miner upgraden
- `GET /api/app/miner/claim` - Belohnungen sammeln
- `GET /api/app/mining/stats` - Mining-Statistiken

## Komponenten

### BottomNav Component
```jsx
// /app/frontend/src/components/BottomNav.jsx
// Fixed bottom navigation with 5 tabs
// Active tab highlighting with #6c63ff
```

### Seiten-Struktur
- `SuperAppMinimal.jsx` - Home mit Quick Access Grid
- `MinerDashboard.jsx` - Mining Dashboard
- `MinerMarket.jsx` - Miner Shop
- `GamesHub.jsx` - Spiele-Übersicht
- `AppWallet.jsx` - Coin-Wallet

## Tech Stack
- **Frontend:** React, TailwindCSS, Lucide Icons
- **Backend:** FastAPI, Python
- **Database:** MongoDB
- **Design:** Dark theme, mobile-first, card-based UI

## Datenbank-Schema

### Mining Collections
- `app_wallets`: `{user_id, coins, total_earned, total_spent}`
- `app_miners`: `{user_id, miners: [{id, type_id, level, is_active, last_claim, total_mined}]}`
- `mining_history`: `{user_id, amount, miners_claimed, claimed_at}`

## URLs
- `/super-app` - Home Dashboard
- `/miner` - Mining Dashboard
- `/miner-market` - Miner Shop
- `/games` - Games Hub
- `/app-wallet` - Wallet

## Bekannte Probleme
1. **KRITISCH:** Einige ältere Features nutzen in-memory Dicts statt MongoDB
2. Veraltete Router-Dateien sollten entfernt werden

## Nächste Schritte
- [ ] Quick Play Game-Logik mit Backend verbinden
- [ ] Tägliche Belohnungen implementieren
- [ ] Match-3 Spiel fertigstellen
- [ ] In-Memory Daten auf MongoDB migrieren
