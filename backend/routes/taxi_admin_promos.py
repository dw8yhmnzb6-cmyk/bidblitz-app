"""
BidBlitz Admin/Merchant — Taxi Promo Code Management.
======================================================
Permits admins (and merchant operators) to create, list, edit, archive promo
codes that are stored in MongoDB collection `taxi_promo_codes`.

Includes redemption reporting (how often used, total discount volume, top users).

Endpoints:
  GET    /api/taxi/admin/promos             — list all (active + archived)
  POST   /api/taxi/admin/promos             — create new
  PATCH  /api/taxi/admin/promos/{code}      — update (label, value, expires_at, active)
  DELETE /api/taxi/admin/promos/{code}      — archive (active=false)
  GET    /api/taxi/admin/promos/{code}/stats — redemption stats
"""
from datetime import datetime, timezone
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi/admin/promos", tags=["taxi-admin-promos"])


async def _admin_or_merchant(request: Request) -> dict:
    user = await get_current_user(request)
    role = user.get("role")
    if role not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Admin oder Merchant")
    return user


class PromoCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=32)
    type: Literal["percent", "fixed", "free_ride"] = "percent"
    value: float = Field(..., ge=0)
    max_off: Optional[float] = Field(None, ge=0)
    max_uses_per_user: int = Field(1, ge=1, le=999)
    label: Optional[str] = Field(None, max_length=200)
    expires_at: Optional[str] = None
    active: bool = True


class PromoUpdate(BaseModel):
    value: Optional[float] = Field(None, ge=0)
    max_off: Optional[float] = None
    max_uses_per_user: Optional[int] = Field(None, ge=1, le=999)
    label: Optional[str] = Field(None, max_length=200)
    expires_at: Optional[str] = None
    active: Optional[bool] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_promos(request: Request, include_archived: bool = True):
    await _admin_or_merchant(request)
    q = {} if include_archived else {"active": True}
    promos = await db.taxi_promo_codes.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

    if promos:
        codes = [p["code"] for p in promos]
        # aggregate redemptions per code
        pipeline = [
            {"$match": {"code": {"$in": codes}}},
            {"$group": {"_id": "$code", "redemptions": {"$sum": 1}, "discount_total": {"$sum": "$discount"}}},
        ]
        stats = {}
        async for s in db.taxi_promo_redemptions.aggregate(pipeline):
            stats[s["_id"]] = {"redemptions": s["redemptions"], "discount_total": round(s.get("discount_total", 0), 2)}
        for p in promos:
            s = stats.get(p["code"]) or {}
            p["redemptions"] = s.get("redemptions", 0)
            p["discount_total"] = s.get("discount_total", 0.0)
    return {"promos": promos, "count": len(promos)}


@router.post("")
async def create_promo(body: PromoCreate, request: Request):
    user = await _admin_or_merchant(request)
    code = body.code.strip().upper()
    if not code.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(400, "Code darf nur Buchstaben, Ziffern, '-' oder '_' enthalten")

    existing = await db.taxi_promo_codes.find_one({"code": code}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Code existiert bereits")

    doc = {
        "code": code,
        "type": body.type,
        "value": float(body.value),
        "max_off": float(body.max_off) if body.max_off is not None else None,
        "max_uses_per_user": int(body.max_uses_per_user),
        "label": (body.label or f"{code} Aktion").strip()[:200],
        "expires_at": body.expires_at,
        "active": body.active,
        "created_at": _now_iso(),
        "created_by": str(user.get("_id") or user.get("id") or ""),
    }
    await db.taxi_promo_codes.insert_one(doc.copy())
    doc.pop("_id", None)

    # Best-effort broadcast push to taxi customers when active
    if body.active:
        try:
            from utils.onesignal_push import broadcast_to_segment, is_configured
            if is_configured():
                preview = f"{doc['label']} — Code: {code}"
                await broadcast_to_segment("Subscribed Users", "Neue Promo-Aktion 🎁", preview)
        except Exception:
            pass

    return {"success": True, "promo": doc}


@router.patch("/{code}")
async def update_promo(code: str, body: PromoUpdate, request: Request):
    await _admin_or_merchant(request)
    code = code.strip().upper()
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "max_off" or k == "expires_at"}
    if not update:
        raise HTTPException(400, "Keine Änderungen")
    update["updated_at"] = _now_iso()
    res = await db.taxi_promo_codes.update_one({"code": code}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Promo nicht gefunden")
    promo = await db.taxi_promo_codes.find_one({"code": code}, {"_id": 0})
    return {"success": True, "promo": promo}


@router.delete("/{code}")
async def archive_promo(code: str, request: Request):
    await _admin_or_merchant(request)
    code = code.strip().upper()
    res = await db.taxi_promo_codes.update_one(
        {"code": code}, {"$set": {"active": False, "archived_at": _now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Promo nicht gefunden")
    return {"success": True}


@router.get("/{code}/stats")
async def promo_stats(code: str, request: Request, limit: int = 20):
    await _admin_or_merchant(request)
    code = code.strip().upper()
    promo = await db.taxi_promo_codes.find_one({"code": code}, {"_id": 0})
    if not promo:
        # also allow BUILTIN code stats
        from utils.taxi_promo import BUILTIN
        if code not in BUILTIN:
            raise HTTPException(404, "Promo nicht gefunden")
        promo = {"code": code, **BUILTIN[code], "builtin": True}

    redemptions = await db.taxi_promo_redemptions.find({"code": code}, {"_id": 0}).sort("redeemed_at", -1).limit(limit).to_list(limit)
    # Aggregate
    pipe = [{"$match": {"code": code}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "discount": {"$sum": "$discount"}, "unique_users": {"$addToSet": "$user_id"}}}]
    agg = await db.taxi_promo_redemptions.aggregate(pipe).to_list(1)
    summary = {}
    if agg:
        a = agg[0]
        summary = {
            "redemptions": a["count"],
            "discount_total": round(a["discount"], 2),
            "unique_users": len(a.get("unique_users", [])),
        }
    return {"promo": promo, "summary": summary, "recent": redemptions}
