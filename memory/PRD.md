# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB)
- Production: IONOS Server, PM2, Nginx, MongoDB Atlas

## Production Status: LAUNCH-READY (140+ Services, 63+ Revenue Streams)

### Total Routes: 140+
### Total Revenue Streams: 63+
### Total Backend Routes Files: 130+

## Completed Features

### V2 Core Modules
- 8 Crypto modules (Earn, Baskets, Derivatives, LevelUp, Predictions, BlitzCard, Supercharger, DeFi Wallet)
- LevelUp Referral-Reward System
- 10 Service/Finance modules (Crypto Loans, P2P Lending, Trading Bot, Live Shopping, Creators, Skills, Invoicing, QR Menu, Bookings, Contracts)
- 12 Utility modules (Abo Boxes, Music, Surveys, Card Compare, Micro Tasks, etc.)
- 13 Viral/Engagement modules (Daily Spin, Quiz, BlitzClips TikTok-style feed, etc.)

### Deployment & Infrastructure
- Live Production Deployment on IONOS (PM2 + Nginx)
- Production Auth Bug Fix (UserContext.jsx Reducer)
- DB Export/Backup scripts

### Session: 2026-04-16 - Seed Data & Mobile Fix
- **P0 DONE**: Comprehensive seed script for all new modules (24 collections seeded)
  - 12 reservation-ready restaurants (Italian, Japanese, Turkish, German, Indian, Mexican, French, Asian)
  - 43 restaurant reviews, 21 reservations
  - 8 digital marketplace listings
  - 10 BlitzClips (user-generated content)
  - 80 transactions (for admin dashboard stats)
  - 12 pet bookings, 15 appointment bookings, 10 live shopping orders
  - 8 creator subscriptions, 12 creator tips
  - 6 trading bots, 10 crypto basket purchases, 8 abo box subscriptions
  - 6 digital contracts, 8 invoices, 6 P2P lending offers, 5 crypto loans
  - 8 prediction bets, 15 social posts, 30 additional users
  - 20 notifications, 12 challenge participants, 10 quiz matches, 8 skill bookings
  - Total: 214 collections, 10,669 documents
- **P1 DONE**: Mobile UI Responsiveness Fix
  - Fixed horizontal scrolling (scrollWidth == clientWidth confirmed)
  - Added native app CSS (touch-action, user-select, overscroll-behavior)
  - Fixed iOS overscroll bounce via position:fixed body trick
  - Responsive tagline text (20px mobile, 22px desktop)
  - Added #root overflow-x containment
  - Ambient glow overflow fix
- **P2 DONE**: i18n language validation - stored lang now validated against supported codes

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!

## Backlog (Prioritized)
- P1: Apple Pay / Google Pay (Stripe Integration)
- P1: Digital Products Marketplace (backend route partially built)
- P2: App.js Code Splitting (130+ Routes need lazy loading)
- P2: Server Security (SSH/Fail2Ban/Mongo-Auth on IONOS)
- P3: Run seed script on production MongoDB Atlas

## Seed Script Location
- `/app/backend/scripts/seed_all_modules.py`
- Usage: `python seed_all_modules.py` (local) or `MONGO_URL="mongodb+srv://..." python seed_all_modules.py` (production)
