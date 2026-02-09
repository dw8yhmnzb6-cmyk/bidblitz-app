# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional features.

## Current Status (February 8, 2026)

### ✅ Session Update - February 8, 2026 (Session 2)

**Completed in this session:**

1. ✅ **P0 Admin Panel Mobile Responsiveness - VOLLSTÄNDIG BEHOBEN**
   - Problem: Mehrere Admin-Tabs (Manager, Gutscheine, Zahlungen, Spiel-Einstellungen, Analytics) waren auf Mobile nicht responsiv
   - Lösung: Alle Tabs haben jetzt Mobile Card-Views (`md:hidden`) und Desktop Table-Views (`hidden md:block`)
   - Getestet: 8/8 Mobile Layout Tests bestanden (100% Erfolgsrate)
   - Geänderte Dateien:
     - `/app/frontend/src/pages/Admin.js` - Manager Tab responsive gemacht
     - `/app/frontend/src/components/admin/AdminGameConfig.js` - Header und Cards responsiv
     - `/app/frontend/src/components/admin/AdminAnalytics.js` - KPI Cards und Charts responsiv

2. ✅ **NEUES FEATURE: Mobile-Traffic-Analytics-Widget**
   - Automatisches Device-Tracking für alle Besucher (Mobile, Tablet, Desktop)
   - Device-Summary-Cards mit Prozentanteilen
   - Geräte-Trend-Chart (Stacked Area Chart)
   - Geräte-Verteilung-Pie-Chart
   - Betriebssystem- und Browser-Statistiken
   - Neue Dateien:
     - `/app/frontend/src/hooks/useDeviceTracking.js` - Device-Detection Hook
     - `/app/backend/routers/analytics.py` - Neue Endpoints: `/track-device`, `/devices`
   - Geänderte Dateien:
     - `/app/frontend/src/App.js` - Device-Tracking Hook integriert
     - `/app/frontend/src/components/admin/AdminAnalytics.js` - Widget hinzugefügt

3. ✅ **NEUES FEATURE: Wöchentliche E-Mail-Analytics-Reports**
   - E-Mail-Abonnement für wöchentliche Zusammenfassungen
   - HTML-E-Mail-Template mit Nutzer-, Umsatz-, Auktions- und Geräte-Statistiken
   - "Jetzt senden" Button für manuellen Versand
   - Resend-Integration für E-Mail-Versand
   - Neue Dateien:
     - `/app/backend/routers/analytics_reports.py` - Neue Endpoints: `/subscribe`, `/send-now`, `/settings`
   - Geänderte Dateien:
     - `/app/backend/server.py` - Router registriert
     - `/app/frontend/src/components/admin/AdminAnalytics.js` - E-Mail-Widget hinzugefügt

4. ✅ **P0 Additional Admin Mobile Fixes** (User-Reported Issues)
   - **VIP-Auktionen Tab**: Neue mobile Card-View mit Produktbild, VIP-Badge, Stats-Grid, Action-Buttons
   - **Großkunden (B2B) Tab**: Bewerbungen-Sektion mit mobile-optimierten Kontaktinfos und Full-Width Buttons
   - Getestet: 3/3 Mobile Layout Tests bestanden (100% Erfolgsrate)
   - Geänderte Dateien:
     - `/app/frontend/src/components/admin/AdminVIPAuctions.js` - Neue md:hidden Card-View
     - `/app/frontend/src/components/admin/AdminWholesale.js` - Applications-Grid optimiert

5. ✅ **B2B Stripe Checkout Integration** (User-Reported Issue)
   - Problem: Prepaid B2B-Kunden konnten keine Gebote kaufen (Bestellungen blieben auf "awaiting_payment")
   - Lösung: Stripe Checkout Session für Prepaid-Kunden implementiert
   - Kredit-Kunden können weiterhin direkt bestellen (Kreditlimit)
   - Webhook für automatische Gebot-Gutschrift nach Zahlung
   - Neue Endpoints:
     - `POST /api/wholesale/auth/checkout` - Erstellt Stripe Checkout Session
     - `POST /api/wholesale/auth/webhook/payment` - Verarbeitet Zahlungsbestätigung
     - `GET /api/wholesale/auth/order/{order_id}/status` - Bestellstatus abrufen
   - Geänderte Dateien:
     - `/app/backend/routers/wholesale_auth.py` - Stripe Checkout hinzugefügt
     - `/app/frontend/src/pages/WholesaleDashboard.js` - Checkout-Redirect implementiert

6. ✅ **Wartungsmodus verifiziert** (User-Reported Issue)
   - Backend-API funktioniert korrekt (toggle, status)
   - Frontend AdminMaintenance.js funktioniert korrekt
   - Toggle zwischen "System Online" und "Wartungsmodus AKTIV" funktioniert

