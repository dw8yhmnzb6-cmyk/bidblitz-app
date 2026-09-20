from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid
import json
import hashlib
import hmac
import re
import secrets
from io import BytesIO
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.database import db
from core.config import FRONTEND_URL, JWT_SECRET
from core.security import get_current_user
from routes.loyalty_system import get_loyalty_status as _get_loyalty_status
from routes.loyalty_system import get_loyalty_stats as _get_loyalty_stats
from routes.loyalty_system import get_reward_history as _get_loyalty_history
from services.charge_storage import (
    upload_bytes as _storage_upload_bytes,
    get_bytes as _storage_get_bytes,
    delete_bytes as _storage_delete_bytes,
)
from services.charge_notifications import safe_create_charge_notification


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
    product_id: str = ""
    purchase_date: str = ""
    merchant_name: str = ""
    invoice_id: str = ""
    invoice_number: str = ""
    source_sale_id: str = ""
    source_receipt_id: str = ""
    warranty_months: int = Field(default=24, ge=1, le=120)


class ChargeInvoiceSaveRequest(BaseModel):
    invoice_number: str
    merchant_name: str
    amount: float = 0
    purchase_date: str = ""
    product_name: str = ""
    serial_number: str = ""


class ChargeWarrantyUpdateRequest(BaseModel):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    merchant_name: Optional[str] = None
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    warranty_months: Optional[int] = Field(default=None, ge=1, le=120)


class ChargeInvoiceUpdateRequest(BaseModel):
    invoice_number: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: Optional[float] = None
    purchase_date: Optional[str] = None
    product_name: Optional[str] = None
    serial_number: Optional[str] = None


class ChargeWarrantyTransferRequest(BaseModel):
    recipient_email: str


class ChargeWarrantyClaimRequest(BaseModel):
    issue_type: str = "defect"
    subject: str
    description: str
    preferred_resolution: str = "repair"


class ChargeClaimMessageRequest(BaseModel):
    message: str


class ChargeClaimStatusRequest(BaseModel):
    status: str
    note: str = ""


class ChargeCatalogOverrideRequest(BaseModel):
    visible: bool = True
    featured: bool = False
    charge_category: str = ""
    sort_order: int = Field(default=100, ge=0, le=10000)
    manual_url: str = ""
    support_url: str = ""


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


def _safe_http_url(value: Any) -> str:
    url = str(value or "").strip()
    if not url:
        return ""
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültige URL")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Nur gültige HTTP/HTTPS-URLs sind erlaubt")
    return url[:1000]


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


def _warranty_signature(registration_id: str, serial_number: str, valid_until: str) -> str:
    payload = f"{registration_id}|{serial_number}|{valid_until}".encode("utf-8")
    key = hmac.new(
        JWT_SECRET.encode("utf-8"),
        b"bidblitz-charge-warranty-pass",
        hashlib.sha256,
    ).digest()
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def _warranty_verify_url(registration_id: str, signature: str) -> str:
    base = (FRONTEND_URL or "").rstrip("/")
    path = f"/charge-app/warranty-verify?registration_id={registration_id}&sig={signature}"
    return f"{base}{path}" if base else path


def _warranty_evidence(doc: Dict[str, Any]) -> Dict[str, str]:
    has_product = bool(str(doc.get("product_id") or "").strip())
    has_invoice = bool(str(doc.get("invoice_id") or "").strip())
    if has_product and has_invoice:
        return {
            "level": "catalog_and_invoice",
            "label": "Charge-Produkt + Rechnung verknüpft",
            "description": "Produktdatensatz und private Kaufrechnung sind mit dieser Garantie verknüpft.",
        }
    if has_invoice:
        return {
            "level": "invoice_linked",
            "label": "Charge-Rechnung verknüpft",
            "description": "Eine private Kaufrechnung ist mit dieser Garantie verknüpft.",
        }
    if has_product:
        return {
            "level": "catalog_linked",
            "label": "Charge-Produkt verknüpft",
            "description": "Die Garantie ist mit einem Produkt aus dem BidBlitz-Charge-Katalog verknüpft.",
        }
    return {
        "level": "manual",
        "label": "Manuell erfasst",
        "description": "Die Garantie wurde manuell erfasst; es ist kein Kaufbeleg oder Katalogprodukt verknüpft.",
    }


def _warranty_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    months, valid_until_dt, effective_status = _warranty_terms(doc)
    evidence = _warranty_evidence(doc)
    purchase_dt = _parse_iso(doc.get("purchase_date")) or _parse_iso(doc.get("created_at")) or datetime.now(timezone.utc)
    valid_until = valid_until_dt.date().isoformat()
    warranty_pass = _build_warranty_pass(doc)
    return {
        "registration_id": doc.get("registration_id"),
        "product_id": doc.get("product_id") or "",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": doc.get("serial_number") or "—",
        "purchase_date": doc.get("purchase_date") or purchase_dt.date().isoformat(),
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "merchant_id": doc.get("merchant_id") or "",
        "merchant_user_id": doc.get("merchant_user_id") or "",
        "merchant_slug": doc.get("merchant_slug") or "",
        "invoice_number": doc.get("invoice_number") or "—",
        "status": effective_status,
        "warranty_months": months,
        "valid_until": valid_until,
        "coverage_label": f"{months} Monate Charge Care",
        "evidence_level": evidence["level"],
        "evidence_label": evidence["label"],
        "evidence_description": evidence["description"],
        "support_hint": "Digitale Garantie gespeichert – bei Bedarf direkt im Händlernetz abrufbar.",
        "created_at": doc.get("created_at") or _now_iso(),
        "attachments": [_attachment_meta(item, f"/api/charge-app/warranty/{doc.get('registration_id')}/attachments") for item in (doc.get("attachments") or [])],
        "warranty_pass": warranty_pass,
    }


