# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Completion Status (February 2, 2026)

### ✅ Session Summary: Influencer-Bearbeitung Implementiert

**Neu implementiert (February 2, 2026):**
- ✅ **Admin: Influencer bearbeiten** - Vollständiges Modal mit allen Feldern (Name, Provision, E-Mail, Stadt, Manager, Social Media, Status)
- ✅ **Manager: Influencer bearbeiten** - Eingeschränktes Modal (nur Stadt aus eigenem Bereich zuweisen)
- ✅ **Activity-Logging** - Alle Manager-Bearbeitungen werden im Aktivitäts-Protokoll erfasst
- ✅ Manager-Dashboard zeigt jetzt Bearbeiten-Button für jeden Influencer

**Vorherige Session:**
- ✅ Manager-Dashboard-Erweiterung
- ✅ Admin Manager-Aktivitätsprotokoll
- ✅ "Gewinner der Woche"-Broadcast-Button

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
1. ~~**P1: UI-Button für "Gewinner der Woche" Broadcast**~~ ✅ Implementiert
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
