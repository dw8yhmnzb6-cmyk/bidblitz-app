# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)
- Payments: Stripe (proxy), JWT Auth (cookies)
- Maps: Mapbox GL JS (dark-v11)
- AI: GPT-4o-mini via Emergent LLM Key
- i18n: 15 Sprachen

## Production Status: LAUNCH-READY

### All Features (Complete)

#### Finance Core
- Wallet (EUR), POS, P2P Transfers, Stripe Integration
- Credit Score, Premium Finance (Split Bill, Virtual Cards, Savings, BNPL, Gift Cards, Bills)
- **NEW: AI Financial Assistant (BlitzBot)** — GPT-4o-mini powered, analyzes real transactions
- **NEW: Crypto Wallet** — BTC/ETH/USDT/BNB/SOL/XRP, Buy/Sell via EUR wallet, Portfolio tracking
- **NEW: Budget Planner** — 8 categories, limits, expense tracking, 6-month trend chart

#### Commerce & Marketplace
- Auctions (20 products), Merchant System, Marketplace, NFC Pay, VIP

#### Mobility
- Car Rental (full module), Mapbox Live Map
- Taxi/Scooter/Food: Hidden (re-enable when vendors register)

#### Gaming & Rewards
- 11 Games, Coin Economy (100 coins = €1), Global Cashback Engine
- Mining (BLZ tokens), Loyalty Levels, Referral System

#### Platform
- Admin Panel, Support Chat, Kids GPS, KYC/Verification
- i18n: 15 Languages, Feature Gates, Audit Logs

## New Backend Routes (2026-04-12)
- `/api/ai-assistant/chat` — GPT-4o-mini chat with wallet context
- `/api/ai-assistant/history` — Chat history
- `/api/crypto/prices` — Live crypto prices
- `/api/crypto/portfolio` — User holdings
- `/api/crypto/trade` — Buy/sell crypto via wallet
- `/api/crypto/transactions` — Trade history
- `/api/budget/overview` — Monthly spending by category
- `/api/budget/limits` — Set category limits
- `/api/budget/expense` — Add manual expense
- `/api/budget/trends` — 6-month spending trends

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!

## Pending
- P1: i18n remaining pages (Car Rental 16, Premium Finance 6)
- P2: Real-time crypto prices via WebSocket/CoinGecko API
- Backlog: Insurance, Appointments, Social Feed
