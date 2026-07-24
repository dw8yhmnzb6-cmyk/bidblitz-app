#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

grep -q '^REACT_APP_BACKEND_URL=https://bidblitz.ae$' "$ROOT/.env.production"
grep -q '^REACT_APP_STORE_SAFE_MODE=true$' "$ROOT/.env.production"
grep -q '^REACT_APP_DEMO_MODE=false$' "$ROOT/.env.production"
grep -q '^REACT_APP_MOCK_PAYMENTS=false$' "$ROOT/.env.production"
grep -q '^REACT_APP_ENABLE_IN_APP_UPDATES=false$' "$ROOT/.env.production"
grep -q 'applicationId "com.bidblitz.app"' "$ROOT/android/app/build.gradle"
grep -q 'versionCode 3' "$ROOT/android/app/build.gradle"
grep -q 'versionName "1.0.0"' "$ROOT/android/app/build.gradle"
grep -q '<string name="package_name">com.bidblitz.app</string>' "$ROOT/android/app/src/main/res/values/strings.xml"
grep -q 'PRODUCT_BUNDLE_IDENTIFIER = com.bidblitz.app;' "$ROOT/ios/App/App.xcodeproj/project.pbxproj"
grep -q 'MARKETING_VERSION = 1.0.0;' "$ROOT/ios/App/App.xcodeproj/project.pbxproj"

echo "Sanity-Check OK"