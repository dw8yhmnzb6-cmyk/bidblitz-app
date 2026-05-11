# 📱 BidBlitz App Store Submissions Guide

**App:** BidBlitz - Die Super-App  
**Platforms:** iOS (App Store) + Android (Google Play)  
**Version:** 0.1.1  
**Bundle ID:** `com.bidblitz.app`  
**Status:** Ready for Submission

---

## 📋 Pre-Submission Checklist

### ✅ App Configuration (DONE)
- [x] Capacitor configured (`capacitor.config.ts`)
- [x] App ID: `com.bidblitz.app`
- [x] App Name: "BidBlitz"
- [x] Version: 0.1.1
- [x] Icons prepared (192, 512, 1024px)
- [x] Splash Screen configured
- [x] Status Bar configured

### ⏳ Required Before Submission
- [ ] Privacy Policy URL (required for both stores)
- [ ] Terms of Service URL
- [ ] Support URL / Contact Email
- [ ] App Description (German + English)
- [ ] Screenshots (5+ per platform)
- [ ] Promotional images
- [ ] Apple Developer Account ($99/year)
- [ ] Google Play Developer Account ($25 one-time)

---

## 🍎 iOS App Store Submission

### Step 1: Prerequisites

**Apple Developer Account:**
- Sign up: https://developer.apple.com/programs/
- Cost: $99 USD/year
- Verification: 24-48 hours

**Required Software:**
- macOS (Catalina 10.15+)
- Xcode 14+ (from Mac App Store)
- CocoaPods (`sudo gem install cocoapods`)

**Certificates & Provisioning:**
1. Go to https://developer.apple.com/account/
2. Create App ID: `com.bidblitz.app`
3. Create Distribution Certificate
4. Create Provisioning Profile (App Store Distribution)

---

### Step 2: Build iOS App

**On macOS machine:**

```bash
# 1. Install dependencies
cd /path/to/bidblitz/frontend
yarn install

# 2. Build React app
yarn build

# 3. Sync Capacitor
npx cap sync ios

# 4. Open in Xcode
npx cap open ios
```

**In Xcode:**

1. **Set Bundle ID:**
   - Select project → General → Bundle Identifier: `com.bidblitz.app`

2. **Set Version & Build:**
   - Version: `0.1.1`
   - Build: `1`

3. **Configure Signing:**
   - Signing & Capabilities → Team: Select your Apple Developer team
   - Provisioning Profile: Select App Store profile

4. **Configure Permissions (Info.plist):**
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Benötigen wir für Taxi-Abholung und Lieferadresse</string>
   
   <key>NSCameraUsageDescription</key>
   <string>Für Profilbilder und KYC-Verifizierung</string>
   
   <key>NSPhotoLibraryUsageDescription</key>
   <string>Zum Hochladen von Bildern</string>
   
   <key>NSMicrophoneUsageDescription</key>
   <string>Für Video-Streaming und Support-Calls</string>
   ```

5. **Build Archive:**
   - Product → Archive
   - Wait for build (~5-10 min)
   - Window → Organizer → Distribute App
   - Select "App Store Connect"
   - Upload to App Store

---

### Step 3: App Store Connect

**Create App Listing:**

1. Go to https://appstoreconnect.apple.com/
2. My Apps → + → New App
3. Fill App Information:

**Basic Info:**
```
Name: BidBlitz
Subtitle: Die Super-App für alles
Bundle ID: com.bidblitz.app
SKU: BIDBLITZ-001
Primary Language: German
```

**Category:**
```
Primary: Lifestyle
Secondary: Finance
```

**App Description (German):**
```
BidBlitz – Die Super-App für Deutschland

🚕 TAXI & MOBILITÄT
• Taxi buchen in Sekunden
• E-Scooter in der Nähe finden
• Food Delivery & Lieferservice

💳 DIGITAL WALLET
• Guthaben aufladen & bezahlen
• Blitz-Überweisungen
• Krypto-Wallet integriert

🛍️ SHOPPING & AUKTIONEN
• Live-Auktionen
• Marketplace
• Social Shopping

⚡ WEITERE FEATURES
• POS-System für Händler
• EV-Charging für Elektroautos
• Tierbetreuung buchen
• Gaming & Arcade

Alles in einer App. Einfach. Schnell. Sicher.
```

**App Description (English):**
```
BidBlitz – The Super App for Everything

🚕 TAXI & MOBILITY
• Book taxis instantly
• Find nearby e-scooters
• Food delivery service

💳 DIGITAL WALLET
• Top up & pay
• Instant transfers
• Crypto wallet integrated

🛍️ SHOPPING & AUCTIONS
• Live auctions
• Marketplace
• Social shopping

⚡ MORE FEATURES
• POS system for merchants
• EV charging stations
• Pet care booking
• Gaming & arcade

