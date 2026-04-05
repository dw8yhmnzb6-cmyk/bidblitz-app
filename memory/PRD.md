# BidBlitz V2 — Product Requirements Document

## Vision
Ultra-premium fintech web app (year 2040 design) for payments, penny auctions, wallet management, and merchant POS systems.

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
- **Admin Fee Editor UI**: New admin tab "Händler-Gebühren" with editable % per method, save to DB
- Reports: daily/monthly, method breakdown, shift management, refunds
- Merchant Landing Page: 10 sections, auth modal, 13-language switcher
- Pricing: 3 plans, 3 terminals, fee comparison

## Key API Endpoints
- POST /api/payments/barcode-pay, /api/payments/nfc-pay
- GET /api/payments/terminal-summary, /api/payments/fee-info, /api/payments/pricing
- GET/POST /api/payments/admin/fees — Admin fee configuration
- POST /api/payments/onboarding/request-trial
- GET /api/merchant-hierarchy/reports/daily, /reports/monthly
- POST /api/merchant-hierarchy/shifts, /refund

## Upcoming Tasks (P1)
- 2FA (Email OTP / Google Authenticator)
- Kids Wallet with real transactions
- Apple Pay / Google Pay

## Backlog (P2)
- Receipt download/print (PDF)
- Real Web NFC API integration
- Taxi, Scooter, Food integrations
- Chat/Support system
- Developer SDK docs

## Credentials
- See /app/memory/test_credentials.md
