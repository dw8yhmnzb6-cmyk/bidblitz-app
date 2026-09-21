"""
Lightweight Taxi Promo-Code Engine.
====================================
Validates user-entered codes and returns a fare-discount config.

Resolution order:
1. Built-in known codes (NEUKUNDE10, BIDBLITZ5, etc.) — no DB needed for MVP
2. Optional MongoDB `taxi_promo_codes` collection (admin-managed, future)

Discount shapes:
  - {"type":"percent","value":10}        → 10% off, max 5€
  - {"type":"fixed","value":3}           → 3€ off
  - {"type":"free_ride","max":12}        → up to 12€ free (caps remainder to user)

Per-user limits:
  - max_uses_per_user (default 1)
  - tracked in `taxi_promo_redemptions` collection
"""
from datetime import datetime, timezone
from typing import Optional
import hashlib

from pymongo.errors import DuplicateKeyError

from core.database import db

# Static built-in promos (MVP — replace/extend via DB later)
BUILTIN: dict[str, dict] = {
    "NEUKUNDE10": {"type": "percent", "value": 10, "max_off": 5.0, "max_uses_per_user": 1,
                   "label": "10% Rabatt für Neukunden (max 5€)"},
    "BIDBLITZ5":  {"type": "fixed", "value": 5.0, "max_uses_per_user": 1,
                   "label": "5€ Willkommens-Gutschrift"},
    "FREUNDE":    {"type": "percent", "value": 15, "max_off": 8.0, "max_uses_per_user": 3,
                   "label": "15% Freundschaftsrabatt (max 8€)"},
    "PROMO2026":  {"type": "percent", "value": 20, "max_off": 10.0, "max_uses_per_user": 1,
                   "label": "20% Aktion 2026 (max 10€)"},
}


async def _load_db_promo(code: str) -> Optional[dict]:
    try:
        doc = await db.taxi_promo_codes.find_one({"code": code, "active": True}, {"_id": 0})
        return doc
    except Exception:
        return None


async def _redemption_count(user_id: str, code: str) -> int:
    if not user_id:
        return 0
    normalized = code.strip().upper()
    try:
        usage_id = _promo_usage_id(user_id, normalized)
        usage = await db.taxi_promo_usage.find_one({"_id": usage_id}, {"_id": 0, "uses": 1})
        if usage is not None:
            return max(0, int(usage.get("uses") or 0))
        return await db.taxi_promo_redemptions.count_documents({
            "user_id": user_id,
            "code": normalized,
            "$or": [
                {"status": {"$in": ["reserved", "completed"]}},
                {"status": {"$exists": False}},
            ],
        })
    except Exception:
        return 0


