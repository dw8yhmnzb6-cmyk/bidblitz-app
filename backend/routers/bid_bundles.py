"""Bid Bundles Router - Gebote-Pakete mit Bonus"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/bid-bundles", tags=["Bid Bundles"])

# Default Bid Bundles Configuration
DEFAULT_BUNDLES = [
    {
        "id": "bundle_starter",
        "name": "Starter",
        "bids": 50,
        "bonus_bids": 0,
        "price": 29.00,
        "price_per_bid": 0.58,
        "badge": None,
        "savings_percent": 0,
        "active": True
    },
    {
        "id": "bundle_basic",
        "name": "Basic",
        "bids": 100,
        "bonus_bids": 10,
        "price": 49.00,
        "price_per_bid": 0.45,
        "badge": None,
        "savings_percent": 22,
        "active": True
    },
    {
        "id": "bundle_popular",
        "name": "Beliebt",
        "bids": 250,
        "bonus_bids": 50,
        "price": 99.00,
        "price_per_bid": 0.33,
        "badge": "⭐ BELIEBT",
        "savings_percent": 43,
        "active": True,
        "highlighted": True
    },
    {
        "id": "bundle_pro",
        "name": "Pro",
        "bids": 500,
        "bonus_bids": 150,
        "price": 179.00,
        "price_per_bid": 0.28,
        "badge": "🔥 BESTE WAHL",
        "savings_percent": 52,
        "active": True
    },
    {
        "id": "bundle_vip",
        "name": "VIP",
        "bids": 1000,
        "bonus_bids": 400,
        "price": 299.00,
        "price_per_bid": 0.21,
        "badge": "👑 VIP",
        "savings_percent": 64,
        "active": True
    }
]

# ==================== SCHEMAS ====================

class BundleCreate(BaseModel):
    name: str
    bids: int
    bonus_bids: int
    price: float
    badge: Optional[str] = None
    highlighted: bool = False

class BundleUpdate(BaseModel):
    name: Optional[str] = None
    bids: Optional[int] = None
    bonus_bids: Optional[int] = None
    price: Optional[float] = None
    badge: Optional[str] = None
    highlighted: Optional[bool] = None
    active: Optional[bool] = None

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/available")
async def get_available_bundles(user: dict = Depends(get_current_user)):
    """Get all available bid bundles for purchase"""
    # Get bundles from DB or use defaults
    bundles = await db.bid_bundles.find(
        {"active": True},
        {"_id": 0}
    ).sort("price", 1).to_list(20)
    
    if not bundles:
        # Use defaults and save them
        for bundle in DEFAULT_BUNDLES:
            bundle["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.bid_bundles.update_one(
                {"id": bundle["id"]},
                {"$set": bundle},
                upsert=True
            )
        bundles = DEFAULT_BUNDLES
    
    # Check if user is VIP for potential extra discount
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "is_vip": 1})
    is_vip = user_data.get("is_vip", False)
    
    # Apply VIP discount if applicable
    VIP_DISCOUNT = 0.10  # 10% extra
    if is_vip:
        for bundle in bundles:
            bundle["vip_price"] = round(bundle["price"] * (1 - VIP_DISCOUNT), 2)
            bundle["vip_discount"] = VIP_DISCOUNT * 100
    
    return {
        "bundles": bundles,
        "is_vip": is_vip,
        "vip_discount_percent": VIP_DISCOUNT * 100 if is_vip else 0
    }

@router.get("/recommended")
async def get_recommended_bundle(user: dict = Depends(get_current_user)):
    """Get personalized bundle recommendation"""
    user_id = user["id"]
    
    # Analyze user's bidding history
    total_bids = await db.bids.count_documents({
        "user_id": user_id,
        "is_bot": {"$ne": True}
    })
    
    # Get user's purchase history
    purchases = await db.purchases.find(
        {"user_id": user_id, "type": "bids"},
        {"_id": 0, "amount": 1}
    ).to_list(100)
    
    avg_purchase = sum(p.get("amount", 0) for p in purchases) / len(purchases) if purchases else 0
    
    # Recommend based on activity
    if total_bids > 500 or avg_purchase > 200:
        recommended_id = "bundle_vip"
        reason = "Basierend auf deiner hohen Aktivität"
    elif total_bids > 200 or avg_purchase > 100:
        recommended_id = "bundle_pro"
        reason = "Perfekt für regelmäßige Bieter"
    elif total_bids > 50:
        recommended_id = "bundle_popular"
        reason = "Unser beliebtestes Paket"
    else:
        recommended_id = "bundle_basic"
        reason = "Ideal für den Einstieg"
    
    bundle = await db.bid_bundles.find_one({"id": recommended_id}, {"_id": 0})
    if not bundle:
        bundle = next((b for b in DEFAULT_BUNDLES if b["id"] == recommended_id), DEFAULT_BUNDLES[2])
    
    return {
        "recommended": bundle,
        "reason": reason,
        "user_stats": {
            "total_bids_placed": total_bids,
            "avg_purchase_amount": round(avg_purchase, 2)
        }
    }

@router.post("/purchase/{bundle_id}")
async def purchase_bundle(bundle_id: str, user: dict = Depends(get_current_user)):
    """Initiate bundle purchase (creates Stripe checkout)"""
    bundle = await db.bid_bundles.find_one({"id": bundle_id, "active": True}, {"_id": 0})
    
    if not bundle:
        # Try default bundles
        bundle = next((b for b in DEFAULT_BUNDLES if b["id"] == bundle_id), None)
    
    if not bundle:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    # Check for VIP discount
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "is_vip": 1})
    is_vip = user_data.get("is_vip", False)
    
    final_price = bundle.get("vip_price", bundle["price"]) if is_vip else bundle["price"]
    total_bids = bundle["bids"] + bundle["bonus_bids"]
    
    # Create pending purchase record
    purchase_id = str(uuid.uuid4())
    await db.pending_purchases.insert_one({
        "id": purchase_id,
        "user_id": user["id"],
        "bundle_id": bundle_id,
        "bundle_name": bundle["name"],
        "bids": bundle["bids"],
        "bonus_bids": bundle["bonus_bids"],
        "total_bids": total_bids,
        "price": final_price,
        "vip_discount_applied": is_vip,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Note: In production, this would create a Stripe checkout session
    # For now, return the purchase details
    return {
        "purchase_id": purchase_id,
        "bundle": bundle,
        "final_price": final_price,
        "total_bids": total_bids,
        "vip_discount_applied": is_vip,
        "checkout_url": f"/checkout/{purchase_id}"  # Would be Stripe URL
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/all")
async def get_all_bundles(admin: dict = Depends(get_admin_user)):
    """Get all bundles including inactive (admin only)"""
    bundles = await db.bid_bundles.find({}, {"_id": 0}).sort("price", 1).to_list(50)
    
    if not bundles:
        bundles = DEFAULT_BUNDLES
    
    return {"bundles": bundles}

@router.post("/admin/create")
async def create_bundle(bundle: BundleCreate, admin: dict = Depends(get_admin_user)):
    """Create a new bid bundle"""
    bundle_id = f"bundle_{uuid.uuid4().hex[:8]}"
    
    # Calculate price per bid
    total_bids = bundle.bids + bundle.bonus_bids
    price_per_bid = round(bundle.price / total_bids, 2)
    
    # Calculate savings vs starter bundle
    base_price_per_bid = 0.58  # Starter bundle price
    savings_percent = round((1 - price_per_bid / base_price_per_bid) * 100)
    
    bundle_doc = {
        "id": bundle_id,
        "name": bundle.name,
        "bids": bundle.bids,
        "bonus_bids": bundle.bonus_bids,
        "price": bundle.price,
        "price_per_bid": price_per_bid,
        "badge": bundle.badge,
        "savings_percent": max(0, savings_percent),
        "highlighted": bundle.highlighted,
        "active": True,
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bid_bundles.insert_one(bundle_doc)
    
    return {"success": True, "bundle": bundle_doc}

@router.put("/admin/{bundle_id}")
async def update_bundle(bundle_id: str, update: BundleUpdate, admin: dict = Depends(get_admin_user)):
    """Update an existing bundle"""
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    # Recalculate price_per_bid if price or bids changed
    if "price" in update_dict or "bids" in update_dict or "bonus_bids" in update_dict:
        current = await db.bid_bundles.find_one({"id": bundle_id})
        if current:
            new_price = update_dict.get("price", current["price"])
            new_bids = update_dict.get("bids", current["bids"])
            new_bonus = update_dict.get("bonus_bids", current["bonus_bids"])
            total = new_bids + new_bonus
            update_dict["price_per_bid"] = round(new_price / total, 2)
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = admin["id"]
    
    result = await db.bid_bundles.update_one(
        {"id": bundle_id},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    return {"success": True}

@router.delete("/admin/{bundle_id}")
async def delete_bundle(bundle_id: str, admin: dict = Depends(get_admin_user)):
    """Delete/deactivate a bundle"""
    result = await db.bid_bundles.update_one(
        {"id": bundle_id},
        {"$set": {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    return {"success": True}

@router.get("/admin/stats")
async def get_bundle_stats(admin: dict = Depends(get_admin_user)):
    """Get bundle sales statistics"""
    # Sales by bundle
    pipeline = [
        {"$match": {"type": "bids", "status": "completed"}},
        {"$group": {
            "_id": "$bundle_id",
            "count": {"$sum": 1},
            "revenue": {"$sum": "$amount"}
        }},
        {"$sort": {"revenue": -1}}
    ]
    
    sales = await db.purchases.aggregate(pipeline).to_list(20)
    
    # Total stats
    total_revenue = sum(s["revenue"] for s in sales)
    total_sales = sum(s["count"] for s in sales)
    
    return {
        "by_bundle": sales,
        "totals": {
            "revenue": round(total_revenue, 2),
            "sales": total_sales,
            "avg_order_value": round(total_revenue / total_sales, 2) if total_sales > 0 else 0
        }
    }


bid_bundles_router = router
