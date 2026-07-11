# BidBlitz — ROADMAP

## Status nach Admin-KI-Assistent — 11.07.2026
- ✅ Neuer **Admin KI-Assistent** live unter `/admin/ai-assistant`.
- ✅ Versteht freie deutsche Befehle für Admin-Aufgaben und zeigt **immer zuerst einen Vorschlag**.
- ✅ Erste Aktionen live: neue Auktionen anlegen, Auktionen ersetzen, Standard-Katalog wiederherstellen, Plattform-Checks anstoßen, Passwort-Reset, Wallet-Gutschrift/Abzug, Lead-Status-Änderung sowie Fehler-/Login-Berichte.
- 🟡 Nächster sinnvoller Ausbau: komplette Mining-CRM-Aktionen, Monitoring-Alerts mit Telegram/E-Mail, noch tiefere Kunden-Listenfilter und automatische Tagesreports für Armend.

## Status nach Admin-Fehlerzentrale — 11.07.2026
- ✅ Admin-Monitoring zeigt jetzt nicht nur Server-Health, sondern auch eine echte **Fehlerzentrale** für kaputte Kernbereiche.
- ✅ Live-Probes für **Webseite**, **Login**, **Registrierung** und **Auktionen** eingebaut.
- ✅ Frontend-Fehler laufen nicht mehr ins Leere (`/api/monitoring/log-error` war vorher 404), sondern werden jetzt gespeichert und in der Fehlerzentrale sichtbar.
- ✅ E-Mail-Alarmierung per Resend technisch angeschlossen.
- 🟡 Blocker: Resend-Domain `bidblitz.ae` muss im Resend-Account verifiziert werden, sonst werden Live-Mails abgelehnt.

## Status nach Penny Auctions Premium-Tech-Reset — 11.07.2026
- ✅ Penny Auctions komplett erneuert: aktiver Katalog enthält jetzt **exakt 30 neue Premium-Tech-Auktionen** statt alter Demo-Produkte.
- ✅ Alle 30 Auktionen erfüllen den neuen Produktvertrag: **2026-Modelle**, **UVP > 1000€**, **Startpreis 0,01€**, **7 Tage Laufzeit**, **2–4 Bilder** und aggressive Bot-Konfiguration.
- ✅ `/auctions` ist in der Preview wieder direkt testbar; Store-Safe-Blocking greift dort nicht mehr, bleibt aber für echte Store-Builds erhalten.
- ✅ Galerie im Auktionsdetail live: Nutzer sehen Thumbnails und können zwischen Produktbildern wechseln.
- 🟡 Nächster sinnvoller Auktions-Schritt: echte Merchandising-/Conversion-Layer ergänzen — z. B. "Top Deals", "Fast Ending", Gewinner-Highlights oder sekundäre Premium-Pricing-Experimente für Credits.

