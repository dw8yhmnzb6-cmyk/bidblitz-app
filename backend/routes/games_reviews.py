"""Non-monetary player reviews for BidBlitz Games.

Reviews are account-bound but public responses never expose owner IDs. Only the
first-party Match preview and currently published community games are reviewable.
Admin moderation is explicit and audited.
"""

import hashlib
import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/reviews", tags=["games-reviews"])
admin_router = APIRouter(prefix="/api/admin/games/reviews", tags=["admin-games-reviews"])

_GAME_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
_MAX_PUBLIC_REVIEWS = 50
_MAX_SUMMARY_GAMES = 50
_FIRST_PARTY_GAME_IDS = {"match", "bubble", "runner", "farm"}


class ReviewInput(BaseModel):
    rating: int = Field(strict=True, ge=1, le=5)
    text: str = Field(default="", max_length=1000)

    @field_validator("text", mode="before")
    @classmethod
    def normalize_text(cls, value):
        text = str(value or "").strip()
        if "\x00" in text:
            raise ValueError("Ungültiger Review-Text")
        return text


class ModerationInput(BaseModel):
    action: Literal["hide", "restore"]
    note: str = Field(default="", max_length=500)

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value):
        text = str(value or "").strip()
        if "\x00" in text:
            raise ValueError("Ungültige Moderationsnotiz")
        return text


def _game_id(value: str) -> str:
    value = str(value or "").strip().lower()
    if not _GAME_ID.fullmatch(value):
        raise HTTPException(400, "Ungültige Spiel-ID")
    return value


async def _user(request: Request) -> dict:
    return await get_current_user(request)


async def _admin(request: Request) -> dict:
    user = await _user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


async def _assert_reviewable_game(game_id: str) -> str:
    game_id = _game_id(game_id)
    if game_id in _FIRST_PARTY_GAME_IDS:
        return game_id
    game = await db.games_catalog.find_one(
        {"id": game_id, "status": "published"},
        {"_id": 0, "id": 1},
    )
    if not game:
        raise HTTPException(404, "Spiel ist nicht für Reviews verfügbar")
    return game_id


def _review_id(owner_id: str, game_id: str) -> str:
    return hashlib.sha256(f"{owner_id}:{game_id}".encode("utf-8")).hexdigest()[:32]


def _public_review(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "game_id": doc.get("game_id"),
        "rating": int(doc.get("rating") or 0),
        "text": str(doc.get("text") or ""),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _admin_review(doc: dict) -> dict:
    public = _public_review(doc)
    public.update({
        "status": doc.get("status", "visible"),
        "moderation_note": doc.get("moderation_note", ""),
        "moderated_at": doc.get("moderated_at"),
    })
    return public


async def _summary(game_id: str) -> dict:
    pipeline = [
        {"$match": {"game_id": game_id, "status": "visible"}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "average": {"$avg": "$rating"},
        }},
    ]
    rows = await db.games_reviews.aggregate(pipeline).to_list(1)
    if not rows:
        return {"count": 0, "average": None}
    count = int(rows[0].get("count") or 0)
    average = rows[0].get("average")
    return {
        "count": count,
        "average": round(float(average), 2) if average is not None else None,
    }


async def _reviewable_game_ids(game_ids: list[str]) -> list[str]:
    unique = []
    seen = set()
    for value in game_ids:
        game_id = _game_id(value)
        if game_id not in seen:
            seen.add(game_id)
            unique.append(game_id)
        if len(unique) > _MAX_SUMMARY_GAMES:
            raise HTTPException(400, "Zu viele Spiele angefragt")

    allowed = []
    allowed.extend(game_id for game_id in unique if game_id in _FIRST_PARTY_GAME_IDS)

    community_ids = [game_id for game_id in unique if game_id not in _FIRST_PARTY_GAME_IDS]
    if community_ids:
        rows = await db.games_catalog.find(
            {"id": {"$in": community_ids}, "status": "published"},
            {"_id": 0, "id": 1},
        ).limit(_MAX_SUMMARY_GAMES).to_list(_MAX_SUMMARY_GAMES)
        published = {row.get("id") for row in rows if row.get("id")}
        allowed.extend(game_id for game_id in unique if game_id in published)

    return allowed


@router.get("/summaries")
async def review_summaries(game_ids: str = ""):
    requested = [part.strip() for part in str(game_ids or "").split(",") if part.strip()]
    if not requested:
        return {"summaries": {}}

    allowed = await _reviewable_game_ids(requested)
    summaries = {game_id: {"count": 0, "average": None} for game_id in allowed}
    if not allowed:
        return {"summaries": summaries}

    pipeline = [
        {"$match": {"game_id": {"$in": allowed}, "status": "visible"}},
        {"$group": {
            "_id": "$game_id",
            "count": {"$sum": 1},
            "average": {"$avg": "$rating"},
        }},
    ]
    rows = await db.games_reviews.aggregate(pipeline).to_list(_MAX_SUMMARY_GAMES)
    for row in rows:
        game_id = row.get("_id")
        if game_id not in summaries:
            continue
        count = int(row.get("count") or 0)
        average = row.get("average")
        summaries[game_id] = {
            "count": count,
            "average": round(float(average), 2) if average is not None else None,
        }
    return {"summaries": summaries}


