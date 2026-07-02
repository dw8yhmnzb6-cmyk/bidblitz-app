from collections import defaultdict
from datetime import datetime, timezone, timedelta
import math
import re
import secrets

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from core.audit import AuditEvent, get_client_info, log_audit
from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/admin/customer-intelligence", tags=["admin-customer-intelligence"])


class RadarActionRequest(BaseModel):
    action_type: str
    user_id: str
    alert_id: str = ""
    store_id: str = ""
    merchant_id: str = ""
    template_id: str = ""
    coupon_value: float = 5.0
    message: str = ""


class RadarTemplateRequest(BaseModel):
    name: str
    action_type: str = "coupon_push_alert"
    coupon_value: float = 5.0
    message: str
    segment: str = "all"
    active: bool = True


class RadarRuleRequest(BaseModel):
    name: str
    template_id: str
    segment: str = "vip_seconds_buyers"
    trigger_type: str = "customer_near_shop"
    min_total_revenue: float = 0
    max_distance_km: float = 1.0
    cooldown_hours: int = 24
    daily_cap: int = 25
    active: bool = True


class RadarRuleRunRequest(BaseModel):
    rule_id: str
    dry_run: bool = True
    days: int = 365


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


def hours_since(value: str) -> float | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return round((now_utc() - parsed).total_seconds() / 3600, 2)
    except Exception:
        return None


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


def customer_segments(customer_rows: list[dict]) -> dict:
    segments = {
        "vip_seconds_buyers": [],
        "omnichannel_buyers": [],
        "pos_loyalists": [],
        "dormant_high_value": [],
    }
    for row in customer_rows:
        channels = sum(1 for key in ["seconds_revenue", "commerce_revenue", "pos_revenue"] if safe_float(row.get(key)) > 0)
        payload = {
            "user": row["user"],
            "total_revenue": row.get("total_revenue", 0),
            "seconds_revenue": round(row.get("seconds_revenue", 0), 2),
            "seconds_credits": row.get("seconds_credits", 0),
            "channels": channels,
            "last_event_at": row.get("last_event_at", ""),
        }
        if row.get("seconds_revenue", 0) >= 100 or row.get("seconds_credits", 0) >= 50:
            segments["vip_seconds_buyers"].append(payload)
        if channels >= 2:
            segments["omnichannel_buyers"].append(payload)
        if row.get("pos_revenue", 0) >= 25 or (row.get("pos_revenue", 0) > 0 and row.get("purchases", 0) >= 3):
            segments["pos_loyalists"].append(payload)
        age_hours = hours_since(row.get("last_event_at", ""))
        if row.get("total_revenue", 0) >= 100 and age_hours is not None and age_hours > 24 * 60:
            payload["inactive_days"] = int(age_hours / 24)
            segments["dormant_high_value"].append(payload)
    return {key: value[:12] for key, value in segments.items()}


def build_heatmap(customer_markers: list[dict], customer_rows: list[dict]) -> list[dict]:
    revenue_by_user = {row["user"]["user_id"]: row.get("total_revenue", 0) for row in customer_rows}
    cells = {}
    for marker in customer_markers:
        if not valid_coord(marker.get("lat"), marker.get("lng")):
            continue
        lat_bucket = round(safe_float(marker.get("lat")), 2)
        lng_bucket = round(safe_float(marker.get("lng")), 2)
        key = f"{lat_bucket}:{lng_bucket}"
        cell = cells.setdefault(key, {"cell_id": key, "lat": lat_bucket, "lng": lng_bucket, "customers": 0, "revenue": 0.0, "last_seen": ""})
        cell["customers"] += 1
        cell["revenue"] += safe_float(revenue_by_user.get(marker.get("user", {}).get("user_id", "")))
        cell["last_seen"] = max(cell["last_seen"], marker.get("last_seen", ""))
    rows = [{**cell, "revenue": round(cell["revenue"], 2), "intensity": min(100, cell["customers"] * 25 + int(cell["revenue"] / 20))} for cell in cells.values()]
    rows.sort(key=lambda item: (item["customers"], item["revenue"]), reverse=True)
    return rows[:40]


