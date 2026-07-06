"""
POS Feature-Flags / Add-Ons
Merchants können einzelne Pro-Features (Tisch-Reservierung, QR-Bestellung, KDS, ...)
zubuchen. Admin schaltet sie frei oder sperrt sie.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)
from core.database import db
from core.security import get_current_user
from core.config import STRIPE_API_KEY

router = APIRouter(prefix="/api/pos/features", tags=["POS Features"])


# ═══════════════════════════════════════════════════════════
# CATALOG — alle verfügbaren Add-Ons mit Preisen
# ═══════════════════════════════════════════════════════════
FEATURE_CATALOG = [
    {"key": "table_reservations", "name": "Tisch-Reservierung", "category": "gastro",
     "description": "Online & in-App Tisch-Reservierungen mit Gast-Kalender",
     "monthly_price": 9.90, "default_enabled": False},
    {"key": "table_qr_orders", "name": "QR-Tisch-Bestellung", "category": "gastro",
     "description": "Gäste scannen QR am Tisch, bestellen direkt aus der Karte",
     "monthly_price": 14.90, "default_enabled": False},
    {"key": "kds", "name": "Küchen-Display (KDS)", "category": "gastro",
     "description": "Küchen-Tickets digital, mehrere Stationen, Status-Tracking",
     "monthly_price": 12.90, "default_enabled": False},
    {"key": "loyalty", "name": "Treueprogramm", "category": "marketing",
     "description": "Punktekarten, Rabatte, Geburtstags-Aktionen",
     "monthly_price": 7.90, "default_enabled": True},
    {"key": "vouchers", "name": "Gutscheine & Aufladung", "category": "payments",
     "description": "Gutscheine verkaufen, Wallet aufladen am POS",
     "monthly_price": 4.90, "default_enabled": True},
    {"key": "deposits", "name": "Pfand-System", "category": "retail",
     "description": "Pfand-Tracking (Flaschen, Kisten) mit Rückgabe",
     "monthly_price": 3.90, "default_enabled": False},
    {"key": "tse_fiskaly", "name": "TSE/Fiskaly Cloud", "category": "compliance",
     "description": "GoBD/KassenSichV-konforme TSE-Signatur jeder Buchung",
     "monthly_price": 19.90, "default_enabled": False},
    {"key": "dynamic_pricing", "name": "Dynamic Pricing", "category": "ai",
     "description": "Automatische Preisanpassung nach Nachfrage/Tageszeit",
     "monthly_price": 24.90, "default_enabled": False},
    {"key": "ai_assistant", "name": "KI-Assistent", "category": "ai",
     "description": "Chat-Bot für Produkt-, Bestand- und Reportfragen",
     "monthly_price": 14.90, "default_enabled": False},
    {"key": "voice_commands", "name": "Voice Commands", "category": "ai",
     "description": "Whisper-basierte Sprach-Bestellung am POS",
     "monthly_price": 9.90, "default_enabled": False},
    {"key": "ocr_delivery", "name": "OCR Lieferschein", "category": "ai",
     "description": "Lieferscheine fotografieren → automatisch erfassen",
     "monthly_price": 9.90, "default_enabled": False},
    {"key": "scan_and_go", "name": "Scan & Go", "category": "selfcheckout",
     "description": "Kunde scannt selbst per App, zahlt mobil — kein Anstehen",
     "monthly_price": 19.90, "default_enabled": False},
    {"key": "self_checkout", "name": "Self-Checkout-Kasse", "category": "selfcheckout",
     "description": "Eigenständige Kunden-Kasse (Tablet/Kiosk)",
     "monthly_price": 14.90, "default_enabled": False},
    {"key": "delivery_orders", "name": "Lieferdienst-Anbindung", "category": "gastro",
     "description": "Lieferando, Uber Eats, Wolt direkt importieren",
     "monthly_price": 16.90, "default_enabled": False},
    {"key": "webhooks_api", "name": "API & Webhooks", "category": "developer",
     "description": "Eigene Integrationen via REST + Outgoing-Webhooks",
     "monthly_price": 12.90, "default_enabled": False},
    {"key": "datev_export", "name": "DATEV-Export", "category": "compliance",
     "description": "Buchhaltungs-Export DATEV / Lexoffice",
     "monthly_price": 6.90, "default_enabled": False},
    {"key": "marketing_campaigns", "name": "Marketing-Kampagnen", "category": "marketing",
     "description": "E-Mail/Push an Kunden mit Coupons",
     "monthly_price": 11.90, "default_enabled": False},
    {"key": "advanced_reports", "name": "Erweiterte Berichte", "category": "analytics",
     "description": "ABC-Analyse, Forecast, Cross-Sell, Top-Cashier-KPIs",
     "monthly_price": 8.90, "default_enabled": False},
    {"key": "staff_timeclock", "name": "Mitarbeiter-Zeiterfassung", "category": "staff",
     "description": "Kommen/Gehen Stempeluhr, Pausen, Überstunden, Lohn-Export",
     "monthly_price": 9.90, "default_enabled": False},
    {"key": "staff_schedule", "name": "Schichtplanung", "category": "staff",
     "description": "Visueller Wochen-Schedule, Drag&Drop, Konflikt-Warnung",
     "monthly_price": 12.90, "default_enabled": False},
    {"key": "staff_wallet", "name": "Mitarbeiter-Wallet & Bonus", "category": "staff",
     "description": "Boni / Trinkgelder direkt auf Mitarbeiter-Wallet auszahlen",
     "monthly_price": 6.90, "default_enabled": False},
    {"key": "inventory_pro", "name": "Warenwirtschaft Pro", "category": "retail",
     "description": "EK/VK-Tracking, Lieferanten, Bestellungen, Wareneingang, Stocktake",
     "monthly_price": 14.90, "default_enabled": False},
    {"key": "purchase_orders", "name": "Bestellwesen", "category": "retail",
     "description": "Bestellungen an Lieferanten, Auto-Order auf Min-Bestand, Wareneingang",
     "monthly_price": 9.90, "default_enabled": False},
]
FEATURE_KEYS = {f["key"] for f in FEATURE_CATALOG}


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _is_admin(user: dict) -> bool:
    return user.get("role") in ("admin", "superadmin")


async def _get_merchant_for_user(user: dict) -> Optional[dict]:
    user_id = str(user["_id"])
    return await db.pos_merchants.find_one({"owner_id": user_id})


async def _ensure_defaults(merchant_id: str):
    """Stelle sicher, dass Default-Add-Ons aktiv sind (idempotent)."""
    for f in FEATURE_CATALOG:
        if f["default_enabled"]:
            existing = await db.pos_merchant_features.find_one({
                "merchant_id": merchant_id, "feature_key": f["key"],
            })
            if not existing:
                await db.pos_merchant_features.insert_one({
                    "merchant_id": merchant_id,
                    "feature_key": f["key"],
                    "enabled": True,
                    "trial": False,
                    "valid_until": None,
                    "monthly_price": f["monthly_price"],
                    "activated_at": _now(),
                    "activated_by": "system_default",
                })


# ═══════════════════════════════════════════════════════════
# PUBLIC HELPER — andere Routes können prüfen
# ═══════════════════════════════════════════════════════════
async def is_feature_enabled(merchant_id: str, feature_key: str) -> bool:
    """Prüfe ob Feature für diesen Merchant aktiv ist (in anderen Routes nutzbar)."""
    if feature_key not in FEATURE_KEYS:
        return False
    merchant = await db.pos_merchants.find_one({"merchant_id": merchant_id}, {"_id": 0, "status": 1, "access_blocked": 1})
    if merchant and (merchant.get("access_blocked") or merchant.get("status") in {"blocked", "suspended"}):
        return False
    f = await db.pos_merchant_features.find_one({
        "merchant_id": merchant_id, "feature_key": feature_key,
    })
    if f is None:
        # Kein Eintrag: Default-Wert aus Catalog konsultieren
        feat = next((x for x in FEATURE_CATALOG if x["key"] == feature_key), None)
        return bool(feat and feat["default_enabled"])
    if not f.get("enabled"):
        return False
    valid_until = f.get("valid_until")
    if valid_until:
        try:
            if datetime.fromisoformat(valid_until) < datetime.now(timezone.utc):
                return False
        except ValueError:
            pass
    return True


# ═══════════════════════════════════════════════════════════
# BRANCHEN-BUNDLES — 1-Klick "Standard-Paket pro Branche"
# Jedes Bundle = Liste {feature_key, bundle_price}.
# bundle_price = None → übernimmt Catalog-Preis.
# bundle_price = 0 → kostenlos im Bundle.
# ═══════════════════════════════════════════════════════════
INDUSTRY_BUNDLES = [
    {
        "key": "eiscafe",
        "name": "Eiscafé / Café Komplett",
        "icon": "🍦",
        "description": "Tisch-Reservierung + QR-Bestellung + KDS + Treueprogramm + Gutscheine + Marketing + Mitarbeiter-Bonus.",
        "monthly_total": 53.70,
        "features": [
            {"key": "table_reservations",  "price": 7.90},
            {"key": "table_qr_orders",     "price": 12.90},
            {"key": "kds",                 "price": 9.90},
            {"key": "loyalty",             "price": 4.90},
            {"key": "vouchers",            "price": 4.30},
            {"key": "marketing_campaigns", "price": 7.90},
            {"key": "staff_wallet",        "price": 5.90},
        ],
    },
    {
        "key": "restaurant",
        "name": "Restaurant Vollausstattung",
        "icon": "🍽️",
        "description": "Reservierung + QR + KDS + Delivery + OCR + Treueprogramm + Reports + Schichtplan + API.",
        "monthly_total": 95.70,
        "features": [
            {"key": "table_reservations", "price": 9.90},
            {"key": "table_qr_orders",    "price": 14.90},
            {"key": "kds",                "price": 12.90},
            {"key": "delivery_orders",    "price": 14.90},
            {"key": "ocr_delivery",       "price": 7.90},
            {"key": "loyalty",            "price": 4.90},
            {"key": "advanced_reports",   "price": 4.50},
            {"key": "staff_schedule",     "price": 12.90},
            {"key": "webhooks_api",       "price": 12.90},
        ],
    },
    {
        "key": "retail",
        "name": "Einzelhandel Komplett",
        "icon": "🛍️",
        "description": "Warenwirtschaft + Bestellwesen + Pfand + Zeiterfassung + Treue + Reports + Self-Checkout + DATEV.",
        "monthly_total": 78.70,
        "features": [
            {"key": "inventory_pro",     "price": 14.90},
            {"key": "purchase_orders",   "price": 9.90},
            {"key": "deposits",          "price": 3.90},
            {"key": "staff_timeclock",   "price": 6.90},
            {"key": "loyalty",           "price": 4.90},
            {"key": "advanced_reports",  "price": 9.40},
            {"key": "self_checkout",     "price": 14.90},
            {"key": "datev_export",      "price": 6.90},
            {"key": "scan_and_go",       "price": 7.00},
        ],
    },
    {
        "key": "kiosk",
        "name": "Kiosk / Spätkauf",
        "icon": "🏪",
        "description": "Warenwirtschaft + Pfand + Gutscheine + TSE/Fiskaly + Treue + Scan&Go.",
        "monthly_total": 53.60,
        "features": [
            {"key": "inventory_pro", "price": 9.90},
            {"key": "deposits",      "price": 3.90},
            {"key": "vouchers",      "price": 4.90},
            {"key": "tse_fiskaly",   "price": 11.20},
            {"key": "loyalty",       "price": 7.90},
            {"key": "scan_and_go",   "price": 15.80},
        ],
    },
    {
        "key": "supermarkt",
        "name": "Supermarkt / Markt",
        "icon": "🛒",
        "description": "Warenwirtschaft + Self-Checkout + Scan&Go + Treue + Marketing + Reports + Compliance + API + Voice.",
        "monthly_total": 132.60,
        "features": [
            {"key": "inventory_pro",       "price": 14.90},
            {"key": "purchase_orders",     "price": 9.90},
            {"key": "deposits",            "price": 3.90},
            {"key": "self_checkout",       "price": 14.90},
            {"key": "scan_and_go",         "price": 14.90},
            {"key": "loyalty",             "price": 7.90},
            {"key": "marketing_campaigns", "price": 9.90},
            {"key": "advanced_reports",    "price": 8.90},
            {"key": "tse_fiskaly",         "price": 14.70},
            {"key": "webhooks_api",        "price": 12.90},
            {"key": "voice_commands",      "price": 9.90},
            {"key": "datev_export",        "price": 6.90},
            {"key": "ai_assistant",        "price": 3.90},
        ],
    },
    {
        "key": "salon",
        "name": "Friseur / Salon / Beauty",
        "icon": "💇",
        "description": "Reservierung + Treue + Gutscheine + Zeiterfassung + Schichtplan + Marketing + Reports.",
        "monthly_total": 54.60,
        "features": [
            {"key": "table_reservations",  "price": 9.90},
            {"key": "loyalty",             "price": 4.90},
            {"key": "vouchers",            "price": 4.90},
            {"key": "staff_timeclock",     "price": 6.90},
            {"key": "staff_schedule",      "price": 8.30},
            {"key": "marketing_campaigns", "price": 11.90},
            {"key": "advanced_reports",    "price": 7.80},
        ],
    },
    {
        "key": "ki_max",
        "name": "KI-Maximalpaket",
        "icon": "🤖",
        "description": "Dynamic Pricing + KI-Assistent + Voice-Commands + OCR + API-Integration. Für alle Branchen.",
        "monthly_total": 62.80,
        "features": [
            {"key": "dynamic_pricing", "price": 19.90},
            {"key": "ai_assistant",    "price": 14.90},
            {"key": "voice_commands",  "price": 7.90},
            {"key": "ocr_delivery",    "price": 7.20},
            {"key": "webhooks_api",    "price": 12.90},
        ],
    },
    {
        "key": "starter_free",
        "name": "Starter (alles kostenlos für 30 Tage)",
        "icon": "🎁",
        "description": "Onboarding-Geschenk: ALLE Features 30 Tage gratis. Danach normale Preise.",
        "monthly_total": 0.00,
        "features": [
            {"key": k, "price": 0.00} for k in [
                "table_reservations","table_qr_orders","kds","loyalty","vouchers",
                "deposits","staff_timeclock","inventory_pro","purchase_orders",
                "advanced_reports","ocr_delivery",
            ]
        ],
    },
]
BUNDLE_KEYS = {b["key"] for b in INDUSTRY_BUNDLES}


async def _load_bundles() -> List[dict]:
    """
    Load bundles from DB (pos_bundles collection) if any exist;
    otherwise return the hardcoded DEFAULTS so admins always see the
    8 starter bundles on first run.
    """
    custom = await db.pos_bundles.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not custom:
        return INDUSTRY_BUNDLES
    # Merge: prefer DB bundles; fall back to defaults that haven't been overridden
    keys = {b["key"] for b in custom}
    merged = list(custom)
    for b in INDUSTRY_BUNDLES:
        if b["key"] not in keys:
            merged.append(b)
    return merged


async def _all_bundle_keys() -> set:
    bundles = await _load_bundles()
    return {b["key"] for b in bundles}


# ═══════════════════════════════════════════════════════════
# CATALOG
# ═══════════════════════════════════════════════════════════
@router.get("/catalog")
async def get_catalog():
    """Öffentlicher Katalog aller Add-Ons mit Preisen."""
    return {"features": FEATURE_CATALOG}


@router.get("/bundles")
async def get_bundles():
    """Branchen-Bundles für 1-Klick Aktivierung (DB-backed mit hardcoded Fallback)."""
    bundles = await _load_bundles()
    return {"bundles": bundles}


class BundleFeatureItem(BaseModel):
    key: str
    price: float = Field(ge=0)


class BundleSave(BaseModel):
    key: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=120)
    icon: str = Field(default="📦", max_length=8)
    description: str = Field(default="", max_length=500)
    features: List[BundleFeatureItem]
    order: int = Field(default=100, ge=0, le=10000)


@router.post("/admin/bundles")
async def admin_save_bundle(req: BundleSave, request: Request):
    """Create or update a custom industry bundle. Admin only."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")

    # Validate all feature keys exist in catalog
    bad = [f.key for f in req.features if f.key not in FEATURE_KEYS]
    if bad:
        raise HTTPException(400, f"Unbekannte Feature-Keys: {', '.join(bad)}")

    monthly_total = round(sum(f.price for f in req.features), 2)
    payload = {
        "key": req.key,
        "name": req.name,
        "icon": req.icon or "📦",
        "description": req.description,
        "features": [{"key": f.key, "price": float(f.price)} for f in req.features],
        "monthly_total": monthly_total,
        "order": req.order,
        "updated_at": _now(),
        "updated_by": str(user["_id"]),
    }
    await db.pos_bundles.update_one(
        {"key": req.key},
        {"$set": payload, "$setOnInsert": {"created_at": _now(), "created_by": str(user["_id"])}},
        upsert=True,
    )

    # Audit
    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": str(user["_id"]),
            "action": "bundle.save",
            "ref": {"bundle_key": req.key, "name": req.name, "monthly_total": monthly_total},
            "ts": _now(),
        })
    except Exception:
        pass

    return {"ok": True, "bundle": payload}


