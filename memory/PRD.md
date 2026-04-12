# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Production Status: LAUNCH-READY

### All Features
- Wallet, POS, Auctions, Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module), Mapbox Live Map
- Premium Finance, AI Assistant (BlitzBot), Crypto Wallet, Budget Planner
- Support Chat, Credit Score (Admin-genehmigte Kredite + Auto-Pay), Referral
- Kids Module (GPS, Geofencing, Wallet, Tasks, Screen Time, App Control, SOS, Device Status)
- Admin Grants & Coupon System (EUR/Coins/BLZ/BidCredits/KidsAbo/Premium vergeben)
- Admin Credit Management (Anträge genehmigen/ablehnen)
- i18n: 15 Sprachen

### Credit System Flow
1. Kunde beantragt → Status: "pending"
2. Admin genehmigt → Geld wird ausgezahlt
3. Auto-Pay: Monatliche Raten automatisch vom Wallet (Background Task, stündlich)
4. Bei zu wenig Guthaben: Notification "Bitte Wallet aufladen"

### Admin Grants & Coupons (2026-04-12)
- POST /api/admin/grants/balance — EUR/Coins/BidCredits/BLZ an User vergeben
- POST /api/admin/grants/coupon/create — Gutschein-Code erstellen
- POST /api/admin/grants/coupon/redeem — User löst Code ein
- GET /api/admin/grants/coupons — Alle Coupons listen
- Typen: eur, coins, bid_credits, blz, kids_abo, premium_month

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Test Coupons: WELCOME25 (€25), KIDS3FREE (3M Kids Premium)

## Pending
- P1: Admin UI für Grants/Coupons (Frontend-Seite)
- P1: Mining Launchpad "Body is disturbed" Fix (iOS Safari)
- P2: i18n remaining pages
