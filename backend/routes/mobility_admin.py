"""
BidBlitz V2 - Mobility Admin Control Center
Complete admin management for Taxi, Scooter, and Food modules.
"""

import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/mobility/admin", tags=["Mobility Admin"])

# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class ScooterCreate(BaseModel):
    scooter_id: Optional[str] = None
    model: str = "BidBlitz S1"
    battery_percent: int = 100
    city: str = "berlin"
    location: dict = {"lat": 52.52, "lng": 13.405}


class PricingUpdate(BaseModel):
    module: str  # taxi, scooter, food
    pricing: dict


class RoleApproval(BaseModel):
    user_id: str
    role: str
    decision: str  # approve, reject
    reason: Optional[str] = ""


# ══════════════════════════════════════
# OVERVIEW DASHBOARD
# ══════════════════════════════════════

@router.get("/overview")
async def get_mobility_overview(request: Request):
    """Get overview stats for all mobility modules."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    
    # Taxi stats
    taxi_total = await db.taxi_rides.count_documents({})
    taxi_active = await db.taxi_rides.count_documents({"status": {"$in": ["requested", "accepted", "arriving", "started"]}})
    taxi_today = await db.taxi_rides.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    taxi_completed = await db.taxi_rides.count_documents({"status": "completed"})
    
    # Scooter stats
    scooter_total_rides = await db.scooter_rentals.count_documents({})
    scooter_active = await db.scooter_rentals.count_documents({"status": {"$in": ["reserved", "active", "paused"]}})
    scooter_fleet = await db.scooters.count_documents({})
    scooter_available = await db.scooters.count_documents({"status": "available"})
    scooter_in_use = await db.scooters.count_documents({"status": "in_use"})
    
    # Food stats
    food_total = await db.food_orders.count_documents({})
    food_active = await db.food_orders.count_documents({"status": {"$nin": ["delivered", "cancelled"]}})
    food_today = await db.food_orders.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    restaurants_total = await db.food_restaurants.count_documents({})
    restaurants_open = await db.food_restaurants.count_documents({"is_open": True})
    
    # Revenue (from platform_revenue collection)
    revenue_pipeline = [
        {"$match": {"created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}}
    ]
    revenue_data = await db.platform_revenue.aggregate(revenue_pipeline).to_list(100)
    revenue_by_category = {r["_id"]: round(r["total"], 2) for r in revenue_data}
    total_revenue = sum(revenue_by_category.values())
    
    # Today's revenue
    today_revenue_pipeline = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    today_revenue_data = await db.platform_revenue.aggregate(today_revenue_pipeline).to_list(1)
    today_revenue = today_revenue_data[0]["total"] if today_revenue_data else 0
    
    # Drivers/Delivery
    drivers_total = await db.users.count_documents({"is_driver": True})
    drivers_online = await db.users.count_documents({"is_driver": True, "driver_status": "online"})
    delivery_total = await db.users.count_documents({"is_delivery_driver": True})
    delivery_online = await db.users.count_documents({"is_delivery_driver": True, "delivery_status": "online"})
    
    # Pending approvals
    pending_drivers = await db.role_requests.count_documents({"requested_role": "driver", "status": "pending"})
    pending_delivery = await db.role_requests.count_documents({"requested_role": "delivery_driver", "status": "pending"})
    pending_restaurants = await db.role_requests.count_documents({"requested_role": "restaurant", "status": "pending"})
    
    # Pending payouts
    pending_payouts = await db.mobility_payouts.count_documents({"status": "pending"})
    pending_payout_amount = 0
    payouts = await db.mobility_payouts.find({"status": "pending"}).to_list(1000)
    pending_payout_amount = sum(p["amount"] for p in payouts)
    
    return {
        "taxi": {
            "total_rides": taxi_total,
            "active_rides": taxi_active,
            "today_rides": taxi_today,
            "completed_rides": taxi_completed,
        },
        "scooter": {
            "total_rides": scooter_total_rides,
            "active_rides": scooter_active,
            "fleet_size": scooter_fleet,
            "available": scooter_available,
            "in_use": scooter_in_use,
        },
        "food": {
            "total_orders": food_total,
            "active_orders": food_active,
            "today_orders": food_today,
            "restaurants": restaurants_total,
            "restaurants_open": restaurants_open,
        },
        "drivers": {
            "taxi_drivers": drivers_total,
            "taxi_online": drivers_online,
            "delivery_drivers": delivery_total,
            "delivery_online": delivery_online,
        },
        "revenue": {
            "total_week": round(total_revenue, 2),
            "today": round(today_revenue, 2),
            "by_category": revenue_by_category,
        },
        "pending": {
            "driver_approvals": pending_drivers,
            "delivery_approvals": pending_delivery,
            "restaurant_approvals": pending_restaurants,
            "payouts": pending_payouts,
            "payout_amount": round(pending_payout_amount, 2),
        },
    }


# ══════════════════════════════════════
# TAXI ADMIN
# ══════════════════════════════════════

@router.get("/taxi/rides")
async def admin_list_taxi_rides(
    request: Request, 
    status: str = "", 
    limit: int = 50,
    date_from: str = ""
):
    """List all taxi rides with filters."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    if date_from:
        query["created_at"] = {"$gte": date_from}
    
    rides = await db.taxi_rides.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"rides": rides, "total": len(rides)}


