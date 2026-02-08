# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional features.

## Current Status (February 7, 2026)

### ✅ Phase 1 Bug Fixes Completed

**Bugs Fixed:**
1. ✅ **Refer-a-Friend Routing Bug** - Fixed duplicate route in App.js. `/freunde-werben` now correctly shows `ReferFriendsPage` instead of old `ReferralDashboard`
2. ✅ **Theme Consistency** - Updated Contact.js, FAQ.js, HowItWorks.js to use dynamic light/dark theme via `useTheme` hook
3. ✅ **Admin Auktionsdauer-Bug** - Verified working - backend correctly handles 1 Tag (86400s) duration
4. ✅ **Lint Errors** - Fixed VoiceDebugAssistant.js unescaped entities error
5. ✅ **Tournament API 520 Error** (7. Feb 2026) - Fixed MongoDB BSON error in `/api/tournaments/current`
   - Problem: Integer keys in PRIZES dictionary caused `bson.errors.InvalidDocument`
   - Lösung: Konvertierung aller Keys zu Strings (1 → "1", 2 → "2", etc.)
   - Datei: `/app/backend/routers/tournaments.py`
6. ✅ **Horizontales Scrollen für Beendete Auktionen** (7. Feb 2026)
   - Neuer "Kürzlich Beendet" Carousel-Bereich am Seitenende
   - CSS: `overflow-x-auto`, `scrollbar-hide`, `scroll-smooth`
   - Datei: `/app/frontend/src/pages/Auctions.js` (Lines 1155-1188)
7. ✅ **Gutschein-Filter Logik** (7. Feb 2026)
   - Filtert jetzt nach Produkt-Kategorie statt `is_free_auction`
   - Erkennt Kategorien: "gutschein", "voucher", "gift"
   - Neue `isVoucherProduct()` Hilfsfunktion
   - Datei: `/app/frontend/src/pages/Auctions.js` (Lines 855-865)
8. ✅ **EndedAuctionCard Datum-Fix** (7. Feb 2026)
   - Problem: `end_time` vs `ended_at` Feldname
   - Lösung: Fallback zu beiden Feldern
   - Neue Übersetzungsschlüssel: `ended`, `endedAt`
9. ✅ **Nacht-Auktionen Timer 00:00:00 Bug** (7. Feb 2026)
   - Problem: Timer zeigte 00:00:00 für pausierte Nacht-Auktionen
   - Lösung: LiveTimer Component unterstützt jetzt `isPaused` prop
   - `isNightPaused` Prüfung erkennt jetzt auch `status='night_paused'`
   - Datei: `/app/frontend/src/pages/Auctions.js` (Lines 194-269)
10. ✅ **OpenAI Bildanalyse-Fehler** (7. Feb 2026)
   - Problem: "Invalid base64 image_url" mit gpt-4o Modell
   - Lösung: Modell von gpt-4o auf gpt-4.1 aktualisiert
   - Datei: `/app/backend/routers/voice_command.py` (Lines 1199-1263)
11. ✅ **Nacht-Auktionen Benachrichtigung** (8. Feb 2026)
   - Benutzer werden automatisch benachrichtigt, wenn Nacht-Auktionen um 23:30 starten
   - Nur für Auktionen, auf die der Benutzer bereits geboten hat
   - Opt-out möglich über Benachrichtigungs-Einstellungen
   - Backend: `/app/backend/server.py` - `send_night_auction_notifications()` Funktion
   - Frontend: `/app/frontend/src/pages/Notifications.js` - Neue "🌙 Nacht-Auktionen starten" Option

### ✅ Phase 2 Feature Additions Completed

**New Features:**
1. ✅ **Leaderboard Widget "Wöchentliche Champions"** - Added to homepage showing top 3 weekly tournament participants
   - Shows user rankings with points and wins
   - "Jetzt mitmachen!" CTA button
   - Links to full /tournaments page
   - File: `/app/frontend/src/components/LeaderboardWidget.js`

2. ✅ **Albanian/Kosovo Sprachunterstützung vollständig** 🇦🇱🇽🇰
   - Alle UI-Komponenten auf Albanisch übersetzt
   - `xk` (Kosovo) zu allen lokalen Übersetzungsobjekten hinzugefügt:
     - Footer, CookieConsent, LeaderboardWidget, LiveWinnerPopup
     - BuyBids, InviteFriends, Profile, Purchases, VIP Seiten
   - Navigation vollständig: Renditja, Rrota e Fatit, Kartat Dhuratë, etc.

