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
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import transfer_between_wallets, TransactionType
import secrets
import hashlib
import json

router = APIRouter(prefix="/api/p2p", tags=["p2p-transfer"])


def _ensure_wallet_write_allowed(user: dict):
    if TEST_MODE or user.get("role") == "admin":
        return
    if user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "Bitte verifiziere zuerst deinen Ausweis, um Geld zu senden.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )


def _require_idempotency_key(req_key: Optional[str], request: Request) -> str:
    key = (req_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


def generate_reference():
    return f"P2P-{secrets.token_hex(4).upper()}"


def generate_bidblitz_id():
    """Generate unique BidBlitz ID like BLZ-XXXX-XXXX"""
    return f"BLZ-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"


def generate_qr_token():
    """Generate secure QR token for transfers"""
    return secrets.token_urlsafe(32)


def transfer_reference(sender_id: str, recipient_id: str, amount: float, idempotency_key: Optional[str]) -> str:
    """Use a deterministic reference when the client supplies an idempotency key."""
    if not idempotency_key:
        return generate_reference()
    raw = f"{sender_id}:{recipient_id}:{amount:.2f}:{idempotency_key.strip()}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest().upper()[:20]
    return f"P2P-{digest}"


async def ensure_bidblitz_id(user: dict) -> str:
    bidblitz_id = user.get("bidblitz_id")
    if bidblitz_id:
        return bidblitz_id
    bidblitz_id = generate_bidblitz_id()
    while await db.users.find_one({"bidblitz_id": bidblitz_id}):
        bidblitz_id = generate_bidblitz_id()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"bidblitz_id": bidblitz_id}})
    user["bidblitz_id"] = bidblitz_id
    return bidblitz_id


