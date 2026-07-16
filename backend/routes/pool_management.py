import json
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from core.config import STRIPE_API_KEY
from core.database import db
from core.security import get_current_user
from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest, StripeCheckout

router = APIRouter(prefix="/api/pool", tags=["pool-management"])

FACILITY_ID = "pool-bluewave"
FACILITY_INFO = {
    "facility_id": FACILITY_ID,
    "name": "BlueWave Aquatics & Family Spa",
    "city": "Hamburg",
    "country": "DE",
    "hero_image": "https://images.unsplash.com/photo-1614667288602-9ac6e37318a7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwyfHxzd2ltbWluZyUyMHBvb2wlMjBpbmRvb3IlMjBibHVlfGVufDB8fHx8MTc4NDE1MzkwN3ww&ixlib=rb-4.1.0&q=85",
    "hours": {
        "de": "Mo–So · 09:00–21:00",
        "en": "Mon–Sun · 09:00–21:00",
    },
    "address": "Elballee 42, 22765 Hamburg",
}

POOL_PACKAGES = {
    "adult-day": {
        "package_id": "adult-day",
        "label_de": "Tagesticket Erwachsene",
        "label_en": "Adult day pass",
        "description_de": "Ganztägiger Eintritt inkl. Badebereich",
        "description_en": "Full-day access including pool area",
        "price": 18.0,
        "max_people": 1,
        "color": "#0088CC",
    },
    "child-day": {
        "package_id": "child-day",
        "label_de": "Tagesticket Kind",
        "label_en": "Child day pass",
        "description_de": "Eintritt für Kinder bis 15 Jahre",
        "description_en": "Entry for children up to 15 years",
        "price": 10.0,
        "max_people": 1,
        "color": "#10B981",
    },
    "family-day": {
        "package_id": "family-day",
        "label_de": "Familienkarte",
        "label_en": "Family pass",
        "description_de": "2 Erwachsene + 2 Kinder, ganztägig",
        "description_en": "2 adults + 2 children, full day",
        "price": 46.0,
        "max_people": 4,
        "color": "#F59E0B",
    },
    "evening-pass": {
        "package_id": "evening-pass",
        "label_de": "Abendticket",
        "label_en": "Evening pass",
        "description_de": "Gültig ab 17:00 Uhr",
        "description_en": "Valid from 17:00 onwards",
        "price": 12.0,
        "max_people": 1,
        "color": "#7C3AED",
    },
    "ten-visit": {
        "package_id": "ten-visit",
        "label_de": "10er Karte",
        "label_en": "10-visit pass",
        "description_de": "Mehrfachkarte für Stammgäste",
        "description_en": "Multi-visit pass for regular guests",
        "price": 149.0,
        "max_people": 1,
        "visits": 10,
        "color": "#EF4444",
    },
}

POOL_EXTRAS = {
    "locker": {
        "extra_id": "locker",
        "label_de": "Spind reservieren",
        "label_en": "Reserve locker",
        "description_de": "Tagesnutzung mit QR/RFID-Zuordnung",
        "description_en": "Daily locker usage with QR/RFID assignment",
        "price": 4.0,
        "weekend_price": 4.5,
        "pricing_mode": "per_booking",
        "access_zones": ["locker_zone"],
    },
    "sauna": {
        "extra_id": "sauna",
        "label_de": "Sauna Upgrade",
        "label_en": "Sauna upgrade",
        "description_de": "Zusatzbereich Sauna & Ruhezone",
        "description_en": "Sauna and relaxation zone add-on",
        "price": 9.0,
        "weekend_price": 10.5,
        "pricing_mode": "per_guest",
        "access_zones": ["sauna_gate", "sauna_zone"],
    },
    "sunbed": {
        "extra_id": "sunbed",
        "label_de": "Liegenpaket",
        "label_en": "Sunbed package",
        "description_de": "Reservierte Liege im Familienbereich",
        "description_en": "Reserved sunbed in family zone",
        "price": 6.0,
        "weekend_price": 7.0,
        "pricing_mode": "per_booking",
        "access_zones": ["sunbed_zone"],
    },
}

SNACK_MENU = {
    "water": {"menu_id": "water", "label_de": "Mineralwasser", "label_en": "Mineral water", "price": 2.5},
    "smoothie": {"menu_id": "smoothie", "label_de": "Frucht-Smoothie", "label_en": "Fruit smoothie", "price": 4.9},
    "fries": {"menu_id": "fries", "label_de": "Pommes", "label_en": "Fries", "price": 4.5},
    "burger": {"menu_id": "burger", "label_de": "Pool Burger", "label_en": "Pool burger", "price": 8.9},
    "icecream": {"menu_id": "icecream", "label_de": "Eisbecher", "label_en": "Ice cream cup", "price": 3.9},
}

TURNSTILES = [
    {"turnstile_id": "ENTRY-01", "label": "Main entry"},
    {"turnstile_id": "EXIT-01", "label": "Main exit"},
    {"turnstile_id": "SPA-01", "label": "Spa lane"},
]

HARDWARE_BLUEPRINT = {
    "architectures": [
        {
            "id": "cloud_only",
            "label_de": "Cloud-Backend direkt",
            "label_en": "Direct cloud backend",
            "fit": "Niedrig bis mittel",
            "note_de": "Einfach, aber für lokale Controller nur bedingt robust.",
            "note_en": "Simple, but only moderately robust for local controllers.",
        },
        {
            "id": "cloud_plus_edge",
            "label_de": "Cloud + lokaler Edge-Dienst",
            "label_en": "Cloud + local edge service",
            "fit": "Hoch",
            "note_de": "Empfohlene Standardarchitektur für Drehkreuze, Relais und Offline-Fallback.",
            "note_en": "Recommended default architecture for turnstiles, relays and offline fallback.",
        },
        {
            "id": "hybrid_gateway",
            "label_de": "Hybrid mit Gateway-Box",
            "label_en": "Hybrid with gateway box",
            "fit": "Sehr hoch",
            "note_de": "Beste Option für mehrere Zonen, hohe Frequenz und verschiedene Hersteller.",
            "note_en": "Best option for multiple zones, high throughput and mixed vendors.",
        },
    ],
    "rfid": {
        "supported_modes": ["nfc_mifare", "qr_wristband"],
        "recommended_patterns": [
            {
                "id": "rfid-reader-http",
                "label": "HTTP reader bridge",
                "protocols": ["HTTP", "Webhook", "Local daemon"],
                "best_for": "REST-fähige Reader oder Edge-Service mit Reader-SDK",
            },
            {
                "id": "rfid-reader-serial",
                "label": "Serial / USB bridge",
                "protocols": ["USB", "Serial", "TCP bridge"],
                "best_for": "MIFARE-/NFC-Leser ohne Cloud-API",
            },
        ],
        "fields": ["wristband_uid", "rfid_family", "reader_id", "encoding", "site_code"],
    },
    "turnstile": {
        "supported_modes": ["http_controller", "tcp_serial_bridge"],
        "commands": ["grant_entry", "grant_exit", "lock_lane", "unlock_lane", "heartbeat"],
        "fields": ["turnstile_id", "controller_url", "lane_direction", "protocol", "auth_token"],
    },
    "locker": {
        "supported_modes": ["network_api", "relay_bridge"],
        "commands": ["open_locker", "close_locker", "reserve_locker", "release_locker", "status_sync"],
        "fields": ["locker_id", "controller_url", "relay_channel", "zone", "fail_safe_mode"],
    },
}

DEFAULT_HARDWARE_CONFIG = {
    "deployment_modes": ["cloud_only", "cloud_plus_edge", "hybrid_gateway"],
    "selected_mode": "cloud_plus_edge",
    "rfid": {
        "enabled": True,
        "provider_mode": "nfc_mifare_and_qr",
        "adapter_type": "edge_reader_bridge",
        "protocols": ["http", "serial"],
        "webhook_path": "/api/pool/hardware/rfid/events",
        "status": "planned",
    },
    "turnstile": {
        "enabled": True,
        "adapter_type": "edge_turnstile_bridge",
        "protocols": ["http", "tcp", "serial"],
        "webhook_path": "/api/pool/hardware/turnstile/events",
        "status": "planned",
    },
    "locker": {
        "enabled": True,
        "adapter_type": "edge_locker_bridge",
        "protocols": ["http", "relay"],
        "webhook_path": "/api/pool/hardware/locker/events",
        "status": "planned",
    },
    "security": {
        "shared_secret_required": True,
        "heartbeat_seconds": 30,
        "allow_offline_queue": True,
        "audit_every_event": True,
    },
    "updated_at": None,
}