@router.delete("/admin/bundles/{bundle_key}")
async def admin_delete_bundle(bundle_key: str, request: Request):
    """Delete a custom bundle. Hardcoded defaults are restored on next load."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")
    res = await db.pos_bundles.delete_one({"key": bundle_key})
    if res.deleted_count == 0:
        # Maybe it's a default → mark it as hidden via tombstone
        await db.pos_bundles.update_one(
            {"key": bundle_key},
            {"$set": {"key": bundle_key, "hidden": True, "hidden_at": _now(), "hidden_by": str(user["_id"])}},
            upsert=True,
        )
    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": str(user["_id"]),
            "action": "bundle.delete",
            "ref": {"bundle_key": bundle_key},
            "ts": _now(),
        })
    except Exception:
        pass
    return {"ok": True, "deleted": bundle_key}


# ═══════════════════════════════════════════════════════════
# MERCHANT VIEW — eigene aktive/inaktive Features
# ═══════════════════════════════════════════════════════════
@router.get("/me")
async def my_features(request: Request):
    """Liste aller Features mit eigenem Aktivierungs-Status."""
    user = await get_current_user(request)
    merchant = await _get_merchant_for_user(user)
    if not merchant:
        raise HTTPException(404, "Kein Merchant-Profil")
    if merchant.get("access_blocked") or merchant.get("status") in {"blocked", "suspended"}:
        raise HTTPException(403, merchant.get("status_reason") or "Händlerzugang gesperrt")

    await _ensure_defaults(merchant["merchant_id"])
    activated = await db.pos_merchant_features.find(
        {"merchant_id": merchant["merchant_id"]}, {"_id": 0}
    ).to_list(200)
    by_key = {a["feature_key"]: a for a in activated}

    out = []
    for f in FEATURE_CATALOG:
        a = by_key.get(f["key"], {})
        valid_until = a.get("valid_until")
        is_active = bool(a.get("enabled"))
        if is_active and valid_until:
            try:
                if datetime.fromisoformat(valid_until) < datetime.now(timezone.utc):
                    is_active = False
            except ValueError:
                pass
        out.append({
            **f,
            "enabled": is_active,
            "trial": a.get("trial", False),
            "valid_until": valid_until,
            "activated_at": a.get("activated_at"),
        })
    return {"merchant_id": merchant["merchant_id"], "features": out}


class TrialActivate(BaseModel):
    feature_key: str
    days: int = 14


@router.post("/trial")
async def start_trial(req: TrialActivate, request: Request):
    """Selbst Trial starten (14 Tage Standard, 1× pro Feature)."""
    user = await get_current_user(request)
    merchant = await _get_merchant_for_user(user)
    if not merchant:
        raise HTTPException(404, "Kein Merchant-Profil")
    if merchant.get("access_blocked") or merchant.get("status") in {"blocked", "suspended"}:
        raise HTTPException(403, merchant.get("status_reason") or "Händlerzugang gesperrt")
    if req.feature_key not in FEATURE_KEYS:
        raise HTTPException(400, "Unbekanntes Feature")

    existing = await db.pos_merchant_features.find_one({
        "merchant_id": merchant["merchant_id"], "feature_key": req.feature_key,
    })
    if existing and existing.get("trial_used"):
        raise HTTPException(400, "Trial bereits genutzt — bitte Admin zur Aktivierung kontaktieren")

    valid_until = (datetime.now(timezone.utc) + timedelta(days=req.days)).isoformat()
    feat = next(f for f in FEATURE_CATALOG if f["key"] == req.feature_key)
    doc = {
        "merchant_id": merchant["merchant_id"],
        "feature_key": req.feature_key,
        "enabled": True,
        "trial": True,
        "trial_used": True,
        "valid_until": valid_until,
        "monthly_price": feat["monthly_price"],
        "activated_at": _now(),
        "activated_by": str(user["_id"]),
    }
    if existing:
        await db.pos_merchant_features.update_one(
            {"merchant_id": merchant["merchant_id"], "feature_key": req.feature_key},
            {"$set": doc},
        )
    else:
        await db.pos_merchant_features.insert_one(doc)
        doc.pop("_id", None)
    return {"ok": True, "feature": doc, "message": f"Trial gestartet bis {valid_until[:10]}"}


# ═══════════════════════════════════════════════════════════
# ADMIN — Aktivierung / Deaktivierung pro Merchant
# ═══════════════════════════════════════════════════════════
@router.get("/admin/merchant/{merchant_id}")
async def admin_list_for_merchant(merchant_id: str, request: Request):
    """Admin sieht alle Features eines Merchants."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")

    activated = await db.pos_merchant_features.find(
        {"merchant_id": merchant_id}, {"_id": 0}
    ).to_list(200)
    by_key = {a["feature_key"]: a for a in activated}
    out = []
    for f in FEATURE_CATALOG:
        a = by_key.get(f["key"], {})
        custom = a.get("custom_price")
        # Effektiver Preis: Override wenn gesetzt, sonst Catalog-Default
        effective_price = float(custom) if custom is not None else float(f["monthly_price"])
        out.append({
            **f,
            "enabled": bool(a.get("enabled")),
            "trial": a.get("trial", False),
            "valid_until": a.get("valid_until"),
            "activated_at": a.get("activated_at"),
            "catalog_price": float(f["monthly_price"]),
            "custom_price": custom,
            "effective_price": effective_price,
        })
    return {"merchant_id": merchant_id, "features": out}


