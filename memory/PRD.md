# BidBlitz Penny Auction Platform - PRD

## Letztes Update: 22. Januar 2026

## Original-Anforderung
Penny-Auktions-Website nach dem Vorbild von `dealdash.com` und `snipster.de`.

## Aktuelle Session - Massive Feature-Updates

### Neue Features (22. Januar 2026):

#### 1. Gratis-Auktionen ✅ NEU
- Auktionen ohne Gebote-Abzug
- 🎁 GRATIS Badge auf Karten
- Filter "Gratis (X)" auf Startseite
- 4 Gratis-Auktionen aktiv

#### 2. Daily Login Rewards ✅ NEU  
- 1-5 zufällige Gratis-Gebote pro Tag
- Streak-System:
  - 7 Tage = +10 Bonus
  - 14 Tage = +20 Bonus
  - 30 Tage = +50 Bonus
- UI im Dashboard mit Streak-Anzeige
- API: `/auth/claim-daily-reward`, `/auth/daily-reward-status`

#### 3. Achievements System ✅ NEU
- 12 verschiedene Achievements:
  - 🏆 Erster Sieg (5 Gebote)
  - 🎯 Sammler - 10 Siege (20 Gebote)
  - ⭐ Profi - 50 Siege (100 Gebote)
  - 👑 Meister - 100 Siege (250 Gebote)
  - 🦉 Nachteule (15 Gebote)
  - 🐦 Frühaufsteher (5 Gebote)
  - 💎 Großzügig (30 Gebote)
  - 🍀 Glückspilz (10 Gebote)
  - 🔥 Wochensieger (10 Gebote)
  - 💪 Monatssieger (50 Gebote)
  - 👥 Werber (25 Gebote)
  - 🎓 Anfänger-Champion (15 Gebote)
- UI im Dashboard

#### 4. Mehr Auktionen ✅ NEU
- **62 Produkte** (vorher 10)
- **62 aktive Auktionen** (vorher 10)
- Kategorien: Smartphones, Audio, TV, Laptops, Tablets, Gaming, Haushalt, Smart Home, Smartwatches, Kameras, Drohnen, Gutscheine, Fitness

#### 5. Admin-Konfiguration ✅ NEU
- Alle Features einstellbar via Admin-Panel:
  - Daily Rewards (ein/aus, Min/Max Gebote, Streak-Bonusse)
  - Gratis-Auktionen (ein/aus, Max. Teilnehmer)
  - Beginner-Auktionen (ein/aus, Max. Siege)
  - Nacht-Auktionen (ein/aus, Rabatt %, Stunden)
  - Achievements (ein/aus)
  - Referral (Gebote, Min. Einzahlung)
- API: `/admin/config/game`
- Bulk-Auktions-Erstellung: `/admin/auctions/bulk-create`
- Bulk-Produkt-Import: `/admin/products/bulk-import`

#### 6. Auktions-Filter erweitert ✅
- Live (62)
- 🎓 Anfänger (7)
- 🎁 Gratis (4)
- ⭐ VIP (8)
- Geplant (0)
- Beendet (0)

#### 7. Auktions-Badges ✅
- 🎓 Lila Badge für Beginner-Auktionen
- 🎁 GRATIS Badge für Gratis-Auktionen
- VIP Badge für VIP-Auktionen
- 🌙 Indigo Badge für Nacht-Auktionen

### Frühere Features dieser Session:
- Bid Buddy verbessert
- Push-Notifications "5 Min vor Ende"
- Beginner-Auktionen (max. 10 Siege)
- Stripe LIVE aktiviert
- i18n komplett

## Zugangsdaten

| Rolle | E-Mail | Passwort |
|-------|--------|----------|
| Admin | admin@bidblitz.de | Admin123! |
| Kunde | kunde@bidblitz.de | Kunde123! |

## API Endpoints

### Auth
- `POST /auth/claim-daily-reward` - Tägliche Belohnung abholen
- `GET /auth/daily-reward-status` - Status prüfen
- `GET /auth/achievements` - Achievements anzeigen

### Admin
- `GET/PUT /admin/config/game` - Spielkonfiguration
- `POST /admin/auctions/bulk-create` - Massenauktionen
- `POST /admin/products/bulk-import` - Massenprodukte
- `GET /admin/daily-rewards/stats` - Reward-Statistiken
- `POST /admin/achievements/grant/{user_id}/{achievement_id}` - Achievement vergeben

### Auktionen
- Alle Standard-Endpoints
- Filter: `is_beginner_only`, `is_free_auction`, `is_vip_only`, `is_night_auction`

## Datenbank Collections

- `game_config` - Spieleinstellungen
- `daily_rewards` - Tägliche Belohnungen Log
- `user_achievements` - Benutzer-Achievements
- `products` - 62 Produkte
- `auctions` - 62 Auktionen

## Nächste Schritte

1. Admin-Panel UI für Konfiguration
2. Nacht-Auktionen UI (22-6 Uhr)
3. Achievements-Seite
4. PayPal Integration
5. Live-Chat Support
