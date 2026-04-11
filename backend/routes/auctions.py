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


# ── Get user's credit balance ──
@router.get("/credits/balance")
async def get_credits(request: Request):
    """Get user's current bid credit balance."""
    user = await get_current_user(request)
    return {"bid_credits": user.get("bid_credits", 0)}


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
]


# ── Seed demo auctions ──
async def seed_demo_auctions():
    """Seed auctions from product catalog if none exist."""
    count = await db.auctions.count_documents({"status": "active"})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    # Pick first 6 products for initial seed
    for d in PRODUCT_CATALOG[:6]:
        auction_id = secrets.token_hex(8)
        ends_at = (now + timedelta(seconds=d["duration"])).isoformat()
        auction = {
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
            "created_by": "system",
            "created_at": now.isoformat(),
            "category": d.get("category", ""),
            "features": d.get("features", []),
            "condition": d.get("condition", "Brand New — Factory Sealed"),
        }
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

    # Create new auctions from full catalog
    created = []
    for d in PRODUCT_CATALOG:
        auction_id = secrets.token_hex(8)
        ends_at = (now + timedelta(seconds=d["duration"])).isoformat()
        auction = {
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
            "created_by": str(user["_id"]),
            "created_at": now_iso,
            "category": d.get("category", ""),
            "features": d.get("features", []),
            "condition": d.get("condition", "Brand New — Factory Sealed"),
        }
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
    return {"products": PRODUCT_CATALOG, "total": len(PRODUCT_CATALOG)}


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

    return {"auctions": auctions}


@router.post("/admin/bot-config")
async def set_bot_config(req: BotConfigRequest, request: Request):
    """Admin: configure bot for an auction."""
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
        "estimated_revenue": estimated_revenue,
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
    
    Bots only bid on auctions where admin has explicitly enabled bot_enabled=True.
    This simulates market activity in the early phase of the platform.
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
                target = auction.get("bot_target_price", 0)
                current = auction.get("current_price", 0)

                # Don't bid if target reached
                if current >= target:
                    continue

                try:
                    ends = datetime.fromisoformat(auction["ends_at"])
                    remaining = (ends - now).total_seconds()
                except Exception:
                    continue

                # Only bid in final seconds (configurable per auction)
                bot_min_secs = auction.get("bot_min_seconds", 300)
                if bot_min_secs > 0 and remaining > bot_min_secs:
                    continue

                # Randomize bid probability to look natural
                # Lower probability = more realistic
                bid_probability = auction.get("bot_probability", 0.3)
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
