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
- Barcode/QR payment flow, NFC payment strategy

## POS & Payment System (COMPLETED)
- POS Terminal, NFC Payments, Admin Fee Config
- Reports, Merchant Landing Page, Pricing

## Auction Bot Admin System (COMPLETED)
- Admin bot control, auto-bidding loop, target price, 30 bot names

## Crypto Mining Module (COMPLETED - Enhanced 2026-04-05)
- **Mining Dashboard**: BLZ balance, EUR value, hashrate, daily/total earnings, active rigs
- **Daily Rewards**: Claim system with abuse prevention (1 claim/day), streak tracking
- **Claim History**: Full history endpoint with streak count and total claimed
- **Wallet**: BLZ→EUR conversion, send BLZ to users, transaction history
- **Miner Shop**: 5 tiers (Starter→Quantum), ROI calculation
- **Upgrade System**: Power & Efficiency (10 levels each)
- **VIP Levels**: Bronze→Diamond with mining bonuses (0-15%)
- **Referral System**: Unique codes, 5% bonus, referral boost indicator in dashboard
- **Referral Boost Display**: Shows active boost with daily bonus amount
- **Reward Logging**: All claims logged in mining_claims + mining_transactions collections
- **Admin Reward Logs**: GET /api/mining/admin/reward-logs

## Home Screen (ENHANCED 2026-04-05)
- **"Available Now" Section**: Wallet (large card), Auctions, Mining, Merchant - all clickable
- **"Coming Soon" Section**: NFC Pay, VIP, Referrals, Apple/Google Pay, Marketplace, More Rewards
- **Coming Soon Badge**: Yellow "BALD/UPCOMING" label
- **Feature Preview**: Tap any coming-soon card → expands to show description + "We're building this"
- **All cards use premium dark glassmorphism design**

### Mining API Endpoints
- GET /api/mining/dashboard — Full dashboard with streak + referral boost
- GET /api/mining/packages, /upgrade-costs, /vip-levels
- GET /api/mining/claim-history — Full claim history with streak
- GET /api/mining/transactions
- GET /api/mining/admin/reward-logs — Admin: all reward logs
- POST /api/mining/buy-miner, /upgrade, /claim-daily
- POST /api/mining/withdraw, /send, /apply-referral

## Upcoming Tasks
- Mining Phase 2: Marketplace, Card, Launchpad (P1)
- Receipt PDF-Export (P1)
- 2FA Integration (P1)
- Kids Wallet (P1)

## Backlog (P2)
- Apple/Google Pay, Developer SDK, Chat/Support

## Credentials
- See /app/memory/test_credentials.md
