"""Publication catalog and isolated public delivery for approved third-party games.

Publishing only points the catalog at a version that already passed archive and
private-preview review. Third-party code is always served from a dedicated,
cookie-free host with restrictive browser policy.
"""

import hashlib
import mimetypes
import os
import re
import secrets
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from core.database import db
from core.security import get_current_user
from routes.game_preview import PREVIEW_BASE_URL, PREVIEW_HOST, PREVIEW_ROOT, _safe_asset_path
from routes.game_studio_uploads import UPLOAD_ROOT
from routes.games_developer import BILLING_READY, assert_publication_entitlement, reserve_publication_slot, release_publication_slot


api_router = APIRouter(tags=["games-catalog"])
admin_router = APIRouter(prefix="/api/admin/game-studio", tags=["admin-game-studio-publication"])
public_router = APIRouter(tags=["games-public-play"])

PUBLIC_HOST = os.environ.get("GAME_PUBLIC_HOST", "").strip().lower().split(":")[0]
PUBLIC_BASE_URL = os.environ.get("GAME_PUBLIC_BASE_URL", "").strip().rstrip("/")
PUBLIC_FRAME_ANCESTORS = os.environ.get("GAME_PUBLIC_FRAME_ANCESTORS", "'none'").strip() or "'none'"
PUBLICATION_LOCK_TTL_SECONDS = max(
    30,
    int(os.environ.get("GAME_PUBLICATION_LOCK_TTL_SECONDS", "300")),
)

RELEASE_ROOT = Path(
    os.environ.get(
        "GAME_STUDIO_RELEASE_ROOT",
        str(Path(__file__).resolve().parents[1] / "private" / "game-studio" / "releases"),
    )
)

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".bin": "application/octet-stream",
    ".dat": "application/octet-stream",
}
_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{2,79}$")


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


def _duplicate_key(exc: Exception) -> bool:
    return exc.__class__.__name__ == "DuplicateKeyError" or getattr(exc, "code", None) == 11000


async def _acquire_publication_lock(draft_id: str) -> str:
    """Serialize publication changes for one game across all API instances."""
    token = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=PUBLICATION_LOCK_TTL_SECONDS)
    try:
        await db.games_publication_locks.insert_one({
            "_id": draft_id,
            "token": token,
            "created_at": now,
            "expires_at": expires_at,
        })
    except Exception as exc:
        if _duplicate_key(exc):
            raise HTTPException(409, "Veröffentlichung dieses Spiels wird bereits bearbeitet")
        raise
    return token


async def _release_publication_lock(draft_id: str, token: str) -> bool:
    """Best-effort release; TTL cleanup prevents a crashed worker from blocking forever."""
    try:
        result = await db.games_publication_locks.delete_one({
            "_id": draft_id,
            "token": token,
        })
    except Exception:
        return False
    return bool(getattr(result, "deleted_count", 0))


def _slugify(title: str, draft_id: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", str(title or "").strip().lower()).strip("-")
    base = base[:50].strip("-") or "game"
    suffix = hashlib.sha256(str(draft_id).encode("utf-8")).hexdigest()[:10]
    slug = f"{base}-{suffix}"
    if not _SLUG.fullmatch(slug):
        raise HTTPException(500, "Spiel-Slug konnte nicht erzeugt werden")
    return slug


def _public_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-store",
        "Content-Security-Policy": (
            "sandbox allow-scripts; "
            "default-src 'self' data: blob:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self' data:; "
            "media-src 'self' data: blob:; "
            "connect-src 'none'; "
            "worker-src 'none'; "
            "object-src 'none'; "
            "base-uri 'none'; "
            "form-action 'none'; "
            f"frame-ancestors {PUBLIC_FRAME_ANCESTORS}"
        ),
        "Permissions-Policy": (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), "
            "serial=(), bluetooth=(), clipboard-read=(), clipboard-write=()"
        ),
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
    }


