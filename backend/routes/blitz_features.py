"""
BidBlitz V2 - BlitzBattle (1v1 Challenges), BlitzCreator (Influencer), BlitzBox (Mystery Boxes)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/blitz", tags=["blitz-features"])

# ═══ BLITZ BATTLE ═══
BATTLE_FEE = 0.10

class BattleCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=80)
    type: str = "savings"  # savings, steps, gaming_score
    stake: float = Field(..., ge=1, le=500)
    duration_hours: int = Field(24, ge=1, le=168)

class BattleJoin(BaseModel):
    battle_id: str

@router.get("/battles")
async def get_battles():
    battles = await db.blitz_battles.find({"status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"battles": battles}

@router.post("/battles/create")
async def create_battle(req: BattleCreate, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    balance = user.get("balance", 0)
    if balance < req.stake: raise HTTPException(400, f"Einsatz: €{req.stake:.2f} benötigt")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -req.stake}})
    now = datetime.now(timezone.utc)
    battle = {
        "battle_id": f"bt_{secrets.token_hex(6)}", "creator_email": email, "creator_name": user.get("name", ""),
        "title": req.title, "type": req.type, "stake": req.stake,
        "pool": req.stake, "fee_pct": BATTLE_FEE * 100,
        "participants": [{"email": email, "name": user.get("name", ""), "score": 0}],
        "status": "open", "winner": None,
        "created_at": now.isoformat(), "ends_at": (now + timedelta(hours=req.duration_hours)).isoformat(),
    }
    await db.blitz_battles.insert_one(battle)
    battle.pop("_id", None)
    return {"ok": True, "battle": battle}

@router.post("/battles/join")
async def join_battle(req: BattleJoin, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    b = await db.blitz_battles.find_one({"battle_id": req.battle_id, "status": "open"})
    if not b: raise HTTPException(404, "Battle nicht gefunden")
    if any(p["email"] == email for p in b.get("participants", [])): raise HTTPException(400, "Bereits dabei")
    balance = user.get("balance", 0)
    if balance < b["stake"]: raise HTTPException(400, f"Einsatz: €{b['stake']:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -b["stake"]}})
    await db.blitz_battles.update_one({"battle_id": req.battle_id},
        {"$push": {"participants": {"email": email, "name": user.get("name", ""), "score": 0}}, "$inc": {"pool": b["stake"]}, "$set": {"status": "active"}})
    return {"ok": True, "message": f"Battle beigetreten! Einsatz: €{b['stake']:.2f}"}

# ═══ BLITZ CREATOR ═══
CREATOR_FEE = 0.15

class CreatorGigCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=100)
    description: str = ""
    platform: str = "tiktok"
    budget: float = Field(..., ge=5, le=5000)
    requirements: str = ""

class CreatorApply(BaseModel):
    gig_id: str
    pitch: str = ""

@router.get("/creator/gigs")
async def get_gigs(platform: Optional[str] = None):
    query = {"status": "open"}
    if platform: query["platform"] = platform
    gigs = await db.creator_gigs.find(query, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"gigs": gigs}

@router.post("/creator/gigs")
async def create_gig(req: CreatorGigCreate, request: Request):
    user = await get_current_user(request)
    gig = {
        "gig_id": f"cg_{secrets.token_hex(6)}", "brand_email": user.get("email", ""), "brand_name": user.get("name", ""),
        "title": req.title, "description": req.description, "platform": req.platform,
        "budget": req.budget, "requirements": req.requirements,
        "applicants": [], "selected_creator": None, "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.creator_gigs.insert_one(gig)
    gig.pop("_id", None)
    return {"ok": True, "gig": gig}

@router.post("/creator/apply")
async def apply_gig(req: CreatorApply, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    gig = await db.creator_gigs.find_one({"gig_id": req.gig_id, "status": "open"})
    if not gig: raise HTTPException(404, "Gig nicht gefunden")
    if any(a["email"] == email for a in gig.get("applicants", [])): raise HTTPException(400, "Bereits beworben")
    await db.creator_gigs.update_one({"gig_id": req.gig_id},
        {"$push": {"applicants": {"email": email, "name": user.get("name", ""), "pitch": req.pitch, "applied_at": datetime.now(timezone.utc).isoformat()}}})
    return {"ok": True, "message": "Bewerbung gesendet!"}

# ═══ BLITZ BOX ═══
BOXES = [
    {"box_id": "sneaker", "name": "Sneaker Mystery Box", "price": 29.99, "color": "#F59E0B", "items": "2-3 Sneaker-Artikel", "value_range": "€40-120"},
    {"box_id": "gaming", "name": "Gaming Mystery Box", "price": 19.99, "color": "#8B5CF6", "items": "3-5 Gaming-Items", "value_range": "€25-80"},
    {"box_id": "beauty", "name": "Beauty Mystery Box", "price": 14.99, "color": "#EC4899", "items": "4-6 Beauty-Produkte", "value_range": "€20-60"},
    {"box_id": "tech", "name": "Tech Mystery Box", "price": 39.99, "color": "#3B82F6", "items": "1-2 Tech-Gadgets", "value_range": "€50-150"},
    {"box_id": "streetwear", "name": "Streetwear Box", "price": 24.99, "color": "#EF4444", "items": "2-3 Streetwear-Stücke", "value_range": "€35-100"},
]

class BuyBox(BaseModel):
    box_id: str

@router.get("/boxes")
async def get_boxes():
    return {"boxes": BOXES}

@router.post("/boxes/buy")
async def buy_box(req: BuyBox, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    box = next((b for b in BOXES if b["box_id"] == req.box_id), None)
    if not box: raise HTTPException(404, "Box nicht gefunden")
    balance = user.get("balance", 0)
    if balance < box["price"]: raise HTTPException(400, f"Benötigt: €{box['price']:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -box["price"]}})
    # Generate random items
    item_count = random.randint(2, 5)
    sample_items = {
        "sneaker": ["Nike Air Max", "Adidas Ultraboost", "Jordan 1 Low", "New Balance 550", "Puma Suede"],
        "gaming": ["Gaming Mauspad", "LED Strip", "Controller Grip", "Headset Stand", "Webcam Cover"],
        "beauty": ["Gesichtsmaske", "Lip Balm Set", "Parfüm Mini", "Nagellack Set", "Skincare Kit"],
        "tech": ["Bluetooth Earbuds", "USB-C Hub", "Phone Stand", "Power Bank Mini", "LED Ring Light"],
        "streetwear": ["Bucket Hat", "Oversized Tee", "Socks Pack", "Beanie", "Tote Bag"],
    }
    items = random.sample(sample_items.get(req.box_id, ["Item"]), min(item_count, len(sample_items.get(req.box_id, ["Item"]))))
    value = round(box["price"] * random.uniform(1.0, 2.5), 2)
    order = {
        "order_id": secrets.token_hex(6), "user_email": email, "box_id": req.box_id,
        "box_name": box["name"], "price": box["price"], "items": items,
        "estimated_value": value, "status": "shipped",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.box_orders.insert_one(order)
    return {"ok": True, "items": items, "value": value, "message": f"{box['name']} bestellt! Wert: ~€{value:.2f}"}

@router.get("/boxes/my-orders")
async def my_box_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.box_orders.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"orders": orders}