def build_radar_alerts(customer_markers: list[dict], store_markers: list[dict], customer_rows: list[dict]) -> list[dict]:
    rows_by_user = {row["user"]["user_id"]: row for row in customer_rows}
    alerts = []
    for marker in customer_markers:
        user = marker.get("user", {})
        row = rows_by_user.get(user.get("user_id", ""), {})
        for store in store_markers:
            if not valid_coord(marker.get("lat"), marker.get("lng")) or not valid_coord(store.get("lat"), store.get("lng")):
                continue
            distance = haversine_km(marker["lat"], marker["lng"], store["lat"], store["lng"])
            if distance <= 1.0:
                alerts.append({
                    "alert_id": f"near-{user.get('user_id','')}-{store.get('store_id','')}",
                    "type": "customer_near_shop",
                    "severity": "high" if row.get("total_revenue", 0) >= 100 else "medium",
                    "title": "Kunde nahe Partner-Shop",
                    "message": f"{user.get('name', 'Kunde')} ist ca. {distance} km von {store.get('store_name', 'Shop')} entfernt.",
                    "user": user,
                    "store": store,
                    "distance_km": distance,
                    "last_seen": marker.get("last_seen", ""),
                    "recommended_action": "VIP-Angebot, Push-Coupon oder Shop-Personal-Hinweis prüfen",
                })
    for row in customer_rows[:20]:
        if row.get("seconds_revenue", 0) >= 100:
            alerts.append({
                "alert_id": f"vip-seconds-{row['user']['user_id']}",
                "type": "vip_seconds_buyer",
                "severity": "medium",
                "title": "VIP Sekunden-Käufer",
                "message": f"{row['user']['name']} hat €{round(row.get('seconds_revenue', 0), 2)} in Sekunden/Credits gekauft.",
                "user": row["user"],
                "recommended_action": "High-value Retention oder Premium Bundle anbieten",
            })
    return alerts[:30]


def privacy_policy_summary() -> dict:
    return {
        "status": "policy_ready",
        "precise_location_retention_hours": 24,
        "aggregated_analytics_retention_days": 1095,
        "admin_access": "Nur Admin-Rolle; Zugriff wird im Audit-Log protokolliert",
        "consent_mode": "Standortsignale werden nur aus vorhandenen App-Funktionen gelesen; Consent-Collection ist vorbereitet, falls granularer Opt-in aktiviert wird",
        "recommended_next_step": "Granulare Standort-Einwilligung pro Use-Case und automatische Löschung präziser Rohdaten aktivieren",
    }


def build_coupon_code(prefix: str = "RADAR") -> str:
    return f"{prefix}-{secrets.token_hex(3).upper()}"


def default_radar_templates() -> list[dict]:
    return [
        {
            "template_id": "tpl-vip-near-shop",
            "name": "VIP nahe Shop",
            "action_type": "coupon_push_alert",
            "coupon_value": 10.0,
            "message": "VIP-Angebot aktiviert: Dein persönlicher BidBlitz Coupon wartet jetzt.",
            "segment": "vip_seconds_buyers",
            "active": True,
            "system": True,
        },
        {
            "template_id": "tpl-omni-bundle",
            "name": "Omnichannel Bundle",
            "action_type": "coupon_push_alert",
            "coupon_value": 7.5,
            "message": "Exklusives Bundle für deine nächsten BidBlitz- und Shop-Käufe ist aktiv.",
            "segment": "omnichannel_buyers",
            "active": True,
            "system": True,
        },
        {
            "template_id": "tpl-manager-only",
            "name": "Manager Alert only",
            "action_type": "manager_alert",
            "coupon_value": 0.0,
            "message": "Top-Kunde in Shopnähe: persönliches Angebot oder Service-Touchpoint prüfen.",
            "segment": "pos_loyalists",
            "active": True,
            "system": True,
        },
        {
            "template_id": "tpl-reactivation",
            "name": "Reaktivierung",
            "action_type": "coupon_push_alert",
            "coupon_value": 5.0,
            "message": "Wir vermissen dich: Dein Reaktivierungs-Coupon ist 14 Tage aktiv.",
            "segment": "dormant_high_value",
            "active": True,
            "system": True,
        },
    ]


