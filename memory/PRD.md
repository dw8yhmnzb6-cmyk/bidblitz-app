# BidBlitz Super-App - PRD

## Architecture
Frontend: React + Tailwind + Leaflet | Backend: FastAPI | DB: MongoDB | Server: IONOS 212.227.20.190

## Level 12: Reviews, Verification, Sorting (March 2026)

### Booking-Verified Reviews
- Only guests with completed bookings can review (1 review per booking enforced)
- Status flow: PENDING → APPROVED/REJECTED by admin
- Rating 1-5 stars, title + text (max 2000 chars)
- Host reply (only for approved reviews, only by hotel owner)
- Report system (SPAM/ABUSE/FAKE/OTHER, 1 per user per review)

### Rating Aggregation
- Auto-computed avg + count per hotel (hotel_rating_agg collection)
- Updated on review create/approve/reject
- Listings response includes real rating_avg + rating_count

### Verification System
- host_verified + hotel_verified flags per hotel
- Admin sets via POST /api/admin/hotels/{id}/verify
- Listings include is_host_verified, is_hotel_verified badges

### Sorting (Hotels)
- FEATURED first (Level 11 monetization) → BOOST → then normal
- Verification badges shown in response
- Filters: min_rating, stars, price, guests, city, region, superhost

### Admin Tools (/admin/reviews)
- Tabs: PENDING / APPROVED / REJECTED
- Approve/Reject buttons + reported count display
- Full review text + host reply visible

### Collections
hotel_reviews, hotel_review_reports, hotel_verification, hotel_rating_agg

### Endpoints
- GET /api/hotels/{id}/reviews (public, sort/filter/paginate)
- POST /api/hotels/{id}/reviews (guest, booking-verified)
- POST /api/hotels/reviews/{id}/report (guest)
- POST /api/hotels/reviews/{id}/reply (host only)
- GET /api/admin/hotel-reviews (admin, filterable)
- POST /api/admin/hotel-reviews/{id}/approve
- POST /api/admin/hotel-reviews/{id}/reject
- GET /api/hotels/{id}/verification (public)
- POST /api/admin/hotels/{id}/verify (admin)

## Previous Levels
- L1-5: Hotels, Taxi (rider+driver), Admin Dashboard
- L6: Loyalty, Pricing, Coupons, Star Filter
- L7: Marketplace (Real Estate, Cars, Jobs), Search
- L10: Rate Limiting, Audit Logs, Moderation, Fraud, Business Accounts
- L11: Monetization (Boosts, Featured, Subscriptions, Revenue)

## Pending: P2
Guest-Host chat, Genius loyalty, Insurance, Parking, KI-Chatbot, App Store, Analytics Dashboard
