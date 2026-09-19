"""
BidBlitz V2 - Food Order Live Tracking
Wolt-inspired live tracking system with real-time driver location, status updates, chat, and tipping.

Features:
- Live countdown timer
- Real-time driver location on map
- Order status flow (preparing → on_way → nearby → delivered)
- In-app chat (driver + support)
- Post-delivery tipping (up to 24h, card only)
- Push notifications for status changes
"""
import secrets
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from routes.web_push import send_push_to_user
from routes.email_service import notify_taxi_confirmed

router = APIRouter(prefix="/api/food", tags=["food-tracking"])


# ═══════════════════════════════════════════════════════════════
# ORDER STATUS FLOW
# ═══════════════════════════════════════════════════════════════

ORDER_STATUSES = {
    "pending": {
        "label": "Bestellung eingegangen",
        "description": "Wir haben deine Bestellung erhalten",
        "icon": "📋",
        "next": "preparing",
    },
    "preparing": {
        "label": "Wird vorbereitet",
        "description": "Das Restaurant bereitet deine Bestellung vor",
        "icon": "👨‍🍳",
        "next": "ready_for_pickup",
    },
    "ready_for_pickup": {
        "label": "Bereit zur Abholung",
        "description": "Warten auf Fahrer",
        "icon": "📦",
        "next": "picked_up",
    },
    "picked_up": {
        "label": "Unterwegs",
        "description": "Dein Fahrer ist auf dem Weg zu dir",
        "icon": "🚗",
        "next": "nearby",
    },
    "nearby": {
        "label": "Fast da!",
        "description": "Dein Fahrer ist gleich da",
        "icon": "📍",
        "next": "delivered",
    },
    "delivered": {
        "label": "Geliefert",
        "description": "Guten Appetit!",
        "icon": "✅",
        "next": None,
    },
    "cancelled": {
        "label": "Storniert",
        "description": "Bestellung wurde storniert",
        "icon": "❌",
        "next": None,
    },
}


# ═══════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════

class DriverLocationUpdate(BaseModel):
    order_id: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    heading: Optional[float] = Field(None, ge=0, lt=360)  # Direction in degrees


class AddTipRequest(BaseModel):
    order_id: str
    amount: float = Field(..., gt=0, le=50)
    message: Optional[str] = Field(None, max_length=200)
    idempotency_key: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    order_id: str
    status: str


# ═══════════════════════════════════════════════════════════════
# LIVE TRACKING ENDPOINT
# ═══════════════════════════════════════════════════════════════

