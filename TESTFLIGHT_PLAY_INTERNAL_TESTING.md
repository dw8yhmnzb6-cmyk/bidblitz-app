# BidBlitz — TestFlight & Play Internal Testing Build Guide

## Quick Start Build Pipeline

```bash
# 1. Web-Build erzeugen
cd /app/frontend
yarn install
yarn build

# 2. Capacitor sync (Web → Native)
npx cap sync android
npx cap sync ios

# 3. Android Release AAB (auf Linux/macOS, braucht Android SDK + Java 17)
cd android
./build-release-aab.sh
# Output: app/build/outputs/bundle/release/app-release.aab
```

## Android — Play Internal Testing Track (~5 Minuten Setup)

### A. Initial App-Setup (einmalig)
1. Login: https://play.google.com/console (25 USD einmalig)
2. **Apps erstellen** → "BidBlitz" → Default Language: German (Germany)
3. Package Name: `com.bidblitz.app` (MUSS exakt zu Capacitor-Config matchen)
4. **App-Bundle-Explorer** → Lade `app-release.aab` hoch → akzeptiere App-Signing-by-Google

### B. Internal Testing Track aktivieren
1. **Test → Interner Test** → "Neuer Track erstellen"
2. **Tester-Liste** → bis zu 100 Email-Adressen einfügen (oder Google-Group nutzen)
3. **Release erstellen** → AAB hochladen
4. **Veröffentlichen** → Tester bekommen einen Opt-In-Link via Email
5. Wartezeit: ~30 Min bis Update bei Testern verfügbar

### C. Erforderliche Store-Listing Felder (sonst Block)
- App-Symbol (512x512 PNG)
- Feature-Grafik (1024x500 PNG)  
- 2-8 Screenshots pro Geräte-Typ (Phone, 7"-Tablet, 10"-Tablet)
- App-Beschreibung (DE + EN, max 4000 Zeichen)
- App-Kategorie: `Finanzen` oder `Einkaufen`
- Inhalts-Bewertung: Fragebogen ausfüllen (~5 Min)
- **Datenschutzerklärung-URL** (PFLICHT, z.B. `https://bidblitz.ae/datenschutz`)
- Datenschutz-Daten-Sicherheit Section (Google fragt ab welche Daten du sammelst)

---

## iOS — TestFlight (~10 Minuten Setup)

### A. Apple Developer Setup
1. https://developer.apple.com/programs (99 USD/Jahr)
2. **Identifiers** → "+" → App ID erstellen → `com.bidblitz.app`
3. **App Store Connect** → "Meine Apps" → "+" → "Neue App"
   - Plattform: iOS
   - Name: BidBlitz
   - Sprache: Deutsch  
   - Bundle ID: com.bidblitz.app
   - SKU: BIDBLITZ_V1

### B. Build & Archive (auf macOS, braucht Xcode 15+)
```bash
cd /app/frontend
yarn build && npx cap sync ios
open ios/App/App.xcworkspace
```
In Xcode:
1. **Product → Scheme → Edit Scheme → Build Configuration → Release**
2. **Signing & Capabilities** → Team: dein Apple-Account auswählen
3. **Generic iOS Device** als Build-Target wählen
4. **Product → Archive** (5-15 Min)
5. Window → Organizer → Archive auswählen → "Distribute App"
6. "App Store Connect" → "Upload" → Sign with Distribution Cert

### C. TestFlight aktivieren
1. App Store Connect → BidBlitz → **TestFlight** Tab
2. **iOS-Builds** → Build erscheint nach 5-15 Min "Processing"
3. **Test-Informationen** ausfüllen:
   - Beta-Beschreibung: "Erste Beta-Version. Bitte testet Wallet, Auktionen, Marketplace."
   - Was zu testen ist
4. **Interne Tester** → "+" → bis zu 100 Tester (deine Apple-ID Team-Mitglieder, kein Approval nötig)  
   ODER **Externe Tester** → bis zu 10.000 Tester (braucht ~24h Apple Beta-Review)
5. Tester bekommen Email + können via TestFlight-App installieren

---

## Release Notes Template (DE + EN)

### v1.0.0 — Beta Release (Februar 2026)
**Was ist neu:**
- 🛒 **POS-System** auf REWE/Lidl-Niveau (18 Enterprise-Features: Bon-Storno, RFID, AI-Verlust-Detektion)
- 💳 **BidBlitz Pay** mit Stripe (Apple Pay, Google Pay, Karten)
- 🏆 **Penny-Auktionen** (Live-Bidding mit Auto-Bid)
- 📺 **Live-Shopping** via LiveKit (Host & Viewer Modus)
- 🤖 **AI-Chatbot** auf Landing Page (Multi-Turn, Lead-Scoring)
- 🔐 **KYC-Verifizierung** mit AI-Detection (Gemini)
- 🚕 **Taxi-Modul** (in-app Buchung)
- ⚡ **Wallet-Transfer** zwischen Usern

**Bekannte Einschränkungen:**
- Live-Streaming braucht aktiven LiveKit-Host
- KYC-Approval kann bis zu 24h dauern
- Production Stripe-Mode bald verfügbar

**Test-Daten:**
- Stripe Test-Karte: `4242 4242 4242 4242`, CVC: `123`, Expiry: beliebig in Zukunft

---

## Beta-Tester-Liste (Sample 10 Tester)

Erstelle in Google Console / TestFlight:
```
1. dev1@bidblitz.ae        — Hauptentwickler
2. ceo@bidblitz.ae         — CEO Review
3. design@bidblitz.ae      — UX/UI Lead
4. qa@bidblitz.ae          — QA Lead
5-7. founder-friends-1-3   — Externe POV
8-10. early-customers-1-3  — Real Restaurant/Retail Owners
```

---

## Crash-Monitoring (empfohlen vor Public Release)

```bash
yarn add @sentry/capacitor @sentry/react @sentry/tracing
```

Init in `frontend/src/index.js`:
```javascript
import * as Sentry from '@sentry/capacitor';
import * as SentryReact from '@sentry/react';
Sentry.init({
  dsn: 'https://YOUR-DSN@sentry.io/PROJECT_ID',
  release: 'bidblitz@1.0.0',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
}, SentryReact.init);
```

→ Du siehst Live-Crashes von Beta-Testern in Sentry-Dashboard

---

## Risk-Mitigation Checklist

- [ ] Keystore extern gesichert (`bidblitz-upload.jks` + Passwort)
- [ ] Resend-Domain `bidblitz.ae` verifiziert
- [ ] Stripe Webhook-Endpoint registriert + Secret in `.env`
- [ ] LiveKit Cloud Project + API-Keys
- [ ] Datenschutzerklärung + AGB online
- [ ] Sentry/Datadog Monitoring aktiv
- [ ] DSGVO/GDPR Cookie-Banner aktiv (UAE hat schwächere Anforderungen, aber für EU-User wichtig)
- [ ] App-Store-Screenshots (iPhone 6.7", iPhone 6.5", iPad Pro 12.9", iPad Pro 11")
- [ ] Pricing-Strategie definiert (Free + In-App-Purchases? Subscription? Transaction-Fees?)