@router.post("/taxi/cancel")
async def admin_cancel_taxi_ride(request: Request):
    """Admin force cancel a taxi ride."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    ride_id = body.get("ride_id")
    reason = body.get("reason", "Cancelled by admin")
    refund = body.get("refund", True)
    
    ride = await db.taxi_rides.find_one({"ride_id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Ride already finished")
    
    now = datetime.now(timezone.utc)
    
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancelled_by": "admin",
            "cancel_reason": reason,
        }}
    )
    
    # Process refund if ride was started
    if refund and ride.get("fare_estimate"):
        from routes.mobility_payments import process_refund
        await process_refund(
            user_id=ride["user_id"],
            amount=ride["fare_estimate"],
            payment_id=ride_id,
            reason=reason
        )
    
    return {"ok": True, "message": "Ride cancelled"}


@router.get("/taxi/drivers")
async def admin_list_taxi_drivers(request: Request, status: str = ""):
    """List all taxi drivers."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {"is_driver": True}
    if status:
        query["driver_status"] = status
    
    drivers = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).limit(100).to_list(100)
    
    # Get ride counts
    for driver in drivers:
        driver_id = driver.get("id") or str(driver.get("_id", ""))
        count = await db.taxi_rides.count_documents({"driver.driver_id": driver_id, "status": "completed"})
        driver["completed_rides"] = count
    
    return {"drivers": drivers}


@router.post("/taxi/driver/suspend")
async def admin_suspend_driver(request: Request):
    """Suspend a taxi driver."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    driver_id = body.get("driver_id")
    reason = body.get("reason", "")
    
    result = await db.users.update_one(
        {"_id": ObjectId(driver_id)},
        {"$set": {
            "driver_status": "suspended",
            "driver_suspended_at": datetime.now(timezone.utc).isoformat(),
            "driver_suspend_reason": reason,
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {"ok": True, "message": "Driver suspended"}


@router.post("/taxi/driver/activate")
async def admin_activate_driver(request: Request):
    """Activate/reactivate a driver."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    driver_id = body.get("driver_id")
    
    await db.users.update_one(
        {"_id": ObjectId(driver_id)},
        {"$set": {"driver_status": "offline"}, "$unset": {"driver_suspended_at": "", "driver_suspend_reason": ""}}
    )
    
    return {"ok": True, "message": "Driver activated"}


# ══════════════════════════════════════
# SCOOTER ADMIN
# ══════════════════════════════════════

