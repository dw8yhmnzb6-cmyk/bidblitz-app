# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (MongoDB)
- Payments: Stripe (proxy), JWT Auth (cookies)
- i18n: 15 Sprachen (DE, EN, TR, FR, ES, IT, PT, NL, PL, RU, AR + Varianten)

## Production Status: LAUNCH-READY

### Completed Features

#### Core Platform
- Wallet, POS, Auctions (20 products), Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module: 16+ pages, CRUD, PDFs, disputes, staff, reports)
- Premium Finance (Split Bill, Virtual Cards, Savings, BNPL, Gift Cards, Bills)
- Support Chat, Credit Score, Referral System, Kids GPS

#### Production Readiness (2026-04-12)
- Fake/demo data removed (scooters, restaurants, taxi drivers)
- Broken features hidden (Taxi, Scooter, Food — removed from menus)
- "Coming Soon" eliminated — only real features shown
- Wallet enforcement: all actions go through wallet balance check
- Coins/Cashback Engine globally connected:
  - payment.py → process_loyalty_rewards (2 coins/€1, 1% cashback)
  - p2p transfer → process_loyalty_rewards (1 coin/€1)
  - stripe topup → process_loyalty_rewards (1 coin/€1, 0.5% cashback)
  - car_rental booking → process_loyalty_rewards (3 coins/€1, 2% cashback)
  - marketplace purchase → process_loyalty_rewards (2 coins/€1, 2% cashback)
- i18n: Gaming, MorePage menus, Car Rental, Premium Finance translated (12 languages)
- Merchant system: real registration, listings, payments, revenue tracking

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!

## Coin System
- 100 coins = 1€
- Earned on: payments, transfers, topups, car rentals, marketplace
- Redeemable: wallet, VIP, boosts, marketplace
- Levels: Bronze → Silver → Gold → Platinum (multiplier 1x-2x)

## Pending/Future
- P1: Map integration (Mapbox) for real-time vehicle/location display
- P2: AI Financial Assistant (GPT-based)
- P2: Crypto Wallet (BTC/ETH/USDT)
- P2: Budget Planner
- Backlog: Insurance Marketplace, Appointment Booking, Social Feed
- Backlog: Taxi/Scooter/Food re-enable when real vendors register
