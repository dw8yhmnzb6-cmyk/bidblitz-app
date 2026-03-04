# BidBlitz Super-App - Product Requirements Document

## Original Problem Statement
Build a full-featured "Super App" (BidBlitz) with Hotels (Airbnb-style), Taxi (Uber-style), Auctions, Wallet, Genius loyalty.

## Architecture
- Frontend: React + Tailwind CSS + Leaflet | Backend: FastAPI | DB: MongoDB
- Server: IONOS VPS 212.227.20.190 | Domain: bidblitz.ae

## Implemented Modules

### Hotels Module (COMPLETE)
- 55 listings, search/filter, booking, host dashboard, mobile-responsive
- **Reviews & Ratings**: Post-stay reviews (1-5 stars + text), auto-updates listing average
- **Star Filter**: 3★/4★/5★ filter on search page
- **Loyalty Points**: Earn points for reviews, view balance
- **Dynamic Pricing**: Weekend surcharge (+20%)
- **Coupons**: BIDBLITZ10 (10%), WELCOME20 (20%)
- **Growth**: AI descriptions, promo codes, affiliate tracking
- **Map endpoint** for hotel locations

### Taxi Module (COMPLETE)
- **Rider App**: Nearby taxis on map, ETA badges, booking, tracking, wallet, ratings
- **Driver App** (`/taxi/driver`): Registration, admin approval, online/offline, ride management, earnings dashboard

### Admin Taxi Dashboard
- Approve/block drivers, view stats, pricing config, ride management

## Backend Routers (Hotels)
- `hotels.py` - Listings + bookings (with min_rating filter)
- `hotels_host.py` - Host management
- `hotels_level3.py` - Payouts cron
- `hotels_growth.py` - AI desc, promos, affiliate, map
- `hotels_loyalty.py` - Points system
- `hotels_dynamic_pricing.py` - Weekend pricing
- `hotels_coupons.py` - Gift/coupon codes
- `hotels_reviews.py` - Reviews & ratings

## Cleanup Done
- Removed obsolete `hotels_booking.py` and `hotels_airbnb.py` from server.py

## Pending Tasks
### P2
- Guest-Host chat, Genius loyalty, Insurance, Parking
- KI-Chatbot, App Store prep
