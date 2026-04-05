# BidBlitz V2 — Product Requirements Document

## Vision
Ultra-premium fintech web app (year 2040 design) for payments, penny auctions, crypto mining, wallet management, and merchant POS systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, ShadCN/UI
- Backend: FastAPI, MongoDB (Motor), JWT Auth
- Payments: Stripe / Stripe Connect
- Design: Dark glassmorphism, cyan/gold glow accents

## Completed Features
- JWT Auth, Wallet with Stripe, Penny auctions, 13-language i18n
- Influencer payouts, Gamified Rewards, Role requests, Identity verification
- Merchant Hierarchy, Barcode/QR/NFC payment flows
- POS Terminal, Admin Fee Config, Reports, Merchant Landing Page
- Auction Bot Admin (auto-bidding, target price, 30 bot names)

## Crypto Mining Module (COMPLETED)
- Dashboard: BLZ balance, hashrate, daily/total earnings, claim streak, referral boost
- Daily Rewards: Claim with abuse prevention (1/day), streak tracking
- Wallet Tab: BLZ→EUR, send BLZ, history with Today/All filter + type badges
- Package Comparison Table: 5 packages side-by-side with BEST badge
- **Purchase Flow (FIXED 2026-04-05)**: Select → Confirmation Modal (shows balance in green/red) → Buy if affordable → Success Animation ("Miner Activated!" + new balance) → Auto-dismiss
- **Balance Validation**: Real-time check against user's EUR wallet, red warning + disabled button if insufficient, error message display in modal with retry
- Backend returns `main_balance_eur` in dashboard for accurate balance display
- Upgrade System, VIP Levels, Referral System all working

## Home Screen
- "Available Now" + "Coming Soon" feature sections
- Feature preview on tap

## Upcoming Tasks
- Mining Phase 2: Marketplace, Card, Launchpad (P1)
- Receipt PDF-Export (P1)
- 2FA Integration (P1), Kids Wallet (P1)

## Backlog (P2)
- Apple/Google Pay, Developer SDK, Chat/Support

## Credentials
- See /app/memory/test_credentials.md
