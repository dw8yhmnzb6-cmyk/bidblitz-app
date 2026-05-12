# BidBlitz Staff Mobile App

## Setup Native Apps

### iOS
```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

### Android
```bash
npx cap add android
npx cap sync android
npx cap open android
```

### Build for Production
```bash
# Frontend build
cd frontend
yarn build

# Sync to native
cd ..
npx cap sync

# Open in Xcode/Android Studio
npx cap open ios
npx cap open android
```

## Features
- Push Notifications (OneSignal)
- Geolocation (GPS Check-in)
- Camera (QR Scanner)
- Offline Support (Coming Soon)

## App Store Submission
- iOS: Requires Apple Developer Account ($99/year)
- Android: Requires Google Play Developer Account ($25 one-time)
