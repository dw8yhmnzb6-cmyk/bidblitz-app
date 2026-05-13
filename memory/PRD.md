# BidBlitz — Product Requirements Document (PRD)

## Original Problem Statement
Complete the POS requirements (at the level of REWE/Lidl/Aldi) and integrate missing competitor Super App features flawlessly, create native mobile builds, and optimize the application architecture for the absolute cheapest possible deployment to maximize revenue and minimize running costs.

**User language**: GERMAN. **Mode**: STRICT FAST MODE (no filler, facts/code/terminal only).

## Architecture
- Frontend: React 19 + Capacitor 7 (iOS/Android) + Tailwind + framer-motion + sonner
- Backend: FastAPI + Motor (MongoDB async) + emergentintegrations
- DB: MongoDB
- Bundle ID: `com.bidblitz.app`
- Stripe key: pre-configured (test mode)
- Emergent LLM Key: pre-configured

## Implemented Features (current Sprint, Feb 2026)

### 13.05.2026 (iter90 — Sprint A: Knowledge Base Extras + Schedule Editor Extras)
- 🟢 **Knowledge Base — Cover-Image-Upload** (`POST /api/staff/knowledge/upload-cover`, multipart): jpg/png/webp, max 5MB. Wird unter `/uploads/knowledge/` gespeichert (StaticFiles).
- 🟢 **Knowledge Base — AI-Summary** (`POST /articles/{id}/summary`): nutzt Emergent LLM Key + **openai/gpt-4.1-mini** (Claude/Anthropic war via EMERGENT_LLM_KEY nicht zugelassen — Fallback dokumentiert). Generiert 2-Satz-DE-Kurzfassung, persistiert `ai_summary`. Wird bei Content-Edit auto-invalidiert.
- 🟢 **Knowledge Base — Quiz**: Article-Schema erweitert um `quiz:[{question, options[], correct}]`. Staff-Endpoint strippt `correct` (anti-cheat). `POST /me/articles/{id}/quiz-attempt` validiert Antworten, gibt score/total/passed (>=70%) + per-Question Results, schreibt in `staff_kb_quiz_attempts`. Manager kann via `GET /articles/{id}/quiz-attempts` Versuche einsehen.
- 🟢 **Schedule-Editor — Konflikt-Detection**: POST + PATCH `/shifts` prüfen Overlap (server-side: `start_time < new_end AND end_time > new_start`). Liefern **409** mit `detail.conflicts[]`. `?force=true` überschreibt. Frontend: nativer confirm()-Dialog + force-Retry. Visuell: rote/amber Schichtkacheln + AlertTriangle bei Overlap im selben Tag.
- 🟢 **Schedule-Editor — Resize-Handle**: 1.5px-Bar am unteren Rand jeder Schichtkachel → MouseDown+Drag passt `end_time` in 15-Min-Schritten an, MouseUp triggert PATCH mit Conflict-Handling.
- 🟢 **Schedule-Editor — Weekly Repeat**: `POST /api/staff/shifts/repeat {week_start, weeks 1-12, skip_conflicts}` clont alle Schichten der Quellwoche um N Wochen nach vorn. Frontend: lila „Woche wiederholen"-Button öffnet Modal mit Wochen-Slider + skip-Toggle.
- 🧪 Testing iter90: **23/23 Backend ✅** (Cover-Upload, AI-Summary, Quiz, Overlap-409, Force, Repeat). Frontend-Browser-Test sticky-session, aber alle testids quellverifiziert (Iter89-Regression bestanden). 0 Bugs.


### 13.05.2026 (iter89 — Knowledge Base + Visueller Drag&Drop Schedule-Editor)
- 🟢 **Backend: Knowledge Base Modul** (`/app/backend/routes/staff_knowledge.py`, Router registriert):
  - Manager CRUD: `POST/GET/PATCH/DELETE /api/staff/knowledge/articles` mit title/slug/content (Markdown), category, tags[], pinned, published, view_count
  - Suche: `?q=` (title/content/tag-regex) + `?category=` Filter
  - Staff Read: `GET /me/articles` (nur published, ohne content für Liste), `GET /me/articles/{id}` (mit view_count++), `GET /me/categories`, `GET /categories` (Manager)
  - Auth: Merchant via `get_current_user`, Staff via `staff_session` Cookie
- 🟢 **Backend: Shift PATCH** (`/api/staff/shifts/{id}`) — neuer Endpoint für Drag&Drop Reassign (staff_id / start_time / end_time / title / location)
- 🟢 **Frontend Manager** (`/merchant/staff`): 2 neue Tabs
  - `Knowledge Base` (`KnowledgeBaseManager.jsx`): Suche, Kategorie-Filter, Artikel-Editor (Markdown), Tag-Picker, Pin/Publish Toggle, Liste mit View-Counter und Last-Updated
  - `Schedule-Editor` (`ScheduleGridEditor.jsx`): Wochenraster Mitarbeiter × Mo–So, Click-to-Create, HTML5 native Drag&Drop zum Verschieben/Reassignen, Click-on-Shift öffnet Editor (Edit/Delete), Wochen-Navigation
- 🟢 **Frontend Staff** (`/staff/mobile`): Profil-Tile „Knowledge Base" → `StaffKnowledge.jsx` mit Suche, Kategorie-Chips, Reader mit eigenem Markdown-Renderer (H1-H3, Listen, Code-Blöcke, Bold/Italic, Links, Blockquote)
- 🧪 Testing iter89: **12/12 Backend ✅ · Frontend 100% (KB CRUD UI + Schedule Grid Editor UI verified)** · 0 Bugs · Drag&Drop fallback durch Click-to-Open Modal getestet (Playwright Drag flaky bei nativen HTML5 Events)


### 12.05.2026 (iter88 — Demo Polish + Real Payouts + NFC + Push Preferences)
- 🟢 **Demo Seed (Investor-Grade)**: 30 Tage realistische Aktivität mit Archetypen (Schichtleiter/Koch/Kellner mit eigenen Patterns morning/evening/weekend). Generiert pro Seed: **10 Mitarbeiter · 613 Clock-Events · 55 Schichten · 50 Tasks (15 open / 35 done) · 50 Wallet-Bonus/Trinkgeld-Events · 10 Notifications · 4 Warnings · 2 Locations**. Ein Klick = perfekte Pitch-Deck-Daten.
- 🟢 **Wallet Real-Payouts** (`staff_wallet.py`):
  - `POST /bank/save` (Merchant) speichert IBAN — masked storage (`DE89••••3000`), Validierung
  - `GET /bank/me` (Staff) — Bankdaten masked, **kein iban_full Leak**
  - `POST /payout` mit zwei Methoden:
    - **SEPA Manual**: `status=pending` + Reference `BB-XXXXXXXX` + IBAN masked, Merchant überweist via Banking-Portal
    - **Stripe Connect**: live `stripe.Transfer.create` zu connected account (graceful Fallback bei fehlender Onboarding)
  - `POST /payouts/{id}/confirm` (Merchant), `GET /payouts`, `GET /payouts/me`
  - Bonus-Events werden mit `payout_id` verknüpft und `status=wallet_paid` markiert
- 🟢 **NFC Native Service** (`utils/nfcService.js`): Capacitor `@capacitor-community/nfc` Plugin Wrapper mit Web-NFC Fallback (Android Chrome). `isNFCAvailable()` + `scanNFC()`. Terminal Page hat jetzt einen funktionalen `terminal-nfc-scan-btn` mit Loader + Toast-Fallback bei fehlender Verfügbarkeit.
- 🟢 **OneSignal Push UI Vertiefung**:
  - Backend: `GET/POST /api/staff/push/preferences` (4 Kategorien: shift_reminders, task_assigned, bonus_received, warnings), `GET /devices/me`
  - Frontend: Profile Tab → "Benachrichtigungen" öffnet jetzt BottomSheet mit 4 Toggle-Rows + "Test-Push senden" Button
- 🧪 Testing iter87/iter88: **14/14 Backend-Tests ✅** · 0 UI-Bugs · 0 Action Items


### 12.05.2026 (iter87 — Investor/Customer WOW Pass: Terminal Mode + Landing Showcase)
- 🎨 **NEW: Staff Terminal / Kiosk Page** (`/staff/terminal`, `StaffTerminalPage.jsx`): Fullscreen-Tablet-Modus für geteiltes Gerät am Empfang. Member-Tiles mit Live-Status (Working/Pause/Bereit), Premium PIN-Pad Modal (PIN-Dots + 3×4 Grid), QR-Code Bereich (rechts), NFC-Zone (Placeholder für native App), Success-Flash bei Aktion, Auto-Refresh alle 30s. Optimal für Café/Restaurant/Friseur/Händler.
- 🎨 **Landing Page Polish** (`StaffUpgradeScreen.jsx`):
  - Social-Proof-Strip (30 Tage gratis · 4,99 € · DSGVO · DATEV)
  - **App Showcase**: 3 große Karten "Eine App. Drei Modi." (Mitarbeiter App / Manager Dashboard / Terminal Kiosk) mit Gradient-Glow und Feature-Bullets, klickbar → live ansehen
- 🔧 Chat-Widget auch auf `/staff/terminal` ausgeblendet (Click-Interception vermeiden)
- 📦 Backend unverändert (132 Router), keine neuen Backend-Features


### 12.05.2026 (iter83–86 — BidBlitz Staff Connecteam-Style Premium Mobile UX)
- 🟢 **Connecteam-Style Timesheet Backend** (`routes/staff_timesheet.py`): `/team-overview` (Connecteam-Tabelle: Regular/ÜS/Pause/Abwesenheit/Total/Kosten), `/me/weekly`, `/me/day`, `/me/month`, `/manager/day-detail`, CSV-Export (`/team-overview.csv`).
- 🟢 **Check-in Attachments**: `POST /api/staff/clock/self` akzeptiert nun JSON-Body mit `customer`, `project`, `equipment`, `kilometers`, `note`, `photo_url`. Schema `SelfClockEvent`. Legacy Query-Params bleiben kompatibel.
- 🟢 **Staff Tasks API** (`routes/staff_tasks.py`): Merchant erstellt Tasks (`/create`), Staff sieht eigene (`/me?status=open|done|all`), markiert erledigt (`/{id}/complete`). Team-Liste für Merchant (`/list`).
- 🎨 **Premium Mobile UX Pass (Connecteam/Revolut/Stripe-Stil)**:
  - **Global Design Tokens** (`/styles/staff-tokens.css`): Farben, Radius, Shadows, Spacing, Button-Heights, Animationen → `.staff-app` scope.
  - **5-Tab Bottom Navigation** (Floating Pill mit Glass-Blur): Home / Schichten / Aufgaben / Wallet / Profil (`StaffBottomNav.jsx` rewrite, animated active indicator).
  - **Home Tab**: Live Status Card mit Glow + Live-Timer (s-Genauigkeit), 256px Gradient Circle Action Button mit Success-Burst-Animation, KPI Grid (Heute/Woche/ÜS/Wallet), Next-Shift-Card, Tasks-Teaser.
  - **Shifts Tab**: Heute/Morgen/Diese Woche/Später Karten mit großen Uhrzeiten + Status-Pills.
  - **Tasks Tab**: Connecteam-Style Cards mit Priorität (Überfällig/Heute/Bald/Normal), Optimistic Complete, Filter Offen/Erledigt/Alle.
  - **Wallet Tab**: Hero Balance + Bonus/Trinkgeld Split + Verlauf.
  - **Profile Tab**: Premium Profile Hero, Sprachen-Sheet, PIN-Sheet, Notifications-Toggle, Logout.
  - **Premium Primitives** (`StaffPrimitives.jsx`): `PremiumEmpty`, `Skeleton`, `StatusPill`, `GlowDot`.