async def load_radar_templates(include_inactive: bool = False) -> list[dict]:
    query = {} if include_inactive else {"active": {"$ne": False}}
    custom = await db.customer_radar_templates.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    defaults = default_radar_templates()
    templates = custom + defaults
    return [tpl for tpl in templates if include_inactive or tpl.get("active", True)]


async def find_radar_template(template_id: str) -> dict | None:
    if not template_id:
        return None
    custom = await db.customer_radar_templates.find_one({"template_id": template_id}, {"_id": 0})
    if custom:
        return custom
    return next((tpl for tpl in default_radar_templates() if tpl["template_id"] == template_id), None)


async def build_radar_metrics() -> dict:
    actions = await db.customer_radar_actions.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    coupons = await db.coupons.find({"source": "admin_customer_radar"}, {"_id": 0, "used_count": 1, "value": 1, "created_at": 1}).to_list(1000)
    by_type = defaultdict(int)
    by_template = defaultdict(int)
    daily = defaultdict(int)
    for action in actions:
        by_type[action.get("action_type", "unknown")] += 1
        if action.get("template_id"):
            by_template[action["template_id"]] += 1
        daily[str(action.get("created_at", ""))[:10]] += 1
    redeemed = [coupon for coupon in coupons if int(coupon.get("used_count", 0) or 0) > 0]
    return {
        "total_actions": len(actions),
        "coupons_issued": len(coupons),
        "coupons_redeemed": len(redeemed),
        "redemption_rate": round((len(redeemed) / len(coupons)) * 100, 2) if coupons else 0,
        "coupon_value_issued": round(sum(safe_float(c.get("value")) for c in coupons), 2),
        "by_type": dict(by_type),
        "by_template": dict(by_template),
        "daily": [{"date": key, "actions": daily[key]} for key in sorted(daily.keys())[-30:]],
    }


async def load_radar_history(limit: int = 80) -> list[dict]:
    actions = await db.customer_radar_actions.find({}, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 200)).to_list(min(max(limit, 1), 200))
    user_ids = {action.get("user_id", "") for action in actions if action.get("user_id")}
    users = await load_user_map(user_ids)
    for action in actions:
        action["user"] = public_customer(users.get(action.get("user_id", "")), action.get("user_id", ""))
    return actions


async def load_radar_rules(include_inactive: bool = True) -> list[dict]:
    query = {} if include_inactive else {"active": True}
    rules = await db.customer_radar_rules.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return rules


def segment_members(segment: str, segments: dict, top_customers: list[dict]) -> set[str]:
    if segment == "all":
        return {row["user"]["user_id"] for row in top_customers}
    return {row["user"]["user_id"] for row in segments.get(segment, [])}


