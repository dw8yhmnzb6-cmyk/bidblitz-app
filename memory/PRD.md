# BidBlitz Super-App - Product Requirements Document

## Original Problem Statement
Build a full-featured "Super App" (BidBlitz) with multiple modules including Hotels (Airbnb-style), Taxi (Uber-style with rider + driver apps), Auctions, Wallet, Genius loyalty, and more.

## Architecture
- **Frontend:** React + Tailwind CSS + Leaflet (maps)
- **Backend:** FastAPI with modular routers (systemd-managed)
- **Database:** MongoDB
- **Server:** IONOS VPS at 212.227.20.190
- **Domain:** bidblitz.ae

## Implemented Modules

### Hotels Module (COMPLETE)
- Full Airbnb-style with 55 listings, search/filter, booking, host dashboard, payouts
- Mobile-responsive dark-themed UI
- Growth features: AI descriptions, promo codes, affiliate tracking, map

### Taxi Rider App (COMPLETE)
- Live map with nearby taxi icons (simulated 12 drivers, 4s refresh)
- "X Taxis in der Nähe" + "~X Min" ETA badges
- Booking flow: pickup/dropoff → vehicle select → searching → tracking → complete
- Vehicle types: Standard, Premium, Van
- Wallet payment, rating system, saved places, history

### Taxi Driver App (COMPLETE - March 2026)
- **Registration**: Form with phone, vehicle type, make/model/plate/color
- **Admin Approval**: Drivers need admin approval before going online
- **Status Pages**: Pending approval, blocked, approved (main app)
- **Online/Offline Toggle**: Power button to go available
- **Live Map**: Dark tiles with GPS position, ride pickup/dropoff markers
- **Incoming Rides**: Auto-polling every 3s for assigned rides
- **Ride Actions**: Accept → Arrive → Start → Complete (+ Cancel)
- **Rider Info**: Name, distance, vehicle type, phone call button
- **Earnings Dashboard**: Today/Week earnings, total rides, average rating
- **Recent Rides**: List of today's completed rides with earnings
- **Tabs**: Map view + Earnings view

### Key Backend Endpoints (Taxi Driver)
- `POST /api/taxi/driver/register` - Apply as driver
- `GET /api/taxi/driver/stats` - Driver profile/status
- `POST /api/taxi/driver/online` - Go online with GPS
- `POST /api/taxi/driver/offline` - Go offline
- `POST /api/taxi/driver/location` - Update GPS position
- `GET /api/taxi/driver/pending-rides` - Get assigned rides
- `POST /api/taxi/driver/action/{ride_id}` - Accept/arrive/start/complete/cancel
- `GET /api/taxi/driver/earnings` - Today/week/total earnings + ratings
- `POST /api/taxi/admin/approve-driver/{user_id}` - Admin approval
- `GET /api/taxi/nearby-drivers` - Simulated nearby drivers

## Code Structure
```
/var/www/bidblitz/
├── backend/routers/
│   ├── taxi_pro.py (rider + driver + admin endpoints)
│   ├── taxi_nearby.py (nearby driver simulation)
│   ├── taxi_extended.py, taxi_offers.py, taxi_places.py, etc.
│   ├── hotels.py, hotels_host.py, hotels_growth.py, etc.
├── frontend/src/pages/
│   ├── TaxiPage.jsx (Rider app with nearby taxis)
│   ├── TaxiDriver.jsx (Driver app - NEW)
│   ├── TaxiProfile.jsx
│   ├── HotelsPage.jsx, HotelDetail.jsx, etc.
```

## Pending Tasks
### P1
- Reviews & Ratings for Hotels
- Star-based filter on hotel search
- Clean up obsolete routers

### P2
- Guest-Host chat, Genius loyalty, Insurance, Parking Finder
- KI-Support-Chatbot, App Store preparation

## 3rd Party Integrations
- Resend (email), Google Maps, Tawk.to

## Mocked/Simulated
- Crypto Wallet, OEM Scooter, Taxi driver positions (simulated nearby)