# ══════════════════════════════════════════════════════════════════════════════
# USER PROFILE / BIDBLITZ ID
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/profile")
async def get_transfer_profile(request: Request):
    """Get user's P2P transfer profile including BidBlitz ID and QR code"""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    bidblitz_id = await ensure_bidblitz_id(user)

    qr_token = user.get("qr_token")
    if not qr_token:
        qr_token = generate_qr_token()
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"qr_token": qr_token}},
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
    if not username.replace("_", "").replace(".", "").isalnum():
        raise HTTPException(status_code=400, detail="Username darf nur Buchstaben, Zahlen, _ und . enthalten")

    existing = await db.users.find_one({"username": username, "_id": {"$ne": user["_id"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Username bereits vergeben")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"username": username}},
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
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# INSTANT P2P TRANSFER
# ══════════════════════════════════════════════════════════════════════════════

class TransferRequest(BaseModel):
    recipient_id: str
    amount: float
    message: Optional[str] = None
    transfer_method: str = "direct"  # direct, qr, nearby, nfc
    idempotency_key: Optional[str] = None


@router.post("/transfer")
async def instant_transfer(req: TransferRequest, request: Request):
    """Execute a wallet-to-wallet transfer through the canonical payment engine."""
    user = await get_current_user(request)
    _ensure_wallet_write_allowed(user)
    sender_id = str(user["_id"])

    if req.amount < 0.01:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €0.01")
    if req.amount > 10000:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €10.000 pro Überweisung")
    if req.recipient_id == sender_id:
        raise HTTPException(status_code=400, detail="Überweisung an sich selbst nicht möglich")

    try:
        recipient = await db.users.find_one({"_id": ObjectId(req.recipient_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültige Empfänger-ID")
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")

    recipient_id = str(recipient["_id"])
    recipient_name = recipient.get("name", "BidBlitz User")
    sender_name = user.get("name", "BidBlitz User")
    client_idempotency_key = _require_idempotency_key(req.idempotency_key, request)
    reference = transfer_reference(sender_id, recipient_id, req.amount, client_idempotency_key)
    now = datetime.now(timezone.utc)

    result = await transfer_between_wallets(
        from_user_id=sender_id,
        to_user_id=recipient_id,
        amount=req.amount,
        tx_type=TransactionType.TRANSFER,
        description=f"P2P transfer to {recipient_name}",
        reference=reference,
        idempotency_key=client_idempotency_key,
        metadata={
            "kind": "p2p",
            "sender_id": sender_id,
            "sender_name": sender_name,
            "recipient_id": recipient_id,
            "recipient_name": recipient_name,
            "message": req.message or "",
            "transfer_method": req.transfer_method,
            "client_idempotency_key": client_idempotency_key or "",
        },
    )
    if not result.success:
        status_code = 409 if result.status.value == "pending" else 400
        raise HTTPException(status_code=status_code, detail=result.error or "Überweisung fehlgeschlagen")

    return {
        "success": True,
        "message": f"€{req.amount:.2f} erfolgreich an {recipient_name} gesendet",
        "reference": result.reference or reference,
        "transaction_id": result.transaction_id,
        "amount": req.amount,
        "fee": 0.0,
        "recipient_name": recipient_name,
        "sender_new_balance": round(result.new_balance or 0.0, 2),
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
    user_id = str(user["_id"])
    bidblitz_id = await ensure_bidblitz_id(user)

    qr_token = user.get("qr_token")
    if not qr_token:
        qr_token = generate_qr_token()
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"qr_token": qr_token}},
        )

    qr_data = {
        "type": "bidblitz_p2p",
        "token": qr_token,
        "name": user.get("name", "BidBlitz User"),
        "bidblitz_id": bidblitz_id,
    }
    if amount and amount > 0:
        qr_data["amount"] = amount

    return {
        "qr_data": json.dumps(qr_data),
        "qr_token": qr_token,
        "user_id": user_id,
        "wallet_id": user_id,
        "bidblitz_id": bidblitz_id,
        "name": user.get("name"),
    }


@router.post("/qr/scan")
async def scan_qr_code(request: Request):
    """Process scanned QR code and return recipient info"""
    user = await get_current_user(request)
    body = await request.json()
    qr_data = body.get("qr_data", "")

    try:
        if qr_data.startswith("{"):
            data = json.loads(qr_data)
            token = data.get("token")
            preset_amount = data.get("amount")
        else:
            token = qr_data
            preset_amount = None
    except Exception:
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
    """Enable nearby receive only in test mode until real proximity is implemented."""
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Nearby-Empfang ist in Production deaktiviert, bis echte Standortnähe verifiziert wird.",
        )
    body = await request.json()
    enabled = body.get("enabled", True)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5) if enabled else None
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "nearby_receive_enabled": enabled,
            "nearby_expires_at": expires_at.isoformat() if expires_at else None,
        }},
    )

    return {
        "success": True,
        "nearby_enabled": enabled,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


@router.get("/nearby/users")
async def get_nearby_users(request: Request):
    """Return simulated nearby users only in test mode."""
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Nearby-Nutzer sind in Production deaktiviert, bis echte Standortnähe verifiziert wird.",
        )
    now = datetime.now(timezone.utc)

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
    """Get recent transfer recipients from legacy and canonical P2P rows."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    recent_txs = await db.transactions.find({
        "user_id": user_id,
        "type": {"$in": ["p2p_send", "transfer"]},
    }).sort("created_at", -1).limit(40).to_list(40)

    seen = set()
    recipients = []
    for tx in recent_txs:
        if tx.get("type") == "transfer" and tx.get("direction") not in (None, "debit"):
            continue
        metadata = tx.get("metadata") or {}
        cid = tx.get("counterparty_id") or metadata.get("recipient_id") or metadata.get("counterparty_user_id")
        if cid and cid not in seen:
            seen.add(cid)
            recipients.append({
                "user_id": cid,
                "name": tx.get("counterparty_name") or metadata.get("recipient_name") or "BidBlitz User",
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
        {"$set": {"favorite_recipients": favorites}},
    )
    return {"success": True, "favorites": favorites}


@router.get("/recipients/favorites")
async def get_favorite_recipients(request: Request):
    """Get favorite recipients with details"""
    user = await get_current_user(request)
    favorites = user.get("favorite_recipients", [])

    if not favorites:
        return {"recipients": []}

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
    """Get P2P transfer history including canonical transfer rows."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    transfers = await db.transactions.find({
        "user_id": user_id,
        "type": {"$in": ["p2p_send", "p2p_receive", "transfer"]},
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    return {"transfers": transfers, "total": len(transfers)}
