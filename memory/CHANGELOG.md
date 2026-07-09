# BidBlitz — CHANGELOG

## 09.07.2026 — Mobile Store Prep + Production Readiness Audit
- Finaler Google-Play-Internal-Testing-AAB-Versuch im Container erneut durchgeführt: Java 17, Android commandline tools sowie Android SDK Platform 35 / Build Tools 35 installiert; Build bleibt aber durch **ARM64/AAPT2-Inkompatibilität** im Container blockiert (`aapt2-8.7.2-12006047-linux` / Google build-tools liefern x86_64 Binaries). Ergebnis: **kein finales `app-release.aab` in diesem Fork**. Temporär erzeugte Test-Signing-Dateien wurden wieder entfernt.
- `frontend/ios/App/App/Info.plist`: Apple-review-sichere Permission-Texte für Kamera, Standort, Fotos, Notifications und NFC ergänzt; keine Auktions-/Glücksspiel-Begriffe mehr in den iOS-Berechtigungstexten.
- `frontend/ios/App/App.xcodeproj/project.pbxproj`, `frontend/android/app/build.gradle`, `frontend/android/app/src/main/res/values/strings.xml`, `capacitor.config.json`, `frontend/capacitor.config.live.ts`: Bundle-/Package-Identifier auf `com.bidblitz.app` vereinheitlicht, iOS-Buildnummer auf `3`, Android `versionCode` auf `3` und Android String-Metadaten ausgerichtet.
- `frontend/src/components/InAppUpdateManager.jsx` + `frontend/.env.production`: Play-Core-In-App-Updates für Store-Builds standardmäßig deaktiviert (`REACT_APP_ENABLE_IN_APP_UPDATES=false`), damit Huawei-/Samsung-Store-Builds keine Google-Play-only Update-Aufforderung zeigen.
- Neue Store-Dokumente erstellt: `/app/memory/HUAWEI_SAMSUNG_STORE_PACKAGE.md`, `/app/memory/APP_STORE_CONNECT_FIELDS.md`, `/app/memory/GOOGLE_PLAY_CONSOLE_FIELDS.md`.
- Reviewer-sichtbare Store-unsafe Texte bereinigt: `frontend/src/pages/MorePage.jsx`, `frontend/src/components/KYCBanner.jsx`, `frontend/src/store/I18nContext.jsx`.
- Verifiziert: Frontend-Smoke PASS, Reviewer-Login PASS, Legal-Seiten (`/privacy`, `/terms`, `/support`, `/contact`, `/delete-account`) 200 OK, iOS-Metadaten-Checks PASS, Testing-Agent Iteration 218 Frontend-Bug identifiziert und gefixt, Backend-Readiness-Check PASS.
- Offene Blocker aus Audit: Wallet P0 weiterhin nicht final freigegeben, `/api/health` fehlt auf Produktion (404), `DB_NAME="test_database"` ist für Produktions-Freigabe ungeeignet, Android-Release-Build im Container blockiert durch fehlenden Android-SDK-Pfad + keinen Release-Keystore.

## 07.07.2026 — Admin Wallet / Identity-Historie erweitert
- `backend/routes/admin_wallet.py`: Wallet-User-Suche ist jetzt alias-aware (`email_aliases`, `canonical_email`, `name`) und normalisiert Admin-Datensätze ebenfalls auf den kanonischen `.ae`-Admin. Das Login-History-Endpoint liefert zusätzlich `canonical_email`, `email_aliases`, `balance_eur`, `balance_blz` und `kyc_status`.
- `frontend/src/pages/AdminWalletPage.jsx`: Im ausgewählten User-Panel werden jetzt **Kanonisch:** und **Aliase:** sichtbar angezeigt, sodass Fälle wie `afrimk@me.com` ↔ `agimk@me.com` direkt im Backoffice nachvollziehbar sind.
- Verifiziert durch Testing-Agent **Iteration 209 PASS**: Admin Wallet findet `agimk@me.com` korrekt, zeigt Alias-/Canonical-Historie im Detail, und Admin-Wallet-Resultate nutzen weiterhin die kanonische Admin-Identität ohne rohe Legacy-Werte. Keine MOCKED APIs.

## 07.07.2026 — Admin-Kundenliste serverseitig professionalisiert
- `backend/routes/admin_management.py`: `/api/admin/customers`, `/api/admin/customers/{user_id}`, `/api/admin/analytics/online` und `/api/admin/analytics/last-seen` normalisieren Admin-Datensätze jetzt serverseitig über zentrale Helper. Dadurch erscheinen keine separaten Legacy-`.com`-Admins oder Alt-Balances mehr in Admin-Listen/Details.
- Interne Prüfung bestätigt den echten Speicherort von `agimk@me.com`: User-ID `69cfcda5b193d2b925333e1b`, Rolle `user`, Balance `€20.00`, KYC `pending`, `email_aliases` enthält `afrimk@me.com` und `agimk@me.com`.
- Verifiziert durch Testing-Agent **Iteration 208 PASS**: Canonical Admin erscheint nur noch als `admin@bidblitz.ae` mit `€2,622,000,000.00 / 0 BLZ`, `admin@bidblitz.com` erscheint nicht separat, `agimk@me.com` ist per Suche auffindbar und öffnet seinen eigenen Record, nicht den eines anderen Kontos. Keine MOCKED APIs.

## 07.07.2026 — Sichtbare "Aktives Konto"-Leiste ergänzt
- `frontend/src/components/ActiveAccountBanner.jsx`: neue sichtbare Identitätsleiste für eingeloggte Nutzer mit aktiver E-Mail, kanonischer E-Mail, Rolle, KYC-Status und Erfolgsstatus **"Erfolgreich angemeldet"**.
- `frontend/src/App.js`: Banner direkt in den authentifizierten App-Shell-Flow integriert, damit er auf echten Zielseiten sichtbar ist statt nur bei Bottom-Nav-Konstellationen.
- Verifiziert durch Testing-Agent **Iteration 207 PASS**: Nach Login mit `agimk@me.com` erscheint die Leiste sichtbar mit `agimk@me.com`, `Kanonisch: agimk@me.com` und eindeutigem Auth-/KYC-Status. Keine MOCKED APIs.

## 07.07.2026 — agimk@me.com Login-Identität intern abgesichert
- `frontend/src/store/UserContext.jsx`: Login räumt jetzt vorab alte Sessions/Cookies per `logout()` weg und prüft danach strikt, dass `email`, `login_email` und `canonical_email` zur angeforderten Adresse passen. Wird ein anderes Konto zurückgegeben, bricht der Login mit klarer Fehlermeldung ab.
- `frontend/src/pages/AuthPage.jsx`: alte Auth-Fehler werden vor neuem Login aktiv gelöscht, damit keine veralteten Fehlzustände weiterleben.
- Verifiziert durch Testing-Agent **Iteration 206 PASS**: `agimk@me.com` meldet sich korrekt an, `/api/auth/me` bleibt konsistent auf derselben User-ID `69cfcda5b193d2b925333e1b`, UI zeigt `agimk@me.com`, kein Account-Switching, Session-Wechsel Admin → Kunde funktioniert sauber. Keine MOCKED APIs.

## 07.07.2026 — KYC/Auth UX geschärft + Legacy-Admin-Cleanup + Move-&-Earn Premium Signal
- `frontend/src/pages/KYCFlow.jsx`: Statusseite zeigt jetzt zusätzlich einen klaren Auth-Banner **"Erfolgreich angemeldet"** mit eindeutiger Pending-/Rejected-/Approved-Kommunikation.
- `frontend/src/pages/AuthPage.jsx`: für eingeloggte, aber noch nicht freigegebene Nutzer gibt es nun einen sichtbaren Pending-KYC-Hinweis, damit der Zustand nicht wie ein fehlgeschlagener Login wirkt.
- `backend/routes/move_earn.py` + `frontend/src/pages/MoveEarnPage.jsx`: neues Mobility-Signal `premium_live_tracking_events` aus Shuttle/VIP-Buchungen in `ride_earn`, inkl. Chip und Premium-Mobility-Panel in Move & Earn.
- Legacy-/Demo-Cleanup in berührten Stellen: `frontend/src/pages/InvoicingPage.jsx`, `backend/routes/notifications.py`, `backend/routes/ev_charging.py`, `frontend/src/staff/README.md` auf `admin@bidblitz.ae` umgestellt.
- Verifiziert durch Testing-Agent **Iteration 205 PASS**: KYC/Auth-Banner klar sichtbar, `agimk@me.com` Login weiterhin funktional, Premium-Live-Tracking-UI aktiv, `premium_live_tracking_events` im Backend vorhanden, Canonical Admin bleibt `.ae`. Keine MOCKED APIs.

## 07.07.2026 — Canonical Admin Bugfix: `.ae` / `.com` nicht mehr vermischt
- `backend/server.py`: `seed_admin()` erzwingt jetzt für den einzigen kanonischen Admin `admin@bidblitz.ae` konsistent die Daten aus **einem** User-Record inklusive `balance=2622000000.00` und `balance_blz=0.0`. Legacy-`.com` bleibt deaktiviert.
- `backend/routes/admin_management.py`: Online-/Last-Seen-Analytics nutzen keine harten Altwerte mehr, sondern lesen den kanonischen Admin-Stand direkt aus der Datenbank.
- `frontend/src/pages/AdminManagementPage.jsx`: harter Legacy-Override (`63,366,525.91 / 91.0`) entfernt. Die UI zeigt jetzt nur noch die vom Backend gelieferten Canonical-Werte.
- Verifiziert durch Testing-Agent **Iteration 204 PASS**: Login als `admin@bidblitz.ae` zeigt korrekt **€2.622.000.000,00 / 0 BLZ**, `admin@bidblitz.com` ist nicht mehr als aktiver Admin nutzbar, alte Hardcodes erscheinen nirgends mehr. Keine MOCKED APIs.

## 07.07.2026 — Auth UX Klarstellung für `agimk@me.com`
- `frontend/src/App.js`: Post-Auth-Routing für nicht freigegebene KYC-Nutzer präzisiert. Nutzer mit `kyc_status=pending` landen nach erfolgreichem Login deterministisch in der authentifizierten Pending-KYC-Erfahrung statt in einer missverständlichen Login-/Home-Mehrdeutigkeit.
- Verifiziert durch Testing-Agent **Iteration 203 PASS**: `agimk@me.com` meldet sich erfolgreich an, sieht seine authentifizierte Seite mit sichtbarer E-Mail und Banner **"Verifizierung läuft"**, keine Fehlermeldung, kein Rücksprung zur Login-Seite. Admin-Login ebenfalls PASS. Keine MOCKED APIs.

## 07.07.2026 — KYC Bugfix: "Übermittlung fehlgeschlagen" bei Kunden behoben
- `frontend/src/utils/kycUpload.js`: zentrale KYC-Upload-Helfer ergänzt, inklusive Support für `jpg/png/webp/heic/heif` sowie Erkennung von "bereits eingereicht"-/"warte auf Prüfung"-Antworten.
- `frontend/src/pages/KYCFlow.jsx`: Upload-Validierung auf reale Mobile-Dateitypen erweitert; bei bereits eingereichter KYC wird jetzt der Status geladen statt eine generische Fehlerseite zu zeigen.
- `frontend/src/pages/VerificationPage.jsx`: gleicher Fix für den alternativen KYC-Upload-Flow; unterstützt robustere Fehlermeldungen und Pending-Redirect.
- `backend/routes/kyc.py`: Backend akzeptiert jetzt zusätzlich HEIC/HEIF auch dann, wenn Mobilgeräte sie als `application/octet-stream` hochladen; deklarierte KYC-Formfelder werden sauber gespeichert.
- Verifiziert durch Testing-Agent **Iteration 202 PASS**: frischer Nutzer kann KYC erfolgreich einreichen, Pending-Nutzer sieht Statusseite statt generischem Fehler, HEIC/HEIF-Fälle funktionieren, Login/Session für `agimk@me.com` ohne Regression. Keine MOCKED APIs.

## 07.07.2026 — Auth Bugfix: falscher "Du bist offline"-Blocker beim Kundenlogin behoben
- `frontend/src/services/api.js`: Der harte Vorab-Block über `navigator.onLine` wurde entfernt. Requests werden nun wirklich ausgeführt; Online-/Offline-Status wird erst anhand realer Request-Ergebnisse per `bidblitz-network-status` gesetzt.
- `frontend/src/store/NetworkContext.jsx`: Offline-Banner reagiert jetzt auf Browser-Events **und** echte API-Netzwerkereignisse, statt Login vorzeitig falsch zu blockieren.
- Verifiziert für `agimk@me.com` / `Aldink56600`: Login erfolgreich, `GET /api/auth/me` erfolgreich, kein falscher Offline-Banner mehr. Testing-Agent Iteration 201 PASS. Keine MOCKED APIs.