async def build_intelligence_context(days: int = 365) -> dict:
    since = iso_days_ago(days)
    seconds = await seconds_purchases_since(since)
    commerce = await commerce_events_since(since)
    pos = await pos_events_since(since)
    customer_markers, store_markers = await build_customer_markers(since)
    user_ids = {e.get("user_id", "") for e in seconds + commerce + pos if e.get("user_id") and not str(e.get("user_id", "")).startswith("bot_")}
    users = await load_user_map(user_ids)
    by_user = defaultdict(lambda: {"seconds_revenue": 0.0, "seconds_credits": 0, "purchases": 0, "commerce_revenue": 0.0, "pos_revenue": 0.0, "last_event_at": ""})
    for item in seconds:
        uid = item.get("user_id", "")
        by_user[uid]["seconds_revenue"] += item["amount"]
        by_user[uid]["seconds_credits"] += item["credits"]
        by_user[uid]["purchases"] += 1
        by_user[uid]["last_event_at"] = max(by_user[uid]["last_event_at"], item.get("created_at", ""))
    for item in commerce:
        uid = item.get("user_id", "")
        by_user[uid]["commerce_revenue"] += item["amount"]
        by_user[uid]["purchases"] += 1
        by_user[uid]["last_event_at"] = max(by_user[uid]["last_event_at"], item.get("created_at", ""))
    for item in pos:
        uid = item.get("user_id", "")
        if uid:
            by_user[uid]["pos_revenue"] += item["amount"]
            by_user[uid]["purchases"] += 1
            by_user[uid]["last_event_at"] = max(by_user[uid]["last_event_at"], item.get("created_at", ""))
    top_customers = []
    for uid, stats in by_user.items():
        if not uid:
            continue
        user = public_customer(users.get(uid), uid)
        total = stats["seconds_revenue"] + stats["commerce_revenue"] + stats["pos_revenue"]
        top_customers.append({"user": user, **stats, "total_revenue": round(total, 2)})
    top_customers.sort(key=lambda x: x["total_revenue"], reverse=True)
    segments = customer_segments(top_customers)
    alerts = build_radar_alerts(customer_markers, store_markers, top_customers)
    return {"top_customers": top_customers, "segments": segments, "alerts": alerts, "customer_markers": customer_markers, "store_markers": store_markers}


async def evaluate_radar_rule(rule: dict, days: int = 365) -> dict:
    context = await build_intelligence_context(days)
    members = segment_members(rule.get("segment", "all"), context["segments"], context["top_customers"])
    revenue_by_user = {row["user"]["user_id"]: row.get("total_revenue", 0) for row in context["top_customers"]}
    matched = []
    for alert in context["alerts"]:
        uid = alert.get("user", {}).get("user_id", "")
        if uid not in members:
            continue
        if safe_float(revenue_by_user.get(uid)) < safe_float(rule.get("min_total_revenue", 0)):
            continue
        if rule.get("trigger_type") == "customer_near_shop" and safe_float(alert.get("distance_km", 999)) > safe_float(rule.get("max_distance_km", 1.0)):
            continue
        matched.append(alert)
    return {"matches": matched[: int(rule.get("daily_cap", 25) or 25)], "match_count": len(matched), "context_summary": {"alerts": len(context["alerts"]), "segment_members": len(members)}}


async def execute_rule_matches(admin: dict, rule: dict, matches: list[dict], dry_run: bool) -> dict:
    template = await find_radar_template(rule.get("template_id", ""))
    if not template:
        raise HTTPException(status_code=404, detail="Rule Template nicht gefunden")
    executed = []
    skipped = []
    cooldown_start = (now_utc() - timedelta(hours=int(rule.get("cooldown_hours", 24) or 24))).isoformat()
    for alert in matches[: int(rule.get("daily_cap", 25) or 25)]:
        uid = alert.get("user", {}).get("user_id", "")
        recent = await db.customer_radar_actions.find_one({"user_id": uid, "rule_id": rule.get("rule_id"), "created_at": {"$gte": cooldown_start}}, {"_id": 0})
        if recent:
            skipped.append({"user_id": uid, "reason": "cooldown"})
            continue
        payload = RadarActionRequest(
            action_type=template.get("action_type", "coupon_push_alert"),
            user_id=uid,
            alert_id=alert.get("alert_id", ""),
            store_id=(alert.get("store") or {}).get("store_id", ""),
            merchant_id=(alert.get("store") or {}).get("merchant_id", ""),
            template_id=template.get("template_id", ""),
            coupon_value=safe_float(template.get("coupon_value"), 5),
            message=template.get("message", ""),
        )
        if dry_run:
            executed.append({"user_id": uid, "status": "would_execute", "template_id": payload.template_id})
            continue
        user = await get_user_by_id(uid)
        if not user:
            skipped.append({"user_id": uid, "reason": "user_not_found"})
            continue
        coupon = await create_radar_coupon(admin, user, payload) if payload.action_type in {"coupon", "coupon_push_alert"} else None
        notification = await create_customer_notification(user, "BidBlitz Radar Angebot", payload.message or "Ein persönliches Angebot wartet auf dich.", {"action_url": "/wallet", "coupon_code": (coupon or {}).get("code", ""), "source": "admin_customer_radar_rule", "rule_id": rule.get("rule_id", "")}) if payload.action_type in {"push", "coupon_push_alert"} else None
        manager_alert = await create_manager_alert(admin, user, payload, coupon) if payload.action_type in {"manager_alert", "coupon_push_alert"} else None
        action_doc = {"action_id": f"CRA-{secrets.token_hex(6).upper()}", "action_type": payload.action_type, "user_id": uid, "store_id": payload.store_id, "merchant_id": payload.merchant_id, "alert_id": payload.alert_id, "template_id": payload.template_id, "rule_id": rule.get("rule_id", ""), "coupon_code": (coupon or {}).get("code", ""), "notification_id": (notification or {}).get("notif_id", ""), "manager_alert_id": (manager_alert or {}).get("alert_id", ""), "created_by": str(admin.get("_id")), "created_at": now_utc().isoformat(), "source": "automation_rule"}
        await db.customer_radar_actions.insert_one(action_doc.copy())
        action_doc.pop("_id", None)
        executed.append(action_doc)
    return {"executed": executed, "skipped": skipped}


