"""User router - Consolidated user profile, dashboard, and account endpoints"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
from typing import Optional
import base64
import uuid

from config import db, logger, REFERRAL_MIN_DEPOSIT, REFERRER_REWARD_BIDS, REFEREE_REWARD_BIDS
from dependencies import get_current_user, hash_password, verify_password, validate_password_strength
from schemas import UpdateProfileRequest, ChangePasswordRequest, WishlistRequest, VoucherRedeem

router = APIRouter(tags=["User"])

# ==================== PROFILE ====================

@router.get("/user/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get user profile"""
    # Ensure customer number exists
    customer_number = user.get("customer_number")
    if not customer_number:
        import random
        import string
        while True:
            customer_number = ''.join(random.choices(string.digits, k=8))
            existing = await db.users.find_one({"customer_number": customer_number})
            if not existing:
                break
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"customer_number": customer_number}}
        )
    
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "bids_balance": user["bids_balance"],
        "customer_number": customer_number,
        "total_bids_placed": user.get("total_bids_placed", 0),
        "total_deposits": user.get("total_deposits", 0),
        "won_auctions": user.get("won_auctions", []),
        "referral_code": user.get("referral_code", user["id"][:8].upper()),
        "two_factor_enabled": user.get("two_factor_enabled", False),
        "preferred_language": user.get("preferred_language", "de"),
        "avatar_url": user.get("avatar_url"),
        "created_at": user.get("created_at")
    }

@router.post("/user/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload profile avatar image.
    
    Accepts JPEG, PNG, WebP images up to 2MB.
    The image is stored as base64 in the database.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: JPEG, PNG, WebP, GIF"
        )
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 2MB)
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 2MB.")
    
    # Convert to base64 data URL
    base64_content = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{file.content_type};base64,{base64_content}"
    
    # Update user profile
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"avatar_url": data_url, "avatar_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"User {user['id']} uploaded new avatar")
    
    return {
        "message": "Avatar uploaded successfully",
        "avatar_url": data_url
    }

@router.delete("/user/avatar")
async def delete_avatar(user: dict = Depends(get_current_user)):
    """Delete user's avatar"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {"avatar_url": "", "avatar_updated_at": ""}}
    )
    
    return {"message": "Avatar deleted successfully"}

@router.put("/user/profile")
async def update_profile(data: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    """Update user profile"""
    updates = {}
    
    if data.name:
        updates["name"] = data.name
    
    if data.email and data.email != user["email"]:
        # Check if email is taken
        existing = await db.users.find_one({"email": data.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        updates["email"] = data.email.lower()
    
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated

@router.put("/user/language")
async def update_preferred_language(language: str, user: dict = Depends(get_current_user)):
    """Update user's preferred language for emails"""
    # List of supported languages
    supported = ["de", "en", "sq", "el", "tr", "fr", "es", "it", "nl", "pl", "pt", "ru", "zh", "ja", "ko", "ar", "hi", "cs", "sr", "hr"]
    
    if language not in supported:
        raise HTTPException(status_code=400, detail=f"Language '{language}' not supported")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"preferred_language": language}}
    )
    
    return {"message": f"Preferred language updated to {language}", "language": language}