POOL_ACCESS_POINTS = [
    {"door_id": "ENTRY-01", "label_de": "Haupteingang", "label_en": "Main entry", "zone_id": "main_entry", "device_type": "turnstile"},
    {"door_id": "EXIT-01", "label_de": "Hauptausgang", "label_en": "Main exit", "zone_id": "main_exit", "device_type": "turnstile"},
    {"door_id": "SPA-01", "label_de": "Sauna-Gate", "label_en": "Spa gate", "zone_id": "sauna_gate", "device_type": "turnstile"},
    {"door_id": "FAM-01", "label_de": "Familienbereich", "label_en": "Family area", "zone_id": "family_zone", "device_type": "door"},
]

TURNSTILE_ZONE_MAP = {
    "ENTRY-01": "main_entry",
    "EXIT-01": "main_exit",
    "SPA-01": "sauna_gate",
}

PACKAGE_COMPATIBILITY_MAP = {
    "adult-day": {"duration_id": "day", "adult_count": 1, "child_count": 0},
    "child-day": {"duration_id": "day", "adult_count": 0, "child_count": 1},
    "family-day": {"duration_id": "day", "adult_count": 2, "child_count": 2},
    "evening-pass": {"duration_id": "evening", "adult_count": 1, "child_count": 0},
    "adult-2h": {"duration_id": "2h", "adult_count": 1, "child_count": 0},
    "child-2h": {"duration_id": "2h", "adult_count": 0, "child_count": 1},
}

DEFAULT_POOL_PRICING_CONFIG = {
    "facility_id": FACILITY_ID,
    "currency": "EUR",
    "weekend_days": [5, 6],
    "guest_rules": {
        "adult_age_from": 16,
        "child_age_to": 15,
    },
    "durations": [
        {"duration_id": "2h", "label_de": "2 Stunden", "label_en": "2 hours", "minutes": 120, "all_day": False},
        {"duration_id": "day", "label_de": "Tagesticket", "label_en": "Day pass", "minutes": 720, "all_day": True},
        {"duration_id": "evening", "label_de": "Abendticket", "label_en": "Evening pass", "minutes": 240, "all_day": False, "valid_from": "17:00"},
    ],
    "rates": {
        "weekday": {
            "2h": {"adult": 12.0, "child": 7.0, "family": 32.0},
            "day": {"adult": 18.0, "child": 10.0, "family": 46.0},
            "evening": {"adult": 12.0, "child": 8.0, "family": 34.0},
        },
        "weekend": {
            "2h": {"adult": 14.0, "child": 8.0, "family": 38.0},
            "day": {"adult": 22.0, "child": 12.0, "family": 56.0},
            "evening": {"adult": 14.0, "child": 9.0, "family": 39.0},
        },
    },
    "family_bundle": {
        "enabled": True,
        "exact_adults": 2,
        "exact_children": 2,
    },
    "extras": {
        "locker": {"weekday": 4.0, "weekend": 4.5, "pricing_mode": "per_booking"},
        "sauna": {"weekday": 9.0, "weekend": 10.5, "pricing_mode": "per_guest"},
        "sunbed": {"weekday": 6.0, "weekend": 7.0, "pricing_mode": "per_booking"},
    },
    "overstay_rules": {
        "enabled": True,
        "grace_minutes": 15,
        "adult_per_30_min": 3.5,
        "child_per_30_min": 2.5,
    },
    "access_profiles": {
        "base_zones": ["main_entry", "main_exit", "pool_hall", "family_zone", "locker_zone"],
        "extra_zone_map": {
            "sauna": ["sauna_gate", "sauna_zone"],
            "sunbed": ["sunbed_zone"],
        },
    },
}


class PoolCheckoutRequest(BaseModel):
    package_id: Optional[str] = None
    duration_id: Optional[str] = None
    adult_count: int = Field(1, ge=0, le=20)
    child_count: int = Field(0, ge=0, le=20)
    visit_date: Optional[str] = None
    quantity: int = Field(1, ge=1, le=10)
    extras: List[str] = Field(default_factory=list)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    origin_url: str


class CashSaleRequest(BaseModel):
    package_id: Optional[str] = None
    duration_id: Optional[str] = None
    adult_count: int = Field(1, ge=0, le=20)
    child_count: int = Field(0, ge=0, le=20)
    visit_date: Optional[str] = None
    quantity: int = Field(1, ge=1, le=10)
    extras: List[str] = Field(default_factory=list)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    payment_method: str = Field("cash")


class LockerAssignRequest(BaseModel):
    ticket_code: str
    locker_id: Optional[str] = None


class LockerReleaseRequest(BaseModel):
    locker_id: Optional[str] = None
    ticket_code: Optional[str] = None


class TurnstileScanRequest(BaseModel):
    scan_code: str
    direction: str = Field("entry")
    turnstile_id: str = Field("ENTRY-01")


class SnackSaleItem(BaseModel):
    menu_id: str
    quantity: int = Field(1, ge=1, le=20)


class SnackSaleRequest(BaseModel):
    items: List[SnackSaleItem]
    payment_method: str = Field("cash")
    ticket_code: Optional[str] = None


class HardwareConfigRequest(BaseModel):
    selected_mode: str = Field("cloud_plus_edge")
    rfid_provider_mode: str = Field("nfc_mifare_and_qr")
    rfid_adapter_type: str = Field("edge_reader_bridge")
    turnstile_adapter_type: str = Field("edge_turnstile_bridge")
    locker_adapter_type: str = Field("edge_locker_bridge")
    shared_secret_hint: Optional[str] = None


class PoolQuoteRequest(BaseModel):
    duration_id: str
    adult_count: int = Field(1, ge=0, le=20)
    child_count: int = Field(0, ge=0, le=20)
    extras: List[str] = Field(default_factory=list)
    visit_date: Optional[str] = None


class PoolPricingConfigRequest(BaseModel):
    pricing_config: dict


class DoorCommandRequest(BaseModel):
    door_id: str
    ticket_code: Optional[str] = None
    action: str = Field("unlock")


class LockerOpenRequest(BaseModel):
    locker_id: str
    ticket_code: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _short_id(prefix: str, length: int = 8) -> str:
    return f"{prefix}-{secrets.token_hex(length // 2).upper()}"


def _package_payload(package_id: str) -> dict:
    package = POOL_PACKAGES[package_id]
    return {
        "package_id": package["package_id"],
        "label_de": package["label_de"],
        "label_en": package["label_en"],
        "description_de": package["description_de"],
        "description_en": package["description_en"],
        "price": float(package["price"]),
        "max_people": package.get("max_people", 1),
        "visits": package.get("visits", 1),
        "color": package.get("color", "#0088CC"),
    }


def _extra_payload(extra_id: str) -> dict:
    extra = POOL_EXTRAS[extra_id]
    return {
        "extra_id": extra["extra_id"],
        "label_de": extra["label_de"],
        "label_en": extra["label_en"],
        "description_de": extra["description_de"],
        "description_en": extra["description_en"],
        "price": float(extra["price"]),
        "weekend_price": float(extra.get("weekend_price", extra["price"])),
        "pricing_mode": extra.get("pricing_mode", "per_booking"),
    }


def _snack_payload(menu_id: str) -> dict:
    snack = SNACK_MENU[menu_id]
    return {
        "menu_id": snack["menu_id"],
        "label_de": snack["label_de"],
        "label_en": snack["label_en"],
        "price": float(snack["price"]),
    }


def _round_money(value: float) -> float:
    return round(float(value or 0), 2)


def _resolve_origin(origin_url: str, request: Request) -> str:
    origin = (origin_url or request.headers.get("origin") or "").strip().rstrip("/")
    if not origin.startswith("http"):
        raise HTTPException(status_code=400, detail="Origin URL fehlt")
    return origin


async def _require_pool_staff(request: Request):
    user = await get_current_user(request)
    role = user.get("role")
    if not (user.get("is_admin") or role in {"admin", "bidblitz_admin", "merchant"}):
        raise HTTPException(status_code=403, detail="Pool-Verwaltung nur für Admin oder Betreiber")
    return user


