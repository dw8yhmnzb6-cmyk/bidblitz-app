"""BidBlitz V2 - Coupons, Achievements, Short Videos, Meme Gen, AI Chat, Round-Up Savings, Debt Tracker, Crypto Airdrops"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/engage", tags=["engage"])

# ─── COUPONS ───
COUPONS = [
    {"id": "cp1", "brand": "McDonalds", "deal": "Big Mac Menue fuer 4.99 EUR", "discount": "30%", "expires": "2026-05-31", "category": "Essen", "color": "#DC2626"},
    {"id": "cp2", "brand": "REWE", "deal": "10 EUR Rabatt ab 50 EUR Einkauf", "discount": "10 EUR", "expires": "2026-05-15", "category": "Supermarkt", "color": "#CC0000"},
    {"id": "cp3", "brand": "Amazon", "deal": "5 EUR Gutschein ab 25 EUR", "discount": "5 EUR", "expires": "2026-06-01", "category": "Online", "color": "#FF9900"},
    {"id": "cp4", "brand": "Nike", "deal": "20% auf alle Sneaker", "discount": "20%", "expires": "2026-05-20", "category": "Fashion", "color": "#111"},
    {"id": "cp5", "brand": "Spotify", "deal": "3 Monate Premium fuer 0.99 EUR", "discount": "90%", "expires": "2026-04-30", "category": "Streaming", "color": "#1DB954"},
    {"id": "cp6", "brand": "Lieferando", "deal": "Gratis Lieferung + 3 EUR Rabatt", "discount": "3 EUR", "expires": "2026-05-10", "category": "Essen", "color": "#FF8000"},
    {"id": "cp7", "brand": "MediaMarkt", "deal": "15% auf Gaming-Zubehoer", "discount": "15%", "expires": "2026-06-15", "category": "Tech", "color": "#E2001A"},
    {"id": "cp8", "brand": "Douglas", "deal": "20% auf alles", "discount": "20%", "expires": "2026-05-25", "category": "Beauty", "color": "#000"},
]

@router.get("/coupons")
async def get_coupons():
    return {"coupons": COUPONS}

@router.post("/coupons/claim/{coupon_id}")
async def claim_coupon(coupon_id: str, request: Request):
    user = await get_current_user(request)
    coupon = next((c for c in COUPONS if c["id"] == coupon_id), None)
    if not coupon: raise HTTPException(404, "Coupon nicht gefunden")
    code = f"{coupon['brand'].upper()[:4]}-{secrets.token_hex(3).upper()}"
    await db.claimed_coupons.insert_one({"user_email": user.get("email",""), "coupon_id": coupon_id, "brand": coupon["brand"], "code": code, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "code": code, "message": f"{coupon['brand']} Coupon eingeloest! Code: {code}"}

# ─── ACHIEVEMENTS ───
ACHIEVEMENTS = [
    {"id": "first_pay", "name": "Erste Zahlung", "desc": "Erste Transaktion durchgefuehrt", "xp": 50, "icon": "zap", "rarity": "Common"},
    {"id": "10_txns", "name": "Power User", "desc": "10 Transaktionen abgeschlossen", "xp": 200, "icon": "star", "rarity": "Uncommon"},
    {"id": "referral", "name": "Einlader", "desc": "Ersten Freund eingeladen", "xp": 300, "icon": "users", "rarity": "Rare"},
    {"id": "premium", "name": "VIP Member", "desc": "Premium-Abo abgeschlossen", "xp": 500, "icon": "crown", "rarity": "Epic"},
    {"id": "quiz_win", "name": "Quizmaster", "desc": "5 Quiz-Battles gewonnen", "xp": 400, "icon": "brain", "rarity": "Rare"},
    {"id": "1000_eur", "name": "Big Spender", "desc": "1.000 EUR umgesetzt", "xp": 1000, "icon": "gem", "rarity": "Legendary"},
    {"id": "streak_7", "name": "7-Tage-Streak", "desc": "7 Tage hintereinander aktiv", "xp": 350, "icon": "flame", "rarity": "Rare"},
    {"id": "all_features", "name": "Explorer", "desc": "10 verschiedene Features genutzt", "xp": 250, "icon": "compass", "rarity": "Uncommon"},
]

@router.get("/achievements")
async def get_achievements(request: Request):
    user = await get_current_user(request)
    unlocked = await db.user_achievements.find({"user_email": user.get("email","")}, {"_id": 0}).to_list(50)
    unlocked_ids = {a["achievement_id"] for a in unlocked}
    total_xp = sum(a.get("xp", 0) for a in unlocked)
    level = total_xp // 500 + 1
    result = []
    for a in ACHIEVEMENTS:
        a_copy = dict(a)
        a_copy["unlocked"] = a["id"] in unlocked_ids
        result.append(a_copy)
    return {"achievements": result, "total_xp": total_xp, "level": level, "unlocked_count": len(unlocked_ids)}

@router.post("/achievements/unlock/{achievement_id}")
async def unlock_achievement(achievement_id: str, request: Request):
    user = await get_current_user(request)
    ach = next((a for a in ACHIEVEMENTS if a["id"] == achievement_id), None)
    if not ach: raise HTTPException(404, "Achievement nicht gefunden")
    existing = await db.user_achievements.find_one({"user_email": user.get("email",""), "achievement_id": achievement_id})
    if existing: return {"ok": True, "message": "Bereits freigeschaltet"}
    await db.user_achievements.insert_one({"user_email": user.get("email",""), "achievement_id": achievement_id, "xp": ach["xp"], "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "xp": ach["xp"], "message": f"Achievement '{ach['name']}' freigeschaltet! +{ach['xp']} XP"}

# ─── SHORT VIDEOS ───
VIDEOS = [
    {"id": "v1", "creator": "TechTim", "title": "iPhone 18 Leak!", "likes": 12400, "views": 89000, "duration": "15s", "category": "Tech"},
    {"id": "v2", "creator": "FitMia", "title": "5-Min Bauch-Workout", "likes": 8900, "views": 45000, "duration": "45s", "category": "Fitness"},
    {"id": "v3", "creator": "CryptoMax", "title": "Bitcoin-Prognose 2027", "likes": 21000, "views": 120000, "duration": "30s", "category": "Crypto"},
    {"id": "v4", "creator": "KochAnna", "title": "Pasta in 5 Minuten", "likes": 5600, "views": 32000, "duration": "60s", "category": "Kochen"},
    {"id": "v5", "creator": "Comedy_Jan", "title": "Deutsche Bahn Realitaet", "likes": 45000, "views": 380000, "duration": "20s", "category": "Comedy"},
    {"id": "v6", "creator": "StyleLisa", "title": "Summer Outfit 2026", "likes": 9800, "views": 67000, "duration": "25s", "category": "Fashion"},
]

@router.get("/videos")
async def get_videos():
    vids = []
    for v in VIDEOS:
        vc = dict(v)
        vc["likes"] = v["likes"] + random.randint(-100, 500)
        vids.append(vc)
    return {"videos": vids}

@router.post("/videos/like/{video_id}")
async def like_video(video_id: str, request: Request):
    user = await get_current_user(request)
    await db.video_likes.insert_one({"user_email": user.get("email",""), "video_id": video_id, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}

# ─── MEME GENERATOR ───
MEME_TEMPLATES = [
    {"id": "m1", "name": "Drake Hotline", "lines": 2},
    {"id": "m2", "name": "Distracted Boyfriend", "lines": 3},
    {"id": "m3", "name": "This Is Fine", "lines": 1},
    {"id": "m4", "name": "Stonks", "lines": 1},
    {"id": "m5", "name": "Two Buttons", "lines": 2},
]

class CreateMeme(BaseModel):
    template_id: str
    texts: list

@router.get("/memes/templates")
async def meme_templates():
    return {"templates": MEME_TEMPLATES}

@router.post("/memes/create")
async def create_meme(req: CreateMeme, request: Request):
    user = await get_current_user(request)
    meme = {"meme_id": f"meme_{secrets.token_hex(6)}", "user_email": user.get("email",""), "template_id": req.template_id, "texts": req.texts,
            "likes": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.memes.insert_one(meme)
    return {"ok": True, "meme_id": meme["meme_id"], "message": "Meme erstellt!"}

@router.get("/memes/feed")
async def meme_feed():
    memes = await db.memes.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"memes": memes}

# ─── AI CHAT ───
class AIChatMsg(BaseModel):
    message: str

@router.post("/ai-chat")
async def ai_chat(req: AIChatMsg, request: Request):
    user = await get_current_user(request)
    responses = [
        f"Gute Frage! Basierend auf deinem Profil empfehle ich dir, unsere Crypto Earn Funktion zu nutzen — bis zu 12% APY!",
        f"Hey! Wusstest du, dass du mit dem Daily Gluecksrad taeglich bis zu 50 EUR gewinnen kannst? Probier's aus!",
        f"Ich sehe, dass du {random.choice(['Bitcoin', 'Ethereum', 'Solana'])} interessant findest. Der aktuelle Trend zeigt nach oben!",
        f"Tipp: Mit dem Level Up Gold-Abo sparst du 3% Cashback auf alles. Das lohnt sich ab 300 EUR Umsatz/Monat!",
        f"Dein aktuelles Portfolio sieht gut aus! Vielleicht waere ein Crypto Basket zur Diversifizierung sinnvoll?",
    ]
    reply = random.choice(responses)
    return {"ok": True, "reply": reply, "is_premium": False}

# ─── ROUND-UP SAVINGS ───
@router.get("/roundup/stats")
async def roundup_stats(request: Request):
    user = await get_current_user(request)
    savings = await db.roundup_savings.find({"user_email": user.get("email","")}, {"_id": 0}).to_list(100)
    total = sum(s.get("amount", 0) for s in savings)
    return {"total_saved": round(total, 2), "transactions": len(savings), "active": True}

@router.post("/roundup/toggle")
async def toggle_roundup(request: Request):
    user = await get_current_user(request)
    return {"ok": True, "active": True, "message": "Round-Up Sparen aktiviert! Bei jeder Zahlung wird aufgerundet."}

# ─── DEBT TRACKER ───
class AddDebt(BaseModel):
    person: str
    amount: float = Field(..., gt=0)
    direction: str = "owed_to_me"  # owed_to_me / i_owe
    note: str = ""

@router.post("/debts/add")
async def add_debt(req: AddDebt, request: Request):
    user = await get_current_user(request)
    debt = {"debt_id": f"debt_{secrets.token_hex(6)}", "user_email": user.get("email",""), "person": req.person,
            "amount": req.amount, "direction": req.direction, "note": req.note, "settled": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.debt_tracker.insert_one(debt)
    label = "schuldet mir" if req.direction == "owed_to_me" else "schulde ich"
    return {"ok": True, "message": f"{req.person} {label} {req.amount} EUR"}

@router.get("/debts/mine")
async def my_debts(request: Request):
    user = await get_current_user(request)
    debts = await db.debt_tracker.find({"user_email": user.get("email",""), "settled": False}, {"_id": 0}).to_list(50)
    owed_to_me = sum(d["amount"] for d in debts if d["direction"] == "owed_to_me")
    i_owe = sum(d["amount"] for d in debts if d["direction"] == "i_owe")
    return {"debts": debts, "owed_to_me": round(owed_to_me, 2), "i_owe": round(i_owe, 2), "net": round(owed_to_me - i_owe, 2)}

@router.post("/debts/settle/{debt_id}")
async def settle_debt(debt_id: str, request: Request):
    user = await get_current_user(request)
    await db.debt_tracker.update_one({"debt_id": debt_id, "user_email": user.get("email","")}, {"$set": {"settled": True}})
    return {"ok": True, "message": "Schuld beglichen!"}

# ─── CRYPTO AIRDROPS ───
AIRDROPS = [
    {"id": "ad1", "project": "BlitzCoin (BLZ)", "amount": "100 BLZ", "value_eur": 5.00, "requirements": "Account verifiziert", "ends": "2026-05-15", "participants": 12400},
    {"id": "ad2", "project": "SolanaPlay (SPLAY)", "amount": "50 SPLAY", "value_eur": 2.50, "requirements": "1 Trade in letzten 30 Tagen", "ends": "2026-05-01", "participants": 8900},
    {"id": "ad3", "project": "DeFi Gem (DGEM)", "amount": "200 DGEM", "value_eur": 8.00, "requirements": "DeFi Wallet erstellt", "ends": "2026-06-01", "participants": 5600},
    {"id": "ad4", "project": "MetaWorld (META)", "amount": "75 META", "value_eur": 3.75, "requirements": "Level 2+ im Level Up", "ends": "2026-05-20", "participants": 3200},
    {"id": "ad5", "project": "GameFi Token (GFT)", "amount": "500 GFT", "value_eur": 10.00, "requirements": "Gaming-Bereich genutzt", "ends": "2026-04-30", "participants": 21000},
]

@router.get("/airdrops")
async def get_airdrops():
    return {"airdrops": AIRDROPS}

@router.post("/airdrops/claim/{airdrop_id}")
async def claim_airdrop(airdrop_id: str, request: Request):
    user = await get_current_user(request)
    airdrop = next((a for a in AIRDROPS if a["id"] == airdrop_id), None)
    if not airdrop: raise HTTPException(404, "Airdrop nicht gefunden")
    existing = await db.claimed_airdrops.find_one({"user_email": user.get("email",""), "airdrop_id": airdrop_id})
    if existing: raise HTTPException(400, "Bereits geclaimed")
    await db.claimed_airdrops.insert_one({"user_email": user.get("email",""), "airdrop_id": airdrop_id, "project": airdrop["project"], "amount": airdrop["amount"], "value_eur": airdrop["value_eur"], "created_at": datetime.now(timezone.utc).isoformat()})
    await db.users.update_one({"email": user.get("email","")}, {"$inc": {"balance": airdrop["value_eur"]}})
    return {"ok": True, "message": f"{airdrop['amount']} geclaimed! +{airdrop['value_eur']} EUR Wert"}
