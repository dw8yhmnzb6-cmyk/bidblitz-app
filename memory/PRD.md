# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, and analytics.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn/UI
- **Backend**: FastAPI, MongoDB (Motor), PyJWT, bcrypt
- **Payments**: Stripe (Test Mode via emergentintegrations)
- **Deployment**: nginx, systemd, deploy/rollback scripts

## Architecture
- `/app/frontend/src/` - React SPA (dark premium theme)
  - `pages/` - HomePage, WalletPage, ScannerPage, MerchantPage, AdminPage, AuthPage, MorePage, ReferralPage, NotificationsPage
  - `components/` - ExportSection, ExportButton, BottomNav, TopUpModal, PremiumCard, TransactionFilters, etc.
  - `store/` - UserContext, WalletContext, MerchantContext, I18nContext
  - `services/api.js` - Centralized API client with CSV download helpers
- `/app/backend/` - FastAPI REST API
  - `routes/` - auth, wallet, payment, merchant, transactions, stripe, payout, admin, export, profile, sessions, referral, notifications, promotions, analytics
  - `core/` - config, database, security, audit, compliance, rate_limit
- `/app/deploy/` - nginx.conf, systemd service, deploy.sh, rollback.sh, env-templates

## What's Been Implemented

### Fully Completed & Working
- JWT Cookie-based Auth (Login/Register/Logout/Refresh)
- Wallet (Balance, Card Display, Currency EUR)
- Stripe Top-up (Checkout Sessions, Status Verification, Packages)
- QR/Merchant Payment Generation (bidblitz:// deep links)
- Payment Flow (Send, Pay, Fee Preview, Balance Check)
- Merchant Dashboard (Earnings, Transactions, Balance)
- Admin Dashboard (Users, Merchants, Payouts, Config, Overview)
- Payout System (Request, History, Cancel, Admin Approve)
- Role-based Access Control (user/admin/merchant, 403 on unauthorized)
- CSV Export Backend + Frontend UI (WalletPage, MerchantPage, AdminPage) ✅
- Report Summaries (Aggregated JSON endpoints)
- Referral System (Code Generation, Apply, Reward Check, Leaderboard)
- Notifications (Onboarding, Admin Send, Mark All Read)
- Promotions Engine (Create, Toggle, Active Filter)
- Growth Analytics (Funnel, Retention, Campaigns, Overview)
- Profile & Password Management
- MorePage Sub-Pages i18n: Profile + Settings fully translated (EN/DE) ✅ Apr 3
- Health Check Endpoint
- Structured Logging & Global Error Handler
- Database Indexes
- Deployment Scripts

### Partially Completed
- i18n: Other 10 languages (sq, tr, fr, es, it, pt, nl, pl, ru, ar) ~40% of keys translated
- Security: audit.py exists but NOT called anywhere
- Security: compliance.py exists but NOT used

### Completed in Latest Session (Apr 3)
- Rate Limiting: Wired rate_limit.py into server.py (slowapi limiter, exception handler, decorators on auth/stripe/payment endpoints)
- ScannerPage i18n: All hardcoded strings replaced with t() calls (STEP_LABELS, processing steps, receipt labels, error messages)
- AdminPage i18n: All hardcoded strings replaced with t() calls (tabs, stat cards, section headers, buttons, empty states)
- i18n expanded: All 10 remaining languages (sq, tr, fr, es, it, pt, nl, pl, ru, ar) expanded from ~40% to ~95% coverage (~150+ keys each)
- WalletPage i18n: Fixed 3 hardcoded strings (title, available balance, this month)
- Settings Language Picker: Added functional language picker UI with 12 language grid (replaces static "English" text)

### Not Yet Implemented
- Onboarding-Flow UI (Welcome screens, progress checklists)
- Frontend Offline/Error State
- Support Center / Help Page
- Activity Feed, Streaks/Milestones, Feature Flags

## Prioritized Backlog
### P0
1. ~~Rate Limiting: Wire rate_limit.py into server.py~~ DONE
2. ~~ScannerPage + AdminPage hardcoded strings -> i18n~~ DONE

### P1
3. ~~i18n: Complete remaining 10 languages~~ DONE (Apr 3, 2026)
4. Negative Balance / Duplicate Prevention
5. Frontend Offline/Error handling
6. Onboarding Welcome Flow UI

### P2
6. Support Center / Help Page
7. Wire audit.py into security-critical endpoints
8. Merchant Performance Insights UI
