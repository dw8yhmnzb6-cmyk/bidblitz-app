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
- Admin alerts on critical events
- Soft launch mode (whitelist gate, live dashboard)
- 15 users + 3 merchants onboarded, real payments flowing
- Feedback collection system
- Invite code system (generate, validate, redeem, deactivate)

### Invite Code System (DONE - Apr 2026)
- Registration requires valid invite code during soft launch
- Admin generates codes: `POST /api/admin/invite-codes` (count, max_uses, label)
- Admin lists codes: `GET /api/admin/invite-codes` (with usage stats)
- Admin deactivates: `PUT /api/admin/invite-codes/{code}/deactivate`
- Register with code: `POST /api/auth/register` with `invite_code` field
- Codes stored in MongoDB `invite_codes` collection
- Supports single-use and multi-use codes
- All paths tested: valid, no code, used, invalid, deactivated → all correct

## User Feedback (23 responses, avg 3.7/5)
### Prioritized Issues
- P0: Compliance block messages unclear
- P1: No onboarding tutorial, no merchant refunds, QR code too small
- P2: Payout auto-approve, animation performance, home page length
- P3: Apple Pay/Google Pay, merchant daily summary, receipt duration

## Backlog
- Taxi, Scooter, Food, Auctions (placeholder cards)
- Onboarding welcome flow, User streaks, Merchant insights
- Push notifications, KYC upgrade, Saved payment methods

## Test Credentials
- See /app/memory/test_credentials.md for full list
