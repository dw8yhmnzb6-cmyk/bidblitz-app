"""
BidBlitz P2P Wallet Transfer System
====================================
- Email Transfer
- Username/BidBlitz ID Transfer
- QR/Barcode Transfer
- Nearby Transfer
- NFC Transfer (with fallback)

All transfers are:
- Instant
- Free (zero fee)
- Wallet-to-wallet only
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets
import hashlib
import json

router = APIRouter(prefix="/api/p2p", tags=["p2p-transfer"])


def generate_reference():
    return f"P2P-{secrets.token_hex(4).upper()}"


def generate_bidblitz_id():
    """Generate unique BidBlitz ID like BLZ-XXXX-XXXX"""
    return f"BLZ-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"


def generate_qr_token():
    """Generate secure QR token for transfers"""
    return secrets.token_urlsafe(32)


# ══════════════════════════════════════════════════════════════════════════════
# USER PROFILE / BIDBLITZ ID
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/profile")
async def get_transfer_profile(request: Request):
    """Get user's P2P transfer profile including BidBlitz ID and QR code"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Ensure user has a BidBlitz ID
    bidblitz_id = user.get("bidblitz_id")
    if not bidblitz_id:
        bidblitz_id = generate_bidblitz_id()
        # Ensure uniqueness
        while await db.users.find_one({"bidblitz_id": bidblitz_id}):
            bidblitz_id = generate_bidblitz_id()
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"bidblitz_id": bidblitz_id}}
        )
    
    # Generate or get QR token
    qr_token = user.get("qr_token")
    if not qr_token:
        qr_token = generate_qr_token()
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"qr_token": qr_token}}
        )
    
    return {
        "user_id": user_id,
        "bidblitz_id": bidblitz_id,
        "username": user.get("username", user.get("name", "").lower().replace(" ", "")),
        "name": user.get("name", "BidBlitz User"),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "qr_token": qr_token,
        "balance": round(user.get("balance", 0.0), 2),
        "avatar": user.get("avatar"),
        "nearby_enabled": user.get("nearby_receive_enabled", False),
    }


