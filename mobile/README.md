# 🚀 BidBlitz V2 Mobile App (React Native)

## 📱 Platform Support
- ✅ iOS 13.0+
- ✅ Android 6.0+ (API 23+)

## 🎯 Features
- 🛍️ Penny Auctions mit Live-Bidding
- 💰 Wallet (Apple Pay, Google Pay, Cards)
- 🔔 Push Notifications (Wins, Outbid, Auction Ending)
- 🚖 Taxi/Driver Module
- 📊 SMM Boost Services
- 🎮 Arcade Hub
- 🗺️ Friends Map (Location Sharing)
- 💳 Virtual Cards, Credit System
- 👶 Kids Mode
- 📦 50+ Super App Services

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- React Native CLI
- Xcode 15+ (for iOS)
- Android Studio (for Android)
- CocoaPods (for iOS dependencies)

### Installation

```bash
# Install dependencies
cd /app/mobile
npm install

# iOS specific
cd ios && pod install && cd ..

# Android - no extra steps needed

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## 🔧 Configuration

### Backend API
Edit `src/config/api.js`:
```javascript
export const API_URL = 'https://bidblitz.ae/api';
```

### Stripe Keys
Edit `src/config/stripe.js`:
```javascript
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_...';
```

### Firebase (Push Notifications)
1. Download `google-services.json` (Android) → Place in `android/app/`
2. Download `GoogleService-Info.plist` (iOS) → Place in `ios/BidBlitzMobile/`

## 📦 Build for Production

### Android APK/AAB
```bash
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk

./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

### iOS IPA
```bash
# Open Xcode
open ios/BidBlitzMobile.xcworkspace

# Select "Any iOS Device"
# Product → Archive
# Distribute App → App Store Connect
```

## 🏪 Store Submission

### Apple App Store
1. Create App in App Store Connect
2. Upload IPA via Xcode or Transporter
3. Fill App Information (Screenshots, Description)
4. Submit for Review

### Google Play Store
1. Create App in Google Play Console
2. Upload AAB
3. Fill Store Listing
4. Submit for Review

## 📸 Required Assets

### App Icon
- iOS: 1024x1024 PNG (no transparency)
- Android: 512x512 PNG

### Screenshots
- iPhone 6.5": 1284x2778 (6-10 images)
- iPhone 5.5": 1242x2208
- Android Phone: 1080x1920 (2-8 images)
- Android Tablet: 1200x1920 (optional)

## 🔐 Certificates & Signing

### iOS
- Apple Developer Certificate (Distribution)
- Provisioning Profile (App Store)
- Configure in Xcode → Signing & Capabilities

### Android
- Keystore file (`bidblitz-release.keystore`)
- Configured in `android/gradle.properties`

## 📄 Privacy & Legal

Required Documents:
- Privacy Policy URL
- Terms of Service URL
- Support URL
- Contact Email

## 🚀 Timeline
- ✅ Day 1-2: Core App Development
- ✅ Day 3: Native Features (Payments, Push)
- ✅ Day 4: Testing & Bug Fixes
- ⏳ Day 5: Store Submission Prep
- ⏳ Day 6-7: Developer Account Setup
- ⏳ Day 8: Submit to Stores
- ⏳ Day 9-12: Store Review (1-3 days typical)

## 🆘 Troubleshooting

### Build Errors (iOS)
```bash
cd ios && pod deintegrate && pod install
```

### Build Errors (Android)
```bash
cd android && ./gradlew clean
```

### Metro Bundler Issues
```bash
npx react-native start --reset-cache
```

## 📞 Support
- Backend API: https://bidblitz.ae/api
- Email: support@bidblitz.com
