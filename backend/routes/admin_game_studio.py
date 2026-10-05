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
from routes.game_studio import SUPPORTED_LANGUAGES
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
    action: Literal["approve_archive", "approve_preview", "request_changes", "reject"]
    note: str = Field(default="", max_length=1000)

    @field_validator("note", mode="before")
    @classmethod
    def trim_note(cls, value):
        return str(value or "").strip()


class TranslationReviewInput(BaseModel):
    reviewed: bool
    note: str = Field(default="", max_length=1000)

    @field_validator("note", mode="before")
    @classmethod
    def trim_translation_note(cls, value):
        return str(value or "").strip()


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


def _public_version(doc: dict) -> dict:
    return {
        key: value for key, value in doc.items()
        if key not in {"_id", "owner_id", "storage_path", "preview_path", "release_path", "release_path", "create_key"}
    }


@router.get("/versions")
async def review_queue(
    request: Request,
    review_status: str = Query("submitted", max_length=40),
    limit: int = Query(50, ge=1, le=100),
):
    await _admin(request)
    allowed = {"submitted", "archive_approved", "preview_approved", "changes_requested", "rejected"}
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
        "approve_preview": "preview_approved",
        "request_changes": "changes_requested",
        "reject": "rejected",
    }[payload.action]

    if current.get("review_status") == target:
        return _public_version(current)

    current_status = current.get("review_status")
    if payload.action == "approve_archive" and current_status != "submitted":
        raise HTTPException(409, "Archivfreigabe erfordert eine eingereichte Version")
    if payload.action == "approve_preview":
        if current_status != "archive_approved" or current.get("preview_status") != "prepared":
            raise HTTPException(409, "Preview-Freigabe erfordert eine vorbereitete private Vorschau")
    if payload.action in {"request_changes", "reject"} and current_status not in {"submitted", "archive_approved"}:
        raise HTTPException(409, "Diese Version kann in diesem Status nicht zurückgewiesen werden")
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
        # Review approval never grants BidBlitz API/cookie access to third-party code.
        "execution_status": "isolated_preview_only" if target == "preview_approved" else "blocked_pending_isolated_preview",
    }
    result = await db.game_studio_versions.update_one(
        {"id": version_id, "review_status": current_status, "status": {"$ne": "deleted"}},
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


SOURCE_LANGUAGE = "en"


def _public_translation_review(code: str, doc: dict | None) -> dict:
    doc = doc or {}
    return {
        "code": code,
        "reviewed": bool(doc.get("reviewed")),
        "reviewed_at": doc.get("reviewed_at") if doc.get("reviewed") else None,
        "note": str(doc.get("note") or ""),
    }


@router.get("/translation-reviews")
async def translation_reviews(request: Request):
    """Read human translation-review state without exposing reviewer identity."""
    await _admin(request)
    codes = sorted(code for code in SUPPORTED_LANGUAGES if code != SOURCE_LANGUAGE)
    rows = await db.games_translation_reviews.find(
        {"code": {"$in": codes}},
        {"_id": 0, "code": 1, "reviewed": 1, "reviewed_at": 1, "note": 1},
    ).to_list(len(codes))
    by_code = {
        str(row.get("code")): row
        for row in rows
        if str(row.get("code") or "") in SUPPORTED_LANGUAGES
    }
    items = [_public_translation_review(code, by_code.get(code)) for code in codes]
    reviewed = [item["code"] for item in items if item["reviewed"]]
    pending = [item["code"] for item in items if not item["reviewed"]]
    return {
        "source_language": SOURCE_LANGUAGE,
        "localized_count": len(codes),
        "human_reviewed_count": len(reviewed),
        "pending_count": len(pending),
        "human_reviewed_codes": reviewed,
        "pending_codes": pending,
        "items": items,
    }


@router.post("/translation-reviews/{code}")
async def set_translation_review(
    code: str,
    payload: TranslationReviewInput,
    request: Request,
):
    """Record an explicit human admin review decision for one translation."""
    admin = await _admin(request)
    normalized = str(code or "").strip()
    if normalized not in SUPPORTED_LANGUAGES:
        raise HTTPException(404, "Unbekannter Sprachcode")
    if normalized == SOURCE_LANGUAGE:
        raise HTTPException(400, "Die Quellsprache wird nicht als Übersetzung geprüft")

    now = datetime.now(timezone.utc).isoformat()
    reviewer_id = str(admin.get("_id") or admin.get("id") or "")
    reviewed_at = now if payload.reviewed else None
    await db.games_translation_reviews.update_one(
        {"code": normalized},
        {"$set": {
            "code": normalized,
            "reviewed": payload.reviewed,
            "reviewed_at": reviewed_at,
            "note": payload.note,
            "reviewer_id": reviewer_id,
            "updated_at": now,
        }},
        upsert=True,
    )
    await db.games_translation_review_events.insert_one({
        "id": f"translation-review:{normalized}:{now}",
        "code": normalized,
        "reviewed": payload.reviewed,
        "note": payload.note,
        "reviewer_id": reviewer_id,
        "created_at": now,
    })
    row = await db.games_translation_reviews.find_one(
        {"code": normalized},
        {"_id": 0, "code": 1, "reviewed": 1, "reviewed_at": 1, "note": 1},
    )
    return _public_translation_review(normalized, row)