## Status nach Dating Safety Pro + Real Premium Checkout — 10.07.2026
- ✅ Mining Revenue Conversion Block live: Ansprechpartner, Zielgruppen-Segmentierung und Angebotskarten leiten Nutzer jetzt direkt in passende Mining-Anfragen.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Kontaktziele (WhatsApp/Telegram/Telefon), feste Ansprechpartnerdaten und Response-SLA mit echtem Team-Branding.
- ✅ Mining Trust Quick Contact + FAQ live: 1-Klick-Kontakt und häufige Fragen sind jetzt direkt auf der Seite integriert.
- 🟡 Nächster sinnvoller Mining-Schritt: echte WhatsApp-/Telegram-Ziele, Rückruf-Workflow und noch stärkere Conversion-Bausteine wie feste Ansprechpartner oder Response-SLA.
- ✅ Mining Trust Lead Form vereinfacht: Schnell-Auswahl, optionale Firma und minimaler Submit mit Name + E-Mail funktionieren.
- 🟡 Nächster sinnvoller Mining-Schritt: noch mehr Conversion mit WhatsApp-/Telegram-Schnellanfrage oder 1-Klick-Kontaktmodulen für Kunden.
- ✅ Mining Trust Admin CRM + Video Slots live: Leads können verwaltet und Dubai-/Abu-Dhabi-Videos direkt gepflegt werden.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Rollen-/Dashboard-Auswertung für Mining-Leads (Neu/Kontaktiert/Qualified), plus Medien-Uploads statt nur URL-basierter Verwaltung.
- ✅ Mining Trust Public API + Lead Capture live: `/mining-trust` liefert jetzt öffentliche Proof-Daten und nimmt Leads direkt an.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Video-Uploads/Einbindung für Dubai & Abu Dhabi sowie Admin-/CRM-Ansicht für eingehende Mining-Leads.
- ✅ Mining Trust Investor-Version live: Live-Kennzahlen, Standortkarte und Proof-of-Infrastructure-Timeline sind ergänzt.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Nutzer-Videos/Fotos und echte Live-Daten statt Platzhalterwerte einbinden.
- ✅ Mining Trust Page live: separate Proof-Seite für Bitcoin-Mining-Infrastruktur mit Dubai-/Abu-Dhabi-Fokus, ASIC-Fotos und Video-Platzhaltern.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Nutzer-Fotos/Videos ersetzen die AI-Platzhalter und optional Live-Metriken (Hashrate/Uptime/Standortstatus) ergänzen.
- ✅ Segment-/Preisexperimente live: Starter-Deals, Bundle-Angebote und Paywall-Kombinationen variieren jetzt deterministisch pro Nutzersegment.
- ✅ Dynamische Monetarisierung live: Hero, Plan-Highlight und limitierte Bundles passen sich an Experimente an.
- 🟡 Nächster sinnvoller Dating-Schritt: echte Conversion-Messung/Auswertung (Impressions → Checkout → Paid) je Experiment-Variante, damit wir Gewinner automatisch hochziehen können.
- ✅ Roses / Priority Inbox live: Standouts haben jetzt direkte Rose-Kaufhebel und Priority Inbox-Metadaten.
- ✅ Top Picks tägliche Rotation live: tägliche, stabile Rotation pro Nutzer/Tag ist vorbereitet und im UI sichtbar.
- 🟡 Nächster sinnvoller Dating-Schritt: echte Segment-/Preisexperimente, z. B. Starter-Offer-Varianten, unterschiedliche Paywall-Kombinationen oder zeitlich limitierte Rose-Bundles.
- ✅ Top Picks / Standouts live: kuratierte Discovery-Flächen für Gold/Platinum-Upsell sind eingebaut.
- ✅ Platinum Message-before-match live: erste Nachricht kann schon beim Like gesendet werden.
- 🟡 Nächster sinnvoller Dating-Schritt: echte **Top Picks Rotation** mit täglichen Refreshes, Standouts mit stärkerem Super-Like-Kaufdruck und eventuell **Roses / Priority Inbox** als nächster Umsatzhebel.
- ✅ Dating Monetization V1 live: Plus / Gold / Platinum, sichtbare Conversion-Flächen, Einzelkäufe für Boosts / Super Likes / Rewinds, Starter-Offer-Logik und echte Stripe-Checkout-Flows.
- ✅ Umsatz-Trigger eingebaut: Likes-You-Lock, stärkerer Paywall, Entitlements, Plan-Karten und Einzelkauf-Grid.
- 🟡 Nächster sinnvoller Dating-Schritt: noch stärkere Monetarisierung wie Message-before-match / Standouts / Top Picks oder dynamische Preis-/Abo-Experimente für Segmente.
- ✅ Dating P2 Safety Pro live: Scam-Signal-Erkennung im Profiltext, Nudity-Warnung/Fallback-Scan für Bilder, `safety_summary` auf Profil, Discover, Likes und Matches.
- ✅ Dating Discovery / Ranking Intelligence verbessert: `discover_rank` berücksichtigt jetzt Safety, Profil-Vervollständigung und Medienqualität (Voice/Video) zusätzlich zu Boost/Verifizierung.
- ✅ Dating Premium Hauptflow ist jetzt real: `GET /api/dating/premium/plans`, `POST /api/dating/premium/checkout`, `GET /api/dating/premium/status/{session_id}` arbeiten mit echtem Stripe Checkout und `payment_transactions`.
- ⚠️ `POST /api/dating/premium/demo-upgrade` bleibt weiterhin **MOCKED** nur für Backward Compatibility; Haupt-UI-Flow nutzt bereits den realen Checkout.
- 🟡 Nächster sinnvoller Dating-Schritt: Safety Pro weiter vertiefen (z. B. Chat-Scam-Signale / Inbox-Warnungen) oder Live-Dating / Events als nächster P2-Differenzierer.

