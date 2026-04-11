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
- **Customer**: Browse cars, book, pay via wallet, manage bookings, sign contracts, write reviews
- **Vendor**: Register, manage fleet (CRUD + image upload), handle bookings lifecycle, invoices/PDF, payouts
- **Admin**: Approve vendors, oversee bookings, process payouts, platform settings

---

## Completed Features

### Phase 1 - Core Platform (DONE)
- Unified Wallet (EUR), Kids GPS, Merchant POS, Auctions, Mobility Map, Loyalty

### Phase 2 - Gaming Hub (DONE - 2026-04-11)
- 6 games with real EUR wallet integration

### Phase 3 - Scooter Live (DONE - 2026-04-11)
- Live scooter map + Admin management

### Phase 4 - Car Rental Backend Core (DONE - 2026-04-11)
- Full modular backend in `/app/backend/modules/car_rental/`
- 33 end-to-end test cases passed

### Phase 5 - Car Rental Frontend Complete (DONE - 2026-04-11)
- 13 pages: CarList, CarDetail, MyBookings, MyBookingDetail, VendorDashboard, VendorCars, VendorBookings, VendorBookingDetail, VendorInvoices, VendorPayouts, VendorDamages, VendorSettings, AdminCarRental

### Phase 6 - P1 Features (DONE - 2026-04-11)

**6a. Fahrzeug-Bildupload:**
- Chunked file upload to `/api/car-rental/vendor/cars/{id}/upload-image`
- JPG/PNG/WebP support, max 10MB
- Auto-set first image as main, set main image, delete image
- Images stored in `/app/backend/uploads/car_rental/` served via `/api/uploads/`
- Gallery display in VendorCarsPage edit mode + CarListPage + CarDetailPage

**6b. Kunden-Bewertungen:**
- `POST /api/car-rental/reviews` - Create review (1-5 stars + comment)
- `GET /api/car-rental/cars/{id}/reviews` - Public car reviews
- `GET /api/car-rental/vendors/{id}/reviews` - Vendor reviews
- Auto-updates car and vendor average ratings
- Only completed bookings can be reviewed (one per booking)
- Review display on CarDetailPage with star ratings
- Review creation modal on MyBookingDetailPage

**6c. Receipt PDF Export:**
- `GET /api/car-rental/invoices/{id}/pdf` - Invoice PDF download
- `GET /api/car-rental/bookings/{id}/receipt-pdf` - Booking receipt PDF
- Professional German-language PDFs with reportlab
- Includes: vendor info, customer info, booking details, line items, totals, MwSt.
- Download buttons in VendorInvoicesPage and MyBookingDetailPage

---

## Architecture

### Backend Modules
```
/app/backend/modules/car_rental/
  __init__.py, models.py, schemas.py, repository.py, routes.py,
  services.py, contracts.py, invoices.py, utils.py, pdf_generator.py
```

### Frontend Modules
```
/app/frontend/src/modules/car-rental/
  api/index.js (530+ lines)
  pages/ (13 page components + index.js)
```

### Key DB Collections
- `car_rental_vendors`, `car_rental_cars`, `car_rental_bookings`
- `car_rental_invoices`, `car_rental_contracts`, `car_rental_damage_reports`
- `car_rental_payouts`, `car_rental_reviews` (NEW)

---

## Upcoming Tasks (P2)
- Push Notifications (Geofence alerts)
- Apple Pay / Google Pay integration
- Chat/Support System
- Car rental insurance management
- Multi-language support for PDF exports

## Test Credentials
- Admin: `admin@bidblitz.com` / `BidBlitz2026!`
- Customer: `kunde@bidblitz.com` / `Kunde2026!`
