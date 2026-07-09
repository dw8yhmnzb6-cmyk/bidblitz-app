# BidBlitz — Google Play Console Internal Testing Package

Prepared for **Internal Testing only**. **Do not publish publicly yet.**

## Release Status
- Internal testing target: Google Play Console → Internal Testing
- STORE_SAFE_MODE=true
- DEMO_MODE=false
- MOCK_PAYMENTS=false
- Wallet P0 remains launch blocker until fixed and verified

---

## 1) Android Release Build Verification

- AAB ready: Yes
- AAB path: `/app/frontend/android/app/build/outputs/bundle/release/app-release.aab`
- Package name / applicationId: `com.bidblitz.app`
- versionName: `1.0.0`
- versionCode: `3`
- Signed AAB: Yes (`META-INF/BIDBLITZ.SF`, `META-INF/BIDBLITZ.RSA` present)
- Release signing configured: Yes
- Debug build: No
- Localhost API in production config: No
- Production API: `https://bidblitz.ae`
- Store-safe mode active: Yes
- Restricted modules hidden: Yes

### Verified inputs
- `frontend/.env.production`
  - `REACT_APP_BACKEND_URL=https://bidblitz.ae`
  - `REACT_APP_STORE_SAFE_MODE=true`
  - `REACT_APP_DEMO_MODE=false`
  - `REACT_APP_MOCK_PAYMENTS=false`
- `frontend/android/app/build.gradle`
  - `applicationId "com.bidblitz.app"`
  - `versionCode 3`
  - `versionName "1.0.0"`

### Notes
- AAB contains production bundle metadata and manifest entries for `com.bidblitz.app`, `versionCode=3`, `versionName=1.0.0`, `compileSdkVersion=35`.
- Reviewer account was normalized to zero balances for internal testing readiness.

---

## 2) Google Play Console Upload Checklist

### Create app
1. Log in to Google Play Console
2. Click **Create app**
3. App name: **BidBlitz**
4. Default language: **English (en-US or en-GB)**
5. App or game: **App**
6. Free or paid: **Free**
7. Category recommendation: **Finance**
   - Alternative if desired for merchant-first positioning: **Business**

### Upload signed AAB
1. Open the app in Play Console
2. Go to **Testing → Internal testing**
3. Create release
4. Upload file:
   - `/app/frontend/android/app/build/outputs/bundle/release/app-release.aab`
5. Add release notes (see section below)
6. Save

### Create internal testing track
1. Open **Testing → Internal testing**
2. Create or edit track
3. Add tester list email group or direct emails
4. Include reviewer test account details in release notes or tester instructions

### Add tester emails
Recommended initial tester set:
- `reviewer@bidblitz.ae`
- internal team emails / QA emails you choose

### Reviewer test account
- Email: `reviewer@bidblitz.ae`
- Password: `BidBlitzReview2026!`
- Role: normal user
- Notes: no real payment required, zero unrealistic balances, limited scope for wallet/QR/support/privacy/terms and merchant preview only

---

## 3) Store Listing Texts

### Short Description
BidBlitz combines secure wallet payments, QR Pay, POS tools, invoices and business management in one app.

### Full Description — English
BidBlitz combines secure wallet payments, QR Pay, POS tools, smart invoices and business management into one mobile app built for customers, merchants and modern operations teams.

With BidBlitz, customers can access wallet functions, review balances, use QR-based payment flows, manage payment activity and access support and privacy controls from one place. The app is designed to keep everyday payment actions clear, secure and easy to navigate.

For merchants and business users, BidBlitz offers practical tools for POS operations, QR Pay checkouts, payment links, invoice management and staff-related workflows. Merchants can streamline customer payments, manage business-facing flows and support in-store operations with a mobile-first experience.

BidBlitz also supports cashier and POS usage with QR scanning, customer lookup, invoice-based flows and merchant payment actions. Smart invoice and payment link tools help businesses request and manage payments more efficiently.

Where available, the app extends beyond payments with taxi and mobility services, including route-related flows, map usage and location-aware convenience features.