All in one app. Simple. Fast. Secure.
```

**Keywords (max 100 chars):**
```
taxi,wallet,food,delivery,auction,payment,scooter,shopping,fintech
```

**Support URL:**
```
https://bidblitz.ae/support
```

**Privacy Policy URL:**
```
https://bidblitz.ae/privacy
```

---

### Step 4: Screenshots (Required)

**iOS Screenshot Sizes:**

| Device | Size (Portrait) | Required |
|--------|----------------|----------|
| iPhone 6.7" (Pro Max) | 1290 x 2796 | ✅ Minimum 3 |
| iPhone 6.5" | 1242 x 2688 | ✅ Minimum 3 |
| iPhone 5.5" | 1242 x 2208 | Optional |
| iPad Pro 12.9" | 2048 x 2732 | Optional |

**Recommended Screenshots:**
1. **Home/Dashboard** - Overview of all features
2. **Taxi Booking** - Show booking flow
3. **Wallet** - Balance & transactions
4. **Auctions** - Live bidding
5. **Profile** - User settings

**Tools:**
- Use Xcode Simulator
- Capture: Cmd + S
- Or use: https://www.appscreenshots.io/

---

### Step 5: App Review Information

**Demo Account (for Apple Review Team):**
```
Email: appstore-demo@bidblitz.ae
Password: DemoAccount2024!
```

**Review Notes:**
```
TEST INSTRUCTIONS:

1. Login with demo account (credentials above)
2. Navigate to Taxi module to test booking
3. Check Wallet for balance display
4. Browse Marketplace/Auctions

IMPORTANT NOTES:
- Some features require real GPS location (Taxi, Scooter)
- Payment is test-mode (no real charges)
- Admin features require separate login

Contact: support@bidblitz.ae for questions
```

---

### Step 6: Submit for Review

1. **Pricing:** Free (with In-App Purchases optional)
2. **Availability:** Worldwide or Germany only
3. **Age Rating:** 
   - Violence: None
   - Profanity: None
   - Gambling: Yes (Auctions)
   - Suggested: 12+

4. **Export Compliance:**
   - Uses Encryption: Yes (HTTPS)
   - Export Compliance: No (standard encryption only)

5. **Submit:** Click "Submit for Review"

**Review Time:** 24-48 hours typical

---

## 🤖 Google Play Store Submission

### Step 1: Prerequisites

**Google Play Console:**
- Sign up: https://play.google.com/console/signup
- Cost: $25 USD (one-time)
- Verification: Instant

**Required Software:**
- Android Studio (or command line tools)
- JDK 17+
- Gradle

---

### Step 2: Build Android APK/AAB

**On your development machine:**

```bash
# 1. Install dependencies
cd /path/to/bidblitz/frontend
yarn install

# 2. Build React app
yarn build

# 3. Sync Capacitor
npx cap sync android

# 4. Open in Android Studio
npx cap open android
```

**In Android Studio:**

1. **Update `build.gradle` (app level):**
   ```gradle
   android {
       defaultConfig {
           applicationId "com.bidblitz.app"
           versionCode 1
           versionName "0.1.1"
           minSdkVersion 22
           targetSdkVersion 34
       }
   }
   ```

2. **Generate Signing Key:**
   ```bash
   keytool -genkey -v -keystore bidblitz-release.keystore \
     -alias bidblitz -keyalg RSA -keysize 2048 -validity 10000
   
   # Password: [SAVE THIS SECURELY]
   # Alias: bidblitz
   ```

3. **Configure Signing (`android/app/build.gradle`):**
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file("../../bidblitz-release.keystore")
               storePassword System.getenv("KEYSTORE_PASSWORD")
               keyAlias "bidblitz"
               keyPassword System.getenv("KEY_PASSWORD")
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
           }
       }
   }
   ```

4. **Build Release AAB:**
   ```bash
   cd android
   ./gradlew bundleRelease
   
   # Output: android/app/build/outputs/bundle/release/app-release.aab
   ```

---

### Step 3: Google Play Console Setup

**Create App:**

1. Go to https://play.google.com/console/
2. Create App → Fill details:

**App Details:**
```
App Name: BidBlitz
Default Language: German (Deutsch)
App Type: App
Category: Lifestyle
```

**Store Listing:**

**Short Description (80 chars):**
```
Die Super-App: Taxi, Wallet, Food, Auktionen & mehr in einer App
```

**Full Description (4000 chars max):**
```
🚀 BidBlitz – Die Super-App für Deutschland

Entdecke die All-in-One-Lösung für deinen Alltag!

🚕 TAXI & MOBILITÄT
• Taxi jetzt buchen – in Sekunden unterwegs
• E-Scooter in deiner Nähe finden
• Food Delivery – Essen direkt zu dir

💳 DIGITAL WALLET
• Guthaben aufladen und bezahlen
• Blitz-Überweisungen an Freunde
• Krypto-Wallet für Bitcoin & Co.

🛍️ SHOPPING & AUKTIONEN
• Live-Auktionen – Biete mit und gewinne!
• Marketplace für lokale Deals
• Social Shopping mit Freunden

⚡ NOCH MEHR FEATURES
• POS-System für Händler & Restaurants
• EV-Charging Stationen finden
• Tierbetreuung in deiner Nähe buchen
• Gaming & Arcade Mini-Spiele

✨ WARUM BIDBLITZ?
✓ Alles in einer App
✓ Schnelle Zahlungen
✓ Sichere Verschlüsselung
✓ 24/7 Support

📱 Jetzt herunterladen und loslegen!
```

