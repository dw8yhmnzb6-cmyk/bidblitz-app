# BidBlitz — Huawei AppGallery & Samsung Galaxy Store Preparation

Status: Vorbereitung abgeschlossen. **Keine öffentliche Veröffentlichung durchgeführt.**

## Release-Konfiguration
- Package name: `com.bidblitz.app`
- Version name: `1.0.0`
- Version code: `3`
- Production API: `https://bidblitz.ae`
- STORE_SAFE_MODE=true
- DEMO_MODE=false
- MOCK_PAYMENTS=false
- REACT_APP_ENABLE_IN_APP_UPDATES=false
- Wallet P0 bleibt Launch-Blocker bis zur bestätigten Verifikation

---

## 1) Final Report

### Huawei AppGallery
- Huawei package ready: **NO**
- Grund: Release-Export (`.apk` / `.aab`) wurde im Container nicht vollständig erzeugt, weil der Android-SDK-Pfad im Build-Container fehlt und zusätzlich kein Release-Keystore im Workspace vorhanden ist.

### Samsung Galaxy Store
- Samsung package ready: **NO**
- Grund: Release-Export (`.apk` / `.aab`) wurde im Container nicht vollständig erzeugt, weil der Android-SDK-Pfad im Build-Container fehlt und zusätzlich kein Release-Keystore im Workspace vorhanden ist.

### Verification Summary
- Package name confirmed: **YES**
- Version name/code: **1.0.0 / 3**
- Production API confirmed: **YES**
- Store-safe mode active: **YES**
- Google dependency risks found: **YES**
- Metadata ready: **YES**
- Screenshots plan ready: **YES**
- Test account ready: **YES**
- Public submission executed: **NO**

---

## 2) Huawei Compatibility Report

### Confirmed safe / non-Google core pieces
- API calls laufen gegen `https://bidblitz.ae`
- Kartenbasis nutzt **Mapbox**, nicht Google Maps
- Zahlungen benötigen **kein Google Pay-only Checkout**
- Store-safe Build-Flags aktiv
- Kein `google-services.json` im Android-Projekt vorhanden

### Google/Huawei risk list
1. **Google Services Gradle classpath (optional)**
   - Where: `frontend/android/build.gradle`
   - Use: nur optionales Apply bei vorhandenem `google-services.json`
   - Huawei-compatible alternative: ohne Plugin betreiben oder später Huawei Push Kit ergänzen
   - Risk: **Low**

2. **In-App Update plugin (`@capawesome/capacitor-app-update`)**
   - Where: `frontend/src/components/InAppUpdateManager.jsx`
   - Use: native Update-Checks auf Android
   - Huawei-compatible alternative: AppGallery store updates / Huawei AppGallery distribution flow
   - Risk: **Medium**
   - Current mitigation: per Release-Flag deaktiviert (`REACT_APP_ENABLE_IN_APP_UPDATES=false`)

3. **Web Push / Browser push path**
   - Where: `frontend/public/service-worker.js`, `frontend/src/components/PushNotifications.jsx`
   - Use: Web Push im Browser-Kontext
   - Huawei-compatible alternative: Huawei Push Kit für native Push, falls native Push später benötigt wird
   - Risk: **Medium**
   - Current status: kein Firebase-only native Pflichtpfad im Android-Projekt aktiv erkannt

### Huawei compatibility issues
- Kein final signiertes Store-Paket vorhanden
- Android SDK im aktuellen Build-Container nicht vollständig verfügbar (`sdk.dir=/usr/lib/android-sdk` zeigt auf keinen existierenden Pfad)
- Optionaler Google-Services-Classpath verbleibt im Projekt, blockiert aktuell aber nicht ohne `google-services.json`
- Native Push-Fallback für Huawei ist noch nicht integriert, falls später native Push-Verteilung verlangt wird

---

## 3) Samsung Compatibility Report

### Confirmed safe / compatible
- APK/AAB-Format für Android-Projekt vorgesehen
- Package name korrekt auf `com.bidblitz.app`
- Version code erhöht auf `3`
- Store-safe Flags aktiv
- Kein Google-Pay-Zwang in Checkout-Flows dokumentiert
- Icons, adaptive launcher assets und Splash-Ressourcen vorhanden

### Samsung compatibility issues
- Kein signiertes Release-Paket vorhanden
- Android SDK im aktuellen Build-Container nicht vollständig verfügbar (`sdk.dir=/usr/lib/android-sdk` zeigt auf keinen existierenden Pfad)
- Samsung Store Build sollte ohne Play-only In-App-Update-Banner ausgeliefert werden — bereits per Flag deaktiviert

---

## 4) Store Metadata — Copy/Paste

### App Name
BidBlitz

### Short Description
Secure wallet payments, QR Pay, POS tools, invoices and business management in one app.

### Long Description — English
BidBlitz brings secure wallet payments, QR Pay, POS tools, invoices and business management together in one mobile app for everyday users, merchants and growing teams.

Users can view their wallet, review payment activity, scan or present QR Pay codes, open invoices, manage payment links and access account support from a single experience. The app is designed to keep financial actions clear, fast and easy to understand.

Merchants and business operators can use BidBlitz for point-of-sale flows, cashier support, customer payment handling, invoice collection and staff-friendly operational tools. Business teams can move between payment, support and operational workflows without switching between multiple apps.

