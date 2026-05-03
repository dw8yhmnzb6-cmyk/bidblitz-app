# BidBlitz Mobile — CI/CD Automation Guide
# GitHub Actions + Fastlane Setup

---

## 1. GitHub Actions Workflow (Android AAB + iOS IPA)

**File:** `.github/workflows/mobile-release.yml`

```yaml
name: Mobile Release Build

on:
  push:
    tags:
      - 'v*.*.*'  # Trigger on version tags (e.g., v1.0.0)
  workflow_dispatch:  # Manual trigger

jobs:
  android-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install dependencies
        working-directory: frontend
        run: yarn install --frozen-lockfile

      - name: Build web assets
        working-directory: frontend
        run: yarn build

      - name: Sync Capacitor
        working-directory: frontend
        run: npx cap sync android

      - name: Decode keystore (from GitHub Secrets)
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > frontend/android/bidblitz-upload.jks

      - name: Create keystore.properties
        working-directory: frontend/android
        run: |
          cat > keystore.properties <<EOF
          storeFile=bidblitz-upload.jks
          storePassword=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          keyAlias=bidblitz
          keyPassword=${{ secrets.ANDROID_KEY_PASSWORD }}
          EOF

      - name: Build Release AAB
        working-directory: frontend/android
        run: ./gradlew bundleRelease

      - name: Upload AAB to Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: android-release-aab
          path: frontend/android/app/build/outputs/bundle/release/app-release.aab

      - name: Upload to Google Play (optional)
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          packageName: com.bidblitz.app
          releaseFiles: frontend/android/app/build/outputs/bundle/release/app-release.aab
          track: internal  # Change to 'production' for public release

  ios-release:
    runs-on: macos-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install CocoaPods
        run: sudo gem install cocoapods

      - name: Install dependencies
        working-directory: frontend
        run: yarn install --frozen-lockfile

      - name: Build web assets
        working-directory: frontend
        run: yarn build

      - name: Sync Capacitor
        working-directory: frontend
        run: npx cap sync ios

      - name: Install CocoaPods dependencies
        working-directory: frontend/ios/App
        run: pod install

      - name: Setup Fastlane
        run: |
          cd frontend/ios
          bundle install

      - name: Build & Upload to TestFlight
        working-directory: frontend/ios
        env:
          FASTLANE_USER: ${{ secrets.APPLE_ID }}
          FASTLANE_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
        run: bundle exec fastlane beta

      - name: Upload IPA to Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ios-release-ipa
          path: frontend/ios/build/BidBlitz.ipa
```

---

## 2. Fastlane Setup (iOS Automation)

**File:** `frontend/ios/Fastfile`

```ruby
default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    # 1. Increment build number
    increment_build_number(
      xcodeproj: "App/App.xcodeproj"
    )

    # 2. Build app
    build_app(
      scheme: "App",
      workspace: "App/App.xcworkspace",
      export_method: "app-store",
      export_options: {
        provisioningProfiles: {
          "com.bidblitz.app" => "match AppStore com.bidblitz.app"
        }
      }
    )

    # 3. Upload to TestFlight
    upload_to_testflight(
      skip_waiting_for_build_processing: true,
      apple_id: ENV["FASTLANE_USER"]
    )

    # 4. Commit version bump
    commit_version_bump(
      message: "Version bump by fastlane",
      xcodeproj: "App/App.xcodeproj"
    )
  end

  desc "Build for App Store release"
  lane :release do
    # 1. Ensure clean git
    ensure_git_status_clean

    # 2. Increment version
    increment_version_number(
      xcodeproj: "App/App.xcodeproj",
      bump_type: "patch"  # or "minor", "major"
    )

    # 3. Build
    build_app(
      scheme: "App",
      workspace: "App/App.xcworkspace",
      export_method: "app-store"
    )

    # 4. Upload to App Store Connect
    upload_to_app_store(
      skip_metadata: false,
      skip_screenshots: false,
      submit_for_review: true,
      automatic_release: false
    )

    # 5. Tag release
    add_git_tag(
      tag: "v#{get_version_number(xcodeproj: 'App/App.xcodeproj')}"
    )

    push_to_git_remote
  end

  desc "Take screenshots"
  lane :screenshots do
    snapshot
  end

  desc "Setup certificates & profiles"
  lane :setup do
    match(type: "appstore", readonly: true)
    match(type: "development", readonly: true)
  end
end
```

**File:** `frontend/ios/Gemfile`

```ruby
source "https://rubygems.org"

gem "fastlane"
gem "cocoapods"
```

---

## 3. GitHub Secrets Setup

Add these secrets in GitHub → Settings → Secrets and variables → Actions:

### Android Secrets:

```bash
# Generate base64-encoded keystore
cat frontend/android/bidblitz-upload.jks | base64 > keystore.txt
# Copy content to GitHub Secret: ANDROID_KEYSTORE_BASE64

# Other secrets:
ANDROID_KEYSTORE_PASSWORD=your_keystore_password
ANDROID_KEY_PASSWORD=your_key_password
```

### iOS Secrets:

```
APPLE_ID=your@apple-id.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
FASTLANE_SESSION=<generate via: fastlane spaceauth>
```

### Google Play Upload (optional):

```
GOOGLE_PLAY_SERVICE_ACCOUNT={"type":"service_account",...}
```

Get from: Google Play Console → Setup → API access → Create service account

---

## 4. Fastlane Installation

```bash
# macOS
sudo gem install fastlane

# Or via Homebrew
brew install fastlane

# Initialize in project
cd frontend/ios
fastlane init
```

---

## 5. Manual Build Commands (Alternative to CI/CD)

### Android:

```bash
cd frontend/android
./generate-keystore.sh  # First time only
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

### iOS:

```bash
cd frontend/ios
bundle install
bundle exec fastlane beta  # TestFlight
# OR
bundle exec fastlane release  # App Store
```

---

## 6. Screenshot Automation (iOS)

**File:** `frontend/ios/Snapfile`

```ruby
devices([
  "iPhone 15 Pro Max",
  "iPhone 15",
  "iPad Pro (12.9-inch)"
])

languages([
  "de-DE",
  "en-US"
])

scheme("App")

output_directory("./screenshots")

clear_previous_screenshots(true)
```

**Generate screenshots:**

```bash
cd frontend/ios
bundle exec fastlane snapshot
```

---

## 7. Version Management

### Bump version via Fastlane:

```bash
# iOS
fastlane run increment_version_number bump_type:patch
fastlane run increment_build_number

# Android (edit manually)
# frontend/android/app/build.gradle
versionCode 2
versionName "1.0.1"
```

---

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| `Keystore tampered` | Wrong password in keystore.properties |
| `Provisioning profile not found` | Run `fastlane match` to sync profiles |
| `CocoaPods install fails` | Run `pod repo update` |
| `GitHub Actions timeout` | Increase timeout in workflow yml |

---

## 9. Release Checklist

- [ ] Version bumped (iOS + Android)
- [ ] Keystore backed up (Android)
- [ ] assetlinks.json deployed to production
- [ ] apple-app-site-association deployed
- [ ] Screenshots prepared (1290×2796, 1242×2688)
- [ ] Privacy policy URL valid
- [ ] GitHub secrets configured
- [ ] Test build uploaded to TestFlight/Internal Testing
- [ ] Release notes written
- [ ] Submit for review

---

## 10. Workflow Trigger

```bash
# Create release tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Build Android AAB
# 2. Build iOS IPA
# 3. Upload to Google Play Internal Track
# 4. Upload to TestFlight
```

---

**✅ CI/CD Setup Complete**

All builds automated via GitHub Actions + Fastlane.
