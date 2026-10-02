"""Developer-owned game metadata drafts. No payments or publication in this phase."""

import json
from pathlib import Path

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/game-studio", tags=["game-studio"])

# Checked deployment copy of frontend/src/config/gamesLanguages.json.
_language_registry = json.loads(
    (Path(__file__).resolve().parents[1] / "data" / "games_languages.json").read_text(encoding="utf-8")
)
SUPPORTED_LANGUAGES = frozenset(entry["code"] for entry in _language_registry)


class GameDraftInput(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    description: str = Field(min_length=30, max_length=2000)
    category: Literal["Puzzle", "Arcade", "Strategy", "Sports"]
    languages: list[str] = Field(min_length=1, max_length=len(SUPPORTED_LANGUAGES))
    rights_confirmed: bool

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_text(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Text erforderlich")
        value = value.strip()
        if not value:
            raise ValueError("Text darf nicht leer sein")
        return value

    @field_validator("languages")
    @classmethod
    def validate_languages(cls, languages: list[str]) -> list[str]:
        if len(set(languages)) != len(languages) or any(code not in SUPPORTED_LANGUAGES for code in languages):
            raise ValueError("Ungültige oder doppelte Sprachcodes")
        return languages

    @field_validator("rights_confirmed")
    @classmethod
    def require_rights(cls, confirmed: bool) -> bool:
        if not confirmed:
            raise ValueError("Rechtebestätigung erforderlich")
        return confirmed


class GameDraftUpdate(GameDraftInput):
    revision: int = Field(ge=0, strict=True)


def _public_draft(doc: dict) -> dict:
    public = {key: value for key, value in doc.items() if key not in {"_id", "owner_id"}}
    public.setdefault("revision", 0)
    return public


def _edit_query(draft_id: str, owner_id: str, revision: int) -> dict:
    query = {"id": draft_id, "owner_id": owner_id, "status": "draft"}
    if revision == 0:
        query["$or"] = [{"revision": 0}, {"revision": {"$exists": False}}]
    else:
        query["revision"] = revision
    return query


async def _edit_failed(draft_id: str, owner_id: str):
    existing = await db.game_studio_drafts.find_one({"id": draft_id, "owner_id": owner_id})
    if existing is None:
        raise HTTPException(404, "Entwurf nicht gefunden")
    raise HTTPException(409, "Entwurf wurde geändert. Bitte den aktuellen Stand neu laden.")


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


@router.get("/drafts")
async def list_drafts(request: Request):
    owner_id = await _owner(request)
    rows = await db.game_studio_drafts.find(
        {"owner_id": owner_id}, {"_id": 0, "owner_id": 0}
    ).sort("updated_at", -1).limit(100).to_list(100)
    return {"drafts": [_public_draft(row) for row in rows]}


@router.post("/drafts", status_code=201)
async def create_draft(request: Request, draft: GameDraftInput):
    owner_id = await _owner(request)
    if await db.game_studio_drafts.count_documents({"owner_id": owner_id}, limit=101) >= 100:
        raise HTTPException(409, "Maximal 100 Entwürfe pro Konto")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid4()), "owner_id": owner_id, "status": "draft", "revision": 1,
        **draft.model_dump(), "created_at": now, "updated_at": now,
    }
    await db.game_studio_drafts.insert_one(doc)
    return _public_draft(doc)


@router.get("/drafts/{draft_id}")
async def get_draft(draft_id: str, request: Request):
    owner_id = await _owner(request)
    doc = await db.game_studio_drafts.find_one(
        {"id": draft_id, "owner_id": owner_id}, {"_id": 0, "owner_id": 0}
    )
    if doc is None:
        raise HTTPException(404, "Entwurf nicht gefunden")
    return _public_draft(doc)


@router.put("/drafts/{draft_id}")
async def update_draft(draft_id: str, request: Request, draft: GameDraftUpdate):
    owner_id = await _owner(request)
    updates = {**draft.model_dump(exclude={"revision"}), "updated_at": datetime.now(timezone.utc).isoformat()}
    result = await db.game_studio_drafts.update_one(
        _edit_query(draft_id, owner_id, draft.revision),
        {"$set": updates, "$inc": {"revision": 1}}
    )
    if not result.matched_count:
        await _edit_failed(draft_id, owner_id)
    return {"id": draft_id, "revision": draft.revision + 1, "saved": True}


@router.delete("/drafts/{draft_id}")
async def delete_draft(draft_id: str, request: Request, revision: int = Query(..., ge=0)):
    owner_id = await _owner(request)
    result = await db.game_studio_drafts.delete_one(
        _edit_query(draft_id, owner_id, revision)
    )
    if not result.deleted_count:
        await _edit_failed(draft_id, owner_id)
    return {"deleted": True}

