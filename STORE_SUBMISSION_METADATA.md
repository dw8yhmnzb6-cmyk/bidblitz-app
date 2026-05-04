# BidBlitz — Store-Submission Metadaten (Copy-Paste-Ready)

Stand: 04.05.2026 · Domain: `bidblitz.ae`

---

## App-Identifier
| Feld | Wert |
|------|------|
| Bundle ID (iOS) | `com.bidblitz.app` |
| Application ID (Android) | `com.bidblitz.app` |
| App-Name | `BidBlitz` |
| Default Language | Deutsch (de-DE) |
| Auch lokalisiert | English (en-US), Arabic (ar-AE) |

---

## Apple App Store Connect

### App Name (max 30)
```
BidBlitz — Super App
```

### Subtitle (max 30)
```
Auktionen · Wallet · Mobility
```

### Promotional Text (max 170, jederzeit änderbar)
```
Penny-Auktionen, Wallet, Taxi, Live-Shopping & POS-System — alles in einer App. Jetzt kostenlos starten!
```

### Description (max 4000)
```
BidBlitz ist die ultimative Super-App: Spar bis zu 90% bei Penny-Auktionen, verwalte dein Wallet, buche Taxis und genieße Live-Shopping — alles an einem Ort.

🎯 PENNY-AUKTIONEN
• Bis zu 90% Rabatt auf Top-Marken (iPhone, MacBook, PS5, Möbel)
• Live-Countdown-Auktionen mit Echtzeit-Bidding
• Voucher-, VIP- und Standard-Modi

💳 WALLET & ZAHLUNGEN
• Sicher Geld senden & empfangen
• QR-Zahlungen bei Partner-Händlern
• Virtuelle BlitzCard für Online-Käufe
• Krypto-Wallet integriert (BLZ-Token)

🚖 MOBILITY
• Taxi & Scooter buchen — günstiger als Uber/Bolt
• Live-Tracking & faire Preise
• In-App-Bezahlung

🛍️ LIVE-SHOPPING
• Echte Live-Streams von Top-Verkäufern
• Direkt aus dem Stream kaufen
• Exklusive Live-Rabatte

🏪 POS & MERCHANT-TOOLS
• Vollwertige Kasse (REWE/Lidl-Niveau)
• Hardware-Integration: Drucker, Scanner, Schublade, Waage
• Altersverifikation (FSK 16/18)
• KDS für Restaurants

🎁 REWARDS & GAMIFICATION
• BLZ-Token mining
• Daily-Quests & Achievements
• Referral-Boni

🔒 SICHER & DSGVO-KONFORM
• KYC-Verifizierung (UAE Anti-Money-Laundering)
• Bank-Level-Verschlüsselung
• 2-Faktor-Authentifizierung

Verfügbar in DE, EN, AR · Über 100 Module · 200+ Features

📧 Support: support@bidblitz.ae
🌐 Web: https://bidblitz.ae
```

### Keywords (max 100 Zeichen, kommagetrennt)
```
auktionen,wallet,taxi,super app,penny,bidding,shopping,live,pos,kasse,krypto,blz,uae,dubai
```

### Support URL
```
https://bidblitz.ae/support
```

### Marketing URL
```
https://bidblitz.ae
```

### Privacy Policy URL (Pflicht)
```
https://bidblitz.ae/privacy
```

### Kategorien
- **Primary:** Finance
- **Secondary:** Lifestyle

### Age Rating
- **17+** (wegen User-Generated Content + financial transactions + gambling-adjacent auctions)
- Antworten im Apple-Fragebogen:
  - Frequent/Intense Simulated Gambling: **No** (Penny-Auktionen sind Skill-based, nicht Glücksspiel)
  - Frequent/Intense Mature Themes: **Infrequent/Mild**
  - Profanity: **Infrequent/Mild**

### App Privacy (Datenerhebung)
| Datenkategorie | Verlinkt mit User? | Tracking? |
|----------------|---------------------|-----------|
| Email-Adresse | Ja | Nein |
| Name | Ja | Nein |
| Telefonnummer | Ja | Nein |
| Kauf-Historie | Ja | Nein |
| Standort (grob) | Ja | Nein |
| ID-Foto (KYC) | Ja | Nein |
| Gerätedaten (Crash-Logs) | Nein | Nein |

