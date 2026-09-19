"""
BidBlitz Split Bill System
===========================
Rechnungen teilen mit Freunden
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.payment_engine import transfer_between_wallets, TransactionType
import secrets

router = APIRouter(prefix="/api/split", tags=["split-bill"])


def generate_split_id():
    return f"SPLIT-{secrets.token_hex(4).upper()}"


class SplitBillCreate(BaseModel):
    title: str
    total_amount: float
    participants: List[str]
    split_type: str = "equal"
    custom_amounts: Optional[dict] = None
    description: Optional[str] = None


class SplitPayment(BaseModel):
    split_id: str
    amount: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False)


@router.post("/create")
async def create_split_bill(req: SplitBillCreate, request: Request):
    """Create a new split bill"""
    user = await get_current_user(request)
    creator_id = str(user["_id"])

    if req.total_amount < 1:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €1.00")
    if len(req.participants) < 1:
        raise HTTPException(status_code=400, detail="Mindestens 1 Teilnehmer erforderlich")

    all_participants = list(set([creator_id] + req.participants))
    splits = {}
    if req.split_type == "equal":
        per_person = round(req.total_amount / len(all_participants), 2)
        for p in all_participants:
            splits[p] = per_person
    elif req.split_type == "custom" and req.custom_amounts:
        splits = req.custom_amounts

    participant_details = []
    for pid in all_participants:
        if ObjectId.is_valid(pid):
            u = await db.users.find_one({"_id": ObjectId(pid)})
            if u:
                participant_details.append({
                    "user_id": pid,
                    "name": u.get("name", "User"),
                    "email": u.get("email"),
                    "amount_owed": splits.get(pid, 0),
                    "paid": pid == creator_id,
                    "paid_at": datetime.now(timezone.utc).isoformat() if pid == creator_id else None,
                })
        else:
            normalized_email = pid.strip().lower()
            registered = await db.users.find_one({"email": normalized_email})
            participant_details.append({
                "user_id": str(registered["_id"]) if registered else None,
                "email": normalized_email,
                "name": (registered or {}).get("name") or normalized_email.split("@")[0],
                "amount_owed": splits.get(pid, 0),
                "paid": False,
                "paid_at": None,
            })

    split_id = generate_split_id()
    now = datetime.now(timezone.utc)
    split_doc = {
        "split_id": split_id,
        "creator_id": creator_id,
        "creator_name": user.get("name", "User"),
        "title": req.title,
        "description": req.description,
        "total_amount": req.total_amount,
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
            await db.notifications.insert_one({
                "user_id": p["user_id"],
                "type": "split_bill_invite",
                "title": "Rechnung teilen",
                "message": f"{user.get('name')} möchte €{p['amount_owed']:.2f} für '{req.title}' teilen",
                "data": {"split_id": split_id},
                "read": False,
                "created_at": now.isoformat(),
            })

    return {
        "success": True,
        "split_id": split_id,
        "total_amount": req.total_amount,
        "participants": len(participant_details),
        "per_person": splits.get(creator_id, 0),
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
