# BidBlitz Mobile Release Guide (Feb 2026)

App package/bundle identifier: **`com.bidblitz.app`**
(set in `/app/frontend/capacitor.config.ts` and
`ios/App/App.xcodeproj/project.pbxproj`.)

---

## 1. ANDROID RELEASE BUILD

### 1.1 Generate the upload keystore (ONE TIME — keep safe forever)

```bash
cd /app/frontend/android

keytool -genkeypair -v \
  -keystore bidblitz-upload.jks \
  -alias bidblitz \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype JKS
```

When prompted, enter:

* **Store password** — choose a strong password (WRITE IT DOWN).
* **Key password** — can be the same.
* **Name, Org, Country** — whatever suits the company record.

> **CRITICAL:** Back this `.jks` file up off-site. Losing it means you
> can never update the app on the Play Store.

### 1.2 Create `keystore.properties`

```bash
cp /app/frontend/android/keystore.properties.template \
   /app/frontend/android/keystore.properties
```

Edit `/app/frontend/android/keystore.properties` and fill in the real
values:

```properties
storeFile=bidblitz-upload.jks
storePassword=<the_store_password_you_chose>
keyAlias=bidblitz
keyPassword=<the_key_password_you_chose>
```

(`.jks` and `keystore.properties` are already in `.gitignore`.)

### 1.3 Get the SHA256 fingerprint

```bash
keytool -list -v \
  -keystore /app/frontend/android/bidblitz-upload.jks \
  -alias bidblitz
```

Output contains lines like:

```
Certificate fingerprints:
         SHA1:   AB:CD:EF:...
         SHA256: 12:34:56:78:9A:BC:DE:F0:...
```

Copy the **SHA256** line (the 64-hex-pair string, including the colons).

### 1.4 Paste SHA256 into `assetlinks.json`

Open **`/app/frontend/public/.well-known/assetlinks.json`** and replace:

```
"REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT"
```

with the actual SHA256 fingerprint (keep the colons):

```json
"sha256_cert_fingerprints": ["12:34:56:78:9A:BC:DE:F0:..."]
```

> If you enroll in Google Play App Signing (recommended), you will get a
> SECOND fingerprint from Play Console — add it as a second string in the
> same array. Keep both: upload key + Play-managed signing key.

Rebuild frontend so the file gets into `/app/frontend/build/.well-known/`:

```bash
cd /app/frontend && yarn build
```

Deploy the static files to production (nginx serves them at
`https://bidblitz.ae/.well-known/assetlinks.json`).

### 1.5 Build commands — Android

```bash
cd /app/frontend

# Web → native sync
./build-mobile.sh prod

# Option A: Signed release APK (for internal testing / sideload)
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Option B: Signed AAB (the format required by Google Play)
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Upload the `.aab` to Google Play Console → Production release.

---

## 2. iOS RELEASE BUILD

### 2.1 Find your Apple Team ID

1. Go to <https://developer.apple.com/account>.
2. Sign in with the Apple Developer account that owns the app.
3. On the top-right, click your name → **Membership Details**.
4. Copy the **Team ID** (10-character alphanumeric, e.g. `A1B2C3D4E5`).

Alternative: Xcode → Xcode menu → Settings → Accounts → select team →
the Team ID is shown next to the team name.

### 2.2 Paste Team ID into `apple-app-site-association`

Open **`/app/frontend/public/.well-known/apple-app-site-association`**
and replace the three `REPLACE_TEAMID` placeholders with your actual
Team ID:

```json
"appIDs": ["A1B2C3D4E5.com.bidblitz.app"],
...
"webcredentials": { "apps": ["A1B2C3D4E5.com.bidblitz.app"] }
```

File must be served with `Content-Type: application/json` and **no
extension** on the filename — already correct.

Rebuild frontend + deploy so nginx serves:
`https://bidblitz.ae/.well-known/apple-app-site-association`

### 2.3 Verify iOS bundle identifier

Currently: **`com.bidblitz.app`**.

