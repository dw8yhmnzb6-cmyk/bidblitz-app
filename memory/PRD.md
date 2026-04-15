# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), CoinGecko, httpx, yfinance

## Production Status: LAUNCH-READY (60+ Services)

### All Features
- **Zahlung & Finanzen**: Wallet, QR, P2P, Karten, Krypto (CoinGecko), Budget, Kredit, BNPL, Geschenkkarten
- **Aktien & ETFs**: 24 Assets (Yahoo Finance Live), Portfolio, Watchlist
- **Mobilitaet**: Taxi (interaktive Karte, regionale Preise DE/KS/AE), Scooter (65+ Berlin+Prishtina, Sharing), Mietwagen, Fluege, Pakete, Ladesaeulen, Gebrauchtwagen, Umzug
- **NEU: Reselling Marketplace**: Sneakers, Streetwear, Gaming — 8% Provision, 16 Listings geseedet
- **NEU: BlitzJobs**: Micro-Jobs (Lieferung, Nachhilfe, Putzen) — 15% Service-Gebuehr, 12 Jobs geseedet
- **NEU: Cashback Shopping**: 20 Partner-Shops (Amazon, Nike, Zalando) — 2-8% Cashback
- **Buchung**: Hotels, Events, Restaurants, Termine, Reiseplaner, Versicherungen
- **Gaming**: Slots, Plinko, Wuerfel, Muenzwurf, Gluecksrad, Rubbellos, Minenfeld — ALLE mit korrekter Coin-Logik
- **Familie**: Kids App (GPS mit exakter Strassenadresse, Mini-Karte)
- **Business**: Haendler-Portal, POS, VIP, Split Bill
- **System**: Rollenbasiertes Menu (Kunde/Haendler/Fahrer/Admin), Notifications, Admin Panel

## Rollenbasiertes Menu (NEU)
- **Kunde**: Sieht Reselling, BlitzJobs, Cashback, Kids, Gaming — KEINE Haendler-Features
- **Haendler**: Sieht Dashboard, Terminal, Bezahlen, Tarife — KEINE Kunden-Features
- **Fahrer**: Sieht zugewiesene Fahrten
- **Admin**: Sieht ALLES

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!

## Backlog
- P1: Apple Pay / Google Pay (Stripe)
- P2: i18n Module (Albanisch/Deutsch Mixup)
- P2: Push Notifications Frontend-UI
- P3: App.js Route-Refactoring
