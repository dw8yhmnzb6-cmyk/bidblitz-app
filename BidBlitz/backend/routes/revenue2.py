"""
Revenue Features Batch 2:
3. Premium Abo (Monthly, BLZ-based initially, Stripe-ready)
4. Marketplace Fee (2.9% on peer transactions)
5. Lottery (tägliche Verlosung mit BLZ-Losen)
"""
from datetime import datetime, timezone, timedelta
import random
import secrets
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
import logging

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.revenue2")
router = APIRouter(prefix="/api", tags=["revenue2"])


def _oid(s):
    try: return ObjectId(s)
    except Exception: return s


# ═══════════════════════════════════════════════════════════
# 3. PREMIUM ABO
# ═══════════════════════════════════════════════════════════
PREMIUM_PRICE_EUR = 4.99
PREMIUM_PRICE_BLZ = 499  # Alternative: 499 BLZ = 1 Monat
PREMIUM_BENEFITS = {
    "no_auction_fees": True,
    "mining_multiplier": 2.0,
    "monthly_blz_bonus": 50,
    "cashback_pct": 0.05,
    "priority_support": True,
    "premium_badge": True,
}

# Launch-Event: 50% Rabatt bis 7 Tage nach Launch
PREMIUM_LAUNCH_START = datetime(2026, 4, 19, tzinfo=timezone.utc)
PREMIUM_LAUNCH_DURATION_DAYS = 7
PREMIUM_LAUNCH_DISCOUNT = 0.50  # 50% off


def _launch_info():
    """Return launch-event state + effective prices."""
    now = datetime.now(timezone.utc)
    ends_at = PREMIUM_LAUNCH_START + timedelta(days=PREMIUM_LAUNCH_DURATION_DAYS)
    active = PREMIUM_LAUNCH_START <= now < ends_at
    if active:
        eur = round(PREMIUM_PRICE_EUR * (1 - PREMIUM_LAUNCH_DISCOUNT), 2)
        blz = int(round(PREMIUM_PRICE_BLZ * (1 - PREMIUM_LAUNCH_DISCOUNT)))
    else:
        eur, blz = PREMIUM_PRICE_EUR, PREMIUM_PRICE_BLZ
    return {
        "launch_active": active,
        "discount_pct": int(PREMIUM_LAUNCH_DISCOUNT * 100) if active else 0,
        "launch_ends_at": ends_at.isoformat(),
        "price_eur": eur,
        "price_blz": blz,
        "original_price_eur": PREMIUM_PRICE_EUR,
        "original_price_blz": PREMIUM_PRICE_BLZ,
    }


