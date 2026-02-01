# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Core Features Implemented

### User System
- User registration with email verification
- JWT-based authentication
- Customer numbers (8-digit) for gifting
- VIP membership tiers
- Influencer accounts with free VIP access

### Auction System
- Real-time penny auctions with WebSocket updates
- Bot system (dual-mode: activity & sniper)
- Auction of the Day feature
- VIP-only auctions
- Auto-restart (3s delay)
- Timer extension on bids (10-15s)

### Payment Integration
- Stripe (LIVE keys configured)
- Bid packages
- Coinbase Commerce (disabled)

### Gift System (NEW)
- Customer numbers for all users
- Gift bids to friends/family
- Gift history tracking
- Notifications for recipients

### Influencer System
- Influencer login with code + email
- Free VIP access (never expires)
- 100 welcome bids
- Commission tracking (default 10%)
- Payout requests (min €50)
- Bank transfer / PayPal payouts

### Internationalization
- 5+ languages: DE, EN, TR, FR, SQ
- Multi-language product names
- Full page translations

## Technical Architecture

### Frontend
- React 18 with React Router
- Tailwind CSS + Shadcn/UI
- WebSocket for real-time updates
- i18n context for translations

### Backend
- FastAPI with async support
- MongoDB database
- JWT authentication
- WebSocket manager

### Key Files
- `/app/backend/server.py` - Main server + bot logic
- `/app/frontend/src/pages/Auctions.js` - Main auction display
- `/app/frontend/src/pages/Admin.js` - Admin panel (refactoring in progress)
- `/app/backend/routers/gifts.py` - Gift system
- `/app/backend/routers/influencer.py` - Influencer system

## Completion Status

### Completed (✅)
- User authentication
- Auction system with bots
- Stripe payments
- VIP system
- Influencer system with VIP + payouts
- Gift bidding system
- Multi-language support
- Admin panel (basic)

### In Progress (🔄)
- Admin.js refactoring (~45%)
- "Not Found" toast issue (mitigated)

### Recently Completed (January 31, 2026)
- ✅ Hide "NEUSTART" (Restarting) status from customers
  - AuctionDetail.js: Shows "BEENDET" instead of "NEUSTART" 
  - Home.js: Timer shows "Beendet" when expired
  - Updated translations for ended/auctionEnded
- ✅ Admin Voice Commands tested and verified:
  - get_stats, create_voucher, add_bids_to_user
  - make_vip, remove_vip, create_report (week/month)
  - All 23 commands functional via GPT-4o-mini parsing

### Pending (📋)
- 2FA implementation
- PayPal integration
- Live chat (needs Tawk.to ID)
- Router consolidation (user.py + users.py)

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Customer:** kunde@bidblitz.de / Kunde123!
- **Influencer:** Code: demo, Email: demo@influencer.test

## API Endpoints

### Authentication
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me

### Auctions
- GET /api/auctions
- POST /api/auctions/{id}/bid
- GET /api/auction-of-the-day

### Gifts
- GET /api/gifts/my-customer-number
- GET /api/gifts/lookup/{number}
- POST /api/gifts/send
- GET /api/gifts/history

### Influencer
- POST /api/influencer/login
- GET /api/influencer/stats/{code}
- GET /api/influencer/payout/balance/{code}
- POST /api/influencer/payout/request/{code}

### VIP
- GET /api/vip/status
- GET /api/vip/plans

### Voice Commands (Admin)
- POST /api/voice-command/transcribe (audio file → text → parsed command)
- POST /api/voice-command/execute (text command → parsed → optional execution)
- POST /api/voice-command/confirm-execute (execute confirmed action)

## Known Issues
1. Influencer login redirect sometimes fails (workaround: localStorage)
2. "Not Found" toast appears intermittently (404 interceptor added)
3. Data persistence may be lost on server restart

## Last Updated
February 1, 2026 (Session 4)

## Changelog
- 2026-01-31: **FEATURE** Influencer Auszahlungsanfragen
  - Neuer Backend-Endpoint: `/api/influencer/payout/request`
  - Neuer Backend-Endpoint: `/api/influencer/payout/history/{code}`
  - Dashboard zeigt: Gesamt verdient, Bereits ausgezahlt, Verfügbar
  - Mindestauszahlung: €10.00
  - Zahlungsmethoden: PayPal, Banküberweisung, Kryptowährung
  - Auszahlungshistorie mit Status (Pending, Completed, Rejected)
