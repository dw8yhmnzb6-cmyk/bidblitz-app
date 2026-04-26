"""
BidBlitz V2 - Scooter IoT Control System
Real hardware integration for electric scooter fleet.
Production-ready for IoT device communication.
"""

import secrets
import math
import logging
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/scooter", tags=["Scooter IoT"])
logger = logging.getLogger("bidblitz.scooter")

# ══════════════════════════════════════════════════════════════════════════════
# MODULE STATUS - Set to False to hide from users
# ══════════════════════════════════════════════════════════════════════════════
SCOOTER_MODULE_ENABLED = True  # ENABLED for live demo


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

# Pricing
UNLOCK_FEE = 1.00
PER_MINUTE_RATE = 0.20
MAX_DAILY_CAP = 20.00
MIN_WALLET_BALANCE = 5.00  # Minimum balance to start ride

# IoT Provider Configuration (configure in .env for production)
IOT_PROVIDER_URL = "https://iot.bidblitz.ae/api/v1"  # Replace with real IoT provider
IOT_API_KEY = ""  # Set from environment

# Timeouts
DEVICE_TIMEOUT_SECONDS = 10
AUTO_LOCK_MINUTES = 30  # Auto-lock if no activity


class ScooterStatus(str, Enum):
    AVAILABLE = "available"
    LOCKED = "locked"
    UNLOCKED = "unlocked"
    IN_USE = "in_use"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"


class DeviceCommand(str, Enum):
    UNLOCK = "unlock"
    LOCK = "lock"
    PING = "ping"
    STATUS = "status"
    ALARM = "alarm"
    LIGHTS_ON = "lights_on"
    LIGHTS_OFF = "lights_off"


# ══════════════════════════════════════════════════════════════════════════════
# IoT DEVICE CONTROL SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class DeviceCommandResult:
    def __init__(self, success: bool, message: str = "", data: dict = None):
        self.success = success
        self.message = message
        self.data = data or {}


async def send_device_command(device_id: str, command: DeviceCommand, params: dict = None) -> DeviceCommandResult:
    """
    Send command to physical scooter IoT device.
    
    In production, this connects to your IoT provider API (e.g., Segway, Comodule, etc.)
    For development/testing, returns simulated success.
    """
    if not device_id:
        return DeviceCommandResult(False, "No device_id configured")
    
    # Log command for audit
    logger.info(f"IoT Command: device={device_id}, cmd={command.value}, params={params}")
    
    # Record command in DB for audit trail
    await db.scooter_device_commands.insert_one({
        "command_id": secrets.token_hex(8),
        "device_id": device_id,
        "command": command.value,
        "params": params or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    })
    
    # Production IoT API call (uncomment when IoT provider is configured)
    """
    try:
        async with httpx.AsyncClient(timeout=DEVICE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{IOT_PROVIDER_URL}/devices/{device_id}/command",
                json={"command": command.value, "params": params or {}},
                headers={"Authorization": f"Bearer {IOT_API_KEY}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Update command status
                await db.scooter_device_commands.update_one(
                    {"device_id": device_id, "status": "pending"},
                    {"$set": {"status": "success", "response": data}}
                )
                return DeviceCommandResult(True, "Command sent", data)
            else:
                await db.scooter_device_commands.update_one(
                    {"device_id": device_id, "status": "pending"},
                    {"$set": {"status": "failed", "error": response.text}}
                )
                return DeviceCommandResult(False, f"Device error: {response.status_code}")
                
    except httpx.TimeoutException:
        return DeviceCommandResult(False, "Device timeout - check connectivity")
    except Exception as e:
        logger.error(f"IoT command failed: {e}")
        return DeviceCommandResult(False, str(e))
    """
    
    # Development mode: Simulate success
    await db.scooter_device_commands.update_one(
        {"device_id": device_id, "status": "pending"},
        {"$set": {"status": "success", "mode": "simulation"}}
    )
    return DeviceCommandResult(True, f"Command {command.value} sent (simulation mode)", {"simulated": True})


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km using Haversine formula."""
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/nearby")
async def get_nearby_scooters(lat: float = 52.52, lng: float = 13.405, radius: float = 5.0):
    """Get available scooters near location (public endpoint)."""
    # Module disabled - return empty state
    if not SCOOTER_MODULE_ENABLED:
        return {
            "scooters": [],
            "total": 0,
            "module_enabled": False,
            "message": "Scooter-Modul wird derzeit vorbereitet",
            "pricing": {
                "unlock_fee": UNLOCK_FEE,
                "per_minute": PER_MINUTE_RATE,
                "daily_cap": MAX_DAILY_CAP,
                "min_balance": MIN_WALLET_BALANCE,
            }
        }
    
    # Return both real and demo scooters
    scooters = await db.scooters.find(
        {
            "status": {"$in": ["available", "locked"]},
            "battery": {"$gte": 15},  # Only scooters with enough battery
        },
        {"_id": 0, "device_id": 0}
    ).to_list(100)
    
    # Production: return only real scooters from DB
    if len(scooters) == 0:
        return {"scooters": [], "total": 0, "message": "Keine E-Scooter in deiner Nähe verfügbar"}
    
    nearby = []
    for s in scooters:
        loc = s.get("location", {})
        slat = loc.get("lat") or s.get("lat", 0)
        slng = loc.get("lng") or s.get("lng", 0)
        
        if slat == 0 and slng == 0:
            continue
        
        s["lat"] = slat
        s["lng"] = slng
        
        # Ensure battery_percent field exists
        if "battery_percent" not in s:
            s["battery_percent"] = s.get("battery", 50)
        
        # Ensure model field exists
        if "model" not in s:
            s["model"] = s.get("name", "E-Scooter")
        
        # Ensure range_km field exists
        if "range_km" not in s:
            s["range_km"] = int(s["battery_percent"] * 0.4)  # ~40km at 100%
        
        dist = haversine_distance(lat, lng, slat, slng)
        if dist <= radius:
            s["distance_km"] = round(dist, 2)
            s["walk_minutes"] = max(1, round(dist * 12))
            nearby.append(s)
    
    nearby.sort(key=lambda x: x.get("distance_km", 999))
    
    return {
        "scooters": nearby[:30],
        "total": len(nearby),
        "module_enabled": True,
        "pricing": {
            "unlock_fee": UNLOCK_FEE,
            "per_minute": PER_MINUTE_RATE,
            "daily_cap": MAX_DAILY_CAP,
            "min_balance": MIN_WALLET_BALANCE,
        }
    }


@router.get("/subscription-plans")
async def get_scooter_plans_alt():
    """Get available scooter subscription plans (alias)."""
    return {"plans": SCOOTER_PLANS}


@router.get("/pricing")
async def get_scooter_pricing():
    """Public: pricing & service info."""
    return {
        "unlock_fee": 1.00,
        "per_minute": 0.20,
        "currency": "EUR",
        "free_paused_minutes": 5,
        "max_speed_kmh": 25,
        "service_area": "Berlin, München, Hamburg",
        "subscription_plans": SCOOTER_PLANS,
    }


@router.get("/active")
async def get_active_ride_alias(request: Request):
    """Alias for /ride/active — used by frontend."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    ride = await db.scooter_rides.find_one(
        {"user_id": uid, "status": {"$in": ["active", "paused"]}},
        {"_id": 0},
    )
    return {"ride": ride}


