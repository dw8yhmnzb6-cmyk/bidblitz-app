# BidBlitz Super-App - Product Requirements Document

## Original Problem Statement
Build a full-featured "Super App" (BidBlitz) with multiple modules including Hotels (Airbnb-style), Taxi (Uber-style), Auctions, Wallet, Genius loyalty, and more. Dark-themed UI, React frontend with Tailwind CSS, FastAPI backend, MongoDB.

## Architecture
- **Frontend:** React + Tailwind CSS + Leaflet (maps) (served as static build via nginx)
- **Backend:** FastAPI with modular routers (systemd-managed)
- **Database:** MongoDB
- **Server:** IONOS VPS at 212.227.20.190
- **Domain:** bidblitz.ae

## What's Been Implemented

### Hotels Module (COMPLETE)
- Search/Filter 55 professional listings, booking, host dashboard, payouts
- Mobile-responsive dark-themed UI on all pages
- Growth features: AI descriptions, promo codes, affiliate tracking, map endpoint

### Taxi Module - Uber-Style (COMPLETE - March 2026)
- **Live map** with dark tiles (Leaflet/CartoDB)
- **Nearby taxis on map**: Simulated driver pool (12 drivers) with blue car icons visible on the map
- **"X Taxis in der Nähe"** badge showing available taxi count
- **"~X Min" ETA badge** showing nearest taxi arrival time
- **Periodic refresh**: Nearby drivers update every 4 seconds with simulated movement
- **Driver details**: Name, car model, plate, rating, ride count, vehicle type
- **Booking flow**: pickup/dropoff → vehicle select → confirm → searching → tracking → complete
- **Vehicle types**: Standard, Premium, Van
- **Live tracking** with driver location, SOS button, cancel option
- **Wallet payment** with balance check
- **Rating system** with tip support
- **Saved places & ride history**
- **Airport shortcuts** (Pristina International)

### Backend Taxi Endpoints
- `GET /api/taxi/nearby-drivers` - Simulated nearby available drivers with positions/ETA
- `GET /api/taxi/estimate` - Fare estimation
- `POST /api/taxi/request-ride` - Book a ride
- `GET /api/taxi/my-ride` - Active ride status
- `POST /api/taxi/cancel/{ride_id}` - Cancel ride
- `GET /api/taxi/history` - Ride history
- Plus: places, ratings, offers, geocoding, websocket endpoints

## Code Structure
```
/var/www/bidblitz/
├── backend/routers/
│   ├── hotels.py, hotels_host.py, hotels_level3.py, hotels_growth.py
│   ├── taxi_pro.py, taxi_extended.py, taxi_nearby.py
│   ├── taxi_geocode.py, taxi_offers.py, taxi_places.py
│   ├── taxi_ratings.py, taxi_websocket.py
│   └── ... (auth, genius, devices, etc.)
├── frontend/src/pages/
│   ├── HotelsPage.jsx, HotelDetail.jsx, HotelsHost.jsx, HotelBookings.jsx, HotelsMap.jsx
│   ├── TaxiPage.jsx, TaxiProfile.jsx
│   └── ... (other pages)
```

## Pending/Upcoming Tasks
### P1
- Reviews & Ratings for Hotels
- Star-based filter (3/4/5 star) on hotel search
- Clean up obsolete routers (hotels_booking.py, hotels_airbnb.py)

### P2
- Guest-Host chat
- Genius loyalty link in navigation
- Insurance module, Parking Finder module
- KI-Support-Chatbot
- App Store preparation

## 3rd Party Integrations
- Resend (email), Google Maps, Tawk.to (chat widget)

## Mocked Features
- Crypto Wallet, OEM Scooter Hardware, Taxi drivers (simulated positions)
