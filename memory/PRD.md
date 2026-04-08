# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2 with Revolut-level payment flows, real backend integration, Stripe top-ups, QR/NFC payments, Admin/Merchant dashboards, and full 15+ language support. Features include a Penny Auction System, GoMining-style Mining/Rewards Module, Merchant POS, Kids Subscriptions, and Mobility services (Taxi, Scooter, Food Delivery). Ultra-premium futuristic dark glassmorphism design.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, Leaflet (react-leaflet)
- Backend: FastAPI, MongoDB (Motor)
- Integrations: Stripe (via Emergent Proxy)
- Design: Dark glassmorphism, futuristic 2040 aesthetic

## Core Modules

### 1. Wallet System
- [x] Balance display and management
- [x] Stripe top-up flow (checkout, quick-topup, webhooks)
- [x] P2P transfers (Send money to other users)
- [x] Transaction history with filters
- [x] Barcode/QR code display
- [x] Export functionality

### 2. Auctions (Penny Auction)
- [x] Live auction bidding
- [x] Credit purchase system (wallet-only)
- [x] Bot bidding simulation
- [x] Watchlist functionality

### 3. Mining Module
- [x] Dashboard with stats
- [x] Miner shop (monthly/yearly billing)
- [x] Auto-rewards loop
- [x] P2P Marketplace
- [x] Launchpad
- [x] Referral system with share button

### 4. Merchant POS
- [x] Payment processing
- [x] Transaction history
- [x] Revenue dashboard

### 5. Mobility Services (IN PROGRESS)
- [ ] Taxi (Real driver system with Leaflet maps)
- [ ] Scooter (Real unlock/rental flow)
- [ ] Food Delivery (Restaurant dashboard)

### 6. Kids Wallet
- [x] Child account creation
- [x] Spending limits
- [ ] Full management UI (pending)

## Wallet-Only Payment Rules (ENFORCED)
All payments within the BidBlitz ecosystem must use wallet balance only:
- ❌ No Apple Pay / Google Pay
- ❌ No external card payments inside app flows
- ✅ All payments deduct from wallet
- ✅ All earnings credit to wallet internally
- ✅ Show balance before action, block if insufficient

Applied to:
- Taxi bookings
- Scooter rentals
- Food orders
- Auction credit purchases
- Mining package purchases
- Merchant payments

## Recent Implementations (April 8, 2025)

### Wallet-Only Payment Enforcement
- Updated all backend routes (taxi.py, scooter.py, food.py, auctions.py, mining.py)
- Added prominent wallet balance cards in frontend before checkout
- Block actions when balance too low with "Wallet aufladen" button
- Removed "Apple / Google Pay" from Coming Soon features

### P2P Wallet Transfer (Senden)
- New `/api/wallet/send` endpoint
- SendMoneyModal component with:
  - Balance display (green/red based on sufficiency)
  - Recipient email input
  - Amount input with validation
  - Optional note
  - Success/Error states
- Transactions recorded for both sender and recipient

### UI Improvements
- TopUp Modal: Larger buttons (py-4), better mobile safe-area padding
- Amount buttons: Larger text (text-base font-bold)
- Food checkout: Wallet card with top-up CTA when insufficient balance
- Scooter page: Wallet balance card before unlock section

## Pending Issues

### P1 (High Priority)
- [ ] KYC Verification UI endpoint mismatch
- [ ] Admin Panel Grid UI (JSX errors when editing)
- [ ] RESEND_API_KEY for emails missing

### P2 (Medium Priority)
- [ ] Main app Referral `my-code` not auto-generating
- [ ] Merchant Dashboard `today_revenue` returning null

## Upcoming Tasks

### P0 (Critical - 1 Week Goal)
1. Complete REAL Taxi System
   - Integrate RealMap.jsx with driver coordinates
   - Driver acceptance flow (online, accept/reject, arrive, complete)
   - Wallet deduction on completion
   
2. Complete REAL Scooter System
   - Map-based unlock with QR
   - Live timer and end-ride logic
   
3. Complete REAL Food System
   - Restaurant Dashboard (menu, orders)
   - Delivery driver flow

### P1 (Important)
- Receipt PDF Export
- 2FA Integration
- Email Notifications (Resend)

### P2 (Backlog)
- Developer SDK Docs
- Chat/Support System
- NFC Tap-to-Pay

## Test Credentials
- Admin: admin@bidblitz.com | BidBlitz2026!
- Customer: kunde@bidblitz.com | Kunde2026!

## Language
- User interface: German (DEUTSCH)
- 15+ languages supported via I18nContext

## Critical Notes
- DO NOT use testing_agent_v3_fork (user disabled)
- Large files (I18nContext.jsx, MiningPage.jsx, AdminPage.jsx) - use precise edits
- Stripe uses emergent proxy with sk_test_emergent
