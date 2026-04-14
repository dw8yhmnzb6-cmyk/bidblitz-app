# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion, Mapbox GL JS (Streets v12)
- Backend: FastAPI, Motor (MongoDB), emergentintegrations (GPT-4o-mini)

## Production Status: LAUNCH-READY

### All Features (Complete)
- Wallet, POS (Barcode/NFC), Auctions, Loyalty, Marketplace, Mining, Gaming (11 games)
- Car Rental (full module, i18n), Premium Finance (7 modules, i18n)
- AI Assistant (BlitzBot), Crypto Wallet, Budget Planner
- Kids Module (GPS, Geofencing, Wallet, Tasks, Screen Time, App Control, SOS)
- Kids App (kinderfreundliches Interface: Dashboard, Wallet, Aufgaben, Chat, Anrufen, Lernspiele, SOS)
- Admin Panel (66+ Tiles mit 3 neuen Sektionen), Admin Grants & Coupons, Admin Credits
- Händler-Portal (Dashboard, Finanzen, Reservierungen, Hotel-Buchungen, Termine, Trinkgeld)
- Trinkgeld-System (POS + P2P, 2% Cashback)
- Hotel-Buchung, Event-Buchung, Restaurant-Reservierung
- Insurance Marketplace, Appointment Booking
- Social Feed / Community (Posts, Likes, Comments, Stories, Follow)
- Job-Marktplatz (Premium-Boost, CV auto-attach), CV-Builder (PDF-Export)
- Flugsuche (Economy/Business/First, 3% Cashback)
- Paketversand (5 Carrier Preisvergleich, Tracking)
- Empfehlungssystem (6 Karussells auf Startseite)
- In der Nähe (Mapbox Streets, Adress-Suche, Gespeicherte Standorte)
- Quick Access (42 Shortcuts, persistent)
- i18n 15 Sprachen, Support Chat, Referral, Mapbox Live Map

### NEW Mega-Features (Feb 2026)
- **Immobilien-Marktplatz**: 7 Seed-Inserate, Filter (Miete/Kauf/Typ/Stadt), Favoriten, Kontaktanfragen
- **Freelancer-Plattform**: 7 Freelancer + 5 Gigs, Kategorien, Projektanfragen, Skill-Filter
- **E-Learning**: 6 Kurse mit Modulen, Einschreibung, Fortschrittstracking, Zertifikate
- **Handwerker-Vermittlung**: 6 Handwerker, Kategorien (Elektriker/Klempner/Maler etc.), Buchung
- **Streaming / VoD**: 6 Filme/Serien/Dokus, Watchlist, Abo-Pläne (Basic/Premium/Family)
- **Telemedizin**: 5 Ärzte, Fachrichtungen, Videosprechstunde buchen, Terminbestätigung
- **Dating**: 6 Profile, Swipe (Like/Pass/Super-Like), Matching-System, Match-Popup
- **Gebrauchtwagen**: 5 Autos (BMW/VW/Tesla/Mercedes/Fiat), Verkäufer kontaktieren
- **Reinigungsservice**: 5 Services, Stunden-Buchung, Preisberechnung
- **Umzugsservice**: 4 Firmen, Kostenvoranschlag-Anfrage, Zimmer-Berechnung
- **Tierbetreuung**: 5 Betreuer (Hundesitter/Gassi/Katzensitter/Tier-Taxi/Tierarzt)
- **Fitness & Gym-Finder**: 5 Studios (Fitness/CrossFit/Yoga/Personal), Mitgliedschaft
- **Reiseplaner**: 5 Urlaubspakete (Städte/Strand/Aktiv/Genuss), Buchung
- **Ladesäulen-App**: 6 Stationen, Freischalten-Flow, Laden starten/stoppen, Wallet-Zahlung
- **Scooter-Abos**: 3 Pläne (Wochen-Pass 9.99€, Monats-Abo 29.99€, Jahres-Abo 249.99€)

### Admin Panel Erweiterungen (Feb 2026)
- **Marktplätze & Services** (8 Tiles): Immobilien, Freelancer, E-Learning, Handwerker, Gebrauchtwagen, Reinigung, Umzug, Tierbetreuung
- **Lifestyle & Gesundheit** (5 Tiles): Streaming, Telemedizin, Dating, Fitness, Reiseplaner
- **Mobilität & Energie** (5 Tiles): Ladesäulen, Scooter-Abos, Mietwagen, Taxi-Fleet, Pakete
- Alle mit echten API-Daten, Tabellen-View, Stats

### Seed Data (150+ Total with Photos)
- 7 Immobilien, 7 Freelancer, 5 Gigs, 6 Kurse, 6 Handwerker
- 6 Streaming-Inhalte, 5 Ärzte, 6 Dating-Profile, 5 Autos
- 5 Reinigungsservices, 4 Umzugsfirmen, 5 Tierbetreuer
- 5 Fitness-Studios, 5 Reisen, 6 Ladesäulen

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
- Kids: "Albin" (child of admin account)

## Backlog
- Apple Pay / Google Pay Integration (P1)
- Email Marketing Admin-Frontend (P1)
- Light/Dark Mode CSS Overrides perfektionieren (P2)
- Kids App Chat-Backend (WebSocket/Polling) (P1)
- i18n Übersetzungen verifizieren (P2)
- Push Notifications (P2)
