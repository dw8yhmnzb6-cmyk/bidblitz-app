"""
BidBlitz V2 - Penny Auction System
Users buy bid credits, each bid costs 1 credit, increases price by €0.01, extends timer.
"""

import secrets
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from core.database import db
from core.security import get_current_user
from core.audit import log_audit, AuditEvent, get_client_info

router = APIRouter(prefix="/api/auctions", tags=["auctions"])

PRICE_INCREMENT = 0.01
TIMER_EXTENSION_SECONDS = 20   # Bid resets live countdown to 20s max
FINAL_BATTLE_THRESHOLD = 60    # Final battle activates in last 60 seconds
DEFAULT_DURATION_SECONDS = 300  # Fallback 5 minutes

CREDIT_PACKAGES = {
    "10": {"credits": 10, "price": 5.00},      # 0.50/bid (base)
    "25": {"credits": 25, "price": 10.00},      # 0.40/bid (20% off)
    "50": {"credits": 50, "price": 17.50},      # 0.35/bid (30% off)
    "100": {"credits": 100, "price": 29.00},    # 0.29/bid (42% off)
    "250": {"credits": 250, "price": 62.50},    # 0.25/bid (50% off)
}


# ── List auctions ──
@router.get("")
async def list_auctions(request: Request):
    """List active and upcoming auctions."""
    now = datetime.now(timezone.utc).isoformat()

    # Auto-end expired auctions
    expired = await db.auctions.find(
        {"status": "active", "ends_at": {"$lt": now}}
    ).to_list(100)
    for auc in expired:
        # Find last bidder
        last_bid = await db.auction_bids.find_one(
            {"auction_id": auc["auction_id"]},
            sort=[("created_at", -1)],
        )
        winner_id = last_bid["user_id"] if last_bid else None
        winner_name = last_bid["user_name"] if last_bid else None
        await db.auctions.update_one(
            {"auction_id": auc["auction_id"]},
            {"$set": {
                "status": "ended",
                "winner_id": winner_id,
                "winner_name": winner_name,
                "ended_at": now,
            }},
        )
        # Notify winner
        if winner_id:
            await db.auction_notifications.insert_one({
                "user_id": winner_id,
                "type": "won",
                "auction_id": auc["auction_id"],
                "message": f"You won {auc['title']} for just €{auc.get('current_price', 0):.2f}!",
                "read": False,
                "created_at": now,
            })
            # Email win notification
            try:
                from routes.email_service import notify_win
                winner_user = await db.users.find_one({"_id": ObjectId(winner_id)})
                if winner_user and winner_user.get("email"):
                    asyncio.create_task(notify_win(
                        winner_user["email"], winner_user.get("name", "User"),
                        auc["title"], auc.get("current_price", 0),
                    ))
            except Exception:
                pass

    auctions = await db.auctions.find(
        {"status": {"$in": ["active", "upcoming", "ended"]}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    # Enrich with final_battle info
    now_dt = datetime.now(timezone.utc)
    for a in auctions:
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now_dt).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
        else:
            a["remaining_seconds"] = 0
            a["final_battle"] = False

    return {"auctions": auctions}


@router.get("/active")
async def get_active_auctions():
    """Get only active auctions."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0},
    ).sort("ends_at", 1).to_list(50)
    
    for a in auctions:
        if a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
    
    return {"auctions": auctions, "count": len(auctions)}


@router.get("/list")
async def list_all_auctions(status: str = None, limit: int = 50):
    """List auctions with optional status filter."""
    query = {}
    if status and status in ["active", "upcoming", "ended"]:
        query["status"] = status
    
    auctions = await db.auctions.find(
        query,
        {"_id": 0},
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    now = datetime.now(timezone.utc)
    for a in auctions:
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
    
    return {"auctions": auctions, "total": len(auctions)}


# ── Get user's credit balance ──
@router.get("/credits/balance")
async def get_credits(request: Request):
    """Get user's current bid credit balance."""
    user = await get_current_user(request)
    return {"bid_credits": user.get("bid_credits", 0)}


@router.get("/credits")
async def get_credits_alias(request: Request):
    """Alias for /credits/balance."""
    user = await get_current_user(request)
    return {"credits": user.get("bid_credits", 0), "bid_credits": user.get("bid_credits", 0)}


# ── Credit Packages ──
@router.get("/credits/packages")
async def get_credit_packages(request: Request):
    """Get available credit packages for purchase."""
    packages = []
    for pkg_id, data in CREDIT_PACKAGES.items():
        packages.append({
            "id": pkg_id,
            "credits": data["credits"],
            "price": data["price"],
            "price_per_credit": round(data["price"] / data["credits"], 2),
        })
    packages.sort(key=lambda x: x["credits"])
    return {"packages": packages}


# ── Buy Credits ──
@router.post("/credits/buy")
async def buy_credits(request: Request):
    """Buy bid credits using wallet balance."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    package_id = body.get("package_id")
    
    if package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    pkg = CREDIT_PACKAGES[package_id]
    price = pkg["price"]
    credits = pkg["credits"]
    
    # WALLET-ONLY: Check balance (BidBlitz closed ecosystem)
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Benötigt: €{price:.2f}, Verfügbar: €{balance:.2f}. Bitte lade dein Wallet auf."
        )
    
    # Deduct balance and add credits
    new_balance = round(balance - price, 2)
    new_credits = user.get("bid_credits", 0) + credits
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"balance": new_balance, "bid_credits": new_credits}}
    )
    
    # Log transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "purchase",
        "category": "auction",
        "amount": -price,
        "description": f"{credits} Bid Credits",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True,
        "credits_added": credits,
        "total_credits": new_credits,
        "new_balance": new_balance,
    }


# ── Daily Reward ──
DAILY_REWARD_CREDITS = 3

@router.post("/daily-reward")
async def claim_daily_reward(request: Request):
    """Claim daily free bid credits."""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    last_claim = user.get("last_daily_claim")
    if last_claim:
        last_dt = datetime.fromisoformat(last_claim)
        if (now - last_dt).total_seconds() < 86400:
            remaining_secs = int(86400 - (now - last_dt).total_seconds())
            raise HTTPException(status_code=400, detail=f"Already claimed. Next in {remaining_secs}s")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"bid_credits": DAILY_REWARD_CREDITS}, "$set": {"last_daily_claim": now.isoformat()}},
    )
    updated = await db.users.find_one({"_id": user["_id"]})
    return {"credits_awarded": DAILY_REWARD_CREDITS, "total_credits": updated.get("bid_credits", 0)}


@router.get("/daily-reward")
async def check_daily_reward(request: Request):
    """Check if daily reward is available."""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    last_claim = user.get("last_daily_claim")
    if not last_claim:
        return {"available": True, "remaining_seconds": 0}
    last_dt = datetime.fromisoformat(last_claim)
    elapsed = (now - last_dt).total_seconds()
    if elapsed >= 86400:
        return {"available": True, "remaining_seconds": 0}
    return {"available": False, "remaining_seconds": int(86400 - elapsed)}


# ── First purchase bonus check ──
@router.get("/first-purchase-check")
async def check_first_purchase(request: Request):
    """Check if user qualifies for first-purchase bonus."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    has_purchased = await db.transactions.find_one({"user_id": user_id, "category": "auction", "type": "purchase"})
    return {"is_first_purchase": not bool(has_purchased), "bonus_credits": 5}


# ── Referral Leaderboard ──
@router.get("/referral-leaderboard")
async def referral_leaderboard(request: Request):
    """Get top referrers."""
    pipeline = [
        {"$match": {"referred_by": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$referred_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    results = await db.users.aggregate(pipeline).to_list(10)
    leaders = []
    for r in results:
        referrer = await db.users.find_one({"_id": ObjectId(r["_id"])}, {"_id": 0, "name": 1})
        if referrer:
            name = referrer.get("name", "User")
            display = name[:2] + "***" if len(name) > 2 else name
            leaders.append({"name": display, "referrals": r["count"], "bonus": r["count"] * 5})
    return {"leaderboard": leaders}


# ── Get saved payment method (for auction checkout) ──
@router.get("/saved-method")
async def get_saved_method_auction(request: Request):
    """Return user's saved card details for auction checkout."""
    user = await get_current_user(request)
    pm_id = user.get("stripe_pm_id")
    if not pm_id:
        return {"has_saved_method": False}
    return {
        "has_saved_method": True,
        "card_brand": user.get("stripe_card_brand", ""),
        "card_last4": user.get("stripe_card_last4", ""),
        "card_exp_month": user.get("stripe_card_exp_month", 0),
        "card_exp_year": user.get("stripe_card_exp_year", 0),
    }


# ── User Watchlist ──
@router.get("/user/watchlist")
async def get_watchlist(request: Request):
    """Get user's watchlist auction IDs."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    items = await db.watchlist.find({"user_id": user_id}, {"_id": 0, "auction_id": 1}).to_list(100)
    return {"watchlist": [i["auction_id"] for i in items]}


# ── Bid Streak ──
@router.get("/user/streak")
async def get_streak(request: Request):
    """Get user's current bid streak info."""
    user = await get_current_user(request)
    streak = user.get("bid_streak", 0)
    last_bid_date = user.get("last_bid_date", "")
    if last_bid_date:
        try:
            last_dt = datetime.fromisoformat(last_bid_date)
            elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if elapsed > 86400:
                streak = 0
        except Exception:
            streak = 0
    return {"streak": streak, "last_bid_date": last_bid_date}


# ── Auction Notifications ──
@router.get("/user/notifications")
async def get_auction_notifications(request: Request):
    """Get user's auction-related notifications."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    notifs = await db.auction_notifications.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)
    return {"notifications": notifs}


@router.post("/user/notifications/read")
async def mark_auction_notifications_read(request: Request):
    """Mark all auction notifications as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.auction_notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}


# ── Referral Code (auction context) ──
@router.get("/user/referral")
async def get_auction_referral(request: Request):
    """Get user's referral code and stats for auction sharing."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ref_code = user.get("referral_code")
    if not ref_code:
        ref_code = secrets.token_hex(4).upper()
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": ref_code}})
    referral_count = await db.users.count_documents({"referred_by": user_id})
    return {"referral_code": ref_code, "referral_count": referral_count, "bonus_per_referral": 5}


@router.post("/user/apply-referral")
async def apply_auction_referral(request: Request):
    """Apply a referral code to get bonus credits."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    code = body.get("code", "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="Already used a referral code")
    referrer = await db.users.find_one({"referral_code": code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if str(referrer["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot use your own code")
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": 5}, "$set": {"referred_by": str(referrer["_id"])}})
    await db.users.update_one({"_id": referrer["_id"]}, {"$inc": {"bid_credits": 5}})
    await db.auction_notifications.insert_one({
        "user_id": str(referrer["_id"]),
        "type": "referral",
        "message": f"{user.get('name', 'Someone')} joined using your code! +5 credits",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    updated = await db.users.find_one({"_id": user["_id"]})
    return {"credits_awarded": 5, "total_credits": updated.get("bid_credits", 0)}


# ── Get single auction with bids ──
@router.get("/{auction_id}")
async def get_auction(auction_id: str, request: Request):
    """Get auction details with recent bid history."""
    now = datetime.now(timezone.utc).isoformat()

    auction = await db.auctions.find_one(
        {"auction_id": auction_id}, {"_id": 0}
    )
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Auto-end if expired
    if auction["status"] == "active" and auction["ends_at"] < now:
        last_bid = await db.auction_bids.find_one(
            {"auction_id": auction_id},
            sort=[("created_at", -1)],
        )
        winner_id = last_bid["user_id"] if last_bid else None
        winner_name = last_bid["user_name"] if last_bid else None
        await db.auctions.update_one(
            {"auction_id": auction_id},
            {"$set": {
                "status": "ended",
                "winner_id": winner_id,
                "winner_name": winner_name,
                "ended_at": now,
            }},
        )
        auction["status"] = "ended"
        auction["winner_id"] = winner_id
        auction["winner_name"] = winner_name

    # Get recent bids (last 30)
    bids = await db.auction_bids.find(
        {"auction_id": auction_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)

    # Count unique bidders
    unique_bidders = await db.auction_bids.distinct("user_id", {"auction_id": auction_id})

    return {"auction": auction, "bids": bids, "unique_bidders": len(unique_bidders)}


# ── Place a bid ──
class BidRequest(BaseModel):
    auction_id: str


@router.post("/bid")
async def place_bid(req: BidRequest, request: Request):
    """Place a bid on an auction. Costs 1 credit."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Check auction exists and is active
    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    if auction["ends_at"] < now_iso:
        raise HTTPException(status_code=400, detail="Auction has ended")

    # Check user has credits
    credits = user.get("bid_credits", 0)
    if credits < 1:
        raise HTTPException(status_code=400, detail="Not enough bid credits")

    # Deduct 1 credit + update bid streak
    today_str = now.strftime("%Y-%m-%d")
    last_bid_date = user.get("last_bid_date", "")
    streak_update = {}
    if last_bid_date:
        try:
            last_dt = datetime.fromisoformat(last_bid_date)
            last_day = last_dt.strftime("%Y-%m-%d")
            if last_day == today_str:
                pass  # Same day, no streak change
            elif (now - last_dt).total_seconds() <= 86400 * 1.5:
                streak_update = {"$inc": {"bid_streak": 1}}
            else:
                streak_update = {"$set": {"bid_streak": 1}}
        except Exception:
            streak_update = {"$set": {"bid_streak": 1}}
    else:
        streak_update = {"$set": {"bid_streak": 1}}

    update_ops = {"$inc": {"bid_credits": -1}, "$set": {"last_bid_date": now.isoformat()}}
    if "$inc" in streak_update:
        update_ops["$inc"]["bid_streak"] = streak_update["$inc"]["bid_streak"]
    elif "$set" in streak_update:
        update_ops["$set"]["bid_streak"] = streak_update["$set"]["bid_streak"]

    await db.users.update_one({"_id": user["_id"]}, update_ops)

    # Calculate new price
    new_price = round(auction["current_price"] + PRICE_INCREMENT, 2)

    # Extend timer — FINAL BATTLE logic
    current_ends = datetime.fromisoformat(auction["ends_at"])
    remaining = (current_ends - now).total_seconds()

    if remaining <= FINAL_BATTLE_THRESHOLD:
        # Final battle: always reset to 20 seconds from now
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    elif remaining < TIMER_EXTENSION_SECONDS:
        # Normal mode but close: extend to minimum
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    else:
        new_ends = current_ends
    new_ends_iso = new_ends.isoformat()

    # Update auction
    await db.auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {
            "current_price": new_price,
            "ends_at": new_ends_iso,
            "last_bidder_id": user_id,
            "last_bidder_name": user.get("name", "Anonymous"),
        },
        "$inc": {"total_bids": 1}},
    )

    # Record bid
    bid_record = {
        "bid_id": secrets.token_hex(6),
        "auction_id": req.auction_id,
        "user_id": user_id,
        "user_name": user.get("name", "Anonymous"),
        "bid_price": new_price,
        "created_at": now_iso,
    }
    await db.auction_bids.insert_one(bid_record)
    bid_record.pop("_id", None)

    # Notify previous bidder they were outbid
    if auction.get("last_bidder_id") and auction["last_bidder_id"] != user_id:
        await db.auction_notifications.insert_one({
            "user_id": auction["last_bidder_id"],
            "type": "outbid",
            "auction_id": req.auction_id,
            "message": f"You were outbid on {auction['title']}!",
            "read": False,
            "created_at": now_iso,
        })
        # Email outbid notification (fire-and-forget)
        try:
            from routes.email_service import notify_outbid
            prev_user = await db.users.find_one({"_id": ObjectId(auction["last_bidder_id"])})
            if prev_user and prev_user.get("email"):
                asyncio.create_task(notify_outbid(
                    prev_user["email"], prev_user.get("name", "User"),
                    auction["title"], req.auction_id, new_price,
                ))
        except Exception:
            pass

    updated_user = await db.users.find_one({"_id": user["_id"]})

    # Trigger auto-bids from other users
    try:
        await process_auto_bids(req.auction_id, user_id)
    except Exception:
        pass

    return {
        "bid": bid_record,
        "new_price": new_price,
        "ends_at": new_ends_iso,
        "total_bids": auction["total_bids"] + 1,
        "remaining_credits": updated_user.get("bid_credits", 0),
    }


# ── Process auto-bids after a manual bid ──
async def process_auto_bids(auction_id: str, last_bidder_id: str):
    """Check if any auto-bidders should respond to this bid."""
    auto_bids = await db.auto_bids.find(
        {"auction_id": auction_id, "active": True, "user_id": {"$ne": last_bidder_id}}
    ).to_list(50)

    for ab in auto_bids:
        if ab["bids_placed"] >= ab["max_bids"]:
            await db.auto_bids.update_one({"_id": ab["_id"]}, {"$set": {"active": False}})
            continue

        user = await db.users.find_one({"_id": ObjectId(ab["user_id"])})
        if not user or user.get("bid_credits", 0) < 1:
            await db.auto_bids.update_one({"_id": ab["_id"]}, {"$set": {"active": False}})
            continue

        auction = await db.auctions.find_one({"auction_id": auction_id})
        if not auction or auction["status"] != "active":
            break

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        if auction["ends_at"] < now_iso:
            break

        # Deduct credit
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": -1}})

        new_price = round(auction["current_price"] + PRICE_INCREMENT, 2)
        current_ends = datetime.fromisoformat(auction["ends_at"])
        remaining = (current_ends - now).total_seconds()
        if remaining <= FINAL_BATTLE_THRESHOLD:
            new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
        elif remaining < TIMER_EXTENSION_SECONDS:
            new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
        else:
            new_ends = current_ends

        await db.auctions.update_one(
            {"auction_id": auction_id},
            {"$set": {"current_price": new_price, "ends_at": new_ends.isoformat(),
                      "last_bidder_id": ab["user_id"], "last_bidder_name": user.get("name", "Anonymous")},
             "$inc": {"total_bids": 1}},
        )

        bid_record = {
            "bid_id": secrets.token_hex(6), "auction_id": auction_id,
            "user_id": ab["user_id"], "user_name": user.get("name", "Anonymous"),
            "bid_price": new_price, "created_at": now_iso, "is_auto": True,
        }
        await db.auction_bids.insert_one(bid_record)

        await db.auto_bids.update_one({"_id": ab["_id"]}, {"$inc": {"bids_placed": 1}})
        break  # Only one auto-bid per trigger


# ── Set Auto-Bid ──
class AutoBidRequest(BaseModel):
    auction_id: str
    max_bids: int = Field(..., ge=1, le=500)


@router.post("/auto-bid")
async def set_auto_bid(req: AutoBidRequest, request: Request):
    """Set auto-bid for an auction."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction or auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction not active")

    credits = user.get("bid_credits", 0)
    if credits < 1:
        raise HTTPException(status_code=400, detail="Not enough bid credits")

    # Upsert auto-bid
    await db.auto_bids.update_one(
        {"user_id": user_id, "auction_id": req.auction_id},
        {"$set": {"active": True, "max_bids": req.max_bids, "updated_at": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"bids_placed": 0, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "max_bids": req.max_bids}


@router.delete("/auto-bid/{auction_id}")
async def cancel_auto_bid(auction_id: str, request: Request):
    """Cancel auto-bid for an auction."""
    user = await get_current_user(request)
    await db.auto_bids.update_one(
        {"user_id": str(user["_id"]), "auction_id": auction_id},
        {"$set": {"active": False}},
    )
    return {"ok": True}


@router.get("/auto-bid/{auction_id}")
async def get_auto_bid(auction_id: str, request: Request):
    """Get auto-bid status for an auction."""
    user = await get_current_user(request)
    ab = await db.auto_bids.find_one(
        {"user_id": str(user["_id"]), "auction_id": auction_id},
        {"_id": 0},
    )
    if not ab or not ab.get("active"):
        return {"active": False}
    return {"active": True, "max_bids": ab.get("max_bids", 0), "bids_placed": ab.get("bids_placed", 0)}


# ── Buy bid credits ──
class BuyCreditsRequest(BaseModel):
    package_id: str


@router.post("/buy-credits")
async def buy_credits(req: BuyCreditsRequest, request: Request):
    """Buy bid credits using wallet balance - Uses Payment Engine for safety."""
    from core.payment_engine import debit_wallet, TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = pkg["price"]
    credits = pkg["credits"]

    # Check first purchase bonus
    has_prev = await db.transactions.find_one({"user_id": user_id, "category": "auction", "type": "purchase"})
    bonus = 5 if not has_prev else 0
    total_credits_add = credits + bonus

    # Use Payment Engine for atomic wallet deduction
    result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.AUCTION_BID,
        description=f"Auction Credits: {credits} credits" + (f" (+{bonus} bonus)" if bonus else ""),
        metadata={"package_id": req.package_id, "credits": credits, "bonus": bonus}
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    # Add credits after successful payment
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"bid_credits": total_credits_add}}
    )

    # Create transaction
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "purchase",
        "amount": -price,
        "description": f"Bid Credits ({credits}x)" + (f" + {bonus} Bonus" if bonus else ""),
        "status": "completed",
        "reference": f"BIDS-{secrets.token_hex(4).upper()}",
        "category": "auction",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    # Process influencer commission
    try:
        from routes.influencer import process_commission
        asyncio.create_task(process_commission(user_id, price, txn["reference"]))
    except Exception:
        pass

    return {
        "credits_added": credits,
        "bonus_credits": bonus,
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
        "is_first_purchase": bool(bonus),
    }


# ── Buy bid credits directly with saved Stripe card ──
class BuyCreditsDirectRequest(BaseModel):
    package_id: str


@router.post("/buy-credits-direct")
async def buy_credits_direct(req: BuyCreditsDirectRequest, request: Request):
    """Buy bid credits directly charging saved Stripe card (1-click)."""
    import stripe as stripe_mod
    from core.config import STRIPE_API_KEY
    stripe_mod.api_key = STRIPE_API_KEY

    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = pkg["price"]
    credits = pkg["credits"]

    cust_id = user.get("stripe_customer_id")
    pm_id = user.get("stripe_pm_id")
    if not cust_id or not pm_id:
        raise HTTPException(status_code=400, detail="No saved payment method")

    # Charge saved card off-session
    try:
        intent = stripe_mod.PaymentIntent.create(
            amount=int(price * 100),
            currency="eur",
            customer=cust_id,
            payment_method=pm_id,
            off_session=True,
            confirm=True,
            metadata={
                "user_id": user_id,
                "type": "bid_credits_direct",
                "package_id": req.package_id,
                "credits": str(credits),
            },
        )
    except stripe_mod.error.CardError:
        # Card declined — remove saved method
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$unset": {
                "stripe_pm_id": "", "stripe_card_brand": "", "stripe_card_last4": "",
                "stripe_card_exp_month": "", "stripe_card_exp_year": "", "stripe_pm_saved_at": "",
            }},
        )
        raise HTTPException(status_code=402, detail="Card declined. Please use another payment method.")
    except Exception:
        raise HTTPException(status_code=500, detail="Payment failed")

    if intent.status != "succeeded":
        raise HTTPException(status_code=402, detail=f"Payment not completed: {intent.status}")

    # Add credits
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"bid_credits": credits}},
    )

    # Create transaction
    ref = f"BIDS-D-{secrets.token_hex(4).upper()}"
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "purchase",
        "amount": -price,
        "description": f"Bid Credits ({credits}x) — Card",
        "status": "completed",
        "reference": ref,
        "payment_method": "saved_card",
        "category": "auction",
        "stripe_pi_id": intent.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "credits_added": credits,
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
        "method": "card",
        "reference": ref,
    }


