from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid
import json
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from routes.loyalty_system import get_loyalty_status as _get_loyalty_status
from routes.loyalty_system import get_loyalty_stats as _get_loyalty_stats
from routes.loyalty_system import get_reward_history as _get_loyalty_history
from services.charge_storage import (
    upload_bytes as _storage_upload_bytes,
    get_bytes as _storage_get_bytes,
    delete_bytes as _storage_delete_bytes,
)


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
    warranty_months: int = Field(default=24, ge=1, le=120)


class ChargeInvoiceSaveRequest(BaseModel):
    invoice_number: str
    merchant_name: str
    amount: float = 0
    purchase_date: str = ""
    product_name: str = ""
    serial_number: str = ""


class ChargeWarrantyUpdateRequest(BaseModel):
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    merchant_name: Optional[str] = None
    invoice_number: Optional[str] = None
    warranty_months: Optional[int] = Field(default=None, ge=1, le=120)


class ChargeInvoiceUpdateRequest(BaseModel):
    invoice_number: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: Optional[float] = None
    purchase_date: Optional[str] = None
    product_name: Optional[str] = None
    serial_number: Optional[str] = None


class ChargeCatalogOverrideRequest(BaseModel):
    visible: bool = True
    featured: bool = False
    charge_category: str = ""
    sort_order: int = Field(default=100, ge=0, le=10000)


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
        "wireless": ["wireless", "magsafe", "mag safe", "qi", "inductive", "induktiv"],
        "dock": ["dock", "stand", "hub", "station", "halterung", "holder"],
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


def _preview_mode(content_type: Any) -> str:
    normalized = str(content_type or "").lower()
    if normalized.startswith("image/"):
        return "image"
    if normalized == "application/pdf":
        return "pdf"
    return "download"


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


def _add_months(dt: datetime, months: int) -> datetime:
    months = max(1, min(int(months or 24), 120))
    month_index = (dt.month - 1) + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    # Clamp the original day to the target month's last valid day.
    next_month = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1, tzinfo=dt.tzinfo)
    last_day = (next_month - timedelta(days=1)).day
    return dt.replace(year=year, month=month, day=min(dt.day, last_day))


def _warranty_terms(doc: Dict[str, Any]) -> tuple[int, datetime, str]:
    purchase_dt = _parse_iso(doc.get("purchase_date")) or _parse_iso(doc.get("created_at")) or datetime.now(timezone.utc)
    months = max(1, min(int(doc.get("warranty_months") or 24), 120))
    valid_until_dt = _add_months(purchase_dt, months)
    stored_status = str(doc.get("status") or "active")
    effective_status = "expired" if stored_status == "active" and datetime.now(timezone.utc) > valid_until_dt else stored_status
    return months, valid_until_dt, effective_status


def _warranty_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    months, valid_until_dt, effective_status = _warranty_terms(doc)
    purchase_dt = _parse_iso(doc.get("purchase_date")) or _parse_iso(doc.get("created_at")) or datetime.now(timezone.utc)
    valid_until = valid_until_dt.date().isoformat()
    warranty_pass = _build_warranty_pass(doc)
    return {
        "registration_id": doc.get("registration_id"),
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": doc.get("serial_number") or "—",
        "purchase_date": doc.get("purchase_date") or purchase_dt.date().isoformat(),
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "invoice_number": doc.get("invoice_number") or "—",
        "status": effective_status,
        "warranty_months": months,
        "valid_until": valid_until,
        "coverage_label": f"{months} Monate Charge Care",
        "support_hint": "Digitale Garantie gespeichert – bei Bedarf direkt im Händlernetz abrufbar.",
        "created_at": doc.get("created_at") or _now_iso(),
        "attachments": [_attachment_meta(item, f"/api/charge-app/warranty/{doc.get('registration_id')}/attachments") for item in (doc.get("attachments") or [])],
        "warranty_pass": warranty_pass,
    }