BidBlitz also includes mobility functionality where available, including taxi-related discovery and ride support flows. Access to device features such as camera, notifications, NFC, location and media is requested only when relevant to the feature being used.

The mobile experience is focused on secure real-world utility, clear account controls, privacy access, support visibility and business-ready payment operations.

### Langbeschreibung — Deutsch
BidBlitz vereint sicheres Wallet, QR Pay, POS-Tools, Rechnungen und Business-Management in einer einzigen mobilen App für Nutzer, Händler und wachsende Teams.

Nutzer können ihr Wallet öffnen, Zahlungsaktivitäten prüfen, QR-Pay-Codes scannen oder anzeigen, Rechnungen aufrufen, Payment Links verwalten und den Support direkt aus einer einheitlichen Oberfläche erreichen. Die App ist darauf ausgelegt, finanzielle Abläufe klar, schnell und verständlich zu halten.

Händler und Unternehmen nutzen BidBlitz für Point-of-Sale-Prozesse, Kassenunterstützung, Kundenzahlungen, Rechnungsabwicklung und operative Team-Workflows. Geschäftliche Nutzer wechseln dadurch einfacher zwischen Zahlung, Betreuung und operativen Aufgaben.

Zusätzlich bietet BidBlitz – sofern verfügbar – Mobility-Funktionen wie Taxi-bezogene Such- und Ride-Flows. Zugriffe auf Kamera, Mitteilungen, NFC, Standort und Medien werden nur dann angefragt, wenn sie für die genutzte Funktion erforderlich sind.

Der mobile Build konzentriert sich auf sichere reale Nutzung, klare Kontosteuerung, Datenschutzpfade, sichtbaren Support und business-taugliche Zahlungsabläufe.

### Përshkrimi i gjatë — Shqip
BidBlitz bashkon wallet të sigurt, QR Pay, mjete POS, fatura dhe menaxhim biznesi në një aplikacion të vetëm mobil për përdorues, merchantë dhe ekipe në rritje.

Përdoruesit mund të hapin wallet-in e tyre, të kontrollojnë aktivitetin e pagesave, të skanojnë ose shfaqin kode QR Pay, të hapin faturat, të menaxhojnë payment links dhe të kontaktojnë support-in nga një përvojë e vetme. Aplikacioni është ndërtuar që veprimet financiare të jenë të qarta, të shpejta dhe të lehta për t’u kuptuar.

Merchantët dhe bizneset mund ta përdorin BidBlitz për procese point-of-sale, mbështetje në arkë, pagesa të klientëve, mbledhje faturash dhe mjete operative për staf. Kjo i ndihmon ekipet të kalojnë më lehtë midis pagesave, support-it dhe rrjedhave të punës së përditshme.

BidBlitz përfshin edhe funksione mobility aty ku janë të disponueshme, përfshirë kërkimin dhe rrjedhat e mbështetjes për taxi. Qasja te kamera, njoftimet, NFC, lokacioni dhe media kërkohet vetëm kur nevojitet për funksionin që po përdoret.

Build-i mobil fokusohet te përdorimi real, kontrolli i qartë i llogarisë, privatësia, support-i i dukshëm dhe operacionet e sigurta të pagesave për biznes.

---

## 5) Legal & Privacy Links
- Privacy Policy: `https://bidblitz.ae/privacy`
- Terms and Conditions: `https://bidblitz.ae/terms`
- Support: `https://bidblitz.ae/support`
- Contact: `https://bidblitz.ae/contact`
- Delete Account / Data Deletion: `https://bidblitz.ae/delete-account`

---

## 6) Permission Explanations
- Camera: Used for QR scanning, payment code capture and document capture when needed.
- Location: Used for taxi and mobility flows, route assistance and nearby-service context when enabled.
- Notifications: Used for payment confirmations, support replies, account alerts and operational updates.
- NFC: Used for supported contactless wallet and POS interactions.
- Photos / Media: Used for optional uploads, document capture and attachments.
- Internet / Network access: Required for secure API communication, login, wallet updates, invoices and support access.

---

## 7) Screenshot Checklist
1. Welcome / Login
2. Wallet
3. QR Pay
4. POS / Merchant
5. Invoice / Payment Link
6. Staff / Business Tools
7. Taxi / Mobility
8. Security / Privacy

Rules:
- Keine Fake-Balances
- Keine unrealistischen hohen Guthaben
- Keine ausgeblendeten Store-unsafe Module zeigen
- Nur echte oder neutrale Testdaten verwenden

---

## 8) Test Account
- Email: `reviewer@bidblitz.ae`
- Role: `normal user`
- Login verified: **YES**
- Wallet visible: **YES**
- QR Pay accessible: **YES**
- Merchant/POS preview intended: **YES**
- Support / Privacy / Terms intended: **YES**
- Real payment required: **NO**
- Unrealistic fake balance: **NO**

Current reviewer state:
- Balance: `0.0 EUR`
- BLZ: `0.0`
- review_account: `true`

---

## 9) Remaining Blockers
1. **Wallet P0 remains launch blocker** until the ledger fix is fully verified and approved.
2. **No signed release keystore in workspace** → final AppGallery / Galaxy Store package export still pending.
3. **Android SDK path in the current container is invalid** → native release build cannot finish inside this workspace at the moment.
4. **Huawei native push fallback not yet integrated** if Huawei-native push distribution is later required.

Do not submit publicly yet.