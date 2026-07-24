"""
BidBlitz Split Bill System
===========================
Rechnungen teilen mit Freunden
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/split", tags=["split-bill"])


def generate_split_id():
    return f"SPLIT-{secrets.token_hex(4).upper()}"


class SplitBillCreate(BaseModel):
    title: str
    total_amount: float
    participants: List[str]  # List of user_ids or emails
    split_type: str = "equal"  # equal, custom, percentage
    custom_amounts: Optional[dict] = None  # {user_id: amount}
    description: Optional[str] = None


class SplitPayment(BaseModel):
    split_id: str
    amount: Optional[float] = None


@router.post("/create")
async def create_split_bill(req: SplitBillCreate, request: Request):
    """Create a new split bill"""
    user = await get_current_user(request)
    creator_id = str(user["_id"])
    
    if req.total_amount < 1:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €1.00")
    
    if len(req.participants) < 1:
        raise HTTPException(status_code=400, detail="Mindestens 1 Teilnehmer erforderlich")
    
    # Include creator in participants
    all_participants = list(set([creator_id] + req.participants))
    
    # Calculate split amounts
    splits = {}
    if req.split_type == "equal":
        per_person = round(req.total_amount / len(all_participants), 2)
        for p in all_participants:
            splits[p] = per_person
    elif req.split_type == "custom" and req.custom_amounts:
        splits = req.custom_amounts
    
    # Resolve participant names
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
                    "paid": pid == creator_id,  # Creator is considered paid
                    "paid_at": datetime.now(timezone.utc).isoformat() if pid == creator_id else None,
                })
        else:
            # Email invite
            participant_details.append({
                "user_id": None,
                "email": pid,
                "name": pid.split("@")[0],
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
    
    # Create notifications for participants
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
    }


@router.get("/my-bills")
async def get_my_split_bills(request: Request):
    """Get all split bills where user is participant"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Bills I created
    created = await db.split_bills.find({
        "creator_id": user_id
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Bills I'm participating in
    participating = await db.split_bills.find({
        "participants.user_id": user_id,
        "creator_id": {"$ne": user_id}
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {
        "created": created,
        "participating": participating,
    }


@router.get("/{split_id}")
async def get_split_bill(split_id: str, request: Request):
    """Get split bill details"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    bill = await db.split_bills.find_one({"split_id": split_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    
    # Check if user is participant
    is_participant = any(p.get("user_id") == user_id for p in bill.get("participants", []))
    if not is_participant and bill.get("creator_id") != user_id:
        raise HTTPException(status_code=403, detail="Kein Zugriff")
    
    # Calculate stats
    total_paid = sum(p["amount_owed"] for p in bill["participants"] if p.get("paid"))
    total_pending = bill["total_amount"] - total_paid
    
    return {
        **bill,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "is_creator": bill.get("creator_id") == user_id,
    }


@router.post("/pay")
async def pay_split_bill(req: SplitPayment, request: Request):
    """Pay your share of a split bill"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    bill = await db.split_bills.find_one({"split_id": req.split_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    
    # Find user's share
    participant = None
    for p in bill.get("participants", []):
        if p.get("user_id") == user_id:
            participant = p
            break
    
    if not participant:
        raise HTTPException(status_code=403, detail="Du bist kein Teilnehmer")
    
    if participant.get("paid"):
        raise HTTPException(status_code=400, detail="Bereits bezahlt")
    
    amount = req.amount or participant["amount_owed"]
    
    # Check balance
    if user.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Nicht genügend Guthaben")
    
    # Debit payer
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -amount}}
    )
    
    # Credit creator
    await db.users.update_one(
        {"_id": ObjectId(bill["creator_id"])},
        {"$inc": {"balance": amount}}
    )
    
    # Update split bill
    now = datetime.now(timezone.utc)
    await db.split_bills.update_one(
        {"split_id": req.split_id, "participants.user_id": user_id},
        {"$set": {
            "participants.$.paid": True,
            "participants.$.paid_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )
    
    # Create transactions
    reference = f"SPLIT-PAY-{secrets.token_hex(4).upper()}"
    
    await db.transactions.insert_many([
        {
            "id": f"tx_{secrets.token_hex(8)}",
            "user_id": user_id,
            "type": "split_payment",
            "amount": -amount,
            "description": f"Split: {bill['title']}",
            "reference": reference,
            "status": "completed",
            "created_at": now.isoformat(),
        },
        {
            "id": f"tx_{secrets.token_hex(8)}",
            "user_id": bill["creator_id"],
            "type": "split_received",
            "amount": amount,
            "description": f"Split von {user.get('name')}: {bill['title']}",
            "reference": reference,
            "status": "completed",
            "created_at": now.isoformat(),
        }
    ])
    
    # Check if all paid
    updated_bill = await db.split_bills.find_one({"split_id": req.split_id})
    all_paid = all(p.get("paid") for p in updated_bill.get("participants", []))
    if all_paid:
        await db.split_bills.update_one(
            {"split_id": req.split_id},
            {"$set": {"status": "completed"}}
        )
    
    return {
        "success": True,
        "amount_paid": amount,
        "reference": reference,
    }


@router.post("/{split_id}/remind")
async def send_reminder(split_id: str, request: Request):
    """Send reminder to unpaid participants"""
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