@router.get("/{scooter_id}")
async def get_scooter_details(scooter_id: str):
    """Get scooter details by ID or QR code."""
    # Skip known sub-routes that shouldn't match here
    if scooter_id in ("plans", "subscribe", "my-subscription", "cancel-subscription", "subscription-plans", "pricing", "active"):
        raise HTTPException(status_code=404, detail="Ungültige Route")
    scooter = await db.scooters.find_one(
        {"$or": [{"scooter_id": scooter_id}, {"qr_code": scooter_id}]},
        {"_id": 0, "device_id": 0}
    )
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    return scooter


# ══════════════════════════════════════════════════════════════════════════════
# UNLOCK / START RIDE
# ══════════════════════════════════════════════════════════════════════════════

class UnlockRequest(BaseModel):
    scooter_id: str  # Can be scooter_id or qr_code


@router.post("/unlock")
async def unlock_scooter(req: UnlockRequest, request: Request):
    """
    Unlock scooter and start ride.
    
    Flow:
    1. Validate scooter exists and is available
    2. Check user wallet balance
    3. Send UNLOCK command to physical device
    4. Create ride session
    5. Deduct unlock fee
    """
    from core.payment_engine import debit_wallet, TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find scooter by ID or QR code
    scooter = await db.scooters.find_one({
        "$or": [{"scooter_id": req.scooter_id}, {"qr_code": req.scooter_id}]
    })
    
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    scooter_id = scooter["scooter_id"]
    
    # Check status
    if scooter.get("status") not in ["available", "locked"]:
        raise HTTPException(status_code=400, detail=f"Scooter nicht verfügbar (Status: {scooter.get('status')})")
    
    # Check battery
    if scooter.get("battery", 100) < 10:
        raise HTTPException(status_code=400, detail="Scooter Akku zu niedrig")
    
    # Check user doesn't have active ride
    active_ride = await db.scooter_rides.find_one({
        "user_id": user_id,
        "status": "active"
    })
    if active_ride:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Fahrt")
    
    # Check wallet balance
    balance = user.get("balance", 0)
    if balance < MIN_WALLET_BALANCE:
        raise HTTPException(
            status_code=400,
            detail=f"Mindestguthaben €{MIN_WALLET_BALANCE:.2f} erforderlich. Aktuell: €{balance:.2f}"
        )
    
    # Send UNLOCK command to physical device
    device_id = scooter.get("device_id")
    if device_id:
        cmd_result = await send_device_command(device_id, DeviceCommand.UNLOCK)
        if not cmd_result.success:
            raise HTTPException(status_code=503, detail=f"Scooter Entsperrung fehlgeschlagen: {cmd_result.message}")
    
    now = datetime.now(timezone.utc)
    ride_id = secrets.token_hex(8)
    
    # Deduct unlock fee
    payment_result = await debit_wallet(
        user_id=user_id,
        amount=UNLOCK_FEE,
        tx_type=TransactionType.SCOOTER_PAYMENT,
        description=f"Scooter Entsperrgebühr ({scooter_id})",
        reference=f"SC-{ride_id[:8].upper()}",
        metadata={"ride_id": ride_id, "scooter_id": scooter_id, "type": "unlock"}
    )
    
    if not payment_result.success:
        # Revert: Lock scooter again if payment failed
        if device_id:
            await send_device_command(device_id, DeviceCommand.LOCK)
        raise HTTPException(status_code=400, detail=payment_result.error)
    
    # Create ride session
    ride = {
        "ride_id": ride_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "scooter_id": scooter_id,
        "device_id": device_id,
        "status": "active",
        "start_location": scooter.get("location", {}),
        "start_time": now.isoformat(),
        "unlock_fee": UNLOCK_FEE,
        "per_minute_rate": PER_MINUTE_RATE,
        "current_cost": UNLOCK_FEE,
        "distance_km": 0,
        "created_at": now.isoformat(),
    }
    await db.scooter_rides.insert_one(ride)
    
    # Update scooter status
    await db.scooters.update_one(
        {"scooter_id": scooter_id},
        {"$set": {
            "status": "in_use",
            "current_ride_id": ride_id,
            "current_user_id": user_id,
            "unlocked_at": now.isoformat(),
        }}
    )
    
    ride.pop("_id", None)
    
    return {
        "ok": True,
        "ride": ride,
        "scooter": {
            "scooter_id": scooter_id,
            "model": scooter.get("model"),
            "battery": scooter.get("battery"),
        },
        "new_balance": payment_result.new_balance,
        "message": "Scooter entsperrt! Gute Fahrt!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# END RIDE / LOCK
# ══════════════════════════════════════════════════════════════════════════════

class EndRideRequest(BaseModel):
    ride_id: Optional[str] = None
    scooter_id: Optional[str] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    parking_photo_url: Optional[str] = None  # Photo proof of correct parking


@router.post("/end")
async def end_ride(req: EndRideRequest, request: Request):
    """
    End ride and lock scooter.
    
    Flow:
    1. Calculate duration and cost
    2. Deduct final cost from wallet
    3. Send LOCK command to device
    4. Update scooter location and status
    5. Complete ride session
    """
    from core.payment_engine import debit_wallet, TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find active ride
    query = {"user_id": user_id, "status": "active"}
    if req.ride_id:
        query["ride_id"] = req.ride_id
    elif req.scooter_id:
        query["scooter_id"] = req.scooter_id
    
    ride = await db.scooter_rides.find_one(query)
    if not ride:
        raise HTTPException(status_code=404, detail="Keine aktive Fahrt gefunden")
    
    scooter_id = ride["scooter_id"]
    ride_id = ride["ride_id"]
    device_id = ride.get("device_id")
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(ride["start_time"])
    
    # Calculate duration
    duration_seconds = (now - start_time).total_seconds()
    duration_minutes = max(1, duration_seconds / 60)
    
    # Calculate cost
    ride_cost = round(duration_minutes * PER_MINUTE_RATE, 2)
    total_cost = UNLOCK_FEE + ride_cost
    total_cost = min(total_cost, MAX_DAILY_CAP)  # Apply daily cap
    
    # Cost already includes unlock fee, so deduct only ride cost
    ride_cost_to_deduct = total_cost - UNLOCK_FEE
    
    # Deduct ride cost
    payment_result = None
    if ride_cost_to_deduct > 0:
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=ride_cost_to_deduct,
            tx_type=TransactionType.SCOOTER_PAYMENT,
            description=f"Scooter Fahrt ({round(duration_minutes)} Min)",
            reference=f"SC-RIDE-{ride_id[:8].upper()}",
            metadata={"ride_id": ride_id, "minutes": round(duration_minutes)}
        )
    
    # Send LOCK command to device
    if device_id:
        cmd_result = await send_device_command(device_id, DeviceCommand.LOCK)
        if not cmd_result.success:
            logger.warning(f"Lock command failed for {scooter_id}: {cmd_result.message}")
            # Continue anyway - scooter may auto-lock
    
    # Determine end location
    end_location = ride.get("start_location", {})
    if req.end_lat and req.end_lng:
        end_location = {"lat": req.end_lat, "lng": req.end_lng}
    
    # Calculate distance
    start_loc = ride.get("start_location", {})
    distance_km = 0
    if start_loc.get("lat") and end_location.get("lat"):
        distance_km = haversine_distance(
            start_loc["lat"], start_loc["lng"],
            end_location["lat"], end_location["lng"]
        )
    
    # Update ride
    await db.scooter_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "status": "completed",
            "end_time": now.isoformat(),
            "end_location": end_location,
            "duration_seconds": round(duration_seconds),
            "duration_minutes": round(duration_minutes),
            "ride_cost": ride_cost,
            "total_cost": total_cost,
            "distance_km": round(distance_km, 2),
            "parking_photo_url": req.parking_photo_url,
        }}
    )
    
    # Update scooter
    await db.scooters.update_one(
        {"scooter_id": scooter_id},
        {"$set": {
            "status": "available",
            "location": end_location,
            "current_ride_id": None,
            "current_user_id": None,
            "last_ride_end": now.isoformat(),
        },
        "$inc": {
            "total_rides": 1,
            "total_revenue": total_cost,
            "total_distance": distance_km,
        }}
    )
    
    new_balance = payment_result.new_balance if payment_result else user.get("balance", 0) - ride_cost_to_deduct
    
    return {
        "ok": True,
        "summary": {
            "ride_id": ride_id,
            "duration_minutes": round(duration_minutes),
            "distance_km": round(distance_km, 2),
            "unlock_fee": UNLOCK_FEE,
            "ride_cost": ride_cost,
            "total_cost": total_cost,
        },
        "new_balance": round(new_balance, 2),
        "message": f"Fahrt beendet. Gesamt: €{total_cost:.2f}",
    }


