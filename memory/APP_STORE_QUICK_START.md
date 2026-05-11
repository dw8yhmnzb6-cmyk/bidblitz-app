# ✅ App Store Submission - Quick Start Checklist

**Goal:** Get BidBlitz on iOS App Store & Google Play Store

---

## 🎯 Phase 1: Preparation (1-2 days)

### Developer Accounts
- [ ] **Apple Developer Program** - Sign up at https://developer.apple.com/programs/
  - Cost: $99 USD/year
  - Verification: 24-48 hours
  - Need: Credit card, legal entity info

- [ ] **Google Play Console** - Sign up at https://play.google.com/console/signup
  - Cost: $25 USD (one-time)
  - Verification: Instant
  - Need: Credit card, valid ID

### Legal Documents (CRITICAL - Required by both stores)
- [ ] **Privacy Policy** → Create at https://bidblitz.ae/privacy
  - Must cover: Location, Personal data, Financial data, Cookies
  - Generator: https://www.freeprivacypolicy.com/ or hire lawyer

- [ ] **Terms of Service** → https://bidblitz.ae/terms
  - Must cover: Service usage, Payments, Refunds, Liability

- [ ] **Support Page** → https://bidblitz.ae/support
  - Contact email: support@bidblitz.ae
  - FAQ section

### App Store Assets
- [ ] **App Icon** ✅ (Already exists: `/app/frontend/public/app-icon-1024.png`)
- [ ] **Feature Graphic** ✅ (Already exists: `/app/frontend/public/store-feature-1024x500.png`)
- [ ] **Screenshots** (5+ per platform)
  - iPhone: 1290x2796 (3 minimum)
  - Android: 1080x1920 (2 minimum)
  - Screens needed: Home, Taxi, Wallet, Marketplace, Profile

---

## 🍎 Phase 2: iOS Build & Submit (macOS required, 2-4 hours)

### Prerequisites
- [ ] macOS computer (Catalina 10.15+)
- [ ] Xcode 14+ installed
- [ ] Apple Developer account verified
- [ ] CocoaPods installed (`sudo gem install cocoapods`)

### Build Steps
```bash
# 1. Clone & build React app
cd bidblitz/frontend
yarn install
yarn build

# 2. Sync Capacitor
npx cap sync ios
npx cap open ios

# 3. In Xcode:
# - Set Bundle ID: com.bidblitz.app
# - Set Version: 0.1.1, Build: 1
# - Configure Signing (select your team)
# - Add Location permission description to Info.plist
# - Product → Archive
# - Upload to App Store Connect
```

### App Store Connect
- [ ] Create app at https://appstoreconnect.apple.com/
- [ ] Fill app information (Name, Description, Keywords)
- [ ] Upload screenshots
- [ ] Set Privacy Policy URL
- [ ] Create demo account for reviewers
- [ ] Submit for review

**Estimated Review Time:** 24-48 hours

---

## 🤖 Phase 3: Android Build & Submit (Any OS, 1-3 hours)

### Prerequisites
- [ ] Android Studio installed
- [ ] JDK 17+ installed
- [ ] Google Play Console account verified

### Build Steps
```bash
# 1. Build React app (if not done)
cd bidblitz/frontend
yarn install
yarn build

# 2. Sync Capacitor
npx cap sync android
npx cap open android

# 3. Generate signing keystore
keytool -genkey -v -keystore bidblitz-release.keystore \
  -alias bidblitz -keyalg RSA -keysize 2048 -validity 10000

# 4. In Android Studio:
# - Update versionCode & versionName in build.gradle
# - Configure signing with keystore
# - Build → Generate Signed Bundle (AAB)
# - Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Google Play Console
- [ ] Create app at https://play.google.com/console/
- [ ] Fill store listing (Name, Description)
- [ ] Upload app icon & feature graphic
- [ ] Upload screenshots
- [ ] Complete content rating questionnaire
- [ ] Fill data safety form
- [ ] Upload AAB file
- [ ] Submit for review

**Estimated Review Time:** 1-7 days

---

## 📸 Phase 4: Screenshots (1-2 hours)

### Automated Way (Recommended)
Use Playwright to capture screenshots:

```bash
# Install Playwright
cd frontend
npm install -D @playwright/test

