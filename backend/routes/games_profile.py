"""Account-backed BidBlitz Games preferences. No monetary state or rewards."""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/profile", tags=["games-profile"])
_GAME_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
_MAX_FAVORITES = 100


def _game_id(value: str) -> str:
    value = (value or "").strip().lower()
    if not _GAME_ID.fullmatch(value):
        raise HTTPException(400, "Ungültige Spiel-ID")
    return value


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


async def _profile(owner_id: str) -> dict:
    doc = await db.games_profiles.find_one({"owner_id": owner_id}, {"_id": 0, "owner_id": 0})
    if not doc:
        return {"favorites": [], "updated_at": None}
    favorites = [item for item in doc.get("favorites", []) if isinstance(item, str) and _GAME_ID.fullmatch(item)]
    return {"favorites": favorites[:_MAX_FAVORITES], "updated_at": doc.get("updated_at")}


@router.get("")
async def get_profile(request: Request):
    return await _profile(await _owner(request))


@router.post("/favorites/{game_id}")
async def add_favorite(game_id: str, request: Request):
    owner_id = await _owner(request)
    game_id = _game_id(game_id)
    existing = await db.games_profiles.find_one({"owner_id": owner_id}, {"favorites": 1}) or {}
    favorites = existing.get("favorites") or []
    if game_id not in favorites and len(favorites) >= _MAX_FAVORITES:
        raise HTTPException(409, "Maximal 100 gemerkte Spiele pro Konto")
    now = datetime.now(timezone.utc).isoformat()
    await db.games_profiles.update_one(
        {"owner_id": owner_id},
        {
            "$addToSet": {"favorites": game_id},
            "$set": {"updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return await _profile(owner_id)


@router.delete("/favorites/{game_id}")
async def remove_favorite(game_id: str, request: Request):
    owner_id = await _owner(request)
    game_id = _game_id(game_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.games_profiles.update_one(
        {"owner_id": owner_id},
        {"$pull": {"favorites": game_id}, "$set": {"updated_at": now}},
        upsert=False,
    )
    return await _profile(owner_id)
