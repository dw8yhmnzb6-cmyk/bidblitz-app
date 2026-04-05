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
- 12-language support (I18nContext)
- Influencer/Commission payout system (wallet credits)
- Gamified Rewards (daily login, streaks, milestones, comeback bonus)
- Role request system + admin approval
- Identity verification (ID front/back/selfie) for Influencer, Manager, Investor, Merchant
- Complete Merchant Hierarchy: branches, staff, cash registers, API keys, live revenue
- Barcode/QR payment flow (customer → merchant)
- NFC payment strategy + tap-to-pay foundation

## New Features (COMPLETED — April 5, 2026)
### Merchant Onboarding Strategy
- Onboarding page targeting small businesses: free 30-day trial, live demo, benefit highlights
- Low fees (0.3% NFC wallet), fast payments (<2s), customer growth (100K+ users)
- Business registration form with trial auto-creation
- Backend: POST `/api/payments/onboarding/request-trial`

### Redesigned POS Terminal Interface
- Large numeric amount display with EUR prefix
- Full numeric keypad (0-9, dot, delete, clear)
- Scan, QR, and NFC payment method buttons
- "ZAHLUNG STARTEN" (Start Payment) big CTA
- Online/offline indicator in header
- Daily revenue summary dropdown
- Fullscreen/kiosk mode toggle
- BidBlitz POS branding with "SECURE PAYMENT TERMINAL"
- Ultra-fast badge for amounts < 25 EUR
- PIN required badge for amounts > 50 EUR
- Success screen with full receipt

### NFC Payment System
- Merchant enters amount → customer taps phone/card
- Detects payment type: BidBlitz Wallet (0.3%), Card/Contactless (2.5%)
- NFC ready screen with animated pulse
- Wallet deduction for app users, card processing for non-app users
- Receipt generation with all payment details

### Payment Type Detection
- 7 payment methods: wallet, barcode, nfc_wallet, nfc_card, apple_pay, google_pay, card
- Fee rates: 0.3% (NFC wallet), 0.5% (barcode/wallet), 2.5% (card/contactless/Apple/Google Pay)
- Payment type shown in receipt and transaction history

### Merchant Pricing & Terminal Business Model
- 3 plans: Starter (Free), Professional (29/mo), Enterprise (99/mo)
- Terminal hardware: Tablet Stand Kit (149 EUR), Terminal Rental (19/mo), Terminal Purchase (399 EUR)
- Complete fee structure display
- Terminal features: tablet stand, NFC, scanner, WiFi+4G, security, kiosk mode
- Backend: GET `/api/payments/pricing`

### Merchant Reports & Shifts
- Daily reports: total revenue, fees, net, transaction count, avg transaction, method breakdown
- Monthly reports: daily breakdown, method breakdown, best day
- Shift management: open/close shifts, shift history, per-shift totals
- New Dashboard tabs: Berichte (Reports), Schichten (Shifts), Rückerstattungen (Refunds)
- Backend: GET `/api/merchant-hierarchy/reports/daily`, `/reports/monthly`, POST `/shifts`

### Refund System
- Refund with mandatory reason (min 3 chars)
- Wallet refund to customer if original was wallet payment
- Merchant total revenue adjusted
- Transaction marked as refunded with timestamp
- Backend: POST `/api/merchant-hierarchy/refund`, GET `/refunds`

## Key API Endpoints
- `POST /api/auth/login` — JWT login
- `POST /api/payments/barcode-pay` — Barcode payment
- `POST /api/payments/nfc-pay` — NFC payment (with type detection)
- `GET /api/payments/terminal-summary` — Terminal daily summary
- `GET /api/payments/fee-info` — Fee structure
- `GET /api/payments/pricing` — Plans, terminals, fees
- `POST /api/payments/onboarding/request-trial` — Merchant trial signup
- `GET /api/merchant-hierarchy/reports/daily` — Daily report
- `GET /api/merchant-hierarchy/reports/monthly` — Monthly report
- `POST /api/merchant-hierarchy/shifts` — Open/close shift
- `POST /api/merchant-hierarchy/refund` — Process refund
- `GET /api/merchant-hierarchy/refunds` — Get refund history

## Upcoming Tasks (P1)
- 2FA (Email OTP / Google Authenticator)
- Kids Wallet with real transactions
- Apple Pay / Google Pay real integration

## Backlog (P2)
- Taxi, Scooter, Food integrations
- Chat/Support system
- User milestones expansion
- Developer SDK/POS plugin documentation

## Credentials
- See `/app/memory/test_credentials.md`
