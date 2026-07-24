"""
BidBlitz V2 - Group Buy, Credit Score, Digital Card, Wishlist
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/social", tags=["social-features"])


# ═══ GROUP BUY ═══
class GroupBuyCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: str = ""
    target_price: float = Field(..., gt=0)
    min_participants: int = Field(3, ge=2, le=50)
    max_participants: int = Field(10, ge=2, le=100)
    category: str = "Allgemein"
    deadline_hours: int = Field(48, ge=1, le=168)

class GroupBuyJoin(BaseModel):
    group_id: str

@router.get("/group-buy")
async def get_group_buys(category: Optional[str] = None):
    query = {"status": "open"}
    if category:
        query["category"] = category
    groups = await db.group_buys.find(query, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"groups": groups}

@router.post("/group-buy/create")
async def create_group_buy(req: GroupBuyCreate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    per_person = round(req.target_price / req.min_participants, 2)
    group = {
        "group_id": f"gb_{secrets.token_hex(6)}",
        "creator_email": user.get("email", ""),
        "creator_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "target_price": req.target_price,
        "per_person": per_person,
        "min_participants": req.min_participants,
        "max_participants": req.max_participants,
        "category": req.category,
        "participants": [{"email": user.get("email", ""), "name": user.get("name", ""), "joined_at": now.isoformat()}],
        "current_count": 1,
        "status": "open",
        "created_at": now.isoformat(),
        "deadline": (now + timedelta(hours=req.deadline_hours)).isoformat(),
    }
    await db.group_buys.insert_one(group)
    group.pop("_id", None)
    return {"ok": True, "group": group}

@router.post("/group-buy/join")
async def join_group_buy(req: GroupBuyJoin, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    group = await db.group_buys.find_one({"group_id": req.group_id, "status": "open"})
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden")
    if any(p["email"] == email for p in group.get("participants", [])):
        raise HTTPException(400, "Bereits beigetreten")
    if group["current_count"] >= group["max_participants"]:
        raise HTTPException(400, "Gruppe voll")
    
    await db.group_buys.update_one(
        {"group_id": req.group_id},
        {"$push": {"participants": {"email": email, "name": user.get("name", ""), "joined_at": datetime.now(timezone.utc).isoformat()}},
         "$inc": {"current_count": 1}}
    )
    new_count = group["current_count"] + 1
    if new_count >= group["min_participants"]:
        await db.group_buys.update_one({"group_id": req.group_id}, {"$set": {"status": "ready"}})
    return {"ok": True, "current_count": new_count, "message": "Beigetreten!"}


# ═══ CREDIT SCORE / FINANZ-COACH ═══
@router.get("/credit-score")
async def get_credit_score(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    # Calculate score based on user behavior
    balance = user.get("balance", 0)
    is_premium = user.get("is_premium", False)
    
    tx_count = await db.transactions.count_documents({"email": email})
    jobs_completed = await db.blitz_jobs.count_documents({"worker_email": email, "status": "completed"})
    challenges = await db.spar_challenges.count_documents({"participants.email": email})
    cashback = await db.cashback_claims.count_documents({"user_email": email})
    
    base = 400
    base += min(200, int(balance / 50))
    base += min(100, tx_count * 5)
    base += jobs_completed * 20
    base += challenges * 15
    base += cashback * 10
    if is_premium: base += 50
    score = min(850, max(300, base))
    
    if score >= 750: level = "Exzellent"
    elif score >= 650: level = "Sehr gut"
    elif score >= 550: level = "Gut"
    elif score >= 450: level = "Aufbauend"
    else: level = "Starter"
    
    tips = []
    if not is_premium: tips.append("Premium-Abo abschließen (+50 Punkte)")
    if tx_count < 10: tips.append("Mehr Transaktionen durchführen")
    if jobs_completed == 0: tips.append("Einen BlitzJob abschließen (+20 Punkte)")
    if challenges == 0: tips.append("An einer Spar-Challenge teilnehmen (+15 Punkte)")
    if cashback == 0: tips.append("Cashback-Shopping nutzen (+10 Punkte)")
    
    return {
        "score": score, "level": level, "max_score": 850,
        "breakdown": {"balance_score": min(200, int(balance / 50)), "activity_score": min(100, tx_count * 5),
                       "jobs_score": jobs_completed * 20, "savings_score": challenges * 15,
                       "cashback_score": cashback * 10, "premium_bonus": 50 if is_premium else 0},
        "tips": tips,
    }


# ═══ DIGITAL CARD / QR PROFILE ═══
@router.get("/profile-card")
async def get_profile_card(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    resell_count = await db.resell_listings.count_documents({"seller_email": email, "status": "sold"})
    jobs_done = await db.blitz_jobs.count_documents({"worker_email": email, "status": "completed"})
    rating = 4.5 + random.uniform(0, 0.5)
    
    # Check verification
    is_verified = user.get("verified", False) or user.get("is_premium", False)
    
    card = {
        "name": user.get("name", ""),
        "email": email,
        "role": user.get("role", "user"),
        "qr_data": f"bidblitz://profile/{email}",
        "is_verified": is_verified,
        "is_premium": user.get("is_premium", False),
        "premium_plan": user.get("premium_plan"),
        "member_since": user.get("created_at", "2026-01-01"),
        "stats": {
            "items_sold": resell_count,
            "jobs_completed": jobs_done,
            "rating": round(rating, 1),
            "trust_score": min(100, 60 + resell_count * 5 + jobs_done * 10),
        },
    }
    return card


# ═══ WISHLIST WITH PRICE ALERTS ═══
class WishlistAdd(BaseModel):
    item_type: str  # reselling, cashback_shop
    item_id: str
    item_title: str
    current_price: float = 0
    target_price: Optional[float] = None

@router.get("/wishlist")
async def get_wishlist(request: Request):
    user = await get_current_user(request)
    items = await db.wishlist.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("added_at", -1).to_list(50)
    return {"items": items}

@router.post("/wishlist/add")
async def add_to_wishlist(req: WishlistAdd, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    existing = await db.wishlist.find_one({"user_email": email, "item_id": req.item_id})
    if existing:
        raise HTTPException(400, "Bereits auf der Wunschliste")
    
    item = {
        "wishlist_id": secrets.token_hex(6),
        "user_email": email,
        "item_type": req.item_type,
        "item_id": req.item_id,
        "item_title": req.item_title,
        "current_price": req.current_price,
        "target_price": req.target_price,
        "alert_sent": False,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wishlist.insert_one(item)
    return {"ok": True, "message": f"{req.item_title} zur Wunschliste hinzugefügt!"}

@router.delete("/wishlist/{item_id}")
async def remove_from_wishlist(item_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.wishlist.delete_one({"item_id": item_id, "user_email": user.get("email", "")})
    if result.deleted_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"ok": True}