## Status nach Dating Video-Profil — 10.07.2026
- ✅ Dating P2 Video-Profil live: Aufnahme, Upload, Playback und Löschen funktionieren; Video-Metadaten erscheinen in Profil, Discover, Likes und Matches.
- ✅ Dating P2 Voice Intro live.
- ✅ Dating P2 Nearby / Crossed Paths live.
- ✅ Safety Pro, Discovery / Ranking Intelligence und realer Premium-Checkout sind inzwischen umgesetzt.
- ⚠️ Dating Premium Demo-Endpoint bleibt zusätzlich **MOCKED** für Backward Compatibility.

## Status nach Dating Voice Intro — 10.07.2026
- ✅ Dating P2 Voice Intro live: Aufnahme, Upload, Playback und Löschen funktionieren; Voice-Metadaten erscheinen in Discover, Likes und Matches.
- ✅ Dating P2 Nearby / Crossed Paths bereits live und stabil.
- 🟡 Nächster sinnvoller Dating-Schritt: **Video-Profil** als nächster Medienbaustein oder **Safety Pro** (Scam Detection / Nudity Warning).
- ⚠️ Dating Premium Aktivierung bleibt weiterhin **MOCKED** über `/api/dating/premium/demo-upgrade`; echte Subscription-/Payment-Verknüpfung ist weiterhin offen.

## Status nach Dating Nearby / Crossed Paths — 10.07.2026
- ✅ Dating P2 Nearby live: Nutzer können Standort freigeben; Nearby-Profile werden mit `distance_km` ausgeliefert.
- ✅ Dating P2 Crossed Paths live: räumliche Begegnungen werden gespeichert und im Dating-UI angezeigt.
- ✅ Dating Setup-UX verbessert: Profil-Modal blockiert nicht mehr hart und kann per **„Später“** geschlossen werden.
- 🟡 Nächster sinnvoller Dating-Schritt: Voice Intro / Video-Profil oder Safety Pro (Scam Detection / Nudity Warning) als nächster Differenzierer.
- ⚠️ Dating Premium Aktivierung bleibt weiterhin **MOCKED** über `/api/dating/premium/demo-upgrade`; echte Subscription-/Payment-Verknüpfung ist weiterhin offen.

## Status nach Dating Boost + AI Helpers — 10.07.2026
- ✅ Dating P1 Boost/Spotlight live: Premium-Nutzer können Boost aktivieren; Discover priorisiert geboostete Profile serverseitig und liefert `boost`-/`spotlight`-Metadaten aus.
- ✅ Dating P2 Start live: AI Bio, AI Profil-Coach und AI Icebreakers funktionieren über echte Backend-Endpunkte mit `emergentintegrations`.
- ✅ Dating-Stabilität verbessert: Duplicate-Key-Race-Conditions beim Profil-/Seed-Like-Setup beseitigt; Testing-Agent Iteration 219 vollständig grün.
- 🟡 Nächster sinnvoller Schritt im Dating-Modul: UX-Feinschliff im Profil-Setup (z. B. `Skip for now` statt hartem Auto-Open) und danach P2-Ausbau Richtung Voice/Video oder Nearby/Crossed Paths.
- ⚠️ Premium-Aktivierung für Dating bleibt aktuell bewusst **MOCKED** über `/api/dating/premium/demo-upgrade`; echte Payment-/Subscription-Verknüpfung ist der nächste Monetization-Schritt.

## Status nach Frontend-i18n Final Cleanup — 09.07.2026
- ✅ Offene harte Texte in Wallet-Filtern, KYC-Banner, User Stats, Monitoring, Leaderboard/ExtraFeatures und Restaurant Tables Admin bereinigt.
- ✅ Gemeinsame i18n-Keys für **DE / EN / SQ / AR** ergänzt; Albanisch-Modus per Smoke-Test und Frontend-Testagent geprüft.
- 🟡 Nächster sinnvoller Schritt: projektweiter Rest-Audit auf tiefer liegende Seiten/Legacy-Flows außerhalb der zuletzt bearbeiteten Kernbereiche.
- 🔴 Android-AAB-Build bleibt im aktuellen ARM64-Container durch AAPT2-Inkompatibilität blockiert; kein finales `.aab` aus diesem Container.

