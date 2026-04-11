# BidBlitz V2 - Product Requirements Document

## Project Overview
BidBlitz V2 is a comprehensive fintech Super App combining Revolut-level payment flows, a Penny Auction System, GoMining-style Mining Module, Mobility (Taxi, Scooter, Food Delivery), Marketplace, and Kids Wallet. The app strictly uses REAL data - no fake/demo data generation.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, React-Leaflet
- **Backend**: FastAPI, MongoDB (Motor async driver)
- **Payments**: Stripe (via Emergent Proxy), Internal Wallet System
- **Auth**: JWT tokens with HTTP-only cookies

## Core Features Implemented

### 1. Authentication & User Management ✅
- JWT-based authentication
- Email/password login and registration
- Role-based access (customer, driver, restaurant_owner, merchant, admin)
- KYC verification system

### 2. Wallet System ✅
- Central payment engine (`/app/backend/core/payment_engine.py`)
- Atomic transactions with duplicate prevention
- Stripe Checkout integration for top-ups
- Real-time balance updates
- Transaction history

### 3. Penny Auction System ✅
- Real-time bidding with WebSocket simulation
- Admin-controlled bot bidding
- Credit-based bidding system
- Auction countdown timers

### 4. Mining Module (GoMining-Style) ✅
- Mining packages with hashrate
- Auto-rewards background loop
- P2P Marketplace for miners
- Mining referral system
- Launchpad for new tokens

### 5. Taxi/Driver System ✅
- Real driver registration with KYC
- Driver online/offline status
- GPS location tracking
- Ride booking and matching
- Dynamic pricing with commission
- Driver earnings to wallet

### 6. Scooter System ✅
- IoT hardware integration stubs
- Nearby scooter discovery with GPS
- Unlock/Lock flow
- Per-minute pricing
- Battery status tracking

### 7. Food Delivery System ✅
- Restaurant registration and approval
- Menu management
- Order creation with wallet payment
- Restaurant dashboard for incoming orders
- Delivery driver flow
- Payment split (restaurant/platform/driver)

### 8. Marketplace (eBay-Style) ✅
- Listing creation with categories
- Browse/search/filter
- Buy with wallet
- Seller contact messaging
- Premium boost listings
- Commission on sales

### 9. Chat System ✅
- User-to-user messaging
- Chat list with unread counts
- Real-time polling (3-second intervals)
- Message notifications

### 10. Referral & Rewards System ✅
- Auto-generated referral codes
- Share via WhatsApp/Email/Telegram
- Multi-level rewards (3 levels)
- Daily login bonus
- Streak bonuses (3, 7, 14, 30 days)
- Influencer/Manager commission system

### 11. Partner Registration ✅
- Driver application with document upload
- Restaurant application flow
- Admin approval panel
- Role-based access after approval

### 12. Merchant POS ✅
- QR code payments
- Receipt PDF generation
- Transaction history
- Daily revenue tracking

### 13. Kids Wallet ✅
- Parental controls
- Spending limits
- Activity monitoring

### 14. Internationalization ✅
- 15+ languages supported
- Flag emojis for language selector
- Dynamic translation switching

## API Endpoints

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Wallet
- `GET /api/wallet/balance`
- `GET /api/wallet/transactions`
- `POST /api/wallet/transfer`

### Stripe
- `POST /api/stripe/checkout`
- `GET /api/stripe/checkout/status/{session_id}`
- `POST /api/stripe/webhook` ✅ NEW

### Taxi
- `GET /api/taxi/drivers/nearby`
- `POST /api/taxi/estimate`
- `POST /api/taxi/book`
- `POST /api/taxi/driver/accept`
- `POST /api/taxi/complete`

### Scooter
- `GET /api/scooter/nearby`
- `POST /api/scooter/unlock`
- `POST /api/scooter/lock`

### Food Delivery
- `GET /api/food/restaurants`
- `GET /api/food/nearby`
- `GET /api/food/restaurant/{id}/menu`
- `POST /api/food/order`
- `GET /api/food/restaurant/dashboard`
- `POST /api/food/restaurant/order/accept`
- `POST /api/food/delivery/accept`
- `POST /api/food/delivery/complete`

### Marketplace
- `GET /api/marketplace/list`
- `POST /api/marketplace/create`
- `GET /api/marketplace/{id}`
- `POST /api/marketplace/buy`
- `POST /api/marketplace/contact`
- `POST /api/marketplace/boost`

### Chat
- `POST /api/chat/create`
- `POST /api/chat/send`
- `GET /api/chat/list`
- `GET /api/chat/{chat_id}`
- `GET /api/chat/poll`

### Referral
- `GET /api/referral/my-code`
- `GET /api/referral/dashboard`
- `POST /api/referral/claim-daily`
- `GET /api/referral/daily-status`

### Applications (Partner Registration)
- `POST /api/applications/driver/apply`
- `POST /api/applications/restaurant/apply`
- `GET /api/applications/admin/pending`
- `POST /api/applications/admin/approve`

## Test Credentials
- **Admin**: `admin@bidblitz.com` | `BidBlitz2026!`
- **Customer**: `kunde@bidblitz.com` | `Kunde2026!`

## Known Issues
1. KYC endpoint mismatch (`/status` vs `/my-status`) - P2
2. Merchant dashboard `today_revenue` calculation - P2

## Upcoming Features (Backlog)
1. 2FA Integration (Email OTP / Google Authenticator)
2. Email Notifications (Resend API)
3. Apple Pay / Google Pay
4. PWA / Installability
5. NFC Tap-to-Pay
6. Developer SDK Documentation

## Architecture Notes
- All payments go through `payment_engine.py` for atomicity
- No fake/demo data - everything requires real registration
- Admin approval required for drivers and restaurants
- Stripe webhook handles wallet credits on payment completion
- Real GPS integration with Leaflet maps

## Updated: 2026-04-11

## Latest System Health Check
```
Status: healthy
Message: Alle Systeme laufen einwandfrei!

MODULES:
  database: ✓ OK
  wallet: ✓ OK
  drivers: ✓ OK
  scooters: ✓ OK
  restaurants: ✓ OK

COUNTS:
  users: 57
  admins: 1
  drivers: 2
  restaurants: 8
  scooters: 45
  active_auctions: 7
```

## Session Summary (2026-04-11)

### Implemented This Session:
1. ✅ Marketplace System (eBay-style listings)
2. ✅ Chat System (real-time messaging)
3. ✅ Referral & Rewards System (multi-level, daily bonus, streaks)
4. ✅ Partner Registration (driver/restaurant applications)
5. ✅ Food Delivery Restaurant Dashboard
6. ✅ Delivery Driver Flow
7. ✅ Stripe Webhook for wallet credit
8. ✅ Real Map GPS fixes
9. ✅ System Health Check endpoint
10. ✅ Admin Cleanup endpoint

### All APIs Tested and Working:
- `/api/auth/*` - Authentication
- `/api/wallet/*` - Wallet operations
- `/api/stripe/*` - Stripe payments + webhook
- `/api/taxi/*` - Taxi booking
- `/api/scooter/*` - Scooter rental
- `/api/food/*` - Food delivery
- `/api/marketplace/*` - Marketplace
- `/api/chat/*` - Messaging
- `/api/referral/*` - Referral system
- `/api/applications/*` - Partner registration
- `/api/admin/*` - Admin panel

