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
- Daily MongoDB backup via cron (2:00 AM UTC), 7-day retention
- Rotating error/access logs, uptime monitor every 5 min
- Enhanced /api health check: DB status, backup info

### Admin Alerts (DONE - Apr 2026)
- Auto in-app notifications to admins on: payment_failed, send_failed, topup_failed, payout_cancelled, suspicious_activity, login_locked, system_error

### Soft Launch Mode (DONE - Apr 2026)
- Invite-only access gate: registration blocked unless email is whitelisted or soft launch disabled
- Existing users can always log in (configurable via allow_existing_users)
- Admin whitelist management: add/remove emails via API
- Admin toggle: enable/disable soft launch, open/close registration
- Live activity dashboard: payments (24h/1h), failed payments, volume, support tickets, logins, new users, alerts
- All config stored in MongoDB (platform_config collection)
- Admin endpoints: GET/PUT /api/admin/soft-launch, POST/DELETE /api/admin/soft-launch/whitelist

### Production Readiness (DONE - Apr 2026)
- All float rounding fixed across every endpoint
- Production frontend build (1.4MB)
- Full live test: 34/34 checks passed

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
- VIP (whitelisted): vip@example.com / Vip2026!

## Operations
- Backup: /app/scripts/backup_db.sh (cron: 0 2 * * *)
- Monitor: /app/scripts/monitor.sh (cron: */5 * * * *)
- Logs: /app/backend/logs/
- Soft launch config: MongoDB platform_config collection
