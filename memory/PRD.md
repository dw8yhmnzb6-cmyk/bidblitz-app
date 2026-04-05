# BidBlitz V2 — Product Requirements Document

## Vision
Ultra-premium fintech web app (year 2040 design) for payments, penny auctions, crypto mining, wallet management, and merchant POS systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, ShadCN/UI
- Backend: FastAPI, MongoDB (Motor), JWT Auth
- Payments: Stripe / Stripe Connect
- Design: Dark glassmorphism, cyan/gold glow accents

## Core Features (COMPLETED)
- JWT Auth with email/password (admin seeding)
- Wallet system with Stripe top-up (checkout redirect)
- Live dual-timer penny auction system
- 13-language support (I18nContext) with language switcher
- Influencer/Commission payout system (wallet credits)
- Gamified Rewards (daily login, streaks, milestones, comeback bonus)
- Role request system + admin approval
- Identity verification (ID front/back/selfie)
- Complete Merchant Hierarchy: branches, staff, cash registers, API keys, live revenue
- Barcode/QR payment flow
- NFC payment strategy

## POS & Payment System (COMPLETED)
- POS Terminal: numeric keypad, scan/QR/NFC, ultra-fast, fullscreen/kiosk, receipts
- NFC Payments: type detection (wallet 0.3% vs card 2.5%), daily revenue + last txns
- Admin Fee Config: DB-configurable, 7 methods, GET/POST admin endpoints
- Admin Fee Editor UI: New admin tab with editable % per method, save to DB
- Reports: daily/monthly, method breakdown, shift management, refunds
- Merchant Landing Page: 10 sections, auth modal, 13-language switcher
- Pricing: 3 plans, 3 terminals, fee comparison

## Auction Bot Admin System (COMPLETED - 2026-04-05)
- Admin "Auktionen" tab with full bot control
- Bot auto-bidding background loop (asyncio) with random timing
- Target price system with revenue calculation
- 30 unique bot names for realistic simulation

## Crypto Mining Module (COMPLETED - 2026-04-05)
- **Mining Dashboard**: BLZ balance, EUR value, hashrate, daily earnings, active rigs count
- **Daily Rewards**: Claim daily mining earnings based on hashrate & efficiency
- **Wallet**: BLZ balance display, BLZ→EUR conversion (withdraw), send BLZ to users
- **Miner Shop**: 5 tiers (Starter €49, Pro €199, Elite €699, Titan €2,999, Quantum €9,999)
- **Upgrade System**: Power (10 levels, +10% hashrate each) & Efficiency (10 levels, +1% each)
- **VIP Levels**: Bronze/Silver/Gold/Platinum/Diamond with mining bonuses (0-15%)
- **Referral System**: Unique BLZ-XXXX codes, 5% of referral's mining rewards
- **Transaction History**: Full activity log (purchases, claims, sends, upgrades)
- Route: `/mining` accessible from MEHR menu
- Backend: `/app/backend/routes/mining.py`
- Frontend: `/app/frontend/src/pages/MiningPage.jsx`

### Mining API Endpoints
- GET /api/mining/dashboard — Full dashboard data
- GET /api/mining/packages — Miner packages list
- GET /api/mining/upgrade-costs — Upgrade cost tables
- GET /api/mining/vip-levels — VIP level requirements
- GET /api/mining/transactions — Transaction history
- POST /api/mining/buy-miner — Purchase a miner
- POST /api/mining/upgrade — Upgrade power or efficiency
- POST /api/mining/claim-daily — Claim daily mining reward
- POST /api/mining/withdraw — Convert BLZ to EUR
- POST /api/mining/send — Send BLZ to another user
- POST /api/mining/apply-referral — Apply referral code

## Key API Endpoints (Other)
- POST /api/payments/barcode-pay, /api/payments/nfc-pay
- GET /api/payments/terminal-summary, /api/payments/fee-info, /api/payments/pricing
- GET/POST /api/payments/admin/fees
- GET /api/auctions/admin/list
- POST /api/auctions/admin/bot-config

## Upcoming Tasks
- Mining Phase 2: Marketplace, Card, Launchpad (P1)
- Receipt download/print PDF-Export (P1)
- 2FA (Email OTP / Google Authenticator) (P1)
- Kids Wallet with real transactions (P1)

## Backlog (P2)
- Apple Pay / Google Pay
- Developer SDK docs
- Chat/Support system
- Real Web NFC API integration

## Credentials
- See /app/memory/test_credentials.md
