# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Completion Status (February 4, 2026)

### ✅ LATEST: Update 5 - iPad Fixes + Happy Hour/Lucky Admin (Feb 4)

**Implementiert:**

1. ✅ **iPad Admin-Sidebar repariert:**
   - Sidebar jetzt ab 768px sichtbar (vorher 1024px)
   - Optimierte Größen für Tablets
   - Vollständige Navigation auf iPad

2. ✅ **Glücksrad (Spin Wheel) iPad-Fix:**
   - Modal mit z-index 99999 über allem
   - Zentriert und responsive
   - Vollständig sichtbar auf allen Geräten

3. ✅ **Safari/iOS Login-Kompatibilität:**
   - `safeStorage` Helper für localStorage/sessionStorage Fallback
   - Funktioniert in Safari Private Mode

4. ✅ **Happy Hour Admin-Einstellungen:**
   - Ein/Aus Toggle-Schalter
   - Startzeit und Endzeit konfigurierbar
   - Bonus-Multiplikator wählbar (1.5x, 2x, 2.5x, 3x)
   - API: `PUT /api/gamification/happy-hour/config`

5. ✅ **Lucky in 50 Admin-Einstellungen:**
   - Gewinn-Intervall wählbar (25, 50, 100, 200)
   - Gewinn-Gebote wählbar (5, 10, 15, 25)
   - Live-Statistik (Gebote bis Lucky Bid, Gesamte Gebote)
   - API: `PUT /api/excitement/lucky-bid/config`

6. ✅ **Promo-Code "Nur einmal pro Kunde" Option:**
   - Neue Checkbox im Admin-Formular
   - "Limit" Spalte zeigt 1x/Kunde oder Mehrfach

### ✅ Update 4 - Auktions-Sichtbarkeit + Promo-Codes (Feb 3)

1. ✅ "Ende" Tab zeigt beendete Auktionen (via auction_history)
2. ✅ Nacht-Auktionen immer sichtbar
3. ✅ Promo-Code-System fertig (Admin + Benutzer-UI)

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Promo Code:** WELCOME2026 (50 Gebote)

## Key API Endpoints - New

### Happy Hour
- `GET /api/gamification/happy-hour` - Status abrufen
- `PUT /api/gamification/happy-hour/config` - Einstellungen ändern

### Lucky Bid
- `GET /api/excitement/lucky-bid/status` - Status und Statistik
- `PUT /api/excitement/lucky-bid/config` - Einstellungen ändern

## Pending Items (Priority Order)

1. **P1: Alle Übersetzungen vervollständigen** - Site-weiter Audit
2. **P2: Auktionsdauer-Bug** - Admin-Formular Berechnung
3. **P3: "Not Found" Toast** - Wiederkehrendes Problem

## Last Updated
February 4, 2026