@router.get("/orders/{order_id}/track")
async def get_order_tracking(order_id: str, request: Request):
    """
    Get live tracking data for an order.
    Returns: countdown, driver location, status, ETA, chat info.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find order
    order = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify user owns this order
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # Get current status info
    status = order.get("status", "pending")
    status_info = ORDER_STATUSES.get(status, ORDER_STATUSES["pending"])
    
    # Calculate ETA and countdown
    now = datetime.now(timezone.utc)
    estimated_delivery = order.get("estimated_delivery_at")
    countdown_seconds = 0
    eta_formatted = "Berechnung läuft..."
    
    if estimated_delivery:
        try:
            eta_dt = datetime.fromisoformat(estimated_delivery.replace("Z", "+00:00"))
            if eta_dt.tzinfo is None:
                eta_dt = eta_dt.replace(tzinfo=timezone.utc)
            countdown_seconds = max(0, int((eta_dt - now).total_seconds()))
            eta_formatted = eta_dt.strftime("%H:%M")
        except Exception:
            pass
    
    # Get driver info (if assigned)
    driver_info = None
    driver_location = None
    if order.get("driver_id"):
        driver = await db.users.find_one(
            {"_id": ObjectId(order["driver_id"])},
            {"_id": 0, "name": 1, "email": 1, "driver_photo_url": 1, "driver_vehicle": 1}
        )
        if driver:
            driver_info = {
                "id": order["driver_id"],
                "name": driver.get("name", "Fahrer"),
                "photo_url": driver.get("driver_photo_url", ""),
                "vehicle": driver.get("driver_vehicle", ""),
            }
        
        # Get latest driver location
        driver_location = await db.driver_locations.find_one(
            {"order_id": order_id},
            {"_id": 0},
            sort=[("updated_at", -1)]
        )
    
    # Get restaurant info
    restaurant = await db.food_restaurants.find_one(
        {"restaurant_id": order.get("restaurant_id")},
        {"_id": 0, "name": 1, "location": 1, "photo_url": 1}
    )
    
    # Get user's delivery address
    delivery_address = order.get("delivery_address", {})
    
    # Check if tip was already added
    existing_tip = await db.food_tips.find_one({"order_id": order_id, "user_id": user_id})
    
    # Check if order is eligible for tipping (delivered within 24h, paid by card)
    can_tip = False
    if status == "delivered" and not existing_tip:
        delivered_at = order.get("delivered_at")
        payment_method = order.get("payment_method", "")
        if delivered_at and "card" in payment_method.lower():
            try:
                delivered_dt = datetime.fromisoformat(delivered_at.replace("Z", "+00:00"))
                if delivered_dt.tzinfo is None:
                    delivered_dt = delivered_dt.replace(tzinfo=timezone.utc)
                hours_since = (now - delivered_dt).total_seconds() / 3600
                can_tip = hours_since <= 24
            except Exception:
                pass
    
    return {
        "order_id": order_id,
        "status": status,
        "status_info": status_info,
        "countdown_seconds": countdown_seconds,
        "estimated_delivery_time": eta_formatted,
        "estimated_delivery_at": estimated_delivery,
        "driver": driver_info,
        "driver_location": driver_location,
        "restaurant": restaurant,
        "delivery_address": delivery_address,
        "items": order.get("items", []),
        "total_price": order.get("total_price", 0),
        "can_tip": can_tip,
        "tip_amount": existing_tip.get("amount") if existing_tip else None,
        "created_at": order.get("created_at"),
    }


# ═══════════════════════════════════════════════════════════════
# DRIVER LOCATION UPDATE (for Driver App)
# ═══════════════════════════════════════════════════════════════

@router.post("/orders/{order_id}/driver-location")
async def update_driver_location(order_id: str, loc: DriverLocationUpdate, request: Request):
    """
    Driver app updates their GPS location.
    Called every 30-60 seconds while order is active.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Verify user is assigned driver for this order
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("driver_id") != user_id:
        raise HTTPException(status_code=403, detail="Not assigned to this order")
    
    now = datetime.now(timezone.utc)
    
    # Update location
    await db.driver_locations.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "driver_id": user_id,
                "lat": loc.lat,
                "lng": loc.lng,
                "heading": loc.heading,
                "updated_at": now.isoformat(),
            },
        },
        upsert=True,
    )
    
    # Calculate distance to customer
    delivery_loc = order.get("delivery_address", {}).get("location", {})
    customer_lat = delivery_loc.get("lat")
    customer_lng = delivery_loc.get("lng")
    
    distance_km = None
    if customer_lat and customer_lng:
        # Haversine formula for distance
        from math import radians, sin, cos, sqrt, atan2
        R = 6371  # Earth radius in km
        
        lat1, lng1 = radians(loc.lat), radians(loc.lng)
        lat2, lng2 = radians(customer_lat), radians(customer_lng)
        
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance_km = R * c
        
        # If driver is within 500m, trigger "nearby" status
        if distance_km < 0.5 and order.get("status") == "picked_up":
            await update_order_status_internal(order_id, "nearby", user_id)
            
            # Send push: "Dein Fahrer ist gleich da!"
            try:
                asyncio.create_task(send_push_to_user(
                    order["user_id"],
                    title="🚗 Fast da!",
                    body=f"Dein Fahrer ist nur noch {int(distance_km * 1000)}m entfernt",
                    data={"type": "order_nearby", "order_id": order_id},
                ))
            except Exception:
                pass
    
    return {
        "ok": True,
        "distance_to_customer_km": round(distance_km, 2) if distance_km else None,
    }


# ═══════════════════════════════════════════════════════════════
# STATUS UPDATE
# ═══════════════════════════════════════════════════════════════

async def update_order_status_internal(order_id: str, new_status: str, actor_id: str):
    """Internal function to update order status and send notifications."""
    if new_status not in ORDER_STATUSES:
        return
    
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        return
    
    old_status = order.get("status", "pending")
    if old_status == new_status:
        return
    
    now = datetime.now(timezone.utc)
    
    if new_status == "delivered":
        from routes.food import _settle_food_delivery
        await _settle_food_delivery(order_id)
    else:
        update_data = {
            "status": new_status,
            "updated_at": now.isoformat(),
        }
        await db.food_orders.update_one(
            {"order_id": order_id, "status": old_status},
            {"$set": update_data},
        )
    
    # Log status change
    await db.food_order_status_log.insert_one({
        "order_id": order_id,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by": actor_id,
        "created_at": now.isoformat(),
    })
    
    # Send push notification to customer
    status_info = ORDER_STATUSES[new_status]
    try:
        asyncio.create_task(send_push_to_user(
            order["user_id"],
            title=f"{status_info['icon']} {status_info['label']}",
            body=status_info["description"],
            data={"type": "order_status_change", "order_id": order_id, "status": new_status},
        ))
    except Exception:
        pass
    
    return True


