"""
BidBlitz V2 - Contacts & Quick-Send
Friends list, favorites, quick transfers
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from core.security import get_current_user
from core.database import db

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


class AddContactRequest(BaseModel):
    email: str
    nickname: str = ""


@router.get("")
async def get_contacts(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    contacts = await db.contacts.find({"user_id": user_id}, {"_id": 0}).sort("nickname", 1).to_list(200)
    # Enrich with user info
    for c in contacts:
        u = await db.users.find_one({"email": c["contact_email"]}, {"_id": 0, "password": 0, "name": 1, "email": 1})
        if u:
            c["name"] = u.get("name", c["contact_email"])
    return {"contacts": contacts}


@router.post("/add")
async def add_contact(req: AddContactRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    target = await db.users.find_one({"email": req.email})
    if not target:
        raise HTTPException(404, "User nicht gefunden")
    if str(target["_id"]) == user_id:
        raise HTTPException(400, "Du kannst dich nicht selbst hinzufügen")
    existing = await db.contacts.find_one({"user_id": user_id, "contact_email": req.email})
    if existing:
        raise HTTPException(400, "Kontakt existiert bereits")
    import secrets
    await db.contacts.insert_one({
        "contact_id": secrets.token_hex(8),
        "user_id": user_id,
        "contact_email": req.email,
        "contact_user_id": str(target["_id"]),
        "nickname": req.nickname or target.get("name", req.email),
        "favorite": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@router.post("/favorite/{contact_id}")
async def toggle_favorite(contact_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    c = await db.contacts.find_one({"contact_id": contact_id, "user_id": user_id})
    if not c:
        raise HTTPException(404)
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {"favorite": not c.get("favorite", False)}}
    )
    return {"ok": True, "favorite": not c.get("favorite", False)}


@router.delete("/{contact_id}")
async def remove_contact(contact_id: str, request: Request):
    user = await get_current_user(request)
    await db.contacts.delete_one({"contact_id": contact_id, "user_id": str(user["_id"])})
    return {"ok": True}