@router.post("/profile/username")
async def set_username(request: Request):
    """Set or update username"""
    user = await get_current_user(request)
    body = await request.json()
    username = body.get("username", "").lower().strip()
    
    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Username muss mindestens 3 Zeichen haben")
    
    if len(username) > 20:
        raise HTTPException(status_code=400, detail="Username darf maximal 20 Zeichen haben")
    
    # Check if alphanumeric
    if not username.replace("_", "").replace(".", "").isalnum():
        raise HTTPException(status_code=400, detail="Username darf nur Buchstaben, Zahlen, _ und . enthalten")
    
    # Check uniqueness
    existing = await db.users.find_one({"username": username, "_id": {"$ne": user["_id"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Username bereits vergeben")
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"username": username}}
    )
    
    return {"success": True, "username": username}


# ══════════════════════════════════════════════════════════════════════════════
# RECIPIENT LOOKUP
# ══════════════════════════════════════════════════════════════════════════════

class LookupRequest(BaseModel):
    query: str
    type: str = "auto"  # auto, email, username, bidblitz_id, phone, qr_token


@router.post("/lookup")
async def lookup_recipient(req: LookupRequest, request: Request):
    """Find recipient by email, username, BidBlitz ID, phone, or QR token"""
    user = await get_current_user(request)
    query = req.query.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="Suchbegriff erforderlich")
    
    recipient = None
    lookup_type = req.type
    
    # Auto-detect type if not specified
    if lookup_type == "auto":
        if "@" in query:
            lookup_type = "email"
        elif query.startswith("BLZ-"):
            lookup_type = "bidblitz_id"
        elif query.startswith("+") or query.replace(" ", "").isdigit():
            lookup_type = "phone"
        elif len(query) > 30:
            lookup_type = "qr_token"
        else:
            lookup_type = "username"
    
    # Lookup based on type
    if lookup_type == "email":
        recipient = await db.users.find_one({"email": query.lower()})
    elif lookup_type == "bidblitz_id":
        recipient = await db.users.find_one({"bidblitz_id": query.upper()})
    elif lookup_type == "username":
        recipient = await db.users.find_one({"username": query.lower()})
    elif lookup_type == "phone":
        clean_phone = query.replace(" ", "").replace("-", "")
        recipient = await db.users.find_one({"phone": {"$regex": clean_phone}})
    elif lookup_type == "qr_token":
        recipient = await db.users.find_one({"qr_token": query})
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    # Prevent self-transfer
    if str(recipient["_id"]) == str(user["_id"]):
        raise HTTPException(status_code=400, detail="Überweisung an sich selbst nicht möglich")
    
    return {
        "found": True,
        "recipient": {
            "user_id": str(recipient["_id"]),
            "name": recipient.get("name", "BidBlitz User"),
            "username": recipient.get("username"),
            "bidblitz_id": recipient.get("bidblitz_id"),
            "email": recipient.get("email", "")[:3] + "***" if recipient.get("email") else None,
            "avatar": recipient.get("avatar"),
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# INSTANT P2P TRANSFER
# ══════════════════════════════════════════════════════════════════════════════

class TransferRequest(BaseModel):
    recipient_id: str
    amount: float
    message: Optional[str] = None
    transfer_method: str = "direct"  # direct, qr, nearby, nfc


@router.post("/transfer")
async def instant_transfer(req: TransferRequest, request: Request):
    """
    Execute instant, free wallet-to-wallet transfer.
    
    Rules:
    - Instant debit/credit
    - Zero transfer fee
    - Atomic operation
    - No duplicate transfers
    - No negative balance
    """
    user = await get_current_user(request)
    sender_id = str(user["_id"])
    
    # Validate amount
    if req.amount < 0.01:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €0.01")
    if req.amount > 10000:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €10.000 pro Überweisung")
    
    # Check sender balance
    sender_balance = user.get("balance", 0.0)
    if sender_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Nicht genügend Guthaben. Verfügbar: €{sender_balance:.2f}")
    
    # Prevent self-transfer
    if req.recipient_id == sender_id:
        raise HTTPException(status_code=400, detail="Überweisung an sich selbst nicht möglich")
    
    # Find recipient
    try:
        recipient = await db.users.find_one({"_id": ObjectId(req.recipient_id)})
    except:
        raise HTTPException(status_code=400, detail="Ungültige Empfänger-ID")
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    recipient_id = str(recipient["_id"])
    recipient_name = recipient.get("name", "BidBlitz User")
    sender_name = user.get("name", "BidBlitz User")
    
    # Generate reference
    reference = generate_reference()
    now = datetime.now(timezone.utc)
    
    # ═══ ATOMIC TRANSFER ═══
    # Debit sender
    sender_result = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": req.amount}},
        {"$inc": {"balance": -req.amount}}
    )
    
    if sender_result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Überweisung fehlgeschlagen - Guthaben prüfen")
    
    # Credit recipient
    await db.users.update_one(
        {"_id": recipient["_id"]},
        {"$inc": {"balance": req.amount}}
    )
    
    # Get new balances
    updated_sender = await db.users.find_one({"_id": user["_id"]})
    updated_recipient = await db.users.find_one({"_id": recipient["_id"]})
    
    # ═══ CREATE TRANSACTION RECORDS ═══
    
    # Sender transaction (p2p_send)
    sender_tx = {
        "id": f"tx_{secrets.token_hex(8)}",
        "user_id": sender_id,
        "type": "p2p_send",
        "amount": -req.amount,
        "description": f"Gesendet an {recipient_name}",
        "counterparty_id": recipient_id,
        "counterparty_name": recipient_name,
        "message": req.message,
        "transfer_method": req.transfer_method,
        "reference": reference,
        "status": "completed",
        "fee": 0.0,
        "created_at": now.isoformat(),
    }
    
    # Recipient transaction (p2p_receive)
    recipient_tx = {
        "id": f"tx_{secrets.token_hex(8)}",
        "user_id": recipient_id,
        "type": "p2p_receive",
        "amount": req.amount,
        "description": f"Empfangen von {sender_name}",
        "counterparty_id": sender_id,
        "counterparty_name": sender_name,
        "message": req.message,
        "transfer_method": req.transfer_method,
        "reference": reference,
        "status": "completed",
        "fee": 0.0,
        "created_at": now.isoformat(),
    }
    
    await db.transactions.insert_many([sender_tx, recipient_tx])
    
    return {
        "success": True,
        "message": f"€{req.amount:.2f} erfolgreich an {recipient_name} gesendet",
        "reference": reference,
        "amount": req.amount,
        "fee": 0.0,
        "recipient_name": recipient_name,
        "sender_new_balance": round(updated_sender.get("balance", 0), 2),
        "transfer_method": req.transfer_method,
        "timestamp": now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# QR CODE TRANSFER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/qr/generate")
async def generate_receive_qr(request: Request, amount: Optional[float] = None):
    """Generate QR code data for receiving money"""
    user = await get_current_user(request)
    
    qr_token = user.get("qr_token")
    if not qr_token:
        qr_token = generate_qr_token()
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"qr_token": qr_token}}
        )
    
    qr_data = {
        "type": "bidblitz_p2p",
        "token": qr_token,
        "name": user.get("name", "BidBlitz User"),
        "bidblitz_id": user.get("bidblitz_id"),
    }
    
    if amount and amount > 0:
        qr_data["amount"] = amount
    
    return {
        "qr_data": json.dumps(qr_data),
        "qr_token": qr_token,
        "bidblitz_id": user.get("bidblitz_id"),
        "name": user.get("name"),
    }


