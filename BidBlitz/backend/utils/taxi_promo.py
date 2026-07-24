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
    try:
        return await db.taxi_promo_redemptions.count_documents({"user_id": user_id, "code": code})
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

    # User-specific promo check (e.g., referral-bound codes)
    if promo.get("user_id") and user_id and promo["user_id"] != user_id:
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


async def record_redemption(user_id: str, code: str, ride_id: Optional[str] = None, discount: float = 0.0):
    if not user_id or not code:
        return
    try:
        await db.taxi_promo_redemptions.insert_one({
            "user_id": user_id,
            "code": code.strip().upper(),
            "ride_id": ride_id,
            "discount": float(discount),
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass
