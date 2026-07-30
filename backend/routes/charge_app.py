from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid
import json
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user
from routes.loyalty_system import get_loyalty_status as _get_loyalty_status
from routes.loyalty_system import get_loyalty_stats as _get_loyalty_stats
from routes.loyalty_system import get_reward_history as _get_loyalty_history
from services.charge_storage import upload_bytes as _storage_upload_bytes, get_bytes as _storage_get_bytes


router = APIRouter(prefix="/api/charge-app", tags=["charge-app"])

ALLOWED_UPLOAD_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
ALLOWED_UPLOAD_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class ChargeWarrantyRegistrationRequest(BaseModel):
    product_name: str
    serial_number: str
    purchase_date: str = ""
    merchant_name: str = ""
    invoice_number: str = ""


class ChargeInvoiceSaveRequest(BaseModel):
    invoice_number: str
    merchant_name: str
    amount: float = 0
    purchase_date: str = ""
    product_name: str = ""
    serial_number: str = ""


class ChargeInteractionRequest(BaseModel):
    interaction_type: str
    merchant_slug: str = ""
    merchant_name: str = ""
    city: str = ""
    category: str = ""
    offer_title: str = ""
    metadata: Dict[str, Any] = {}


class ChargeOfferRuleRequest(BaseModel):
    name: str
    region: str = ""
    merchant_slug: str = ""
    category: str = ""
    reason_label: str = ""
    offer_title: str = ""
    offer_hint: str = ""
    score_boost: int = 10
    priority: int = 50
    active: bool = True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _slugify(value: Any) -> str:
    text = str(value or "").strip().lower()
    return "-".join(part for part in "".join(ch if ch.isalnum() else " " for ch in text).split() if part)


def _unique_list(values: List[str]) -> List[str]:
    seen = set()
    result = []
    for item in values:
        normalized = str(item or "").strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def _infer_categories(*texts: Any) -> List[str]:
    corpus = " ".join(str(item or "") for item in texts).lower()
    mapping = {
        "charger": ["charger", "charge", "adapter", "netzteil", "power adapter", "fast charge", "ladegerät"],
        "cable": ["cable", "kabel", "usb-c", "lightning", "hdmi", "wire"],
        "powerbank": ["powerbank", "battery", "akku", "magnetic pack"],
        "dock": ["dock", "stand", "hub", "station"],
        "car": ["car", "auto", "vehicle", "12v"],
        "audio": ["audio", "earbuds", "kopfhörer", "speaker"],
    }
    matches = []
    for key, keywords in mapping.items():
        if any(word in corpus for word in keywords):
            matches.append(key)
    return matches or ["charge-accessories"]