def _origin_preflight(host: str, base_url: str) -> dict:
    host = str(host or "").strip().lower().split(":")[0]
    base_url = str(base_url or "").strip().rstrip("/")
    configured = bool(host and base_url)
    if not configured:
        return {
            "configured": False,
            "host": host or None,
            "https": False,
            "host_matches": False,
            "safe": False,
        }

    parsed = urlparse(base_url)
    local = host in {"localhost", "127.0.0.1"}
    https = parsed.scheme == "https"
    host_matches = parsed.hostname == host
    scheme_safe = https or (local and parsed.scheme == "http")
    return {
        "configured": True,
        "host": host,
        "https": https,
        "host_matches": host_matches,
        "safe": bool(host_matches and scheme_safe),
    }


def _nearest_existing_parent(path: Path) -> Path | None:
    candidate = path
    for _ in range(32):
        if candidate.exists():
            return candidate
        parent = candidate.parent
        if parent == candidate:
            return None
        candidate = parent
    return None


def _storage_preflight(root: Path) -> dict:
    try:
        resolved = Path(root).expanduser().resolve()
        frontend_public = (Path(__file__).resolve().parents[2] / "frontend" / "public").resolve()
        private_location = not resolved.is_relative_to(frontend_public)
        exists = resolved.is_dir()
        probe = resolved if exists else _nearest_existing_parent(resolved)
        writable = bool(probe and probe.is_dir() and os.access(probe, os.W_OK))
        return {
            "exists": exists,
            "writable": writable,
            "private_location": private_location,
            "safe": bool(writable and private_location),
        }
    except (OSError, RuntimeError):
        return {
            "exists": False,
            "writable": False,
            "private_location": False,
            "safe": False,
        }


def _roots_are_distinct(*roots: Path) -> bool:
    try:
        resolved = [str(Path(root).expanduser().resolve()) for root in roots]
    except (OSError, RuntimeError):
        return False
    return len(set(resolved)) == len(resolved)


