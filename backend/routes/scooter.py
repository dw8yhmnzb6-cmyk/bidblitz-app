"""
BidBlitz V2 - Scooter IoT Control System
Real hardware integration for electric scooter fleet.
Production-ready for IoT device communication.
"""

import secrets
import os
import math
import logging
import hashlib
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

from core.database import db
from core.config import TEST_MODE
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


def _default_scooter_pricing() -> dict:
    return {
        "unlock_fee": UNLOCK_FEE,
        "per_minute": PER_MINUTE_RATE,
        "daily_cap": MAX_DAILY_CAP,
        "min_balance": MIN_WALLET_BALANCE,
        "minimum_charge": UNLOCK_FEE,
        "currency": "EUR",
        "profile_scope": "fallback",
        "source": "Scooter fallback tariff",
        "city": "",
        "country": "",
        "country_code": "",
        "basis": "Fallback-Tarif",
        "available": True,
    }


async def _resolve_scooter_pricing(lat: Optional[float] = None, lng: Optional[float] = None, address: str = "") -> dict:
    pricing = _default_scooter_pricing()
    if lat is None or lng is None:
        return pricing
    if not (-90 <= float(lat) <= 90 and -180 <= float(lng) <= 180):
        raise HTTPException(status_code=400, detail="Ungültige Koordinaten")

    try:
        # Single canonical tariff resolver shared with the Mobility Platform.
        # Lazy import avoids coupling router import order during app startup.
        from routes.mobility_platform import _resolve_pricing_context
        context = await _resolve_pricing_context(float(lat), float(lng), address or "")
        mode = dict((context.get("modes") or {}).get("scooter") or {})
        if not mode:
            pricing.update({
                "available": False,
                "profile_scope": (context.get("mode_scopes") or {}).get("scooter", context.get("profile_scope") or "country"),
                "source": context.get("source") or pricing["source"],
                "city": context.get("city") or "",
                "country": context.get("country") or context.get("region") or "",
                "country_code": context.get("country_code") or "",
                "basis": "Für diese Region ist noch kein Scooter-Tarif hinterlegt.",
            })
            return pricing

        local_currency = str(context.get("currency") or "EUR").upper()
        pricing.update({
            "unlock_fee": round(float(mode.get("base", UNLOCK_FEE) or 0), 2),
            "per_minute": round(float(mode.get("per_min", PER_MINUTE_RATE) or 0), 4),
            "daily_cap": round(float(mode.get("daily_cap", MAX_DAILY_CAP) or MAX_DAILY_CAP), 2),
            "min_balance": round(float(mode.get("min_balance", MIN_WALLET_BALANCE) or 0), 2),
            "minimum_charge": round(float(mode.get("minimum", mode.get("base", UNLOCK_FEE)) or 0), 2),
            "currency": local_currency,
            "profile_scope": (context.get("mode_scopes") or {}).get("scooter", context.get("profile_scope") or "country"),
            "source": context.get("source") or pricing["source"],
            "city": context.get("city") or "",
            "country": context.get("country") or context.get("region") or "",
            "country_code": context.get("country_code") or "",
            "basis": mode.get("basis") or "",
            "range_per_min_low": mode.get("range_per_min_low"),
            "range_per_min_high": mode.get("range_per_min_high"),
            "available": local_currency == "EUR",
            "billing_supported": local_currency == "EUR",
        })
        if local_currency != "EUR":
            pricing["basis"] = (pricing.get("basis") or "") + " · Wallet-Abrechnung für diese Währung noch nicht freigeschaltet."
        return pricing
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Scooter tariff resolution failed closed: %s", exc)
        pricing.update({
            "available": False,
            "billing_supported": False,
            "basis": "Lokaler Scooter-Tarif konnte nicht verifiziert werden. Fahrtstart ist vorübergehend gesperrt.",
            "source": "pricing_resolution_failed",
        })
        return pricing