3. ✅ **Turnier-Push-Benachrichtigungen implementiert** 🔔
   - API-Endpunkte: `/api/tournaments/subscribe`, `/api/tournaments/notification-status`
   - Benachrichtigungen bei Position-Änderungen (Top-3 Abstieg/Aufstieg)
   - Benachrichtigungen bei Turnier-Start
   - Benachrichtigungen wenn Turnier endet (24h vorher)
   - Admin-Endpunkt für manuelle Turnier-Benachrichtigungen

4. ✅ **Admin Analytics Dashboard** 📊
   - KPI-Karten: Umsatz, Bestellungen, Neue Nutzer, Aktive Nutzer
   - Umsatzentwicklung Chart (AreaChart)
   - Conversion Funnel (BarChart): Besuche → Registrierungen → Gebote → Käufe
   - Auktionsstatistik, Engagement-Metriken, Top Seiten
   - Zeitraum-Filter (7, 14, 30, 90 Tage)
   - File: `/app/frontend/src/components/admin/AdminAnalytics.js`

5. ✅ **Admin Surveys Dashboard** 📋
   - Net Promoter Score (NPS) mit Trend-Chart
   - Promoter/Passiv/Kritiker Verteilung (PieChart)
   - Durchschnittliche Bewertung mit Sterne-Rating
   - Bewertungsverteilung (Balkendiagramm)
   - Neuestes Feedback Liste
   - File: `/app/frontend/src/components/admin/AdminSurveys.js`

6. ✅ **Automatische NPS-Umfrage nach Auktionsgewinn** 🎉
   - Popup erscheint im Dashboard nach Gewinn
   - 0-10 NPS Skala mit farblicher Kennzeichnung
   - Optionales Feedback-Feld
   - +5 Gratis-Gebote als Dankeschön
   - Mehrsprachig: DE, EN, SQ, XK, TR, FR
   - File: `/app/frontend/src/components/WinSurveyPopup.js`

7. ✅ **Produktbeschreibungen auf Auktionskarten** 📝
   - Beschreibungen werden unter Produktnamen angezeigt
   - Kursiver, grauer Text für bessere Lesbarkeit
   - Mehrsprachige Beschreibungsunterstützung
   - Modified: `/app/frontend/src/pages/Auctions.js` (AuctionCard)

8. ✅ **Personalisierte Produktempfehlungen** 🎯 (NEU - 7. Feb 2026)
   - **"Für dich empfohlen"** Widget auf der Hauptseite
   - **5 Sektionen:**
     - Weiterbieten (Auktionen auf denen User schon geboten hat)
     - Speziell für dich (basierend auf Lieblingskateorien)
     - Endet bald (Auktionen die in < 1 Stunde enden)
     - Gerade beliebt (meist gebotene Auktionen)
     - Ähnlich zu deinen Gewinnen
   - **Personalisierte Begrüßung** (Guten Morgen/Tag/Abend + Benutzername)
   - **Horizontales Scrollen** für Produktkarten
   - **Login-Aufforderung** für nicht eingeloggte Benutzer
   - Files: `/app/frontend/src/components/PersonalizedRecommendations.js`, `/app/backend/routers/personalized_homepage.py`
   - Backend API: `/api/personalized/homepage`
   - 100% getestet und funktionsfähig ✅

**Testing Status:**
- Phase 1: All fixes verified by testing agent (iteration_36.json)
- Phase 2: Leaderboard widget visually verified, Albanian language tested
- Phase 3: Personalized Recommendations verified (iteration_37.json) - 100% passed
- Phase 4: All new homepage features verified (iteration_38.json) - 100% passed

---

## New Features Added (February 7, 2026)

### Homepage Enhancements - "Mach alles rein" Phase 2
14. ✅ **Flash Sales Banner** ⚡
   - Blitzangebote mit Countdown-Timer
   - Rabatt-Anzeige und "Jetzt kaufen" Button
   - File: `/app/frontend/src/components/FlashSaleBanner.js`
   - API: `/api/flash-sales/active`

15. ✅ **Mystery Box Section** 📦
   - Bronze, Silber, Gold, Diamant Boxen
   - Wertbereich-Anzeige (€50-€5000)
   - "Jetzt bieten" Button
   - File: `/app/frontend/src/components/MysteryBoxSection.js`
   - API: `/api/mystery-box/active`

16. ✅ **Social Share Popup** 📱
   - +3 Gebote für Teilen auf Facebook/Twitter/WhatsApp/Telegram
   - Nach-Gewinn-Dialog für Sharing
   - File: `/app/frontend/src/components/SocialSharePopup.js`
   - API: `/api/social/share/{auction_id}`

