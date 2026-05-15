"""
POS Feature-Flags / Add-Ons
Merchants können einzelne Pro-Features (Tisch-Reservierung, QR-Bestellung, KDS, ...)
zubuchen. Admin schaltet sie frei oder sperrt sie.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
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
# CATALOG
# ═══════════════════════════════════════════════════════════
@router.get("/catalog")
async def get_catalog():
    """Öffentlicher Katalog aller Add-Ons mit Preisen."""
    return {"features": FEATURE_CATALOG}


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
        out.append({
            **f,
            "enabled": bool(a.get("enabled")),
            "trial": a.get("trial", False),
            "valid_until": a.get("valid_until"),
            "activated_at": a.get("activated_at"),
        })
    return {"merchant_id": merchant_id, "features": out}


class AdminToggle(BaseModel):
    merchant_id: str
    feature_key: str
    enabled: bool
    valid_until: Optional[str] = None  # ISO-Datum oder None = unbegrenzt


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
    payload = {
        "merchant_id": req.merchant_id,
        "feature_key": req.feature_key,
        "enabled": req.enabled,
        "trial": False,
        "valid_until": req.valid_until,
        "monthly_price": feat["monthly_price"],
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
            "ref": {"merchant_id": req.merchant_id, "feature_key": req.feature_key, "enabled": req.enabled},
            "ts": _now(),
        })
    except Exception:
        pass

    return {"ok": True, "feature": payload}


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