@router.get("/scooter/fleet")
async def admin_list_scooters(request: Request, status: str = "", city: str = ""):
    """List all scooters in fleet."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    if city:
        query["city"] = city
    
    scooters = await db.scooters.find(query, {"_id": 0}).limit(200).to_list(200)
    
    return {"scooters": scooters, "total": len(scooters)}


@router.post("/scooter/add")
async def admin_add_scooter(req: ScooterCreate, request: Request):
    """Add a new scooter to fleet."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    scooter_id = req.scooter_id or f"SC-{secrets.token_hex(4).upper()}"
    
    # Check if exists
    existing = await db.scooters.find_one({"scooter_id": scooter_id})
    if existing:
        raise HTTPException(status_code=400, detail="Scooter ID already exists")
    
    scooter = {
        "scooter_id": scooter_id,
        "model": req.model,
        "battery_percent": req.battery_percent,
        "city": req.city,
        "location": req.location,
        "status": "available",
        "max_speed": 20,
        "range_km": 25,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.scooters.insert_one(scooter)
    scooter.pop("_id", None)
    
    return {"ok": True, "scooter": scooter}


@router.post("/scooter/update")
async def admin_update_scooter(request: Request):
    """Update scooter status/info."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    scooter_id = body.get("scooter_id")
    updates = body.get("updates", {})
    
    allowed_fields = ["status", "battery_percent", "location", "city", "model"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.scooters.update_one(
        {"scooter_id": scooter_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scooter not found")
    
    return {"ok": True, "message": "Scooter updated"}


@router.delete("/scooter/{scooter_id}")
async def admin_remove_scooter(scooter_id: str, request: Request):
    """Remove a scooter from fleet."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Check if in use
    scooter = await db.scooters.find_one({"scooter_id": scooter_id})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter not found")
    
    if scooter.get("status") == "in_use":
        raise HTTPException(status_code=400, detail="Cannot remove scooter in use")
    
    await db.scooters.delete_one({"scooter_id": scooter_id})
    
    return {"ok": True, "message": "Scooter removed"}


@router.post("/scooter/disable")
async def admin_disable_scooter(request: Request):
    """Disable a broken scooter."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    scooter_id = body.get("scooter_id")
    reason = body.get("reason", "Maintenance required")
    
    await db.scooters.update_one(
        {"scooter_id": scooter_id},
        {"$set": {
            "status": "offline",
            "disabled_at": datetime.now(timezone.utc).isoformat(),
            "disable_reason": reason,
        }}
    )
    
    return {"ok": True, "message": "Scooter disabled"}


@router.get("/scooter/rentals")
async def admin_list_scooter_rentals(request: Request, status: str = "", limit: int = 50):
    """List scooter rentals."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    rentals = await db.scooter_rentals.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"rentals": rentals}


# ══════════════════════════════════════
# FOOD ADMIN
# ══════════════════════════════════════

@router.get("/food/restaurants")
async def admin_list_restaurants(request: Request, status: str = ""):
    """List all restaurants."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status == "open":
        query["is_open"] = True
    elif status == "closed":
        query["is_open"] = False
    
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).limit(100).to_list(100)
    
    # Get order counts
    for rest in restaurants:
        count = await db.food_orders.count_documents({"restaurant_id": rest.get("restaurant_id")})
        rest["total_orders"] = count
    
    return {"restaurants": restaurants}


@router.post("/food/restaurant/toggle")
async def admin_toggle_restaurant(request: Request):
    """Toggle restaurant open/closed status."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    restaurant_id = body.get("restaurant_id")
    is_open = body.get("is_open", True)
    
    await db.food_restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$set": {"is_open": is_open}}
    )
    
    return {"ok": True, "message": f"Restaurant {'opened' if is_open else 'closed'}"}


@router.get("/food/orders")
async def admin_list_food_orders(request: Request, status: str = "", limit: int = 50):
    """List food orders."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.food_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"orders": orders}


@router.post("/food/order/cancel")
async def admin_cancel_food_order(request: Request):
    """Admin cancel a food order with refund."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    order_id = body.get("order_id")
    reason = body.get("reason", "Cancelled by admin")
    refund = body.get("refund", True)
    
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "delivered":
        raise HTTPException(status_code=400, detail="Cannot cancel delivered order")
    
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": "admin",
            "cancel_reason": reason,
        }}
    )
    
    if refund and order.get("total"):
        from routes.mobility_payments import process_refund
        await process_refund(
            user_id=order["user_id"],
            amount=order["total"],
            payment_id=order_id,
            reason=reason
        )
    
    return {"ok": True, "message": "Order cancelled and refunded" if refund else "Order cancelled"}


@router.get("/food/delivery-drivers")
async def admin_list_delivery_drivers(request: Request):
    """List delivery drivers."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    drivers = await db.users.find(
        {"is_delivery_driver": True},
        {"_id": 0, "password_hash": 0}
    ).limit(100).to_list(100)
    
    return {"drivers": drivers}


# ══════════════════════════════════════
# PRICING CONTROLS
# ══════════════════════════════════════

@router.get("/pricing")
async def admin_get_pricing(request: Request):
    """Get all pricing configurations."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get from config collection or return defaults
    taxi_config = await db.mobility_config.find_one({"key": "pricing_taxi"}) or {}
    scooter_config = await db.mobility_config.find_one({"key": "pricing_scooter"}) or {}
    food_config = await db.mobility_config.find_one({"key": "pricing_food"}) or {}
    
    return {
        "taxi": taxi_config.get("value", {
            "base_fare": 2.50,
            "per_km": 1.20,
            "per_min": 0.25,
            "min_fare": 5.00,
            "cancellation_fee": 3.00,
            "surge_high": 1.5,
            "surge_peak": 2.0,
        }),
        "scooter": scooter_config.get("value", {
            "unlock_fee": 1.00,
            "per_minute": 0.19,
            "pause_rate": 0.05,
            "daily_cap": 15.00,
        }),
        "food": food_config.get("value", {
            "delivery_fee_base": 1.99,
            "delivery_fee_per_km": 0.50,
            "service_fee_percent": 0.10,
            "small_order_fee": 2.00,
            "small_order_threshold": 15.00,
        }),
    }