def _build_personalization_profile(user: Dict[str, Any], warranties: List[Dict[str, Any]], invoices: List[Dict[str, Any]], interactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    region_candidates = _unique_list([
        str(user.get("city") or "").strip(),
        str(user.get("region") or "").strip(),
        str(user.get("address_city") or "").strip(),
    ])

    merchant_names = _unique_list([
        *(item.get("merchant_name") for item in warranties),
        *(item.get("merchant_name") for item in invoices),
        *(item.get("merchant_name") for item in interactions),
    ])
    merchant_slugs = _unique_list([
        *(item.get("merchant_slug") for item in interactions),
    ])
    categories = _unique_list([
        *[cat for item in warranties for cat in _infer_categories(item.get("product_name"), item.get("serial_number"), item.get("merchant_name"))],
        *[cat for item in invoices for cat in _infer_categories(item.get("product_name"), item.get("merchant_name"), item.get("invoice_number"))],
        *(item.get("category") for item in interactions if item.get("category")),
    ])

    return {
        "region": region_candidates[0] if region_candidates else "Deutschland",
        "regions": region_candidates or ["Deutschland"],
        "top_merchants": merchant_names[:4],
        "merchant_slugs": merchant_slugs[:4],
        "top_categories": categories[:4],
    }


def _serialize_offer_rule(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "rule_id": doc.get("rule_id"),
        "name": doc.get("name") or "Charge Regel",
        "region": doc.get("region") or "",
        "merchant_slug": doc.get("merchant_slug") or "",
        "category": doc.get("category") or "",
        "reason_label": doc.get("reason_label") or "",
        "offer_title": doc.get("offer_title") or "",
        "offer_hint": doc.get("offer_hint") or "",
        "score_boost": int(doc.get("score_boost") or 0),
        "priority": int(doc.get("priority") or 0),
        "active": bool(doc.get("active", True)),
        "created_at": doc.get("created_at") or "",
        "updated_at": doc.get("updated_at") or "",
    }


def _rule_matches_profile(rule: Dict[str, Any], merchant: Dict[str, Any], profile: Dict[str, Any]) -> bool:
    region = str(rule.get("region") or "").strip().lower()
    merchant_slug = str(rule.get("merchant_slug") or "").strip().lower()
    category = str(rule.get("category") or "").strip().lower()

    merchant_city = str(merchant.get("city") or "").strip().lower()
    merchant_public_slug = str(merchant.get("public_slug") or "").strip().lower()
    merchant_categories = [item.lower() for item in _infer_categories(merchant.get("category"), merchant.get("business_name"))]
    profile_regions = [str(item).strip().lower() for item in (profile.get("regions") or [])]
    profile_categories = [str(item).strip().lower() for item in (profile.get("top_categories") or [])]

    if region and region not in profile_regions and region != merchant_city:
        return False
    if merchant_slug and merchant_slug != merchant_public_slug:
        return False
    if category and category not in merchant_categories and category not in profile_categories:
        return False
    return True


def _apply_offer_rules(merchant: Dict[str, Any], profile: Dict[str, Any], rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    matched = [rule for rule in rules if rule.get("active", True) and _rule_matches_profile(rule, merchant, profile)]
    matched.sort(key=lambda item: (int(item.get("priority") or 0), int(item.get("score_boost") or 0)), reverse=True)
    total_boost = sum(int(item.get("score_boost") or 0) for item in matched)
    labels = [item.get("reason_label") for item in matched if item.get("reason_label")]
    return {
        "rules": matched,
        "score_boost": total_boost,
        "labels": labels,
        "primary_rule": matched[0] if matched else None,
    }


def _score_merchant_for_profile(merchant: Dict[str, Any], profile: Dict[str, Any], rules: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []
    city = str(merchant.get("city") or "")
    business_name = str(merchant.get("business_name") or "")
    slug = str(merchant.get("public_slug") or "")
    category = str(merchant.get("category") or "")

    if city and any(city.lower() == region.lower() for region in profile.get("regions", [])):
        score += 45
        reasons.append(f"In deiner Region: {city}")
    if business_name and any(business_name.lower() == item.lower() for item in profile.get("top_merchants", [])):
        score += 40
        reasons.append("Passend zu deinem bisherigen Händler")
    if slug and any(slug == item for item in profile.get("merchant_slugs", [])):
        score += 35
        reasons.append("Du hast diesen Händler schon angesehen")
    merchant_categories = _infer_categories(category, business_name)
    if any(cat in merchant_categories for cat in profile.get("top_categories", [])):
        score += 20
        reasons.append("Passend zu deinen Charge-Produkten")

    rules_payload = _apply_offer_rules(merchant, profile, rules or [])
    if rules_payload["score_boost"]:
        score += rules_payload["score_boost"]
        reasons.extend(rules_payload["labels"])

    unique_reasons = _unique_list(reasons)

    return {
        **merchant,
        "personalization_score": score,
        "match_reason": unique_reasons[0] if unique_reasons else "Beliebt im BidBlitz Charge Netzwerk",
        "match_reasons": unique_reasons or ["Beliebt im BidBlitz Charge Netzwerk"],
        "rule_boost": rules_payload["score_boost"],
        "applied_rules": [_serialize_offer_rule(item) for item in rules_payload["rules"]],
        "primary_rule": _serialize_offer_rule(rules_payload["primary_rule"]) if rules_payload["primary_rule"] else None,
    }


def _personalized_offer_from_promo(promo: Dict[str, Any], merchant: Dict[str, Any], profile: Dict[str, Any], score: int, reasons: List[str]) -> Dict[str, Any]:
    merchant_name = merchant.get("business_name") or "BidBlitz Charge Händler"
    city = merchant.get("city") or profile.get("region") or "Deutschland"
    primary_rule = merchant.get("primary_rule") or {}
    title = primary_rule.get("offer_title") or promo.get("name") or f"Charge Angebot bei {merchant_name}"
    description = primary_rule.get("offer_hint") or promo.get("description") or f"Exklusiver Charge-Vorteil bei {merchant_name} in {city}."
    return {
        "offer_id": f"{_slugify(title)}-{merchant.get('public_slug') or 'network'}",
        "title": title,
        "description": description,
        "offer_type": promo.get("type") or "cashback",
        "value": promo.get("value") or 0,
        "expires_at": promo.get("expires_at") or "",
        "target": promo.get("target") or "all",
        "merchant_name": merchant_name,
        "merchant_slug": merchant.get("public_slug") or "",
        "region": city,
        "category": merchant.get("category") or "Charge / Retail",
        "score": score,
        "reason": reasons[0] if reasons else "Für dein Charge-Profil empfohlen",
        "reasons": reasons or ["Für dein Charge-Profil empfohlen"],
        "cta_label": "Zum Händler",
        "applied_rule": primary_rule or None,
    }


def _fallback_offer(merchant: Dict[str, Any], profile: Dict[str, Any], score: int, reasons: List[str]) -> Dict[str, Any]:
    merchant_name = merchant.get("business_name") or "BidBlitz Charge Händler"
    city = merchant.get("city") or profile.get("region") or "Deutschland"
    category = merchant.get("category") or "Charge / Retail"
    primary_rule = merchant.get("primary_rule") or {}
    value = 12 if any("Region" in reason for reason in reasons) else 8
    return {
        "offer_id": f"fallback-{merchant.get('public_slug') or _slugify(merchant_name)}",
        "title": primary_rule.get("offer_title") or f"{merchant_name} Charge Bonus",
        "description": primary_rule.get("offer_hint") or f"Empfohlenes {category}-Angebot für dich in {city}. Perfekt für passendes Zubehör und neue Charge-Käufe.",
        "offer_type": "member_offer",
        "value": value,
        "expires_at": "",
        "target": "all",
        "merchant_name": merchant_name,
        "merchant_slug": merchant.get("public_slug") or "",
        "region": city,
        "category": category,
        "score": score,
        "reason": reasons[0] if reasons else "Empfohlen im Charge-Netzwerk",
        "reasons": reasons or ["Empfohlen im Charge-Netzwerk"],
        "cta_label": "Zum Händler",
        "applied_rule": primary_rule or None,
    }


def _build_personalized_offers(promotions: List[Dict[str, Any]], merchants: List[Dict[str, Any]], profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    scored_merchants = [_score_merchant_for_profile(item, profile) for item in merchants]
    scored_merchants.sort(key=lambda item: item.get("personalization_score", 0), reverse=True)
    selected = [item for item in scored_merchants if item.get("personalization_score", 0) > 0][:4] or scored_merchants[:3]
    result: List[Dict[str, Any]] = []
    used_ids = set()
    for index, merchant in enumerate(selected):
        matching_promo = promotions[index % len(promotions)] if promotions else None
        offer = _personalized_offer_from_promo(matching_promo, merchant, profile, merchant.get("personalization_score", 0), merchant.get("match_reasons", [])) if matching_promo else _fallback_offer(merchant, profile, merchant.get("personalization_score", 0), merchant.get("match_reasons", []))
        offer_id = offer.get("offer_id")
        if offer_id in used_ids:
            continue
        used_ids.add(offer_id)
        result.append(offer)
    return result


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _warranty_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    purchase_dt = _parse_iso(doc.get("purchase_date")) or _parse_iso(doc.get("created_at")) or datetime.now(timezone.utc)
    valid_until = (purchase_dt + timedelta(days=730)).date().isoformat()
    warranty_pass = _build_warranty_pass(doc)
    return {
        "registration_id": doc.get("registration_id"),
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": doc.get("serial_number") or "—",
        "purchase_date": doc.get("purchase_date") or purchase_dt.date().isoformat(),
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "invoice_number": doc.get("invoice_number") or "—",
        "status": doc.get("status") or "active",
        "valid_until": valid_until,
        "coverage_label": "24 Monate Charge Care",
        "support_hint": "Digitale Garantie gespeichert – bei Bedarf direkt im Händlernetz abrufbar.",
        "created_at": doc.get("created_at") or _now_iso(),
        "attachments": [_attachment_meta(item, f"/api/charge-app/warranty/{doc.get('registration_id')}/attachments") for item in (doc.get("attachments") or [])],
        "warranty_pass": warranty_pass,
    }


def _build_warranty_pass(doc: Dict[str, Any]) -> Dict[str, Any]:
    purchase_dt = _parse_iso(doc.get("purchase_date")) or _parse_iso(doc.get("created_at")) or datetime.now(timezone.utc)
    valid_until = (purchase_dt + timedelta(days=730)).date().isoformat()
    qr_payload = json.dumps({
        "type": "bidblitz_charge_warranty_pass",
        "registration_id": doc.get("registration_id"),
        "serial_number": doc.get("serial_number"),
        "product_name": doc.get("product_name"),
        "merchant_name": doc.get("merchant_name"),
        "valid_until": valid_until,
        "status": doc.get("status") or "active",
    }, ensure_ascii=False)
    return {
        "pass_id": f"BB-CHARGE-{str(doc.get('registration_id') or '')[-6:]}",
        "registration_id": doc.get("registration_id"),
        "serial_number": doc.get("serial_number") or "—",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "coverage_label": "24 Monate Charge Care",
        "status_label": "Aktiv" if (doc.get("status") or "active") == "active" else str(doc.get("status") or "active").title(),
        "valid_until": valid_until,
        "qr_payload": qr_payload,
    }


def _attachment_meta(item: Dict[str, Any], base_download_path: str) -> Dict[str, Any]:
    return {
        "attachment_id": item.get("attachment_id"),
        "original_filename": item.get("original_filename") or "Datei",
        "content_type": item.get("content_type") or "application/octet-stream",
        "size": item.get("size") or 0,
        "uploaded_at": item.get("uploaded_at") or "",
        "download_path": f"{base_download_path}/{item.get('attachment_id')}/download",
    }


def _invoice_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "invoice_id": doc.get("invoice_id"),
        "invoice_number": doc.get("invoice_number") or "—",
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "amount": _safe_float(doc.get("amount")),
        "purchase_date": doc.get("purchase_date") or "",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": doc.get("serial_number") or "",
        "created_at": doc.get("created_at") or "",
        "attachments": [_attachment_meta(item, f"/api/charge-app/invoices/{doc.get('invoice_id')}/attachments") for item in (doc.get("attachments") or [])],
    }


def _validate_upload_file(filename: str, content_type: str, size: int):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    normalized_type = (content_type or "").lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Ungültige Dateiendung. Erlaubt: PDF, JPG, PNG, WEBP")
    if normalized_type and normalized_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiger Dateityp. Erlaubt: PDF, JPG, PNG, WEBP")
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Datei zu groß. Maximal 10 MB")


async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read()
    _validate_upload_file(file.filename or "datei", file.content_type or "", len(content))
    return content


async def _find_user_warranty(user_id: str, registration_id: str) -> Dict[str, Any]:
    doc = await db.charge_app_warranties.find_one({"user_id": user_id, "registration_id": registration_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Garantie nicht gefunden")
    return doc


async def _find_user_invoice(user_id: str, invoice_id: str) -> Dict[str, Any]:
    doc = await db.charge_app_invoices.find_one({"user_id": user_id, "invoice_id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return doc


async def _get_charge_merchants(limit: int = 12) -> List[Dict[str, Any]]:
    merchants = await db.merchant_profiles.find({}, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    payload = []
    for item in merchants:
        business_name = item.get("business_name") or "BidBlitz Partner"
        city = item.get("city") or "Deutschland"
        category = item.get("category") or "Charge / Retail"
        slug = item.get("public_slug") or ""
        payload.append({
            "business_name": business_name,
            "city": city,
            "category": category,
            "website": item.get("website") or "",
            "address": item.get("address") or "",
            "phone": item.get("phone") or "",
            "logo_url": item.get("logo_url") or "",
            "public_slug": slug,
            "route": f"/charge-app/merchant?slug={slug}" if slug else "/merchant",
        })
    return payload


@router.get("/dashboard")
async def get_charge_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))

    warranties = await db.charge_app_warranties.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    invoices = await db.charge_app_invoices.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    interactions = await db.charge_app_interactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    merchants = await _get_charge_merchants()
    rules = await db.charge_offer_rules.find({"active": True}, {"_id": 0}).sort("priority", -1).to_list(100)

    offers = await db.promotions.find(
        {"active": True},
        {"_id": 0, "name": 1, "description": 1, "type": 1, "value": 1, "expires_at": 1, "target": 1}
    ).sort("created_at", -1).limit(8).to_list(8)
    normalized_offers = [
        {
            "title": item.get("name") or "Charge Offer",
            "description": item.get("description") or "Exklusives Angebot für BidBlitz Charge Kunden.",
            "offer_type": item.get("type") or "cashback",
            "value": item.get("value"),
            "expires_at": item.get("expires_at"),
            "target": item.get("target") or "all",
        }
        for item in offers
    ]

    if not normalized_offers:
        normalized_offers = [
            {
                "title": "Charge Starter Bonus",
                "description": "Sichere dir exklusive Händlerangebote und verlängerte Sichtbarkeit deiner Garantie.",
                "offer_type": "member_offer",
                "value": 15,
                "expires_at": "",
                "target": "all",
            },
            {
                "title": "Bundle Rabatt",
                "description": "Kabel + Charger + Zubehör als Premium-Bundle zum Vorteilspreis.",
                "offer_type": "bundle",
                "value": 10,
                "expires_at": "",
                "target": "all",
            },
        ]

    personalization = _build_personalization_profile(user, warranties, invoices, interactions)
    ranked_merchants = [_score_merchant_for_profile(item, personalization, rules) for item in merchants]
    ranked_merchants.sort(key=lambda item: item.get("personalization_score", 0), reverse=True)
    personalized_offers = _build_personalized_offers(normalized_offers, ranked_merchants, personalization)

    loyalty_status = await _get_loyalty_status(request)
    loyalty_stats = await _get_loyalty_stats(request)
    loyalty_history = await _get_loyalty_history(request, limit=8)

    return {
        "summary": {
            "registered_warranties": len(warranties),
            "stored_invoices": len(invoices),
            "coins_balance": loyalty_status.get("coins_balance", 0),
            "offers_total": len(normalized_offers),
            "merchants_total": len(merchants),
            "personalized_offers_total": len(personalized_offers),
            "active_rules_total": len(rules),
        },
        "warranties": [_warranty_card(item) for item in warranties],
        "invoices": [_invoice_card(item) for item in invoices],
        "loyalty": {
            "status": loyalty_status,
            "stats": loyalty_stats,
            "history": loyalty_history,
        },
        "personalization": personalization,
        "admin_rules": [_serialize_offer_rule(item) for item in rules[:10]],
        "personalized_offers": personalized_offers,
        "offers": normalized_offers,
        "merchants": ranked_merchants,
    }


@router.post("/interactions")
async def track_charge_interaction(req: ChargeInteractionRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    interaction = {
        "interaction_id": f"CHG-INT-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "interaction_type": req.interaction_type.strip() or "view",
        "merchant_slug": req.merchant_slug.strip(),
        "merchant_name": req.merchant_name.strip(),
        "city": req.city.strip(),
        "category": req.category.strip(),
        "offer_title": req.offer_title.strip(),
        "metadata": req.metadata or {},
        "created_at": _now_iso(),
    }
    await db.charge_app_interactions.insert_one(interaction)
    interaction.pop("_id", None)
    return {"ok": True, "interaction": interaction}


@router.post("/warranty/register")
async def register_charge_warranty(req: ChargeWarrantyRegistrationRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    serial = req.serial_number.strip()
    if not req.product_name.strip() or not serial:
        raise HTTPException(status_code=400, detail="Produktname und Seriennummer sind erforderlich")

    existing = await db.charge_app_warranties.find_one(
        {"user_id": user_id, "serial_number": serial},
        {"_id": 0}
    )
    if existing:
        return {"ok": True, "warranty": _warranty_card(existing), "duplicate": True}

    doc = {
        "registration_id": f"CHG-WAR-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "product_name": req.product_name.strip(),
        "serial_number": serial,
        "purchase_date": req.purchase_date.strip(),
        "merchant_name": req.merchant_name.strip(),
        "invoice_number": req.invoice_number.strip(),
        "status": "active",
        "created_at": _now_iso(),
    }
    await db.charge_app_warranties.insert_one(doc)
    return {"ok": True, "warranty": _warranty_card(doc)}


@router.post("/invoices/save")
async def save_charge_invoice(req: ChargeInvoiceSaveRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    if not req.invoice_number.strip() or not req.merchant_name.strip():
        raise HTTPException(status_code=400, detail="Rechnungsnummer und Händlername sind erforderlich")

    existing = await db.charge_app_invoices.find_one(
        {"user_id": user_id, "invoice_number": req.invoice_number.strip()},
        {"_id": 0}
    )
    if existing:
        return {"ok": True, "invoice": existing, "duplicate": True}

    doc = {
        "invoice_id": f"CHG-INV-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "invoice_number": req.invoice_number.strip(),
        "merchant_name": req.merchant_name.strip(),
        "amount": _safe_float(req.amount),
        "purchase_date": req.purchase_date.strip(),
        "product_name": req.product_name.strip(),
        "serial_number": req.serial_number.strip(),
        "created_at": _now_iso(),
    }
    await db.charge_app_invoices.insert_one(doc)
    # Exclude MongoDB _id from response to avoid ObjectId serialization error
    doc.pop("_id", None)
    return {"ok": True, "invoice": doc}


@router.post("/warranty/{registration_id}/attachments")
async def upload_warranty_attachment(registration_id: str, request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    content = await _read_upload(file)
    uploaded = _storage_upload_bytes(user_id, file.filename or "warranty-proof.bin", content, file.content_type or None)
    attachment = {
        "attachment_id": f"ATT-{uuid.uuid4().hex[:10].upper()}",
        "kind": "warranty_proof",
        "original_filename": file.filename or "Datei",
        "content_type": file.content_type or "application/octet-stream",
        "size": uploaded.get("size", len(content)),
        "storage_path": uploaded["path"],
        "uploaded_at": _now_iso(),
    }
    await db.charge_app_warranties.update_one({"user_id": user_id, "registration_id": registration_id}, {"$push": {"attachments": attachment}})
    return {"ok": True, "attachment": _attachment_meta(attachment, f"/api/charge-app/warranty/{registration_id}/attachments"), "warranty": _warranty_card({**warranty, "attachments": [*(warranty.get('attachments') or []), attachment]})}


@router.get("/warranty/{registration_id}/attachments/{attachment_id}/download")
@router.head("/warranty/{registration_id}/attachments/{attachment_id}/download")
async def download_warranty_attachment(registration_id: str, attachment_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    attachment = next((item for item in (warranty.get("attachments") or []) if item.get("attachment_id") == attachment_id), None)
    if not attachment:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    content, content_type = _storage_get_bytes(attachment["storage_path"])
    return StreamingResponse(BytesIO(content), media_type=attachment.get("content_type") or content_type, headers={"Content-Disposition": f"attachment; filename={attachment.get('original_filename') or 'charge-datei'}"})


@router.post("/invoices/{invoice_id}/attachments")
async def upload_invoice_attachment(invoice_id: str, request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    invoice = await _find_user_invoice(user_id, invoice_id)
    content = await _read_upload(file)
    uploaded = _storage_upload_bytes(user_id, file.filename or "invoice-proof.bin", content, file.content_type or None)
    attachment = {
        "attachment_id": f"ATT-{uuid.uuid4().hex[:10].upper()}",
        "kind": "invoice_file",
        "original_filename": file.filename or "Datei",
        "content_type": file.content_type or "application/octet-stream",
        "size": uploaded.get("size", len(content)),
        "storage_path": uploaded["path"],
        "uploaded_at": _now_iso(),
    }
    await db.charge_app_invoices.update_one({"user_id": user_id, "invoice_id": invoice_id}, {"$push": {"attachments": attachment}})
    return {"ok": True, "attachment": _attachment_meta(attachment, f"/api/charge-app/invoices/{invoice_id}/attachments"), "invoice": _invoice_card({**invoice, "attachments": [*(invoice.get('attachments') or []), attachment]})}


@router.get("/invoices/{invoice_id}/attachments/{attachment_id}/download")
@router.head("/invoices/{invoice_id}/attachments/{attachment_id}/download")
async def download_invoice_attachment(invoice_id: str, attachment_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    invoice = await _find_user_invoice(user_id, invoice_id)
    attachment = next((item for item in (invoice.get("attachments") or []) if item.get("attachment_id") == attachment_id), None)
    if not attachment:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    content, content_type = _storage_get_bytes(attachment["storage_path"])
    return StreamingResponse(BytesIO(content), media_type=attachment.get("content_type") or content_type, headers={"Content-Disposition": f"attachment; filename={attachment.get('original_filename') or 'charge-datei'}"})


@router.get("/warranty/{registration_id}/pass")
async def get_charge_warranty_pass(registration_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    return {"ok": True, "pass": _build_warranty_pass(warranty)}


@router.get("/warranty/{registration_id}/pass/download")
@router.head("/warranty/{registration_id}/pass/download")
async def download_charge_warranty_pass(registration_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    pass_data = _build_warranty_pass(warranty)
    html = f"""
    <!DOCTYPE html>
    <html lang='de'>
    <head><meta charset='UTF-8'><title>BidBlitz Charge Garantiepass</title></head>
    <body style='font-family:Arial,sans-serif;background:#08131D;padding:32px;color:#fff;'>
      <div style='max-width:760px;margin:0 auto;background:linear-gradient(135deg,#0B1826,#132537);border-radius:24px;padding:32px;border:1px solid rgba(110,231,249,0.25);'>
        <p style='letter-spacing:0.28em;color:#9EEAF6;font-size:11px;text-transform:uppercase;'>BidBlitz Charge</p>
        <h1 style='margin:12px 0 8px;font-size:32px;'>{pass_data['coverage_label']}</h1>
        <p style='color:#D5DFEA;'>Digitaler Garantiepass für {pass_data['product_name']}</p>
        <div style='margin-top:24px;background:#F8F3EA;color:#0F172A;border-radius:18px;padding:20px;'>
          <p><strong>Pass ID:</strong> {pass_data['pass_id']}</p>
          <p><strong>Registrierung:</strong> {pass_data['registration_id']}</p>
          <p><strong>Seriennummer:</strong> {pass_data['serial_number']}</p>
          <p><strong>Händler:</strong> {pass_data['merchant_name']}</p>
          <p><strong>Status:</strong> {pass_data['status_label']}</p>
          <p><strong>Gültig bis:</strong> {pass_data['valid_until']}</p>
          <p><strong>QR Payload:</strong><br><span style='font-family:monospace;word-break:break-all;'>{pass_data['qr_payload']}</span></p>
        </div>
      </div>
    </body>
    </html>
    """
    filename = f"bidblitz-charge-pass-{registration_id}.html"
    return StreamingResponse(iter([html.encode("utf-8")]), media_type="text/html", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/merchants/{slug}")
async def get_charge_merchant_detail(slug: str):
    merchant = await db.merchants.find_one({"public_slug": slug}, {"_id": 0})
    profile = await db.merchant_profiles.find_one({"public_slug": slug}, {"_id": 0})
    if not merchant and not profile:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")

    owner_user_id = (merchant or {}).get("user_id") or (profile or {}).get("user_id")
    merchant_id = (merchant or {}).get("merchant_id")
    merchant_payload = {
        "business_name": (merchant or {}).get("business_name") or (profile or {}).get("business_name") or slug,
        "description": (merchant or {}).get("description") or (profile or {}).get("description") or "",
        "phone": (merchant or {}).get("phone") or (profile or {}).get("phone") or "",
        "email": (merchant or {}).get("email") or (profile or {}).get("email") or "",
        "website": (profile or {}).get("website") or "",
        "address": (merchant or {}).get("address") or (profile or {}).get("address") or "",
        "city": (profile or {}).get("city") or "",
        "logo_url": (profile or {}).get("logo_url") or "",
        "category": (profile or {}).get("category") or "Charge / Retail",
        "public_slug": slug,
    }
    products = await db.pos_products.find({"merchant_id": merchant_id, "active": True}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8) if merchant_id else []
    promotions = await db.promotions.find({"active": True}, {"_id": 0, "name": 1, "description": 1, "type": 1, "value": 1}).sort("created_at", -1).limit(4).to_list(4)
    vouchers = await db.vouchers.find({"merchant_id": owner_user_id, "status": "active"}, {"_id": 0}).sort("created_at", -1).limit(4).to_list(4) if owner_user_id else []
    return {
        "merchant": merchant_payload,
        "products": products,
        "promotions": [{"title": item.get("name"), "description": item.get("description"), "offer_type": item.get("type"), "value": item.get("value")} for item in promotions],
        "vouchers": vouchers,
        "highlights": [
            "Digitale Garantie und klarer After-Sales-Support",
            "Hochwertige Charge-Produkte mit sauberer Präsentation",
            "Passend für Zubehör, Bundles und schnelle Reklamationsfälle",
        ],
    }


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("/admin/offer-rules")
async def list_charge_offer_rules(request: Request):
    await _require_admin(request)
    rows = await db.charge_offer_rules.find({}, {"_id": 0}).sort([("priority", -1), ("updated_at", -1)]).to_list(200)
    return {
        "ok": True,
        "rules": [_serialize_offer_rule(item) for item in rows],
        "summary": {
            "total": len(rows),
            "active": sum(1 for item in rows if item.get("active", True)),
            "regions": len({str(item.get('region') or '').strip().lower() for item in rows if str(item.get('region') or '').strip()}),
            "categories": len({str(item.get('category') or '').strip().lower() for item in rows if str(item.get('category') or '').strip()}),
        },
    }


@router.post("/admin/offer-rules")
async def create_charge_offer_rule(req: ChargeOfferRuleRequest, request: Request):
    admin = await _require_admin(request)
    now = _now_iso()
    doc = {
        "rule_id": f"CHG-RULE-{uuid.uuid4().hex[:10].upper()}",
        "name": req.name.strip() or "Charge Regel",
        "region": req.region.strip(),
        "merchant_slug": req.merchant_slug.strip(),
        "category": req.category.strip(),
        "reason_label": req.reason_label.strip() or "Admin-Regel aktiv",
        "offer_title": req.offer_title.strip(),
        "offer_hint": req.offer_hint.strip(),
        "score_boost": int(req.score_boost),
        "priority": int(req.priority),
        "active": bool(req.active),
        "created_at": now,
        "updated_at": now,
        "updated_by": admin.get("email") or admin.get("user_id") or "admin",
    }
    await db.charge_offer_rules.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "rule": _serialize_offer_rule(doc)}


@router.put("/admin/offer-rules/{rule_id}")
async def update_charge_offer_rule(rule_id: str, req: ChargeOfferRuleRequest, request: Request):
    admin = await _require_admin(request)
    update_doc = {
        "name": req.name.strip() or "Charge Regel",
        "region": req.region.strip(),
        "merchant_slug": req.merchant_slug.strip(),
        "category": req.category.strip(),
        "reason_label": req.reason_label.strip() or "Admin-Regel aktiv",
        "offer_title": req.offer_title.strip(),
        "offer_hint": req.offer_hint.strip(),
        "score_boost": int(req.score_boost),
        "priority": int(req.priority),
        "active": bool(req.active),
        "updated_at": _now_iso(),
        "updated_by": admin.get("email") or admin.get("user_id") or "admin",
    }
    result = await db.charge_offer_rules.update_one({"rule_id": rule_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Regel nicht gefunden")
    saved = await db.charge_offer_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    return {"ok": True, "rule": _serialize_offer_rule(saved or update_doc)}


@router.put("/admin/offer-rules/{rule_id}/toggle")
async def toggle_charge_offer_rule(rule_id: str, request: Request):
    await _require_admin(request)
    existing = await db.charge_offer_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Regel nicht gefunden")
    next_active = not bool(existing.get("active", True))
    await db.charge_offer_rules.update_one({"rule_id": rule_id}, {"$set": {"active": next_active, "updated_at": _now_iso()}})
    saved = await db.charge_offer_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    return {"ok": True, "rule": _serialize_offer_rule(saved or {**existing, 'active': next_active})}
