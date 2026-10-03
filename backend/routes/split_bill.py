"""
BidBlitz Split Bill System
===========================
Rechnungen teilen mit Freunden
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.payment_engine import transfer_between_wallets, TransactionType
import secrets

router = APIRouter(prefix="/api/split", tags=["split-bill"])


def generate_split_id():
    return f"SPLIT-{secrets.token_hex(4).upper()}"


async def _resolve_split_identity(raw: str) -> dict:
    token = str(raw or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Leerer Teilnehmer ist nicht erlaubt")

    if ObjectId.is_valid(token):
        user = await db.users.find_one({"_id": ObjectId(token)}, {"_id": 1, "name": 1, "email": 1})
        if not user:
            raise HTTPException(status_code=404, detail=f"Teilnehmer nicht gefunden: {token}")
        user_id = str(user["_id"])
        email = str(user.get("email") or "").strip().lower()
        return {
            "canonical_key": f"user:{user_id}",
            "user_id": user_id,
            "email": email or None,
            "name": user.get("name") or email or "User",
            "source_key": token,
        }

    email = token.lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail=f"Ungültiger Teilnehmer: {token}")
    user = await db.users.find_one({"email": email}, {"_id": 1, "name": 1, "email": 1})
    if user:
        user_id = str(user["_id"])
        canonical_email = str(user.get("email") or email).strip().lower()
        return {
            "canonical_key": f"user:{user_id}",
            "user_id": user_id,
            "email": canonical_email,
            "name": user.get("name") or canonical_email.split("@")[0],
            "source_key": token,
        }
    return {
        "canonical_key": f"email:{email}",
        "user_id": None,
        "email": email,
        "name": email.split("@")[0],
        "source_key": token,
    }


def _allocate_equal_split(total_amount: float, count: int) -> List[float]:
    total_cents = int(round(float(total_amount) * 100))
    base, remainder = divmod(total_cents, count)
    return [round((base + (1 if idx < remainder else 0)) / 100, 2) for idx in range(count)]


class SplitBillCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    total_amount: float = Field(..., ge=1, le=100000, allow_inf_nan=False)
    participants: List[str] = Field(..., min_length=1, max_length=100)
    split_type: Literal["equal", "custom"] = "equal"
    custom_amounts: Optional[Dict[str, float]] = None
    description: Optional[str] = Field(default=None, max_length=1000)


class SplitPayment(BaseModel):
    split_id: str
    amount: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False)


@router.post("/create")
async def create_split_bill(req: SplitBillCreate, request: Request):
    """Create a normalized split whose participant amounts equal the bill exactly."""
    user = await get_current_user(request)
    creator_id = str(user["_id"])

    creator_identity = {
        "canonical_key": f"user:{creator_id}",
        "user_id": creator_id,
        "email": str(user.get("email") or "").strip().lower() or None,
        "name": user.get("name") or user.get("email") or "User",
        "source_key": creator_id,
    }

    normalized = {creator_identity["canonical_key"]: creator_identity}
    source_to_canonical = {creator_id: creator_identity["canonical_key"]}
    if creator_identity["email"]:
        source_to_canonical[creator_identity["email"]] = creator_identity["canonical_key"]

    for raw in req.participants:
        identity = await _resolve_split_identity(raw)
        normalized[identity["canonical_key"]] = identity
        source_to_canonical[str(raw).strip()] = identity["canonical_key"]
        source_to_canonical[str(raw).strip().lower()] = identity["canonical_key"]
        if identity.get("user_id"):
            source_to_canonical[identity["user_id"]] = identity["canonical_key"]
        if identity.get("email"):
            source_to_canonical[identity["email"]] = identity["canonical_key"]

    identities = list(normalized.values())
    if len(identities) < 2:
        raise HTTPException(status_code=400, detail="Mindestens eine weitere Person ist erforderlich")

    amounts_by_key: Dict[str, float] = {}
    if req.split_type == "equal":
        allocated = _allocate_equal_split(req.total_amount, len(identities))
        for identity, amount in zip(identities, allocated):
            amounts_by_key[identity["canonical_key"]] = amount
    else:
        if not req.custom_amounts:
            raise HTTPException(status_code=400, detail="Custom Split benötigt individuelle Beträge")

        for raw_key, raw_amount in req.custom_amounts.items():
            key_token = str(raw_key or "").strip()
            canonical = (
                source_to_canonical.get(key_token)
                or source_to_canonical.get(key_token.lower())
            )
            if not canonical:
                identity = await _resolve_split_identity(key_token)
                canonical = identity["canonical_key"]
                if canonical not in normalized:
                    raise HTTPException(status_code=400, detail=f"Betrag für unbekannten Teilnehmer: {raw_key}")
            amount = round(float(raw_amount), 2)
            if amount < 0:
                raise HTTPException(status_code=400, detail="Teilbeträge dürfen nicht negativ sein")
            if canonical in amounts_by_key:
                raise HTTPException(status_code=400, detail="Teilnehmer wurde im Custom Split doppelt angegeben")
            amounts_by_key[canonical] = amount

        missing = [i for i in identities if i["canonical_key"] not in amounts_by_key]
        if missing:
            raise HTTPException(
                status_code=400,
                detail="Für jeden Teilnehmer muss ein Custom-Betrag angegeben werden",
            )
        total_custom_cents = sum(int(round(amount * 100)) for amount in amounts_by_key.values())
        total_cents = int(round(float(req.total_amount) * 100))
        if total_custom_cents != total_cents:
            raise HTTPException(
                status_code=400,
                detail=f"Custom-Anteile müssen zusammen exakt €{req.total_amount:.2f} ergeben",
            )

    participant_details = []
    now = datetime.now(timezone.utc)
    for identity in identities:
        amount_owed = round(float(amounts_by_key.get(identity["canonical_key"], 0)), 2)
        is_creator = identity.get("user_id") == creator_id
        if not is_creator and amount_owed < 0.01:
            raise HTTPException(status_code=400, detail="Jeder eingeladene Teilnehmer benötigt einen positiven Anteil")
        participant_details.append({
            "user_id": identity.get("user_id"),
            "email": identity.get("email"),
            "name": identity.get("name") or "User",
            "amount_owed": amount_owed,
            "paid": is_creator,
            "paid_at": now.isoformat() if is_creator else None,
        })

    # Final invariant: all stored shares sum to the displayed total, cent-exact.
    stored_total_cents = sum(int(round(float(p["amount_owed"]) * 100)) for p in participant_details)
    expected_total_cents = int(round(float(req.total_amount) * 100))
    if stored_total_cents != expected_total_cents:
        raise HTTPException(status_code=500, detail="Split-Beträge konnten nicht konsistent berechnet werden")

    split_id = generate_split_id()
    split_doc = {
        "split_id": split_id,
        "creator_id": creator_id,
        "creator_name": user.get("name", "User"),
        "title": req.title.strip(),
        "description": (req.description or "").strip(),
        "total_amount": round(float(req.total_amount), 2),
        "split_type": req.split_type,
        "participants": participant_details,
        "status": "active",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await db.split_bills.insert_one(split_doc)
    split_doc.pop("_id", None)

    for p in participant_details:
        if p["user_id"] and p["user_id"] != creator_id:
            notification_id = f"split-invite:{split_id}:{p['user_id']}"
            await db.notifications.update_one(
                {"_id": notification_id},
                {"$setOnInsert": {
                    "_id": notification_id,
                    "user_id": p["user_id"],
                    "type": "split_bill_invite",
                    "title": "Rechnung teilen",
                    "message": f"{user.get('name')} möchte €{p['amount_owed']:.2f} für '{req.title}' teilen",
                    "data": {"split_id": split_id},
                    "read": False,
                    "created_at": now.isoformat(),
                }},
                upsert=True,
            )

    creator_share = next(
        (p["amount_owed"] for p in participant_details if p.get("user_id") == creator_id),
        0,
    )
    return {
        "success": True,
        "split_id": split_id,
        "total_amount": round(float(req.total_amount), 2),
        "participants": len(participant_details),
        "per_person": creator_share if req.split_type == "equal" else None,
        "bill": split_doc,
    }

@router.get("/my-bills")
async def get_my_split_bills(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    created = await db.split_bills.find({"creator_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    participating = await db.split_bills.find({
        "participants.user_id": user_id,
        "creator_id": {"$ne": user_id},
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"created": created, "participating": participating}


@router.get("/{split_id}")
async def get_split_bill(split_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    bill = await db.split_bills.find_one({"split_id": split_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    is_participant = any(p.get("user_id") == user_id for p in bill.get("participants", []))
    if not is_participant and bill.get("creator_id") != user_id:
        raise HTTPException(status_code=403, detail="Kein Zugriff")
    total_paid = sum(p["amount_owed"] for p in bill["participants"] if p.get("paid"))
    return {
        **bill,
        "total_paid": total_paid,
        "total_pending": bill["total_amount"] - total_paid,
        "is_creator": bill.get("creator_id") == user_id,
    }


@router.post("/pay")
async def pay_split_bill(req: SplitPayment, request: Request):
    """Pay the authenticated participant's exact share through the canonical wallet ledger."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    bill = await db.split_bills.find_one({"split_id": req.split_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if bill.get("status") == "completed":
        raise HTTPException(status_code=409, detail="Rechnung ist bereits abgeschlossen")

    participant = next((p for p in bill.get("participants", []) if p.get("user_id") == user_id), None)
    if not participant:
        raise HTTPException(status_code=403, detail="Du bist kein Teilnehmer")
    if participant.get("paid"):
        raise HTTPException(status_code=409, detail="Bereits bezahlt")

    amount = round(float(participant.get("amount_owed") or 0), 2)
    if amount < 0.01:
        raise HTTPException(status_code=400, detail="Ungültiger Anteil")
    if req.amount is not None and round(float(req.amount), 2) != amount:
        raise HTTPException(status_code=400, detail=f"Zu zahlen sind exakt €{amount:.2f}")

    creator_id = str(bill.get("creator_id") or "")
    if not creator_id or creator_id == user_id:
        raise HTTPException(status_code=400, detail="Ungültiger Zahlungsempfänger")

    reference = f"SPLIT-{req.split_id}-{user_id[-8:]}"
    result = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=creator_id,
        amount=amount,
        tx_type=TransactionType.TRANSFER,
        description=f"Split: {bill.get('title', 'Rechnung')}",
        reference=reference,
        metadata={
            "kind": "split_bill_payment",
            "split_id": req.split_id,
            "creator_id": creator_id,
            "participant_id": user_id,
            "audit_metadata": {"route": "split_bill.pay"},
        },
        idempotency_key=f"split_bill:{req.split_id}:{user_id}",
    )
    if not result.success:
        status = str(getattr(result.status, "value", result.status))
        raise HTTPException(
            status_code=409 if status in {"pending", "reconciliation_required"} else 400,
            detail=result.error or "Zahlung fehlgeschlagen",
        )

    now = datetime.now(timezone.utc)
    await db.split_bills.update_one(
        {"split_id": req.split_id, "participants.user_id": user_id},
        {"$set": {
            "participants.$.paid": True,
            "participants.$.paid_at": now.isoformat(),
            "participants.$.wallet_transaction_id": result.transaction_id,
            "updated_at": now.isoformat(),
        }},
    )

    updated_bill = await db.split_bills.find_one({"split_id": req.split_id})
    if updated_bill and all(p.get("paid") for p in updated_bill.get("participants", [])):
        await db.split_bills.update_one(
            {"split_id": req.split_id},
            {"$set": {"status": "completed", "updated_at": now.isoformat()}},
        )

    return {
        "success": True,
        "amount_paid": amount,
        "reference": result.reference or reference,
        "transaction_id": result.transaction_id,
        "new_balance": result.new_balance,
        "idempotent_replay": bool(getattr(result, "idempotent_replay", False)),
    }


@router.post("/{split_id}/remind")
async def send_reminder(split_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    bill = await db.split_bills.find_one({"split_id": split_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if bill.get("creator_id") != user_id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann erinnern")

    now = datetime.now(timezone.utc)
    reminded = 0
    for p in bill.get("participants", []):
        if not p.get("paid") and p.get("user_id"):
            await db.notifications.insert_one({
                "user_id": p["user_id"],
                "type": "split_reminder",
                "title": "Erinnerung: Rechnung teilen",
                "message": f"Du schuldest noch €{p['amount_owed']:.2f} für '{bill['title']}'",
                "data": {"split_id": split_id},
                "read": False,
                "created_at": now.isoformat(),
            })
            reminded += 1
    return {"success": True, "reminded": reminded}
