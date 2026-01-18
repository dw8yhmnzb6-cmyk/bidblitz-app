"""User router - Profile, Referrals, Bid History"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from config import db, logger, REFERRAL_MIN_DEPOSIT, REFERRAL_REWARD_BIDS
from dependencies import get_current_user, hash_password, verify_password, validate_password_strength
from schemas import UpdateProfileRequest, ChangePasswordRequest, VoucherRedeem

router = APIRouter(prefix="/user", tags=["User"])

# ==================== PROFILE ====================

@router.put("/profile")
async def update_profile(request: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    updates = {}
    if request.name:
        updates["name"] = request.name
    if request.email:
        existing = await db.users.find_one({"email": request.email.lower(), "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
        updates["email"] = request.email.lower()
    
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated_user

@router.put("/change-password")
async def change_password(request: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    if not verify_password(request.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch")
    
    is_valid, message = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password": hash_password(request.new_password)}}
    )
    return {"message": "Passwort erfolgreich geändert"}

# ==================== BID HISTORY ====================

@router.get("/bid-history")
async def get_bid_history(user: dict = Depends(get_current_user), limit: int = 50):
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

# ==================== PURCHASES ====================

@router.get("/purchases")
async def get_purchases(user: dict = Depends(get_current_user), limit: int = 50):
    purchases = await db.purchases.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    return purchases

# ==================== VOUCHER REDEEM ====================

@router.post("/redeem-voucher")
async def redeem_voucher(request: VoucherRedeem, user: dict = Depends(get_current_user)):
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

# ==================== REFERRALS ====================

@router.get("/referrals")
async def get_referrals(user: dict = Depends(get_current_user)):
    referral_code = user.get("referral_code", user["id"][:8].upper())
    
    # Get all users referred by this user
    referred_users = await db.users.find(
        {"referred_by": user["id"]},
        {"_id": 0, "id": 1, "name": 1, "created_at": 1, "total_deposits": 1}
    ).to_list(length=100)
    
    # Count qualified referrals (those who deposited at least €5)
    qualified_count = sum(1 for u in referred_users if u.get("total_deposits", 0) >= REFERRAL_MIN_DEPOSIT)
    
    # Calculate earned bids (only from qualified referrals)
    bids_earned = qualified_count * REFERRAL_REWARD_BIDS
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://bidblitz.de/register?ref={referral_code}",
        "invited_friends": len(referred_users),
        "qualified_friends": qualified_count,
        "bids_earned": bids_earned,
        "min_deposit_required": REFERRAL_MIN_DEPOSIT,
        "reward_per_referral": REFERRAL_REWARD_BIDS,
        "referred_users": [
            {
                "name": u["name"],
                "created_at": u["created_at"],
                "qualified": u.get("total_deposits", 0) >= REFERRAL_MIN_DEPOSIT
            }
            for u in referred_users
        ]
    }

# Helper function to process referral reward after deposit
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
        # User just crossed the €5 threshold
        referred_by = user.get("referred_by")
        if referred_by and user.get("referral_reward_pending"):
            # Give rewards to both referrer and referee
            
            # Reward the referrer
            await db.users.update_one(
                {"id": referred_by},
                {"$inc": {"bids_balance": REFERRAL_REWARD_BIDS}}
            )
            
            # Reward the referee (new user)
            await db.users.update_one(
                {"id": user_id},
                {
                    "$inc": {"bids_balance": REFERRAL_REWARD_BIDS},
                    "$set": {"referral_reward_pending": False}
                }
            )
            
            logger.info(f"Referral reward processed: {user_id} referred by {referred_by}")
            
            # Log the referral completion
            await db.referral_rewards.insert_one({
                "id": str(uuid.uuid4()),
                "referrer_id": referred_by,
                "referee_id": user_id,
                "bids_awarded": REFERRAL_REWARD_BIDS,
                "trigger_deposit": deposit_amount,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