async def create_radar_coupon(admin: dict, user: dict, req: RadarActionRequest) -> dict:
    value = round(max(1.0, min(float(req.coupon_value or 5.0), 100.0)), 2)
    code = build_coupon_code("RADAR")
    expires_at = (now_utc() + timedelta(days=14)).isoformat()
    doc = {
        "coupon_id": f"RC-{secrets.token_hex(6).upper()}",
        "code": code,
        "coupon_type": "customer_radar",
        "value": value,
        "description": f"Radar Coupon für {user.get('name', 'Kunde')}",
        "max_uses": 1,
        "used_count": 0,
        "target_user_id": str(user.get("_id") or user.get("id") or req.user_id),
        "target_user_email": user.get("email", ""),
        "store_id": req.store_id,
        "merchant_id": req.merchant_id,
        "created_by": str(admin.get("_id")),
        "created_at": now_utc().isoformat(),
        "expires_at": expires_at,
        "active": True,
        "source": "admin_customer_radar",
        "alert_id": req.alert_id,
        "template_id": req.template_id,
    }
    await db.coupons.insert_one(doc.copy())
    await db.promo_codes.update_one(
        {"code": code},
        {"$setOnInsert": {"code": code, "active": True, "created_at": doc["created_at"], "creator_email": admin.get("email", ""), "description": doc["description"], "max_uses": 1, "type": "credit", "used_count": 0, "value": value, "target_user_id": doc["target_user_id"], "expires_at": expires_at}},
        upsert=True,
    )
    doc.pop("_id", None)
    return doc


async def create_customer_notification(user: dict, title: str, body: str, data: dict) -> dict:
    user_id = str(user.get("_id") or user.get("id") or "")
    doc = {
        "notif_id": f"RAD-N-{secrets.token_hex(8)}",
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "category": "customer_radar",
        "title": title,
        "body": body,
        "action_url": data.get("action_url", "/wallet"),
        "read": False,
        "created_at": now_utc().isoformat(),
        "data": data,
    }
    await db.notifications.insert_one(doc.copy())
    try:
        from routes.web_push import send_push_to_user
        await send_push_to_user(user_id, title, body, data=data)
    except Exception:
        pass
    doc.pop("_id", None)
    return doc


