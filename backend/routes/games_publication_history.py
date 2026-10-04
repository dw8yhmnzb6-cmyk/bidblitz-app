"""Publication history views for BidBlitz Games."""

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/game-studio", tags=["game-publication-history"])
admin_router = APIRouter(prefix="/api/admin/game-studio", tags=["admin-game-publication-history"])


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


async def _admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


async def _owned_draft(draft_id: str, owner_id: str) -> dict:
    draft = await db.game_studio_drafts.find_one(
        {"id": draft_id, "owner_id": owner_id, "status": "draft"},
        {"_id": 0, "owner_id": 0},
    )
    if not draft:
        raise HTTPException(404, "Spielentwurf nicht gefunden")
    return draft


def _event_view(row: dict) -> dict:
    return {
        "action": row.get("action"),
        "version_id": row.get("version_id"),
        "previous_version_id": row.get("previous_version_id"),
        "created_at": row.get("created_at"),
    }


@router.get("/drafts/{draft_id}/publication-history")
async def developer_publication_history(draft_id: str, request: Request):
    owner_id = await _owner(request)
    await _owned_draft(draft_id, owner_id)
    rows = await db.game_studio_publication_events.find(
        {"draft_id": draft_id},
        {"_id": 0, "owner_id": 0, "admin_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)
    return {"events": [_event_view(row) for row in rows]}


@admin_router.get("/games/{draft_id}/publication-history")
async def admin_publication_history(draft_id: str, request: Request):
    await _admin(request)
    draft = await db.game_studio_drafts.find_one({"id": draft_id}, {"_id": 0, "owner_id": 0})
    if not draft:
        raise HTTPException(404, "Spielentwurf nicht gefunden")
    rows = await db.game_studio_publication_events.find(
        {"draft_id": draft_id},
        {"_id": 0, "owner_id": 0},
    ).sort("created_at", -1).limit(200).to_list(200)
    return {"events": [_event_view(row) for row in rows]}
