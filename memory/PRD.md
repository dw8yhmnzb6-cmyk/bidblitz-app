# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (MongoDB)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Completed Features

### Core Platform - Wallet, Kids GPS, POS, Auctions, Mobility, Loyalty
### Scooter Live - Map + Admin
### Credit Score - Term selection + repayment schedule
### Support Chat - Threaded tickets
### Car Rental - Full module (16+ pages, disputes, staff, reports, PDFs)
### Gaming Platform - 11 Games, Coin Economy
### Mining Page - BLZ Token Mining (improved UI)
### Auctions - 20 Products 2026, varied bot prices

### Premium Finance (DONE - 2026-04-11)
- **Rechnung teilen**: Erstellen, Teilnehmer, automatische Berechnung pro Person
- **Virtuelle Karten**: Einmal-Karten erstellen (Limit, Label), Nummer anzeigen/kopieren
- **Sparziele**: Ziel setzen (Name, Betrag, monatlich), Fortschrittsbalken
- **Später zahlen (BNPL)**: Info-Seite, Ratenzahlungen anzeigen
- **Geschenkkarten**: 8 Anbieter, Kauf via Wallet, Code-Generierung

### Mining Page Verbesserung (DONE - 2026-04-11)
- Premium Glassmorphism Balance Card mit Gradient-Effekten
- Deutsche Texte (Auszahlen, Senden, Abbrechen)
- Miner-Karten mit farbigen Borders und besserer Lesbarkeit

### Car Rental Production Gaps (DONE - 2026-04-12)
- Contract PDF: Backend route + PDF generator + Frontend API ✅
- Handover Photos: Backend upload endpoint + Frontend API ✅
- Vendor Staff UI: Full CRUD page + Navigation im Vendor Dashboard ✅
- Admin Disputes UI: Full list/detail/resolve page + Navigation im Admin Panel ✅
- Vendor Reports UI: Stats + Charts + Navigation ✅
- Admin Commission UI: Inline per-vendor commission + Settings Tab ✅
- Admin Settings Tab: Default commission, min payout, payout schedule, max booking days ✅

### i18n / Mehrsprachigkeit (IN PROGRESS - 2026-04-12)
- Bestehendes i18n-System: 12 Sprachen (DE, EN-UK, EN-US, SQ, SQ-XK, TR, FR, ES, IT, PT, NL, PL, RU, AR, AR-AE)
- Extra Translations Modul (`translations_extra.js`) für Gaming, Car Rental, Premium Finance
- GamingPage vollständig auf i18n umgestellt (Spielnamen, Beschreibungen, UI-Texte, Buttons)
- Sprache wird im User-Profil gespeichert und beim Login automatisch geladen
- Noch ausstehend: Car Rental Pages, Premium Finance Pages, weitere Seiten konvertieren

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!

## Pending Tasks
- P1: Remaining pages i18n conversion (Car Rental 16 pages, Premium Finance 6 pages, ~10 other pages)
- P2: Premium Finance UX-Verfeinerung
- P2: Push Notifications / Geofence
- P2: Apple Pay / Google Pay
- Backlog: Car Rental Insurance Management
- Refactoring: Große Monolith-Dateien aufteilen (AuctionsPage, MiningPage, GamingPage)