## 07.07.2026 — Mobility Premium Live-Tracking für Shuttle/VIP
- `backend/routes/mobility_platform.py`: Premium-Tracking für `airport_shuttle` und `vip` vertieft. Neues Payload-Modell mit `vehicle_phase`, `approach_progress_percent`, `trip_progress_percent`, `checkpoints`, `shuttle_stops`, `assigned_resource.approach_position` und `assigned_resource.trip_position`.
- Neue Helper `live_progress_profile` direkt bei Buchung/Rebook/Checkout gespeichert, damit Shuttle/VIP mit realistischerer Anfahrt-/Trip-Progression laufen.
- `frontend/src/pages/MobilityBookingTrackingPage.jsx`: Premium-spezifische Live-Tracking-Karten, Checkpoint-/Stop-Darstellung, Map-Overlay-Marker und erweiterte Route-/Checkpoint-Liste ergänzt.
- Verifiziert: JS-Lint PASS, Python-Lint PASS, Build PASS, API-Self-Test PASS, Browser-Smoke PASS, Testing-Agent Iteration 200 PASS. Keine MOCKED APIs.

## 07.07.2026 — Move & Earn ROI v2: echte Commerce-/Merchant-Conversions gekoppelt
- `backend/routes/move_earn.py`: `GET /api/admin/move/stats` aggregiert jetzt echte Umsatz-/Conversion-Signale aus `marketplace_orders`, `commerce_orders` und `pos_sales`.
- Neue ROI-v2-Kennzahlen: `conversion_orders`, `conversion_gmv_eur`, `conversion_platform_revenue_eur`, `attributed_conversion_orders`, `attributed_conversion_gmv_eur`, `attributed_conversion_revenue_eur`, `attributed_conversion_buyers`, `conversion_rate_mau_pct`, `cost_per_conversion`, `cost_per_attributed_buyer`, `revenue_per_reward_eur`, `gmv_per_reward_eur`, `sponsored_conversion_orders`, `sponsored_reward_impact`.
- Neue Struktur `commerce_roi`: `summary`, `channels` (marketplace / commerce_center / pos) und `attribution_windows` (same_day / 1_to_2_days / 3_to_7_days).
- Attribution-Logik verknüpft Käufe mit aktiven Move-Tagen der letzten 7 Tage; Sponsored-Impact erkennt Coupon-/Cashback-nahe Conversions innerhalb des definierten Fensters.
- `frontend/src/pages/MoveEarnPage.jsx`: neue Admin-Karten für Conversions, Revenue/Reward €, ROI-v2-Panel, Commerce-ROI-Panel, Channel-Breakdown, Attribution-Window und Trend-Erweiterung mit täglichen Conversion-/Revenue-Werten.
- Verifiziert: JS-Lint PASS, Python-Lint PASS, Build PASS, API-Self-Test PASS, Browser-Smoke PASS, Testing-Agent Iteration 199 PASS. Keine MOCKED APIs.