- 🎨 **Merchant Dashboard Polish** (`MerchantLiveOverview.jsx`): Cards statt Tabellen — Live-Status Grid (alle MA mit Online-Dot), Quick-Actions, Activity-Feed, KPI Hero (Aktiv/Pause/Anträge/Monatsstunden), Connecteam-Timesheet als neuer Tab.
- 🔧 **Fixes**: Chat-Widget auf `/staff/mobile` ausgeblendet (Click-Interception), nested `<button>` warning in Profile-Row behoben, StaffShifts empty state wrapper, stable `openAttachmentSheet` function reference.
- 🧪 Testing: iter84 ✅ 14/14, iter85 ✅ 11/11 (2 medium fixed in iter86), iter86 ✅ funktional verifiziert + Polish-Items.
- 📦 132 Router insgesamt (staff_timesheet + staff_tasks neu).



### 12.05.2026 (iter81–82 — Final Hardening: AI Insights + Demo + System Health)
- 🟢 **AI Insights** (`routes/staff_insights.py`): regelbasiert (keine LLM-Latenz). Erkennt frequent_late (≥3x), overtime_trend (vs Vorwoche), high_overtime_individuals (>50h), missing_checkouts, weak_coverage (Wochentag×Stunde), productivity_trend_4w
- 🟢 **Smart Alert Engine** (`routes/staff_alerts.py`): `/live` (open_sessions, long_running >8h, shifts_no_show), `/scan` delegiert auf warnings.scan_for_warnings, `/list` aliased auf warnings
- 🟢 **Analytics + Costs** (`routes/staff_analytics.py`): hours-by-day, attendance, absence, heatmap (7×24), costs/summary (mit Overtime-Surcharge 25 %), costs/by-location, admin/global (active_merchants, MRR, conversion_pct)
- 🟢 **Demo Mode** (`routes/staff_demo.py`): isolierter `demo-merchant-bidblitz` Tenant. `POST /seed` erzeugt 10 Mitarbeiter + 200 Events + 28 Shifts + 3 Warnings + 2 Locations. `GET /dashboard` Public Read-only KPIs. `DELETE /clear` (admin)
- 🟢 **System Health** (`routes/staff_system.py`): `/health`, `/version` (v1.0.0), `/system-status` mit collections+flags+integrations matrix
- 🟢 **MongoDB Indexes** (`core/performance.py` erweitert): 19 neue Compound-Indexes für staff_clock_events, warnings, subscriptions, invites, magic_tokens, notifications, audit_log, settings
- 🟢 **System Check Page** (`pages/StaffSystemCheckPage.jsx`): Status-Pills, Collections, Feature-Flags, Integrations, Refresh-Button (Route `/staff/system-check`)
- 📘 **README** (`/app/memory/staff_module_readme.md`): 12 Sections inkl. komplette Endpoint-Matrix, Permission-Matrix, ENV-Vars, Deployment-Checklist, Roadmap
- 🧪 Backend Smoke: 12 neue Endpoints alle 200/funktional. 126 registrierte Router insgesamt.
- ⚠️ **Bekannte externe TODOs** (siehe README §9): Stripe Live-Checkout, Resend/Twilio Magic-Link Versand, OneSignal Push, NFC Native, LiveKit UI.

### 12.05.2026 (iter78–80 — BidBlitz Staff Business + Mobile + Phase 2)
- 🟢 **Subscription/Paywall** (`routes/staff_subscription.py`):
  - Plans Basic 4,99 € (5 MA) / Pro 9,99 € (20 MA) / Enterprise (∞)
  - 30-Tage Free Trial (Pro Features), Status `trialing/active/expired/cancelled`
  - Endpoints `/plans`, `/status`, `/start-trial`, `/create-checkout` (Stripe Placeholder), `/cancel`, `/feature-flags`, `/admin/list`, `/admin/override`, `/admin/toggle-module`
  - Limit-Check in `POST /api/staff/members` (402/403 mit Code `limit_reached`/`no_subscription`)
  - Admin Override: trial extend, plan/status change, max_staff_override, enable/disable
- 🟢 **Branchen-Vorlagen** (`routes/staff_templates.py`): 7 Industrien (Gastronomie, Eiscafé, Retail, Friseur, Bau, Reinigung, Lieferdienst) mit Shifts/Pausen/Rollen/Check-in-Methode/Urlaubstagen
- 🟢 **Rollen & Rechte** (`routes/staff_roles.py`): Owner/Manager/Schichtleiter/Mitarbeiter/Aushilfe, 9 Permissions, `role_has_permission()`
- 🟢 **GPS-Standorte** (`routes/staff_locations.py`): Lat/Lng/Radius, Haversine-Geofence, `validate_geofence()` automatisch bei Clock-Event aufgerufen → `staff_warnings` doc mit `resolved=False`
- 🟢 **Auto-Warnings** (`routes/staff_warnings.py`): no_clock_out (>12h), duplicate_clock_in (<5min), missing_break (>6h), overtime (>10h), shift_no_checkin, gps_out_of_range
- 🟢 **Reports/Exports** (`routes/staff_reports_extended.py`): daily/weekly/monthly/by-location/warnings, CSV-Export, DATEV-CSV
- 🟢 **Magic Login** (`routes/staff_magic_link.py`): Token-based Login (30 Min TTL), single-use, anti-enumeration, env-gated magic_url
- 🟢 **Invite Flow** (`routes/staff_invites.py`): `staff_invites` mit pending/accepted/expired/revoked, 7-Tage TTL, Limit-Check beim Create UND Accept
- 🟢 **Employee Profile** (`routes/staff_profile.py`): `/me/profile`, `/me/change-pin` (bcrypt), `/me/dashboard` (status, today/week hours, next_shift, vacation)
- 🟢 **Admin SaaS Metrics** (`routes/staff_metrics.py`): MRR/ARR Placeholder, Churn Risk, by-plan, avg_staff/merchant
- 🟢 **Notification Center** (`routes/staff_notifications.py` + `components/staff/StaffNotificationCenter.jsx`): Collection `staff_notifications`, Typen `shift_reminder/new_shift/leave_approved/leave_rejected/missed_clock_out/warning_assigned/info`, Endpoints `/list`, `/{id}/read`, `/mark-all-read`, `/send`, `/types`. Auto-Trigger bei neuer Schicht (`POST /api/staff/shifts`) und Urlaub-Approve/Reject. Bell-Icon mit Unread-Badge im Mobile-Header.
- 🟢 **Frontend Marketing Page** (`pages/StaffUpgradeScreen.jsx`): Hero, Vorteile, Crewmeister/Papershift Vergleichstabelle, Pricing Cards mit `data-testid=staff-plan-card-*`, Trial-CTA, Industries
- 🟢 **Frontend Paywall Gate** (`pages/StaffManagementPage.jsx`): zeigt Upgrade-Screen wenn keine aktive Sub, Trial/Plan Badge, Limit-Display, Upgrade-CTA, Limit-Error-Toast bei Member-Create
- 🟢 **Employee Mobile UI** (`pages/StaffMobilePage.jsx`): Magic-Link Auth via URL `?token=`, PIN-Login Fallback, Big-Buttons (Check-in/out/Pause), Status-Badge (working/break/off), Today/Week Hours, Next Shift, Vacation. Settings-Sheet mit Language Switcher + Logout. Offline-Indicator + Queue-Count.
- 🟢 **Invite Accept Page** (`pages/StaffInvitePage.jsx`): Public Token-Preview + Name + optionale PIN
- 🟢 **Dashboard Cards** (`components/staff/StaffDashboardCards.jsx`): Anwesend/Pause/Verspätet/Fehlt/Schichten/Warnungen/Monatskosten
- 🟢 **Warnings List** (`components/staff/StaffWarningsList.jsx`): mit Scan-Button + Resolve
- 🟢 **Export Buttons** (`components/staff/StaffExportButtons.jsx`): CSV/PDF/Payroll/DATEV
- 🟢 **Admin SaaS Metrics UI** (`components/AdminStaffMetrics.jsx`): Tiles + Plan-Tabelle
- 🟢 **i18n Stub** (`i18n/staff.js`): DE/EN/SQ/TR mit `t()` helper + Language Persistence in localStorage
- 🟢 **Offline Queue** (`utils/staffOfflineQueue.js`): Auto-Sync bei `online`-Event, Device-Info Helper (device_type/browser/platform/app_version)
- 🟢 **App Store Texts** (`/app/memory/app_store_descriptions.md`): DE/EN/SQ Long+Short Description, Keywords, Feature-List
- 🟢 **App.js Routes**: `/merchant/staff/upgrade` (auth), `/staff/mobile` (public, no chrome), `/staff/invite` (public, no chrome) — BottomNav & CookieBanner unterdrückt für Employee Shell
- 🟢 **Schema Erweiterungen**: ClockEvent enthält jetzt `device_type/browser/platform/app_version`, audit_log doc in `staff_audit_log` für clock_event + magic_login
- 🧪 **Testing**: iter78 (Subscription) 93%/100%, iter79 (Phase 2) 95.8%/100%, iter80 (Fixes) 100%/100% — alle HIGH-Issues gefixt

### 12.05.2026 (iter77 — QR-Bestellung v2: Mr-Yum-Parität, Ratings, Combos, Live-Status, Tip, Split)
- 🟢 **Backend** (`routes/qr_table_order.py` ~860 Z., 1274 routes total):
  - Menu-CRUD (`POST/GET/DELETE /api/merchant/menu/items` + `bulk-import`)
  - Image-Upload (`POST /api/merchant/menu/upload-image` → GridFS-Bucket `menu_images`, public stream via `GET /api/qr/menu/image/{file_id}`)
  - Modifier-Engine: `MenuItemRequest.modifier_groups[]` mit `required/min/max`, server-side reprice in `place_qr_order` mit `_validate_modifiers()` (rejects unknown options 400)
  - Schema-Enrichment: `image_url`, `description`, `name_i18n`, `description_i18n`, `tags[]`, `allergens[]`, `calories`, `is_popular`, `sort_order`, `scope` (food/drinks)
  - **Popular** (`GET /api/qr/popular/{merchant_id}`): Aggregation top-selling items über `qr_orders`
  - **Upsell** (`POST /api/qr/upsell`): Frequently-bought-together graph hydrated mit Menu-Daten
  - **Tip** (`POST /api/qr/order/tip`): atomic wallet-debit, blocks double-tip 409, updates `order.tip + total`
  - **Live-Status** (`GET /api/qr/order-status/{order_id}`): polling endpoint mit `status_history`, `accepted_at`, etc.
  - **Table-History** (`GET /api/qr/table-history/{merchant_id}/{table_id}`): heutige Bestellungen des Customers + Summe
  - **Reviews** (`POST /api/qr/order/review` + `GET /api/qr/reviews/{merchant_id}`): 1-5 Star-Ratings, blocks double-review 409, status-gate accepted/completed
  - **Combos** (`GET /api/qr/combos/{merchant_id}` + `POST/DELETE /api/merchant/combos`): bundle_price + auto-computed `full_price/save`
  - Menu-Response inkludiert `rating_avg` + `rating_count` pro Item
