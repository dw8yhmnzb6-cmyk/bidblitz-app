# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe
- **Languages**: 12 (EN, DE, SQ, TR, FR, ES, IT, PT, NL, PL, RU, AR)

## Core Architecture
- `/app/frontend/src/` — React SPA with context-based state management
- `/app/backend/` — FastAPI with MongoDB, routes under `/api`
- `/app/scripts/` — Cron-based backup & monitoring scripts

## What's Been Implemented

### Core Features (Complete)
- Full JWT authentication (login/register with invite codes)
- Wallet: balance, top-up (Stripe), send money, QR barcode
- Merchant dashboard: earnings, payments, payouts, weekly chart
- Admin dashboard: platform management, soft-launch controls
- 12-language i18n support, Kids dashboard with paywall
- Notifications, activity feed, referral system
- Export tools, Feature flags & gating, Premium card display
- Transaction history with filters

### Soft Launch Features (Complete)
- Invite-only gates, admin whitelist, invite codes (standard + MRC-)
- Soft launch dashboard, DB backups & monitoring cron jobs
- Admin alerts, user feedback, 15 users + 3 merchants seeded

### Public Browsing, Auth Gating & Guest Experience (Complete)
- Homepage publicly accessible to guests
- Balance/data masked for unauthenticated visitors
- AuthGateOverlay + GuestCTABar for auth-gated flows
- Try Demo mode with mock data on Wallet/Merchant/More pages
- Clear CTA buttons (Login/Register/Demo) in header + hero + inner pages
- Onboarding hint (dismissible, localStorage-persisted, 12 languages)
- Improved guest homepage: products, benefits, trust sections

### Conversion Tracking (Complete — April 4, 2026)
**Backend:**
- `POST /api/analytics/track` — Public event ingestion endpoint (no auth required)
- `GET /api/analytics/conversions?days=N` — Admin-only conversion dashboard
- Events stored in `conversion_events` collection, daily rollups in `conversion_metrics`
- Server-side tracking for `register_complete` (in auth.py) and `first_payment` (in payment.py)

**Frontend:**
- `/app/frontend/src/services/tracker.js` — Lightweight fire-and-forget tracker using `sendBeacon` with fetch fallback
- Session-based dedup (`fireOnce`) and permanent dedup (`fireOnceEver`)
- Tracked events:
  - `guest_visit` — on homepage load (once/session)
  - `guest_register_click` — every register CTA click with source
  - `register_complete` — server-side on successful registration (once ever)
  - `first_payment` — server-side on first payment completion (once ever)
  - `feature_click` — on product/service card click with feature name
  - `demo_start` / `demo_exit` — demo mode lifecycle
  - `cta_click` — login/register button clicks with page context
  - `page_view` — on every navigation
- Conversion funnel: guest → register rate, register → first payment rate
- Top features report: ranked by click count

**Data model:**
- `conversion_events`: `{event, session_id, meta, day, ts, user_id, ip}`
- `conversion_metrics`: `{day, event, count, updated_at}` (upserted daily)

## Key Files
- `/app/frontend/src/App.js` — Routing, tracking wiring
- `/app/frontend/src/services/tracker.js` — Frontend event tracker
- `/app/frontend/src/pages/HomePage.jsx` — Guest homepage with tracking
- `/app/backend/routes/analytics.py` — Conversion tracking endpoints
- `/app/backend/routes/auth.py` — Server-side register_complete tracking
- `/app/backend/routes/payment.py` — Server-side first_payment tracking
- `/app/frontend/src/models/homeTranslations.js` — Guest translations (12 lang)

## Backlog (P2/P3 — Not Started)
- Push notifications (WebPush)
- KYC upgrade flow
- User Streaks/Milestones tracking
- Saved payment methods (Apple Pay, Google Pay)
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