## Status nach Mobile Store Prep + Production Audit — 09.07.2026
- ✅ Huawei AppGallery / Samsung Galaxy Store / Apple App Store Connect Copy-Paste-Pakete vorbereitet.
- ✅ iOS Permission-Texte review-sicher aktualisiert; Android Package-/Version-Metadaten auf `com.bidblitz.app` / Version `1.0.0` / Build `3` ausgerichtet.
- ✅ Reviewer-Flow, Legal-Seiten und Store-safe UI erneut geprüft; reviewer-sichtbare Auktions-Texte aus More/KYC-Hinweisen entfernt.
- 🔴 Public/Store Launch weiter blockiert durch Wallet P0, fehlenden produktionsreifen Health-Endpoint und ungeklärte Produktions-DB-Konfiguration (`DB_NAME="test_database"`).
- 🔴 Android-Alt-Store-Export im Container weiter blockiert durch fehlenden Android-SDK-Pfad und fehlenden Release-Keystore.

## Status nach Admin Customer Intelligence — 01.07.2026
- ✅ 06.07.2026 Commerce Center V1 vertieft: Analytics, Programmplanung und Performance Board live; Event-Tracking und CTA-Flows per Testing-Agent verifiziert.
- ✅ 06.07.2026 P1 Mobility-Ausbau abgeschlossen: E‑Bike und Carsharing in Mobility Center + Mobility Map integriert, 6‑Wege Vergleich aktiv und per Testing-Agent verifiziert.
- ✅ 06.07.2026 P0 Stabilitätsschritt abgeschlossen: großer Frontend-Router entschlackt (`App.js` in Hilfsmodule zerlegt) und per Testing-Agent Iteration 195 ohne Regressionen verifiziert.
- ✅ 06.07.2026 Taxi P0 geschlossen: Uber-like Live-Autocomplete ab 1 Buchstaben, Kosovo-Tarif `2€ Start + Kilometer`, Admin-Seed-Startup wieder idempotent aktiv.
- ✅ 06.07.2026 Taxi P1 vertieft: persönliche Trefferquellen vor Live-Geocode, Quellen-Badges, Kosovo-Stadtprofile Prishtina/Prizren/Peja.
- ✅ 06.07.2026 Taxi Airport-Festpreis ergänzt: Flughafen Kosovo/PRN ↔ Prishtina mit 15€/20€/24€ und sauberem Festpreis-Breakdown; Gast-Console-Taxi-Noise reduziert und Public Feature Flags restored.
- ✅ 06.07.2026 Admin-Kanonisierung: `admin@bidblitz.ae` ist einziger echter Admin; `admin@bidblitz.com` ist deaktiviert; `.ae` Admin bleibt vollständig freigeschaltet.
- ✅ 06.07.2026 Admin Merchant Controls: Händler-Feature-Freischaltung, individuelle Modulpreise, Händlerbearbeitung, Zahlstatus und Blockieren/Freigeben bei Nichtzahlung live.
- ✅ 06.07.2026 Admin Provisioning API: Händler/Gastro/Kiosk per API oder Dropdown freischalten, Bundlepreise setzen und POS Public API-Key erzeugen; Kassen-/Gutschein-/Auflade-Flow dokumentiert.
- ✅ Admin sieht jetzt Sekunden-/Bid-Credit-Käufe, Käufer, Commerce/POS-Käufe, Standortsignale, Shop-Matches und Jahresanalyse.
- ✅ Customer Live Radar ergänzt: Radar-Alerts, Segmente, Heatmap-Zellen und Privacy Guard.
- ✅ Radar Actions ergänzt: Coupon, Push, Manager-Alert und Auto-Aktion direkt aus Admin-Radar-Alerts.
- ✅ Kampagnen-Templates, Erfolgsmessung und Customer-Radar-Action-Historie/Timeline ergänzt.
- ✅ Radar Automation Rule Center ergänzt: Regeln speichern, simulieren und ausführen; Daily Cap, Trigger Type, Cooldown und positive VIP-Ausführung verifiziert.
- ✅ Radar Scheduler + Performance ergänzt: Scheduler-Config, manueller Tick, Background-Loop und Performance-Grid im Admin.
- ✅ Deployment-Hygiene/CORS-Härtung abgeschlossen: App-Level credentialed CORS, Production-Nginx CORS und Deployment-Agent PASS.
- ✅ Direkt-Routen verfügbar: `/admin/customer-intelligence` und `/admin/customer-map`.
- 🟡 Nächster sinnvoller Schritt: echte Geo-Kachelkarte mit Heatmap/Clustern und DSGVO-konformer Standort-Einwilligungs-/Retention-Policy.

