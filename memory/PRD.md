# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with an ultra-premium futuristic 2040 dark glassmorphism design.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe (checkout + saved payment methods + 1-click), Web-based wallet top-up
- **Languages**: 12 (EN, DE, SQ, TR, FR, ES, IT, PT, NL, PL, RU, AR)

## Implemented Features

### Core (Complete)
- Full JWT auth, Wallet, Merchant & Admin dashboards, QR payments
- 12-language i18n, Kids dashboard with paywall
- Notifications, activity feed, referral system
- Export tools, Feature flags, Premium card, Transactions

### Penny Auction System (Complete)
- Full auction CRUD, bidding, auto-bid, daily rewards, credit packages
- Dual timer system with Final Battle mechanics (20s reset)

### Engagement Features (Complete)
- One-click checkout, low credits popup, discount badges, watchlist, bid streak

### Stripe Connect (Complete)
- Express accounts, onboarding, earnings tracking

### Influencer System (Complete)
- Commission payouts as bid_credits (Reward Balance), admin-configurable

### Investor Page (Complete)
- Landing page + contact form

### Rewards System (Complete)
- Daily login reward, streak (Day 1-7), comeback bonus, milestones, notifications

### Role Request & Admin Approval (Complete)
- Registration role selector, admin approve/reject, status filters

### Identity Verification (Complete)
- Upload ID front/back + selfie, admin review with image preview

### Merchant Hierarchy System (Complete)
- Main Merchant → Branches → Staff → Registers/POS
- Staff roles: merchant_owner, branch_admin, cashier, staff
- Commission system 0.5%–3% per merchant

### Register Transaction View (Complete — April 5, 2026)
- Transactions per register with date filter: Today/Week/Month/All
- Shows amount, time, status, total per filter
- Register dropdown filter, access scoped by role
- Backend: `GET /api/merchant-hierarchy/register-transactions`

### Branch Summary View (Complete — April 5, 2026)
- All branch totals with revenue, payment count, active registers
- Visual comparison with animated progress bars
- Backend: `GET /api/merchant-hierarchy/branch-summary`

### Merchant Commission View (Complete — April 5, 2026)
- Commission % per merchant, earned per register and branch
- Total commission breakdown
- Backend: `GET /api/merchant-hierarchy/commission-summary`

### API Key Management (Complete — April 5, 2026)
- Full CRUD for API keys per register
- Show/hide, copy, regenerate actions
- Enable/disable API key (toggle register status)
- Last activity timestamp, transaction count, revenue per key
- Linked to register and branch
- Backend: `GET /api/merchant-hierarchy/api-keys`

### Web-Based Payments (Complete — April 5, 2026)
- Payments happen on website via Stripe checkout
- App uses wallet balance for in-app actions
- Wallet redirect for top-up
- Balance sync after payment
- Backend: `GET /api/merchant-hierarchy/wallet-balance`

## Key Files
- Backend: `routes/merchant_hierarchy.py`, `routes/rewards.py`, `routes/verification.py`, `routes/role_requests.py`
- Frontend: `pages/MerchantDashboardPage.jsx` (9 tabs), `pages/RewardsPage.jsx`, `pages/VerificationPage.jsx`
- Services: `services/api.js`, `store/I18nContext.jsx`

## Merchant Dashboard Tabs
1. **Übersicht** — Revenue/Fees/Net cards, register status, recent transactions
2. **Filialen** — Branch CRUD, address/city/country
3. **Übersicht (Summary)** — Branch comparison with animated bars
4. **Kassen** — Register CRUD with API keys
5. **Transaktionen** — Date-filtered (Today/Week/Month/All), register filter
6. **Provision** — Commission rate, breakdown by branch and register
7. **API Schlüssel** — Full key management with show/copy/regenerate
8. **Mitarbeiter** — Staff CRUD with role assignment
9. **Umsatz** — Live revenue with auto-refresh

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
