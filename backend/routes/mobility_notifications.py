"""
BidBlitz V2 - Mobility Notifications System
Real-time notifications for Taxi, Scooter, and Food modules.
"""

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/mobility/notifications", tags=["Mobility Notifications"])

# Notification types
NOTIFICATION_TYPES = {
    # Taxi
    "taxi_ride_requested": {"icon": "🚕", "title": "Neue Fahrtanfrage", "category": "taxi"},
    "taxi_ride_accepted": {"icon": "✅", "title": "Fahrer gefunden", "category": "taxi"},
    "taxi_driver_arriving": {"icon": "🚗", "title": "Fahrer kommt", "category": "taxi"},
    "taxi_ride_started": {"icon": "🛣️", "title": "Fahrt gestartet", "category": "taxi"},
    "taxi_ride_completed": {"icon": "🏁", "title": "Fahrt abgeschlossen", "category": "taxi"},
    "taxi_ride_cancelled": {"icon": "❌", "title": "Fahrt storniert", "category": "taxi"},
    
    # Scooter
    "scooter_unlocked": {"icon": "🔓", "title": "Scooter entsperrt", "category": "scooter"},
    "scooter_ride_ended": {"icon": "🛴", "title": "Fahrt beendet", "category": "scooter"},
    "scooter_low_battery": {"icon": "🔋", "title": "Niedriger Akkustand", "category": "scooter"},
    
    # Food
    "food_order_placed": {"icon": "📝", "title": "Bestellung aufgegeben", "category": "food"},
    "food_order_accepted": {"icon": "✅", "title": "Bestellung bestätigt", "category": "food"},
    "food_order_preparing": {"icon": "👨‍🍳", "title": "Wird zubereitet", "category": "food"},
    "food_order_picked_up": {"icon": "🛵", "title": "Fahrer unterwegs", "category": "food"},
    "food_order_delivered": {"icon": "📦", "title": "Geliefert", "category": "food"},
    "food_order_cancelled": {"icon": "❌", "title": "Bestellung storniert", "category": "food"},
    
    # Driver/Delivery
    "driver_new_request": {"icon": "🔔", "title": "Neue Anfrage", "category": "driver"},
    "driver_ride_cancelled": {"icon": "❌", "title": "Fahrt storniert", "category": "driver"},
    "delivery_new_order": {"icon": "🔔", "title": "Neue Lieferung", "category": "delivery"},
    "delivery_order_cancelled": {"icon": "❌", "title": "Lieferung storniert", "category": "delivery"},
    
    # Merchant
    "merchant_new_order": {"icon": "🔔", "title": "Neue Bestellung", "category": "merchant"},
    "merchant_order_cancelled": {"icon": "❌", "title": "Bestellung storniert", "category": "merchant"},
    
    # Payment
    "payment_success": {"icon": "💰", "title": "Zahlung erfolgreich", "category": "payment"},
    "payment_failed": {"icon": "⚠️", "title": "Zahlung fehlgeschlagen", "category": "payment"},
    "earning_credited": {"icon": "💵", "title": "Verdienst gutgeschrieben", "category": "payment"},
}


