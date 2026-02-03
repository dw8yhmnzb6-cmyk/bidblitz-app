# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Completion Status (February 3, 2026)

### ✅ NEW: Update 3 - Jackpot Toggle + BidBlitz Gutscheine + Übersetzungen (Feb 3)

**Implementiert:**

1. ✅ **Admin Jackpot Ein/Aus-Schalter:**
   - Toggle-Button im Admin Panel (🏆 Jackpot Tab)
   - API: `POST /api/excitement/global-jackpot/toggle`
   - Status wird in global_jackpot.is_active gespeichert

2. ✅ **BidBlitz-eigene Gutscheine:**
   - Neue Produkte erstellt (nur unsere eigenen):
     - BidBlitz 50 Gratis-Gebote
     - BidBlitz 100 Gratis-Gebote  
     - BidBlitz 200 Gratis-Gebote
     - BidBlitz VIP 1 Monat GRATIS
   - Alte Drittanbieter-Gutscheine entfernt aus Auktionen

3. ✅ **Übersetzungen aktualisiert:**
   - "Gutscheine" statt "Gratis/Free" in allen Sprachen
   - Albanisch (SQ): "Kuponë" 
   - Türkisch (TR): "Kuponlar"
   - Französisch (FR): "Bons"
   - Spanisch (ES): "Cupones"
   - Info-Text: "Gebote kosten Geld, Gutschein ist GRATIS bei Gewinn"

### ✅ Update 2 - Investor Portal + Gutschein-System (Feb 3)

**Verbesserungen:**

1. ✅ **Investor Portal - Klare Vorteile:**
   - Neue "Vision" Sektion mit Zielen (€5M+ Umsatz, 100K+ Nutzer, 10+ Länder)
   - "Was Sie als Investor erhalten" mit 4 Kategorien:
     - 📈 Rendite-Potenzial (Ziel: 20-50% p.a.)
     - 🏆 Unternehmensanteile (0.01% - 1% Equity)
     - 🎁 Exklusive Vorteile (VIP, Gratis-Gebote, Events)
     - 📊 Volle Transparenz (Reports, Dashboard, Meetings)

2. ✅ **Gutschein-Auktionen (Gratis → Gutscheine):**
   - Umbenannt von "Gratis" zu "Gutscheine" (🎫)
   - Klarstellung: Gebote kosten Geld, Gutschein ist GRATIS bei Gewinn
   - Backend: `/api/voucher-auctions/*` Router
   - Max 20 Gebote/Woche auf Gutschein-Auktionen
   - Max 1 Gutschein-Gewinn pro Nutzer (lifetime)

3. ✅ **Übersetzungen aktualisiert:**
   - DE: "Gutscheine" statt "Gratis"
   - EN: "Vouchers" statt "Free"
   - Info-Text: "Bieten Sie mit gekauften Geboten - Gutschein ist GRATIS bei Gewinn!"

### ✅ Stripe Integration + Tag/Nacht Logik (Feb 3, 2026)

**Neu implementiert:**

1. ✅ **Investor Portal mit Stripe-Zahlung:**
   - 4 Investment-Pakete: Starter (€500), Standard (€2.500), Premium (€10.000), Partner (€50.000)
   - Automatische Stripe-Checkout Integration
   - Equity-Anteile und Perks pro Paket
   - Polling für Zahlungsstatus

2. ✅ **Tag/Nacht-Auktionen Logik:**
   - Tag-Auktionen: Nur sichtbar 06:00-23:30 Uhr
   - Nacht-Auktionen: Nur sichtbar 23:30-06:00 Uhr
   - "Nacht"-Filter nur nachts sichtbar
   - "Geschenke"-Filter entfernt

3. ✅ **Gratis-Auktionen System:**
   - Backend: `/api/free-auctions/*` Router
   - Max 20 Gratis-Gebote pro Woche pro Nutzer
   - Max 1 Gratis-Gewinn pro Nutzer (lifetime)
   - 4 Gratis-Gutschein-Auktionen aktiv

4. ✅ **Neue Backend APIs:**
   - `GET /api/investor/packages` - Investment-Pakete
   - `POST /api/investor/checkout` - Stripe Checkout erstellen
   - `GET /api/investor/checkout/status/:id` - Zahlungsstatus
   - `POST /api/investor/webhook/stripe` - Stripe Webhook
   - `GET /api/free-auctions/limits` - Gratis-Gebote Limits
   - `POST /api/free-auctions/bid/:id` - Gratis-Gebot platzieren

