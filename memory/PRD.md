# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2 with Revolut-level payment flows, Stripe top-ups, QR payments, Admin/Merchant dashboards, 12-language support, user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, qrcode.react
- Backend: FastAPI, MongoDB (Motor), slowapi, Stripe SDK
- Auth: JWT with HttpOnly cookies, brute-force lockout

## What's Implemented (All DONE)
- JWT Auth, MongoDB, Rate limiting, CORS, offline detection
- Wallet top-up (Stripe), Merchant payments, P2P send, QR scan, Payouts
- Audit logging, Compliance engine, Feature flags, Session management
- 12-language i18n, Premium dark UI, Framer Motion
- Admin Dashboard (full), Profile, Support, Kids, Growth/Referral, Settings, Export
- All balance returns use round(value, 2)
- Backups (daily cron), Monitoring (5-min), Error/Access logging
- Admin alerts (payment_failed, send_failed, topup_failed, system_error, etc.)
- Soft launch mode (whitelist gate, live dashboard)
- 15 users + 3 merchants onboarded, real payments flowing
- Feedback collection system (POST/GET /api/feedback, admin review)

## User Feedback Summary (23 responses, avg 3.7/5)
### P0 — Critical
1. Compliance block messages unclear (no human-readable reason shown)
### P1 — High
2. No onboarding tutorial / barcode explanation
3. Merchant refunds not possible
4. QR code too small on mobile
### P2 — Medium
5. Payout auto-approve for small amounts
6. Animations stutter on old Android (prefers-reduced-motion)
7. Home page too long
### P3 — Feature Requests
8. Apple Pay / Google Pay
9. Daily merchant sales summary
10. Payment receipt display duration

## Backlog (not started)
- Taxi, Scooter, Food, Auctions (placeholder cards)
- User streaks/milestones
- Push notifications (WebPush)
- KYC upgrade flow

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Merchant: haendler@bidblitz.com / BidBlitz2026!
- 15 launch users + 3 merchants: Launch2026! (see test_credentials.md)