@router.get("/{game_id}")
async def list_public_reviews(game_id: str):
    game_id = await _assert_reviewable_game(game_id)
    rows = await db.games_reviews.find(
        {"game_id": game_id, "status": "visible"},
        {"_id": 0, "owner_id": 0, "moderated_by": 0, "moderation_note": 0},
    ).sort("updated_at", -1).limit(_MAX_PUBLIC_REVIEWS).to_list(_MAX_PUBLIC_REVIEWS)
    return {
        "game_id": game_id,
        "summary": await _summary(game_id),
        "reviews": [_public_review(row) for row in rows],
    }


@router.get("/{game_id}/mine")
async def get_my_review(game_id: str, request: Request):
    game_id = await _assert_reviewable_game(game_id)
    user = await _user(request)
    owner_id = str(user["_id"])
    row = await db.games_reviews.find_one(
        {"owner_id": owner_id, "game_id": game_id},
        {"_id": 0, "owner_id": 0, "moderated_by": 0},
    )
    if not row:
        return {"review": None}
    return {"review": _admin_review(row)}


@router.put("/{game_id}")
async def upsert_review(game_id: str, payload: ReviewInput, request: Request):
    game_id = await _assert_reviewable_game(game_id)
    user = await _user(request)
    owner_id = str(user["_id"])
    review_id = _review_id(owner_id, game_id)
    now = datetime.now(timezone.utc).isoformat()

    await db.games_reviews.update_one(
        {"owner_id": owner_id, "game_id": game_id},
        {
            "$set": {
                "id": review_id,
                "rating": payload.rating,
                "text": payload.text,
                "updated_at": now,
            },
            "$setOnInsert": {
                "owner_id": owner_id,
                "game_id": game_id,
                "status": "visible",
                "created_at": now,
            },
        },
        upsert=True,
    )
    row = await db.games_reviews.find_one(
        {"owner_id": owner_id, "game_id": game_id},
        {"_id": 0, "owner_id": 0, "moderated_by": 0},
    )
    return {
        "review": _admin_review(row or {}),
        "summary": await _summary(game_id),
    }


@router.delete("/{game_id}")
async def delete_my_review(game_id: str, request: Request):
    game_id = await _assert_reviewable_game(game_id)
    user = await _user(request)
    owner_id = str(user["_id"])
    result = await db.games_reviews.delete_one({"owner_id": owner_id, "game_id": game_id})
    return {
        "deleted": bool(getattr(result, "deleted_count", 0)),
        "summary": await _summary(game_id),
    }


@admin_router.get("")
async def list_reviews_for_moderation(request: Request, status: str = "visible", limit: int = 100):
    await _admin(request)
    if status not in {"visible", "hidden"}:
        raise HTTPException(400, "Ungültiger Review-Status")
    limit = max(1, min(int(limit or 100), 200))
    rows = await db.games_reviews.find(
        {"status": status},
        {"_id": 0, "owner_id": 0, "moderated_by": 0},
    ).sort("updated_at", -1).limit(limit).to_list(limit)
    return {"reviews": [_admin_review(row) for row in rows], "count": len(rows)}


@admin_router.post("/{review_id}/moderate")
async def moderate_review(review_id: str, payload: ModerationInput, request: Request):
    admin = await _admin(request)
    review_id = str(review_id or "").strip().lower()
    if not re.fullmatch(r"[a-f0-9]{32}", review_id):
        raise HTTPException(400, "Ungültige Review-ID")

    target_status = "hidden" if payload.action == "hide" else "visible"
    now = datetime.now(timezone.utc).isoformat()
    admin_id = str(admin.get("_id") or admin.get("id") or "")
    result = await db.games_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "status": target_status,
            "moderation_note": payload.note,
            "moderated_at": now,
            "moderated_by": admin_id,
            "updated_at": now,
        }},
    )
    if not getattr(result, "matched_count", 0):
        raise HTTPException(404, "Review nicht gefunden")

    row = await db.games_reviews.find_one({"id": review_id}, {"_id": 0})
    await db.games_review_moderation_events.insert_one({
        "review_id": review_id,
        "game_id": (row or {}).get("game_id"),
        "action": payload.action,
        "note": payload.note,
        "admin_id": admin_id,
        "created_at": now,
    })
    return {"review": _admin_review(row or {})}
