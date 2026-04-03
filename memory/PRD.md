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

### Fully Completed & Working (Backend + Frontend)
- JWT Cookie-based Auth (Login/Register/Logout/Refresh)
- Wallet (Balance, Card Display, Currency EUR)
- Stripe Top-up (Checkout Sessions, Status Verification, Packages)
- QR/Merchant Payment Generation (bidblitz:// deep links)
- Payment Flow (Send, Pay, Fee Preview, Balance Check)
- Merchant Dashboard (Earnings, Transactions, Balance)
- Admin Dashboard (Users, Merchants, Payouts, Config, Overview)
- Payout System (Request, History, Cancel, Admin Approve)
- Role-based Access Control (user/admin/merchant, 403 on unauthorized)
- CSV Export (User/Merchant/Admin, all endpoints + Frontend UI with ExportSection) ✅ COMPLETED Apr 3
- Report Summaries (Aggregated JSON endpoints)
- Referral System (Code Generation, Apply, Reward Check, Leaderboard)
- Notifications (Onboarding, Admin Send, Mark All Read)
- Promotions Engine (Create, Toggle, Active Filter)
- Growth Analytics (Funnel, Retention, Campaigns, Overview)
- Profile & Password Management
- Health Check Endpoint
- Structured Logging & Global Error Handler
- Database Indexes (email, user_id, created_at)
- Deployment Scripts (deploy.sh, rollback.sh, nginx.conf, systemd)
- i18n: EN + DE (~90% complete)

### Partially Completed
- i18n: Other 10 languages (sq, tr, fr, es, it, pt, nl, pl, ru, ar) ~40% of keys translated
- MorePage Sub-Pages (Profile, Settings): hardcoded English strings remain
- ScannerPage: STEP_LABELS array hardcoded instead of using t()
- AdminPage: Some tab labels still hardcoded
- Security: rate_limit.py exists but NOT wired into server.py
- Security: audit.py exists but NOT called anywhere
- Security: compliance.py exists but NOT used

### Not Yet Implemented
- Onboarding-Flow UI (Welcome screens, progress checklists)
- Frontend Offline/Error State (graceful backend-unavailable handling)
- Support Center / Help Page (placeholder only)
- Activity Feed
- User Streaks/Milestones
- Feature Flags / Soft-Launch mode
- Merchant Performance Insights UI

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Test User: audit_test@test.com / Test1234!

## Prioritized Backlog
### P0 (Must do next)
1. i18n: Complete MorePage Sub-Pages (Profile, Settings) translations
2. Rate Limiting: Wire rate_limit.py into server.py
3. i18n: Complete ScannerPage and AdminPage translations

### P1 (Important)
4. i18n: Complete remaining 10 languages
5. Frontend Offline/Error handling
6. Onboarding Welcome Flow UI

### P2 (Nice to have)
7. Support Center / Help Page
8. Wire audit.py into security-critical endpoints
9. Merchant Performance Insights UI
10. Activity Feed

### P3 (Future)
11. User Streaks/Milestones
12. Feature Flags / Soft-Launch
13. Real deployment to production server
