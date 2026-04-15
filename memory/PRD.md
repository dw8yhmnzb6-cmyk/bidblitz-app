# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS (interaktiv)
- Backend: FastAPI, Motor (MongoDB), emergentintegrations, CoinGecko API, httpx, yfinance

## Production Status: LAUNCH-READY (55+ Services)

### All Features
- **Zahlung & Finanzen**: Wallet, QR, P2P, Karten, Krypto (CoinGecko live), Budget, Kredit, BNPL, Geschenkkarten
- **Aktien & ETFs**: 24 Assets (Yahoo Finance Live), Portfolio, Watchlist, Kauf/Verkauf via Wallet
- **Mobilitaet**: Taxi (interaktive Mapbox Karte, regionale Preise DE/KS/AE), Scooter (65 Scooter Berlin+Prishtina, **Sharing-Feature**), Mietwagen, Fluege, Pakete, Ladesaeulen, Gebrauchtwagen, Umzug
- **Buchung**: Hotels, Events, Restaurants, Termine, Reiseplaner, Versicherungen (Seed)
- **Marktplaetze**: Immobilien, Freelancer, Jobs+CV, Handwerker, Reinigung, Marktplatz, Auktionen
- **Lifestyle**: Streaming, Dating, Fitness, Telemedizin, Tierbetreuung
- **Gaming**: Slots, Plinko, Wuerfel, Muenzwurf, Gluecksrad, Rubbellos, Hoeher/Tiefer, Minenfeld, Memory, Quiz — ALLE mit korrekter Coin-Logik
- **Familie**: Kids App (GPS mit exakter Strassenadresse via Reverse Geocoding, Mini-Karte auf Eltern-Uebersicht), Kids Kontrolle
- **Business**: Haendler-Portal, POS, VIP, Split Bill
- **System**: Notifications, Email Marketing Admin, Admin Panel (66+ Tiles), Dark/Light Mode

## Recent Fixes (2026-04-15)
- ADDED: Scooter-Sharing Feature (Code generieren, teilen, einloesen)
- ADDED: 15 Scooter in Prishtina geseedet
- FIXED: Kids GPS zeigt jetzt exakte Strassenadressen (Mapbox Reverse Geocoding)
- FIXED: Kids Karten Mobile-Buttons kompakter (nur Icons)
- FIXED: Taxi regionale Preise (DE/KS/AE automatisch erkannt)
- FIXED: Taxi interaktive Mapbox GL JS Karte
- FIXED: Gaming Coins-Bug in ALLEN Spielen behoben
- FIXED: Plinko Ball-Animation
- FIXED: Stocks API NaN/Infinity

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!

## Backlog
- P1: Apple Pay / Google Pay (Stripe Integration)
- P2: i18n Module (Albanisch/Deutsch Mixup)
- P2: Push Notifications Frontend-UI
- P3: App.js Route-Block refactoring
