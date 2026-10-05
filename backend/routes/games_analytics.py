"""Privacy-minimal public launch counters for BidBlitz Games.

Counters are approximate operational metrics only. They contain no account ID,
IP address, device fingerprint, wallet value, reward state or monetary data.
They must never be used as a billing or payout source of truth.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from core.database import db


router = APIRouter(prefix="/api/games/analytics", tags=["games-analytics"])
_GAME_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
_FIRST_PARTY_GAME_IDS = {"match", "bubble"}


def _game_id(value: str) -> str:
    value = str(value or "").strip().lower()
    if not _GAME_ID.fullmatch(value):
        raise HTTPException(400, "Ungültige Spiel-ID")
    return value


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


@router.post("/{game_id}/launch")
async def record_game_launch(game_id: str):
    game_id = await _assert_playable(game_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.games_launch_totals.update_one(
        {"game_id": game_id},
        {
            "$inc": {"launches": 1},
            "$set": {"updated_at": now},
            "$setOnInsert": {
                "game_id": game_id,
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {
        "recorded": True,
        "game_id": game_id,
        "measurement": "approximate_launches",
        "monetary": False,
    }
