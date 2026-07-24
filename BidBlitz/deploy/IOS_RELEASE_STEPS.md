# BidBlitz iOS Release Build - Steps

**Bundle ID:** `com.bidblitz.app`

---

## Prerequisites

- **macOS** with **Xcode 15+** installed
- **Apple Developer Account** (paid membership required for App Store distribution)
- **CocoaPods** installed: `sudo gem install cocoapods`

---

## 1. Find Your Apple Team ID

### Method A: Developer Portal

1. Go to: [https://developer.apple.com/account](https://developer.apple.com/account)
2. Sign in with your Apple Developer account
3. Click your name (top-right) → **Membership Details**
4. Copy the **Team ID** (10-character alphanumeric, e.g. `A1B2C3D4E5`)

### Method B: Xcode

1. Open Xcode
2. Menu: **Xcode** → **Settings** → **Accounts**
3. Select your Apple ID
4. Click your Team name
5. Team ID is shown next to the team name

---

## 2. Update apple-app-site-association with Team ID

Open: `/app/frontend/public/.well-known/apple-app-site-association`

Replace **all 3 instances** of `REPLACE_TEAMID` with your actual Team ID:

**Before:**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["REPLACE_TEAMID.com.bidblitz.app"],
        ...
      }
    ]
  },
  "webcredentials": { "apps": ["REPLACE_TEAMID.com.bidblitz.app"] }
}
```

**After (example with Team ID `A1B2C3D4E5`):**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["A1B2C3D4E5.com.bidblitz.app"],
        ...
      }
    ]
  },
  "webcredentials": { "apps": ["A1B2C3D4E5.com.bidblitz.app"] }
}
```

**Rebuild frontend** so the updated file gets into the iOS assets:

```bash
cd /app/frontend
yarn build
npx cap sync ios
```

**Deploy** the file to production so it's reachable at:  
`https://bidblitz.ae/.well-known/apple-app-site-association`

---

## 3. Open Xcode Project

```bash
cd /app/frontend
npx cap open ios
```

Xcode will open the BidBlitz iOS project.

---

## 4. Configure Signing & Capabilities in Xcode

### 4.1 Select the App Target

1. In Xcode's left sidebar, click the **App** project (top)
2. Select the **App** target (under **TARGETS**)
3. Go to the **Signing & Capabilities** tab

### 4.2 Enable Automatic Signing

1. Check **"Automatically manage signing"**
2. Select your **Team** from the dropdown (the one matching your Team ID)
3. Xcode will automatically provision the app

**Verify:**
- **Bundle Identifier:** `com.bidblitz.app` ✅
- **Signing Certificate:** Apple Development / Distribution (auto-generated)

### 4.3 Add Associated Domains Capability

1. Click the **"+ Capability"** button
2. Search for **"Associated Domains"**
3. Double-click to add it
4. Click **"+"** to add two domains:
   - `applinks:bidblitz.ae`
   - `webcredentials:bidblitz.ae`

**Do NOT include `https://` in the domain names.**

---

## 5. Install CocoaPods Dependencies

If you haven't synced yet:

```bash
cd /app/frontend/ios/App
pod install
```

This installs Capacitor native dependencies.

---

## 6. Build & Test on Device/Simulator

### 6.1 Select Device

1. At the top of Xcode, select a device:
   - For testing: **iPhone 15 Simulator** or your physical device
   - For release: **Any iOS Device (arm64)**

### 6.2 Run the App

1. Click the **Play (▶)** button or press **Cmd + R**
2. App should launch on the device/simulator

**Test key features:**
- Login/registration
- Deep links (open Safari → navigate to `https://bidblitz.ae/auctions/123` → should open app)
- Stripe payments

---

## 7. Archive for App Store Distribution

### 7.1 Select "Any iOS Device (arm64)"

At the top of Xcode, change the device dropdown to:
**Any iOS Device (arm64)**

### 7.2 Create Archive

1. Menu: **Product** → **Archive**
2. Wait for the build to complete (~2-5 minutes)
3. The **Organizer** window will open automatically

### 7.3 Distribute to App Store

1. In the **Organizer**, select your archive
2. Click **"Distribute App"**
3. Choose **"App Store Connect"**
4. Select **"Upload"** (default)
5. Follow the prompts (automatic signing is recommended)
6. Click **"Upload"**

**Processing time:** 5-30 minutes after upload.

---

## 8. App Store Connect Setup

### 8.1 Create App Listing

