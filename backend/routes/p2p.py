"""
P2P Payments with @handle
Cash App / Venmo / Revolut-style: users claim a unique @handle ($bidblitz.ahmet)
and send money to each other by handle (no IBAN needed).
"""
import re
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.payment_engine import transfer_between_wallets, TransactionType
from core.audit import log_audit, AuditEvent, get_client_info

router = APIRouter(prefix="/api/p2p", tags=["p2p"])
logger = logging.getLogger("bidblitz.p2p")

HANDLE_RE = re.compile(r"^[a-z0-9_.-]{3,20}$")
RESERVED_HANDLES = {
    "admin", "bidblitz", "system", "support", "help", "api", "root",
    "official", "null", "undefined", "anonymous", "guest", "user",
    "me", "you", "kids", "money", "wallet", "pay",
}


class ClaimHandleRequest(BaseModel):
    handle: str = Field(..., min_length=3, max_length=20)


class P2PSendRequest(BaseModel):
    recipient_handle: str = Field(..., min_length=3, max_length=20)
    amount: float = Field(..., gt=0, le=5000)
    note: Optional[str] = Field(default="", max_length=140)


def _normalize(h: str) -> str:
    return h.strip().lstrip("@").lstrip("$").lower()


@router.get("/handle/me")
async def my_handle(request: Request):
    """Return current user's handle + stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    doc = await db.users.find_one({"_id": user["_id"]}, {"handle": 1, "username": 1, "name": 1, "_id": 0})
    handle = _normalize((doc or {}).get("handle") or (doc or {}).get("username") or "")
    if handle and (doc or {}).get("handle") != handle:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"handle": handle}})
    received = await db.transactions.count_documents({"user_id": user_id, "type": "p2p_receive"})
    sent = await db.transactions.count_documents({"user_id": user_id, "type": "p2p_send"})
    return {
        "handle": handle or None,
        "name": (doc or {}).get("name"),
        "received_count": received,
        "sent_count": sent,
    }


@router.post("/handle/claim")
@limiter.limit("5/minute")
async def claim_handle(req: ClaimHandleRequest, request: Request):
    """Claim a unique @handle. Case-insensitive unique index on users.handle required."""
    user = await get_current_user(request)
    h = _normalize(req.handle)

    if not HANDLE_RE.match(h):
        raise HTTPException(400, "Invalid handle: 3-20 chars, lowercase letters/digits/_-. only")
    if h in RESERVED_HANDLES:
        raise HTTPException(400, "Dieser Handle ist für BidBlitz reserviert. Bitte wähle einen persönlichen Namen.")

    # Check collision
    existing = await db.users.find_one({"$or": [{"handle": h}, {"username": h}]}, {"_id": 1})
    if existing and existing["_id"] != user["_id"]:
        raise HTTPException(409, "Handle already taken")

    # Update user
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"handle": h, "handle_claimed_at": datetime.now(timezone.utc)}},
    )

    ip, ua = get_client_info(request)
    await log_audit("p2p_handle_claimed", user_id=str(user["_id"]),
                    email=user.get("email", ""), ip=ip, user_agent=ua,
                    details={"handle": h})

    return {"ok": True, "handle": h}


@router.get("/handle/lookup/{handle}")
async def lookup_handle(handle: str, request: Request):
    """Resolve a handle → public user info (for send-screen preview)."""
    await get_current_user(request)  # auth-gated to prevent handle-enumeration
    h = _normalize(handle)
    if not HANDLE_RE.match(h):
        raise HTTPException(400, "Invalid handle")
    u = await db.users.find_one({"handle": h}, {"_id": 1, "name": 1, "avatar": 1, "handle": 1})
    if not u:
        raise HTTPException(404, "Handle not found")
    return {
        "user_id": str(u["_id"]),
        "name": u.get("name"),
        "avatar": u.get("avatar"),
        "handle": u["handle"],
    }


@router.post("/send")
@limiter.limit("10/minute")
async def p2p_send(req: P2PSendRequest, request: Request):
    """Transfer money to another user by handle. Atomic debit/credit via payment_engine."""
    user = await get_current_user(request)
    sender_id = str(user["_id"])
    h = _normalize(req.recipient_handle)

    recipient = await db.users.find_one({"handle": h}, {"_id": 1, "name": 1, "handle": 1})
    if not recipient:
        raise HTTPException(404, "Recipient handle not found")
    recipient_id = str(recipient["_id"])
    if recipient_id == sender_id:
        raise HTTPException(400, "Cannot send to yourself")

    # Atomic transfer
    try:
        result = await transfer_between_wallets(
            from_user_id=sender_id,
            to_user_id=recipient_id,
            amount=req.amount,
            tx_type=TransactionType.TRANSFER,
            description=f"P2P → @{h}: {req.note or 'No message'}",
            reference=f"P2P-{h}-{int(datetime.now(timezone.utc).timestamp())}",
            metadata={
                "recipient_handle": h,
                "sender_handle": (await db.users.find_one({"_id": user["_id"]}, {"handle": 1}) or {}).get("handle"),
                "note": req.note or "",
                "kind": "p2p",
            },
        )
        if not result.success:
            raise HTTPException(400, result.error or "Transfer failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"P2P transfer failed: {e}")
        raise HTTPException(500, "Transfer failed")

    ip, ua = get_client_info(request)
    await log_audit("p2p_send", user_id=sender_id, email=user.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"to_handle": h, "amount": req.amount, "note": req.note})

    return {
        "ok": True,
        "amount": req.amount,
        "recipient_handle": h,
        "recipient_name": recipient.get("name"),
        "new_balance": result.new_balance,
    }


@router.get("/history")
async def p2p_history(request: Request, limit: int = 20):
    """Recent P2P transactions (sent + received)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    cursor = db.transactions.find(
        {
            "user_id": user_id,
            "type": {"$in": ["p2p_send", "p2p_receive", "transfer"]},
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(min(limit, 50))
    items = []
    async for t in cursor:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        items.append(t)
    return {"items": items}