async def _ensure_lockers():
    count = await db.pool_lockers.count_documents({"facility_id": FACILITY_ID})
    if count:
        return
    docs = []
    for zone in ["A", "B"]:
        for idx in range(1, 5):
            docs.append({
                "locker_id": f"L-{zone}{idx:02d}",
                "facility_id": FACILITY_ID,
                "zone": zone,
                "size": "standard" if idx <= 8 else "family",
                "status": "free",
                "ticket_code": None,
                "wristband_id": None,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
    if docs:
        await db.pool_lockers.insert_many(docs)


def _compute_total(package_id: str, quantity: int, extras: List[str]) -> float:
    if package_id not in POOL_PACKAGES:
        raise HTTPException(status_code=400, detail="Unbekanntes Ticketpaket")
    total = POOL_PACKAGES[package_id]["price"] * quantity
    for extra_id in extras:
        if extra_id not in POOL_EXTRAS:
            raise HTTPException(status_code=400, detail=f"Unbekanntes Extra: {extra_id}")
        total += POOL_EXTRAS[extra_id]["price"] * quantity
    return _round_money(total)


def _parse_extras_json(raw: str | None) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return [item for item in parsed if item in POOL_EXTRAS]
    except Exception:
        return []


def _ticket_public_view(doc: dict | None) -> Optional[dict]:
    if not doc:
        return None
    return {
        "ticket_id": doc.get("ticket_id"),
        "ticket_code": doc.get("ticket_code"),
        "package_id": doc.get("package_id"),
        "package_label_de": doc.get("package_label_de"),
        "package_label_en": doc.get("package_label_en"),
        "quantity": doc.get("quantity", 1),
        "extras": doc.get("extras", []),
        "total_amount": doc.get("total_amount", 0),
        "currency": doc.get("currency", "EUR"),
        "status": doc.get("status"),
        "customer_name": doc.get("customer_name"),
        "customer_email": doc.get("customer_email"),
        "wristband_id": doc.get("wristband_id"),
        "locker_id": doc.get("locker_id"),
        "duration_id": doc.get("duration_id"),
        "duration_label_de": doc.get("duration_label_de"),
        "duration_label_en": doc.get("duration_label_en"),
        "adult_count": doc.get("adult_count", 0),
        "child_count": doc.get("child_count", 0),
        "day_type": doc.get("day_type"),
        "valid_from": doc.get("valid_from"),
        "valid_until": doc.get("valid_until"),
        "access_zones": doc.get("access_zones", []),
        "pricing_breakdown": doc.get("pricing_breakdown", []),
        "overstay_fee": doc.get("overstay_fee", 0),
        "checked_in_at": doc.get("checked_in_at"),
        "checked_out_at": doc.get("checked_out_at"),
        "created_at": doc.get("created_at"),
        "source": doc.get("source"),
    }


def _locker_public_view(doc: dict) -> dict:
    return {
        "locker_id": doc.get("locker_id"),
        "zone": doc.get("zone"),
        "size": doc.get("size"),
        "status": doc.get("status"),
        "ticket_code": doc.get("ticket_code"),
        "wristband_id": doc.get("wristband_id"),
        "updated_at": doc.get("updated_at"),
    }


def _access_event_view(doc: dict) -> dict:
    return {
        "event_id": doc.get("event_id"),
        "ticket_code": doc.get("ticket_code"),
        "direction": doc.get("direction"),
        "turnstile_id": doc.get("turnstile_id"),
        "status": doc.get("status"),
        "message": doc.get("message"),
        "created_at": doc.get("created_at"),
    }


def _sale_view(doc: dict) -> dict:
    return {
        "sale_id": doc.get("sale_id"),
        "receipt_code": doc.get("receipt_code"),
        "items": doc.get("items", []),
        "subtotal": doc.get("subtotal", 0),
        "total_amount": doc.get("total_amount", 0),
        "payment_method": doc.get("payment_method"),
        "ticket_code": doc.get("ticket_code"),
        "created_at": doc.get("created_at"),
        "status": doc.get("status"),
    }


def _hardware_log_view(doc: dict) -> dict:
    return {
        "event_id": doc.get("event_id"),
        "device_type": doc.get("device_type"),
        "adapter_type": doc.get("adapter_type"),
        "status": doc.get("status"),
        "message": doc.get("message"),
        "payload_summary": doc.get("payload_summary"),
        "created_at": doc.get("created_at"),
    }


def _hardware_command_view(doc: dict) -> dict:
    return {
        "command_id": doc.get("command_id"),
        "device_type": doc.get("device_type"),
        "device_id": doc.get("device_id"),
        "action": doc.get("action"),
        "status": doc.get("status"),
        "message": doc.get("message"),
        "payload": doc.get("payload", {}),
        "created_at": doc.get("created_at"),
    }


async def _ensure_hardware_config():
    existing = await db.pool_hardware_config.find_one({"facility_id": FACILITY_ID}, {"_id": 0})
    if existing:
        return existing
    doc = {"facility_id": FACILITY_ID, **DEFAULT_HARDWARE_CONFIG, "updated_at": _now_iso()}
    await db.pool_hardware_config.insert_one(doc)
    doc.pop("_id", None)
    return doc


def _clone_pricing_defaults() -> dict:
    return json.loads(json.dumps(DEFAULT_POOL_PRICING_CONFIG))


def _safe_float(value, fallback: float) -> float:
    try:
        return round(float(value), 2)
    except Exception:
        return round(float(fallback), 2)


def _safe_int(value, fallback: int, minimum: int | None = None, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except Exception:
        parsed = fallback
    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _normalize_pricing_config(raw: dict | None) -> dict:
    config = _clone_pricing_defaults()
    raw = raw or {}

    if isinstance(raw.get("weekend_days"), list):
        days = [day for day in raw.get("weekend_days", []) if isinstance(day, int) and 0 <= day <= 6]
        if days:
            config["weekend_days"] = sorted(set(days))

    raw_durations = raw.get("durations") if isinstance(raw.get("durations"), list) else []
    normalized_durations = []
    for default_duration in config["durations"]:
        override = next((item for item in raw_durations if item.get("duration_id") == default_duration["duration_id"]), {})
        normalized = {
            **default_duration,
            "label_de": str(override.get("label_de", default_duration["label_de"])),
            "label_en": str(override.get("label_en", default_duration["label_en"])),
            "minutes": _safe_int(override.get("minutes"), default_duration["minutes"], 30, 1440),
        }
        if default_duration.get("valid_from"):
            normalized["valid_from"] = str(override.get("valid_from", default_duration.get("valid_from")))
        normalized_durations.append(normalized)
    config["durations"] = normalized_durations

    raw_rates = raw.get("rates") if isinstance(raw.get("rates"), dict) else {}
    for day_type in ["weekday", "weekend"]:
        for duration in config["durations"]:
            duration_id = duration["duration_id"]
            source = (((raw_rates.get(day_type) or {}).get(duration_id)) or {})
            defaults = config["rates"][day_type][duration_id]
            config["rates"][day_type][duration_id] = {
                "adult": _safe_float(source.get("adult"), defaults["adult"]),
                "child": _safe_float(source.get("child"), defaults["child"]),
                "family": _safe_float(source.get("family"), defaults["family"]),
            }

    raw_extras = raw.get("extras") if isinstance(raw.get("extras"), dict) else {}
    for extra_id, defaults in config["extras"].items():
        source = raw_extras.get(extra_id) if isinstance(raw_extras.get(extra_id), dict) else {}
        defaults["weekday"] = _safe_float(source.get("weekday"), defaults["weekday"])
        defaults["weekend"] = _safe_float(source.get("weekend"), defaults["weekend"])
        defaults["pricing_mode"] = source.get("pricing_mode") if source.get("pricing_mode") in {"per_booking", "per_guest"} else defaults["pricing_mode"]

    raw_family = raw.get("family_bundle") if isinstance(raw.get("family_bundle"), dict) else {}
    config["family_bundle"]["enabled"] = bool(raw_family.get("enabled", config["family_bundle"]["enabled"]))
    config["family_bundle"]["exact_adults"] = _safe_int(raw_family.get("exact_adults"), config["family_bundle"]["exact_adults"], 1, 4)
    config["family_bundle"]["exact_children"] = _safe_int(raw_family.get("exact_children"), config["family_bundle"]["exact_children"], 1, 6)

    raw_overstay = raw.get("overstay_rules") if isinstance(raw.get("overstay_rules"), dict) else {}
    config["overstay_rules"]["enabled"] = bool(raw_overstay.get("enabled", config["overstay_rules"]["enabled"]))
    config["overstay_rules"]["grace_minutes"] = _safe_int(raw_overstay.get("grace_minutes"), config["overstay_rules"]["grace_minutes"], 0, 180)
    config["overstay_rules"]["adult_per_30_min"] = _safe_float(raw_overstay.get("adult_per_30_min"), config["overstay_rules"]["adult_per_30_min"])
    config["overstay_rules"]["child_per_30_min"] = _safe_float(raw_overstay.get("child_per_30_min"), config["overstay_rules"]["child_per_30_min"])
    return config


async def _ensure_pricing_config():
    existing = await db.pool_pricing_config.find_one({"facility_id": FACILITY_ID}, {"_id": 0})
    if existing:
        normalized = _normalize_pricing_config(existing)
        normalized["facility_id"] = FACILITY_ID
        return normalized
    doc = _normalize_pricing_config({})
    doc["facility_id"] = FACILITY_ID
    doc["updated_at"] = _now_iso()
    await db.pool_pricing_config.insert_one(doc)
    doc.pop("_id", None)
    return doc


def _parse_visit_datetime(raw: str | None) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)
    value = str(raw).strip()
    try:
        if len(value) <= 10:
            return datetime.fromisoformat(f"{value}T10:00:00+00:00")
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Ungültiges Besuchsdatum") from exc


def _duration_config(pricing_config: dict, duration_id: str) -> dict:
    duration = next((item for item in pricing_config.get("durations", []) if item.get("duration_id") == duration_id), None)
    if not duration:
        raise HTTPException(status_code=400, detail="Unbekannte Tarifdauer")
    return duration


def _quote_access_zones(pricing_config: dict, extras: list[str]) -> list[str]:
    zones = list(pricing_config.get("access_profiles", {}).get("base_zones", []))
    extra_zone_map = pricing_config.get("access_profiles", {}).get("extra_zone_map", {})
    for extra_id in extras:
        zones.extend(extra_zone_map.get(extra_id, []))
        zones.extend(POOL_EXTRAS.get(extra_id, {}).get("access_zones", []))
    return list(dict.fromkeys(zone for zone in zones if zone))


def _compute_overstay_fee(ticket: dict, pricing_config: dict, checkout_dt: datetime | None = None) -> float:
    rules = pricing_config.get("overstay_rules", {})
    if not rules.get("enabled") or not ticket.get("valid_until"):
        return 0.0
    try:
        valid_until = datetime.fromisoformat(ticket["valid_until"])
        current = checkout_dt or datetime.now(timezone.utc)
        over_minutes = max(0, int((current - valid_until).total_seconds() // 60) - int(rules.get("grace_minutes", 0)))
        if over_minutes <= 0:
            return 0.0
        chunks = (over_minutes + 29) // 30
        adult_fee = chunks * float(rules.get("adult_per_30_min", 0)) * int(ticket.get("adult_count", 0) or 0)
        child_fee = chunks * float(rules.get("child_per_30_min", 0)) * int(ticket.get("child_count", 0) or 0)
        return _round_money(adult_fee + child_fee)
    except Exception:
        return 0.0


def _quote_pool_booking(duration_id: str, adult_count: int, child_count: int, extras: list[str], visit_date: str | None, pricing_config: dict) -> dict:
    adult_count = max(0, int(adult_count or 0))
    child_count = max(0, int(child_count or 0))
    if adult_count + child_count <= 0:
        raise HTTPException(status_code=400, detail="Mindestens ein Gast erforderlich")

    visit_dt = _parse_visit_datetime(visit_date)
    day_type = "weekend" if visit_dt.weekday() in pricing_config.get("weekend_days", [5, 6]) else "weekday"
    duration = _duration_config(pricing_config, duration_id)
    rates = ((pricing_config.get("rates") or {}).get(day_type) or {}).get(duration_id) or {}
    adult_rate = float(rates.get("adult", 0))
    child_rate = float(rates.get("child", 0))
    family_rate = float(rates.get("family", 0))

    breakdown = []
    subtotal = 0.0
    applied_family_bundle = False
    family_cfg = pricing_config.get("family_bundle", {})
    if (
        family_cfg.get("enabled")
        and adult_count == int(family_cfg.get("exact_adults", 2))
        and child_count == int(family_cfg.get("exact_children", 2))
        and family_rate > 0
        and family_rate < (adult_count * adult_rate + child_count * child_rate)
    ):
        applied_family_bundle = True
        subtotal = family_rate
        breakdown.append({
            "type": "family_bundle",
            "label_de": f"Familienkarte {duration.get('label_de')}",
            "label_en": f"Family pass {duration.get('label_en')}",
            "quantity": 1,
            "unit_price": family_rate,
            "line_total": family_rate,
        })
    else:
        if adult_count:
            line_total = _round_money(adult_count * adult_rate)
            subtotal += line_total
            breakdown.append({
                "type": "adult",
                "label_de": f"Erwachsene × {adult_count}",
                "label_en": f"Adults × {adult_count}",
                "quantity": adult_count,
                "unit_price": adult_rate,
                "line_total": line_total,
            })
        if child_count:
            line_total = _round_money(child_count * child_rate)
            subtotal += line_total
            breakdown.append({
                "type": "child",
                "label_de": f"Kinder × {child_count}",
                "label_en": f"Children × {child_count}",
                "quantity": child_count,
                "unit_price": child_rate,
                "line_total": line_total,
            })

    extras_total = 0.0
    total_guests = adult_count + child_count
    for extra_id in extras:
        extra = POOL_EXTRAS.get(extra_id)
        extra_cfg = (pricing_config.get("extras") or {}).get(extra_id, {})
        if not extra:
            raise HTTPException(status_code=400, detail=f"Unbekanntes Extra: {extra_id}")
        unit_price = float(extra_cfg.get(day_type, extra.get("weekend_price") if day_type == "weekend" else extra.get("price", 0)))
        pricing_mode = extra_cfg.get("pricing_mode", extra.get("pricing_mode", "per_booking"))
        units = total_guests if pricing_mode == "per_guest" else 1
        line_total = _round_money(unit_price * units)
        extras_total += line_total
        breakdown.append({
            "type": "extra",
            "extra_id": extra_id,
            "label_de": extra.get("label_de"),
            "label_en": extra.get("label_en"),
            "quantity": units,
            "unit_price": unit_price,
            "line_total": line_total,
        })

    total = _round_money(subtotal + extras_total)
    return {
        "pricing_mode": "dynamic",
        "duration_id": duration_id,
        "duration_label_de": duration.get("label_de"),
        "duration_label_en": duration.get("label_en"),
        "duration_minutes": int(duration.get("minutes", 0) or 0),
        "visit_date": visit_dt.date().isoformat(),
        "day_type": day_type,
        "is_weekend": day_type == "weekend",
        "adult_count": adult_count,
        "child_count": child_count,
        "total_guests": total_guests,
        "subtotal": _round_money(subtotal),
        "extras_total": _round_money(extras_total),
        "total": total,
        "currency": pricing_config.get("currency", "EUR"),
        "breakdown": breakdown,
        "applied_family_bundle": applied_family_bundle,
        "access_zones": _quote_access_zones(pricing_config, extras),
    }


def _legacy_quote(package_id: str, quantity: int, extras: list[str]) -> dict:
    if package_id not in POOL_PACKAGES:
        raise HTTPException(status_code=400, detail="Unbekanntes Ticketpaket")
    package = POOL_PACKAGES[package_id]
    total = _compute_total(package_id, quantity, extras)
    return {
        "pricing_mode": "legacy",
        "package_id": package_id,
        "package_label_de": package["label_de"],
        "package_label_en": package["label_en"],
        "adult_count": 1 if package_id.startswith("adult") or package_id == "evening-pass" else 0,
        "child_count": 1 if package_id.startswith("child") else 0,
        "duration_id": "day" if "day" in package_id else "evening",
        "duration_label_de": package["label_de"],
        "duration_label_en": package["label_en"],
        "duration_minutes": 720 if "day" in package_id else 240,
        "day_type": "weekday",
        "visit_date": datetime.now(timezone.utc).date().isoformat(),
        "subtotal": total,
        "extras_total": 0.0,
        "total": total,
        "currency": "EUR",
        "breakdown": [{
            "type": "package",
            "label_de": package["label_de"],
            "label_en": package["label_en"],
            "quantity": quantity,
            "unit_price": package["price"],
            "line_total": total,
        }],
        "applied_family_bundle": package_id == "family-day",
        "access_zones": _quote_access_zones(DEFAULT_POOL_PRICING_CONFIG, extras),
    }


async def _resolve_booking_quote(package_id: str | None, duration_id: str | None, adult_count: int, child_count: int, quantity: int, extras: list[str], visit_date: str | None) -> dict:
    pricing_config = await _ensure_pricing_config()
    if duration_id:
        return _quote_pool_booking(duration_id, adult_count, child_count, extras, visit_date, pricing_config)
    if package_id in PACKAGE_COMPATIBILITY_MAP:
        mapped = PACKAGE_COMPATIBILITY_MAP[package_id]
        return _quote_pool_booking(mapped["duration_id"], mapped["adult_count"], mapped["child_count"], extras, visit_date, pricing_config)
    return _legacy_quote(package_id or "", quantity, extras)


async def _enqueue_hardware_command(device_type: str, device_id: str, action: str, payload: dict, message: str):
    command_doc = {
        "command_id": _short_id("HWC", 10),
        "facility_id": FACILITY_ID,
        "device_type": device_type,
        "device_id": device_id,
        "action": action,
        "status": "queued",
        "message": message,
        "payload": payload,
        "created_at": _now_iso(),
    }
    await db.pool_hardware_commands.insert_one(command_doc)
    return command_doc


async def _record_hardware_event(device_type: str, adapter_type: str, status: str, message: str, payload_summary: dict | None = None):
    event_doc = {
        "event_id": _short_id("HWE", 10),
        "facility_id": FACILITY_ID,
        "device_type": device_type,
        "adapter_type": adapter_type,
        "status": status,
        "message": message,
        "payload_summary": payload_summary or {},
        "created_at": _now_iso(),
    }
    await db.pool_hardware_events.insert_one(event_doc)
    return event_doc


async def _issue_ticket_from_transaction(tx: dict) -> dict:
    existing = await db.pool_tickets.find_one({"session_id": tx.get("session_id")}, {"_id": 0})
    if existing:
        return existing

    metadata = tx.get("metadata") or {}
    package_id = metadata.get("package_id")
    pricing_snapshot = tx.get("pricing_snapshot") or {}
    if package_id and package_id not in POOL_PACKAGES and package_id not in PACKAGE_COMPATIBILITY_MAP:
        raise HTTPException(status_code=400, detail="Ticketpaket im Payment ungültig")
    extras = _parse_extras_json(metadata.get("extras_json"))
    quantity = max(1, int(metadata.get("quantity", 1)))
    ticket_code = _short_id("POOL", 10)
    now_iso = _now_iso()
    package = POOL_PACKAGES.get(package_id) if package_id else None
    package_label_de = pricing_snapshot.get("duration_label_de") or (package or {}).get("label_de") or "Pool Ticket"
    package_label_en = pricing_snapshot.get("duration_label_en") or (package or {}).get("label_en") or "Pool ticket"
    ticket_doc = {
        "ticket_id": _short_id("PTK", 10),
        "ticket_code": ticket_code,
        "facility_id": FACILITY_ID,
        "package_id": package_id,
        "package_label_de": package_label_de,
        "package_label_en": package_label_en,
        "quantity": quantity,
        "extras": extras,
        "total_amount": _round_money(float(tx.get("amount", 0))),
        "currency": (tx.get("currency") or "EUR").upper(),
        "status": "paid",
        "customer_name": tx.get("customer_name") or metadata.get("customer_name"),
        "customer_email": tx.get("customer_email") or metadata.get("customer_email"),
        "source": "online",
        "payment_method": "stripe",
        "session_id": tx.get("session_id"),
        "wristband_id": None,
        "locker_id": None,
        "duration_id": pricing_snapshot.get("duration_id"),
        "duration_label_de": pricing_snapshot.get("duration_label_de"),
        "duration_label_en": pricing_snapshot.get("duration_label_en"),
        "adult_count": int(pricing_snapshot.get("adult_count", 0) or 0),
        "child_count": int(pricing_snapshot.get("child_count", 0) or 0),
        "day_type": pricing_snapshot.get("day_type"),
        "valid_from": None,
        "valid_until": None,
        "access_zones": pricing_snapshot.get("access_zones", []),
        "pricing_breakdown": pricing_snapshot.get("breakdown", []),
        "visit_date": pricing_snapshot.get("visit_date"),
        "checked_in_at": None,
        "checked_out_at": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.pool_tickets.insert_one(ticket_doc)
    await db.payment_transactions.update_one(
        {"session_id": tx.get("session_id")},
        {"$set": {"ticket_code": ticket_code, "updated_at": now_iso}},
    )
    return ticket_doc


async def handle_pool_ticket_webhook(session_id: str):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "type": "pool_ticket"}, {"_id": 0})
    if not tx:
        return None
    lock = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "type": "pool_ticket", "ticket_issued": {"$ne": True}},
        {"$set": {"ticket_issued": True, "status": "credited", "payment_status": "paid", "updated_at": _now_iso()}},
        projection={"_id": 0},
        return_document=ReturnDocument.BEFORE,
    )
    if lock:
        return await _issue_ticket_from_transaction(lock)
    return await db.pool_tickets.find_one({"session_id": session_id}, {"_id": 0})


async def _build_public_overview() -> dict:
    await _ensure_lockers()
    hardware_config = await _ensure_hardware_config()
    pricing_config = await _ensure_pricing_config()
    active_guests = await db.pool_tickets.count_documents({"facility_id": FACILITY_ID, "status": "active"})
    total_lockers = await db.pool_lockers.count_documents({"facility_id": FACILITY_ID})
    free_lockers = await db.pool_lockers.count_documents({"facility_id": FACILITY_ID, "status": "free"})
    return {
        "facility": {
            **FACILITY_INFO,
            "hardware_modes": {
                "rfid": hardware_config.get("rfid", {}).get("status", "planned"),
                "turnstile_bridge": hardware_config.get("turnstile", {}).get("status", "planned"),
                "locker_relays": hardware_config.get("locker", {}).get("status", "planned"),
            },
            "supported_payments": ["cash", "card", "online"],
        },
        "packages": [_package_payload(package_id) for package_id in POOL_PACKAGES],
        "extras": [_extra_payload(extra_id) for extra_id in POOL_EXTRAS],
        "snack_menu": [_snack_payload(menu_id) for menu_id in SNACK_MENU],
        "pricing_config": pricing_config,
        "access_points": POOL_ACCESS_POINTS,
        "occupancy": {
            "inside_now": active_guests,
            "total_lockers": total_lockers,
            "available_lockers": free_lockers,
        },
        "highlights": [
            {"id": "qr", "title_de": "QR / RFID vorbereitet", "title_en": "QR / RFID ready"},
            {"id": "locker", "title_de": "Spindmanagement live", "title_en": "Locker management live"},
            {"id": "payments", "title_de": "Kasse + Online-Zahlung", "title_en": "Cashier + online payments"},
        ],
    }


@router.get("/public/overview")
async def public_pool_overview():
    return await _build_public_overview()


@router.post("/public/pricing/quote")
async def get_pool_pricing_quote(req: PoolQuoteRequest):
    pricing_config = await _ensure_pricing_config()
    quote = _quote_pool_booking(req.duration_id, req.adult_count, req.child_count, req.extras, req.visit_date, pricing_config)
    quote["pricing_config"] = {
        "currency": pricing_config.get("currency", "EUR"),
        "weekend_days": pricing_config.get("weekend_days", [5, 6]),
    }
    return quote


@router.post("/public/tickets/checkout")
async def create_pool_checkout(req: PoolCheckoutRequest, request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe ist nicht konfiguriert")
    origin = _resolve_origin(req.origin_url, request)
    quote = await _resolve_booking_quote(req.package_id, req.duration_id, req.adult_count, req.child_count, req.quantity, req.extras, req.visit_date)
    total = quote["total"]
    metadata = {
        "type": "pool_ticket",
        "facility_id": FACILITY_ID,
        "package_id": req.package_id or "",
        "duration_id": req.duration_id or quote.get("duration_id") or "",
        "adult_count": str(quote.get("adult_count", req.adult_count)),
        "child_count": str(quote.get("child_count", req.child_count)),
        "visit_date": quote.get("visit_date") or req.visit_date or "",
        "quantity": str(req.quantity),
        "extras_json": json.dumps(req.extras),
        "customer_name": req.customer_name or "",
        "customer_email": req.customer_email or "",
    }
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    session = await stripe_checkout.create_checkout_session(
        CheckoutSessionRequest(
            amount=float(total),
            currency="eur",
            success_url=f"{origin}/pool?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/pool?cancelled=1",
            metadata=metadata,
            payment_methods=["card"],
        )
    )
    now_iso = _now_iso()
    await db.payment_transactions.update_one(
        {"session_id": session.session_id},
        {
            "$set": {
                "payment_id": _short_id("PTX", 10),
                "session_id": session.session_id,
                "amount": total,
                "currency": "EUR",
                "type": "pool_ticket",
                "status": "initiated",
                "payment_status": "pending",
                "customer_name": req.customer_name,
                "customer_email": req.customer_email,
                "facility_id": FACILITY_ID,
                "metadata": metadata,
                "pricing_snapshot": quote,
                "updated_at": now_iso,
                "created_at": now_iso,
            }
        },
        upsert=True,
    )
    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "amount": total,
        "currency": "EUR",
    }


@router.get("/public/tickets/checkout-status/{session_id}")
async def get_pool_checkout_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "type": "pool_ticket"}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Checkout-Session nicht gefunden")

    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    new_status = "completed" if checkout_status.payment_status == "paid" else checkout_status.status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": new_status, "payment_status": checkout_status.payment_status, "updated_at": _now_iso()}},
    )
    ticket = None
    if checkout_status.payment_status == "paid":
        ticket = await handle_pool_ticket_webhook(session_id)
    else:
        ticket = await db.pool_tickets.find_one({"session_id": session_id}, {"_id": 0})

    return {
        "status": new_status,
        "payment_status": checkout_status.payment_status,
        "amount_total": checkout_status.amount_total,
        "currency": checkout_status.currency,
        "ticket": _ticket_public_view(ticket),
    }


