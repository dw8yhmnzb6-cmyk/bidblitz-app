# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Production Status: LAUNCH-READY

### All Features
- Wallet, POS, Auctions, Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module), Mapbox Live Map
- Premium Finance, AI Assistant (BlitzBot), Crypto Wallet, Budget Planner
- Support Chat, Credit Score (Admin-genehmigte Kredite + Auto-Pay), Referral
- Kids Module (GPS, Geofencing, Wallet, Tasks, Screen Time, App Control, SOS, Device Status)
- Admin Grants & Coupon System (EUR/Coins/BLZ/BidCredits/KidsAbo/Premium vergeben)
- Admin Credit Management (Anträge genehmigen/ablehnen)
- Admin Panel Full Grid (48 Tiles mit echten Detail-Views)
- i18n: 15 Sprachen
- Trinkgeld-System (POS + Kunden-zu-Mitarbeiter, Cashback 2%)
- Hotel/Unterkunft-Buchung (Eigener Marktplatz, Wallet-Zahlung, 3% Cashback)
- Event-Buchung (Tickets kaufen, Standard + VIP, QR-Codes, 2% Cashback)
- Restaurant-Reservierung (Tisch buchen, Küchen-Filter, Kaution per Wallet)
- Personalisierter Schnellzugriff auf der Startseite (bis zu 8 Shortcuts, persistent)

### New Pages (2026-04-12)
- NotificationCenterPage, ContactsPage, UserStatsPage, CurrencyConverterPage
- HotelBookingPage, EventBookingPage, RestaurantReservationPage

### Tipping System
- POST /api/tips/send — Kunde sendet Trinkgeld an Mitarbeiter
- POST /api/tips/pos — POS: Händler initiiert Trinkgeld vom Kunden
- GET /api/tips/presets — Vorgeschlagene Beträge
- GET /api/tips/sent — Gesendete Trinkgelder
- GET /api/tips/received — Empfangene Trinkgelder
- 2% Cashback auf alle Trinkgelder

### Quick Access
- GET /api/user/quick-access — User-Shortcuts laden
- POST /api/user/quick-access — Shortcuts speichern (max 8)
- 20 verfügbare Shortcuts (Taxi, Scooter, Hotels, Restaurant, Events, etc.)

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Test Coupons: WELCOME25 (€25), KIDS3FREE (3M Kids Premium)

## Pending
- P1: i18n remaining pages (Car Rental 16 pages, Premium Finance 5 pages)
- P2: Car Rental Production Gaps (Contract PDF, Handover, Disputes UI)
- P2: Insurance Marketplace
- P2: Appointment Booking System
- P2: Social Feed / Community
