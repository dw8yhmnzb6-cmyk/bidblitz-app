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

### Child Accounts (Complete)
- Backend CRUD (`/api/kids/children`), frontend persistent child management
- Add/select/remove children, weekly limit slider, progress bars

## Key Files
- `/app/backend/routes/stripe.py` — Stripe checkout + saved methods + 1-click
- `/app/frontend/src/components/TopUpModal.jsx` — Top-up modal with 1-click UI
- `/app/frontend/src/services/api.js` — API service
- `/app/backend/routes/kids.py` — Child accounts
- `/app/backend/routes/analytics.py` — Conversion tracking
- `/app/frontend/src/services/tracker.js` — Frontend event tracker
- `/app/frontend/src/pages/HomePage.jsx` — Guest homepage

## Backlog (P2/P3 — Not Started)
- Push notifications (WebPush)
- KYC upgrade flow
- User Streaks/Milestones tracking
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
