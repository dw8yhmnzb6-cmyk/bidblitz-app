# 📸 App Store Screenshots - Generated

**Date:** 2026-05-11  
**Location:** `/app/frontend/public/screenshots/`  
**Total Size:** 13 MB

---

## ✅ Generated Screenshots

### iOS (iPhone Pro Max - 1290x2796)

| # | Filename | Size | Screen | Status |
|---|----------|------|--------|--------|
| 1 | `01-home-iphone-pro-max.png` | 1.6 MB | Home Dashboard | ✅ Ready |
| 2 | `02-taxi-iphone-pro-max.png` | 882 KB | Taxi Booking | ✅ Ready |
| 3 | `03-wallet-iphone-pro-max.png` | 1.6 MB | Digital Wallet | ✅ Ready |
| 4 | `04-auctions-iphone-pro-max.png` | 3.1 MB | Live Auctions | ✅ Ready |
| 5 | `05-profile-iphone-pro-max.png` | 1.6 MB | User Profile | ✅ Ready |

**Total:** 5 screenshots (Minimum required: 3) ✅

### Android (1080x1920)

| # | Filename | Size | Screen | Status |
|---|----------|------|--------|--------|
| 1 | `01-home-android-phone.png` | 790 KB | Home Dashboard | ✅ Ready |
| 2 | `02-taxi-android-phone.png` | 475 KB | Taxi Booking | ✅ Ready |
| 3 | `03-wallet-android-phone.png` | 856 KB | Digital Wallet | ✅ Ready |
| 4 | `04-auctions-android-phone.png` | 1.5 MB | Live Auctions | ✅ Ready |

**Total:** 4 screenshots (Minimum required: 2) ✅

---

## 📋 Screenshot Descriptions (for Store Listings)

### 1. Home Dashboard
**German:**
```
Alle Funktionen auf einen Blick: Taxi, Wallet, Food Delivery, Auktionen und mehr.
```

**English:**
```
All features at a glance: Taxi, Wallet, Food Delivery, Auctions and more.
```

---

### 2. Taxi Booking
**German:**
```
Taxi jetzt buchen – mit Echtzeit-Karte und Live-Tracking.
```

**English:**
```
Book a taxi now – with real-time map and live tracking.
```

---

### 3. Digital Wallet
**German:**
```
Guthaben verwalten, bezahlen und Geld an Freunde senden.
```

**English:**
```
Manage balance, make payments and send money to friends.
```

---

### 4. Live Auctions
**German:**
```
Biete mit in spannenden Live-Auktionen und sichere dir tolle Deals.
```

**English:**
```
Bid in exciting live auctions and secure great deals.
```

---

### 5. User Profile
**German:**
```
Dein Profil – Einstellungen, Favoriten und Account-Verwaltung.
```

**English:**
```
Your profile – settings, favorites and account management.
```

---

## 📤 Upload Instructions

### iOS (App Store Connect)

1. Go to https://appstoreconnect.apple.com/
2. Select your app → App Store → Screenshots
3. Select device: **6.7" Display (iPhone Pro Max)**
4. Upload screenshots in order:
   - `01-home-iphone-pro-max.png`
   - `02-taxi-iphone-pro-max.png`
   - `03-wallet-iphone-pro-max.png`
   - `04-auctions-iphone-pro-max.png`
   - `05-profile-iphone-pro-max.png`
5. Add captions (optional but recommended)
6. Repeat for other device sizes if needed

**Tip:** Screenshots will be shown in the order uploaded.

---

### Android (Google Play Console)

1. Go to https://play.google.com/console/
2. Select your app → Store presence → Main store listing
3. Scroll to **Phone screenshots**
4. Upload screenshots (drag & drop):
   - `01-home-android-phone.png`
   - `02-taxi-android-phone.png`
   - `03-wallet-android-phone.png`
   - `04-auctions-android-phone.png`
5. Reorder if needed (drag & drop)
6. Save changes

**Note:** Google Play supports up to 8 screenshots per device type.

---

## 🔄 Regenerate Screenshots

If you need to update screenshots (e.g., after UI changes):

```bash
cd /app/frontend

# Regenerate all screenshots
yarn screenshots

# Or regenerate specific platform
node scripts/generate-screenshots.js
```

**Prerequisites:**
- App must be running (or use production URL)
- Test account credentials valid
- Playwright installed (`yarn add -D playwright`)

---

## 🎨 Screenshot Quality

**Current Settings:**
- Format: PNG
- Quality: High (no compression)
- Animations: Disabled for consistency
- Scrollbars: Hidden
- Device pixel ratio:
  - iOS: 3x (Retina)
  - Android: 2x

**File Sizes:**
- iOS: ~1-3 MB per screenshot (acceptable)
- Android: ~400-1500 KB per screenshot (acceptable)

---

## ✅ Compliance Check

### iOS App Store Requirements
- [x] Minimum 3 screenshots
- [x] Size: 1290x2796 (iPhone Pro Max)
- [x] Format: PNG or JPG
- [x] No offensive content
- [x] Accurate representation of app
- [x] No placeholder UI

### Google Play Requirements
- [x] Minimum 2 screenshots
- [x] Size: 1080x1920 (Phone)
- [x] Format: PNG or JPG (24-bit)
- [x] Max 8 screenshots
- [x] No graphic violence
- [x] Accurate representation

---

## 🚀 Next Steps

1. **Review screenshots:** Open files in `/app/frontend/public/screenshots/`
2. **Quality check:**
   - Are screenshots clear and high-res?
   - No blurry text?
   - UI looks professional?
3. **Upload to stores:**
   - iOS: App Store Connect
   - Android: Google Play Console
4. **Add captions** (recommended for better conversion)
5. **Test on actual devices** if possible

---

## 📞 Support

If screenshots need adjustments:

**Regenerate with custom settings:**
```javascript
// Edit /app/frontend/scripts/generate-screenshots.js
// Adjust viewport, actions, or add new screens
```

**Common adjustments:**
- Change viewport size
- Add/remove screens
- Adjust wait times
- Customize user flow

---

**Generated:** 2026-05-11 09:47 UTC  
**Script:** `/app/frontend/scripts/generate-screenshots.js`  
**Status:** ✅ Ready for upload