- 🟢 **Frontend Customer** (`QrOrderPage.jsx` ~1100 Z., komplett-Redesign):
  - Hero-Image mit Bistro-Logo + Multi-Language-Toggle (DE/EN/TR mit 50+ Strings)
  - Sticky-Header: Suche, Food/Drinks-Scope-Tabs, Kategorie-Chips, Tag-Filter (Popular/Vegan/Vegetarisch/Spicy), Allergen-Filter (10 Typen Sheet)
  - **Combo Deals Carousel** mit Save-Badge + durchgestrichener Original-Preis
  - **Popular Here Carousel** mit Order-Count-Badge
  - **2-Spalten Foto-Grid** mit Hero-Image, Stars + Rating-Avg, Beschreibung, Tag-Badges, Price + Add-CTA
  - **Detail-Bottom-Sheet**: Hero (16:9), Stars+Rating-Count, Tags, Kalorien, Allergene-Red-Box, Modifier-Groups (Radio für size, Checkbox für toppings, +/- Pricing live), Sonderwünsche-Textarea (200 chars), Sticky-Footer mit qty-Stepper + Add-CTA (line-total live)
  - **Cart-CTA mit Upsell-Strip** "Häufig dazu bestellt"
  - **Order-History Sheet** über Header-Button (heutige Tisch-Orders mit Status-Badges, Total)
  - **Success-Screen**: Live-Status-Timeline (Received→Accepted→Preparing→Ready), Tip-Section (5/10/15%/custom), Split-Bill (stepper, per-person calc), Review-CTA → ReviewSheet mit per-item Star-Rating + optional Comment
- 🟢 **Merchant** (`MerchantQrTablesPage.jsx`): Neuer Tab "Speisekarte" mit ItemEditor (Bild-Upload Drag&Drop ODER URL paste, Tags, Allergene, Kategorie, Scope-Toggle, Kalorien)
- 🟢 **Demo-Seed**: 14 Items (Pizza/Burger/Pasta/Salat/Beilagen/Dessert/Drinks) mit Unsplash-Bildern, 3 Combos (Pizza Night Deal, Classic Burger Meal, Quinoa Lunch), 13 Reviews pre-seeded
- ✅ **Testing**: **22/22 Backend Pytest passed** (`/app/tests/qr_v2/test_qr_v2_backend.py`), **100% Frontend E2E** (Playwright `/app/tests/qr_v2/playwright_qr_v2_e2e.py`): hero/tabs/categories/filters/combos/popular/detail-sheet/modifiers/cart/upsell/lang-switch/submit/success/tip/split/review — alle green.
- 🟢 **UX-Fix nach Test**: Detail-Sheet auf flex-column umgebaut, Add-Button als sticky-footer **innerhalb** des Sheets statt fixed-position (kein Off-Screen mehr auf 390×844).

### 12.05.2026 (iter76 — QR-Tisch-Bestellung Komplett: Customer + Merchant + Test)
- 🟢 **Backend** (`routes/qr_table_order.py` ~420 Z., bereits in iter75 scaffolded, jetzt verdrahtet):
  - Customer-Endpunkte: `GET /api/qr/resolve/{token}` (sliding-window TTL 5min, auto-rotate), `GET /api/qr/menu/{merchant_id}`, `POST /api/qr/order` (atomares `balance`-Debit, server-side Preisvalidierung, instant/waiter Mode), `GET /api/qr/order/{order_id}`.
  - Merchant-Endpunkte: `POST/GET /api/merchant/qr-tables`, `POST /api/merchant/qr-tables/{id}/rotate`, `POST /api/merchant/qr-settings`, `GET /api/merchant/qr-orders/{merchant_id}`, `POST .../accept|reject|complete` (reject macht atomic refund auf User-Wallet).
  - **Bugfix vor Tests**: Wallet-Feld korrigiert (`balance` statt `wallet_balance`).
- 🟢 **Frontend Customer** (`pages/QrOrderPage.jsx`): Refactored von `react-router-dom` auf prop-basierte Navigation (`token`, `onNavigate`, `onAuthRequired`, `onLogin`) kompatibel mit App.js currentPath-Routing. Resolve + Menu-Load + Scope-Tabs (Speisen/Getränke) + Cart mit qty-Toggle + Submit-CTA + Success-Screen.
- 🟢 **Frontend Merchant** (`pages/MerchantQrTablesPage.jsx` ~330 Z.): 3 Tabs (Tische/Bestellungen/Einstellungen). Tische: Anlegen (label+capacity), QR-Code-PNG via `qrcode.react`, Print-Window mit kompletter Layout, Token-Rotate-Button. Bestellungen: Live-Liste mit 5s-Polling, gruppiert nach Status (pending/accepted/completed/rejected), Accept/Reject/Complete-Buttons. Settings: instant/waiter + scopes (food/drinks).
- 🟢 **App.js**: Lazy-Loaded `QrOrderPage`, `MerchantQrTablesPage`. Path-Handler `/order/qr/:token` (mit Guest-Auth-Fallback) + `/merchant/qr-tables`. **Chrome-Cloak**: BottomNav, AIChatWidget, SuperAppOverlay, LandingChatbot, CookieBanner werden auf `/order/qr/*` ausgeblendet für sauberes Customer-Erlebnis.
- 🟢 **MorePage**: Eintrag "QR-Tisch-Bestellung" mit Store-Icon (Merchant/Admin sichtbar) → navigiert zu `/merchant/qr-tables`.
- ✅ **Testing**: 10/10 Backend-Pytest passed (`/app/backend/tests/test_qr_table_order.py`). Frontend E2E (Playwright via testing-agent): Customer scannt → Menu rendert → Pizza €8.50 ins Cart → Submit → Success-Screen mit `qro_7a2caa93eaae`. Merchant-Page rendert 4 Tisch-Cards mit QR-Codes, alle 3 Tabs switchen, Cloak verifiziert. **Success: 100% backend, 100% frontend**.

### 12.05.2026 (iter75 — Driver Application Approval Workflow + Top-5 Lieblings-Routen)
- 🟢 **Application-Workflow Backend** (`routes/taxi.py`):
  - **Bestehender** `POST /admin/drivers/{driver_id}/approve` propagiert jetzt `vehicle_capabilities` aus dem matchenden Application-Datensatz (by email) in `drivers.car.{pet_friendly,luggage_class,assistance}` und markiert die Application als approved.
  - **Neu**: `GET /admin/applications?status=pending` listet Applications mit Stats (total/pending/approved/rejected).
  - **Neu**: `POST /admin/applications/{application_id}/approve` legt den `db.drivers`-Datensatz frisch an mit allen propagierten Capabilities, verlinkt Application↔Driver, flaggt den User (`is_driver=true`, `taxi_driver_id`).
  - **Neu**: `POST /admin/applications/{application_id}/reject` mit Reviewer-Audit.
- 🟢 **Top-5 Lieblings-Routen**:
  - Backend: `GET /api/taxi/favorite-routes?limit=5` mit MongoDB-Aggregation über `taxi_rides` → gruppiert pickup×dropoff, sortiert nach `use_count`+`last_used_at`, liefert avg_fare und full coords.
  - Service: `fetchFavoriteRoutes(limit)` in `taxiApi.js`.
  - UI: Eigene Sektion "Lieblings-Routen" im BookingSheet (sichtbar wenn `!dropoff.address`). Klick → setzt Pickup+Dropoff in einem Schritt. Zeigt Use-Count (`5×`) und avg-Fare. Auto-Refresh nach jeder Buchung.
- ✅ Backend startet clean (`from server import app` OK), Lint clean.

### 12.05.2026 (iter74 — Live Driver Count + Driver Onboarding Capabilities)
- 🟢 **Live Driver Count im BookingSheet**: 
  - Neuer Service: `fetchNearbyDriversCount` (taxiApi.js) ruft `/api/taxi/drivers/nearby` mit allen taxi.eu-Filter-Params (`carType`, `withPet`, `luggage`, `assistance`).
  - TaxiPage: debounced (400ms) Refetch bei Änderung von `pickup.lat/lng`, `selectedVehicle`, `orderOptions.{withPet,luggage,assistance}`.
  - BookingSheet zeigt grünen Pulse-Hint *"3 Taxis in der Nähe verfügbar"* wenn `count > 0`, ansonsten den **taxi.eu-style No-Drivers-Banner** *"Leider ist kein freies Taxi in Ihrer Nähe..."*.
- 🟢 **Driver Onboarding Capabilities** (Backend + Frontend):
  - `DriverOnboardRequest` Model erweitert um `pet_friendly`, `luggage_class` (small/much/much_combi/large), `assistance`.
  - Application persistiert `vehicle_capabilities` Sub-Doc → wird beim Approval an `drivers.car.{pet_friendly,luggage_class,assistance}` propagiert → matched automatisch im `book_ride` Driver-Query.
  - `TaxiDriverOnboardingModal.jsx` erweitert: Kapazitäten-Sub-Panel mit Pet-Checkbox, 4-Button Luggage-Grid, Assistance-Checkbox.
- ✅ Verifiziert: API `POST /driver/onboard` mit allen 3 neuen Feldern → HTTP 200 (App-ID `5b530b13446de64e`). BookingSheet zeigt No-Drivers-Banner bei leerer DB. Lint clean.

### 12.05.2026 (iter73 — Tracking Sheet im Fullscreen-Layout + Driver-Filter Backend)
- 🟢 **TaxiTrackingSheet.jsx** (260 Z.) — neue Komponente: Status-Badge, Driver-Card (Avatar/Rating/Vehicle/Plate/Call), Route-Liste (cyan/amber/red dots inkl. **Waypoints + per-Address Notes**), Fare-Card, Demo-Buttons, Chat/Split-Grid, Cancel, Completed-Success-State.
- 🟢 **TaxiPage**: `inMapBookingFlow` triggert jetzt sowohl bei `view==='book' && taxiType` ALS AUCH `view==='tracking' && activeRide` → Map+Bottom-Sheet bleiben durchgehend sichtbar während ride. Sheet zeigt je nach `view` `<TaxiBookingSheet>` oder `<TaxiTrackingSheet>`. Tracking startet bei `half`-Snap (statt collapsed).
- 🟢 **Old `TaxiTrackingView` aus der TaxiPage entfernt** — nicht mehr referenziert. Import + Container-Block raus. Datei bleibt für andere Konsumenten erhalten.
- 🟢 **Backend Driver-Matching erweitert** (`routes/taxi.py`):
  - `book_ride`: Driver-Query enthält jetzt `car.pet_friendly`, `car.luggage_class` (Stufen-Match: `much_combi` ⊇ `combi/wagon/much`), `car.assistance`. So werden nur passende Fahrer benachrichtigt.
  - `get_nearby_drivers` (öffentlich): neue Query-Params `with_pet`, `luggage`, `assistance` → UI kann Live-Verfügbarkeit *vor* der Buchung anzeigen (z.B. "0 Fahrer für 'Viel Gepäck Kombi'").
