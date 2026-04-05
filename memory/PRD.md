# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with an ultra-premium futuristic 2040 dark glassmorphism design.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe (checkout + saved payment methods + 1-click)
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
- Category filters, product catalog (13 items)

### Engagement Features (Complete)
- One-click checkout, low credits popup, discount badges
- Watchlist, bid streak, outbid/win notifications, referral sharing

### Stripe Connect (Complete)
- Express accounts, onboarding, earnings tracking

### Influencer System (Complete)
- Multi-level commission tracking (influencer + manager override)
- Commission payouts as **bid_credits (Reward Balance)** — no real money
- Credits auto-added to influencer/manager wallet
- Admin-configurable rates, bonus campaigns

### Investor Page (Complete)
- Landing page with investment pitch, contact form

### Rewards System (Complete — April 5, 2026)
- Daily login reward with streak tracking (Day 1-7: 1→2→3→4→5→7→10 credits)
- Comeback bonus (3 credits after 2+ missed days)
- Milestones: First Top-Up (5), First Bid (3), First Win (10), First Invite (5)
- Reward notifications, total earned tracking
- Backend: `/api/rewards/status`, `/api/rewards/daily-claim`, `/api/rewards/milestone/{id}`

### Role Request & Admin Approval System (Complete — April 5, 2026)
- Registration with role selector (Customer, Merchant, Influencer, Manager, Investor)
- Admin tab "Rollen" with approve/reject and status filters
- Backend: `/api/role-requests/request`, `/api/role-requests/admin/decide`

### Identity Verification System (Complete — April 5, 2026)
- Upload ID front, ID back, selfie with ID
- Status tracking: pending → approved/rejected
- Admin review tab with document image preview
- Only required for: merchant, influencer, manager, investor
- Normal customers exempt
- Backend: `/api/verification/upload`, `/api/verification/admin/decide`
- Frontend: `VerificationPage.jsx` with upload form + status display

### Merchant Hierarchy System (Complete — April 5, 2026)
**Structure**: Main Merchant → Branches → Staff → Registers/POS
- Branch CRUD with address, city, country, contact person
- Register/POS device management with API keys
- Staff management with roles (merchant_owner, branch_admin, cashier, staff)
- Commission system: 0.5%–3% per merchant (admin-configurable)
- POS payment processing via API key (`X-API-Key` header)
- Auto fee calculation and revenue tracking

**Access Control:**
- Merchant owner: sees all branches, revenue, staff, registers
- Branch admin: sees only own branch
- Cashier: sees only assigned register

**Live Revenue View:**
- Revenue per register, branch, and total
- Transaction count, latest transactions
- Online/offline status per register
- Auto-refresh every 10 seconds

**Backend Endpoints:**
- `POST /api/merchant-hierarchy/admin/create-merchant`
- `POST /api/merchant-hierarchy/admin/set-commission`
- `POST /api/merchant-hierarchy/branches` (CRUD)
- `POST /api/merchant-hierarchy/registers` (CRUD + toggle + regen key)
- `POST /api/merchant-hierarchy/staff` (add/remove)
- `POST /api/merchant-hierarchy/api/process-payment` (POS API)
- `GET /api/merchant-hierarchy/revenue` (scoped by access level)

**Frontend: `MerchantDashboardPage.jsx`**
- 5 tabs: Übersicht, Filialen, Kassen, Mitarbeiter, Umsatz
- Branch creation form, register management with API key visibility
- Staff assignment with role selector
- Live revenue with auto-refresh

## Key Files
- `/app/backend/routes/rewards.py`, `/app/backend/routes/role_requests.py`
- `/app/backend/routes/verification.py`, `/app/backend/routes/merchant_hierarchy.py`
- `/app/backend/routes/influencer.py`, `/app/backend/routes/investor.py`
- `/app/frontend/src/pages/RewardsPage.jsx`, `/app/frontend/src/pages/VerificationPage.jsx`
- `/app/frontend/src/pages/MerchantDashboardPage.jsx`, `/app/frontend/src/pages/AdminPage.jsx`
- `/app/frontend/src/pages/MorePage.jsx`, `/app/frontend/src/services/api.js`

## Backlog (P1)
- 2FA Integration (Email OTP / Google Authenticator)
- Kids Wallet with real transactions
- Apple Pay / Google Pay
- Push Notifications (WebPush)

## Backlog (P2)
- Taxi, Scooter, Food integrations
- Chat/Support system
- Achievements display

## Credentials
- See `/app/memory/test_credentials.md`
