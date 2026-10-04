"""Short-lived, audience-bound owner handoffs to integrated projects.

Receivers must verify issuer/audience/expiry and atomically consume the nonce.
The editable catalogue can never change a credential handoff destination.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import APIRouter, HTTPException, Request, Response
from routes.admin_projects import require_owner, require_admin_write, get_project

router = APIRouter(prefix="/api/admin/sso", tags=["admin-sso"])
SSO_TARGETS = {
    "eyes": {"handoff_url": "https://eyes.bidblitz.ae/api/auth/bidblitz-sso",
             "browser_url": "https://eyes.bidblitz.ae", "mode": "exchange"},
    "trade": {"handoff_url": "https://trade.bidblitz.ae/api/auth/bidblitz-sso",
              "browser_url": "https://trade.bidblitz.ae/auth/bidblitz-sso", "mode": "redirect"},
}


def sso_configuration(project_id):
    specific = os.getenv(f"BIDBLITZ_SSO_{project_id.upper()}_SECRET")
    secret = (specific if specific is not None else os.getenv("BIDBLITZ_SSO_SHARED_SECRET", "")).strip()
    owner_id = os.getenv("BIDBLITZ_OWNER_ID", "bidblitz-owner-primary").strip()
    return {"configured": project_id in SSO_TARGETS and len(secret) >= 32 and bool(owner_id),
            "secret": secret, "owner_id": owner_id}


def _b64url(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _sign(payload, secret):
    body = _b64url(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _b64url(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{signature}"


@router.post("/{project_id}")
async def create_sso_handoff(project_id: str, request: Request, response: Response):
    user = await require_owner(request)
    require_admin_write(request)
    target = SSO_TARGETS.get(project_id)
    if not target:
        raise HTTPException(404, "Zentrale Anmeldung ist für dieses Projekt noch nicht angebunden.")
    project = await get_project(project_id)
    if not project or project["status"] not in {"active", "dev"}:
        raise HTTPException(403, "Dieses Projekt ist für die zentrale Anmeldung deaktiviert.")
    config = sso_configuration(project_id)
    if not config["configured"]:
        raise HTTPException(503, "Zentrale Anmeldung ist noch nicht konfiguriert.")
    now = int(time.time())
    payload = {"iss": "https://bidblitz.ae", "aud": project_id, "sub": config["owner_id"],
               "email": user["email"].strip().lower(), "role": "owner", "permissions": ["*"],
               "iat": now, "exp": now + 60, "nonce": secrets.token_urlsafe(24)}
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Referrer-Policy"] = "no-referrer"
    return {"project_id": project_id, **target, "code": _sign(payload, config["secret"]), "expires_in": 60}
