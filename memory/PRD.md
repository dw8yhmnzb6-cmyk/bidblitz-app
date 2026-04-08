# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2 with Revolut-level payment flows, real backend integration, Stripe top-ups, QR/NFC payments, Admin/Merchant dashboards, and full 15+ language support. Features include a Penny Auction System, GoMining-style Mining/Rewards Module, Merchant POS, Kids Subscriptions, and Mobility services (Taxi, Scooter, Food Delivery). Ultra-premium futuristic dark glassmorphism design.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, Leaflet (react-leaflet)
- Backend: FastAPI, MongoDB (Motor)
- Integrations: Stripe (via Emergent Proxy)
- Design: Dark glassmorphism, futuristic 2040 aesthetic

## WALLET-ONLY CLOSED ECOSYSTEM (ENFORCED)

All payments within BidBlitz MUST use wallet balance only:
- ❌ NO Apple Pay / Google Pay
- ❌ NO external card payments inside app flows
- ✅ ALL payments deduct from wallet
- ✅ ALL earnings credit to wallet internally
- ✅ Show balance before action, block if insufficient

### Payment Flow by Module:

| Module | Customer Pays | Receiver Gets | Platform Fee |
|--------|--------------|---------------|--------------|
| Taxi | Wallet deduction | Driver wallet +85% | 15% |
| Scooter | Wallet deduction | Platform revenue | 100% |
| Food | Wallet deduction | Restaurant +85%, Courier +90% of delivery | 15% / 10% |
| Auctions | Wallet for credits | N/A | 100% |
| Mining | Wallet for packages | N/A | 100% |
| Merchant POS | Customer wallet | Merchant wallet (net after fee) | 0.5-2.5% |
| P2P Transfer | Sender wallet | Recipient wallet | 0% |

## Core Modules Status

### 1. Wallet System ✅
- [x] Balance display and management
- [x] Stripe top-up flow (checkout, quick-topup, webhooks)
- [x] P2P transfers (Send money - SendMoneyModal)
- [x] Transaction history with filters
- [x] Barcode/QR code display
- [x] Export functionality

### 2. Auctions (Penny Auction) ✅
- [x] Live auction bidding
- [x] Credit purchase (wallet-only)
- [x] Bot bidding simulation
- [x] Watchlist

### 3. Mining Module ✅
- [x] Dashboard with stats
- [x] Miner shop (monthly/yearly)
- [x] Auto-rewards loop
- [x] P2P Marketplace
- [x] Launchpad
- [x] Referral with share button

### 4. Merchant POS ✅
- [x] Barcode payment processing
- [x] NFC payment processing
- [x] Merchant wallet crediting (net amount)
- [x] Revenue dashboard

### 5. Mobility Services (IN PROGRESS)
- [ ] Taxi (Real Leaflet maps, driver system)
- [ ] Scooter (Real unlock/rental)
- [ ] Food (Restaurant dashboard)

### 6. Kids Wallet ✅
- [x] Child account creation
- [x] Spending limits
- [ ] Full management UI (pending)

## Recent Implementations (April 8, 2025)

### Wallet-Only Ecosystem Complete
- Backend: All routes enforce wallet balance check with German error messages
- Frontend: Wallet cards with top-up CTAs when balance insufficient
- Removed Apple/Google Pay from Coming Soon

### Internal Crediting System
- **Taxi**: Driver gets 85% credited to wallet on ride completion
- **Food**: Restaurant gets 85% of subtotal, Courier gets 90% of delivery fee
- **Scooter**: Platform revenue recorded (owned fleet)
- **Merchant POS**: Net amount (after fee) credited directly to merchant wallet

### P2P Wallet Transfer
- `/api/wallet/send` endpoint
- SendMoneyModal component
- Instant transfer between BidBlitz users

## Pending Issues

### P1 (High Priority)
- [ ] KYC Verification UI endpoint mismatch
- [ ] Admin Panel Grid UI (JSX errors)
- [ ] RESEND_API_KEY for emails

### P2 (Medium Priority)
- [ ] Main app Referral `my-code` not auto-generating
- [ ] Merchant Dashboard `today_revenue` calculation

## Upcoming Tasks

### P0 (Critical)
1. Complete REAL Taxi System (Leaflet maps, driver flow)
2. Complete REAL Scooter System (QR unlock, timer)
3. Complete REAL Food System (Restaurant dashboard)

### P1 (Important)
- Receipt PDF Export
- 2FA Integration
- Email Notifications

### P2 (Backlog)
- Developer SDK Docs
- Chat/Support System
- NFC Tap-to-Pay hardware integration

## Test Credentials
- Admin: admin@bidblitz.com | BidBlitz2026!
- Customer: kunde@bidblitz.com | Kunde2026!

## Language
- User interface: German (DEUTSCH)
- 15+ languages supported via I18nContext

## Critical Development Notes
- DO NOT use testing_agent_v3_fork (disabled by user)
- Large files need precise edits (I18nContext.jsx, MiningPage.jsx, AdminPage.jsx)
- Stripe uses emergent proxy with sk_test_emergent
- All ObjectIds must be excluded from MongoDB responses
