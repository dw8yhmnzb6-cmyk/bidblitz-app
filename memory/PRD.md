# BidBlitz PRD

## Architektur - Alles in EINEM System
- **Frontend:** React + TailwindCSS
- **Backend:** FastAPI (ein Server)
- **Database:** MongoDB (ein Login, ein Wallet, alles zusammen)
- **Server:** IONOS 212.227.20.190 / bidblitz.ae

## Integriertes Scooter/Mobility System

### Benutzer-Rollen (bestehende Users-Collection)
- `user` - Normaler Benutzer
- `partner_admin` - Scooter-Partner (sieht eigene Flotte)
- `super_admin` - Super-Admin (sieht alles)

### Wallet-System (integriert)
- `wallet_balance_cents` auf User-Dokument (EUR-Guthaben)
- `bids_balance` bleibt separat (Auktions-Gebote)
- Wallet-Ledger: Doppelte Buchfuehrung fuer alle Transaktionen
- Kategorien: topup, ride_unlock, ride_fee, loan, repayment, admin_credit

### Scooter-APIs
- `GET /api/devices/available` - Verfuegbare Geraete (oeffentlich)
- `POST /api/devices/reserve/{id}` - Reservieren (10 Min kostenlos)
- `POST /api/devices/ring/{id}` - Klingeln/Orten
- `POST /api/devices/report/{id}` - Problem melden
- `POST /api/devices/unlock/request` - Fahrt starten (bucht Entsperrgebuehr vom Wallet)
- `POST /api/devices/unlock/{id}/end` - Fahrt beenden (bucht Minutengebuehr vom Wallet)
- `GET /api/devices/my-sessions` - Fahrtverlauf
- `GET /api/devices/my-reservations` - Aktive Reservierungen

### Wallet-APIs
- `GET /api/wallet-ledger/balance` - Saldo (EUR + Gebote)
- `GET /api/wallet-ledger/transactions` - Transaktionshistorie
- `POST /api/wallet-ledger/topup` - Wallet aufladen

### Partner-APIs
- `GET /api/devices/partner/my-devices` - Eigene Geraete
- `GET /api/devices/partner/my-rides` - Fahrten auf eigenen Geraeten
- `POST /api/devices/admin/set-partner/{user_id}` - User zum Partner machen
- `GET /api/devices/admin/partners` - Alle Partner auflisten

### User-Seiten
- `/scooter` - Karten-Ansicht mit QR-Scanner
- `/support-tickets` - Support-Tickets
- `/loans` - Mikrokredite

### Dashboard-Kacheln
- Scooter, Support, Kredite als Quick-Access im Dashboard

## Status: LIVE auf bidblitz.ae
- 16 Demo-Scooter (Dubai + Pristina)
- 30 Auktionen mit echten Fotos
- Wallet mit Ledger-System
- Mobile-responsive Admin-Panel

## Credentials
- Admin: admin@bidblitz.ae / AfrimKrasniqi123
- Server: 212.227.20.190 / root / neew7ky3xhyt3H
