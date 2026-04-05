# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with an ultra-premium futuristic 2040 dark glassmorphism design.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe (checkout + saved methods + 1-click), Barcode/QR, NFC
- **Languages**: 12 (EN, DE, SQ, TR, FR, ES, IT, PT, NL, PL, RU, AR)

## Implemented Features

### Core: Auth, Wallet, Admin, QR, i18n, Kids, Notifications, Referral, Export, Feature Flags

### Penny Auction: CRUD, bidding, auto-bid, dual timer, Final Battle, credit packages

### Stripe Connect: Express merchant accounts, earnings tracking

### Influencer System: Commission as bid_credits (Reward Balance), admin-configurable

### Investor Page: Landing page + contact form

### Rewards: Daily login, streak (Day 1-7), comeback bonus, milestones, notifications

### Role Request & Admin: Registration role selector, admin approve/reject

### Identity Verification: ID front/back + selfie upload, admin review

### Merchant Hierarchy: Main Account → Branches → Staff → Registers/POS, 0.5-3% commission

### Merchant Dashboard (9 tabs): Overview, Branches, Summary, Registers, Transactions, Commission, API Keys, Staff, Revenue

### Payment System (Complete — April 5, 2026)

**Customer Barcode Payment:**
- Dynamic QR/barcode per user, auto-refreshes every 2 minutes
- Barcode format: `BLZ-XXXXXXXXXXXXXXXX`
- Time-based security: barcode invalidated after single use + expiry
- Backend: `GET /api/payments/my-barcode`, `POST /api/payments/refresh-barcode`

**Merchant Payment Terminal:**
- 4-step flow: Enter Amount → Scan Barcode → Confirm → Done
- Quick amount buttons (5, 10, 15, 20, 25, 50)
- Barcode lookup shows customer name before confirming
- One-tap confirm, payment in seconds
- Backend: `POST /api/payments/barcode-lookup`, `POST /api/payments/barcode-pay`

**NFC Payment Strategy:**
- Wallet NFC: 0.3% fee (lowest, encourages wallet)
- Barcode/QR: 0.5% fee (low)
- Card NFC: 2.5% fee (standard)
- Backend: `POST /api/payments/nfc-pay`, `GET /api/payments/fee-info`

**Web-Based Credit Purchase:**
- "Buy Credits" buttons (10, 25, 50, 100, 250, 500 EUR)
- Opens Stripe checkout session
- Redirects back after payment
- Wallet auto-syncs

**Frontend Pages:**
- `PaymentPage.jsx` — Customer barcode display, timer, wallet top-up, fee info
- `MerchantTerminalPage.jsx` — 4-step payment terminal flow

## Key Files
- Backend: `routes/pos_payments.py`, `routes/merchant_hierarchy.py`, `routes/rewards.py`, `routes/verification.py`, `routes/role_requests.py`, `routes/stripe.py`
- Frontend: `pages/PaymentPage.jsx`, `pages/MerchantTerminalPage.jsx`, `pages/MerchantDashboardPage.jsx`, `pages/RewardsPage.jsx`, `pages/VerificationPage.jsx`

## Backlog (P1)
- 2FA Integration (Email OTP / Google Authenticator)
- Kids Wallet with real transactions
- Apple Pay / Google Pay
- Push Notifications (WebPush)

## Backlog (P2)
- Taxi, Scooter, Food integrations
- Chat/Support system

## Credentials
- See `/app/memory/test_credentials.md`
