"""
BidBlitz V2 - Premium Finance Features
Split Bill, Virtual Cards, Savings Goals, BNPL, Gift Cards
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from core.database import db
from core.security import get_current_user
import secrets
import random
import string

router = APIRouter(tags=["premium-finance"])


# ══════════════════════════════════════════════════════════════════════════════
# SPLIT BILL
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/api/split-bill/create")
async def create_split_bill(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    now = datetime.now(timezone.utc).isoformat()
    bill = {
        "bill_id": f"SB-{secrets.token_hex(4).upper()}",
        "creator_id": str(user["_id"]),
        "creator_name": user.get("name", ""),
        "title": body.get("title", ""),
        "total": body.get("total", 0),
        "participants": body.get("participants", []),
        "per_person": round(body.get("total", 0) / max(len(body.get("participants", [])), 1), 2),
        "status": "pending",
        "created_at": now,
    }
    await db.split_bills.insert_one(bill)
    bill.pop("_id", None)
    return {"ok": True, "bill": bill}


@router.get("/api/split-bill/my")
async def get_my_splits(request: Request):
    user = await get_current_user(request)
    bills = await db.split_bills.find({"creator_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"bills": bills}


# ══════════════════════════════════════════════════════════════════════════════
# VIRTUAL CARDS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/virtual-cards")
async def get_virtual_cards(request: Request):
    user = await get_current_user(request)
    cards = await db.virtual_cards.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"cards": cards}


@router.post("/api/virtual-cards")
async def create_virtual_card(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    now = datetime.now(timezone.utc).isoformat()
    number = "4" + "".join([str(random.randint(0, 9)) for _ in range(15)])
    card = {
        "card_id": f"VC-{secrets.token_hex(4).upper()}",
        "user_id": str(user["_id"]),
        "label": body.get("label", "Virtuelle Karte"),
        "number": number,
        "cvv": "".join([str(random.randint(0, 9)) for _ in range(3)]),
        "exp_month": 12,
        "exp_year": 2027,
        "limit": body.get("limit", 50),
        "spent": 0,
        "status": "active",
        "created_at": now,
    }
    await db.virtual_cards.insert_one(card)
    card.pop("_id", None)
    return {"ok": True, "card": card}


# ══════════════════════════════════════════════════════════════════════════════
# SAVINGS GOALS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/savings/goals")
async def get_savings_goals(request: Request):
    user = await get_current_user(request)
    goals = await db.savings_goals.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"goals": goals}


@router.post("/api/savings/goals")
async def create_savings_goal(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    now = datetime.now(timezone.utc).isoformat()
    goal = {
        "goal_id": f"SG-{secrets.token_hex(4).upper()}",
        "user_id": str(user["_id"]),
        "name": body.get("name", ""),
        "target_amount": body.get("target_amount", 0),
        "current_amount": 0,
        "monthly_amount": body.get("monthly_amount", 0),
        "status": "active",
        "created_at": now,
    }
    await db.savings_goals.insert_one(goal)
    goal.pop("_id", None)
    return {"ok": True, "goal": goal}


# ══════════════════════════════════════════════════════════════════════════════
# BUY NOW PAY LATER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/bnpl/orders")
async def get_bnpl_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.bnpl_orders.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"orders": orders}


# ══════════════════════════════════════════════════════════════════════════════
# GIFT CARDS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/gift-cards/my")
async def get_my_gift_cards(request: Request):
    user = await get_current_user(request)
    cards = await db.gift_cards.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"cards": cards}


@router.post("/api/gift-cards/purchase")
async def purchase_gift_card(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    card_type = body.get("type", "")
    amount = body.get("amount", 0)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")

    # Check wallet balance
    user_doc = await db.users.find_one({"_id": user["_id"]})
    balance = user_doc.get("balance", 0)
    if balance < amount:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")

    # Deduct from wallet
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -amount}})

    now = datetime.now(timezone.utc).isoformat()
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=16))
    code = f"{code[:4]}-{code[4:8]}-{code[8:12]}-{code[12:16]}"

    card = {
        "card_id": f"GC-{secrets.token_hex(4).upper()}",
        "user_id": str(user["_id"]),
        "type": card_type,
        "amount": amount,
        "code": code,
        "status": "active",
        "redeemed": False,
        "created_at": now,
    }
    await db.gift_cards.insert_one(card)

    # Transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": str(user["_id"]),
        "type": "purchase",
        "amount": -amount,
        "description": f"Geschenkkarte {card_type} €{amount}",
        "status": "completed",
        "category": "gift_card",
        "created_at": now,
    })

    card.pop("_id", None)
    return {"ok": True, "card": card}
