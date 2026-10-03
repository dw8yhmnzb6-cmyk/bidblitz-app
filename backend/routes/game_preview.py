"""Cookie-free isolated preview delivery for reviewed third-party games.

The preview route is disabled until GAME_PREVIEW_HOST and GAME_PREVIEW_BASE_URL
are configured. It must run on a host that does not receive BidBlitz auth cookies.
"""

import hashlib
import mimetypes
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from core.database import db
from core.security import get_current_user


router = APIRouter(tags=["game-preview"])
api_router = APIRouter(prefix="/api/game-studio", tags=["game-preview-access"])

PREVIEW_ROOT = Path(
    os.environ.get(
        "GAME_STUDIO_PREVIEW_ROOT",
        str(Path(__file__).resolve().parents[1] / "private" / "game-studio" / "previews"),
    )
)
PREVIEW_HOST = os.environ.get("GAME_PREVIEW_HOST", "").strip().lower().split(":")[0]
PREVIEW_BASE_URL = os.environ.get("GAME_PREVIEW_BASE_URL", "").strip().rstrip("/")
FRAME_ANCESTORS = os.environ.get("GAME_PREVIEW_FRAME_ANCESTORS", "'none'").strip() or "'none'"
TOKEN_TTL_MINUTES = 30
_TOKEN = re.compile(r"^[A-Za-z0-9_-]{32,128}$")

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


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _preview_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-store, private",
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
            f"frame-ancestors {FRAME_ANCESTORS}"
        ),
        "Permissions-Policy": (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), "
            "serial=(), bluetooth=(), clipboard-read=(), clipboard-write=()"
        ),
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
    }


def _configured_preview_url(token: str) -> str:
    if not PREVIEW_HOST or not PREVIEW_BASE_URL:
        raise HTTPException(503, "Private Games-Vorschau ist noch nicht konfiguriert")
    parsed = urlparse(PREVIEW_BASE_URL)
    local = PREVIEW_HOST in {"localhost", "127.0.0.1"}
    if parsed.hostname != PREVIEW_HOST or parsed.scheme not in ({"http", "https"} if local else {"https"}):
        raise HTTPException(503, "Games-Preview-Konfiguration ist unsicher")
    return f"{PREVIEW_BASE_URL}/game-preview/{token}/index.html"


def _require_preview_host(request: Request) -> None:
    if not PREVIEW_HOST:
        raise HTTPException(404, "Nicht gefunden")
    host = (request.headers.get("host") or "").split(":")[0].lower()
    if host != PREVIEW_HOST:
        raise HTTPException(404, "Nicht gefunden")
    # A preview request must never carry BidBlitz authentication cookies.
    if request.cookies.get("access_token") or request.cookies.get("refresh_token"):
        raise HTTPException(400, "Preview-Host darf keine BidBlitz-Login-Cookies erhalten")


def _safe_asset_path(root: Path, requested: str) -> Path:
    requested = requested or "index.html"
    if "\x00" in requested or "\\" in requested:
        raise HTTPException(400, "Ungültiger Vorschaupfad")
    path = PurePosixPath(requested)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise HTTPException(400, "Ungültiger Vorschaupfad")
    if len(requested) > 240:
        raise HTTPException(400, "Vorschaupfad ist zu lang")
    resolved_root = root.resolve()
    target = (root / path.as_posix()).resolve()
    if not target.is_relative_to(resolved_root):
        raise HTTPException(400, "Ungültiger Vorschaupfad")
    return target


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


@api_router.post("/drafts/{draft_id}/versions/{version_id}/preview-link")
async def create_preview_link(draft_id: str, version_id: str, request: Request):
    owner_id = await _owner(request)
    version = await db.game_studio_versions.find_one({
        "id": version_id,
        "draft_id": draft_id,
        "owner_id": owner_id,
        "status": "quarantined",
        "review_status": "archive_approved",
        "preview_status": "prepared",
        "execution_status": "blocked_pending_isolated_preview",
    })
    if not version:
        raise HTTPException(404, "Vorbereitete Spielversion nicht gefunden")

    preview_path = Path(version.get("preview_path") or "")
    try:
        root = PREVIEW_ROOT.resolve()
        resolved = preview_path.resolve()
    except OSError:
        raise HTTPException(409, "Vorschau-Dateien sind nicht verfügbar")
    if not resolved.is_relative_to(root) or not (resolved / "index.html").is_file():
        raise HTTPException(409, "Vorschau-Dateien sind nicht verfügbar")

    token = secrets.token_urlsafe(32)
    preview_url = _configured_preview_url(token)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=TOKEN_TTL_MINUTES)
    token_doc = {
        "_id": f"{owner_id}:{version_id}",
        "token_hash": _hash_token(token),
        "owner_id": owner_id,
        "draft_id": draft_id,
        "version_id": version_id,
        "created_at": now,
        "expires_at": expires,
    }
    await db.game_studio_preview_tokens.replace_one(
        {"_id": token_doc["_id"]},
        token_doc,
        upsert=True,
    )
    return {
        "url": preview_url,
        "expires_at": expires.isoformat(),
        "ttl_minutes": TOKEN_TTL_MINUTES,
    }


@api_router.delete("/drafts/{draft_id}/versions/{version_id}/preview-links")
async def revoke_preview_links(draft_id: str, version_id: str, request: Request):
    owner_id = await _owner(request)
    version = await db.game_studio_versions.find_one({
        "id": version_id,
        "draft_id": draft_id,
        "owner_id": owner_id,
        "status": "quarantined",
    })
    if not version:
        raise HTTPException(404, "Spielversion nicht gefunden")
    now = datetime.now(timezone.utc)
    result = await db.game_studio_preview_tokens.update_one(
        {"_id": f"{owner_id}:{version_id}", "revoked_at": {"$exists": False}},
        {"$set": {"revoked_at": now}},
    )
    return {"revoked": int(getattr(result, "modified_count", 0) or 0)}


@router.get("/game-preview/{token}/{asset_path:path}")
async def serve_private_preview(token: str, asset_path: str, request: Request):
    _require_preview_host(request)
    if not _TOKEN.fullmatch(token):
        raise HTTPException(404, "Nicht gefunden")

    now = datetime.now(timezone.utc)
    access = await db.game_studio_preview_tokens.find_one({
        "token_hash": _hash_token(token),
        "expires_at": {"$gt": now},
        "revoked_at": {"$exists": False},
    })
    if not access:
        raise HTTPException(404, "Vorschau-Link ist ungültig oder abgelaufen")

    version = await db.game_studio_versions.find_one({
        "id": access.get("version_id"),
        "owner_id": access.get("owner_id"),
        "status": "quarantined",
        "review_status": "archive_approved",
        "preview_status": "prepared",
    })
    if not version:
        raise HTTPException(404, "Vorschau ist nicht mehr verfügbar")

    preview_path = Path(version.get("preview_path") or "")
    try:
        root = PREVIEW_ROOT.resolve()
        resolved_preview = preview_path.resolve()
    except OSError:
        raise HTTPException(404, "Vorschau ist nicht mehr verfügbar")
    if not resolved_preview.is_relative_to(root):
        raise HTTPException(404, "Vorschau ist nicht mehr verfügbar")

    target = _safe_asset_path(resolved_preview, asset_path or "index.html")
    if not target.is_file():
        raise HTTPException(404, "Vorschau-Datei nicht gefunden")
    suffix = target.suffix.lower()
    media_type = CONTENT_TYPES.get(suffix) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(
        target,
        media_type=media_type,
        headers=_preview_headers(),
        filename=None,
    )