Security and privacy are core to the BidBlitz experience. The app includes support paths, privacy pages, account controls, permission-based access to device features such as camera, location, notifications, NFC and photos where relevant, and clear account deletion / data deletion request options.

The mobile store build is configured in store-safe mode and focuses on secure business and payment functionality.

### Vollständige Beschreibung — Deutsch
BidBlitz verbindet sicheres Wallet, QR Pay, POS-Tools, smarte Rechnungen und Business-Management in einer mobilen App für Kunden, Händler und moderne Betriebe.

Mit BidBlitz können Kunden Wallet-Funktionen nutzen, Guthaben prüfen, QR-basierte Zahlungsflüsse öffnen, Zahlungsaktivitäten einsehen sowie Support- und Datenschutzfunktionen an einer Stelle erreichen. Die App ist darauf ausgelegt, alltägliche Zahlungsprozesse klar, sicher und einfach bedienbar zu machen.

Für Händler und Unternehmen bietet BidBlitz praktische Werkzeuge für POS-Abläufe, QR-Pay-Checkouts, Payment Links, Rechnungsmanagement und Staff-Workflows. Merchant-Nutzer können Kundenzahlungen vereinfachen, geschäftliche Prozesse mobil steuern und Abläufe am Verkaufspunkt effizient unterstützen.

BidBlitz unterstützt außerdem Kassen- und POS-Nutzung mit QR-Scan, Kundensuche, rechnungsbasierten Zahlungen und Merchant-Payment-Flows. Smarte Rechnungen und Zahlungslinks helfen Unternehmen dabei, Zahlungen professionell anzufordern und zu verwalten.

Sofern verfügbar, erweitert die App ihren Nutzen über Zahlungen hinaus um Taxi- und Mobility-Funktionen mit Karten, ortsbezogenen Abläufen und komfortablen Mobilitätsservices.

Sicherheit und Datenschutz stehen im Mittelpunkt. Die App enthält Support-Zugänge, Datenschutzseiten, Kontoeinstellungen, berechtigungsbasierte Nutzung von Kamera, Standort, Benachrichtigungen, NFC und Fotos sowie klare Pfade für Konto- und Datenlöschung.

Die Mobile-Store-Version läuft im Store-Safe-Mode und konzentriert sich auf sichere Zahlungs-, Merchant- und Mobility-Funktionen.

### Përshkrimi i plotë — Shqip
BidBlitz bashkon wallet-in e sigurt, QR Pay, mjetet POS, faturat inteligjente dhe menaxhimin e biznesit në një aplikacion mobil për klientë, merchant-e dhe ekipe moderne operative.

Me BidBlitz, klientët mund të përdorin funksionet e wallet-it, të shohin bilancin, të hapin flukset e pagesave me QR, të ndjekin aktivitetin e pagesave dhe të kenë akses te support-i dhe kontrollet e privatësisë nga një vend i vetëm. Aplikacioni është ndërtuar për t’i bërë veprimet e përditshme të pagesave të qarta, të sigurta dhe të lehta për përdorim.

Për merchant-et dhe bizneset, BidBlitz ofron mjete praktike për POS, checkout me QR Pay, payment links, menaxhim faturash dhe workflow për stafin. Përdoruesit business mund të thjeshtojnë pagesat e klientëve, të menaxhojnë procese operative dhe të mbështesin përdorimin në pikën e shitjes me një përvojë mobile moderne.

BidBlitz mbështet gjithashtu përdorim cashier/POS me skanim QR, gjetje klienti, flukse të bazuara në faturë dhe procese pagese për merchant. Faturat inteligjente dhe payment links ndihmojnë bizneset të kërkojnë dhe menaxhojnë pagesat në mënyrë profesionale.

Kur është i disponueshëm, aplikacioni zgjerohet përtej pagesave me funksione taxi dhe mobility, përfshirë përdorimin e hartës, flukse të lidhura me udhëtimin dhe komoditete të bazuara në lokacion.

Siguria dhe privatësia janë pjesë qendrore e përvojës BidBlitz. Aplikacioni përfshin rrugë support-i, faqe privatësie, kontrolle të llogarisë, përdorim me leje të kamerës, lokacionit, njoftimeve, NFC dhe fotove, si dhe rrugë të qarta për fshirje llogarie dhe kërkesë për fshirje të të dhënave.

