# BidBlitz Super-App - PRD

## Übersicht
BidBlitz ist eine Super-App mit über 50 Seiten und 90+ Routern - eine Enterprise-Grade Plattform für Auktionen, Zahlungen, Transport, Shopping und Services.

## Neue Features (März 2026)

### Minimalistisches Dark-Theme Design
- **Mobile-First UI** mit Bottom Navigation (Home, Mining, Games, Market, Wallet)
- **Farbschema:**
  - Hintergrund: `#0c0f22`
  - Cards: `#1c213f`
  - Accent: `#6c63ff`

### Quick Play Game (NEU!)
- Spiel starten mit Animation
- Zufällige Belohnung 10-50 Coins
- Coins werden direkt zur Wallet hinzugefügt
- Live Feed zeigt alle Spielgewinne

### Tägliche Belohnungen (NEU!)
- 7-Tage Streak System
- Steigende Belohnungen: Tag 1 (10) → Tag 7 (100 + Mystery Box)
- Streak-Anzeige und visueller Fortschritt
- Einmal pro Tag abholen

### Profit Chart (NEU!)
- Canvas-basiertes Liniendiagramm
- Zeigt Mining-Profit der letzten 7 Tage
- Wochentags-Labels (Mo, Di, Mi, Do, Fr, Sa, So)
- Gradient-Füllung unter der Linie

### Live Transactions Feed (NEU!)
- Echtzeit-Aktivitäten anzeigen
- Farbcodierte Punkte nach Aktivitätstyp
- Auto-Refresh alle 5 Sekunden
- Zeigt: Game Wins, Daily Rewards, Miner Käufe

## Backend-Endpoints

### Games
- `POST /api/app/games/play` - Spiel spielen (10-50 Coins Reward)
- `GET /api/app/games/history` - Spielverlauf

### Daily Rewards
- `GET /api/app/daily-reward/status` - Status & Streak
- `POST /api/app/daily-reward/claim` - Belohnung abholen

### Live Feed
- `GET /api/app/live-feed` - Aktivitäts-Feed

### Chart
- `GET /api/app/mining/chart-data` - Profit-Daten für Chart

## Seiten

| Route | Seite | Beschreibung |
|-------|-------|--------------|
| `/super-app` | SuperAppMinimal | Home Dashboard |
| `/miner` | MinerDashboard | Mining Dashboard |
| `/miner-market` | MinerMarket | Miner Shop |
| `/games` | GamesHub | Games + Daily Rewards |
| `/app-wallet` | AppWallet | Wallet + Chart + Feed |

## Datenbank-Collections

### Neue Collections
- `games_history`: Spielverlauf
- `daily_rewards`: Streak und Claim-Status
- `live_feed`: Aktivitäts-Log

### Bestehende Collections
- `app_wallets`: Coin-Guthaben
- `app_miners`: Miner-Besitz
- `mining_history`: Mining-Claim-Verlauf

## Tech Stack
- **Frontend:** React, TailwindCSS, Lucide Icons, Canvas API
- **Backend:** FastAPI, Python, MongoDB
- **Design:** Dark theme, mobile-first, card-based UI

## Nächste Schritte
- [ ] Match-3 Puzzle Spiel fertigstellen
- [ ] Slot Machine implementieren
- [ ] Glücksrad mit Spin-Animation
- [ ] In-Memory Daten auf MongoDB migrieren