@admin_router.get("/diagnostics")
async def games_diagnostics(request: Request):
    """Read-only operational snapshot for the Games admin dashboard."""
    await _admin(request)
    counts = {
        "drafts": await db.game_studio_drafts.count_documents({"status": "draft"}),
        "versions": await db.game_studio_versions.count_documents({}),
        "submitted": await db.game_studio_versions.count_documents({"review_status": "submitted"}),
        "archive_approved": await db.game_studio_versions.count_documents({"review_status": "archive_approved"}),
        "preview_approved": await db.game_studio_versions.count_documents({"review_status": "preview_approved"}),
        "published": await db.games_catalog.count_documents({"status": "published"}),
        "unpublished": await db.games_catalog.count_documents({"status": "unpublished"}),
        "publication_events": await db.game_studio_publication_events.count_documents({}),
        "publication_locks": await db.games_publication_locks.count_documents({}),
    }
    preflight = await games_preflight(request)
    return {
        "status": "ok" if preflight["ready"] else "attention",
        "counts": counts,
        "preflight_ready": preflight["ready"],
        "billing_fail_closed": preflight["billing"]["fail_closed"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@admin_router.get("/preflight")
async def games_preflight(request: Request):
    """Read-only Games readiness check. It never enables hosts, billing or production."""
    await _admin(request)

    public_origin = _origin_preflight(PUBLIC_HOST, PUBLIC_BASE_URL)
    preview_origin = _origin_preflight(PREVIEW_HOST, PREVIEW_BASE_URL)
    upload_storage = _storage_preflight(UPLOAD_ROOT)
    preview_storage = _storage_preflight(PREVIEW_ROOT)
    release_storage = _storage_preflight(RELEASE_ROOT)
    isolated_origins = bool(
        public_origin["safe"]
        and preview_origin["safe"]
        and public_origin["host"] != preview_origin["host"]
    )
    distinct_storage_roots = _roots_are_distinct(UPLOAD_ROOT, PREVIEW_ROOT, RELEASE_ROOT)
    billing_fail_closed = not BILLING_READY

    required = {
        "public_origin_safe": public_origin["safe"],
        "preview_origin_safe": preview_origin["safe"],
        "origins_isolated": isolated_origins,
        "upload_storage_safe": upload_storage["safe"],
        "preview_storage_safe": preview_storage["safe"],
        "release_storage_safe": release_storage["safe"],
        "storage_roots_distinct": distinct_storage_roots,
        "billing_fail_closed": billing_fail_closed,
    }
    return {
        "scope": "games_non_monetary_preflight",
        "ready": all(required.values()),
        "checks": required,
        "public_origin": public_origin,
        "preview_origin": preview_origin,
        "storage": {
            "upload": upload_storage,
            "preview": preview_storage,
            "release": release_storage,
        },
        "billing": {
            "enabled": BILLING_READY,
            "fail_closed": billing_fail_closed,
        },
        "side_effects": "none",
    }


def _configured_public_url(slug: str) -> str:
    if not PUBLIC_HOST or not PUBLIC_BASE_URL:
        raise HTTPException(503, "Öffentlicher Games-Host ist noch nicht konfiguriert")
    parsed = urlparse(PUBLIC_BASE_URL)
    local = PUBLIC_HOST in {"localhost", "127.0.0.1"}
    if parsed.hostname != PUBLIC_HOST or parsed.scheme not in ({"http", "https"} if local else {"https"}):
        raise HTTPException(503, "Öffentliche Games-Host-Konfiguration ist unsicher")
    return f"{PUBLIC_BASE_URL}/game/{slug}/index.html"


def _require_public_host(request: Request) -> None:
    if not PUBLIC_HOST:
        raise HTTPException(404, "Nicht gefunden")
    host = (request.headers.get("host") or "").split(":")[0].lower()
    if host != PUBLIC_HOST:
        raise HTTPException(404, "Nicht gefunden")
    if request.cookies.get("access_token") or request.cookies.get("refresh_token"):
        raise HTTPException(400, "Öffentlicher Game-Host darf keine BidBlitz-Login-Cookies erhalten")


def _release_dir(version_id: str) -> Path:
    return RELEASE_ROOT / hashlib.sha256(str(version_id).encode("utf-8")).hexdigest()[:32]


def _freeze_release(version: dict) -> Path:
    preview_path = Path(version.get("preview_path") or "")
    try:
        preview_root = PREVIEW_ROOT.resolve()
        source = preview_path.resolve()
    except OSError:
        raise HTTPException(409, "Vorbereitete Spielversion ist nicht verfügbar")
    if not source.is_relative_to(preview_root) or not (source / "index.html").is_file():
        raise HTTPException(409, "Vorbereitete Spielversion ist nicht verfügbar")

    RELEASE_ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    target = _release_dir(str(version.get("id") or ""))
    if target.exists():
        resolved_target = target.resolve()
        if not resolved_target.is_relative_to(RELEASE_ROOT.resolve()) or not (resolved_target / "index.html").is_file():
            raise HTTPException(409, "Release-Snapshot ist inkonsistent")
        return resolved_target

    temporary = RELEASE_ROOT / f".{target.name}.tmp"
    shutil.rmtree(temporary, ignore_errors=True)
    try:
        shutil.copytree(source, temporary, symlinks=False)
        for path in sorted(temporary.rglob("*"), reverse=True):
            path.chmod(0o555 if path.is_dir() else 0o444)
        temporary.chmod(0o555)
        os.replace(temporary, target)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return target.resolve()


def _public_catalog_item(doc: dict) -> dict:
    allowed = {
        "id", "slug", "title", "description", "category", "languages",
        "public_url", "active_version_id", "version_number",
        "published_at", "updated_at", "source",
    }
    return {key: value for key, value in doc.items() if key in allowed}


async def _approved_version(version_id: str, draft_id: str) -> dict:
    version = await db.game_studio_versions.find_one({
        "id": version_id,
        "draft_id": draft_id,
        "status": "quarantined",
        "review_status": "preview_approved",
        "preview_status": "prepared",
    })
    if not version:
        raise HTTPException(409, "Version ist nicht für Veröffentlichung freigegeben")
    preview_path = Path(version.get("preview_path") or "")
    try:
        root = PREVIEW_ROOT.resolve()
        resolved = preview_path.resolve()
    except OSError:
        raise HTTPException(409, "Vorbereitete Spielversion ist nicht verfügbar")
    if not resolved.is_relative_to(root) or not (resolved / "index.html").is_file():
        raise HTTPException(409, "Vorbereitete Spielversion ist nicht verfügbar")
    return version


async def _draft(draft_id: str) -> dict:
    draft = await db.game_studio_drafts.find_one(
        {"id": draft_id, "status": "draft"},
        {"_id": 0},
    )
    if not draft:
        raise HTTPException(404, "Spielentwurf nicht gefunden")
    return draft


async def _catalog_doc(draft: dict, version: dict, *, existing: dict | None = None) -> dict:
    slug = (existing or {}).get("slug") or _slugify(draft.get("title"), draft.get("id"))
    public_url = _configured_public_url(slug)
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": draft["id"],
        "owner_id": draft["owner_id"],
        "slug": slug,
        "title": draft["title"],
        "description": draft["description"],
        "category": draft["category"],
        "languages": list(draft.get("languages") or []),
        "source": "third_party",
        "status": "published",
        "active_version_id": version["id"],
        "version_number": int(version.get("version_number") or 1),
        "public_url": public_url,
        "published_at": (existing or {}).get("published_at") or now,
        "updated_at": now,
    }


@api_router.get("/api/games/catalog")
async def public_catalog():
    rows = await db.games_catalog.find(
        {"status": "published"},
        {"_id": 0},
    ).sort([("updated_at", -1), ("title", 1)]).limit(500).to_list(500)
    return {"games": [_public_catalog_item(row) for row in rows], "count": len(rows)}


@admin_router.post("/versions/{version_id}/approve-preview")
async def approve_preview(version_id: str, request: Request):
    """Convenience endpoint for the explicit second-stage preview approval."""
    admin = await _admin(request)
    current = await db.game_studio_versions.find_one({
        "id": version_id,
        "status": "quarantined",
        "review_status": "archive_approved",
        "preview_status": "prepared",
    })
    if not current:
        existing = await db.game_studio_versions.find_one({"id": version_id})
        if existing and existing.get("review_status") == "preview_approved":
            return {"approved": True, "version_id": version_id}
        raise HTTPException(409, "Private Vorschau ist nicht freigabebereit")
    now = datetime.now(timezone.utc).isoformat()
    reviewer_id = str(admin.get("_id") or admin.get("id") or "")
    result = await db.game_studio_versions.update_one(
        {"id": version_id, "review_status": "archive_approved", "preview_status": "prepared"},
        {"$set": {
            "review_status": "preview_approved",
            "preview_reviewed_at": now,
            "preview_reviewed_by": reviewer_id,
            "execution_status": "isolated_preview_only",
            "updated_at": now,
        }},
    )
    if not result.matched_count:
        raise HTTPException(409, "Prüfstatus wurde zwischenzeitlich geändert")
    await db.game_studio_review_events.insert_one({
        "id": f"preview-approval:{version_id}:{now}",
        "version_id": version_id,
        "draft_id": current.get("draft_id"),
        "owner_id": current.get("owner_id"),
        "reviewer_id": reviewer_id,
        "action": "approve_preview",
        "result": "preview_approved",
        "note": "",
        "created_at": now,
    })
    return {"approved": True, "version_id": version_id}


@admin_router.post("/versions/{version_id}/publish")
async def publish_version(version_id: str, request: Request):
    admin = await _admin(request)
    version = await db.game_studio_versions.find_one({"id": version_id})
    if not version:
        raise HTTPException(404, "Spielversion nicht gefunden")
    draft_id = str(version.get("draft_id") or "")
    lock_token = await _acquire_publication_lock(draft_id)
    owner_id = ""
    slot_reserved = False
    try:
        draft = await _draft(draft_id)
        version = await _approved_version(version_id, draft_id)
        owner_id = str(draft.get("owner_id") or "")
        entitlement = await assert_publication_entitlement(owner_id, draft_id)
        existing = await db.games_catalog.find_one({"id": draft_id}) or {}

        # A retry of the already-active version is a no-op. This prevents
        # duplicate publication events and avoids consuming/releasing slots.
        if (
            existing.get("status") == "published"
            and existing.get("active_version_id") == version_id
            and version.get("publication_status") == "published"
        ):
            return _public_catalog_item(existing)

        release_path = _freeze_release(version)
        slot_reserved = await reserve_publication_slot(owner_id, draft_id, entitlement)
        catalog = await _catalog_doc(draft, version, existing=existing)

        old_version_id = existing.get("active_version_id")
        if old_version_id and old_version_id != version_id:
            await db.game_studio_versions.update_one(
                {"id": old_version_id, "draft_id": draft_id},
                {"$set": {"publication_status": "inactive", "updated_at": catalog["updated_at"]}},
            )

        await db.games_catalog.update_one(
            {"id": draft_id},
            {"$set": catalog, "$setOnInsert": {"created_at": catalog["published_at"]}},
            upsert=True,
        )
        await db.game_studio_versions.update_one(
            {"id": version_id, "draft_id": draft_id},
            {"$set": {
                "publication_status": "published",
                "published_at": catalog["updated_at"],
                "public_slug": catalog["slug"],
                "release_path": str(release_path),
                "release_status": "frozen",
                "updated_at": catalog["updated_at"],
            }},
        )
        admin_id = str(admin.get("_id") or admin.get("id") or "")
        await db.game_studio_publication_events.insert_one({
            "id": f"publish:{draft_id}:{version_id}:{catalog['updated_at']}",
            "draft_id": draft_id,
            "version_id": version_id,
            "previous_version_id": old_version_id,
            "action": "publish",
            "admin_id": admin_id,
            "created_at": catalog["updated_at"],
        })
        return _public_catalog_item(catalog)
    except Exception:
        if slot_reserved and owner_id:
            await release_publication_slot(owner_id, draft_id)
        raise
    finally:
        await _release_publication_lock(draft_id, lock_token)


@admin_router.post("/games/{draft_id}/rollback/{version_id}")
async def rollback_game(draft_id: str, version_id: str, request: Request):
    admin = await _admin(request)
    lock_token = await _acquire_publication_lock(draft_id)
    try:
        existing = await db.games_catalog.find_one({"id": draft_id, "status": "published"})
        if not existing:
            raise HTTPException(404, "Veröffentlichtes Spiel nicht gefunden")
        draft = await _draft(draft_id)
        target = await _approved_version(version_id, draft_id)
        await assert_publication_entitlement(str(draft.get("owner_id") or ""), draft_id)
        if existing.get("active_version_id") == version_id:
            return _public_catalog_item(existing)

        release_path = _freeze_release(target)
        catalog = await _catalog_doc(draft, target, existing=existing)
        old_version_id = existing.get("active_version_id")
        await db.game_studio_versions.update_one(
            {"id": old_version_id, "draft_id": draft_id},
            {"$set": {"publication_status": "inactive", "updated_at": catalog["updated_at"]}},
        )
        await db.game_studio_versions.update_one(
            {"id": version_id, "draft_id": draft_id},
            {"$set": {
                "publication_status": "published",
                "published_at": catalog["updated_at"],
                "public_slug": catalog["slug"],
                "release_path": str(release_path),
                "release_status": "frozen",
                "updated_at": catalog["updated_at"],
            }},
        )
        await db.games_catalog.update_one({"id": draft_id}, {"$set": catalog})
        admin_id = str(admin.get("_id") or admin.get("id") or "")
        await db.game_studio_publication_events.insert_one({
            "id": f"rollback:{draft_id}:{version_id}:{catalog['updated_at']}",
            "draft_id": draft_id,
            "version_id": version_id,
            "previous_version_id": old_version_id,
            "action": "rollback",
            "admin_id": admin_id,
            "created_at": catalog["updated_at"],
        })
        return _public_catalog_item(catalog)
    finally:
        await _release_publication_lock(draft_id, lock_token)


@admin_router.post("/games/{draft_id}/unpublish")
async def unpublish_game(draft_id: str, request: Request):
    admin = await _admin(request)
    lock_token = await _acquire_publication_lock(draft_id)
    try:
        existing = await db.games_catalog.find_one({"id": draft_id})
        if not existing:
            raise HTTPException(404, "Veröffentlichtes Spiel nicht gefunden")
        owner_id = str(existing.get("owner_id") or "")
        if existing.get("status") != "published":
            if owner_id:
                await release_publication_slot(owner_id, draft_id)
            return {"unpublished": True, "draft_id": draft_id, "already_unpublished": True}
        now = datetime.now(timezone.utc).isoformat()
        version_id = existing.get("active_version_id")
        await db.games_catalog.update_one(
            {"id": draft_id},
            {"$set": {"status": "unpublished", "updated_at": now}},
        )
        if version_id:
            await db.game_studio_versions.update_one(
                {"id": version_id, "draft_id": draft_id},
                {"$set": {"publication_status": "inactive", "updated_at": now}},
            )
        admin_id = str(admin.get("_id") or admin.get("id") or "")
        await db.game_studio_publication_events.insert_one({
            "id": f"unpublish:{draft_id}:{now}",
            "draft_id": draft_id,
            "version_id": version_id,
            "action": "unpublish",
            "admin_id": admin_id,
            "created_at": now,
        })
        if owner_id:
            await release_publication_slot(owner_id, draft_id)
        return {"unpublished": True, "draft_id": draft_id}
    finally:
        await _release_publication_lock(draft_id, lock_token)


@public_router.get("/game/{slug}/{asset_path:path}")
async def serve_published_game(slug: str, asset_path: str, request: Request):
    _require_public_host(request)
    if not _SLUG.fullmatch(slug):
        raise HTTPException(404, "Nicht gefunden")
    catalog = await db.games_catalog.find_one({"slug": slug, "status": "published"})
    if not catalog:
        raise HTTPException(404, "Spiel nicht gefunden")
    version = await db.game_studio_versions.find_one({
        "id": catalog.get("active_version_id"),
        "draft_id": catalog.get("id"),
        "status": "quarantined",
        "review_status": "preview_approved",
        "preview_status": "prepared",
        "publication_status": "published",
        "release_status": "frozen",
    })
    if not version:
        raise HTTPException(404, "Spielversion nicht verfügbar")

    release_path = Path(version.get("release_path") or "")
    try:
        root = RELEASE_ROOT.resolve()
        resolved = release_path.resolve()
    except OSError:
        raise HTTPException(404, "Spielversion nicht verfügbar")
    if not resolved.is_relative_to(root) or not (resolved / "index.html").is_file():
        raise HTTPException(404, "Spielversion nicht verfügbar")

    target = _safe_asset_path(resolved, asset_path or "index.html")
    if not target.is_file():
        raise HTTPException(404, "Spieldatei nicht gefunden")
    suffix = target.suffix.lower()
    media_type = CONTENT_TYPES.get(suffix) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type, headers=_public_headers(), filename=None)