- ✅ Verifiziert: Map full-screen rendert, Sheet draggable, `data-snap="collapsed"`, Backend Query mit allen 4 neuen Params HTTP 200. Lint clean.

### 12.05.2026 (iter72 — Wiring Komplett: Recent / City-Defaults / Notes / Waypoints)
- 🟢 **Recent Addresses UI**: Server-tracked Adressen werden beim Mount geladen, im Search-Sheet als eigene Sektion "Letzte Adressen" mit Use-Count gezeigt. Nach jeder Buchung automatischer Refresh.
- 🟢 **City-Defaults**: Pickup-Adresse → Heuristisches City-Extract (ZIP + Stadt-Pattern). Auto-Load gespeicherter Optionen für diese Stadt. Inline-Banner "Als Standard für [Stadt] speichern" / "✓ Standard-Optionen für [Stadt] aktiv".
- 🟢 **Per-Address Driver Notes**: `TaxiNoteModal` verdrahtet an Pickup/Dropoff/Waypoint-Rows. Tap-Edit-Icon → Modal → 280-char Textarea → speichert in `pickup.notes` / `dropoff.notes` / `waypoint.notes`. Sichtbar als italic cyan-Hint unter der Adresse.
- 🟢 **Waypoints Vollintegration**: `+ Zwischenstopp hinzufügen` → öffnet Search-Sheet mit `mode='waypoint:N'` → `onSelectWaypoint(idx, sel)` setzt Lat/Lng/Address im State-Array. Max 3 Stops. `bookRideApi` sendet komplettes `stops[]`-Array. Backend route: pickup → stops[] → dropoff, Total-Distanz aus haversine summiert.
- ✅ Verifiziert E2E: Waypoint hinzufügen → Search-Sheet → "Hauptbahnhof Berlin" → Auswahl → amber Waypoint-Row mit Edit+Clear. Console clean.

### 12.05.2026 (iter71 — Bug-Fix: PWA-Prompt + Estimate API)
- 🔴 **Bug 1**: PWA-Install-Prompt erschien über dem Bottom-Sheet im Booking-Flow. Fix: `[data-testid="pwa-install-prompt"]` + `[data-testid="ios-add-to-home"]` zu CSS-Cloak hinzugefügt.
- 🔴 **Bug 2**: "Fehler beim Laden der Preise" — Frontend Service `estimateRide` sendete nested Body `{pickup, dropoff}` statt der flachen `EstimateRequest`-Felder (`pickup_lat/lng`, `dropoff_lat/lng`). Backend antwortete mit Pydantic 422. Fix in `services/taxiApi.js`.
- ✅ Verifiziert E2E (Playwright): Berlin → Alexanderplatz Buchung lädt 3 Fahrzeuge mit korrekten Preisen (Standard €6.32, Premium €10, Van/XL €8). "Anpassen"-Sub-Panel an aktiver Karte sichtbar, Buchen-Button bereit. Keine Console-Errors mehr.

### 12.05.2026 (iter70 — Uber/taxi.eu Profi-Layout: Chrome ausblenden, Hamburger, Sheet 32%)
- 🎯 **User-Feedback aufgegriffen**: Bottom-Sheet konkurrierte mit Bottom-Nav, AI-Chat-FAB, Landing-Chatbot-Bubble, Cookie-Banner, SuperApp-Hub und KYC-/Demo-Banner → kein professioneller Look.
- 🟢 **CSS-Cloak**: `body.taxi-fullscreen-mode` (in App.css) → blendet `.bottom-nav`, `[data-testid="ai-chat-fab"]`, `.chatbot-toggle-btn/.chatbot-window`, `[data-testid="superapp-hub|cookie-banner|kyc-banner|demo-banner|group-tracker-banner|floating-chatbot-bubble"]` aus. Toggle via `useEffect` in TaxiPage abhängig von `inMapBookingFlow`.
- 🟢 **Top-Bar**: Pfeil-Zurück ersetzt durch **Hamburger-Menü** (öffnet `TaxiSideMenu`). Mittig Live-Standort-Pille (`Standort: ...`). Rechts Locate-Button.
- 🟢 **SideMenu**: `TaxiSideMenu.jsx` (199 Z.) — Profile-Card mit Initialen, Wallet-Balance, Nav-Items (Letzte Adressen, Favoriten, Gespeicherte Orte, Verlauf, Fahrer-Onboarding, Einstellungen, Hilfe). `useNavigate`-Abhängigkeit entfernt (Component-agnostic via `onNavigate` prop + Custom-Event-Fallback).
- 🟢 **Sheet Snap-Points** angepasst: collapsed 28% → 32%, half 55% → 62% (mehr Sheet-Content beim Drag). Default-Snap = `collapsed` damit Karte maximal sichtbar.
- 🟢 **Backend-Erweiterungen** (vorgezogen für nächste Iterationen):
  - `FlexBookRequest` + `Stop` Models: `stops[]`, `pickup_notes`, `dropoff_notes` (max 300 chars).
  - `book_ride`: route = pickup → stops[] → dropoff, Total-Distanz aus haversine summiert. Auto-Tracking jeder genutzten Adresse in `taxi_recent_addresses`.
  - Neue Endpoints: `GET/DELETE /api/taxi/recent-addresses`, `GET/POST/DELETE /api/taxi/city-defaults/{city}`.
- 🟢 **Frontend Service**: `bookRideApi` sendet `pickup_notes`/`dropoff_notes`/`stops[]`. Neue Helpers: `fetchRecentAddresses`, `clearRecentAddresses`, `fetchCityDefault`, `saveCityDefault`.
- 🟢 **Komponenten neu**: `TaxiNoteModal.jsx` (per-Adress-Hinweise), erweiterter `TaxiVehiclePicker` (Anpassen-Sub-Panel: Priorität fastest/cheapest/rated + Kapazität+ETA).
- ✅ Verifiziert via Playwright: BottomNav weg, AIChat-FAB weg, LandingChatbot weg, Sheet bei `collapsed`-Snap, Hamburger öffnet SideMenu (Gast-Card sichtbar), Top-Bar Standort-Anzeige. Lint clean.

### 11.05.2026 (iter69 — taxi.eu UI Parität: Bottom-Sheet + Fullscreen Search + Bestelloptionen)
- 🎯 **Vollständige UX-Neuordnung des Buchungsflows nach taxi.eu-Referenz** (Screen-Recording vom User).
- 🟢 **Backend**: `FlexBookRequest` (models/taxi.py) erweitert um `language`, `with_pet`, `luggage`, `assistance`, `scheduled_at`. `book_ride` (routes/taxi.py) persistiert diese als `ride.options`. Backwards-compatible (defaults). Pydantic-Validierung clean.
- 🟢 **Frontend Service**: `bookRideApi` (taxiApi.js) sendet jetzt flache `FlexBookRequest`-Felder + `options.*` (pet/luggage/assistance/notes/scheduledAt/language). **Bugfix mit eingebaut**: alte Implementierung sendete nested `{pickup, dropoff}` → schlug auf Backend mit FlexBookRequest fehl.
- 🟢 **Neue Komponenten**:
  - `TaxiBottomSheet.jsx` (88 Z.) — draggable Bottom-Sheet mit 3 Snap-Points (collapsed 28% / half 55% / full 92%). `framer-motion` `useMotionValue` + Velocity-Projection für natürliches Snap-Verhalten.
  - `TaxiAddressSearchSheet.jsx` (320 Z.) — Fullscreen-Suche, zwei aktive Inputs (Pickup + Dropoff), Live-Mapbox-Suggestions, "Aktueller Standort", Favoriten, gespeicherte Orte, POI-Quick-Tiles (Flughafen/Bahnhof/Hotel/Krankenhaus), "Standort auf Karte festlegen".
  - `TaxiOrderOptions.jsx` (282 Z.) — Bestelloptionen-Sheet mit `Picker`-Sub-Component (Sprache DE/EN/TR/AR/SQ), `Toggle` (Pet, Assistance), Picker (Gepäck none/small/much/much_combi), `ScheduleSheet` (Jetzt / Vorbestellen + datetime-local Input), Sonderwünsche Textarea.
  - `TaxiBookingSheet.jsx` (194 Z.) — taxi.eu-style Sheet-Content: Type-Pill + Ändern, Greeting, tap-able Address-Rows, gespeicherte Orte Chips, Bestelloptionen-Button mit Live-Summary (`Jetzt · 🐾 · 🧳 · EN`), Surge-Warning, "Keine Taxis verfügbar"-Banner, Preise-Anzeigen / Buchen CTA mit `Bestellen für DD.MM HH:MM` bei Vorbestellung.
- 🟢 **TaxiPage.jsx**: Conditional Layout — wenn `view==='book' && taxiType && moduleEnabled` → Vollbild-Map + draggable Bottom-Sheet + Top-Bar (Back/Locate). Andernfalls klassisches Header+Container-Layout (Tracking/History/TypeSelector). `useTaxiState` erweitert um `orderOptions`, `showOrderOptions`, `searchSheetMode`.
- ✅ Playwright-verifiziert: Bottom-Sheet rendert, Adress-Row öffnet Search-Sheet, Mapbox-Vorschläge erscheinen (1 für "Fahltskamp"), Options-Sheet öffnet, Pet-Toggle aktivierbar, Language-Picker (EN) → Summary "Jetzt · 🐾 · EN", Schedule-Sheet vorhanden. Lint clean.

### 11.05.2026 (iter68 — API Layer + BookingForm Sub-Components)
- 🟢 **Neuer Service**: `services/taxiApi.js` (165 Z.) — Zentrale Fetch-Helpers: `fetchMe`, `fetchTaxiStatus`, `fetchModeSettings`, `fetch/save/deleteFavorite`, `fetch/save/deletePlace`, `fetchActiveRide/fetchRide/fetchRideHistory`, `estimateRide`, `bookRideApi`, `cancelRideApi`, `setDriverStatus`, `forwardGeocode`. Konsistente Error-Handling-Konvention (`{ ok, error }`).
- 🟢 **TaxiPage.jsx**: Alle 13 inline `fetch()`-Aufrufe + Error-Handling durch API-Service ersetzt. Hooks wie `fetchUserData`, `refreshFavorites`, `refreshSavedPlaces`, `checkModuleStatus`, `loadModeSettings`, `startPolling`, `checkActiveRide` jetzt `useCallback`-stabilisiert.
- 🟢 **BookingForm Splitting**:
  - `TaxiSavedPlacesRow.jsx` (32 Z.) — Chip-Reihe für gespeicherte Orte
  - `TaxiQuickDestinations.jsx` (114 Z.) — Schnellauswahl + Prishtina + Dubai mit `ChipGroup`-Sub-Component
