# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Build a modern, professional fintech Super App called BidBlitz V2. 100% REAL system with NO fake/demo/seed data. Multi-vendor car rental module, gaming hub, scooter map, and full fintech ecosystem.

## Core Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn/UI
- **Backend**: FastAPI, Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (via proxy, `sk_test_emergent`)
- **Auth**: JWT (cookie-based)

---

## Completed Features

### Core Platform (DONE)
- Unified Wallet, Kids GPS, Merchant POS, Auctions, Mobility Map, Loyalty

### Gaming Hub (DONE)
- 6 games with real EUR wallet integration

### Scooter Live (DONE)
- Live scooter map + Admin management

### Car Rental Module (DONE)
- Full backend (vendors, cars, bookings, contracts, invoices, handover/return, damage, payouts)
- 13 frontend pages (public, customer, vendor, admin)
- Image upload for vendor cars (JPG/PNG/WebP, max 10MB)
- Customer reviews (1-5 stars + comment, auto-updates car/vendor rating)
- PDF export (invoices + booking receipts via reportlab)

### Credit Score Enhancement (DONE - 2026-04-11)
- Extended loan application with term selection (2, 6, 12, 18 months)
- Detailed cost breakdown: monthly rate, interest rate, total interest, total repayment
- Visual repayment schedule with monthly dates and remaining balance
- Proper annuity calculation with compound interest

---

## Architecture

### Backend Modules
```
/app/backend/modules/car_rental/ (models, schemas, repository, routes, services, contracts, invoices, pdf_generator, utils)
```

### Frontend Modules
```
/app/frontend/src/modules/car-rental/ (api/index.js, 13 pages)
/app/frontend/src/pages/CreditScorePage.jsx (enhanced)
```

### Key DB Collections
- car_rental_vendors, car_rental_cars, car_rental_bookings
- car_rental_invoices, car_rental_contracts, car_rental_damage_reports
- car_rental_payouts, car_rental_reviews

---

## Upcoming Tasks (P2)
- Push Notifications (Geofence alerts)
- Chat/Support System (Kunde ↔ Vendor, Kunde ↔ Admin)
- Apple Pay / Google Pay
- Car rental insurance management

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
