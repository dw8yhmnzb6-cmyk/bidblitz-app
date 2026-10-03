"""Operator review for quarantined BidBlitz Games submissions.

Review approval does not publish or execute third-party code. It only advances
the metadata workflow toward a future isolated preview environment.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
import hashlib
import os
import shutil
import zipfile

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user
from routes.game_studio_uploads import UPLOAD_ROOT, _clean_member_name, _inspect_zip


router = APIRouter(prefix="/api/admin/game-studio", tags=["admin-game-studio"])

PREVIEW_ROOT = Path(
    os.environ.get(
        "GAME_STUDIO_PREVIEW_ROOT",
        str(Path(__file__).resolve().parents[1] / "private" / "game-studio" / "previews"),
    )
)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _safe_extract_preview(archive_path: Path, target_dir: Path) -> dict:
    inspection = _inspect_zip(archive_path)
    target_dir.mkdir(parents=True, mode=0o700, exist_ok=False)
    root = target_dir.resolve()
    extracted = 0
    try:
        with zipfile.ZipFile(archive_path, "r") as archive:
            for info in archive.infolist():
                name = _clean_member_name(info.filename)
                destination = (target_dir / name).resolve()
                if not destination.is_relative_to(root):
                    raise HTTPException(400, "Unsicherer Zielpfad beim Entpacken")
                if info.is_dir():
                    destination.mkdir(parents=True, mode=0o700, exist_ok=True)
                    continue
                destination.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
                with archive.open(info, "r") as source, destination.open("wb") as output:
                    shutil.copyfileobj(source, output, length=64 * 1024)
                destination.chmod(0o600)
                extracted += 1
        return {**inspection, "extracted_files": extracted}
    except Exception:
        shutil.rmtree(target_dir, ignore_errors=True)
        raise



class VersionReviewInput(BaseModel):
    action: Literal["approve_archive", "request_changes", "reject"]
    note: str = Field(default="", max_length=1000)

    @field_validator("note", mode="before")
    @classmethod
    def trim_note(cls, value):
        return str(value or "").strip()


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def _public_version(doc: dict) -> dict:
    return {
        key: value for key, value in doc.items()
        if key not in {"_id", "owner_id", "storage_path", "preview_path", "create_key"}
    }


@router.get("/versions")
async def review_queue(
    request: Request,
    review_status: str = Query("submitted", max_length=40),
    limit: int = Query(50, ge=1, le=100),
):
    await _admin(request)
    allowed = {"submitted", "archive_approved", "changes_requested", "rejected"}
    if review_status not in allowed:
        raise HTTPException(400, "Ungültiger Prüfstatus")

    versions = await db.game_studio_versions.find(
        {"review_status": review_status, "status": {"$ne": "deleted"}},
        {"_id": 0, "owner_id": 0, "storage_path": 0, "create_key": 0},
    ).sort("submitted_at", 1).limit(limit).to_list(limit)

    draft_ids = list({row.get("draft_id") for row in versions if row.get("draft_id")})
    drafts = {}
    if draft_ids:
        rows = await db.game_studio_drafts.find(
            {"id": {"$in": draft_ids}},
            {"_id": 0, "id": 1, "title": 1, "category": 1, "languages": 1},
        ).to_list(len(draft_ids))
        drafts = {row["id"]: row for row in rows}

    for version in versions:
        version["game"] = drafts.get(version.get("draft_id"), {})
    return {"versions": versions, "count": len(versions), "review_status": review_status}


@router.post("/versions/{version_id}/review")
async def review_version(version_id: str, payload: VersionReviewInput, request: Request):
    admin = await _admin(request)
    current = await db.game_studio_versions.find_one({
        "id": version_id,
        "status": {"$ne": "deleted"},
    })
    if not current:
        raise HTTPException(404, "Spielversion nicht gefunden")

    target = {
        "approve_archive": "archive_approved",
        "request_changes": "changes_requested",
        "reject": "rejected",
    }[payload.action]

    if current.get("review_status") == target:
        return _public_version(current)
    if current.get("review_status") != "submitted":
        raise HTTPException(409, "Nur eingereichte Versionen können geprüft werden")
    if payload.action in {"request_changes", "reject"} and len(payload.note) < 5:
        raise HTTPException(400, "Bitte einen nachvollziehbaren Hinweis angeben")

    now = datetime.now(timezone.utc).isoformat()
    reviewer_id = str(admin.get("_id") or admin.get("id") or "")
    update = {
        "review_status": target,
        "review_note": payload.note,
        "reviewed_at": now,
        "reviewed_by": reviewer_id,
        "updated_at": now,
        # Third-party code remains blocked until a separate isolated preview origin exists.
        "execution_status": "blocked_pending_isolated_preview",
    }
    result = await db.game_studio_versions.update_one(
        {"id": version_id, "review_status": "submitted", "status": {"$ne": "deleted"}},
        {"$set": update},
    )
    if not result.matched_count:
        raise HTTPException(409, "Prüfstatus wurde zwischenzeitlich geändert")

    event = {
        "id": f"review:{version_id}:{now}",
        "version_id": version_id,
        "draft_id": current.get("draft_id"),
        "owner_id": current.get("owner_id"),
        "reviewer_id": reviewer_id,
        "action": payload.action,
        "result": target,
        "note": payload.note,
        "created_at": now,
    }
    await db.game_studio_review_events.insert_one(event)

    saved = await db.game_studio_versions.find_one({"id": version_id})
    return _public_version(saved)


@router.post("/versions/{version_id}/prepare-preview")
async def prepare_private_preview(version_id: str, request: Request):
    admin = await _admin(request)
    current = await db.game_studio_versions.find_one({
        "id": version_id,
        "status": "quarantined",
        "review_status": "archive_approved",
    })
    if not current:
        raise HTTPException(404, "Freigegebene Spielversion nicht gefunden")

    raw_path = Path(current.get("storage_path") or "")
    try:
        archive_path = raw_path.resolve()
        quarantine_root = UPLOAD_ROOT.resolve()
    except OSError:
        raise HTTPException(409, "Quarantäne-Datei ist nicht verfügbar")
    if not archive_path.is_relative_to(quarantine_root) or not archive_path.is_file():
        raise HTTPException(409, "Quarantäne-Datei ist nicht verfügbar")

    expected_hash = str(current.get("sha256") or "")
    if not expected_hash or _sha256_file(archive_path) != expected_hash:
        raise HTTPException(409, "Quarantäne-Datei wurde verändert")

    PREVIEW_ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    preview_dir = hashlib.sha256(version_id.encode("utf-8")).hexdigest()[:32]
    target = PREVIEW_ROOT / preview_dir
    if target.exists():
        shutil.rmtree(target)
    inspection = _safe_extract_preview(archive_path, target)

    now = datetime.now(timezone.utc).isoformat()
    reviewer_id = str(admin.get("_id") or admin.get("id") or "")
    await db.game_studio_versions.update_one(
        {"id": version_id, "review_status": "archive_approved"},
        {"$set": {
            "preview_status": "prepared",
            "preview_path": str(target),
            "preview_entrypoint": inspection["entrypoint"],
            "preview_prepared_at": now,
            "preview_prepared_by": reviewer_id,
            "execution_status": "blocked_pending_isolated_preview",
            "updated_at": now,
        }},
    )
    saved = await db.game_studio_versions.find_one({"id": version_id})
    result = _public_version(saved)
    result["preview_status"] = "prepared"
    return result