@router.get("/admin/dashboard")
async def get_pool_admin_dashboard(request: Request):
    user = await _require_pool_staff(request)
    await _ensure_lockers()
    hardware_config = await _ensure_hardware_config()
    pricing_config = await _ensure_pricing_config()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    recent_tickets = await db.pool_tickets.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12)
    recent_access = await db.pool_access_events.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12)
    recent_sales = await db.pool_pos_sales.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12)
    hardware_events = await db.pool_hardware_events.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12)
    hardware_commands = await db.pool_hardware_commands.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12)
    locker_docs = await db.pool_lockers.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("locker_id", 1).limit(48).to_list(48)

    tickets_today = [doc async for doc in db.pool_tickets.find({"facility_id": FACILITY_ID, "created_at": {"$gte": today_start}}, {"_id": 0, "total_amount": 1})]
    sales_today = [doc async for doc in db.pool_pos_sales.find({"facility_id": FACILITY_ID, "created_at": {"$gte": today_start}}, {"_id": 0, "total_amount": 1})]

    return {
        "facility": FACILITY_INFO,
        "staff": {"name": user.get("name") or user.get("email"), "role": user.get("role")},
        "packages": [_package_payload(package_id) for package_id in POOL_PACKAGES],
        "extras": [_extra_payload(extra_id) for extra_id in POOL_EXTRAS],
        "snack_menu": [_snack_payload(menu_id) for menu_id in SNACK_MENU],
        "pricing_config": pricing_config,
        "access_points": POOL_ACCESS_POINTS,
        "metrics": {
            "ticket_revenue_today": _round_money(sum(doc.get("total_amount", 0) for doc in tickets_today)),
            "snack_revenue_today": _round_money(sum(doc.get("total_amount", 0) for doc in sales_today)),
            "active_guests": await db.pool_tickets.count_documents({"facility_id": FACILITY_ID, "status": "active"}),
            "tickets_today": len(tickets_today),
            "lockers_occupied": await db.pool_lockers.count_documents({"facility_id": FACILITY_ID, "status": "occupied"}),
            "turnstile_entries_today": await db.pool_access_events.count_documents({"facility_id": FACILITY_ID, "direction": "entry", "created_at": {"$gte": today_start}, "status": "success"}),
        },
        "recent_tickets": [_ticket_public_view(doc) for doc in recent_tickets],
        "recent_access": [_access_event_view(doc) for doc in recent_access],
        "recent_sales": [_sale_view(doc) for doc in recent_sales],
        "hardware_blueprint": HARDWARE_BLUEPRINT,
        "hardware_config": hardware_config,
        "hardware_events": [_hardware_log_view(doc) for doc in hardware_events],
        "hardware_commands": [_hardware_command_view(doc) for doc in hardware_commands],
        "lockers": [_locker_public_view(doc) for doc in locker_docs],
        "hardware_modes": {
            "rfid": hardware_config.get("rfid", {}).get("status", "planned"),
            "turnstile_bridge": hardware_config.get("turnstile", {}).get("status", "planned"),
            "locker_relays": hardware_config.get("locker", {}).get("status", "planned"),
        },
    }