async def validate_promo(code: Optional[str], user_id: Optional[str] = None) -> dict:
    """Returns {valid: bool, code, label?, discount?, reason?}."""
    if not code:
        return {"valid": False, "reason": "empty"}
    code = code.strip().upper()
    if not code or len(code) > 32 or not code.replace("-", "").replace("_", "").isalnum():
        return {"valid": False, "code": code, "reason": "invalid_format"}

    promo = BUILTIN.get(code) or await _load_db_promo(code)
    if not promo:
        return {"valid": False, "code": code, "reason": "not_found"}

    # Taxi promos are usage-limited per user. Never validate a discounted
    # quote anonymously because that would bypass per-user redemption limits.
    if not user_id:
        return {"valid": False, "code": code, "reason": "auth_required"}

    # User-specific promo check (e.g., referral-bound codes)
    if promo.get("user_id") and promo["user_id"] != user_id:
        return {"valid": False, "code": code, "reason": "not_for_you"}

    # Expiry check (DB only — built-ins are evergreen)
    if promo.get("expires_at"):
        try:
            exp = datetime.fromisoformat(promo["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                return {"valid": False, "code": code, "reason": "expired"}
        except Exception:
            pass

    # Per-user usage
    max_uses = int(promo.get("max_uses_per_user", 1))
    used = await _redemption_count(user_id, code) if user_id else 0
    if used >= max_uses:
        return {"valid": False, "code": code, "reason": "already_used"}

    return {
        "valid": True,
        "code": code,
        "label": promo.get("label") or f"Code {code}",
        "discount": {
            "type": promo.get("type", "percent"),
            "value": float(promo.get("value", 0)),
            "max_off": float(promo.get("max_off", 0)) if promo.get("max_off") else None,
        },
        "remaining_uses": max(0, max_uses - used),
    }


def apply_discount(fare: float, promo: dict) -> dict:
    """Returns {original, discount, final, code, label}."""
    if not promo or not promo.get("valid"):
        return {"original": fare, "discount": 0.0, "final": fare, "code": None, "label": None}
    d = promo.get("discount", {})
    dtype = d.get("type", "percent")
    val = float(d.get("value", 0))
    discount = 0.0
    if dtype == "percent":
        discount = fare * (val / 100.0)
    elif dtype == "fixed":
        discount = val
    elif dtype == "free_ride":
        discount = min(fare, val)
    max_off = d.get("max_off")
    if max_off:
        discount = min(discount, float(max_off))
    discount = round(min(discount, fare), 2)
    final = round(max(0.0, fare - discount), 2)
    return {
        "original": round(fare, 2),
        "discount": discount,
        "final": final,
        "code": promo.get("code"),
        "label": promo.get("label"),
    }


def _promo_usage_id(user_id: str, code: str) -> str:
    raw = f"{user_id}:{code.strip().upper()}".encode("utf-8")
    return f"taxi-promo-usage-{hashlib.sha256(raw).hexdigest()[:32]}"


def _promo_redemption_id(user_id: str, code: str, ride_id: str) -> str:
    raw = f"{user_id}:{code.strip().upper()}:{ride_id}".encode("utf-8")
    return f"taxi-promo-redemption-{hashlib.sha256(raw).hexdigest()[:32]}"


async def reserve_redemption(user_id: str, code: str, ride_id: str, discount: float = 0.0) -> dict:
    """Atomically reserve one promo use for one ride.

    Same-ride retries replay without incrementing usage. Different rides compete
    against the per-user max in one Mongo conditional update.
    """
    if not user_id or not code or not ride_id:
        return {"ok": False, "reason": "invalid_identity", "retryable": False}

    normalized = code.strip().upper()
    promo = BUILTIN.get(normalized) or await _load_db_promo(normalized)
    if not promo:
        return {"ok": False, "reason": "not_found", "retryable": False}

    max_uses = max(1, int(promo.get("max_uses_per_user", 1) or 1))
    redemption_id = _promo_redemption_id(user_id, normalized, ride_id)
    usage_id = _promo_usage_id(user_id, normalized)
    now = datetime.now(timezone.utc).isoformat()

    claim = await db.taxi_promo_redemptions.update_one(
        {"_id": redemption_id},
        {"$setOnInsert": {
            "user_id": user_id,
            "code": normalized,
            "ride_id": ride_id,
            "discount": float(discount or 0),
            "status": "reserving",
            "created_at": now,
        }},
        upsert=True,
    )
    if claim.upserted_id is None:
        existing = await db.taxi_promo_redemptions.find_one({"_id": redemption_id}, {"_id": 0}) or {}
        status = existing.get("status")
        if status in {"reserved", "completed"}:
            return {"ok": True, "replayed": True, "status": status}
        if status == "rejected":
            return {"ok": False, "reason": existing.get("reason") or "already_used", "retryable": False}
        return {"ok": False, "reason": "reservation_in_progress", "retryable": True}

    legacy_uses = await db.taxi_promo_redemptions.count_documents({
        "user_id": user_id,
        "code": normalized,
        "_id": {"$ne": redemption_id},
        "$or": [
            {"status": {"$in": ["reserved", "completed"]}},
            {"status": {"$exists": False}},
        ],
    })
    await db.taxi_promo_usage.update_one(
        {"_id": usage_id},
        {"$setOnInsert": {
            "user_id": user_id,
            "code": normalized,
            "max_uses": max_uses,
            "uses": int(legacy_uses or 0),
            "ride_ids": [],
            "created_at": now,
            "updated_at": now,
        }},
        upsert=True,
    )

    selector = {
        "_id": usage_id,
        "uses": {"$lt": max_uses},
    }
    try:
        usage = await db.taxi_promo_usage.update_one(
            selector,
            {
                "$setOnInsert": {
                    "user_id": user_id,
                    "code": normalized,
                    "max_uses": max_uses,
                    "created_at": now,
                },
                "$set": {"updated_at": now, "max_uses": max_uses},
                "$inc": {"uses": 1},
                "$addToSet": {"ride_ids": ride_id},
            },
            upsert=True,
        )
        if usage.matched_count != 1 and usage.upserted_id is None:
            raise DuplicateKeyError("promo usage limit reached")
    except DuplicateKeyError:
        await db.taxi_promo_redemptions.update_one(
            {"_id": redemption_id},
            {"$set": {"status": "rejected", "reason": "already_used", "updated_at": now}},
        )
        return {"ok": False, "reason": "already_used", "retryable": False}
    except Exception:
        await db.taxi_promo_redemptions.update_one(
            {"_id": redemption_id},
            {"$set": {"status": "rejected", "reason": "storage_error", "updated_at": now}},
        )
        return {"ok": False, "reason": "storage_error", "retryable": True}

    await db.taxi_promo_redemptions.update_one(
        {"_id": redemption_id},
        {"$set": {"status": "reserved", "reserved_at": now, "updated_at": now}},
    )
    return {"ok": True, "replayed": False, "status": "reserved"}


async def release_redemption(user_id: str, code: str, ride_id: str) -> None:
    """Release a reserved promo use when booking value was rolled back."""
    if not user_id or not code or not ride_id:
        return
    normalized = code.strip().upper()
    redemption_id = _promo_redemption_id(user_id, normalized, ride_id)
    usage_id = _promo_usage_id(user_id, normalized)
    current = await db.taxi_promo_redemptions.find_one({"_id": redemption_id}, {"_id": 0}) or {}
    if current.get("status") not in {"reserving", "reserved"}:
        return

    await db.taxi_promo_usage.update_one(
        {"_id": usage_id, "ride_ids": ride_id},
        {
            "$inc": {"uses": -1},
            "$pull": {"ride_ids": ride_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    await db.taxi_promo_redemptions.update_one(
        {"_id": redemption_id},
        {"$set": {
            "status": "released",
            "released_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


async def record_redemption(user_id: str, code: str, ride_id: Optional[str] = None, discount: float = 0.0):
    """Finalize an idempotently reserved redemption (or safely reserve it first)."""
    if not user_id or not code or not ride_id:
        return
    reserved = await reserve_redemption(user_id, code, ride_id, discount)
    if not reserved.get("ok"):
        return
    redemption_id = _promo_redemption_id(user_id, code, ride_id)
    await db.taxi_promo_redemptions.update_one(
        {"_id": redemption_id, "status": {"$in": ["reserved", "completed"]}},
        {"$set": {
            "status": "completed",
            "discount": float(discount or 0),
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
