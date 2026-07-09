# BidBlitz — Apple App Store Connect TestFlight Package

Prepared for **TestFlight internal testing only**. **Do not submit publicly yet.**

## Release Status
- Target: App Store Connect → TestFlight internal testing
- STORE_SAFE_MODE=true
- DEMO_MODE=false
- MOCK_PAYMENTS=false
- Wallet P0 remains launch blocker until fixed and verified

---

## 1) iOS Release Build Verification

- Bundle ID: `com.bidblitz.app`
- App name: `BidBlitz`
- Version: `1.0.0`
- Build number: `2`
- Production API: `https://bidblitz.ae`
- HTTPS only: Yes
- ATS secure configuration: Yes (`NSAllowsArbitraryLoads=false`)
- No localhost API in production configuration: Yes
- Store-safe mode active: Yes
- Restricted modules hidden: Yes

### Verified sources
- `frontend/capacitor.config.ts`
  - `appId: 'com.bidblitz.app'`
  - `appName: 'BidBlitz'`
  - `androidScheme: 'https'`
  - `allowMixedContent: false`
- `frontend/ios/App/App/Info.plist`
  - `CFBundleDisplayName = BidBlitz`
  - ATS present and strict
- `frontend/ios/App/App.xcodeproj/project.pbxproj`
  - `PRODUCT_BUNDLE_IDENTIFIER = com.bidblitz.app`
  - `MARKETING_VERSION = 1.0.0`
  - `CURRENT_PROJECT_VERSION = 2`

### Build status in this environment
- iOS archive created: **No**
- IPA created: **No**

Reason:
- This container runs on Linux and does not provide `xcodebuild`, macOS signing services or Apple keychain access.
- TestFlight packaging must be completed on a macOS/Xcode environment with Apple signing credentials.

---

## 2) Apple Signing Preparation Checklist

Before creating the TestFlight build on macOS:

- [ ] Apple Developer Team selected in Xcode
- [ ] Bundle ID `com.bidblitz.app` registered in Apple Developer portal
- [ ] iOS Distribution Certificate available
- [ ] Provisioning Profile available for App Store / TestFlight upload
- [ ] App Store Connect app created
- [ ] Xcode archive created in Release mode
- [ ] Build uploaded to App Store Connect

### Recommended Xcode settings
- Scheme: `App`
- Configuration: `Release`
- Team: your Apple Developer Team
- Signing style: Automatic or Manual with matching profile
- Archive target: iPhone / Any iOS Device (arm64)

---

## 3) App Store Connect Metadata

### App Name
BidBlitz

### Subtitle
Pay, manage and grow your business

### Promotional Text
BidBlitz combines secure wallet payments, QR Pay, POS tools, invoices and business management in one app.

### Description — English
BidBlitz combines secure wallet payments, QR Pay, POS tools, smart invoices and business management into one mobile app for customers, merchants and modern teams.

Customers can use BidBlitz to access wallet features, review balances, open QR-based payment flows, manage payment activity and reach support and privacy controls from one place. The app is designed to make everyday payment actions simple, secure and clear.

For merchants and business users, BidBlitz provides practical tools for POS operations, QR Pay checkout, payment links, invoice handling and staff-related workflows. Businesses can streamline customer payments, manage business-facing flows and support checkout operations from a mobile-first interface.

BidBlitz also supports cashier and POS scenarios through QR scanning, invoice-related payment flows and merchant tools that help businesses accept and manage payments more efficiently.

Where available, the app extends beyond payments with taxi and mobility services, including location-based flows, map usage and ride-related convenience features.

Security and privacy are core parts of the BidBlitz experience. The app includes support access, privacy information, account controls, permission-based use of camera, location, notifications, photos and NFC where relevant, and visible account deletion and data deletion request paths.

The iOS store build is prepared in store-safe mode and focuses on secure payments, merchant functionality and mobility services.

### Beschreibung — Deutsch
BidBlitz verbindet sicheres Wallet, QR Pay, POS-Tools, smarte Rechnungen und Business-Management in einer mobilen App für Kunden, Händler und moderne Teams.

Kunden können mit BidBlitz Wallet-Funktionen nutzen, Guthaben prüfen, QR-basierte Zahlungsflüsse öffnen, Zahlungsaktivitäten einsehen und Support- sowie Datenschutzfunktionen an einer Stelle erreichen. Die App ist darauf ausgerichtet, alltägliche Zahlungen einfach, sicher und klar bedienbar zu machen.

Für Händler und Unternehmen bietet BidBlitz praktische Werkzeuge für POS-Abläufe, QR-Pay-Checkouts, Payment Links, Rechnungsverwaltung und Staff-Workflows. Unternehmen können Zahlungen vereinfachen, operative Prozesse steuern und Checkout-Abläufe mobil unterstützen.

BidBlitz unterstützt außerdem Kassen- und POS-Szenarien über QR-Scan, rechnungsbezogene Zahlungsflüsse und Merchant-Tools, mit denen Unternehmen Zahlungen effizient annehmen und verwalten können.

Sofern verfügbar, erweitert die App ihren Nutzen über Zahlungen hinaus um Taxi- und Mobility-Funktionen mit Karten, ortsbezogenen Abläufen und komfortablen Ride-Features.

