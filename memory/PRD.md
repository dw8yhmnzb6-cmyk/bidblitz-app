# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB)
- Production: IONOS Server, PM2, Nginx, MongoDB Atlas

## Production Status: LAUNCH-READY (140+ Services, 63+ Revenue Streams)

## Multi-Mode System (Implemented 2026-04-16)
- Personal / Kids / Merchant mode switching
- ModeSwitcher dropdown in header
- Mode-aware BottomNav
- Auto-switch on navigation
- Backend modes array

## Kids Payment System (2026-04-16)
- **Stripe Checkout**: `/api/kids/create-checkout` (needs valid sk_test_ or sk_live_ key)
- **Wallet Payment**: `/api/kids/pay-with-wallet` (deducts from BidBlitz wallet balance)
- Both options shown on paywall UI
- Current Stripe key (`mk_1TIDedI8nRp2RQgs9b1rSrWg`) is invalid for Stripe API
- Wallet payment fully working and tested

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!

## Backlog
- P1: Get valid Stripe key (sk_test_ or sk_live_) for card payments
- P1: Digital Products Marketplace
- P1: Run seed script on production MongoDB Atlas
- P2: App.js Code Splitting
- P2: Server Security