- 2026-01-31: **FIXED** Produktübersetzungen auf Startseite
  - Home.js verwendet jetzt useLanguage() Hook
  - AuctionCard zeigt name_translations basierend auf ausgewählter Sprache
- 2026-01-31: **FEATURE** Influencer Dashboard komplett überarbeitet
  - Login mit E-Mail + Code zur Statistik-Ansicht
  - Tier-Fortschritt mit visueller Progress-Bar
  - Statistiken: Kunden, Umsatz, Provision, Käufe
  - Letzte Aktivitäten mit Kunden-Details
  - Tipps für mehr Erfolg
- 2026-01-31: **FEATURE** Influencer Staffelprovisionen (Tiered Commissions)
  - Bronze: 0-10 Kunden (Basis), Silber: 11-50 (+2%), Gold: 51-100 (+3%), Platin: 100+ (+5%)
  - Backend calculates effective commission based on unique customers
  - Frontend shows tier badges, bonuses, and progress to next tier
- 2026-01-31: **FIXED** Bot-Bieten für neue Auktionen
  - `/bid-to-price` endpoint now works for scheduled auctions (saves target for later)
  - Returns success message instead of error for non-active auctions
- 2026-01-31: **FIXED** WebSocket URLs corrected
  - Changed `/ws/auctions/all_auctions` to `/api/ws/auctions` in Home.js, Auctions.js, VIPAuctions.js
  - Fixes "Connection refused" errors in browser console
- 2026-01-31: **MAJOR REFACTOR** Admin.js reduced from 3461 to 2118 lines (-39%)
  - Extracted AdminPages, AdminBanners, AdminInfluencers, AdminWholesale, AdminGameConfig
  - All 16 admin components now in /app/frontend/src/components/admin/
- 2026-01-31: **FIXED** Voice command "Erstelle X Bots mit Y Namen" now correctly parsed as `create_bots`
  - Improved GPT prompt with clear distinction between create_bots vs start_bots/stop_bots
  - Added trigger words documentation in system prompt
  - Added explicit examples for bot creation commands
- 2026-01-31: **ADDED** "Aktion des Tages" option to auction creation form
  - New auction type button in AdminAuctions.js
  - Automatically sets auction as "Auction of the Day" when selected
  - Four auction types now available: Tagesaktion, Nachtaktion, VIP-Aktion, Aktion des Tages
- 2026-01-31: Fixed "NEUSTART" display issue - now shows "BEENDET" for ended auctions
- 2026-01-31: Tested and verified all 23 admin voice commands
- 2026-01-31: Added translation keys for auctionEnded in DE and EN
- 2026-01-31: Added BATCH COMMAND support - combine multiple actions in one command
- 2026-01-31: Fixed create_auctions bug with product name/description structure
- 2026-01-31: Improved delete_auctions logic for status="all"
- 2026-01-31: Added new voice command examples in admin UI
- 2026-01-31: Added PRODUCT TRANSLATION feature:
  - Backend: `/api/admin/products/{id}/translate` and `/api/admin/products/translate-all`
  - Voice command: "Übersetze alle Produkte auf Englisch und Türkisch"
  - Frontend: AuctionCard and AuctionDetail now use translations based on language
  - Products now have `name_translations` and `description_translations` fields
- 2026-01-31: Added GIFT CARD SYSTEM:
  - Backend: `/api/giftcards/*` endpoints for purchase, redeem, validate
  - Fixed packages: €10, €25, €50, €100 + Custom amounts (€5-€500)
  - Redemption as bids OR account balance (not withdrawable)
  - Email notification to recipients with beautiful card design
  - Frontend: `/giftcards` page with 3-step purchase flow
  - Navbar link added
- 2026-01-31: Fixed voice command execution (Body instead of Query parameters)
- 2026-01-31: Fixed bot bid_count not updating
- 2026-01-31: Added DAY/NIGHT AUCTION SCHEDULER:
  - Automatic switch at 23:30 (night start) and 06:00 (day start)
  - Day auctions pause during night, night auctions pause during day
  - Admin endpoints for setting auction day/night mode
  - Status: day_paused, night_paused for paused auctions