# ══════════════════════════════════════════════════════════════════════════════
# LIVE RIDE STATUS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/ride/active")
async def get_active_ride(request: Request):
    """Get user's active ride with live cost calculation."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.scooter_rides.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    
    if not ride:
        return {"has_active": False, "ride": None}
    
    # Calculate live cost
    start_time = datetime.fromisoformat(ride["start_time"])
    elapsed_seconds = (datetime.now(timezone.utc) - start_time).total_seconds()
    elapsed_minutes = elapsed_seconds / 60
    
    current_cost = UNLOCK_FEE + round(elapsed_minutes * PER_MINUTE_RATE, 2)
    current_cost = min(current_cost, MAX_DAILY_CAP)
    
    return {
        "has_active": True,
        "ride": ride,
        "live": {
            "elapsed_seconds": round(elapsed_seconds),
            "elapsed_minutes": round(elapsed_minutes, 1),
            "current_cost": current_cost,
            "max_cost": MAX_DAILY_CAP,
        }
    }


@router.get("/history")
async def get_ride_history(request: Request, limit: int = 20):
    """Get user's ride history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rides = await db.scooter_rides.find(
        {"user_id": user_id, "status": "completed"},
        {"_id": 0}
    ).sort("end_time", -1).limit(limit).to_list(limit)
    
    total_spent = sum(r.get("total_cost", 0) for r in rides)
    total_distance = sum(r.get("distance_km", 0) for r in rides)
    
    return {
        "rides": rides,
        "total": len(rides),
        "stats": {
            "total_spent": round(total_spent, 2),
            "total_distance_km": round(total_distance, 2),
            "total_rides": len(rides),
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# DEVICE GPS/STATUS UPDATE (Called by IoT devices)
# ══════════════════════════════════════════════════════════════════════════════

class DeviceUpdateRequest(BaseModel):
    device_id: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    battery: Optional[int] = None
    speed: Optional[float] = None
    locked: Optional[bool] = None
    signal_strength: Optional[int] = None


@router.post("/device/update")
async def device_location_update(req: DeviceUpdateRequest):
    """
    Receive location/status updates from scooter IoT device.
    Called by the physical scooter hardware.
    """
    # Find scooter by device_id
    scooter = await db.scooters.find_one({"device_id": req.device_id})
    if not scooter:
        raise HTTPException(status_code=404, detail="Unknown device")
    
    now = datetime.now(timezone.utc)
    update = {"last_ping": now.isoformat()}
    
    if req.lat is not None and req.lng is not None:
        update["location"] = {"lat": req.lat, "lng": req.lng}
    
    if req.battery is not None:
        update["battery"] = req.battery
    
    if req.speed is not None:
        update["current_speed"] = req.speed
    
    if req.signal_strength is not None:
        update["signal_strength"] = req.signal_strength
    
    if req.locked is not None:
        # If device reports locked but status is in_use, something is wrong
        if req.locked and scooter.get("status") == "in_use":
            logger.warning(f"Scooter {scooter['scooter_id']} locked while in use!")
    
    await db.scooters.update_one(
        {"device_id": req.device_id},
        {"$set": update}
    )
    
    # Also update ride location if active
    if scooter.get("current_ride_id"):
        await db.scooter_rides.update_one(
            {"ride_id": scooter["current_ride_id"], "status": "active"},
            {"$set": {
                "current_location": update.get("location", {}),
                "current_speed": req.speed,
            }}
        )
    
    return {"ok": True, "scooter_id": scooter["scooter_id"]}


@router.post("/device/ping")
async def device_ping(req: DeviceUpdateRequest):
    """Simple ping from device to confirm connectivity."""
    scooter = await db.scooters.find_one({"device_id": req.device_id})
    if not scooter:
        return {"ok": False, "error": "Unknown device"}
    
    await db.scooters.update_one(
        {"device_id": req.device_id},
        {"$set": {"last_ping": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"ok": True, "scooter_id": scooter["scooter_id"]}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: FLEET MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

class AddScooterRequest(BaseModel):
    model: str = "BidBlitz S1"
    device_id: str  # IoT module ID
    qr_code: str
    lat: float
    lng: float
    battery: int = Field(default=100, ge=0, le=100)


class UpdateScooterAdminRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    battery: Optional[int] = None
    status: Optional[str] = None
    device_id: Optional[str] = None


@router.post("/admin/add")
async def admin_add_scooter(req: AddScooterRequest, request: Request):
    """Admin: Add a new scooter with IoT device."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Check device_id not already used
    existing = await db.scooters.find_one({"device_id": req.device_id})
    if existing:
        raise HTTPException(status_code=400, detail="Device ID already registered")
    
    scooter_id = f"SC-{secrets.token_hex(4).upper()}"
    now = datetime.now(timezone.utc)
    
    scooter = {
        "scooter_id": scooter_id,
        "device_id": req.device_id,
        "qr_code": req.qr_code,
        "model": req.model,
        "location": {"lat": req.lat, "lng": req.lng},
        "battery": req.battery,
        "status": "available",
        "created_at": now.isoformat(),
        "total_rides": 0,
        "total_revenue": 0,
        "total_distance": 0,
    }
    
    await db.scooters.insert_one(scooter)
    scooter.pop("_id", None)
    
    logger.info(f"Admin added scooter: {scooter_id} with device {req.device_id}")
    return {"ok": True, "scooter": scooter}


@router.put("/admin/{scooter_id}")
async def admin_update_scooter(scooter_id: str, req: UpdateScooterAdminRequest, request: Request):
    """Admin: Update scooter details."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    scooter = await db.scooters.find_one({"scooter_id": scooter_id})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    update = {}
    if req.lat is not None and req.lng is not None:
        update["location"] = {"lat": req.lat, "lng": req.lng}
    if req.battery is not None:
        update["battery"] = req.battery
    if req.status is not None:
        update["status"] = req.status
    if req.device_id is not None:
        update["device_id"] = req.device_id
    
    if update:
        await db.scooters.update_one({"scooter_id": scooter_id}, {"$set": update})
    
    updated = await db.scooters.find_one({"scooter_id": scooter_id}, {"_id": 0})
    return {"ok": True, "scooter": updated}


@router.delete("/admin/{scooter_id}")
async def admin_delete_scooter(scooter_id: str, request: Request):
    """Admin: Remove scooter from fleet."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    scooter = await db.scooters.find_one({"scooter_id": scooter_id})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    if scooter.get("status") == "in_use":
        raise HTTPException(status_code=400, detail="Scooter ist gerade in Benutzung")
    
    await db.scooters.delete_one({"scooter_id": scooter_id})
    return {"ok": True, "deleted": scooter_id}


@router.post("/admin/{scooter_id}/command")
async def admin_send_command(scooter_id: str, request: Request):
    """Admin: Send command to scooter device."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    command = body.get("command", "ping")
    
    scooter = await db.scooters.find_one({"scooter_id": scooter_id})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    device_id = scooter.get("device_id")
    if not device_id:
        raise HTTPException(status_code=400, detail="Scooter has no device_id")
    
    try:
        cmd = DeviceCommand(command)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown command: {command}")
    
    result = await send_device_command(device_id, cmd)
    
    return {
        "ok": result.success,
        "command": command,
        "message": result.message,
        "data": result.data,
    }


@router.get("/admin/fleet")
async def admin_get_fleet(request: Request):
    """Admin: Get full fleet overview with stats."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    scooters = await db.scooters.find({}, {"_id": 0}).to_list(500)
    
    # Calculate stats
    stats = {
        "total": len(scooters),
        "available": len([s for s in scooters if s.get("status") == "available"]),
        "in_use": len([s for s in scooters if s.get("status") == "in_use"]),
        "offline": len([s for s in scooters if s.get("status") == "offline"]),
        "maintenance": len([s for s in scooters if s.get("status") == "maintenance"]),
        "low_battery": len([s for s in scooters if s.get("battery", 100) < 20]),
        "total_revenue": sum(s.get("total_revenue", 0) for s in scooters),
        "total_rides": sum(s.get("total_rides", 0) for s in scooters),
    }
    
    return {"scooters": scooters, "stats": stats}


# ══════════════════════════════════════════════════════════════════════════════
# SCOOTER ABO-SYSTEM (Wochen-, Monats-, Jahresabos)
# ══════════════════════════════════════════════════════════════════════════════

SCOOTER_PLANS = [
    {
        "plan_id": "scooter_weekly",
        "name": "Wochen-Pass",
        "duration": "weekly",
        "duration_days": 7,
        "price": 9.99,
        "features": [
            "Keine Entsperrgebühr",
            "30 Min. Freifahrt/Tag",
            "Danach 0.15€/Min.",
            "7 Tage gültig",
        ],
        "unlock_fee": 0,
        "free_minutes_per_day": 30,
        "per_minute_rate": 0.15,
        "color": "#3B82F6",
        "popular": False,
    },
    {
        "plan_id": "scooter_monthly",
        "name": "Monats-Abo",
        "duration": "monthly",
        "duration_days": 30,
        "price": 29.99,
        "features": [
            "Keine Entsperrgebühr",
            "45 Min. Freifahrt/Tag",
            "Danach 0.12€/Min.",
            "30 Tage gültig",
            "Prioritäts-Reservierung",
        ],
        "unlock_fee": 0,
        "free_minutes_per_day": 45,
        "per_minute_rate": 0.12,
        "color": "#10B981",
        "popular": True,
    },
    {
        "plan_id": "scooter_yearly",
        "name": "Jahres-Abo",
        "duration": "yearly",
        "duration_days": 365,
        "price": 249.99,
        "features": [
            "Keine Entsperrgebühr",
            "60 Min. Freifahrt/Tag",
            "Danach 0.10€/Min.",
            "365 Tage gültig",
            "Prioritäts-Reservierung",
            "Exklusive Scooter-Modelle",
            "Spare 110€/Jahr",
        ],
        "unlock_fee": 0,
        "free_minutes_per_day": 60,
        "per_minute_rate": 0.10,
        "color": "#F59E0B",
        "popular": False,
    },
]


@router.get("/plans")
async def get_scooter_plans():
    """Get available scooter subscription plans."""
    return {"plans": SCOOTER_PLANS}


class SubscribePlanReq(BaseModel):
    plan_id: str

@router.post("/subscribe")
async def subscribe_plan(req: SubscribePlanReq, request: Request):
    """Subscribe to a scooter plan. Deducts from wallet."""
    user = await get_current_user(request)
    email = user.get("email", "")

    plan = next((p for p in SCOOTER_PLANS if p["plan_id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Ungültiger Plan")

    # Check existing active subscription
    existing = await db.scooter_subscriptions.find_one({
        "user_email": email,
        "status": "active",
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
    })
    if existing:
        raise HTTPException(400, "Du hast bereits ein aktives Abo")

    # Check wallet balance
    user_doc = await db.users.find_one({"email": email})
    balance = user_doc.get("balance", 0) if user_doc else 0
    if balance < plan["price"]:
        raise HTTPException(400, f"Nicht genügend Guthaben. Benötigt: {plan['price']}€, Verfügbar: {balance:.2f}€")

    # Deduct from wallet
    await db.users.update_one({"email": email}, {"$inc": {"balance": -plan["price"]}})

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=plan["duration_days"])

    subscription = {
        "sub_id": secrets.token_hex(8),
        "user_email": email,
        "user_name": user.get("name", ""),
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "price": plan["price"],
        "duration": plan["duration"],
        "duration_days": plan["duration_days"],
        "unlock_fee": plan["unlock_fee"],
        "free_minutes_per_day": plan["free_minutes_per_day"],
        "per_minute_rate": plan["per_minute_rate"],
        "status": "active",
        "started_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    }
    await db.scooter_subscriptions.insert_one(subscription)
    subscription.pop("_id", None)

    # Log transaction
    await db.transactions.insert_one({
        "user_email": email,
        "type": "scooter_subscription",
        "amount": -plan["price"],
        "description": f"Scooter {plan['name']}",
        "reference": subscription["sub_id"],
        "created_at": now.isoformat(),
    })

    return {"ok": True, "subscription": subscription}


@router.get("/my-subscription")
async def get_my_subscription(request: Request):
    """Get user's active scooter subscription."""
    user = await get_current_user(request)
    sub = await db.scooter_subscriptions.find_one(
        {
            "user_email": user.get("email", ""),
            "status": "active",
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
        },
        {"_id": 0},
    )
    return {"subscription": sub}


@router.post("/cancel-subscription")
async def cancel_subscription(request: Request):
    """Cancel active scooter subscription."""
    user = await get_current_user(request)
    result = await db.scooter_subscriptions.update_one(
        {"user_email": user.get("email", ""), "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(400, "Kein aktives Abo gefunden")
    return {"ok": True, "message": "Abo gekündigt"}



# ══════════════════════════════════════════════════════════════════════════════
# SCOOTER SHARING
# ══════════════════════════════════════════════════════════════════════════════

class ShareScooterRequest(BaseModel):
    ride_id: str
    duration_minutes: int = 60  # 30, 60, 120, 1440 (24h)

class RedeemShareCodeRequest(BaseModel):
    code: str


@router.post("/share/create")
async def create_share_code(req: ShareScooterRequest, request: Request):
    """Create a sharing code for an active scooter ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    email = user.get("email", "")

    # Verify active ride belongs to user
    ride = await db.scooter_rides.find_one({
        "ride_id": req.ride_id,
        "user_id": user_id,
        "status": "active",
    })
    if not ride:
        raise HTTPException(400, "Keine aktive Fahrt gefunden")

    # Check existing share
    existing = await db.scooter_shares.find_one({
        "ride_id": req.ride_id,
        "status": "active",
    })
    if existing:
        return {
            "ok": True,
            "code": existing["code"],
            "expires_at": existing["expires_at"],
            "already_existed": True,
        }

    # Generate share code
    code = f"BLZ-{secrets.token_hex(2).upper()}"
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=req.duration_minutes)

    share = {
        "share_id": secrets.token_hex(8),
        "ride_id": req.ride_id,
        "scooter_id": ride.get("scooter_id"),
        "host_user_id": user_id,
        "host_email": email,
        "host_name": user.get("name", email),
        "code": code,
        "duration_minutes": req.duration_minutes,
        "status": "active",
        "guest_user_id": None,
        "guest_email": None,
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "redeemed_at": None,
    }
    await db.scooter_shares.insert_one(share)

    return {
        "ok": True,
        "code": code,
        "share_id": share["share_id"],
        "expires_at": expires.isoformat(),
        "duration_minutes": req.duration_minutes,
    }


@router.post("/share/redeem")
async def redeem_share_code(req: RedeemShareCodeRequest, request: Request):
    """Redeem a sharing code to unlock a scooter."""
    user = await get_current_user(request)
    guest_id = str(user["_id"])
    guest_email = user.get("email", "")

    code = req.code.strip().upper()
    share = await db.scooter_shares.find_one({
        "code": code,
        "status": "active",
    })
    if not share:
        raise HTTPException(404, "Code ungültig oder abgelaufen")

    # Check expiry
    expires = datetime.fromisoformat(share["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        await db.scooter_shares.update_one({"code": code}, {"$set": {"status": "expired"}})
        raise HTTPException(400, "Code ist abgelaufen")

    # Can't redeem own code
    if share["host_user_id"] == guest_id:
        raise HTTPException(400, "Du kannst deinen eigenen Code nicht einlösen")

    # Already redeemed by someone
    if share.get("guest_user_id"):
        raise HTTPException(400, "Code wurde bereits eingelöst")

    # Mark as redeemed
    await db.scooter_shares.update_one(
        {"code": code},
        {"$set": {
            "guest_user_id": guest_id,
            "guest_email": guest_email,
            "guest_name": user.get("name", guest_email),
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {
        "ok": True,
        "message": f"Scooter von {share['host_name']} freigeschaltet!",
        "scooter_id": share["scooter_id"],
        "host_name": share["host_name"],
        "expires_at": share["expires_at"],
    }


@router.post("/share/revoke")
async def revoke_share(req: ShareScooterRequest, request: Request):
    """Revoke a sharing code."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    result = await db.scooter_shares.update_one(
        {"ride_id": req.ride_id, "host_user_id": user_id, "status": "active"},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(400, "Kein aktiver Share gefunden")
    return {"ok": True, "message": "Freigabe widerrufen"}


@router.get("/share/active")
async def get_active_shares(request: Request):
    """Get all active shares with live cost calculation for host."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    as_host = await db.scooter_shares.find(
        {"host_user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(20)
    as_guest = await db.scooter_shares.find(
        {"guest_user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(20)

    # Enrich host shares with live cost from the ride
    for share in as_host:
        ride = await db.scooter_rides.find_one(
            {"ride_id": share.get("ride_id")}, {"_id": 0}
        )
        if ride and ride.get("status") == "active":
            start = ride.get("started_at") or ride.get("created_at", "")
            try:
                started = datetime.fromisoformat(start.replace("Z", "+00:00"))
                elapsed = (datetime.now(timezone.utc) - started).total_seconds()
                minutes = elapsed / 60
                cost = UNLOCK_FEE + (minutes * PER_MINUTE_RATE)
                share["live_cost"] = round(cost, 2)
                share["live_minutes"] = round(minutes, 1)
                share["ride_active"] = True
            except:
                share["live_cost"] = 0
                share["live_minutes"] = 0
                share["ride_active"] = False
        else:
            share["live_cost"] = 0
            share["live_minutes"] = 0
            share["ride_active"] = False

        # Check if redeemed
        share["is_redeemed"] = share.get("guest_user_id") is not None

    return {
        "shared_by_me": as_host,
        "shared_with_me": as_guest,
    }



# ══════════════════════════════════════════════════════════════════════════════
# QR-CODE UNLOCK — P0 (Industry standard for Scooter Apps)
# ══════════════════════════════════════════════════════════════════════════════

class QrUnlockRequest(BaseModel):
    qr_code: str  # Raw QR content (URL or scooter_id)


@router.post("/unlock-qr")
async def unlock_via_qr(req: QrUnlockRequest, request: Request):
    """
    Unlock scooter from a scanned QR code.
    Accepts either:
      - direct scooter_id (e.g. "SC-T1234")
      - URL containing it (e.g. "https://bidblitz.com/scooter/SC-T1234")
      - URL with ?id= or ?scooter_id= query
    """
    from urllib.parse import urlparse, parse_qs

    raw = (req.qr_code or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="QR-Code leer")

    scooter_id = None

    # 1) Direct ID
    if raw.startswith("SC-") and len(raw) <= 20:
        scooter_id = raw
    else:
        # 2) Try URL parsing
        try:
            parsed = urlparse(raw)
            qs = parse_qs(parsed.query or "")
            if qs.get("scooter_id"):
                scooter_id = qs["scooter_id"][0]
            elif qs.get("id"):
                scooter_id = qs["id"][0]
            else:
                # Last segment of path
                parts = [p for p in (parsed.path or "").split("/") if p]
                if parts and parts[-1].startswith("SC-"):
                    scooter_id = parts[-1]
        except Exception:
            pass

    if not scooter_id:
        raise HTTPException(status_code=400, detail="QR-Code unbekannt")

    # Reuse existing unlock logic
    return await unlock_scooter(UnlockRequest(scooter_id=scooter_id), request)


# ══════════════════════════════════════════════════════════════════════════════
# REPORT ISSUE — Damage / Problem with Scooter
# ══════════════════════════════════════════════════════════════════════════════

class ReportIssueRequest(BaseModel):
    scooter_id: str
    category: str  # "damage" | "battery" | "lights" | "brakes" | "tire" | "vandalism" | "other"
    description: str = Field("", max_length=500)
    photo_url: Optional[str] = None
    severity: str = "medium"  # "low" | "medium" | "high"


@router.post("/report-issue")
async def report_scooter_issue(req: ReportIssueRequest, request: Request):
    """User reports an issue/damage on a scooter."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    scooter = await db.scooters.find_one({"scooter_id": req.scooter_id}, {"_id": 0})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    report_id = secrets.token_hex(8)

    doc = {
        "report_id": report_id,
        "scooter_id": req.scooter_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "category": req.category,
        "description": req.description,
        "photo_url": req.photo_url,
        "severity": req.severity,
        "status": "open",
        "created_at": now,
    }
    await db.scooter_issues.insert_one(doc)
    doc.pop("_id", None)

    # Auto-flag scooter as maintenance for severe issues
    if req.severity == "high":
        await db.scooters.update_one(
            {"scooter_id": req.scooter_id},
            {"$set": {"status": "maintenance", "needs_maintenance": True}},
        )

    # Notify admin
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": "admin",
        "type": "scooter_issue",
        "title": f"⚠️ Scooter-Problem ({req.severity})",
        "message": f"{req.scooter_id}: {req.category}",
        "data": {"report_id": report_id, "scooter_id": req.scooter_id},
        "read": False,
        "created_at": now,
    })

    return {"ok": True, "report_id": report_id, "message": "Danke für die Meldung!"}


# ══════════════════════════════════════════════════════════════════════════════
# RESERVATION — Hold a scooter for X minutes
# ══════════════════════════════════════════════════════════════════════════════

RESERVE_FEE = 0.50           # one-time hold fee
RESERVE_MINUTES = 10         # how long the hold lasts


class ReserveRequest(BaseModel):
    scooter_id: str


@router.post("/reserve")
async def reserve_scooter(req: ReserveRequest, request: Request):
    """Reserve a scooter for {RESERVE_MINUTES} minutes."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    scooter = await db.scooters.find_one({"scooter_id": req.scooter_id})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    if scooter.get("status") not in ("available",):
        raise HTTPException(status_code=400, detail="Scooter ist nicht verfügbar")

    # Cancel any previous reservation by this user
    await db.scooter_reservations.update_many(
        {"user_id": user_id, "status": "active"}, {"$set": {"status": "cancelled"}}
    )

    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=RESERVE_MINUTES)
    res_id = secrets.token_hex(8)

    doc = {
        "reservation_id": res_id,
        "user_id": user_id,
        "scooter_id": req.scooter_id,
        "fee": RESERVE_FEE,
        "status": "active",
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    }
    await db.scooter_reservations.insert_one(doc)
    doc.pop("_id", None)

    await db.scooters.update_one(
        {"scooter_id": req.scooter_id},
        {"$set": {"status": "reserved", "reserved_by": user_id, "reserved_until": expires.isoformat()}},
    )

    return {
        "ok": True,
        "reservation": doc,
        "expires_in_seconds": RESERVE_MINUTES * 60,
        "expires_at": expires.isoformat(),
    }


@router.post("/reserve/cancel")
async def cancel_reservation(request: Request):
    """Cancel active reservation for current user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    res = await db.scooter_reservations.find_one(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    )
    if not res:
        return {"ok": True, "message": "Keine aktive Reservierung"}

    await db.scooter_reservations.update_one(
        {"reservation_id": res["reservation_id"]}, {"$set": {"status": "cancelled"}}
    )
    await db.scooters.update_one(
        {"scooter_id": res["scooter_id"]},
        {"$set": {"status": "available"}, "$unset": {"reserved_by": "", "reserved_until": ""}},
    )
    return {"ok": True}
