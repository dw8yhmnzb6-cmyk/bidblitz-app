# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS (Streets v12)
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)

## Production Status: LAUNCH-READY

### All Features (Complete)
- Wallet, POS (Barcode/NFC), Auctions, Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module, i18n), Premium Finance (7 modules, i18n)
- AI Assistant (BlitzBot), Crypto Wallet, Budget Planner
- Kids Module (GPS, Geofencing, Wallet, Tasks, Screen Time, App Control, SOS)
- Kids App (Chat mit Polling/Tipp-Indikator, Anrufen, Lernspiele, SOS)
- Admin Panel (66+ Tiles, 3 neue Sektionen, Email Marketing Admin UI)
- Händler-Portal, Trinkgeld-System, Hotels, Events, Restaurants
- Insurance, Appointments, Social Feed, Jobs+CV, Flüge, Pakete
- Immobilien, Freelancer, E-Learning, Handwerker, Streaming, Telemedizin
- Dating, Gebrauchtwagen, Reinigung, Umzug, Tierbetreuung, Fitness
- Reiseplaner, Ladesäulen (Freischalten-Flow), Scooter-Abos (Wochen/Monat/Jahr)
- Quick Access (42 Shortcuts), i18n 15 Sprachen, Dark/Light Mode (CSS Overrides)

### Email Marketing Admin (Feb 2026)
- Kampagnen erstellen mit Zielgruppen-Auswahl (Alle/Aktive/Händler/Premium)
- Live-Vorschau im BidBlitz-Style, Test-E-Mail senden
- 5 Quick-Templates (Willkommen, Flash Sale, Feature, Cashback, Empfehlung)
- Kampagnen-Verlauf mit Statistiken (Gesendet/Fehlgeschlagen/Empfänger)
- Erreichbar über Admin Panel → Marketing → E-Mail Marketing

### Kids Chat Backend (Feb 2026)
- `/poll` Endpoint für effizientes Polling (nur neue Nachrichten seit Timestamp)
- `/typing` Endpoint für Tipp-Indikator (auto-expire nach 5 Sek.)
- Frontend: 3-Sekunden-Polling, Typing-Dots-Animation, deduplizierte Messages

### Light/Dark Mode CSS (Feb 2026)
- Comprehensive CSS overrides für inline-styles (#030303, #111, #0A0A0F)
- Text-color overrides (#fff → text-primary, #888/#aaa → text-secondary)
- Input/textarea, select, scrollbar, toaster overrides
- Border, bottom-nav, sticky-header overrides
- Accent colors (#00C2FF) bleiben in Light Mode kräftig

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026! (10.000€ Guthaben)
- Customer: kunde@bidblitz.com / Kunde2026! (5.000€ Guthaben)
- Kids: "Albin" (child of admin account)

## Backlog
- Apple Pay / Google Pay Integration (P1)
- Push Notifications (P2)
- i18n für alle neuen Module (P2)