* `/app/frontend/capacitor.config.ts` → `appId: 'com.bidblitz.app'`
* `/app/frontend/ios/App/App.xcodeproj/project.pbxproj` → `PRODUCT_BUNDLE_IDENTIFIER = com.bidblitz.app`

If you want to change it:

1. Edit `capacitor.config.ts` → `appId`.
2. In Xcode → App target → Signing & Capabilities → change Bundle Identifier to match.
3. Update all three `REPLACE_TEAMID.com.bidblitz.pos` strings in
   `apple-app-site-association` to match the new id.
4. Re-run `yarn cap sync ios`.

### 2.4 Build commands — iOS

```bash
cd /app/frontend
./build-mobile.sh prod
yarn cap open ios         # opens Xcode
```

In Xcode:

1. Select the **App** target at top.
2. **Signing & Capabilities** tab → choose your **Team** (the one matching
   the Team ID you pasted above). Xcode will provision automatically.
3. **Add capability → Associated Domains**, add:
   * `applinks:bidblitz.ae`
   * `webcredentials:bidblitz.ae`
4. Change the top scheme device to **Any iOS Device (arm64)**.
5. Menu **Product → Archive**.
6. When archive completes, the **Organizer** opens → click **Distribute App**.
7. Choose **App Store Connect** → **Upload**.
8. Wait for processing (5–30 min), then submit for review in
   <https://appstoreconnect.apple.com>.

---

## 3. iOS APP STORE SAFE MODE (IAP-compliance)

### 3.1 What was hidden on iOS native builds

Implemented via `/app/frontend/src/utils/iosGuards.js` → `isIOSBlocked(key)`,
which returns `true` only when running inside the Capacitor iOS container.

| Feature key | Pages affected | Reason |
|---|---|---|
| `premium-upgrade` | `PremiumPage.jsx` | Ad-free / feature unlock = IAP required (3.1.1) |
| `pos-feature-addon` | `POSFeaturesComponents.jsx` (Stripe checkout button) | SaaS feature unlock = IAP required |
| `pos-subscription` | (reserved for future) | SaaS subscription = IAP required |
| `creator-subscribe` | `CreatorsPage.jsx` | Digital-content subscription = IAP required |
| `creator-tip` | `CreatorsPage.jsx` | Digital creator tip = IAP required |
| `gaming-buy-coins` | `GamingPage.jsx` → "Buy Coins" button | In-app token purchase = IAP required |
| `wallet-topup` | (reserved — currently ALLOWED, see below) | Stored-value wallet; risk = MEDIUM |
| `blitzmine-boost-buy` | (reserved) | Paid in-app boost = IAP required |
| `live-super-chat` | (reserved) | Digital creator tip = IAP required |

Each blocked flow either hides the CTA completely or shows the yellow
banner `IOSNotAvailable.jsx` that links the user to `bidblitz.ae`.

### 3.2 What remains ALLOWED on iOS (Apple-compliant)

* Penny auctions — real physical goods → Stripe OK (Guideline 3.1.5).
  **BUT** Apple sometimes treats the paid-bid mechanic as gambling. If
  the app gets rejected under 5.3.4, either add explicit age-gating or
  disable real-money bidding on iOS via a server-side feature flag.
* Taxi / Food delivery / Parcel — physical services → Stripe OK.
* Flights / Hotels / Restaurants / Events — real-world services → OK.
* Car rental — physical service → OK.
* Wallet top-up — **currently visible on iOS**. Risk is MEDIUM; can be
  removed by adding `"wallet-topup"` to the BLOCKED set in `iosGuards.js`
  if Apple rejects the first submission.
* BidBlitz Pay Card / Stripe Issuing — financial service → OK (3.1.5).
* POS merchant usage (checkout, inventory, loyalty) — OK. Merchants are
  B2B users; Apple rules 3.1.3(b) allow enterprise software.
* Staff tipping in restaurants (TipModal) — physical-world service → OK.
* Referral bonuses / Cashback — user-earned credit → OK.
* Mining (BlitzMine) — reward earning without purchase → OK.

