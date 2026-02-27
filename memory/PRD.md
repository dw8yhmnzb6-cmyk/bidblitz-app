# BidBlitz PRD

## Provisions-System (LIVE)

### Gebühren (Admin-konfigurierbar 1-20%)
- Topup Fee: 2.5%
- Ride Commission: 15% (Plattform)
- Merchant Fee: 1.5%
- Payout Fee: 1€ + 1%

### Split Payment Flow
1. User zahlt Brutto (z.B. 5€ Fahrt)
2. Plattform bekommt 15% Commission (0.75€) -> Platform Wallet
3. Partner bekommt 85% Settlement (4.25€) -> Partner Balance
4. Alles in Ledger nachvollziehbar

### APIs
- GET /api/provisions/fees - Aktuelle Gebühren
- PUT /api/provisions/fees - Gebühren ändern (Admin, 1-20%)
- GET /api/provisions/platform/balance - Plattform-Einnahmen
- GET /api/provisions/platform/transactions - Alle Provisionen
- GET /api/provisions/partners/balances - Partner-Guthaben
- GET /api/provisions/partners/{id}/ledger - Partner-Buchungen
- POST /api/provisions/partners/payout - Partner-Auszahlung
- GET /api/provisions/reports/summary - Zusammenfassung
- GET /api/provisions/reports/by-partner - Report pro Partner

### Datenbank-Collections
- wallet_ledger: Alle Wallet-Transaktionen
- partner_ledger: Partner-Buchungen (Settlement/Payout)
- partner_balances: Partner-Guthaben
- split_transactions: Aufschlüsselung jeder Zahlung
- partner_payouts: Auszahlungs-Historie
- platform_config: Gebühren-Konfiguration

## Server: 212.227.20.190 | Admin: admin@bidblitz.ae
