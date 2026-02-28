"""
BidBlitz Taxi Pro - Complete Ride-Hailing System
Models: User roles, DriverProfile, Wallet, Ride, PricingConfig, Merchant
Matching, Night Surcharge, Airport Meetpoints, Wallet Rules
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
import uuid, math, pytz

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/taxi", tags=["Taxi Pro"])

KOSOVO_TZ = pytz.timezone("Europe/Belgrade")  # Kosovo uses CET

# Airport meetpoints
AIRPORT_MEETPOINTS = [
    {"code": "PIA_ARRIVALS_A", "name": "Pristina Airport - Arrivals A", "lat": 42.5728, "lng": 21.0358},
    {"code": "PIA_ARRIVALS_B", "name": "Pristina Airport - Arrivals B", "lat": 42.5725, "lng": 21.0362},
    {"code": "PIA_PARKING", "name": "Pristina Airport - Parking", "lat": 42.5732, "lng": 21.0345},
]

# Kosovo bounding box for address restriction
KOSOVO_BOUNDS = {"sw_lat": 41.85, "sw_lng": 20.01, "ne_lat": 43.27, "ne_lng": 21.79}

# Default pricing config
DEFAULT_PRICING = {
    "base_fare_standard": 2.50, "base_fare_premium": 3.00, "base_fare_van": 5.00,
    "per_km_standard": 0.80, "per_min_standard": 0.12,
    "per_km_premium": 1.10, "per_min_premium": 0.18,
    "per_km_van": 1.30, "per_min_van": 0.20,
    "platform_commission_percent": 15,
    "night_surcharge_threshold_ratio": 2.5,
    "night_surcharge_percent_standard": 10, "night_surcharge_percent_premium": 8, "night_surcharge_percent_van": 8,
    "surcharge_split_driver_percent": 80, "surcharge_split_platform_percent": 20,
    "tips_go_100_to_driver": True,
    "wallet_required_before_request": True,
}


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def money(x):
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


async def get_pricing():
    cfg = await db.taxi_pricing_config.find_one({"_id": "pricing"})
    if cfg:
        cfg.pop("_id", None)
        return {**DEFAULT_PRICING, **cfg}
    return DEFAULT_PRICING


def is_night_time():
    now_ks = datetime.now(KOSOVO_TZ)
    return now_ks.hour >= 22 or now_ks.hour < 6


async def check_night_surcharge(pricing, vehicle_type):
    if not is_night_time():
        return False, 0

    # Check demand ratio: open requests / available drivers
    open_requests = await db.taxi_rides.count_documents({"status": "searching"})
    online_drivers = await db.taxi_driver_profiles.count_documents({"is_online": True, "status": "approved"})

    if online_drivers == 0:
        ratio = 999
    else:
        ratio = open_requests / online_drivers

    threshold = pricing.get("night_surcharge_threshold_ratio", 2.5)
    if ratio < threshold:
        return False, 0

    surcharge_pct = pricing.get(f"night_surcharge_percent_{vehicle_type}", 10)
    return True, surcharge_pct


def calc_fare(distance_km, duration_min, vehicle_type, pricing):
    base = pricing.get(f"base_fare_{vehicle_type}", 2.50)
    per_km = pricing.get(f"per_km_{vehicle_type}", 0.80)
    per_min = pricing.get(f"per_min_{vehicle_type}", 0.12)
    fare = base + (distance_km * per_km) + (duration_min * per_min)
    return money(fare)


# ==================== SCHEMAS ====================

class RideRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_address: str
    dropoff_lat: float
    dropoff_lng: float
    dropoff_address: str
    vehicle_type: str = "standard"
    airport_meetpoint_code: Optional[str] = None

class DriverRegister(BaseModel):
    vehicle_type: str = "standard"
    vehicle_make: str = ""
    vehicle_model: str = ""
    vehicle_color: str = ""
    license_plate: str = ""
    phone: Optional[str] = None

class LocationUpdate(BaseModel):
    lat: float
    lng: float

class RideAction(BaseModel):
    action: str  # accept, arrive, start, complete, cancel

class TipRequest(BaseModel):
    amount: float

class WalletTopup(BaseModel):
    amount: float
    method: str = "online"  # online, cash

class MerchantTopup(BaseModel):
    user_id: str
    amount: float

class PricingUpdate(BaseModel):
    base_fare_standard: Optional[float] = None
    base_fare_premium: Optional[float] = None
    base_fare_van: Optional[float] = None
    per_km_standard: Optional[float] = None
    per_min_standard: Optional[float] = None
    per_km_premium: Optional[float] = None
    per_min_premium: Optional[float] = None
    per_km_van: Optional[float] = None
    per_min_van: Optional[float] = None
    platform_commission_percent: Optional[float] = None
    night_surcharge_percent_standard: Optional[float] = None
    night_surcharge_percent_premium: Optional[float] = None
    night_surcharge_percent_van: Optional[float] = None


# ==================== RIDER ENDPOINTS ====================

@router.get("/airport-meetpoints")
async def get_airport_meetpoints():
    return {"meetpoints": AIRPORT_MEETPOINTS}

@router.get("/kosovo-bounds")
async def get_kosovo_bounds():
    return {"bounds": KOSOVO_BOUNDS}

@router.get("/pricing")
async def get_pricing_config():
    return await get_pricing()

@router.get("/estimate")
async def estimate_fare(
    pickup_lat: float, pickup_lng: float,
    dropoff_lat: float, dropoff_lng: float,
    vehicle_type: str = "standard"
):
    pricing = await get_pricing()
    dist = round(haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng), 1)
    dur = round(dist * 2.5, 0)  # avg city speed
    fare = calc_fare(dist, dur, vehicle_type, pricing)

    surcharge_active, surcharge_pct = await check_night_surcharge(pricing, vehicle_type)
    surcharge_amount = money(fare * surcharge_pct / 100) if surcharge_active else 0
    total = money(fare + surcharge_amount)

    commission_pct = pricing.get("platform_commission_percent", 15)
    platform_fee = money(fare * commission_pct / 100)
    driver_earning = money(total - platform_fee)
    if surcharge_active:
        surcharge_driver = money(surcharge_amount * pricing.get("surcharge_split_driver_percent", 80) / 100)
        surcharge_platform = money(surcharge_amount - surcharge_driver)
        driver_earning = money(fare - platform_fee + surcharge_driver)
        platform_fee = money(platform_fee + surcharge_platform)

    return {
        "distance_km": dist, "duration_min": dur, "vehicle_type": vehicle_type,
        "base_fare": fare, "surcharge_active": surcharge_active, "surcharge_amount": surcharge_amount,
        "total_fare": total, "platform_fee": platform_fee, "driver_earning": driver_earning,
        "is_night": is_night_time(),
        "breakdown": {"base": pricing.get(f"base_fare_{vehicle_type}"), "per_km": pricing.get(f"per_km_{vehicle_type}"), "per_min": pricing.get(f"per_min_{vehicle_type}")}
    }


@router.post("/request-ride")
async def request_ride(data: RideRequest, user: dict = Depends(get_current_user)):
    pricing = await get_pricing()

    # Check wallet
    if pricing.get("wallet_required_before_request", True):
        dist = round(haversine_km(data.pickup_lat, data.pickup_lng, data.dropoff_lat, data.dropoff_lng), 1)
        dur = round(dist * 2.5, 0)
        est_fare_cents = int(calc_fare(dist, dur, data.vehicle_type, pricing) * 100)
        wallet_balance = user.get("wallet_balance_cents", 0)
        if wallet_balance < est_fare_cents:
            raise HTTPException(402, f"Wallet-Guthaben zu niedrig. Benötigt: {est_fare_cents/100:.2f} EUR. Bitte aufladen.")

    # Check no active ride
    active = await db.taxi_rides.find_one({"rider_user_id": user["id"], "status": {"$in": ["searching", "assigned", "accepted", "arrived", "started"]}})
    if active:
        raise HTTPException(409, "Sie haben bereits eine aktive Fahrt")

    # Airport meetpoint
    meetpoint = None
    if data.airport_meetpoint_code:
        meetpoint = next((m for m in AIRPORT_MEETPOINTS if m["code"] == data.airport_meetpoint_code), None)

    dist = round(haversine_km(data.pickup_lat, data.pickup_lng, data.dropoff_lat, data.dropoff_lng), 1)
    dur = round(dist * 2.5, 0)
    fare = calc_fare(dist, dur, data.vehicle_type, pricing)

    surcharge_active, surcharge_pct = await check_night_surcharge(pricing, data.vehicle_type)
    surcharge_amount = money(fare * surcharge_pct / 100) if surcharge_active else 0
    total = money(fare + surcharge_amount)

    commission_pct = pricing.get("platform_commission_percent", 15)
    platform_fee = money(fare * commission_pct / 100)
    driver_earning = money(total - platform_fee)

    ride_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    ride = {
        "id": ride_id,
        "rider_user_id": user["id"],
        "rider_name": user.get("name"),
        "driver_user_id": None, "driver_name": None,
        "status": "searching",
        "vehicle_type": data.vehicle_type,
        "pickup": {"address": data.pickup_address, "lat": data.pickup_lat, "lng": data.pickup_lng, "airport_meetpoint_code": data.airport_meetpoint_code},
        "dropoff": {"address": data.dropoff_address, "lat": data.dropoff_lat, "lng": data.dropoff_lng},
        "distance_km": dist, "estimated_duration_min": dur,
        "estimated_fare": fare, "final_fare": None,
        "platform_fee": platform_fee, "driver_earning": driver_earning,
        "surcharge_active": surcharge_active, "surcharge_amount": surcharge_amount,
        "tip_amount": 0,
        "pricing_breakdown": {"base": pricing.get(f"base_fare_{data.vehicle_type}"), "per_km": pricing.get(f"per_km_{data.vehicle_type}"), "per_min": pricing.get(f"per_min_{data.vehicle_type}"), "commission_pct": commission_pct},
        "requested_at": now, "accepted_at": None, "arrived_at": None, "started_at": None, "completed_at": None,
        "cancelled_at": None, "cancel_reason": None,
        "rating_rider": None, "rating_driver": None,
        "tracking": []
    }

    await db.taxi_rides.insert_one(ride)

    # Auto-match: find nearest available driver
    await match_driver(ride_id, data.pickup_lat, data.pickup_lng, data.vehicle_type)

    ride.pop("_id", None)
    return {"success": True, "ride": ride}


async def match_driver(ride_id, pickup_lat, pickup_lng, vehicle_type):
    """Find nearest available online driver"""
    drivers = await db.taxi_driver_profiles.find(
        {"is_online": True, "status": "approved"},
        {"_id": 0}
    ).to_list(100)

    if not drivers:
        return

    # Sort by distance
    for d in drivers:
        if d.get("last_location"):
            d["_dist"] = haversine_km(pickup_lat, pickup_lng, d["last_location"]["lat"], d["last_location"]["lng"])
        else:
            d["_dist"] = 9999

    drivers.sort(key=lambda x: x["_dist"])
    nearest = drivers[0] if drivers else None

    if nearest and nearest["_dist"] < 30:  # Within 30km
        await db.taxi_rides.update_one({"id": ride_id}, {"$set": {
            "status": "assigned",
            "driver_user_id": nearest["user_id"],
            "driver_name": nearest.get("name")
        }})
        await db.taxi_driver_profiles.update_one({"user_id": nearest["user_id"]}, {"$set": {"is_online": False}})


@router.get("/my-ride")
async def get_active_ride(user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one(
        {"rider_user_id": user["id"], "status": {"$in": ["searching", "assigned", "accepted", "arrived", "started"]}},
        {"_id": 0}
    )
    return {"ride": ride}


@router.post("/cancel/{ride_id}")
async def cancel_ride(ride_id: str, reason: str = "Kunde storniert", user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    if ride["rider_user_id"] != user["id"] and ride.get("driver_user_id") != user["id"]:
        raise HTTPException(403, "Nicht berechtigt")
    if ride["status"] in ["completed", "cancelled"]:
        raise HTTPException(409, "Fahrt bereits beendet")

    now = datetime.now(timezone.utc).isoformat()
    await db.taxi_rides.update_one({"id": ride_id}, {"$set": {"status": "cancelled", "cancelled_at": now, "cancel_reason": reason}})

    # Free up driver
    if ride.get("driver_user_id"):
        await db.taxi_driver_profiles.update_one({"user_id": ride["driver_user_id"]}, {"$set": {"is_online": True}})

    return {"success": True, "message": "Fahrt storniert"}


@router.post("/tip/{ride_id}")
async def add_tip(ride_id: str, data: TipRequest, user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one({"id": ride_id, "rider_user_id": user["id"], "status": "completed"})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden oder nicht abgeschlossen")

    tip_cents = int(data.amount * 100)
    if tip_cents <= 0:
        raise HTTPException(400, "Trinkgeld muss positiv sein")

    # Deduct from rider wallet
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -tip_cents}})
    await db.taxi_rides.update_one({"id": ride_id}, {"$inc": {"tip_amount": data.amount}})

    # Wallet transactions
    now = datetime.now(timezone.utc).isoformat()
    await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "tip", "amount_cents": tip_cents, "direction": "out", "related_ride_id": ride_id, "created_at": now})

    # 100% tip to driver
    if ride.get("driver_user_id"):
        await db.users.update_one({"id": ride["driver_user_id"]}, {"$inc": {"wallet_balance_cents": tip_cents}})
        await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": ride["driver_user_id"], "type": "tip", "amount_cents": tip_cents, "direction": "in", "related_ride_id": ride_id, "created_at": now})

    return {"success": True, "message": f"Trinkgeld {data.amount:.2f} EUR gesendet!"}


@router.get("/history")
async def ride_history(limit: int = 50, user: dict = Depends(get_current_user)):
    rides = await db.taxi_rides.find(
        {"$or": [{"rider_user_id": user["id"]}, {"driver_user_id": user["id"]}]},
        {"_id": 0, "tracking": 0}
    ).sort("requested_at", -1).to_list(limit)
    return {"rides": rides}


# ==================== DRIVER ENDPOINTS ====================

@router.post("/driver/register")
async def register_driver(data: DriverRegister, user: dict = Depends(get_current_user)):
    existing = await db.taxi_driver_profiles.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(409, "Bereits registriert")

    profile = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "name": user.get("name"), "email": user.get("email"),
        "phone": data.phone or user.get("phone"),
        "status": "pending", "vehicle_type_capabilities": [data.vehicle_type],
        "vehicle": {"make": data.vehicle_make, "model": data.vehicle_model, "color": data.vehicle_color, "plate": data.license_plate},
        "rating_avg": 5.0, "cancel_rate": 0, "total_rides": 0, "total_earnings_cents": 0,
        "last_location": None, "is_online": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.taxi_driver_profiles.insert_one(profile)
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": "driver", "is_driver": True}})
    profile.pop("_id", None)
    return {"success": True, "driver": profile, "message": "Registrierung eingereicht. Wartet auf Genehmigung."}


@router.post("/driver/online")
async def go_online(data: LocationUpdate, user: dict = Depends(get_current_user)):
    driver = await db.taxi_driver_profiles.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Nicht als Fahrer registriert")
    if driver["status"] != "approved":
        raise HTTPException(403, f"Fahrer-Status: {driver['status']}. Nur genehmigte Fahrer können online gehen.")

    await db.taxi_driver_profiles.update_one({"user_id": user["id"]}, {"$set": {
        "is_online": True, "last_location": {"lat": data.lat, "lng": data.lng, "updated_at": datetime.now(timezone.utc).isoformat()}
    }})
    return {"success": True, "status": "online"}


@router.post("/driver/offline")
async def go_offline(user: dict = Depends(get_current_user)):
    await db.taxi_driver_profiles.update_one({"user_id": user["id"]}, {"$set": {"is_online": False}})
    return {"success": True, "status": "offline"}


@router.post("/driver/location")
async def update_location(data: LocationUpdate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.taxi_driver_profiles.update_one({"user_id": user["id"]}, {"$set": {
        "last_location": {"lat": data.lat, "lng": data.lng, "updated_at": now}
    }})
    # Track active ride
    ride = await db.taxi_rides.find_one({"driver_user_id": user["id"], "status": "started"})
    if ride:
        await db.taxi_rides.update_one({"id": ride["id"]}, {"$push": {"tracking": {"lat": data.lat, "lng": data.lng, "t": now}}})
    return {"success": True}


@router.get("/driver/pending-rides")
async def get_pending_rides(user: dict = Depends(get_current_user)):
    driver = await db.taxi_driver_profiles.find_one({"user_id": user["id"]})
    if not driver:
        return {"rides": []}
    # Rides assigned to this driver
    rides = await db.taxi_rides.find(
        {"driver_user_id": user["id"], "status": {"$in": ["assigned", "accepted", "arrived", "started"]}},
        {"_id": 0, "tracking": 0}
    ).to_list(10)
    return {"rides": rides}


@router.post("/driver/action/{ride_id}")
async def driver_action(ride_id: str, data: RideAction, user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()

    if data.action == "accept":
        if ride["status"] != "assigned" or ride["driver_user_id"] != user["id"]:
            raise HTTPException(409, "Kann nicht angenommen werden")
        await db.taxi_rides.update_one({"id": ride_id}, {"$set": {"status": "accepted", "accepted_at": now}})
        return {"success": True, "message": "Angenommen! Fahren Sie zum Abholort."}

    elif data.action == "arrive":
        if ride["status"] != "accepted":
            raise HTTPException(409, "Ungültig")
        await db.taxi_rides.update_one({"id": ride_id}, {"$set": {"status": "arrived", "arrived_at": now}})
        return {"success": True, "message": "Am Abholort. Warten auf Fahrgast."}

    elif data.action == "start":
        if ride["status"] != "arrived":
            raise HTTPException(409, "Ungültig")
        await db.taxi_rides.update_one({"id": ride_id}, {"$set": {"status": "started", "started_at": now}})
        return {"success": True, "message": "Fahrt gestartet!"}

    elif data.action == "complete":
        if ride["status"] != "started":
            raise HTTPException(409, "Ungültig")

        # Final fare = estimated fare (MVP)
        final_fare = ride["estimated_fare"]
        surcharge = ride.get("surcharge_amount", 0)
        total = money(final_fare + surcharge)
        total_cents = int(total * 100)

        pricing = await get_pricing()
        commission_pct = pricing.get("platform_commission_percent", 15)
        platform_fee = money(final_fare * commission_pct / 100)

        # Surcharge split
        if surcharge > 0:
            s_driver = money(surcharge * pricing.get("surcharge_split_driver_percent", 80) / 100)
            s_platform = money(surcharge - s_driver)
            platform_fee = money(platform_fee + s_platform)

        driver_earning = money(total - platform_fee)
        driver_earning_cents = int(driver_earning * 100)
        platform_fee_cents = int(platform_fee * 100)

        await db.taxi_rides.update_one({"id": ride_id}, {"$set": {
            "status": "completed", "completed_at": now,
            "final_fare": total, "platform_fee": platform_fee, "driver_earning": driver_earning
        }})

        # Payment: deduct from rider
        await db.users.update_one({"id": ride["rider_user_id"]}, {"$inc": {"wallet_balance_cents": -total_cents}})
        await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": ride["rider_user_id"], "type": "ride_payment", "amount_cents": total_cents, "direction": "out", "related_ride_id": ride_id, "created_at": now})

        # Platform commission
        platform = await db.users.find_one({"email": "platform@bidblitz.ae"})
        if platform:
            await db.users.update_one({"id": platform["id"]}, {"$inc": {"wallet_balance_cents": platform_fee_cents}})

        # Driver earning
        await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": driver_earning_cents}})
        await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "ride_payment", "amount_cents": driver_earning_cents, "direction": "in", "related_ride_id": ride_id, "created_at": now})

        # Update driver stats
        await db.taxi_driver_profiles.update_one({"user_id": user["id"]}, {"$inc": {"total_rides": 1, "total_earnings_cents": driver_earning_cents}, "$set": {"is_online": True}})

        return {"success": True, "final_fare": total, "driver_earning": driver_earning, "platform_fee": platform_fee}

    elif data.action == "cancel":
        await db.taxi_rides.update_one({"id": ride_id}, {"$set": {"status": "cancelled", "cancelled_at": now, "cancel_reason": "Fahrer storniert"}})
        await db.taxi_driver_profiles.update_one({"user_id": user["id"]}, {"$set": {"is_online": True}})
        return {"success": True, "message": "Storniert"}

    raise HTTPException(400, "Ungültige Aktion")


@router.get("/driver/stats")
async def driver_stats(user: dict = Depends(get_current_user)):
    profile = await db.taxi_driver_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Kein Fahrerprofil")
    return {"driver": profile}


# ==================== WALLET / MERCHANT ====================

@router.post("/wallet/topup")
async def wallet_topup(data: WalletTopup, user: dict = Depends(get_current_user)):
    cents = int(data.amount * 100)
    if cents < 100:
        raise HTTPException(400, "Mindestbetrag: 1 EUR")

    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": cents}})
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "type": f"topup_{data.method}",
        "amount_cents": cents, "direction": "in", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "message": f"{data.amount:.2f} EUR aufgeladen"}


@router.post("/merchant/topup")
async def merchant_topup_user(data: MerchantTopup, user: dict = Depends(get_current_user)):
    """Merchant tops up a user's wallet (cash payment at merchant)"""
    # Check if user is a merchant (simplified: check is_merchant flag)
    if not user.get("is_merchant"):
        raise HTTPException(403, "Nur für Händler")

    cents = int(data.amount * 100)
    merchant_commission_rate = user.get("merchant_commission_rate", 1.0)
    commission_cents = int(cents * merchant_commission_rate / 100)
    net_cents = cents - commission_cents

    now = datetime.now(timezone.utc).isoformat()

    # Credit user wallet (net after commission)
    await db.users.update_one({"id": data.user_id}, {"$inc": {"wallet_balance_cents": net_cents}})
    await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": data.user_id, "type": "topup_cash", "amount_cents": net_cents, "direction": "in", "merchant_id": user["id"], "created_at": now})

    # Commission to merchant
    await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "commission", "amount_cents": commission_cents, "direction": "in", "related_ride_id": None, "merchant_id": user["id"], "created_at": now, "metadata": {"topup_user": data.user_id, "gross": cents}})

    return {"success": True, "net_credited": net_cents / 100, "commission": commission_cents / 100}