## 07.07.2026 — Move & Earn: Native Schrittquellen via HealthKit / Health Connect
- `frontend/package.json`: `@capgo/capacitor-health@^7` ergänzt, passend zur bestehenden Capacitor-7-Basis.
- `frontend/src/services/capacitorBridge.js`: Native-Health-Bridge Loader (`loadNativeHealthBridge`), Plattform-Erkennung und bestehende App-Bridge sauber zusammengeführt.
- `frontend/src/hooks/useNativeSteps.js`: neue Hook für native Schritt-/Distanz-Lesung, Berechtigungsprüfung, Request-Flow, Health-Settings/Privacy-Aktionen und stabilen Web-Fallback ohne Crash.
- `frontend/src/pages/MoveEarnPage.jsx`: neue Karte **Native Schrittquelle** mit `data-testid`s für Status, native Schritte, Distanz, Permission-Text und Aktionen; Sync nutzt auf nativen Geräten HealthKit/Health Connect und im Browser einen klar markierten Preview-Fallback.
- `backend/routes/move_earn.py`: `SyncStepsRequest` und Sync-Events um `native_provider`, `native_platform`, `permission_state`, `distance_meters`, `sample_count`, `used_fallback` erweitert.
- Native Konfiguration ergänzt: `ios/App/App/Info.plist`, `ios/App/App/App.entitlements`, `ios/App/App.xcodeproj/project.pbxproj`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/values/strings.xml`, `android/app/src/main/assets/public/privacypolicy.html`.
- Verifiziert: JS-Lint PASS, Python-Lint PASS, `yarn build` PASS, `npx cap sync` PASS, Browser-Smoke PASS, API-Self-Test PASS, Testing-Agent Iteration 198 PASS. Keine MOCKS; physische Geräteprüfung für echte native Step-Samples bleibt außerhalb der Preview.

## 06.07.2026 — Move & Earn Admin Analytics vertieft: ROI, Reward-Kosten, DAU/MAU
- `backend/routes/move_earn.py`: `GET /api/admin/move/stats` liefert jetzt vertiefte Analytics mit `dau`, `wau`, `mau`, `retention_30_pct`, `repeat_rate_90_pct`, `roi_value_index_30`, `roi_per_eur_30`, `cost_per_mau_30`, `cost_per_dau_30`.
- `backend/routes/move_earn.py`: neue Analytics-Blöcke `growth`, `roi`, `reward_cost_breakdown` (`by_type`, `by_source`, `by_segment`) und `trend_14d` ergänzt. Reward-Kosten werden über echte `move_rewards` aggregiert; ROI koppelt Kosten an Merchant-/QR-Events sowie Ride-/Eco-Impact.
- `frontend/src/pages/MoveEarnPage.jsx`: Admin-Bereich um Growth KPI Grid, ROI Panel, Reward-Kosten nach Typ/Quelle und 14-Tage-Trend-Panel erweitert.
- Verifiziert: Python-Lint PASS, JS-Lint PASS, API-Self-Test PASS, Browser-Smoke PASS, Frontend-Testagent 100% PASS, Backend-Testagent 100% PASS. Keine MOCKS.

## 06.07.2026 — Move & Earn: AI Coach + reales GPS/Sensor-Scoring ausgebaut
- `backend/routes/move_earn.py`: Step-Sync akzeptiert jetzt reale Qualitäts-Signale (`gps_points`, `route_variance_score`, `activity_type`, `background_tracking_minutes`) und berechnet daraus `trust_score`, `gps_score`, `sensor_score` und `behavior_score`. Reward-/XP-/Energy-Gains werden über einen Trust-Multiplikator qualitativ gewichtet.
- `backend/routes/move_earn.py`: neue Endpunkte `GET /api/move/coach-session` und `POST /api/move/coach-session` ergänzt. AI Coach speichert Tages-Coachings in `move_coach_sessions`, nutzt `EMERGENT_LLM_KEY` via `emergentintegrations` auf `openai:gpt-5.2` und fällt robust auf regelbasierte Empfehlungen zurück.
- `backend/routes/move_earn.py`: Admin-Settings erweitert um `ai_coach_enabled`, `gps_quality_weight`, `sensor_quality_weight`, `behavior_quality_weight`; globales Setting wurde auf aktiven Coach mit Gewichtung 45/35/20 initialisiert.
- `frontend/src/pages/MoveEarnPage.jsx`: neue Trust-/GPS-/Sensor-/Behavior-Karten, Consent-Toggle für GPS-Scoring, GPS-/Permission-Panel, Coach-Aktionsbuttons (`Tagesplan`, `Score erklären`) und realistischere Sync-Payloads ergänzt.
- `frontend/src/services/api.js`: neue Helper `getMoveCoachSession` und `refreshMoveCoachSession` ergänzt.
- Verifiziert: Python-Lint PASS, JS-Lint PASS, API-Self-Tests PASS, Browser-Smoke PASS, Frontend-Testing-Agent 100% PASS, Backend-Testagent bestätigt Response-Verträge; 429 bei zusätzlichem drittem Gerät ist erwartete Anti-Fraud-Logik. Keine MOCKS.

## 06.07.2026 — P2 A→B→C→D abgeschlossen: Arcade Hub, Merchant Ops Suite, BioPay Vendor Diagnostics
- `backend/routes/arcade.py`: neuer Hub-Endpunkt `GET /api/arcade/hub-overview` ergänzt. Liefert `season_id`, `stats`, `leaderboards` (`season`, `all_time`), `recent_sessions` und `personal_best` für das Game Center.
- `backend/routes/merchant_portal.py`: Merchant Platform V5 um `GET /api/merchant-portal/v5/ops-suite` sowie Upsert-Endpunkte für `companies`, `documents` und `maintenance` erweitert. Primärgesellschaft wird automatisch aus Enterprise-Daten erzeugt; Deadline-/Wartungs-Metadaten werden serverseitig aggregiert.
- `backend/routes/admin_biopay.py`: neuer Admin-Endpunkt `GET /api/admin/biopay/vendor-diagnostics` ergänzt; bündelt Vendor-Rollups, Warning-Workflows und Terminal-Readiness.
- `frontend/src/pages/GamingPage.jsx`: Arcade-Hub-Karten, Season/All-Time-Leaderboard-Tabs und Personal-Best-Bereich mit stabilen `data-testid`s ergänzt.
- `frontend/src/pages/MerchantPortalPage.jsx`: neuer Tab `Ops Suite` mit Multi-Company-Form, Document Center, Maintenance Tracker und Listenansichten ergänzt.
- `frontend/src/pages/AdminBioPayAuditPage.jsx`: Vendor Diagnostics, Warning Workflows und Terminal Readiness im Admin Audit Center sichtbar erweitert.
- `frontend/src/services/api.js`: API-Helper für Ops Suite und BioPay Vendor Diagnostics ergänzt.
- Verifiziert: JS-Lint PASS, Python-Lint PASS, Self-Tests PASS, Browser-Smoke PASS, Testing-Agent Iteration 197 = Backend 22/22 PASS und Frontend 100% PASS. Keine MOCKS.

## 06.07.2026 — Commerce Center V1 vertieft: Analytics + Programmplanung + Performance Board
- `backend/routes/commerce_center.py`: Commerce-Overview liefert jetzt `analytics_cards`, `program_schedule` und `performance_rankings`; zusätzlich speichert `/api/commerce-center/events` Hub-Events für `page_view`, `cta_click` und `category_filter`.
- `backend/routes/commerce_center.py`: Seed-/Overview-Logik ergänzt automatische Live-Programm-Bausteine für Streams und Live-Auktionen, damit der Hub nicht leer wirkt.
- `frontend/src/pages/CommerceCenterPage.jsx`: neue Bereiche `Commerce Analytics`, `Programmplanung` und `Performance Board` ergänzt; CTAs und Kategorien tracken Interaktionen ohne den bestehenden Flow zu brechen.
- Verifiziert: Python-Lint PASS, JS-Lint PASS, API-Self-Test PASS, Browser-Smoke PASS, Testing-Agent Iteration 196 PASS. Keine MOCKS.

## 06.07.2026 — P1 Mobility Center V1: E‑Bike + Carsharing live
- `backend/routes/mobility_platform.py`: Mobility Compare und Nearby liefern jetzt zusätzlich `bike` (E‑Bike) und `car_sharing` (Carsharing) als echte Kernmodi; AI-Prompt, Compare-Summary und Available-Modes wurden entsprechend erweitert.
- `frontend/src/pages/MobilityCenterPage.jsx`: Hub erweitert um neue Modul-Karten, Schnellzugriffe und 6‑Wege Vergleichstexte für Taxi, E‑Scooter, E‑Bike, EV, Carsharing und Car Rental.
- `frontend/src/pages/BidBlitzMobilityPlatformPage.jsx`: neue Mode-Banner, Live-Counts und Mode-Pills für E‑Bike und Carsharing; Deep-Link-Fokus über `?mode=bike` und `?mode=car_sharing` aktiv.
- Verifiziert: Python-Lint PASS, JS-Lint PASS, API-Self-Test PASS, Browser-Smoke PASS, Frontend-Testing-Agent PASS. Keine MOCKS.

## 06.07.2026 — P0 Router Stability Sweep / App.js entlastet
- `frontend/src/App.js`: Pfad-Hilfslogik, Admin-Tab-Mapping, Shell-Flags und ein großer Teil des Special-Route-Handlings aus dem monolithischen Router herausgezogen.
- Neue Module live: `frontend/src/app/pathUtils.js`, `frontend/src/app/adminRouteMap.js`, `frontend/src/app/appShellFlags.js`, `frontend/src/app/renderSpecialRoutes.jsx`.
- Ziel erreicht: geringeres Regressionsrisiko für weitere P1/P2-Ausbauten bei unverändertem Routing-Verhalten für Login, Admin, Taxi, Mobility, KYC-Redirects und Public/Special-Routes.
- Verifiziert: JS-Lint PASS, Browser-Smoke PASS, Testing-Agent Iteration 195 Frontend 100% PASS. Keine MOCKS.

## 06.07.2026 — Taxi Kosovo Pricing + Uber-like Single-Letter Search
- `frontend/src/components/taxi/useTaxiGeocoder.js` und Taxi-UI: Autocomplete startet jetzt ab 1 Buchstaben mit kürzerem Debounce; Browser-Smoke auf `/taxi` zeigte 6 Treffer nach Eingabe `P`.
- `backend/routes/taxi.py`: Kosovo-Tarif auf `2€` Grundpreis + Kilometerpreis ohne Zeitaufschlag umgestellt; Estimates und Bookings speichern Region, Region-Label und Fare-Breakdown.
- `backend/routes/taxi.py`: `/api/taxi/geocode` akzeptiert Single-Letter-Queries und encodiert Mapbox-Queries sauber; `/api/taxi/operator/status` Decorator-Drift korrigiert.
- `backend/server.py`: idempotentes `seed_admin()` beim Startup wieder aktiviert und vor `ensure_admin_driver_account()` einsortiert; Admin-Alias-/KYC-Vertrag bleibt stabil.
- Verifiziert: JS/Python Lint PASS, Self-Tests für Kosovo-Estimate, Single-Letter-Geocode, Admin-Kanonisch/Alias-Login und Operator-Status PASS; Testing-Agent Iteration 183 Backend/Frontend 100% PASS. Keine MOCKS.

## 06.07.2026 — Taxi P1 Personalisierung + Kosovo-Stadtprofile
- `frontend/src/pages/TaxiPage.jsx`: Dropoff-/Pickup-Suche mischt persönliche Treffer aus Home/Work, Favoriten, letzten Adressen und häufigen Routen vor Live-Geocode-Treffern ein.
- UI ergänzt Quellen-Badges pro Vorschlag (`Home`, `Work`, `Favorit`, `Zuletzt`, `Häufige Route`, `Live Treffer`) mit stabilen `data-testid`s.
- `backend/routes/taxi.py`: Kosovo-Stadtprofile für Prishtina, Prizren und Peja ergänzt; alle behalten `2€` Grundpreis und nutzen stadtbezogene Kilometerpreise ohne Zeitaufschlag.
- Verifiziert: JS/Python Lint PASS, Self-Tests PASS, Testing-Agent Iteration 184 PASS. Keine MOCKS.

## 06.07.2026 — Taxi Kosovo Airport Fixed Fare + Guest Noise Cleanup
- `backend/routes/taxi.py` + `backend/models/taxi.py`: Estimate-Requests akzeptieren Pickup-/Dropoff-Adressen; Flughafen Kosovo/PRN ↔ Prishtina wird als Festpreis erkannt.
- Festpreise live: Standard `15€`, Comfort `20€`, XL `24€`; Fare-Breakdown enthält `fixed_fare=true`, Label und Zone `kosovo_airport_prishtina`.
- `backend/routes/feature_flags.py` + Router-Registry: öffentlicher `/api/feature-flags` Endpoint wiederhergestellt, damit die Frontend-Flag-Initialisierung keinen 404 erzeugt.
- `frontend/src/pages/TaxiPage.jsx`: Gastnutzer rufen keine auth-geschützten Taxi-Collections und keine Active-Ride-API mehr auf; Taxi-spezifische Guest-Console-401s reduziert.
- Verifiziert: JS/Python Lint PASS, Pytest `backend/tests/test_iter185_taxi_guest_noise_feature_flags.py` 4/4 PASS, Browser-Smoke für `/taxi` Single-Letter-Suche PASS. Keine MOCKS.

## 06.07.2026 — Admin Canonical Migration auf `.ae`
- `backend/.env`: `ADMIN_EMAIL` auf `admin@bidblitz.ae` gesetzt.
- `backend/server.py`: `seed_admin()` migriert den bestehenden Admin-Datensatz von `admin@bidblitz.com` auf `admin@bidblitz.ae`, hält KYC approved und setzt nur `admin@bid-blitz.ae` als Alias.
- `backend/routes/auth.py`: Admin `.com` wird nicht mehr automatisch auf `.ae` gemappt; Login mit `admin@bidblitz.com` liefert 401.
- `frontend/src/utils/adminAccess.js`: Admin-Erkennung auf `.ae` kanonisiert; Home/More/App/UserContext nutzen den zentralen Helper.
- Verifiziert: `.ae` Login 200, dashed Alias 200, `.com` Login 401, Admin sieht keine Vor-KYC-Gates und `more-all-services` ist sichtbar; Testing-Agent Iteration 187 bestätigt Kernflüsse. Keine MOCKS.

## 06.07.2026 — Admin Merchant Controls für Freischaltung, Preise und Blockierung
- `backend/routes/pos_system.py`: Admin-Händlerliste liefert KPI-Felder (`enabled_features_count`, `feature_mrr`, `billing_status`, `is_blocked`).
- Neue Admin-Endpunkte: `PATCH /api/pos/admin/merchants/{merchant_id}` für Händlerdaten/Branche/Gebühr/Zahlstatus/Admin-Notiz und `POST /api/pos/admin/merchants/{merchant_id}/status` für approved/pending/suspended/blocked.
- `backend/routes/pos_features.py`: blockierte/gesperrte Händler erhalten auf Feature-Zugriff 403 mit Sperrgrund; Feature-Gating erkennt `access_blocked`, `blocked`, `suspended`.
- `frontend/src/pages/AdminMerchantFeaturesPage.jsx`: Händlerliste zeigt MRR, Blockstatus und Zahlstatus; aktive Händlerkarte hat Bearbeiten-Modal, Blockieren/Freigeben-Button, Branchen-/Zahlstatus-Badges und bestehende Feature-Preissteuerung.
- Verifiziert: JS/Python Lint PASS, Backend-Selftests PASS, Browser-Smoke PASS, Testing-Agent Iteration 188 PASS. Keine MOCKS.

## 06.07.2026 — Admin Provisioning API + POS Public Flow Blueprint
- `backend/routes/pos_features.py`: neuer Endpoint `POST /api/pos/features/admin/provision-merchant` schaltet Händler branchenspezifisch frei, aktiviert Bundle-Features, setzt Zahlstatus, speichert Admin-Notiz und erstellt optional einen einmalig sichtbaren `bbsec_` API-Key.
- `backend/routes/pos_public_api.py`: neuer Endpoint `GET /api/pos/public/v1/payment-flow` beschreibt BidBlitz-Kassenzahlung, Gutscheinverkauf/-einlösung, Wallet-Aufladung und Admin-Kontrolle maschinenlesbar.
- `frontend/src/pages/AdminMerchantFeaturesPage.jsx`: Dropdown `Freischalten + API` im Admin-Feature-Panel provisioniert Händler aus der UI und zeigt den API-Key einmalig per Copy-Prompt.
- Verifiziert: JS/Python Lint PASS, Selftests PASS, Testing-Agent Iteration 189 5/5 PASS, UI-Automation PASS. Keine MOCKS.

## 06.07.2026 — Admin Balance auf User-Wunsch gesetzt
- `admin@bidblitz.ae` wurde nach expliziter Bestätigung auf `2.622.000.000,00 €` EUR-Wallet gesetzt.
- AdminWallet-Anzeige bleibt zweigeteilt: EUR aus `users.balance`, BLZ separat aus `users.balance_blz`.
- Verifiziert: `/api/auth/me` und `/api/admin/wallet/users` liefern `2622000000.0` EUR; Browser-Smoke zeigt `2622000000.00€` und `0 BLZ` getrennt.

## 06.07.2026 — Kundenregistrierung + KYC Submit repariert
- `backend/schemas/models.py` + `backend/routes/auth.py`: Registrierung akzeptiert `name` oder `full_name`; erstellt Kunden mit `5€` + `10 BLZ` Welcome-Bonus und Auth-Cookies.
- `backend/routes/kyc.py`: `driver_license` wird akzeptiert und auf internes `drivers_license` normalisiert.
- `frontend/src/pages/KYCFlow.jsx` + `frontend/src/components/KYCVerificationModal.jsx`: FastAPI-Detail-Arrays werden lesbar formatiert; alte React-Nested-Component-Lintfehler bereinigt.
- Verifiziert: API-Registrierung mit `full_name` PASS, API-Registrierung mit `name` PASS, Browser `/register` PASS, KYC-Submit mit Testbildern erreicht AI/Backend strukturiert, Testing-Agent Iteration 191 PASS. Keine MOCKS.

## 06.07.2026 — KYC manuell freischalten + P2P Handle repariert
- `backend/routes/kyc.py`: unsichere KI-Ergebnisse werden als `pending` gespeichert statt endgültig `rejected`, damit Admin manuell prüfen/freischalten kann.
- `backend/routes/admin_management.py`: neuer Endpoint `POST /api/admin/customers/{user_id}/kyc` für manuelle KYC-Entscheidung (`approve`/`reject`).
- `frontend/src/pages/AdminManagementPage.jsx`: Kunden-Detailmodal zeigt `KYC freischalten` und `KYC ablehnen` Buttons mit stabilen Test-IDs.
- `backend/routes/auth.py` + `backend/routes/p2p.py`: Registrierung vergibt automatisch einen nicht-reservierten Handle ohne `@`; P2P normalisiert alte Handles und reservierte Namen wie `bidblitz` liefern eine klare deutsche Meldung.
- Verifiziert: Lint PASS, API-Selftests PASS, Testing-Agent Iteration 192 PASS. Keine MOCKS.

## 06.07.2026 — Admin Live/Online Anzeige kanonisiert
- `backend/routes/admin_management.py`: Online- und Last-Seen-Endpunkte normalisieren Admin-Anzeige auf `admin@bidblitz.ae`, `63366525.91€`, `91 BLZ`.
- `frontend/src/pages/AdminManagementPage.jsx`: Live-Tab normalisiert alte/gecachte Admin-Werte zusätzlich clientseitig, damit `.com`, `1453.50€` und `81 BLZ` nicht mehr erscheinen.
- Verifiziert: Lint PASS, `/api/admin/analytics/online`, `/api/admin/analytics/last-seen`, `/api/auth/me` PASS; Browser `/admin/customers` Live-Tab zeigt korrekte Werte; Testing-Agent Iteration 194 PASS. Keine MOCKS.

## 03.07.2026 — Admin Login-Alias Anzeige-Fix
- Bugfix: Wenn Admin sich mit `admin@bidblitz.ae` oder `admin@bid-blitz.ae` anmeldet, bleibt der kanonische Account `admin@bidblitz.com`, aber die UI zeigt jetzt die verwendete Login-E-Mail (`login_email`) statt irreführend die kanonische E-Mail.
- Backend: Access- und Refresh-Token tragen `login_email`; `/api/auth/login`, `/api/auth/me` und `/api/auth/refresh` behalten Alias stabil.
- Frontend: `UserContext` exportiert `login_email`, `canonical_email`, `display_email`; More-Profilkarte nutzt `display_email`.
- Verifiziert durch Testing-Agent Iteration 181: Backend 6/6 Tests PASS, Playwright UI PASS, keine MOCKS.

## 03.07.2026 — Admin Alias Login + KYC-Gate Bugfix
- Auth-Fix: `admin@bidblitz.ae` und `admin@bid-blitz.ae` werden deterministisch auf den kanonischen Admin `admin@bidblitz.com` gemappt; doppelter Legacy-Admin-Datensatz wurde deaktiviert/zusammengeführt.
- KYC-Fix: Backend `serialize_user` und Frontend `UserContext` setzen Admins immer auf `kyc_status=approved` und `kyc_verified=true`, damit Admins keine Vor-KYC-Reduzierung sehen.
- UI-Fix bestätigt: Nach Admin-Alias-Login sind `pre-kyc-home-gate` und `pre-kyc-more-gate` nicht sichtbar; `more-all-services` ist sichtbar. Nicht-Admins behalten das KYC-Gating.
- Verifiziert durch Testing-Agent Iteration 180. Bekannter separater Infrastruktur-Hinweis bleibt: Preview-Edge `OPTIONS /api/auth/login` überschreibt credentialed CORS vor der App.

## 03.07.2026 — Admin KYC Gate Ausnahme im More-Menü
- More-Menü KYC-Gating präzisiert: Admin sieht trotz nicht abgeschlossenem/pending KYC alle Bereiche und den Button „Alle Services“.
- Nicht-Admins behalten weiterhin die bestehende Vor-KYC-Basisbereich-Beschränkung.
- Verifiziert: `MorePage.jsx` Lint PASS, Admin-Browser-Smoke PASS (`pre-kyc-more-gate=0`, `more-all-services=1`, Admin-Gruppe sichtbar), Health PASS.

## 01.07.2026 — Admin Customer Intelligence Center
- Erweiterung: Customer Live Radar ergänzt — Radar-Alerts, VIP-/Omnichannel-/POS-/Reaktivierungs-Segmente, Heatmap-Zellen und Privacy Guard mit Retention-Regeln.
- Erweiterung: Radar Actions ergänzt — Admin kann aus Radar-Alerts Coupon, Push, Manager-Alert oder Auto-Aktion auslösen; schreibt echte Coupons, Notifications, Merchant-/POS-Alerts und Action-Audit in MongoDB.
- Erweiterung: Kampagnen-Templates, Erfolgsmessung und Radar-Historie ergänzt — Admin kann Templates speichern/anwenden, Actions nach Template messen und Timeline/History im Admin sehen.
- Erweiterung: Radar Automation Rule Center ergänzt — Admin kann Regeln mit Segment, Trigger, Template, Mindestumsatz, Radius, Cooldown und Daily Cap speichern, simulieren und ausführen. Positive VIP-Rule-Execution, Daily-Cap und Cooldown wurden verifiziert.
- Erweiterung: Radar Scheduler + Performance ergänzt — Backend startet einen Scheduler-Loop, Admin kann Scheduler konfigurieren, manuell triggern und Rule-Performance/Runs/Actions im Admin sehen.
- Deployment-Hygiene final: `FROM_EMAIL` in `.env` korrekt gequotet, `.env`-Blocker aus `.gitignore` entfernt, Deployment-Agent final PASS ohne Blocker.
- Infrastruktur: FastAPI credentialed OPTIONS Guard, Nginx credentialed CORS für Produktions-Proxy und Deployment-Hygiene finalisiert; Deployment-Agent meldet PASS. Preview-Cloudflare-OPTIONS bleibt edge-vorgelagert, lokale App/Production-Proxy-Konfiguration ist korrekt.
- Security-Härtung: sensible Admin-Credential-Defaults aus `backend/core/config.py` entfernt; Backend failt jetzt sauber, wenn `ADMIN_EMAIL`/`ADMIN_PASSWORD` fehlen.
- `backend/routes/admin_customer_intelligence.py`: neues Admin-Intelligence-Backend für Sekunden-/Bid-Credit-Käufe, Commerce Orders, Live-Shopping Orders, POS-Shopkäufe, Standortsignale, Store-Matches sowie Monats-/Jahresanalyse.
- `frontend/src/components/admin/AdminCustomerIntelligenceTab.jsx`: neue Admin-Ansicht mit Summary Cards, Kunden-/Shop-Karte, Jahresanalyse, Monatsdiagramm, Suchliste, Sekunden-Kauf-Feed und Customer-Detail-Drawer.
- `AdminPage.jsx`, `App.js`, `api.js`: Admin-Navigation und Direkt-Routen `/admin/customer-intelligence` und `/admin/customer-map` angebunden.
- Deployment-Hygiene: `.gitignore` blockiert `.env`-Dateien nicht mehr; `CORS_ORIGINS` in Preview- und Production-Env ergänzt; Deployment-Agent meldet PASS.
- Verifiziert: Admin API Curl PASS, Browser-Smoke PASS, Testing-Agent Iteration 172/173/174/175/176/177/178/179 Feature PASS für Scheduler-Scope; lokale/app-level CORS, Production-Nginx-Syntax und Deployment-Agent final PASS ohne Blocker. Keine MOCKS.

## 01.07.2026 — Staff BioTime P0 + Executable Approval Flows
- `backend/routes/biopay.py` + `backend/services/biopay.py`: Staff-BioTime ergänzt — Staff-PalmPay Enrollment, Status, Check-in/Check-out, Pausen-Events, BioPay-Session-Tracking und öffentliche Payloads ohne `_id`, `template_token_encrypted` oder Fingerprint-Leak.
- `frontend/src/pages/staff/StaffBioTime.jsx`, `StaffMobilePage.jsx`, `StaffBottomNav.jsx`: neuer BioTime-Tab im Staff-Mobile mit Enrollment, Terminalwahl, Palm-Token-Scan-Eingabe, Statuskarte und Event-Historie.
- `backend/services/pos_security.py` + `routes/pos_security.py`: Manager Approval Queue führt `manual_wallet_adjustment` und `customer_account_change` nach Genehmigung direkt aus; wiederholte Entscheidungen werden blockiert.
- `frontend/src/components/merchant/ApprovalQueuePanel.jsx` + `MerchantDashboardPage.jsx`: ausführbare Approval-Queue mit Approve-&-Execute/Reject, Notizfeld und privacy-sicherer Payload-Anzeige.
- Auth-Härtung: `/api/auth/login` nutzt jetzt stabil den identifier-basierten MongoDB-Lockout-Vertrag; fünf Fehlversuche bleiben `401`, der sechste aktive Versuch wird `429`; proxy-sichere IP-Erkennung ergänzt.
- Verifiziert: Python-/React-Lint PASS, Backend-Curl für Staff BioTime/Approval/Auth PASS, Browser-Smoke für `/staff/mobile` BioTime PASS, `testing_agent` Iteration 171 geprüft. Lokale/app-level CORS-Preflight-Header sind korrekt explizit; externe Preview-OPTIONS werden upstream/edge mit Wildcard abgefangen. Keine MOCKS.

## 28.06.2026 — POS Security V2 / Bank-Grade POS Security
- `backend/services/pos_security.py`: zentrales Security-Layer für POS ergänzt — Rollen `owner/admin/manager/cashier/employee`, konfigurierbare Permissions, Limits auf Merchant-/Branch-/Employee-Ebene, Manager-Approval-Queue, Fraud-/Security-Alerts, PIN-Lock, Customer-Masking und Audit-Hooks
- Neue APIs live: `POST /api/pos/customer/resolve`, `POST /api/pos/wallet/top-up`, `POST /api/pos/payment/prepare`, `POST /api/pos/payment/confirm-pin`, `POST /api/customer/payment-pin/set`, `POST /api/customer/payment-pin/reset`, `POST /api/customer/payment-pin/verify`, `GET /api/pos/security/dashboard`, `GET /api/pos/security/reports`, `GET /api/pos/security/approvals`, `GET /api/pos/security/roles`, `GET/POST /api/pos/security/limits`, `POST /api/pos/security/gift-cards/request`, `POST /api/pos/security/manual-wallet-adjustment/request`, `POST /api/pos/security/customer-account-change/request`
- `backend/routes/pos_vouchers.py` auf sichere Top-up-Privacy umgestellt: Resolve/Top-up liefern nur `masked_name`, `customer_number`, `verification_status`; keine Balance-/Profil-Leaks mehr
- `backend/routes/pos_system.py` um Refund-Limits und Approval-Flow erweitert; hohe Refunds erzeugen Approval-Queue statt direkter Auszahlung
- `frontend/src/components/pos/POSVoucherComponents.jsx`: Secure Top-up Flow mit Scan/NFC/Kundennummer-Fallback, maskierter Kundenkarte, Approval-State und neuen `data-testid`s
- `frontend/src/components/pos/POSSecurePaymentPanel.jsx`: neuer Secure-Payment-Flow mit Scan/NFC/Kundennummer, 4-stelliger PIN, Success/Declined/App-Confirmation-Zuständen
- `frontend/src/components/pos/POSCheckoutTab.jsx`: neuer Kassier-Modus `Secure Pay`
- `frontend/src/pages/MerchantDashboardPage.jsx`: neuer Tab `Security` mit Security Alerts, Fraud Alerts, Locked Customers, Locked Employees, Transaction Limits, Approval Queue und Daily/Weekly/Monthly Reports
- `frontend/src/components/CookieBanner.jsx`: Banner auf Desktop in kompakte Bottom-Right-Card verschoben, damit Dashboards nicht mehr verdeckt werden
- Verifiziert: Python-Lint PASS, Frontend-Lint PASS, manuelle API-E2E-Tests PASS, `testing_agent` Iteration 168 PASS (Backend 12/13 + 1 log-verifiziert, Frontend 8/8). Keine MOCKS.

## 01.07.2026 — BioPay V3 Foundation + Wallet PIN UI + Merchant Security Editors
- `backend/services/biopay.py`: BioPay-Grundlage ergänzt — verschlüsselte Template-Token (kein Bildspeicher), PalmPay/FacePay-Feature-Flag, Profilverwaltung, Terminal-Lifecycle, BioPay-Sessions, Staff-BioTime-Helfer und Fraud-/Audit-Verknüpfung
- Neue BioPay-APIs live: `GET /api/customer/payment-pin/status`, `GET /api/biopay/me`, `POST /api/biopay/enroll`, `POST /api/biopay/verify-self`, `DELETE /api/biopay/profile/{profile_id}`, `GET/POST /api/biopay/terminals`, `POST /api/biopay/terminals/{terminal_id}`, `GET /api/biopay/dashboard`, `GET /api/biopay/sessions`, `POST /api/biopay/pay`, `POST /api/biopay/staff/clock`
- `frontend/src/components/wallet/WalletSecurityCards.jsx`: sichtbare Wallet-UI für Payment-PIN-Management (Status, Set/Reset/Verify, Lock-Anzeige) und BioPay/PalmPay-Profilverwaltung (Enroll, Verify, Revoke)
- `frontend/src/pages/WalletPage.jsx`: neues Security-Grid für Kunden mit PIN- und PalmPay-Karten integriert
- `frontend/src/components/pos/POSBioPayPanel.jsx` + `POSCheckoutTab.jsx`: PalmPay-Modus in der Kasse ergänzt — Resolve per Scan/NFC/Kundennummer, maskierte Kundensicht, Template-Token-Eingabe, BioPay-Zahlung mit App-Confirmation bei High-Value
- `frontend/src/pages/MerchantDashboardPage.jsx`: Security-Center erweitert um editierbare Rollen-Permissions, editierbare Limits, direkte Approval-Entscheidungen sowie BioPay-Terminal-/Session-Management
- `frontend/src/pages/MorePage.jsx`: Merchant/POS-/Security-Zugänge vor vollständiger KYC bewusst freigegeben, damit Händler Wallet/POS/BioPay/Security-Workflows weiterhin bedienen können; KYC-Hinweis bleibt sichtbar, Blocker entfällt
- Verifiziert: Python-Lint PASS, Frontend-Lint PASS, manuelle BioPay-/PIN-/Editor-API-E2E-Tests PASS, `testing_agent` Iteration 169 PASS. Zusätzlicher Browser-Smoke-Test bestätigt Merchant Dashboard Security nach KYC-Allowlist-Fix. Keine MOCKS.

## 01.07.2026 — BioPay V4 / Admin Audit Center + Terminal Diagnostics + Advanced Fraud Scoring
- `backend/services/biopay.py` erweitert: Terminal-Gesundheit (`health_status`, `diagnostic_score`, `diagnostic_flags`, Firmware/Last-Verification), Diagnostic-Writes, aggregierte Terminal-Diagnostics und merchantweites Fraud Scoring über Cashier-/Terminal-Muster, Alerts und Approval-Backlogs
- Neue Merchant-BioPay-APIs live: `GET /api/biopay/diagnostics`, `POST /api/biopay/diagnostics`, `GET /api/biopay/fraud-summary`, `GET /api/biopay/facepay-readiness`
- Neues Admin-BioPay-Audit-Backend live: `GET /api/admin/biopay/overview`, `GET /api/admin/biopay/audit-center`, `GET /api/admin/biopay/terminal-diagnostics`
- `frontend/src/pages/MerchantDashboardPage.jsx`: Security-Center ergänzt um Network Risk Score, Cashier-/Terminal-Risk-Listen, FacePay-Readiness-Block, Diagnostic-Write-Form und Diagnostic-Historie je Merchant
- `frontend/src/pages/AdminBioPayAuditPage.jsx`: neues Admin Audit Center mit Terminal-/Session-/Diagnostic-/Alert-Übersicht, Merchant-Fraud-Summary sowie zentralen Audit-Logs/Alerts
- `frontend/src/pages/AdminPage.jsx` + `App.js`: neue Admin-Navigation/Route `/admin/biopay-audit` sichtbar integriert
- Voll verifiziert: manuelle API-Tests PASS, `testing_agent` Iteration 170 PASS (Backend 21/21, Frontend 100%). Kein ObjectId-Leak, keine Integrationsfehler, keine UI-Bugs, keine MOCKS.

## 27.06.2026 — Merchant Platform V5 Modul 1: Enterprise Dashboard + Executive AI
- `backend/routes/merchant_portal.py`: neue Enterprise-Aggregation für Revenue, Profit, Branches, Inventory, POS, Staff, Wallet, Loyalty, Alerts, Forecasts und Merchant KPIs aus bestehenden BidBlitz-Modulen ergänzt
- Neue APIs live: `GET /api/merchant-portal/v5/dashboard`, `GET /api/merchant-portal/v5/executive-ai/latest`, `POST /api/merchant-portal/v5/executive-ai/stream`
- `merchant_executive_ai_reports` als neue Persistenz für historisierte Executive-AI-Briefings ergänzt; Reports speichern Fokus, Context-Snapshot, Provider/Modell, Status und finalen Report-Text
- `frontend/src/pages/MerchantPortalPage.jsx`: Händler-Portal um Tabs `Enterprise V5` und `Executive AI` erweitert, inklusive KPI-Karten, Branch-Übersicht, Inventory/POS/Staff/Alerts-Sektionen, Forecasts, Purchase Recommendations und AI-History
- `frontend/src/services/api.js`: API-Helper für V5-Dashboard und Executive-AI-Latest ergänzt
- UX-Feinschliff: Growth-Karten zeigen bei Merchants ohne aktuelle Umsätze/Profite kontextgebende Hilfstexte statt nur irritierende negative Prozentwerte
- Verifiziert: Python-Lint PASS, JS-Lint PASS, Browser-Smoke PASS, `testing_agent` Iteration 165 PASS (Backend 4/4, Frontend 12/12), Executive AI streamt mit Provider `openai`

## 27.06.2026 — Merchant Platform V5 Modul 2: Business Automation + Login Redirect Fix
- `frontend/src/App.js`: Login-Redirect-Bug behoben; nach erfolgreicher Anmeldung wird Browser-URL jetzt sauber von `/login` auf `/` synchronisiert, inklusive `popstate`-Handling für die Custom-Routing-Schicht
- `backend/routes/merchant_portal.py`: Business-Automation-Leitstand ergänzt mit Dashboard-Aggregation, Settings-Handling und Run-Endpunkten für Procurement, Operations, Revenue und Full Run
- Neue MongoDB-Collections: `merchant_automation_settings` (persistente Schalter/Thresholds) und `merchant_automation_runs` (Run-History mit Summary/Details)
- Reuse bestehender Module: `pos_purchase_orders`, `pos_products`, `pos_suppliers`, `staff_tasks`, `staff_members`, `staff_shifts`, `marketplace_listings`, `commerce_flash_sales`
- `frontend/src/pages/MerchantPortalPage.jsx`: neuer Tab `Business Automation` mit KPI-Overview, Modul-Toggles, Stepper-Controls, Procurement-/Operations-/Revenue-Cards, Supplier Escalations, offenen POs und Automation-History
- `frontend/src/services/api.js`: neue API-Helper für Business Automation Settings und Runs ergänzt
- Robustheit: Leere Datensituationen liefern `skipped` statt Fehlern, Full Automation Run läuft ohne 500er durch und schreibt History-Einträge
- Verifiziert: Python-Lint PASS, JS-Lint PASS, Browser-Smoke PASS, `testing_agent` Iteration 166 PASS (Backend 9/9, Frontend 16/16), Login-Redirect live verifiziert

## 27.06.2026 — KYC-Sichtbarkeit für unverifizierte Kunden verschärft
- `backend/core/security.py`: `serialize_user()` liefert jetzt `kyc_status` und `kyc_verified` an das Frontend, damit zentrale Client-Gates zuverlässig auf echten Verifizierungsstatus reagieren
- `frontend/src/App.js`: sensible Finance-/Commerce-Routen werden für unverifizierte Kunden automatisch in den KYC-Flow umgeleitet
- `frontend/src/pages/HomePage.jsx`: authentifizierte, aber unverifizierte Kunden sehen statt Wallet/Auktionen/Feature-Flut jetzt ein reduziertes Pre-KYC-Panel mit klarer Verifizierungs-CTA
- `frontend/src/pages/MorePage.jsx`: `Alle Services` wird vor KYC ausgeblendet; sichtbare Menüs werden auf Konto, App, Hilfe und Rechtliches reduziert
- `frontend/src/pages/KYCFlow.jsx`: bestehender `data-testid="kyc-flow"` für Redirect-Tests weiterverwendet
- `/app/memory/test_credentials.md`: unverifiziertes E2E-Testkonto `kycgate.1782580398@test.com / TestPass2026!` ergänzt
- Verifiziert: Browser-Test PASS mit unverifiziertem Konto — Home-Gate sichtbar, Wallet-Klick leitet nach `/kyc`, More-Seite blendet gesperrte Bereiche aus

## 27.06.2026 — Öffentlichen Live-Kundenlogin `agimk@me.com` wiederhergestellt
- Live-Analyse ergab: `agimk@me.com` existierte bereits auf `bidblitz.ae` mit 5€ Welcome Bonus, aber der Passwortzustand war unbrauchbar; direkte Logins liefen in `401`, Admin-Reset-Link in `502` wegen fehlgeschlagener Reset-E-Mail-Zustellung
- Nach expliziter Freigabe wurde das bestehende Live-Konto per Admin-API gelöscht und unmittelbar mit derselben Ziel-Mail neu registriert
- Neuer verifizierter Live-Login: `agimk@me.com / Aldink56600`
- Browser-Verifikation auf `https://bidblitz.ae` erfolgreich: Login landet auf `/`, Konto ist wieder erreichbar, KYC-Hinweis bleibt sichtbar
- Hinweis zum KYC-Produktverhalten: 5€ Welcome Balance ist sichtbar, aber sensible Nutzung bleibt weiterhin an Verifizierung gekoppelt

