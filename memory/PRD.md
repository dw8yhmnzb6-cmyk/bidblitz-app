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
- 12-language i18n support
- Kids dashboard with paywall
- Notifications, activity feed, referral system
- Export tools (CSV/PDF for transactions, payments, payouts)
- Feature flags & gating system
- Premium card display
- Transaction history with filters

### Soft Launch Features (Complete)
- Invite-only registration gates
- Admin whitelist toggle
- Standard and merchant-specific invite codes (MRC- prefix)
- Soft launch dashboard metrics
- DB backup & server monitoring cron jobs
- Admin alerts via audit logs
- User feedback collection
- 15 seeded users, 3 merchants, simulated payments

### Public Browsing & Auth Gating (Complete)
- Homepage publicly accessible to guests
- Balance/data masked for unauthenticated visitors
- AuthGateOverlay for action-gated flows (login/register popup)
- Bottom nav accessible for guests

### Try Demo Mode (Complete — April 4, 2026)
- "Try Demo" button on homepage for guests
- Persistent demo banner ("DEMO MODE — No real transactions")
- Wallet/Merchant/More pages show mock data in demo mode
- All actions show demo toasts (no real API calls)
- "Exit Demo" returns to guest homepage

### Clear CTA Buttons (Complete — April 4, 2026)
- Homepage header: Separate "Login" + "Register" buttons
- Homepage hero: Register (primary), Login + Try Demo (secondary row)
- Inner pages: GuestCTABar component (Register/Login/Demo)
- AuthPage/AuthGateOverlay accept `initialMode` prop

### Onboarding Hint for Guests (Complete — April 4, 2026)
- Non-blocking inline banner below header on HomePage
- Short i18n message explaining app value (12 languages)
- Dismissible via X button, uses localStorage to show once
- Smooth enter/exit animation via AnimatePresence
- Hidden during demo mode and for authenticated users
- Key: `onboarding.hint` in all 12 language blocks

## Key Files
- `/app/frontend/src/App.js` — Routing, demo mode, auth gate, CTA wiring
- `/app/frontend/src/pages/HomePage.jsx` — Homepage with CTAs + onboarding hint
- `/app/frontend/src/pages/AuthPage.jsx` — Auth page with initialMode support
- `/app/frontend/src/components/DemoBanner.jsx` — Demo mode banner
- `/app/frontend/src/components/GuestCTABar.jsx` — Guest CTA bar for inner pages
- `/app/frontend/src/components/AuthGateOverlay.jsx` — Auth popup overlay
- `/app/frontend/src/models/demoData.js` — Mock data for demo mode
- `/app/frontend/src/store/I18nContext.jsx` — 12-language translations

## Backlog (P2/P3 — Not Started)
- Push notifications (WebPush)
- KYC upgrade flow
- User Streaks/Milestones tracking
- Saved payment methods (Apple Pay, Google Pay)
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
