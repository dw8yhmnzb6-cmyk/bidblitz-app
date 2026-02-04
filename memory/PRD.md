# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Completion Status (February 5, 2026)

### ✅ LATEST: Update 6 - Bug Fixes (Feb 5)

**Repariert:**

1. ✅ **"Not Found" Toast-Unterdrückung:**
   - Verbesserter Axios-Interceptor in `/app/frontend/src/lib/axiosConfig.js`
   - 404-Fehler werden jetzt konsequent unterdrückt
   - Keine störenden "Not Found" Meldungen mehr für Benutzer

2. ✅ **Auktionsdauer-Bug untersucht:**
   - Backend-API funktioniert korrekt (86400 Sekunden = 24 Stunden)
   - Frontend-Logik in `AdminAuctions.js` konvertiert korrekt:
     - `minutes` → `× 60`
     - `hours` → `× 3600`
     - `days` → `× 86400`
   - Mindestdauer von 10 Stunden wird durchgesetzt

3. ✅ **Penny-Auktion Timer erklärt:**
   - Timer zeigt Zeit bis aktuelles Gebot gewinnt (~10-15 Sekunden)
   - Reset bei jedem neuen Gebot - das ist normales Penny-Auktion-Verhalten
   - Keine Änderung erforderlich - funktioniert wie beabsichtigt

### ✅ Update 5 - iPad Fixes + Happy Hour/Lucky Admin (Feb 4)

1. ✅ **iPad Admin-Sidebar repariert**
2. ✅ **Glücksrad (Spin Wheel) iPad-Fix**
3. ✅ **Safari/iOS Login-Kompatibilität**
4. ✅ **Happy Hour Admin-Einstellungen**
5. ✅ **Lucky in 50 Admin-Einstellungen**
6. ✅ **Promo-Code "Nur einmal pro Kunde" Option**

### ✅ Update 4 - Auktions-Sichtbarkeit + Promo-Codes (Feb 3)

1. ✅ "Ende" Tab zeigt beendete Auktionen (via auction_history)
2. ✅ Nacht-Auktionen immer sichtbar
3. ✅ Promo-Code-System fertig (Admin + Benutzer-UI)

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Promo Code:** WELCOME2026 (50 Gebote)

## Key API Endpoints

### Auctions
- `POST /api/admin/auctions` - Auktion erstellen (mit `duration_seconds`)
- `GET /api/auctions/ended` - Beendete Auktionen für "Ende" Tab
- `GET /api/auction-of-the-day` - Auktion des Tages

### Gamification
- `GET /api/gamification/happy-hour` - Status abrufen
- `PUT /api/gamification/happy-hour/config` - Einstellungen ändern
- `GET /api/excitement/lucky-bid/status` - Status und Statistik
- `PUT /api/excitement/lucky-bid/config` - Einstellungen ändern

## Pending Items (Priority Order)

1. **P1: Alle Übersetzungen vervollständigen** - Site-weiter Audit für 100% deutsche Übersetzung
2. **P2: Apple Login fertigstellen** - Wartet auf Apple Developer Credentials

## Future Tasks (Backlog)

- Live-Chat aktivieren (benötigt Tawk.to ID)
- WhatsApp Business Integration
- 2FA (Zwei-Faktor-Authentifizierung)
- SEO Optimierung

## Known Mocked Services

- **Tawk.to (Live Chat):** Placeholder-Skript vorhanden
- **Resend (Email):** API integriert, aber im Mock-Modus

## Architecture Notes

### Auction Timer Behavior (Penny Auction)
Der Timer zeigt NICHT die Gesamtdauer der Auktion, sondern die verbleibende Zeit bis das aktuelle Gebot gewinnt. Bei jedem neuen Gebot wird der Timer auf 10-15 Sekunden zurückgesetzt. Dies ist das Standard-Verhalten einer Penny-Auktion.

### Error Handling
- `/app/frontend/src/lib/axiosConfig.js` - Globaler Axios-Interceptor
- Unterdrückt 404, 405 und Netzwerkfehler automatisch
- Verhindert "Not Found" Toast-Meldungen für Benutzer

## Last Updated
February 5, 2026