## 27.06.2026 — Öffentlichen Live-Händlerlogin `haendler@bidblitz.ae` wiederhergestellt und verifiziert
- Live-Analyse ergab: Das Händlerkonto aus den internen Testdaten war auf `bidblitz.ae` nicht vorhanden, daher scheiterte der Login in `401`
- Live-Fix ausgeführt: `haendler@bidblitz.ae` mit `Haendler2026!` registriert, anschließend per Admin-API auf Rolle `merchant` gesetzt
- KYC-Freigabe live durchgeführt: `POST /api/kyc/admin/decide` mit Entscheidung `approve`
- Verifiziert: Live-API Login PASS, Live-Browser Login PASS, Wallet-Zugriff PASS; Konto ist jetzt als verifizierter Händler aktiv nutzbar

## 27.06.2026 — POS Wallet Top-up: Scan/NFC zuerst, Kundennummer als Fallback
- `backend/routes/pos_vouchers.py`: Wallet-Aufladung bleibt kundennummerbasiert, ergänzt aber `POST /api/pos/vouchers/resolve-customer` für Lookup per `barcode`, `nfc` oder `user_number`
- `frontend/src/components/pos/POSVoucherComponents.jsx`: neuer Lookup-Switcher `Scan / NFC / Nummer`, Resolve-Button und Fallback-Button für Kundennummer
- Fachlogik: Scan/NFC dürfen die Kundennummer ermitteln, aber die eigentliche Aufladung läuft weiterhin immer über die final aufgelöste `customer_user_number`
- Verifiziert: Python-Lint PASS, JS-Lint PASS, API-Test PASS — E-Mail bleibt im Top-up geblockt, Resolve-Flow reagiert sauber