## Status nach 01.07.2026
- ✅ P0 Staff-BioTime-Frontend: Check-in/Check-out via PalmPay für Mitarbeiter umgesetzt.
- ✅ P0 Executable Approval-Flows: Manual Wallet Adjustments und Customer Account Changes werden nach Manager-Freigabe direkt ausgeführt; Reject und Repeat-Block sind aktiv.
- 🔴 P0 verbleibend: Approval-Ausführung für weitere Sonderfälle vertiefen, falls neue Top-up-/Refund-Typen außerhalb der vorhandenen Execution-Pfade entstehen.
- ✅ P1: Commerce Center V1 — Marketplace, Live Shopping, Penny Auctions.
- ✅ P1: Mobility Center V1 — E-Scooter, E-Bike, Carsharing.
- ✅ P2: Externe Hardware-/Vendor-Diagnostics und restliches Game Center abgeschlossen.
- ✅ P2: Move & Earn AI Coach + GPS/Sensor-Scoring ausgebaut und verifiziert.
- ✅ P2: Move & Earn Admin-Analytics um ROI, Reward-Kosten nach Typ/Quelle/Segment und DAU/MAU vertieft.
- ✅ 07.07.2026 Move & Earn: native Schrittquellen (HealthKit / Health Connect) sauber über Capacitor angebunden; Web-Preview bleibt mit erklärtem Fallback stabil.
- ✅ 07.07.2026 Move & Earn ROI v2 mit echten Commerce-/Merchant-/POS-Conversions gekoppelt; Admin sieht jetzt attributed Orders, GMV, Platform Revenue, Conversion Rate, Cost per Conversion sowie Channel-/Attribution-Windows.
- ✅ 07.07.2026 Mobility: Premium Live-Tracking für Shuttle/VIP mit Approach-/Trip-Phase, Checkpoints, Shuttle-Stops und Map-Overlays erweitert.

