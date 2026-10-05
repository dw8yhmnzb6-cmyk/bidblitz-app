"""Account-backed monotonic progress for the first-party Match preview.

Only level unlocks, best scores and stars are synchronized. Coins, purchases,
lives, RNG and the active board remain device-local and are never accepted here.
"""

from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/progress", tags=["games-progress"])
_LEVELS = 30
_BUBBLE_LEVELS = 20
_RUNNER_LEVELS = 15


Score = Annotated[int, Field(strict=True, ge=0, le=1_000_000_000)]
Star = Annotated[int, Field(strict=True, ge=0, le=3)]


class MatchProgressInput(BaseModel):
    version: Literal[1] = 1
    unlocked: int = Field(ge=1, le=_LEVELS, strict=True)
    best: list[Score] = Field(min_length=_LEVELS, max_length=_LEVELS)
    stars: list[Star] = Field(min_length=_LEVELS, max_length=_LEVELS)

    @field_validator("best")
    @classmethod
    def validate_best(cls, values: list[int]) -> list[int]:
        if any(type(value) is not int or value < 0 or value > 1_000_000_000 for value in values):
            raise ValueError("Ungültige Bestwerte")
        return values

    @field_validator("stars")
    @classmethod
    def validate_stars(cls, values: list[int]) -> list[int]:
        if any(type(value) is not int or value < 0 or value > 3 for value in values):
            raise ValueError("Ungültige Sterne")
        return values

    @model_validator(mode="after")
    def validate_sequence(self):
        completed = 0
        gap_seen = False
        for index, (score, stars) in enumerate(zip(self.best, self.stars)):
            if score == 0:
                if stars != 0:
                    raise ValueError("Sterne ohne abgeschlossenen Level")
                gap_seen = True
                continue
            if gap_seen or stars < 1:
                raise ValueError("Ungültige Level-Reihenfolge")
            completed = index + 1
        expected_unlocked = 1 if completed == 0 else min(_LEVELS, completed + 1)
        if self.unlocked != expected_unlocked:
            raise ValueError("Freigeschaltetes Level passt nicht zum Fortschritt")
        return self


class BubbleProgressInput(BaseModel):
    version: Literal[1] = 1
    unlocked: int = Field(ge=1, le=_BUBBLE_LEVELS, strict=True)
    best: list[Score] = Field(min_length=_BUBBLE_LEVELS, max_length=_BUBBLE_LEVELS)
    stars: list[Star] = Field(min_length=_BUBBLE_LEVELS, max_length=_BUBBLE_LEVELS)

    @field_validator("best")
    @classmethod
    def validate_best(cls, values: list[int]) -> list[int]:
        if any(type(value) is not int or value < 0 or value > 1_000_000_000 for value in values):
            raise ValueError("Ungültige Bestwerte")
        return values

    @field_validator("stars")
    @classmethod
    def validate_stars(cls, values: list[int]) -> list[int]:
        if any(type(value) is not int or value < 0 or value > 3 for value in values):
            raise ValueError("Ungültige Sterne")
        return values

    @model_validator(mode="after")
    def validate_sequence(self):
        completed = 0
        gap_seen = False
        for index, (score, stars) in enumerate(zip(self.best, self.stars)):
            if score == 0:
                if stars != 0:
                    raise ValueError("Sterne ohne abgeschlossenen Level")
                gap_seen = True
                continue
            if gap_seen or stars < 1:
                raise ValueError("Ungültige Level-Reihenfolge")
            completed = index + 1
        expected_unlocked = 1 if completed == 0 else min(_BUBBLE_LEVELS, completed + 1)
        if self.unlocked != expected_unlocked:
            raise ValueError("Freigeschaltetes Level passt nicht zum Fortschritt")
        return self


