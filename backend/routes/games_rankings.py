"""Private, privacy-minimal personal rankings for first-party BidBlitz Games.

The current first-party progress is client-synced and therefore not an
anti-cheat source of truth. This endpoint deliberately exposes only the
authenticated player's own position and aggregate participant counts. It never
returns another player's account ID, name, email or score row.
"""

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/rankings", tags=["games-rankings"])

_GAME_CONFIG = {
    "match": ("games_match_progress", 30),
    "bubble": ("games_bubble_progress", 20),
    "runner": ("games_runner_progress", 15),
}


def _clean_scores(values, levels: int) -> list[int]:
    if not isinstance(values, list) or len(values) != levels:
        return [0] * levels
    return [
        value if type(value) is int and 0 <= value <= 1_000_000_000 else 0
        for value in values
    ]


def _clean_stars(values, levels: int) -> list[int]:
    if not isinstance(values, list) or len(values) != levels:
        return [0] * levels
    return [
        value if type(value) is int and 0 <= value <= 3 else 0
        for value in values
    ]


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


def _collection_for(game_id: str):
    config = _GAME_CONFIG.get(game_id)
    if not config:
        raise HTTPException(404, "Ranking für dieses Spiel ist nicht verfügbar")
    collection_name, levels = config
    return getattr(db, collection_name), levels


@router.get("/{game_id}/me")
async def get_personal_ranking(game_id: str, request: Request):
    """Return only the signed-in player's own practice rank and aggregates."""
    normalized = str(game_id or "").strip().lower()
    collection, levels = _collection_for(normalized)
    owner_id = await _owner(request)
    verified = False
    integrity = "client_synced_unverified"

    verified_collection = None
    if normalized == "runner":
        verified_collection = db.games_runner_verified_progress
    elif normalized == "bubble":
        verified_collection = db.games_bubble_verified_progress

    if verified_collection is not None:
        verified_row = await verified_collection.find_one(
            {"owner_id": owner_id},
            {"_id": 0, "owner_id": 0, "best": 1, "stars": 1},
        )
        verified_best = _clean_scores((verified_row or {}).get("best"), levels)
        if sum(verified_best) > 0:
            collection = verified_collection
            verified = True
            integrity = "server_replayed_not_full_anti_cheat"

    row = await collection.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0, "best": 1, "stars": 1, "unlocked": 1},
    )
    best = _clean_scores((row or {}).get("best"), levels)
    stars = _clean_stars((row or {}).get("stars"), levels)
    total_score = sum(best)
    total_stars = sum(stars)
    completed_levels = sum(1 for value in best if value > 0)

    participant_filter = {"best": {"$elemMatch": {"$gt": 0}}}
    participants = await collection.count_documents(participant_filter)

    rank = None
    if total_score > 0:
        better = await collection.count_documents({
            **participant_filter,
            "$expr": {"$gt": [{"$sum": "$best"}, total_score]},
        })
        rank = int(better) + 1

    return {
        "game_id": normalized,
        "mode": "server_replayed" if verified else "practice",
        "verified": verified,
        "public_leaderboard_enabled": False,
        "rank": rank,
        "participants": int(participants),
        "total_score": int(total_score),
        "total_stars": int(total_stars),
        "completed_levels": int(completed_levels),
        "max_levels": levels,
        "privacy": "private_self_only",
        "integrity": integrity,
    }
