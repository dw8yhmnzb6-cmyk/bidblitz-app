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
- Wallet top-up via Stripe checkout (6 packages €10–€500)
- Customer → Merchant payments with compliance checks
- Peer-to-peer send with fees
- Merchant barcode scan payment with idempotency
- Dynamic QR code (HMAC-based, 5-min rotation)
- Merchant payouts with admin approval pipeline
- Platform fee engine (configurable)
- **Promotions wired into all payment flows (Apr 2026)**:
  - Payment (pay): cashback promo — % of amount credited back after payment
  - Send: reduced_fee promo — % discount on send fee (up to 100% = free)
  - Merchant scan: cashback promo — same as pay, customer gets cashback
  - Topup (Stripe): bonus_topup promo — % bonus credited after top-up
  - Promo shown in UI: TopUp success screen (bonus badge), Scanner receipt (cashback row)
  - Per-user once, respects max_uses, date range, min_amount

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

### Profile & Account (DONE - Apr 2026)
- Profile editing: inline name edit with Edit/Save/Cancel flow
- Inline validation (empty name, too-short name)
- Premium success/error feedback (animated badges)
- Member Since from real backend created_at
- Account ID (truncated)
- Password change: current/new/confirm with labeled fields
- Inline validation (too short, mismatch)
- Friendly error messages (wrong password → localized)
- Auto-collapse on success
- Settings → Change Password navigates to Profile with form pre-opened
- Settings persistence: language, notifications, email notifications, biometric, dark mode → all saved to backend via PUT /api/user/profile
- Settings hydrated from backend on login/refresh via serialize_user → /api/auth/me
- Language synced: backend → I18n on login, I18n → backend on change in Settings
- localStorage fallback for language (I18nContext STORAGE_KEY)
- All profile/password/settings labels in all 12 languages

### Support Center (DONE - Apr 2026)
- FAQ accordion with i18n
- Contact form with category selector (General, Payments, Account, Security, Merchant), subject, optional reference/transaction ID, message
- Connected to backend POST /api/support/tickets — creates real stored tickets
- Success feedback with ticket ID, auto-reset after 4s
- Validation: subject + message required (localized warning)
- Admin ticket management: list, filter by status, resolve with response
- All labels in 12 languages

### Kids Feature (DONE)
- Stripe subscription paywall with trial
- Post-subscription dashboard with child profiles, spending limits

### Admin Dashboard (DONE)
- Overview stats, Users, Merchants, Payouts, Transactions, Settings
- Feature Flags toggle panel
- Audit log viewer
- Compliance dashboard (flags + checks)
- Growth analytics UI (overview, funnel, retention, campaigns)

### Growth Features (DONE)
- Referral system with codes, rewards, leaderboard
- Notifications (in-app CRUD + admin broadcast)
- Export (14 CSV endpoints + 3 JSON summaries)

## Partially Implemented
- Promotions: Backend CRUD exists but no user-facing promo UI
- Referral: Share link goes nowhere (no deep-link handling)
- Settings: Privacy, Active Sessions sub-pages don't exist

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