def _build_warranty_pass(doc: Dict[str, Any]) -> Dict[str, Any]:
    months, valid_until_dt, effective_status = _warranty_terms(doc)
    evidence = _warranty_evidence(doc)
    valid_until = valid_until_dt.date().isoformat()
    registration_id = str(doc.get("registration_id") or "")
    serial_number = str(doc.get("serial_number") or "")
    signature = _warranty_signature(registration_id, serial_number, valid_until)
    qr_payload = _warranty_verify_url(registration_id, signature)
    return {
        "pass_id": f"BB-CHARGE-{str(doc.get('registration_id') or '')[-6:]}",
        "registration_id": doc.get("registration_id"),
        "serial_number": doc.get("serial_number") or "—",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "coverage_label": f"{months} Monate Charge Care",
        "warranty_months": months,
        "status_label": "Aktiv" if effective_status == "active" else ("Abgelaufen" if effective_status == "expired" else effective_status.title()),
        "evidence_level": evidence["level"],
        "evidence_label": evidence["label"],
        "valid_until": valid_until,
        "qr_payload": qr_payload,
        "verification_signature": signature,
        "verification_path": f"/api/charge-app/warranty/verify/{registration_id}",
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
        "merchant_id": doc.get("merchant_id") or "",
        "merchant_user_id": doc.get("merchant_user_id") or "",
        "merchant_slug": doc.get("merchant_slug") or "",
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


def _serial_key(value: Any) -> str:
    return "".join(str(value or "").strip().upper().split())


async def _find_conflicting_active_warranty(
    *,
    user_id: str,
    registration_id: str = "",
    product_id: str = "",
    product_name: str = "",
    serial_number: str,
) -> Optional[Dict[str, Any]]:
    key = _serial_key(serial_number)
    if not key:
        return None

    identity: Dict[str, Any]
    if product_id:
        identity = {"product_id": product_id}
    else:
        name = str(product_name or "").strip()
        identity = {"product_name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}

    query: Dict[str, Any] = {
        **identity,
        "$or": [
            {"serial_key": key},
            {"serial_number": {"$regex": f"^{re.escape(str(serial_number or '').strip())}$", "$options": "i"}},
        ],
    }
    if registration_id:
        query["registration_id"] = {"$ne": registration_id}

    candidates = await db.charge_app_warranties.find(query, {"_id": 0}).limit(20).to_list(20)
    for candidate in candidates:
        if str(candidate.get("user_id") or "") == user_id and registration_id and candidate.get("registration_id") == registration_id:
            continue
        if _warranty_card(candidate).get("status") == "active":
            return candidate
    return None


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


async def _resolve_charge_product(product_id: Any) -> tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    value = str(product_id or "").strip()
    if not value:
        return None, {}
    product = await db.pos_products.find_one(
        {"product_id": value, "active": True},
        {"_id": 0},
    )
    if not product or not _charge_catalog_categories(product):
        raise HTTPException(status_code=404, detail="Charge-Produkt nicht gefunden")

    merchant: Dict[str, Any] = {}
    profile: Dict[str, Any] = {}
    if product.get("merchant_id"):
        merchant = await db.merchants.find_one(
            {"merchant_id": product.get("merchant_id")},
            {"_id": 0},
        ) or {}
    if merchant.get("user_id"):
        profile = await db.merchant_profiles.find_one(
            {"user_id": merchant.get("user_id")},
            {"_id": 0},
        ) or {}
    binding = {
        "merchant_id": merchant.get("merchant_id") or product.get("merchant_id") or "",
        "merchant_user_id": str(merchant.get("user_id") or profile.get("user_id") or ""),
        "merchant_slug": merchant.get("public_slug") or profile.get("public_slug") or "",
        "merchant_name": merchant.get("business_name") or profile.get("business_name") or "BidBlitz Charge Händler",
    }
    return product, binding


async def _resolve_charge_merchant(merchant_name: Any) -> Dict[str, Any]:
    """Best-effort exact merchant binding for Charge after-sales flows."""
    name = str(merchant_name or "").strip()
    if not name:
        return {}
    escaped = re.escape(name)
    merchant = await db.merchants.find_one(
        {"business_name": {"$regex": f"^{escaped}$", "$options": "i"}},
        {"_id": 0},
    )
    profile = None
    if not merchant:
        profile = await db.merchant_profiles.find_one(
            {"business_name": {"$regex": f"^{escaped}$", "$options": "i"}},
            {"_id": 0},
        )
        if profile and profile.get("user_id"):
            merchant = await db.merchants.find_one(
                {"user_id": profile.get("user_id")},
                {"_id": 0},
            ) or {}
    if not merchant and not profile:
        return {}
    merchant = merchant or {}
    profile = profile or (
        await db.merchant_profiles.find_one(
            {"user_id": merchant.get("user_id")},
            {"_id": 0},
        )
        if merchant.get("user_id")
        else {}
    ) or {}
    return {
        "merchant_id": merchant.get("merchant_id") or "",
        "merchant_user_id": str(merchant.get("user_id") or profile.get("user_id") or ""),
        "merchant_slug": merchant.get("public_slug") or profile.get("public_slug") or "",
        "merchant_name": merchant.get("business_name") or profile.get("business_name") or name,
    }


def _transfer_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    status = str(doc.get("status") or "pending")
    expires_at = _parse_iso(doc.get("expires_at"))
    if status == "pending" and expires_at and expires_at < datetime.now(timezone.utc):
        status = "expired"
    return {
        "transfer_id": doc.get("transfer_id"),
        "registration_id": doc.get("registration_id"),
        "product_id": doc.get("product_id") or "",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number_masked": doc.get("serial_number_masked") or "",
        "from_user_id": doc.get("from_user_id") or "",
        "from_email": doc.get("from_email") or "",
        "recipient_email": doc.get("recipient_email") or "",
        "status": status,
        "created_at": doc.get("created_at") or "",
        "expires_at": doc.get("expires_at") or "",
        "accepted_at": doc.get("accepted_at") or "",
        "cancelled_at": doc.get("cancelled_at") or "",
    }


def _normalized_email(value: Any) -> str:
    return str(value or "").strip().lower()


async def _active_warranty_transfer(registration_id: str, owner_user_id: str) -> Optional[Dict[str, Any]]:
    transfer = await db.charge_warranty_transfers.find_one(
        {
            "registration_id": registration_id,
            "from_user_id": owner_user_id,
            "status": "pending",
        },
        {"_id": 0},
    )
    if not transfer:
        return None
    expires_at = _parse_iso(transfer.get("expires_at"))
    if expires_at and expires_at <= datetime.now(timezone.utc):
        await db.charge_warranty_transfers.update_one(
            {"transfer_id": transfer.get("transfer_id"), "status": "pending"},
            {"$set": {"status": "expired", "updated_at": _now_iso()}},
        )
        return None
    return transfer


def _claim_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "claim_id": doc.get("claim_id"),
        "registration_id": doc.get("registration_id"),
        "user_id": doc.get("customer_user_id") or doc.get("user_id"),
        "merchant_user_id": doc.get("user_id") if doc.get("customer_user_id") else doc.get("merchant_user_id"),
        "merchant_id": doc.get("merchant_id") or "",
        "merchant_slug": doc.get("merchant_slug") or "",
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": doc.get("serial_number") or "",
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "issue_type": doc.get("issue_type") or "defect",
        "subject": doc.get("subject") or "Garantiefall",
        "description": doc.get("description") or "",
        "preferred_resolution": doc.get("preferred_resolution") or "repair",
        "status": doc.get("status") or "open",
        "admin_note": doc.get("admin_note") or "",
        "created_at": doc.get("created_at") or "",
        "updated_at": doc.get("updated_at") or doc.get("created_at") or "",
        "resolved_at": doc.get("resolved_at") or "",
        "messages": doc.get("messages") or [],
        "status_history": doc.get("status_history") or [{
            "status": doc.get("status") or "open",
            "actor_role": "system",
            "actor_id": "",
            "note": "",
            "created_at": doc.get("created_at") or "",
        }],
        "attachments": [
            _attachment_meta(item, f"/api/charge-app/claims/{doc.get('claim_id')}/attachments")
            for item in (doc.get("attachments") or [])
        ],
    }


def _validate_claim_status(value: str) -> str:
    normalized = str(value or "").strip().lower()
    allowed = {"open", "in_review", "approved", "rejected", "resolved", "cancelled"}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail="Ungültiger Reklamationsstatus")
    return normalized


