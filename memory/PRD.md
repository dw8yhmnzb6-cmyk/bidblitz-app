# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)
- Payments: Stripe (proxy), JWT Auth (cookies)

## Production Status: LAUNCH-READY

### All Features
- Wallet, POS, Auctions, Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module with Contract PDF, Handover Photos, Disputes, Invoices PDF)
- Mapbox Live Map
- Premium Finance, AI Assistant (BlitzBot), Crypto Wallet, Budget Planner
- Support Chat, Credit Score (Admin-genehmigte Kredite + Auto-Pay), Referral
- Kids Module (GPS, Geofencing, Wallet, Tasks, Screen Time, App Control, SOS, Device Status)
- Admin Grants & Coupon System
- Admin Panel Full Grid (48 Tiles mit echten Detail-Views)
- Trinkgeld-System (POS + Kunden-zu-Mitarbeiter, 2% Cashback)
- Hotel/Unterkunft-Buchung (Eigener Marktplatz, 10 Seed-Properties mit Fotos)
- Event-Buchung (Tickets Standard + VIP, 10 Seed-Events mit Fotos)
- Restaurant-Reservierung (Tisch buchen, 12 Seed-Restaurants mit Fotos)
- Personalisierter Schnellzugriff (bis zu 8 Shortcuts, persistent)
- i18n: 15 Sprachen, alle 23 Car Rental + Premium Finance Seiten mit useI18n()
- Notification Center, Contacts, User Stats, Currency Converter

### Seed Data (32 Einträge mit Fotos)
- 10 Hotels (Dubai, Berlin, München, Antalya, Wien, Istanbul, Zürich)
- 10 Events (Konzerte, Sport, Comedy, Theater, Festivals)
- 12 Restaurants (Italienisch, Japanisch, Türkisch, Deutsch, Indisch, Mexikanisch, Französisch, Asiatisch, Amerikanisch, Mediterran)

### Car Rental Production Status: COMPLETE
- Contract PDF Generation ✅
- Handover Photo Upload ✅
- Vendor Staff UI ✅
- Admin Disputes UI ✅
- Vendor Reports UI ✅
- Admin Commission ✅
- Invoice PDF ✅

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Test Coupons: WELCOME25 (€25), KIDS3FREE (3M Kids Premium)

## Pending
- P2: Insurance Marketplace
- P2: Appointment Booking System
- P2: Social Feed / Community
- Backlog: Apple Pay / Google Pay integration