@router.get("/admin/hardware/config")
async def get_pool_hardware_config(request: Request):
    await _require_pool_staff(request)
    config = await db.pool_hardware_config.find_one({"facility_id": FACILITY_ID}, {"_id": 0})
    if not config:
        config = await _ensure_hardware_config()
    events = await db.pool_hardware_events.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    commands = await db.pool_hardware_commands.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {
        "facility": FACILITY_INFO,
        "hardware_blueprint": HARDWARE_BLUEPRINT,
        "hardware_config": config,
        "hardware_events": [_hardware_log_view(doc) for doc in events],
        "hardware_commands": [_hardware_command_view(doc) for doc in commands],
    }


@router.get("/admin/pricing/config")
async def get_pool_pricing_config(request: Request):
    await _require_pool_staff(request)
    pricing_config = await _ensure_pricing_config()
    return {
        "facility": FACILITY_INFO,
        "pricing_config": pricing_config,
        "extras": [_extra_payload(extra_id) for extra_id in POOL_EXTRAS],
        "access_points": POOL_ACCESS_POINTS,
    }


@router.post("/admin/pricing/config")
async def update_pool_pricing_config(req: PoolPricingConfigRequest, request: Request):
    user = await _require_pool_staff(request)
    normalized = _normalize_pricing_config(req.pricing_config)
    normalized["facility_id"] = FACILITY_ID
    normalized["updated_at"] = _now_iso()
    normalized["updated_by"] = str(user.get("_id"))
    await db.pool_pricing_config.update_one({"facility_id": FACILITY_ID}, {"$set": normalized}, upsert=True)
    return {"ok": True, "pricing_config": normalized}