## February 1, 2026 Changelog

- 2026-02-01: **FIXED** Influencer Dashboard Mobile Layout
  - Payout section now uses responsive stacked layout (grid-cols-1 on mobile, grid-cols-3 on desktop)
  - Stats display "Label" on left, "Value" on right on mobile for better readability
  - "Anfordern" button shortened on mobile to prevent overflow
  - Added data-testid for payout button
  
- 2026-02-01: **FIXED** Tier Progress Mobile Layout
  - Changed from grid-cols-4 to grid-cols-2 on mobile for 2x2 grid
  - Reduced padding on mobile (p-3 instead of p-4)
  - Added data-testid for each tier (tier-bronze, tier-silber, etc.)
  
- 2026-02-01: **IMPROVED** Voice Command Translation
  - Enhanced system prompt with better trigger words for translate_products
  - Default to all 5 languages (en, tr, fr, sq, ar) when no specific languages mentioned
  - Added multiple example translations to GPT prompt
  - Fixed translate_products to handle both string and dict product name formats
  - Shows skipped count for already-translated products
  - Better German confirmation messages
  - Increased product limit from 100 to 500 for translate_products and check_translations

- 2026-02-01: **NEW** Voice Command "check_translations" / "Übersetzung überprüfen"
  - New command to check translation status of all products
  - Shows: total products, fully translated, partially translated, not translated
  - Lists missing translations by language
  - Shows overall translation percentage
  - Provides helpful tip to translate missing products
  - Trigger words: "Übersetzung überprüfen", "Übersetzungen prüfen", "funktioniert nicht so richtig"

- 2026-02-01: **FIXED** Influencer-Code Card Mobile Layout
  - Changed from side-by-side to stacked layout on mobile (flex-col on mobile, flex-row on desktop)
  - Commission percentage now visible on mobile with "Aktuelle Provision" label
  - Description text uses smaller font (text-xs) on mobile with leading-relaxed
  - Influencer code text reduced to text-2xl on mobile for better fit

- 2026-02-01: **IMPROVED** Influencer Login Persistence
  - Now saves `influencer_token` separately in localStorage
  - Validates session on page load by fetching stats
  - Clears storage if session is invalid
  - Shows success toast on logout

- 2026-02-01: **NEW** Image Analysis Feature for Voice Commands
  - New `/api/voice-command/analyze-image` endpoint
  - Accepts image upload (PNG, JPG, GIF, WebP up to 10MB)
  - Uses GPT-4o Vision to analyze screenshots
  - Admin can upload UI screenshots to identify bugs
  - Results displayed in voice command result area
  - New UI section with drag-and-drop image upload
  - **FIXED** Changed from `image_urls` to `file_contents` with `ImageContent` class

- 2026-02-01: **FIXED** Translation System
  - AuctionOfTheDay.js now uses i18n translations for all text
  - Added missing translations: `auctionOfDay`, `currentPrice`, `remaining`, `bidNow`, `lastBidder`
  - Navbar now uses t() function for `giftCards` and `vipAuctions`
  - Added Turkish translations for `nav.giftCards` and `nav.vipAuctions`
  - Added German translations for `nav.giftCards` and `nav.vipAuctions`
  - Product names now display in selected language using `name_translations`

- 2026-02-01: **TESTED** All bug fixes verified by testing agent (100% pass rate)
  - Test file created: /app/backend/tests/test_voice_translation.py

- 2026-02-01: **MAJOR FEATURE** Admin Dashboard Komplett Überarbeitet
  - **Quick Actions Bar**: 5 Buttons für häufige Admin-Aktionen (Auktionen erstellen, Bots Start/Stop, AOTD setzen, Refresh)
  - **Live Widgets**: 4 Echtzeit-Statistik-Widgets (Heute Umsatz, Aktive Auktionen, Online Users mit Puls-Animation, Gebote/h)
  - **Global Search**: Modal für Suche nach Benutzern, Auktionen, Produkten mit Kategoriefilter
  - **KI-Assistent**: Chatbot unten rechts für Sprachbefehle im Textformat
  - **Keyboard Shortcuts**: "/" für Suche, Ctrl+J für KI-Chat, Escape zum Schließen
  - **Mobile Responsive**: Alle neuen Widgets funktionieren auf Mobile (2x2 Grid für Widgets, vertikale Stat-Cards)
  - Neue Komponenten: AdminQuickActions.js, AdminLiveWidgets.js, AdminGlobalSearch.js, AdminAIChat.js
  - Test-Ergebnis: 100% (9/9 Tests bestanden)

