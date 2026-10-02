"""Short-lived SSO handoff from the central BidBlitz owner admin.

No password is shared with child projects. The handoff is HMAC-signed, scoped to
one project and expires quickly. Child projects must additionally enforce nonce
single-use.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import APIRouter, HTTPException, Request
from core.security import get_current_user
from routes.admin_projects import _is_platform_owner

router = APIRouter(prefix="/api/admin/sso", tags=["admin-sso"])

SSO_TARGETS = {
    "eyes": "https://eyes.bidblitz.ae/api/auth/bidblitz-sso",
}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _sign(payload: dict, secret: str) -> str:
    body = _b64url(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _b64url(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{signature}"


@router.post("/{project_id}")
async def create_sso_handoff(project_id: str, request: Request):
    user = await get_current_user(request)
    if not _is_platform_owner(user):
        raise HTTPException(status_code=403, detail="Platform owner access required")

    target = SSO_TARGETS.get(project_id)
    if not target:
        raise HTTPException(status_code=404, detail="Project SSO is not connected")

    secret = os.getenv("BIDBLITZ_SSO_SHARED_SECRET", "").strip()
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="Central SSO is not configured")

    now = int(time.time())
    owner_id = os.getenv("BIDBLITZ_OWNER_ID", "bidblitz-owner-primary").strip()
    if not owner_id:
        raise HTTPException(status_code=503, detail="Central owner identity is not configured")

    payload = {
        "iss": "https://bidblitz.ae",
        "aud": project_id,
        "sub": owner_id,
        "email": str(user.get("canonical_email") or user.get("email") or "").strip().lower(),
        "role": "owner",
        "permissions": ["*"],
        "iat": now,
        "exp": now + 60,
        "nonce": secrets.token_urlsafe(24),
    }
    return {
        "project_id": project_id,
        "handoff_url": target,
        "code": _sign(payload, secret),
        "expires_in": 60,
    }
