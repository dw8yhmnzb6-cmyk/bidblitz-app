import os

from fastapi import APIRouter, HTTPException, Request

from core.security import get_current_user
from core.versioning import fetch_remote_json, get_system_version_payload


router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/version")
async def get_system_version(request: Request):
    return get_system_version_payload(request)


@router.get("/compare")
async def compare_system_versions(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    production_base = os.environ.get("SYSTEM_COMPARE_PRODUCTION_URL", "https://bidblitz.ae").rstrip("/")
    preview = get_system_version_payload(request)

    result = {
        "preview": preview,
        "production": None,
        "preview_health": None,
        "production_health": None,
        "comparison": {
            "commit_matches": False,
            "build_matches": False,
        },
    }

    try:
        production = fetch_remote_json(f"{production_base}/api/system/version")
        result["production"] = production
        result["comparison"] = {
            "commit_matches": preview.get("git_commit") == production.get("git_commit"),
            "build_matches": preview.get("build_id") == production.get("build_id"),
        }
    except Exception as exc:
        result["production_error"] = str(exc)

    try:
        result["preview_health"] = fetch_remote_json(f"{preview.get('public_base_url').rstrip('/')}/api/diag/health/probe")
    except Exception as exc:
        result["preview_health_error"] = str(exc)

    try:
        result["production_health"] = fetch_remote_json(f"{production_base}/api/diag/health/probe")
    except Exception as exc:
        result["production_health_error"] = str(exc)

    return result
