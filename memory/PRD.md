# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Completion Status (February 5, 2026)

### ✅ LATEST: Update 10 - Timer-Fix + Bot-Verbesserung + Schnäppchen-Radar (Feb 5)

**Implementiert:**

1. ✅ **Timer-Anzeige korrigiert (P0 - Kritisch):**
   - Timer zeigt jetzt **Stunden:Minuten:Sekunden** für Auktionen > 1 Stunde
   - Grüner Hintergrund für lange Auktionen (>1 Stunde)
   - Blauer Hintergrund für kurze Auktionen (<1 Stunde) 
   - Roter pulsierender Hintergrund wenn < 30 Sekunden
   - Tage-Format implementiert: `1T 12:30:45` für Auktionen > 24 Stunden
   - Dateien: `/app/frontend/src/pages/Auctions.js`, `/app/frontend/src/pages/Home.js`

2. ✅ **Bot-Verhalten verbessert (P1):**
   - **Realistische Intervalle:** 15-90 Sekunden (vorher: 4 Sekunden)
   - **Pause-Perioden:** 15% Chance für 1-3 Minuten Pause
   - **Bot-Rotation:** Verschiedene Bots pro Auktion (nicht immer derselbe)
   - **Gestaffeltes Bieten:** Nicht alle Auktionen gleichzeitig
   - **Doppelte Bot-Namen entfernt:** 37 Duplikate gelöscht
   - Datei: `/app/backend/server.py` (Funktion `bot_last_second_bidder`)

3. ✅ **Schnäppchen-Radar (Neues Feature):**
   - Neue Seite: `/deal-radar` (auch `/radar`, `/schnaeppchen`, `/deals`)
   - Findet Auktionen mit wenig Konkurrenz
   - Zeigt Preishistorie für Produkte
   - Tabs: "Top Schnäppchen" und "Wenig Aktivität"
   - API-Endpoints:
     - `GET /api/deal-radar/bargains` - Schnäppchen finden
     - `GET /api/deal-radar/low-activity` - Wenig-Aktivität Auktionen
     - `GET /api/deal-radar/price-history/{product_id}` - Preishistorie
   - Dateien: `/app/backend/routers/deal_radar.py`, `/app/frontend/src/pages/DealRadarPage.js`

### Bereits vorhanden (aus vorherigen Sessions)

| # | Feature | Status | Pfad |
|---|---------|--------|------|
| 1 | Push-Benachrichtigungen | ✅ Vorhanden | `/api/notifications/push/` |
| 2 | Refer-a-Friend | ✅ Vorhanden | `/invite`, `/referral/` |
| 3 | Countdown-Deals | ✅ Vorhanden | `/flash-sales/` |
| 4 | Auktions-Favoriten | ✅ Vorhanden | `/favorites/`, `/watchlist` |
| 5 | Winner Gallery | ✅ Vorhanden | `/winners`, `/gewinner` |
| 6 | Täglicher Login-Bonus | ✅ Vorhanden | `/daily-quests/`, `/belohnungen` |
| 7 | SMS-Verifizierung | ✅ Placeholder | `/phone-verify` (benötigt Twilio) |
| 8 | Gebote-Abo | ✅ Vorhanden | `/subscription`, `/abo` |
| 9 | Affiliate-Programm | ✅ Vorhanden | `/influencer/`, `/affiliate/` |
| 10 | Preis-Alarme | ✅ Vorhanden | `/alerts`, `/price-alerts` |
| 11 | PWA Support | ✅ Vorhanden | manifest.json + sw.js |
| 12 | Live-Chat | ✅ Vorbereitet | TawkToChat.js (benötigt Tawk.to ID) |

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Manager (Prishtina):** manager.prishtina@bidblitz.de / Manager123!
- **Promo Code:** WELCOME2026 (50 Gebote)

## Key API Endpoints

### Auctions
- `POST /api/admin/auctions` - Auktion erstellen
- `GET /api/auctions/ended` - Beendete Auktionen für "Ende" Tab
- `GET /api/auction-of-the-day` - Auktion des Tages
- `POST /api/auctions/{id}/bid` - Gebot platzieren

### Deal Radar (NEU)
- `GET /api/deal-radar/bargains` - Schnäppchen finden
- `GET /api/deal-radar/low-activity` - Auktionen mit wenig Aktivität
- `GET /api/deal-radar/price-history/{product_id}` - Preishistorie
- `GET /api/deal-radar/ending-soon?minutes=30` - Auktionen die bald enden

### Gamification
- `GET /api/gamification/happy-hour` - Status abrufen
- `PUT /api/gamification/happy-hour/config` - Einstellungen ändern
- `GET /api/excitement/lucky-bid/status` - Lucky Bid Status

## Pending Items (Priority Order)

1. **P1: SMS-Verifizierung aktivieren** - Benötigt Twilio API-Schlüssel
2. **P2: Live-Chat aktivieren** - Benötigt Tawk.to Property ID

## Future Tasks (Backlog)

- Apple Login fertigstellen (blockiert - Apple Developer Credentials)
- WhatsApp Business Integration
- 2FA (Zwei-Faktor-Authentifizierung)
- SEO Optimierung

## Known Mocked Services

- **Tawk.to (Live Chat):** Vorbereitet, benötigt Property ID
- **Resend (Email):** API integriert, aber im Mock-Modus
- **Twilio (SMS):** Placeholder erstellt, benötigt API-Schlüssel

## Architecture Notes

### Auction System
- **Fixed-End Auktionen:** Timer läuft ohne Reset bei neuem Gebot
- **is_fixed_end Flag:** Alle Auktionen haben dieses Flag = true
- **Mindestpreis:** €20 für normale Auktionen, 30% für Gutscheine

### Timer Behavior
- Grün: > 1 Stunde verbleibend (HH:MM:SS)
- Blau: < 1 Stunde verbleibend (MM:SS)
- Rot/Pulsierend: < 30 Sekunden verbleibend
- Tage-Format: > 24 Stunden (XT HH:MM:SS)

### Bot Behavior
- Intervalle: 15-90 Sekunden (zufällig)
- Pause-Chance: 15% für 1-3 Minuten
- Rotation: Verschiedene Bots pro Auktion
- Gestaffelt: Max 5 Auktionen pro Zyklus

### Error Handling
- `/app/frontend/src/lib/axiosConfig.js` - Globaler Axios-Interceptor
- Unterdrückt 404, 405 und Netzwerkfehler automatisch

## Test Reports
- `/app/test_reports/iteration_32.json` - Timer + Deal Radar Tests (100% PASS)

## Last Updated
February 5, 2026
