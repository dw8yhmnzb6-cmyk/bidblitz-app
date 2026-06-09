# BidBlitz — CHANGELOG

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
- Revenue-Insert im Mobility-Payment-Flow gehärtet, damit Mehrfachbuchungen keine Duplicate-Key-Fehler mehr auslösen
- Router-Registrierung für `mobility_platform` und `mobility_payments` ergänzt
- Verifiziert: Self-Test PASS + `iteration_138.json` vollständig grün (Backend 13/13, Frontend 100%) + `iteration_139.json` AI-Retests grün (Backend 17/17, Frontend 100%) + `iteration_140.json` Booking/Preferences grün (Backend 22/22, Frontend 100%) + `iteration_141.json` Checkout/Tracking grün (Backend 15/15, Frontend 100%)

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