7. ✅ **Admin.js Dashboard-Tab Refactoring**
   - Dashboard-Tab inline Code durch AdminDashboard-Komponente ersetzt
   - Admin.js von **3143** auf **2902** Zeilen reduziert (-241 Zeilen)
   - Geänderte Dateien:
     - `/app/frontend/src/pages/Admin.js` - Dashboard-Code durch Komponenten-Aufruf ersetzt
     - `/app/frontend/src/components/admin/AdminDashboard.js` - Aktualisiert mit neuen Props

8. ✅ **Auctions.js Code-Analyse**
   - 1263 Zeilen, bereits gut strukturiert mit memo-Komponenten
   - Wiederverwendbare Komponenten erstellt in `/app/frontend/src/components/auction/`
   - Lokale Komponenten beibehalten, da sie seitenspezifisch sind

---

### Stripe Webhook Konfiguration (MANUELL ERFORDERLICH)

Um B2B Zahlungen vollständig zu aktivieren, muss der Stripe Webhook im Stripe Dashboard konfiguriert werden:

1. Gehe zu **Stripe Dashboard** → **Developers** → **Webhooks**
2. Klicke auf "Add endpoint"
3. URL: `https://bidblitz-mobile.preview.emergentagent.com/api/wholesale/auth/webhook/payment`
4. Events: Wähle `checkout.session.completed`
5. Kopiere das **Webhook Signing Secret** und füge es in `backend/.env` als `STRIPE_WEBHOOK_SECRET=whsec_...` ein
6. Starte Backend neu: `sudo supervisorctl restart backend`

---

### ✅ Session Update - February 8, 2026 (Session 1)

**Completed in this session:**

1. ✅ **P0 Admin Panel Responsive Bug - BEHOBEN**
   - Problem: Admin Tabellen waren auf Mobile abgeschnitten
   - Ursache: `Admin.js` verwendete inline-Code statt der refactored Komponenten
   - Lösung: Payments, Users, Products Tabs verwenden jetzt die Komponenten mit responsive Card-View
   - Dateien: `/app/frontend/src/pages/Admin.js`

2. ✅ **Enhanced Affiliate Dashboard**
   - Real-time KPI-Cards: Konversionsrate, Ø Bestellwert, Ø Provision, Kundenwert
   - Interaktive Charts mit recharts: Einnahmen (30 Tage), Anmeldungen vs. Käufe
   - Performance-Zusammenfassung mit dynamischer Bewertung (Exzellent/Gut/Potenzial)
   - Vollständige DE/EN Übersetzungen
   - Datei: `/app/frontend/src/pages/InfluencerDashboard.js`

3. ✅ **B2B Kunden-Management für Großkunden**
   - Kunden über 8-stellige Kundennummer hinzufügen
   - Gebote an verknüpfte Kunden senden mit optionaler Nachricht
   - Transfer-Historie mit Datum, Empfänger, Betrag und Kosten
   - Stats: Verknüpfte Kunden, Gesendete Gebote, Kosten gesamt
   - Backend APIs: `/api/wholesale/auth/add-customer`, `/send-bids`, `/my-customers`, `/bid-transfers`
   - Datei: `/app/frontend/src/pages/WholesaleDashboard.js`
   - Datei: `/app/backend/routers/wholesale_auth.py`

4. ✅ **AI-Preisempfehlungen**
   - Produktempfehlungen basierend auf Benutzerverhalten und Lieblingskategorien
   - Smart Alerts für endende Auktionen und neue Produkte
   - Paket-Empfehlung basierend auf Guthaben und Aktivität
   - Frontend-Widget mit Produktkarten und Match-Score
   - Dateien: `/app/backend/routers/ai_bid_recommendations.py`, `/app/frontend/src/components/AIRecommendations.js`

5. ✅ **Push-Benachrichtigungen aktiviert**
   - VAPID-Keys verbunden
   - User-Toggle für Push-Subscriptions
   - Benachrichtigungstypen: Auktion endet, Überboten, Gewonnen, Neue Auktionen, Promotionen
   - Service Worker erweitert für Push-Events
   - Admin-Endpoint zum Senden von Benachrichtigungen
   - Dateien: `/app/backend/routers/push_notifications.py`, `/app/frontend/src/components/PushNotificationSettings.js`

6. ✅ **Admin.js Refactoring (Teil 1)**
   - Staff-Tab zu separater Komponente extrahiert
   - Responsive Mobile-Ansicht hinzugefügt
   - Datei von 3132 auf 2988 Zeilen reduziert
   - Neue Datei: `/app/frontend/src/components/admin/AdminStaff.js`

