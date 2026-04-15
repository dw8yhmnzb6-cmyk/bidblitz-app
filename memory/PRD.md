# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS (interaktiv)
- Backend: FastAPI, Motor (MongoDB), emergentintegrations, CoinGecko API, httpx, yfinance

## Production Status: LAUNCH-READY (55+ Services)

### All Features
- **Zahlung & Finanzen**: Wallet, QR, P2P, Karten, Krypto (CoinGecko live), Budget, Kredit, BNPL, Geschenkkarten
- **Aktien & ETFs**: 24 Assets (Yahoo Finance Live), Portfolio, Watchlist, Kauf/Verkauf via Wallet
- **Mobilitaet**: Taxi (interaktive Mapbox Karte, regionale Preise DE/KS/AE), Scooter (65 Scooter in Berlin+Prishtina), Mietwagen, Fluege, Pakete, Ladesaeulen, Gebrauchtwagen, Umzug
- **Buchung**: Hotels, Events, Restaurants, Termine, Reiseplaner, Versicherungen (Seed)
- **Marktplaetze**: Immobilien, Freelancer, Jobs+CV, Handwerker, Reinigung, Marktplatz, Auktionen
- **Lifestyle**: Streaming, Dating, Fitness, Telemedizin, Tierbetreuung
- **Gaming**: Lucky Slots, Plinko (Ball-Animation), Wuerfel, Muenzwurf, Gluecksrad, Rubbellos, Hoeher/Tiefer, Minenfeld, Memory, Quiz — ALLE mit korrekter Coin-Abzugs/Gutschrift-Logik
- **Familie**: Kids App (GPS Mapbox auf Eltern-Uebersicht + Detail), Kids Kontrolle, Social, KI-Assistent
- **Business**: Haendler-Portal, POS, VIP, Split Bill
- **System**: Notifications, Email Marketing Admin, Admin Panel (66+ Tiles), Dark/Light Mode

## Recent Fixes (2026-04-15)
- FIXED: Taxi Netzwerkfehler (nested pickup/dropoff, Multi-Vehicle Estimates)
- FIXED: Taxi regionale Preise (DE=1.20€/km, KS=0.50€/km, AE=0.90€/km)
- FIXED: Taxi interaktive Mapbox GL JS Karte (ersetzt statisches Bild)
- FIXED: Stocks API NaN/Infinity abgefangen, 24 Assets fehlerfrei
- FIXED: Kids GPS auf Eltern-Uebersichtskarten (Mini-Karte + Adresse + Batterie)
- FIXED: Gaming Coins-Bug — ALLE Spiele rufen jetzt API bei jedem Spin/Zug auf (Verlust wird abgezogen)
- FIXED: Plinko Ball-Animation (Ball faellt durch Pegs, visuelles Feedback)
- ADDED: 15 Scooter in Prishtina geseedet (Skanderbeg, Newborn, Germia Park, etc.)

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
- P3: Scooter-Freischaltung fuer Kollegen/Freunde (Sharing-Feature)
