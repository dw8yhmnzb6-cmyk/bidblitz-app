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
- Invite code system (user + merchant types)
- Feedback collection system
- 15 users + 4 merchants onboarded, real payments flowing

### Public Browsing (DONE - Apr 2026)
- Visitors can browse homepage without login (no forced auth)
- Guest sees: services, features, Taxi/Scooter/Food cards, bottom nav, language switcher
- Balance card shows masked EUR •••,•• with "Anmelden" CTA
- Header shows "BidBlitz" name + "Anmelden" sign-in button
- CTA button shows "Konto erstellen" (Create Account)
- Protected paths (wallet, scan, merchant, more, notifications, admin) trigger auth overlay
- Auth page has "Zurück" (Back) button to return to public browsing
- After login, user returns to app with full access
- All text translated in 12 languages (common.back key added)

## Not Implemented (Backlog)
- P0: Compliance block messages need human-readable text
- P1: Onboarding welcome flow, Merchant refunds, QR code zoom
- P2: Payout auto-approve, Animation performance, Home page length
- P3: Apple Pay/Google Pay, Merchant daily summary
- Taxi, Scooter, Food, Auctions (placeholder cards)
- User streaks, Push notifications, KYC, Saved payment methods

## Test Credentials
- See /app/memory/test_credentials.md for full list
