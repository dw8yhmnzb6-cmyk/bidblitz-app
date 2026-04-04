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
- Export tools, Feature flags & gating, Premium card display
- Transaction history with filters

### Soft Launch Features (Complete)
- Invite-only gates, admin whitelist, invite codes (standard + MRC-)
- Soft launch dashboard metrics, DB backups & monitoring cron jobs
- Admin alerts, user feedback collection, 15 users + 3 merchants seeded

### Public Browsing & Auth Gating (Complete)
- Homepage publicly accessible to guests
- Balance/data masked for unauthenticated visitors
- AuthGateOverlay + GuestCTABar for auth-gated flows
- Bottom nav accessible for guests

### Try Demo Mode (Complete)
- "Try Demo" button, persistent demo banner
- Mock data for Wallet/Merchant/More pages, demo toasts on actions

### Clear CTA Buttons (Complete)
- Homepage header: Login + Register buttons
- Homepage hero: Register (primary), Login + Try Demo (secondary row)
- Inner pages: GuestCTABar (Register/Login/Demo)
- AuthPage/AuthGateOverlay accept initialMode

### Onboarding Hint (Complete)
- Dismissible inline banner, localStorage-persisted, 12-language i18n

### Improved Guest Homepage (Complete — April 4, 2026)
- **Key Products section**: 4 product cards (Wallet, QR Payments, Merchant Tools, Rides & More) with icons, descriptions, and "Use now" CTAs that gate behind registration
- **Benefits section**: 3 benefit pills (Instant, Low Fees, Secure) with icons and descriptions
- **Trust section**: 3 trust badges (1,200+ users, Encrypted, 12 Languages)
- **Bottom CTA**: Wallet banner linking to registration
- **Separate translations file**: `/app/frontend/src/models/homeTranslations.js` with all 12 languages (avoids modifying brittle I18nContext.jsx)
- **Guest vs Auth split**: Guests see products/benefits/trust; authenticated users see balance card + services grid
- All action clicks on guest sections trigger Register flow (auth gating on action, not on view)

## Key Files
- `/app/frontend/src/App.js` — Routing, demo mode state, auth gate, CTA wiring
- `/app/frontend/src/pages/HomePage.jsx` — Homepage with guest products/benefits/trust sections
- `/app/frontend/src/models/homeTranslations.js` — Guest homepage translations (12 languages)
- `/app/frontend/src/models/demoData.js` — Mock data for demo mode
- `/app/frontend/src/components/DemoBanner.jsx` — Demo mode banner
- `/app/frontend/src/components/GuestCTABar.jsx` — Guest CTA bar for inner pages
- `/app/frontend/src/components/AuthGateOverlay.jsx` — Auth popup overlay
- `/app/frontend/src/pages/AuthPage.jsx` — Auth page with initialMode support
- `/app/frontend/src/store/I18nContext.jsx` — Main 12-language translations

## Backlog (P2/P3 — Not Started)
- Push notifications (WebPush)
- KYC upgrade flow
- User Streaks/Milestones tracking
- Saved payment methods (Apple Pay, Google Pay)
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