# ==================== ADMIN ====================

@router.get("/admin/drivers")
async def admin_drivers(admin: dict = Depends(get_admin_user)):
    drivers = await db.taxi_driver_profiles.find({}, {"_id": 0}).to_list(200)
    return {"drivers": drivers}

@router.post("/admin/approve-driver/{user_id}")
async def admin_approve(user_id: str, admin: dict = Depends(get_admin_user)):
    await db.taxi_driver_profiles.update_one({"user_id": user_id}, {"$set": {"status": "approved"}})
    return {"success": True}

@router.post("/admin/block-driver/{user_id}")
async def admin_block(user_id: str, admin: dict = Depends(get_admin_user)):
    await db.taxi_driver_profiles.update_one({"user_id": user_id}, {"$set": {"status": "blocked", "is_online": False}})
    return {"success": True}

@router.put("/admin/pricing")
async def update_pricing(data: PricingUpdate, admin: dict = Depends(get_admin_user)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if updates:
        await db.taxi_pricing_config.update_one({"_id": "pricing"}, {"$set": updates}, upsert=True)
    return {"success": True, "pricing": await get_pricing()}

@router.get("/admin/rides")
async def admin_rides(limit: int = 50, admin: dict = Depends(get_admin_user)):
    rides = await db.taxi_rides.find({}, {"_id": 0, "tracking": 0}).sort("requested_at", -1).to_list(limit)
    return {"rides": rides}

@router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    pipeline = [{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total_fare": {"$sum": "$final_fare"}, "total_commission": {"$sum": "$platform_fee"}, "count": {"$sum": 1}}}]
    result = await db.taxi_rides.aggregate(pipeline).to_list(1)
    s = result[0] if result else {}
    total_drivers = await db.taxi_driver_profiles.count_documents({})
    online = await db.taxi_driver_profiles.count_documents({"is_online": True})
    pending = await db.taxi_driver_profiles.count_documents({"status": "pending"})
    return {
        "total_rides": s.get("count", 0), "total_revenue": s.get("total_fare", 0),
        "total_commission": s.get("total_commission", 0),
        "total_drivers": total_drivers, "online_drivers": online, "pending_drivers": pending,
        "is_night": is_night_time()
    }
