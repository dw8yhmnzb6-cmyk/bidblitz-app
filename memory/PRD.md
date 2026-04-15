# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), emergentintegrations, CoinGecko API, httpx, yfinance

## Production Status: LAUNCH-READY (55+ Services)

### All Features
- **Zahlung & Finanzen**: Wallet, QR, P2P, Karten, Krypto (CoinGecko live), Budget, Kredit, BNPL, Geschenkkarten
- **Aktien & ETFs**: 24 Assets (AAPL, MSFT, NVDA, SAP, iShares...), Portfolio, Watchlist, Kauf/Verkauf via Wallet, Yahoo Finance Live-Kurse
- **Mobilitat**: Taxi (Autocomplete, Saved Places, Map-Switcher, Multi-Vehicle Estimates), Scooter+Abos, Mietwagen, Fluege, Pakete, Ladesaeulen, Gebrauchtwagen, Umzug
- **Buchung**: Hotels, Events, Restaurants, Termine, Reiseplaner, Versicherungen
- **Marktplaetze**: Immobilien, Freelancer, Jobs+CV, Handwerker, Reinigung, Marktplatz, Auktionen
- **Lifestyle**: Streaming, Dating, Fitness, Telemedizin, Tierbetreuung
- **Lernen**: E-Learning, Gaming, BlitzPoints, Mining, Referral, CV-Builder
- **Familie**: Kids App (GPS Mapbox+Schnellstandorte, GPS auf Eltern-Uebersichtskarten), Kids Kontrolle, Social, KI-Assistent
- **Business**: Haendler-Portal, POS, VIP, Split Bill
- **System**: Notifications (13 Seed), Email Marketing Admin, Admin Panel (66+ Tiles), Dark/Light Mode

## Recent Fixes (2026-04-15)
- FIXED: Taxi "Netzwerkfehler" - Backend akzeptiert jetzt nested pickup/dropoff Format, gibt 3 Fahrzeugtyp-Estimates zurueck
- FIXED: Stocks API KeyError/NaN - yfinance NaN/Infinity Werte werden abgefangen, Fallback-Preise genutzt
- ADDED: Kids GPS auf Eltern-Uebersichtskarten (Mini-Mapbox-Karte + Adresse + Batterie-Status pro Kind)
- SEEDED: GPS-Koordinaten fuer alle 7 Kinder (Berliner Standorte)

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!

## Backlog
- P1: Apple Pay / Google Pay (Stripe Integration)
- P2: i18n fuer neue Module (Albanisch/Deutsch Mixup in Bottom Nav)
- P2: Push Notifications Frontend-UI (Backend seeded, Toast/Modal fehlt)
- P3: App.js Route-Block refactoring (35+ Routes)