@router.post("/orders/update-status")
async def update_order_status(req: UpdateStatusRequest, request: Request):
    """
    Update order status (Driver/Restaurant/Admin only).
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    role = user.get("role", "")
    
    order = await db.food_orders.find_one({"order_id": req.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Permission check against canonical Food ownership fields.
    is_driver = (order.get("courier") or {}).get("user_id") == user_id
    restaurant = await db.food_restaurants.find_one(
        {"restaurant_id": order.get("restaurant_id")},
        {"_id": 0, "owner_id": 1, "user_id": 1},
    )
    is_restaurant = user_id in {
        str((restaurant or {}).get("owner_id") or ""),
        str((restaurant or {}).get("user_id") or ""),
    }
    is_admin = role in {"admin", "super_admin"}
    
    if not (is_driver or is_restaurant or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")

    old_status = order.get("status")
    allowed_transitions = {
        "pending": {"preparing"},
        "confirmed": {"preparing"},
        "preparing": {"ready"},
        "picked_up": {"nearby", "delivered"},
        "nearby": {"delivered"},
    }
    if req.status not in allowed_transitions.get(old_status, set()):
        if old_status == req.status:
            return {"ok": True, "new_status": req.status, "replayed": True}
        raise HTTPException(status_code=409, detail=f"Ungültiger Statuswechsel: {old_status} → {req.status}")

    if req.status in {"preparing", "ready"} and not (is_restaurant or is_admin):
        raise HTTPException(status_code=403, detail="Nur Restaurant/Admin darf diesen Status setzen")
    if req.status in {"nearby", "delivered"} and not (is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Nur Fahrer/Admin darf diesen Status setzen")
    
    await update_order_status_internal(req.order_id, req.status, user_id)
    return {"ok": True, "new_status": req.status, "replayed": False}


# ═══════════════════════════════════════════════════════════════
# TIPPING SYSTEM
# ═══════════════════════════════════════════════════════════════

@router.post("/orders/{order_id}/tip")
async def add_tip(order_id: str, tip_req: AddTipRequest, request: Request):
    """Send one post-delivery wallet tip directly to the assigned courier."""
    from core.payment_engine import transfer_between_wallets, TransactionType
    import hashlib

    user = await get_current_user(request)
    user_id = str(user["_id"])
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order or order.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Order not delivered yet")

    delivered_at = order.get("delivered_at")
    if not delivered_at:
        raise HTTPException(status_code=400, detail="Delivery time unknown")
    try:
        delivered_dt = datetime.fromisoformat(str(delivered_at).replace("Z", "+00:00"))
        if delivered_dt.tzinfo is None:
            delivered_dt = delivered_dt.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - delivered_dt).total_seconds() > 24 * 3600:
            raise HTTPException(status_code=400, detail="Tipping period expired (24h limit)")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid delivery timestamp")

    courier_id = str((order.get("courier") or {}).get("user_id") or "")
    if not courier_id:
        raise HTTPException(status_code=400, detail="Für diese Bestellung ist kein Fahrer zugeordnet")

    raw_key = (tip_req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    idempotency_key = f"food-tip:{user_id}:{order_id}:{raw_key}"
    tip_id = f"TIP-{hashlib.sha256(idempotency_key.encode('utf-8')).hexdigest()[:20]}"

    existing = await db.food_tips.find_one({"order_id": order_id, "user_id": user_id}, {"_id": 0})
    if existing:
        if existing.get("idempotency_key") == idempotency_key:
            fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "tip_amount": float(existing.get("amount") or 0),
                "new_balance": round(float(fresh_user.get("balance") or 0), 2),
                "replayed": True,
            }
        raise HTTPException(status_code=400, detail="Tip already added")

    amount = round(float(tip_req.amount), 2)
    result = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=courier_id,
        amount=amount,
        tx_type=TransactionType.TRANSFER,
        description=f"Trinkgeld für Food-Fahrer ({order_id})",
        reference=tip_id,
        metadata={"order_id": order_id, "kind": "food_tip"},
        idempotency_key=idempotency_key,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error or "Trinkgeld konnte nicht gesendet werden")

    now = datetime.now(timezone.utc)
    tip_doc = {
        "tip_id": tip_id,
        "order_id": order_id,
        "user_id": user_id,
        "driver_id": courier_id,
        "amount": amount,
        "message": tip_req.message,
        "idempotency_key": idempotency_key,
        "wallet_transaction_id": result.transaction_id,
        "created_at": now.isoformat(),
    }
    await db.food_tips.update_one(
        {"order_id": order_id, "user_id": user_id},
        {"$setOnInsert": tip_doc},
        upsert=True,
    )

    try:
        asyncio.create_task(send_push_to_user(
            courier_id,
            title="💰 Trinkgeld erhalten!",
            body=f"€{amount:.2f} Trinkgeld von {user.get('name', 'Kunde')}",
            data={"type": "tip_received", "order_id": order_id, "amount": amount},
        ))
    except Exception:
        pass

    return {
        "ok": True,
        "tip_amount": amount,
        "new_balance": result.new_balance,
        "replayed": bool(result.idempotent_replay),
    }


@router.get("/orders/{order_id}/tip-status")
async def get_tip_status(order_id: str, request: Request):
    """Check if tip was added and if tipping is still available."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order or order.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Order not found")
    
    tip = await db.food_tips.find_one({"order_id": order_id, "user_id": user_id})
    
    can_tip = False
    hours_remaining = 0
    
    if order.get("status") == "delivered" and not tip:
        delivered_at = order.get("delivered_at")
        payment_method = order.get("payment_method", "")
        if delivered_at and "card" in payment_method.lower():
            try:
                now = datetime.now(timezone.utc)
                delivered_dt = datetime.fromisoformat(delivered_at.replace("Z", "+00:00"))
                if delivered_dt.tzinfo is None:
                    delivered_dt = delivered_dt.replace(tzinfo=timezone.utc)
                hours_since = (now - delivered_dt).total_seconds() / 3600
                if hours_since <= 24:
                    can_tip = True
                    hours_remaining = 24 - hours_since
            except Exception:
                pass
    
    return {
        "can_tip": can_tip,
        "tip_added": bool(tip),
        "tip_amount": tip.get("amount") if tip else None,
        "hours_remaining": round(hours_remaining, 1) if can_tip else 0,
    }