@router.post("/user/change-password")
async def change_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Change user password"""
    # Verify current password
    full_user = await db.users.find_one({"id": user["id"]})
    if not verify_password(data.current_password, full_user["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    is_valid, message = validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Update password
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    
    return {"message": "Password changed successfully"}

# ==================== DASHBOARD ====================

@router.get("/user/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    """Get user dashboard data"""
    # Recent bid history
    recent_auctions = await db.auctions.find(
        {"bid_history.user_id": user["id"]},
        {"_id": 0}
    ).sort("end_time", -1).to_list(10)
    
    # Won auctions
    won_auction_ids = user.get("won_auctions", [])
    won_auctions = []
    if won_auction_ids:
        won_auctions = await db.auctions.find(
            {"id": {"$in": won_auction_ids}},
            {"_id": 0}
        ).to_list(50)
        
        # Add product info
        for auction in won_auctions:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            if product:
                auction["product"] = product
    
    # Active autobidders
    autobidders = await db.autobidders.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(20)
    
    # Transaction history
    transactions = await db.transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "bids_balance": user["bids_balance"],
        "total_bids_placed": user.get("total_bids_placed", 0),
        "won_auctions_count": len(won_auction_ids),
        "recent_activity": recent_auctions,
        "won_auctions": won_auctions,
        "autobidders": autobidders,
        "transactions": transactions
    }

# ==================== WON AUCTIONS ====================

@router.get("/won-auctions/{auction_id}")
async def get_won_auction(auction_id: str, user: dict = Depends(get_current_user)):
    """Get a specific won auction for checkout"""
    # First check in won_auctions collection
    won_auction = await db.won_auctions.find_one(
        {"auction_id": auction_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if won_auction:
        # Get product info
        product = await db.products.find_one({"id": won_auction.get("product_id")}, {"_id": 0})
        if product:
            won_auction["is_bid_voucher"] = product.get("is_bid_voucher", False)
            won_auction["bid_amount"] = product.get("bid_amount", 0)
        return won_auction
    
    # Fallback: check in user's won_auctions list
    user_won_ids = user.get("won_auctions", [])
    if auction_id not in user_won_ids:
        raise HTTPException(status_code=404, detail="Gewonnene Auktion nicht gefunden")
    
    # Get auction details
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Get product
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    return {
        "auction_id": auction_id,
        "user_id": user["id"],
        "product_id": auction.get("product_id"),
        "product_name": product.get("name") if product else "Unbekannt",
        "product_image": product.get("image_url") if product else "",
        "final_price": auction.get("current_price", auction.get("final_price", 0.01)),
        "retail_price": product.get("retail_price") if product else 0,
        "is_bid_voucher": product.get("is_bid_voucher", False) if product else False,
        "bid_amount": product.get("bid_amount", 0) if product else 0,
        "status": auction.get("payment_status", "pending_payment"),
        "won_at": auction.get("ended_at"),
        "is_free_auction": auction.get("is_free_auction", False)
    }

@router.post("/won-auctions/{auction_id}/claim-bids")
async def claim_bid_voucher(auction_id: str, user: dict = Depends(get_current_user)):
    """Claim bids from a won bid voucher (100 Gebote Gutschein)"""
    # Verify user won this auction
    won_auction = await db.won_auctions.find_one(
        {"auction_id": auction_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not won_auction:
        # Check in user's won_auctions
        if auction_id not in user.get("won_auctions", []):
            raise HTTPException(status_code=404, detail="Gewonnene Auktion nicht gefunden")
    
    # Check if already claimed
    if won_auction and won_auction.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Gebote bereits abgeholt")
    
    # Get auction and product
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if not product or not product.get("is_bid_voucher"):
        raise HTTPException(status_code=400, detail="Kein Gebote-Gutschein")
    
    bid_amount = product.get("bid_amount", 100)
    
    # Credit the bids to user
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": bid_amount}}
    )
    
    # Mark as claimed
    await db.won_auctions.update_one(
        {"auction_id": auction_id, "user_id": user["id"]},
        {"$set": {"status": "paid", "claimed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"🎁 User {user['id']} claimed {bid_amount} bids from voucher")
    
    return {
        "success": True,
        "bids_credited": bid_amount,
        "message": f"{bid_amount} Gebote wurden Ihrem Konto gutgeschrieben!"
    }

@router.post("/won-auctions/{auction_id}/checkout")
async def checkout_won_auction(auction_id: str, user: dict = Depends(get_current_user)):
    """Create Stripe checkout for won auction"""
    import stripe
    import os
    
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    
    # Verify user won this auction
    won_auction = await db.won_auctions.find_one(
        {"auction_id": auction_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not won_auction:
        if auction_id not in user.get("won_auctions", []):
            raise HTTPException(status_code=404, detail="Gewonnene Auktion nicht gefunden")
        
        # Get from auction
        auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
        if not auction:
            raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
        
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        final_price = auction.get("current_price", auction.get("final_price", 0.01))
        product_name = product.get("name") if product else "Gewonnene Auktion"
    else:
        final_price = won_auction.get("final_price", 0.01)
        product_name = won_auction.get("product_name", "Gewonnene Auktion")
    
    # Create Stripe checkout session
    frontend_url = os.environ.get("FRONTEND_URL", "https://bidblitz.de")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Gewonnen: {product_name}",
                        "description": f"Endpreis der Auktion"
                    },
                    "unit_amount": int(final_price * 100)  # Stripe uses cents
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=f"{frontend_url}/dashboard?payment=success&auction={auction_id}",
            cancel_url=f"{frontend_url}/checkout/won/{auction_id}",
            metadata={
                "type": "won_auction",
                "auction_id": auction_id,
                "user_id": user["id"]
            }
        )
        
        return {"checkout_url": session.url}
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Erstellen der Zahlung")

# ==================== WISHLIST ====================

@router.get("/user/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    """Get user's wishlist"""
    wishlist = await db.wishlists.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with product/category details
    for item in wishlist:
        if item.get("product_id"):
            product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
            if product:
                item["product"] = product
    
    return wishlist