## P0
- 🔴 Produktionsfreigabe-Audit offen: `/api/health` auf Produktion fehlt (404) und muss für Monitoring/Store-Verifikation sauber bereitgestellt werden.
- 🔴 Produktionsdatenbank-Kontrakt offen: `DB_NAME="test_database"` ist für Public-Launch/TestFlight/Internal-Testing nicht freigabefähig, solange nicht bestätigt ist, dass dies die echte produktive DB sein soll.
- 🔴 Wallet P0 bleibt aktiv bis die manuellen Repair-Aktionen für kritische Fälle sauber abgearbeitet sind: Reconciliation Center + Controlled Manual Repair sind live, jetzt fehlen die fachlichen Einzelentscheidungen pro kritischem Wallet.
- 🔴 Alt-Store-Mobile-Release bleibt blockiert, bis ein echter Android-SDK-Pfad und ein dauerhafter Release-Keystore im Build-Kontext vorhanden sind.
- 🔴 Finaler Google-Play-AAB-Build bleibt in diesem Container zusätzlich durch ARM64/AAPT2-Binary-Inkompatibilität blockiert; für den tatsächlichen Upload ist ein kompatibler x86_64-Build-Host oder ein funktionierender ARM64-AAPT2-Workaround nötig.
- 🔴 Wallet P0 bleibt aktiv bis die manuellen Repair-Aktionen für kritische Fälle sauber abgearbeitet sind: Reconciliation Center + Controlled Manual Repair sind live, jetzt fehlen die fachlichen Einzelentscheidungen pro kritischem Wallet.
- 🔴 Nach Manual Decisions Run 1 bleiben insbesondere diese Risikoklassen offen: Ledger-Rebuild-Fälle, Legacy-Wallets mit widersprüchlicher Historie und negative Delta-Fälle mit vorhandener `wallets.balance`-Abweichung.
- 🔴 Admin-/Alias-UI bleibt unter Beobachtung: weitere Listen außerhalb von Auth + Admin-Kundenliste bei Bedarf auf dieselbe kanonische Admin-Namenslogik umstellen.
- 🔴 KYC-Altstatus-Quellen außerhalb der Hauptkundenverwaltung bei Bedarf ebenfalls auf dieselbe Normalisierung angleichen (`verified` → `approved`, `failed/error` → `rejected`).
- 🔴 Falls weitere versteckte Admin-Altaccounts auftauchen, dieselbe Deaktivierungslogik konsequent anwenden statt neue Admin-Aliase wieder zuzulassen.
- 🔴 Offene Wallet-Härtung nach Phase 3: weitere historische EUR-Geldpfade außerhalb des Kern-Wallet-/POS-/Admin-Bereichs schrittweise auf zentrale Engine migrieren (z. B. Invoicing, Tips, Mobility, Stripe-Webhooks, Merchant/Restaurant/Taxi-Altpfade), ohne Bestandswerte blind anzupassen.
- 🔴 Store Launch bleibt blockiert, bis Reconciliation für Altbestände und restliche historische EUR-Pfade abgeschlossen sind.
- Frontend-Routing-Stabilität als Basis für nächste Ausbaustufe verbessert; weiterer Fokus jetzt auf P1-Feature-Ausbau statt monolithischer Routerpflege
- BioPay V4 weiter vertiefen: Staff-BioTime als vollständige operative Oberfläche, Admin-Audit-Drilldowns pro Merchant/Terminal und Ausreißer-Workflows
- POS Security V2 operativ abrunden: Manual Wallet Adjustment und Customer Account Change auch mit kompletter Ausführungs-UI statt nur Approval-Request/Queue ergänzen
- Merchant Platform V5: Omnichannel Commerce nach dem neuen Enterprise Dashboard als nächstes vertiefen — kanalübergreifender Bestand, Sync-Status, Order-Funnel und operative Automationen auf Basis der bestehenden POS-/Inventory-/Merchant-Module
- Merchant Platform V5: Executive AI nach Modul 1/2 weiter ausbauen — Drilldowns pro Filiale, recurring Briefings, Alert-Subscriptions und Automation-Vorschläge für Einkauf/Staffing
- Merchant Platform V5: Business Automation nach V1 weiter vertiefen — echte Auto-PO-Freigabeketten, Supplier-SLA-Eskalationen, Task-Zuweisung nach Rolle und Revenue-Playbooks mit messbarer Conversion
- Mobility Center V1 nach E‑Bike/Carsharing weiter vertiefen: Parking, Pendler-Abos, Fleet-Verfügbarkeit, Saved/Frequent Routes und Rebook-Intelligence enger im neuen Hub bündeln
- Smart Invoice Follow-up: Payment-Link Reminder-Kampagnen (Batch/Schedule), echte Webhook-Settlement-Härtung und öffentliche Payment-Seite um Success/Retry/Resume weiter vertiefen
- Frontend-ESLint-Warnings schrittweise abbauen, damit die Codebase nach dem CI-Fix nicht nur fehlerfrei, sondern langfristig wartbarer wird
- Game Center V1 nach dem neuen Hub um echte Season-Quests, XP-Claims und VIP-Perk-Aktivierungen vertiefen
- Taxi nach dem UX-Umbau weiter vertiefen: Live-Ride-Tracking, gespeicherte Adressen/Favoriten noch stärker in den neuen Kundenflow integrieren und Wallet/Apple-Pay-Checkout visuell weiter glätten
- Taxi nach dem UX-Umbau weiter vertiefen: echte Home/Work-Verwaltung, Favoriten-Speicherung aus der Suche, noch stärkeres Post-Booking-Live-Tracking und Checkout-Varianten (Wallet/Apple Pay) visuell weiter glätten
- CI-/Build-Härtung fortsetzen: historische Dependency-Pins weiter reduzieren und Integrations-abhängige Module langfristig sauberer von Core-/Smoke-Tests entkoppeln
- Taxi nächster Schritt: letzte Ziele noch stärker personalisieren, Fahrerkarte/Ankunfts-Tracking weiter glätten und gespeicherte Orte/Empfängerflows noch stärker in den Bestell-Button-Flow einbinden
- Taxi nächster Schritt: Search-to-Book noch direkter machen, weitere Kosovo-Airport-/City-Festpreise ergänzen und optional globale Guest-Auth-Checks leiser gestalten
- Mobility nächster Schritt: Tracking jetzt mit Rebook/Support/Push-Remindern verknüpfen und danach Commerce Center wieder priorisieren

