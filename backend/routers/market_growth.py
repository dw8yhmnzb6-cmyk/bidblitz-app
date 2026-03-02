"""
Marketplace Growth: Verified Seller + Auto-Refresh + CSV Import + Revenue Wallet + Admin Reports
All-in-one for BidBlitz Motor async
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Body, UploadFile, File
import csv, io, uuid, os

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/market/growth", tags=["Market Growth"])

UTC = timezone.utc
def _now(): return datetime.now(UTC)
def _id(p): return f"{p}-{uuid.uuid4().hex[:12].upper()}"

VERIFIED_PRICE = {"XK": 299, "DE": 299, "AE": 1500}
REFRESH_QUOTA = {"free": 0, "premium": 1, "pro": 3}


# ==================== VERIFIED SELLER ====================

@router.get("/verified")
async def get_verified(country_code: str = Query("XK"), user: dict = Depends(get_current_user)):
    cc = country_code.upper()
    doc = await db.market_seller_verified.find_one({"user_id": user["id"], "cc": cc}, {"_id": 0})
    active = bool(doc and doc.get("until") and datetime.fromisoformat(doc["until"]) > _now())
    return {"verified": active, "until": doc.get("until") if doc else None}

@router.post("/verified/buy")
async def buy_verified(country_code: str = Query("XK"), user: dict = Depends(get_current_user)):
    cc = country_code.upper()
    price = VERIFIED_PRICE.get(cc, 299)
    bal = user.get("wallet_balance_cents", 0)
    if bal < price: raise HTTPException(402, f"Nicht genug Guthaben ({price/100:.2f} EUR)")
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -price}})
    # Platform revenue
    await _credit_platform(price, "verified", cc, user["id"])
    until = (_now() + timedelta(days=30)).isoformat()
    await db.market_seller_verified.update_one({"user_id": user["id"], "cc": cc}, {"$set": {"until": until}}, upsert=True)
    return {"ok": True, "verified": True, "until": until, "charged": price}


# ==================== REFRESH ====================

@router.get("/refresh/quota")
async def refresh_quota(country_code: str = Query("XK"), user: dict = Depends(get_current_user)):
    plan = await db.market_seller_plans.find_one({"user_id": user["id"], "cc": country_code.upper()}, {"plan_id": 1})
    pid = plan.get("plan_id", "free") if plan else "free"
    quota = REFRESH_QUOTA.get(pid, 0)
    day = _now().strftime("%Y-%m-%d")
    used = await db.market_refresh_usage.count_documents({"user_id": user["id"], "day": day})
    return {"quota": quota, "used": used, "remaining": max(0, quota - used)}

@router.post("/refresh")
async def refresh_listing(listing_id: str = Query(...), user: dict = Depends(get_current_user)):
    l = await db.market_listings.find_one({"listing_id": listing_id, "seller_user_id": user["id"], "status": "active"})
    if not l: raise HTTPException(404, "Nicht gefunden")
    q = await refresh_quota(l.get("country_code", "XK"), user)
    if q["remaining"] <= 0: raise HTTPException(402, "Refresh-Limit erreicht")
    now = _now()
    await db.market_listings.update_one({"listing_id": listing_id}, {"$set": {"published_at": now.isoformat()}})
    await db.market_refresh_usage.insert_one({"user_id": user["id"], "listing_id": listing_id, "day": now.strftime("%Y-%m-%d"), "created_at": now.isoformat()})
    return {"ok": True, "refreshed_at": now.isoformat()}


# ==================== CSV IMPORT ====================

@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    raw = await file.read()
    if len(raw) > 3 * 1024 * 1024: raise HTTPException(413, "Max 3MB")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8", errors="replace")))
    rows = list(reader)
    if len(rows) > 300: raise HTTPException(400, "Max 300 Zeilen")
    created = 0
    for r in rows:
        try:
            await db.market_listings.insert_one({
                "listing_id": _id("LIST"), "seller_user_id": user["id"],
                "country_code": (r.get("country_code") or "XK").upper(), "city": r.get("city", ""),
                "category": (r.get("category") or "").lower(), "title": r.get("title", ""),
                "description": r.get("description", ""), "price_cents": int(r.get("price_cents") or 0),
                "currency": r.get("currency", "EUR"), "images": [x.strip() for x in (r.get("images") or "").split("|") if x.strip()],
                "attributes": {"rooms": r.get("rooms"), "sqm": r.get("sqm")},
                "status": "active", "boost_rank": 0,
                "published_at": _now().isoformat(), "expires_at": (_now() + timedelta(days=21)).isoformat(),
                "created_at": _now().isoformat()
            })
            created += 1
        except: pass
    return {"ok": True, "created": created, "skipped": len(rows) - created}


# ==================== PLATFORM REVENUE ====================

async def _credit_platform(amount_cents, purpose, cc, user_id):
    """Credit 100% to platform revenue"""
    platform = await db.users.find_one({"email": "platform@bidblitz.ae"})
    if platform:
        await db.users.update_one({"id": platform["id"]}, {"$inc": {"wallet_balance_cents": amount_cents}})
    await db.market_payments.insert_one({
        "payment_id": _id("MPAY"), "seller_user_id": user_id,
        "country_code": cc, "kind": purpose, "amount_cents": amount_cents,
        "created_at": _now().isoformat()
    })
    await db.platform_ledger.insert_one({
        "wallet_id": "BIDBLITZ_REVENUE", "amount_cents": amount_cents, "direction": "credit",
        "meta": {"purpose": purpose, "cc": cc, "user": user_id}, "created_at": _now().isoformat()
    })


# ==================== ADMIN REVENUE REPORTS ====================

@router.get("/admin/revenue/balance")
async def revenue_balance(admin: dict = Depends(get_admin_user)):
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount_cents"}}}]
    r = await db.market_payments.aggregate(pipeline).to_list(1)
    return {"balance_cents": r[0]["total"] if r else 0}

@router.get("/admin/revenue/summary")
async def revenue_summary(days: int = Query(30), admin: dict = Depends(get_admin_user)):
    start = (_now() - timedelta(days=days)).isoformat()
    by_kind = await db.market_payments.aggregate([
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {"_id": "$kind", "sum": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}},
        {"$sort": {"sum": -1}}
    ]).to_list(20)
    by_country = await db.market_payments.aggregate([
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {"_id": "$country_code", "sum": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    total = sum(x["sum"] for x in by_kind)
    return {"total_cents": total, "days": days, "by_kind": by_kind, "by_country": by_country}

@router.get("/admin/revenue/daily")
async def revenue_daily(days: int = Query(30), country_code: str = None, admin: dict = Depends(get_admin_user)):
    start = (_now() - timedelta(days=days)).isoformat()
    match = {"created_at": {"$gte": start}}
    if country_code: match["country_code"] = country_code.upper()
    series = await db.market_payments.aggregate([
        {"$match": match},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "sum": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]).to_list(400)
    return {"series": [{"day": s["_id"], "cents": s["sum"], "count": s["count"]} for s in series]}


# ==================== DYNAMIC PRICING ====================

@router.get("/admin/pricing")
async def get_pricing(country_code: str = Query("XK"), category: str = Query("*"), admin: dict = Depends(get_admin_user)):
    p = await db.market_pricing_config.find_one({"country_code": country_code.upper(), "category": category}, {"_id": 0})
    return {"pricing": p or {"country_code": country_code.upper(), "category": category, "prices": {}}}

@router.put("/admin/pricing")
async def set_pricing(payload: dict = Body(...), admin: dict = Depends(get_admin_user)):
    cc = (payload.get("country_code") or "XK").upper()
    cat = payload.get("category", "*")
    prices = payload.get("prices", {})
    await db.market_pricing_config.update_one(
        {"country_code": cc, "category": cat},
        {"$set": {"prices": prices, "currency": "AED" if cc == "AE" else "EUR", "updated_at": _now().isoformat()}},
        upsert=True
    )
    return {"ok": True}
