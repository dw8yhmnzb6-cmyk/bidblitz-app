# BidBlitz — ROADMAP

## Status nach Admin Customer Intelligence — 01.07.2026
- ✅ 06.07.2026 Taxi P0 geschlossen: Uber-like Live-Autocomplete ab 1 Buchstaben, Kosovo-Tarif `2€ Start + Kilometer`, Admin-Seed-Startup wieder idempotent aktiv.
- ✅ 06.07.2026 Taxi P1 vertieft: persönliche Trefferquellen vor Live-Geocode, Quellen-Badges, Kosovo-Stadtprofile Prishtina/Prizren/Peja.
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
- 🟡 P1: Commerce Center V1 — Marketplace, Live Shopping, Penny Auctions.
- 🟡 P1: Mobility Center V1 — E-Scooter, E-Bike, Carsharing.
- 🟢 P2: Externe Hardware-/Vendor-Diagnostics und restliches Game Center.

## P0
- BioPay V4 weiter vertiefen: Staff-BioTime als vollständige operative Oberfläche, Admin-Audit-Drilldowns pro Merchant/Terminal und Ausreißer-Workflows
- POS Security V2 operativ abrunden: Manual Wallet Adjustment und Customer Account Change auch mit kompletter Ausführungs-UI statt nur Approval-Request/Queue ergänzen
- Merchant Platform V5: Omnichannel Commerce nach dem neuen Enterprise Dashboard als nächstes vertiefen — kanalübergreifender Bestand, Sync-Status, Order-Funnel und operative Automationen auf Basis der bestehenden POS-/Inventory-/Merchant-Module
- Merchant Platform V5: Executive AI nach Modul 1/2 weiter ausbauen — Drilldowns pro Filiale, recurring Briefings, Alert-Subscriptions und Automation-Vorschläge für Einkauf/Staffing
- Merchant Platform V5: Business Automation nach V1 weiter vertiefen — echte Auto-PO-Freigabeketten, Supplier-SLA-Eskalationen, Task-Zuweisung nach Rolle und Revenue-Playbooks mit messbarer Conversion
- Mobility Center V1 vertiefen: Parking, Carsharing, EV Charging sowie Saved/Frequent Routes enger im neuen Hub bündeln
- Smart Invoice Follow-up: Payment-Link Reminder-Kampagnen (Batch/Schedule), echte Webhook-Settlement-Härtung und öffentliche Payment-Seite um Success/Retry/Resume weiter vertiefen
- Frontend-ESLint-Warnings schrittweise abbauen, damit die Codebase nach dem CI-Fix nicht nur fehlerfrei, sondern langfristig wartbarer wird
- Game Center V1 nach dem neuen Hub um echte Season-Quests, XP-Claims und VIP-Perk-Aktivierungen vertiefen
- Taxi nach dem UX-Umbau weiter vertiefen: Live-Ride-Tracking, gespeicherte Adressen/Favoriten noch stärker in den neuen Kundenflow integrieren und Wallet/Apple-Pay-Checkout visuell weiter glätten
- Taxi nach dem UX-Umbau weiter vertiefen: echte Home/Work-Verwaltung, Favoriten-Speicherung aus der Suche, noch stärkeres Post-Booking-Live-Tracking und Checkout-Varianten (Wallet/Apple Pay) visuell weiter glätten
- CI-/Build-Härtung fortsetzen: historische Dependency-Pins weiter reduzieren und Integrations-abhängige Module langfristig sauberer von Core-/Smoke-Tests entkoppeln
- Taxi nächster Schritt: letzte Ziele noch stärker personalisieren, Fahrerkarte/Ankunfts-Tracking weiter glätten und gespeicherte Orte/Empfängerflows noch stärker in den Bestell-Button-Flow einbinden
- Taxi nächster Schritt: Search-to-Book noch direkter machen, leise Guest-Console-401s vermeiden und weitere Kosovo-Stadt-/Airport-Festpreise ergänzen
- Mobility nächster Schritt: Tracking jetzt mit Rebook/Support/Push-Remindern verknüpfen und danach Commerce Center wieder priorisieren

## P1
- POS Security: Fraud Scoring weiter vertiefen (kassiererübergreifende Muster, Echtzeit-Suspicion-Score, Auto-Eskalation an Admin)
- BioPay: Staff-BioTime-Seite im Frontend, Check-in/out-Historie und Manager-Freigabe für Ausreißer ergänzen
- BioPay: FacePay hinter Feature-Flag mit Merchant-sichtbarer Readiness-Anzeige weiter zur produktionsreifen Aktivierung führen
- BioPay: Admin Audit Center um Filter, Export, Merchant-Drilldowns und Terminal-Warnworkflows erweitern
- Merchant Platform V5: Digital Signage + Smart Pricing auf dem neuen Enterprise-Datenmodell aufsetzen (Preisregeln, Promotion-Slots, Filialausspielung)
- Merchant Platform V5: Procurement AI auf dem Business-Automation-V1 aufsetzen (Forecast-basierte Mengen, Supplier-Vergleich, Genehmigungslogik, Inventory-Playbooks)
- Commerce: Live-Auctions-Seed/Programmplanung, Live-Produkt-Pinning und dedizierte Commerce-Analytics für Conversion, Flash-Sale-Umsatz und CTA-Klicks ergänzen
- Merchant Commerce: Bulk-Flash-Sale-Kampagnen, Scheduler und Performance-Rankings ergänzen
- Mobility: Compare-Flow nach dem neuen 4-Wege-Vergleich um Saved/Frequent Routes, One-Tap-Rebook und Parking-/Carsharing-Kombinationen erweitern
- Game Center: Achievements-/Season-Daten stärker mit Rewards, Referral und VIP Drops koppeln
- Move & Earn: echte native Schrittquellen (HealthKit/Google Fit/Pedometer) sauber anbinden und Preview-Sync von simulierten Device-Werten auf reale Sensor-Provider erweitern
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
- Merchant Platform V5: Multi-Company Management, Document Center und Maintenance Tracker auf Basis der neuen Enterprise-Struktur ergänzen
- Move & Earn: AI Coach später mit echten Empfehlungen, Coaching-Plänen und optionalem GPS-/Sensor-Scoring ausbauen
- Mobility: echte Live-Positionsupdates/Tracking für Shuttle, VIP und weitere Transportarten vertiefen
- Mobility: serverseitige Ranking-Heuristik für Autocomplete und Empfehlungslogik weiter schärfen
- Printer-Diagnose später um echte Live-Socket-Logs/Retry-Historie pro Gerät vertiefen
- Floorplan später um Mehrraum-Zonen, Rotation und freien Rechteck-/Polygon-Raumaufbau vertiefen