- 2026-02-01: **BUG FIXES** Quick Actions und Auktionen-Filter
  - **Quick Actions Fix**: Bots Start/Stop verwenden jetzt korrekt die Voice-Command API statt nicht existierende Endpoints
  - **Tag/Nacht-Filter**: Neuer Filter-Bereich über der Auktionen-Tabelle (Alle/Tag/Nacht)
  - **Typ-Spalte**: Neue Spalte in Auktionen-Tabelle zeigt Tag/Nacht-Typ mit Icons

- 2026-02-01: **BUG FIXES** Auktionsdauer und Großkunden-API
  - **Auktionsdauer-Berechnung**: Code refactored mit switch-statement und besseren Debug-Logs
  - **Großkunden API-Pfade korrigiert**: 
    - `/wholesale/admin/{id}/approve` → `/admin/wholesale/approve/{id}`
    - `/wholesale/admin/{id}/reject` → `/admin/wholesale/reject/{id}`
    - `/wholesale/admin/{id}` → `/admin/wholesale/{id}`
  - **Verbesserte Fehlermeldungen**: Benutzerfreundliche deutsche Fehlermeldungen für alle Großkunden-Operationen
  - **Root Cause für "Fehler" Toast**: Problem war falscher API-Pfad + fehlende Benutzerkonten für Großkunden-Bewerbungen

- 2026-02-01: **FEATURE** Voice Command führt Aktionen bei Bildanalyse aus
  - **Problem**: Bei "übersetze alles" + Bild wurde nur das Bild analysiert, nicht die Übersetzung ausgeführt
  - **Lösung**: `/analyze-image` Endpoint erkennt jetzt Action-Keywords und führt Aktionen automatisch aus
  - **Unterstützte Aktionen bei Bildanalyse**:
    - `translate_products`: "übersetze", "übersetzung", "sprache", "englisch"
    - `check_translations`: "übersetzung prüfen", "übersetzungen prüfen"
    - `create_auctions`: "erstelle auktionen", "neue auktionen"
    - `start_bots`, `stop_bots`, `create_bots`
  - **Response enthält jetzt**: `action_executed` und `action_result` wenn eine Aktion erkannt wurde
  - **Frontend zeigt an**: Welche Aktion ausgeführt wurde + Bildanalyse

- 2026-02-01: **FEATURE** Website-Übersetzungen für Influencer-Dashboard
  - **10 Sprachen** haben jetzt vollständige Influencer-Übersetzungen: de, en, tr, fr, es, it, ru, ar, sq
  - **Neue Keys hinzugefügt**: `loginSubtitle`, `emailPlaceholder`, `giftCards`, `vipAuctions`
  - **Influencer-Portal** zeigt jetzt alle Texte in der gewählten Sprache an
  - **Navigation** zeigt "Gift Cards" und "VIP Auctions" in allen Sprachen an

## Pending Issues

### P1 - Resolved ✅
1. ~~**Incorrect auction duration calculation**~~ - Code verbessert, Backend-Tests bestätigen korrekte Berechnung
2. ~~**Voice Command führt Aktionen nicht aus**~~ - Aktionen werden jetzt bei Bildanalyse automatisch erkannt und ausgeführt
3. ~~**Website-Übersetzungen für Influencer**~~ - 10 Sprachen mit vollständigen Influencer-Übersetzungen

### P2 - Pending Features
2. **Admin email notifications for payout requests** - Email an Admin bei neuen Influencer-Auszahlungsanfragen
3. **Two-Factor Authentication (2FA)**
4. **PayPal Integration**

### P3 - Minor Issues
5. **"Not Found" Toast Notification** - Wiederkehrendes Problem (5x gemeldet)