class AdminToggle(BaseModel):
    merchant_id: str
    feature_key: str
    enabled: bool
    valid_until: Optional[str] = None  # ISO-Datum oder None = unbegrenzt
    custom_price: Optional[float] = None  # €/Monat-Override pro Händler. None=Catalog-Default, 0=kostenlos.


@router.post("/admin/toggle")
async def admin_toggle(req: AdminToggle, request: Request):
    """Admin schaltet ein Feature für einen Merchant frei oder sperrt es."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")
    if req.feature_key not in FEATURE_KEYS:
        raise HTTPException(400, "Unbekanntes Feature")

    feat = next(f for f in FEATURE_CATALOG if f["key"] == req.feature_key)
    existing = await db.pos_merchant_features.find_one({
        "merchant_id": req.merchant_id, "feature_key": req.feature_key,
    })
    # Preis-Logik: explizit übergeben > existierender Override > Catalog-Default
    if req.custom_price is not None:
        effective_price = max(0.0, float(req.custom_price))
    elif existing and existing.get("custom_price") is not None:
        effective_price = float(existing["custom_price"])
    else:
        effective_price = float(feat["monthly_price"])

    payload = {
        "merchant_id": req.merchant_id,
        "feature_key": req.feature_key,
        "enabled": req.enabled,
        "trial": False,
        "valid_until": req.valid_until,
        "monthly_price": effective_price,
        "custom_price": req.custom_price if req.custom_price is not None
                        else (existing or {}).get("custom_price"),
        "activated_at": _now() if req.enabled else (existing or {}).get("activated_at"),
        "activated_by": str(user["_id"]),
        "deactivated_at": None if req.enabled else _now(),
    }
    if existing:
        await db.pos_merchant_features.update_one(
            {"merchant_id": req.merchant_id, "feature_key": req.feature_key},
            {"$set": payload},
        )
    else:
        await db.pos_merchant_features.insert_one(payload)
        payload.pop("_id", None)

    # Audit
    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": str(user["_id"]),
            "action": "feature.toggle",
            "ref": {
                "merchant_id": req.merchant_id,
                "feature_key": req.feature_key,
                "enabled": req.enabled,
                "monthly_price": effective_price,
            },
            "ts": _now(),
        })
    except Exception:
        pass

    return {"ok": True, "feature": payload}


class PriceUpdate(BaseModel):
    merchant_id: str
    feature_key: str
    custom_price: float  # €/Monat — 0 = kostenlos


@router.post("/admin/set-price")
async def admin_set_price(req: PriceUpdate, request: Request):
    """Admin setzt nur den Preis (ohne Enable-Status anzufassen)."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")
    if req.feature_key not in FEATURE_KEYS:
        raise HTTPException(400, "Unbekanntes Feature")

    effective_price = max(0.0, float(req.custom_price))
    feat = next(f for f in FEATURE_CATALOG if f["key"] == req.feature_key)
    existing = await db.pos_merchant_features.find_one({
        "merchant_id": req.merchant_id, "feature_key": req.feature_key,
    })

    update_doc = {
        "merchant_id": req.merchant_id,
        "feature_key": req.feature_key,
        "monthly_price": effective_price,
        "custom_price": effective_price,
    }
    if not existing:
        # Lege Eintrag mit enabled=False an — Preis ist hinterlegt für später
        update_doc.update({
            "enabled": False,
            "trial": False,
            "valid_until": None,
            "activated_at": None,
            "activated_by": str(user["_id"]),
        })
        await db.pos_merchant_features.insert_one(update_doc)
        update_doc.pop("_id", None)
    else:
        await db.pos_merchant_features.update_one(
            {"merchant_id": req.merchant_id, "feature_key": req.feature_key},
            {"$set": update_doc},
        )

    # Audit
    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": str(user["_id"]),
            "action": "feature.set_price",
            "ref": {
                "merchant_id": req.merchant_id,
                "feature_key": req.feature_key,
                "new_price": effective_price,
                "catalog_price": feat["monthly_price"],
            },
            "ts": _now(),
        })
    except Exception:
        pass

    return {"ok": True, "merchant_id": req.merchant_id, "feature_key": req.feature_key, "monthly_price": effective_price}


