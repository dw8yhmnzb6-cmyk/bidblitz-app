"""Operator review for quarantined BidBlitz Games submissions.

Review approval does not publish or execute third-party code. It only advances
the metadata workflow toward a future isolated preview environment.
"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/admin/game-studio", tags=["admin-game-studio"])


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
        if key not in {"_id", "owner_id", "storage_path", "create_key"}
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