@router.post("/admin/hardware/config")
async def update_pool_hardware_config(req: HardwareConfigRequest, request: Request):
    user = await _require_pool_staff(request)
    if req.selected_mode not in DEFAULT_HARDWARE_CONFIG["deployment_modes"]:
        raise HTTPException(status_code=400, detail="Ungültiger deployment mode")
    now_iso = _now_iso()
    update_doc = {
        "selected_mode": req.selected_mode,
        "rfid.enabled": True,
        "rfid.provider_mode": req.rfid_provider_mode,
        "rfid.adapter_type": req.rfid_adapter_type,
        "rfid.status": "planned",
        "turnstile.enabled": True,
        "turnstile.adapter_type": req.turnstile_adapter_type,
        "turnstile.status": "planned",
        "locker.enabled": True,
        "locker.adapter_type": req.locker_adapter_type,
        "locker.status": "planned",
        "security.shared_secret_hint": req.shared_secret_hint or "configured-via-edge",
        "updated_at": now_iso,
        "updated_by": str(user.get("_id")),
    }
    await db.pool_hardware_config.update_one({"facility_id": FACILITY_ID}, {"$set": update_doc}, upsert=True)
    event = await _record_hardware_event(
        "config",
        "admin_blueprint",
        "updated",
        "Hardware blueprint updated",
        {
            "selected_mode": req.selected_mode,
            "rfid": req.rfid_adapter_type,
            "turnstile": req.turnstile_adapter_type,
            "locker": req.locker_adapter_type,
        },
    )
    config = await db.pool_hardware_config.find_one({"facility_id": FACILITY_ID}, {"_id": 0})
    return {"ok": True, "hardware_config": config, "hardware_event": _hardware_log_view(event)}