def _build_warranty_pass(doc: Dict[str, Any]) -> Dict[str, Any]:
    months, valid_until_dt, effective_status = _warranty_terms(doc)
    valid_until = valid_until_dt.date().isoformat()
    qr_payload = json.dumps({
        "type": "bidblitz_charge_warranty_pass",
        "registration_id": doc.get("registration_id"),
        "serial_number": doc.get("serial_number"),
        "product_name": doc.get("product_name"),
        "merchant_name": doc.get("merchant_name"),
        "valid_until": valid_until,
        "status": effective_status,
    }, ensure_ascii=False)
    return {
        "pass_id": f"BB-CHARGE-{str(doc.get('registration_id') or '')[-6:]}",
        "registration_id": doc.get("registration_id"),
        "serial_number": doc.get("serial_number") or "—",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "coverage_label": f"{months} Monate Charge Care",
        "warranty_months": months,
        "status_label": "Aktiv" if effective_status == "active" else ("Abgelaufen" if effective_status == "expired" else effective_status.title()),
        "valid_until": valid_until,
        "qr_payload": qr_payload,
    }


def _attachment_meta(item: Dict[str, Any], base_download_path: str) -> Dict[str, Any]:
    preview_mode = _preview_mode(item.get("content_type"))
    return {
        "attachment_id": item.get("attachment_id"),
        "original_filename": item.get("original_filename") or "Datei",
        "content_type": item.get("content_type") or "application/octet-stream",
        "size": item.get("size") or 0,
        "uploaded_at": item.get("uploaded_at") or "",
        "download_path": f"{base_download_path}/{item.get('attachment_id')}/download",
        "preview_mode": preview_mode,
        "preview_supported": preview_mode in {"image", "pdf"},
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


def _clean_optional_text(value: Any) -> str:
    return str(value or "").strip()


def _delete_attachment_blob(attachment: Dict[str, Any]) -> None:
    storage_path = attachment.get("storage_path")
    if not storage_path:
        return
    try:
        _storage_delete_bytes(storage_path)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Datei konnte nicht aus dem Charge-Speicher gelöscht werden: {str(exc)[:160]}",
        )


def _delete_document_blobs(doc: Dict[str, Any]) -> None:
    for attachment in doc.get("attachments") or []:
        _delete_attachment_blob(attachment)


def _matches_merchant_context(merchant_name: Any, merchant_payload: Dict[str, Any], slug: str) -> bool:
    merchant_slug = _slugify(merchant_name)
    if not merchant_slug:
        return False
    candidates = {
        _slugify(merchant_payload.get("business_name")),
        _slugify(slug),
    }
    return merchant_slug in candidates


def _charge_catalog_categories(product: Dict[str, Any]) -> List[str]:
    categories = _infer_categories(
        product.get("name"),
        product.get("brand"),
        product.get("description"),
        product.get("category"),
        product.get("sku"),
    )
    corpus = " ".join(str(product.get(key) or "") for key in ("name", "brand", "description", "category", "sku")).lower()
    if categories == ["charge-accessories"] and not any(
        token in corpus
        for token in ("charge", "charger", "kabel", "cable", "powerbank", "magsafe", "wireless", "usb", "adapter", "audio", "car")
    ):
        return []
    return categories


