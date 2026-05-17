# BidBlitz — CHANGELOG

## 17.05.2026
- Barcode/QR-Scan-System im bestehenden `/scan`-Tab eingebaut
- Neue API `POST /api/scan/resolve` für Tisch-, Rechnungs-, Checkout- und Wallet-Codes
- Stabile Tisch-Barcodes `TBL-...` ergänzt und im Merchant-QR-Tab sichtbar gemacht
- Rechnungs-Scan-Codes `BBINV-...` + öffentliche Rechnungs-Zahlungsseite `/invoice/pay/:scanCode` ergänzt
- Testing: `iteration_126.json` vollständig grün