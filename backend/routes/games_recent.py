"""Account-backed recent play history for BidBlitz Games.

This stores only game IDs and timestamps. No wallet, rewards, scores, device
fingerprints or monetary state are recorded here.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/recent", tags=["games-recent"])
_GAME_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
_MAX_RECENT = 20
_FIRST_PARTY_GAME_IDS = {"match", "bubble", "runner", "farm"}


def _game_id(value: str) -> str:
    value = str(value or "").strip().lower()
    if not _GAME_ID.fullmatch(value):
        raise HTTPException(400, "Ungültige Spiel-ID")
    return value


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


async def _assert_playable(game_id: str) -> str:
    game_id = _game_id(game_id)
    if game_id in _FIRST_PARTY_GAME_IDS:
        return game_id
    row = await db.games_catalog.find_one(
        {"id": game_id, "status": "published"},
        {"_id": 0, "id": 1},
    )
    if not row:
        raise HTTPException(404, "Spiel ist nicht verfügbar")
    return game_id


def _public(row: dict) -> dict:
    return {
        "game_id": row.get("game_id"),
        "last_played_at": row.get("last_played_at"),
    }


@router.get("")
async def list_recent_games(request: Request):
    owner_id = await _owner(request)
    rows = await db.games_recent_plays.find(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0, "launch_count": 0},
    ).sort("last_played_at", -1).limit(_MAX_RECENT).to_list(_MAX_RECENT)
    return {"games": [_public(row) for row in rows]}


@router.post("/{game_id}")
async def record_recent_game(game_id: str, request: Request):
    owner_id = await _owner(request)
    game_id = await _assert_playable(game_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.games_recent_plays.update_one(
        {"owner_id": owner_id, "game_id": game_id},
        {
            "$set": {"last_played_at": now},
            "$setOnInsert": {
                "owner_id": owner_id,
                "game_id": game_id,
                "created_at": now,
            },
            "$inc": {"launch_count": 1},
        },
        upsert=True,
    )
    return {"game_id": game_id, "last_played_at": now}


@router.delete("")
async def clear_recent_games(request: Request):
    owner_id = await _owner(request)
    result = await db.games_recent_plays.delete_many({"owner_id": owner_id})
    return {"cleared": int(getattr(result, "deleted_count", 0))}