def _require_scooter_idempotency_key(body_key: Optional[str], request: Request, *, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


async def _settle_outstanding_scooter_debts(user: dict) -> float:
    from core.payment_engine import debit_wallet, TransactionType

    user_id = str(user["_id"])
    debts = await db.scooter_payment_due.find(
        {"user_id": user_id, "status": "due"},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)

    remaining = 0.0
    for debt in debts:
        amount = round(float(debt.get("amount") or 0), 2)
        if amount <= 0:
            continue
        result = await debit_wallet(
            user_id=user_id,
            amount=amount,
            tx_type=TransactionType.SCOOTER_PAYMENT,
            description=f"Offener Scooter-Betrag {debt.get('ride_id', '')}",
            reference=f"SC-DEBT-{str(debt.get('ride_id', ''))[:8].upper()}",
            metadata={"ride_id": debt.get("ride_id"), "kind": "scooter_debt_settlement"},
            idempotency_key=f"scooter-debt:{debt.get('ride_id')}",
        )
        if result.success:
            paid_at = datetime.now(timezone.utc).isoformat()
            await db.scooter_payment_due.update_one(
                {"ride_id": debt.get("ride_id"), "user_id": user_id, "status": "due"},
                {"$set": {"status": "paid", "paid_at": paid_at, "transaction_id": result.transaction_id}},
            )
            await db.scooter_rides.update_one(
                {"ride_id": debt.get("ride_id"), "user_id": user_id},
                {"$set": {"payment_status": "paid_late", "payment_transaction_id": result.transaction_id, "payment_paid_at": paid_at}},
            )
        else:
            remaining += amount
    return round(remaining, 2)


async def _get_active_scooter_subscription(user: dict) -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"])
    email = user.get("email", "")
    sub = await db.scooter_subscriptions.find_one(
        {
            "status": "active",
            "expires_at": {"$gt": now},
            "$or": [
                {"user_id": user_id},
                {"user_email": email},
            ],
        },
        {"_id": 0},
    )
    return sub


# IoT Provider Configuration. Production fails closed unless these are set.
IOT_PROVIDER_URL = os.environ.get("IOT_PROVIDER_URL", "").rstrip("/")
IOT_API_KEY = os.environ.get("IOT_API_KEY", "")
IOT_DEVICE_INGEST_KEY = os.environ.get("IOT_DEVICE_INGEST_KEY", "")


def _iot_live_configured() -> bool:
    return bool(IOT_PROVIDER_URL and IOT_API_KEY)


def _require_iot_device_ingest_auth(request: Request) -> None:
    if TEST_MODE:
        return
    expected = IOT_DEVICE_INGEST_KEY or IOT_API_KEY
    if not expected:
        raise HTTPException(status_code=503, detail="IoT device ingest is not configured")
    auth = request.headers.get("Authorization", "")
    bearer = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    provided = request.headers.get("X-IoT-Key", "").strip() or bearer
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid IoT device credentials")

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
    """Send an audited command to a physical scooter; simulate only in TEST_MODE."""
    if not device_id:
        return DeviceCommandResult(False, "No device_id configured")

    command_id = secrets.token_hex(8)
    logger.info("IoT Command: device=%s, cmd=%s", device_id, command.value)
    await db.scooter_device_commands.insert_one({
        "command_id": command_id,
        "device_id": device_id,
        "command": command.value,
        "params": params or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    })

    if TEST_MODE:
        await db.scooter_device_commands.update_one(
            {"command_id": command_id},
            {"$set": {
                "status": "success",
                "mode": "simulation",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return DeviceCommandResult(True, f"Command {command.value} sent (test simulation)", {"simulated": True})

    if not _iot_live_configured():
        await db.scooter_device_commands.update_one(
            {"command_id": command_id},
            {"$set": {
                "status": "failed",
                "error": "IoT provider not configured",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return DeviceCommandResult(False, "IoT provider not configured")

    try:
        async with httpx.AsyncClient(timeout=DEVICE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{IOT_PROVIDER_URL}/devices/{device_id}/command",
                json={"command": command.value, "params": params or {}, "command_id": command_id},
                headers={
                    "Authorization": f"Bearer {IOT_API_KEY}",
                    "Idempotency-Key": f"scooter-command:{command_id}",
                },
            )
        if response.status_code not in {200, 201, 202}:
            error_text = response.text[:500]
            await db.scooter_device_commands.update_one(
                {"command_id": command_id},
                {"$set": {
                    "status": "failed",
                    "provider_status": response.status_code,
                    "error": error_text,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            return DeviceCommandResult(False, f"Device provider error: {response.status_code}")

        try:
            data = response.json()
        except Exception:
            data = {"raw": response.text[:500]}
        await db.scooter_device_commands.update_one(
            {"command_id": command_id},
            {"$set": {
                "status": "success",
                "mode": "live",
                "provider_status": response.status_code,
                "response": data,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return DeviceCommandResult(True, "Command accepted by IoT provider", data)
    except httpx.TimeoutException:
        await db.scooter_device_commands.update_one(
            {"command_id": command_id},
            {"$set": {
                "status": "failed",
                "error": "timeout",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return DeviceCommandResult(False, "Device timeout - check connectivity")
    except Exception as exc:
        logger.exception("IoT command failed for %s", device_id)
        await db.scooter_device_commands.update_one(
            {"command_id": command_id},
            {"$set": {
                "status": "failed",
                "error": str(exc)[:500],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return DeviceCommandResult(False, "IoT command failed")

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
async def get_nearby_scooters(lat: Optional[float] = None, lng: Optional[float] = None, radius: float = 5.0):
    """Get available scooters and the canonical local tariff for the explicit user location."""
    effective_enabled = SCOOTER_MODULE_ENABLED and (TEST_MODE or _iot_live_configured())
    fallback_pricing = _default_scooter_pricing()
    if not effective_enabled:
        return {
            "scooters": [],
            "total": 0,
            "module_enabled": False,
            "message": "Scooter-IoT ist noch nicht für Livebetrieb verbunden.",
            "pricing": fallback_pricing,
        }
    if lat is None or lng is None:
        return {
            "scooters": [],
            "total": 0,
            "module_enabled": True,
            "location_required": True,
            "message": "Standortzugriff erforderlich, um Scooter in deiner Nähe anzuzeigen.",
            "pricing": fallback_pricing,
        }
    if not (-90 <= float(lat) <= 90 and -180 <= float(lng) <= 180):
        raise HTTPException(status_code=400, detail="Ungültige Koordinaten")
    radius = max(0.1, min(float(radius), 20.0))
    pricing = await _resolve_scooter_pricing(lat, lng)

    scooters = await db.scooters.find(
        {
            "status": {"$in": ["available", "locked"]},
            "battery": {"$gte": 15},
        },
        {"_id": 0, "device_id": 0}
    ).to_list(100)

    nearby = []
    for s in scooters:
        loc = s.get("location", {})
        slat = loc.get("lat") if loc.get("lat") is not None else s.get("lat")
        slng = loc.get("lng") if loc.get("lng") is not None else s.get("lng")
        if slat is None or slng is None:
            continue
        s["lat"] = slat
        s["lng"] = slng
        if "battery_percent" not in s:
            s["battery_percent"] = s.get("battery", 50)
        if "model" not in s:
            s["model"] = s.get("name", "E-Scooter")
        if "range_km" not in s:
            s["range_km"] = int(s["battery_percent"] * 0.4)
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
        "message": None if nearby else "Keine E-Scooter in deiner Nähe verfügbar",
        "pricing": pricing,
    }


@router.get("/subscription-plans")
async def get_scooter_plans_alt():
    """Get available scooter subscription plans (alias)."""
    return {"plans": SCOOTER_PLANS}


@router.get("/pricing")
async def get_scooter_pricing(lat: Optional[float] = None, lng: Optional[float] = None, address: str = ""):
    """Public local scooter pricing resolved by country/city through the canonical Mobility tariff source."""
    pricing = await _resolve_scooter_pricing(lat, lng, address)
    return {
        **pricing,
        "free_paused_minutes": 5,
        "max_speed_kmh": 25,
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
    if ride:
        ride["rental_id"] = ride.get("ride_id")
        ride["started_at"] = ride.get("start_time")
    return {
        "has_active_rental": bool(ride),
        "has_active": bool(ride),
        "rental": ride,
        "ride": ride,
    }


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
    idempotency_key: Optional[str] = None


@router.post("/unlock")
async def unlock_scooter(req: UnlockRequest, request: Request):
    """Atomically claim a scooter, charge unlock fee once, and start one ride."""
    from core.payment_engine import debit_wallet, credit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    if not SCOOTER_MODULE_ENABLED:
        raise HTTPException(status_code=503, detail="Scooter-Modul ist deaktiviert")
    if not TEST_MODE and not _iot_live_configured():
        raise HTTPException(status_code=503, detail="Scooter-IoT ist noch nicht für Livebetrieb verbunden")
    if not TEST_MODE and user.get("role") != "admin" and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "Bitte verifiziere zuerst deinen Ausweis, um einen Scooter zu mieten.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )
    idempotency_key = _require_scooter_idempotency_key(req.idempotency_key, request, prefix="scooter-unlock")
    claim_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:20]
    ride_id = f"SCR-{claim_hash[:16]}"

    existing_ride = await db.scooter_rides.find_one(
        {"user_id": user_id, "unlock_idempotency_key": idempotency_key},
        {"_id": 0},
    )
    if existing_ride:
        existing_ride["rental_id"] = existing_ride.get("ride_id")
        existing_ride["started_at"] = existing_ride.get("start_time")
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "ride": existing_ride,
            "rental": existing_ride,
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }

    outstanding = await _settle_outstanding_scooter_debts(user)
    if outstanding > 0:
        raise HTTPException(
            status_code=402,
            detail=f"Offener Scooter-Betrag €{outstanding:.2f}. Bitte Wallet aufladen, bevor du eine neue Fahrt startest.",
        )

    active_ride = await db.scooter_rides.find_one({
        "user_id": user_id,
        "status": {"$in": ["active", "paused"]},
    })
    if active_ride:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Fahrt")

    subscription = await _get_active_scooter_subscription(user)
    free_minutes_per_day = int((subscription or {}).get("free_minutes_per_day", 0) or 0)
    free_minutes_remaining_at_start = 0.0
    if subscription and free_minutes_per_day > 0:
        now_for_quota = datetime.now(timezone.utc)
        day_start = now_for_quota.replace(hour=0, minute=0, second=0, microsecond=0)
        prior_rides = await db.scooter_rides.find(
            {
                "user_id": user_id,
                "subscription_id": subscription.get("sub_id"),
                "status": "completed",
                "start_time": {"$gte": day_start.isoformat(), "$lt": now_for_quota.isoformat()},
            },
            {"_id": 0, "duration_minutes": 1},
        ).to_list(200)
        used_minutes = sum(float(item.get("duration_minutes") or 0) for item in prior_rides)
        free_minutes_remaining_at_start = max(0.0, free_minutes_per_day - used_minutes)

    scooter = await db.scooters.find_one({
        "$or": [{"scooter_id": req.scooter_id}, {"qr_code": req.scooter_id}]
    })
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    if scooter.get("battery", 100) < 10:
        raise HTTPException(status_code=400, detail="Scooter Akku zu niedrig")

    scooter_location = scooter.get("location") or {}
    scooter_address = " ".join(str(value) for value in [scooter.get("city"), scooter.get("country"), scooter.get("address")] if value)
    local_pricing = await _resolve_scooter_pricing(
        scooter_location.get("lat", scooter.get("lat")),
        scooter_location.get("lng", scooter.get("lng")),
        scooter_address,
    )
    if not local_pricing.get("available", True):
        raise HTTPException(status_code=503, detail="Für diesen Standort ist noch kein Scooter-Tarif freigeschaltet.")

    ride_unlock_fee = float((subscription or {}).get("unlock_fee", local_pricing["unlock_fee"]))
    ride_rate = float((subscription or {}).get("per_minute_rate", local_pricing["per_minute"]))
    ride_daily_cap = float((subscription or {}).get("daily_cap", local_pricing["daily_cap"]))
    ride_minimum_charge = float((subscription or {}).get("minimum_charge", local_pricing.get("minimum_charge", ride_unlock_fee)) or 0)
    ride_currency = str((subscription or {}).get("currency") or local_pricing.get("currency") or "EUR").upper()
    if ride_currency != "EUR":
        raise HTTPException(
            status_code=503,
            detail=f"Scooter-Tarif in {ride_currency} kann noch nicht sicher über das EUR-Wallet abgerechnet werden.",
        )

    fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
    balance = float(fresh_user.get("balance") or 0)
    required_balance = 0.0 if subscription else float(local_pricing.get("min_balance", MIN_WALLET_BALANCE))
    if balance < required_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Mindestguthaben {required_balance:.2f} {ride_currency} erforderlich. Aktuell: {balance:.2f} {ride_currency}",
        )

    device_id = scooter.get("device_id")
    if not device_id:
        raise HTTPException(status_code=503, detail="Scooter hat keine verbundene IoT-Geräte-ID")

    scooter_id = scooter["scooter_id"]
    original_status = scooter.get("status") or "available"
    claim = await db.scooters.update_one(
        {
            "_id": scooter["_id"],
            "status": {"$in": ["available", "locked"]},
        },
        {
            "$set": {
                "status": "unlocking",
                "unlock_claim_key": claim_hash,
                "unlock_claim_user_id": user_id,
                "unlock_claimed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if claim.modified_count != 1:
        current = await db.scooters.find_one({"_id": scooter["_id"]}) or {}
        if current.get("unlock_claim_key") != claim_hash or current.get("unlock_claim_user_id") != user_id:
            raise HTTPException(status_code=409, detail="Scooter wurde gerade von einem anderen Nutzer reserviert")

    if device_id:
        cmd_result = await send_device_command(device_id, DeviceCommand.UNLOCK)
        if not cmd_result.success:
            await db.scooters.update_one(
                {"_id": scooter["_id"], "unlock_claim_key": claim_hash},
                {"$set": {"status": original_status}, "$unset": {"unlock_claim_key": "", "unlock_claim_user_id": "", "unlock_claimed_at": ""}},
            )
            raise HTTPException(status_code=503, detail=f"Scooter Entsperrung fehlgeschlagen: {cmd_result.message}")

    payment_result = None
    if ride_unlock_fee > 0:
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=ride_unlock_fee,
            tx_type=TransactionType.SCOOTER_PAYMENT,
            description=f"Scooter Entsperrgebühr ({scooter_id})",
            reference=f"SC-{claim_hash[:12].upper()}",
            metadata={"ride_id": ride_id, "scooter_id": scooter_id, "type": "unlock"},
            idempotency_key=idempotency_key,
        )
        if not payment_result.success:
            if device_id:
                await send_device_command(device_id, DeviceCommand.LOCK)
            await db.scooters.update_one(
                {"_id": scooter["_id"], "unlock_claim_key": claim_hash},
                {"$set": {"status": original_status}, "$unset": {"unlock_claim_key": "", "unlock_claim_user_id": "", "unlock_claimed_at": ""}},
            )
            raise HTTPException(status_code=400, detail=payment_result.error or "Entsperrgebühr konnte nicht bezahlt werden")

    now = datetime.now(timezone.utc)
    ride = {
        "ride_id": ride_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "scooter_id": scooter_id,
        "scooter_model": scooter.get("model"),
        "device_id": device_id,
        "status": "active",
        "start_location": scooter.get("location", {}),
        "start_time": now.isoformat(),
        "started_at": now.isoformat(),
        "unlock_fee": ride_unlock_fee,
        "per_minute_rate": ride_rate,
        "daily_cap": ride_daily_cap,
        "minimum_charge": ride_minimum_charge,
        "currency": ride_currency,
        "pricing_context": {
            "profile_scope": local_pricing.get("profile_scope"),
            "source": local_pricing.get("source"),
            "city": local_pricing.get("city"),
            "country": local_pricing.get("country"),
            "country_code": local_pricing.get("country_code"),
            "basis": local_pricing.get("basis"),
        },
        "free_minutes_per_day": free_minutes_per_day,
        "free_minutes_remaining_at_start": round(free_minutes_remaining_at_start, 2),
        "subscription_id": (subscription or {}).get("sub_id"),
        "subscription_plan_id": (subscription or {}).get("plan_id"),
        "current_cost": ride_unlock_fee,
        "distance_km": 0,
        "unlock_idempotency_key": idempotency_key,
        "unlock_payment_transaction_id": payment_result.transaction_id if payment_result else None,
        "payment_status": "unlock_paid" if payment_result else "subscription_unlock",
        "created_at": now.isoformat(),
    }
    await db.scooter_rides.update_one(
        {"ride_id": ride_id, "user_id": user_id},
        {"$setOnInsert": ride},
        upsert=True,
    )

    assigned = await db.scooters.update_one(
        {"_id": scooter["_id"], "unlock_claim_key": claim_hash, "unlock_claim_user_id": user_id},
        {
            "$set": {
                "status": "in_use",
                "current_ride_id": ride_id,
                "current_user_id": user_id,
                "unlocked_at": now.isoformat(),
            },
            "$unset": {"unlock_claim_key": "", "unlock_claim_user_id": "", "unlock_claimed_at": ""},
        },
    )
    if assigned.modified_count != 1:
        refund = None
        if ride_unlock_fee > 0:
            refund = await credit_wallet(
                user_id=user_id,
                amount=ride_unlock_fee,
                tx_type=TransactionType.REFUND,
                description="Scooter Unlock Rollback",
                reference=f"SC-ROLLBACK-{claim_hash[:12].upper()}",
                source="scooter_unlock_rollback",
                metadata={"ride_id": ride_id, "scooter_id": scooter_id},
                idempotency_key=f"scooter-unlock-rollback:{ride_id}",
            )
        await db.scooter_rides.update_one(
            {"ride_id": ride_id, "user_id": user_id},
            {"$set": {"status": "cancelled", "cancel_reason": "scooter_assignment_failed", "refund_transaction_id": refund.transaction_id if refund and refund.success else None}},
        )
        if device_id:
            await send_device_command(device_id, DeviceCommand.LOCK)
        raise HTTPException(status_code=409, detail="Scooter-Zuweisung fehlgeschlagen. Entsperrgebühr wurde zurückgebucht.")

    ride["rental_id"] = ride_id
    return {
        "ok": True,
        "ride": ride,
        "rental": ride,
        "scooter": {
            "scooter_id": scooter_id,
            "model": scooter.get("model"),
            "battery": scooter.get("battery"),
        },
        "new_balance": (
            payment_result.new_balance
            if payment_result
            else float((await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}).get("balance") or 0)
        ),
        "message": "Scooter entsperrt! Gute Fahrt!",
        "replayed": False,
    }


# ══════════════════════════════════════════════════════════════════════════════
# END RIDE / LOCK
# ══════════════════════════════════════════════════════════════════════════════

class EndRideRequest(BaseModel):
    ride_id: Optional[str] = None
    scooter_id: Optional[str] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    end_location: Optional[dict] = None
    parking_photo_url: Optional[str] = None  # Photo proof of correct parking
    idempotency_key: Optional[str] = None


@router.post("/end")
async def end_ride(req: EndRideRequest, request: Request):
    """Lock and finish a ride once; unpaid remainder becomes an explicit debt."""
    from core.payment_engine import debit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    if not TEST_MODE and not _iot_live_configured():
        raise HTTPException(status_code=503, detail="Scooter-IoT ist nicht verfügbar; Fahrt kann nicht sicher beendet werden")

    lookup = {"user_id": user_id}
    if req.ride_id:
        lookup["ride_id"] = req.ride_id
    elif req.scooter_id:
        lookup["scooter_id"] = req.scooter_id

    existing = await db.scooter_rides.find_one(lookup)
    if not existing:
        raise HTTPException(status_code=404, detail="Keine Fahrt gefunden")
    if existing.get("status") == "completed":
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "summary": {
                "ride_id": existing["ride_id"],
                "duration_minutes": existing.get("duration_minutes", 0),
                "total_minutes": existing.get("duration_minutes", 0),
                "distance_km": existing.get("distance_km", 0),
                "unlock_fee": existing.get("unlock_fee", UNLOCK_FEE),
                "ride_cost": existing.get("ride_cost", 0),
                "total_cost": existing.get("total_cost", 0),
                "payment_status": existing.get("payment_status"),
                "amount_due": existing.get("amount_due", 0),
            },
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }
    if existing.get("status") not in {"active", "paused"}:
        raise HTTPException(status_code=400, detail=f"Fahrt kann im Status {existing.get('status')} nicht beendet werden")

    ride = existing
    scooter_id = ride["scooter_id"]
    ride_id = ride["ride_id"]
    device_id = ride.get("device_id")
    now = datetime.now(timezone.utc)

    settlement = ride.get("end_settlement")
    if not settlement:
        start_time = datetime.fromisoformat(ride["start_time"])
        duration_seconds = max(0, (now - start_time).total_seconds())
        duration_minutes = max(1, duration_seconds / 60)
        rate = float(ride.get("per_minute_rate") or PER_MINUTE_RATE)
        unlock_fee = float(ride.get("unlock_fee") if ride.get("unlock_fee") is not None else UNLOCK_FEE)
        free_minutes_per_day = int(ride.get("free_minutes_per_day") or 0)
        if ride.get("free_minutes_remaining_at_start") is not None:
            free_minutes_remaining = max(0.0, float(ride.get("free_minutes_remaining_at_start") or 0))
        else:
            free_minutes_remaining = 0.0
            if free_minutes_per_day > 0 and ride.get("subscription_id"):
                day_start = start_time.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                prior_rides = await db.scooter_rides.find(
                    {
                        "user_id": user_id,
                        "subscription_id": ride.get("subscription_id"),
                        "status": "completed",
                        "start_time": {"$gte": day_start.isoformat(), "$lt": start_time.isoformat()},
                    },
                    {"_id": 0, "duration_minutes": 1},
                ).to_list(200)
                used_minutes = sum(float(item.get("duration_minutes") or 0) for item in prior_rides)
                free_minutes_remaining = max(0.0, free_minutes_per_day - used_minutes)

        free_minutes_used = min(duration_minutes, free_minutes_remaining)
        billable_minutes = max(0.0, duration_minutes - free_minutes_used)
        ride_cost = round(billable_minutes * rate, 2)
        daily_cap = float(ride.get("daily_cap") or MAX_DAILY_CAP)
        minimum_charge = max(0.0, float(ride.get("minimum_charge") or 0))
        total_cost = min(max(round(unlock_fee + ride_cost, 2), minimum_charge), daily_cap)
        ride_cost_to_deduct = max(0.0, round(total_cost - unlock_fee, 2))

        end_location = ride.get("current_location") or ride.get("start_location", {})
        end_lat = req.end_lat
        end_lng = req.end_lng
        if req.end_location:
            end_lat = req.end_location.get("lat")
            end_lng = req.end_location.get("lng")
        if end_lat is not None and end_lng is not None:
            end_location = {"lat": float(end_lat), "lng": float(end_lng)}

        settlement = {
            "quoted_at": now.isoformat(),
            "duration_seconds": round(duration_seconds),
            "duration_minutes": round(duration_minutes),
            "ride_cost": ride_cost,
            "total_cost": total_cost,
            "ride_cost_to_deduct": ride_cost_to_deduct,
            "free_minutes_used": round(free_minutes_used, 2),
            "billable_minutes": round(billable_minutes, 2),
            "end_location": end_location,
        }
        claim = await db.scooter_rides.update_one(
            {"ride_id": ride_id, "user_id": user_id, "status": {"$in": ["active", "paused"]}, "end_settlement": {"$exists": False}},
            {"$set": {"end_settlement": settlement, "end_started_at": now.isoformat()}},
        )
        if claim.modified_count != 1:
            ride = await db.scooter_rides.find_one({"ride_id": ride_id, "user_id": user_id}) or ride
            settlement = ride.get("end_settlement") or settlement

    if not device_id:
        await db.scooter_rides.update_one(
            {"ride_id": ride_id, "user_id": user_id},
            {"$set": {
                "end_lock_status": "failed",
                "end_lock_error": "missing_device_id",
                "end_lock_failed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=503, detail="Scooter-Gerät ist nicht verbunden. Fahrt bleibt aktiv; Support wurde erforderlich.")

    cmd_result = await send_device_command(device_id, DeviceCommand.LOCK)
    if not cmd_result.success:
        logger.error("Lock command failed for %s: %s", scooter_id, cmd_result.message)
        await db.scooter_rides.update_one(
            {"ride_id": ride_id, "user_id": user_id},
            {"$set": {
                "end_lock_status": "failed",
                "end_lock_error": cmd_result.message,
                "end_lock_failed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await db.scooters.update_one(
            {"scooter_id": scooter_id, "current_ride_id": ride_id},
            {"$set": {
                "status": "in_use",
                "lock_error": cmd_result.message,
                "lock_error_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(
            status_code=503,
            detail="Scooter konnte nicht sicher verriegelt werden. Fahrt wurde noch nicht abgeschlossen; bitte erneut versuchen oder Support nutzen.",
        )

    await db.scooter_rides.update_one(
        {"ride_id": ride_id, "user_id": user_id},
        {"$set": {
            "end_lock_status": "confirmed",
            "end_lock_confirmed_at": datetime.now(timezone.utc).isoformat(),
        }, "$unset": {"end_lock_error": "", "end_lock_failed_at": ""}},
    )

    amount_to_debit = round(float(settlement.get("ride_cost_to_deduct") or 0), 2)
    payment_result = None
    payment_status = "paid"
    amount_due = 0.0
    if amount_to_debit > 0:
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=amount_to_debit,
            tx_type=TransactionType.SCOOTER_PAYMENT,
            description=f"Scooter Fahrt ({int(settlement.get('duration_minutes') or 0)} Min)",
            reference=f"SC-RIDE-{ride_id[:12].upper()}",
            metadata={"ride_id": ride_id, "minutes": settlement.get("duration_minutes"), "kind": "ride_end"},
            idempotency_key=f"scooter-end:{ride_id}",
        )
        if not payment_result.success:
            payment_status = "due"
            amount_due = amount_to_debit
            await db.scooter_payment_due.update_one(
                {"ride_id": ride_id, "user_id": user_id},
                {"$setOnInsert": {
                    "ride_id": ride_id,
                    "user_id": user_id,
                    "scooter_id": scooter_id,
                    "amount": amount_due,
                    "status": "due",
                    "reason": payment_result.error or "insufficient_balance",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

    end_location = settlement.get("end_location") or ride.get("start_location", {})
    start_loc = ride.get("start_location", {})
    distance_km = 0.0
    if start_loc.get("lat") is not None and end_location.get("lat") is not None:
        distance_km = haversine_distance(
            start_loc["lat"], start_loc["lng"],
            end_location["lat"], end_location["lng"],
        )

    completed_at = datetime.now(timezone.utc).isoformat()
    await db.scooter_rides.update_one(
        {"ride_id": ride_id, "user_id": user_id, "status": {"$in": ["active", "paused"]}},
        {"$set": {
            "status": "completed",
            "end_time": completed_at,
            "end_location": end_location,
            "duration_seconds": settlement.get("duration_seconds", 0),
            "duration_minutes": settlement.get("duration_minutes", 0),
            "ride_cost": settlement.get("ride_cost", 0),
            "total_cost": settlement.get("total_cost", 0),
            "free_minutes_used": settlement.get("free_minutes_used", 0),
            "billable_minutes": settlement.get("billable_minutes", settlement.get("duration_minutes", 0)),
            "distance_km": round(distance_km, 2),
            "parking_photo_url": req.parking_photo_url,
            "payment_status": payment_status,
            "payment_transaction_id": payment_result.transaction_id if payment_result and payment_result.success else None,
            "amount_due": amount_due,
        }},
    )

    await db.scooters.update_one(
        {"scooter_id": scooter_id, "current_ride_id": ride_id},
        {
            "$set": {
                "status": "available",
                "location": end_location,
                "current_ride_id": None,
                "current_user_id": None,
                "last_ride_end": completed_at,
            },
            "$inc": {
                "total_rides": 1,
                "total_revenue": float(settlement.get("total_cost") or 0),
                "total_distance": distance_km,
            },
        },
    )

    fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
    return {
        "ok": True,
        "summary": {
            "ride_id": ride_id,
            "duration_minutes": settlement.get("duration_minutes", 0),
            "total_minutes": settlement.get("duration_minutes", 0),
            "distance_km": round(distance_km, 2),
            "unlock_fee": float(ride.get("unlock_fee") or UNLOCK_FEE),
            "ride_cost": settlement.get("ride_cost", 0),
            "total_cost": settlement.get("total_cost", 0),
            "payment_status": payment_status,
            "amount_due": amount_due,
        },
        "new_balance": round(float(fresh_user.get("balance") or 0), 2),
        "message": (
            f"Fahrt beendet. Gesamt: €{float(settlement.get('total_cost') or 0):.2f}"
            if payment_status == "paid"
            else f"Fahrt sicher beendet. Offener Betrag: €{amount_due:.2f}"
        ),
        "replayed": False,
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
        {"user_id": user_id, "status": {"$in": ["active", "paused"]}},
        {"_id": 0}
    )
    
    if not ride:
        return {"has_active": False, "ride": None}
    
    start_time = datetime.fromisoformat(ride["start_time"])
    elapsed_seconds = max(0, (datetime.now(timezone.utc) - start_time).total_seconds())
    elapsed_minutes = elapsed_seconds / 60
    unlock_fee = float(ride.get("unlock_fee") if ride.get("unlock_fee") is not None else UNLOCK_FEE)
    rate = float(ride.get("per_minute_rate") or PER_MINUTE_RATE)
    free_remaining = max(0.0, float(ride.get("free_minutes_remaining_at_start") or 0))
    billable_minutes = max(0.0, elapsed_minutes - free_remaining)
    daily_cap = float(ride.get("daily_cap") or MAX_DAILY_CAP)
    minimum_charge = max(0.0, float(ride.get("minimum_charge") or 0))
    current_cost = min(max(round(unlock_fee + (billable_minutes * rate), 2), minimum_charge), daily_cap)

    ride["rental_id"] = ride.get("ride_id")
    ride["started_at"] = ride.get("start_time")
    
    return {
        "has_active": True,
        "has_active_rental": True,
        "ride": ride,
        "rental": ride,
        "live": {
            "elapsed_seconds": round(elapsed_seconds),
            "elapsed_minutes": round(elapsed_minutes, 1),
            "free_minutes_remaining_at_start": round(free_remaining, 1),
            "billable_minutes": round(billable_minutes, 1),
            "current_cost": current_cost,
            "max_cost": daily_cap,
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
    
    for ride in rides:
        ride["rental_id"] = ride.get("ride_id")
        ride["total_minutes"] = ride.get("duration_minutes", 0)

    return {
        "rides": rides,
        "rentals": rides,
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
    device_id: str = Field(..., min_length=2, max_length=128)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    battery: Optional[int] = Field(default=None, ge=0, le=100)
    speed: Optional[float] = Field(default=None, ge=0, le=120)
    locked: Optional[bool] = None
    signal_strength: Optional[int] = Field(default=None, ge=-200, le=0)


@router.post("/device/update")
async def device_location_update(req: DeviceUpdateRequest, request: Request):
    _require_iot_device_ingest_auth(request)
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
async def device_ping(req: DeviceUpdateRequest, request: Request):
    """Authenticated ping from a physical scooter."""
    _require_iot_device_ingest_auth(request)
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
    idempotency_key: Optional[str] = None

@router.post("/subscribe")
async def subscribe_plan(req: SubscribePlanReq, request: Request):
    """Subscribe once through the canonical wallet ledger."""
    from core.payment_engine import debit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    email = user.get("email", "")
    idempotency_key = _require_scooter_idempotency_key(req.idempotency_key, request, prefix="scooter-subscription")
    sub_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:16]
    sub_id = f"SCS-{sub_hash}"

    existing_same = await db.scooter_subscriptions.find_one({"sub_id": sub_id, "user_id": user_id}, {"_id": 0})
    if existing_same:
        return {"ok": True, "subscription": existing_same, "replayed": True}

    plan = next((p for p in SCOOTER_PLANS if p["plan_id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Ungültiger Plan")

    now = datetime.now(timezone.utc)
    active = await _get_active_scooter_subscription(user)
    if active:
        raise HTTPException(400, "Du hast bereits ein aktives Abo")

    await db.users.update_one(
        {"_id": user["_id"], "active_scooter_subscription_id": {"$ne": None}},
        {"$set": {"active_scooter_subscription_id": None}},
    )
    claim = await db.users.update_one(
        {
            "_id": user["_id"],
            "$or": [
                {"active_scooter_subscription_id": {"$exists": False}},
                {"active_scooter_subscription_id": None},
                {"active_scooter_subscription_id": sub_id},
            ],
        },
        {"$set": {"active_scooter_subscription_id": sub_id, "scooter_subscription_claimed_at": now.isoformat()}},
    )
    if claim.modified_count != 1:
        current = await db.users.find_one({"_id": user["_id"]}, {"active_scooter_subscription_id": 1, "_id": 0}) or {}
        if current.get("active_scooter_subscription_id") != sub_id:
            raise HTTPException(status_code=409, detail="Eine andere Abo-Anfrage wird bereits verarbeitet")

    result = await debit_wallet(
        user_id=user_id,
        amount=float(plan["price"]),
        tx_type=TransactionType.SUBSCRIPTION,
        description=f"Scooter {plan['name']}",
        reference=f"SC-SUB-{sub_hash.upper()}",
        metadata={"plan_id": plan["plan_id"], "sub_id": sub_id, "kind": "scooter_subscription"},
        idempotency_key=idempotency_key,
    )
    if not result.success:
        await db.users.update_one(
            {"_id": user["_id"], "active_scooter_subscription_id": sub_id},
            {"$set": {"active_scooter_subscription_id": None}},
        )
        raise HTTPException(status_code=400, detail=result.error or "Abo-Zahlung fehlgeschlagen")

    expires = now + timedelta(days=plan["duration_days"])
    subscription = {
        "sub_id": sub_id,
        "user_id": user_id,
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
        "payment_transaction_id": result.transaction_id,
        "idempotency_key": idempotency_key,
    }
    await db.scooter_subscriptions.update_one(
        {"sub_id": sub_id, "user_id": user_id},
        {"$setOnInsert": subscription},
        upsert=True,
    )
    subscription = await db.scooter_subscriptions.find_one({"sub_id": sub_id, "user_id": user_id}, {"_id": 0}) or subscription
    return {"ok": True, "subscription": subscription, "new_balance": result.new_balance, "replayed": False}


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
    active = await _get_active_scooter_subscription(user)
    if not active:
        raise HTTPException(400, "Kein aktives Abo gefunden")
    result = await db.scooter_subscriptions.update_one(
        {"sub_id": active["sub_id"], "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(400, "Kein aktives Abo gefunden")
    await db.users.update_one(
        {"_id": user["_id"], "active_scooter_subscription_id": active["sub_id"]},
        {"$set": {"active_scooter_subscription_id": None}},
    )
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