- 📉 `TaxiPage.jsx`: 702 → **538 Zeilen** (−23%). `TaxiBookingForm.jsx`: 405 → 311 (−23%).
- 📉 **Gesamt seit iter65**: 1588 → 538 (−66%, −1050 Zeilen). 9 neue Module + 1 Service-Layer.
- ✅ Verifiziert: Schnellauswahl Click → Dropoff fills → Save-Btn appears, alle 3 Tabs funktional, Mapbox-Autocomplete intakt, Lint clean.

### 11.05.2026 (iter67 — useTaxiMap Hook + TaxiTypeSelector Extraction)
- 🟢 **Neuer Hook**: `hooks/useTaxiMap.js` (266 Zeilen) — kapselt Mapbox-Lazy-Load, Map-Init (keyed off `taxiType`), Pickup-Marker (draggable + inline reverse-geocode), Dropoff-Marker, Style-Switch, POI-Tilequery (`loadPOIs` + `clearPoiMarkers`), Popup-Bridge (`window.__taxiSetDropoffPOI`), Unmount-Cleanup. Returns `{ mapContainerRef, mapRef, pickupMarkerRef, loadPOIs }`.
- 🟢 **Neue Komponente**: `components/taxi/TaxiTypeSelector.jsx` (139 Zeilen) — Hero-Image + Business/Private-Cards + Info-Box, `TypeCard` sub-component für Card-Logik, Driver-Counts + Mode-Settings als Props. Alte unbenutzte 1.0-Version überschrieben.
- 🟢 **TaxiPage.jsx aufgeräumt**: 5× Map-`useEffect`, 5× Refs, `loadPOIs`, `clearPoiMarkers`, `loadMapbox`, alle `mapboxgl`-Imports/Aufrufe entfernt. `MAP_STYLES`, `POI_CATEGORIES`, `TaxiPoiFilterSheet`, `TaxiMapStylePicker`, `TaxiSavePlaceModal`, `TaxiVehiclePicker`, `TaxiAddressInput` Imports entfernt (gehören jetzt in BookingForm).
- 📉 `TaxiPage.jsx`: 1034 → 702 Zeilen (−32%). **Gesamt seit iter65**: 1588 → 702 (−56%).
- ✅ Verifiziert via Playwright: Type-Selector (Hero + Cards + Info-Box), Map-Mount beim Type-Pick, Pickup-Autocomplete (Mapbox), "Ändern"-Button (zurück zum Selector). Lint clean.

### 11.05.2026 (iter66 — TaxiPage Header + Tracking Extraction)
- 🟢 **Refactor**: `TaxiHeader.jsx` (Sticky-Header, Balance, Tab-Nav) und `TaxiTrackingView.jsx` (Live-Map, Driver-Info, Route, Fare, Demo-Controls, Cancel/Complete) extrahiert.
- 🟢 **Cleanup**: Unbenutzte Imports entfernt (`STATUS_COLORS`, `STATUS_LABELS`, `VEHICLE_ICONS`, `VehicleIcon` — gehören jetzt nur in TrackingView).
- 📉 `TaxiPage.jsx` 1251 → 1034 Zeilen (−17%). Gesamt seit iter65: 1588 → 1034 (−35%).
- ✅ Verifiziert via Playwright: Header, alle 3 Tabs (Buchen/Live/Verlauf), Type-Selection rendern korrekt; Lint clean.

### 11.05.2026 (iter65 — Mapbox Autocomplete Fix + Booking Form Extraction)
- 🔴 **Bug**: Pickup/Dropoff Eingabe zeigte KEINE Mapbox-Vorschläge. Root Cause: `useTaxiGeocoder.js` las `mapboxgl.accessToken`, der erst nach asynchronem `loadMapbox()` gesetzt wird → User tippte vor Map-Init → API call mit `access_token=undefined` → 401 → leere Suggestions.
- 🟢 **Fix**: `useTaxiGeocoder.js` nutzt jetzt `process.env.REACT_APP_MAPBOX_TOKEN` direkt. Static `import mapboxgl from "mapbox-gl"` entfernt (bessere Lazy-Load). Zusätzlich: `AbortController`-Cleanup für race-freie Tipp-Sessions, `autocomplete=true` & `postcode,district` in types.
- 🟢 **Refactor**: Booking Form (~390 Zeilen JSX) extrahiert aus `TaxiPage.jsx` in neue Komponente `components/taxi/TaxiBookingForm.jsx`. TaxiPage.jsx von 1588 → 1251 Zeilen (-21%).
- ✅ Verifiziert via Playwright: "Fahltskamp" → 1 Vorschlag (25421 Pinneberg), "Hauptstr" → 5 Vorschläge.

### 11.05.2026 (iter64 — TaxiPage UX-Bug + Mapbox Lazy-Load)
- 🔴 **UX-Bug**: Klick auf "Unternehmer-Taxi"/"Privat-Taxi" Karten öffnete bei `businessDrivers === 0` (oder `privateDrivers === 0`) das **Fahrer-Bewerbungsformular** statt das Taxi-Bestellformular. User-Frustration: "ich will Taxi bestellen, nicht Fahrer werden".
- 🟢 **Fix**: onClick in `TaxiPage.jsx` Lines 901-908 + 935-942 vereinfacht zu `setTaxiType('business' | 'private')`. Driver-Onboarding ist nur noch über expliziten Eintrag (z.B. Mehr-Tab) erreichbar.
- 🔴 **Performance**: `mapbox-gl` (~800KB) wurde als Top-Level `import` eager in den TaxiPage-Chunk gepackt → blockierte First-Paint der Type-Selection (Map wird auf dieser Stufe nicht gebraucht).
- 🟢 **Fix**: `mapbox-gl` + CSS via dynamic `import()` mit `webpackChunkName: "mapbox-gl"`. Modul-Level Promise-Gate (`loadMapbox()`) verhindert doppelte Loads. Erst bei `taxiType` !== '' → `mapContainerRef` rendert → `loadMapbox()` lädt das Bundle → Map initialisiert. Initial Type-Selection-Render jetzt ohne Map-JS.
- 🟢 **Cleanup**: 3 Stellen `mapboxgl.accessToken` durch `process.env.REACT_APP_MAPBOX_TOKEN` ersetzt (kein Library-Zugriff mehr für Geocoding/Tilequery-Token).
- ✅ Lint clean. Production läuft (`https://bidblitz.ae/api/auctions` HTTP 200, 700ms).


### 11.05.2026 (iter63 — Production 502 Fix + LandingChatbot)
- 🔴 **Root Cause Pass 1**: `--exclude 'data/'` in rsync → `data/bidblitz_kb.py` fehlte → ImportError `ai_chatbot`.
- 🔴 **Root Cause Pass 2**: `livekit-api` Package fehlte in `requirements.txt` → ModuleNotFoundError.
- 🔴 **Root Cause Pass 3**: `pm2 restart api --update-env` behält ALTE Args → neuer Code lief auf `--host 0.0.0.0` statt `--host 127.0.0.1`. Mit `--workers 2` lief Auctions-Background-Loop in BEIDEN Workers parallel → Race-Condition + Port-Bind-Konflikt während alter Prozess noch shutdownte → Worker Exit Status 1.
- 🟢 **Strukturelle Fixes**:
  1. `--exclude 'data/'` aus `deploy.yml` entfernt.
  2. `livekit-api==1.1.0` + `livekit-protocol==1.1.7` in `requirements.txt` gepinnt.
  3. Pre-Boot Import-Validation (`python -c "from server import app"`) nach pip install.
  4. **Clean PM2 Restart**: `pm2 delete api` → `pm2 start ... --workers 1` statt `pm2 restart --update-env`. Garantiert frische Args + Singleton Background-Tasks.
  5. **Port-Polling-Loop** (bis 60s) statt fixed `sleep 5`. Wartet aktiv auf Port-Bind, dumpt sinnvolle Logs bei Timeout.
- ✅ Lokale Smoke-Tests: `from server import app` → 2241 routes loaded. `routes.livekit_streaming` → router OK.
- 🟡 **User Action**: "Save to GitHub" Push.


### 10.05.2026 (iter59 — EV Charging Customer History UI)
- 🟢 `EVChargingHistoryPage.jsx` (Customer-Liste): Stats-Header (Sessions/Total kWh/Total €), Empty-State, Error-State, Session-Cards mit Status-Badge, Station, Stecker, Datum, Dauer, kWh, Kosten, Settlement-Ref, PDF-Download (`/api/ev/receipt/:id/pdf`) und Detail-Link auf `/ev/session/:id`.
- 🟢 Route `/ev/history` in `App.js` verdrahtet.
- 🟢 "Historie"-Button im Top-Bar von `EVChargingMapPage.jsx` ergänzt.
- ✅ Verifiziert: Lint clean, Page rendert (`data-testid="ev-history-title"` im DOM gefunden), Backend `/api/ev/history` (auth via Cookie) liefert `{"sessions": []}` für kunde@bidblitz.com.

### 10.05.2026 (iter60 — OCPP 2.0.1 + Admin/Operator UI angereichert)
- 🟢 **OCPP 2.0.1 CSMS** (`backend/services/ocpp_v201.py`, ~470 Zeilen): vollständige 2.0.1-Implementierung. WebSocket-Endpoint `/api/ev/ocpp/v201/{cp_id}` mit Subprotocol-Negotiation `ocpp2.0.1`.
- 🟢 **OCPP-2.0.1 Inbound-Messages**: BootNotification (neue `chargingStation`-Struct + `reason`), Heartbeat, StatusNotification (evseId+connectorId), Authorize (idToken-Object), TransactionEvent (Started/Updated/Ended ersetzt 1.6 Start/Stop/MeterValues), MeterValues, NotifyReport, NotifyEvent, FirmwareStatusNotification, SecurityEventNotification, DataTransfer, LogStatusNotification.
- 🟢 **OCPP-2.0.1 Outbound-Calls**: RequestStartTransaction, RequestStopTransaction, ChangeAvailability, Reset (Immediate/OnIdle), UnlockConnector, GetVariables, SetVariables, TriggerMessage, GetBaseReport.
- 🟢 **REST protokoll-aware**: `/api/ev/start` und `/api/ev/stop` erkennen `cp.protocol` und routen automatisch zu v1.6 oder v2.0.1. Admin Reset/Unlock/Availability ebenso. Neue Endpunkte `/api/ev/admin/cp/{id}/v201/get-variables|set-variables|trigger|get-base-report`.
- 🟢 **Admin Overview**: zeigt `online_v16` und `online_v201` separat. `ChargePointBody` akzeptiert `protocol` und `connectors[]`.
- 🟢 **End-to-End-Test** (`/tmp/test_ocpp_v201.py`): Boot → Status → /api/ev/start → CSMS RequestStartTransaction → CP Accepted → TransactionEvent(Started) → Updated 1.5 kWh → /api/ev/stop → CSMS RequestStopTransaction → TransactionEvent(Ended) 3 kWh → Wallet-Settlement **€2.35** (3 kWh × €0.45 + €1) ✅ PASS.
- 🟢 **EVAdminLayout angereichert**: Stat-Tiles mit OCPP-Version-Split, Stations-Tabelle mit Such-Input + Protokoll-Badge + Reset/Unlock/Availability/Trigger-Buttons, Inline-CRUD-Forms für Hersteller / Ladestation / Tarif, Sessions-Filter (active/completed/cancelled/failed), Payouts-Approval.
- 🟢 **EVOperatorLayout angereichert**: Live-Online-Counter, eigene Stationen mit Reset/Unlock-Steuerung, Sessions-Filter, Umsatz-Breakdown (€/Session, €/kWh), neuer Tab **Mitarbeiter** mit RFID-Karten Add-Form via `/api/ev/operator/staff`.
- ✅ Verifiziert: Lint clean (Python + JS), Backend reload OK, Admin-UI Smoketest (Tarif-Form rendert mit allen Feldern).

