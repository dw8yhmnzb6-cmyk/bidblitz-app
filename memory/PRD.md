# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe
- **Languages**: 12 (EN, DE, SQ, TR, FR, ES, IT, PT, NL, PL, RU, AR)

## What's Been Implemented

### Core Features (Complete)
- Full JWT auth, Wallet, Merchant & Admin dashboards, QR payments
- 12-language i18n, Kids dashboard with paywall, Notifications
- Export tools, Feature flags, Premium card, Transaction history

### Soft Launch (Complete)
- Invite codes, whitelist, dashboard metrics, backups, monitoring, alerts

### Public Browsing & Guest Experience (Complete)
- Homepage public, auth-gated actions, Try Demo mode
- Clear CTAs (Login/Register/Demo), Onboarding hint, Guest homepage sections

### Conversion Tracking (Complete)
- Event ingestion API, admin dashboard, funnel metrics, feature click tracking

### Child Accounts (Complete — April 5, 2026)
**Backend (kids.py):**
- `GET /api/kids/children` — List children for current parent
- `POST /api/kids/children` — Create child (name, weekly_limit). Max 6 per parent
- `PUT /api/kids/children/{child_id}` — Update name/limit
- `DELETE /api/kids/children/{child_id}` — Remove child
- Data stored in `kids_children` collection: `{child_id, parent_id, name, avatar, weekly_limit, spent, color, created_at}`

**Frontend (KidsPaywall.jsx):**
- Children loaded from backend on mount, persist across sessions
- "Add Child" button with name input, creates via API
- Child list: colored avatar (first letter), name, €spent/€limit, progress bar, % used
- Click to select: expanded controls (weekly limit slider, "Remove Child" button with i18n)
- Empty state shown when no children exist
- Loading spinner while fetching from backend
- Stats: total children count, weekly spending, total limit
- i18n: `kids.remove_child`, `kids.no_children`, `kids.add_first` added to EN + DE

**Frontend API (api.js):**
- `listChildren()`, `createChild()`, `updateChild()`, `deleteChild()` methods

## Key Files
- `/app/backend/routes/kids.py` — Child CRUD endpoints
- `/app/frontend/src/pages/KidsPaywall.jsx` — Kids dashboard with child management
- `/app/frontend/src/services/api.js` — API service with child methods
- `/app/frontend/src/App.js` — Routing, tracking, auth
- `/app/frontend/src/pages/HomePage.jsx` — Guest homepage
- `/app/frontend/src/services/tracker.js` — Conversion tracker
- `/app/backend/routes/analytics.py` — Analytics + conversion endpoints

## Backlog (P2/P3 — Not Started)
- Push notifications (WebPush)
- KYC upgrade flow
- User Streaks/Milestones tracking
- Saved payment methods (Apple Pay, Google Pay)
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
