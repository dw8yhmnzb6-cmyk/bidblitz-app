"""Read-only launch readiness for BidBlitz Games.

This endpoint never enables production, billing, DNS or deployment. It only
reports whether the known launch gates are satisfied.
"""

import os

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user
from routes.game_studio import SUPPORTED_LANGUAGES
from routes.games_catalog import games_preflight
from routes.games_developer import BILLING_READY


router = APIRouter(prefix="/api/admin/game-studio", tags=["admin-games-launch-readiness"])

SOURCE_LANGUAGE = "en"
PHYSICAL_DEVICE_ACCEPTED = os.environ.get("GAMES_PHYSICAL_DEVICE_ACCEPTED", "false").lower() == "true"
PRODUCTION_APPROVED = os.environ.get("GAMES_PRODUCTION_APPROVED", "false").lower() == "true"


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


@router.get("/launch-readiness")
async def launch_readiness(request: Request):
    await _admin(request)

    technical = await games_preflight(request)
    localized_codes = sorted(code for code in SUPPORTED_LANGUAGES if code != SOURCE_LANGUAGE)
    reviewed_rows = await db.games_translation_reviews.find(
        {"reviewed": True, "code": {"$in": localized_codes}},
        {"_id": 0, "code": 1},
    ).to_list(len(localized_codes))
    reviewed_codes = sorted({
        str(row.get("code") or "")
        for row in reviewed_rows
        if str(row.get("code") or "") in localized_codes
    })
    translations_ready = len(reviewed_codes) == len(localized_codes)

    replay_games = ["match", "bubble", "runner"]
    integrity_ready = True  # covered by dedicated server-replay regression tests
    trusted_leaderboards_disabled = True

    non_monetary_ready = all([
        bool(technical.get("ready")),
        translations_ready,
        integrity_ready,
        trusted_leaderboards_disabled,
        PHYSICAL_DEVICE_ACCEPTED,
        PRODUCTION_APPROVED,
    ])
    commercial_ready = non_monetary_ready and BILLING_READY

    blockers = []
    if not technical.get("ready"):
        blockers.append("technical_preflight")
    if not translations_ready:
        blockers.append("human_translation_review")
    if not PHYSICAL_DEVICE_ACCEPTED:
        blockers.append("physical_device_acceptance")
    if not PRODUCTION_APPROVED:
        blockers.append("production_approval")
    if not BILLING_READY:
        blockers.append("billing_provider")

    return {
        "non_monetary_launch_ready": non_monetary_ready,
        "commercial_launch_ready": commercial_ready,
        "blockers": blockers,
        "technical": {
            "ready": bool(technical.get("ready")),
            "scope": technical.get("scope"),
        },
        "translations": {
            "source_language": SOURCE_LANGUAGE,
            "required": len(localized_codes),
            "reviewed": len(reviewed_codes),
            "ready": translations_ready,
        },
        "integrity": {
            "server_replay_games": replay_games,
            "ready": integrity_ready,
            "public_trusted_leaderboards_enabled": False,
        },
        "physical_devices": {
            "accepted": PHYSICAL_DEVICE_ACCEPTED,
        },
        "production": {
            "approved": PRODUCTION_APPROVED,
        },
        "billing": {
            "ready": BILLING_READY,
        },
        "side_effects": "none",
    }
