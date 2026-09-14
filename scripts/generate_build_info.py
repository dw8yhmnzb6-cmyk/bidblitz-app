#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_BUILD_INFO = ROOT / "backend" / "build_info.json"
FRONTEND_VERSION_INFO = ROOT / "frontend" / "public" / "version.json"
FRONTEND_SERVICE_WORKER = ROOT / "frontend" / "public" / "service-worker.js"
SERVICE_WORKER_BUILD_MARKER = "// BUILD_ID_INJECTED"
BUILD_ID_FILE = Path("/tmp/bidblitz_build_id.txt")


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()
    except Exception:
        return "unknown"


def resolve_build_id(short_commit: str) -> str:
    explicit_build_id = os.environ.get("BUILD_ID", "").strip()
    if explicit_build_id:
        return explicit_build_id

    if BUILD_ID_FILE.exists():
        file_build_id = BUILD_ID_FILE.read_text().strip()
        if file_build_id:
            return file_build_id

    react_build_id = os.environ.get("REACT_APP_BUILD_ID", "").strip()
    if react_build_id:
        return react_build_id

    return f"{short_commit}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"


def inject_service_worker_build_id(build_id: str) -> str:
    safe_build_id = re.sub(r"[^a-zA-Z0-9._-]", "_", build_id)[:120] or "unversioned"
    source = FRONTEND_SERVICE_WORKER.read_text()
    pattern = (
        r"const EMBEDDED_BUILD_ID = '[^']*';\s*"
        + re.escape(SERVICE_WORKER_BUILD_MARKER)
    )
    replacement = (
        f"const EMBEDDED_BUILD_ID = '{safe_build_id}'; "
        f"{SERVICE_WORKER_BUILD_MARKER}"
    )
    updated, count = re.subn(pattern, replacement, source, count=1)
    if count != 1:
        raise RuntimeError(
            "service-worker.js is missing the BUILD_ID_INJECTED marker; "
            "refusing to create a production build with an unversioned worker"
        )
    FRONTEND_SERVICE_WORKER.write_text(updated)
    return safe_build_id


def main() -> int:
    commit = git("rev-parse", "HEAD")
    short_commit = commit[:7] if commit != "unknown" else "unknown"
    branch = git("branch", "--show-current")
    timestamp = datetime.now(timezone.utc).isoformat()
    build_id = resolve_build_id(short_commit)
    environment = os.environ.get("BUILD_ENVIRONMENT", "preview")
    api_base_url = os.environ.get("BUILD_API_BASE_URL", "https://super-app-staging-2.preview.emergentagent.com")
    public_base_url = os.environ.get("BUILD_PUBLIC_BASE_URL", api_base_url)
    backend_version = os.environ.get("BUILD_BACKEND_VERSION", "2.0.0")
    frontend_version = os.environ.get("BUILD_FRONTEND_VERSION", build_id)
    service_worker_version = os.environ.get("BUILD_SERVICE_WORKER_VERSION", f"bidblitz-static-{build_id}")
    api_cache_version = os.environ.get("BUILD_API_CACHE_VERSION", f"bidblitz-api-{build_id}")
    embedded_service_worker_build_id = inject_service_worker_build_id(build_id)

    backend_payload = {
        "environment": environment,
        "frontend_version": frontend_version,
        "backend_version": backend_version,
        "git_commit": commit,
        "git_branch": branch,
        "build_id": build_id,
        "deployed_at": timestamp,
        "api_base_url": api_base_url,
        "public_base_url": public_base_url,
        "service_worker_version": service_worker_version,
        "api_cache_version": api_cache_version,
        "service_worker_build_id": embedded_service_worker_build_id,
    }
    frontend_payload = {
        **backend_payload,
        "frontend_version": frontend_version,
    }

    BACKEND_BUILD_INFO.write_text(json.dumps(backend_payload, indent=2) + "\n")
    FRONTEND_VERSION_INFO.write_text(json.dumps(frontend_payload, indent=2) + "\n")
    print(json.dumps({"backend": str(BACKEND_BUILD_INFO), "frontend": str(FRONTEND_VERSION_INFO), "build_id": build_id, "service_worker_build_id": embedded_service_worker_build_id}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
