# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB)
- Payments: Stripe (proxy), JWT Auth (cookies)
- Maps: Mapbox GL JS (dark-v11 theme)
- i18n: 15 Sprachen

## Production Status: LAUNCH-READY

### Completed Features
- Wallet, POS, Auctions (20 products), Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module: 16+ pages, CRUD, PDFs, disputes, staff, reports)
- Premium Finance (Split Bill, Virtual Cards, Savings, BNPL, Gift Cards, Bills)
- Support Chat, Credit Score, Referral System, Kids GPS
- Mapbox GL Integration (dark-theme, user location, car markers, action sheets)
- Coins/Cashback globally connected (payments, transfers, topups, car rental, marketplace)
- Production cleanup (no fake data, broken features hidden, Coming Soon removed)

## Mapbox Integration (2026-04-12)
- MapboxMap component: `/app/frontend/src/components/MapboxMap.jsx`
- MobilityMapPage: `/app/frontend/src/pages/MobilityMapPage.jsx`
- Token: stored in frontend/.env as REACT_APP_MAPBOX_TOKEN
- Features: Dark theme, user GPS tracking, car rental markers, radius circle, popups, action sheets
- Route: `/mobility-map` accessible from MEHR > Live Map

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!

## Pending
- P1: i18n remaining pages (Car Rental 16, Premium Finance 6)
- P2: AI Financial Assistant, Crypto Wallet, Budget Planner
- Backlog: Insurance, Appointments, Social Feed, Taxi/Scooter/Food (when vendors register)