# Create screenshot script (see APP_STORE_SUBMISSION_GUIDE.md)
# Run: npx playwright test screenshots.spec.ts
```

### Manual Way
1. Run app in iOS Simulator / Android Emulator
2. Navigate to each screen
3. Capture:
   - iOS: Cmd + S in Simulator
   - Android: Screenshot button in Emulator

**Required Screens:**
1. **Home Dashboard** - Show all modules
2. **Taxi Booking** - Booking interface with map
3. **Wallet** - Balance and transactions
4. **Marketplace/Auctions** - Live bidding
5. **Profile** - User settings

---

## 🚀 Phase 5: Submission

### Pre-Flight Checklist
- [ ] App builds successfully on both platforms
- [ ] No crash on launch
- [ ] Login works with demo account
- [ ] At least 1 major feature working (e.g., Taxi booking)
- [ ] Privacy Policy live
- [ ] Terms of Service live
- [ ] Support email active

### Submit
- [ ] iOS: Click "Submit for Review" in App Store Connect
- [ ] Android: Click "Submit for Review" in Play Console

### Monitor
- [ ] Check email for review updates
- [ ] Respond to reviewer questions within 24h
- [ ] Fix any rejection issues

---

## ⏱️ Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Developer Accounts | 1-2 days | Apple verification |
| Legal Documents | 2-4 hours | Lawyer review (optional) |
| iOS Build | 2-4 hours | macOS, Xcode |
| Android Build | 1-3 hours | Android Studio |
| Screenshots | 1-2 hours | Running app |
| Store Listings | 1-2 hours | Assets ready |
| **Total** | **3-5 days** | With accounts ready |

---

## 💰 Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer | $99 | Annual |
| Google Play | $25 | One-time |
| Privacy Policy (optional lawyer) | $200-500 | One-time |
| **Total Initial** | **$124-624** | - |
| **Annual Renewal** | **$99** | Yearly |

---

## 🆘 Common Issues & Solutions

### "No macOS for iOS build"
**Solution:** 
- Use GitHub Actions with macOS runner
- Or rent macOS cloud (MacStadium, AWS Mac)
- Or use Expo EAS Build (paid service)

### "Screenshots don't look professional"
**Solution:**
- Use mockup tools: https://mockuphone.com/
- Or hire designer on Fiverr ($20-50)

### "App rejected for missing features"
**Solution:**
- Ensure demo account has access
- Add clear review notes
- Show at least 3-4 working features

### "Certificate/Provisioning issues"
**Solution:**
- Revoke and recreate in Apple Developer Portal
- Use "Automatic" signing in Xcode for first build
- Check Bundle ID matches exactly

---

## 📞 Quick Links

- **Full Guide:** `/app/memory/APP_STORE_SUBMISSION_GUIDE.md`
- **Capacitor Config:** `/app/frontend/capacitor.config.ts`
- **App Icons:** `/app/frontend/public/`
- **Apple Developer:** https://developer.apple.com/account/
- **Google Play Console:** https://play.google.com/console/
- **Support Email:** support@bidblitz.ae

---

## ✅ Success Criteria

App is **READY** when:
- [x] Capacitor configured
- [x] Icons prepared
- [ ] Privacy Policy live
- [ ] Screenshots captured (5+)
- [ ] Demo account works
- [ ] Builds successfully
- [ ] No crashes on launch

**NEXT STEP:** Create Privacy Policy & Terms of Service

---

**Created:** 2026-05-11  
**Status:** Ready for execution  
**Owner:** BidBlitz Team