@router.get("/premium/status")
async def premium_status(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    info = _launch_info()
    balance_eur = round(float(user.get("balance", 0) or 0), 2)
    balance_blz = int(float(user.get("balance_blz", 0) or 0))
    sub = await db.premium_subscriptions.find_one({"user_id": uid, "active": True})
    if not sub:
        return {
            "active": False, "benefits": PREMIUM_BENEFITS,
            "balance_eur": balance_eur, "balance_blz": balance_blz,
            **info,
        }
    sub.pop("_id", None)
    now = datetime.now(timezone.utc)
    expires_at = sub.get("expires_at")
    expired = False
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt < now:
                expired = True
                await db.premium_subscriptions.update_one({"user_id": uid}, {"$set": {"active": False}})
        except Exception:
            pass
    return {
        "active": not expired,
        "subscription": sub,
        "benefits": PREMIUM_BENEFITS,
        "balance_eur": balance_eur,
        "balance_blz": balance_blz,
        **info,
    }


class PremiumPurchaseRequest(BaseModel):
    payment_method: str = Field(..., pattern="^(eur|blz)$")


@router.post("/premium/purchase")
async def purchase_premium(req: PremiumPurchaseRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    info = _launch_info()
    price_eur = info["price_eur"]
    price_blz = info["price_blz"]
    # Check active sub
    existing = await db.premium_subscriptions.find_one({"user_id": uid, "active": True})
    if req.payment_method == "eur":
        bal = float(user.get("balance", 0) or 0)
        if bal < price_eur:
            raise HTTPException(400, f"Nicht genug Guthaben (brauchst €{price_eur})")
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -price_eur}})
        amount, currency = price_eur, "EUR"
    else:
        bal = float(user.get("balance_blz", 0) or 0)
        if bal < price_blz:
            raise HTTPException(400, f"Nicht genug BLZ (brauchst {price_blz})")
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": -price_blz}})
        amount, currency = price_blz, "BLZ"


    now = datetime.now(timezone.utc)
    # Extend existing or create new
    if existing:
        current_expires = existing.get("expires_at")
        base = now
        if current_expires:
            try:
                exp_dt = datetime.fromisoformat(current_expires.replace("Z", "+00:00"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                if exp_dt > now:
                    base = exp_dt
            except Exception:
                pass
        new_expires = (base + timedelta(days=30)).isoformat()
        await db.premium_subscriptions.update_one(
            {"user_id": uid},
            {"$set": {"expires_at": new_expires, "last_renewed_at": now.isoformat(), "active": True}},
        )
    else:
        new_expires = (now + timedelta(days=30)).isoformat()
        await db.premium_subscriptions.insert_one({
            "user_id": uid,
            "active": True,
            "started_at": now.isoformat(),
            "expires_at": new_expires,
            "last_renewed_at": now.isoformat(),
        })
    # Credit monthly BLZ bonus
    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": PREMIUM_BENEFITS["monthly_blz_bonus"]}})

    desc = "BidBlitz Premium (30 Tage)"
    if info["launch_active"]:
        desc = f"BidBlitz Premium (30 Tage · LAUNCH -{info['discount_pct']}%)"
    await db.transactions.insert_one({
        "user_id": uid, "type": "payment", "amount": amount, "currency": currency,
        "status": "completed", "description": desc,
        "merchant_name": "BidBlitz", "category": "premium",
        "reference": f"PREM-{now.strftime('%Y%m%d%H%M%S')}",
        "date": now.isoformat(), "created_at": now.isoformat(),
    })
    return {"ok": True, "expires_at": new_expires, "bonus_blz": PREMIUM_BENEFITS["monthly_blz_bonus"], "launch_discount": info["launch_active"]}


@router.post("/premium/cancel")
async def cancel_premium(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    result = await db.premium_subscriptions.update_one(
        {"user_id": uid, "active": True},
        {"$set": {"auto_renew": False, "canceled_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "canceled": result.matched_count > 0}


# ═══════════════════════════════════════════════════════════
# 4. MARKETPLACE FEE (2.9% + 0.30€)
# ═══════════════════════════════════════════════════════════
MARKETPLACE_FEE_PCT = 0.029
MARKETPLACE_FEE_FIXED = 0.30


def calc_marketplace_fee(amount: float) -> dict:
    fee = round(amount * MARKETPLACE_FEE_PCT + MARKETPLACE_FEE_FIXED, 2)
    return {"fee": fee, "net": round(amount - fee, 2), "pct": MARKETPLACE_FEE_PCT, "fixed": MARKETPLACE_FEE_FIXED}


@router.get("/marketplace/fee-info")
async def fee_info():
    return {
        "fee_pct": MARKETPLACE_FEE_PCT,
        "fee_fixed": MARKETPLACE_FEE_FIXED,
        "example_100": calc_marketplace_fee(100),
        "example_500": calc_marketplace_fee(500),
    }


class MarketplaceTransferRequest(BaseModel):
    recipient_email: str
    amount: float = Field(gt=0)
    note: Optional[str] = ""


@router.post("/marketplace/transfer")
async def marketplace_transfer(req: MarketplaceTransferRequest, request: Request):
    """P2P-Transfer MIT 2,9% + 0,30€ Fee. Fee geht an BidBlitz."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bal = float(user.get("balance", 0) or 0)

    recipient = await db.users.find_one({"email": req.recipient_email.strip().lower()})
    if not recipient:
        raise HTTPException(404, "Empfänger nicht gefunden")
    rid = str(recipient.get("_id") or recipient.get("id"))
    if rid == uid:
        raise HTTPException(400, "Selbst-Transfer nicht möglich")

    fee_info_result = calc_marketplace_fee(req.amount)
    total = req.amount  # sender pays full amount
    net = fee_info_result["net"]  # recipient receives amount minus fee
    if bal < total:
        raise HTTPException(400, f"Nicht genug Guthaben (benötigt: €{total})")

    # Execute transfer
    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -total}})
    await db.users.update_one({"_id": _oid(rid)}, {"$inc": {"balance": net}})

    now = datetime.now(timezone.utc).isoformat()
    tx_ref = f"MKT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    # Log both sides
    await db.transactions.insert_one({
        "user_id": uid, "type": "transfer", "amount": total, "currency": "EUR",
        "status": "completed", "description": f"Marketplace Transfer an {req.recipient_email}: {req.note or ''}",
        "merchant_name": req.recipient_email, "category": "marketplace",
        "reference": tx_ref, "date": now, "created_at": now,
        "fee": fee_info_result["fee"],
    })
    await db.transactions.insert_one({
        "user_id": rid, "type": "transfer", "amount": net, "currency": "EUR",
        "status": "completed", "description": f"Marketplace Empfang von {user.get('email')}: {req.note or ''}",
        "merchant_name": user.get("email"), "category": "marketplace",
        "reference": tx_ref + "-R", "date": now, "created_at": now,
    })
    # Fee tracking
    await db.marketplace_fees.insert_one({
        "amount": req.amount, "fee": fee_info_result["fee"], "net": net,
        "sender_id": uid, "recipient_id": rid, "reference": tx_ref, "created_at": now,
    })
    return {
        "ok": True,
        "amount_charged": total,
        "amount_received": net,
        "fee": fee_info_result["fee"],
        "tx_ref": tx_ref,
    }


# ═══════════════════════════════════════════════════════════
# 5. LOTTERIE
# ═══════════════════════════════════════════════════════════
LOTTERY_TICKET_PRICE_BLZ = 10  # 10 BLZ pro Los

# Echte Sachpreise pro Tier (Bilder via Unsplash CDN, Wert in EUR)
LOTTERY_PRIZE_POOL = {
    "grand": {
        "blz": 5000,
        "count_per_draw": 1,
        "label_de": "Hauptpreis",
        "label_en": "Grand Prize",
        "items": [
            {
                "name": "iPhone 17 Pro 256GB",
                "value_eur": 1499,
                "image": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80",
                "description": "Brandneues iPhone 17 Pro in Titanium-Schwarz",
            },
            {
                "name": "MacBook Air M4",
                "value_eur": 1299,
                "image": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
                "description": "MacBook Air mit M4-Chip, 13 Zoll, 256GB",
            },
        ],
    },
    "big": {
        "blz": 500,
        "count_per_draw": 5,
        "label_de": "Großer Preis",
        "label_en": "Big Prize",
        "items": [
            {
                "name": "AirPods Pro 3",
                "value_eur": 279,
                "image": "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80",
                "description": "AirPods Pro mit Active Noise Cancelling",
            },
            {
                "name": "Apple Watch SE",
                "value_eur": 299,
                "image": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80",
                "description": "Apple Watch SE 44mm GPS",
            },
            {
                "name": "Amazon Gutschein 250€",
                "value_eur": 250,
                "image": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80",
                "description": "Amazon.de Gutschein im Wert von 250€",
            },
        ],
    },
    "small": {
        "blz": 50,
        "count_per_draw": 20,
        "label_de": "Kleiner Preis",
        "label_en": "Small Prize",
        "items": [
            {
                "name": "Restaurant-Gutschein 50€",
                "value_eur": 50,
                "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
                "description": "Gutschein für Partner-Restaurants",
            },
            {
                "name": "Lieferando Gutschein 50€",
                "value_eur": 50,
                "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
                "description": "Lieferando Bestellgutschein",
            },
            {
                "name": "Netflix 3 Monate",
                "value_eur": 45,
                "image": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&q=80",
                "description": "Netflix Premium 3 Monate",
            },
        ],
    },
    "mini": {
        "blz": 15,
        "count_per_draw": 100,
        "label_de": "Mini-Preis",
        "label_en": "Mini Prize",
        "items": [
            {
                "name": "Kaffee-Gutschein 15€",
                "value_eur": 15,
                "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
                "description": "Starbucks / lokaler Coffee-Shop",
            },
            {
                "name": "Spotify Premium 1 Monat",
                "value_eur": 11,
                "image": "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=600&q=80",
                "description": "1 Monat Spotify Premium",
            },
            {
                "name": "BLZ Bonus-Token",
                "value_eur": 15,
                "image": "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=600&q=80",
                "description": "Direkt aufgeladen ins BidBlitz Wallet",
            },
        ],
    },
}


async def _current_lottery_draw():
    """Get or create today's draw."""
    today = datetime.now(timezone.utc).date().isoformat()
    draw = await db.lottery_draws.find_one({"draw_date": today})
    if not draw:
        await db.lottery_draws.insert_one({
            "draw_date": today,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": "open",
            "tickets": [],
            "winners": None,
            "drawn_at": None,
        })
        draw = await db.lottery_draws.find_one({"draw_date": today})
    draw.pop("_id", None)
    return draw


@router.get("/lottery/current")
async def lottery_current(request: Request):
    await get_current_user(request)  # require auth
    draw = await _current_lottery_draw()
    # Don't send full ticket list to avoid huge payload
    ticket_count = len(draw.get("tickets", []))
    draw["ticket_count"] = ticket_count
    draw.pop("tickets", None)
    return {
        "draw": draw,
        "ticket_price_blz": LOTTERY_TICKET_PRICE_BLZ,
        "prize_pool": LOTTERY_PRIZE_POOL,
    }


class BuyTicketRequest(BaseModel):
    quantity: int = Field(ge=1, le=100)


@router.post("/lottery/buy-tickets")
async def lottery_buy(req: BuyTicketRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cost = LOTTERY_TICKET_PRICE_BLZ * req.quantity
    bal = float(user.get("balance_blz", 0) or 0)
    if bal < cost:
        raise HTTPException(400, f"Nicht genug BLZ (brauchst {cost})")

    draw = await _current_lottery_draw()
    if draw.get("status") != "open":
        raise HTTPException(400, "Keine offene Ziehung")

    ticket_numbers = []
    for _ in range(req.quantity):
        ticket_numbers.append({
            "user_id": uid,
            "number": secrets.token_hex(4).upper(),
            "bought_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": -cost}})
    await db.lottery_draws.update_one(
        {"draw_date": draw["draw_date"]},
        {"$push": {"tickets": {"$each": ticket_numbers}}},
    )
    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.insert_one({
        "user_id": uid, "type": "payment", "amount": cost, "currency": "BLZ",
        "status": "completed", "description": f"Lotterie: {req.quantity} Los(e)",
        "merchant_name": "BidBlitz", "category": "lottery",
        "reference": f"LOT-{now.replace('-','').replace(':','').replace('.','')[:18]}",
        "date": now, "created_at": now,
    })
    return {"ok": True, "tickets_bought": req.quantity, "tickets": [t["number"] for t in ticket_numbers], "cost": cost}


@router.get("/lottery/my-tickets")
async def my_tickets(request: Request, draw_date: Optional[str] = None):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    query = {"draw_date": draw_date} if draw_date else {}
    cursor = db.lottery_draws.find(query, {"_id": 0}).sort("draw_date", -1).limit(30)
    results = []
    async for draw in cursor:
        my_in_draw = [t for t in draw.get("tickets", []) if t.get("user_id") == uid]
        if my_in_draw:
            my_wins = []
            for w in (draw.get("winners") or []):
                if w.get("user_id") == uid:
                    my_wins.append(w)
            results.append({
                "draw_date": draw["draw_date"],
                "status": draw.get("status"),
                "my_tickets": len(my_in_draw),
                "winners": my_wins,
                "drawn_at": draw.get("drawn_at"),
            })
    return {"draws": results}


@router.post("/lottery/draw")
async def lottery_draw_now(request: Request):
    """Admin: Force-ziehung für heute (normalerweise via Cron)."""
    admin = await get_current_user(request)
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")

    draw = await _current_lottery_draw()
    if draw.get("status") != "open":
        raise HTTPException(400, "Ziehung bereits durchgeführt")

    tickets = draw.get("tickets", [])
    if not tickets:
        raise HTTPException(400, "Keine Tickets — keine Ziehung")

    # Shuffle and draw
    random.shuffle(tickets)
    winners = []
    i = 0
    for tier_name, tier_cfg in LOTTERY_PRIZE_POOL.items():
        for _ in range(tier_cfg["count_per_draw"]):
            if i >= len(tickets):
                break
            t = tickets[i]
            winners.append({
                "user_id": t["user_id"],
                "ticket_number": t["number"],
                "tier": tier_name,
                "prize_blz": tier_cfg["blz"],
            })
            # Credit winner
            await db.users.update_one({"_id": _oid(t["user_id"])}, {"$inc": {"balance_blz": tier_cfg["blz"]}})
            await db.transactions.insert_one({
                "user_id": t["user_id"], "type": "reward", "amount": tier_cfg["blz"], "currency": "BLZ",
                "status": "completed", "description": f"Lotterie-Gewinn ({tier_name}): {tier_cfg['blz']} BLZ",
                "merchant_name": "BidBlitz Lotterie", "category": "lottery_win",
                "reference": f"LOT-WIN-{draw['draw_date']}-{t['number']}",
                "date": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            i += 1

    await db.lottery_draws.update_one(
        {"draw_date": draw["draw_date"]},
        {"$set": {
            "status": "closed",
            "winners": winners,
            "drawn_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "winners_count": len(winners), "tickets_sold": len(tickets)}
