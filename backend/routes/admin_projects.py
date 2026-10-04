"""Owner-only project catalogue in the existing BidBlitz database."""
import os
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.errors import DuplicateKeyError

from core.database import db
from core.security import get_current_user
from core.admin_project_defaults import PROJECTS

router = APIRouter(prefix="/api/admin/projects", tags=["admin-projects"])


def _normalized_email(value):
    return str(value or "").strip().lower()


def _is_platform_owner(user):
    configured = {_normalized_email(v) for v in os.getenv(
        "BIDBLITZ_OWNER_EMAILS", "admin@bidblitz.ae").split(",") if v.strip()}
    # Use the current database identity, never token-supplied login aliases.
    return (user.get("role") == "admin"
            and not user.get("login_disabled") and not user.get("is_disabled")
            and _normalized_email(user.get("email")) in configured)


async def require_owner(request):
    user = await get_current_user(request)
    if not _is_platform_owner(user):
        raise HTTPException(403, "Nur der Haupt-Admin darf alle Projekte verwalten.")
    return user


def require_admin_write(request):
    """Same-origin browser writes, or explicitly authenticated API clients."""
    if request.headers.get("x-bidblitz-admin") != "1":
        raise HTTPException(403, "Admin-Anfrage konnte nicht bestätigt werden.")
    allowed = {"https://bidblitz.ae", os.getenv("FRONTEND_URL", "").rstrip("/")}
    origin = request.headers.get("origin")
    if origin and origin not in allowed:
        raise HTTPException(403, "Anfrage von einer nicht erlaubten Webseite.")
    if not origin and (request.cookies.get("access_token") or not request.headers.get("authorization", "").startswith("Bearer ")):
        raise HTTPException(403, "Ursprung der Admin-Anfrage fehlt.")


class ProjectFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    category: str = Field(default="Weitere", min_length=1, max_length=60)
    icon: str = Field(default="BB", min_length=1, max_length=32)
    color: str = Field(default="#7c3aed", pattern=r"^#[0-9a-fA-F]{6}$")
    url: str | None = Field(default=None, max_length=500)
    admin_url: str | None = Field(default=None, max_length=500)
    status: Literal["active", "coming_soon", "hidden", "dev"] = "coming_soon"
    position: int = Field(default=100, ge=0, le=10000)

    @field_validator("url", "admin_url")
    @classmethod
    def safe_url(cls, value):
        if not value:
            return None
        if value == "/admin":
            return value
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username
                or parsed.password or parsed.fragment or parsed.query or "\\" in value
                or any(ord(c) <= 32 or ord(c) == 127 for c in value)):
            raise ValueError("Eine HTTPS-Adresse ohne Zugangsdaten, Query oder Fragment ist erforderlich.")
        # Accessing port also rejects malformed ports during validation.
        if parsed.port not in (None, 443):
            raise ValueError("Nur HTTPS-Port 443 ist erlaubt.")
        return value.rstrip("/")


class ProjectCreate(ProjectFields):
    id: str = Field(min_length=2, max_length=60, pattern=r"^[a-z][a-z0-9-]+$")


class ProjectUpdate(ProjectFields):
    revision: int = Field(ge=0)


def _defaults():
    return {p["id"]: {
        **ProjectFields(name=p["name"], description=p["description"],
                        url=p["url"], admin_url=p["admin_url"],
                        status={"pending": "coming_soon", "dev": "dev"}.get(p["status"], "active"),
                        position=i * 10).model_dump(),
        "id": p["id"], "revision": 0,
    } for i, p in enumerate(PROJECTS)}


async def get_project(project_id):
    stored = await db.admin_projects.find_one({"_id": project_id}, {"_id": 0, "audit": 0})
    return stored or _defaults().get(project_id)


def project_view(project):
    from routes.admin_sso import sso_configuration, SSO_TARGETS
    project = {k: v for k, v in project.items() if k not in {"_id", "audit"}}
    native = project["id"] == "bidblitz"
    target = SSO_TARGETS.get(project["id"])
    configured = bool(target and sso_configuration(project["id"])["configured"])
    available = project["status"] in {"active", "dev"}
    return {**project, "permissions": ["catalogue:manage"],
            "sso": native or bool(target), "sso_ready": native or (configured and available),
            "sso_state": "native" if native else "configured" if configured else "not_configured" if target else "not_integrated",
            "open_mode": "internal" if native else "sso" if configured and available else "link" if project.get("admin_url") and available else "unavailable",
            "sso_message": "Mit deiner BidBlitz-Sitzung geöffnet." if native else
            "SSO konfiguriert; das Zielprojekt prüft Anmeldung und Rechte." if configured else
            "SSO noch nicht konfiguriert. Separate Projektanmeldung erforderlich." if target else
            "Separate Projektanmeldung erforderlich; zentrale Anmeldung noch nicht angebunden."}


@router.get("")
async def list_admin_projects(request: Request, response: Response):
    user = await require_owner(request)
    response.headers["Cache-Control"] = "no-store"
    projects = _defaults()
    async for row in db.admin_projects.find({}, {"_id": 0, "audit": 0}):
        projects[row["id"]] = row
    return {"owner": {"email": user.get("email"), "role": "owner", "permissions": ["catalogue:manage", "sso:issue"]},
            "projects": [project_view(p) for p in sorted(projects.values(), key=lambda p: (p["position"], p["name"].casefold(), p["id"]))]}


def _event(user, action):
    return {"action": action, "actor_id": str(user.get("user_id") or user.get("_id") or user.get("id") or ""),
            "at": datetime.now(timezone.utc).isoformat()}


@router.post("", status_code=201)
async def create_project(body: ProjectCreate, request: Request):
    user = await require_owner(request)
    require_admin_write(request)
    if body.id in _defaults():
        raise HTTPException(409, "Diese Projekt-ID existiert bereits.")
    project = {**body.model_dump(), "revision": 1}
    try:
        await db.admin_projects.insert_one({"_id": body.id, **project, "audit": [_event(user, "create")]})
    except DuplicateKeyError:
        raise HTTPException(409, "Diese Projekt-ID existiert bereits.")
    return {"project": project_view(project)}


@router.put("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, request: Request):
    user = await require_owner(request)
    require_admin_write(request)
    current = await get_project(project_id)
    if current is None:
        raise HTTPException(404, "Projekt nicht gefunden.")
    if body.revision != current["revision"]:
        raise HTTPException(409, "Das Projekt wurde inzwischen geändert. Bitte neu laden.")
    if project_id == "bidblitz" and (body.admin_url != "/admin" or body.url != "/admin" or body.status != "active"):
        raise HTTPException(422, "Der Zugang zum Haupt-Admin muss aktiv bleiben.")
    project = {**body.model_dump(exclude={"revision"}), "id": project_id, "revision": body.revision + 1}
    event = _event(user, "update")
    if body.revision == 0:
        try:
            await db.admin_projects.insert_one({"_id": project_id, **project, "audit": [event]})
        except DuplicateKeyError:
            raise HTTPException(409, "Das Projekt wurde inzwischen geändert. Bitte neu laden.")
    else:
        result = await db.admin_projects.update_one({"_id": project_id, "revision": body.revision},
            {"$set": project, "$push": {"audit": {"$each": [event], "$slice": -50}}})
        if result.matched_count != 1:
            raise HTTPException(409, "Das Projekt wurde inzwischen geändert. Bitte neu laden.")
    return {"project": project_view(project)}
