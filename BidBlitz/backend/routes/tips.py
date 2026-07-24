"""
BidBlitz V2 - Tipping System
Allows customers to tip staff at merchants (restaurants, cafés, etc.)
Tips go directly to the employee's wallet with cashback for the customer.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/tips", tags=["tips"])


class TipRequest(BaseModel):
    staff_email: str
    amount: float = Field(..., gt=0)
    transaction_id: Optional[str] = None
    merchant_id: Optional[str] = None
    message: Optional[str] = None


class TipPresets(BaseModel):
    bill_amount: float = Field(..., gt=0)


CASHBACK_RATE = 0.02  # 2% cashback on tips


@router.get("/presets")
async def get_tip_presets(bill_amount: float = 0):
    """Get suggested tip amounts based on bill amount."""
    percentages = [
        {"percent": 5, "amount": round(bill_amount * 0.05, 2)},
        {"percent": 10, "amount": round(bill_amount * 0.10, 2)},
        {"percent": 15, "amount": round(bill_amount * 0.15, 2)},
        {"percent": 20, "amount": round(bill_amount * 0.20, 2)},
    ]
    fixed = [
        {"label": "1", "amount": 1.00},
        {"label": "2", "amount": 2.00},
        {"label": "5", "amount": 5.00},
    ]
    return {"percentages": percentages, "fixed": fixed}


@router.post("/send")
async def send_tip(req: TipRequest, request: Request):
    """Send a tip from customer wallet to staff wallet."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss positiv sein")
    if req.amount > 500:
        raise HTTPException(status_code=400, detail="Maximales Trinkgeld: €500")

    balance = user.get("balance", 0.0)
    if balance < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben. Benötigt: €{req.amount:.2f}, Verfügbar: €{balance:.2f}",
        )

    staff = await db.users.find_one({"email": req.staff_email.lower().strip()})
    if not staff:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")

    staff_id = str(staff["_id"])
    if staff_id == user_id:
        raise HTTPException(status_code=400, detail="Kann kein Trinkgeld an sich selbst senden")

    now = datetime.now(timezone.utc).isoformat()
    tip_id = secrets.token_hex(8)
    ref = f"TIP-{secrets.token_hex(4).upper()}"

    # Deduct from customer
    result = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": req.amount}},
        {"$inc": {"balance": -req.amount}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Zahlung fehlgeschlagen")

    # Credit staff wallet
    await db.users.update_one(
        {"_id": staff["_id"]},
        {"$inc": {"balance": req.amount}},
    )

    # Cashback for customer (2% on tips)
    cashback = round(req.amount * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": cashback}},
        )

    # Save tip record
    tip_doc = {
        "tip_id": tip_id,
        "sender_id": user_id,
        "sender_email": user.get("email", ""),
        "sender_name": user.get("name", ""),
        "staff_id": staff_id,
        "staff_email": staff.get("email", ""),
        "staff_name": staff.get("name", ""),
        "amount": req.amount,
        "cashback": cashback,
        "message": req.message or "",
        "transaction_id": req.transaction_id or "",
        "merchant_id": req.merchant_id or "",
        "reference": ref,
        "created_at": now,
    }
    await db.tips.insert_one(tip_doc)

    # Transaction records
    await db.transactions.insert_one({
        "id": tip_id,
        "user_id": user_id,
        "type": "tip_sent",
        "amount": -req.amount,
        "description": f"Trinkgeld an {staff.get('name', staff.get('email', ''))}",
        "status": "completed",
        "reference": ref,
        "category": "tip",
        "created_at": now,
    })

    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": staff_id,
        "type": "tip_received",
        "amount": req.amount,
        "description": f"Trinkgeld von {user.get('name', user.get('email', ''))}",
        "status": "completed",
        "reference": ref,
        "category": "tip",
        "created_at": now,
    })

    if cashback > 0:
        await db.transactions.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "tip_cashback",
            "amount": cashback,
            "description": f"Cashback für Trinkgeld ({CASHBACK_RATE*100:.0f}%)",
            "status": "completed",
            "reference": ref,
            "category": "cashback",
            "created_at": now,
        })

    updated_user = await db.users.find_one({"_id": user["_id"]}, {"_id": 0, "balance": 1})

    return {
        "ok": True,
        "tip_id": tip_id,
        "amount": req.amount,
        "cashback": cashback,
        "staff_name": staff.get("name", ""),
        "reference": ref,
        "new_balance": updated_user.get("balance", 0),
    }



class PosTipRequest(BaseModel):
    customer_id: str
    amount: float = Field(..., gt=0)
    transaction_id: Optional[str] = None
    message: Optional[str] = None


