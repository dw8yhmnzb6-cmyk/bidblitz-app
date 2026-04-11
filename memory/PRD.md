# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Build a modern, professional fintech Super App called BidBlitz V2. 100% REAL system with NO fake/demo/seed data. Latest major feature: Complete multi-vendor car rental module (`car_rental`) inside BidBlitz.

## Core Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn/UI
- **Backend**: FastAPI, Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (via proxy, `sk_test_emergent`)
- **Auth**: JWT (cookie-based `access_token` / `refresh_token`)

## User Personas
- **Customer**: Browse cars, book, pay via wallet, manage bookings, sign contracts
- **Vendor**: Register as car rental company, manage fleet, handle bookings lifecycle (approve/handover/return), invoices, payouts
- **Admin**: Approve vendors, oversee all bookings, process payouts, platform settings

---

## Completed Features

### Phase 1 - Core Platform (DONE)
- Unified Wallet (EUR) with top-up, send, receive
- Kids GPS & Safety module
- Merchant POS with terminal
- Premium Auctions system
- Mobility Map
- Loyalty & Rewards

### Phase 2 - Gaming Hub (DONE - 2026-04-11)
- 6 games: Slot Machine, Dice, Coin Flip, Number Guess, Color Predict, Crash
- Real EUR wallet integration (`REWARD` transaction type)
- Game Center navigation from MorePage

### Phase 3 - Scooter Live (DONE - 2026-04-11)
- Live scooter map (no demo filters)
- Admin scooter management (Mobility > Scooter-Flotte in AdminPage)

### Phase 4 - Car Rental Backend Core (DONE - 2026-04-11)
- Full modular backend in `/app/backend/modules/car_rental/`
- Models, Schemas, Repository, Services, Routes, Contracts, Invoices, Utils
- 33 end-to-end bash test cases passed
- Collections: `car_rental_vendors`, `car_rental_cars`, `car_rental_bookings`, `car_rental_invoices`, `car_rental_contracts`, `car_rental_damage_reports`, `car_rental_payouts`

### Phase 5 - Car Rental Frontend Complete (DONE - 2026-04-11)
**Public Pages:**
- `CarListPage.jsx` - Browse/filter cars with search, pagination
- `CarDetailPage.jsx` - Car details, booking flow with date selection, extras, pricing, wallet payment

**Customer Pages:**
- `MyCarBookingsPage.jsx` - Booking list with tabs (Alle/Aktiv/Vergangen), cancel
- `MyBookingDetailPage.jsx` - Full booking detail, contract signing, invoice view

**Vendor Pages:**
- `VendorCarRentalDashboardPage.jsx` - Dashboard with revenue, stats, fleet status, quick actions
- `VendorCarsPage.jsx` - Fleet CRUD (create/edit/archive cars with full form)
- `VendorBookingsPage.jsx` - Booking list with status tabs, quick approve/reject/ready actions
- `VendorBookingDetailPage.jsx` - Full booking lifecycle (approve, reject, handover, return, contract/invoice generation)
- `VendorInvoicesPage.jsx` - Invoice list with status filter, mark-as-paid
- `VendorPayoutsPage.jsx` - Payout list with request payout modal
- `VendorDamagesPage.jsx` - Damage reports with resolve action
- `VendorSettingsPage.jsx` - Company info, bank details, booking settings (auto-approve, fees, etc.)

**Admin Pages:**
- `AdminCarRentalPage.jsx` - 4 tabs: Übersicht (stats), Vermieter (approve/suspend), Buchungen (all), Auszahlungen (process/reject)

**Navigation:**
- MorePage: Mietwagen, Meine Buchungen, Vermieter Dashboard links in Mobility section
- MorePage: Admin Car Rental link for admin users
- App.js: Full routing for all 15+ car rental routes including dynamic routes

---

## Architecture

### Backend Modules
```
/app/backend/modules/car_rental/
  __init__.py, models.py, schemas.py, repository.py, 
  routes.py, services.py, contracts.py, invoices.py, utils.py
```

### Frontend Modules
```
/app/frontend/src/modules/car-rental/
  api/index.js          (442 lines - full API client)
  pages/
    CarListPage.jsx, CarDetailPage.jsx,
    MyCarBookingsPage.jsx, MyBookingDetailPage.jsx,
    VendorCarRentalDashboardPage.jsx, VendorCarsPage.jsx,
    VendorBookingsPage.jsx, VendorBookingDetailPage.jsx,
    VendorInvoicesPage.jsx, VendorPayoutsPage.jsx,
    VendorDamagesPage.jsx, VendorSettingsPage.jsx,
    AdminCarRentalPage.jsx, index.js
```

### Key API Endpoints
- `GET /api/car-rental/cars/search` - Public car search
- `GET /api/car-rental/cars/{id}` - Car detail
- `POST /api/car-rental/bookings` - Create booking
- `POST /api/car-rental/bookings/{id}/pay` - Pay booking
- `GET /api/car-rental/my-bookings` - Customer bookings
- `POST /api/car-rental/vendor/register` - Vendor registration
- `GET /api/car-rental/vendor/dashboard` - Vendor dashboard
- `POST/GET /api/car-rental/vendor/cars` - Car CRUD
- `GET /api/car-rental/vendor/bookings` - Vendor bookings
- `POST /api/car-rental/vendor/bookings/{id}/approve|reject|ready|handover|return`
- `GET /api/car-rental/admin/overview` - Admin overview
- `POST /api/car-rental/admin/vendors/{id}/action` - Approve/suspend vendor

---

## Upcoming Tasks (P1/P2)
- Receipt PDF Export
- Push Notifications (Geofence alerts)
- Apple Pay / Google Pay integration
- Chat/Support System
- Car rental image upload for vehicles
- Customer reviews/ratings for cars and vendors

## Test Credentials
- Admin: `admin@bidblitz.com` / `BidBlitz2026!`
- Customer: `kunde@bidblitz.com` / `Kunde2026!`
