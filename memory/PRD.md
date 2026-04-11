# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (MongoDB)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Completed Features

### Core Platform - Wallet, Kids GPS, POS, Auctions, Mobility, Loyalty
### Gaming Hub - 6 games, Coin-based economy (Cashback→Coins→Play→Win→EUR)
### Scooter Live - Map + Admin management
### Car Rental - Full module (13+ pages, vendor/customer/admin)
### Credit Score - Term selection + repayment schedule
### Support Chat - Threaded ticket system (customer↔admin)

### Phase 7 - Gaming Coin Economy (DONE - 2026-04-11)
- Replaced Points system with **Coins**
- Cashback from transactions → Coins
- Buy Coins with Wallet (€1 = 1000 Coins)
- Bet Coins to play (min 5, max 500 per game)
- Win Coins from games
- Redeem Coins → EUR (min 500 Coins)
- Gewinntabelle: "P" → "Coins"
- Coin purchase modal + Auszahlen button

### Phase 8 - Car Rental Gaps (DONE - 2026-04-11)
- **Contract PDF**: `/contracts/{id}/pdf` endpoint + generate_contract_pdf
- **Handover/Return Photos**: `/vendor/bookings/{id}/upload-photo` with phase param
- **Vendor Staff Page**: VendorStaffPage with add/edit/remove + role selection
- **Admin Disputes**: Full dispute system (create/message/resolve) + AdminDisputesPage
- **Vendor Reports Page**: VendorReportsPage with period selection, charts, top cars
- **Admin Commission UI**: Per-vendor commission in AdminCarRentalPage

### New Routes Added
- `/car-rental/vendor/staff` - Staff management
- `/car-rental/vendor/reports` - Analytics page
- `/car-rental/admin/disputes` - Dispute management
- `/car-rental/contracts/{id}/pdf` - Contract PDF
- `/car-rental/vendor/bookings/{id}/upload-photo` - Photo upload
- `/car-rental/disputes` - Create/view disputes
- `/gaming/buy-coins` - Buy coins with wallet
- `/gaming/earn-cashback` - Cashback → coins
- `/gaming/coin-history` - Coin transaction log
- `/gaming/redeem` - Coins → EUR

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
