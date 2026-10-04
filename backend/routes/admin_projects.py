"""Central BidBlitz admin project registry.

This endpoint exposes only non-secret navigation metadata. Project authentication
remains isolated until each project has been connected to BidBlitz ID/SSO.
"""
import os

from fastapi import APIRouter, HTTPException, Request
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/projects", tags=["admin-projects"])

def _normalized_email(value: str | None) -> str:
    return (value or "").strip().lower().replace("@bid-blitz.", "@bidblitz.").replace("@bitblitz.", "@bidblitz.")


def _is_platform_owner(user: dict) -> bool:
    # Authority belongs to the canonical admin record. Login aliases may identify
    # that same record, but an alias never grants admin authority to another user.
    if user.get("role") != "admin":
        return False

    canonical_owner = _normalized_email(
        os.getenv("BIDBLITZ_CANONICAL_OWNER_EMAIL", "admin@bidblitz.ae")
    )
    canonical_identity = _normalized_email(
        user.get("canonical_email") or user.get("email")
    )
    if canonical_identity != canonical_owner:
        return False

    configured_aliases = {
        _normalized_email(value)
        for value in os.getenv("BIDBLITZ_OWNER_EMAILS", canonical_owner).split(",")
        if value.strip()
    }
    identities = {
        _normalized_email(user.get("email")),
        _normalized_email(user.get("canonical_email")),
        _normalized_email(user.get("login_email")),
        *[_normalized_email(value) for value in (user.get("email_aliases") or [])],
    }
    return canonical_owner in configured_aliases and canonical_owner in identities


def _flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _project_sso_ready(project_id: str) -> bool:
    if project_id == "bidblitz":
        return True
    if len(os.getenv("BIDBLITZ_SSO_SHARED_SECRET", "").strip()) < 32:
        return False
    flags = {
        "eyes": "BIDBLITZ_SSO_EYES_ENABLED",
        "trade": "BIDBLITZ_SSO_TRADE_ENABLED",
        "aion": "BIDBLITZ_SSO_AION_ENABLED",
    }
    flag = flags.get(project_id)
    if not flag or not _flag(flag):
        return False
    if project_id == "aion" and not os.getenv("BIDBLITZ_AION_BASE_URL", "").strip():
        return False
    return True


PROJECTS = [
    {"id":"bidblitz","name":"BidBlitz","description":"Super App & Haupt-Admin","url":"/admin","admin_url":"/admin","status":"connected","sso":True},
    {"id":"eyes","name":"Eyes.BidBlitz","description":"Face Search","url":"https://eyes.bidblitz.ae","admin_url":"https://eyes.bidblitz.ae","status":"online","sso":False},
    {"id":"trade","name":"Trade BidBlitz","description":"Trading Dashboard","url":"https://trade.bidblitz.ae","admin_url":"https://trade.bidblitz.ae","status":"online","sso":False},
    {"id":"nex","name":"BidBlitz NEX","description":"AI Workflow Plattform","url":"https://nex.bidblitz.ae","admin_url":"https://nex.bidblitz.ae","status":"online","sso":False},
    {"id":"stack","name":"BidBlitz Stack","description":"Infrastruktur & Developer Stack","url":"https://stack.bidblitz.ae","admin_url":"https://stack.bidblitz.ae","status":"dev","sso":False},
    {"id":"aion","name":"AION","description":"KI-Assistent & Brain","url":None,"admin_url":None,"status":"pending","sso":False,"adapter":"prepared"},
    {"id":"power","name":"Power BidBlitz","description":"Powerbank Sharing","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"charging","name":"Charging.BidBlitz","description":"Charging Zubehör","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"verify","name":"BidBlitz Verify","description":"Identitätsprüfung","url":None,"admin_url":None,"status":"pending","sso":False,"adapter":"sandbox-prepared"},
    {"id":"passport","name":"BidBlitz Passport","description":"Digital Product Passport","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"games","name":"Game.BidBlitz","description":"Games Plattform","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"iptv","name":"BidBlitz IPTV","description":"TV & Streaming Plattform","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"the-eye","name":"The Eye","description":"Global Intelligence Dashboard","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"veysca","name":"VEYSCA","description":"Security & Web Risk","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"conformexa","name":"Conformexa","description":"EU Compliance","url":None,"admin_url":None,"status":"pending","sso":False},
]


@router.get("")
async def list_admin_projects(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not _is_platform_owner(user):
        raise HTTPException(status_code=403, detail="Platform owner access required")

    return {
        "owner": {
            "email": user.get("canonical_email") or user.get("email"),
            "role": "owner",
            "permissions": ["*"],
        },
        "projects": [
            {
                **project,
                **(
                    {
                        "url": os.getenv("BIDBLITZ_AION_BASE_URL", "").rstrip("/") or None,
                        "admin_url": os.getenv("BIDBLITZ_AION_BASE_URL", "").rstrip("/") or None,
                        "status": "online" if os.getenv("BIDBLITZ_AION_BASE_URL", "").strip() else "pending",
                    }
                    if project["id"] == "aion"
                    else {}
                ),
                "permissions": ["*"],
                "sso_ready": _project_sso_ready(project["id"]),
            }
            for project in PROJECTS
        ],
        "sso_rollout": {
            "enabled": any(_project_sso_ready(project_id) for project_id in ("eyes", "trade", "aion")),
            "message": "BidBlitz ID SSO wird projektweise aktiviert.",
        },
    }