class RunnerProgressInput(BaseModel):
    version: Literal[1] = 1
    unlocked: int = Field(ge=1, le=_RUNNER_LEVELS, strict=True)
    best: list[Score] = Field(min_length=_RUNNER_LEVELS, max_length=_RUNNER_LEVELS)
    stars: list[Star] = Field(min_length=_RUNNER_LEVELS, max_length=_RUNNER_LEVELS)

    @field_validator("best")
    @classmethod
    def validate_best(cls, values: list[int]) -> list[int]:
        if any(type(value) is not int or value < 0 or value > 1_000_000_000 for value in values):
            raise ValueError("Ungültige Bestwerte")
        return values

    @field_validator("stars")
    @classmethod
    def validate_stars(cls, values: list[int]) -> list[int]:
        if any(type(value) is not int or value < 0 or value > 3 for value in values):
            raise ValueError("Ungültige Sterne")
        return values

    @model_validator(mode="after")
    def validate_sequence(self):
        completed = 0
        gap_seen = False
        for index, (score, stars) in enumerate(zip(self.best, self.stars)):
            if score == 0:
                if stars != 0:
                    raise ValueError("Sterne ohne abgeschlossenen Level")
                gap_seen = True
                continue
            if gap_seen or stars < 1:
                raise ValueError("Ungültige Level-Reihenfolge")
            completed = index + 1
        expected_unlocked = 1 if completed == 0 else min(_RUNNER_LEVELS, completed + 1)
        if self.unlocked != expected_unlocked:
            raise ValueError("Freigeschaltetes Level passt nicht zum Fortschritt")
        return self


def _duplicate_key(exc: Exception) -> bool:
    return exc.__class__.__name__ == "DuplicateKeyError" or getattr(exc, "code", None) == 11000


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


def _default_progress() -> dict:
    return {"version": 1, "unlocked": 1, "best": [0] * _LEVELS, "stars": [0] * _LEVELS, "updated_at": None}


def _public(doc: dict | None) -> dict:
    if not doc:
        return _default_progress()
    best = doc.get("best") if isinstance(doc.get("best"), list) and len(doc["best"]) == _LEVELS else [0] * _LEVELS
    stars = doc.get("stars") if isinstance(doc.get("stars"), list) and len(doc["stars"]) == _LEVELS else [0] * _LEVELS
    return {
        "version": 1,
        "unlocked": max(1, min(_LEVELS, int(doc.get("unlocked") or 1))),
        "best": [int(value) if isinstance(value, int) and 0 <= value <= 1_000_000_000 else 0 for value in best],
        "stars": [int(value) if isinstance(value, int) and 0 <= value <= 3 else 0 for value in stars],
        "updated_at": doc.get("updated_at"),
    }


