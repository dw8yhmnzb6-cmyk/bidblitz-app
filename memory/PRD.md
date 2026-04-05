# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe (checkout + saved payment methods + 1-click)
- **Languages**: 12 (EN, DE, SQ, TR, FR, ES, IT, PT, NL, PL, RU, AR)

## What's Been Implemented

### Core Features (Complete)
- Full JWT auth, Wallet, Merchant & Admin dashboards, QR payments
- 12-language i18n, Kids dashboard with paywall + child accounts
- Notifications, activity feed, referral system
- Export tools, Feature flags, Premium card, Transaction history

### Soft Launch (Complete)
- Invite codes, whitelist, dashboard metrics, backups, monitoring, alerts

### Public Browsing & Guest Experience (Complete)
- Homepage public, auth-gated actions, Try Demo mode
- Clear CTAs (Login/Register/Demo), Onboarding hint, Guest homepage sections
- Conversion tracking (event ingestion, funnel metrics, feature click tracking)

### Saved Payment Methods & 1-Click Top-Up (Complete)
- Checkout sessions create/reuse Stripe Customer with setup_future_usage
- Saved card info, quick-topup, delete method endpoints
- Card declined auto-removes saved method

### KYC Flow (Complete)
- Submit/view KYC data, validate age (>=16), status tracking

### Penny Auction System (Complete)
- Full auction CRUD, bidding, auto-bid, daily rewards, credit packages
- Ultra-premium dark glassmorphism design
- Category filters, product catalog (13 items)

### Engagement Features (Complete)
- Watchlist, Bid Streak, Outbid/Win notifications, Referral system
- One-Click Checkout, Low Credits Popup, Discount badges

### Dual Timer + Final Battle System (Complete)
- 2-3 day auctions, final battle in last 60s, 20s reset per bid

### Stripe Connect for Merchant Payouts (Complete)
- Express accounts, onboarding, earnings tracking

### Email Notifications (Complete)
- Outbid/win/new auction alerts (log-based + Resend-ready)

### Influencer System (Complete — April 5, 2026)
- Multi-level commission tracking (influencer + manager override)
- Commission payouts as **bid_credits (Reward Balance)** — no real money
- Credits auto-added to influencer/manager wallet on each purchase
- Admin-configurable rates, bonus campaigns
- Influencer Dashboard: reward balance, referral stats, linked influencers
- Backend: `/api/influencer/me`, `/api/influencer/admin/*`
- Frontend: `InfluencerPage.jsx` with "Reward Balance" labels

### Investor Page (Complete — April 5, 2026)
- Landing page with investment pitch (Penny Auction model, payment system, growth engine, scalability)
- Contact form for potential investors
- Backend: `POST /api/investor/contact`, `GET /api/investor/contacts` (admin)
- Frontend: `InvestorPage.jsx` with glassmorphism design

### Rewards System (Complete — April 5, 2026)
**Backend (routes/rewards.py):**
- `GET /api/rewards/status` — streak, daily availability, milestones, total earned
- `POST /api/rewards/daily-claim` — claim daily reward with streak tracking
- `POST /api/rewards/milestone/{id}` — claim completed milestone
- `GET /api/rewards/notifications` — reward notifications
- `POST /api/rewards/notifications/read` — mark read

**Streak System:**
- Day 1-7 increasing rewards: 1, 2, 3, 4, 5, 7, 10 credits
- Reset if user misses a day
- Visual 7-day progress bar

**Comeback Bonus:**
- 3 bonus credits if user returns after 2+ missed days
- Welcome back message

**Milestones:**
- First Top-Up: 5 credits
- First Bid: 3 credits
- First Win: 10 credits
- First Invite: 5 credits

**Frontend (pages/RewardsPage.jsx):**
- Total earned / balance display
- Daily claim button with streak tracking
- 7-day visual streak progress
- Milestone cards with claim buttons
- Reward notifications panel
- Full DE + EN translations

### Role Request & Admin Approval System (Complete — April 5, 2026)
**Registration Flow:**
- Users can select requested role: Customer, Merchant, Influencer, Manager, Investor
- Default active role = user/customer
- Selected role saved as `requested_role` with `approval_status = pending`

**Backend (routes/role_requests.py):**
- `POST /api/role-requests/request` — request role upgrade
- `GET /api/role-requests/my-status` — user's role request status
- `GET /api/role-requests/admin/list` — admin list requests (with status filter)
- `POST /api/role-requests/admin/decide` — approve/reject
- `POST /api/role-requests/admin/change-role` — direct role change

**Admin Dashboard:**
- "Rollen" tab with Pending/Approved/Rejected/All filters
- Approve/Reject buttons per request
- Shows user name, email, current role → requested role

**Frontend:**
- Role selector dropdown in registration form
- "Role requires admin approval" hint for non-customer roles

### Navigation (Complete — April 5, 2026)
- MorePage.jsx: Added Rewards, Influencer, Investor menu items in Growth section
- All pages accessible via More menu navigation

## Key Files
- `/app/backend/routes/rewards.py` — Rewards system
- `/app/backend/routes/role_requests.py` — Role request system
- `/app/backend/routes/influencer.py` — Influencer system (credits-based)
- `/app/backend/routes/investor.py` — Investor contact
- `/app/backend/routes/auctions.py` — Penny auction system
- `/app/backend/routes/stripe.py` — Stripe checkout + saved methods
- `/app/frontend/src/pages/RewardsPage.jsx` — Rewards UI
- `/app/frontend/src/pages/InfluencerPage.jsx` — Influencer dashboard
- `/app/frontend/src/pages/InvestorPage.jsx` — Investor landing
- `/app/frontend/src/pages/MorePage.jsx` — Navigation hub
- `/app/frontend/src/pages/AdminPage.jsx` — Admin with Roles tab
- `/app/frontend/src/pages/AuthPage.jsx` — Auth with role selector
- `/app/frontend/src/services/api.js` — API service
- `/app/frontend/src/store/I18nContext.jsx` — Translations

## Backlog (P1)
- 2FA Integration (Email OTP or Google Authenticator)
- Kids Wallet System with real transactions
- Apple Pay / Google Pay
- Push Notifications (WebPush)

## Backlog (P2/P3)
- User Streaks/Milestones achievements display
- Taxi, Scooter, Food features
- Chat/Support system

## Credentials
- See `/app/memory/test_credentials.md`
