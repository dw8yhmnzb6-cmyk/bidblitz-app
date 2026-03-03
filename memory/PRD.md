# BidBlitz Super App - Product Requirements Document

## Original Problem Statement
Migration und Weiterentwicklung der BidBlitz Auktionsplattform zu einer vollständigen "Super App" mit umfangreichen Funktionen für den E-Commerce-Markt in Dubai und Europa.

## Core Requirements
1. **Auction Platform** - Live-Auktionen, VIP-Auktionen, Gebote-System ✅
2. **Admin Panel** - Vollständiges Management-Dashboard ✅
3. **Marketplace** - Produktlisten, Kategorien, Filter ✅
4. **Multi-Language Support** - DE, EN, TR, SQ, AR, FR ✅
5. **Mobility Module** - Taxi, Scooter, Transport ✅
6. **Services Hub** - Hotels, Versicherung, Krypto, Parken ✅
7. **Food Delivery** - Restaurantbestellungen ✅
8. **Events** - Dubai Events & Tickets ✅
9. **Partner Portal** - Partner-Management ✅
10. **BidBlitz Pay** - Wallet & Zahlungen ✅

## Completed Work (March 3, 2026)

### Hotel Booking System - Dark Theme Frontend ✅
**Status: COMPLETED (March 3, 2026)**

Deployed a new dark-themed hotel booking frontend:

**Frontend Files:**
- `/var/www/bidblitz/frontend/src/pages/HotelsPage.jsx` - Hotel search/list page
- `/var/www/bidblitz/frontend/src/pages/HotelDetail.jsx` - Hotel detail & booking page

**Backend API:**
- `/var/www/bidblitz/backend/routers/hotels.py` - Main Hotels API router

**Features:**
- Dark slate-950 background theme
- Filter system: Region, Stadt, Suche, Gäste, Max €/Nacht
- Hotel cards with images, ratings, prices
- Detailed view with photo gallery
- Booking widget with Genius discount display
- Price breakdown (subtotal, discount, total)
- Booking confirmation modal with level-up notification

**Routes:**
- `/hotels` - Hotel search/browse
- `/hotels/:id` - Hotel detail & booking

### BidBlitz Genius Level-System ✅
**Status: COMPLETED (March 3, 2026)**

Implemented a 3-tier loyalty program for hotels and Super-App:

**Backend:**
- `/var/www/bidblitz/backend/utils/genius.py` - Level calculation logic
- `/var/www/bidblitz/backend/routers/genius.py` - API endpoints
- Hook added in `/var/www/bidblitz/backend/routers/extended_services.py` (line 41)

**API Endpoints:**
- `GET /api/genius/me` - Get user's genius status
- `GET /api/genius/benefits` - Get current level benefits
- `POST /api/genius/_internal/add_activity` - Admin: add activity
- `POST /api/genius/_internal/recalc_all` - Admin: recalculate all levels

**Level Requirements:**
- Level 1 (Starter): Default - 10% Hotel-Rabatt
- Level 2 (Gold): 1.000€ OR 5 Buchungen OR 1.000 Punkte - 10-15% Rabatt + Upgrade
- Level 3 (Platinum): 5.000€ OR 15 Buchungen OR 5.000 Punkte - 10-20% Rabatt + VIP

**Frontend:**
- `/var/www/bidblitz/frontend/src/pages/GeniusProgramPage.jsx`
- Route: `/genius`

### Hotel Booking System - Backend ✅
**Status: COMPLETED (March 3, 2026)**

Full Airbnb-style backend for hotel listings and bookings:

**Backend File:**
- `/var/www/bidblitz/backend/routers/hotels_airbnb.py`

**API Endpoints:**
- `GET /api/hotels-airbnb/listings` - Search/filter listings
- `GET /api/hotels-airbnb/listings/{listing_id}` - Get listing details
- `POST /api/hotels-airbnb/listings` - Create listing (host)
- `POST /api/hotels-airbnb/bookings` - Book a listing (applies Genius discount)
- `GET /api/hotels-airbnb/user/level` - Get user's Genius level
- `POST /api/hotels-airbnb/_internal/payouts` - Process host payouts

**Features:**
- Listing management with photos, amenities, pricing
- Booking with wallet debit (uses existing debit_payment)
- Automatic Genius level discount application
- Platform fee calculation (15%)
- Host payout management

### Nginx Optimization ✅
**Status: COMPLETED (March 3, 2026)**

Optimized Nginx configuration for SPA:
- `try_files` for client-side routing
- Security headers (X-Frame-Options, CSP, etc.)
- Caching for static assets
- Reverse proxy for API

### Location Selection & Bids Display Fix ✅
**Status: COMPLETED**

1. **Dynamic Location Selector** - Users can select from UAE, Kosovo, Deutschland, Österreich, Schweiz
2. **Bids Balance Display** - Real-time bids_balance from user API

### Full-Site Translation Implementation ✅
**Status: COMPLETED**

All pages fully support multi-language translation (DE, EN, SQ, AR, TR, FR)

## Technical Architecture

### Frontend
- React 18 with React Router
- Tailwind CSS + Shadcn/UI components
- i18n system using `LanguageContext` and translation files
- Location: `/var/www/bidblitz/frontend/`

### Backend
- FastAPI (Python)
- MongoDB database
- Location: `/var/www/bidblitz/backend/`

### Database Collections
- `genius` - User loyalty level data
- `genius_events` - Audit log for level changes
- `hotel_listings` - Hotel/apartment listings
- `hotel_bookings` - Booking records

### Deployment
- Server: IONOS (212.227.20.190)
- Frontend: Nginx serving React build
- Backend: PM2/Gunicorn

## Supported Languages
1. 🇩🇪 German (de) - Default
2. 🇬🇧 English (en)
3. 🇹🇷 Turkish (tr)
4. 🇽🇰 Albanian/Kosovo (sq/xk)
5. 🇦🇪 Arabic (ar/ae)
6. 🇫🇷 French (fr)

## Upcoming Tasks (P1)
- [ ] Add Genius page link in main navigation
- [ ] Implement "Booking History" page for users

## Upcoming Tasks (P2)
- [ ] In-App Chat (Rider-Driver)
- [ ] SOS Button in Taxi App
- [ ] Taxi Fare Splitting
- [ ] App-wide Dark Mode Toggle

## Future Tasks (P3)
- [ ] Sync production server with GitHub repository
- [ ] App Store submission preparation
- [ ] KI-powered support chatbot
- [ ] Insurance Module
- [ ] Parking Finder Module
- [ ] Remove obsolete hotels_booking.py router
- [ ] Create MongoDB indexes for genius collections

## Mocked Features
- Crypto Wallet (placeholder implementation)
- OEM Scooter Hardware integration

## 3rd Party Integrations
- Resend (Email)
- Google Maps
- Tawk.to (Chat)
- Stripe (Payments)

## Credentials
- **Server:** root@212.227.20.190
- **Admin:** admin@bidblitz.ae / AfrimKrasniqi123

---
*Last Updated: March 3, 2026*