### 10.05.2026 (iter61 — TaxiPage Code-Splitting Phase 2)
- 🟢 **5 Modale extrahiert** in `/components/taxi/`:
  - `TaxiPoiFilterSheet.jsx` (71 LOC) — POI-Filter Bottom-Sheet (Restaurants/Supermärkte/etc.)
  - `TaxiMapStylePicker.jsx` (78 LOC) — Apple-Maps-style Map-Style-Switcher
  - `TaxiSavePlaceModal.jsx` (73 LOC) — Inline Ort-speichern Modal
  - `TaxiFavoritesModal.jsx` (108 LOC) — Favoriten-Liste Full-Screen Overlay
  - `TaxiSaveFavoriteModal.jsx` (91 LOC) — Save-Favorite Center Modal
- 🟢 **TaxiPage.jsx 2323 → 2019 Zeilen** (–304, ~13%). Komponenten via Props (isOpen, onClose, callbacks) gekoppelt — keine Logik-Änderung.
- ✅ Verifiziert: Lint clean, Login + Privat-Taxi-Auswahl OK, Map-Style-Modal öffnet, Streets/Hell/Dunkel/Satellit Vorschauen rendern, POI-Filter-Button im DOM präsent.

### 10.05.2026 (iter62 — ISO-15118 Plug & Charge + TaxiPage Custom Hook)
- 🟢 **ISO-15118 Plug & Charge auf OCPP 2.0.1** (`backend/services/ev_pki.py`, ~210 Zeilen + 4 neue Inbound-Handler in `ocpp_v201.py`):
  - **PnC `Authorize`** mit `iso15118CertificateHashData[]` + `certificate` + eMAID-Token-Type. Trust-Store-Mode (`EV_PNC_MODE=trust_store`) prüft Revocations + eMAID-Contracts; `permissive` (default) akzeptiert für QA; `delegated` für externe V2G-PKI (z.B. Hubject).
  - **`SignCertificate`** (CP→CSMS): CSR-Queue + `requestId`. Admin signiert via `POST /api/ev/admin/pki/sign-csr/{request_id}` → CSMS pusht **`CertificateSigned`** an CP.
  - **`Get15118EVCertificate`** (CP→CSMS): EV-Zertifikats-Anfrage (Install/Update) persistiert für PKI-Forwarding.
  - **`GetCertificateStatus`** (CP→CSMS): OCSP-style Status mit Revocation-Liste (`good`/`revoked`).
### 10.05.2026 (iter63 — POS Restaurant Features P1+P2 — Müller/Aures Parität)
  - **Server-initiierte Calls**: `CertificateSigned`, `InstallCertificate`, `DeleteCertificate`, `GetInstalledCertificateIds`.
### 10.05.2026 (iter64 — TaxiPage Integration + Auto-Dispatch + RKSV)
- 🟢 **REST-Admin-API**: `/api/ev/admin/pki/csrs` (GET pending), `/sign-csr/{id}` (POST), `/trust-anchors` (GET/POST), `/revocations` (GET/POST), `/emaid-contracts` (GET/POST), `/admin/cp/{id}/v201/install-certificate|delete-certificate|installed-certificates`.
- 🟢 **DB-Collections neu**: `ev_pki_csr_queue`, `ev_pki_trust_store`, `ev_pki_revocations`, `ev_pki_authz_log`, `ev_pki_ev_cert_requests`, `ev_emaid_contracts`.
- ✅ **End-to-End-Test** (`/tmp/test_iso15118.py`): PnC-Authorize(eMAID) → Accepted → SignCertificate → CSR queued → Admin signiert → CertificateSigned an CP delivered → Get15118EVCertificate persistiert → GetCertificateStatus(good) → Revocation → GetCertificateStatus(revoked). **PASS**.

- 🟢 **TaxiPage Custom Hook** `useTaxiGeocoder` (`/components/taxi/useTaxiGeocoder.js`, 116 LOC):
  - Encapsulates Mapbox forward-geocoding, debounce-Timer-Management (per-key), `geocodeOnBlur` Coord-Fixup. Wiederverwendbar für andere Map-Module.
- 🟢 **TaxiPage.jsx 2019 → 1975 Zeilen** (–44 weitere). Inline `geocodeSearch`/`geocodeOnBlur` (~70 LOC) + 2 useRef-Timer entfernt.
- ✅ Verifiziert (Playwright): "Berlin Hauptbahnhof" → 6 Suggestions geladen ("Berlin", "Berlin-Neukölln", "Berlin Mitte" mit Berlin/DE Subtitle).

### Status (10.05.2026)
- **LiveKit Streaming**: Code bereit; LIVEKIT_URL+LIVEKIT_API_KEY/SECRET in `/app/backend/.env` LEER. **User-Aktion**: Credentials von LiveKit Cloud Dashboard eintragen.
- **Landing Chatbot**: läuft live (`gpt-5`, openai). Health: `{"status":"ok","model":"gpt-5"}`.

### 10.05.2026 (iter64 — TaxiPage Integration + Auto-Dispatch + RKSV)
- 🟢 **TaxiPage Komponenten-Integration** abgeschlossen:
  - `TaxiAddressInput` ersetzt 2 große Inline-Forms für Pickup/Dropoff mit Suggestion-Dropdown
  - `TaxiVehiclePicker` ersetzt Inline-Vehicle-Cards-Loop
  - `TaxiDriverOnboardingModal` ersetzt komplettes 7-Feld-Inline-Modal mit Erfolgs-State
  - **TaxiPage.jsx 1975 → 1655 Zeilen** (–320 weitere, gesamt von 2323 → 1655 = –29%)
  - 4 obsolete useState entfernt: `onboardingForm`, `setOnboardingForm`, `onboardingSubmitting`, `onboardingSuccess`
- ✅ Smoketest: Pickup + Dropoff Inputs sichtbar, Geocoder liefert "Berlin, DE" Suggestion bei Dropoff-Eingabe.

- 🟢 **POS Auto-Dispatcher** (Müller-style category→route mapping):
  - `POST /api/pos/bonweiterleitung/category-map` (upsert)
  - `GET /api/pos/bonweiterleitung/category-map?store_id=X`
  - `POST /api/pos/bonweiterleitung/auto-dispatch` (cart_id → gruppiert Items nach `category`, sendet jede Gruppe an die konfigurierte Route)
  - Voided Items werden ignoriert, Items ohne Category werden als `skipped` zurückgegeben

- 🟢 **RKSV (Österreich)** — `pos_rksv.py` (~280 LOC):
  - `/api/pos/rksv/state` — Kassen-Status (Kassen-ID, Umsatzzähler, aktiv/inaktiv)
  - `/api/pos/rksv/start-beleg|null-beleg|monats-beleg|jahres-beleg|schluss-beleg`
  - `/api/pos/rksv/sign-sale` — Standard-Verkaufsbeleg mit verketteter HMAC-SHA-256-Signatur
  - `/api/pos/rksv/dep` + `/api/pos/rksv/dep/verify` — Datenerfassungsprotokoll export & Chain-Verify
  - Per-Store HMAC-Secret aus `RKSV_SECRET` env-var (oder default seed)
- ✅ **End-to-End-Test** `/tmp/test_rksv_autodispatch.py`: Start-Beleg → 3× sign-sale → Null/Monats/Jahres-Beleg → DEP-Verify (7 Belege chain-valid) → Schluss-Beleg → Auto-Dispatch routes + category-map setup. **PASS**.

- 🟢 **Sections** (Restaurant/Terrasse/Außer Haus): `/api/pos/sections/create|list` mit Farbe+sort_order.
- 🟢 **Tisch-Rename** `/api/pos/tables/rename` (Audit-trailed, role-checked).
- 🟢 **Tisch-Verschieben/Merge** `/api/pos/tables/move` mit `merge=true` für Cart-Zusammenführung. Aktualisiert pos_tables (src→available, dst→occupied) + pos_carts.table_id.
- 🟢 **Storno + Werbung** `/api/pos/carts/item/void` mit kind=`storno|werbung`, separater `pos_void_log` Collection für Audit. `/api/pos/voids/log` Endpoint.
- 🟢 **Kellner-PIN-Login**: `/api/pos/waiters/create|login|deactivate`. PIN HMAC-SHA256 mit per-Kellner Salt, niemals im API-Response exposed.
- 🟢 **Kellner-Abrechnung** `/api/pos/waiters/{id}/abrechnung?date_from&date_to`: sale_count, item_count, total, cash/card-Split, tips. Default = heute.
- 🟢 **Bonweiterleitung** `/api/pos/bonweiterleitung/create|list|dispatch|deactivate|dispatches`:
  - Modi `umsatzuebergabe` | `bondruck`
  - Felder: request_url, response_url, backup_path, request_interval_s, response_check_interval_s, serial_number, external_number, waiter/table-Filter, betrieb
  - `dispatch` sendet Bon via httpx POST → loggt in `pos_bon_dispatches` mit Status (`delivered`|`http_error`|`network_error`|`queued`), inkrementiert `serial_number` atomar.
- 🟢 **Frontend** `POSRestaurantTab.jsx` (530 LOC) als neuer Tab in `POSPage.jsx`:
  - **Tische+Bereiche**: visuelles Grid (3-6 Spalten), Section-Filter-Buttons (Restaurant/Terrasse/Außer Haus), Rename/Move/Release-Aktionen pro Tisch, Move-Visualisierung mit gelbem Hervorheben.
  - **Storno/Werbung**: Audit-Log-Liste mit kind-Badge, voided_by E-Mail, Datum.
  - **Kellner**: Add-Form (Name/PIN-numeric/E-Mail) + Liste mit Avatar, Deactivate.
  - **Kellner-Abrechnung**: Picker (Kellner + Date-Range) + 7-Stat-Tiles (Sessions/Items/Umsatz/Trinkgeld/Bar/Karte/Sonstige).
  - **Bonweiterleitung**: Create-Form (Name/Modus/Betrieb/URL) + Routen-Liste mit Serial + Last-Dispatches mit Status-Badge.
- ✅ **End-to-End-Test** `/tmp/test_pos_p1p2.py`: 18 Assertions PASS (3 Bereiche, 2 Tische, Rename → "VIP-Tisch", Move t1→t2 erfolgreich, Release, void-log queryable, Waiter PIN-Login OK + falsche PIN → 401, Abrechnung returnt summary mit total/cash/tips, Bon-Route create→list→dispatch(fake-cart 404)→deactivate). Lint clean.
- ✅ **UI-Smoketest** (Playwright): Login → POS → Restaurant Tab → alle 5 Sub-Tabs gefunden, Bonweiterleitung Anlege-Form rendert mit 4 Feldern.

