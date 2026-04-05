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
- 12-language support (I18nContext) with language switcher
- Influencer/Commission payout system (wallet credits)
- Gamified Rewards (daily login, streaks, milestones, comeback bonus)
- Role request system + admin approval
- Identity verification (ID front/back/selfie)
- Complete Merchant Hierarchy: branches, staff, cash registers, API keys, live revenue
- Barcode/QR payment flow
- NFC payment strategy

## POS & Payment System (COMPLETED — April 5, 2026)
### POS Terminal
- Large numeric amount display + numeric keypad
- Scan/QR/NFC payment method buttons
- Ultra-fast badge (<25€), PIN required badge (>50€)
- Online/offline indicator, fullscreen/kiosk mode
- BidBlitz POS branding
- Success screen with full receipt

### NFC Payment System
- Merchant enters amount → NFC ready screen
- Payment type detection: Wallet (0.3%), Card/Contactless (2.5%)
- Daily revenue + last transactions shown on NFC screen
- Receipt generation with payment type

### Admin-Configurable Fees
- Admin GET/POST `/api/payments/admin/fees`
- 7 payment methods: wallet, barcode, nfc_wallet, nfc_card, apple_pay, google_pay, card
- DB-stored rates, fallback to defaults

### Merchant Reports
- Daily reports: revenue, fees, net, method breakdown, hourly breakdown
- Monthly reports: daily breakdown, best day, avg transaction
- Shift management: open/close, per-shift totals, history
- New Dashboard tabs: Reports, Shifts, Refunds

### Refund System
- Refund with mandatory reason
- Customer wallet refund for wallet payments
- Merchant total adjusted

## Merchant Landing Page (COMPLETED — April 5, 2026)
### Route: `/merchant-landing`
Full sales-ready landing page for merchant onboarding:
1. **Hero** — Headlines, 3 CTA buttons (Register, Login, Demo)
2. **Benefits** — 7 benefit cards (fast payments, low fees, QR, barcode, NFC, tracking, branches)
3. **How It Works** — 5 steps (register, approval, branch, register/API, accept)
4. **Payment Methods** — 5 methods with fee rates
5. **Features** — 8 merchant tools
6. **Pricing** — 3 plans (Starter/Professional/Enterprise) + fee comparison
7. **Trust** — 5 trust indicators
8. **CTA** — Register/Login buttons
9. **Auth Modal** — Login/Register with toggle, merchant role request
10. **Language Switcher** — All 13 app languages in sticky header
- Full DE/EN translations (fallback to EN if missing)
- Dark premium design, glassmorphism, animations
- No bottom nav (standalone landing page)

### Merchant Pricing
- Starter (Free): 0.5% wallet, 1 branch, 2 registers
- Professional (29/mo): 0.3% NFC, 2.5% card, 5 branches, API access
- Enterprise (99/mo): Unlimited, custom fees, dedicated terminal, SDK
- Terminal hardware: Tablet Stand (149€), Rental (19/mo), Purchase (399€)

## Key API Endpoints
- `POST /api/auth/login` — JWT login
- `POST /api/payments/barcode-pay` — Barcode payment
- `POST /api/payments/nfc-pay` — NFC payment (with type detection)
- `GET /api/payments/terminal-summary` — Terminal daily summary
- `GET /api/payments/fee-info` — Fee structure
- `GET /api/payments/pricing` — Plans, terminals, fees
- `GET/POST /api/payments/admin/fees` — Admin fee config
- `POST /api/payments/onboarding/request-trial` — Merchant trial
- `GET /api/merchant-hierarchy/reports/daily` — Daily report
- `GET /api/merchant-hierarchy/reports/monthly` — Monthly report
- `POST /api/merchant-hierarchy/shifts` — Open/close shift
- `POST /api/merchant-hierarchy/refund` — Process refund

## Upcoming Tasks (P1)
- 2FA (Email OTP / Google Authenticator)
- Kids Wallet with real transactions
- Apple Pay / Google Pay real integration

## Backlog (P2)
- Taxi, Scooter, Food integrations
- Chat/Support system
- Developer SDK/POS plugin documentation
- User milestones expansion

## Credentials
- See `/app/memory/test_credentials.md`