def _matches_merchant_context(
    merchant_name: Any,
    merchant_payload: Dict[str, Any],
    slug: str,
    linked_slug: Any = "",
) -> bool:
    direct_slug = str(linked_slug or "").strip().lower()
    if direct_slug and direct_slug == str(slug or "").strip().lower():
        return True
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
        "manual_url": _safe_http_url(override.get("manual_url") or product.get("manual_url") or ""),
        "support_url": _safe_http_url(override.get("support_url") or product.get("support_url") or ""),
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
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    safe_limit = min(max(int(limit or 120), 1), 300)

    query: Dict[str, Any] = {"active": True}
    if q and q.strip():
        needle = q.strip()[:100]
        safe_needle = re.escape(needle)
        query["$or"] = [
            {"name": {"$regex": safe_needle, "$options": "i"}},
            {"brand": {"$regex": safe_needle, "$options": "i"}},
            {"description": {"$regex": safe_needle, "$options": "i"}},
            {"category": {"$regex": safe_needle, "$options": "i"}},
            {"sku": {"$regex": safe_needle, "$options": "i"}},
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

    saved_docs = await db.charge_saved_products.find(
        {"user_id": user_id, "product_id": {"$in": product_ids}},
        {"_id": 0, "product_id": 1},
    ).to_list(1000) if product_ids else []
    saved_ids = {str(item.get("product_id")) for item in saved_docs}

    cards: List[Dict[str, Any]] = []
    requested_category = str(category or "").strip().lower()

    for product in products:
        override = override_by_product.get(str(product.get("product_id"))) or {}
        if override.get("visible") is False:
            continue
        merchant = merchant_by_id.get(str(product.get("merchant_id")))
        profile = profile_by_user.get(str((merchant or {}).get("user_id")))
        card = _charge_product_card(product, merchant, profile, override)
        card["saved"] = str(product.get("product_id")) in saved_ids
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


@router.get("/purchase-candidates")
async def get_charge_purchase_candidates(request: Request, limit: int = 100):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    safe_limit = min(max(int(limit or 100), 1), 300)

    sales = await db.pos_sales.find(
        {"customer_id": user_id, "status": "completed"},
        {"_id": 0},
    ).sort("created_at", -1).limit(safe_limit).to_list(safe_limit)

    if not sales:
        return {"candidates": [], "total": 0}

    product_ids = list({
        str(item.get("product_id"))
        for sale in sales
        for item in (sale.get("items") or [])
        if item.get("product_id")
    })
    products = await db.pos_products.find(
        {"product_id": {"$in": product_ids}, "active": True},
        {"_id": 0},
    ).to_list(1000) if product_ids else []
    product_by_id = {
        str(product.get("product_id")): product
        for product in products
        if _charge_catalog_categories(product)
    }

    sale_ids = [str(sale.get("sale_id")) for sale in sales if sale.get("sale_id")]
    existing_warranties = await db.charge_app_warranties.find(
        {
            "user_id": user_id,
            "source_sale_id": {"$in": sale_ids},
        },
        {"_id": 0, "source_sale_id": 1, "product_id": 1, "registration_id": 1},
    ).to_list(1000) if sale_ids else []
    registered_counts: Dict[str, int] = {}
    for warranty in existing_warranties:
        key = f"{warranty.get('source_sale_id')}:{warranty.get('product_id')}"
        registered_counts[key] = registered_counts.get(key, 0) + 1

    merchant_ids = list({str(sale.get("merchant_id")) for sale in sales if sale.get("merchant_id")})
    merchants = await db.merchants.find(
        {"merchant_id": {"$in": merchant_ids}},
        {"_id": 0},
    ).to_list(500) if merchant_ids else []
    merchant_by_id = {str(item.get("merchant_id")): item for item in merchants}

    pos_merchants = await db.pos_merchants.find(
        {"merchant_id": {"$in": merchant_ids}},
        {"_id": 0},
    ).to_list(500) if merchant_ids else []
    pos_merchant_by_id = {str(item.get("merchant_id")): item for item in pos_merchants}

    candidates: List[Dict[str, Any]] = []
    for sale in sales:
        grouped: Dict[str, Dict[str, Any]] = {}
        for line in sale.get("items") or []:
            product_id = str(line.get("product_id") or "")
            product = product_by_id.get(product_id)
            if not product:
                continue
            row = grouped.setdefault(product_id, {
                "product": product,
                "quantity": 0.0,
                "line_total": 0.0,
                "unit_price": _safe_float(line.get("unit_price") or product.get("price")),
            })
            row["quantity"] += float(line.get("quantity") or 1)
            row["line_total"] += float(line.get("line_total") or 0)

        for product_id, row in grouped.items():
            quantity = max(1, int(round(row["quantity"])))
            registration_key = f"{sale.get('sale_id')}:{product_id}"
            registered = registered_counts.get(registration_key, 0)
            remaining = max(0, quantity - registered)
            if remaining <= 0:
                continue

            merchant_id = str(sale.get("merchant_id") or "")
            merchant = merchant_by_id.get(merchant_id) or {}
            pos_merchant = pos_merchant_by_id.get(merchant_id) or {}
            product = row["product"]
            candidates.append({
                "candidate_id": f"{sale.get('sale_id')}:{product_id}",
                "sale_id": sale.get("sale_id"),
                "receipt_id": sale.get("receipt_id"),
                "product_id": product_id,
                "product_name": product.get("name") or "BidBlitz Charge Produkt",
                "brand": product.get("brand") or "BidBlitz Charge",
                "image_url": product.get("image_url") or "",
                "merchant_id": merchant_id,
                "merchant_name": (
                    merchant.get("business_name")
                    or pos_merchant.get("business_name")
                    or pos_merchant.get("name")
                    or "BidBlitz Charge Händler"
                ),
                "purchase_date": sale.get("created_at") or "",
                "unit_price": round(float(row["unit_price"] or 0), 2),
                "line_total": round(float(row["line_total"] or 0), 2),
                "quantity": quantity,
                "registered_quantity": registered,
                "remaining_quantity": remaining,
                "warranty_months": int(product.get("warranty_months") or 24),
            })

    return {
        "candidates": candidates[:safe_limit],
        "total": min(len(candidates), safe_limit),
    }


@router.get("/product-lookup")@router.get("/product-lookup")
async def lookup_charge_product(code: str, request: Request):
    await get_current_user(request)
    value = str(code or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Produktcode fehlt")

    product = await db.pos_products.find_one(
        {
            "active": True,
            "$or": [
                {"barcode": value},
                {"qr_code": value},
                {"sku": value},
                {"product_id": value},
            ],
        },
        {"_id": 0},
    )
    if not product or not _charge_catalog_categories(product):
        raise HTTPException(status_code=404, detail="Charge-Produktcode nicht gefunden")

    override = await db.charge_catalog_overrides.find_one(
        {"product_id": product.get("product_id")},
        {"_id": 0},
    ) or {}
    if override.get("visible") is False:
        raise HTTPException(status_code=404, detail="Charge-Produktcode nicht gefunden")

    resolved, merchant_binding = await _resolve_charge_product(product.get("product_id"))
    merchant = {}
    profile = {}
    if merchant_binding.get("merchant_id"):
        merchant = await db.merchants.find_one(
            {"merchant_id": merchant_binding.get("merchant_id")},
            {"_id": 0},
        ) or {}
    if merchant_binding.get("merchant_user_id"):
        profile = await db.merchant_profiles.find_one(
            {"user_id": merchant_binding.get("merchant_user_id")},
            {"_id": 0},
        ) or {}

    card = _charge_product_card(resolved or product, merchant, profile, override)
    return {
        "ok": True,
        "product": card,
        "warranty_prefill": {
            "product_id": card.get("product_id"),
            "product_name": card.get("name"),
            "merchant_name": merchant_binding.get("merchant_name") or card.get("merchant_name"),
            "warranty_months": int((resolved or product).get("warranty_months") or 24),
        },
    }


@router.get("/catalog/{product_id}")
async def get_charge_catalog_product(product_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))

    product = await db.pos_products.find_one(
        {"product_id": product_id, "active": True},
        {"_id": 0},
    )
    if not product or not _charge_catalog_categories(product):
        raise HTTPException(status_code=404, detail="Charge-Produkt nicht gefunden")

    override = await db.charge_catalog_overrides.find_one(
        {"product_id": product_id},
        {"_id": 0},
    ) or {}
    if override.get("visible") is False:
        raise HTTPException(status_code=404, detail="Charge-Produkt nicht gefunden")

    merchant = None
    profile = None
    if product.get("merchant_id"):
        merchant = await db.merchants.find_one(
            {"merchant_id": product.get("merchant_id")},
            {"_id": 0},
        )
    if merchant and merchant.get("user_id"):
        profile = await db.merchant_profiles.find_one(
            {"user_id": merchant.get("user_id")},
            {"_id": 0},
        )

    card = _charge_product_card(product, merchant, profile, override)
    card["saved"] = bool(await db.charge_saved_products.find_one({
        "user_id": user_id,
        "product_id": product_id,
    }))
    categories = card.get("charge_categories") or []

    related_query: Dict[str, Any] = {
        "active": True,
        "product_id": {"$ne": product_id},
    }
    related_candidates = await db.pos_products.find(
        related_query,
        {"_id": 0},
    ).sort("updated_at", -1).limit(120).to_list(120)

    related_ids = [str(item.get("product_id")) for item in related_candidates if item.get("product_id")]
    related_overrides = await db.charge_catalog_overrides.find(
        {"product_id": {"$in": related_ids}},
        {"_id": 0},
    ).to_list(200) if related_ids else []
    related_override_by_id = {str(item.get("product_id")): item for item in related_overrides}

    related_merchant_ids = list({
        str(item.get("merchant_id"))
        for item in related_candidates
        if item.get("merchant_id")
    })
    related_merchants = await db.merchants.find(
        {"merchant_id": {"$in": related_merchant_ids}},
        {"_id": 0},
    ).to_list(200) if related_merchant_ids else []
    related_merchant_by_id = {str(item.get("merchant_id")): item for item in related_merchants}

    related_user_ids = list({
        str(item.get("user_id"))
        for item in related_merchants
        if item.get("user_id")
    })
    related_profiles = await db.merchant_profiles.find(
        {"user_id": {"$in": related_user_ids}},
        {"_id": 0},
    ).to_list(200) if related_user_ids else []
    related_profile_by_user = {str(item.get("user_id")): item for item in related_profiles}

    related_cards: List[Dict[str, Any]] = []
    wanted = {str(item).lower() for item in categories}
    for candidate in related_candidates:
        candidate_categories = _charge_catalog_categories(candidate)
        if not candidate_categories:
            continue
        candidate_override = related_override_by_id.get(str(candidate.get("product_id"))) or {}
        if candidate_override.get("visible") is False:
            continue
        if wanted and not wanted.intersection({str(item).lower() for item in candidate_categories}):
            continue
        rel_merchant = related_merchant_by_id.get(str(candidate.get("merchant_id")))
        rel_profile = related_profile_by_user.get(str((rel_merchant or {}).get("user_id")))
        related_cards.append(_charge_product_card(candidate, rel_merchant, rel_profile, candidate_override))
        if len(related_cards) >= 6:
            break

    merchant_payload = {
        "business_name": (merchant or {}).get("business_name") or card.get("merchant_name"),
        "public_slug": (merchant or {}).get("public_slug") or (profile or {}).get("public_slug") or card.get("merchant_slug"),
        "address": (merchant or {}).get("address") or (profile or {}).get("address") or "",
        "city": (profile or {}).get("city") or (merchant or {}).get("city") or card.get("city") or "",
        "phone": (merchant or {}).get("phone") or (profile or {}).get("phone") or "",
        "email": (merchant or {}).get("email") or (profile or {}).get("email") or "",
        "website": (profile or {}).get("website") or "",
        "logo_url": (profile or {}).get("logo_url") or "",
    }

    return {
        "product": card,
        "merchant": merchant_payload,
        "related_products": related_cards,
    }


@router.get("/saved-products")
async def get_saved_charge_products(request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    saved = await db.charge_saved_products.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).limit(300).to_list(300)
    ids = [str(item.get("product_id")) for item in saved if item.get("product_id")]
    if not ids:
        return {"products": [], "total": 0}

    products = await db.pos_products.find(
        {"product_id": {"$in": ids}, "active": True},
        {"_id": 0},
    ).to_list(300)
    product_by_id = {str(item.get("product_id")): item for item in products}

    overrides = await db.charge_catalog_overrides.find(
        {"product_id": {"$in": ids}},
        {"_id": 0},
    ).to_list(300)
    override_by_id = {str(item.get("product_id")): item for item in overrides}

    merchant_ids = list({
        str(item.get("merchant_id"))
        for item in products
        if item.get("merchant_id")
    })
    merchants = await db.merchants.find(
        {"merchant_id": {"$in": merchant_ids}},
        {"_id": 0},
    ).to_list(300) if merchant_ids else []
    merchant_by_id = {str(item.get("merchant_id")): item for item in merchants}

    user_ids = list({
        str(item.get("user_id"))
        for item in merchants
        if item.get("user_id")
    })
    profiles = await db.merchant_profiles.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0},
    ).to_list(300) if user_ids else []
    profile_by_user = {str(item.get("user_id")): item for item in profiles}

    cards = []
    for product_id in ids:
        product = product_by_id.get(product_id)
        if not product or not _charge_catalog_categories(product):
            continue
        override = override_by_id.get(product_id) or {}
        if override.get("visible") is False:
            continue
        merchant = merchant_by_id.get(str(product.get("merchant_id")))
        profile = profile_by_user.get(str((merchant or {}).get("user_id")))
        card = _charge_product_card(product, merchant, profile, override)
        card["saved"] = True
        cards.append(card)
    return {"products": cards, "total": len(cards)}