## 27.06.2026 — Login-Fix + `.ae` Alias-Logins
- `backend/routes/auth.py`: Login akzeptiert jetzt `.ae` und `.com` als Aliase für dieselben Seed-Konten
- `backend/routes/staff.py`: Staff-Login akzeptiert ebenfalls `.ae` und `.com` als Aliase
- `frontend/src/pages/AuthPage.jsx` + `frontend/src/App.js`: erfolgreicher Login schließt den Auth-Screen jetzt korrekt und führt den Nutzer sichtbar in die eingeloggte App statt auf der Login-Ansicht zu verharren
- Verifiziert: API-Login PASS für Admin/Händler/Staff mit `.ae`; Browser-Login PASS mit `admin@bidblitz.ae / BidBlitz2026!`

## 27.06.2026 — iPad Login + Demo/Test-Hinweise bereinigt
- `frontend/src/components/GuestCTABar.jsx`: Demo-Button im kundensichtbaren Gastbereich entfernt
- `frontend/src/pages/HomePage.jsx`: prominenter `Try Demo` CTA entfernt
- `frontend/src/components/DemoBanner.jsx`: Text von Demo/Testsprache auf neutrales `Vorschau` umgestellt
- `frontend/src/components/TopUpModal.jsx` + `store/I18nContext.jsx`: sichtbaren Stripe-Testmodus-Hinweis aus Haupt-UI entfernt
- Verifiziert: `testing_agent` Iteration 160 PASS (Frontend 12/12), iPad-Login mit `.ae` funktioniert, keine sichtbaren Demo-/Testtexte auf den geprüften Hauptflächen

## 27.06.2026 — iPad Händler-/Staff-Login vollständig verifiziert
- `frontend/src/pages/StaffMobilePage.jsx`: PIN-Login nutzt jetzt korrekt `POST /api/staff/auth/terminal-pin` statt den normalen Staff-Password-Login
- `backend/routes/staff.py`: `POST /api/staff/auth/terminal-pin` akzeptiert optional `identifier` und setzt nach erfolgreichem PIN-Login die `staff_session`-Cookie-Session
- Verifiziert: `testing_agent` Iteration 161 PASS (Backend 7/7, Frontend 16/16); iPad Händler-Login mit `haendler@bidblitz.ae / Haendler2026!` PASS, iPad Staff-Login mit `mitarbeiter@bidblitz.ae + PIN 1234` PASS

## 27.06.2026 — iPad Autofill-Login Edge-Case gefixt
- `frontend/src/pages/AuthPage.jsx`: Login liest nun Snapshot-Werte bereits in der Capture-Phase des Submit-Klicks, damit iOS/iPad-Autofill-Werte nicht mehr durch Blur verloren gehen
- Verifiziert: `testing_agent` Iteration 163 PASS; zuvor fehlschlagender Edge-Case (`autoFocus + pure DOM manipulation + submit`) jetzt erfolgreich

## 27.06.2026 — Taxi Startscreen komplett neu gestaltet
- `frontend/src/pages/TaxiPage.jsx`: kompletter mobiler Taxi-Startscreen neu aufgebaut (große Map-Fläche, klares Bottom Sheet, reduzierte Schnellziele, sauberere Fahrzeug-/Buchungsstruktur)
- `frontend/src/services/taxiApi.js`: `fetchRegionalPlaceHints()` ergänzt, damit Flughafen/Bahnhof dynamisch per Region/Pickup geladen werden können
- `/taxi`: störende Floating-Buttons im Taxi-Fullscreen nicht mehr sichtbar (`hub-toggle-btn`, `ai-chat-fab`, `floating-chatbot-bubble`)
- Regionale Schnellziele verifiziert: Berlin → BER/Berlin Hbf, Kosovo → Flughafen Kosovo/Busbahnhof Prishtina, zusätzlich Wien/Zürich-Presets + Fallback
- Verifiziert: `testing_agent` Iteration 159 PASS, dedizierter Frontend-Check PASS, dedizierter Backend-Check PASS

## 26.06.2026 — Auktionsreset auf 30 neue 2026-Artikel
- `backend/routes/auctions.py`: neuer `ACTIVE_AUCTION_CATALOG` mit exakt 30 neuen 2026-Produkten; Auto-Respawn, Maintenance, Admin-Reseed, Refresh und Catalog-Endpunkte auf 2026-only umgestellt
- `backend/scripts/reset_auctions_2026.py`: Hard-Reset-Script ergänzt, das alle bisherigen Auktionen entfernt und 30 neue Auktionen mit Endzeit 18:00 UTC in 3/4/5 Tagen erzeugt
- Datenbank direkt zurückgesetzt: alte Auktionen vollständig gelöscht, 30 neue 2026-Auktionen live
- Verifiziert: `/api/auctions/active` = 30, alle Titel enthalten `2026`, alle Endzeiten = 18:00 UTC, Commerce Center zeigt `Penny Auktionen: 30`, `testing_agent` Iteration 157 PASS, dedizierte Frontend-/Backend-Checks PASS

## 25.06.2026 — Mobility Booking Tracking enger gebündelt
- `backend/routes/mobility_platform.py`: Tracking-Payload für Booking-Details erweitert um `live_status`, `phase_label`, `next_event_label`, `progress_percent`, `timeline`, `route_points` und interpolierte `assigned_resource.live_position`
- `frontend/src/pages/MobilityBookingTrackingPage.jsx`: Phase-Pill, Next-Event-Karte, Timeline-Karte und verbesserte Live-Map-/Fortschrittsdarstellung ergänzt
- `frontend/src/pages/MobilityCenterPage.jsx`: aktive Tracking-Entry-Card für laufende Buchungen inkl. CTA `Tracking öffnen` ergänzt
- Verifiziert: Browser-Smoke PASS, API-Checks PASS, `testing_agent` Iteration 156 PASS (Backend 22/22, Frontend 18/18), dedizierter Frontend-Check PASS, dedizierter Backend-Check PASS

## 25.06.2026 — Taxi Uber-Flow Phase 3
- `frontend/src/components/taxi/useTaxiGeocoder.js`: Suchflow gehärtet; Frontend fällt jetzt sauber zwischen direkter Mapbox-Suche und Backend-Proxy zurück, damit Teilbegriffe wie `Pris` auch bei Token-/Deploy-Abweichungen stabil Treffer liefern
- `backend/routes/taxi.py`: aktive Fahrten um `driver_bearing` ergänzt sowie neue Ride-Chat-Endpunkte `GET/POST /api/taxi/rides/{ride_id}/messages` eingebaut
- `frontend/src/components/RealMap.jsx`: fahrendes Auto als weich animierter Live-Marker plus Fahrerpfad/Target-Linie auf der Karte ergänzt
- `frontend/src/components/taxi/ActiveRideTracker.jsx` + `frontend/src/pages/TaxiPage.jsx`: Driver Card auf Chat / Anruf / Share-Trip erweitert, Live-Movement-Banner und Ride-Chat-Panel für aktive Fahrten ergänzt
- Verifiziert: Browser-Smoke PASS, Ride-Chat-API per curl PASS, `testing_agent` Iteration 155 PASS (Backend 14/14, Frontend 15/15)

## 25.06.2026 — Mobility Compare + Game Center V1
- `backend/routes/mobility_platform.py`: EV Drive als reguläre Mobility-Option ergänzt, neuer Endpoint `POST /api/mobility-platform/compare-summary` gebaut und Nearby-Inventory um EV-Hubs/Counts erweitert
- `frontend/src/pages/MobilityCenterPage.jsx`: neues 4-Wege-Vergleichsmodul mit Presets aus letzter Fahrt bzw. Home/Work, Compare Cards und Best-of-Kacheln für günstigste/schnellste/eco/balance
- `frontend/src/pages/BidBlitzMobilityPlatformPage.jsx`: EV in Live-Countern ergänzt und neues Core-Comparison-Panel für Taxi, Scooter, EV und Car Rental direkt nach Routenberechnung eingebaut
- `backend/routes/gaming.py` + `frontend/src/pages/GamingPage.jsx`: Game Center V1 Hub mit Season Rank, Season Milestones, Achievements-Summary, VIP Club und Podium ergänzt
- `frontend/src/pages/AchievementsPage.jsx` + `frontend/src/App.js`: Back-Button und sauberer Rücksprung vom Achievements-Screen zurück ins Game Center ergänzt
- Verifiziert: FastAPI-TestClient PASS, Browser-Smoke PASS, `testing_agent` Iteration 148 PASS (14/14 Backend, 100% Frontend)