### 3.3 Re-enabling hidden flows (once IAP is shipped)

Add a runtime override:

```js
// e.g. after feature-flags load from backend
if (featureFlags.ios_iap_live) window.__BB_FORCE_IAP_OPEN = true;
```

Or edit the BLOCKED set in `iosGuards.js` directly.

---

## 4. EXACT BUILD COMMANDS — COPY / PASTE

### Android

```bash
# One-time: keystore + properties
cd /app/frontend/android
keytool -genkeypair -v -keystore bidblitz-upload.jks -alias bidblitz \
        -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS
cp keystore.properties.template keystore.properties
# then edit keystore.properties with real passwords

# Fingerprint (paste SHA256 into public/.well-known/assetlinks.json)
keytool -list -v -keystore bidblitz-upload.jks -alias bidblitz

# Build
cd /app/frontend
./build-mobile.sh prod
cd android && ./gradlew bundleRelease

# Result: android/app/build/outputs/bundle/release/app-release.aab
```

### iOS

```bash
cd /app/frontend
./build-mobile.sh prod
yarn cap open ios
# In Xcode: Signing → Team, Add Associated Domains, then
# Product → Archive → Distribute → App Store Connect
```

---

## 5. FINAL STATUS

| Component | Status |
|---|---|
| **Android ready** | **YES** — as soon as user (a) runs the `keytool` command locally, (b) fills in `keystore.properties`, (c) pastes SHA256 into `assetlinks.json`, and (d) runs `./gradlew bundleRelease`. All code changes are complete. |
| **iOS ready** | **YES** — as soon as user (a) pastes their Apple Team ID into `apple-app-site-association`, (b) opens Xcode, selects signing team, adds Associated Domains, and (c) runs Product → Archive. All code changes are complete. |

### Remaining user actions (nothing else is code-side)

1. **Android — local machine only:**
   * Run `keytool -genkeypair ... bidblitz-upload.jks` (see §1.1).
   * Back up the `.jks` to an offline location.
   * Create `keystore.properties` from template, fill passwords.
   * Run `keytool -list -v -keystore bidblitz-upload.jks -alias bidblitz` → copy SHA256 → paste into `/app/frontend/public/.well-known/assetlinks.json`.
   * `cd /app/frontend && yarn build && cd android && ./gradlew bundleRelease`.
   * Upload `app-release.aab` to Google Play Console.

2. **iOS — macOS with Xcode only:**
   * Get Apple Team ID from <https://developer.apple.com/account> → Membership Details.
   * Paste Team ID into the 3 placeholders in `/app/frontend/public/.well-known/apple-app-site-association`.
   * `cd /app/frontend && yarn build && yarn cap sync ios`.
   * `yarn cap open ios`.
   * In Xcode: pick Team, add Associated Domains `applinks:bidblitz.ae` + `webcredentials:bidblitz.ae`.
   * Product → Archive → Distribute → App Store Connect.
   * Create the listing in App Store Connect (screenshots, description, privacy URL = `https://bidblitz.ae/legal/datenschutz`).

3. **Deployment:**
   * Push current frontend build to `https://bidblitz.ae` so that
     `.well-known/assetlinks.json` (with real SHA256) and
     `.well-known/apple-app-site-association` (with real Team ID) are
     reachable. **This must happen BEFORE the first app build is
     installed**, otherwise deep-link verification fails.

4. **Google Play Console / App Store Connect:**
   * Create the store listing (app name: BidBlitz; category: Finance or Shopping).
   * Screenshots: minimum 2 phone screenshots per store; iOS additionally needs 6.9" and 6.5" device sizes.
   * Data Safety (Play) / Privacy Nutrition Labels (Apple): declare
     camera, location, payment info, contact info, identifiers as collected.
   * Privacy policy URL: `https://bidblitz.ae/legal/datenschutz`.
   * Terms URL: `https://bidblitz.ae/legal/agb`.

No more code blockers remain.