1. Go to: [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **"My Apps"** → **"+"** → **"New App"**

**Required info:**
- **Platform:** iOS
- **Name:** BidBlitz
- **Primary Language:** German
- **Bundle ID:** `com.bidblitz.app` (select from dropdown)
- **SKU:** `bidblitz-app-001` (internal tracking, any unique string)

### 8.2 App Information

- **Category:** Finance or Shopping
- **Content Rights:** Check "Does not contain third-party content"

### 8.3 Privacy Policy & Terms

- **Privacy Policy URL:** `https://bidblitz.ae/legal/datenschutz`
- **Terms of Service URL:** `https://bidblitz.ae/legal/agb`

### 8.4 App Privacy

Click **"App Privacy"** → **"Get Started"**

**Data collected:**
- ✅ Contact Info (email)
- ✅ User Content (photos, purchases)
- ✅ Identifiers (user ID)
- ✅ Location (coarse for marketplace)
- ✅ Financial Info (Stripe payments)

**Purpose:**
- App Functionality, Analytics, Product Personalization

### 8.5 Screenshots

**Required sizes:**
- **6.7" (iPhone 15 Pro Max):** 1290 × 2796 pixels (2-10 screenshots)
- **6.5" (iPhone 15 Plus):** 1242 × 2688 pixels (2-10 screenshots)

**Optional:**
- iPad Pro 12.9" (if supporting iPads)

**Tools:**
- Use Xcode Simulator → **Device → Screenshot**
- Use [App Store Screenshot Generator](https://www.appscreenshots.com/)

### 8.6 App Review Information

**Contact info:**
- **First/Last Name:** Your name
- **Phone:** Your phone
- **Email:** Your email

**Demo account (required if login is needed):**
- **Username:** `admin@bidblitz.ae` (or create a demo account)
- **Password:** [provide test password]
- **Notes:** "Use this account to test all features."

**Age Rating:**
- Click **"Edit"** → Answer questionnaire
- Likely result: **12+** (simulated gambling, in-app purchases)

---

## 9. Submit for Review

1. Select your uploaded build in **App Store Connect**
2. Fill in **"What's New in This Version"**: `Initial release`
3. Click **"Add for Review"**
4. Click **"Submit to App Review"**

**Review time:** 24-48 hours (first submission often takes longer).

---

## 10. Verify Deep Links After Approval

After app is live on the App Store:

1. Install the app on a physical device
2. Open Safari → navigate to `https://bidblitz.ae/auctions/123`
3. App should open automatically (not browser)

If deep links don't work:
- Verify `apple-app-site-association` is reachable at:
  `https://bidblitz.ae/.well-known/apple-app-site-association`
- Verify Team ID matches your Apple Developer account
- Check Xcode → **Associated Domains** are correctly set

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No signing certificate found" | Xcode → Settings → Accounts → Download Manual Profiles |
| "Failed to register bundle identifier" | Bundle ID already registered → use existing one in Developer Portal |
| "CocoaPods not installed" | Run: `sudo gem install cocoapods` |
| White screen on launch | Check `REACT_APP_BACKEND_URL` points to production API |
| Deep links not working | Verify `apple-app-site-association` is live and Team ID is correct |
| "Provisioning profile doesn't match" | Xcode → Signing → Select correct Team |

---

## App Store Rejection - Common Issues

### 3.1.1 In-App Purchase (IAP)

**Issue:** App offers digital goods/services without using Apple IAP.

**Solution:** BidBlitz already implements IAP guards via `iosGuards.js`.  
The following features are **hidden on iOS**:
- Premium subscriptions
- Gaming coins
- Creator tips
- POS feature add-ons

**Physical goods/services remain visible:**
- Penny auctions (physical items)
- Taxi, Food, Flights, Hotels
- BidBlitz Pay (financial service)

### 5.3.4 Gambling

**Issue:** Paid penny auctions may be flagged as gambling.

**Solution:**
- Add age-gating (18+) in app
- OR disable real-money bidding on iOS via server feature flag

---

## Build Configuration Summary

| Property | Value |
|----------|-------|
| Bundle ID | `com.bidblitz.app` |
| Team ID | *(Your 10-char Apple Team ID)* |
| Xcode Version | 15+ |
| Deployment Target | iOS 13.0+ |
| Associated Domains | `applinks:bidblitz.ae`, `webcredentials:bidblitz.ae` |

---

## Final Checklist

- [ ] Apple Developer account active (paid membership)
- [ ] Team ID found and pasted into `apple-app-site-association`
- [ ] Frontend rebuilt and deployed to production
- [ ] Xcode project opened via `npx cap open ios`
- [ ] Signing configured (Team selected, automatic signing enabled)
- [ ] Associated Domains added (`applinks:bidblitz.ae`, `webcredentials:bidblitz.ae`)
- [ ] Archive created (Product → Archive)
- [ ] App uploaded to App Store Connect
- [ ] App listing created (name, bundle ID, screenshots, privacy)
- [ ] Demo account credentials provided for App Review
- [ ] App submitted for review

**✅ Ready for App Store submission!**