**App Icon:**
- Upload: `/app/frontend/public/app-icon-512.png` (512x512)

**Feature Graphic:**
- Size: 1024 x 500 px
- Upload: `/app/frontend/public/store-feature-1024x500.png`

**Screenshots (Minimum 2, Maximum 8):**
- Phone: 16:9 or 9:16 ratio
- Tablet: Optional

---

### Step 4: Content Rating

**Questionnaire:**
- Violence: No
- Sex/Nudity: No
- Profanity: No
- Drugs: No
- Gambling: Yes (Auctions/Bidding)
- Social Features: Yes (Chat, Friends)
- User-Generated Content: Yes

**Expected Rating:** PEGI 12 / USK 12

---

### Step 5: App Content & Privacy

**Privacy Policy:**
```
https://bidblitz.ae/privacy
```

**Data Safety:**
- Collects Location: Yes (for Taxi/Delivery)
- Collects Personal Info: Yes (Name, Email, Phone)
- Collects Financial Info: Yes (Wallet, Payments)
- Data Encrypted: Yes
- Users can request deletion: Yes

---

### Step 6: Release

**Release Type:** Production

**Countries:** Select:
- Germany (Primary)
- Austria
- Switzerland
- Or: Worldwide

**Pricing:** Free

**App Release:**
1. Upload AAB file (`app-release.aab`)
2. Release Name: `v0.1.1 - Initial Release`
3. Release Notes:
   ```
   🎉 BidBlitz ist da!
   
   ✨ Features:
   • Taxi buchen
   • Wallet & Zahlungen
   • Food Delivery
   • Live-Auktionen
   • E-Scooter finden
   
   Mehr Features kommen bald!
   ```

4. **Submit for Review**

**Review Time:** 1-7 days typical

---

## 📸 Screenshot Generation Guide

**Automated Screenshot Tool:**

```bash
# Install Capacitor Screenshot plugin
npm install @capacitor-community/screenshot-api

# Or use Playwright for automated screenshots
```

**Manual Screenshots:**

1. **iOS Simulator:**
   ```bash
   # Open specific device
   npx cap open ios
   # In Xcode: Choose device (e.g., iPhone 15 Pro Max)
   # Run app, navigate, press Cmd+S
   ```

2. **Android Emulator:**
   ```bash
   npx cap open android
   # In Android Studio: Choose device (e.g., Pixel 7)
   # Run app, navigate, use screenshot button
   ```

**Required Screens:**
- Login/Onboarding
- Dashboard/Home
- Taxi Booking
- Wallet
- Marketplace/Auctions

---

## 🚀 CI/CD Automation (Optional)

**GitHub Actions for Store Builds:**

`.github/workflows/build-mobile.yml`:
```yaml
name: Build Mobile Apps

on:
  push:
    tags:
      - 'v*'

jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build iOS
        run: |
          cd frontend
          yarn install
          yarn build
          npx cap sync ios
          xcodebuild archive ...
          
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Android AAB
        run: |
          cd frontend
          yarn install
          yarn build
          npx cap sync android
          cd android && ./gradlew bundleRelease
```

---

## 📋 Post-Submission Checklist

### After Approval:
- [ ] Test download from stores
- [ ] Monitor crash reports (Firebase Crashlytics)
- [ ] Monitor reviews
- [ ] Set up app update notifications
- [ ] Plan v0.2.0 features

### Ongoing:
- [ ] Monthly updates (App Store prefers regular updates)
- [ ] Respond to user reviews within 48h
- [ ] Monitor analytics (downloads, retention, crashes)

---

## 🆘 Troubleshooting

**iOS Build Errors:**
```bash
# Clean build
cd ios/App
rm -rf Pods Podfile.lock
pod install
xcodebuild clean
```

**Android Build Errors:**
```bash
# Clean Gradle
cd android
./gradlew clean
./gradlew bundleRelease --stacktrace
```

**Certificate Issues:**
- Re-download from Apple Developer Portal
- Verify Bundle ID matches
- Check provisioning profile expiration

---

## 📞 Support

- **BidBlitz Support:** support@bidblitz.ae
- **Apple Developer Support:** https://developer.apple.com/support/
- **Google Play Support:** https://support.google.com/googleplay/android-developer/

---

**Last Updated:** 2026-05-11  
**Next Review:** Before v0.2.0 release