class BundleApply(BaseModel):
    merchant_id: str
    bundle_key: str
    mode: str = "replace"  # "replace" = deaktiviere alles andere zuerst, "merge" = nur Bundle-Features dazu


@router.post("/admin/apply-bundle")
async def admin_apply_bundle(req: BundleApply, request: Request):
    """
    Aktiviert ein komplettes Branchen-Bundle in einem Klick.
    - mode='merge'   → Bundle-Features ON, andere unverändert.
    - mode='replace' → Bundle-Features ON, alle anderen OFF.
    Setzt automatisch die Bundle-Preise als custom_price.
    """
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")

    all_bundles = await _load_bundles()
    bundle = next((b for b in all_bundles if b["key"] == req.bundle_key), None)
    if not bundle:
        raise HTTPException(400, f"Unbekanntes Bundle: {req.bundle_key}")
    bundle_keys_set = {f["key"] for f in bundle["features"]}
    now = _now()
    actor_id = str(user["_id"])

    activated, deactivated, skipped = [], [], []

    # 1) replace-mode: alle aktuell aktiven Features, die NICHT im Bundle sind, deaktivieren
    if req.mode == "replace":
        currently_active = await db.pos_merchant_features.find(
            {"merchant_id": req.merchant_id, "enabled": True}, {"_id": 0}
        ).to_list(200)
        for a in currently_active:
            if a["feature_key"] in bundle_keys_set:
                continue
            await db.pos_merchant_features.update_one(
                {"merchant_id": req.merchant_id, "feature_key": a["feature_key"]},
                {"$set": {"enabled": False, "deactivated_at": now, "activated_by": actor_id}},
            )
            deactivated.append(a["feature_key"])

    # 2) Bundle-Features aktivieren mit ihren Preisen
    for feat_def in bundle["features"]:
        key = feat_def["key"]
        if key not in FEATURE_KEYS:
            skipped.append(key)
            continue
        catalog_feat = next(f for f in FEATURE_CATALOG if f["key"] == key)
        custom_price = float(feat_def.get("price")) if feat_def.get("price") is not None else None
        effective_price = custom_price if custom_price is not None else float(catalog_feat["monthly_price"])

        existing = await db.pos_merchant_features.find_one({
            "merchant_id": req.merchant_id, "feature_key": key,
        })
        payload = {
            "merchant_id": req.merchant_id,
            "feature_key": key,
            "enabled": True,
            "trial": False,
            "valid_until": None,
            "monthly_price": effective_price,
            "custom_price": custom_price,
            "activated_at": now,
            "activated_by": actor_id,
            "deactivated_at": None,
            "applied_bundle": req.bundle_key,
        }
        if existing:
            await db.pos_merchant_features.update_one(
                {"merchant_id": req.merchant_id, "feature_key": key},
                {"$set": payload},
            )
        else:
            await db.pos_merchant_features.insert_one(payload)
        activated.append(key)

    # Audit
    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": actor_id,
            "action": "feature.apply_bundle",
            "ref": {
                "merchant_id": req.merchant_id,
                "bundle_key": req.bundle_key,
                "bundle_name": bundle["name"],
                "mode": req.mode,
                "activated": activated,
                "deactivated": deactivated,
            },
            "ts": now,
        })
    except Exception:
        pass

    return {
        "ok": True,
        "bundle": bundle["name"],
        "mode": req.mode,
        "activated": activated,
        "deactivated": deactivated,
        "skipped": skipped,
        "monthly_total": bundle.get("monthly_total"),
    }


