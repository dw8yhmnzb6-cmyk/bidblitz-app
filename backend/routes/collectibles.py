"""
BidBlitz V2 - Digital Collectibles / Trading Cards
Starter €2.99, Booster €0.99, 5% Handelsgebühr
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/collectibles", tags=["collectibles"])

TRADE_FEE = 0.05
RARITIES = {"common": 60, "rare": 25, "epic": 10, "legendary": 5}
SERIES = [
    {"id": "football", "name": "Fußball Stars", "cards": ["Mbappe", "Haaland", "Bellingham", "Vinicius", "Saka", "Musiala", "Gavi", "Pedri", "Wirtz", "Xavi Simons"]},
    {"id": "anime", "name": "Anime Heroes", "cards": ["Goku", "Naruto", "Luffy", "Tanjiro", "Gojo", "Itachi", "Levi", "Zoro", "Vegeta", "Sukuna"]},
    {"id": "gaming", "name": "Gaming Legends", "cards": ["Mario", "Link", "Master Chief", "Kratos", "Geralt", "Solid Snake", "Cloud", "Samus", "Pikachu", "Doom Guy"]},
    {"id": "influencer", "name": "Creator Edition", "cards": ["MrBeast", "PewDiePie", "KSI", "Ninja", "Pokimane", "xQc", "Ludwig", "Dream", "Valkyrae", "Sykkuno"]},
]

def _generate_card(series_id: str):
    series = next((s for s in SERIES if s["id"] == series_id), SERIES[0])
    roll = random.randint(1, 100)
    if roll <= 5: rarity = "legendary"
    elif roll <= 15: rarity = "epic"
    elif roll <= 40: rarity = "rare"
    else: rarity = "common"
    name = random.choice(series["cards"])
    power = {"common": random.randint(50, 70), "rare": random.randint(70, 85), "epic": random.randint(85, 95), "legendary": random.randint(95, 100)}[rarity]
    value = {"common": round(random.uniform(0.1, 0.5), 2), "rare": round(random.uniform(0.5, 2), 2), "epic": round(random.uniform(2, 8), 2), "legendary": round(random.uniform(8, 25), 2)}[rarity]
    return {"card_id": f"c_{secrets.token_hex(4)}", "series": series_id, "series_name": series["name"], "name": name, "rarity": rarity, "power": power, "value": value}

class BuyPack(BaseModel):
    pack_type: str = "booster"  # starter, booster
    series: str = "football"

class TradeRequest(BaseModel):
    card_id: str
    price: float

class BuyCard(BaseModel):
    listing_id: str

@router.get("/my-collection")
async def my_collection(request: Request):
    user = await get_current_user(request)
    cards = await db.user_cards.find({"owner_email": user.get("email", "")}, {"_id": 0}).sort("rarity", 1).to_list(200)
    return {"cards": cards, "total": len(cards)}

@router.post("/buy-pack")
async def buy_pack(req: BuyPack, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    price = 2.99 if req.pack_type == "starter" else 0.99
    count = 5 if req.pack_type == "starter" else 1
    balance = user.get("balance", 0)
    if balance < price: raise HTTPException(400, f"Benötigt: €{price:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    cards = []
    for _ in range(count):
        card = _generate_card(req.series)
        card["owner_email"] = email
        card["obtained_at"] = datetime.now(timezone.utc).isoformat()
        card["obtained_via"] = req.pack_type
        await db.user_cards.insert_one(card)
        card.pop("_id", None)
        cards.append(card)
    return {"ok": True, "cards": cards, "price": price, "pack_type": req.pack_type}

@router.post("/list-for-trade")
async def list_for_trade(req: TradeRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    card = await db.user_cards.find_one({"card_id": req.card_id, "owner_email": email})
    if not card: raise HTTPException(404, "Karte nicht gefunden")
    listing = {
        "listing_id": f"tl_{secrets.token_hex(4)}", "card_id": req.card_id,
        "seller_email": email, "card_name": card.get("name"), "card_rarity": card.get("rarity"),
        "series": card.get("series"), "power": card.get("power"),
        "price": req.price, "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.card_market.insert_one(listing)
    return {"ok": True, "listing_id": listing["listing_id"]}

@router.get("/market")
async def card_market(series: str = None):
    query = {"status": "active"}
    if series: query["series"] = series
    listings = await db.card_market.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"listings": listings, "total": len(listings)}

@router.post("/buy-card")
async def buy_card(req: BuyCard, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    listing = await db.card_market.find_one({"listing_id": req.listing_id, "status": "active"})
    if not listing: raise HTTPException(404, "Nicht verfügbar")
    if listing["seller_email"] == email: raise HTTPException(400, "Eigene Karte")
    price = listing["price"]
    fee = round(price * TRADE_FEE, 2)
    balance = user.get("balance", 0)
    if balance < price: raise HTTPException(400, f"Benötigt: €{price:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    await db.users.update_one({"email": listing["seller_email"]}, {"$inc": {"balance": price - fee}})
    await db.user_cards.update_one({"card_id": listing["card_id"]}, {"$set": {"owner_email": email}})
    await db.card_market.update_one({"listing_id": req.listing_id}, {"$set": {"status": "sold"}})
    return {"ok": True, "message": f"{listing['card_name']} gekauft für €{price:.2f}!"}

@router.get("/series")
async def get_series():
    return {"series": SERIES}
