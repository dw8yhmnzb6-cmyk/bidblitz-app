# BidBlitz Super-App - PRD

## Architecture
Frontend: React + Tailwind + Leaflet | Backend: FastAPI | DB: MongoDB | Server: IONOS 212.227.20.190 | Domain: bidblitz.ae

## Implemented Modules

### Hotels (COMPLETE)
- 55 listings, search/filter, booking, host dashboard, payouts, mobile UI
- Reviews & Ratings, Star Filter (3/4/5★), Loyalty Points, Dynamic Pricing, Coupons
- Growth: AI descriptions, promos, affiliate, map

### Taxi (COMPLETE)
- Rider: nearby taxis on map, ETA badges, booking, tracking, wallet, ratings
- Driver App (`/taxi/driver`): registration, admin approval, online/offline, ride mgmt, earnings
- Admin: approve/block drivers, stats, pricing

### Admin Dashboard (`/admin/dashboard`) - COMPLETE March 2026
- **6 Tabs**: Statistiken, Bewertungen, Gutscheine, Hotels, Buchungen, Fahrer
- Hotel Stats: listings, active, bookings, revenue
- Taxi Stats: drivers, online, pending, rides
- Reviews: list all, delete (moderation)
- Coupons: create new codes, delete existing
- Hotels: list all DB listings, activate/deactivate
- Bookings: view all with status
- Drivers: approve pending, block problematic

## Backend Routers
- hotels.py, hotels_host.py, hotels_level3.py, hotels_growth.py
- hotels_loyalty.py, hotels_dynamic_pricing.py, hotels_coupons.py, hotels_reviews.py
- taxi_pro.py, taxi_extended.py, taxi_nearby.py, taxi_*.py
- admin_dashboard.py

## Cleanup Done
- Removed hotels_booking.py and hotels_airbnb.py from server.py

## Pending: P2
- Guest-Host chat, Genius loyalty, Insurance, Parking, KI-Chatbot, App Store