class BulkToggle(BaseModel):
    merchant_id: str
    features: List[str]
    enabled: bool


@router.post("/admin/bulk-toggle")
async def admin_bulk_toggle(req: BulkToggle, request: Request):
    """Mehrere Features auf einmal schalten."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")
    updated = 0
    for key in req.features:
        if key not in FEATURE_KEYS:
            continue
        feat = next(f for f in FEATURE_CATALOG if f["key"] == key)
        existing = await db.pos_merchant_features.find_one({
            "merchant_id": req.merchant_id, "feature_key": key,
        })
        payload = {
            "merchant_id": req.merchant_id,
            "feature_key": key,
            "enabled": req.enabled,
            "trial": False,
            "valid_until": None,
            "monthly_price": feat["monthly_price"],
            "activated_at": _now() if req.enabled else (existing or {}).get("activated_at"),
            "activated_by": str(user["_id"]),
        }
        if existing:
            await db.pos_merchant_features.update_one(
                {"merchant_id": req.merchant_id, "feature_key": key}, {"$set": payload},
            )
        else:
            await db.pos_merchant_features.insert_one(payload)
        updated += 1
    return {"ok": True, "updated": updated}


@router.get("/check/{feature_key}")
async def check_feature(feature_key: str, request: Request):
    """Prüfe ob ein Feature für eingeloggten Merchant aktiv ist (für Frontend-Gating)."""
    user = await get_current_user(request)
    merchant = await _get_merchant_for_user(user)
    if not merchant:
        return {"enabled": False, "reason": "no_merchant"}
    enabled = await is_feature_enabled(merchant["merchant_id"], feature_key)
    return {"feature_key": feature_key, "enabled": enabled}


# ═══════════════════════════════════════════════════════════
# STRIPE CHECKOUT — Feature kaufen (1 Monat)
# ═══════════════════════════════════════════════════════════
class FeatureCheckoutRequest(BaseModel):
    feature_key: str
    months: int = 1  # Monate (1, 3, 6, 12)
    origin_url: str  # Frontend Origin für Success/Cancel Redirect


@router.post("/checkout/create")
async def create_feature_checkout(req: FeatureCheckoutRequest, request: Request):
    """Erstelle Stripe-Checkout-Session für Feature-Buchung."""
    user = await get_current_user(request)
    merchant = await _get_merchant_for_user(user)
    if not merchant:
        raise HTTPException(404, "Kein Merchant-Profil")
    if req.feature_key not in FEATURE_KEYS:
        raise HTTPException(400, "Unbekanntes Feature")
    if req.months not in (1, 3, 6, 12):
        raise HTTPException(400, "Monate müssen 1, 3, 6 oder 12 sein")

    feat = next(f for f in FEATURE_CATALOG if f["key"] == req.feature_key)
    monthly = feat["monthly_price"]

    # Mengenrabatt
    discount_pct = {1: 0, 3: 5, 6: 10, 12: 20}[req.months]
    base_total = monthly * req.months
    discount = round(base_total * discount_pct / 100, 2)
    total = round(base_total - discount, 2)

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/pos?feature_purchase=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pos?feature_purchase=cancelled"

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    checkout_request = CheckoutSessionRequest(
        amount=float(total),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "feature_purchase",
            "user_id": str(user["_id"]),
            "merchant_id": merchant["merchant_id"],
            "feature_key": req.feature_key,
            "months": str(req.months),
            "amount": str(total),
            "feature_name": feat["name"],
        },
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Pending-Eintrag für Webhook
    await db.pos_feature_purchases.insert_one({
        "session_id": session.session_id,
        "user_id": str(user["_id"]),
        "merchant_id": merchant["merchant_id"],
        "feature_key": req.feature_key,
        "feature_name": feat["name"],
        "months": req.months,
        "amount": total,
        "currency": "EUR",
        "status": "pending",
        "created_at": _now(),
    })

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "amount": total,
        "months": req.months,
        "discount_pct": discount_pct,
    }


async def activate_feature_after_payment(session_id: str) -> bool:
    """Wird vom Stripe-Webhook aufgerufen, sobald Payment 'paid' ist."""
    purchase = await db.pos_feature_purchases.find_one({"session_id": session_id})
    if not purchase:
        return False
    if purchase["status"] == "completed":
        return True  # Already activated (idempotent)

    feat = next((f for f in FEATURE_CATALOG if f["key"] == purchase["feature_key"]), None)
    if not feat:
        return False

    # Bestehende Feature-Eintrag oder neu
    existing = await db.pos_merchant_features.find_one({
        "merchant_id": purchase["merchant_id"],
        "feature_key": purchase["feature_key"],
    })
    # Verlängern statt überschreiben falls noch gültig
    base_dt = datetime.now(timezone.utc)
    if existing and existing.get("valid_until"):
        try:
            cur_end = datetime.fromisoformat(existing["valid_until"])
            if cur_end > base_dt:
                base_dt = cur_end
        except ValueError:
            pass
    new_valid_until = (base_dt + timedelta(days=30 * purchase["months"])).isoformat()

    payload = {
        "merchant_id": purchase["merchant_id"],
        "feature_key": purchase["feature_key"],
        "enabled": True,
        "trial": False,
        "valid_until": new_valid_until,
        "monthly_price": feat["monthly_price"],
        "activated_at": _now(),
        "activated_by": purchase["user_id"],
        "last_purchase_session": session_id,
    }
    if existing:
        await db.pos_merchant_features.update_one(
            {"merchant_id": purchase["merchant_id"], "feature_key": purchase["feature_key"]},
            {"$set": payload},
        )
    else:
        await db.pos_merchant_features.insert_one(payload)

    await db.pos_feature_purchases.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "completed_at": _now(), "valid_until": new_valid_until}},
    )

    try:
        await db.pos_audit_log.insert_one({
            "audit_id": f"AUD-{datetime.now(timezone.utc).timestamp()}",
            "actor_id": purchase["user_id"],
            "action": "feature.purchase",
            "ref": {
                "merchant_id": purchase["merchant_id"],
                "feature_key": purchase["feature_key"],
                "months": purchase["months"],
                "amount": purchase["amount"],
                "session_id": session_id,
            },
            "ts": _now(),
        })
    except Exception:
        pass

    return True


@router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Polling-Endpoint für Frontend nach Redirect von Stripe."""
    user = await get_current_user(request)
    purchase = await db.pos_feature_purchases.find_one(
        {"session_id": session_id, "user_id": str(user["_id"])}, {"_id": 0}
    )
    if not purchase:
        raise HTTPException(404, "Kauf nicht gefunden")

    # Falls Webhook noch nicht durch ist: live von Stripe nachfragen
    if purchase["status"] != "completed":
        try:
            host_url = str(request.base_url).rstrip("/")
            webhook_url = f"{host_url}/api/webhook/stripe"
            sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
            status = await sc.get_checkout_status(session_id)
            if status.payment_status == "paid":
                await activate_feature_after_payment(session_id)
                purchase = await db.pos_feature_purchases.find_one(
                    {"session_id": session_id}, {"_id": 0}
                )
        except Exception:
            pass

    return {"purchase": purchase}


