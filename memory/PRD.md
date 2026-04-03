# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, and growth/referral systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, Shadcn UI
- Backend: FastAPI, MongoDB (Motor), slowapi
- Payments: Stripe (system test key `sk_test_emergent`)
- Auth: JWT-based (HttpOnly cookies)
- i18n: 12 languages (en, de, sq, tr, fr, es, it, pt, nl, pl, ru, ar)

## Architecture
- `/app/frontend/src/pages/` — Page components (Home, Wallet, Scanner, Admin, More, Support, Activity, Kids)
- `/app/frontend/src/store/` — Context providers (Auth, I18n, Network, Wallet, FeatureFlag)
- `/app/frontend/src/components/` — Shared components (LanguageSwitcher, FeatureGate, BottomNav, etc.)
- `/app/frontend/src/services/api.js` — API client
- `/app/backend/routes/` — FastAPI route modules (auth, payment, stripe, admin, kids, etc.)
- `/app/backend/core/` — Core modules (audit, compliance, rate_limit, security, feature_flags)

## What's Been Implemented

### Core Features
- JWT Auth with admin/customer/merchant roles
- Rate limiting (slowapi) on all critical endpoints
- Audit logging wired into all backend flows
- Compliance monitoring (velocity, limits, KYC) wired into payment/top-up flows
- Stripe top-up flow
- Merchant barcode scanner payment flow with idempotency
- Frontend offline detection (NetworkContext)
- API error resilience (ErrorState, interceptors)
- 12-language i18n (100% coverage)
- Support Center / Help Page (FAQ, search, contact form)
- Activity Feed UI (transaction history, stats, filters)

### Soft-Launch System (2026-04-03)
- **Feature Flags Backend**: `core/feature_flags.py` with MongoDB-backed flag config
- **Public API**: `GET /api/feature-flags` — returns simplified flags for frontend
- **Admin API**: `GET/PUT /api/admin/feature-flags/{name}` — full CRUD for admin
- **FeatureFlagContext**: Frontend context that loads flags and provides `isEnabled(flag, role)`
- **FeatureGate Component**: Renders "Coming Soon" premium screen for disabled features
- **Integrated**: Support, Activity, Kids, and Referral pages wrapped with FeatureGate
- **10 Feature Flags**: onboarding, merchant_payouts, admin_tools, referral, promotions, support_center, activity_feed, kids, scanner, export

### Global Language Switcher (2026-04-03)
- **LanguageSwitcher Component**: Globe icon + current lang code in header
- **Dropdown**: 12 languages shown in their own language (Deutsch, English, Shqip, etc.)
- **Persistence**: localStorage (`bidblitz_lang`)
- **Instant Switch**: No page reload required
- **Location**: HomePage header, top right

### BidBlitz Kids Paywall (2026-04-03)
- **Pricing**: Monthly 4.99 EUR, Yearly 49.99 EUR (Best Value highlighted)
- **Free Trial**: 7-day trial available for new users
- **Backend**: `routes/kids.py` — subscription status, trial start, Stripe checkout, verify
- **Frontend**: `KidsPaywall.jsx` — benefits display, plan selector, Stripe redirect
- **DB Collections**: `kids_subscriptions`, `kids_checkout_sessions`
- **States**: none, trial, active, expired, canceled
- **Stripe Integration**: Uses emergentintegrations StripeCheckout for payment sessions

## Backlog
### P1
- Onboarding Welcome Flow UI
- Admin Feature Flags Management UI (currently API-only, no dedicated UI page)

### P2
- User Streaks/Milestones tracking
- Merchant Performance Insights UI
- BidBlitz Kids actual child account management (post-subscription)

## Known Mocks
- Support contact form is frontend-only (no backend POST endpoint)
- Stripe checkout creates real sessions but uses test key
