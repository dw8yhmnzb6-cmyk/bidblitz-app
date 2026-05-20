# BidBlitz — CHANGELOG

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