async def _ensure_progress(owner_id: str, now: str):
    try:
        await db.games_match_progress.update_one(
            {"owner_id": owner_id},
            {"$setOnInsert": {
                "owner_id": owner_id,
                "version": 1,
                "unlocked": 1,
                "best": [0] * _LEVELS,
                "stars": [0] * _LEVELS,
                "created_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )
    except Exception as exc:
        if not _duplicate_key(exc):
            raise


async def _read(owner_id: str) -> dict:
    doc = await db.games_match_progress.find_one({"owner_id": owner_id}, {"_id": 0, "owner_id": 0})
    return _public(doc)


@router.get("/match")
async def get_match_progress(request: Request):
    return await _read(await _owner(request))


@router.put("/match")
async def save_match_progress(request: Request, progress: MatchProgressInput):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc).isoformat()
    await _ensure_progress(owner_id, now)
    maxima = {"unlocked": progress.unlocked}
    maxima.update({f"best.{index}": value for index, value in enumerate(progress.best)})
    maxima.update({f"stars.{index}": value for index, value in enumerate(progress.stars)})
    await db.games_match_progress.update_one(
        {"owner_id": owner_id},
        {"$max": maxima, "$set": {"version": 1, "updated_at": now}},
    )
    return await _read(owner_id)


def _default_bubble_progress() -> dict:
    return {
        "version": 1,
        "unlocked": 1,
        "best": [0] * _BUBBLE_LEVELS,
        "stars": [0] * _BUBBLE_LEVELS,
        "updated_at": None,
    }


def _public_bubble(doc: dict | None) -> dict:
    if not doc:
        return _default_bubble_progress()
    best = doc.get("best") if isinstance(doc.get("best"), list) and len(doc["best"]) == _BUBBLE_LEVELS else [0] * _BUBBLE_LEVELS
    stars = doc.get("stars") if isinstance(doc.get("stars"), list) and len(doc["stars"]) == _BUBBLE_LEVELS else [0] * _BUBBLE_LEVELS
    return {
        "version": 1,
        "unlocked": max(1, min(_BUBBLE_LEVELS, int(doc.get("unlocked") or 1))),
        "best": [int(value) if isinstance(value, int) and 0 <= value <= 1_000_000_000 else 0 for value in best],
        "stars": [int(value) if isinstance(value, int) and 0 <= value <= 3 else 0 for value in stars],
        "updated_at": doc.get("updated_at"),
    }


async def _ensure_bubble_progress(owner_id: str, now: str):
    try:
        await db.games_bubble_progress.update_one(
            {"owner_id": owner_id},
            {"$setOnInsert": {
                "owner_id": owner_id,
                "version": 1,
                "unlocked": 1,
                "best": [0] * _BUBBLE_LEVELS,
                "stars": [0] * _BUBBLE_LEVELS,
                "created_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )
    except Exception as exc:
        if not _duplicate_key(exc):
            raise


async def _read_bubble(owner_id: str) -> dict:
    doc = await db.games_bubble_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0},
    )
    return _public_bubble(doc)


@router.get("/bubble")
async def get_bubble_progress(request: Request):
    return await _read_bubble(await _owner(request))


@router.put("/bubble")
async def save_bubble_progress(request: Request, progress: BubbleProgressInput):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc).isoformat()
    await _ensure_bubble_progress(owner_id, now)
    maxima = {"unlocked": progress.unlocked}
    maxima.update({f"best.{index}": value for index, value in enumerate(progress.best)})
    maxima.update({f"stars.{index}": value for index, value in enumerate(progress.stars)})
    await db.games_bubble_progress.update_one(
        {"owner_id": owner_id},
        {"$max": maxima, "$set": {"version": 1, "updated_at": now}},
    )
    return await _read_bubble(owner_id)


def _default_runner_progress() -> dict:
    return {
        "version": 1,
        "unlocked": 1,
        "best": [0] * _RUNNER_LEVELS,
        "stars": [0] * _RUNNER_LEVELS,
        "updated_at": None,
    }


def _public_runner(doc: dict | None) -> dict:
    if not doc:
        return _default_runner_progress()
    best = doc.get("best") if isinstance(doc.get("best"), list) and len(doc["best"]) == _RUNNER_LEVELS else [0] * _RUNNER_LEVELS
    stars = doc.get("stars") if isinstance(doc.get("stars"), list) and len(doc["stars"]) == _RUNNER_LEVELS else [0] * _RUNNER_LEVELS
    return {
        "version": 1,
        "unlocked": max(1, min(_RUNNER_LEVELS, int(doc.get("unlocked") or 1))),
        "best": [int(value) if isinstance(value, int) and 0 <= value <= 1_000_000_000 else 0 for value in best],
        "stars": [int(value) if isinstance(value, int) and 0 <= value <= 3 else 0 for value in stars],
        "updated_at": doc.get("updated_at"),
    }


async def _ensure_runner_progress(owner_id: str, now: str):
    try:
        await db.games_runner_progress.update_one(
            {"owner_id": owner_id},
            {"$setOnInsert": {
                "owner_id": owner_id,
                "version": 1,
                "unlocked": 1,
                "best": [0] * _RUNNER_LEVELS,
                "stars": [0] * _RUNNER_LEVELS,
                "created_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )
    except Exception as exc:
        if not _duplicate_key(exc):
            raise


async def _read_runner(owner_id: str) -> dict:
    doc = await db.games_runner_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0},
    )
    return _public_runner(doc)


@router.get("/runner")
async def get_runner_progress(request: Request):
    return await _read_runner(await _owner(request))


@router.put("/runner")
async def save_runner_progress(request: Request, progress: RunnerProgressInput):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc).isoformat()
    await _ensure_runner_progress(owner_id, now)
    maxima = {"unlocked": progress.unlocked}
    maxima.update({f"best.{index}": value for index, value in enumerate(progress.best)})
    maxima.update({f"stars.{index}": value for index, value in enumerate(progress.stars)})
    await db.games_runner_progress.update_one(
        {"owner_id": owner_id},
        {"$max": maxima, "$set": {"version": 1, "updated_at": now}},
    )
    return await _read_runner(owner_id)
