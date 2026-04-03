# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, and growth/referral systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, Shadcn UI
- Backend: FastAPI, MongoDB (Motor), slowapi
- Payments: Stripe (system test key `sk_test_emergent`)
- Auth: JWT-based
- i18n: 12 languages (en, de, sq, tr, fr, es, it, pt, nl, pl, ru, ar)

## Architecture
- `/app/frontend/src/pages/` — All page components
- `/app/frontend/src/store/` — Context providers (Auth, I18n, Network, Wallet)
- `/app/frontend/src/services/api.js` — API client
- `/app/backend/routes/` — FastAPI route modules
- `/app/backend/core/` — audit, compliance, rate_limit, security

## What's Been Implemented
- JWT Auth with admin/customer/merchant roles
- Rate limiting (slowapi) on all critical endpoints
- Audit logging wired into all backend flows
- Compliance monitoring (velocity, limits, KYC) wired into payment/top-up flows
- Stripe top-up flow
- Merchant barcode scanner payment flow with idempotency
- Frontend offline detection (NetworkContext)
- API error resilience (ErrorState, interceptors)
- 12-language i18n (100% coverage)
- HomePage with services grid
- WalletPage with balance & transactions
- AdminPage with audit logs & compliance flags
- MorePage with settings, referral, notifications
- **Support Center / Help Page** (FAQ with search, categories, accordion, contact form) — DONE 2026-04-03
- **Activity Feed UI** (transaction history, stats, filters, date grouping) — DONE 2026-04-03

## Completed Tasks (Recent)
- [x] Support Center UI (SupportPage.jsx) — 12 FAQ items across 4 categories, search, contact form
- [x] Activity Feed UI (ActivityPage.jsx) — Stats bar, 5 filter types, date-grouped transactions, refresh
- [x] All new strings translated into 12 languages in I18nContext.jsx
- [x] Fixed I18nContext locale/setLocale aliasing in MorePage

## Backlog
### P1
- Onboarding Welcome Flow UI (welcome screen, progress checklist, empty-state guidance)

### P2
- User Streaks/Milestones tracking
- Merchant Performance Insights UI (backend analytics exist, UI pending)

## Test Accounts
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / BidBlitz2026!
- Merchant: haendler@bidblitz.com / BidBlitz2026!

## Known Mocks
- Support contact form is frontend-only (no backend POST endpoint)