Build-i mobile për store funksionon në store-safe mode dhe fokusohet te pagesat e sigurta, funksionet merchant dhe mobility.

---

## 4) Data Safety Form Preparation

### Collected data
- Name
- Email address
- Phone number (if user profile or business flow uses it)
- User ID
- Payment information / payment references (if used)
- Transaction history
- Location (if taxi / mobility is enabled and used)
- Photos / documents (if KYC or upload flows are used)
- Camera access (QR scanning / uploads)
- Device identifiers / technical identifiers
- Diagnostics / crash data

### Purposes
- App functionality
- Payments
- Fraud prevention
- Account management
- Security
- Customer support

### Data Safety confirmations
- Data sold: **No**
- Data encrypted in transit: **Yes**
- User can request deletion: **Yes**
- Privacy Policy link exists: **Yes** → `https://bidblitz.ae/privacy`

### Suggested Google Play Data Safety mapping
| Data Type | Collected | Shared | Required for app functionality | Linked to user |
|---|---|---|---|---|
| Name | Yes | No | Yes | Yes |
| Email | Yes | No | Yes | Yes |
| Phone number | If used | No | Yes | Yes |
| User ID | Yes | No | Yes | Yes |
| Payment info / references | Yes | No | Yes | Yes |
| Transaction history | Yes | No | Yes | Yes |
| Location | If enabled | No | Yes | Yes |
| Photos / documents | If used | No | Yes | Yes |
| Camera | Permission-based | No | Yes | Potentially |
| Device identifiers | Yes | No | Yes | Yes |
| Diagnostics | Yes | No | Yes | Potentially |

---

## 5) Permissions Explanations

- Camera: Used to scan QR codes and capture verification or document uploads when needed.
- Location: Used for taxi, mobility and nearby service functionality where available.
- Notifications: Used for payment confirmations, invoice updates, support updates and security alerts.
- NFC: Used for contactless wallet and RFID identification on supported flows and devices.
- Photos / media: Used for optional document upload, KYC submission and image attachments.

---

## 6) Content Rating Preparation

Suggested answers:
- Gambling: **No**
- Paid chance games: **No**
- Mystery boxes: **No**
- Adult content: **No**
- Violence: **No**
- User-generated gambling content: **No**
- Finance / payment functionality present: **Yes**

Store-safe note:
- Auctions, live auctions, penny auctions, Plinko, spin wheel, mystery boxes and gambling-style modules are hidden in the mobile store build.

---

## 7) Test Account

- Email: `reviewer@bidblitz.ae`
- Password: `BidBlitzReview2026!`
- Role: normal user
- Ready: Yes

### Verified scope
- Can log in: Yes
- Can view wallet: Yes
- Can open QR Pay: Yes
- Can open merchant / POS preview if allowed: Yes (preview-only scope)
- Can open support / privacy / terms: Yes
- No real payment required: Yes
- No unrealistic fake balance: Yes (normalized to `0.0 EUR`, `0.0 BLZ`)

---

## 8) Internal Testing Release Notes

Initial internal test release of BidBlitz.
Includes wallet overview, QR Pay, POS tools, merchant dashboard, invoices, support pages and store-safe business features.
Auctions and game-like modules are disabled in this mobile store build.

---

## 9) Exact Next Step for Google Play Console Upload

1. Open Google Play Console
2. Create app: **BidBlitz**
3. Set default language to **English**
4. Choose **App** and **Free**
5. Choose category **Finance** (or **Business** if you want merchant-first positioning)
6. Go to **Testing → Internal testing**
7. Create release
8. Upload AAB: `/app/frontend/android/app/build/outputs/bundle/release/app-release.aab`
9. Paste the internal testing release notes from section 8
10. Add tester emails and include `reviewer@bidblitz.ae`
11. Fill Store Listing using the texts above
12. Fill Data Safety using section 4
13. Fill Content Rating using section 6
14. Save and roll out **to Internal Testing only**

Do **not** submit to public production until Wallet P0 is fixed and re-verified.