def _charge_product_card(
    product: Dict[str, Any],
    merchant: Optional[Dict[str, Any]],
    profile: Optional[Dict[str, Any]],
    override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    stock = _safe_float(product.get("stock"))
    track_stock = bool(product.get("track_stock", True))
    merchant_name = (merchant or {}).get("business_name") or "BidBlitz Charge Händler"
    merchant_slug = (merchant or {}).get("public_slug") or (profile or {}).get("public_slug") or ""
    city = (profile or {}).get("city") or (merchant or {}).get("city") or ""
    override = override or {}
    categories = _charge_catalog_categories(product)
    forced_category = str(override.get("charge_category") or "").strip().lower()
    if forced_category:
        categories = [forced_category, *[item for item in categories if item != forced_category]]
    return {
        "product_id": product.get("product_id"),
        "name": product.get("name") or "BidBlitz Charge Produkt",
        "description": product.get("description") or "",
        "brand": product.get("brand") or "BidBlitz Charge",
        "category": product.get("category") or (categories[0] if categories else "Charge / Zubehör"),
        "charge_categories": categories,
        "price": _safe_float(product.get("price")),
        "currency": "EUR",
        "stock": stock,
        "track_stock": track_stock,
        "in_stock": (not track_stock) or stock > 0 or bool(product.get("allow_negative_stock")),
        "image_url": product.get("image_url") or "",
        "barcode": product.get("barcode") or "",
        "sku": product.get("sku") or "",
        "merchant_id": product.get("merchant_id") or "",
        "merchant_name": merchant_name,
        "merchant_slug": merchant_slug,
        "city": city,
        "route": f"/charge-app/merchant?slug={merchant_slug}" if merchant_slug else "/merchant",
        "featured": bool(override.get("featured", False)),
        "sort_order": int(override.get("sort_order") or 100),
        "updated_at": product.get("updated_at") or product.get("created_at") or "",
    }


async def _get_charge_merchants(limit: int = 12) -> List[Dict[str, Any]]:
    merchants = await db.merchant_profiles.find({}, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    payload = []
    for item in merchants:
        slug = item.get("public_slug") or ""
        merchant_doc = None
        if slug:
            merchant_doc = await db.merchants.find_one({"public_slug": slug}, {"_id": 0})
        if not merchant_doc and item.get("user_id"):
            merchant_doc = await db.merchants.find_one({"user_id": item.get("user_id")}, {"_id": 0})

        business_name = (merchant_doc or {}).get("business_name") or item.get("business_name") or "BidBlitz Partner"
        city = item.get("city") or "Deutschland"
        category = item.get("category") or "Charge / Retail"
        payload.append({
            "business_name": business_name,
            "city": city,
            "category": category,
            "website": item.get("website") or "",
            "address": (merchant_doc or {}).get("address") or item.get("address") or "",
            "phone": (merchant_doc or {}).get("phone") or item.get("phone") or "",
            "email": (merchant_doc or {}).get("email") or item.get("email") or "",
            "logo_url": item.get("logo_url") or "",
            "public_slug": slug,
            "route": f"/charge-app/merchant?slug={slug}" if slug else "/merchant",
        })
    return payload


@router.get("/catalog")
async def get_charge_catalog(
    request: Request,
    q: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 120,
):
    await get_current_user(request)
    safe_limit = min(max(int(limit or 120), 1), 300)

    query: Dict[str, Any] = {"active": True}
    if q and q.strip():
        needle = q.strip()
        query["$or"] = [
            {"name": {"$regex": needle, "$options": "i"}},
            {"brand": {"$regex": needle, "$options": "i"}},
            {"description": {"$regex": needle, "$options": "i"}},
            {"category": {"$regex": needle, "$options": "i"}},
            {"sku": {"$regex": needle, "$options": "i"}},
            {"barcode": needle},
        ]

    products = await db.pos_products.find(query, {"_id": 0}).sort("updated_at", -1).limit(500).to_list(500)
    products = [item for item in products if _charge_catalog_categories(item)]

    merchant_ids = list({
        str(item.get("merchant_id"))
        for item in products
        if item.get("merchant_id")
    })
    merchants = await db.merchants.find(
        {"merchant_id": {"$in": merchant_ids}},
        {"_id": 0},
    ).to_list(500) if merchant_ids else []
    merchant_by_id = {str(item.get("merchant_id")): item for item in merchants}

    user_ids = list({
        str(item.get("user_id"))
        for item in merchants
        if item.get("user_id")
    })
    profiles = await db.merchant_profiles.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0},
    ).to_list(500) if user_ids else []
    profile_by_user = {str(item.get("user_id")): item for item in profiles}

    product_ids = [str(item.get("product_id")) for item in products if item.get("product_id")]
    overrides = await db.charge_catalog_overrides.find(
        {"product_id": {"$in": product_ids}},
        {"_id": 0},
    ).to_list(1000) if product_ids else []
    override_by_product = {str(item.get("product_id")): item for item in overrides}

    cards: List[Dict[str, Any]] = []
    requested_category = str(category or "").strip().lower()

    for product in products:
        override = override_by_product.get(str(product.get("product_id"))) or {}
        if override.get("visible") is False:
            continue
        merchant = merchant_by_id.get(str(product.get("merchant_id")))
        profile = profile_by_user.get(str((merchant or {}).get("user_id")))
        card = _charge_product_card(product, merchant, profile, override)
        cats = card.get("charge_categories") or []
        if requested_category and requested_category != "all" and requested_category not in [str(x).lower() for x in cats]:
            continue
        cards.append(card)

    cards.sort(key=lambda item: (
        0 if item.get("featured") else 1,
        int(item.get("sort_order") or 100),
        str(item.get("name") or "").lower(),
    ))
    cards = cards[:safe_limit]

    category_counts: Dict[str, int] = {}
    for card in cards:
        for cat in card.get("charge_categories") or []:
            category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        "products": cards,
        "total": len(cards),
        "categories": [
            {"id": key, "count": value}
            for key, value in sorted(category_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
        "query": q or "",
        "category": requested_category or "all",
    }


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
        "warranty_months": int(req.warranty_months),
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


@router.put("/warranty/{registration_id}")
async def update_charge_warranty(
    registration_id: str,
    req: ChargeWarrantyUpdateRequest,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    current = await _find_user_warranty(user_id, registration_id)
    updates = req.dict(exclude_unset=True)

    for key in ("product_name", "serial_number", "purchase_date", "merchant_name", "invoice_number"):
        if key in updates:
            updates[key] = _clean_optional_text(updates[key])

    product_name = updates.get("product_name", current.get("product_name", ""))
    serial_number = updates.get("serial_number", current.get("serial_number", ""))
    if not product_name or not serial_number:
        raise HTTPException(status_code=400, detail="Produktname und Seriennummer sind erforderlich")

    if serial_number != current.get("serial_number"):
        duplicate = await db.charge_app_warranties.find_one({
            "user_id": user_id,
            "serial_number": serial_number,
            "registration_id": {"$ne": registration_id},
        })
        if duplicate:
            raise HTTPException(status_code=409, detail="Diese Seriennummer ist bereits registriert")

    updates["updated_at"] = _now_iso()
    await db.charge_app_warranties.update_one(
        {"user_id": user_id, "registration_id": registration_id},
        {"$set": updates},
    )
    updated = {**current, **updates}
    return {"ok": True, "warranty": _warranty_card(updated)}


@router.delete("/warranty/{registration_id}")
async def delete_charge_warranty(registration_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    _delete_document_blobs(warranty)
    result = await db.charge_app_warranties.delete_one({
        "user_id": user_id,
        "registration_id": registration_id,
    })
    if result.deleted_count != 1:
        raise HTTPException(status_code=409, detail="Garantie konnte nicht gelöscht werden")
    return {"ok": True, "registration_id": registration_id}


@router.put("/invoices/{invoice_id}")
async def update_charge_invoice(
    invoice_id: str,
    req: ChargeInvoiceUpdateRequest,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    current = await _find_user_invoice(user_id, invoice_id)
    updates = req.dict(exclude_unset=True)

    for key in ("invoice_number", "merchant_name", "purchase_date", "product_name", "serial_number"):
        if key in updates:
            updates[key] = _clean_optional_text(updates[key])
    if "amount" in updates:
        updates["amount"] = _safe_float(updates["amount"])

    invoice_number = updates.get("invoice_number", current.get("invoice_number", ""))
    merchant_name = updates.get("merchant_name", current.get("merchant_name", ""))
    if not invoice_number or not merchant_name:
        raise HTTPException(status_code=400, detail="Rechnungsnummer und Händlername sind erforderlich")

    if invoice_number != current.get("invoice_number"):
        duplicate = await db.charge_app_invoices.find_one({
            "user_id": user_id,
            "invoice_number": invoice_number,
            "invoice_id": {"$ne": invoice_id},
        })
        if duplicate:
            raise HTTPException(status_code=409, detail="Diese Rechnungsnummer ist bereits gespeichert")

    updates["updated_at"] = _now_iso()
    await db.charge_app_invoices.update_one(
        {"user_id": user_id, "invoice_id": invoice_id},
        {"$set": updates},
    )
    updated = {**current, **updates}
    return {"ok": True, "invoice": _invoice_card(updated)}


@router.delete("/invoices/{invoice_id}")
async def delete_charge_invoice(invoice_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    invoice = await _find_user_invoice(user_id, invoice_id)
    _delete_document_blobs(invoice)
    result = await db.charge_app_invoices.delete_one({
        "user_id": user_id,
        "invoice_id": invoice_id,
    })
    if result.deleted_count != 1:
        raise HTTPException(status_code=409, detail="Rechnung konnte nicht gelöscht werden")
    return {"ok": True, "invoice_id": invoice_id}


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


@router.delete("/warranty/{registration_id}/attachments/{attachment_id}")
async def delete_warranty_attachment(
    registration_id: str,
    attachment_id: str,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    attachment = next(
        (item for item in (warranty.get("attachments") or []) if item.get("attachment_id") == attachment_id),
        None,
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    _delete_attachment_blob(attachment)
    await db.charge_app_warranties.update_one(
        {"user_id": user_id, "registration_id": registration_id},
        {"$pull": {"attachments": {"attachment_id": attachment_id}}, "$set": {"updated_at": _now_iso()}},
    )
    remaining = [
        item for item in (warranty.get("attachments") or [])
        if item.get("attachment_id") != attachment_id
    ]
    return {
        "ok": True,
        "attachment_id": attachment_id,
        "warranty": _warranty_card({**warranty, "attachments": remaining, "updated_at": _now_iso()}),
    }


@router.delete("/invoices/{invoice_id}/attachments/{attachment_id}")
async def delete_invoice_attachment(
    invoice_id: str,
    attachment_id: str,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    invoice = await _find_user_invoice(user_id, invoice_id)
    attachment = next(
        (item for item in (invoice.get("attachments") or []) if item.get("attachment_id") == attachment_id),
        None,
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    _delete_attachment_blob(attachment)
    await db.charge_app_invoices.update_one(
        {"user_id": user_id, "invoice_id": invoice_id},
        {"$pull": {"attachments": {"attachment_id": attachment_id}}, "$set": {"updated_at": _now_iso()}},
    )
    remaining = [
        item for item in (invoice.get("attachments") or [])
        if item.get("attachment_id") != attachment_id
    ]
    return {
        "ok": True,
        "attachment_id": attachment_id,
        "invoice": _invoice_card({**invoice, "attachments": remaining, "updated_at": _now_iso()}),
    }


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
async def get_charge_merchant_detail(slug: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
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
    user_warranties = await db.charge_app_warranties.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    user_invoices = await db.charge_app_invoices.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    related_warranties = [_warranty_card(item) for item in user_warranties if _matches_merchant_context(item.get("merchant_name"), merchant_payload, slug)][:4]
    related_invoices = [_invoice_card(item) for item in user_invoices if _matches_merchant_context(item.get("merchant_name"), merchant_payload, slug)][:4]
    return {
        "merchant": merchant_payload,
        "products": products,
        "promotions": [{"title": item.get("name"), "description": item.get("description"), "offer_type": item.get("type"), "value": item.get("value")} for item in promotions],
        "vouchers": vouchers,
        "customer_context": {
            "warranty_count": len(related_warranties),
            "invoice_count": len(related_invoices),
            "warranties": related_warranties,
            "invoices": related_invoices,
        },
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


@router.get("/admin/catalog")
async def admin_charge_catalog(request: Request, q: Optional[str] = None, limit: int = 300):
    await _require_admin(request)
    safe_limit = min(max(int(limit or 300), 1), 500)
    query: Dict[str, Any] = {"active": True}
    if q and q.strip():
        needle = q.strip()
        query["$or"] = [
            {"name": {"$regex": needle, "$options": "i"}},
            {"brand": {"$regex": needle, "$options": "i"}},
            {"category": {"$regex": needle, "$options": "i"}},
            {"sku": {"$regex": needle, "$options": "i"}},
            {"barcode": needle},
        ]

    products = await db.pos_products.find(query, {"_id": 0}).sort("updated_at", -1).limit(1000).to_list(1000)
    products = [item for item in products if _charge_catalog_categories(item)]

    product_ids = [str(item.get("product_id")) for item in products if item.get("product_id")]
    overrides = await db.charge_catalog_overrides.find(
        {"product_id": {"$in": product_ids}},
        {"_id": 0},
    ).to_list(1000) if product_ids else []
    override_by_product = {str(item.get("product_id")): item for item in overrides}

    merchant_ids = list({str(item.get("merchant_id")) for item in products if item.get("merchant_id")})
    merchants = await db.merchants.find(
        {"merchant_id": {"$in": merchant_ids}},
        {"_id": 0},
    ).to_list(1000) if merchant_ids else []
    merchant_by_id = {str(item.get("merchant_id")): item for item in merchants}

    rows = []
    for product in products[:safe_limit]:
        merchant = merchant_by_id.get(str(product.get("merchant_id"))) or {}
        override = override_by_product.get(str(product.get("product_id"))) or {}
        rows.append({
            "product_id": product.get("product_id"),
            "name": product.get("name") or "",
            "brand": product.get("brand") or "",
            "price": _safe_float(product.get("price")),
            "stock": _safe_float(product.get("stock")),
            "category": product.get("category") or "",
            "inferred_categories": _charge_catalog_categories(product),
            "merchant_id": product.get("merchant_id") or "",
            "merchant_name": merchant.get("business_name") or "BidBlitz Händler",
            "image_url": product.get("image_url") or "",
            "visible": bool(override.get("visible", True)),
            "featured": bool(override.get("featured", False)),
            "charge_category": override.get("charge_category") or "",
            "sort_order": int(override.get("sort_order") or 100),
            "override_updated_at": override.get("updated_at") or "",
        })

    rows.sort(key=lambda item: (
        0 if item.get("featured") else 1,
        int(item.get("sort_order") or 100),
        str(item.get("name") or "").lower(),
    ))
    return {
        "ok": True,
        "products": rows,
        "summary": {
            "total": len(rows),
            "visible": sum(1 for item in rows if item.get("visible")),
            "hidden": sum(1 for item in rows if not item.get("visible")),
            "featured": sum(1 for item in rows if item.get("featured")),
        },
    }


@router.put("/admin/catalog/{product_id}")
async def admin_update_charge_catalog_product(
    product_id: str,
    req: ChargeCatalogOverrideRequest,
    request: Request,
):
    admin = await _require_admin(request)
    product = await db.pos_products.find_one({"product_id": product_id, "active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    if not _charge_catalog_categories(product) and not req.charge_category.strip():
        raise HTTPException(status_code=400, detail="Produkt ist kein Charge-Produkt; Charge-Kategorie erforderlich")

    now = _now_iso()
    update = {
        "product_id": product_id,
        "visible": bool(req.visible),
        "featured": bool(req.featured),
        "charge_category": req.charge_category.strip().lower(),
        "sort_order": int(req.sort_order),
        "updated_at": now,
        "updated_by": admin.get("email") or admin.get("user_id") or "admin",
    }
    await db.charge_catalog_overrides.update_one(
        {"product_id": product_id},
        {"$set": update, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True, "override": update}


@router.delete("/admin/catalog/{product_id}")
async def admin_reset_charge_catalog_product(product_id: str, request: Request):
    await _require_admin(request)
    await db.charge_catalog_overrides.delete_one({"product_id": product_id})
    return {"ok": True, "product_id": product_id, "reset": True}


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