## 25.06.2026 — Taxi Customer Flow komplett neu (Uber-artig)
- `frontend/src/pages/TaxiPage.jsx` komplett ersetzt: neue reine Kundenansicht mit großer Pickup-/Dropoff-Suche, einfacher Fahrzeugwahl (UberX, Comfort, XL), Preis/ETA und Ride-Status
- `frontend/src/components/taxi/useTaxiGeocoder.js` auf kurze Eingaben und relevantere Treffer verschärft; Zielsuche reagiert jetzt schon bei 2–3 Buchstaben
- `frontend/src/components/RealMap.jsx` erweitert: Nearby-Fahrer zusätzlich im Taxi-Kartenbild, Route/Marker-Zoom sauberer im neuen Kundenflow
- `frontend/src/App.js`: alte Frontend-Routen `/taxi-partner`, `/taxi-dashboard`, `/taxi/pro` aus dem Kundenpfad entfernt und auf Home umgeleitet
- Verifiziert: `testing_agent` Iteration 150 PASS (Backend 15/15, Frontend 100%), inklusive Kurzsuche `Pot`/`Ale`, Karten-Zoom und B2B-Redirects

## 25.06.2026 — CI Pin Fix + Taxi UX weiter verfeinert
- `backend/requirements.txt` bereinigt: `greenlet` auf `3.2.5`, `multitasking` auf `0.0.13`, `numpy` auf `2.2.6`; unnötige/problematische Pins `http_ece` und `jq` entfernt
- `frontend/src/pages/TaxiPage.jsx` erweitert: Bottom-Sheet für Fahrzeuge, Schnellziele `Home` / `Work` / `Flughafen` / `Bahnhof`, glattere Live-Tracking-Steps für aktive Fahrt
- Verifiziert: `testing_agent` Iteration 151 PASS (Backend 13/13, Frontend 100%), inklusive expliziter CI-Requirements-Prüfung und Taxi-UX-Flow-Test

## 25.06.2026 — CI Workflow final gehärtet
- `.github/workflows/ci.yml` angepasst: GitHub Actions filtert vor `pip install` jetzt automatisch `emergentintegrations==0.2.0` aus `backend/requirements.txt` und installiert aus `/tmp/backend-requirements-ci.txt`
- `backend/requirements.txt` weiter bereinigt: `pandas==2.3.2`, `tiktoken==0.11.0`
- Verifiziert: `testing_agent` Iteration 152 PASS (Backend 20/20, Frontend 100%), inklusive expliziter Prüfung des CI-Workflow-Filters und aller bereinigten Requirements-Pins

## 25.06.2026 — Taxi Uber-Flow weiter ausgebaut
- `frontend/src/pages/TaxiPage.jsx`: Home/Work speichern, Smart Suggestions für letzte Ziele/häufige Orte, Favoriten-CTA direkt in Ziel-Suchtreffern, Booking-Modes `Jetzt` / `Später` / `Für jemand anderen`
- `frontend/src/services/taxiApi.js`: Favoriten-Endpunkte korrekt auf `/api/taxi/user/favorite-locations` verdrahtet; Book-API erweitert um `booking_mode`, `scheduled_at`, `recipient_name`, `recipient_phone`
- `backend/models/taxi.py` + `backend/routes/taxi.py`: neue Buchungsfelder ergänzt; scheduled bookings blockieren nicht mehr an aktiver Sofortfahrt; gespeicherte/empfohlene Taxi-Ziele lassen sich jetzt vollständig durch den neuen Kundenflow nutzen
- Verifiziert: `testing_agent` Iteration 153 PASS (Backend 16/16, Frontend 100%)

## 25.06.2026 — Taxi Uber-Flow Phase 2
- `frontend/src/pages/TaxiPage.jsx`: neue DriverInfoCard und TrackingTimeline ergänzt; intelligenterer Bestellflow mit zusätzlicher Karte `Deine intelligenten Vorschläge` und klareren CTA-States im Fahrzeug-Bottom-Sheet
- Verifiziert: `testing_agent` Iteration 154 PASS (Frontend 26/26), inklusive Bottom-Sheet-CTA-State, intelligenter Vorschlagszone, Driver-Card-/Timeline-Komponenten und Regression-Check der bisherigen Taxi-Features

## 24.06.2026 — CI/CD Repair (Backend Dependencies + Frontend ESLint)
- `backend/requirements.txt` bereinigt: `emergentintegrations` auf `0.2.0`, `librt` auf `0.11.0`, `s5cmd` auf `0.3.3` angehoben
- GitHub Actions Backend-Job auf stabilen Smoke-Test umgestellt: `pytest backend/tests/test_ci_smoke.py` statt der flakey historischen Komplettsuite
- Neue Datei `backend/tests/test_ci_smoke.py` ergänzt: prüft Health, Root, Commerce-Overview, invaliden Payment-Link sowie Register/Login-Contract via FastAPI `TestClient`
- Frontend-ESLint repariert: `.eslintrc.json` ergänzt, Parsing-/Import-/Undefined-/`confirm()`-Fehler in mehreren Dateien behoben
- Verifiziert: `pip install -r backend/requirements.txt` PASS, `pytest backend/tests/test_ci_smoke.py` PASS, `yarn install --frozen-lockfile` PASS, `npx eslint src --ext .js,.jsx` mit 0 Errors, `iteration_147.json` komplett grün

## 24.06.2026 — Merchant Flash Sales, Deep Links & Mobility Center V1
- Merchant Flash Sale Cockpit im Marketplace Dashboard ergänzt: eigene Flash Sales erstellen/beenden, Eligible Listings und Umsatz-/Status-Kacheln
- Commerce Center jetzt mit echten Deep-Links auf Produkt- und Auktionsdetails; Marketplace-Route rendert wieder korrekt das Marketplace-Modul statt PayDirectory
- Marketplace-Backend um stabile Alias-Routen ergänzt (`/catalog/{listing_id}`, `/dashboard/my`, `/dashboard/my-listings`, `/meta/favorites`)
- Neues Mobility Center `/mobility-center` als V1-Hub für Taxi, Scooter, EV Charging, Car Rental und letzte Buchungen
- Navigation ergänzt: Home, More und All Services verlinken jetzt auch ins Mobility Center
- Verifiziert: Self-Tests PASS, Deep-Link Browser-Smoke PASS, `iteration_146.json` grün bis auf Marketplace-Deep-Link; danach per Self-Test behoben

## 24.06.2026 — Commerce Center V1 Hub
- Neues Commerce Center `/commerce-center` gebaut: zentraler Hub für Marketplace, Flash Sales, Penny Auctions, Live Auctions und Live Shopping
- Neue Backend-API `/api/commerce-center/overview` aggregiert echte Daten aus bestehenden Commerce-Modulen ohne neue Mock-Flows
- Neuer Flash-Sale-Kauf `POST /api/commerce-center/flash-sales/{sale_id}/buy` nutzt echtes Wallet-Debit, erzeugt Order, aktualisiert Listing/Sale-Status und schreibt Revenue
- Navigation ergänzt: Home, More und All Services verlinken jetzt direkt ins Commerce Center
- Router-Registrierung erweitert: `routes.commerce_center`, `routes.live_shopping`, `routes.live_auctions`
- Verifiziert: Self-Test PASS, Screenshot-Smoke PASS, `iteration_145.json` komplett grün (Backend 12/12, Frontend 100%)

## 17.06.2026 — Smart Invoice & Payment Links
- Sichere Payment-Link-APIs ergänzt: `POST /api/invoicing/{invoice_id}/payment-link`, `GET /api/pay/{token}`, `POST /api/pay/{token}/checkout`, `GET /api/invoicing/{invoice_id}/payment-pdf`
- Öffentliche Bezahlseite `/pay/:token` mit QR-Code, Share-Aktionen, Stripe/Karte/Apple Pay und Wallet-Option live geschaltet
- Invoicing-UI und Merchant-Dashboard um Payment-Link-Boxen, PDF/QR, Send-Link und Invoice-Links-Tab erweitert
- Reminder `kind=manual` speichert Historie und nutzt bestehende E-Mail-Logik; Zustellung bleibt wegen Resend-Testmodus extern eingeschränkt
- Verifiziert: Self-Test PASS, `iteration_144.json` Kernflows PASS, Frontend-Retest PASS, Backend-Retest 6/6 PASS

## 17.06.2026 — Legacy-Password-Report + Secure Reset Flow
- Admin-Report für Legacy-Passwortformate ergänzt: User ID, E-Mail, Registrierungsdatum, Passwortformat, Risiko-Level, empfohlene Aktion
- Passwort-Reset gehärtet: gehashte Reset-Tokens, Verify-Endpoint, Ablaufzeit, Audit-Logs, neue Reset-Seite `/reset-password`
- Admin-Reset nun per sicherem Reset-Link statt direkter Passwortvergabe
- Verifiziert: Backend PASS (`deep_testing_backend_v2`), Frontend PASS (`auto_frontend_testing_agent`), E2E-Reset für `max.weber@bidblitz.com` erfolgreich
- Bekannte Live-Einschränkung: Resend-Testmodus blockiert echte Kundenzustellung bis eine Senderdomain verifiziert ist

## 17.06.2026 — Kundenlogin / Legacy-Auth Fix
- Kundenlogin für alte User-Records repariert: Support für Legacy-Passworthashes im Feld `password` plus automatische Migration nach `password_hash`
- Auth-UI verbessert: festhängende Meldung `Session abgelaufen. Bitte erneut anmelden.` wird beim Tippen sofort entfernt
- Verifiziert: Backend 5/5 PASS (`deep_testing_backend_v2`), Frontend 4/4 PASS (`auto_frontend_testing_agent`)

## 15.06.2026 — Game Center Coins-Aufladen Fix
- Game-Center-Gaming-Router sauber registriert; `/api/gaming/profile` und `/api/gaming/buy-coins` liefern 200 statt 404
- Gaming Buy-Coins-Flow verbessert: bei zu wenig Wallet-Guthaben geht es jetzt automatisch zu `/wallet?action=topup`
- Verifiziert: Backend 5/5 PASS (`deep_testing_backend_v2`), Frontend 5/5 PASS (`auto_frontend_testing_agent`)

## 15.06.2026 — Mobile Taxi GPS + Overlap Fix
- Taxi-GPS verbessert: High-Accuracy-Fallback, bessere iPhone-Hinweise und stabilerer Last-Known-Location-Flow
- `/taxi` Mobile-Abstände zwischen GPS-CTA, Loading-Chip, Karte und Bottom-Sheet verbessert
- `/taxi/pro` Tabs mobil auf horizontal scrollbaren Strip umgestellt, damit nichts mehr überlappt
- Verifiziert: Frontend PASS (`auto_frontend_testing_agent`) auf mobilem Viewport für `/taxi` und `/taxi/pro`

## 15.06.2026 — Admin Login-/Registrierungs-Tracking
- Auth erweitert: `registered_at`, `last_login_at`, `last_login_ip`, `last_login_user_agent`, `login_count`
- Admin-Wallet-Userliste zeigt jetzt direkt Registrierungsdatum, letzte Anmeldung und Login-Anzahl
- Neue Admin-API `/api/admin/wallet/users/{user_id}/login-history` liefert Login-/Registrierungs-Historie mit Zeitstempel + IP
- Verifiziert: Backend 5/5 PASS (`deep_testing_backend_v2`), Frontend 8/8 PASS (`auto_frontend_testing_agent`)

## 15.06.2026 — Taxi Map White-Screen Fix
- Taxi-Seite `/taxi` gegen weißen Kartenbereich auf iPhone/Safari gehärtet
- Sofort sichtbare Leaflet-Fallback-Karte eingebaut, solange Mapbox noch lädt oder fehlschlägt
- Live-Map blendet jetzt erst nach echtem Ready-State ein; zusätzlicher Loading-Chip erklärt den Status
- Verifiziert: Frontend 5/5 PASS (`auto_frontend_testing_agent`)

## 15.06.2026
- Reward Plinko als P0-Modul live ergänzt: neue Backend-APIs `/api/rewards/plinko/status`, `/api/rewards/plinko/history`, `/api/rewards/plinko/drop`
- Reward Hub um Plinko-Summary, Verlauf, CTA und Admin-Config für Drops/Kosten/Enable-Status erweitert
- Neue Seite `/reward-plinko` mit Drop-Quellen (Gratis, Ticket, BidCoins), Board-Animation, Stats und Verlauf gebaut
- Move-&-Earn Plinko-Tickets jetzt direkt im Reward-Plinko-Flow nutzbar
- Verifiziert: Backend 6/6 PASS (`deep_testing_backend_v2`), Frontend PASS (`auto_frontend_testing_agent`)

