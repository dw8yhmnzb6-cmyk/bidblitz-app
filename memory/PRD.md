# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2 with Revolut-level payment flows, Stripe top-ups, QR payments, Admin/Merchant dashboards, 12-language support, user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, qrcode.react
- Backend: FastAPI, MongoDB (Motor), slowapi, Stripe SDK
- Auth: JWT with HttpOnly cookies, brute-force lockout

## What's Implemented

### Core Infrastructure (DONE)
- JWT Auth with register/login/logout/refresh, brute-force lockout
- MongoDB with Motor async driver
- Rate limiting on all sensitive endpoints
- CORS, global error handling, offline detection

### Payments (DONE)
- Wallet top-up via Stripe checkout (6 packages)
- Customer → Merchant payments with compliance checks
- Peer-to-peer send with fees
- Merchant barcode scan payment with idempotency
- Dynamic QR code (HMAC-based, 5-min rotation)
- Merchant payouts with admin approval pipeline
- Platform fee engine (configurable)
- Promotions wired into all payment flows (cashback, reduced_fee, bonus_topup)
- Float precision fixed: all balance returns use round(value, 2)

### System/Security (DONE)
- Audit logging (17 event types, MongoDB-backed)
- Compliance engine (KYC tiers, velocity detection, payout risk)
- Feature flags (10 flags, MongoDB-backed, CRUD, FeatureGate component)
- Session management

### UI/UX (DONE)
- 12-language i18n (en, de, sq, tr, fr, es, it, pt, nl, pl, ru, ar)
- Global LanguageSwitcher in header + settings
- Premium dark theme (#030303, glass-morphism, Framer Motion)
- Offline detection with toast
- Role-aware bottom navigation

### Profile & Account (DONE)
- Profile editing, password change, settings persistence
- All labels in 12 languages

### Support Center (DONE)
- FAQ accordion, contact form, admin ticket management
- All labels in 12 languages

### Kids Feature (DONE)
- Stripe subscription paywall with trial
- Post-subscription dashboard with child profiles

### Admin Dashboard (DONE)
- Overview stats, Users, Merchants, Payouts, Transactions
- Feature Flags, Audit logs, Compliance, Growth Analytics, Promotions, Config
- N+1 query optimization (aggregation pipelines for users/merchants)

### Growth Features (DONE)
- Referral system, notifications, export (14 CSV + 3 JSON)

### Settings Sub-pages (DONE)
- Privacy, Active Sessions

### Production Readiness (DONE - Apr 2026)
- P0 merchant-scan bug fixed (balance rounding + merchant name)
- N+1 admin query optimization (users + merchants)
- Production frontend build (1.4MB, sourcemaps disabled)
- All critical flows verified: login, wallet, send, merchant-scan, admin

## Not Implemented (Backlog)
- Taxi, Scooter, Food, Auctions (placeholder cards only)
- Onboarding welcome flow
- User streaks/milestones
- Merchant performance insights
- Push notifications (WebPush)
- KYC upgrade flow
- Saved payment methods (Apple Pay, Google Pay)

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Merchant: haendler@bidblitz.com / BidBlitz2026!
