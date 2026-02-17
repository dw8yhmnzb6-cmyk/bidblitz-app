"""
Partner Happy Hour / Flash Sales - Zeitbegrenzte Angebote für Partner
Erhöht Dringlichkeit und Conversion
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/partner-flash-sales", tags=["Partner Flash Sales"])

# ==================== SCHEMAS ====================

class FlashSaleCreate(BaseModel):
    voucher_id: Optional[str] = None  # Specific voucher or None for all
    name: str
    description: Optional[str] = None
    discount_percent: int  # 10, 20, 30, etc.
    start_time: str  # ISO format
    end_time: str  # ISO format
    max_redemptions: Optional[int] = None  # Limit number of sales
    notify_customers: bool = True  # Send push notification

class FlashSaleResponse(BaseModel):
    id: str
    name: str
    discount_percent: int
    start_time: str
    end_time: str
    is_active: bool
    redemptions: int

# ==================== ENDPOINTS ====================

@router.post("/create")
async def create_flash_sale(data: FlashSaleCreate, token: str):
    """Create a new flash sale / happy hour"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Validate times
    try:
        start = datetime.fromisoformat(data.start_time.replace('Z', '+00:00'))
        end = datetime.fromisoformat(data.end_time.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datumsformat")
    
    if end <= start:
        raise HTTPException(status_code=400, detail="Endzeit muss nach Startzeit liegen")
    
    if data.discount_percent < 5 or data.discount_percent > 90:
        raise HTTPException(status_code=400, detail="Rabatt muss zwischen 5% und 90% liegen")
    
    # Create flash sale
    flash_sale_id = str(uuid.uuid4())
    flash_sale = {
        "id": flash_sale_id,
        "partner_id": partner_id,
        "partner_name": partner.get("name"),
        "voucher_id": data.voucher_id,
        "name": data.name,
        "description": data.description,
        "discount_percent": data.discount_percent,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "max_redemptions": data.max_redemptions,
        "redemptions": 0,
        "status": "scheduled",
        "notify_customers": data.notify_customers,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.partner_flash_sales.insert_one(flash_sale)
    
    # Schedule notification if enabled
    if data.notify_customers:
        await schedule_flash_sale_notification(flash_sale_id, partner, data)
    
    logger.info(f"Flash sale created: {flash_sale_id} for partner {partner_id}")
    
    return {
        "success": True,
        "message": "Aktion erstellt",
        "flash_sale_id": flash_sale_id
    }


async def schedule_flash_sale_notification(flash_sale_id: str, partner: dict, data: FlashSaleCreate):
    """Schedule push notification for flash sale start"""
    notification = {
        "id": str(uuid.uuid4()),
        "flash_sale_id": flash_sale_id,
        "partner_id": partner.get("id"),
        "title": f"🔥 {data.discount_percent}% Rabatt bei {partner.get('name')}!",
        "body": data.name,
        "scheduled_for": data.start_time,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.scheduled_notifications.insert_one(notification)


@router.get("/my-sales")
async def get_my_flash_sales(token: str, status: Optional[str] = None):
    """Get all flash sales for partner"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    query = {"partner_id": partner_id}
    if status:
        query["status"] = status
    
    sales = await db.partner_flash_sales.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Update status based on current time
    now = datetime.now(timezone.utc)
    for sale in sales:
        start = datetime.fromisoformat(sale["start_time"].replace('Z', '+00:00'))
        end = datetime.fromisoformat(sale["end_time"].replace('Z', '+00:00'))
        
        if now < start:
            sale["is_active"] = False
            sale["status"] = "scheduled"
        elif now > end:
            sale["is_active"] = False
            sale["status"] = "ended"
        else:
            sale["is_active"] = True
            sale["status"] = "active"
        
        # Calculate remaining time
        if sale["is_active"]:
            remaining = (end - now).total_seconds()
            sale["remaining_seconds"] = int(remaining)
    
    return {"flash_sales": sales}


@router.get("/active")
async def get_active_flash_sales(
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    limit: int = 20
):
    """Get all currently active flash sales"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find active sales
    query = {
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }
    
    sales = await db.partner_flash_sales.find(
        query,
        {"_id": 0}
    ).sort("discount_percent", -1).limit(limit).to_list(limit)
    
    # Enrich with partner info
    enriched_sales = []
    for sale in sales:
        partner = await db.partner_accounts.find_one(
            {"id": sale["partner_id"]},
            {"_id": 0, "name": 1, "logo_url": 1, "business_type": 1, "city": 1, "address": 1}
        )
        
        if partner:
            # Filter by city/type if specified
            if city and partner.get("city", "").lower() != city.lower():
                continue
            if business_type and partner.get("business_type") != business_type:
                continue
            
            sale["partner"] = partner
            
            # Calculate remaining time
            end = datetime.fromisoformat(sale["end_time"].replace('Z', '+00:00'))
            remaining = (end - datetime.now(timezone.utc)).total_seconds()
            sale["remaining_seconds"] = max(0, int(remaining))
            
            enriched_sales.append(sale)
    
    return {"active_sales": enriched_sales}


@router.delete("/{sale_id}")
async def cancel_flash_sale(sale_id: str, token: str):
    """Cancel a flash sale"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    sale = await db.partner_flash_sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Aktion nicht gefunden")
    
    if sale["partner_id"] != partner.get("id"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    await db.partner_flash_sales.update_one(
        {"id": sale_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Cancel scheduled notification
    await db.scheduled_notifications.update_one(
        {"flash_sale_id": sale_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"success": True, "message": "Aktion abgebrochen"}


@router.post("/extend/{sale_id}")
async def extend_flash_sale(sale_id: str, token: str, additional_hours: int = 1):
    """Extend an active flash sale"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    sale = await db.partner_flash_sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Aktion nicht gefunden")
    
    if sale["partner_id"] != partner.get("id"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    # Extend end time
    current_end = datetime.fromisoformat(sale["end_time"].replace('Z', '+00:00'))
    new_end = current_end + timedelta(hours=additional_hours)
    
    await db.partner_flash_sales.update_one(
        {"id": sale_id},
        {"$set": {"end_time": new_end.isoformat()}}
    )
    
    return {
        "success": True,
        "message": f"Aktion um {additional_hours} Stunde(n) verlängert",
        "new_end_time": new_end.isoformat()
    }


@router.get("/stats/{sale_id}")
async def get_flash_sale_stats(sale_id: str, token: str):
    """Get detailed statistics for a flash sale"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    sale = await db.partner_flash_sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Aktion nicht gefunden")
    
    if sale["partner_id"] != partner.get("id"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    # Get redemptions during this sale
    redemptions = await db.voucher_redemptions.find({
        "partner_id": partner.get("id"),
        "redeemed_at": {
            "$gte": sale["start_time"],
            "$lte": sale.get("end_time", datetime.now(timezone.utc).isoformat())
        }
    }).to_list(1000)
    
    total_revenue = sum(r.get("value", 0) for r in redemptions)
    
    return {
        "sale": sale,
        "total_redemptions": len(redemptions),
        "total_revenue": total_revenue,
        "average_order_value": total_revenue / len(redemptions) if redemptions else 0
    }
