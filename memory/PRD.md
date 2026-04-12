# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Production Status: LAUNCH-READY

### All Features (Complete List)
- Wallet, POS, Auctions, Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module + Contract PDF + Handover Photos + Disputes + i18n)
- Mapbox Live Map
- Premium Finance (Credit Score, BNPL, Virtual Cards, Savings, Split Bill, Bills, Gift Cards — all with i18n)
- AI Assistant (BlitzBot), Crypto Wallet, Budget Planner
- Support Chat, Referral System
- Kids Module (GPS, Geofencing, Wallet, Tasks, Screen Time, App Control, SOS, Device Status)
- Admin Panel Full Grid (48 Tiles with real detail views)
- Admin Grants & Coupon System
- Admin Credit Management (Approve/Reject + Auto-Pay)
- Trinkgeld-System (POS + Customer-to-Staff, 2% Cashback)
- Hotel/Unterkunft-Buchung (Own Marketplace, 10 Seed Properties with photos, 3% Cashback)
- Event-Buchung (Tickets Standard + VIP, 10 Seed Events with photos, 2% Cashback)
- Restaurant-Reservierung (12 Seed Restaurants with photos, Cuisine Filters)
- Insurance Marketplace (11 Products: Kfz, Reise, Handy, Hausrat, Haftpflicht, Kranken, Leben, Tier — with photos, 2% Cashback)
- Appointment Booking (10 Providers: Friseur, Arzt, Kosmetik, Fitness, Anwalt, KFZ-Werkstatt, Handwerker — with photos)
- Social Feed / Community (Posts, Likes, Comments, Stories, Follow System — 10 Seed Posts with photos)
- Personalized Quick Access Bar (up to 8 shortcuts, persistent in MongoDB, 23 available options)
- Notification Center, Contacts, User Stats, Currency Converter
- i18n: 15 Languages, all 23 Car Rental + Premium Finance pages with useI18n()

### Seed Data Summary (63 Total Entries with Photos)
- 10 Hotels (Dubai, Berlin, München, Antalya, Wien, Istanbul, Zürich)
- 10 Events (Concerts, Sports, Comedy, Theater, Festivals)
- 12 Restaurants (10 Cuisines: Italian, Japanese, Turkish, German, Indian, Mexican, French, Asian, American, Mediterranean)
- 11 Insurance Products (8 Categories)
- 10 Appointment Providers (7 Branches)
- 10 Social Feed Posts

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Test Coupons: WELCOME25 (€25), KIDS3FREE (3M Kids Premium)

## Backlog
- Apple Pay / Google Pay Integration
- Flugsuche & Paketversand Module
- Empfehlungssystem (Beliebte Hotels/Events basierend auf Standort)