17. ✅ **Auction Alarm System** 🔔
   - Benachrichtigung X Minuten vor Auktionsende
   - Inline-Button auf Auktionskarten
   - File: `/app/frontend/src/components/AuctionAlarm.js`
   - API: `/api/countdown-alarm/{auction_id}`

### i18n Übersetzungen (Phase 2)
18. ✅ **Vollständige Navigation-Übersetzungen**
   - `leaderboard` und `luckyWheel` zu allen Sprachen hinzugefügt
   - Sprachen aktualisiert: DE, EN, FR, ES, IT, RU, TR, ZH, JA, SQ, XK
   - Alle neuen Komponenten mehrsprachig (6+ Sprachen)

### Homepage Enhancements - "Mach alles rein" Phase 1
9. ✅ **Winner Gallery** 🏆
   - Zeigt echte Gewinner mit Fotos und Ersparnissen
   - Social Proof für bessere Conversion
   - Horizontales Karussell mit Navigation
   - File: `/app/frontend/src/components/WinnerGallery.js`
   - API: `/api/winners`

10. ✅ **Exit-Intent Popup** 🎁
   - Zeigt "5 Gratis-Gebote" für neue Besucher
   - Triggt bei Mausverlassen (oben) oder nach 30 Sekunden
   - Nur für nicht-eingeloggte Benutzer
   - File: `/app/frontend/src/components/ExitIntentPopup.js`

11. ✅ **Daily Quests Widget** 🎯
   - Zeigt tägliche Aufgaben mit Fortschrittsbalken
   - Belohnungen in Geboten
   - Streak-Anzeige für Login-Serie
   - File: `/app/frontend/src/components/DailyQuestsWidget.js`
   - API: `/api/daily/quests`

12. ✅ **VIP Promo Banner** 👑
   - Zeigt VIP-Vorteile für nicht-VIP-Mitglieder
   - Exklusive Auktionen, VIP-Badge, Bonus-Gebote
   - -20% Rabatt-Badge
   - File: `/app/frontend/src/components/VIPBadge.js`

13. ✅ **VIP Badge Komponente** 💎
   - 5 Tier-Level: Bronze, Silber, Gold, Platin, Diamant
   - Anzeige neben Benutzernamen
   - Files: `/app/frontend/src/components/VIPBadge.js`

---

## Architecture Overview

### Backend (86+ Routers)
- FastAPI with MongoDB
- Rate limiting via slowapi
- OpenAI integration for Voice Debug & AI recommendations
- Stripe payment processing
- Telegram bot integration

### Frontend (74+ Pages)
- React with Tailwind CSS
- Shadcn/UI components
- Dynamic Light/Dark theme system
- Real-time WebSocket updates
- 20+ language support including Albanian

---

## Key Features Implemented

### Gamification ✅
- Achievements & Badges
- Levels & XP system
- Daily Quests & Rewards
- Battle Pass
- Lucky Wheel
- Streak Protection
- **Weekly Tournaments** with Leaderboard Widget
- **Winner Gallery**

### Monetization ✅
- Stripe Payments
- Bid Packages
- VIP Subscription
- Gift Cards
- Crypto Payments

### Social ✅
- Friend Battle
- Team Auctions
- **Referral System** (with ReferFriendsPage)
- **Leaderboard Widget on Homepage**
- Winner Gallery

### AI & Personalization ✅
- AI Bid Recommendations
- Deal Radar
- Price Alerts
- Wishlist
- Optimal Bidding Times

### Admin Tools ✅
- Dashboard with stats
- User management
- Bot management
- Voice Debug Assistant (iOS/Safari compatible)
- **Debug Reports Dashboard**
- AI Chat Assistant
- **Wartungsmodus (Maintenance Mode)** - NEU!

---

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Manager:** manager.prishtina@bidblitz.de / Manager123!

---

## Mocked Services
| Service | Status | Required |
|---------|--------|----------|
| WhatsApp | MOCKED | API Token |
| Twilio SMS | MOCKED | Credentials |
| Apple Login | MOCKED | Dev Credentials |
| Tawk.to Live Chat | MOCKED | Property ID |
| Resend Email | MOCKED | Working API Key |

---

## Files Modified/Created (This Session)

### New Components:
- `/app/frontend/src/components/LeaderboardWidget.js` - Weekly Champions widget

### Route Fix:
- `/app/frontend/src/App.js` - Removed duplicate `/freunde-werben` route

