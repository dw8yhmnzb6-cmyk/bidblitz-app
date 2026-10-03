"""
BidBlitz V2 - Insurance Marketplace
Versicherungen: Auto, Reise, Handy, Hausrat, Haftpflicht, Kranken, Leben, Tier
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
import secrets
import hashlib

router = APIRouter(prefix="/api/insurance", tags=["insurance"])

CASHBACK_RATE = 0.02


def _require_insurance_live_provider() -> None:
    if TEST_MODE:
        return
    raise HTTPException(
        status_code=503,
        detail={
            "error": "insurance_provider_not_live",
            "message": "Versicherungsabschluss und Schadenauszahlungen sind noch nicht mit einem lizenzierten Versicherungsanbieter verbunden.",
        },
    )


def _insurance_idempotency_key(body_key: Optional[str], request: Request, *, action: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"insurance-{action}:{key}"


class InsuranceProduct(BaseModel):
    title: str
    category: str  # auto, travel, phone, household, liability, health, life, pet
    provider: str = ""
    description: str = ""
    coverage: str = ""
    monthly_price: float = Field(..., gt=0)
    yearly_price: float = 0
    deductible: float = 0
    features: List[str] = []
    image_url: str = ""


class InsurancePurchase(BaseModel):
    product_id: str
    billing: str = "monthly"  # monthly | yearly
    start_date: str = ""
    idempotency_key: Optional[str] = None


CATEGORIES = [
    {"id": "auto", "label": "Kfz-Versicherung", "icon": "car"},
    {"id": "travel", "label": "Reiseversicherung", "icon": "plane"},
    {"id": "phone", "label": "Handyversicherung", "icon": "smartphone"},
    {"id": "household", "label": "Hausratversicherung", "icon": "home"},
    {"id": "liability", "label": "Haftpflicht", "icon": "shield"},
    {"id": "health", "label": "Krankenversicherung", "icon": "heart"},
    {"id": "life", "label": "Lebensversicherung", "icon": "umbrella"},
    {"id": "pet", "label": "Tierversicherung", "icon": "paw"},
]


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


SEED_PRODUCTS = [
    {"category":"auto","title":"Kfz Basis","provider":"AllgemeinSchutz","description":"Haftpflicht für PKW bis 130 kW","coverage":"Bis 100 Mio. € pers. Schäden","monthly_price":29.90,"deductible":150,"features":["24/7 Schadenservice","Mallorca-Police","Werkstattbindung optional"],"image_url":"https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=80"},
    {"category":"auto","title":"Kfz Premium Vollkasko","provider":"AutoPlus","description":"Vollkasko inkl. Diebstahl & Marderbiss","coverage":"Vollkasko + GAP + Neuwert 24 Mo.","monthly_price":68.50,"deductible":300,"features":["Werkstatt-Service","Mietwagen inkl.","E-Auto Akku Schutz"],"image_url":"https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=80"},
    {"category":"travel","title":"Reise Welt 365","provider":"GlobeSafe","description":"Jahres-Auslandsreise inkl. Rücktransport","coverage":"Heilkosten unbegrenzt, Rücktransport","monthly_price":7.50,"deductible":0,"features":["365 Tage weltweit","COVID-Versorgung","Gepäck bis 2.000€"],"image_url":"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80"},
    {"category":"phone","title":"Smartphone Pro","provider":"DeviceCare","description":"Bruch-, Wasser-, Diebstahlschutz","coverage":"Neuwerterstattung bis 36 Mo.","monthly_price":9.90,"deductible":50,"features":["Express-Reparatur","Akku-Tausch","Daten-Backup"],"image_url":"https://images.unsplash.com/photo-1551355716-d99cdb39c5b9?w=400&q=80"},
    {"category":"household","title":"Hausrat 70m²","provider":"HomeShield","description":"Hausrat & Glasbruch für Mietwohnung","coverage":"Bis 80.000€ Hausrat","monthly_price":11.20,"deductible":100,"features":["Fahrraddiebstahl 5%","Elementarschäden","Glasbruch inkl."],"image_url":"https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=400&q=80"},
    {"category":"liability","title":"Privathaftpflicht Plus","provider":"SafetyFirst","description":"Privathaftpflicht für Familie","coverage":"50 Mio. € Personenschäden","monthly_price":4.90,"deductible":0,"features":["Schlüsselverlust","Mietsachschäden","Forderungsausfall"],"image_url":"https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80"},
    {"category":"health","title":"Zahn-Plus","provider":"DentaProtect","description":"Zahnzusatz: Prophylaxe + Zahnersatz","coverage":"90% Zahnersatz, 100% PZR","monthly_price":19.90,"deductible":0,"features":["Implantate inkl.","Kieferorthopädie","Keine Wartezeit auf Prophylaxe"],"image_url":"https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=400&q=80"},
    {"category":"life","title":"Risikoleben 250k","provider":"VitaPrime","description":"Risikolebensversicherung 250.000€","coverage":"Auszahlung im Todesfall","monthly_price":14.50,"deductible":0,"features":["Steuerlich absetzbar","Konstante Beiträge","Hinterbliebenenschutz"],"image_url":"https://images.unsplash.com/photo-1518152006812-edab29b069ac?w=400&q=80"},
    {"category":"pet","title":"Hund OP","provider":"PetCare","description":"OP-Versicherung für Hunde","coverage":"100% OP-Kosten 5.000€/Jahr","monthly_price":16.90,"deductible":0,"features":["Auch ältere Tiere","Keine Wartezeit Notfall","Heilbehandlung 1.500€"],"image_url":"https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&q=80"},
]


@router.on_event("startup")
async def seed_insurance():
    if not TEST_MODE:
        return
    if await db.insurance_products.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for p in SEED_PRODUCTS:
            doc = dict(p)
            doc["product_id"] = secrets.token_hex(8)
            doc["yearly_price"] = round(p["monthly_price"] * 10.8, 2)
            doc["purchase_count"] = 0
            doc["rating"] = 4.5
            doc["status"] = "active"
            doc["created_at"] = now
            await db.insurance_products.insert_one(doc)


@router.get("/products")
async def list_products(category: str = "", limit: int = 30):
    query = {"status": "active"}
    if not TEST_MODE:
        query.update({"is_real": True, "provider_live": True})
    if category:
        query["category"] = category
    products = await db.insurance_products.find(query, {"_id": 0}).sort("monthly_price", 1).limit(limit).to_list(limit)
    return {"products": products, "count": len(products)}


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    query = {"product_id": product_id}
    if not TEST_MODE:
        query.update({"is_real": True, "provider_live": True})
    p = await db.insurance_products.find_one(query, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Versicherung nicht gefunden")
    return p


@router.post("/products")
async def create_product(req: InsuranceProduct, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    now = datetime.now(timezone.utc).isoformat()
    pid = secrets.token_hex(8)
    doc = {
        "product_id": pid,
        "title": req.title,
        "category": req.category,
        "provider": req.provider,
        "description": req.description,
        "coverage": req.coverage,
        "monthly_price": req.monthly_price,
        "yearly_price": req.yearly_price or round(req.monthly_price * 10.8, 2),
        "deductible": req.deductible,
        "features": req.features,
        "image_url": req.image_url,
        "purchase_count": 0,
        "rating": 0,
        "status": "active",
        "created_at": now,
    }
    await db.insurance_products.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "product": doc}


@router.post("/purchase")
async def purchase_insurance(req: InsurancePurchase, request: Request):
    _require_insurance_live_provider()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if req.billing not in {"monthly", "yearly"}:
        raise HTTPException(status_code=400, detail="Ungültige Abrechnung")

    idempotency_key = _insurance_idempotency_key(req.idempotency_key, request, action="purchase")
    purchase_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    policy_id = f"INSP-{purchase_hash.upper()}"

    existing = await db.insurance_policies.find_one({"policy_id": policy_id, "user_id": user_id}, {"_id": 0})
    if existing:
        if existing.get("product_id") != req.product_id or existing.get("billing") != req.billing:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Versicherungsdaten verwendet")
        return {"ok": True, "policy": existing, "replayed": True}

    product = await db.insurance_products.find_one({"product_id": req.product_id, "status": "active"})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")

    price = round(float(product["yearly_price"] if req.billing == "yearly" else product["monthly_price"]), 2)
    cashback = round(price * CASHBACK_RATE, 2)
    now = datetime.now(timezone.utc).isoformat()
    ref = f"INS-{purchase_hash[:12].upper()}"

    policy = {
        "policy_id": policy_id,
        "product_id": req.product_id,
        "product_title": product["title"],
        "category": product["category"],
        "provider": product.get("provider", ""),
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "billing": req.billing,
        "price": price,
        "cashback": cashback,
        "deductible": product.get("deductible", 0),
        "start_date": req.start_date or now[:10],
        "status": "payment_pending",
        "reference": ref,
        "idempotency_key": idempotency_key,
        "created_at": now,
    }
    await db.insurance_policies.update_one(
        {"policy_id": policy_id, "user_id": user_id},
        {"$setOnInsert": policy},
        upsert=True,
    )

    from core.payment_engine import debit_wallet, credit_wallet, TransactionType
    payment = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.PAYMENT,
        description=f"Versicherung: {product['title']} ({req.billing})",
        reference=ref,
        merchant_name=product.get("provider") or "Versicherungsanbieter",
        metadata={"policy_id": policy_id, "product_id": req.product_id, "kind": "insurance"},
        idempotency_key=f"insurance-policy:{policy_id}:premium",
    )
    if not payment.success:
        await db.insurance_policies.update_one(
            {"policy_id": policy_id},
            {"$set": {"status": "payment_failed", "payment_error": payment.error, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        raise HTTPException(status_code=400, detail=payment.error or "Zahlung fehlgeschlagen")

    cashback_result = None
    if cashback > 0:
        cashback_result = await credit_wallet(
            user_id=user_id,
            amount=cashback,
            tx_type=TransactionType.CASHBACK,
            description=f"Versicherungs-Cashback: {product['title']}",
            reference=f"{ref}-CB",
            source="insurance_cashback",
            metadata={"policy_id": policy_id, "product_id": req.product_id},
            idempotency_key=f"insurance-policy:{policy_id}:cashback",
        )
        if not cashback_result.success:
            await db.insurance_policies.update_one(
                {"policy_id": policy_id},
                {"$set": {"status": "reconciliation_required", "payment_transaction_id": payment.transaction_id, "cashback_error": cashback_result.error}},
            )
            raise HTTPException(status_code=409, detail=cashback_result.error or "Cashback benötigt Abstimmung")

    activated_at = datetime.now(timezone.utc).isoformat()
    await db.insurance_policies.update_one(
        {"policy_id": policy_id, "status": {"$in": ["payment_pending", "payment_failed"]}},
        {"$set": {
            "status": "active",
            "payment_transaction_id": payment.transaction_id,
            "cashback_transaction_id": cashback_result.transaction_id if cashback_result else None,
            "activated_at": activated_at,
            "updated_at": activated_at,
        }},
    )
    await db.insurance_products.update_one(
        {"product_id": req.product_id, f"purchase_markers.{policy_id}": {"$exists": False}},
        {"$inc": {"purchase_count": 1}, "$set": {f"purchase_markers.{policy_id}": activated_at}},
    )
    fresh = await db.insurance_policies.find_one({"policy_id": policy_id}, {"_id": 0}) or policy
    return {"ok": True, "policy": fresh, "replayed": bool(payment.idempotent_replay)}


@router.get("/my-policies")
async def my_policies(request: Request):
    user = await get_current_user(request)
    policies = await db.insurance_policies.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"policies": policies}


@router.post("/cancel/{policy_id}")
async def cancel_policy(policy_id: str, request: Request):
    user = await get_current_user(request)
    p = await db.insurance_policies.find_one({"policy_id": policy_id})
    if not p or p["user_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if p["status"] != "active":
        raise HTTPException(status_code=400, detail="Police bereits gekündigt")
    await db.insurance_policies.update_one({"policy_id": policy_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ─── QUOTE CALCULATOR ─────────────────────────────────────────────────────────
QUOTE_BASE = {
    "auto": {"base": 35, "per_year_age": -0.4, "per_year_old": 0.6, "label_age": "driver_age", "label_old": "vehicle_age"},
    "travel": {"base": 8, "per_day": 1.2, "label_day": "trip_days"},
    "phone": {"base": 6, "per_value": 0.012, "label_value": "device_value"},
    "household": {"base": 9, "per_sqm": 0.18, "label_sqm": "living_sqm"},
    "liability": {"base": 4, "fixed": True},
    "health": {"base": 95, "per_year_age": 1.2, "label_age": "age"},
    "life": {"base": 18, "per_value": 0.0009, "label_value": "coverage_amount", "per_year_age": 0.6, "label_age": "age"},
    "pet": {"base": 12, "per_year_age": 0.4, "label_age": "pet_age"},
}


class QuoteRequest(BaseModel):
    category: str
    params: dict = {}


@router.post("/quote")
async def quote_insurance(req: QuoteRequest):
    cfg = QUOTE_BASE.get(req.category)
    if not cfg:
        raise HTTPException(status_code=400, detail="Kategorie unbekannt")
    p = req.params or {}
    monthly = float(cfg["base"])
    if req.category == "auto":
        age = int(p.get("driver_age", 35) or 35)
        v_age = int(p.get("vehicle_age", 5) or 5)
        monthly += max(0, (35 - age)) * 0.8 + v_age * 0.6
    elif req.category == "travel":
        days = int(p.get("trip_days", 7) or 7)
        monthly = cfg["base"] + days * cfg["per_day"]
    elif req.category == "phone":
        val = float(p.get("device_value", 600) or 600)
        monthly = cfg["base"] + val * cfg["per_value"]
    elif req.category == "household":
        sqm = float(p.get("living_sqm", 60) or 60)
        monthly = cfg["base"] + sqm * cfg["per_sqm"]
    elif req.category in ("health",):
        age = int(p.get("age", 30) or 30)
        monthly = cfg["base"] + max(0, age - 25) * cfg["per_year_age"]
    elif req.category == "life":
        age = int(p.get("age", 30) or 30)
        cov = float(p.get("coverage_amount", 100000) or 100000)
        monthly = cfg["base"] + cov * cfg["per_value"] + max(0, age - 25) * cfg["per_year_age"]
    elif req.category == "pet":
        age = int(p.get("pet_age", 3) or 3)
        monthly = cfg["base"] + age * cfg["per_year_age"]
    monthly = round(max(2.0, monthly), 2)
    yearly = round(monthly * 10.8, 2)
    return {
        "ok": True,
        "category": req.category,
        "monthly_price": monthly,
        "yearly_price": yearly,
        "yearly_savings": round(monthly * 12 - yearly, 2),
        "currency": "EUR",
    }


# ─── CLAIMS ───────────────────────────────────────────────────────────────────
class ClaimCreate(BaseModel):
    policy_id: str
    claim_type: str = ""  # accident, theft, damage, illness, other
    description: str = Field(..., min_length=10)
    incident_date: str = ""
    amount_estimate: float = 0
    photos: List[str] = []  # base64 or URLs


@router.post("/claim")
async def create_claim(req: ClaimCreate, request: Request):
    _require_insurance_live_provider()
    user = await get_current_user(request)
    policy = await db.insurance_policies.find_one({"policy_id": req.policy_id})
    if not policy or policy["user_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Police nicht gefunden")
    if policy["status"] != "active":
        raise HTTPException(status_code=400, detail="Police nicht aktiv")
    now = datetime.now(timezone.utc).isoformat()
    cid = secrets.token_hex(8)
    ref = f"CLM-{secrets.token_hex(4).upper()}"
    claim = {
        "claim_id": cid,
        "reference": ref,
        "policy_id": req.policy_id,
        "policy_title": policy["product_title"],
        "category": policy["category"],
        "user_id": str(user["_id"]),
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "claim_type": req.claim_type or "other",
        "description": req.description,
        "incident_date": req.incident_date or now[:10],
        "amount_estimate": float(req.amount_estimate or 0),
        "photos": req.photos[:6],
        "status": "submitted",
        "created_at": now,
    }
    await db.insurance_claims.insert_one(claim)
    claim.pop("_id", None)
    return {"ok": True, "claim": claim}


@router.get("/my-claims")
async def my_claims(request: Request):
    user = await get_current_user(request)
    claims = await db.insurance_claims.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"claims": claims}


@router.get("/claim/{claim_id}")
async def claim_detail(claim_id: str, request: Request):
    user = await get_current_user(request)
    c = await db.insurance_claims.find_one({"claim_id": claim_id}, {"_id": 0})
    if not c or c["user_id"] != str(user["_id"]):
        raise HTTPException(status_code=404, detail="Schaden nicht gefunden")
    return c


# Admin: review claim
class ClaimReview(BaseModel):
    status: str  # approved, rejected, in_review, paid
    payout_amount: float = 0
    notes: str = ""


@router.post("/admin/claim/{claim_id}/review")
async def admin_review_claim(claim_id: str, req: ClaimReview, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    c = await db.insurance_claims.find_one({"claim_id": claim_id})
    if not c:
        raise HTTPException(status_code=404, detail="Schaden nicht gefunden")
    update = {"status": req.status, "review_notes": req.notes,
              "reviewed_at": datetime.now(timezone.utc).isoformat()}
    if req.status == "paid" and req.payout_amount > 0:
        _require_insurance_live_provider()
        from core.payment_engine import credit_wallet, TransactionType

        payout = await credit_wallet(
            user_id=str(c["user_id"]),
            amount=round(float(req.payout_amount), 2),
            tx_type=TransactionType.REFUND,
            description=f"Schadenauszahlung: {c['policy_title']}",
            reference=c["reference"],
            source="insurance_claim_payout",
            metadata={"claim_id": claim_id, "policy_id": c.get("policy_id")},
            idempotency_key=f"insurance-claim:{claim_id}:payout",
        )
        if not payout.success:
            raise HTTPException(status_code=409, detail=payout.error or "Schadenauszahlung benötigt Abstimmung")
        update["payout_amount"] = round(float(req.payout_amount), 2)
        update["payout_transaction_id"] = payout.transaction_id
    await db.insurance_claims.update_one({"claim_id": claim_id}, {"$set": update})
    return {"ok": True}
