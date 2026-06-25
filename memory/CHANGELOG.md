# BidBlitz — CHANGELOG

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