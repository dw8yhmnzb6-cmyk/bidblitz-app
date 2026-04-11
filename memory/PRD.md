# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech Super App called BidBlitz V2. Full-stack application with FastAPI backend, MongoDB database, and React/TailwindCSS frontend. Features include:
- Unified Wallet payment system
- Penny Auction platform with bot bidding
- Kids Wallet with parental controls
- Merchant POS system
- P2P transfers
- Premium Finance features

## What's Been Implemented

### Core Features (DONE)
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Wallet System**: EUR balance, top-ups, transfers
- **P2P Transfers**: Email, Username, QR, NFC methods
- **Stripe Integration**: Top-ups via Emergent proxy

### Penny Auction System (DONE)
- 20 unique premium products (no duplicates)
- 3-phase bot bidding strategy
- Premium DealDash-style UI redesign (April 2026)
- Live timer, bid counter, category filters
- "How it Works" tutorial section

### Kids Wallet System (DONE)
- Parent dashboard with child management
- Freeze/unfreeze child wallets
- PIN system for child authentication
- 16-button quick actions grid
- **NEW (April 2026)**: Tasks/Aufgaben system with rewards

### Merchant POS (DONE)
- Barcode scanning payments
- Fee structure configuration
- Daily/weekly reporting

### Premium Finance Features (April 2026)
- Split Bill (UI ready, backend stub)
- Virtual Cards (UI ready, backend stub)
- Savings Goals (UI ready)
- BNPL / Pay Later (UI ready)
- Gift Cards (UI ready)
- Bills / Utility Payments (UI ready)

### Translations (DONE)
- 15 languages with flag emojis
- German as primary language
- All Premium Finance features translated

## Architecture

### Backend
- FastAPI with Motor (async MongoDB)
- Routes: `/app/backend/routes/`
- Core: `/app/backend/core/`

### Frontend
- React 18 with TailwindCSS
- Framer Motion animations
- Shadcn/UI components
- State: Zustand stores

### Key Files
- `/app/backend/routes/auctions.py` - Auction system + bot logic
- `/app/backend/routes/kids.py` - Kids wallet + tasks
- `/app/frontend/src/pages/AuctionsPage.jsx` - Premium auction UI
- `/app/frontend/src/pages/KidsPaywall.jsx` - Parent dashboard
- `/app/frontend/src/store/I18nContext.jsx` - Translations

## Credentials
- Admin: `admin@bidblitz.com` / `BidBlitz2026!`
- Customer: `kunde@bidblitz.com` / `Kunde2026!`

## Known Issues
1. SendMoney Modal balance fallback (fixed with user store)
2. Some Premium Finance pages need full implementation

## Backlog (P1-P2)
- [ ] Complete Split Bill implementation
- [ ] Complete Virtual Cards implementation
- [ ] eSIM / Utility bill payments
- [ ] Apple Pay / Google Pay
- [ ] Receipt PDF export
- [ ] Real map tracking
- [ ] Chat/Support system

## Session Updates (April 11, 2026)
- Fixed Auction UI - Premium DealDash-style redesign
- Created 20 unique auction products (no duplicates)
- Tested bot bidding - working correctly
- Added Premium Finance menu to MorePage
- Fixed translation keys for new features
- Added Kids Tasks/Aufgaben system with rewards
- Fixed SendMoneyModal balance display bug