# ── Buy bid credits via Stripe Checkout (new card) ──
class BuyCreditsStripeRequest(BaseModel):
    package_id: str


@router.post("/buy-credits-stripe")
async def buy_credits_stripe(req: BuyCreditsStripeRequest, request: Request):
    """Create Stripe Checkout Session for buying bid credits with a new card."""
    import stripe as stripe_mod
    from core.config import STRIPE_API_KEY
    stripe_mod.api_key = STRIPE_API_KEY

    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = pkg["price"]
    credits_amount = pkg["credits"]

    # Get or create Stripe customer
    cust_id = user.get("stripe_customer_id")
    if not cust_id:
        customer = stripe_mod.Customer.create(
            email=user.get("email", ""),
            name=user.get("name", ""),
            metadata={"user_id": user_id},
        )
        cust_id = customer.id
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"stripe_customer_id": cust_id}})

    # Store pending purchase info
    pending_id = secrets.token_hex(8)
    await db.pending_credit_purchases.insert_one({
        "pending_id": pending_id,
        "user_id": user_id,
        "package_id": req.package_id,
        "credits": credits_amount,
        "price": price,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Create Checkout Session
    origin = str(request.base_url).rstrip("/")
    # Use the frontend URL from referrer or a sensible default
    frontend_url = request.headers.get("origin", origin)

    session = stripe_mod.checkout.Session.create(
        customer=cust_id,
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {
                    "name": f"{credits_amount}x Gebot-Credits",
                    "description": f"BidBlitz Auktions-Credits",
                },
                "unit_amount": int(price * 100),
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{frontend_url}?credit_purchase={pending_id}&status=success",
        cancel_url=f"{frontend_url}?credit_purchase={pending_id}&status=cancel",
        metadata={
            "type": "bid_credits",
            "user_id": user_id,
            "pending_id": pending_id,
            "package_id": req.package_id,
            "credits": str(credits_amount),
        },
    )

    return {"checkout_url": session.url, "session_id": session.id, "pending_id": pending_id}


@router.post("/buy-credits-confirm/{pending_id}")
async def confirm_credit_purchase(pending_id: str, request: Request):
    """Confirm a pending Stripe credit purchase after successful checkout."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    pending = await db.pending_credit_purchases.find_one({"pending_id": pending_id, "user_id": user_id})
    if not pending:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if pending["status"] == "completed":
        # Already processed
        updated_user = await db.users.find_one({"_id": user["_id"]})
        return {"credits_added": pending["credits"], "total_credits": updated_user.get("bid_credits", 0)}

    credits_amount = pending["credits"]
    price = pending["price"]

    # Mark as completed
    await db.pending_credit_purchases.update_one(
        {"pending_id": pending_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Add credits
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": credits_amount}})

    # Create transaction
    ref = f"BIDS-S-{secrets.token_hex(4).upper()}"
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "purchase",
        "amount": -price,
        "description": f"Bid Credits ({credits_amount}x) — Stripe",
        "status": "completed",
        "reference": ref,
        "payment_method": "stripe_checkout",
        "category": "auction",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(txn)

    updated_user = await db.users.find_one({"_id": user["_id"]})
    return {
        "credits_added": credits_amount,
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
    }


# ── Admin: Create auction ──
class CreateAuctionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    retail_price: float = Field(..., gt=0)
    duration_seconds: int = Field(default=300, ge=60, le=3600)
    start_now: bool = True


@router.post("/admin/create")
async def create_auction(req: CreateAuctionRequest, request: Request):
    """Admin creates a new auction."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    auction_id = secrets.token_hex(8)
    ends_at = (now + timedelta(seconds=req.duration_seconds)).isoformat()

    auction = {
        "auction_id": auction_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip(),
        "image_url": req.image_url or "",
        "retail_price": req.retail_price,
        "starting_price": 0.00,
        "current_price": 0.00,
        "price_increment": PRICE_INCREMENT,
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": req.duration_seconds,
        "ends_at": ends_at if req.start_now else "",
        "status": "active" if req.start_now else "upcoming",
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": str(user["_id"]),
        "created_at": now.isoformat(),
    }
    await db.auctions.insert_one(auction)
    auction.pop("_id", None)

    return {"auction": auction}


# ══════════════════════════════════════════════════════
# Product Catalog — Easy to update by admin
# Keep this list current with trending, high-demand items
# Last updated: April 2026
# ══════════════════════════════════════════════════════

# Product images mapped by title
PRODUCT_IMAGES = {
    "Samsung Galaxy S26 Ultra": "https://images.unsplash.com/photo-1773414422164-eefdc240da58?w=600&h=400&fit=crop&q=80",
    "iPhone 17 Pro Max": "https://images.unsplash.com/photo-1769594362058-d561f024a235?w=600&h=400&fit=crop&q=80",
    "Google Pixel 10 Pro": "https://images.unsplash.com/photo-1639885339994-59a8ffd15bdb?w=600&h=400&fit=crop&q=80",
    "Nintendo Switch 2": "https://images.unsplash.com/photo-1761395013766-8416415b0207?w=600&h=400&fit=crop&q=80",
    "PlayStation 5 Pro": "https://images.unsplash.com/photo-1693929291343-f38cb7519d5d?w=600&h=400&fit=crop&q=80",
    "AirPods Pro 3": "https://images.unsplash.com/photo-1677346414290-d337cbc682a6?w=600&h=400&fit=crop&q=80",
    "Sony WH-1000XM6": "https://images.unsplash.com/photo-1748792321323-25d97044ba2c?w=600&h=400&fit=crop&q=80",
    "Apple Watch Ultra 3": "https://images.unsplash.com/photo-1585823339274-26b392cefe45?w=600&h=400&fit=crop&q=80",
    "Samsung Galaxy Ring 2": "https://images.unsplash.com/photo-1760088348194-a5ac70a8aa9f?w=600&h=400&fit=crop&q=80",
    "MacBook Pro 16\" M5 Pro": "https://images.unsplash.com/photo-1627766556564-5d89b3765c46?w=600&h=400&fit=crop&q=80",
    "iPad Pro 13\" M5": "https://images.unsplash.com/photo-1622849030045-1f2c32ae3099?w=600&h=400&fit=crop&q=80",
    "Meta Quest 4": "https://images.unsplash.com/photo-1758523670318-f1b79559e1d1?w=600&h=400&fit=crop&q=80",
    "Dyson Airstrait Pro": "https://images.unsplash.com/photo-1629397683830-9805395892e8?w=600&h=400&fit=crop&q=80",
    "LG OLED G5 77\"": "https://images.unsplash.com/photo-1684777219236-a387cbefb883?w=600&h=400&fit=crop&q=80",
    "Samsung Neo QLED 8K 75\"": "https://images.unsplash.com/photo-1623902118614-01c68f0508c8?w=600&h=400&fit=crop&q=80",
    "Roborock S9 MaxV Ultra": "https://images.unsplash.com/photo-1762859731349-c9ff2808b672?w=600&h=400&fit=crop&q=80",
    "Apple HomePod 3": "https://images.unsplash.com/photo-1617722694908-9be1092d1bc2?w=600&h=400&fit=crop&q=80",
    # NEW 20 PRODUCTS - April 2026
    "Rolex Submariner Gold": "https://images.unsplash.com/photo-1760532467609-45ed8016f795?w=600&h=400&fit=crop&q=80",
    "Omega Seamaster 300": "https://images.unsplash.com/photo-1704783549722-8dcd98e9cf5d?w=600&h=400&fit=crop&q=80",
    "Razer Huntsman V3 Pro": "https://images.unsplash.com/photo-1645802106095-765b7e86f5bb?w=600&h=400&fit=crop&q=80",
    "Corsair K100 RGB": "https://images.unsplash.com/photo-1628089700970-0012c5718efc?w=600&h=400&fit=crop&q=80",
    "DJI Mavic 4 Pro": "https://images.unsplash.com/photo-1668836733970-9ed7e53cd2ca?w=600&h=400&fit=crop&q=80",
    "DJI Mini 4 Pro": "https://images.unsplash.com/photo-1773750923584-5c684563e0d9?w=600&h=400&fit=crop&q=80",
    "Segway Ninebot Max G3": "https://images.unsplash.com/photo-1737636255601-179dc7535116?w=600&h=400&fit=crop&q=80",
    "Xiaomi Electric Scooter 5": "https://images.unsplash.com/photo-1583322319396-08178ea4f8b3?w=600&h=400&fit=crop&q=80",
    "De'Longhi La Specialista": "https://images.unsplash.com/photo-1741113937337-1d0273bf941d?w=600&h=400&fit=crop&q=80",
    "Breville Barista Touch": "https://images.unsplash.com/photo-1635749269192-489bdda05932?w=600&h=400&fit=crop&q=80",
    "Sony A7 IV": "https://images.unsplash.com/photo-1637270871981-4b579f127c0c?w=600&h=400&fit=crop&q=80",
    "Sony A7R V": "https://images.unsplash.com/photo-1576420379131-bfc2344aab31?w=600&h=400&fit=crop&q=80",
    "VanMoof S5": "https://images.unsplash.com/photo-1753092604434-8c0e6c3b50f0?w=600&h=400&fit=crop&q=80",
    "Cowboy 5": "https://images.unsplash.com/photo-1666360058702-a3aa07227c53?w=600&h=400&fit=crop&q=80",
    "Secretlab Titan Evo 2024": "https://images.unsplash.com/photo-1770195555068-37103df33bf8?w=600&h=400&fit=crop&q=80",
    "Herman Miller Embody Gaming": "https://images.unsplash.com/photo-1577239458058-b179bc7479bf?w=600&h=400&fit=crop&q=80",
    "Google Nest Audio": "https://images.unsplash.com/photo-1655976796910-b239b1a1a41c?w=600&h=400&fit=crop&q=80",
    "Sonos Era 300": "https://images.unsplash.com/photo-1655976797987-0fdbab9e7419?w=600&h=400&fit=crop&q=80",
    "Evolve GTR 2": "https://images.unsplash.com/photo-1611172016558-17e0da981759?w=600&h=400&fit=crop&q=80",
    "Boosted Board Mini X": "https://images.unsplash.com/photo-1659337162301-37d9e1289eac?w=600&h=400&fit=crop&q=80",
    "Samsung Odyssey G9 49\"": "https://images.unsplash.com/photo-1632064824547-e77c36851495?w=600&h=400&fit=crop&q=80",
    "LG UltraGear 45GR95QE": "https://images.unsplash.com/photo-1582736317407-371893d9e146?w=600&h=400&fit=crop&q=80",
    "XGIMI Horizon Ultra": "https://images.unsplash.com/photo-1620764701841-b584378ee8fd?w=600&h=400&fit=crop&q=80",
    "Samsung Freestyle 2": "https://images.unsplash.com/photo-1750994700257-133c7fdb0c7a?w=600&h=400&fit=crop&q=80",
    "Theragun Pro Plus": "https://images.unsplash.com/photo-1746278925416-9d6c71f55c2d?w=600&h=400&fit=crop&q=80",
    "Hyperice Hypervolt 2 Pro": "https://images.unsplash.com/photo-1611908200005-b898ddde09cf?w=600&h=400&fit=crop&q=80",
    # 50th Product - Tesla Model Pi Phone 2026
    "Tesla Model Pi Phone 2026": "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=600&h=400&fit=crop&q=80",
}

PRODUCT_CATALOG = [
    # Smartphones
    {"title": "Samsung Galaxy S26 Ultra", "description": "Samsung Galaxy S26 Ultra 512GB Titanium — AMOLED 6.9\", Snapdragon 8 Elite 2, 200MP Camera", "retail_price": 1499.00, "duration": 172800, "category": "phones",
     "features": ["6.9\" Dynamic AMOLED 2X, 3120x1440", "Snapdragon 8 Elite 2 Processor", "200MP Main + 50MP Ultra-Wide + 10MP Telephoto", "5000mAh Battery, 65W Fast Charge", "512GB Storage, 16GB RAM", "S Pen Built-in, IP68 Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "iPhone 17 Pro Max", "description": "Apple iPhone 17 Pro Max 256GB — A19 Pro Chip, 48MP Triple Camera, Titanium Design", "retail_price": 1449.00, "duration": 216000, "category": "phones",
     "features": ["6.9\" Super Retina XDR, ProMotion 120Hz", "A19 Pro Chip, 6-Core GPU", "48MP Fusion + 48MP Ultra-Wide + 12MP Telephoto 5x", "Titanium Frame, Ceramic Shield Front", "USB-C, Wi-Fi 7, 5G", "Action Button, Camera Control"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Google Pixel 10 Pro", "description": "Google Pixel 10 Pro 256GB — Tensor G5, AI-First Camera, 7 Years Updates", "retail_price": 1099.00, "duration": 194400, "category": "phones",
     "features": ["6.7\" LTPO OLED, 1-120Hz, 2400 nits", "Google Tensor G5 Processor", "50MP Main + 48MP Ultra-Wide + 48MP Telephoto 5x", "AI Magic Eraser, Best Take, Night Sight", "7 Years OS & Security Updates", "5000mAh Battery, 45W Charging"],
     "condition": "Brand New — Factory Sealed"},
    # Gaming
    {"title": "Nintendo Switch 2", "description": "Nintendo Switch 2 Console — 8\" LCD, Magnetic Joy-Cons, Backwards Compatible", "retail_price": 449.00, "duration": 172800, "category": "gaming",
     "features": ["8\" 1080p LCD Display", "NVIDIA Custom Processor", "Magnetic Joy-Con 2 Controllers", "Backwards Compatible with Switch Games", "64GB Internal Storage, microSD Slot", "USB-C Dock for 4K TV Output"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "PlayStation 5 Pro", "description": "Sony PS5 Pro 2TB — Enhanced GPU, 8K Output, DualSense Edge Controller", "retail_price": 799.00, "duration": 216000, "category": "gaming",
     "features": ["Enhanced GPU with Ray Tracing", "2TB SSD Ultra-Fast Storage", "8K Video Output Support", "DualSense Edge Wireless Controller", "Tempest 3D Audio Engine", "4K Gaming at 120fps"],
     "condition": "Brand New — Factory Sealed"},
    # Audio
    {"title": "AirPods Pro 3", "description": "Apple AirPods Pro 3 — H3 Chip, Adaptive Audio, USB-C MagSafe Case", "retail_price": 299.00, "duration": 172800, "category": "audio",
     "features": ["Apple H3 Chip for Intelligent Audio", "Adaptive Noise Cancellation", "Personalized Spatial Audio with Head Tracking", "USB-C MagSafe Charging Case", "Up to 6h Listening, 30h with Case", "IP54 Dust & Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Sony WH-1000XM6", "description": "Sony WH-1000XM6 Wireless — Best-in-class ANC, 40h Battery, LDAC Hi-Res", "retail_price": 399.00, "duration": 194400, "category": "audio",
     "features": ["Industry-Leading Noise Cancellation", "40h Battery Life, 3min Quick Charge = 3h", "LDAC Hi-Res Audio, DSEE Extreme", "Multipoint Connection (2 Devices)", "Speak-to-Chat & Adaptive Sound Control", "Ultra Lightweight 250g, Premium Comfort"],
     "condition": "Brand New — Factory Sealed"},
    # Wearables
    {"title": "Apple Watch Ultra 3", "description": "Apple Watch Ultra 3 — Titanium, Satellite SOS, 72h Battery, S10 Chip", "retail_price": 899.00, "duration": 420, "category": "wearables",
     "features": ["49mm Titanium Case, Sapphire Crystal", "Apple S10 Chip, Double Tap Gesture", "72h Battery, 36h Normal Use", "Satellite Emergency SOS", "100m Water Resistant, EN13319 Dive", "Precision Dual-Frequency GPS"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Samsung Galaxy Ring 2", "description": "Samsung Galaxy Ring 2 — Health Tracking, Sleep Analysis, Titanium, 7-Day Battery", "retail_price": 449.00, "duration": 172800, "category": "wearables",
     "features": ["Titanium Build, 2.6g Ultra-Light", "Heart Rate & SpO2 Monitoring 24/7", "Advanced Sleep & Stress Tracking", "Cycle Tracking & Skin Temperature", "7-Day Battery, Wireless Charging Case", "IP68 + 10ATM Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    # Laptops & Tablets
    {"title": "MacBook Pro 16\" M5 Pro", "description": "Apple MacBook Pro 16\" M5 Pro — 18GB RAM, 512GB SSD, Liquid Retina XDR", "retail_price": 2899.00, "duration": 259200, "category": "laptops",
     "features": ["16.2\" Liquid Retina XDR, 3456x2234", "Apple M5 Pro, 12-Core CPU, 18-Core GPU", "18GB Unified Memory, 512GB SSD", "Up to 22h Battery Life", "Thunderbolt 5, HDMI 2.1, SD Card Slot", "6-Speaker Sound System, Spatial Audio"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "iPad Pro 13\" M5", "description": "Apple iPad Pro 13\" M5 — Tandem OLED, Apple Pencil 3, Thunderbolt 5", "retail_price": 1399.00, "duration": 216000, "category": "tablets",
     "features": ["13\" Tandem OLED, 2752x2064, ProMotion", "Apple M5 Chip, Hardware Ray Tracing", "Apple Pencil 3 & Magic Keyboard Support", "Thunderbolt 5 / USB 4", "12MP Ultra-Wide Front, LiDAR Scanner", "Face ID, Wi-Fi 7, 5G Optional"],
     "condition": "Brand New — Factory Sealed"},
    # XR / Smart Home
    {"title": "Meta Quest 4", "description": "Meta Quest 4 — Mixed Reality, Snapdragon XR3, 4K per Eye, 256GB", "retail_price": 549.00, "duration": 194400, "category": "xr",
     "features": ["Snapdragon XR3 Gen 1 Processor", "4K per Eye, Pancake Lens 2.0", "Full-Color Mixed Reality Passthrough", "256GB Storage, Wi-Fi 7", "Hand Tracking 3.0, Eye Tracking", "Meta Horizon OS, 1000+ Apps & Games"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Dyson Airstrait Pro", "description": "Dyson Airstrait Pro — Wet-to-Dry Straightener, Intelligent Heat Control", "retail_price": 549.00, "duration": 172800, "category": "home",
     "features": ["Wet-to-Dry Straightening Technology", "Intelligent Heat Control Every 100x/sec", "Flexing Plates for Root-to-Tip Styling", "3 Heat Settings + Cool Mode", "Dual Airflow Jets for Fast Drying", "360° Swivel Cable, Heat-Resistant Case"],
     "condition": "Brand New — Factory Sealed"},
    # TVs
    {"title": "LG OLED G5 77\"", "description": "LG OLED evo G5 77\" 4K — MLA+ Panel, a11 AI Processor, Dolby Vision & Atmos", "retail_price": 3299.00, "duration": 259200, "category": "tvs",
     "features": ["77\" 4K OLED evo MLA+ Panel, 4000 nits", "a11 AI Processor 4K, AI Upscaling", "Dolby Vision IQ, Dolby Atmos, DTS:X", "4x HDMI 2.1, 144Hz VRR Gaming", "Gallery Design, Flush Wall Mount", "webOS 26, Apple AirPlay 2"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Samsung Neo QLED 8K 75\"", "description": "Samsung QN900F 75\" 8K — Neural Quantum Processor, Infinity Screen, 8K AI Upscaling", "retail_price": 4999.00, "duration": 259200, "category": "tvs",
     "features": ["75\" 8K Neo QLED, Mini LED Backlight", "Neural Quantum Processor 8K", "Anti-Reflection Infinity Screen", "8K AI Upscaling, Real Depth Enhancer", "Dolby Atmos, Object Tracking Sound Pro", "4x HDMI 2.1, SmartThings Hub Built-in"],
     "condition": "Brand New — Factory Sealed"},
    # Robot Vacuums
    {"title": "Roborock S9 MaxV Ultra", "description": "Roborock S9 MaxV Ultra — 10,000Pa Suction, AI Object Avoidance, Self-Wash Mop", "retail_price": 1599.00, "duration": 216000, "category": "robots",
     "features": ["10,000Pa HyperForce Suction", "AI 3D Object Avoidance, ReactiveAI 3.0", "Self-Washing & Self-Drying Mop", "Auto-Empty Dock, 7-Week Dustbin", "Multi-Floor Mapping, No-Go Zones", "Matter & Google/Alexa Compatible"],
     "condition": "Brand New — Factory Sealed"},
    # Smart Home
    {"title": "Apple HomePod 3", "description": "Apple HomePod 3 — Spatial Audio, Siri Intelligence, Matter Hub, Room Sensing", "retail_price": 349.00, "duration": 172800, "category": "smarthome",
     "features": ["High-Excursion Woofer, 5 Tweeters", "Spatial Audio with Room Sensing", "Siri with On-Device Intelligence", "Thread & Matter Smart Home Hub", "Ultra Wideband, Intercom, Find My", "Temperature & Humidity Sensor"],
     "condition": "Brand New — Factory Sealed"},
    
    # ═══════════════════════════════════════════════════════════════════
    # NEW 20 PRODUCTS - April 2026
    # ═══════════════════════════════════════════════════════════════════
    
    # Luxury Watches
    {"title": "Rolex Submariner Gold", "description": "Rolex Submariner Date 41mm — 18K Yellow Gold, Black Dial, Oysterflex Bracelet", "retail_price": 38900.00, "duration": 604800, "category": "watches",
     "features": ["41mm 18K Yellow Gold Case", "Cerachrom Ceramic Bezel Insert", "Calibre 3235 Movement, 70h Reserve", "Waterproof to 300m / 1000ft", "Chromalight Display, Blue Glow", "Oysterflex Rubber Bracelet"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Omega Seamaster 300", "description": "Omega Seamaster 300M — Co-Axial Master Chronometer, Ceramic Bezel, 42mm", "retail_price": 5700.00, "duration": 432000, "category": "watches",
     "features": ["42mm Stainless Steel Case", "Co-Axial Master Chronometer Movement", "Ceramic Bezel with Diving Scale", "300m Water Resistance", "Wave-Pattern Blue Dial", "5-Year Warranty"],
     "condition": "Brand New — Factory Sealed"},
    
    # Gaming Keyboards
    {"title": "Razer Huntsman V3 Pro", "description": "Razer Huntsman V3 Pro — Analog Optical Switches, Magnetic Wrist Rest, RGB Chroma", "retail_price": 299.00, "duration": 172800, "category": "gaming",
     "features": ["Analog Optical Switches", "Adjustable Actuation 0.1-4.0mm", "Magnetic Leatherette Wrist Rest", "Razer Chroma RGB per Key", "Multi-Function Dial & Media Keys", "Onboard Memory, 8000Hz Polling"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Corsair K100 RGB", "description": "Corsair K100 RGB — OPX Optical Switches, iCUE Control Wheel, Aircraft Aluminum", "retail_price": 249.00, "duration": 172800, "category": "gaming",
     "features": ["Corsair OPX Optical Switches", "4000Hz Hyper-Polling", "iCUE Control Wheel", "Aircraft-Grade Aluminum Frame", "Per-Key RGB Backlighting", "Detachable Palm Rest"],
     "condition": "Brand New — Factory Sealed"},
    
    # Drones
    {"title": "DJI Mavic 4 Pro", "description": "DJI Mavic 4 Pro — Hasselblad Camera, 8K Video, Omnidirectional Sensing, 48min Flight", "retail_price": 2199.00, "duration": 259200, "category": "drones",
     "features": ["Hasselblad 4/3 CMOS Sensor", "8K/24fps & 4K/120fps Video", "Omnidirectional Obstacle Sensing", "48-Minute Max Flight Time", "O4 Transmission 20km Range", "ActiveTrack 6.0, MasterShots"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "DJI Mini 4 Pro", "description": "DJI Mini 4 Pro — Under 250g, 4K HDR, Tri-Directional Sensing, Fly More Combo", "retail_price": 1099.00, "duration": 216000, "category": "drones",
     "features": ["Under 249g, No Registration Needed", "1/1.3\" CMOS, 48MP Photos", "4K/60fps HDR Video", "Tri-Directional Obstacle Sensing", "34-Minute Flight Time", "10km O4 Video Transmission"],
     "condition": "Brand New — Factory Sealed"},
    
    # Electric Scooters
    {"title": "Segway Ninebot Max G3", "description": "Segway Ninebot KickScooter Max G3 — 40km Range, 30km/h Speed, 10\" Pneumatic Tires", "retail_price": 999.00, "duration": 216000, "category": "mobility",
     "features": ["40km / 25mi Max Range", "30km/h / 18.6mph Top Speed", "10\" Pneumatic Tires", "Front & Rear Suspension", "Built-in Phone Charger", "IPX5 Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Xiaomi Electric Scooter 5", "description": "Xiaomi Electric Scooter 5 Pro — 600W Motor, 45km Range, 10\" Tubeless Tires", "retail_price": 799.00, "duration": 194400, "category": "mobility",
     "features": ["600W Dual Motor Peak", "45km / 28mi Max Range", "10\" Tubeless Self-Sealing Tires", "Front & Rear Disc Brakes", "LED Dashboard Display", "Apple Find My Compatible"],
     "condition": "Brand New — Factory Sealed"},
    
    # Coffee Machines
    {"title": "De'Longhi La Specialista", "description": "De'Longhi La Specialista Arte Evo — Integrated Grinder, Smart Tamping, Steam Wand", "retail_price": 849.00, "duration": 194400, "category": "home",
     "features": ["Sensor Grinding Technology", "Smart Tamping Station", "Active Temperature Control", "Professional Steam Wand", "3 Preset Recipes + Custom", "LatteCrema Hot System"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Breville Barista Touch", "description": "Breville Barista Touch Impress — Assisted Tamping, Touch Display, Grind Size Dial", "retail_price": 1499.00, "duration": 216000, "category": "home",
     "features": ["Impress Puck System, Auto Tamping", "Intuitive Touch Screen Display", "ThermoJet Heating System", "Integrated Conical Burr Grinder", "Programmable Shot Volumes", "Auto Steam Wand"],
     "condition": "Brand New — Factory Sealed"},
    
    # Cameras
    {"title": "Sony A7 IV", "description": "Sony Alpha 7 IV — 33MP Full-Frame, 4K 60p, Real-Time Eye AF, 10fps Burst", "retail_price": 2499.00, "duration": 259200, "category": "cameras",
     "features": ["33MP Exmor R Full-Frame Sensor", "BIONZ XR Processor", "4K 60p 10-Bit Video", "Real-Time Eye AF for Humans/Animals", "5-Axis In-Body Stabilization", "759-Point Phase Detection AF"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Sony A7R V", "description": "Sony Alpha 7R V — 61MP Full-Frame, AI AF Processor, 8K Oversampled 4K", "retail_price": 3899.00, "duration": 302400, "category": "cameras",
     "features": ["61MP Full-Frame Exmor R Sensor", "AI Processing Unit for AF", "8-Stop In-Body Stabilization", "8K Oversampled 4K Video", "4K 60p, S-Log3, S-Cinetone", "Dual Card Slots, USB-C"],
     "condition": "Brand New — Factory Sealed"},
    
    # E-Bikes
    {"title": "VanMoof S5", "description": "VanMoof S5 — Integrated Anti-Theft, Turbo Boost, 150km Range, App Connected", "retail_price": 2998.00, "duration": 302400, "category": "mobility",
     "features": ["Front & Rear Hub Motors", "Turbo Boost Button", "150km / 93mi Range", "Integrated Smart Lock", "Kick Lock Anti-Theft", "Find My Bike Tracking"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Cowboy 5", "description": "Cowboy 5 — Carbon Belt Drive, Removable Battery, 70km Range, Crash Detection", "retail_price": 2990.00, "duration": 302400, "category": "mobility",
     "features": ["Carbon Belt Drive, No Chain", "Removable 360Wh Battery", "70km / 43mi Range", "Integrated Lights", "Crash Detection & SOS", "GPS Anti-Theft"],
     "condition": "Brand New — Factory Sealed"},
    
    # Gaming Chairs
    {"title": "Secretlab Titan Evo 2024", "description": "Secretlab Titan Evo 2024 — 4-Way L-Adapt Lumbar, Magnetic Armrests, Hybrid Leatherette", "retail_price": 584.00, "duration": 194400, "category": "gaming",
     "features": ["4-Way L-Adapt Lumbar Support", "Magnetic CloudSwap Armrests", "Neo Hybrid Leatherette", "Multi-Tilt Mechanism", "XL Pebble Seat Base", "5-Year Extended Warranty"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Herman Miller Embody Gaming", "description": "Herman Miller x Logitech G Embody Gaming Chair — 12-Year Warranty, Sync Fabric", "retail_price": 1795.00, "duration": 259200, "category": "gaming",
     "features": ["Logitech G x HM Collaboration", "Pixelated Support Technology", "Copper-Infused Cooling Foam", "Sync Fabric Gaming Material", "PostureFit Spinal Support", "12-Year Warranty"],
     "condition": "Brand New — Factory Sealed"},
    
    # Smart Speakers
    {"title": "Google Nest Audio", "description": "Google Nest Audio — 75mm Woofer, Google Assistant, Multi-Room Audio", "retail_price": 99.00, "duration": 172800, "category": "smarthome",
     "features": ["75mm Woofer, 19mm Tweeter", "Google Assistant Built-In", "Multi-Room Audio Support", "Voice Match for Personalization", "Ambient IQ Auto-Adjust", "Chromecast Built-In"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Sonos Era 300", "description": "Sonos Era 300 — Dolby Atmos, Spatial Audio, WiFi 6, USB-C Line-In", "retail_price": 499.00, "duration": 194400, "category": "smarthome",
     "features": ["Dolby Atmos Music Support", "6 Drivers for Spatial Sound", "Trueplay Tuning Technology", "WiFi 6, Bluetooth, USB-C", "Amazon Alexa Built-In", "AirPlay 2 Compatible"],
     "condition": "Brand New — Factory Sealed"},
    
    # Electric Skateboards
    {"title": "Evolve GTR 2", "description": "Evolve GTR 2 Bamboo — All-Terrain, Dual 3000W Motors, 50km Range, 50km/h", "retail_price": 2399.00, "duration": 259200, "category": "mobility",
     "features": ["Dual 3000W Hub Motors", "50km / 31mi Range", "50km/h / 31mph Top Speed", "Bamboo Deck with Fiberglass", "175mm All-Terrain Wheels", "LED Lights, Regenerative Braking"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Boosted Board Mini X", "description": "Boosted Mini X — Compact Design, 23km Range, 30km/h Speed, Deep Concave Deck", "retail_price": 999.00, "duration": 194400, "category": "mobility",
     "features": ["Compact 29.5\" Deck", "1000W Dual Motors", "23km / 14mi Range", "30km/h / 18.5mph Speed", "Regenerative Braking", "Hyper Mode Available"],
     "condition": "Brand New — Factory Sealed"},
    
    # Gaming Monitors
    {"title": "Samsung Odyssey G9 49\"", "description": "Samsung Odyssey OLED G9 49\" — QD-OLED, 240Hz, 0.03ms, 1000R Curve, HDR10+", "retail_price": 1799.00, "duration": 259200, "category": "monitors",
     "features": ["49\" QD-OLED Curved Display", "5120x1440, 32:9 Aspect Ratio", "240Hz Refresh Rate", "0.03ms Response Time", "1000R Curvature", "HDR10+ Gaming, 99% DCI-P3"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "LG UltraGear 45GR95QE", "description": "LG UltraGear 45\" OLED — 240Hz, 0.03ms, WQHD, G-Sync & FreeSync Premium", "retail_price": 1699.00, "duration": 259200, "category": "monitors",
     "features": ["45\" Curved OLED Panel", "3440x1440 WQHD Resolution", "240Hz Refresh Rate", "0.03ms GtG Response Time", "G-Sync & FreeSync Premium", "Anti-Glare Low Reflection"],
     "condition": "Brand New — Factory Sealed"},
    
    # Projectors
    {"title": "XGIMI Horizon Ultra", "description": "XGIMI Horizon Ultra — 4K Dolby Vision, 2300 ISO Lumens, Harman Kardon Audio", "retail_price": 1699.00, "duration": 216000, "category": "home",
     "features": ["Native 4K Resolution", "2300 ISO Lumens Brightness", "Dolby Vision & HDR10+", "Harman Kardon Speakers", "Intelligent Screen Adaptation", "Google TV Built-In"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Samsung Freestyle 2", "description": "Samsung The Freestyle 2nd Gen — Portable Projector, 360° Sound, Smart TV Built-In", "retail_price": 899.00, "duration": 194400, "category": "home",
     "features": ["Full HD 1080p Resolution", "360° Sound Built-In", "Auto Focus & Auto Keystone", "Samsung Smart TV Built-In", "Gaming Hub Support", "Portable, 830g Weight"],
     "condition": "Brand New — Factory Sealed"},
    
    # Massage Guns
    {"title": "Theragun Pro Plus", "description": "Theragun Pro Plus — 60lb Force, Smart App, 6 Attachments, QuietForce Technology", "retail_price": 599.00, "duration": 172800, "category": "fitness",
     "features": ["60lb No-Stall Force", "QuietForce Technology", "OLED Screen with Force Meter", "300-Minute Battery Life", "6 Attachment Heads", "Therabody App Integration"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Hyperice Hypervolt 2 Pro", "description": "Hyperice Hypervolt 2 Pro — Bluetooth Connected, 5 Speeds, Quiet Glide Technology", "retail_price": 399.00, "duration": 172800, "category": "fitness",
     "features": ["Quiet Glide Technology", "Bluetooth App Control", "5 Speed Settings", "3-Hour Battery Life", "5 Attachment Heads", "TSA-Approved Carry Size"],
     "condition": "Brand New — Factory Sealed"},

    # === 50th Product ===
    {"title": "Tesla Model Pi Phone 2026", "description": "Tesla Model Pi Smartphone — Satellite Connection via Starlink, Neuralink-Ready, Solar-Charging Display, 5000mAh Battery. Das Tesla Phone ist das erste Smartphone mit direktem Starlink-Satellite-Zugang weltweit — für Telefonate & Internet ohne Netzabdeckung. Mit Tesla-Car-Integration, Krypto-Mining-Funktion und revolutionärer Neuralink-Ready Technologie.",
     "retail_price": 1299.00, "duration": 216000, "category": "phones",
     "features": ["Starlink Satellite Connection", "Neuralink-Ready", "Solar-Charging Display", "5000mAh Battery", "Tesla Car Integration", "Native Crypto Mining", "Titanium Housing"],
     "condition": "Brand New — Factory Sealed"},
]


# ── Seed demo auctions ──
def _bot_target_for(retail_price: float) -> float:
    """Pick realistic bot target final price based on retail value."""
    import random as _r
    if retail_price < 300:
        return round(_r.uniform(18, 30), 2)
    if retail_price < 800:
        return round(_r.uniform(30, 55), 2)
    if retail_price < 2000:
        return round(_r.uniform(50, 90), 2)
    if retail_price < 5000:
        return round(_r.uniform(80, 140), 2)
    return round(_r.uniform(150, 280), 2)


def _build_auction_doc(d: dict, created_by: str, now: datetime) -> dict:
    """Build a full auction document with bot auto-bidding config."""
    auction_id = secrets.token_hex(8)
    ends_at = (now + timedelta(seconds=d["duration"])).isoformat()
    return {
        "auction_id": auction_id,
        "title": d["title"],
        "description": d["description"],
        "image_url": PRODUCT_IMAGES.get(d["title"], ""),
        "retail_price": d["retail_price"],
        "starting_price": 0.00,
        "current_price": 0.00,
        "price_increment": PRICE_INCREMENT,
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": d["duration"],
        "ends_at": ends_at,
        "status": "active",
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": created_by,
        "created_at": now.isoformat(),
        "category": d.get("category", ""),
        "features": d.get("features", []),
        "condition": d.get("condition", "Brand New — Factory Sealed"),
        # ── Auto Bot-Bidding Configuration ──
        "bot_enabled": True,
        "bot_target_price": _bot_target_for(d["retail_price"]),
        "bot_final_phase_seconds": 300,  # Last 5 min → bots resume
        "bot_probability": 0.35,
        "bot_strategy": "standard",
        "bot_aggression": "medium",
        "bot_min_seconds": 300,
    }


async def seed_demo_auctions():
    """Seed ALL 50 auctions from product catalog if none exist (with bot auto-bidding)."""
    count = await db.auctions.count_documents({"status": "active"})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    for d in PRODUCT_CATALOG:
        auction = _build_auction_doc(d, "system", now)
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)


# ── Admin: Refresh product auctions ──
@router.post("/admin/refresh")
async def refresh_auctions(request: Request):
    """Admin: End all active auctions and launch fresh ones from catalog."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # End all active auctions
    await db.auctions.update_many(
        {"status": "active"},
        {"$set": {"status": "ended", "ended_at": now_iso}},
    )

    # Create new auctions from full catalog (with bot auto-bidding)
    created = []
    for d in PRODUCT_CATALOG:
        auction = _build_auction_doc(d, str(user["_id"]), now)
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)
        created.append(auction["auction_id"])

    return {"refreshed": len(created), "auction_ids": created}


# ── Admin: Get product catalog ──
@router.get("/admin/catalog")
async def get_catalog(request: Request):
    """Admin: View the current product catalog."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")
    return {"catalog": PRODUCT_CATALOG, "total": len(PRODUCT_CATALOG)}


# ── Watchlist Toggle ──
@router.post("/{auction_id}/watchlist")
async def toggle_watchlist(auction_id: str, request: Request):
    """Toggle auction in user's watchlist."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    existing = await db.watchlist.find_one({"user_id": user_id, "auction_id": auction_id})
    if existing:
        await db.watchlist.delete_one({"_id": existing["_id"]})
        return {"watched": False}
    await db.watchlist.insert_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"watched": True}


# ══════════════════════════════════════════════════════
# BOT ADMIN — Target Price & Auto-Bidding System
# ══════════════════════════════════════════════════════

BOT_NAMES = [
    "Max_B", "Lukas99", "AnnaMaria", "Sophie_K", "Leon2040",
    "EmmaW", "Felix_H", "Laura88", "Tim_S", "Julia_M",
    "Nico_R", "Lena_X", "Paul_T", "Clara92", "Ben_F",
    "Mia_Z", "David_W", "Hannah_G", "Simon_P", "Lisa_V",
    "Jan_K", "Marie_D", "Tom_A", "Sarah_N", "Alex_C",
    "Nina_E", "Moritz_L", "Elena_O", "Finn_J", "Lea_U",
]

import random


class BotConfigRequest(BaseModel):
    auction_id: str
    bot_enabled: bool = True
    bot_target_price: float = Field(0, ge=0, le=100000)
    bot_min_seconds: int = Field(300, ge=0, le=86400)  # Bot starts bidding when remaining <= this
    # NEW: Extended bot options
    bot_aggression: str = Field("medium", pattern="^(low|medium|high|extreme)$")  # How fast bot bids
    bot_max_bids_per_minute: int = Field(5, ge=1, le=30)  # Max bids per minute
    bot_min_delay_seconds: int = Field(3, ge=1, le=60)  # Min delay between bids
    bot_max_delay_seconds: int = Field(15, ge=3, le=300)  # Max delay between bids
    bot_react_to_users: bool = Field(True)  # Bot reacts faster when real users bid
    bot_final_battle_mode: str = Field("aggressive", pattern="^(passive|normal|aggressive|berserker)$")


class BotStrategyRequest(BaseModel):
    auction_id: str
    strategy: str = Field("standard", pattern="^(standard|sniper|pressure|marathon|whale)$")


# Bot Aggression Settings
BOT_AGGRESSION_SETTINGS = {
    "low": {"min_delay": 10, "max_delay": 30, "bids_per_min": 3},
    "medium": {"min_delay": 5, "max_delay": 15, "bids_per_min": 6},
    "high": {"min_delay": 2, "max_delay": 8, "bids_per_min": 12},
    "extreme": {"min_delay": 1, "max_delay": 4, "bids_per_min": 20},
}

# Bot Strategies
BOT_STRATEGIES = {
    "standard": {
        "name": "Standard",
        "description": "Gleichmäßiges Bieten bis zum Zielpreis",
        "aggression": "medium",
        "final_battle": "normal",
    },
    "sniper": {
        "name": "Sniper",
        "description": "Wartet bis letzte Sekunden, dann aggressiv",
        "aggression": "low",
        "final_battle": "aggressive",
    },
    "pressure": {
        "name": "Pressure",
        "description": "Konstanter Druck, schnelle Gebote",
        "aggression": "high",
        "final_battle": "aggressive",
    },
    "marathon": {
        "name": "Marathon",
        "description": "Langsam und stetig über lange Zeit",
        "aggression": "low",
        "final_battle": "passive",
    },
    "whale": {
        "name": "Whale",
        "description": "Dominiert die Auktion komplett",
        "aggression": "extreme",
        "final_battle": "berserker",
    },
}


@router.get("/admin/list")
async def admin_list_auctions(request: Request):
    """Admin: list all auctions with bot config."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    auctions = await db.auctions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    now_dt = datetime.now(timezone.utc)
    for a in auctions:
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                a["remaining_seconds"] = max(0, (ends - now_dt).total_seconds())
            except Exception:
                a["remaining_seconds"] = 0
        else:
            a["remaining_seconds"] = 0

        # Revenue calculation
        tp = a.get("bot_target_price", 0)
        if tp > 0:
            bids_needed = int(tp / PRICE_INCREMENT)
            a["bot_estimated_revenue"] = round(bids_needed * 0.50, 2)
        else:
            a["bot_estimated_revenue"] = 0

        # Bot bid count
        bot_bids = await db.auction_bids.count_documents({
            "auction_id": a["auction_id"], "is_bot": True
        })
        a["bot_bids_placed"] = bot_bids
        
        # Add strategy info
        strategy = a.get("bot_strategy", "standard")
        a["bot_strategy_info"] = BOT_STRATEGIES.get(strategy, BOT_STRATEGIES["standard"])

    return {"auctions": auctions, "strategies": BOT_STRATEGIES, "aggression_settings": BOT_AGGRESSION_SETTINGS}


@router.get("/admin/bot-strategies")
async def get_bot_strategies(request: Request):
    """Admin: Get available bot strategies."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")
    
    return {
        "strategies": BOT_STRATEGIES,
        "aggression_settings": BOT_AGGRESSION_SETTINGS,
        "final_battle_modes": {
            "passive": "Wenig Aktivität in letzten Sekunden",
            "normal": "Normale Reaktion auf User-Gebote",
            "aggressive": "Schnelle Gegengebote",
            "berserker": "Sofortige Reaktion, maximale Intensität",
        }
    }


@router.post("/admin/bot-config")
async def set_bot_config(req: BotConfigRequest, request: Request):
    """Admin: configure bot for an auction with extended options."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    await db.auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {
            "bot_enabled": req.bot_enabled,
            "bot_target_price": req.bot_target_price,
            "bot_min_seconds": req.bot_min_seconds,
            "bot_aggression": req.bot_aggression,
            "bot_max_bids_per_minute": req.bot_max_bids_per_minute,
            "bot_min_delay_seconds": req.bot_min_delay_seconds,
            "bot_max_delay_seconds": req.bot_max_delay_seconds,
            "bot_react_to_users": req.bot_react_to_users,
            "bot_final_battle_mode": req.bot_final_battle_mode,
        }},
    )

    # Calculate estimated revenue
    bids_needed = int(req.bot_target_price / PRICE_INCREMENT) if req.bot_target_price > 0 else 0
    estimated_revenue = round(bids_needed * 0.50, 2)

    return {
        "ok": True,
        "auction_id": req.auction_id,
        "bot_enabled": req.bot_enabled,
        "bot_target_price": req.bot_target_price,
        "bot_aggression": req.bot_aggression,
        "estimated_revenue": estimated_revenue,
    }


@router.post("/admin/bot-strategy")
async def set_bot_strategy(req: BotStrategyRequest, request: Request):
    """Admin: set bot strategy for an auction."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.strategy not in BOT_STRATEGIES:
        raise HTTPException(status_code=400, detail="Invalid strategy")
    
    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    strategy = BOT_STRATEGIES[req.strategy]
    aggression = BOT_AGGRESSION_SETTINGS[strategy["aggression"]]
    
    await db.auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {
            "bot_strategy": req.strategy,
            "bot_aggression": strategy["aggression"],
            "bot_final_battle_mode": strategy["final_battle"],
            "bot_min_delay_seconds": aggression["min_delay"],
            "bot_max_delay_seconds": aggression["max_delay"],
            "bot_max_bids_per_minute": aggression["bids_per_min"],
        }},
    )
    
    return {
        "ok": True,
        "strategy": req.strategy,
        "strategy_info": strategy,
    }


async def execute_bot_bid(auction):
    """Place a single bot bid on an auction."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    bot_name = random.choice(BOT_NAMES)
    new_price = round(auction["current_price"] + PRICE_INCREMENT, 2)

    # Extend timer like a normal bid
    current_ends = datetime.fromisoformat(auction["ends_at"])
    remaining = (current_ends - now).total_seconds()
    if remaining <= FINAL_BATTLE_THRESHOLD:
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    elif remaining < TIMER_EXTENSION_SECONDS:
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    else:
        new_ends = current_ends

    await db.auctions.update_one(
        {"auction_id": auction["auction_id"]},
        {"$set": {
            "current_price": new_price,
            "ends_at": new_ends.isoformat(),
            "last_bidder_id": f"bot_{bot_name}",
            "last_bidder_name": bot_name,
        },
        "$inc": {"total_bids": 1}},
    )

    bid_record = {
        "bid_id": secrets.token_hex(6),
        "auction_id": auction["auction_id"],
        "user_id": f"bot_{bot_name}",
        "user_name": bot_name,
        "bid_price": new_price,
        "created_at": now_iso,
        "is_bot": True,
    }
    await db.auction_bids.insert_one(bid_record)


async def bot_bidding_loop():
    """Background loop: check bot-enabled auctions and place bids.
    
    NEW 3-PHASE BOT BIDDING STRATEGY:
    ═══════════════════════════════════════════════════════════════════
    Phase 1 (START): Bots bid until price reaches €3-5 to generate initial activity
    Phase 2 (PAUSE): Bots stop completely, let real customers bid
    Phase 3 (FINAL 5 MIN): If remaining < 5min AND price < target, bots resume
                          Bots bid until target price is reached, then STOP
    ═══════════════════════════════════════════════════════════════════
    """
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

            bot_auctions = await db.auctions.find({
                "status": "active",
                "bot_enabled": True,
                "bot_target_price": {"$gt": 0},
                "ends_at": {"$gt": now_iso},
            }).to_list(100)

            for auction in bot_auctions:
                target = auction.get("bot_target_price", 50)  # z.B. €50.01
                current = auction.get("current_price", 0)
                
                # ═══ PHASE CHECK: Target already reached? STOP completely ═══
                if current >= target:
                    continue

                try:
                    ends = datetime.fromisoformat(auction["ends_at"])
                    remaining = (ends - now).total_seconds()
                except Exception:
                    continue

                # ═══════════════════════════════════════════════════════════
                # PHASE 1: START PHASE (Preis < initial_target)
                # Bots bieten bis €3-6 erreicht sind um Aktivität zu generieren
                # Jede Auktion bekommt einen eigenen zufälligen Zielwert
                # ═══════════════════════════════════════════════════════════
                initial_target = auction.get("bot_initial_target")
                if initial_target is None:
                    # Generate unique random target for this auction and persist it
                    initial_target = round(random.uniform(3.0, 6.0), 2)
                    await db.auctions.update_one(
                        {"auction_id": auction["auction_id"]},
                        {"$set": {"bot_initial_target": initial_target}}
                    )
                
                if current < initial_target:
                    # In Phase 1: Biete bis initial_target erreicht
                    bid_probability = 0.4  # 40% Chance pro Loop
                    if random.random() > bid_probability:
                        continue
                    await asyncio.sleep(random.uniform(0.5, 2.0))
                    await execute_bot_bid(auction)
                    continue

                # ═══════════════════════════════════════════════════════════
                # PHASE 2: PAUSE PHASE (€5 < Preis < Target, Zeit > 5 Min)
                # Bots stoppen komplett, echte Kunden bieten
                # ═══════════════════════════════════════════════════════════
                final_phase_seconds = auction.get("bot_final_phase_seconds", 300)  # 5 Minuten
                
                if remaining > final_phase_seconds:
                    # Noch mehr als 5 Minuten übrig → PAUSE (keine Bot-Bids)
                    continue

                # ═══════════════════════════════════════════════════════════
                # PHASE 3: FINAL PHASE (Letzte 5 Minuten)
                # Bots bieten wieder bis Zielpreis erreicht ist
                # ═══════════════════════════════════════════════════════════
                # Preis < Target UND weniger als 5 Minuten übrig
                bid_probability = auction.get("bot_probability", 0.35)
                if random.random() > bid_probability:
                    continue

                # Add random delay to avoid predictable timing
                await asyncio.sleep(random.uniform(0.5, 2.0))
                
                await execute_bot_bid(auction)

        except Exception as e:
            import logging
            logging.getLogger("bidblitz").error(f"Bot loop error: {e}")

        # Random sleep interval to avoid patterns
        await asyncio.sleep(random.uniform(3, 8))


def start_bot_loop():
    """Start the bot bidding background task."""
    asyncio.create_task(bot_bidding_loop())


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN AUCTION AUTOMATION SYSTEM
# Full admin control over auction lifecycle, scheduling, and auto-rotation
# ═══════════════════════════════════════════════════════════════════════════════

class AutomationConfigRequest(BaseModel):
    enabled: bool = True
    auto_create_enabled: bool = True
    min_active_auctions: int = Field(default=5, ge=1, le=50)
    max_active_auctions: int = Field(default=20, ge=1, le=100)
    default_duration_hours: int = Field(default=48, ge=1, le=168)
    auto_end_expired: bool = True
    auto_restart_ended: bool = False
    bot_default_enabled: bool = True
    bot_default_target_percent: float = Field(default=15.0, ge=0, le=50)  # % of retail price
    categories_enabled: list = Field(default=["phones", "gaming", "audio", "wearables", "laptops", "tablets"])


class ScheduleAuctionRequest(BaseModel):
    product_index: int = Field(..., ge=0)  # Index in PRODUCT_CATALOG
    start_at: Optional[str] = None  # ISO datetime, None = start immediately
    duration_hours: int = Field(default=48, ge=1, le=168)
    bot_enabled: bool = True
    bot_target_price: Optional[float] = None  # None = auto-calculate
    featured: bool = False


class BulkScheduleRequest(BaseModel):
    product_indices: list  # List of indices
    stagger_minutes: int = Field(default=30, ge=0, le=1440)
    duration_hours: int = Field(default=48, ge=1, le=168)
    bot_enabled: bool = True


@router.get("/admin/automation/config")
async def get_automation_config(request: Request):
    """Admin: Get current automation configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await db.auction_automation_config.find_one({"_id": "global"})
    if not config:
        config = {
            "enabled": True,
            "auto_create_enabled": True,
            "min_active_auctions": 5,
            "max_active_auctions": 20,
            "default_duration_hours": 48,
            "auto_end_expired": True,
            "auto_restart_ended": False,
            "bot_default_enabled": True,
            "bot_default_target_percent": 15.0,
            "categories_enabled": ["phones", "gaming", "audio", "wearables", "laptops", "tablets"],
        }
    
    config.pop("_id", None)
    
    # Add stats
    active_count = await db.auctions.count_documents({"status": "active"})
    scheduled_count = await db.auctions.count_documents({"status": "scheduled"})
    ended_today = await db.auctions.count_documents({
        "status": "ended",
        "ended_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    config["stats"] = {
        "active_auctions": active_count,
        "scheduled_auctions": scheduled_count,
        "ended_today": ended_today,
        "catalog_size": len(PRODUCT_CATALOG),
    }
    
    return config


@router.post("/admin/automation/config")
async def set_automation_config(req: AutomationConfigRequest, request: Request):
    """Admin: Update automation configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config_dict = req.dict()
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_dict["updated_by"] = str(user["_id"])
    
    await db.auction_automation_config.update_one(
        {"_id": "global"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"ok": True, "config": config_dict}


@router.post("/admin/auction/schedule")
async def schedule_single_auction(req: ScheduleAuctionRequest, request: Request):
    """Admin: Schedule a single auction from catalog."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.product_index >= len(PRODUCT_CATALOG):
        raise HTTPException(status_code=400, detail=f"Invalid product index. Max: {len(PRODUCT_CATALOG)-1}")
    
    product = PRODUCT_CATALOG[req.product_index]
    now = datetime.now(timezone.utc)
    
    if req.start_at:
        try:
            start_time = datetime.fromisoformat(req.start_at.replace("Z", "+00:00"))
        except:
            raise HTTPException(status_code=400, detail="Invalid start_at format")
        status = "scheduled" if start_time > now else "active"
    else:
        start_time = now
        status = "active"
    
    duration_seconds = req.duration_hours * 3600
    ends_at = start_time + timedelta(seconds=duration_seconds)
    
    # Auto-calculate bot target if not provided (15% of retail by default)
    if req.bot_target_price is None:
        bot_target = round(product["retail_price"] * 0.15, 2)
    else:
        bot_target = req.bot_target_price
    
    auction_id = secrets.token_hex(8)
    auction = {
        "auction_id": auction_id,
        "title": product["title"],
        "description": product["description"],
        "image_url": PRODUCT_IMAGES.get(product["title"], ""),
        "retail_price": product["retail_price"],
        "starting_price": 0.00,
        "current_price": 0.00,
        "price_increment": PRICE_INCREMENT,
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": duration_seconds,
        "starts_at": start_time.isoformat(),
        "ends_at": ends_at.isoformat(),
        "status": status,
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": str(user["_id"]),
        "created_at": now.isoformat(),
        "category": product.get("category", ""),
        "features": product.get("features", []),
        "condition": product.get("condition", "Brand New — Factory Sealed"),
        "bot_enabled": req.bot_enabled,
        "bot_target_price": bot_target,
        "bot_min_seconds": 60,
        "bot_probability": 0.4,
        "featured": req.featured,
        "admin_scheduled": True,
    }
    
    await db.auctions.insert_one(auction)
    auction.pop("_id", None)
    
    return {
        "ok": True,
        "auction": auction,
        "message": f"Auction '{product['title']}' {'scheduled for ' + start_time.isoformat() if status == 'scheduled' else 'started immediately'}",
    }


@router.post("/admin/auction/bulk-schedule")
async def bulk_schedule_auctions(req: BulkScheduleRequest, request: Request):
    """Admin: Schedule multiple auctions with staggered start times."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    created = []
    
    for i, idx in enumerate(req.product_indices):
        if idx >= len(PRODUCT_CATALOG):
            continue
        
        product = PRODUCT_CATALOG[idx]
        start_time = now + timedelta(minutes=i * req.stagger_minutes)
        duration_seconds = req.duration_hours * 3600
        ends_at = start_time + timedelta(seconds=duration_seconds)
        
        status = "scheduled" if start_time > now else "active"
        bot_target = round(product["retail_price"] * 0.15, 2)
        
        auction_id = secrets.token_hex(8)
        auction = {
            "auction_id": auction_id,
            "title": product["title"],
            "description": product["description"],
            "image_url": PRODUCT_IMAGES.get(product["title"], ""),
            "retail_price": product["retail_price"],
            "starting_price": 0.00,
            "current_price": 0.00,
            "price_increment": PRICE_INCREMENT,
            "timer_extension": TIMER_EXTENSION_SECONDS,
            "duration_seconds": duration_seconds,
            "starts_at": start_time.isoformat(),
            "ends_at": ends_at.isoformat(),
            "status": status,
            "winner_id": None,
            "winner_name": None,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "total_bids": 0,
            "created_by": str(user["_id"]),
            "created_at": now.isoformat(),
            "category": product.get("category", ""),
            "features": product.get("features", []),
            "condition": product.get("condition", "Brand New — Factory Sealed"),
            "bot_enabled": req.bot_enabled,
            "bot_target_price": bot_target,
            "bot_min_seconds": 60,
            "bot_probability": 0.4,
            "admin_scheduled": True,
        }
        
        await db.auctions.insert_one(auction)
        created.append({"auction_id": auction_id, "title": product["title"], "starts_at": start_time.isoformat()})
    
    return {
        "ok": True,
        "created_count": len(created),
        "auctions": created,
    }


@router.post("/admin/auction/{auction_id}/pause")
async def pause_auction(auction_id: str, request: Request):
    """Admin: Pause an active auction."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active auctions can be paused")
    
    now = datetime.now(timezone.utc)
    ends_at = datetime.fromisoformat(auction["ends_at"])
    remaining = (ends_at - now).total_seconds()
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "status": "paused",
            "paused_at": now.isoformat(),
            "remaining_when_paused": max(0, remaining),
        }}
    )
    
    return {"ok": True, "status": "paused", "remaining_seconds": remaining}


@router.post("/admin/auction/{auction_id}/resume")
async def resume_auction(auction_id: str, request: Request):
    """Admin: Resume a paused auction."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "paused":
        raise HTTPException(status_code=400, detail="Only paused auctions can be resumed")
    
    now = datetime.now(timezone.utc)
    remaining = auction.get("remaining_when_paused", 300)
    new_ends_at = now + timedelta(seconds=remaining)
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "status": "active",
            "ends_at": new_ends_at.isoformat(),
            "resumed_at": now.isoformat(),
        },
        "$unset": {"paused_at": "", "remaining_when_paused": ""}}
    )
    
    return {"ok": True, "status": "active", "ends_at": new_ends_at.isoformat()}


@router.post("/admin/auction/{auction_id}/end")
async def force_end_auction(auction_id: str, request: Request):
    """Admin: Force end an auction immediately."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] == "ended":
        raise HTTPException(status_code=400, detail="Auction already ended")
    
    now = datetime.now(timezone.utc)
    
    # Find winner
    last_bid = await db.auction_bids.find_one(
        {"auction_id": auction_id},
        sort=[("created_at", -1)]
    )
    winner_id = last_bid["user_id"] if last_bid and not last_bid.get("is_bot") else None
    winner_name = last_bid["user_name"] if last_bid and not last_bid.get("is_bot") else None
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "status": "ended",
            "ended_at": now.isoformat(),
            "winner_id": winner_id,
            "winner_name": winner_name,
            "force_ended_by": str(user["_id"]),
        }}
    )
    
    return {
        "ok": True,
        "status": "ended",
        "winner_id": winner_id,
        "winner_name": winner_name,
        "final_price": auction.get("current_price", 0),
    }


@router.post("/admin/auction/{auction_id}/extend")
async def extend_auction(auction_id: str, request: Request):
    """Admin: Extend auction time."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    extend_minutes = body.get("minutes", 60)
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] not in ("active", "paused"):
        raise HTTPException(status_code=400, detail="Cannot extend ended auction")
    
    current_ends = datetime.fromisoformat(auction["ends_at"])
    new_ends = current_ends + timedelta(minutes=extend_minutes)
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"ends_at": new_ends.isoformat()}}
    )
    
    return {"ok": True, "new_ends_at": new_ends.isoformat(), "extended_minutes": extend_minutes}


@router.delete("/admin/auction/{auction_id}")
async def delete_auction(auction_id: str, request: Request):
    """Admin: Delete an auction (only if no bids)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    bid_count = await db.auction_bids.count_documents({"auction_id": auction_id, "is_bot": {"$ne": True}})
    if bid_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {bid_count} real user bids exist")
    
    # Delete auction and bot bids
    await db.auction_bids.delete_many({"auction_id": auction_id})
    await db.auctions.delete_one({"auction_id": auction_id})
    
    return {"ok": True, "deleted": auction_id}


@router.get("/admin/stats/overview")
async def get_auction_stats(request: Request):
    """Admin: Get comprehensive auction statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    
    # Counts
    total_auctions = await db.auctions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    scheduled_auctions = await db.auctions.count_documents({"status": "scheduled"})
    paused_auctions = await db.auctions.count_documents({"status": "paused"})
    ended_auctions = await db.auctions.count_documents({"status": "ended"})
    
    # Bids
    total_bids = await db.auction_bids.count_documents({})
    real_bids = await db.auction_bids.count_documents({"is_bot": {"$ne": True}})
    bot_bids = await db.auction_bids.count_documents({"is_bot": True})
    bids_today = await db.auction_bids.count_documents({"created_at": {"$gte": today_start}})
    
    # Revenue (each bid = €0.50 revenue from credit purchase)
    revenue_estimate = round(real_bids * 0.50, 2)
    
    # Winners
    auctions_with_winner = await db.auctions.count_documents({"winner_id": {"$ne": None}})
    
    # Credit purchases
    credit_txns = await db.transactions.find({
        "type": "auction_bid",
        "status": "completed"
    }).to_list(1000)
    total_credit_revenue = sum(abs(t.get("amount", 0)) for t in credit_txns)
    
    return {
        "auctions": {
            "total": total_auctions,
            "active": active_auctions,
            "scheduled": scheduled_auctions,
            "paused": paused_auctions,
            "ended": ended_auctions,
            "with_winner": auctions_with_winner,
        },
        "bids": {
            "total": total_bids,
            "real_users": real_bids,
            "bots": bot_bids,
            "today": bids_today,
        },
        "revenue": {
            "estimated_from_bids": revenue_estimate,
            "total_credit_purchases": round(total_credit_revenue, 2),
        },
        "catalog_size": len(PRODUCT_CATALOG),
    }
