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
- Wallet top-up via Stripe checkout (6 packages)
- Customer → Merchant payments with compliance checks
- Peer-to-peer send with fees
- Merchant barcode scan payment with idempotency
- Dynamic QR code (HMAC-based, 5-min rotation)
- Merchant payouts with admin approval pipeline
- Platform fee engine (configurable)
- Promotions wired into all payment flows
- All balance responses use round(value, 2)

### System/Security (DONE)
- Audit logging (17 event types, MongoDB-backed)
- Compliance engine (KYC tiers, velocity detection, payout risk)
- Feature flags (10 flags, MongoDB-backed, CRUD)
- Session management

### UI/UX (DONE)
- 12-language i18n (en, de, sq, tr, fr, es, it, pt, nl, pl, ru, ar)
- Premium dark theme, glass-morphism, Framer Motion
- Offline detection, role-aware navigation

### Admin Dashboard (DONE)
- Overview, Users, Merchants, Payouts, Transactions
- Feature Flags, Audit logs, Compliance, Growth Analytics, Promotions, Config
- N+1 query optimization (aggregation pipelines)

### All Other Features (DONE)
- Profile & Account, Support Center, Kids Feature, Growth/Referral, Settings, Export

### Backups & Monitoring (DONE - Apr 2026)
- Daily MongoDB backup via cron (2:00 AM UTC), 7-day retention, compressed .tar.gz
- Backup integrity verification (tar test on each run)
- Rotating error log (/app/backend/logs/error.log, 5MB × 5 files)
- Access log for 4xx/5xx requests (/app/backend/logs/access.log)
- Request logging middleware (method, path, status, duration)
- Uptime monitor every 5 min: API, MongoDB, disk, memory, backup freshness
- Alert log (/app/backend/logs/alerts.log) for critical issues
- Enhanced /api health check: DB status, backup info, uptime timestamp

### Production Readiness (DONE - Apr 2026)
- All float rounding fixed across every endpoint
- N+1 admin query optimization
- Production frontend build (1.4MB)
- Full live test: login, wallet, topup, send, merchant-scan, payouts, admin — ALL PASSED

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

## Operations
- Backup script: /app/scripts/backup_db.sh (cron: 0 2 * * *)
- Monitor script: /app/scripts/monitor.sh (cron: */5 * * * *)
- Backups stored: /app/backups/ (7-day retention)
- Logs: /app/backend/logs/ (error.log, access.log, backup.log, uptime.log, alerts.log)
