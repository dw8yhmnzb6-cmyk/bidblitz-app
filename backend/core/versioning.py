import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

BACKEND_BUILD_INFO_PATH = BACKEND_DIR / "build_info.json"
FRONTEND_VERSION_PATHS = [
    FRONTEND_DIR / "build" / "version.json",
    Path("/var/www/bidblitz/frontend/build/version.json"),
    FRONTEND_DIR / "public" / "version.json",
]


def _read_json(path: Path) -> dict[str, Any]:
    try:
        if path.exists():
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                return data
    except Exception:
        return {}
    return {}


def _first_json(paths: list[Path]) -> dict[str, Any]:
    for path in paths:
        data = _read_json(path)
        if data:
            return data
    return {}


def _git_output(*args: str) -> str:
    try:
        return subprocess.check_output(["git", "-C", str(ROOT_DIR), *args], text=True).strip()
    except Exception:
        return ""


def _infer_environment(host: str, api_base_url: str, build_info: dict[str, Any]) -> str:
    explicit = str(build_info.get("environment") or "").strip()
    if explicit:
        return explicit
    marker = f"{host} {api_base_url}".lower()
    if "bidblitz.ae" in marker:
        return "production"
    if "preview.emergentagent.com" in marker:
        return "preview"
    return os.environ.get("APP_ENV") or "development"


def get_system_version_payload(request=None) -> dict[str, Any]:
    build_info = _read_json(BACKEND_BUILD_INFO_PATH)
    frontend_info = _first_json(FRONTEND_VERSION_PATHS)

    git_commit = build_info.get("git_commit") or frontend_info.get("git_commit") or _git_output("rev-parse", "HEAD") or "unknown"
    git_branch = build_info.get("git_branch") or frontend_info.get("git_branch") or _git_output("branch", "--show-current") or "unknown"
    deployed_at = build_info.get("deployed_at") or frontend_info.get("deployed_at")
    build_id = build_info.get("build_id") or frontend_info.get("build_id") or (git_commit[:7] if git_commit != "unknown" else "unknown")

    if request is not None:
        api_base_url = str(request.base_url).rstrip("/")
        host = request.url.hostname or ""
    else:
        api_base_url = str(build_info.get("api_base_url") or frontend_info.get("api_base_url") or os.environ.get("PUBLIC_BASE_URL") or os.environ.get("FRONTEND_URL") or "").rstrip("/")
        host = ""

    environment = _infer_environment(host, api_base_url, build_info or frontend_info)
    backend_version = str(build_info.get("backend_version") or "2.0.0")
    frontend_version = str(frontend_info.get("frontend_version") or build_info.get("frontend_version") or build_id)
    service_worker_version = frontend_info.get("service_worker_version") or "bidblitz-static-v16"
    api_cache_version = frontend_info.get("api_cache_version") or "bidblitz-api-v16"

    return {
        "environment": environment,
        "frontend_version": frontend_version,
        "backend_version": backend_version,
        "git_commit": git_commit,
        "git_branch": git_branch,
        "build_id": build_id,
        "deployed_at": deployed_at,
        "api_base_url": api_base_url,
        "public_base_url": str(build_info.get("public_base_url") or frontend_info.get("public_base_url") or os.environ.get("PUBLIC_BASE_URL") or os.environ.get("FRONTEND_URL") or "").rstrip("/"),
        "frontend_url": str(os.environ.get("FRONTEND_URL") or "").rstrip("/"),
        "service_worker_version": service_worker_version,
        "api_cache_version": api_cache_version,
        "store_safe_mode": True,
        "test_mode": str(os.environ.get("TEST_MODE") or os.environ.get("REACT_APP_TEST_MODE") or "").lower() == "true",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
