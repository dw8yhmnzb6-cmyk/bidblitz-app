"""
BidBlitz V2 — Investor Page API
Contact form for potential investors.
"""
import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel
from core.database import db

router = APIRouter(prefix="/api/investor", tags=["Investor"])
logger = logging.getLogger("bidblitz.investor")


class ContactReq(BaseModel):
    name: str
    email: str
    company: str = ""
    message: str = ""


@router.post("/contact")
async def submit_contact(req: ContactReq):
    """Submit an investor contact form."""
    contact = {
        "id": secrets.token_hex(8),
        "name": req.name,
        "email": req.email,
        "company": req.company,
        "message": req.message,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.investor_contacts.insert_one(contact)
    contact.pop("_id", None)
    logger.info(f"New investor contact: {req.name} ({req.email})")
    return {"ok": True, "message": "Thank you for your interest. We will be in touch."}


@router.get("/contacts")
async def list_contacts(request: Request):
    """Admin: list investor contacts."""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    contacts = await db.investor_contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"contacts": contacts, "total": len(contacts)}