@router.get("/purchases/me")
async def my_purchases(request: Request, limit: int = 20):
    """Käufe des Merchants — Rechnungs-Historie."""
    user = await get_current_user(request)
    merchant = await _get_merchant_for_user(user)
    if not merchant:
        return {"purchases": []}
    items = await db.pos_feature_purchases.find(
        {"merchant_id": merchant["merchant_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"purchases": items}


# ═══════════════════════════════════════════════════════════
# ADMIN AUDIT LOG
# ═══════════════════════════════════════════════════════════
@router.get("/admin/audit-log")
async def admin_audit_log(
    request: Request,
    limit: int = 100,
    skip: int = 0,
    merchant_id: Optional[str] = None,
    action_type: Optional[str] = None,
):
    """Admin Audit Log — alle Feature-Management Aktionen mit Filter."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Nur Admin")

    query = {}
    if merchant_id:
        query["ref.merchant_id"] = merchant_id
    if action_type:
        query["action"] = action_type

    logs = await db.pos_audit_log.find(query, {"_id": 0}) \
        .sort("ts", -1) \
        .skip(skip) \
        .limit(min(limit, 500)) \
        .to_list(500)

    # Enrich mit Admin Email
    from bson import ObjectId
    actor_ids = list({log["actor_id"] for log in logs if log.get("actor_id") and isinstance(log["actor_id"], str)})
    users_map = {}
    if actor_ids:
        # Convert string IDs to ObjectId for MongoDB query
        try:
            object_ids = [ObjectId(aid) for aid in actor_ids if aid]
            users = await db.users.find({"_id": {"$in": object_ids}}, {"_id": 1, "email": 1}).to_list(len(object_ids))
            users_map = {str(u["_id"]): u.get("email", "unknown") for u in users}
        except Exception:
            pass  # Invalid ObjectId format

    for log in logs:
        actor_id = log.get("actor_id")
        if isinstance(actor_id, dict):
            # Legacy schema: actor_id was stored as full user dict
            log["admin_email"] = actor_id.get("email", "system")
            log["actor_id"] = str(actor_id.get("_id") or actor_id.get("id") or "")
        else:
            log["admin_email"] = users_map.get(actor_id, "system") if actor_id else "system"

    total = await db.pos_audit_log.count_documents(query)

    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip,
    }