# ═══════════════════════════════════════════════════════════════
# CHAT INTEGRATION
# ═══════════════════════════════════════════════════════════════

@router.post("/orders/{order_id}/start-chat")
async def start_order_chat(order_id: str, request: Request):
    """
    Start chat with driver or support for this order.
    Returns existing chat_id or creates new one.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    body = await request.json()
    chat_type = body.get("type", "driver")  # "driver" or "support"
    
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    if chat_type == "driver":
        driver_id = order.get("driver_id")
        if not driver_id:
            raise HTTPException(status_code=400, detail="No driver assigned yet")
        
        # Check if chat already exists
        existing_chat = await db.chats.find_one({
            "$or": [
                {"user1_id": user_id, "user2_id": driver_id, "context": f"food_order:{order_id}"},
                {"user1_id": driver_id, "user2_id": user_id, "context": f"food_order:{order_id}"},
            ]
        })
        
        if existing_chat:
            return {"chat_id": existing_chat["chat_id"], "created": False}
        
        # Create new chat
        driver = await db.users.find_one({"_id": ObjectId(driver_id)})
        chat_id = secrets.token_hex(8)
        
        await db.chats.insert_one({
            "chat_id": chat_id,
            "user1_id": user_id,
            "user1_name": user.get("name", ""),
            "user2_id": driver_id,
            "user2_name": driver.get("name", "Fahrer"),
            "context": f"food_order:{order_id}",
            "context_title": f"Bestellung #{order_id[:8]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"chat_id": chat_id, "created": True}
    
    elif chat_type == "support":
        # Find admin/support user
        support_user = await db.users.find_one({"role": "admin"}, {"_id": 1})
        if not support_user:
            raise HTTPException(status_code=500, detail="Support not available")
        
        support_id = str(support_user["_id"])
        
        # Check existing chat
        existing_chat = await db.chats.find_one({
            "$or": [
                {"user1_id": user_id, "user2_id": support_id, "context": f"food_support:{order_id}"},
                {"user1_id": support_id, "user2_id": user_id, "context": f"food_support:{order_id}"},
            ]
        })
        
        if existing_chat:
            return {"chat_id": existing_chat["chat_id"], "created": False}
        
        # Create support chat
        chat_id = secrets.token_hex(8)
        await db.chats.insert_one({
            "chat_id": chat_id,
            "user1_id": user_id,
            "user1_name": user.get("name", ""),
            "user2_id": support_id,
            "user2_name": "BidBlitz Support",
            "context": f"food_support:{order_id}",
            "context_title": f"Support: Bestellung #{order_id[:8]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"chat_id": chat_id, "created": True, "support": True}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid chat type")
