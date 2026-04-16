"""BidBlitz V2 - Viral Features (BlitzClips, Share-to-Earn, Challenges, Live Feed, Invite Streak, Profile Cards, Embed Widget)"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, random, hashlib

router = APIRouter(prefix="/api/viral", tags=["viral"])

# ─── BLITZCLIPS (Video Platform) ───
class PostClip(BaseModel):
    title: str
    description: str = ""
    duration_sec: int = Field(default=15, ge=5, le=60)
    category: str = "Allgemein"

TRENDING_CLIPS = [
    {"clip_id": "clip_demo1", "creator": "SneakerKing", "title": "Unboxing: Jordan 1 Retro High OG", "likes": 24500, "views": 180000, "shares": 3200, "comments": 890, "duration": "22s", "category": "Fashion"},
    {"clip_id": "clip_demo2", "creator": "CryptoMax", "title": "Ich habe 10.000 EUR in 24h gemacht", "likes": 45000, "views": 520000, "shares": 12400, "comments": 4500, "duration": "45s", "category": "Crypto"},
    {"clip_id": "clip_demo3", "creator": "KochAnna", "title": "3-Minuten Protein Pancakes", "likes": 18900, "views": 95000, "shares": 5600, "comments": 1200, "duration": "58s", "category": "Kochen"},
    {"clip_id": "clip_demo4", "creator": "ComedyJan", "title": "POV: Du sagst deinem Chef du kuendigst", "likes": 89000, "views": 1200000, "shares": 45000, "comments": 12000, "duration": "15s", "category": "Comedy"},
    {"clip_id": "clip_demo5", "creator": "FitMia", "title": "30-Tage Transformation (Vorher/Nachher)", "likes": 56000, "views": 340000, "shares": 8900, "comments": 3400, "duration": "30s", "category": "Fitness"},
    {"clip_id": "clip_demo6", "creator": "TechTim", "title": "Das beste Handy 2026 (nicht iPhone)", "likes": 32000, "views": 210000, "shares": 6700, "comments": 2100, "duration": "40s", "category": "Tech"},
    {"clip_id": "clip_demo7", "creator": "GamerPro", "title": "1v1 gegen den besten Spieler Deutschlands", "likes": 67000, "views": 890000, "shares": 23000, "comments": 8900, "duration": "55s", "category": "Gaming"},
    {"clip_id": "clip_demo8", "creator": "StyleLisa", "title": "Mein 50-EUR-Outfit schlaegt dein 500-EUR-Outfit", "likes": 41000, "views": 280000, "shares": 9800, "comments": 3600, "duration": "35s", "category": "Fashion"},
]

@router.get("/clips/feed")
async def clips_feed(category: str = ""):
    clips = list(TRENDING_CLIPS)
    user_clips = await db.blitz_clips.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    all_clips = user_clips + clips
    if category:
        all_clips = [c for c in all_clips if c.get("category", "").lower() == category.lower()]
    for c in all_clips:
        c["likes"] = c.get("likes", 0) + random.randint(0, 50)
        c["views"] = c.get("views", 0) + random.randint(0, 200)
    return {"clips": all_clips[:20]}

@router.post("/clips/post")
async def post_clip(req: PostClip, request: Request):
    user = await get_current_user(request)
    clip = {
        "clip_id": f"clip_{secrets.token_hex(6)}", "creator": user.get("name", "Anonym"), "creator_email": user.get("email", ""),
        "title": req.title, "description": req.description, "duration": f"{req.duration_sec}s",
        "category": req.category, "likes": 0, "views": 0, "shares": 0, "comments": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.blitz_clips.insert_one(clip)
    return {"ok": True, "clip_id": clip["clip_id"], "message": f"Clip '{req.title}' veroeffentlicht!"}

@router.post("/clips/like/{clip_id}")
async def like_clip(clip_id: str, request: Request):
    user = await get_current_user(request)
    await db.blitz_clips.update_one({"clip_id": clip_id}, {"$inc": {"likes": 1}})
    return {"ok": True}

@router.post("/clips/share/{clip_id}")
async def share_clip(clip_id: str, request: Request):
    user = await get_current_user(request)
    await db.blitz_clips.update_one({"clip_id": clip_id}, {"$inc": {"shares": 1}})
    share_link = f"https://bidblitz.com/clip/{clip_id}"
    return {"ok": True, "share_link": share_link, "message": "Link kopiert! Teile ihn mit Freunden."}

# ─── SHARE-TO-EARN ───
@router.post("/share-earn")
async def share_to_earn(request: Request):
    user = await get_current_user(request)
    link = f"https://bidblitz.com/join/{hashlib.sha256(user.get('email','').encode()).hexdigest()[:8]}"
    await db.share_links.insert_one({"user_email": user.get("email",""), "link": link, "clicks": 0, "signups": 0, "earned": 0, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "link": link, "reward_per_signup": 2.0, "message": "Share-Link erstellt! 2 EUR pro Anmeldung."}

@router.get("/share-earn/stats")
async def share_stats(request: Request):
    user = await get_current_user(request)
    links = await db.share_links.find({"user_email": user.get("email","")}, {"_id": 0}).to_list(10)
    total_earned = sum(l.get("earned", 0) for l in links)
    total_signups = sum(l.get("signups", 0) for l in links)
    return {"links": links, "total_earned": round(total_earned, 2), "total_signups": total_signups}

# ─── VIRAL CHALLENGES ───
CHALLENGES = [
    {"id": "ch1", "title": "Spare 100 EUR in 7 Tagen", "desc": "Schaffe es, 100 EUR in einer Woche zu sparen", "prize": "25 EUR Bonus", "participants": 4500, "ends": "2026-05-01", "category": "Sparen", "color": "#22C55E"},
    {"id": "ch2", "title": "10 Trades in 24 Stunden", "desc": "Fuehre 10 Crypto-Trades in einem Tag durch", "prize": "50 EUR + Gold-Abo", "participants": 2300, "ends": "2026-04-30", "category": "Trading", "color": "#F7931A"},
    {"id": "ch3", "title": "5 Freunde einladen", "desc": "Lade 5 Freunde in einer Woche ein", "prize": "100 EUR Bonus", "participants": 8900, "ends": "2026-05-15", "category": "Social", "color": "#8B5CF6"},
    {"id": "ch4", "title": "7-Tage Streak Challenge", "desc": "Nutze die App 7 Tage hintereinander", "prize": "15 EUR + Badge", "participants": 12400, "ends": "2026-05-10", "category": "Engagement", "color": "#EF4444"},
    {"id": "ch5", "title": "Quiz Master: 10 Siege", "desc": "Gewinne 10 Quiz-Battles", "prize": "75 EUR + Legendary Badge", "participants": 1800, "ends": "2026-05-20", "category": "Gaming", "color": "#06B6D4"},
]

@router.get("/challenges")
async def get_challenges():
    return {"challenges": CHALLENGES}

@router.post("/challenges/join/{challenge_id}")
async def join_challenge(challenge_id: str, request: Request):
    user = await get_current_user(request)
    ch = next((c for c in CHALLENGES if c["id"] == challenge_id), None)
    if not ch: raise HTTPException(404, "Challenge nicht gefunden")
    await db.challenge_participants.insert_one({"user_email": user.get("email",""), "challenge_id": challenge_id, "progress": 0, "status": "active", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "message": f"Challenge '{ch['title']}' beigetreten! Preis: {ch['prize']}"}

# ─── LIVE ACTIVITY FEED ───
@router.get("/live-feed")
async def live_feed():
    activities = [
        {"user": "Ma***", "action": "hat 500 EUR im Quiz gewonnen", "time": "gerade eben", "type": "win", "amount": 500},
        {"user": "Li***", "action": "hat BTC DCA Bot gestartet", "time": "vor 2 Min", "type": "bot", "amount": 200},
        {"user": "To***", "action": "hat den 50 EUR JACKPOT gedreht!", "time": "vor 5 Min", "type": "jackpot", "amount": 50},
        {"user": "Sa***", "action": "hat Ruby Steel Karte bestellt", "time": "vor 8 Min", "type": "card", "amount": 0},
        {"user": "Ke***", "action": "hat 0.5 BTC als Kredit hinterlegt", "time": "vor 12 Min", "type": "loan", "amount": 34250},
        {"user": "An***", "action": "hat 3 Freunde eingeladen", "time": "vor 15 Min", "type": "referral", "amount": 15},
        {"user": "Ju***", "action": "hat Nike Air Max im Live-Shopping gekauft", "time": "vor 18 Min", "type": "shopping", "amount": 133},
        {"user": "Mi***", "action": "hat Obsidian Level Up abonniert", "time": "vor 22 Min", "type": "premium", "amount": 49.99},
        {"user": "Pa***", "action": "hat 100 BLZ Airdrop geclaimed", "time": "vor 25 Min", "type": "airdrop", "amount": 5},
        {"user": "Em***", "action": "hat Quiz Battle 5/5 gewonnen!", "time": "vor 30 Min", "type": "quiz", "amount": 9},
    ]
    return {"activities": activities}

# ─── INVITE STREAK BONUS ───
@router.get("/invite-streak")
async def invite_streak(request: Request):
    user = await get_current_user(request)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent = await db.levelup_referrals.find_one({"user_email": user.get("email","")}, {"_id": 0})
    recent_refs = [r for r in (recent or {}).get("referrals", []) if r.get("date", "") >= week_ago]
    streak = len(recent_refs)
    bonus_unlocked = streak >= 3
    return {"streak": streak, "target": 3, "bonus_eur": 25 if bonus_unlocked else 0, "bonus_unlocked": bonus_unlocked,
            "message": f"{streak}/3 Einladungen diese Woche" + (" — 25 EUR Bonus freigeschaltet!" if bonus_unlocked else "")}

# ─── PROFILE CARD (Jahresrueckblick/Wrapped) ───
@router.get("/profile-card")
async def profile_card(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    txs = await db.nfc_transactions.count_documents({"user_email": email})
    quizzes = await db.quiz_matches.count_documents({"user_email": email, "won": True})
    referrals = 0
    ref = await db.levelup_referrals.find_one({"user_email": email})
    if ref: referrals = ref.get("total_referrals", 0)
    card = {
        "name": user.get("name", "BidBlitz User"),
        "member_since": "2026",
        "total_transactions": txs + random.randint(20, 100),
        "quiz_wins": quizzes + random.randint(0, 5),
        "friends_invited": referrals,
        "top_category": random.choice(["Crypto", "Shopping", "Gaming", "Finance"]),
        "level": random.randint(3, 15),
        "badges": random.randint(2, 8),
        "share_text": f"Mein BidBlitz 2026 Jahresrueckblick: {txs + random.randint(20, 100)} Transaktionen, Level {random.randint(3, 15)}! 🚀",
    }
    return {"card": card}
