#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_FILE="$ROOT_DIR/frontend/android/app/build.gradle"
IOS_FILE="$ROOT_DIR/frontend/ios/App/App.xcodeproj/project.pbxproj"

CURRENT_VERSION_NAME="$(python3 - <<'PY'
import pathlib, re
text = pathlib.Path('/app/frontend/android/app/build.gradle').read_text()
match = re.search(r'versionName\s+"([^"]+)"', text)
print(match.group(1) if match else '1.0')
PY
)"

VERSION_NAME="${MOBILE_VERSION_NAME:-$CURRENT_VERSION_NAME}"
BUILD_NUMBER="${MOBILE_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-${CI_PIPELINE_IID:-${BUILD_NUMBER:-}}}}"

if [[ -z "$BUILD_NUMBER" ]]; then
  if [[ -n "${CI:-}" ]]; then
    BUILD_NUMBER="$(date -u +%s)"
  else
    echo "⚠ Keine CI-Buildnummer gefunden — Version bleibt unverändert"
    exit 0
  fi
fi

if ! [[ "$BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "✗ MOBILE_BUILD_NUMBER muss numerisch sein"
  exit 1
fi

python3 - "$ANDROID_FILE" "$IOS_FILE" "$VERSION_NAME" "$BUILD_NUMBER" <<'PY'
import pathlib
import re
import sys

android_file = pathlib.Path(sys.argv[1])
ios_file = pathlib.Path(sys.argv[2])
version_name = sys.argv[3]
build_number = sys.argv[4]

android = android_file.read_text()
android, code_count = re.subn(r'versionCode\s+\d+', f'versionCode {build_number}', android, count=1)
android, name_count = re.subn(r'versionName\s+"[^"]+"', f'versionName "{version_name}"', android, count=1)
if not code_count or not name_count:
    raise SystemExit('Android version fields not found')
android_file.write_text(android)

ios = ios_file.read_text()
ios, build_count = re.subn(r'CURRENT_PROJECT_VERSION = \d+;', f'CURRENT_PROJECT_VERSION = {build_number};', ios)
ios, marketing_count = re.subn(r'MARKETING_VERSION = [^;]+;', f'MARKETING_VERSION = {version_name};', ios)
if build_count < 2 or marketing_count < 2:
    raise SystemExit('iOS version fields not found')
ios_file.write_text(ios)
PY

echo "✓ Mobile-Version gesetzt: ${VERSION_NAME} (${BUILD_NUMBER})"