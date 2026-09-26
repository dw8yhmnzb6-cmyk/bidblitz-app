"""Developer-owned game metadata drafts. No payments or publication in this phase."""

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/game-studio", tags=["game-studio"])


class GameDraftInput(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    description: str = Field(min_length=30, max_length=2000)
    category: Literal["Puzzle", "Arcade", "Strategy", "Sports"]
    languages: list[str] = Field(min_length=1, max_length=40)
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
        if len(set(languages)) != len(languages) or any(
            len(code) < 2 or len(code) > 12 or
            not code.replace("-", "").isalpha() or code != code.lower()
            for code in languages
        ):
            raise ValueError("Ungültige oder doppelte Sprachcodes")
        return languages

    @field_validator("rights_confirmed")
    @classmethod
    def require_rights(cls, confirmed: bool) -> bool:
        if not confirmed:
            raise ValueError("Rechtebestätigung erforderlich")
        return confirmed


def _public_draft(doc: dict) -> dict:
    return {key: value for key, value in doc.items() if key not in {"_id", "owner_id"}}


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


@router.get("/drafts")
async def list_drafts(request: Request):
    owner_id = await _owner(request)
    rows = await db.game_studio_drafts.find(
        {"owner_id": owner_id}, {"_id": 0, "owner_id": 0}
    ).sort("updated_at", -1).limit(100).to_list(100)
    return {"drafts": rows}


@router.post("/drafts", status_code=201)
async def create_draft(request: Request, draft: GameDraftInput):
    owner_id = await _owner(request)
    if await db.game_studio_drafts.count_documents({"owner_id": owner_id}, limit=101) >= 100:
        raise HTTPException(409, "Maximal 100 Entwürfe pro Konto")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid4()), "owner_id": owner_id, "status": "draft",
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
    return doc


@router.put("/drafts/{draft_id}")
async def update_draft(draft_id: str, request: Request, draft: GameDraftInput):
    owner_id = await _owner(request)
    updates = {**draft.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    result = await db.game_studio_drafts.update_one(
        {"id": draft_id, "owner_id": owner_id, "status": "draft"}, {"$set": updates}
    )
    if not result.matched_count:
        raise HTTPException(404, "Bearbeitbarer Entwurf nicht gefunden")
    return await get_draft(draft_id, request)


@router.delete("/drafts/{draft_id}")
async def delete_draft(draft_id: str, request: Request):
    owner_id = await _owner(request)
    result = await db.game_studio_drafts.delete_one(
        {"id": draft_id, "owner_id": owner_id, "status": "draft"}
    )
    if not result.deleted_count:
        raise HTTPException(404, "Bearbeitbarer Entwurf nicht gefunden")
    return {"deleted": True}
