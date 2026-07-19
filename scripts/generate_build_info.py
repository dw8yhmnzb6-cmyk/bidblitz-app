#!/usr/bin/env python3
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_BUILD_INFO = ROOT / "backend" / "build_info.json"
FRONTEND_VERSION_INFO = ROOT / "frontend" / "public" / "version.json"


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()
    except Exception:
        return "unknown"


def main() -> int:
    commit = git("rev-parse", "HEAD")
    short_commit = commit[:7] if commit != "unknown" else "unknown"
    branch = git("branch", "--show-current")
    timestamp = datetime.now(timezone.utc).isoformat()
    build_id = f"{short_commit}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    backend_payload = {
        "environment": "preview",
        "frontend_version": build_id,
        "backend_version": "2.0.0",
        "git_commit": commit,
        "git_branch": branch,
        "build_id": build_id,
        "deployed_at": timestamp,
        "api_base_url": "https://super-app-staging-2.preview.emergentagent.com",
        "public_base_url": "https://super-app-staging-2.preview.emergentagent.com",
        "service_worker_version": "bidblitz-static-v16",
        "api_cache_version": "bidblitz-api-v16",
    }
    frontend_payload = {
        **backend_payload,
        "frontend_version": build_id,
    }

    BACKEND_BUILD_INFO.write_text(json.dumps(backend_payload, indent=2) + "\n")
    FRONTEND_VERSION_INFO.write_text(json.dumps(frontend_payload, indent=2) + "\n")
    print(json.dumps({"backend": str(BACKEND_BUILD_INFO), "frontend": str(FRONTEND_VERSION_INFO), "build_id": build_id}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())