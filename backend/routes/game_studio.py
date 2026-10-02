"""Developer-owned game metadata drafts. No payments or publication in this phase."""

import json
from pathlib import Path

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Query, Request
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


def _valid_create_key(value: str) -> str:
    value = (value or "").strip()
    allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_:.";
    if not (16 <= len(value) <= 128) or any(ch not in allowed for ch in value):
        raise HTTPException(400, "Ungültiger Idempotency-Key")
    return value


def _duplicate_key(exc: Exception) -> bool:
    return exc.__class__.__name__ == "DuplicateKeyError" or getattr(exc, "code", None) == 11000


async def _existing_create(owner_id: str, create_key: str):
    request_doc = await db.game_studio_draft_requests.find_one({"_id": f"{owner_id}:{create_key}"})
    if not request_doc:
        return None
    if request_doc.get("status") == "deleted":
        raise HTTPException(410, "Dieser Entwurf wurde bereits gelöscht")
    draft_id = request_doc.get("draft_id")
    if draft_id:
        doc = await db.game_studio_drafts.find_one({"id": draft_id, "owner_id": owner_id})
        if doc:
            return _public_draft(doc)
    raise HTTPException(409, "Speichervorgang läuft. Bitte dieselbe Anfrage erneut senden.")


async def _reserve_slot(owner_id: str, draft_id: str, create_key: str, now: str) -> int:
    legacy = await db.game_studio_drafts.count_documents(
        {"owner_id": owner_id, "slot": {"$exists": False}}, limit=101
    )
    if legacy >= 100:
        raise HTTPException(409, "Maximal 100 Entwürfe pro Konto")
    for slot in range(legacy, 100):
        try:
            await db.game_studio_draft_slots.insert_one({
                "_id": f"{owner_id}:{slot}", "owner_id": owner_id, "slot": slot,
                "draft_id": draft_id, "create_key": create_key, "created_at": now,
            })
            return slot
        except Exception as exc:
            if not _duplicate_key(exc):
                raise
    raise HTTPException(409, "Maximal 100 Entwürfe pro Konto")


@router.get("/drafts")
async def list_drafts(request: Request):
    owner_id = await _owner(request)
    rows = await db.game_studio_drafts.find(
        {"owner_id": owner_id}, {"_id": 0, "owner_id": 0}
    ).sort("updated_at", -1).limit(100).to_list(100)
    return {"drafts": [_public_draft(row) for row in rows]}


@router.post("/drafts", status_code=201)
async def create_draft(
    request: Request,
    draft: GameDraftInput,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    owner_id = await _owner(request)
    create_key = _valid_create_key(idempotency_key)
    existing = await db.game_studio_draft_requests.find_one({"_id": f"{owner_id}:{create_key}"})
    if existing:
        return await _existing_create(owner_id, create_key)

    draft_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    request_doc = {
        "_id": f"{owner_id}:{create_key}", "owner_id": owner_id, "create_key": create_key,
        "draft_id": draft_id, "status": "reserving", "created_at": now, "updated_at": now,
    }
    try:
        await db.game_studio_draft_requests.insert_one(request_doc)
    except Exception as exc:
        if _duplicate_key(exc):
            return await _existing_create(owner_id, create_key)
        raise

    slot = None
    try:
        slot = await _reserve_slot(owner_id, draft_id, create_key, now)
        doc = {
            "id": draft_id, "owner_id": owner_id, "status": "draft", "revision": 1,
            "slot": slot, "create_key": create_key,
            **draft.model_dump(), "created_at": now, "updated_at": now,
        }
        await db.game_studio_drafts.insert_one(doc)
        await db.game_studio_draft_requests.update_one(
            {"_id": request_doc["_id"]},
            {"$set": {"status": "completed", "draft_id": draft_id, "updated_at": now}},
        )
        return _public_draft(doc)
    except Exception:
        if slot is not None:
            await db.game_studio_draft_slots.delete_one({"_id": f"{owner_id}:{slot}", "draft_id": draft_id})
        await db.game_studio_draft_requests.delete_one({"_id": request_doc["_id"], "status": "reserving"})
        raise


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
    await db.game_studio_draft_slots.delete_one({"owner_id": owner_id, "draft_id": draft_id})
    await db.game_studio_draft_requests.update_one(
        {"owner_id": owner_id, "draft_id": draft_id},
        {"$set": {"status": "deleted", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"deleted": True}