### Phase A — Mobile Build Automation
- Bundle ID migration to `com.bidblitz.app` (iOS, Android, Capacitor, Deep Links)
- `build-mobile-final.sh` script + ANDROID_SIGNING_STEPS.md + IOS_RELEASE_STEPS.md

### Phase B — POS Hardware Integrations (43 endpoints total)
- `/api/pos/hardware/printer/print` (ESC/POS)
- `/api/pos/hardware/scanner/test|register`
- `/api/pos/hardware/cash-drawer/open`
- `/api/pos/hardware/scale/weight`
- `/api/pos/hardware/tse/sign`

### Phase C — Landing-Page Chatbot
- `/api/landing-chatbot/chat|leads|analytics` (gpt-4.1-mini via Emergent LLM Key, multi-turn session memory)

### Phase D — LiveKit Live-Streaming
- `/api/livekit/rooms` POST (create) + GET (list)
- `/api/livekit/token` (publisher/viewer mode)
- `/api/livekit/rooms/{name}/products|recording/start|stop|analytics`

### Phase E — Super-App Marketplace + Wallet
- `/api/super-app/marketplace/categories|items`
- `/api/super-app/wallet/balance|topup`
- `/api/super-app/gaming|creator|analytics`

### POS Enterprise Retail Features (REWE/Lidl-Niveau)
- `/api/pos/receipts/void` + `/return` + `/digital`
- `/api/pos/products/weighted/create|lookup`
- `/api/pos/age-verify` (Dual-Mode: cart_id ODER birth_year/id_checked/required_age)
- `/api/pos/products/age-restricted`
- `/api/pos/prices/bulk-update`
- `/api/pos/supervisor/dashboard|alert`
- `/api/pos/smart-cart/start|scan|checkout`
- `/api/pos/exchange-rate`, `/tax-free/register`, `/loss-prevention/dashboard`

### Frontend UI Wiring (this iteration)
- `LandingChatbot` global widget mounted in App.js root layout for `!user.isAuthenticated` (visible on every guest route incl. `/` and `/landing`)
- New route `/landing` → `LandingPage` with embedded chatbot
- New route `/livekit-stream` → `LiveKitStreamPage` (room list + create + host/viewer token UI)
- New route `/wallet-dashboard` → `WalletDashboard` component
- New route `/super-marketplace` → `SuperAppMarketplace` component
- POSPage RetailTab now has 4 action buttons: Bon-Storno, Rückgabe, Altersverifikation, Hardware-Test
- New components: `POSHardwareModal` (printer/scanner/drawer/scale tabs), `AgeVerificationModal` (FSK 16/18 with ID-check)

## Test Status
- Backend: 19/19 PASS (LiveKit, POS-Hardware, age-verify dual-mode, landing-chatbot, super-app)
- Frontend: 3/3 PASS (LandingChatbot global, LiveKitStreamPage testids, POS RetailTab 4 buttons + Hardware modal)
- Test report: `/app/test_reports/iteration_47.json`
- Pytest harness: `/app/backend/tests/test_iter46_livekit_hardware.py` (19 tests)

## Test Credentials
- admin@bidblitz.ae / BidBlitz2026!
- admin@bidblitz.com / BidBlitz2026!

## P2 Backlog (Optional, non-blocking)
- LandingChatbot Claude Sonnet 4.5 (sobald Emergent-Key Anthropic-Zugriff bekommt)
- LiveKit Recording → S3/local storage
- birth_year range error i18n + better UX
- AdminLandingLeadsPage Lead-Export als CSV

## P0 — User Action Required (External)
- Generate Android Release Keystore via `/app/frontend/build-mobile-final.sh`
- Configure real keys in backend/.env: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- Submit to App Store + Play Store (guides in `/app/frontend/deploy/`)

## Mocked Integrations
- LiveKit: `.env` placeholder structure prepared. User must fill real keys from cloud.livekit.io before live streaming works.
- Landing-Chatbot: NOW LIVE with gpt-4.1-mini (was keyword matcher in iter47)

## Changelog
- **10.05.2026 (iter59 — EV Charging Business Layer komplett)**:
  - 🟢 **Operator-Modell**: `ev_operators` mit pending/active/suspended-Workflow, Staff-Sub-Collection (`ev_operator_staff` mit viewer/manager-Rollen), Payouts-Pipeline (`ev_operator_payouts` mit requested→approved→paid), Commission-Logs (`ev_operator_commissions`).
  - 🟢 **Settlement mit Commission-Split**: `finalize_session()` rechnet Brutto/Netto/MwSt sauber, zieht Gesamtbetrag vom User, transferiert auf Operator-Wallet, dann zweite Buchung Operator→Plattform-Pool für Commission. Verifiziert: 5.5 kWh × €0.50 + €1 = €3.75 → Net €3.15 + VAT €0.60 (19%) → Platform-Fee €0.56 (15%) + Operator-Share €3.19.
  - 🟢 **Commission-System**: Default 12%, override per Operator (`ev_operators.commission_pct`), override per Charge-Point (`ev_charge_points.commission_pct_override`).
  - 🟢 **Tariff-Erweiterung**: `vat_rate`, `time_rules` (Zeit-basierte Tarife), `idle_fee_per_minute`, `minimum_fee` — PUT `/api/ev/admin/tariffs/{id}` zum Editieren.
  - 🟢 **Hardware-Vendor-Onboarding**: `ev_station_models` mit OCPP-Version, `max_power_kw`, `connector_types`, `firmware_versions`. Endpoints: `POST /api/ev/admin/hardware-vendors/models`, `GET /api/ev/admin/hardware-vendors/{vendor_id}/models`.
  - 🟢 **Receipt + PDF**: `services/ev_receipt.py` mit reportlab, generiert produktionsreifes PDF (A4) mit Header, Kunde/Station, Fahrtdaten, Pricing-Breakdown (Energie/Zeit/Sessiongebühr), Net/VAT/Total. Sequentielle Receipt-No `BB-EV-{YYYY}-{seq:06d}` via MongoDB-Counter. Endpoints: `GET /api/ev/receipt/{session_id}` (JSON) + `GET /api/ev/receipt/{session_id}/pdf` (3.2 KB PDF). Verifiziert: PDF erfolgreich erzeugt + heruntergeladen.
  - 🟢 **Admin-Endpoints**: Operator-Status-Toggle, Commission setzen, Payout-Decisions (approved/rejected/paid mit SEPA-External-Ref → Operator-Wallet wird beim "paid" um den Betrag reduziert + transactions-record).
  - 🟢 **Operator-Endpoints**: Register, Profile, Stations/Sessions/Revenue, Payout-Request, Staff-Management.
  - 🟢 **Frontend (10 neue Pages)**: 5 Admin-Pages (`AdminEVOverviewPage`, `AdminEVOperatorsPage`, `AdminEVHardwareVendorsPage`, `AdminEVTariffsPage`, `AdminEVPayoutsPage`) + 5 Operator-Pages (`EVOperatorDashboardPage`, `EVOperatorStationsPage`, `EVOperatorSessionsPage`, `EVOperatorRevenuePage`, `EVOperatorPayoutsPage`). Alle als dünne Wrapper über zwei Shared-Layouts (`EVAdminLayout`, `EVOperatorLayout`) — DRY ohne Code-Duplikation. Routes wired in App.js: `/admin/ev/*` und `/operator/ev/*`.
  - 🟢 **Receipt-Download im Customer-Flow**: `EVLiveSessionPage` zeigt nach Abschluss "Quittung PDF · BB-EV-2026-XXXXXX"-Link.
  - 🟢 **End-to-End-Test** (`/tmp/test_ev_business.py`): Admin → Operator-Approval → 15% Commission → CP-Erstellung → Hardware-Model → CP-Connect → Customer-Charge → Settlement → PDF-Download → Operator-Payout-Request → Admin-Approve → Admin-Mark-Paid (SEPA-Ref). Alle Schritte erfolgreich, alle 8 Acceptance-Criteria YES.
  - 🟢 **Live-Verifikation**: Admin-EV-Page rendert mit echten DB-Daten (7 Stationen, €6.10 Lifetime-Umsatz, 8.5 kWh).
- **10.05.2026 (iter58 — EV Charging Module komplett: echtes OCPP-1.6J CSMS)**:
  - 🟢 **Backend**: `services/ocpp_csms.py` (~360 Zeilen) — vollständige OCPP-1.6J CSMS-Implementierung. WebSocket-Endpoint `/api/ev/ocpp/v16/{charge_point_id}` mit Subprotocol-Negotiation `ocpp1.6`. Wire-Format `[2,id,action,payload]` / `[3,id,result]` / `[4,id,error,desc,details]` korrekt implementiert. In-Memory-Registry für aktive Verbindungen.
  - 🟢 **OCPP-Messages eingehend**: BootNotification, Heartbeat, Authorize, StartTransaction, StopTransaction, MeterValues, StatusNotification.
  - 🟢 **OCPP-Messages serverseitig**: RemoteStartTransaction, RemoteStopTransaction, ChangeAvailability, Reset, UnlockConnector — mit Future/Promise-basiertem CALL-Tracking + Timeout.
  - 🟢 **REST API** (`routes/ev_charging.py`, ~520 Zeilen): Customer-Endpunkte `/api/ev/stations`, `/api/ev/station/{id}`, `/api/ev/start`, `/api/ev/stop/{session_id}`, `/api/ev/session/{id}`, `/api/ev/history`. Operator-Endpunkte (Stations/Sessions/Revenue). Admin-Endpunkte (HardwareVendors, ChargePoints, Tariffs, Sessions, Overview, Availability/Reset/Unlock-Befehle).
  - 🟢 **Wallet-Integration**: `core/payment_engine.TransactionType.EV_CHARGING` neu hinzugefügt. `finalize_session()` führt atomaren `transfer_between_wallets(user → operator)` durch. **Verifiziert**: 3 kWh × €0.45 + €1 = €2.35 wurden vom User abgezogen + an Operator gutgeschrieben (`TRF-FBE1F1AD`, status `completed`).
  - 🟢 **DB-Collections**: ev_charge_points, ev_connectors, ev_charging_sessions, ev_meter_values, ev_tariffs, ev_authorizations, ev_hardware_vendors, ev_activity_logs (komplette Audit-Trail jeder OCPP-Message persistiert).
  - 🟢 **Security**: nur registrierte charge_point_ids dürfen sich verbinden (1008 Policy Violation bei unbekannten), Single-Use id_tags (BB-XXX), kein doppeltes Charging pro User, KYC-Wallet-Pre-Check vor Start, server-side Preisberechnung.
  - 🟢 **QR/NFC/Deeplink**: `bidblitz://ev/start/{cp}/{c}` + `https://bidblitz.ae/ev/start/{cp}/{c}` automatisch beim Onboarding generiert.
  - 🟢 **Frontend**: `EVStartChargingPage` (lädt Station/Tarif/Wallet, Reservierungsbetrag editierbar, "Jetzt laden"-Button) + `EVLiveSessionPage` (Live-kWh-Anzeige, Power, Live-Kosten, Pulse-Animation, Stop-Button). Routes `/ev/start/:cp/:c` und `/ev/session/:id` in App.js verdrahtet.
  - 🟢 **End-to-End Smoketest** (`/tmp/test_ocpp.py`): WebSocket-Charge-Point-Simulator führt komplettes Szenario durch — Boot/Status/Heartbeat → REST `/api/ev/start` → CSMS sendet RemoteStart → CP antwortet mit Accepted → CP sendet StartTransaction → MeterValues 3 kWh + 22 kW → REST `/api/ev/stop` → CSMS sendet RemoteStop → CP sendet StopTransaction → finalize_session() → Wallet-Settlement OK. **Status: completed, final_cost €2.35**.
  - **Keine Fake-Simulation**: Hardware muss physikalisch via OCPP-1.6 verbunden werden. Backend wartet auf reale Charge-Points.
