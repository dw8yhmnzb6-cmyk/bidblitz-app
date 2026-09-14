#!/usr/bin/env python3
"""Strict post-deploy verification for the BidBlitz web frontend.

This check intentionally uses only the Python standard library so it can run on
GitHub Actions without installing extra packages. It verifies the exact pieces
that let customers move from an old frontend build to a new one automatically:

- app-shell/update files are never stored by HTTP caches;
- a hashed /static/ asset remains long-lived and immutable;
- index.html, version.json and service-worker.js expose one identical build id;
- the live build can optionally be required to equal the build just deployed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "test_reports" / "deployment" / "live_verification.json"
APP_SHELL_PATHS = ("/", "/index.html", "/version.json", "/service-worker.js")
STATIC_MAX_AGE_MIN = 31_536_000


def cache_busted(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["__bbv"] = str(int(time.time() * 1000))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def fetch(url: str, *, bust_cache: bool = False) -> dict[str, Any]:
    request_url = cache_busted(url) if bust_cache else url
    request = Request(
        request_url,
        headers={
            "User-Agent": "BidBlitz-Live-Verify/1.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {
                "url": request_url,
                "status": response.status,
                "headers": {key.lower(): value for key, value in response.headers.items()},
                "body": body,
            }
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return {
            "url": request_url,
            "status": error.code,
            "headers": {key.lower(): value for key, value in error.headers.items()},
            "body": body,
            "error": str(error),
        }
    except URLError as error:
        return {
            "url": request_url,
            "status": 0,
            "headers": {},
            "body": "",
            "error": str(error),
        }


def cache_control(response: dict[str, Any]) -> str:
    return response.get("headers", {}).get("cache-control", "").lower()


def extract_meta_build_id(html: str) -> str:
    tag_match = re.search(
        r"<meta\b[^>]*\bname=[\"']bidblitz-build-version[\"'][^>]*>",
        html,
        flags=re.IGNORECASE,
    )
    if not tag_match:
        return ""
    content_match = re.search(
        r"\bcontent=[\"']([^\"']+)[\"']",
        tag_match.group(0),
        flags=re.IGNORECASE,
    )
    return content_match.group(1).strip() if content_match else ""


def extract_worker_build_id(worker: str) -> str:
    match = re.search(
        r"const\s+EMBEDDED_BUILD_ID\s*=\s*[\"']([^\"']+)[\"']\s*;\s*//\s*BUILD_ID_INJECTED",
        worker,
    )
    return match.group(1).strip() if match else ""


def extract_static_asset(html: str) -> str:
    candidates = re.findall(
        r"(?:src|href)=[\"']([^\"']*/static/[^\"']+)[\"']",
        html,
        flags=re.IGNORECASE,
    )
    for candidate in candidates:
        if re.search(r"\.(?:js|css)(?:\?|$)", candidate, flags=re.IGNORECASE):
            return candidate
    return candidates[0] if candidates else ""


def max_age_seconds(value: str) -> int | None:
    match = re.search(r"(?:^|,)\s*max-age\s*=\s*(\d+)", value, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def add_check(checks: list[dict[str, Any]], name: str, passed: bool, detail: str) -> None:
    checks.append({"name": name, "passed": bool(passed), "detail": detail})
    print(f"{'PASS' if passed else 'FAIL'}  {name}: {detail}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify live BidBlitz frontend deployment")
    parser.add_argument("--base-url", default="https://bidblitz.ae")
    parser.add_argument("--expected-build-id", default="")
    parser.add_argument("--expected-commit", default="")
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    checks: list[dict[str, Any]] = []

    responses: dict[str, dict[str, Any]] = {}
    for path in APP_SHELL_PATHS:
        url = base_url + (path if path != "/" else "/")
        response = fetch(url, bust_cache=True)
        responses[path] = response
        add_check(
            checks,
            f"{path} returns HTTP 200",
            response["status"] == 200,
            f"HTTP {response['status']}",
        )
        cc = cache_control(response)
        add_check(
            checks,
            f"{path} is no-store",
            "no-store" in cc,
            cc or "Cache-Control missing",
        )

    index_html = responses["/index.html"]["body"]
    version_body = responses["/version.json"]["body"]
    worker_body = responses["/service-worker.js"]["body"]

    try:
        version_json = json.loads(version_body)
    except json.JSONDecodeError as error:
        version_json = {}
        add_check(checks, "version.json is valid JSON", False, str(error))
    else:
        add_check(checks, "version.json is valid JSON", True, "valid JSON")

    version_build_id = str(version_json.get("build_id") or "").strip()
    index_build_id = extract_meta_build_id(index_html)
    worker_build_id = extract_worker_build_id(worker_body)

    add_check(checks, "index exposes build id", bool(index_build_id), index_build_id or "missing")
    add_check(checks, "version.json exposes build id", bool(version_build_id), version_build_id or "missing")
    add_check(checks, "service worker exposes embedded build id", bool(worker_build_id), worker_build_id or "missing")

    identity_values = [index_build_id, version_build_id, worker_build_id]
    identity_matches = all(identity_values) and len(set(identity_values)) == 1
    add_check(
        checks,
        "index/version/service-worker build ids match",
        identity_matches,
        f"index={index_build_id or '-'} version={version_build_id or '-'} sw={worker_build_id or '-'}",
    )

    if args.expected_build_id:
        add_check(
            checks,
            "live build equals deployed build",
            identity_matches and version_build_id == args.expected_build_id,
            f"live={version_build_id or '-'} expected={args.expected_build_id}",
        )

    if args.expected_commit:
        expected_prefix = args.expected_commit.strip()[:7]
        add_check(
            checks,
            "live build belongs to expected commit",
            bool(version_build_id) and version_build_id.startswith(expected_prefix),
            f"live={version_build_id or '-'} expected-prefix={expected_prefix}",
        )

    static_asset = extract_static_asset(index_html)
    add_check(checks, "index references a hashed static asset", bool(static_asset), static_asset or "missing")
    if static_asset:
        static_response = fetch(urljoin(base_url + "/", static_asset), bust_cache=False)
        static_cc = cache_control(static_response)
        static_max_age = max_age_seconds(static_cc)
        add_check(
            checks,
            "static asset returns HTTP 200",
            static_response["status"] == 200,
            f"HTTP {static_response['status']}",
        )
        add_check(
            checks,
            "static asset is immutable",
            "immutable" in static_cc,
            static_cc or "Cache-Control missing",
        )
        add_check(
            checks,
            "static asset has long max-age",
            static_max_age is not None and static_max_age >= STATIC_MAX_AGE_MIN,
            f"max-age={static_max_age}" if static_max_age is not None else static_cc or "max-age missing",
        )

    preview_leak = "preview.emergentagent.com" in index_html or "preview.emergentagent.com" in worker_body
    add_check(
        checks,
        "live app shell contains no preview domain",
        not preview_leak,
        "clean" if not preview_leak else "preview.emergentagent.com found",
    )

    failed = [check for check in checks if not check["passed"]]
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "expected_build_id": args.expected_build_id or None,
        "expected_commit": args.expected_commit or None,
        "live_build_id": version_build_id or None,
        "index_build_id": index_build_id or None,
        "service_worker_build_id": worker_build_id or None,
        "static_asset": static_asset or None,
        "checks": checks,
        "passed": not failed,
        "failed_checks": [check["name"] for check in failed],
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\nLive verification: {len(checks) - len(failed)}/{len(checks)} checks passed.")
    print(f"Report: {report_path}")
    if failed:
        print("Deployment verification FAILED.", file=sys.stderr)
        return 3
    print("Deployment verification PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
