# BidBlitz V2 — Product Requirements Document

## Vision
Ultra-premium fintech web app (year 2040 design) for payments, penny auctions, crypto mining, wallet management, and merchant POS systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, ShadCN/UI
- Backend: FastAPI, MongoDB (Motor), JWT Auth
- Payments: Stripe / Stripe Connect
- Design: Dark glassmorphism, cyan/gold glow accents

## Core Features (COMPLETED)
- JWT Auth, Wallet with Stripe, Live penny auction system
- 13-language support, Influencer payouts, Gamified Rewards
- Role requests, Identity verification
- Complete Merchant Hierarchy, Barcode/QR/NFC payment flows

## POS & Payment System (COMPLETED)
- POS Terminal, NFC Payments, Admin Fee Config, Reports
- Merchant Landing Page, Pricing, Shift mgmt, Refunds

## Auction Bot Admin (COMPLETED)
- Admin bot control, auto-bidding loop, target price, 30 bot names

## Crypto Mining Module (COMPLETED - Enhanced 2026-04-05)
- **Dashboard**: BLZ balance, hashrate, daily/total earnings, claim streak, referral boost indicator
- **Daily Rewards**: Claim system with abuse prevention (1/day), streak tracking
- **Claim History API**: Full history with streak count
- **Wallet Tab**: BLZ→EUR conversion, send BLZ, transaction history with **Today/All filter** and **colored type badges** (Claim, Referral, Purchase, Upgrade, Withdraw, Send, Receive)
- **Package Comparison Table**: Side-by-side comparison of all 5 packages (Price, TH/s, Daily EUR, ROI days, Yearly EUR) with "BEST" badge on Elite Station
- **Purchase Flow**: Select Package → Confirmation Modal (shows Hashrate, Efficiency, Daily/Yearly Earnings, Total Price) → Confirm → Success Animation ("Miner Activated!") → Auto-dismiss
- **Miner Shop**: 5 tiers (Starter €49 → Quantum €9,999) with realistic ROI (41-116 days)
- **Upgrade System**: Power & Efficiency (10 levels each)
- **VIP Levels**: Bronze→Diamond with mining bonuses (0-15%)
- **Referral System**: Unique codes, 5% bonus, boost indicator
- **Admin Reward Logs**: GET /api/mining/admin/reward-logs

## Home Screen (COMPLETED 2026-04-05)
- "Available Now" (Wallet, Auctions, Mining, Merchant) + "Coming Soon" sections
- Feature preview: tap → description + "Coming Soon" message

### Mining API Endpoints
- GET /api/mining/dashboard, /packages, /upgrade-costs, /vip-levels, /claim-history, /transactions
- GET /api/mining/admin/reward-logs
- POST /api/mining/buy-miner, /upgrade, /claim-daily, /withdraw, /send, /apply-referral

## Upcoming Tasks
- Mining Phase 2: Marketplace, Card, Launchpad (P1)
- Receipt PDF-Export (P1)
- 2FA Integration (P1), Kids Wallet (P1)

## Backlog (P2)
- Apple/Google Pay, Developer SDK, Chat/Support

## Credentials
- See /app/memory/test_credentials.md
