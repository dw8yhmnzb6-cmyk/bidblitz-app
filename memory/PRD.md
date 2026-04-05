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
- Clear CTAs (Login/Register/Demo), Onboarding hint, Guest homepage sections (products/benefits/trust)
- Conversion tracking (event ingestion, funnel metrics, feature click tracking)

### Saved Payment Methods & 1-Click Top-Up (Complete — April 5, 2026)
**Backend (stripe.py):**
- Checkout sessions now create/reuse Stripe Customer with `setup_future_usage: off_session`
- After successful checkout, payment method details (brand, last4, exp) saved to user document
- `GET /api/stripe/saved-method` — returns saved card info
- `POST /api/stripe/quick-topup` — charges saved payment method off-session (1-click)
- `DELETE /api/stripe/saved-method` — removes saved payment method
- Card declined → auto-removes saved method, forces new checkout

**Frontend (TopUpModal.jsx):**
- On open, fetches saved payment method
- If saved: shows card (brand + last4 + expiry + "Gespeichert" badge) with "Bestätigen & Bezahlen €X" button
- "Neue Zahlungsmethode wählen" fallback → standard Stripe checkout
- "Gespeicherte Karte verwenden" link to switch back
- i18n: `topup.confirm_pay`, `topup.saved`, `topup.new_method`, `topup.use_saved`, `topup.expires` in all 12 languages

**Data model (users collection):**
- `stripe_customer_id`, `stripe_pm_id`, `stripe_card_brand`, `stripe_card_last4`, `stripe_card_exp_month`, `stripe_card_exp_year`, `stripe_pm_saved_at`

### KYC Flow (Complete — April 5, 2026)
**Backend (profile.py):**
- `GET /api/user/kyc` — returns KYC status and data
- `POST /api/user/kyc` — submit KYC data (full_name, date_of_birth, street, city, postal_code, country)
- Validates age (>=16), stores status as `pending`
- Audit logging on submission

**Frontend (MorePage.jsx → KYCView):**
- Accessible via "Sicherheit" menu in Account section
- Status badge: Not Submitted (grey) / Pending (yellow) / Verified (green) / Rejected (red)
- Form: Full Name, Date of Birth, Street, Postal Code, City, Country
- Pre-fills data if already submitted, allows re-submission
- i18n: `kyc.*` keys in EN + DE

**Data model (users collection → `kyc` subdocument):**
- `{full_name, date_of_birth, street, city, postal_code, country, status, submitted_at, reviewed_at}`
- `kyc_level` field on user: `basic` / `pending` / `verified`

### Penny Auction System (Complete — April 5, 2026)
**Backend (routes/auctions.py):**
- `GET /api/auctions` — list all auctions (auto-ends expired ones)
- `GET /api/auctions/{auction_id}` — auction detail + last 30 bids
- `POST /api/auctions/bid` — place bid (costs 1 credit, +€0.01, extends timer +10s)
- `POST /api/auctions/buy-credits` — buy bid credits with wallet balance (4 packages: 10/25/50/100)
- `GET /api/auctions/credits/balance` — user's credit balance
- `POST /api/auctions/admin/create` — admin creates auctions
- Auto-seeds 4 demo auctions (iPhone, PS5, AirPods, Galaxy Watch)

**Frontend (pages/AuctionsPage.jsx):**
- Auction list with live countdown timers (polling every 2.5s/5s)
- Auction detail: price ticker, timer, animated bid button, live bid history
- Buy Credits modal with 4 packages
- "How it works" section
- Accessible from Homepage via purple "BidBlitz Auktionen" banner
- Route: `/auctions`
- i18n: `auction.*` keys in EN + DE

**Data model:**
- `auctions` collection: `{auction_id, title, description, retail_price, current_price, ends_at, status, winner_id, total_bids, ...}`
- `auction_bids` collection: `{bid_id, auction_id, user_id, user_name, bid_price, created_at}`
- `users.bid_credits`: integer credit balance

**Credit packages:**
- 10 credits = €5, 25 credits = €10, 50 credits = €18, 100 credits = €30

### Child Accounts (Complete)
- Backend CRUD (`/api/kids/children`), frontend persistent child management
- Add/select/remove children, weekly limit slider, progress bars

## Key Files
- `/app/backend/routes/stripe.py` — Stripe checkout + saved methods + 1-click
- `/app/backend/routes/auctions.py` — Penny auction system
- `/app/backend/routes/profile.py` — User profile + KYC
- `/app/frontend/src/pages/AuctionsPage.jsx` — Auction UI
- `/app/frontend/src/components/TopUpModal.jsx` — Top-up modal with 1-click UI
- `/app/frontend/src/services/api.js` — API service
- `/app/backend/routes/kids.py` — Child accounts
- `/app/backend/routes/analytics.py` — Conversion tracking
- `/app/frontend/src/services/tracker.js` — Frontend event tracker
- `/app/frontend/src/pages/HomePage.jsx` — Guest homepage

## Backlog (P0/P1 — Phase 1)
- Saved Cards Management Seite (P0 — UI to view/delete saved cards)
- Stripe Connect for Merchant Payouts (P0)
- Email Notifications — Resend/SendGrid (P0)
- Push Notifications — WebPush (P1)
- 2FA Integration (P1)
- Kids Wallet System with real transactions (P1)

## Backlog (P2/P3 — Not Started)
- Apple Pay / Google Pay
- User Streaks/Milestones tracking
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