### Theme Updates:
- `/app/frontend/src/pages/Contact.js` - Added useTheme hook
- `/app/frontend/src/pages/FAQ.js` - Added useTheme hook
- `/app/frontend/src/pages/HowItWorks.js` - Added useTheme hook

### Homepage Integration:
- `/app/frontend/src/pages/Auctions.js` - Added LeaderboardWidget import and render

### Lint Fixes:
- `/app/frontend/src/components/VoiceDebugAssistant.js` - Fixed unescaped entities

---

## Language Support

### Currently Supported (20+ languages):
- German (de) 🇩🇪
- English (en) 🇬🇧
- **Albanian (sq) 🇦🇱** ✅
- **Kosovo (xk) 🇽🇰** ✅
- Turkish (tr) 🇹🇷
- French (fr) 🇫🇷
- Spanish (es) 🇪🇸
- Arabic (ar) 🇸🇦
- Russian (ru) 🇷🇺
- Japanese (ja) 🇯🇵
- Korean (ko) 🇰🇷
- Hindi (hi) 🇮🇳
- And more...

---

## Next Tasks (Backlog)

### Priority 1: Admin Dashboards
- ✅ Admin Analytics Dashboard
- ✅ Admin Surveys Management Dashboard
- 🔶 Admin Tournaments Management

### Priority 2: Pending Integrations
- 🔶 Tawk.to Live-Chat (Property ID needed)
- 🔶 Apple Login (credentials needed)
- 🔶 WhatsApp/SMS notifications (API keys needed)

### Priority 3: Refactoring
- 🔶 Admin.js refactoring (>1200 lines - split into components)

---

## Test Reports
- `/app/test_reports/iteration_35.json` - Voice Debug & Bidding fixes
- `/app/test_reports/iteration_36.json` - Phase 1 Bug Fixes
- `/app/test_reports/iteration_37.json` - Personalized Recommendations Feature (100% passed)
- `/app/test_reports/iteration_38.json` - Homepage Features (100% passed)
- `/app/test_reports/iteration_39.json` - iPad Responsive & Bot Bidding
- `/app/test_reports/iteration_40.json` - Nacht-Auktionen Timer & OpenAI Fix (100% passed)
- `/app/test_reports/iteration_41.json` - Wartungsmodus & Freunde werben Link (100% passed)

---

## Last Updated
February 8, 2026

## Completed Features This Session (February 8, 2026)

### 1. ✅ B2B Großkunden-Portal (NEU!) 🏢
- **Separates Portal** unter /b2b mit eigenem Design (cyan/blau Theme)
- **Registrierung** (/b2b/register): Firma, Kontakt, E-Mail, Passwort, Steuernummer, erwartetes Volumen
- **Admin-Freischaltung**: Admin kann Rabatt (%), Kreditlimit (€), Zahlungsziel (Vorkasse/Netto 15/30) festlegen
- **Login** (/b2b/login): Separater Login für B2B-Kunden
- **Dashboard** (/b2b/dashboard) mit Tabs:
  - Übersicht: Rabatt, Kreditlimit, Verfügbar, Bestellungen, Gesamtumsatz
  - Gebote kaufen: Alle Pakete mit automatisch berechnetem Rabatt
  - Bestellungen: Bestellhistorie
  - Profil: Firmendaten
- **Backend APIs**: `/api/wholesale/auth/*`
- **Testing**: 100% bestanden (15/15 Backend, 11/11 Frontend)
- Files:
  - `/app/backend/routers/wholesale_auth.py` - Neue Auth-Endpunkte
  - `/app/frontend/src/pages/WholesaleRegister.js`
  - `/app/frontend/src/pages/WholesaleLogin.js`
  - `/app/frontend/src/pages/WholesaleDashboard.js`

### 2. ✅ Admin Wartungsmodus (Maintenance Mode) 🔧
- **Neuer Admin-Tab** "Wartung" mit Schraubenschlüssel-Icon
- **Toggle-Funktion** zum Aktivieren/Deaktivieren
- **Konfigurierbare Nachricht** für Benutzer
- **Geschätzte Dauer** mit Countdown
- **Wartungsseite** für nicht-Admin-Benutzer
- Files:
  - `/app/backend/routers/maintenance.py` - API-Endpunkte
  - `/app/frontend/src/components/admin/AdminMaintenance.js` - Admin UI
  - `/app/frontend/src/pages/MaintenancePage.js` - Benutzer-Wartungsseite

