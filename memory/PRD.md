# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2 with Revolut-level payment flows, Stripe top-ups, QR payments, Admin/Merchant dashboards, 12-language support, user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, qrcode.react
- Backend: FastAPI, MongoDB (Motor), slowapi, Stripe SDK
- Auth: JWT with HttpOnly cookies, brute-force lockout

## What's Implemented

### Core (DONE)
- JWT Auth, MongoDB, Rate limiting, CORS, offline detection
- Wallet top-up (Stripe), Merchant payments, P2P send, QR scan, Payouts
- Audit logging, Compliance engine, Feature flags, Session management
- 12-language i18n, Premium dark UI, Framer Motion
- Admin Dashboard (full), Profile, Support, Kids, Growth/Referral, Settings, Export
- All balance returns use round(value, 2)

### Backups & Monitoring (DONE - Apr 2026)
- Daily MongoDB backup (cron 2AM UTC), 7-day retention
- Rotating error/access logs, uptime monitor every 5 min
- Enhanced /api health check

### Admin Alerts (DONE - Apr 2026)
- Auto notifications on: payment_failed, send_failed, topup_failed, payout_cancelled, suspicious_activity, login_locked, system_error

### Soft Launch Mode (DONE - Apr 2026)
- Invite-only gate, admin whitelist, toggle on/off
- Live dashboard: payments, failures, volume, tickets, logins, users, alerts

### First Users & Merchants Onboarded (DONE - Apr 2026)
- 15 test users created and funded (EUR 15-50 each)
- 3 merchants onboarded: Boulangerie Paris, Pizzeria Roma, TechShop Berlin
- 10 real merchant payments executed (EUR 1.50-12.99)
- 5 P2P sends executed
- All whitelisted in soft launch
- Platform stats: 54 users, 159 transactions, EUR 631 volume, EUR 15.77 revenue
- 0 backend errors, monitoring active

## Not Implemented (Backlog)
- Taxi, Scooter, Food, Auctions (placeholder cards)
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
- 15 launch users + 3 merchants: Launch2026! (see test_credentials.md)