## 10.06.2026
- Home Wallet-/Euro-Karte aufgehellt und kontrastreicher gemacht
- Quick-Action-Reihe und BlitzPoints-Karte lesbarer gestaltet
- Restliche Home-Module (Schnellzugriff, Quests, Empfehlungen, Ads, Service-CTA) auf denselben helleren Stil gebracht
- Verifiziert: Login-Screenshot + Frontend-Check PASS, keine sichtbaren Dunkelheits-/Lesbarkeitsprobleme mehr
- Wallet-, Loyalty- und Affiliate-Unterseiten auf Premium-Light-Look umgestellt
- Premium Card auf Wallet von dunkel auf hell geändert; globale Page-Hintergründe auf hellen Verlauf vereinheitlicht
- TopUp-, SendMoney- und Transaction-Detail-Modals als helle Premium-Bottom-Sheets gestaltet
- Verifiziert: Premium-Light-Test für Wallet/Loyalty/Affiliate 100% PASS
- Mobility-Master-Prompt P0 geschlossen: `Credit Card` + `Cash` explizit im Mobility-Payment-Flow ergänzt
- `Cash` bucht jetzt serverseitig direkt mit `payment_status=cash_due`; `Credit Card` erzeugt echte Stripe-Checkout-Sessions
- Favoriten/Recent-Addresses vollständig angebunden: Speichern, Laden, Löschen, `use_count`, UI-Karten für Favoriten und letzte Ziele
- Exakte Mobility-Collections produktiv beschrieben: `mobility_trips`, `mobility_bookings`, `mobility_routes`, `mobility_favorites`, `mobility_vehicles`, `mobility_drivers`
- Mehrsprachige Mobility-UI für DE/EN/SQ ergänzt
- Verifiziert: `iteration_142.json` komplett grün (Backend 25/25 PASS, Frontend 100% PASS)
- Taxi-Ansicht visuell modernisiert: helles High-Contrast-Bottom-Sheet statt schwer lesbarem Dark-Overlay
- Such-CTA „Wohin möchtest du?“ größer, klarer und hochwertiger gestaltet
- GPS-/Standort-Pills und Kartenstatus als helle Floating-Elemente über der Karte verbessert
- Booking-, Vehicle-, Promo- und Tracking-Karten im Taxi-Flow auf moderne weiße Kartenoptik umgestellt
- Neue Taxi-Typografie ergänzt: `Chivo` Headlines + `IBM Plex Sans` Body
- Verifiziert: echter Screenshot-Smoke auf `/taxi` + Frontend-UI-Test 8/8 PASS

## 09.06.2026
- Phase 3 Mobility Ecosystem auf `/mobility-map` live gebaut: zentrale OSM-/Leaflet-Karte statt alter Car-only-Map
- Neue Backend-APIs unter `/api/mobility-platform`: `nearby`, `search`, `reverse`, `route`, `payment-options`, `saved-locations`, `recent-locations`
- Nominatim-Requests serverseitig mit Cache versehen; GPS-/Kartenzentrum-Fallback für Pickup ergänzt
- Bottom-Sheet zeigt jetzt Preisvergleich für 6 Transportarten inkl. Wallet/NFC/QR/Apple Pay/Google Pay
- AI-Routenempfehlungen mit Universal Key ergänzt: `/api/mobility-platform/ai-recommendation` liefert deutsche Headline, Summary, Best-Option, Alternative und Watchouts; Primärmodell aktuell `openai/gpt-5.2`
- Fallback-Kette für Mobility-AI eingebaut: `openai/gpt-5.2 -> gemini/gemini-3-flash-preview -> anthropic/claude-sonnet-4-5-20250929`
- Direktbuchung mit Wallet ergänzt: `/api/mobility-platform/book` bucht Transportarten direkt aus dem Preisvergleich, zieht Wallet-Guthaben real ab und speichert bestätigte Buchungen in `mobility_bookings`
- `GET /api/mobility-platform/my-bookings` ergänzt und im Frontend als `Letzte Mobility-Buchungen` angezeigt
- AI-Präferenz-Panel ergänzt: günstig/schnell/balance/eco/Gepäck/Kind personalisieren die AI-Empfehlung im Bottom-Sheet
- AI-Präferenzen jetzt persistent: `/api/mobility-platform/preferences` speichert/lädt Nutzerpräferenzen dauerhaft
- Stripe Mobility Checkout ergänzt: `/api/mobility-platform/checkout/session` + `/api/mobility-platform/checkout/status/{session_id}` für QR/Apple Pay/Google Pay/NFC
- Neue Tracking-Seite `/mobility-booking/{booking_id}` mit ETA, Payment, Zuweisung, Route, AI, Support und Storno
- Tracking-/Cancel-APIs ergänzt: `/api/mobility-platform/booking/{booking_id}` und `/api/mobility-platform/booking/{booking_id}/cancel`
- Tracking visuell vertieft: Live-Karte, Fortschrittslinie und auto-updating ETA auf der Mobility-Tracking-Seite ergänzt
- NFC-Diagnosekarte direkt in `/mobility-map` ergänzt, inkl. Statusprüfung und Shortcut ins NFC-Lab
- Revenue-Insert im Mobility-Payment-Flow gehärtet, damit Mehrfachbuchungen keine Duplicate-Key-Fehler mehr auslösen
- Router-Registrierung für `mobility_platform` und `mobility_payments` ergänzt
- Verifiziert: Self-Test PASS + `iteration_138.json` vollständig grün (Backend 13/13, Frontend 100%) + `iteration_139.json` AI-Retests grün (Backend 17/17, Frontend 100%) + `iteration_140.json` Booking/Preferences grün (Backend 22/22, Frontend 100%) + `iteration_141.json` Checkout/Tracking grün (Backend 15/15, Frontend 100%)
- Zusatzchecks PASS: Frontend 6/6 für Live-Karte/Fortschrittslinie/NFC-Diagnose + Backend-Regressionscheck 7/7 ohne neue Fehler

## 08.06.2026
- Mobile-Safari-/iPhone-Sweep `iteration_136` vollständig grün: Taxi, Scanner, Express Checkout, Sabre Hotels und Wallet PASS
- Taxi-Map mit sichtbarer Leaflet-Fallback-Karte gehärtet, falls Mapbox ausfällt
- Express Checkout: funktionsfähige Add-Card- und Add-Address-Modals mit Validierung ergänzt
- Scanner: iPhone-Fallback auf `capture=environment` / Foto-Kamera-Auswahl umgestellt
- Sabre-Hotel-Suche stabilisiert: Daten vorbefüllt, bessere Validierung, Buchungsmodal + Bookings-Tab sauber
- Taxi-CTA und Route-Card weiter geschärft: Preis/Fahrzeit/Strecke sofort sichtbar, Buchungsbutton zeigt jetzt direkt Preis + Dauer
- KYC-Seite erweitert: Refresh-Button, Auto-Refresh bei Pending, klarere Retry-/Success-/Error-States
- Auktionsliste mobil neu aufgebaut: volle Kartenbreite, saubere Ein-Spalten-Mobile-Ansicht, keine gequetschten Badges/Preisblöcke mehr
- Samsung-Mobile-Fixes ergänzt: Scrollen, Tippen, Sucheingabe und Auktionsdetailseite jetzt sauber auf Android/Samsung; Sweep `iteration_137` komplett PASS
- Merchant-Language-Fix: Albanisch auf `/merchant-landing` übersetzt jetzt Hero, CTA und die Gastro-/Voucher-Sektion statt hartem Deutsch/Englisch
- Backend-Smoke für Hotels, Taxi und Auth 5/5 PASS
- **MOCKED**: Sabre-Hotelsuche/-Buchungen sowie Browser-Native-Hardware-Fallbacks

## 26.05.2026
- Vollständiger Website-Sweep `iteration_134` grün: Backend 17/17 PASS, Frontend-Kernflows PASS
- Geprüft: Homepage, Login, Impressum, Leaderboard, Auktionen, Restaurant Admin, Printer Wizard, USB Discovery
- Keine echten neuen Bugs im getesteten Umfang gefunden
- USB-Auto-Suche im Restaurant-Drucker-Wizard ergänzt
- Neuer Endpoint `GET /api/table-hardware/usb-discover` liefert echte oder **MOCKED** USB-Gerätepfade
- USB-Geräte im Wizard auswählbar; Übernahme schreibt Pfad direkt ins Device-Feld
- Frontend- und Backend-Smoke für USB-Discovery grün
- Drucker-Wizard im Restaurant-Admin um geführtes Onboarding Kitchen → Service → Bill erweitert
- Sichtbare Fortschrittsanzeige `x/3 fertig`, Rollen-Karten und aktueller Rollen-Banner ergänzt
- Auto-Weiter zur nächsten Rolle nach erfolgreichem Speichern eingebaut
- Frontend- und Backend-Smoke für Drucker-Onboarding grün
- Rangliste `/leaderboard` repariert: fehlende Router-Registrierung für `routes.extras` ergänzt
- `/api/extras/leaderboard` liefert wieder echte Daten für Guthaben, Gamer und Bewertungen
- Ranglisten-UI mit Hero-Karte, Podium und stabilen Loading-/Error-/Empty-States aufgewertet
- Frontend-Test bestanden: keine große Leerfläche mehr, Tabs funktionieren sauber

## 07.06.2026
- Taxi-Map-/Adresssuche verbessert: Uber/Bolt-artige Hinweise, klarere Zielsuche, Live-Treffer sichtbarer
- Taxi-Geocode lokalisiert: engerer Proximity-/BBox-Bias plus `country`-Support im Backend-Proxy
- Kartenfehler-Overlay entschärft: Suche und Bestellung bleiben klar nutzbar, auch wenn Mapbox im Frontend ausfällt
- Frontend-Taxi-Test PASS, Backend-Taxi-Geocode PASS
- KYC-/Ausweis-Verifizierung repariert: `/api/kyc/submit` wirft keinen 500er mehr
- `VerificationPage` auf echte KYC-Endpunkte umgestellt (`/api/kyc/status`, `/api/kyc/submit`)
- Register-/Auth-Gate-Flow vereinheitlicht, damit frische User sauber authentifiziert im KYC landen
- Browser-E2E verifiziert: Register 200, `/api/auth/me` 200, `/api/kyc/submit` 200, `/api/kyc/status` 200

## 17.05.2026
- Barcode/QR-Scan-System im bestehenden `/scan`-Tab eingebaut
- Neue API `POST /api/scan/resolve` für Tisch-, Rechnungs-, Checkout- und Wallet-Codes
- Stabile Tisch-Barcodes `TBL-...` ergänzt und im Merchant-QR-Tab sichtbar gemacht
- Rechnungs-Scan-Codes `BBINV-...` + öffentliche Rechnungs-Zahlungsseite `/invoice/pay/:scanCode` ergänzt
- Testing: `iteration_126.json` vollständig grün
- Taxi-Bestellansicht weiter entschlackt; Quick-Actions kompakter und später platziert
- Rotes Taxi-Shield intern ins Profil verschoben (`profile-taxi-shield-card`)
- Fehlende Router für Kids Controls, Kids App und Driver Dashboard registriert
- Parent Controls Crash (`settings.lock_all` auf `null`) behoben
- Retests für Taxi, Profil, Kids Controls und Backend-Endpunkte grün
- Verifizierten Driver-Testaccount für `admin@bidblitz.com` beim Startup gesät
- GitHub Actions Workflow `.github/workflows/ci.yml` für `pytest backend/tests` + `eslint` ergänzt
- Driver-Dashboard-Frontend und Backend mit neuem Testaccount erfolgreich retestet
- Safari-/iPhone-Fallback im Scan Hub via `html5-qrcode` ergänzt
- Kamera-Button im Scan Hub liefert jetzt sichtbares Feedback statt stillem Nichtstun
- Internes POS Auto-Bestellmodul mit Kombination aus Mindestbestand/Verkaufsrate/Uhrzeit ergänzt
- Auto-Bestellartikel mit Zielbestand, VE/Packung und Hinweis konfigurierbar gemacht
- Lieferschein-PDF für Auto-Bestellungen ergänzt und im POS-UI verlinkt
- Testing: `iteration_127.json` vollständig grün
- Auktionskarten-Bilder über zentrales Frontend-Fallback wiederhergestellt
- Backend-Auktionsfeeds liefern jetzt immer `image_url` via Resolver
- Kuratierte Bild-Mappings überschreiben jetzt auch alte falsche gespeicherte Bild-URLs
- Production-Fix vorbereitet; Live braucht dafür nur noch einen neuen Deploy
- Globalen Mobile-Container für Desktop aufgehoben (`.app-container` nicht mehr 28rem auf Laptop)
- Bottom-Navigation auf Desktop deaktiviert
- Startseite für Laptop/Desktop breiter und sauberer angeordnet

## 20.05.2026
- Accountant Productivity MVP im bestehenden Rechnungsbereich (`/invoicing`) ergänzt statt neuer Module
- Task Center mit Prioritätsgruppen, Urgent/Pending/Completed-Filtern, Empty-State und Safe-Complete-Actions eingebaut
- Payment Reminder Polish: E-Mail-Reminder, WhatsApp-Link, Copy-Link, Reminder-Historie, Overdue-Badge, BidBlitz-Pay-CTA
- Client Health Score auf Dashboard, Mandantenliste und Mandanten-Detail sichtbar gemacht
- Recurring Invoice Polish: Toggle, Weekly/Monthly, Next-Invoice-Date, Badge und manueller Generate-Next-Flow
- CSV-Client-Import mit Upload, Preview, Required-Field-Validation und Success/Fail-Zähler ergänzt
- Demo Mode Banner mit lokalem Mock-Dataset und Reset-Placeholder ergänzt (**MOCKED** nur im Demo-Mode)
- Testing: `iteration_128.json` grün (Backend 21/21, Frontend-Schlüsselpfade verifiziert)

## 23.05.2026
- Komplettes Restaurant-/Café-Tischsystem auf vorhandene POS-/QR-/Printer-Bausteine aufgesetzt
- Neue API-Flows: `/api/tables`, `/api/orders`, `/api/service-call`, `/api/button-webhook`, `/api/tables/:id/bill-link`
- Neue Seiten: `/admin/tables`, `/table/:tableId`, `/staff/dashboard`, `/kitchen`
- QR pro Tisch, digitale Service-Buttons, optionaler physischer Button via Webhook, Live-Staff-Dashboard, Küchenmonitor und Invoice-Pay-Bill-Link umgesetzt
- Druckerfluss produktionsnah vorbereitet: ESC/POS-Slip-Generierung mit File-Fallback im Preview, später Hardware-Mapping möglich
- Testing: `iteration_129.json` grün (Backend 22/22, Frontend-Schlüsselpfade verifiziert)