---

## Google Play Console

### App Title (max 30)
```
BidBlitz — Super App
```

### Short Description (max 80)
```
Auktionen, Wallet, Taxi, Live-Shopping & POS — alles in einer App.
```

### Full Description (max 4000)
> *(identisch mit Apple-Description oben)*

### App Category
- **Category:** Finance
- **Tags:** Shopping, Lifestyle, Maps & Navigation

### Content Rating (IARC)
- **PEGI 18 / Adults Only**
- Antworten:
  - In-App-Käufe: **Ja**
  - Real-Money-Gambling: **Nein** (Penny-Auktionen sind Skill-based)
  - User-to-User-Communication: **Ja** (Chat, Live-Streams)
  - User-Generated-Content: **Ja** (Live-Shopping, Posts)
  - Standortzugriff: **Ja** (Taxi, Mobility)

### Data Safety
| Daten gesammelt | Geteilt? | Optional? |
|------------------|----------|-----------|
| Email | mit Resend (Email-Service) | Nein (Pflicht für Account) |
| Name | mit niemandem | Nein |
| ID-Foto (KYC) | mit Gemini (AI-Verifizierung) | Nein (Pflicht für Wallet) |
| Standort | nicht geteilt | Optional (Taxi-Modul) |
| Kauf-Historie | mit Stripe | Nein (Pflicht für Bezahlung) |
| Crash-Logs | mit Sentry (mit Consent) | Optional |

Alle Daten via TLS 1.3 verschlüsselt, MongoDB at-rest AES-256.

### Target Audience
- **Ages:** 18+
- **Appeals to children:** No

### Government App?
- No (kein offizielles Government-App)

---

## Store-Assets (bereit unter `/app/frontend/public/`)

| Asset | Datei | Größe |
|-------|-------|-------|
| App Icon (App Store + Play) | `app-icon-1024.png` | 1024×1024 |
| App Icon (Adaptive Android) | `app-icon-512.png` | 512×512 |
| App Icon (PWA Android) | `app-icon-192.png` | 192×192 |
| Feature Graphic (Play Store) | `store-feature-1024x500.png` | 1024×500 |

> **Screenshots fehlen noch** — siehe `STORE_SUBMISSION_CHECKLIST.md` Abschnitt 3.3.
> Empfehlung: iOS-Simulator + `xcrun simctl io booted screenshot` ODER Android-Emulator `adb exec-out screencap -p`.

---

## Empfohlene Test-Tracks vor Production-Rollout

### Apple TestFlight
1. Internal Testing (max 100 Tester, sofort verfügbar)
2. External Testing (max 10.000 Tester, Apple Beta-Review nötig — 1-2 Tage)

### Google Play Internal Testing
1. Internal Track (max 100 Tester via Email-Liste, sofort)
2. Closed Testing (Open Group, optional)
3. Open Testing (Public Beta)
4. Production Rollout (5% → 10% → 50% → 100%)

---

## Health-Check vor Submission
- [ ] Alle Crash-Reports der letzten 7 Tage in Sentry: 0
- [ ] KYC-Flow End-to-End getestet (admin@bidblitz.ae)
- [ ] Stripe-Test-Checkout erfolgreich (`4242 4242 4242 4242`)
- [ ] Cookie-Banner sichtbar bei erstem Visit
- [ ] `/privacy` + `/terms` öffentlich erreichbar
- [ ] Deep-Links funktionieren (`bidblitz://auction/123`)
- [ ] App startet offline ohne Crash (zeigt "Offline"-Hinweis)
- [ ] Push-Permissions-Dialog erscheint nur einmal
- [ ] Ladezeiten <3s auf 4G

---

**Nächster Schritt:** AAB lokal bauen → `bash /app/frontend/build-aab-release.sh` (Android SDK + JDK17 erforderlich, nicht im Container verfügbar).
