#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "test_reports" / "deployment"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

ROUTES = [
    "/",
    "/login",
    "/wallet",
    "/scan",
    "/merchant",
    "/legal/datenschutz",
    "/legal/agb",
    "/support-chat",
]


def fetch_text(url: str):
    response = requests.get(url, timeout=30)
    return response.status_code, response.text


def fetch_json(url: str):
    response = requests.get(url, timeout=30)
    try:
        payload = response.json()
    except Exception:
        payload = {"raw": response.text[:300]}
    return response.status_code, payload


def main() -> int:
    production_base = "https://bidblitz.ae"
    preview_base = "https://super-app-staging-2.preview.emergentagent.com"

    preview_version_status, preview_version = fetch_json(preview_base + "/api/system/version")
    prod_version_status, prod_version = fetch_json(production_base + "/api/system/version")

    route_results = []
    has_preview_domain = False
    for route in ROUTES:
        status, html = fetch_text(production_base + route)
        route_results.append({
            "route": route,
            "status": status,
            "contains_build_id": str(prod_version.get("build_id") or "") in html,
            "contains_preview_domain": "preview.emergentagent.com" in html,
        })
        if route == "/":
            has_preview_domain = has_preview_domain or ("preview.emergentagent.com" in html)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "preview_version_status": preview_version_status,
        "production_version_status": prod_version_status,
        "preview_version": preview_version,
        "production_version": prod_version,
        "routes": route_results,
        "commit_matches": preview_version.get("git_commit") == prod_version.get("git_commit"),
        "build_matches": preview_version.get("build_id") == prod_version.get("build_id"),
        "preview_domain_found_in_live": has_preview_domain,
    }
    (REPORT_DIR / "live_verification.json").write_text(json.dumps(payload, indent=2))
    print(json.dumps(payload, indent=2))
    return 0 if payload["commit_matches"] and payload["build_matches"] and not has_preview_domain else 3


if __name__ == "__main__":
    raise SystemExit(main())