Sicherheit und Datenschutz stehen im Mittelpunkt. Die App enthält Support-Zugänge, Datenschutzinformationen, Kontoeinstellungen, berechtigungsbasierte Nutzung von Kamera, Standort, Benachrichtigungen, Fotos und NFC sowie sichtbare Pfade für Konto- und Datenlöschung.

Der iOS-Store-Build ist im Store-Safe-Mode vorbereitet und konzentriert sich auf sichere Zahlungen, Merchant-Funktionen und Mobility-Services.

### Përshkrimi — Shqip
BidBlitz bashkon wallet-in e sigurt, QR Pay, mjetet POS, faturat inteligjente dhe menaxhimin e biznesit në një aplikacion mobil për klientë, merchant-e dhe ekipe moderne.

Klientët mund të përdorin BidBlitz për të hyrë te funksionet e wallet-it, për të parë bilancin, për të hapur flukse pagesash me QR, për të ndjekur aktivitetin e pagesave dhe për të aksesuar support-in dhe privatësinë nga një vend i vetëm. Aplikacioni është ndërtuar për t’i bërë pagesat e përditshme të thjeshta, të sigurta dhe të qarta.

Për merchant-et dhe bizneset, BidBlitz ofron mjete praktike për procese POS, checkout me QR Pay, payment links, menaxhim faturash dhe workflow për stafin. Bizneset mund të thjeshtojnë pagesat e klientëve, të menaxhojnë procese operative dhe të mbështesin checkout-in nga një ndërfaqe mobile moderne.

BidBlitz mbështet gjithashtu skenarë cashier dhe POS përmes skanimit QR, flukseve të pagesës të lidhura me fatura dhe mjeteve merchant që ndihmojnë bizneset të pranojnë dhe menaxhojnë pagesat në mënyrë efikase.

Kur është i disponueshëm, aplikacioni zgjerohet përtej pagesave me funksione taxi dhe mobility, përfshirë përdorimin e hartës, procese të lidhura me lokacionin dhe veçori komode për ride.

Siguria dhe privatësia janë pjesë qendrore e përvojës BidBlitz. Aplikacioni përfshin rrugë support-i, informacione privatësie, kontrolle të llogarisë, përdorim me leje të kamerës, lokacionit, njoftimeve, fotove dhe NFC-së, si dhe rrugë të dukshme për fshirje llogarie dhe kërkesë për fshirje të të dhënave.

Build-i iOS për store është përgatitur në store-safe mode dhe fokusohet në pagesa të sigurta, funksione merchant dhe shërbime mobility.

---

## 4) App Privacy Draft

### Data types
- Name
- Email
- Phone number (if used)
- User ID
- Payment info / payment references (if used)
- Transaction history
- Location (if mobility/taxi enabled)
- Photos / documents (if KYC/upload enabled)
- Camera access (QR scanning / uploads)
- Device identifiers
- Diagnostics

### Purposes
- App functionality
- Payments
- Fraud prevention
- Account management
- Security
- Customer support

### Privacy confirmations
- Data is not sold: **Yes**
- Data is encrypted in transit: **Yes**
- User can request deletion: **Yes**
- Privacy Policy link exists: **Yes** → `https://bidblitz.ae/privacy`

---

## 5) iOS Permission Text Verification

### Current status
The app already defines iOS permission descriptions in `Info.plist`, but some texts still mention non-store-safe or broader legacy use cases. For TestFlight submission, use the following clean product-facing wording:

- Camera:
  - Used to scan QR codes and optionally upload verification documents.
- Location:
  - Used for taxi, mobility and nearby service features.
- Notifications:
  - Used for payment confirmations, invoices, security alerts and service updates.
- Photos:
  - Used only when the user chooses to upload documents or images.
- NFC:
  - Used for supported contactless wallet identification where available.

### Important note
- Before final Xcode archive upload, align `Info.plist` usage descriptions with the exact wording above to avoid review confusion around legacy features.

---

## 6) Screenshot Checklist — iPhone 6.7 inch

Use only store-safe screens. Do not show unrealistic balances. Do not show auctions or games.

1. Welcome / Login
2. Wallet
3. QR Pay
4. POS / Merchant
5. Invoice / Payment Link
6. Staff / Business Tools
7. Taxi / Mobility
8. Security / Privacy

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
- Can open merchant / POS preview if allowed: Yes
- Can open support / privacy / terms: Yes
- No real payment required: Yes
- No unrealistic fake balance: Yes (`0.0 EUR`, `0.0 BLZ`)

---

## 8) TestFlight Release Notes

Initial TestFlight build of BidBlitz.
Includes wallet overview, QR Pay, POS tools, merchant dashboard, invoices, support pages and store-safe business features.
Auctions and game-like modules are disabled in this mobile store build.

---

## 9) Exact Next Step for App Store Connect Upload

1. Open the project on macOS with Xcode
2. Select Apple Developer Team
3. Confirm Bundle ID `com.bidblitz.app` in Signing & Capabilities
4. Ensure App Store Connect app exists for BidBlitz
5. Confirm Release configuration with Version `1.0.0` and Build `2`
6. Align `Info.plist` permission text to the clean store wording from section 5 if desired before archive
7. Build **Archive** in Release mode
8. Validate archive in Organizer
9. Upload build to App Store Connect
10. Open App Store Connect → TestFlight
11. Add internal testers
12. Add reviewer test account notes
13. Paste TestFlight release notes from section 8
14. Start **TestFlight internal testing only**

Do **not** submit to public App Review until Wallet P0 is fixed and re-verified.
