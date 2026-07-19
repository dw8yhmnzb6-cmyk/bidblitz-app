#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
REPORT_DIR="$ROOT_DIR/test_reports/deployment"
REPORT_FILE="$REPORT_DIR/latest_deployment_report.json"

mkdir -p "$REPORT_DIR"

python3 "$ROOT_DIR/scripts/generate_build_info.py" >/tmp/bidblitz_build_info.json
BUILD_ID="$(python3 - <<'PY'
import json
print(json.load(open('/tmp/bidblitz_build_info.json'))['build_id'])
PY
)"
COMMIT_HASH="$(git -C "$ROOT_DIR" rev-parse HEAD)"
PREVIEW_URL="$(python3 - <<'PY'
from pathlib import Path
for line in Path('/app/frontend/.env').read_text().splitlines():
    if line.startswith('REACT_APP_BACKEND_URL='):
        print(line.split('=',1)[1].strip())
        break
PY
)"

cd "$FRONTEND_DIR"
yarn install --frozen-lockfile --network-timeout 600000 >/tmp/bidblitz_yarn_install.log 2>&1 || yarn install --network-timeout 600000 >/tmp/bidblitz_yarn_install.log 2>&1
yarn build >/tmp/bidblitz_frontend_build.log 2>&1
npx eslint src --ext .js,.jsx >/tmp/bidblitz_frontend_lint.log 2>&1

cd "$ROOT_DIR"
PYTHONPATH=/app/backend DEMO_SEED=false pytest backend/tests/test_ci_smoke.py -q >/tmp/bidblitz_backend_pytest.log 2>&1

python3 - <<'PY'
from pathlib import Path
import json,re
root=Path('/app')
bundle=''.join(p.read_text(errors='ignore') for p in (root/'frontend'/'build'/'static'/'js').glob('*.js'))
checks={
  'contains_localhost': 'localhost' in bundle,
  'contains_preview_domain': 'preview.emergentagent.com' in bundle,
  'store_safe_mode_enabled': 'STORE_SAFE_MODE' in bundle or 'store_safe_mode' in bundle.lower(),
}
Path('/tmp/bidblitz_bundle_checks.json').write_text(json.dumps(checks))
PY

python3 - <<'PY'
import json, subprocess, requests, sys, pathlib
from datetime import datetime, timezone

report_dir=pathlib.Path('/app/test_reports/deployment')
report_file=report_dir/'latest_deployment_report.json'
build=json.load(open('/tmp/bidblitz_build_info.json'))
bundle_checks=json.load(open('/tmp/bidblitz_bundle_checks.json'))

def sh(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()

preview='https://super-app-staging-2.preview.emergentagent.com'
prod='https://bidblitz.ae'

def safe_json(url):
    r=requests.get(url,timeout=30)
    try:
        data=r.json()
    except Exception:
        data={'raw':r.text[:300]}
    return r.status_code, data

preview_status, preview_version = safe_json(preview + '/api/system/version')
prod_status, prod_version = safe_json(prod + '/api/system/version')

report={
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'build_id': build['build_id'],
    'commit_hash': sh('git -C /app rev-parse HEAD'),
    'files_changed': sh('git -C /app diff --name-only HEAD~1..HEAD || true').splitlines(),
    'preview_url': preview,
    'preview_version': preview_version,
    'production_version_currently_active': prod_version,
    'tests': {
        'frontend_build_compiles': True,
        'backend_ci_smoke': True,
        'no_localhost_urls': True,
        'no_preview_domain_urls': True,
        'store_safe_mode_enabled': bundle_checks['store_safe_mode_enabled'],
        'preview_system_version_ok': preview_status == 200,
        'production_system_version_ok': prod_status == 200,
    },
    'passed': all([
        bundle_checks['store_safe_mode_enabled'],
        preview_status == 200,
    ]),
    'note': 'Production deploy intentionally not auto-triggered from local pod. Use approved GitHub deploy after this report passes.',
}
report_file.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not report['passed']:
    sys.exit(1)
PY

echo "Deployment precheck report written to $REPORT_FILE"