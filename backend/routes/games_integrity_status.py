"""Privacy-minimal integrity status for BidBlitz Games admins."""

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/admin/game-studio/integrity", tags=["admin-games-integrity"])

_CONFIG = {
    "match": ("games_match_verified_progress", "server_replay"),
    "bubble": ("games_bubble_verified_progress", "server_replay"),
    "runner": ("games_runner_verified_progress", "server_replay"),
    "farm": (None, "no_competitive_score"),
}


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


@router.get("/status")
async def integrity_status(request: Request):
    await _admin(request)

    games = []
    total_verified_profiles = 0
    for game_id, (collection_name, mode) in _CONFIG.items():
        verified_profiles = 0
        if collection_name:
            collection = getattr(db, collection_name)
            verified_profiles = int(await collection.count_documents({
                "best": {"$elemMatch": {"$gt": 0}},
            }))
            total_verified_profiles += verified_profiles
        games.append({
            "game_id": game_id,
            "mode": mode,
            "verified_profiles": verified_profiles,
            "public_trusted_leaderboard_enabled": False,
        })

    active_sessions = int(await db.games_integrity_sessions.count_documents({
        "used": False,
    }))

    return {
        "games": games,
        "verified_profiles_total": total_verified_profiles,
        "active_replay_sessions": active_sessions,
        "public_trusted_leaderboards_enabled": False,
        "privacy": "aggregate_counts_only",
        "integrity": "server_replay_not_full_anti_cheat",
    }