---

## Architecture

### Backend
- FastAPI with MongoDB
- WebSocket for real-time updates
- JWT Authentication
- RBAC with roles and permissions

### Frontend (74+ Pages)
- React with Tailwind CSS
- Shadcn/UI components
- Dynamic Light/Dark theme system
- Real-time WebSocket updates
- 24 language support including Albanian

---

## Key Features Implemented

### Gamification ✅
- Achievements & Badges
- Levels & XP system
- Daily Quests & Rewards
- Battle Pass
- Lucky Wheel
- Weekly Tournaments with Leaderboard Widget
- Winner Gallery

### Monetization ✅
- Stripe Payments
- Bid Packages
- VIP Subscription
- Gift Cards
- Crypto Payments

### Social ✅
- Friend Battle
- Team Auctions
- Referral System (with ReferFriendsPage)
- Social Sharing Rewards
- Leaderboard Widget on Homepage
- Winner Gallery

### AI & Personalization ✅
- **AI Bid Recommendations** (NEW!)
- **AI Product Recommendations** (NEW!)
- **Smart Alerts** (NEW!)
- Deal Radar
- Price Alerts
- Wishlist
- Optimal Bidding Times

### B2B Wholesale Portal ✅
- Separate Login/Registration
- Discount-based pricing
- Credit system
- Order history
- **Customer Management** (NEW!)
- **Bid Transfers to Customers** (NEW!)

### Admin Tools ✅
- Dashboard with stats
- User management
- Bot management
- Voice Debug Assistant
- Debug Reports Dashboard
- AI Chat Assistant
- Maintenance Mode
- **Staff Management** (Refactored!)
- **Push Notification Admin** (NEW!)

---

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **B2B Customer:** test@grosshandel.de / Test123!
- **Influencer:** demo@influencer.test / demo

---

## Mocked Services
| Service | Status | Required |
|---------|--------|----------|
| WhatsApp | MOCKED | API Token |
| Twilio SMS | MOCKED | Credentials |
| Apple Login | MOCKED | Dev Credentials |
| Tawk.to Live Chat | MOCKED | Property ID |
| Resend Email | ACTIVE | Working API Key |

---

## Files Modified/Created (This Session)

### New Features:
- `/app/frontend/src/components/AIRecommendations.js` - KI-Empfehlungen Widget
- `/app/frontend/src/components/PushNotificationSettings.js` - Push-Einstellungen
- `/app/frontend/src/components/admin/AdminStaff.js` - Staff Management Komponente
- `/app/backend/routers/push_notifications.py` - Push Notifications API

### Enhanced:
- `/app/frontend/src/pages/InfluencerDashboard.js` - Real-time Charts & KPIs
- `/app/frontend/src/pages/WholesaleDashboard.js` - B2B Kunden-Management
- `/app/backend/routers/wholesale_auth.py` - B2B Customer APIs
- `/app/backend/routers/ai_bid_recommendations.py` - Product Recommendations API
- `/app/frontend/src/pages/Dashboard.js` - AI Recommendations & Push Settings integriert

### Admin Panel Refactoring:
- `/app/frontend/src/pages/Admin.js` - Staff-Tab ausgelagert, ~145 Zeilen reduziert
- `/app/frontend/src/components/admin/index.js` - AdminStaff Export hinzugefügt

### Bug Fixes:
- `/app/frontend/src/pages/Admin.js` - Payments, Users, Products Tabs verwenden jetzt responsive Komponenten

---

## Backlog / Upcoming Tasks

### P1 (High Priority)
- [ ] Admin.js weiter refactoren (Dashboard-Tab, Jackpot-Tab, etc.)
- [ ] Auctions.js Refactoring (>1100 Zeilen)

### P2 (Medium Priority)
- [ ] Tawk.to Live Chat finalisieren (Credentials benötigt)
- [ ] Apple Login finalisieren (Credentials benötigt)
- [ ] Auktionsdauer-Bug Frontend verifizieren
- [ ] Maintenance Mode Toggle-Logik korrigieren

### P3 (Low Priority)
- [ ] Lint-Warnungen in VIPAuctions.js beheben
- [ ] Lint-Warnungen in Admin.js beheben
- [ ] i18n für alle neuen Komponenten erweitern

---

## Language Support (24 languages)
German, English, Albanian, Kosovo, Turkish, French, Spanish, Italian, Dutch, Polish, Portuguese, Russian, Arabic, Chinese, Japanese, Korean, Hindi, Swedish, Norwegian, Danish, Finnish, Greek, Romanian, Czech