### ✅ Auktionstypen + Investor Portal (February 2, 2026)

**Neu implementiert:**

1. ✅ **Neue Auktionstypen:**
   - 🌙 **Nacht-Auktionen** (4 aktiv) - Spezielle Auktionen für Nacht-Spieler
   - 🎓 **Anfänger-Auktionen** (4 aktiv) - Nur für neue Nutzer
   - 🎀 **Geschenke-Auktionen** (5 aktiv) - Gutscheine & Geschenkkarten

2. ✅ **Gutschein-Produkte erstellt:**
   - Amazon €50 & €100
   - MediaMarkt €75
   - IKEA €100
   - Steam €50
   - PlayStation Store €50
   - Netflix €25
   - Spotify Premium

3. ✅ **Investor Portal** (`/investor` oder `/investoren`):
   - **Übersicht:** Plattform-Statistiken, Wachstumskurve
   - **Crowdfunding:** 3 Demo-Projekte (Mobile App, EU-Expansion, Premium Katalog)
   - **Investieren:** Direkt-Investition Formular
   - **Meine Investitionen:** Übersicht für eingeloggte Nutzer

4. ✅ **Backend APIs:**
   - `GET /api/investor/public/stats` - Öffentliche Statistiken
   - `GET /api/investor/crowdfunding/projects` - Crowdfunding-Projekte
   - `POST /api/investor/investments` - Investitionsanfrage
   - `POST /api/investor/crowdfunding/invest` - In Projekt investieren

**Aktive Auktionen:** 48 (inkl. 4 Nacht, 4 Anfänger, 5 Geschenke)

### ✅ Admin Panel UI Bugs Fixed (February 2, 2026)
**Bug Fixes Verified:**
1. ✅ **Manager Details Modal** - Responsive auf Mobilgeräten (2x2 Grid)
2. ✅ **Jackpot Panel** - Benutzer-Dropdown funktioniert (7 Benutzer laden), Betrag-Eingabe funktioniert
3. ✅ **Letzter Gewinner Anzeige** - €NaN Bug behoben (null-check hinzugefügt)

**Test Report:** `/app/test_reports/iteration_31.json`

### ✅ Session Summary: Neue Auktionen + Globaler Jackpot

**Neu implementiert (February 2, 2026):**

1. ✅ **Alle alten Auktionen gelöscht** - Frischer Start
2. ✅ **20 neue gemischte Auktionen erstellt**:
   - Elektronik (iPhone, AirPods, Samsung, MacBook)
   - Gaming (PS5, Nintendo Switch)
   - Haushalt (Dyson, Nespresso, KitchenAid)
   - Mode (Ray-Ban, Michael Kors, Pandora)
   - Gutscheine (Amazon, MediaMarkt, IKEA)
   - Sport (E-Scooter, Fitbit)

3. ✅ **Globaler Jackpot-System**:
   - Großer goldener Banner auf Startseite
   - Start: 500 Gebote (€75 Wert)
   - Jedes Gebot erhöht um +1
   - Admin kann Jackpot vergeben: `/api/excitement/global-jackpot/award/{user_id}`

4. ✅ **8 Spannung-Features** (vorherige Implementierung):
   - Jackpot-Auktionen, Blitz-Countdown, Mystery, Duell, Lucky Bid, Happy Hour, Turbo, Sniper-Alarm

**Admin-Panel:** `/admin/excitement` - Verwalten aller Spannung-Features

### Previous Session: 21 Features + Manager Fix

**New Feature: Admin Manager Details**
- Bei Klick auf "Details" eines Managers sieht man:
  - Verwaltete Städte
  - Anzahl Influencer
  - Influencer-Provision gesamt
  - Manager-Provision (15%)
  - Liste aller Influencer mit Code, Stadt, Anmeldungen, Provision, Status
  - Zugangsdaten des Managers
  - **NEU: Aktivitäts-Protokoll** (Login, Freischalten, Sperren)

**New Feature: Weekly Winners (Gewinner der Woche)**
- API `/api/weekly-winners/top-deals` - Top Schnäppchen der Woche
- API `/api/weekly-winners/stats` - Wochenstatistiken
- API `/api/weekly-winners/broadcast` - Push an alle Benutzer (Admin)
- API `/api/weekly-winners/leaderboard` - Top Gewinner der Woche