@router.post("/user/wishlist")
async def add_to_wishlist(data: WishlistRequest, user: dict = Depends(get_current_user)):
    """Add product or category to wishlist"""
    if not data.product_id and not data.category:
        raise HTTPException(status_code=400, detail="Product ID or category required")
    
    # Check for duplicates
    query = {"user_id": user["id"]}
    if data.product_id:
        query["product_id"] = data.product_id
    if data.category:
        query["category"] = data.category
    
    existing = await db.wishlists.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="Already in wishlist")
    
    item = {
        "id": str(__import__('uuid').uuid4()),
        "user_id": user["id"],
        "product_id": data.product_id,
        "category": data.category,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wishlists.insert_one(item)
    return {"message": "Added to wishlist", "id": item["id"]}

@router.delete("/user/wishlist/{item_id}")
async def remove_from_wishlist(item_id: str, user: dict = Depends(get_current_user)):
    """Remove item from wishlist"""
    result = await db.wishlists.delete_one({"id": item_id, "user_id": user["id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    
    return {"message": "Removed from wishlist"}

# ==================== REFERRALS ====================

@router.get("/user/referrals")
async def get_referral_stats(user: dict = Depends(get_current_user)):
    """Get user's referral statistics"""
    referral_code = user.get("referral_code", user["id"][:8].upper())
    
    # Count referrals
    referrals = await db.users.count_documents({"referred_by": user["id"]})
    
    # Count successful referrals (those who deposited)
    successful = await db.users.count_documents({
        "referred_by": user["id"],
        "total_deposits": {"$gt": 0}
    })
    
    rewards_earned = user.get("referral_rewards_earned", 0)
    
    return {
        "referral_code": referral_code,
        "total_referrals": referrals,
        "successful_referrals": successful,
        "rewards_earned": rewards_earned,
        "share_url": f"https://bidblitz.de/?ref={referral_code}"
    }


# ==================== BID HISTORY (from users.py) ====================

@router.get("/user/bid-history")
async def get_bid_history(user: dict = Depends(get_current_user), limit: int = 50):
    """Get user's bid history with auction details"""
    bids = await db.bid_history.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    for bid in bids:
        auction = await db.auctions.find_one({"id": bid["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
            bid["auction"] = auction
            bid["product"] = product
    
    return bids

# Also support /users/bid-history for backwards compatibility
@router.get("/users/bid-history")
async def get_bid_history_compat(user: dict = Depends(get_current_user), limit: int = 50):
    return await get_bid_history(user, limit)

# ==================== PURCHASES (from users.py) ====================

@router.get("/user/purchases")
async def get_purchases(user: dict = Depends(get_current_user), limit: int = 50):
    """Get user's purchase history"""
    purchases = await db.purchases.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    return purchases

@router.get("/users/purchases")
async def get_purchases_compat(user: dict = Depends(get_current_user), limit: int = 50):
    return await get_purchases(user, limit)

# ==================== VOUCHER REDEEM (from users.py) ====================

@router.post("/user/redeem-voucher")
async def redeem_voucher(request: VoucherRedeem, user: dict = Depends(get_current_user)):
    """Redeem a voucher code for bids"""
    voucher = await db.vouchers.find_one({"code": request.code.upper()}, {"_id": 0})
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    if voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
        raise HTTPException(status_code=400, detail="Gutschein bereits vollständig eingelöst")
    
    if voucher.get("expires_at"):
        if datetime.fromisoformat(voucher["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Gutschein abgelaufen")
    
    used_by = voucher.get("used_by", [])
    if user["id"] in used_by:
        raise HTTPException(status_code=400, detail="Sie haben diesen Gutschein bereits eingelöst")
    
    await db.vouchers.update_one(
        {"code": request.code.upper()},
        {
            "$inc": {"used_count": 1},
            "$push": {"used_by": user["id"]}
        }
    )
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": voucher["bids"]}}
    )
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    return {
        "message": f"{voucher['bids']} Gebote gutgeschrieben!",
        "bids_added": voucher["bids"],
        "new_balance": updated_user["bids_balance"]
    }

@router.post("/users/redeem-voucher")
async def redeem_voucher_compat(request: VoucherRedeem, user: dict = Depends(get_current_user)):
    return await redeem_voucher(request, user)

# ==================== REFERRAL HELPER (from users.py) ====================

async def process_referral_reward(user_id: str, deposit_amount: float):
    """Called after a user makes a deposit to check and process referral rewards"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    # Update total deposits
    new_total = user.get("total_deposits", 0) + deposit_amount
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"total_deposits": new_total}}
    )
    
    # Check if this is the first time crossing the threshold
    if user.get("total_deposits", 0) < REFERRAL_MIN_DEPOSIT and new_total >= REFERRAL_MIN_DEPOSIT:
        referred_by = user.get("referred_by")
        if referred_by and user.get("referral_reward_pending"):
            # Reward the referrer
            await db.users.update_one(
                {"id": referred_by},
                {"$inc": {"bids_balance": REFERRER_REWARD_BIDS}}
            )
            
            # Reward the referee
            await db.users.update_one(
                {"id": user_id},
                {
                    "$inc": {"bids_balance": REFEREE_REWARD_BIDS},
                    "$set": {"referral_reward_pending": False}
                }
            )
            
            logger.info(f"Referral reward processed: Referrer {referred_by} gets {REFERRER_REWARD_BIDS} bids, Referee {user_id} gets {REFEREE_REWARD_BIDS} bids")
            
            await db.referral_rewards.insert_one({
                "id": str(uuid.uuid4()),
                "referrer_id": referred_by,
                "referee_id": user_id,
                "referrer_bids_awarded": REFERRER_REWARD_BIDS,
                "referee_bids_awarded": REFEREE_REWARD_BIDS,
                "trigger_deposit": deposit_amount,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