async def create_notification(
    user_id: str,
    notification_type: str,
    message: str,
    data: dict = None,
    reference_id: str = None,
    reference_type: str = None,
):
    """Create a new notification for a user."""
    ntype = NOTIFICATION_TYPES.get(notification_type, {})
    
    notification = {
        "notification_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": notification_type,
        "category": ntype.get("category", "general"),
        "icon": ntype.get("icon", "🔔"),
        "title": ntype.get("title", "Benachrichtigung"),
        "message": message,
        "data": data or {},
        "reference_id": reference_id,
        "reference_type": reference_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.mobility_notifications.insert_one(notification)
    notification.pop("_id", None)
    
    return notification


# ══════════════════════════════════════
# TRIGGER FUNCTIONS (Called by other modules)
# ══════════════════════════════════════

async def notify_taxi_status(ride: dict, status: str):
    """Send notification for taxi status change."""
    user_id = ride.get("user_id")
    ride_id = ride.get("ride_id")
    driver_name = ride.get("driver", {}).get("name", "Fahrer")
    
    messages = {
        "accepted": f"{driver_name} hat deine Fahrt angenommen",
        "arriving": f"{driver_name} kommt in ca. {ride.get('driver', {}).get('eta_minutes', 5)} Min",
        "started": "Deine Fahrt hat begonnen. Gute Reise!",
        "completed": f"Fahrt abgeschlossen. €{ride.get('final_fare', ride.get('fare_estimate', 0)):.2f}",
        "cancelled": "Deine Fahrt wurde storniert",
    }
    
    ntype = f"taxi_ride_{status}" if status != "arriving" else "taxi_driver_arriving"
    
    if user_id and status in messages:
        await create_notification(
            user_id=user_id,
            notification_type=ntype,
            message=messages[status],
            reference_id=ride_id,
            reference_type="taxi_ride",
            data={"ride_id": ride_id, "status": status}
        )


async def notify_scooter_event(rental: dict, event: str):
    """Send notification for scooter events."""
    user_id = rental.get("user_id")
    rental_id = rental.get("rental_id")
    
    messages = {
        "unlocked": f"Scooter {rental.get('scooter_id')} entsperrt. Gute Fahrt!",
        "ended": f"Fahrt beendet. Gesamt: €{rental.get('total_cost', 0):.2f}",
    }
    
    ntype = f"scooter_{event}" if event != "ended" else "scooter_ride_ended"
    
    if user_id and event in messages:
        await create_notification(
            user_id=user_id,
            notification_type=ntype,
            message=messages[event],
            reference_id=rental_id,
            reference_type="scooter_rental",
            data={"rental_id": rental_id}
        )


async def notify_food_status(order: dict, status: str):
    """Send notification for food order status change."""
    user_id = order.get("user_id")
    order_id = order.get("order_id")
    restaurant = order.get("restaurant_name", "Restaurant")
    courier = order.get("courier", {}).get("name", "Fahrer")
    
    messages = {
        "confirmed": f"{restaurant} hat deine Bestellung bestätigt",
        "preparing": "Dein Essen wird jetzt zubereitet",
        "picked_up": f"{courier} hat dein Essen abgeholt und ist unterwegs",
        "delivered": "Guten Appetit! Deine Bestellung wurde geliefert",
        "cancelled": "Deine Bestellung wurde storniert",
    }
    
    ntype = f"food_order_{status}"
    
    if user_id and status in messages:
        await create_notification(
            user_id=user_id,
            notification_type=ntype,
            message=messages[status],
            reference_id=order_id,
            reference_type="food_order",
            data={"order_id": order_id, "status": status}
        )


async def notify_driver_new_request(driver_id: str, ride: dict):
    """Notify driver of new ride request."""
    await create_notification(
        user_id=driver_id,
        notification_type="driver_new_request",
        message=f"Neue Fahrt: {ride.get('pickup', {}).get('address', 'Startpunkt')[:30]}",
        reference_id=ride.get("ride_id"),
        reference_type="taxi_ride",
        data={"ride_id": ride.get("ride_id"), "fare": ride.get("fare_estimate")}
    )


async def notify_merchant_new_order(merchant_id: str, order: dict):
    """Notify merchant of new food order."""
    await create_notification(
        user_id=merchant_id,
        notification_type="merchant_new_order",
        message=f"Neue Bestellung: {len(order.get('items', []))} Artikel • €{order.get('total', 0):.2f}",
        reference_id=order.get("order_id"),
        reference_type="food_order",
        data={"order_id": order.get("order_id")}
    )


async def notify_payment(user_id: str, success: bool, amount: float, category: str, reference_id: str = None):
    """Notify user of payment result."""
    await create_notification(
        user_id=user_id,
        notification_type="payment_success" if success else "payment_failed",
        message=f"Zahlung von €{amount:.2f} {'erfolgreich' if success else 'fehlgeschlagen'}",
        reference_id=reference_id,
        reference_type=category,
        data={"amount": amount, "success": success}
    )


async def notify_earning(user_id: str, amount: float, source: str, reference_id: str = None):
    """Notify driver/merchant of credited earning."""
    await create_notification(
        user_id=user_id,
        notification_type="earning_credited",
        message=f"€{amount:.2f} Verdienst aus {source} gutgeschrieben",
        reference_id=reference_id,
        reference_type=source,
        data={"amount": amount, "source": source}
    )


# ══════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════

@router.get("/list")
async def get_notifications(request: Request, category: str = "", unread_only: bool = False, limit: int = 50):
    """Get user's mobility notifications."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if category:
        query["category"] = category
    if unread_only:
        query["read"] = False
    
    notifications = await db.mobility_notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.mobility_notifications.count_documents({"user_id": user_id, "read": False})
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
    }


@router.post("/mark-read")
async def mark_notifications_read(request: Request):
    """Mark notifications as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    
    notification_ids = body.get("notification_ids", [])
    mark_all = body.get("mark_all", False)
    
    if mark_all:
        await db.mobility_notifications.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif notification_ids:
        await db.mobility_notifications.update_many(
            {"user_id": user_id, "notification_id": {"$in": notification_ids}},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"ok": True}


@router.get("/unread-count")
async def get_unread_count(request: Request):
    """Get unread notification count by category."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    pipeline = [
        {"$match": {"user_id": user_id, "read": False}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    
    results = await db.mobility_notifications.aggregate(pipeline).to_list(100)
    
    counts = {r["_id"]: r["count"] for r in results}
    total = sum(counts.values())
    
    return {
        "total": total,
        "by_category": counts,
    }


@router.delete("/clear")
async def clear_notifications(request: Request, category: str = ""):
    """Clear notifications."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if category:
        query["category"] = category
    
    result = await db.mobility_notifications.delete_many(query)
    
    return {"ok": True, "deleted": result.deleted_count}
