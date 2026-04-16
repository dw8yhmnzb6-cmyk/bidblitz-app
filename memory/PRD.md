# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB)
- Production: IONOS Server, PM2, Nginx, MongoDB Atlas

## Production Status: LAUNCH-READY (140+ Services, 63+ Revenue Streams)

### Total Routes: 140+
### Total Revenue Streams: 63+
### Total Backend Routes Files: 130+

## Multi-Mode System (Implemented 2026-04-16)

### Mode Architecture
- **Personal Mode**: Standard user dashboard (Wallet, Services, Crypto, etc.)
- **Kids Mode**: Parental control dashboard (GPS, Tasks, Allowance, Quiz)
- **Merchant Mode**: Business portal (POS, Finances, Reservations, Analytics)

### Technical Implementation
- Backend: `serialize_user()` returns `modes` array based on user role + flags
- Frontend: `UserContext` manages `currentMode` state with localStorage persistence
- `ModeSwitcher` component: Dropdown in HomePage header, shows only accessible modes
- `BottomNav`: Dynamically changes navigation items based on `currentMode`
- Auto-switch: Navigating to /kids or /merchant-portal auto-switches mode
- Roles → Modes mapping:
  - `admin` → [personal, kids, merchant]
  - `user` + `has_kids` → [personal, kids]
  - `merchant` → [personal, merchant]
  - `user` (basic) → [personal]

## Completed Features

### V2 Core Modules (Previous Sessions)
- 8 Crypto modules, LevelUp Referral System
- 10 Service/Finance modules
- 12 Utility modules
- 13 Viral/Engagement modules
- Live Production Deployment on IONOS

### Session: 2026-04-16
- **P0 DONE**: Comprehensive seed script (24 collections, 10,669 documents)
- **P1 DONE**: Mobile UI Fix (no horizontal scrolling, native app CSS)
- **P2 DONE**: i18n language validation fix
- **Multi-Mode System DONE**: Full Personal/Kids/Merchant mode switching
  - ModeSwitcher component with animated dropdown
  - Mode-aware BottomNav (KIDS tab, PORTAL tab, etc.)
  - Auto-switch on navigation
  - Persistent mode via localStorage
  - Backend modes array in user serialization
  - Kids data seeded (35 tasks, 32 messages, 41 transactions)
  - Merchant data seeded (25 transactions, 8 tips)

## Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!

## Backlog (Prioritized)
- P1: Apple Pay / Google Pay (Stripe Integration)
- P1: Digital Products Marketplace completion
- P1: Run seed script on production MongoDB Atlas
- P2: App.js Code Splitting (130+ Routes need lazy loading)
- P2: Server Security (SSH/Fail2Ban/Mongo-Auth on IONOS)
