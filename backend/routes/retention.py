"""
Retention Features v2:
1. Streak-Kalender (täglicher Login-Streak mit Milestone-Rewards)
2. Leaderboard (Top-User wöchentlich)
3. BLZ↔EUR Exchange (Wechselrate 1 EUR = 300 BLZ verkaufen / 350 BLZ kaufen)
4. Geschenk-Codes (Gift-Code-System)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
import secrets
import string

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api", tags=["retention"])


def _oid(s):
    try: return ObjectId(s)
    except Exception: return s


def _today(): return datetime.now(timezone.utc).date().isoformat()
def _now(): return datetime.now(timezone.utc).isoformat()


# ══════════════════════════════════════════════════════════════
# 1. STREAK CALENDAR
# ══════════════════════════════════════════════════════════════

STREAK_MILESTONES = {
    3:  {"blz": 10,  "eur": 0,  "label": "3 Tage"},
    7:  {"blz": 50,  "eur": 0,  "label": "1 Woche"},
    14: {"blz": 150, "eur": 0,  "label": "2 Wochen"},
    30: {"blz": 500, "eur": 5,  "label": "1 Monat 🏆"},
    60: {"blz": 1000,"eur": 10, "label": "2 Monate"},
    100:{"blz": 3000,"eur": 25, "label": "100 Tage 💎"},
}


async def _get_streak(user_id: str) -> dict:
    s = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0})
    if not s:
        return {"user_id": user_id, "current_streak": 0, "longest_streak": 0, "last_login": None, "claimed_milestones": []}
    return s


@router.get("/streak/status")
async def streak_status(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    s = await _get_streak(uid)
    today = _today()

    # Update streak if logged in today
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    last = s.get("last_login")
    current = s.get("current_streak", 0)
    changed = False

    if last == today:
        pass  # already counted today
    elif last == yesterday:
        current += 1
        changed = True
    else:
        current = 1  # reset
        changed = True

    if changed:
        longest = max(s.get("longest_streak", 0), current)
        await db.user_streaks.update_one(
            {"user_id": uid},
            {"$set": {"current_streak": current, "last_login": today, "longest_streak": longest},
             "$setOnInsert": {"claimed_milestones": [], "started_at": _now()}},
            upsert=True,
        )
        s["current_streak"] = current
        s["longest_streak"] = longest
        s["last_login"] = today

    claimed = set(s.get("claimed_milestones", []))
    # Which milestone is unlockable now?
    unlockable = None
    for days, reward in STREAK_MILESTONES.items():
        if current >= days and days not in claimed:
            unlockable = {"days": days, **reward}
            break

    # Next target
    next_target = None
    for days in sorted(STREAK_MILESTONES.keys()):
        if current < days:
            next_target = {"days": days, **STREAK_MILESTONES[days]}
            break

    # Build 14-day heatmap (last 14 days incl. today)
    today_date = datetime.now(timezone.utc).date()
    heatmap = []
    for i in range(13, -1, -1):
        d = (today_date - timedelta(days=i)).isoformat()
        # Active if within current streak window
        days_ago = i
        active = (current - days_ago) > 0 and d <= today
        heatmap.append({"date": d, "active": active})

    return {
        "current_streak": current,
        "longest_streak": s.get("longest_streak", current),
        "last_login": s.get("last_login", today),
        "claimed_milestones": sorted(list(claimed)),
        "unlockable_milestone": unlockable,
        "next_milestone": next_target,
        "milestones": [{"days": d, **r, "claimed": d in claimed, "reached": current >= d} for d, r in sorted(STREAK_MILESTONES.items())],
        "heatmap": heatmap,
    }


@router.post("/streak/claim/{days}")
async def claim_streak_milestone(days: int, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if days not in STREAK_MILESTONES:
        raise HTTPException(400, "Unbekanntes Streak-Ziel")
    s = await _get_streak(uid)
    if s.get("current_streak", 0) < days:
        raise HTTPException(400, f"Du brauchst noch {days - s.get('current_streak', 0)} Tag(e)")
    claimed = s.get("claimed_milestones", [])
    if days in claimed:
        raise HTTPException(400, "Belohnung bereits abgeholt")

    reward = STREAK_MILESTONES[days]
    inc = {}
    if reward.get("blz"): inc["balance_blz"] = reward["blz"]
    if reward.get("eur"): inc["balance"] = reward["eur"]
    if inc:
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": inc})
    claimed.append(days)
    await db.user_streaks.update_one({"user_id": uid}, {"$set": {"claimed_milestones": claimed}})

    now = _now()
    await db.transactions.insert_one({
        "user_id": uid, "type": "bonus",
        "amount": reward.get("blz") or reward.get("eur"),
        "currency": "BLZ" if reward.get("blz") else "EUR",
        "status": "completed", "description": f"🔥 Streak {reward['label']}",
        "merchant_name": "BidBlitz", "category": "streak_milestone",
        "reference": f"STREAK-{days}-{_today()}",
        "date": now, "created_at": now,
    })
    return {"ok": True, "reward": reward}


# ══════════════════════════════════════════════════════════════
# 2. LEADERBOARD
# ══════════════════════════════════════════════════════════════

LEADERBOARD_TYPES = {
    "earnings_week":  {"label": "Verdient diese Woche (€)", "field": "week_earnings"},
    "mining_week":    {"label": "BLZ gemint", "field": "week_blz"},
    "referrals_week": {"label": "Freunde eingeladen", "field": "week_refs"},
    "streak":         {"label": "Längster Streak", "field": "streak"},
}


@router.get("/leaderboard/{type}")
async def leaderboard(type: str, limit: int = 20):
    """Top users by category. Shows first name + avatar + rank."""
    if type not in LEADERBOARD_TYPES:
        raise HTTPException(400, "Unbekannte Kategorie")
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_iso = week_start.isoformat()

    if type == "earnings_week":
        # Sum of all positive EUR transactions this week (type=bonus,referral,taxi_earning)
        pipeline = [
            {"$match": {"currency": "EUR", "amount": {"$gt": 0}, "created_at": {"$gte": week_iso},
                        "type": {"$in": ["bonus", "referral", "TAXI_EARNING", "taxi_earning", "payment"]}}},
            {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}},
            {"$limit": limit},
        ]
        results = await db.transactions.aggregate(pipeline).to_list(limit)
        unit = "€"
    elif type == "mining_week":
        pipeline = [
            {"$match": {"currency": "BLZ", "amount": {"$gt": 0}, "created_at": {"$gte": week_iso}}},
            {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}},
            {"$limit": limit},
        ]
        results = await db.transactions.aggregate(pipeline).to_list(limit)
        unit = "BLZ"
    elif type == "referrals_week":
        pipeline = [
            {"$match": {"created_at": {"$gte": week_iso}, "referred_by": {"$exists": True, "$ne": None, "$ne": ""}}},
            {"$group": {"_id": "$referred_by", "total": {"$sum": 1}}},
            {"$sort": {"total": -1}},
            {"$limit": limit},
        ]
        results = await db.users.aggregate(pipeline).to_list(limit)
        unit = "Freunde"
    else:  # streak
        pipeline = [
            {"$sort": {"current_streak": -1}},
            {"$limit": limit},
            {"$project": {"_id": "$user_id", "total": "$current_streak"}},
        ]
        results = await db.user_streaks.aggregate(pipeline).to_list(limit)
        unit = "Tage"

    # Enrich with user info (first name + avatar only for privacy)
    board = []
    for rank, row in enumerate(results, 1):
        try:
            u = await db.users.find_one({"_id": ObjectId(row["_id"])}, {"name": 1, "avatar": 1, "_id": 0})
            if not u: continue
            first = (u.get("name", "").split() or ["?"])[0]
            board.append({
                "rank": rank,
                "name": first,
                "avatar": u.get("avatar"),
                "value": round(float(row["total"]), 2) if type in ("earnings_week",) else int(row["total"]),
                "unit": unit,
            })
        except Exception:
            pass
    return {"type": type, "label": LEADERBOARD_TYPES[type]["label"], "entries": board, "count": len(board)}


@router.get("/leaderboard/me/rank")
async def my_leaderboard_rank(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Earnings this week
    my_earnings = 0.0
    async for r in db.transactions.aggregate([
        {"$match": {"user_id": uid, "currency": "EUR", "amount": {"$gt": 0}, "created_at": {"$gte": week_start},
                    "type": {"$in": ["bonus", "referral", "TAXI_EARNING", "taxi_earning"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]):
        my_earnings = round(float(r.get("total", 0)), 2)

    my_blz = 0
    async for r in db.transactions.aggregate([
        {"$match": {"user_id": uid, "currency": "BLZ", "amount": {"$gt": 0}, "created_at": {"$gte": week_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]):
        my_blz = int(r.get("total", 0))

    streak_doc = await db.user_streaks.find_one({"user_id": uid}, {"current_streak": 1, "_id": 0})
    return {
        "earnings_week": my_earnings,
        "mining_week": my_blz,
        "streak": streak_doc.get("current_streak", 0) if streak_doc else 0,
    }


# ══════════════════════════════════════════════════════════════
# 3. BLZ ↔ EUR EXCHANGE
# ══════════════════════════════════════════════════════════════

# Rates (bank-style: platform takes the spread)
RATE_BLZ_PER_EUR_BUY  = 350  # User kauft: 1 € → bekommt nur 300 BLZ (Platform nimmt 50 BLZ Spread)
RATE_BLZ_PER_EUR_SELL = 400  # User verkauft: 400 BLZ → 1 € (Platform behält Spread)
MIN_EXCHANGE_EUR = 0.50
MAX_EXCHANGE_EUR_DAY = 100.0  # Anti-abuse


@router.get("/exchange/rates")
async def exchange_rates(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    # Check daily limit
    day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    used_today = 0.0
    async for r in db.transactions.aggregate([
        {"$match": {"user_id": uid, "category": "exchange", "created_at": {"$gte": day_start}}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]):
        used_today = float(r.get("total", 0))
    return {
        "buy_rate": RATE_BLZ_PER_EUR_BUY,   # 1€ gives you X BLZ
        "sell_rate": RATE_BLZ_PER_EUR_SELL, # X BLZ gives you 1€
        "min_eur": MIN_EXCHANGE_EUR,
        "max_per_day": MAX_EXCHANGE_EUR_DAY,
        "used_today": round(used_today, 2),
        "remaining_today": round(MAX_EXCHANGE_EUR_DAY - used_today, 2),
        "balance_eur": round(float(user.get("balance", 0) or 0), 2),
        "balance_blz": int(float(user.get("balance_blz", 0) or 0)),
    }


class ExchangeRequest(BaseModel):
    direction: str = Field(..., pattern="^(buy_blz|sell_blz)$")  # buy_blz = EUR→BLZ, sell_blz = BLZ→EUR
    amount: float = Field(..., gt=0)  # amount in EUR


@router.post("/exchange/execute")
async def execute_exchange(req: ExchangeRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    eur = float(req.amount)
    if eur < MIN_EXCHANGE_EUR:
        raise HTTPException(400, f"Mindestbetrag: €{MIN_EXCHANGE_EUR}")

    # Daily limit
    day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    used_today = 0.0
    async for r in db.transactions.aggregate([
        {"$match": {"user_id": uid, "category": "exchange", "created_at": {"$gte": day_start}}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]):
        used_today = float(r.get("total", 0))
    if used_today + eur > MAX_EXCHANGE_EUR_DAY:
        raise HTTPException(400, f"Tageslimit überschritten (€{MAX_EXCHANGE_EUR_DAY - used_today:.2f} übrig)")

    if req.direction == "buy_blz":
        bal_eur = float(user.get("balance", 0) or 0)
        if bal_eur < eur:
            raise HTTPException(400, "Nicht genug EUR-Guthaben")
        blz = int(eur * RATE_BLZ_PER_EUR_BUY)
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -eur, "balance_blz": blz}})
        msg = f"Exchange: €{eur:.2f} → {blz} BLZ"
    else:  # sell_blz
        blz_needed = int(eur * RATE_BLZ_PER_EUR_SELL)
        bal_blz = float(user.get("balance_blz", 0) or 0)
        if bal_blz < blz_needed:
            raise HTTPException(400, f"Du brauchst {blz_needed} BLZ (hast {int(bal_blz)})")
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": -blz_needed, "balance": eur}})
        blz = blz_needed
        msg = f"Exchange: {blz_needed} BLZ → €{eur:.2f}"

    now = _now()
    await db.transactions.insert_one({
        "user_id": uid, "type": "exchange",
        "amount": eur if req.direction == "buy_blz" else -eur,
        "currency": "EUR",
        "status": "completed", "description": msg,
        "merchant_name": "BidBlitz Exchange", "category": "exchange",
        "reference": f"EX-{secrets.token_hex(4)}",
        "metadata": {"direction": req.direction, "blz": blz, "eur": eur},
        "date": now, "created_at": now,
    })
    return {"ok": True, "direction": req.direction, "eur": eur, "blz": blz}


# ══════════════════════════════════════════════════════════════
# 5. ADMIN REVENUE DASHBOARD
# ══════════════════════════════════════════════════════════════

async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")
    return user


@router.get("/admin/revenue-dashboard")
async def admin_revenue_dashboard(request: Request):
    """Alle Umsatz-Quellen für den Admin auf einen Blick."""
    await _require_admin(request)
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    async def sum_category(category, date_from=None, currency="EUR"):
        match = {"category": category, "currency": currency, "amount": {"$gt": 0}}
        if date_from:
            match["created_at"] = {"$gte": date_from.isoformat()}
        total = 0.0
        count = 0
        async for r in db.transactions.aggregate([
            {"$match": match},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]):
            total = float(r.get("sum", 0))
            count = int(r.get("count", 0))
        return {"total": round(total, 2), "count": count}

    # Revenue sources (positive EUR flows into platform)
    sources = {
        "premium":           "premium",
        "classified_boost":  "classified_boost",
        "gift_code":         "gift_code",
        "exchange":          "exchange",
        "ad_banner":         "ad_banner",
        "promote":           "promote",
        "instant_cashout":   "instant_cashout",
        "job_boost":         "job_boost",
        "kyc_express":       "kyc_express",
        "spin_wheel":        "spin_wheel",  # costs platform (negative)
        "streak_milestone":  "streak_milestone",  # costs platform
        "birthday":          "birthday",  # costs platform
    }

    result = {"sources": {}, "totals": {"today": 0, "week": 0, "month": 0, "all_time": 0}}
    for label, cat in sources.items():
        today_v = await sum_category(cat, today)
        week_v = await sum_category(cat, week_start)
        month_v = await sum_category(cat, month_start)
        all_v = await sum_category(cat, None)
        result["sources"][label] = {
            "today": today_v["total"], "week": week_v["total"],
            "month": month_v["total"], "all_time": all_v["total"],
            "count_total": all_v["count"],
        }
        # Only count income-sources in totals (not payouts-to-user)
        if cat not in ("spin_wheel", "streak_milestone", "birthday"):
            result["totals"]["today"] += today_v["total"]
            result["totals"]["week"] += week_v["total"]
            result["totals"]["month"] += month_v["total"]
            result["totals"]["all_time"] += all_v["total"]

    # Round
    for k in result["totals"]:
        result["totals"][k] = round(result["totals"][k], 2)

    # User stats
    total_users = await db.users.count_documents({})
    users_today = await db.users.count_documents({"created_at": {"$gte": today.isoformat()}})
    users_week = await db.users.count_documents({"created_at": {"$gte": week_start.isoformat()}})

    # Premium subscriptions (MRR)
    active_premium = await db.premium_subscriptions.count_documents({"active": True})
    mrr = round(active_premium * 4.99, 2)

    result["users"] = {"total": total_users, "today": users_today, "week": users_week}
    result["mrr"] = {"active_premium": active_premium, "mrr_eur": mrr}

    # Top spenders
    top_pipeline = [
        {"$match": {"amount": {"$gt": 0}, "currency": "EUR",
                    "type": {"$in": ["payment", "exchange"]}}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ]
    top_spenders = []
    async for r in db.transactions.aggregate(top_pipeline):
        try:
            u = await db.users.find_one({"_id": ObjectId(r["_id"])}, {"name": 1, "email": 1, "_id": 0})
            if u:
                top_spenders.append({
                    "name": u.get("name"), "email": u.get("email"),
                    "spent": round(float(r["total"]), 2),
                    "tx_count": int(r["count"]),
                })
        except Exception:
            pass
    result["top_spenders"] = top_spenders

    return result


# ══════════════════════════════════════════════════════════════
# 4. GIFT CODES
# ══════════════════════════════════════════════════════════════

GIFT_MIN_EUR = 1.0
GIFT_MAX_EUR = 100.0


def _gen_gift_code() -> str:
    """Format: GIFT-XXXX-XXXX (user-friendly)."""
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return f"GIFT-{''.join(secrets.choice(chars) for _ in range(4))}-{''.join(secrets.choice(chars) for _ in range(4))}"


class GiftCreateRequest(BaseModel):
    amount_eur: float = Field(..., ge=GIFT_MIN_EUR, le=GIFT_MAX_EUR)
    message: Optional[str] = Field(None, max_length=200)


@router.post("/gift/create")
async def create_gift_code(req: GiftCreateRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bal = float(user.get("balance", 0) or 0)
    if bal < req.amount_eur:
        raise HTTPException(400, f"Nicht genug Guthaben (brauchst €{req.amount_eur})")

    code = _gen_gift_code()
    while await db.gift_codes.find_one({"code": code}):
        code = _gen_gift_code()

    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -req.amount_eur}})
    now = _now()
    await db.gift_codes.insert_one({
        "code": code,
        "from_user_id": uid,
        "from_name": user.get("name"),
        "amount_eur": req.amount_eur,
        "message": (req.message or "").strip(),
        "redeemed": False,
        "redeemed_by": None,
        "redeemed_at": None,
        "created_at": now,
    })
    await db.transactions.insert_one({
        "user_id": uid, "type": "payment",
        "amount": req.amount_eur, "currency": "EUR",
        "status": "completed", "description": f"🎁 Geschenk-Code gekauft ({code})",
        "merchant_name": "BidBlitz", "category": "gift_code",
        "reference": code,
        "date": now, "created_at": now,
    })
    return {
        "ok": True,
        "code": code,
        "amount_eur": req.amount_eur,
        "share_url": f"https://bidblitz.ae/redeem?code={code}",
        "share_text": f"🎁 Ich habe dir €{req.amount_eur} BidBlitz-Guthaben geschenkt! Löse ein mit Code: {code} auf https://bidblitz.ae",
    }


class GiftRedeemRequest(BaseModel):
    code: str = Field(..., min_length=6)


@router.post("/gift/redeem")
async def redeem_gift_code(req: GiftRedeemRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    code = req.code.strip().upper()
    gift = await db.gift_codes.find_one({"code": code})
    if not gift:
        raise HTTPException(404, "Code nicht gefunden oder ungültig")
    if gift.get("redeemed"):
        raise HTTPException(400, "Dieser Code wurde bereits eingelöst")
    if gift.get("from_user_id") == uid:
        raise HTTPException(400, "Du kannst eigene Codes nicht einlösen")

    now = _now()
    amount = float(gift["amount_eur"])
    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": amount}})
    await db.gift_codes.update_one(
        {"code": code},
        {"$set": {"redeemed": True, "redeemed_by": uid, "redeemed_by_name": user.get("name"), "redeemed_at": now}},
    )
    await db.transactions.insert_one({
        "user_id": uid, "type": "bonus",
        "amount": amount, "currency": "EUR",
        "status": "completed",
        "description": f"🎁 Geschenk-Code von {gift.get('from_name', 'Freund')} eingelöst",
        "merchant_name": "BidBlitz", "category": "gift_code_redeem",
        "reference": code,
        "date": now, "created_at": now,
    })
    # Notify sender
    if gift.get("from_user_id"):
        await db.notifications.insert_one({
            "notification_id": secrets.token_hex(8),
            "user_id": gift["from_user_id"],
            "title": "🎁 Dein Geschenk wurde eingelöst!",
            "message": f"{user.get('name', 'Dein Freund')} hat €{amount} eingelöst",
            "type": "gift_redeemed", "read": False, "created_at": now,
        })
    return {"ok": True, "amount_eur": amount, "from_name": gift.get("from_name"), "message": gift.get("message")}


@router.get("/gift/my-codes")
async def my_gift_codes(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.gift_codes.find({"from_user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(50)
    codes = await cursor.to_list(50)
    return {"codes": codes, "count": len(codes)}