@router.post("/pricing/update")
async def admin_update_pricing(req: PricingUpdate, request: Request):
    """Update pricing for a module."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.module not in ["taxi", "scooter", "food"]:
        raise HTTPException(status_code=400, detail="Invalid module")
    
    await db.mobility_config.update_one(
        {"key": f"pricing_{req.module}"},
        {"$set": {
            "key": f"pricing_{req.module}",
            "value": req.pricing,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": str(user["_id"]),
        }},
        upsert=True
    )
    
    return {"ok": True, "message": f"Pricing for {req.module} updated"}


# ══════════════════════════════════════
# ROLE APPROVALS
# ══════════════════════════════════════

@router.get("/role-requests")
async def admin_list_role_requests(request: Request, status: str = "pending", role: str = ""):
    """List role requests for drivers, delivery, restaurants."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    if role:
        query["requested_role"] = role
    else:
        query["requested_role"] = {"$in": ["driver", "delivery_driver", "restaurant"]}
    
    requests = await db.role_requests.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    
    # Get user details
    for req in requests:
        user_doc = await db.users.find_one({"_id": ObjectId(req["user_id"])}, {"password_hash": 0})
        if user_doc:
            user_doc.pop("_id", None)
            req["user"] = user_doc
    
    return {"requests": requests}


@router.post("/role-requests/decide")
async def admin_decide_role_request(req: RoleApproval, request: Request):
    """Approve or reject a role request."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    
    role_request = await db.role_requests.find_one({
        "user_id": req.user_id,
        "requested_role": req.role,
        "status": "pending"
    })
    
    if not role_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req.decision == "approve":
        # Update user with role
        update_fields = {}
        if req.role == "driver":
            update_fields = {"is_driver": True, "driver_status": "offline", "driver_approved_at": now.isoformat()}
        elif req.role == "delivery_driver":
            update_fields = {"is_delivery_driver": True, "delivery_status": "offline", "delivery_approved_at": now.isoformat()}
        elif req.role == "restaurant":
            update_fields = {"is_restaurant": True, "restaurant_status": "active", "restaurant_approved_at": now.isoformat()}
        
        await db.users.update_one(
            {"_id": ObjectId(req.user_id)},
            {"$set": update_fields}
        )
        
        await db.role_requests.update_one(
            {"user_id": req.user_id, "requested_role": req.role},
            {"$set": {"status": "approved", "decided_at": now.isoformat(), "decided_by": str(user["_id"])}}
        )
        
        return {"ok": True, "message": f"Role {req.role} approved"}
    else:
        await db.role_requests.update_one(
            {"user_id": req.user_id, "requested_role": req.role},
            {"$set": {
                "status": "rejected",
                "decided_at": now.isoformat(),
                "decided_by": str(user["_id"]),
                "rejection_reason": req.reason,
            }}
        )
        
        return {"ok": True, "message": f"Role {req.role} rejected"}


# ══════════════════════════════════════
# LIVE MONITORING
# ══════════════════════════════════════

@router.get("/live/taxi")
async def admin_live_taxi(request: Request):
    """Get live taxi rides for monitoring."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    rides = await db.taxi_rides.find(
        {"status": {"$in": ["requested", "accepted", "arriving", "started"]}},
        {"_id": 0}
    ).to_list(100)
    
    # Get online drivers
    drivers = await db.users.find(
        {"is_driver": True, "driver_status": "online"},
        {"_id": 0, "password_hash": 0, "name": 1, "driver_location": 1}
    ).to_list(100)
    
    return {"active_rides": rides, "online_drivers": drivers}


@router.get("/live/scooter")
async def admin_live_scooters(request: Request):
    """Get live scooter data."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    scooters = await db.scooters.find({}, {"_id": 0}).to_list(500)
    active_rentals = await db.scooter_rentals.find(
        {"status": {"$in": ["active", "paused"]}},
        {"_id": 0}
    ).to_list(100)
    
    return {"scooters": scooters, "active_rentals": active_rentals}


@router.get("/live/food")
async def admin_live_food(request: Request):
    """Get live food orders and deliveries."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    orders = await db.food_orders.find(
        {"status": {"$nin": ["delivered", "cancelled"]}},
        {"_id": 0}
    ).to_list(100)
    
    # Get online delivery drivers
    drivers = await db.users.find(
        {"is_delivery_driver": True, "delivery_status": "online"},
        {"_id": 0, "password_hash": 0, "name": 1, "delivery_location": 1}
    ).to_list(100)
    
    return {"active_orders": orders, "online_drivers": drivers}
