"""
POS Extras — Admin-Erweiterungen
- Trial-Reset durch Admin
- Staff List / Update Role / Remove
- QR-Code-Poster pro Store (Self-Checkout-Eingang)
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from io import BytesIO
import qrcode
import qrcode.image.svg

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/pos", tags=["POS Extras"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _is_admin(user) -> bool:
    return user.get("role") == "admin" or user.get("is_admin") is True


async def _is_merchant_admin(user, store_id: str) -> bool:
    """Owner of merchant or has merchant_admin/store_manager role on this store."""
    user_id = str(user["_id"])
    store = await db.pos_stores.find_one({"store_id": store_id})
    if not store:
        return False
    merchant = await db.pos_merchants.find_one({"merchant_id": store["merchant_id"]})
    if merchant and merchant.get("owner_id") == user_id:
        return True
    staff = await db.pos_staff.find_one(
        {"user_id": user_id, "store_id": store_id, "active": True}
    )
    return bool(staff and staff.get("role") in {"merchant_admin", "store_manager"})


# ═══════════════════════════════════════════════════════════
# 1. STAFF / EMPLOYEES — Listing, Role-Update, Remove
# ═══════════════════════════════════════════════════════════
@router.get("/staff/list")
async def list_staff(store_id: str, request: Request):
    """Liste aller Mitarbeiter eines Stores."""
    user = await get_current_user(request)
    if not (await _is_admin(user) or await _is_merchant_admin(user, store_id)):
        raise HTTPException(403, "Nicht berechtigt")
    items = await db.pos_staff.find({"store_id": store_id}, {"_id": 0}).sort("added_at", -1).to_list(200)
    return {"staff": items}


class StaffUpdate(BaseModel):
    user_id: str
    store_id: str
    role: Optional[str] = None
    active: Optional[bool] = None


@router.post("/staff/update")
async def update_staff(req: StaffUpdate, request: Request):
    user = await get_current_user(request)
    if not (await _is_admin(user) or await _is_merchant_admin(user, req.store_id)):
        raise HTTPException(403, "Nicht berechtigt")
    if req.role and req.role not in {"cashier", "store_manager", "accountant", "merchant_admin"}:
        raise HTTPException(400, "Rolle ungültig")
    upd = {}
    if req.role is not None:
        upd["role"] = req.role
    if req.active is not None:
        upd["active"] = req.active
    if not upd:
        raise HTTPException(400, "Nichts zu aktualisieren")
    upd["updated_at"] = _now()
    upd["updated_by"] = str(user["_id"])
    res = await db.pos_staff.update_one(
        {"user_id": req.user_id, "store_id": req.store_id}, {"$set": upd}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Staff-Eintrag nicht gefunden")
    return {"ok": True}


@router.post("/staff/remove")
async def remove_staff(req: StaffUpdate, request: Request):
    user = await get_current_user(request)
    if not (await _is_admin(user) or await _is_merchant_admin(user, req.store_id)):
        raise HTTPException(403, "Nicht berechtigt")
    res = await db.pos_staff.delete_one({"user_id": req.user_id, "store_id": req.store_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Staff-Eintrag nicht gefunden")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
# 2. TRIAL-RESET DURCH ADMIN
# ═══════════════════════════════════════════════════════════
class TrialReset(BaseModel):
    merchant_id: str
    feature_key: str


@router.post("/features/admin/trial-reset")
async def reset_trial(req: TrialReset, request: Request):
    """Admin setzt das `trial_used`-Flag eines Merchants zurück, damit erneut getestet werden kann."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")
    res = await db.pos_merchant_features.update_one(
        {"merchant_id": req.merchant_id, "feature_key": req.feature_key},
        {"$set": {"trial_used": False, "trial": False, "enabled": False,
                  "valid_until": None, "trial_reset_at": _now(),
                  "trial_reset_by": str(user["_id"])}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Feature für diesen Merchant nicht gefunden")
    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": str(user["_id"]),
            "action": "feature.trial_reset",
            "ref": {"merchant_id": req.merchant_id, "feature_key": req.feature_key},
            "ts": _now(),
        })
    except Exception:
        pass
    return {"ok": True, "message": "Trial zurückgesetzt — Merchant kann erneut starten"}


# ═══════════════════════════════════════════════════════════
# 3. QR-CODE-POSTER pro Store (Self-Checkout-Einstieg)
# ═══════════════════════════════════════════════════════════
def _build_self_checkout_url(store_id: str, base_url: Optional[str] = None) -> str:
    base = (base_url or "").rstrip("/")
    if not base:
        # Fallback auf Standard-Frontend-Origin
        base = "https://app.bidblitz.ae"
    return f"{base}/selfcheckout?store={store_id}"


@router.get("/store/{store_id}/qr-poster")
async def store_qr_poster(
    store_id: str,
    request: Request,
    format: str = "png",  # png | svg | json
    base_url: Optional[str] = None,
    size: int = 12,
):
    """Generiert einen QR-Code für den Self-Checkout-Einstieg eines Stores.
    PNG-Bytes (default), SVG-String oder JSON mit der Ziel-URL.
    """
    user = await get_current_user(request)
    if not (await _is_admin(user) or await _is_merchant_admin(user, store_id)):
        raise HTTPException(403, "Nicht berechtigt")

    store = await db.pos_stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(404, "Store nicht gefunden")

    target_url = _build_self_checkout_url(store_id, base_url)

    if format == "json":
        return {
            "store_id": store_id,
            "store_name": store.get("name", ""),
            "target_url": target_url,
            "instructions_de": "Plakat ausdrucken und am Eingang aufhängen. Kunden scannen QR und starten Self-Checkout.",
        }

    if format == "svg":
        factory = qrcode.image.svg.SvgPathImage
        img = qrcode.make(target_url, image_factory=factory, box_size=size, border=2)
        buf = BytesIO()
        img.save(buf)
        return Response(content=buf.getvalue(), media_type="image/svg+xml")

    # default: png
    img = qrcode.make(target_url, box_size=size, border=2)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Content-Disposition": f'inline; filename="qr_{store_id}.png"'})