@router.post("/admin/tickets/cash-sale")
async def create_cash_sale_ticket(req: CashSaleRequest, request: Request):
    user = await _require_pool_staff(request)
    quote = await _resolve_booking_quote(req.package_id, req.duration_id, req.adult_count, req.child_count, req.quantity, req.extras, req.visit_date)
    total = quote["total"]
    package = POOL_PACKAGES.get(req.package_id) if req.package_id else None
    payment_method = req.payment_method if req.payment_method in {"cash", "card"} else "cash"
    now_iso = _now_iso()
    ticket_doc = {
        "ticket_id": _short_id("PTK", 10),
        "ticket_code": _short_id("POOL", 10),
        "facility_id": FACILITY_ID,
        "package_id": req.package_id,
        "package_label_de": quote.get("duration_label_de") or (package or {}).get("label_de") or "Pool Ticket",
        "package_label_en": quote.get("duration_label_en") or (package or {}).get("label_en") or "Pool ticket",
        "quantity": req.quantity,
        "extras": [extra for extra in req.extras if extra in POOL_EXTRAS],
        "total_amount": total,
        "currency": "EUR",
        "status": "paid",
        "customer_name": req.customer_name,
        "customer_email": req.customer_email,
        "source": "cashier",
        "payment_method": payment_method,
        "session_id": None,
        "wristband_id": None,
        "locker_id": None,
        "duration_id": quote.get("duration_id"),
        "duration_label_de": quote.get("duration_label_de"),
        "duration_label_en": quote.get("duration_label_en"),
        "adult_count": int(quote.get("adult_count", 0) or 0),
        "child_count": int(quote.get("child_count", 0) or 0),
        "day_type": quote.get("day_type"),
        "valid_from": None,
        "valid_until": None,
        "access_zones": quote.get("access_zones", []),
        "pricing_breakdown": quote.get("breakdown", []),
        "visit_date": quote.get("visit_date"),
        "checked_in_at": None,
        "checked_out_at": None,
        "cashier_id": str(user.get("_id")),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.pool_tickets.insert_one(ticket_doc)
    return {"ok": True, "ticket": _ticket_public_view(ticket_doc)}


@router.get("/admin/lockers")
async def list_pool_lockers(request: Request):
    await _require_pool_staff(request)
    await _ensure_lockers()
    lockers = await db.pool_lockers.find({"facility_id": FACILITY_ID}, {"_id": 0}).sort("locker_id", 1).to_list(100)
    return {"lockers": [_locker_public_view(doc) for doc in lockers]}


@router.post("/admin/lockers/assign")
async def assign_pool_locker(req: LockerAssignRequest, request: Request):
    await _require_pool_staff(request)
    await _ensure_lockers()
    hardware_config = await _ensure_hardware_config()
    ticket = await db.pool_tickets.find_one({"ticket_code": req.ticket_code}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")
    if ticket.get("locker_id"):
        locker = await db.pool_lockers.find_one({"locker_id": ticket["locker_id"]}, {"_id": 0})
        return {"ok": True, "locker": _locker_public_view(locker), "ticket": _ticket_public_view(ticket)}

    locker_query = {"facility_id": FACILITY_ID, "status": "free"}
    if req.locker_id:
        locker_query["locker_id"] = req.locker_id
    locker = await db.pool_lockers.find_one(locker_query, {"_id": 0})
    if not locker:
        raise HTTPException(status_code=404, detail="Kein verfügbarer Spind gefunden")
    now_iso = _now_iso()
    wristband_id = ticket.get("wristband_id") or _short_id("WB", 8)
    await db.pool_lockers.update_one(
        {"locker_id": locker["locker_id"]},
        {"$set": {"status": "occupied", "ticket_code": req.ticket_code, "wristband_id": wristband_id, "updated_at": now_iso}},
    )
    await db.pool_tickets.update_one(
        {"ticket_code": req.ticket_code},
        {"$set": {"locker_id": locker["locker_id"], "wristband_id": wristband_id, "updated_at": now_iso}},
    )
    command = await _enqueue_hardware_command(
        "locker",
        locker["locker_id"],
        "open_locker",
        {"ticket_code": req.ticket_code, "wristband_id": wristband_id, "adapter_type": hardware_config.get("locker", {}).get("adapter_type")},
        "Locker opening queued",
    )
    await _record_hardware_event("locker", hardware_config.get("locker", {}).get("adapter_type", "planned"), "queued", "Locker command queued", {"locker_id": locker["locker_id"], "ticket_code": req.ticket_code})
    assigned = await db.pool_lockers.find_one({"locker_id": locker["locker_id"]}, {"_id": 0})
    updated_ticket = await db.pool_tickets.find_one({"ticket_code": req.ticket_code}, {"_id": 0})
    return {"ok": True, "locker": _locker_public_view(assigned), "ticket": _ticket_public_view(updated_ticket), "command": _hardware_command_view(command)}


@router.post("/admin/lockers/release")
async def release_pool_locker(req: LockerReleaseRequest, request: Request):
    await _require_pool_staff(request)
    hardware_config = await _ensure_hardware_config()
    locker_query = None
    if req.locker_id:
        locker_query = {"locker_id": req.locker_id}
    elif req.ticket_code:
        locker_query = {"ticket_code": req.ticket_code}
    else:
        raise HTTPException(status_code=400, detail="locker_id oder ticket_code erforderlich")

    locker = await db.pool_lockers.find_one(locker_query, {"_id": 0})
    if not locker:
        raise HTTPException(status_code=404, detail="Spind nicht gefunden")

    now_iso = _now_iso()
    await db.pool_lockers.update_one(
        {"locker_id": locker["locker_id"]},
        {"$set": {"status": "free", "ticket_code": None, "wristband_id": None, "updated_at": now_iso}},
    )
    if locker.get("ticket_code"):
        await db.pool_tickets.update_one(
            {"ticket_code": locker["ticket_code"]},
            {"$set": {"locker_id": None, "updated_at": now_iso}},
        )
    command = await _enqueue_hardware_command(
        "locker",
        locker["locker_id"],
        "release_locker",
        {"locker_id": locker["locker_id"], "adapter_type": hardware_config.get("locker", {}).get("adapter_type")},
        "Locker release queued",
    )
    await _record_hardware_event("locker", hardware_config.get("locker", {}).get("adapter_type", "planned"), "queued", "Locker release queued", {"locker_id": locker["locker_id"]})
    released = await db.pool_lockers.find_one({"locker_id": locker["locker_id"]}, {"_id": 0})
    return {"ok": True, "locker": _locker_public_view(released), "command": _hardware_command_view(command)}


@router.post("/admin/lockers/open")
async def open_pool_locker(req: LockerOpenRequest, request: Request):
    await _require_pool_staff(request)
    hardware_config = await _ensure_hardware_config()
    locker = await db.pool_lockers.find_one({"locker_id": req.locker_id, "facility_id": FACILITY_ID}, {"_id": 0})
    if not locker:
        raise HTTPException(status_code=404, detail="Spind nicht gefunden")
    if req.ticket_code and locker.get("ticket_code") and locker.get("ticket_code") != req.ticket_code:
        raise HTTPException(status_code=400, detail="Spind ist einem anderen Ticket zugeordnet")
    command = await _enqueue_hardware_command(
        "locker",
        req.locker_id,
        "open_locker",
        {"locker_id": req.locker_id, "ticket_code": req.ticket_code, "adapter_type": hardware_config.get("locker", {}).get("adapter_type")},
        "Manual locker open queued",
    )
    await _record_hardware_event("locker", hardware_config.get("locker", {}).get("adapter_type", "planned"), "queued", "Manual locker open queued", {"locker_id": req.locker_id})
    return {"ok": True, "locker": _locker_public_view(locker), "command": _hardware_command_view(command)}


@router.post("/admin/turnstile/scan")
async def scan_pool_turnstile(req: TurnstileScanRequest, request: Request):
    user = await _require_pool_staff(request)
    hardware_config = await _ensure_hardware_config()
    pricing_config = await _ensure_pricing_config()
    direction = req.direction.lower().strip()
    if direction not in {"entry", "exit"}:
        raise HTTPException(status_code=400, detail="direction muss entry oder exit sein")
    ticket = await db.pool_tickets.find_one(
        {"$or": [{"ticket_code": req.scan_code}, {"wristband_id": req.scan_code}]},
        {"_id": 0},
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket oder Armband nicht gefunden")

    now_iso = _now_iso()
    now_dt = datetime.now(timezone.utc)
    status = "success"
    message = ""
    locker_released = None
    overstay_fee = 0.0
    required_zone = TURNSTILE_ZONE_MAP.get(req.turnstile_id)
    access_zones = ticket.get("access_zones") or _quote_access_zones(pricing_config, ticket.get("extras", []))

    if required_zone and direction == "entry" and required_zone not in access_zones:
        raise HTTPException(status_code=403, detail="Ticket hat keinen Zutritt zu dieser Tür")

    if direction == "entry":
        if ticket.get("status") == "active":
            raise HTTPException(status_code=400, detail="Gast ist bereits eingecheckt")
        if ticket.get("status") == "completed":
            raise HTTPException(status_code=400, detail="Ticket wurde bereits ausgecheckt")
        duration = _duration_config(pricing_config, ticket.get("duration_id") or "day") if (ticket.get("duration_id") or "day") in [item.get("duration_id") for item in pricing_config.get("durations", [])] else None
        if duration and duration.get("valid_from"):
            start_hour, start_minute = [int(part) for part in str(duration.get("valid_from", "00:00")).split(":", 1)]
            if now_dt.hour < start_hour or (now_dt.hour == start_hour and now_dt.minute < start_minute):
                raise HTTPException(status_code=400, detail=f"Zutritt erst ab {duration.get('valid_from')} Uhr")
        wristband_id = ticket.get("wristband_id") or _short_id("WB", 8)
        valid_until = None
        if duration:
            valid_until = (now_dt + timedelta(minutes=int(duration.get("minutes", 0) or 0))).isoformat()
        await db.pool_tickets.update_one(
            {"ticket_code": ticket["ticket_code"]},
            {"$set": {"status": "active", "checked_in_at": now_iso, "valid_from": now_iso, "valid_until": valid_until, "wristband_id": wristband_id, "updated_at": now_iso}},
        )
        message = "Einlass freigegeben"
    else:
        if ticket.get("status") != "active":
            raise HTTPException(status_code=400, detail="Ticket ist aktuell nicht eingecheckt")
        overstay_fee = _compute_overstay_fee(ticket, pricing_config, now_dt)
        await db.pool_tickets.update_one(
            {"ticket_code": ticket["ticket_code"]},
            {"$set": {"status": "completed", "checked_out_at": now_iso, "overstay_fee": overstay_fee, "updated_at": now_iso}},
        )
        if ticket.get("locker_id"):
            await db.pool_lockers.update_one(
                {"locker_id": ticket["locker_id"]},
                {"$set": {"status": "free", "ticket_code": None, "wristband_id": None, "updated_at": now_iso}},
            )
            locker_released = ticket["locker_id"]
        message = "Ausgang freigegeben"
        if overstay_fee > 0:
            message = f"Ausgang freigegeben · Nachberechnung € {overstay_fee:.2f}"

    command = await _enqueue_hardware_command(
        "turnstile",
        req.turnstile_id,
        "grant_entry" if direction == "entry" else "grant_exit",
        {"turnstile_id": req.turnstile_id, "ticket_code": ticket.get("ticket_code"), "adapter_type": hardware_config.get("turnstile", {}).get("adapter_type")},
        message,
    )
    await _record_hardware_event("turnstile", hardware_config.get("turnstile", {}).get("adapter_type", "planned"), "queued", message, {"turnstile_id": req.turnstile_id, "direction": direction})

    event_doc = {
        "event_id": _short_id("PGA", 10),
        "facility_id": FACILITY_ID,
        "ticket_code": ticket.get("ticket_code"),
        "direction": direction,
        "turnstile_id": req.turnstile_id,
        "status": status,
        "message": message,
        "actor_id": str(user.get("_id")),
        "created_at": now_iso,
    }
    await db.pool_access_events.insert_one(event_doc)
    updated_ticket = await db.pool_tickets.find_one({"ticket_code": ticket["ticket_code"]}, {"_id": 0})
    return {
        "ok": True,
        "message": message,
        "direction": direction,
        "locker_released": locker_released,
        "overstay_fee": overstay_fee,
        "ticket": _ticket_public_view(updated_ticket),
        "event": _access_event_view(event_doc),
        "command": _hardware_command_view(command),
    }


@router.post("/admin/access/door-command")
async def send_pool_door_command(req: DoorCommandRequest, request: Request):
    await _require_pool_staff(request)
    hardware_config = await _ensure_hardware_config()
    door = next((item for item in POOL_ACCESS_POINTS if item.get("door_id") == req.door_id), None)
    if not door:
        raise HTTPException(status_code=404, detail="Tür/Gate nicht gefunden")

    ticket = None
    if req.ticket_code:
        ticket = await db.pool_tickets.find_one({"$or": [{"ticket_code": req.ticket_code}, {"wristband_id": req.ticket_code}]}, {"_id": 0})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket oder Armband nicht gefunden")
        if door.get("zone_id") not in (ticket.get("access_zones") or []):
            raise HTTPException(status_code=403, detail="Ticket hat keinen Zutritt zu dieser Tür")

    command = await _enqueue_hardware_command(
        door.get("device_type", "door"),
        req.door_id,
        req.action,
        {"door_id": req.door_id, "ticket_code": ticket.get("ticket_code") if ticket else None, "adapter_type": hardware_config.get("turnstile", {}).get("adapter_type")},
        "Door command queued",
    )
    await _record_hardware_event("door", hardware_config.get("turnstile", {}).get("adapter_type", "planned"), "queued", "Door command queued", {"door_id": req.door_id, "action": req.action})
    return {"ok": True, "door": door, "ticket": _ticket_public_view(ticket), "command": _hardware_command_view(command)}


@router.post("/admin/pos/sale")
async def create_pool_snack_sale(req: SnackSaleRequest, request: Request):
    user = await _require_pool_staff(request)
    if req.payment_method not in {"cash", "card", "wristband"}:
        raise HTTPException(status_code=400, detail="Ungültige Zahlungsart")
    if not req.items:
        raise HTTPException(status_code=400, detail="Mindestens ein Artikel erforderlich")

    line_items = []
    subtotal = 0.0
    for item in req.items:
        if item.menu_id not in SNACK_MENU:
            raise HTTPException(status_code=400, detail=f"Unbekannter Snack: {item.menu_id}")
        snack = SNACK_MENU[item.menu_id]
        line_total = _round_money(snack["price"] * item.quantity)
        subtotal += line_total
        line_items.append({
            "menu_id": item.menu_id,
            "label_de": snack["label_de"],
            "label_en": snack["label_en"],
            "quantity": item.quantity,
            "unit_price": snack["price"],
            "line_total": line_total,
        })

    linked_ticket = None
    if req.ticket_code:
        linked_ticket = await db.pool_tickets.find_one({"ticket_code": req.ticket_code}, {"_id": 0})
        if not linked_ticket:
            raise HTTPException(status_code=404, detail="Ticket für Snackverkauf nicht gefunden")

    now_iso = _now_iso()
    sale_doc = {
        "sale_id": _short_id("PSL", 10),
        "receipt_code": _short_id("SNK", 10),
        "facility_id": FACILITY_ID,
        "items": line_items,
        "subtotal": _round_money(subtotal),
        "total_amount": _round_money(subtotal),
        "payment_method": req.payment_method,
        "ticket_code": req.ticket_code,
        "status": "completed",
        "cashier_id": str(user.get("_id")),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.pool_pos_sales.insert_one(sale_doc)
    return {"ok": True, "sale": _sale_view(sale_doc), "ticket": _ticket_public_view(linked_ticket)}