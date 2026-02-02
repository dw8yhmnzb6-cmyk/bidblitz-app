"""Price Alerts & Deal Notifications"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/alerts", tags=["Alerts"])

# ==================== PRICE ALERTS ====================

@router.get("/my-alerts")
async def get_my_alerts(user: dict = Depends(get_current_user)):
    """Get user's price alerts"""
    alerts = await db.price_alerts.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with product info
    enriched = []
    for alert in alerts:
        product = await db.products.find_one({"id": alert.get("product_id")}, {"_id": 0, "name": 1, "image_url": 1})
        enriched.append({
            **alert,
            "product": product
        })
    
    return {"alerts": enriched}

@router.post("/create")
async def create_price_alert(
    product_id: Optional[str] = None,
    auction_id: Optional[str] = None,
    target_price: float = 5.0,
    notify_telegram: bool = True,
    notify_email: bool = False,
    notify_push: bool = True,
    user: dict = Depends(get_current_user)
):
    """Create a price alert for a product or auction"""
    if not product_id and not auction_id:
        raise HTTPException(status_code=400, detail="Produkt oder Auktion angeben")
    
    # Check if alert already exists
    query = {"user_id": user["id"], "is_active": True}
    if product_id:
        query["product_id"] = product_id
    if auction_id:
        query["auction_id"] = auction_id
    
    existing = await db.price_alerts.find_one(query)
    if existing:
        # Update existing alert
        await db.price_alerts.update_one(
            {"id": existing["id"]},
            {"$set": {
                "target_price": target_price,
                "notify_telegram": notify_telegram,
                "notify_email": notify_email,
                "notify_push": notify_push,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Alarm aktualisiert", "alert_id": existing["id"]}
    
    # Get product info
    product_name = None
    if product_id:
        product = await db.products.find_one({"id": product_id}, {"_id": 0, "name": 1})
        product_name = product.get("name") if product else None
    elif auction_id:
        auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "product_id": 1})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "name": 1})
            product_name = product.get("name") if product else None
    
    alert = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": product_id,
        "auction_id": auction_id,
        "product_name": product_name,
        "target_price": target_price,
        "notify_telegram": notify_telegram,
        "notify_email": notify_email,
        "notify_push": notify_push,
        "is_active": True,
        "triggered": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.price_alerts.insert_one(alert)
    
    logger.info(f"Price alert created: {user['id']} - {product_name} at €{target_price}")
    
    return {
        "message": f"Alarm erstellt! Du wirst benachrichtigt wenn der Preis unter €{target_price} fällt.",
        "alert_id": alert["id"]
    }

@router.delete("/{alert_id}")
async def delete_price_alert(alert_id: str, user: dict = Depends(get_current_user)):
    """Delete a price alert"""
    result = await db.price_alerts.delete_one({
        "id": alert_id,
        "user_id": user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alarm nicht gefunden")
    
    return {"message": "Alarm gelöscht"}

@router.put("/{alert_id}")
async def update_price_alert(
    alert_id: str,
    target_price: Optional[float] = None,
    is_active: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Update a price alert"""
    update = {}
    if target_price is not None:
        update["target_price"] = target_price
    if is_active is not None:
        update["is_active"] = is_active
    
    if not update:
        raise HTTPException(status_code=400, detail="Keine Änderungen")
    
    result = await db.price_alerts.update_one(
        {"id": alert_id, "user_id": user["id"]},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alarm nicht gefunden")
    
    return {"message": "Alarm aktualisiert"}

# ==================== ALERT CHECKING ====================

async def check_price_alerts(auction_id: str, current_price: float):
    """Check if any price alerts should be triggered for this auction"""
    # Find alerts for this auction or its product
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "product_id": 1})
    if not auction:
        return
    
    product_id = auction.get("product_id")
    
    alerts = await db.price_alerts.find({
        "$or": [
            {"auction_id": auction_id},
            {"product_id": product_id}
        ],
        "is_active": True,
        "triggered": False,
        "target_price": {"$gte": current_price}
    }).to_list(1000)
    
    for alert in alerts:
        await trigger_price_alert(alert, auction_id, current_price)

async def trigger_price_alert(alert: dict, auction_id: str, current_price: float):
    """Trigger a price alert and notify user"""
    user_id = alert["user_id"]
    product_name = alert.get("product_name", "Auktion")
    
    # Mark as triggered
    await db.price_alerts.update_one(
        {"id": alert["id"]},
        {"$set": {
            "triggered": True,
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "triggered_price": current_price
        }}
    )
    
    # Send notifications based on preferences
    if alert.get("notify_push", True):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "price_alert",
            "title": f"🔔 Schnäppchen-Alarm!",
            "message": f"{product_name} ist jetzt unter €{alert['target_price']:.2f}! Aktuell: €{current_price:.2f}",
            "action_url": f"/auctions/{auction_id}",
            "read": False,
            "priority": "high",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if alert.get("notify_telegram", True):
        try:
            from routers.telegram import send_auction_alert
            await send_auction_alert(user_id, "price_alert", {
                "product_name": product_name,
                "target_price": alert["target_price"],
                "current_price": current_price,
                "url": f"https://bidblitz.de/auctions/{auction_id}"
            })
        except Exception as e:
            logger.error(f"Telegram alert error: {e}")
    
    logger.info(f"Price alert triggered: {user_id} - {product_name} at €{current_price}")

__all__ = ['check_price_alerts']