async def create_manager_alert(admin: dict, user: dict, req: RadarActionRequest, coupon: dict | None = None) -> dict:
    doc = {
        "alert_id": f"MRA-{secrets.token_hex(6).upper()}",
        "type": "customer_live_radar_action",
        "severity": "high",
        "status": "open",
        "merchant_id": req.merchant_id,
        "store_id": req.store_id,
        "customer_id": str(user.get("_id") or user.get("id") or req.user_id),
        "customer_name": user.get("name", ""),
        "customer_email": user.get("email", ""),
        "title": "Customer Radar Aktion",
        "message": req.message or f"Kunde {user.get('name', 'Kunde')} erhält Radar-Angebot.",
        "coupon_code": (coupon or {}).get("code", ""),
        "created_by": str(admin.get("_id")),
        "created_at": now_utc().isoformat(),
        "source_alert_id": req.alert_id,
    }
    await db.merchant_alerts.insert_one(doc.copy())
    await db.pos_security_alerts.insert_one({**doc, "alert_id": f"PSR-{secrets.token_hex(6).upper()}", "details": {"source": "customer_live_radar", "coupon_code": doc["coupon_code"]}})
    doc.pop("_id", None)
    return doc


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
    segments = customer_segments(top_customers)

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
    radar_alerts = build_radar_alerts(customer_markers, store_markers, top_customers)
    heatmap = build_heatmap(customer_markers, top_customers)
    templates = await load_radar_templates()
    metrics = await build_radar_metrics()
    history = await load_radar_history(30)
    automation_rules = await load_radar_rules(True)

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
        "radar_alerts": radar_alerts,
        "segments": segments,
        "heatmap": heatmap,
        "privacy_policy": privacy_policy_summary(),
        "campaign_templates": templates,
        "campaign_metrics": metrics,
        "radar_history": history,
        "automation_rules": automation_rules,
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


@router.post("/radar/action")
async def execute_radar_action(req: RadarActionRequest, request: Request):
    admin = await require_admin(request)
    template = await find_radar_template(req.template_id)
    if template:
        req.action_type = template.get("action_type", req.action_type)
        req.coupon_value = safe_float(template.get("coupon_value"), req.coupon_value)
        if not req.message:
            req.message = template.get("message", "")
    allowed = {"coupon", "push", "manager_alert", "coupon_push_alert"}
    if req.action_type not in allowed:
        raise HTTPException(status_code=400, detail="Ungültige Radar-Aktion")
    user = await get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    coupon = None
    notification = None
    manager_alert = None
    if req.action_type in {"coupon", "coupon_push_alert"}:
        coupon = await create_radar_coupon(admin, user, req)
    if req.action_type in {"push", "coupon_push_alert"}:
        title = "BidBlitz Radar Angebot"
        body = req.message or (f"Dein persönlicher Coupon {coupon['code']} ist aktiv." if coupon else "Ein persönliches Angebot wartet auf dich.")
        notification = await create_customer_notification(user, title, body, {"action_url": "/wallet", "coupon_code": (coupon or {}).get("code", ""), "source": "admin_customer_radar", "alert_id": req.alert_id})
    if req.action_type in {"manager_alert", "coupon_push_alert"}:
        manager_alert = await create_manager_alert(admin, user, req, coupon)
    action_doc = {
        "action_id": f"CRA-{secrets.token_hex(6).upper()}",
        "action_type": req.action_type,
        "user_id": str(user.get("_id") or user.get("id") or req.user_id),
        "store_id": req.store_id,
        "merchant_id": req.merchant_id,
        "alert_id": req.alert_id,
        "template_id": req.template_id,
        "coupon_code": (coupon or {}).get("code", ""),
        "notification_id": (notification or {}).get("notif_id", ""),
        "manager_alert_id": (manager_alert or {}).get("alert_id", ""),
        "created_by": str(admin.get("_id")),
        "created_at": now_utc().isoformat(),
    }
    await db.customer_radar_actions.insert_one(action_doc.copy())
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, user_id=str(admin.get("_id")), email=admin.get("email", ""), ip=ip, user_agent=ua, details={"action": "execute_customer_radar_action", "action_type": req.action_type, "target_user": action_doc["user_id"], "coupon_code": action_doc["coupon_code"]})
    action_doc.pop("_id", None)
    return {"ok": True, "action": action_doc, "coupon": coupon, "notification": notification, "manager_alert": manager_alert}


@router.get("/radar/templates")
async def get_radar_templates(request: Request):
    await require_admin(request)
    return {"ok": True, "templates": await load_radar_templates(include_inactive=True)}