### 3. ✅ "Freunde werben" Link sichtbar 🎁
- **Desktop**: Link in der Navbar nach Glücksrad (pink, mit Gift-Icon)
- **Mobile**: Link im mobilen Menü
- **Route**: `/referral` Seite
- File: `/app/frontend/src/components/Navbar.js`

### 4. ✅ Admin Panel Mobile Responsive 📱
- **Großkunden Tab**: Tabelle durch mobile-freundliche Karten ersetzt
- **Influencer Tab**: Tabelle durch mobile-freundliche Karten ersetzt
- Alle Informationen (Rabatt, Status, Aktionen) sichtbar auf mobilen Geräten

### 5. ✅ Großkunden-Freischaltung verbessert 🏢
- Freischaltung funktioniert ohne existierendes User-Konto
- Automatische Willkommens-E-Mail mit Registrierungsaufforderung
- Automatische Verknüpfung bei Registrierung
- Files:
  - `/app/backend/routers/wholesale.py` - Erweiterte approve-Funktion
  - `/app/backend/utils/email.py` - `send_wholesale_welcome_email()`

### 6. ✅ Vollständige Übersetzungen für Auktionskarten 🌍
- **24 Sprachen** haben jetzt alle wichtigen Keys: uvp, bid, lastSoldFor, activity

### Testing Status
- `/app/test_reports/iteration_41.json` - Wartungsmodus & Freunde werben (100% passed)
- `/app/test_reports/iteration_42.json` - Großkunden & Übersetzungen (100% passed)
- `/app/test_reports/iteration_43.json` - Mobile Responsive (100% passed)
- `/app/test_reports/iteration_44.json` - B2B Portal (100% passed - 26/26 Tests)

---

## Previous Session Completed Features
1. ✅ Freunde-werben Route Fix
2. ✅ Theme-Konsistenz (Contact, FAQ, HowItWorks)
3. ✅ Admin Auktionsdauer verifiziert
4. ✅ Lint-Fehler behoben
5. ✅ **Leaderboard Widget "Wöchentliche Champions"**
6. ✅ **Albanian/Kosovo Sprachunterstützung vollständig** 🇦🇱🇽🇰
   - Alle UI-Komponenten auf Albanisch übersetzt
   - `xk` (Kosovo) zu allen lokalen Übersetzungsobjekten hinzugefügt:
     - Footer, CookieConsent, LeaderboardWidget, LiveWinnerPopup
     - BuyBids, InviteFriends, Profile, Purchases, VIP Seiten
   - Navigation vollständig: Renditja, Rrota e Fatit, Kartat Dhuratë, etc.

7. ✅ **Turnier-Push-Benachrichtigungen implementiert** 🔔
   - API-Endpunkte: `/api/tournaments/subscribe`, `/api/tournaments/notification-status`
   - Benachrichtigungen bei Position-Änderungen (Top-3 Abstieg/Aufstieg)
   - Benachrichtigungen bei Turnier-Start
   - Benachrichtigungen wenn Turnier endet (24h vorher)
   - Admin-Endpunkt für manuelle Turnier-Benachrichtigungen

8. ✅ **Admin Analytics Dashboard** 📊
   - KPI-Karten: Umsatz, Bestellungen, Neue Nutzer, Aktive Nutzer
   - Umsatzentwicklung Chart (AreaChart)
   - Conversion Funnel (BarChart): Besuche → Registrierungen → Gebote → Käufe
   - Auktionsstatistik, Engagement-Metriken, Top Seiten
   - Zeitraum-Filter (7, 14, 30, 90 Tage)
   - File: `/app/frontend/src/components/admin/AdminAnalytics.js`

9. ✅ **Admin Surveys Dashboard** 📋
   - Net Promoter Score (NPS) mit Trend-Chart
   - Promoter/Passiv/Kritiker Verteilung (PieChart)
   - Durchschnittliche Bewertung mit Sterne-Rating
   - Bewertungsverteilung (Balkendiagramm)
   - Neuestes Feedback Liste
   - File: `/app/frontend/src/components/admin/AdminSurveys.js`

10. ✅ **Personalisierte Produktempfehlungen** 🎯 (NEU - 7. Feb 2026)
   - "Für dich empfohlen" Widget auf der Hauptseite
   - 5 Sektionen basierend auf Benutzeraktivität
   - Personalisierte Begrüßung (Guten Morgen/Tag/Abend)
   - File: `/app/frontend/src/components/PersonalizedRecommendations.js`
   - Backend: `/app/backend/routers/personalized_homepage.py`
