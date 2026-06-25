# BidBlitz — ROADMAP

## P0
- Mobility Center V1 vertiefen: Parking, Carsharing, EV Charging, Booking-Tracking und Saved/Frequent Routes enger im neuen Hub bündeln
- Smart Invoice Follow-up: Payment-Link Reminder-Kampagnen (Batch/Schedule), echte Webhook-Settlement-Härtung und öffentliche Payment-Seite um Success/Retry/Resume weiter vertiefen
- Frontend-ESLint-Warnings schrittweise abbauen, damit die Codebase nach dem CI-Fix nicht nur fehlerfrei, sondern langfristig wartbarer wird
- Game Center V1 nach dem neuen Hub um echte Season-Quests, XP-Claims und VIP-Perk-Aktivierungen vertiefen
- Taxi nach dem UX-Umbau weiter vertiefen: Live-Ride-Tracking, gespeicherte Adressen/Favoriten noch stärker in den neuen Kundenflow integrieren und Wallet/Apple-Pay-Checkout visuell weiter glätten
- Taxi nach dem UX-Umbau weiter vertiefen: echte Home/Work-Verwaltung, Favoriten-Speicherung aus der Suche, noch stärkeres Post-Booking-Live-Tracking und Checkout-Varianten (Wallet/Apple Pay) visuell weiter glätten

## P1
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
- Move & Earn: AI Coach später mit echten Empfehlungen, Coaching-Plänen und optionalem GPS-/Sensor-Scoring ausbauen
- Mobility: echte Live-Positionsupdates/Tracking für Shuttle, VIP und weitere Transportarten vertiefen
- Mobility: serverseitige Ranking-Heuristik für Autocomplete und Empfehlungslogik weiter schärfen
- Printer-Diagnose später um echte Live-Socket-Logs/Retry-Historie pro Gerät vertiefen
- Floorplan später um Mehrraum-Zonen, Rotation und freien Rechteck-/Polygon-Raumaufbau vertiefen