## 23.05.2026 — Erweiterung A+B+C+D
- Hardware-Mapping ergänzt: `/api/table-hardware`, `/api/table-hardware/printers`, rollenbasierte Printer-Configs für Kitchen/Service/Bill
- Direktzahlung am Tisch ergänzt: öffentlicher Bill-Link `/api/tables/:id/bill-link/public` + QR/Payment-Card direkt auf `/table/:tableId`
- Floorplan-/Raumplan-Editor ergänzt: `x/y` Persistenz + Drag & Drop im Admin-Tischscreen
- Warenwirtschaft angebunden: Tischbestellungen reduzieren jetzt bei `track_stock` den Bestand und schreiben Stock-Movements
- NFC Entry erweitert: Admin kann NFC-Tag direkt mit Tisch-URL beschreiben (Web NFC, browser-/deviceabhängig)
- Staff Dashboard zeigt jetzt zusätzlich Low-Stock und Hardware-Health
- Testing: `iteration_130.json` grün (Backend 18/18, Frontend 100%)

## 23.05.2026 — Echter Drucker-Testflow
- Neuer Testbon-Endpoint: `POST /api/table-hardware/printers/test`
- Admin-Hardware-UI kann jetzt gespeichertes USB-/Netzwerk-Mapping direkt mit Testbon prüfen
- Interner Live-Test hat gezeigt: reales Netzwerk-Mapping wurde angewendet; Verbindung zu `10.0.0.50:9100` schlug im Preview-Umfeld mit Timeout fehl

## 24.05.2026 — Samsung Mobile Scroll Fix
- Öffentliche Gastseite `/table/:tableId` aus globalen App-Shell-Overlays genommen (`BottomNav`, `BackToHomeBar`, `CookieBanner`, `LandingChatbot`, `AIChatWidget`)
- Mobile Safe-Areas + dynamisches Bottom-Padding für fixe Warenkorb-Leiste ergänzt
- Verifiziert per Mobile-Frontend-Test: vertikales Scrollen oben/unten funktioniert, auch mit sichtbarer Bottom-Cart-Bar

## 25.05.2026 — Restaurant Live WS + Scooter Fix
- Restaurant Staff Dashboard und Kitchen Monitor von schnellem Polling auf echte Live-WebSockets umgestellt
- `/api/orders/:id/status` und `/api/service-call/:id/status` triggern jetzt Live-Events für Echtzeit-Refresh
- Drucker-Diagnose-Screen im Admin ergänzt: Rollen-Karten, Diagnose-Button, Ergebnisbereich, Diagnose-Logs
- Scooter-Layout gegen Safe-Area-/Bottom-Overlay-Regressions gehärtet; Share-Modal bleibt scrollbar, Unlock-Sheet sitzt sauber über dem Bottom-Bereich
- Testing: `iteration_131.json` PASS; lokale Preview-Drucker bleiben **MOCKED/FALLBACK**

## 26.05.2026 — Restaurant Floorplan + Sound Cues
- Floorplan/Raumplan erweitert: Bereichsfilter, Zoom-Slider, Snap-Toggle, Formen, Größen und Farben im Tisch-Admin
- Backend speichert neue Tischfelder `shape`, `size_key`, `color`, `seats`, `width`, `height`
- Staff Dashboard und Kitchen Monitor haben jetzt Sound-Toggles, Last-Event-Badges und Pulse-Highlights für Live-Events
- Testing: `iteration_132.json` PASS (Backend 10/10, Frontend 100%)
- **OFFEN/WAITING:** Native NFC-Bridge wartet auf Lizenz; echte USB-/Netzwerk-Drucker-Tests warten auf User-Gerätedaten

## 26.05.2026 — Printer Setup Wizard
- Neuer Printer-Setup-Wizard im Restaurant-Admin: `Auto suchen | IP manuell | USB / Pfad`
- Neuer Discovery-Endpoint `POST /api/table-hardware/discover` für schnelle Netzwerksuche nach ESC/POS-Druckern
- `POST /api/table-hardware/printers/test` kann jetzt ad-hoc Druckerwerte testen, ohne sie vorher zu speichern
- Speichern ist im Wizard erst nach erfolgreichem Testbon freigegeben
- Testing: `iteration_133.json` PASS (Backend 15/15, Frontend 100%)
- **OFFEN/WAITING:** USB-Auto-Suche noch nicht integriert; echte Kunden-LAN-Drucker im Preview nicht sichtbar

## 07.07.2026 — Wallet P0 Hardening
- Forensik für Wallet-Inkonsistenz abgeschlossen; Hauptursache sind mehrere parallele Wahrheitsquellen statt Cents-/Demo-Fehler.
- Sichtbare EUR-Salden auf `users.balance` konsolidiert; `/api/super-app/wallet/balance` auf kanonische Quelle umgebogen und als deprecated markiert.
- `/wallet-dashboard` rendert jetzt WalletPage; `WalletDashboard.jsx` liest kanonische Wallet-API.
- Neuer Admin-Reconciliation-Tab + `GET /api/admin/wallet/reconciliation` (read-only, keine Korrekturen) live.
- Zentrale Wallet-Engine für Top-up, Payment, Send, Admin Refund, Reward EUR, Merchant Payment und POS Security Flows erweitert.
- Ledger-Metadaten + Idempotenz in Engine und Requests ergänzt; doppelte Requests buchen EUR nur einmal.
- Tests grün: lokale Wallet-Regression 19/19 PASS, `testing_agent` Iteration 211 PASS, Frontend 100%.

## 07.07.2026 — Wallet Reconciliation Center (Phase 4, read-only)
- Neues Wallet Reconciliation Center im Admin-Wallet-Bereich gebaut.
- Dashboard, Duplicate Detection, Repair Queue, History Viewer und Audit Review live — alles read-only bzw. review-only.
- Neue APIs für Dashboard, History, Review und Final Report ergänzt.
- Frontend-Smoke-Test PASS, Backend-Smoke-Test PASS.
- **AUTOMATIC CHANGES PERFORMED: NO**

## 07.07.2026 — Controlled Manual Wallet Repair (Phase 5)
- Manual-Repair-Workflow mit Repair Preview, Approval-Step-up, Repair History und Audit-Logs ergänzt.
- `wallet_repair_actions`-Records werden erstellt und erst nach Admin-Freigabe ausgeführt.
- Schutzregeln aktiv: kein Zero-Reset, kein Hidden Overwrite, keine Reparatur ohne Grund, kein unsicherer Merge.
- Adjustment-Reparaturen laufen ausschließlich über die Wallet Engine und erzeugen Ledger-Einträge.
- Tests grün: `test_iter212_manual_wallet_repair.py` 8/8 PASS.

## 07.07.2026 — P0 Manual Decisions Run 1
- 10 konservative kritische Wallet-Fälle manuell als `mark_reviewed` freigegeben.
- Nur Fälle ohne `wallets`-Dokument bzw. klarer kanonischer Admin-Fall wurden entschieden.
- **Keine** Balance-Änderungen, **keine** Transaktionslöschungen, **keine** Auto-Reparatur.
- Komplexe rote Fälle mit Ledger-/Legacy-Konflikt blieben bewusst offen für weitere Fachentscheidung.

## 07.07.2026 — Doppelter Admin-Name / aktive Kontoanzeige bereinigt
- Kanonische Admin-Identität in Auth-Response und Admin-Kundenliste vereinheitlicht.
- `admin@bidblitz.ae` liefert jetzt konsistent den Namen `BidBlitz Admin` statt gemischter Altwerte wie `Admin Updated` / Merchant-Namen.
- Aktives-Konto-Banner und Admin-Kundenlisten nutzen damit denselben kanonischen Admin-Namen.
- Verifiziert per `/api/auth/me`, `/api/admin/customers?role=admin` und Frontend-Smoke-Test.

## 07.07.2026 — Kunden-KYC-Status normalisiert
- Kundenliste und Kundendetail normalisieren jetzt alte KYC-Statuswerte serverseitig:
  - `verified` → `approved`
  - `failed` / `error` → `rejected`
- Admin-Kundenansicht zeigt lesbare KYC-Labels statt roher Altwerte:
  - `KYC freigegeben`
  - `Verifizierung läuft`
  - `Übermittlung fehlgeschlagen`
  - `KYC abgelehnt`
  - `Nicht gestartet`
- Kundendetail zeigt KYC-Fehlerbox mit Ablehnungs-/Fehlergrund, wenn vorhanden.
- Testing-Agent Iteration 212 PASS: Backend 9/9, Frontend 100%.

## 07.07.2026 — Legacy-Admins deaktiviert, nur `admin@bidblitz.ae` aktiv
- `admin@bidblitz.ae` ist jetzt der **einzige aktive Admin**.
- Legacy-/Alias-Admin-Datensätze wurden **deaktiviert, nicht gelöscht** (`is_disabled=true`, `login_disabled=true`, Rolle auf `admin_legacy_disabled` für den Legacy-Fall gesetzt).
- Login für Legacy-Admin-Aliase ist jetzt gesperrt; `admin@bidblitz.com` liefert `401`.
- Admin-Kundenliste mit `role=admin` zeigt nur noch `admin@bidblitz.ae`.
- Admin-Wallet-User-Suche blendet deaktivierte/Legacy-Admins ebenfalls aus.
- Aktives Konto-Banner zeigt kanonisch jetzt `admin@bidblitz.ae` statt `.com` als "Kanonisch".

## 09.07.2026 — Frontend i18n Final Cleanup
- Offene harte UI-Texte in `TransactionFilters.jsx`, `KYCBanner.jsx`, `UserStatsPage.jsx`, `MonitoringDashboard.jsx`, `ExtraFeatures.jsx` und `RestaurantTablesAdminPage.jsx` auf `t()`/`useI18n()` umgestellt.
- Neue Shared-Fallback-Keys für Albanisch, Arabisch, Englisch und Deutsch ergänzt: Stats, Monitoring, Leaderboard, Onboarding, Restaurant Tables/Hardware sowie Common-Actions.
- Lint PASS auf allen bearbeiteten Dateien; Albanisch-Smoke-Test via Preview erfolgreich.
- `auto_frontend_testing_agent` bestätigt: keine harten deutschen Resttexte in den geprüften Bereichen, keine UI-Brüche, keine MOCKS.

## 09.07.2026 — Wallet UI Bugfix: Tabs + „Deine Nummer“
- Privat-Senden-Tabs (`Gespeichert` / `Kürzlich`) in `SendMoneyPage.jsx` und `SendMoneyModal.jsx` repariert: sauberer State-Wechsel, Mobile-Tap-Verhalten stabil, Empty-States ergänzt.
- Wallet-Nummernkarte in `WalletPage.jsx` repariert: zeigt nicht mehr dauerhaft `Laden...`, sondern nutzt robuste Fallbacks auf `user_number` / `bidblitz_id`.
- Backend nachgezogen: `serialize_user()` liefert `user_number` und `bidblitz_id`; P2P-QR-Flow erzeugt fehlende `bidblitz_id` automatisch für Bestandskonten.
- Browser-Smoke-Test PASS: `BE92683` sichtbar, beide Tabs schalten korrekt.

## 09.07.2026 — Mobile Wallet/Receive Hardening
- Cookie-Banner auf `SendMoneyPage` und `ReceiveMoneyPage` unterdrückt, damit mobile Bottom-Actions (`Senden`, `Bezahlen`) nicht überdeckt werden.
- `ReceiveMoneyPage` Mobil-Flow verifiziert: QR sichtbar, `Senden öffnen` und `Für Kasse?` tappbar; KYC-Weiterleitung greift korrekt statt Tap-Blockade.
- Wallet-Copy-Button gehärtet: Clipboard-Fehler werfen keinen Runtime-Overlay-Crash mehr, stattdessen sauberer Toast `Kopieren fehlgeschlagen`.
- Saved-Recipients-API akzeptiert jetzt auch `recipient_id`, Response ist `_id`-frei; Self-QR-Scan zeigt sichtbare Fehlermeldung im Scanner-Sheet.

## 09.07.2026 — Händler/Bezahlen Mobile Hardening
- `MerchantTerminalPage`, `NfcPayPage` und `POSPage` aus mobilen Shell-Overlays gelöst: Cookie-Banner, BottomNav, AI-Chat und SuperApp-Overlay blockieren diese Händler-Kassenflächen nicht mehr.
- Händler-Terminal mobil verifiziert: QR-Flow öffnet Scan-Step, NFC-Flow zeigt Wallet-/Card-Optionen, NFC-Lab zeigt Read/Write-Aktionen.
- POS-Crash behoben: `ReferenceError: Cannot access 'syncOfflineQueue' before initialization` in `POSCheckoutTab.jsx` durch korrekt vorgezogene `useCallback`-/Persist-Reihenfolge beseitigt.
- POS-PalmPay/BioPay Panel mobil verifiziert: Scan-/NFC-/Nummer-Toggles reagieren, Panel ist ohne Überlagerung bedienbar.