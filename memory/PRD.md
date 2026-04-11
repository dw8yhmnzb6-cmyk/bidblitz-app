# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (MongoDB)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Completed Features

### Core Platform - Wallet, Kids GPS, POS, Auctions, Mobility, Loyalty
### Scooter Live - Map + Admin management
### Credit Score - Term selection + repayment schedule
### Support Chat - Threaded ticket system (customer↔admin)

### Car Rental Module (COMPLETE)
- Full backend (vendors, cars, bookings, contracts, invoices, handover/return, damage, payouts, disputes)
- 16 frontend pages (public, customer, vendor, admin)
- Image upload, reviews, PDF export (invoices + receipts + contracts)
- Vendor Staff Management, Reports/Analytics
- Admin Disputes, Commission per-Vendor

### Gaming Platform (11 Games, Coin Economy)
**6 Original**: Glücksrad, Rubbellos, Lucky Slots, Quiz Master, Memory, Würfelglück
**5 New**: Münzwurf, Höher/Tiefer, Minenfeld, Crash, Plinko
- Coin-based economy: Buy Coins (€1=1000), Play with Coins (bet 5-500), Win Coins, Redeem to EUR
- Cashback → Coins integration
- Coins kaufen Modal (6 Pakete: €1-€100)
- Auszahlen/Redeem (min 500 Coins → EUR)

### Auctions (20 Products 2026)
- 20 fresh 2026 products with varied prices
- Bot targets randomized per auction (€3-€6)
- Stripe Checkout option added in payment modal

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