@router.post("/pos")
async def pos_tip(req: PosTipRequest, request: Request):
    """Merchant-initiated tip: customer just paid via POS, now adds tip.
    The logged-in user (merchant/staff) receives the tip.
    """
    staff = await get_current_user(request)
    staff_id = str(staff["_id"])

    if req.amount <= 0 or req.amount > 500:
        raise HTTPException(status_code=400, detail="Ungültiger Trinkgeldbetrag")

    customer = await db.users.find_one({"_id": ObjectId(req.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    customer_id = str(customer["_id"])
    if customer_id == staff_id:
        raise HTTPException(status_code=400, detail="Selbst-Trinkgeld nicht möglich")

    balance = customer.get("balance", 0.0)
    if balance < req.amount:
        raise HTTPException(status_code=400, detail="Kunde hat nicht genug Guthaben")

    now = datetime.now(timezone.utc).isoformat()
    tip_id = secrets.token_hex(8)
    ref = f"TIP-{secrets.token_hex(4).upper()}"

    # Deduct from customer
    result = await db.users.update_one(
        {"_id": customer["_id"], "balance": {"$gte": req.amount}},
        {"$inc": {"balance": -req.amount}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Zahlung fehlgeschlagen")

    # Credit staff
    await db.users.update_one({"_id": staff["_id"]}, {"$inc": {"balance": req.amount}})

    # Cashback for customer
    cashback = round(req.amount * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one({"_id": customer["_id"]}, {"$inc": {"balance": cashback}})

    tip_doc = {
        "tip_id": tip_id,
        "sender_id": customer_id,
        "sender_email": customer.get("email", ""),
        "sender_name": customer.get("name", ""),
        "staff_id": staff_id,
        "staff_email": staff.get("email", ""),
        "staff_name": staff.get("name", ""),
        "amount": req.amount,
        "cashback": cashback,
        "message": req.message or "",
        "transaction_id": req.transaction_id or "",
        "pos_initiated": True,
        "reference": ref,
        "created_at": now,
    }
    await db.tips.insert_one(tip_doc)

    # Transaction records
    await db.transactions.insert_one({
        "id": tip_id, "user_id": customer_id, "type": "tip_sent",
        "amount": -req.amount,
        "description": f"Trinkgeld an {staff.get('name', '')}",
        "status": "completed", "reference": ref, "category": "tip", "created_at": now,
    })
    await db.transactions.insert_one({
        "id": secrets.token_hex(8), "user_id": staff_id, "type": "tip_received",
        "amount": req.amount,
        "description": f"Trinkgeld von {customer.get('name', '')}",
        "status": "completed", "reference": ref, "category": "tip", "created_at": now,
    })
    if cashback > 0:
        await db.transactions.insert_one({
            "id": secrets.token_hex(8), "user_id": customer_id, "type": "tip_cashback",
            "amount": cashback, "description": f"Cashback für Trinkgeld ({CASHBACK_RATE*100:.0f}%)",
            "status": "completed", "reference": ref, "category": "cashback", "created_at": now,
        })

    return {
        "ok": True,
        "tip_id": tip_id,
        "amount": req.amount,
        "cashback": cashback,
        "staff_name": staff.get("name", ""),
        "customer_name": customer.get("name", ""),
        "reference": ref,
    }


@router.get("/sent")
async def get_sent_tips(request: Request, limit: int = 30):
    """Get tips sent by the current user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    tips = await db.tips.find(
        {"sender_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    total = sum(t.get("amount", 0) for t in tips)
    return {"tips": tips, "total": round(total, 2), "count": len(tips)}


@router.get("/received")
async def get_received_tips(request: Request, limit: int = 30):
    """Get tips received by the current user (staff view)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    tips = await db.tips.find(
        {"staff_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    total = sum(t.get("amount", 0) for t in tips)
    return {"tips": tips, "total": round(total, 2), "count": len(tips)}


@router.get("/merchant/staff")
async def get_merchant_staff(request: Request, merchant_id: str = ""):
    """Get staff members of a merchant for tip selection."""
    user = await get_current_user(request)
    staff_list = []

    if merchant_id:
        staff_docs = await db.merchant_staff.find(
            {"merchant_id": merchant_id, "status": "active"}, {"_id": 0}
        ).to_list(50)
        for s in staff_docs:
            u = await db.users.find_one(
                {"_id": ObjectId(s["user_id"])}, {"_id": 0, "name": 1, "email": 1}
            ) if s.get("user_id") else None
            if u:
                staff_list.append({
                    "name": u.get("name", ""),
                    "email": u.get("email", ""),
                })

    # Also include the merchant owner
    if merchant_id:
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(merchant_id)})
        if mp and mp.get("user_id"):
            owner = await db.users.find_one(
                {"_id": ObjectId(mp["user_id"])}, {"_id": 0, "name": 1, "email": 1}
            )
            if owner and owner.get("email") not in [s["email"] for s in staff_list]:
                staff_list.insert(0, {
                    "name": owner.get("name", ""),
                    "email": owner.get("email", ""),
                    "is_owner": True,
                })

    return {"staff": staff_list}
