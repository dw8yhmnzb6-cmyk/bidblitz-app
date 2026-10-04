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
# Only audited receivers may receive an owner credential. Catalogue URLs are never used.
SSO_TARGETS = {
    name: {"handoff_url": f"https://{name}.bidblitz.ae/api/auth/bidblitz-sso",
           "browser_url": f"https://{name}.bidblitz.ae/auth/bidblitz-sso", "mode": "redirect"}
    for name in ("eyes", "trade", "nex", "stack")
}
SSO_ADAPTERS = frozenset((*SSO_TARGETS, "aion", "verify", "bidtax", "conformexa"))


def sso_targets():
    targets = dict(SSO_TARGETS)
    for name, endpoint in (("aion", "/api/auth/bidblitz-sso"), ("verify", "/v1/auth/bidblitz-sso"), ("bidtax", "/api/auth/bidblitz-sso"), ("conformexa", "/v1/platform/admin/bidblitz-sso")):
        base = os.getenv(f"BIDBLITZ_{name.upper()}_BASE_URL", "").strip().rstrip("/")
        if not base:
            continue
        from urllib.parse import urlsplit
        try:
            url = urlsplit(base)
            special_host = (
                name == "bidtax" and (url.hostname == "bid-tax.com" or url.hostname.endswith(".bid-tax.com"))
            ) or (
                name == "conformexa" and (url.hostname in {"conformexa.com", "conformexa.de"}
                or url.hostname.endswith(".conformexa.com") or url.hostname.endswith(".conformexa.de"))
            )
            valid = (url.scheme == "https" and url.hostname and
                     (url.hostname.endswith(".bidblitz.ae") or special_host) and not url.username and
                     not url.password and url.port in (None, 443) and
                     not url.path and not url.query and not url.fragment and
                     not any(ord(c) <= 32 or c == "\\" for c in base))
        except ValueError:
            valid = False
        if valid:
            targets[name] = {"handoff_url": base + endpoint,
                             "browser_url": base + "/auth/bidblitz-sso", "mode": "redirect"}
    return targets


def sso_configuration(project_id):
    specific = os.getenv(f"BIDBLITZ_SSO_{project_id.upper()}_SECRET")
    secret = (specific if specific is not None else os.getenv("BIDBLITZ_SSO_SHARED_SECRET", "")).strip()
    owner_id = os.getenv("BIDBLITZ_OWNER_ID", "bidblitz-owner-primary").strip()
    enabled = os.getenv(f"BIDBLITZ_SSO_{project_id.upper()}_ENABLED", "false").strip().lower() in {"true", "1", "yes"}
    target_configured = project_id in sso_targets()
    secret_configured = len(secret) >= 32
    owner_configured = bool(owner_id)
    return {"configured": enabled and target_configured and secret_configured and owner_configured,
            "secret": secret, "owner_id": owner_id, "enabled": enabled,
            "target_configured": target_configured, "secret_configured": secret_configured,
            "owner_configured": owner_configured,
            "secret_source": "project" if specific is not None else "legacy" if secret else "missing"}


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
    target = sso_targets().get(project_id)
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
