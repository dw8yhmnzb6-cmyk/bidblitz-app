# BidBlitz Super-App - PRD

## Architecture
Frontend: React + Tailwind + Leaflet | Backend: FastAPI | DB: MongoDB | Server: IONOS 212.227.20.190

## Level 10 Production-Grade Features (March 2026)

### Security & Rate Limiting
- MongoDB-backed rate limits (key: ip+user+route, 60/min + 300/10min windows)
- Auto-block on exceed with 429

### Audit Logs
- All critical actions logged to `audit_logs` collection
- Admin endpoint: `GET /api/admin/audit?action=&actor=&limit=`

### Marketplace Moderation
- Auto-moderation on listing create: banned keyword check, spam detection, risk scoring (0-100)
- Status: approved/pending/rejected with flagged_terms
- Admin review: `GET /api/admin/marketplace/review` + `PATCH /api/admin/marketplace/{id}`

### Fraud Detection
- Fraud event recording for: failed payments, cancel abuse, promo abuse, high-freq posts
- Auto-flag users with 10+ events/day
- Admin: `GET /api/admin/fraud?type=&user_id=`

### Business Accounts (KYC-lite)
- `POST /api/business/create` with pending status + kyc_level=none
- `GET /api/business/me` + `PATCH /api/business/me`

### Hotels Dynamic Pricing (Real Logic)
- Per-night pricing with: weekend +20%, seasonal multiplier by month, occupancy surcharge
- `GET /api/hotels/pricing/quote?listing_id=&checkin=&checkout=` returns full breakdown
- Host can set rules: `POST /api/hotels/host/pricing/rules`
- Admin override: `PATCH /api/admin/hotels/pricing/override/{listing_id}`

### Frontend
- `/admin/audit` - Audit log viewer with action filter
- `/admin/fraud` - Fraud events viewer with type filter

## All Backend Routers
security_rate_limit, audit_logs, marketplace_moderation, fraud_signals, business_accounts, hotels_pricing
+ hotels (7 routers), taxi (8 routers), admin_dashboard, marketplace_extended, ai_search, recommendations, user_reputation

## Pending: P2
Guest-Host chat, Genius loyalty, Insurance, Parking, KI-Chatbot, App Store