- **08.05.2026 (iter57d — Resend DNS Tools + GitHub Actions CI + Taxi Code-Splitting Phase 1)**:
  - 🟢 **Resend DNS-Endpoints (Admin-only)**: `GET /api/admin/test-email/dns-status` (live DNS-Check), `POST /api/admin/test-email` (Smoketest-Mail) — verifiziert: Domain `bidblitz.ae` ist im Resend-Dashboard noch nicht verifiziert + `TXT send.bidblitz.ae` SPF-Record fehlt. Komplette Anleitung in `/app/RESEND_DNS_FIX.md`.
  - 🟢 **GitHub Actions CI-Workflow** `.github/workflows/ci.yml` hinzugefügt: Frontend-Lint+Build + Backend-Ruff+Pytest auf jedem Push/PR (kein Setup nötig). Ergänzend zur bestehenden `deploy.yml` für Hetzner-Auto-Deploy.
  - 🟢 **TaxiPage Code-Splitting Phase 1**: extrahiert in `/app/frontend/src/components/taxi/`:
    - `TaxiConstants.js` (MAP_STYLES, STATUS_COLORS/LABELS, VEHICLE_ICONS, POI_CATEGORIES)
    - `TaxiVehicleIcon.jsx` (Standard/Premium/Van SVG-Silhouetten)
    - `TaxiHistoryView.jsx` (komplette Verlauf-Tab UI als stateless Komponente)
  - `TaxiPage.jsx` von 2438 → **2323 Zeilen** reduziert (–115 Zeilen). Verifiziert: Verlauf-Tab rendert mit extrahierter Komponente, alle Tabs funktional, kein Crash.
- **08.05.2026 (iter57c — Taxi POI Filter + Ride-History UI Polish)**:
  - 🟢 **POI-Filter (Mapbox Tilequery API)** für taxi.eu Parität: Floating Button "In der Nähe" links unten auf der Map. Bottom-Sheet mit 6 Kategorien (Restaurants, Supermärkte, Tankstellen, Apotheken, Geldautomat, Bahnhöfe). Ergebnisse als Custom Mapbox-Marker mit Category-Farbe + Emoji + Popup "Als Ziel setzen". Verifiziert: 13 Restaurant-Marker laden für Berlin Mitte.
  - 🟢 **Taxi Ride-History UI** komplett neu gestaltet: Stats-Header (Fahrten-Anzahl + Ausgaben), Pickup→Ziel Route mit Connection-Dots, Status-Badge, Vehicle-Icon + Distanz, Bewerten-Button, Refresh-Button, professioneller Empty-State.
  - 🟢 **Wallet React "unique key prop" Warning** behoben: defensive Key-Fallback im Transaction-List Mapping.
  - 🟢 **Pre-Deploy-Check** für bidblitz.ae: PASS. `.gitignore` von 156 blockierenden `.env`-Zeilen bereinigt (656 → 500 Zeilen).
- **08.05.2026 (iter57b — P0 Crash-Fixes + Mapbox Migration finalisiert)**:
  - 🔴 **WalletPage JSX-Crash** behoben: Quick-Actions-Grid `<motion.div>` war kaputt (User-Number-Card + QuickSend in Tag-Attribute reingeschrieben + Duplikat-Block). Sauberer Rewrite: User-Number-Card und QuickSend-Section stehen jetzt VOR dem Quick-Actions-Grid.
  - 🔴 **WalletContext** erweitert: `userNumber` jetzt Teil des State (initialState, SET_WALLET reducer, context value) — WalletPage liest `wallet?.userNumber || wallet?.user_number || wallet?.user?.user_number`. Behebt "Laden..." Bug.
  - 🔴 **TaxiPage mapStyle ReferenceError** behoben: fehlende `useState` Hooks für `mapStyle` und `showMapStyles` (mit localStorage-Initialisierung) hinzugefügt.
  - 🔴 **TaxiPage getGreeting ReferenceError** behoben: durch Inline-IIFE für Begrüßung (Guten Morgen/Tag/Abend/Nacht) ersetzt.
  - 🟡 **Leaflet → Mapbox Migration finalisiert**: alle `L.divIcon`, `L.marker`, `L.latLngBounds`, `setLatLng`, `setView` durch `mapboxgl.Marker`, `mapboxgl.LngLatBounds`, `flyTo` ersetzt. Geocoding (Forward + Reverse + onBlur) auf Mapbox API umgestellt — Autocomplete liefert jetzt PLZ + Stadt + Country-Code als Subtitle (taxi.eu Parität).
  - 🟡 **Backend `/api/wallet/send`** akzeptiert nun `recipient_email`, `recipient_number` (BE-XXXXX), oder `recipient` (auto-detect via "@"). Neuer Endpoint `/api/wallet/lookup-recipient?q=...` zur Empfänger-Validierung. `/api/wallet/` Response liefert nun `user_number` und `user`-Objekt.
  - 🟡 **Backend `/api/taxi/status`**: private_drivers Counter toleriert nun `driver_online` ODER `driver_active` ODER `driver_status='online'` Flag.
  - 🟡 **Frontend `/api/taxi/driver/status` → `/api/taxi/status`**: TaxiPage rief falschen Endpoint für Driver-Counts.
  - ✅ Verifiziert: Wallet zeigt `BE94874` für Admin korrekt, Taxi-Map rendert mit Pickup-Input + 6 Mapbox-Suggestions für "Berlin" (Berlin-Neukölln, Berlin-Mitte, Berlin-Wilmersdorf, etc. mit "Berlin, DE" Subtitle), keine Runtime-Errors.
- **04.05.2026 (iter57 — P2 Bündel a+b+c+d)**:
  - **(a)** Apple Privacy Manifest erstellt: `/app/frontend/ios/App/App/PrivacyInfo.xcprivacy` mit allen Datenkategorien (Email, Name, Phone, Photos/KYC, Location, Purchase, Payment, Crash, UserID) + Required-Reason-APIs (UserDefaults, FileTimestamp, BootTime, DiskSpace) — iOS17+ App Store-konform.
  - **(b)** LandingChatbot/Lead-Scoring **upgraded gpt-4.1-mini → gpt-5** (Claude Sonnet 4.5 nicht via Emergent-Key zugänglich, gpt-5 ist top-tier verfügbar). Health endpoint: `{"model":"gpt-5","provider":"openai"}`. End-to-End-Smoke-Test ✅ erfolgreich (echte qualitativ-höhere Antwort generiert).
  - **(c)** LiveKit S3 Egress-Recording: Code bereits vorhanden in `livekit_streaming.py:253-330`. Doku `/app/LIVEKIT_S3_RECORDING_SETUP.md` erstellt — AWS-Bucket, IAM-Policy, ENV-Vars, API-Beispiele, Costs.
  - **(d)** Age-Verification-Modal UX verbessert: Live-Alter-Berechnung mit Farbindikator (✓/min Age), Range-Validation 1900–`currentYear`, bessere Error-Messages (4-stellig + Range + Mindestalter), Alter-vorab-Check vor API-Call (kein wasted Network-Roundtrip), object-detail.message Parsing.
- **04.05.2026 (iter56 — Legal/Compliance Smoke-Test)**:
  - ✅ Smoke-Test verifiziert: `/privacy`, `/terms`, `CookieBanner` rendern korrekt ohne JS-Errors. Layout intakt, Bottom-Nav unverdeckt.
  - ✅ JSX-Syntax-Fix `<10%` → `&lt;10%` in `TermsPage.jsx` Zeile 32 (verifiziert via Lint + Render).
  - ✅ `STORE_SUBMISSION_CHECKLIST.md` erstellt — komplette App Store + Play Store Submission-Checklist (DSGVO/UAE-konform, KYC-Banner, Legal-URLs).
  - User-Aktion offen: Resend DNS, Stripe Live-Keys, AAB-Build extern, Apple+Google Account.
- **Feb 2026 (iter53 — Bug Hotfix)**: 
  - 🔴 **Stripe Checkout BROKEN**: `/api/auctions/buy-credits-stripe` nutzte direktes `stripe_mod` mit ungültigem `sk_live_...` Key → "Invalid API Key" 500-Error im Frontend als "Server error". Fix: Refactored auf `emergentintegrations.payments.stripe.checkout.StripeCheckout` (Emergent-Proxy) + `STRIPE_API_KEY=sk_test_emergent` in `/app/backend/.env`. Test-Checkout-Session erfolgreich erstellt (`cs_test_...`).
  - 🔴 **"Access denied" / "Server error" englisch**: `services/api.js` formatApiError ignorierte dict-details mit `.message` → fiel zurück auf String(detail) = `[object Object]`, dann generische englische Fallbacks. Fix: formatApiError parst jetzt `.message`, `.msg`, `.detail`, `.error` Felder. Alle Fallback-Strings ins Deutsche übersetzt (timeout, offline, network, 401-500). KYC-Block-Error zeigt nun "Bitte verifiziere zuerst deinen Ausweis…" statt "Access denied".
- **Feb 2026 (iter52)**: Slack/Discord Webhooks für Hot-Leads (>80), Score-Refresh + Score-Historie (immutable timeline), Lead-Funnel-Tracking (5 Stages), LiveKit Egress server-side recording.
- **Feb 2026 (iter51)**: Differentiated Resend status, automatic LLM lead scoring.
- **Feb 2026 (iter50)**: P2-Batch CSV-Export, GridFS Recording, Sales-Call Invite, Extended Analytics.
- **Feb 2026 (iter49)**: Fix LiveKit env empty-string fallback, fix LiveKitStreamPage response-body-double-read.
- **Feb 2026 (iter48)**: P2 cleanup, livekit-client v2.5 web SDK, /live-shopping → LiveKitStreamPage.
- **Feb 2026 (iter48 P0)**: Landing-Chatbot LIVE LLM (gpt-4.1-mini), Android keystore, LIVEKIT .env, build pipeline verified.
- **Feb 2026 (iter47)**: LandingChatbot global mount, /landing route, age-verify dual-mode, POS RetailTab.
- **Feb 2026 (iter46)**: Backend Phases A-E complete (43 endpoints).
- **Feb 2026**: Bundle ID `com.bidblitz.app`, mobile build scripts, 18 POS Enterprise features.