## P1
- Wallet/Reconciliation Admin Center vertiefen: Bulk-Filter, CSV-Export, Delta-Gruppierung, Referenzketten und sichere Einzelfall-Korrektur-Workflows mit Review-Step ergänzen.
- POS Security: Fraud Scoring weiter vertiefen (kassiererübergreifende Muster, Echtzeit-Suspicion-Score, Auto-Eskalation an Admin)
- BioPay: Staff-BioTime-Seite im Frontend, Check-in/out-Historie und Manager-Freigabe für Ausreißer ergänzen
- BioPay: FacePay hinter Feature-Flag mit Merchant-sichtbarer Readiness-Anzeige weiter zur produktionsreifen Aktivierung führen
- BioPay: Admin Audit Center um Filter, Export, Merchant-Drilldowns und Terminal-Warnworkflows erweitern
- Merchant Platform V5: Digital Signage + Smart Pricing auf dem neuen Enterprise-Datenmodell aufsetzen (Preisregeln, Promotion-Slots, Filialausspielung)
- Merchant Platform V5: Procurement AI auf dem Business-Automation-V1 aufsetzen (Forecast-basierte Mengen, Supplier-Vergleich, Genehmigungslogik, Inventory-Playbooks)
- Commerce: Live-Auctions-Seed/Programmplanung, Live-Produkt-Pinning und dedizierte Commerce-Analytics für Conversion, Flash-Sale-Umsatz und CTA-Klicks ergänzen
- Merchant Commerce: Bulk-Flash-Sale-Kampagnen, Scheduler und Performance-Rankings ergänzen
- Commerce nach V1 jetzt weiter vertiefen: Merchant-seitige Bulk-Flash-Sale-Kampagnen, Scheduler, Live-Produkt-Pinning und noch stärkere Conversion-Drilldowns
- Mobility: Compare-Flow nach dem neuen 6-Wege-Vergleich um Saved/Frequent Routes, One-Tap-Rebook, Parking und City-/Fleet-Kombinationen erweitern
- Game Center: Achievements-/Season-Daten stärker mit Rewards, Referral und VIP Drops koppeln
- Move & Earn: native Schrittquellen nach Geräteverifikation weiter vertiefen (z. B. Background-Refresh, feinere Distanz-/Source-Analyse, iOS-/Android-spezifische Messaging-UX)
- Move & Earn: Ride & Earn / Eco Rewards noch tiefer mit realen Scooter-/Bike-/Taxi-/EV-Events, Merchant-QR-Events und Referral-/Friends-Logik koppeln
- Move & Earn: Admin-Analytics um DAU/MAU, Reward-Kosten pro Typ, ROI und gesponserte Rewards ausbauen
- Move & Earn: Reward-Tickets auch für Spin Wheel / Mystery Boxes direkt im Reward Hub einlösbar machen
- Mobility: Stripe-Checkout zusätzlich per Webhook/Session-Resume noch robuster gegen abgebrochene Browser-Sessions machen
- Mobility: Tracking für Shuttle/VIP und weitere Transportarten mit echterer Live-Progression vertiefen
- Mobility: Tracking-Seite um echte Map-Animation und Fortschritts-Polylines weiter ausbauen
- Native NFC-Bridge nachreichen, sobald User-Lizenz vorliegt
- Reale USB-/Netzwerk-Drucker über Native-/Device-Bridge außerhalb Preview mit Hardware-Mapping verifizieren
- USB-Auto-Suche im nativen Drucker-Wizard auf echten Geräten verifizieren
- KYC-Flow später noch um bessere Upload-Fehlermeldungen und klare Status-Refresh-UX erweitern
- Floorplan-/Raumplan-Editor für Tische mit Mehrraum/Zoom/Snapping ausbauen

## P2
- ✅ Merchant Platform V5: Multi-Company Management, Document Center und Maintenance Tracker auf Basis der neuen Enterprise-Struktur ergänzt und per Testing-Agent verifiziert.
- ✅ Game Center: Arcade Hub mit Season-/All-Time-Leaderboards, Personal Best und Reward-/Session-KPIs live und verifiziert.
- ✅ BioPay Admin: Vendor Diagnostics, Warning Workflows und Terminal Readiness im Audit Center live und verifiziert.
- ✅ Move & Earn: AI Coach mit Coaching-Plänen sowie GPS-/Sensor-/Behavior-Scoring live und verifiziert
- Mobility: echte Live-Positionsupdates/Tracking für Shuttle, VIP und weitere Transportarten vertiefen
- Mobility: serverseitige Ranking-Heuristik für Autocomplete und Empfehlungslogik weiter schärfen
- Printer-Diagnose später um echte Live-Socket-Logs/Retry-Historie pro Gerät vertiefen
- Floorplan später um Mehrraum-Zonen, Rotation und freien Rechteck-/Polygon-Raumaufbau vertiefen