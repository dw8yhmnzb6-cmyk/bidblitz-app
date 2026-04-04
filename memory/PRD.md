# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, and growth/referral systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, Shadcn UI, qrcode.react
- Backend: FastAPI, MongoDB (Motor), slowapi
- Payments: Stripe (system test key `sk_test_emergent`)
- Auth: JWT-based (HttpOnly cookies)
- i18n: 12 languages (en, de, sq, tr, fr, es, it, pt, nl, pl, ru, ar)

## Architecture
- `/app/frontend/src/pages/` — Page components
- `/app/frontend/src/store/` — Context providers (Auth, I18n, Network, Wallet, FeatureFlag)
- `/app/frontend/src/components/` — Shared components (LanguageSwitcher, FeatureGate, BarcodeModal, etc.)
- `/app/frontend/src/services/api.js` — API client
- `/app/backend/routes/` — FastAPI route modules
- `/app/backend/core/` — Core modules (audit, compliance, rate_limit, security, feature_flags)

## What's Been Implemented

### Core Features
- JWT Auth with admin/customer/merchant roles
- Rate limiting, audit logging, compliance monitoring
- Stripe top-up flow
- Merchant barcode scanner payment flow with idempotency
- Frontend offline detection, API error resilience
- 12-language i18n (100% coverage)
- Support Center, Activity Feed, Referral System, Notifications

### Dynamic QR Code Payment (2026-04-04)
- **QR Code** replaces old linear barcode (uses qrcode.react QRCodeSVG)
- **Rotates every 5 minutes** with HMAC-based time tokens
- **Countdown timer** with progress bar shows time until next rotation
- **Auto-refresh** when timer expires
- **Customer Scan button** opens QR modal (not merchant scanner)
- **Merchant Scan button** opens scanner page (role-based routing)
- **Backend validation** accepts both old static and new dynamic QR format
- **Format**: `BLZ-XXXXXXXXXXXX-XXXXXXXX` (base + rotating token)

### Soft-Launch / Feature Flags System
- 10 Feature flags with MongoDB-backed config
- Public + Admin APIs, FeatureGate component
- "Coming Soon" premium screen for disabled features

### Global Language Switcher
- Globe icon in header, dropdown with 12 languages
- Instant switch, localStorage persistence

### BidBlitz Kids Paywall
- Monthly 4.99 EUR / Yearly 49.99 EUR + 7-day trial
- Stripe checkout integration, subscription status tracking

## Backlog
### P1
- Onboarding Welcome Flow UI
- Admin Feature Flags Management UI

### P2
- User Streaks/Milestones
- Merchant Performance Insights UI
- Kids child account management post-subscription

## Known Info
- Stripe uses system test key (`sk_test_emergent`) — shows "Sandbox4" in checkout
- Support contact form is frontend-only
