# BidBlitz Super-App - PRD

## Architecture
Frontend: React + Tailwind + Leaflet | Backend: FastAPI | DB: MongoDB | Server: IONOS 212.227.20.190

## Level 14: Enhanced Reviews System (March 2026)

### Features
- Photos support (up to 5 URLs per review)
- Profanity auto-moderation (DE+EN keyword list + spam patterns)
- Clean reviews → auto-APPROVED, flagged → PENDING for admin
- Breakdown response: {5: count, 4: count, 3: count, 2: count, 1: count}
- Helpful votes (1 per user per review)
- Can-review check endpoint (validates booking ownership + completion + uniqueness)
- Host reply (unique per review, host-only)
- Report system (SPAM/ABUSE/FAKE/OTHER)

### Frontend
- `/hotels/:id/review/:bookingId` — Review form with 5-star selector + title + comment
- Validates can-review before showing form
- Success/error states

### Endpoints (hotels_reviews.py)
- GET /api/hotels/{id}/reviews — avg_rating, breakdown, paginated items with user+reply
- POST /api/hotels/{id}/reviews — booking-verified, profanity-checked
- POST /api/hotels/reviews/{id}/reply — host only
- POST /api/hotels/reviews/{id}/helpful — vote helpful
- POST /api/hotels/reviews/{id}/report — report abuse
- GET /api/hotels/reviews/can-review/{bookingId} — pre-check

### Admin (admin_reviews.py)
- GET /api/admin/hotel-reviews — filter by status/reported/hotel
- POST /api/admin/hotel-reviews/{id}/approve
- POST /api/admin/hotel-reviews/{id}/reject

## Previous Levels: L1-13 (Hotels, Taxi, Marketplace, Admin, Security, Monetization, Genius Loyalty)

## Pending: P2
Guest-Host Chat (L15), Insurance, Parking, KI-Chatbot, App Store, Analytics
