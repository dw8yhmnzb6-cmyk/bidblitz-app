#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://bidblitz.ae}"
BASE_URL="${BASE_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

fetch() {
  local name="$1"
  local path="$2"
  curl -fsS \
    -D "$TMP_DIR/${name}.headers" \
    -o "$TMP_DIR/${name}.body" \
    "${BASE_URL}${path}"
}

header_value() {
  local name="$1"
  local header="$2"
  awk -v key="$header" '
    BEGIN { IGNORECASE=1 }
    $0 ~ "^" key ":" {
      sub(/^[^:]+:[[:space:]]*/, "")
      gsub(/\r$/, "")
      value=$0
    }
    END { print value }
  ' "$TMP_DIR/${name}.headers"
}

require_no_store() {
  local name="$1"
  local path="$2"
  fetch "$name" "$path"
  local cc
  cc="$(header_value "$name" 'Cache-Control')"
  [[ "${cc,,}" == *"no-store"* ]] || fail "${path} must include Cache-Control: no-store (got: ${cc:-<missing>})"
  echo "PASS ${path} -> ${cc}"
}

require_revalidate() {
  local name="$1"
  local path="$2"
  fetch "$name" "$path"
  local cc
  cc="$(header_value "$name" 'Cache-Control')"
  if [[ "${cc,,}" != *"no-cache"* && "${cc,,}" != *"must-revalidate"* ]]; then
    fail "${path} must revalidate (got: ${cc:-<missing>})"
  fi
  echo "PASS ${path} -> ${cc}"
}

require_no_store root '/'
require_no_store index '/index.html'
require_no_store version '/version.json'
require_no_store sw '/service-worker.js'
require_revalidate manifest '/manifest.json'

BUILD_ID="$(python3 - "$TMP_DIR/version.body" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
build_id = str(payload.get('build_id') or '').strip()
if not build_id:
    raise SystemExit('version.json has no build_id')
print(build_id)
PY
)"

SW_BUILD_ID="$(python3 - "$TMP_DIR/sw.body" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
match = re.search(r"const EMBEDDED_BUILD_ID = '([^']+)';\s*// BUILD_ID_INJECTED", text)
if not match:
    raise SystemExit('service-worker.js has no embedded build id')
print(match.group(1))
PY
)"

[[ "$SW_BUILD_ID" == "$BUILD_ID" ]] || fail "service-worker build id (${SW_BUILD_ID}) != version.json build id (${BUILD_ID})"
echo "PASS service-worker build id matches version.json: ${BUILD_ID}"

STATIC_PATH="$(python3 - "$TMP_DIR/index.body" <<'PY'
import re
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text()
match = re.search(r'(?:src|href)=["\'](/static/[^"\']+\.(?:js|css))["\']', html)
if not match:
    raise SystemExit('index.html has no /static/ JS/CSS asset')
print(match.group(1))
PY
)"

fetch static "$STATIC_PATH"
STATIC_CC="$(header_value static 'Cache-Control')"
[[ "${STATIC_CC,,}" == *"immutable"* ]] || fail "${STATIC_PATH} must be immutable (got: ${STATIC_CC:-<missing>})"
[[ "${STATIC_CC,,}" == *"max-age="* ]] || fail "${STATIC_PATH} must have max-age (got: ${STATIC_CC:-<missing>})"
echo "PASS ${STATIC_PATH} -> ${STATIC_CC}"

echo "Cache policy verified successfully for ${BASE_URL} (build ${BUILD_ID})."
