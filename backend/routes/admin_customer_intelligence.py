from collections import defaultdict
from datetime import datetime, timezone, timedelta
import math
import re

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request

from core.audit import AuditEvent, get_client_info, log_audit
from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/admin/customer-intelligence", tags=["admin-customer-intelligence"])


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_days_ago(days: int) -> str:
    return (now_utc() - timedelta(days=max(1, min(days, 1095)))).isoformat()


def safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        if isinstance(value, str) and not value.strip():
            return default
        return float(value)
    except Exception:
        return default


def valid_coord(lat, lng) -> bool:
    lat_f = safe_float(lat, None)
    lng_f = safe_float(lng, None)
    return lat_f is not None and lng_f is not None and -90 <= lat_f <= 90 and -180 <= lng_f <= 180


def city_fallback_coord(city: str = "", seed: str = "") -> tuple[float | None, float | None]:
    city_key = (city or "").strip().lower()
    base = {
        "berlin": (52.5200, 13.4050),
        "hamburg": (53.5511, 9.9937),
        "münchen": (48.1351, 11.5820),
        "munich": (48.1351, 11.5820),
        "köln": (50.9375, 6.9603),
        "cologne": (50.9375, 6.9603),
        "frankfurt": (50.1109, 8.6821),
        "pristina": (42.6629, 21.1655),
    }.get(city_key)
    if not base:
        return None, None
    offset_seed = sum(ord(ch) for ch in seed or city_key)
    lat_offset = ((offset_seed % 17) - 8) * 0.003
    lng_offset = (((offset_seed // 7) % 17) - 8) * 0.004
    return round(base[0] + lat_offset, 6), round(base[1] + lng_offset, 6)


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    phi1 = math.radians(safe_float(lat1))
    phi2 = math.radians(safe_float(lat2))
    d_phi = math.radians(safe_float(lat2) - safe_float(lat1))
    d_lam = math.radians(safe_float(lng2) - safe_float(lng1))
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return round(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def month_key(value: str) -> str:
    raw = str(value or "")
    return raw[:7] if len(raw) >= 7 else "unknown"


def year_key(value: str) -> str:
    raw = str(value or "")
    return raw[:4] if len(raw) >= 4 else "unknown"


def public_customer(user: dict | None, fallback_id: str = "") -> dict:
    user = user or {}
    return {
        "user_id": str(user.get("_id") or user.get("id") or fallback_id),
        "name": user.get("name") or user.get("full_name") or "Unbekannter Kunde",
        "email": user.get("email", ""),
        "role": user.get("role", "user"),
        "user_number": user.get("user_number", ""),
        "last_seen": user.get("last_seen") or user.get("last_login_at") or "",
        "bid_credits": int(user.get("bid_credits", 0) or 0),
    }


async def get_user_by_id(user_id: str) -> dict | None:
    if not user_id:
        return None
    query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
    return await db.users.find_one(query, {"password_hash": 0, "password": 0})


async def load_user_map(user_ids: set[str]) -> dict:
    object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
    string_ids = [uid for uid in user_ids if uid and not uid.startswith("bot_")]
    query_parts = []
    if object_ids:
        query_parts.append({"_id": {"$in": object_ids}})
    if string_ids:
        query_parts.append({"id": {"$in": string_ids}})
    if not query_parts:
        return {}
    users = await db.users.find({"$or": query_parts}, {"password_hash": 0, "password": 0}).to_list(1000)
    result = {}
    for user in users:
        result[str(user.get("_id"))] = user
        if user.get("id"):
            result[user["id"]] = user
    return result


def extract_credits(description: str, package_id: str = "") -> int:
    raw = f"{description or ''} {package_id or ''}"
    match = re.search(r"(\d+)\s*(bid\s*)?(credits|sekunden|seconds|bids)", raw, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    if str(package_id).isdigit():
        return int(package_id)
    return 0


async def seconds_purchases_since(since_iso: str) -> list[dict]:
    query = {
        "created_at": {"$gte": since_iso},
        "status": "completed",
        "$or": [
            {"type": {"$in": ["credit_purchase", "purchase"]}},
            {"category": "auction"},
            {"description": {"$regex": "Bid Credits|Sekunden|seconds|credits", "$options": "i"}},
        ],
    }
    rows = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    purchases = []
    for tx in rows:
        credits = extract_credits(tx.get("description", ""), tx.get("package_id", ""))
        purchases.append({
            "event_id": tx.get("id") or tx.get("reference") or f"sec-{len(purchases)}",
            "user_id": tx.get("user_id", ""),
            "amount": abs(safe_float(tx.get("amount"))),
            "credits": credits,
            "description": tx.get("description") or "Sekunden-/Bid-Credit-Kauf",
            "reference": tx.get("reference", ""),
            "payment_method": tx.get("payment_method", "wallet"),
            "created_at": tx.get("created_at", ""),
        })
    return purchases


async def commerce_events_since(since_iso: str) -> list[dict]:
    events = []
    commerce = await db.commerce_orders.find({"created_at": {"$gte": since_iso}}, {"_id": 0}).sort("created_at", -1).limit(400).to_list(400)
    for item in commerce:
        events.append({
            "event_id": item.get("order_id", ""),
            "user_id": item.get("buyer_id", ""),
            "type": "commerce_order",
            "label": item.get("item_title", "Commerce Order"),
            "merchant_name": item.get("seller_name", ""),
            "amount": safe_float(item.get("total_price")),
            "created_at": item.get("created_at", ""),
        })
    live = await db.live_shopping_orders.find({"created_at": {"$gte": since_iso}}, {"_id": 0}).sort("created_at", -1).limit(400).to_list(400)
    emails = [item.get("user_email", "") for item in live if item.get("user_email")]
    email_users = await db.users.find({"email": {"$in": emails}}, {"password_hash": 0, "password": 0}).to_list(400) if emails else []
    email_map = {u.get("email"): str(u.get("_id")) for u in email_users}
    for item in live:
        events.append({
            "event_id": item.get("order_id", ""),
            "user_id": email_map.get(item.get("user_email", ""), ""),
            "type": "live_shopping_order",
            "label": item.get("product", "Live Shopping"),
            "merchant_name": item.get("host", ""),
            "amount": safe_float(item.get("total")),
            "created_at": item.get("created_at", ""),
        })
    return events


async def pos_events_since(since_iso: str) -> list[dict]:
    sales = await db.pos_sales.find({"created_at": {"$gte": since_iso}}, {"_id": 0}).sort("created_at", -1).limit(800).to_list(800)
    store_ids = {s.get("store_id", "") for s in sales if s.get("store_id")}
    merchant_ids = {s.get("merchant_id", "") for s in sales if s.get("merchant_id")}
    stores = await db.pos_stores.find({"store_id": {"$in": list(store_ids)}}, {"_id": 0}).to_list(300) if store_ids else []
    merchants = await db.pos_merchants.find({"merchant_id": {"$in": list(merchant_ids)}}, {"_id": 0}).to_list(300) if merchant_ids else []
    store_map = {s.get("store_id"): s for s in stores}
    merchant_map = {m.get("merchant_id"): m for m in merchants}
    events = []
    for sale in sales:
        store = store_map.get(sale.get("store_id"), {})
        merchant = merchant_map.get(sale.get("merchant_id"), {})
        lat = store.get("lat")
        lng = store.get("lng")
        if not valid_coord(lat, lng):
            lat, lng = city_fallback_coord(store.get("city", ""), sale.get("store_id", ""))
        events.append({
            "event_id": sale.get("sale_id", ""),
            "user_id": sale.get("customer_id", ""),
            "type": "pos_sale",
            "label": ", ".join([i.get("name", "Artikel") for i in (sale.get("items") or [])[:3]]) or "POS Einkauf",
            "merchant_name": merchant.get("business_name") or sale.get("merchant_id", ""),
            "store_id": sale.get("store_id", ""),
            "store_name": store.get("name") or sale.get("store_id", ""),
            "lat": lat,
            "lng": lng,
            "city": store.get("city", ""),
            "amount": safe_float(sale.get("total")),
            "created_at": sale.get("created_at", ""),
        })
    return events


async def location_events_since(since_iso: str) -> list[dict]:
    events = []
    recent = await db.mobility_recent_locations.find({"updated_at": {"$gte": since_iso}}, {"_id": 0}).sort("updated_at", -1).limit(600).to_list(600)
    for item in recent:
        if valid_coord(item.get("lat"), item.get("lng")):
            events.append({
                "event_id": f"loc-{item.get('user_id','')}-{item.get('updated_at','')}",
                "user_id": item.get("user_id", ""),
                "type": "recent_location",
                "label": item.get("address") or item.get("label") or "Standort",
                "lat": safe_float(item.get("lat")),
                "lng": safe_float(item.get("lng")),
                "created_at": item.get("updated_at", ""),
                "use_count": int(item.get("use_count", 1) or 1),
            })
    bookings = await db.mobility_bookings.find({"created_at": {"$gte": since_iso}}, {"_id": 0}).sort("created_at", -1).limit(600).to_list(600)
    for item in bookings:
        pickup = item.get("pickup") or {}
        if valid_coord(pickup.get("lat"), pickup.get("lng")):
            events.append({
                "event_id": item.get("booking_id", ""),
                "user_id": item.get("user_id", ""),
                "type": "mobility_booking",
                "label": f"{item.get('transport_label', 'Mobility')} · {pickup.get('address', '')}",
                "lat": safe_float(pickup.get("lat")),
                "lng": safe_float(pickup.get("lng")),
                "amount": safe_float(item.get("price_eur")),
                "created_at": item.get("created_at", ""),
            })
    return events


async def build_customer_markers(since_iso: str) -> tuple[list[dict], list[dict]]:
    location_events = await location_events_since(since_iso)
    pos_events = await pos_events_since(since_iso)
    by_user = {}
    for event in location_events:
        uid = event.get("user_id", "")
        if uid and valid_coord(event.get("lat"), event.get("lng")) and uid not in by_user:
            by_user[uid] = event
    user_map = await load_user_map(set(by_user.keys()))
    markers = []
    for uid, event in by_user.items():
        user = public_customer(user_map.get(uid), uid)
        markers.append({
            "marker_id": f"customer-{uid}",
            "type": "customer",
            "user": user,
            "label": event.get("label", ""),
            "lat": event.get("lat"),
            "lng": event.get("lng"),
            "last_seen": event.get("created_at", ""),
            "signal": event.get("type", "location"),
        })
    store_markers = []
    seen = set()
    for event in pos_events:
        sid = event.get("store_id")
        if sid and sid not in seen and valid_coord(event.get("lat"), event.get("lng")):
            seen.add(sid)
            store_markers.append({
                "marker_id": f"store-{sid}",
                "type": "store",
                "store_id": sid,
                "store_name": event.get("store_name", sid),
                "merchant_name": event.get("merchant_name", ""),
                "lat": event.get("lat"),
                "lng": event.get("lng"),
                "city": event.get("city", ""),
            })
    return markers, store_markers


@router.get("/overview")
async def customer_intelligence_overview(request: Request, days: int = Query(365, ge=1, le=1095)):
    admin = await require_admin(request)
    since = iso_days_ago(days)
    seconds = await seconds_purchases_since(since)
    commerce = await commerce_events_since(since)
    pos = await pos_events_since(since)
    customer_markers, store_markers = await build_customer_markers(since)
    user_ids = {e.get("user_id", "") for e in seconds + commerce + pos if e.get("user_id") and not str(e.get("user_id", "")).startswith("bot_")}
    users = await load_user_map(user_ids)

    by_user = defaultdict(lambda: {"seconds_revenue": 0.0, "seconds_credits": 0, "purchases": 0, "commerce_revenue": 0.0, "pos_revenue": 0.0, "last_event_at": ""})
    monthly = defaultdict(lambda: {"seconds_revenue": 0.0, "seconds_credits": 0, "commerce_revenue": 0.0, "pos_revenue": 0.0, "events": 0})
    yearly = defaultdict(lambda: {"seconds_revenue": 0.0, "seconds_credits": 0, "commerce_revenue": 0.0, "pos_revenue": 0.0, "events": 0})

    for item in seconds:
        uid = item.get("user_id", "")
        by_user[uid]["seconds_revenue"] += item["amount"]
        by_user[uid]["seconds_credits"] += item["credits"]
        by_user[uid]["purchases"] += 1
        by_user[uid]["last_event_at"] = max(by_user[uid]["last_event_at"], item.get("created_at", ""))
        monthly[month_key(item.get("created_at"))]["seconds_revenue"] += item["amount"]
        monthly[month_key(item.get("created_at"))]["seconds_credits"] += item["credits"]
        monthly[month_key(item.get("created_at"))]["events"] += 1
        yearly[year_key(item.get("created_at"))]["seconds_revenue"] += item["amount"]
        yearly[year_key(item.get("created_at"))]["seconds_credits"] += item["credits"]
        yearly[year_key(item.get("created_at"))]["events"] += 1
    for item in commerce:
        uid = item.get("user_id", "")
        by_user[uid]["commerce_revenue"] += item["amount"]
        by_user[uid]["purchases"] += 1
        by_user[uid]["last_event_at"] = max(by_user[uid]["last_event_at"], item.get("created_at", ""))
        monthly[month_key(item.get("created_at"))]["commerce_revenue"] += item["amount"]
        yearly[year_key(item.get("created_at"))]["commerce_revenue"] += item["amount"]
    for item in pos:
        uid = item.get("user_id", "")
        if uid:
            by_user[uid]["pos_revenue"] += item["amount"]
            by_user[uid]["purchases"] += 1
            by_user[uid]["last_event_at"] = max(by_user[uid]["last_event_at"], item.get("created_at", ""))
        monthly[month_key(item.get("created_at"))]["pos_revenue"] += item["amount"]
        yearly[year_key(item.get("created_at"))]["pos_revenue"] += item["amount"]

    top_customers = []
    for uid, stats in by_user.items():
        if not uid:
            continue
        user = public_customer(users.get(uid), uid)
        total = stats["seconds_revenue"] + stats["commerce_revenue"] + stats["pos_revenue"]
        top_customers.append({"user": user, **stats, "total_revenue": round(total, 2)})
    top_customers.sort(key=lambda x: x["total_revenue"], reverse=True)

    timeline = []
    for key in sorted(monthly.keys()):
        row = monthly[key]
        timeline.append({"month": key, **{k: round(v, 2) if isinstance(v, float) else v for k, v in row.items()}})
    yearly_rows = []
    for key in sorted(yearly.keys()):
        row = yearly[key]
        total = row["seconds_revenue"] + row["commerce_revenue"] + row["pos_revenue"]
        yearly_rows.append({"year": key, "total_revenue": round(total, 2), **{k: round(v, 2) if isinstance(v, float) else v for k, v in row.items()}})

    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, user_id=str(admin.get("_id")), email=admin.get("email", ""), ip=ip, user_agent=ua, details={"action": "view_customer_intelligence", "days": days})

    store_visit_matches = 0
    for customer in customer_markers:
        for store in store_markers:
            if valid_coord(customer.get("lat"), customer.get("lng")) and valid_coord(store.get("lat"), store.get("lng")):
                if haversine_km(customer["lat"], customer["lng"], store["lat"], store["lng"]) <= 1.0:
                    store_visit_matches += 1

    return {
        "ok": True,
        "period_days": days,
        "summary": {
            "seconds_purchases": len(seconds),
            "seconds_revenue": round(sum(i["amount"] for i in seconds), 2),
            "seconds_credits": sum(i["credits"] for i in seconds),
            "commerce_orders": len(commerce),
            "commerce_revenue": round(sum(i["amount"] for i in commerce), 2),
            "pos_sales": len(pos),
            "pos_revenue": round(sum(i["amount"] for i in pos), 2),
            "located_customers": len(customer_markers),
            "visited_stores": len(store_markers),
            "store_visit_matches": store_visit_matches,
        },
        "top_customers": top_customers[:30],
        "recent_seconds_purchases": seconds[:50],
        "recent_customer_events": sorted((commerce + pos)[:120], key=lambda e: e.get("created_at", ""), reverse=True)[:80],
        "map": {"customers": customer_markers[:200], "stores": store_markers[:100]},
        "timeline_monthly": timeline,
        "timeline_yearly": yearly_rows,
    }


@router.get("/customer/{user_id}")
async def customer_intelligence_detail(user_id: str, request: Request, days: int = Query(365, ge=1, le=1095)):
    await require_admin(request)
    since = iso_days_ago(days)
    user = await get_user_by_id(user_id)
    seconds = [item for item in await seconds_purchases_since(since) if item.get("user_id") == user_id]
    commerce = [item for item in await commerce_events_since(since) if item.get("user_id") == user_id]
    pos = [item for item in await pos_events_since(since) if item.get("user_id") == user_id]
    locations = [item for item in await location_events_since(since) if item.get("user_id") == user_id]
    visited = []
    for loc in locations:
        for sale in pos:
            if valid_coord(loc.get("lat"), loc.get("lng")) and valid_coord(sale.get("lat"), sale.get("lng")):
                distance = haversine_km(loc["lat"], loc["lng"], sale["lat"], sale["lng"])
                if distance <= 1.0:
                    visited.append({"store_name": sale.get("store_name", ""), "merchant_name": sale.get("merchant_name", ""), "distance_km": distance, "at": max(loc.get("created_at", ""), sale.get("created_at", ""))})
    return {
        "ok": True,
        "customer": public_customer(user, user_id),
        "summary": {
            "seconds_purchases": len(seconds),
            "seconds_revenue": round(sum(i["amount"] for i in seconds), 2),
            "commerce_revenue": round(sum(i["amount"] for i in commerce), 2),
            "pos_revenue": round(sum(i["amount"] for i in pos), 2),
            "location_signals": len(locations),
            "store_visit_matches": len(visited),
        },
        "seconds_purchases": seconds[:100],
        "commerce_events": commerce[:100],
        "pos_events": pos[:100],
        "locations": locations[:100],
        "store_visit_matches": visited[:50],
    }