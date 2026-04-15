# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS
- Backend: FastAPI, Motor (MongoDB), CoinGecko, httpx, yfinance

## Production Status: LAUNCH-READY (95+ Services, 23+ Revenue Streams)

### Revenue Streams (23+)
1. Premium VIP Abos (4.99-14.99/Mo)
2. Reselling Marketplace (8%)
3. BlitzJobs (15%)
4. BlitzLearn/Nachhilfe (20%)
5. Digital Collectibles (0.99-2.99 + 5% Trade)
6. BlitzBattle 1v1 (10%)
7. BlitzCreator Influencer (15%)
8. Mystery Boxes (14.99-39.99)
9. Promoted Listings (1.99-6.99)
10. Werbebanner (5-99)
11. Sofort-Auszahlung (0.99)
12. Express KYC (4.99)
13. Steuerbericht (4.99)
14. Affiliate (3%)
15. Spar-Challenges (5%)
16. Live Auktionen (10%)
17. Cashback (Affiliate)
18. BlitzPark Parking (0.50/Buchung)
19. Event-Tickets Reselling (12%)
20. Micro-Credit BNPL (1.50/Kredit)
21. Gift Card Marketplace (8%)
22. Flash Deals (3/Post)
23. BlitzPay NFC (3% Haendler-Gebuehr pro Transaktion)

### Completed Features (Latest Session)
- BlitzPay NFC Contactless Payment System (DONE - Apr 2026)
  - Backend: /api/blitzpay/* (generate-token, my-token, pay, merchant-charge, history, deactivate)
  - Frontend: BlitzPayPage.jsx with NFC card visualization, pulse animation, history tab
  - Route registered in App.js (/blitzpay)
  - Navigation link in MorePage.jsx
  - 3% merchant fee on merchant-charge transactions

### Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Kunde: kunde@bidblitz.com / Kunde2026!
- Fahrer: fahrer@bidblitz.com / Fahrer2026!
- Haendler: haendler@bidblitz.com / Haendler2026!
- Promo-Codes: WELCOME10, FRIEND5, PIZZA20, BLITZ50

## Backlog
- P1: Apple Pay / Google Pay (Stripe)
- P2: i18n Module Fix (Albanian/German Translation Desync)
- P2: Social Tipping / Creator-Donations
- P3: App.js Refactoring (Code Splitting / Lazy Loading for 56+ routes)