@router.post("/radar/templates")
async def create_radar_template(req: RadarTemplateRequest, request: Request):
    admin = await require_admin(request)
    allowed = {"coupon", "push", "manager_alert", "coupon_push_alert"}
    if req.action_type not in allowed:
        raise HTTPException(status_code=400, detail="Ungültiger Template-Aktionstyp")
    doc = {
        "template_id": f"tpl-{secrets.token_hex(5)}",
        "name": req.name.strip()[:80],
        "action_type": req.action_type,
        "coupon_value": round(max(0, min(req.coupon_value, 100)), 2),
        "message": req.message.strip()[:280],
        "segment": req.segment,
        "active": req.active,
        "system": False,
        "created_by": str(admin.get("_id")),
        "created_at": now_utc().isoformat(),
    }
    if not doc["name"] or not doc["message"]:
        raise HTTPException(status_code=400, detail="Name und Nachricht erforderlich")
    await db.customer_radar_templates.insert_one(doc.copy())
    doc.pop("_id", None)
    return {"ok": True, "template": doc}


@router.get("/radar/history")
async def get_radar_history(request: Request, limit: int = Query(80, ge=1, le=200)):
    await require_admin(request)
    return {"ok": True, "history": await load_radar_history(limit), "metrics": await build_radar_metrics()}


@router.get("/radar/rules")
async def get_radar_rules(request: Request):
    await require_admin(request)
    return {"ok": True, "rules": await load_radar_rules(True)}


@router.post("/radar/rules")
async def create_radar_rule(req: RadarRuleRequest, request: Request):
    admin = await require_admin(request)
    template = await find_radar_template(req.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    doc = {
        "rule_id": f"rule-{secrets.token_hex(5)}",
        "name": req.name.strip()[:90],
        "template_id": req.template_id,
        "segment": req.segment,
        "trigger_type": req.trigger_type,
        "min_total_revenue": round(max(0, req.min_total_revenue), 2),
        "max_distance_km": round(max(0.1, min(req.max_distance_km, 50)), 2),
        "cooldown_hours": max(1, min(req.cooldown_hours, 24 * 30)),
        "daily_cap": max(1, min(req.daily_cap, 250)),
        "active": req.active,
        "created_by": str(admin.get("_id")),
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
        "last_run_at": None,
        "last_result": None,
    }
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="Rule-Name erforderlich")
    await db.customer_radar_rules.insert_one(doc.copy())
    doc.pop("_id", None)
    return {"ok": True, "rule": doc}


@router.post("/radar/rules/run")
async def run_radar_rule(req: RadarRuleRunRequest, request: Request):
    admin = await require_admin(request)
    rule = await db.customer_radar_rules.find_one({"rule_id": req.rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule nicht gefunden")
    evaluation = await evaluate_radar_rule(rule, req.days)
    result = await execute_rule_matches(admin, rule, evaluation["matches"], req.dry_run)
    run_doc = {
        "run_id": f"run-{secrets.token_hex(6)}",
        "rule_id": req.rule_id,
        "dry_run": req.dry_run,
        "match_count": evaluation["match_count"],
        "executed_count": len(result["executed"]),
        "skipped_count": len(result["skipped"]),
        "executed": result["executed"][:50],
        "skipped": result["skipped"][:50],
        "context_summary": evaluation["context_summary"],
        "created_by": str(admin.get("_id")),
        "created_at": now_utc().isoformat(),
    }
    await db.customer_radar_rule_runs.insert_one(run_doc.copy())
    await db.customer_radar_rules.update_one({"rule_id": req.rule_id}, {"$set": {"last_run_at": run_doc["created_at"], "last_result": {"dry_run": req.dry_run, "match_count": run_doc["match_count"], "executed_count": run_doc["executed_count"], "skipped_count": run_doc["skipped_count"]}}})
    run_doc.pop("_id", None)
    return {"ok": True, "run": run_doc, "matches": evaluation["matches"][:30]}