### All Features Implemented (20 Customer + 1 Weekly Winners)

**Batch 1 (10 Features):**
1. Bid Buddy / Auto-Bieter
2. Buy It Now mit Gebot-Guthaben
3. Subscription Model (3 Stufen)
4. Achievements & Badges (18 Abzeichen)
5. Referral/Freunde-Bonus
6. Win Notifications
7. Countdown Alarm
8. Video Testimonials
9. Statistics & Insights
10. Live Chat (Tawk.to Placeholder)

**Batch 2 (10 Features):**
1. Favoriten mit Smart Alerts
2. Team-Auktionen (Gruppen-Bieten)
3. Bid-Zurück für VIP (10-25%)
4. Auktions-Replay & Statistiken
5. Flash-Gutscheine
6. VIP-Lounge Chat
7. Geburtstags-Bonus (10-30 Gebote)
8. Auktions-Versicherung
9. Produkt-Wünsche Voting
10. Streak-Schutz mit Meilensteinen

**Bonus Feature:**
- Gewinner der Woche Push-Benachrichtigung

## Test Credentials

### Funktionierend:
- **Admin:** admin@bidblitz.de / Admin123!
- **Customer:** kunde@bidblitz.de / Kunde123!
- **Manager Prishtina:** manager.prishtina@bidblitz.de / Prishtina2024! ✅
- **Manager Berlin:** manager.berlin@bidblitz.de / Manager123! ✅
- **Influencer:** Code: demo

## Test Reports
- `/app/test_reports/iteration_28.json` - Batch 1 (100% pass)
- `/app/test_reports/iteration_29.json` - Batch 2 (100% pass)

## Key API Endpoints - New

### Manager (Admin)
- GET `/api/manager/admin/{manager_id}/influencers` - Influencer eines Managers

### Weekly Winners
- GET `/api/weekly-winners/top-deals` - Top Schnäppchen
- GET `/api/weekly-winners/stats` - Wochenstatistiken
- POST `/api/weekly-winners/broadcast` - Push senden (Admin)
- GET `/api/weekly-winners/leaderboard` - Top Gewinner

## Pending Items (Priority Order)
1. ~~**P0: Admin Panel UI Bugs (Manager Modal + Jackpot Panel)**~~ ✅ Behoben
2. **P1: Internationalisierung (i18n)** - Hardcodierte Texte durch `t()` ersetzen
3. **P2: Apple Login finalisieren** - Apple Developer Account erforderlich
4. **P2: Auction Duration Bug** - Admin-Formular Berechnung
5. **P3: "Not Found" Toast** - Wiederkehrendes Problem
6. **Live-Chat aktivieren**: Tawk.to Property ID + Widget ID erforderlich

## Key API Endpoints - Manager Features
- `POST /api/manager/login` - Manager-Anmeldung
- `GET /api/manager/dashboard/{manager_id}` - Manager-Dashboard mit Statistiken und Influencer-Liste
- `POST /api/manager/{manager_id}/influencer/approve/{influencer_id}` - Influencer freischalten
- `POST /api/manager/{manager_id}/influencer/block/{influencer_id}` - Influencer sperren
- `PUT /api/manager/{manager_id}/influencer/{influencer_id}/update` - **NEU:** Influencer bearbeiten (Stadt zuweisen)
- `GET /api/manager/admin/{manager_id}/influencers` - Influencer eines Managers (Admin)
- `GET /api/manager/admin/{manager_id}/activities` - Aktivitätsprotokoll eines Managers (Admin)

## Key API Endpoints - Influencer Features
- `PUT /api/influencer/admin/{influencer_id}` - **Vollständige Bearbeitung** (Admin only)

## Last Updated
February 2, 2026

## Changelog

### February 2, 2026 - Manager Fix + Weekly Winners
- ✅ Manager Login-Credentials repariert
- ✅ Admin Manager-Details-Modal implementiert
- ✅ Influencer-Übersicht pro Manager
- ✅ Weekly Winners API implementiert
- ✅ Gewinner der Woche Push-Feature

### February 2, 2026 - Batch 1 & 2 (20 Features)
- ✅ Alle 20 Kunden-Features implementiert
- ✅ 100% Test-Erfolgsrate in beiden Batches