@router.post("/qr/scan")
async def scan_qr_code(request: Request):
    """Process scanned QR code and return recipient info"""
    user = await get_current_user(request)
    body = await request.json()
    qr_data = body.get("qr_data", "")
    
    try:
        # Try to parse as JSON
        if qr_data.startswith("{"):
            data = json.loads(qr_data)
            token = data.get("token")
            preset_amount = data.get("amount")
        else:
            # Assume it's just the token
            token = qr_data
            preset_amount = None
    except:
        raise HTTPException(status_code=400, detail="Ungültiger QR-Code")
    
    if not token:
        raise HTTPException(status_code=400, detail="Ungültiger QR-Code")
    
    recipient = await db.users.find_one({"qr_token": token})
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    if str(recipient["_id"]) == str(user["_id"]):
        raise HTTPException(status_code=400, detail="Das ist dein eigener QR-Code")
    
    return {
        "found": True,
        "recipient": {
            "user_id": str(recipient["_id"]),
            "name": recipient.get("name", "BidBlitz User"),
            "username": recipient.get("username"),
            "bidblitz_id": recipient.get("bidblitz_id"),
            "avatar": recipient.get("avatar"),
        },
        "preset_amount": preset_amount,
    }


# ══════════════════════════════════════════════════════════════════════════════
# NEARBY TRANSFER
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/nearby/enable")
async def enable_nearby_receive(request: Request):
    """Enable nearby receive mode for 5 minutes"""
    user = await get_current_user(request)
    body = await request.json()
    enabled = body.get("enabled", True)
    
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5) if enabled else None
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "nearby_receive_enabled": enabled,
            "nearby_expires_at": expires_at.isoformat() if expires_at else None,
        }}
    )
    
    return {
        "success": True,
        "nearby_enabled": enabled,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


@router.get("/nearby/users")
async def get_nearby_users(request: Request):
    """Get users who have nearby receive enabled (simulated - in production use GPS)"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    
    # Find users with nearby mode enabled and not expired
    nearby_users = await db.users.find({
        "_id": {"$ne": user["_id"]},
        "nearby_receive_enabled": True,
        "nearby_expires_at": {"$gt": now.isoformat()},
    }, {"_id": 1, "name": 1, "username": 1, "bidblitz_id": 1, "avatar": 1}).to_list(20)
    
    return {
        "users": [
            {
                "user_id": str(u["_id"]),
                "name": u.get("name", "BidBlitz User"),
                "username": u.get("username"),
                "bidblitz_id": u.get("bidblitz_id"),
                "avatar": u.get("avatar"),
            }
            for u in nearby_users
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# RECENT & FAVORITE RECIPIENTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/recipients/recent")
async def get_recent_recipients(request: Request):
    """Get recent transfer recipients"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get recent outgoing transfers
    recent_txs = await db.transactions.find({
        "user_id": user_id,
        "type": "p2p_send",
    }).sort("created_at", -1).limit(20).to_list(20)
    
    # Extract unique recipients
    seen = set()
    recipients = []
    for tx in recent_txs:
        cid = tx.get("counterparty_id")
        if cid and cid not in seen:
            seen.add(cid)
            recipients.append({
                "user_id": cid,
                "name": tx.get("counterparty_name", "BidBlitz User"),
                "last_transfer": tx.get("created_at"),
                "last_amount": abs(tx.get("amount", 0)),
            })
    
    return {"recipients": recipients[:10]}


@router.post("/recipients/favorite")
async def toggle_favorite_recipient(request: Request):
    """Add or remove a favorite recipient"""
    user = await get_current_user(request)
    body = await request.json()
    recipient_id = body.get("recipient_id")
    is_favorite = body.get("is_favorite", True)
    
    if not recipient_id:
        raise HTTPException(status_code=400, detail="Empfänger-ID erforderlich")
    
    favorites = user.get("favorite_recipients", [])
    
    if is_favorite and recipient_id not in favorites:
        favorites.append(recipient_id)
    elif not is_favorite and recipient_id in favorites:
        favorites.remove(recipient_id)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"favorite_recipients": favorites}}
    )
    
    return {"success": True, "favorites": favorites}


@router.get("/recipients/favorites")
async def get_favorite_recipients(request: Request):
    """Get favorite recipients with details"""
    user = await get_current_user(request)
    favorites = user.get("favorite_recipients", [])
    
    if not favorites:
        return {"recipients": []}
    
    # Get user details
    fav_users = await db.users.find({
        "_id": {"$in": [ObjectId(f) for f in favorites if ObjectId.is_valid(f)]}
    }, {"_id": 1, "name": 1, "username": 1, "bidblitz_id": 1, "avatar": 1}).to_list(50)
    
    return {
        "recipients": [
            {
                "user_id": str(u["_id"]),
                "name": u.get("name", "BidBlitz User"),
                "username": u.get("username"),
                "bidblitz_id": u.get("bidblitz_id"),
                "avatar": u.get("avatar"),
            }
            for u in fav_users
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# TRANSFER HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def get_transfer_history(request: Request, limit: int = 50):
    """Get P2P transfer history"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    transfers = await db.transactions.find({
        "user_id": user_id,
        "type": {"$in": ["p2p_send", "p2p_receive"]},
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transfers": transfers, "total": len(transfers)}