@router.put("/saved-products/{product_id}")
async def save_charge_product(product_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    product = await db.pos_products.find_one(
        {"product_id": product_id, "active": True},
        {"_id": 0},
    )
    if not product or not _charge_catalog_categories(product):
        raise HTTPException(status_code=404, detail="Charge-Produkt nicht gefunden")
    override = await db.charge_catalog_overrides.find_one({"product_id": product_id}, {"_id": 0})
    if override and override.get("visible") is False:
        raise HTTPException(status_code=404, detail="Charge-Produkt nicht gefunden")

    now = _now_iso()
    await db.charge_saved_products.update_one(
        {"user_id": user_id, "product_id": product_id},
        {"$setOnInsert": {
            "user_id": user_id,
            "product_id": product_id,
            "created_at": now,
        }},
        upsert=True,
    )
    return {"ok": True, "product_id": product_id, "saved": True}


@router.delete("/saved-products/{product_id}")
async def unsave_charge_product(product_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    await db.charge_saved_products.delete_one({
        "user_id": user_id,
        "product_id": product_id,
    })
    return {"ok": True, "product_id": product_id, "saved": False}


@router.get("/dashboard")
async def get_charge_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    saved_products_total = await db.charge_saved_products.count_documents({"user_id": user_id})

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
            "saved_products_total": saved_products_total,
            "claims_total": await db.merchant_warranty_claims.count_documents({"customer_user_id": user_id}),
            "claims_open": await db.merchant_warranty_claims.count_documents({"customer_user_id": user_id, "status": {"$in": ["open", "in_review", "approved"]}}),
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

    linked_invoice = None
    if req.invoice_id.strip():
        linked_invoice = await _find_user_invoice(user_id, req.invoice_id.strip())

    source_sale = None
    if req.source_sale_id.strip():
        source_sale = await db.pos_sales.find_one(
            {
                "sale_id": req.source_sale_id.strip(),
                "customer_id": user_id,
                "status": "completed",
            },
            {"_id": 0},
        )
        if not source_sale:
            raise HTTPException(status_code=404, detail="Zugehöriger BidBlitz-Kauf wurde nicht gefunden")
        if req.source_receipt_id.strip() and str(source_sale.get("receipt_id") or "") != req.source_receipt_id.strip():
            raise HTTPException(status_code=409, detail="Kaufbeleg passt nicht zum BidBlitz-Verkauf")
        if req.product_id.strip() and not any(
            str(item.get("product_id") or "") == req.product_id.strip()
            for item in (source_sale.get("items") or [])
        ):
            raise HTTPException(status_code=409, detail="Produkt gehört nicht zu diesem BidBlitz-Kauf")

    product = None
    merchant_binding: Dict[str, Any] = {}
    if linked_invoice:
        merchant_binding = {
            "merchant_id": linked_invoice.get("merchant_id") or "",
            "merchant_user_id": linked_invoice.get("merchant_user_id") or "",
            "merchant_slug": linked_invoice.get("merchant_slug") or "",
            "merchant_name": linked_invoice.get("merchant_name") or req.merchant_name.strip(),
        }
    if source_sale and source_sale.get("merchant_id"):
        sale_merchant = await db.merchants.find_one(
            {"merchant_id": source_sale.get("merchant_id")},
            {"_id": 0},
        ) or {}
        sale_pos_merchant = await db.pos_merchants.find_one(
            {"merchant_id": source_sale.get("merchant_id")},
            {"_id": 0},
        ) or {}
        owner_user_id = str(
            sale_merchant.get("user_id")
            or sale_pos_merchant.get("owner_id")
            or ""
        )
        sale_profile = await db.merchant_profiles.find_one(
            {"user_id": owner_user_id},
            {"_id": 0},
        ) if owner_user_id else {}
        merchant_binding = {
            "merchant_id": str(source_sale.get("merchant_id") or ""),
            "merchant_user_id": owner_user_id,
            "merchant_slug": sale_merchant.get("public_slug") or (sale_profile or {}).get("public_slug") or "",
            "merchant_name": (
                sale_merchant.get("business_name")
                or sale_pos_merchant.get("business_name")
                or sale_pos_merchant.get("name")
                or req.merchant_name.strip()
            ),
        }
    if req.product_id.strip():
        product, merchant_binding = await _resolve_charge_product(req.product_id)
    if not merchant_binding:
        merchant_binding = await _resolve_charge_merchant(req.merchant_name)
    canonical_product_name = (product or {}).get("name") or req.product_name.strip()
    canonical_product_id = (product or {}).get("product_id") or req.product_id.strip()
    conflict = await _find_conflicting_active_warranty(
        user_id=user_id,
        product_id=canonical_product_id,
        product_name=canonical_product_name,
        serial_number=serial,
    )
    if conflict:
        if str(conflict.get("user_id") or "") == user_id:
            return {"ok": True, "warranty": _warranty_card(conflict), "duplicate": True}
        raise HTTPException(
            status_code=409,
            detail="Diese Seriennummer ist für dieses Charge-Produkt bereits auf einem anderen Konto aktiv registriert.",
        )
    doc = {
        "registration_id": f"CHG-WAR-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "product_id": canonical_product_id,
        "product_name": canonical_product_name or (linked_invoice or {}).get("product_name") or "",
        "serial_number": serial,
        "serial_key": _serial_key(serial),
        "purchase_date": (
            req.purchase_date.strip()
            or (linked_invoice or {}).get("purchase_date")
            or str((source_sale or {}).get("created_at") or "")
        ),
        "merchant_name": merchant_binding.get("merchant_name") or req.merchant_name.strip(),
        "merchant_id": merchant_binding.get("merchant_id") or "",
        "merchant_user_id": merchant_binding.get("merchant_user_id") or "",
        "merchant_slug": merchant_binding.get("merchant_slug") or "",
        "invoice_id": (linked_invoice or {}).get("invoice_id") or req.invoice_id.strip(),
        "invoice_number": (
            (linked_invoice or {}).get("invoice_number")
            or req.invoice_number.strip()
            or str((source_sale or {}).get("receipt_id") or "")
        ),
        "source_sale_id": str((source_sale or {}).get("sale_id") or req.source_sale_id.strip()),
        "source_receipt_id": str((source_sale or {}).get("receipt_id") or req.source_receipt_id.strip()),
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

    merchant_binding = await _resolve_charge_merchant(req.merchant_name)
    doc = {
        "invoice_id": f"CHG-INV-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "invoice_number": req.invoice_number.strip(),
        "merchant_name": merchant_binding.get("merchant_name") or req.merchant_name.strip(),
        "merchant_id": merchant_binding.get("merchant_id") or "",
        "merchant_user_id": merchant_binding.get("merchant_user_id") or "",
        "merchant_slug": merchant_binding.get("merchant_slug") or "",
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
    pending_transfer = await _active_warranty_transfer(registration_id, user_id)
    if pending_transfer:
        raise HTTPException(
            status_code=409,
            detail=f"Garantie kann während der offenen Übertragung {pending_transfer.get('transfer_id')} nicht bearbeitet werden.",
        )
    updates = req.dict(exclude_unset=True)

    for key in ("product_id", "product_name", "serial_number", "purchase_date", "merchant_name", "invoice_id", "invoice_number"):
        if key in updates:
            updates[key] = _clean_optional_text(updates[key])

    if "invoice_id" in updates and updates.get("invoice_id"):
        linked_invoice = await _find_user_invoice(user_id, updates.get("invoice_id"))
        updates["invoice_id"] = linked_invoice.get("invoice_id") or updates.get("invoice_id")
        updates["invoice_number"] = linked_invoice.get("invoice_number") or updates.get("invoice_number") or ""
        if not updates.get("purchase_date"):
            updates["purchase_date"] = linked_invoice.get("purchase_date") or current.get("purchase_date") or ""
        if not updates.get("product_name"):
            updates["product_name"] = linked_invoice.get("product_name") or current.get("product_name") or ""
        updates["merchant_name"] = linked_invoice.get("merchant_name") or updates.get("merchant_name") or current.get("merchant_name") or ""
        updates["merchant_id"] = linked_invoice.get("merchant_id") or ""
        updates["merchant_user_id"] = linked_invoice.get("merchant_user_id") or ""
        updates["merchant_slug"] = linked_invoice.get("merchant_slug") or ""

    if "product_id" in updates and updates.get("product_id"):
        product, merchant_binding = await _resolve_charge_product(updates.get("product_id"))
        updates["product_id"] = product.get("product_id") or updates.get("product_id")
        updates["product_name"] = product.get("name") or updates.get("product_name") or current.get("product_name") or ""
        updates["merchant_name"] = merchant_binding.get("merchant_name") or updates.get("merchant_name") or current.get("merchant_name") or ""
        updates["merchant_id"] = merchant_binding.get("merchant_id") or ""
        updates["merchant_user_id"] = merchant_binding.get("merchant_user_id") or ""
        updates["merchant_slug"] = merchant_binding.get("merchant_slug") or ""

    if "merchant_name" in updates and not updates.get("product_id") and not updates.get("invoice_id"):
        merchant_binding = await _resolve_charge_merchant(updates.get("merchant_name"))
        updates["merchant_name"] = merchant_binding.get("merchant_name") or updates.get("merchant_name") or ""
        updates["merchant_id"] = merchant_binding.get("merchant_id") or ""
        updates["merchant_user_id"] = merchant_binding.get("merchant_user_id") or ""
        updates["merchant_slug"] = merchant_binding.get("merchant_slug") or ""

    product_name = updates.get("product_name", current.get("product_name", ""))
    serial_number = updates.get("serial_number", current.get("serial_number", ""))
    if not product_name or not serial_number:
        raise HTTPException(status_code=400, detail="Produktname und Seriennummer sind erforderlich")

    if serial_number != current.get("serial_number") or updates.get("product_id") or updates.get("product_name"):
        conflict = await _find_conflicting_active_warranty(
            user_id=user_id,
            registration_id=registration_id,
            product_id=updates.get("product_id", current.get("product_id", "")),
            product_name=updates.get("product_name", current.get("product_name", "")),
            serial_number=serial_number,
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail="Diese Seriennummer ist für dieses Charge-Produkt bereits aktiv registriert.",
            )
    updates["serial_key"] = _serial_key(serial_number)

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

    pending_transfer = await _active_warranty_transfer(registration_id, user_id)
    if pending_transfer:
        raise HTTPException(
            status_code=409,
            detail=f"Garantie kann während der offenen Übertragung {pending_transfer.get('transfer_id')} nicht gelöscht werden.",
        )

    active_claim = await db.merchant_warranty_claims.find_one(
        {
            "registration_id": registration_id,
            "customer_user_id": user_id,
            "status": {"$in": ["open", "in_review", "approved"]},
        },
        {"_id": 0, "claim_id": 1, "status": 1},
    )
    if active_claim:
        raise HTTPException(
            status_code=409,
            detail=(
                "Garantie kann nicht gelöscht werden, solange ein Charge-Care-Fall aktiv ist "
                f"({active_claim.get('claim_id')})."
            ),
        )

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

    if "merchant_name" in updates:
        merchant_binding = await _resolve_charge_merchant(updates.get("merchant_name"))
        updates["merchant_name"] = merchant_binding.get("merchant_name") or updates.get("merchant_name") or ""
        updates["merchant_id"] = merchant_binding.get("merchant_id") or ""
        updates["merchant_user_id"] = merchant_binding.get("merchant_user_id") or ""
        updates["merchant_slug"] = merchant_binding.get("merchant_slug") or ""

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

    linked_warranty = await db.charge_app_warranties.find_one(
        {"user_id": user_id, "invoice_id": invoice_id},
        {"_id": 0, "registration_id": 1},
    )
    if linked_warranty:
        raise HTTPException(
            status_code=409,
            detail=(
                "Rechnung kann nicht gelöscht werden, solange sie mit einer Charge-Garantie verknüpft ist "
                f"({linked_warranty.get('registration_id')})."
            ),
        )

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


@router.get("/warranty/{registration_id}/service-history")
async def get_charge_warranty_service_history(registration_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)
    card = _warranty_card(warranty)

    events: List[Dict[str, Any]] = [{
        "event_id": f"registration:{registration_id}",
        "event_type": "warranty_registered",
        "status": card.get("status") or "active",
        "title": "Garantie registriert",
        "description": card.get("evidence_label") or "Digitale Charge-Garantie",
        "actor_role": "customer",
        "created_at": warranty.get("created_at") or "",
        "claim_id": "",
    }]

    for transfer in warranty.get("transfer_history") or []:
        events.append({
            "event_id": f"transfer:{transfer.get('transfer_id')}",
            "event_type": "ownership_transfer",
            "status": "completed",
            "title": "Garantie übertragen",
            "description": "Besitzerwechsel der digitalen Charge-Garantie",
            "actor_role": "system",
            "created_at": transfer.get("transferred_at") or "",
            "claim_id": "",
        })

    claims = await db.merchant_warranty_claims.find(
        {
            "registration_id": registration_id,
            "customer_user_id": user_id,
        },
        {"_id": 0},
    ).sort("created_at", 1).to_list(100)

    for claim in claims:
        claim_id = str(claim.get("claim_id") or "")
        events.append({
            "event_id": f"claim:{claim_id}",
            "event_type": "claim_opened",
            "status": "open",
            "title": claim.get("subject") or "Charge-Care-Fall eröffnet",
            "description": claim.get("issue_summary") or claim.get("description") or "",
            "actor_role": "customer",
            "created_at": claim.get("created_at") or "",
            "claim_id": claim_id,
        })
        for index, history in enumerate(claim.get("status_history") or []):
            if (
                str(history.get("status") or "") == "open"
                and str(history.get("created_at") or "") == str(claim.get("created_at") or "")
            ):
                continue
            events.append({
                "event_id": f"claim-status:{claim_id}:{index}",
                "event_type": "claim_status",
                "status": history.get("status") or claim.get("status") or "",
                "title": {
                    "in_review": "Garantiefall in Prüfung",
                    "approved": "Lösung freigegeben",
                    "rejected": "Garantiefall abgelehnt",
                    "resolved": "Garantiefall abgeschlossen",
                    "cancelled": "Garantiefall storniert",
                    "open": "Garantiefall geöffnet",
                }.get(str(history.get("status") or ""), "Garantiefall aktualisiert"),
                "description": history.get("note") or "",
                "actor_role": history.get("actor_role") or "system",
                "created_at": history.get("created_at") or "",
                "claim_id": claim_id,
            })

    events.sort(key=lambda item: str(item.get("created_at") or ""))
    return {
        "registration_id": registration_id,
        "product_id": warranty.get("product_id") or "",
        "product_name": warranty.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": warranty.get("serial_number") or "",
        "merchant_name": warranty.get("merchant_name") or "",
        "warranty_status": card.get("status"),
        "valid_until": card.get("valid_until"),
        "service_events": events,
        "service_events_total": len(events),
        "claims_total": len(claims),
    }


@router.post("/warranty/{registration_id}/transfer")@router.post("/warranty/{registration_id}/transfer")
async def create_charge_warranty_transfer(
    registration_id: str,
    req: ChargeWarrantyTransferRequest,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    sender_email = _normalized_email(user.get("email"))
    recipient_email = _normalized_email(req.recipient_email)

    if not recipient_email or "@" not in recipient_email:
        raise HTTPException(status_code=400, detail="Gültige Empfänger-E-Mail erforderlich")
    if recipient_email == sender_email:
        raise HTTPException(status_code=400, detail="Garantie kann nicht an dasselbe Konto übertragen werden")

    warranty = await _find_user_warranty(user_id, registration_id)
    if _warranty_card(warranty).get("status") != "active":
        raise HTTPException(status_code=409, detail="Nur aktive Garantien können übertragen werden")

    active_claim = await db.merchant_warranty_claims.find_one(
        {
            "registration_id": registration_id,
            "customer_user_id": user_id,
            "status": {"$in": ["open", "in_review", "approved"]},
        },
        {"_id": 0, "claim_id": 1},
    )
    if active_claim:
        raise HTTPException(
            status_code=409,
            detail=f"Übertragung nicht möglich: Charge-Care-Fall {active_claim.get('claim_id')} ist noch aktiv.",
        )

    existing = await db.charge_warranty_transfers.find_one(
        {
            "registration_id": registration_id,
            "from_user_id": user_id,
            "status": "pending",
        },
        {"_id": 0},
    )
    if existing:
        existing_expiry = _parse_iso(existing.get("expires_at"))
        if existing_expiry and existing_expiry > datetime.now(timezone.utc):
            if _normalized_email(existing.get("recipient_email")) == recipient_email:
                return {"ok": True, "transfer": _transfer_card(existing), "duplicate": True}
            raise HTTPException(status_code=409, detail="Für diese Garantie existiert bereits eine offene Übertragung")
        await db.charge_warranty_transfers.update_one(
            {"transfer_id": existing.get("transfer_id"), "status": "pending"},
            {"$set": {"status": "expired", "updated_at": _now_iso()}},
        )

    now_dt = datetime.now(timezone.utc)
    expires_at = (now_dt + timedelta(hours=72)).isoformat()
    serial = str(warranty.get("serial_number") or "")
    masked_serial = f"{serial[:2]}***{serial[-2:]}" if len(serial) >= 5 else ("***" if serial else "—")
    transfer = {
        "transfer_id": f"CHG-TR-{secrets.token_hex(8).upper()}",
        "registration_id": registration_id,
        "product_id": warranty.get("product_id") or "",
        "product_name": warranty.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number_masked": masked_serial,
        "from_user_id": user_id,
        "from_email": sender_email,
        "recipient_email": recipient_email,
        "status": "pending",
        "created_at": now_dt.isoformat(),
        "updated_at": now_dt.isoformat(),
        "expires_at": expires_at,
    }
    await db.charge_warranty_transfers.insert_one(transfer)
    transfer.pop("_id", None)
    await safe_create_charge_notification(
        event_key=f"charge_transfer_created:{transfer['transfer_id']}",
        user_email=recipient_email,
        title="Charge-Garantie für dich",
        message=f"{transfer.get('product_name') or 'Charge-Produkt'} wurde dir zur Garantieübernahme angeboten.",
        action_url="/charge-app",
        metadata={"transfer_id": transfer["transfer_id"], "registration_id": registration_id},
    )
    return {"ok": True, "transfer": _transfer_card(transfer)}


@router.get("/warranty-transfers")
async def list_charge_warranty_transfers(request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    email = _normalized_email(user.get("email"))
    rows = await db.charge_warranty_transfers.find(
        {
            "$or": [
                {"from_user_id": user_id},
                {"recipient_email": email},
            ],
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)

    expired_ids = []
    payload = []
    for row in rows:
        card = _transfer_card(row)
        payload.append(card)
        if row.get("status") == "pending" and card.get("status") == "expired":
            expired_ids.append(row.get("transfer_id"))

    if expired_ids:
        await db.charge_warranty_transfers.update_many(
            {"transfer_id": {"$in": expired_ids}, "status": "pending"},
            {"$set": {"status": "expired", "updated_at": _now_iso()}},
        )

    return {
        "incoming": [item for item in payload if _normalized_email(item.get("recipient_email")) == email],
        "outgoing": [item for item in payload if item.get("from_user_id") == user_id],
    }


@router.put("/warranty-transfers/{transfer_id}/accept")
async def accept_charge_warranty_transfer(transfer_id: str, request: Request):
    user = await get_current_user(request)
    recipient_user_id = str(user.get("_id"))
    recipient_email = _normalized_email(user.get("email"))

    transfer = await db.charge_warranty_transfers.find_one(
        {"transfer_id": transfer_id},
        {"_id": 0},
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="Garantieübertragung nicht gefunden")
    if _normalized_email(transfer.get("recipient_email")) != recipient_email:
        raise HTTPException(status_code=403, detail="Diese Garantieübertragung ist für ein anderes Konto bestimmt")

    if transfer.get("status") == "accepted":
        warranty = await db.charge_app_warranties.find_one(
            {"registration_id": transfer.get("registration_id"), "user_id": recipient_user_id},
            {"_id": 0},
        )
        if warranty:
            return {"ok": True, "warranty": _warranty_card(warranty), "duplicate": True}
    if transfer.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Garantieübertragung ist nicht mehr aktiv")

    expires_at = _parse_iso(transfer.get("expires_at"))
    if not expires_at or expires_at <= datetime.now(timezone.utc):
        await db.charge_warranty_transfers.update_one(
            {"transfer_id": transfer_id, "status": "pending"},
            {"$set": {"status": "expired", "updated_at": _now_iso()}},
        )
        raise HTTPException(status_code=409, detail="Garantieübertragung ist abgelaufen")

    registration_id = str(transfer.get("registration_id") or "")
    warranty = await db.charge_app_warranties.find_one(
        {"registration_id": registration_id, "user_id": transfer.get("from_user_id")},
        {"_id": 0},
    )
    if not warranty:
        # Recover a crash where the warranty moved but the transfer status update did not finish.
        already_moved = await db.charge_app_warranties.find_one(
            {"registration_id": registration_id, "user_id": recipient_user_id},
            {"_id": 0},
        )
        if already_moved:
            now = _now_iso()
            await db.charge_warranty_transfers.update_one(
                {"transfer_id": transfer_id, "status": "pending"},
                {"$set": {
                    "status": "accepted",
                    "accepted_at": now,
                    "recipient_user_id": recipient_user_id,
                    "updated_at": now,
                }},
            )
            return {"ok": True, "warranty": _warranty_card(already_moved), "recovered": True}
        raise HTTPException(status_code=409, detail="Garantie gehört nicht mehr dem ursprünglichen Konto")

    conflict = await _find_conflicting_active_warranty(
        user_id=recipient_user_id,
        registration_id=registration_id,
        product_id=warranty.get("product_id") or "",
        product_name=warranty.get("product_name") or "",
        serial_number=warranty.get("serial_number") or "",
    )
    if conflict and conflict.get("registration_id") != registration_id:
        raise HTTPException(status_code=409, detail="Empfänger hat bereits eine aktive Garantie für diese Produkt-Seriennummer")

    now = _now_iso()
    history_entry = {
        "transfer_id": transfer_id,
        "from_user_id": transfer.get("from_user_id"),
        "from_email": transfer.get("from_email") or "",
        "to_user_id": recipient_user_id,
        "to_email": recipient_email,
        "transferred_at": now,
    }
    result = await db.charge_app_warranties.update_one(
        {
            "registration_id": registration_id,
            "user_id": transfer.get("from_user_id"),
        },
        {
            "$set": {
                "user_id": recipient_user_id,
                # Purchase documents stay private with the original buyer.
                "invoice_id": "",
                "invoice_number": "",
                "updated_at": now,
                "last_transfer_at": now,
            },
            "$push": {"transfer_history": history_entry},
        },
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Garantieübertragung konnte nicht atomar übernommen werden")

    await db.charge_warranty_transfers.update_one(
        {"transfer_id": transfer_id, "status": "pending"},
        {"$set": {
            "status": "accepted",
            "accepted_at": now,
            "recipient_user_id": recipient_user_id,
            "updated_at": now,
        }},
    )
    moved = await db.charge_app_warranties.find_one(
        {"registration_id": registration_id, "user_id": recipient_user_id},
        {"_id": 0},
    )
    await safe_create_charge_notification(
        event_key=f"charge_transfer_accepted:{transfer_id}",
        user_id=str(transfer.get("from_user_id") or ""),
        user_email=str(transfer.get("from_email") or ""),
        title="Charge-Garantie übernommen",
        message=f"Die Garantie für {transfer.get('product_name') or 'dein Charge-Produkt'} wurde vom Empfänger angenommen.",
        action_url="/charge-app",
        metadata={"transfer_id": transfer_id, "registration_id": registration_id},
    )
    return {"ok": True, "warranty": _warranty_card(moved or warranty)}


@router.put("/warranty-transfers/{transfer_id}/decline")
async def decline_charge_warranty_transfer(transfer_id: str, request: Request):
    user = await get_current_user(request)
    recipient_email = _normalized_email(user.get("email"))
    now = _now_iso()
    result = await db.charge_warranty_transfers.update_one(
        {
            "transfer_id": transfer_id,
            "recipient_email": recipient_email,
            "status": "pending",
        },
        {"$set": {
            "status": "declined",
            "declined_at": now,
            "recipient_user_id": str(user.get("_id")),
            "updated_at": now,
        }},
    )
    if result.modified_count != 1:
        transfer = await db.charge_warranty_transfers.find_one(
            {"transfer_id": transfer_id, "recipient_email": recipient_email},
            {"_id": 0},
        )
        if not transfer:
            raise HTTPException(status_code=404, detail="Garantieübertragung nicht gefunden")
        if transfer.get("status") == "declined":
            return {"ok": True, "transfer": _transfer_card(transfer)}
        raise HTTPException(status_code=409, detail="Garantieübertragung kann nicht mehr abgelehnt werden")
    transfer = await db.charge_warranty_transfers.find_one(
        {"transfer_id": transfer_id},
        {"_id": 0},
    )
    if transfer:
        await safe_create_charge_notification(
            event_key=f"charge_transfer_declined:{transfer_id}",
            user_id=str(transfer.get("from_user_id") or ""),
            user_email=str(transfer.get("from_email") or ""),
            title="Garantieübertragung abgelehnt",
            message=f"Die Übertragung für {transfer.get('product_name') or 'dein Charge-Produkt'} wurde abgelehnt.",
            action_url="/charge-app",
            metadata={"transfer_id": transfer_id},
        )
    return {"ok": True, "transfer": _transfer_card(transfer or {"transfer_id": transfer_id, "status": "declined"})}


@router.put("/warranty-transfers/{transfer_id}/cancel")
async def cancel_charge_warranty_transfer(transfer_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    now = _now_iso()
    result = await db.charge_warranty_transfers.update_one(
        {
            "transfer_id": transfer_id,
            "from_user_id": user_id,
            "status": "pending",
        },
        {"$set": {"status": "cancelled", "cancelled_at": now, "updated_at": now}},
    )
    if result.modified_count != 1:
        transfer = await db.charge_warranty_transfers.find_one(
            {"transfer_id": transfer_id, "from_user_id": user_id},
            {"_id": 0},
        )
        if not transfer:
            raise HTTPException(status_code=404, detail="Garantieübertragung nicht gefunden")
        if transfer.get("status") == "cancelled":
            return {"ok": True, "transfer": _transfer_card(transfer)}
        raise HTTPException(status_code=409, detail="Garantieübertragung kann nicht mehr storniert werden")
    transfer = await db.charge_warranty_transfers.find_one(
        {"transfer_id": transfer_id},
        {"_id": 0},
    )
    if transfer:
        await safe_create_charge_notification(
            event_key=f"charge_transfer_cancelled:{transfer_id}",
            user_email=str(transfer.get("recipient_email") or ""),
            title="Garantieübertragung storniert",
            message=f"Die angebotene Übertragung für {transfer.get('product_name') or 'ein Charge-Produkt'} wurde storniert.",
            action_url="/charge-app",
            metadata={"transfer_id": transfer_id},
        )
    return {"ok": True, "transfer": _transfer_card(transfer or {"transfer_id": transfer_id, "status": "cancelled"})}


@router.post("/warranty/{registration_id}/claims")
async def create_charge_warranty_claim(
    registration_id: str,
    req: ChargeWarrantyClaimRequest,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    warranty = await _find_user_warranty(user_id, registration_id)

    subject = req.subject.strip()
    description = req.description.strip()
    if not subject or not description:
        raise HTTPException(status_code=400, detail="Betreff und Beschreibung sind erforderlich")

    active_existing = await db.merchant_warranty_claims.find_one({
        "customer_user_id": user_id,
        "registration_id": registration_id,
        "status": {"$in": ["open", "in_review", "approved"]},
    }, {"_id": 0})
    if active_existing:
        return {"ok": True, "claim": _claim_card(active_existing), "duplicate": True}

    merchant_binding = {
        "merchant_id": warranty.get("merchant_id") or "",
        "merchant_user_id": warranty.get("merchant_user_id") or "",
        "merchant_slug": warranty.get("merchant_slug") or "",
        "merchant_name": warranty.get("merchant_name") or "",
    }
    if not merchant_binding.get("merchant_user_id"):
        merchant_binding = await _resolve_charge_merchant(warranty.get("merchant_name"))
    now = _now_iso()
    claim = {
        "claim_id": f"CHG-CLM-{uuid.uuid4().hex[:10].upper()}",
        "registration_id": registration_id,
        # Existing merchant portal owns warranty claims through user_id.
        "user_id": merchant_binding.get("merchant_user_id") or "",
        "customer_user_id": user_id,
        "customer_name": user.get("name") or user.get("full_name") or user.get("email") or "BidBlitz Kunde",
        "customer_email": user.get("email") or "",
        "merchant_id": merchant_binding.get("merchant_id") or "",
        "merchant_slug": merchant_binding.get("merchant_slug") or "",
        "product_id": warranty.get("product_id") or "",
        "product_name": warranty.get("product_name") or "",
        "serial_number": warranty.get("serial_number") or "",
        "merchant_name": merchant_binding.get("merchant_name") or warranty.get("merchant_name") or "",
        "invoice_id": warranty.get("invoice_id") or "",
        "invoice_number": warranty.get("invoice_number") or "",
        "purchase_date": warranty.get("purchase_date") or "",
        "warranty_months": int(warranty.get("warranty_months") or 24),
        "warranty_valid_until": _warranty_card(warranty).get("valid_until"),
        "issue_type": req.issue_type.strip().lower() or "defect",
        "subject": subject,
        "description": description,
        "issue_summary": description,
        "preferred_resolution": req.preferred_resolution.strip().lower() or "repair",
        "requested_resolution": (
            "replace" if (req.preferred_resolution.strip().lower() or "repair") == "replacement"
            else (req.preferred_resolution.strip().lower() or "repair")
        ),
        "source": "charge_app_customer",
        "status": "open",
        "messages": [{
            "message_id": f"MSG-{uuid.uuid4().hex[:10].upper()}",
            "author_role": "customer",
            "author_id": user_id,
            "message": description,
            "created_at": now,
        }],
        "status_history": [{
            "status": "open",
            "actor_role": "customer",
            "actor_id": user_id,
            "note": "Garantiefall eröffnet",
            "created_at": now,
        }],
        "attachments": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.merchant_warranty_claims.insert_one(claim)
    claim.pop("_id", None)
    if claim.get("user_id"):
        await safe_create_charge_notification(
            event_key=f"charge_claim_created:{claim['claim_id']}",
            user_id=str(claim.get("user_id") or ""),
            title="Neuer Charge-Care-Fall",
            message=f"{claim.get('product_name') or 'Charge-Produkt'}: {claim.get('subject') or 'Garantiefall'}",
            action_url="/merchant-portal",
            metadata={"claim_id": claim["claim_id"], "registration_id": registration_id},
        )
    return {"ok": True, "claim": _claim_card(claim)}


@router.get("/claims")
async def list_my_charge_claims(request: Request, limit: int = 100):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    rows = await db.merchant_warranty_claims.find(
        {"customer_user_id": user_id},
        {"_id": 0},
    ).sort("updated_at", -1).limit(min(max(limit, 1), 200)).to_list(200)
    return {"claims": [_claim_card(item) for item in rows], "total": len(rows)}


@router.get("/claims/{claim_id}")
async def get_my_charge_claim(claim_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    claim = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"_id": 0},
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")
    return {"claim": _claim_card(claim)}


@router.post("/claims/{claim_id}/attachments")
async def upload_charge_claim_attachment(
    claim_id: str,
    request: Request,
    file: UploadFile = File(...),
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    claim = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"_id": 0},
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")
    if claim.get("status") in {"resolved", "cancelled"}:
        raise HTTPException(status_code=409, detail="Dieser Garantiefall ist abgeschlossen")

    content = await _read_upload(file)
    uploaded = _storage_upload_bytes(
        user_id,
        file.filename or "claim-evidence.bin",
        content,
        file.content_type or None,
    )
    attachment = {
        "attachment_id": f"ATT-{uuid.uuid4().hex[:10].upper()}",
        "kind": "claim_evidence",
        "original_filename": file.filename or "Datei",
        "content_type": file.content_type or "application/octet-stream",
        "size": uploaded.get("size", len(content)),
        "storage_path": uploaded["path"],
        "uploaded_at": _now_iso(),
    }
    now = _now_iso()
    await db.merchant_warranty_claims.update_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"$push": {"attachments": attachment}, "$set": {"updated_at": now}},
    )
    return {
        "ok": True,
        "attachment": _attachment_meta(
            attachment,
            f"/api/charge-app/claims/{claim_id}/attachments",
        ),
    }


@router.get("/claims/{claim_id}/attachments/{attachment_id}/download")
@router.head("/claims/{claim_id}/attachments/{attachment_id}/download")
async def download_charge_claim_attachment(
    claim_id: str,
    attachment_id: str,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    claim = await db.merchant_warranty_claims.find_one({"claim_id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")
    is_admin = user.get("role") == "admin"
    is_customer = str(claim.get("customer_user_id") or "") == user_id
    is_merchant = user.get("role") == "merchant" and str(claim.get("user_id") or "") == user_id
    if not (is_admin or is_customer or is_merchant):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    attachment = next(
        (item for item in (claim.get("attachments") or []) if item.get("attachment_id") == attachment_id),
        None,
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    content, content_type = _storage_get_bytes(attachment["storage_path"])
    return StreamingResponse(
        BytesIO(content),
        media_type=attachment.get("content_type") or content_type,
        headers={
            "Content-Disposition": f"attachment; filename={attachment.get('original_filename') or 'charge-care-datei'}"
        },
    )


@router.delete("/claims/{claim_id}/attachments/{attachment_id}")
async def delete_charge_claim_attachment(
    claim_id: str,
    attachment_id: str,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    claim = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"_id": 0},
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")
    if claim.get("status") in {"resolved", "cancelled"}:
        raise HTTPException(status_code=409, detail="Dieser Garantiefall ist abgeschlossen")

    attachment = next(
        (item for item in (claim.get("attachments") or []) if item.get("attachment_id") == attachment_id),
        None,
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    _delete_attachment_blob(attachment)
    await db.merchant_warranty_claims.update_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {
            "$pull": {"attachments": {"attachment_id": attachment_id}},
            "$set": {"updated_at": _now_iso()},
        },
    )
    return {"ok": True, "attachment_id": attachment_id}


@router.post("/claims/{claim_id}/messages")
async def add_charge_claim_message(
    claim_id: str,
    req: ChargeClaimMessageRequest,
    request: Request,
):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    claim = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"_id": 0},
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")
    if claim.get("status") in {"resolved", "cancelled"}:
        raise HTTPException(status_code=409, detail="Dieser Garantiefall ist abgeschlossen")

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    now = _now_iso()
    entry = {
        "message_id": f"MSG-{uuid.uuid4().hex[:10].upper()}",
        "author_role": "customer",
        "author_id": user_id,
        "message": message,
        "created_at": now,
    }
    await db.merchant_warranty_claims.update_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"$push": {"messages": entry}, "$set": {"updated_at": now}},
    )
    if claim.get("user_id"):
        await safe_create_charge_notification(
            event_key=f"charge_claim_customer_message:{claim_id}:{entry['message_id']}",
            user_id=str(claim.get("user_id") or ""),
            title="Neue Charge-Care-Nachricht",
            message=f"Kunde hat zu {claim.get('product_name') or 'einem Charge-Produkt'} geschrieben.",
            action_url="/merchant-portal",
            metadata={"claim_id": claim_id, "message_id": entry["message_id"]},
        )
    return {"ok": True, "message": entry}


@router.put("/claims/{claim_id}/cancel")
async def cancel_my_charge_claim(claim_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    claim = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {"_id": 0},
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")
    if claim.get("status") in {"resolved", "rejected", "cancelled"}:
        return {"ok": True, "claim": _claim_card(claim)}

    now = _now_iso()
    history_entry = {
        "status": "cancelled",
        "actor_role": "customer",
        "actor_id": user_id,
        "note": "Garantiefall vom Kunden storniert",
        "created_at": now,
    }
    await db.merchant_warranty_claims.update_one(
        {"claim_id": claim_id, "customer_user_id": user_id},
        {
            "$set": {"status": "cancelled", "updated_at": now, "resolved_at": now},
            "$push": {"status_history": history_entry},
        },
    )
    updated = {
        **claim,
        "status": "cancelled",
        "updated_at": now,
        "resolved_at": now,
        "status_history": [*(claim.get("status_history") or []), history_entry],
    }
    if claim.get("user_id"):
        await safe_create_charge_notification(
            event_key=f"charge_claim_cancelled:{claim_id}",
            user_id=str(claim.get("user_id") or ""),
            title="Charge-Care-Fall storniert",
            message=f"Der Kunde hat den Garantiefall {claim_id} storniert.",
            action_url="/merchant-portal",
            metadata={"claim_id": claim_id, "status": "cancelled"},
        )
    return {"ok": True, "claim": _claim_card(updated)}


@router.get("/admin/claims")
async def admin_list_charge_claims(
    request: Request,
    status: Optional[str] = None,
    limit: int = 300,
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = _validate_claim_status(status)
    rows = await db.merchant_warranty_claims.find(
        query,
        {"_id": 0},
    ).sort("updated_at", -1).limit(min(max(limit, 1), 500)).to_list(500)
    return {
        "claims": [_claim_card(item) for item in rows],
        "summary": {
            "total": len(rows),
            "open": sum(1 for item in rows if item.get("status") == "open"),
            "in_review": sum(1 for item in rows if item.get("status") == "in_review"),
            "approved": sum(1 for item in rows if item.get("status") == "approved"),
            "resolved": sum(1 for item in rows if item.get("status") == "resolved"),
        },
    }


@router.put("/admin/claims/{claim_id}/status")
async def admin_update_charge_claim_status(
    claim_id: str,
    req: ChargeClaimStatusRequest,
    request: Request,
):
    admin = await _require_admin(request)
    claim = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id},
        {"_id": 0},
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Garantiefall nicht gefunden")

    status = _validate_claim_status(req.status)
    now = _now_iso()
    update: Dict[str, Any] = {
        "status": status,
        "admin_note": req.note.strip(),
        "updated_at": now,
        "updated_by": admin.get("email") or str(admin.get("_id") or "admin"),
    }
    if status in {"resolved", "rejected", "cancelled"}:
        update["resolved_at"] = now

    messages = []
    note = req.note.strip()
    if note and note != str(claim.get("admin_note") or "").strip():
        messages.append({
            "message_id": f"MSG-{uuid.uuid4().hex[:10].upper()}",
            "author_role": "admin",
            "author_id": str(admin.get("_id") or "admin"),
            "message": note,
            "created_at": now,
        })

    mongo_update: Dict[str, Any] = {"$set": update}
    push_ops: Dict[str, Any] = {}
    if messages:
        push_ops["messages"] = {"$each": messages}
    if status != str(claim.get("status") or ""):
        push_ops["status_history"] = {
            "status": status,
            "actor_role": "admin",
            "actor_id": str(admin.get("_id") or "admin"),
            "note": note,
            "created_at": now,
        }
    if push_ops:
        mongo_update["$push"] = push_ops
    await db.merchant_warranty_claims.update_one(
        {"claim_id": claim_id},
        mongo_update,
    )
    saved = await db.merchant_warranty_claims.find_one(
        {"claim_id": claim_id},
        {"_id": 0},
    )
    notification_hash = hashlib.sha256(f"{status}|{note}".encode("utf-8")).hexdigest()[:12]
    await safe_create_charge_notification(
        event_key=f"charge_claim_admin_update:{claim_id}:{notification_hash}",
        user_id=str(claim.get("customer_user_id") or ""),
        user_email=str(claim.get("customer_email") or ""),
        title="Charge Care aktualisiert",
        message=note or f"Dein Garantiefall ist jetzt: {status}.",
        action_url=f"/charge-app/claims?claim_id={claim_id}",
        metadata={"claim_id": claim_id, "status": status},
    )
    return {"ok": True, "claim": _claim_card(saved or {**claim, **update})}


@router.get("/warranty/verify/{registration_id}")
async def verify_charge_warranty_pass(registration_id: str, sig: str):
    warranty = await db.charge_app_warranties.find_one(
        {"registration_id": registration_id},
        {"_id": 0},
    )
    if not warranty:
        raise HTTPException(status_code=404, detail="Garantiepass nicht gefunden")

    card = _warranty_card(warranty)
    expected = _warranty_signature(
        registration_id,
        str(warranty.get("serial_number") or ""),
        str(card.get("valid_until") or ""),
    )
    if not sig or not hmac.compare_digest(str(sig), expected):
        raise HTTPException(status_code=403, detail="Ungültiger Garantiepass")

    serial = str(warranty.get("serial_number") or "")
    masked_serial = (
        f"{serial[:2]}***{serial[-2:]}"
        if len(serial) >= 5
        else ("***" if serial else "—")
    )
    return {
        "ok": True,
        "verified": True,
        "pass": {
            "registration_id": registration_id,
            "pass_id": f"BB-CHARGE-{registration_id[-6:]}",
            "product_name": warranty.get("product_name") or "BidBlitz Charge Produkt",
            "merchant_name": warranty.get("merchant_name") or "BidBlitz Charge Händler",
            "serial_number_masked": masked_serial,
            "status": card.get("status"),
            "status_label": card.get("warranty_pass", {}).get("status_label"),
            "coverage_label": card.get("coverage_label"),
            "evidence_level": card.get("evidence_level"),
            "evidence_label": card.get("evidence_label"),
            "valid_until": card.get("valid_until"),
        },
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
          <p><strong>Nachweis:</strong> {pass_data.get('evidence_label') or 'Manuell erfasst'}</p>
          <p style='font-size:12px;color:#475569;'>Der Nachweis beschreibt verknüpfte Garantie-/Kaufdaten und ist keine unabhängige Echtheitsprüfung des physischen Produkts.</p>
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
    related_warranties = [_warranty_card(item) for item in user_warranties if _matches_merchant_context(item.get("merchant_name"), merchant_payload, slug, item.get("merchant_slug"))][:4]
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
        needle = q.strip()[:100]
        safe_needle = re.escape(needle)
        query["$or"] = [
            {"name": {"$regex": safe_needle, "$options": "i"}},
            {"brand": {"$regex": safe_needle, "$options": "i"}},
            {"category": {"$regex": safe_needle, "$options": "i"}},
            {"sku": {"$regex": safe_needle, "$options": "i"}},
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
            "manual_url": override.get("manual_url") or product.get("manual_url") or "",
            "support_url": override.get("support_url") or product.get("support_url") or "",
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
        "manual_url": _safe_http_url(req.manual_url),
        "support_url": _safe_http_url(req.support_url),
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


@router.delete("/admin/offer-rules/{rule_id}")
async def delete_charge_offer_rule(rule_id: str, request: Request):
    admin = await _require_admin(request)
    existing = await db.charge_offer_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Regel nicht gefunden")
    result = await db.charge_offer_rules.delete_one({"rule_id": rule_id})
    if result.deleted_count != 1:
        raise HTTPException(status_code=409, detail="Regel konnte nicht gelöscht werden")
    return {
        "ok": True,
        "rule_id": rule_id,
        "deleted_by": admin.get("email") or admin.get("user_id") or "admin",
    }


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
