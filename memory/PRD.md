# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Completion Status (February 5, 2026)

### ✅ LATEST: Update 11 - Alle empfohlenen Features implementiert (Feb 5)

**Neu implementiert:**

1. ✅ **Live Winner Popups**
   - Zeigt Echtzeit-Gewinner-Benachrichtigungen
   - Social Proof und FOMO-Effekt
   - WebSocket-Integration für Live-Updates
   - Alle 45-90 Sekunden zufällige Anzeige
   - Datei: `/app/frontend/src/components/LiveWinnerPopup.js`

2. ✅ **Gewinner-Feier Animation (Konfetti)**
   - Konfetti-Animation bei Gewinn
   - canvas-confetti Bibliothek installiert
   - Share-Funktion integriert
   - Datei: `/app/frontend/src/components/WinnerCelebration.js`

3. ✅ **Anfänger-Gewinn-Garantie**
   - Neue Benutzer gewinnen garantiert erste Auktion
   - Max 3 garantierte Gewinne pro Benutzer
   - Nur für Produkte unter €50 UVP
   - 7 Tage Gültigkeit nach Registrierung
   - API: `/api/beginner-guarantee/`
   - Datei: `/app/backend/routers/beginner_guarantee.py`

4. ✅ **WhatsApp Business Notifications**
   - Benachrichtigungen bei Auktionsende
   - Überboten-Alarme
   - Gewinn-Benachrichtigungen
   - **MOCKED** - Benötigt WHATSAPP_ACCESS_TOKEN
   - API: `/api/whatsapp/`
   - Datei: `/app/backend/routers/whatsapp_notifications.py`

5. ✅ **Countdown E-Mails für Favoriten**
   - E-Mail 1 Stunde vor Auktionsende
   - E-Mail 30 Minuten vor Ende
   - Überboten-Benachrichtigung
   - API: `/api/countdown-emails/`
   - Datei: `/app/backend/routers/countdown_emails.py`

6. ✅ **User Statistik-Dashboard**
   - Level-System (Bronze bis Legende)
   - Achievements mit Fortschritt
   - Gewinnrate, Ersparnisse, Streak
   - Lieblingskategorien
   - Route: `/stats`, `/statistiken`
   - Datei: `/app/frontend/src/pages/UserStatsPage.js`

7. ✅ **Team-Auktionen**
   - Teams erstellen/beitreten/verlassen
   - Team-Chat
   - Gemeinsames Bieten
   - API: `/api/team-auctions/`
   - Datei: `/app/backend/routers/team_auctions.py`

8. ✅ **Auktions-Replay** (bereits vorhanden, erweitert)
   - Vergangene Auktionen ansehen
   - Zeitlinie mit allen Geboten
   - API: `/api/auction-replay/`

### Vorherige Updates (Feb 5)

- ✅ Timer-Fix: Zeigt jetzt Stunden:Minuten:Sekunden (grün)
- ✅ Bot-Verhalten: Realistische Intervalle 15-90 Sek
- ✅ Schnäppchen-Radar: 6 Sprachen
- ✅ 37 doppelte Bot-Namen entfernt

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Manager:** manager.prishtina@bidblitz.de / Manager123!

## Key API Endpoints (NEU)

### Beginner Guarantee
- `GET /api/beginner-guarantee/eligibility` - Prüft Berechtigung
- `POST /api/beginner-guarantee/activate/{auction_id}` - Garantie aktivieren
- `GET /api/beginner-guarantee/my-guarantees` - Meine Garantien

### Team Auctions
- `POST /api/team-auctions/create` - Team erstellen
- `POST /api/team-auctions/join/{invite_code}` - Team beitreten
- `GET /api/team-auctions/my-team` - Mein Team
- `POST /api/team-auctions/bid/{auction_id}` - Team-Gebot
- `GET/POST /api/team-auctions/chat/{team_id}` - Team-Chat

### WhatsApp (MOCKED)
- `POST /api/whatsapp/subscribe` - Anmelden
- `GET /api/whatsapp/status` - Status prüfen
- `PUT /api/whatsapp/preferences` - Einstellungen

### Countdown Emails
- `POST /api/countdown-emails/subscribe/{auction_id}` - Benachrichtigung aktivieren
- `GET /api/countdown-emails/my-subscriptions` - Meine Abos

## Test Reports
- `/app/test_reports/iteration_32.json` - Timer + Deal Radar (100% PASS)
- `/app/test_reports/iteration_33.json` - Alle neuen Features (100% PASS)

## Pending Items

1. **P1: SMS-Verifizierung** - Benötigt Twilio Credentials
2. **P1: WhatsApp aktivieren** - Benötigt WHATSAPP_ACCESS_TOKEN
3. **P2: Live-Chat aktivieren** - Benötigt Tawk.to Property ID

## Mocked Services

| Service | Status | Benötigt |
|---------|--------|----------|
| WhatsApp Business | MOCKED | WHATSAPP_ACCESS_TOKEN |
| Twilio SMS | MOCKED | Account SID, Auth Token |
| Tawk.to Live Chat | MOCKED | Property ID |
| Resend Email | MOCKED | API Key konfiguriert |

## Architecture Notes

### Frontend Components (NEU)
- `LiveWinnerPopup.js` - Zeigt Gewinner-Popups alle 45-90 Sek
- `WinnerCelebration.js` - Konfetti bei eigenem Gewinn
- `UserStatsPage.js` - Statistik-Dashboard mit Levels

### Backend Routers (NEU)
- `beginner_guarantee.py` - Anfänger-Gewinn-Garantie
- `team_auctions.py` - Team-System
- `whatsapp_notifications.py` - WhatsApp Integration
- `countdown_emails.py` - E-Mail Countdown

### Timer Behavior
- Grün: > 1 Stunde (HH:MM:SS)
- Blau: < 1 Stunde (MM:SS)
- Rot pulsierend: < 30 Sekunden

### Bot Behavior
- Intervalle: 15-90 Sekunden
- Pause-Chance: 15% für 1-3 Min
- Verschiedene Bots pro Auktion

## Last Updated
February 5, 2026
