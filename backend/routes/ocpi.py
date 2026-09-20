"""BidBlitz OCPI 2.2.1 roaming interface.

Implements the OCPI discovery/credentials handshake plus the core roaming data
modules used by CPO/eMSP integrations.  Partners are fail-closed: functional
modules require an active credentials token, and outbound partner secrets are
encrypted at rest.

No partner is contacted merely by importing or starting this module.
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from core.config import BACKEND_URL, JWT_SECRET
from core.database import db
from core.payment_engine import get_user_balance
from core.security import get_current_user
from services import ocpp_csms, ocpp_v201


router = APIRouter(prefix="/ocpi", tags=["ocpi"])

OCPI_VERSION = "2.2.1"
OCPI_COUNTRY_CODE = os.environ.get("OCPI_COUNTRY_CODE", "XK").upper()[:2]
OCPI_PARTY_ID = os.environ.get("OCPI_PARTY_ID", "BBL").upper()[:3]
OCPI_BUSINESS_NAME = os.environ.get("OCPI_BUSINESS_NAME", "BidBlitz")
OCPI_WEBSITE = os.environ.get("OCPI_WEBSITE", "https://bidblitz.ae")
OCPI_BOOTSTRAP_TOKEN = os.environ.get("OCPI_BOOTSTRAP_TOKEN", "")
OCPI_DEFAULT_LIMIT = 100
OCPI_MAX_LIMIT = 1000


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _ocpi(data: Any = None, *, status_code: int = 1000, message: Optional[str] = None) -> Dict[str, Any]:
    body: Dict[str, Any] = {"status_code": status_code, "timestamp": _now()}
    if data is not None:
        body["data"] = data
    if message:
        body["status_message"] = message
    return body


def _public_base(request: Request) -> str:
    configured = (BACKEND_URL or "").rstrip("/")
    if configured and "localhost" not in configured.lower():
        return configured
    return str(request.base_url).rstrip("/")


def _token_key() -> bytes:
    material = (os.environ.get("OCPI_TOKEN_ENCRYPTION_KEY") or JWT_SECRET or "").encode("utf-8")
    if not material:
        raise HTTPException(503, "OCPI token encryption is not configured")
    digest = hashlib.sha256(material + b":bidblitz-ocpi").digest()
    return base64.urlsafe_b64encode(digest)


def _encrypt_token(value: str) -> str:
    return Fernet(_token_key()).encrypt(value.encode("utf-8")).decode("ascii")


def _decrypt_token(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return Fernet(_token_key()).decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _auth_token(header: Optional[str]) -> str:
    if not header:
        raise HTTPException(401, "Missing OCPI Authorization header")
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "token" or not value:
        raise HTTPException(401, "Invalid OCPI Authorization header")
    value = value.strip()
    try:
        decoded = base64.b64decode(value, validate=True).decode("utf-8")
        if decoded:
            return decoded.strip()
    except Exception:
        pass
    # Compatibility with older 2.1.1/2.2 implementations that sent raw tokens.
    return value


async def _partner_from_auth(
    authorization: Optional[str],
    *,
    allow_bootstrap: bool = False,
) -> Optional[Dict[str, Any]]:
    token = _auth_token(authorization)
    if allow_bootstrap and OCPI_BOOTSTRAP_TOKEN and secrets.compare_digest(token, OCPI_BOOTSTRAP_TOKEN):
        return None
    partner = await db.ocpi_partners.find_one(
        {"incoming_token_hash": _token_hash(token), "status": "active"},
        {"_id": 0},
    )
    if not partner:
        raise HTTPException(401, "Unknown or inactive OCPI credentials token")
    return partner


def _roles() -> List[Dict[str, Any]]:
    return [
        {
            "role": "CPO",
            "business_details": {"name": OCPI_BUSINESS_NAME, "website": OCPI_WEBSITE},
            "party_id": OCPI_PARTY_ID,
            "country_code": OCPI_COUNTRY_CODE,
        },
        {
            "role": "EMSP",
            "business_details": {"name": OCPI_BUSINESS_NAME, "website": OCPI_WEBSITE},
            "party_id": OCPI_PARTY_ID,
            "country_code": OCPI_COUNTRY_CODE,
        },
    ]


def _credentials(token: str, request: Request) -> Dict[str, Any]:
    return {
        "token": token,
        "url": f"{_public_base(request)}/ocpi/versions",
        "roles": _roles(),
    }


def _version_details(request: Request) -> Dict[str, Any]:
    base = _public_base(request)
    v = OCPI_VERSION
    return {
        "version": v,
        "endpoints": [
            {"identifier": "credentials", "role": "SENDER", "url": f"{base}/ocpi/{v}/credentials"},
            {"identifier": "locations", "role": "SENDER", "url": f"{base}/ocpi/cpo/{v}/locations"},
            {"identifier": "locations", "role": "RECEIVER", "url": f"{base}/ocpi/emsp/{v}/locations"},
            {"identifier": "tariffs", "role": "SENDER", "url": f"{base}/ocpi/cpo/{v}/tariffs"},
            {"identifier": "tariffs", "role": "RECEIVER", "url": f"{base}/ocpi/emsp/{v}/tariffs"},
            {"identifier": "sessions", "role": "SENDER", "url": f"{base}/ocpi/cpo/{v}/sessions"},
            {"identifier": "sessions", "role": "RECEIVER", "url": f"{base}/ocpi/emsp/{v}/sessions"},
            {"identifier": "cdrs", "role": "SENDER", "url": f"{base}/ocpi/cpo/{v}/cdrs"},
            {"identifier": "cdrs", "role": "RECEIVER", "url": f"{base}/ocpi/emsp/{v}/cdrs"},
            {"identifier": "tokens", "role": "SENDER", "url": f"{base}/ocpi/emsp/{v}/tokens"},
            {"identifier": "tokens", "role": "RECEIVER", "url": f"{base}/ocpi/cpo/{v}/tokens"},
            {"identifier": "commands", "role": "RECEIVER", "url": f"{base}/ocpi/cpo/{v}/commands"},
        ],
    }


def _routing_headers(request: Request) -> Dict[str, Optional[str]]:
    return {
        "from_country_code": request.headers.get("ocpi-from-country-code"),
        "from_party_id": request.headers.get("ocpi-from-party-id"),
        "to_country_code": request.headers.get("ocpi-to-country-code"),
        "to_party_id": request.headers.get("ocpi-to-party-id"),
    }


def _partner_identity(body: Dict[str, Any]) -> tuple[str, str]:
    roles = body.get("roles") or []
    if not roles:
        raise HTTPException(400, "OCPI credentials.roles is required")
    country = str(roles[0].get("country_code") or "").upper()
    party = str(roles[0].get("party_id") or "").upper()
    if len(country) != 2 or not (2 <= len(party) <= 3):
        raise HTTPException(400, "Invalid OCPI country_code/party_id")
    return country, party


@router.get("/versions")
async def versions(request: Request, authorization: Optional[str] = Header(None)):
    await _partner_from_auth(authorization, allow_bootstrap=True)
    return _ocpi([
        {"version": OCPI_VERSION, "url": f"{_public_base(request)}/ocpi/{OCPI_VERSION}"}
    ])


@router.get(f"/{OCPI_VERSION}")
async def version_details(request: Request, authorization: Optional[str] = Header(None)):
    await _partner_from_auth(authorization, allow_bootstrap=True)
    return _ocpi(_version_details(request))


@router.post(f"/{OCPI_VERSION}/credentials")
async def credentials_register(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    await _partner_from_auth(authorization, allow_bootstrap=True)
    remote_token = str(body.get("token") or "")
    remote_url = str(body.get("url") or "")
    if not remote_token or not remote_url:
        raise HTTPException(400, "OCPI credentials token and url are required")
    parsed = urlparse(remote_url)
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        raise HTTPException(400, "Invalid OCPI versions URL")

    country, party = _partner_identity(body)
    partner_id = f"{country}:{party}"
    existing = await db.ocpi_partners.find_one({"partner_id": partner_id})
    if existing and existing.get("status") == "active":
        raise HTTPException(409, "OCPI partner already registered")

    our_token = secrets.token_urlsafe(32)
    doc = {
        "partner_id": partner_id,
        "country_code": country,
        "party_id": party,
        "roles": body.get("roles") or [],
        "versions_url": remote_url,
        "remote_token_enc": _encrypt_token(remote_token),
        "incoming_token_enc": _encrypt_token(our_token),
        "incoming_token_hash": _token_hash(our_token),
        "status": "active",
        "protocol_version": OCPI_VERSION,
        "created_at": (existing or {}).get("created_at") or _now(),
        "updated_at": _now(),
    }
    await db.ocpi_partners.update_one(
        {"partner_id": partner_id},
        {"$set": doc},
        upsert=True,
    )
    return _ocpi(_credentials(our_token, request))


@router.get(f"/{OCPI_VERSION}/credentials")
async def credentials_get(request: Request, authorization: Optional[str] = Header(None)):
    partner = await _partner_from_auth(authorization)
    token = _decrypt_token((partner or {}).get("incoming_token_enc"))
    if not token:
        raise HTTPException(503, "OCPI credentials token cannot be recovered")
    return _ocpi(_credentials(token, request))


@router.put(f"/{OCPI_VERSION}/credentials")
async def credentials_update(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _partner_from_auth(authorization)
    remote_token = str(body.get("token") or "")
    remote_url = str(body.get("url") or "")
    if not remote_token or not remote_url:
        raise HTTPException(400, "OCPI credentials token and url are required")
    country, party = _partner_identity(body)
    if country != partner.get("country_code") or party != partner.get("party_id"):
        raise HTTPException(400, "OCPI credentials role identity cannot change with PUT")

    rotated = secrets.token_urlsafe(32)
    await db.ocpi_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$set": {
            "roles": body.get("roles") or [],
            "versions_url": remote_url,
            "remote_token_enc": _encrypt_token(remote_token),
            "incoming_token_enc": _encrypt_token(rotated),
            "incoming_token_hash": _token_hash(rotated),
            "updated_at": _now(),
        }},
    )
    return _ocpi(_credentials(rotated, request))


@router.delete(f"/{OCPI_VERSION}/credentials")
async def credentials_delete(authorization: Optional[str] = Header(None)):
    partner = await _partner_from_auth(authorization)
    await db.ocpi_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$set": {"status": "inactive", "disabled_at": _now(), "updated_at": _now()}},
    )
    return _ocpi()


async def _functional_partner(request: Request, authorization: Optional[str]) -> Dict[str, Any]:
    partner = await _partner_from_auth(authorization)
    route = _routing_headers(request)
    from_cc, from_pid = route["from_country_code"], route["from_party_id"]
    if from_cc and from_pid:
        if from_cc.upper() != partner["country_code"] or from_pid.upper() != partner["party_id"]:
            raise HTTPException(403, "OCPI routing headers do not match credentials")
    return partner


def _page_headers(response: Response, *, total: int, offset: int, limit: int) -> None:
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)


def _connector_standard(value: Any) -> str:
    v = str(value or "").upper().replace(" ", "_").replace("-", "_")
    aliases = {
        "CCS": "IEC_62196_T2_COMBO",
        "CCS2": "IEC_62196_T2_COMBO",
        "TYPE_2": "IEC_62196_T2",
        "TYP_2": "IEC_62196_T2",
        "TYPE2": "IEC_62196_T2",
        "CHADEMO": "CHADEMO",
        "TESLA": "TESLA_S",
    }
    return aliases.get(v, "IEC_62196_T2")


def _ocpi_status(value: Any) -> str:
    v = str(value or "").lower()
    if v in ("available", "preparing"):
        return "AVAILABLE"
    if v in ("charging", "occupied"):
        return "CHARGING"
    if v in ("faulted", "unavailable"):
        return "OUTOFORDER"
    return "UNKNOWN"


async def _local_location(cp: Dict[str, Any]) -> Dict[str, Any]:
    loc = cp.get("location") or {}
    connectors = await db.ev_connectors.find(
        {"charge_point_id": cp["charge_point_id"]},
        {"_id": 0},
    ).sort("connector_id", 1).to_list(50)
    evse_connectors = []
    for con in connectors:
        power_kw = float(con.get("power_kw") or cp.get("power_kw") or 22)
        evse_connectors.append({
            "id": str(con.get("connector_id") or 1),
            "standard": _connector_standard(con.get("standard") or con.get("type")),
            "format": "CABLE" if con.get("cable_attached", True) else "SOCKET",
            "power_type": "DC" if power_kw > 50 else "AC_3_PHASE",
            "max_voltage": int(con.get("max_voltage") or (800 if power_kw > 50 else 400)),
            "max_amperage": int(con.get("max_amperage") or max(16, round(power_kw * 1000 / 400))),
            "max_electric_power": int(power_kw * 1000),
            "tariff_ids": [str(cp["tariff_id"])] if cp.get("tariff_id") else [],
            "last_updated": con.get("updated_at") or cp.get("updated_at") or cp.get("created_at") or _now(),
        })
    if not evse_connectors:
        evse_connectors = [{
            "id": "1",
            "standard": "IEC_62196_T2",
            "format": "CABLE",
            "power_type": "AC_3_PHASE",
            "max_voltage": 400,
            "max_amperage": 32,
            "last_updated": cp.get("updated_at") or cp.get("created_at") or _now(),
        }]
    status = _ocpi_status((connectors[0] if connectors else {}).get("status"))
    return {
        "country_code": OCPI_COUNTRY_CODE,
        "party_id": OCPI_PARTY_ID,
        "id": cp["charge_point_id"],
        "publish": bool(cp.get("active", True)),
        "name": cp.get("name"),
        "address": loc.get("address") or "Unknown",
        "city": loc.get("city") or "Unknown",
        "postal_code": loc.get("postal_code"),
        "country": str(loc.get("country") or OCPI_COUNTRY_CODE).upper()[:3],
        "coordinates": {
            "latitude": str(loc.get("lat") if loc.get("lat") is not None else 0),
            "longitude": str(loc.get("lng") if loc.get("lng") is not None else 0),
        },
        "evses": [{
            "uid": cp["charge_point_id"],
            "evse_id": f"{OCPI_COUNTRY_CODE}*{OCPI_PARTY_ID}*E{cp['charge_point_id']}"[:48],
            "status": status,
            "connectors": evse_connectors,
            "last_updated": cp.get("updated_at") or cp.get("created_at") or _now(),
        }],
        "operator": {"name": OCPI_BUSINESS_NAME, "website": OCPI_WEBSITE},
        "time_zone": loc.get("time_zone") or "Europe/Belgrade",
        "last_updated": cp.get("updated_at") or cp.get("created_at") or _now(),
    }


async def _local_tariff(doc: Dict[str, Any]) -> Dict[str, Any]:
    tariff_id = str(doc.get("_id") or doc.get("tariff_id"))
    elements = []
    if float(doc.get("price_per_kwh") or 0) > 0:
        elements.append({"price_components": [{
            "type": "ENERGY",
            "price": float(doc.get("price_per_kwh")),
            "step_size": 1,
        }]})
    if float(doc.get("price_per_minute") or 0) > 0:
        elements.append({"price_components": [{
            "type": "TIME",
            "price": round(float(doc.get("price_per_minute")) * 60, 4),
            "step_size": 1,
        }]})
    if float(doc.get("session_fee") or 0) > 0:
        elements.append({"price_components": [{
            "type": "FLAT",
            "price": float(doc.get("session_fee")),
            "step_size": 1,
        }]})
    return {
        "country_code": OCPI_COUNTRY_CODE,
        "party_id": OCPI_PARTY_ID,
        "id": tariff_id,
        "currency": doc.get("currency") or "EUR",
        "type": "REGULAR",
        "elements": elements or [{"price_components": [{"type": "ENERGY", "price": 0.0, "step_size": 1}]}],
        "last_updated": doc.get("updated_at") or doc.get("created_at") or _now(),
    }


def _local_session(doc: Dict[str, Any]) -> Dict[str, Any]:
    status_map = {
        "active": "ACTIVE",
        "starting": "PENDING",
        "stopping": "ACTIVE",
        "completed": "COMPLETED",
        "cancelled": "INVALID",
        "failed": "INVALID",
        "settle_failed": "COMPLETED",
    }
    return {
        "country_code": OCPI_COUNTRY_CODE,
        "party_id": OCPI_PARTY_ID,
        "id": doc["session_id"],
        "start_date_time": doc.get("started_at") or doc.get("created_at") or _now(),
        "end_date_time": doc.get("stopped_at") or (doc.get("settled_at") if doc.get("status") == "completed" else None),
        "kwh": float(doc.get("kwh_charged") or 0),
        "cdr_token": {
            "country_code": OCPI_COUNTRY_CODE,
            "party_id": OCPI_PARTY_ID,
            "uid": str(doc.get("id_tag") or doc.get("user_id") or "UNKNOWN")[:36],
            "type": "APP_USER",
            "contract_id": str(doc.get("user_id") or "")[:36],
        },
        "auth_method": "COMMAND",
        "authorization_reference": doc.get("settlement_ref") or doc.get("reservation_ref"),
        "location_id": doc.get("charge_point_id"),
        "evse_uid": doc.get("charge_point_id"),
        "connector_id": str(doc.get("connector_id") or 1),
        "currency": doc.get("currency") or "EUR",
        "total_cost": {"excl_vat": float(doc.get("net_amount") or 0), "incl_vat": float(doc.get("final_cost") or doc.get("current_cost") or 0)},
        "status": status_map.get(doc.get("status"), "PENDING"),
        "last_updated": doc.get("settled_at") or doc.get("last_meter_at") or doc.get("created_at") or _now(),
    }


@router.get(f"/cpo/{OCPI_VERSION}/locations")
async def cpo_locations(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    total = await db.ev_charge_points.count_documents({"active": True})
    docs = await db.ev_charge_points.find({"active": True}).skip(offset).limit(limit).to_list(limit)
    data = [await _local_location(d) for d in docs]
    _page_headers(response, total=total, offset=offset, limit=limit)
    return _ocpi(data)


@router.get(f"/cpo/{OCPI_VERSION}/locations/{{country_code}}/{{party_id}}/{{location_id}}")
async def cpo_location(
    country_code: str,
    party_id: str,
    location_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    await _functional_partner(request, authorization)
    if country_code.upper() != OCPI_COUNTRY_CODE or party_id.upper() != OCPI_PARTY_ID:
        raise HTTPException(404, "Location not found")
    cp = await db.ev_charge_points.find_one({"charge_point_id": location_id, "active": True})
    if not cp:
        raise HTTPException(404, "Location not found")
    return _ocpi(await _local_location(cp))


@router.get(f"/cpo/{OCPI_VERSION}/tariffs")
async def cpo_tariffs(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    total = await db.ev_tariffs.count_documents({})
    docs = await db.ev_tariffs.find({}).skip(offset).limit(limit).to_list(limit)
    data = [await _local_tariff(d) for d in docs]
    _page_headers(response, total=total, offset=offset, limit=limit)
    return _ocpi(data)


@router.get(f"/cpo/{OCPI_VERSION}/sessions")
async def cpo_sessions(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    total = await db.ev_charging_sessions.count_documents({})
    docs = await db.ev_charging_sessions.find({}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    _page_headers(response, total=total, offset=offset, limit=limit)
    return _ocpi([_local_session(d) for d in docs])


@router.get(f"/cpo/{OCPI_VERSION}/cdrs")
async def cpo_cdrs(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    total = await db.ev_receipts.count_documents({})
    receipts = await db.ev_receipts.find({}).sort("issued_at", -1).skip(offset).limit(limit).to_list(limit)
    data = []
    for rec in receipts:
        sess = await db.ev_charging_sessions.find_one({"session_id": rec.get("session_id")}) or {}
        data.append({
            "country_code": OCPI_COUNTRY_CODE,
            "party_id": OCPI_PARTY_ID,
            "id": str(rec.get("receipt_no") or rec.get("session_id")),
            "start_date_time": sess.get("started_at") or sess.get("created_at") or rec.get("issued_at") or _now(),
            "end_date_time": sess.get("stopped_at") or sess.get("settled_at") or rec.get("issued_at") or _now(),
            "session_id": rec.get("session_id"),
            "cdr_token": _local_session({**sess, "session_id": rec.get("session_id")})["cdr_token"],
            "auth_method": "COMMAND",
            "cdr_location": {
                "id": sess.get("charge_point_id"),
                "name": sess.get("charge_point_id"),
                "address": "See Locations module",
                "city": "Unknown",
                "country": OCPI_COUNTRY_CODE,
                "coordinates": {"latitude": "0", "longitude": "0"},
                "evse_uid": sess.get("charge_point_id"),
                "evse_id": f"{OCPI_COUNTRY_CODE}*{OCPI_PARTY_ID}*E{sess.get('charge_point_id')}"[:48],
                "connector_id": str(sess.get("connector_id") or 1),
                "connector_standard": "IEC_62196_T2",
                "connector_format": "CABLE",
                "connector_power_type": "AC_3_PHASE",
            },
            "currency": rec.get("currency") or "EUR",
            "charging_periods": [{
                "start_date_time": sess.get("started_at") or rec.get("issued_at") or _now(),
                "dimensions": [{"type": "ENERGY", "volume": float(sess.get("kwh_charged") or 0)}],
            }],
            "total_cost": {"excl_vat": float(rec.get("net_amount") or 0), "incl_vat": float(rec.get("total_amount") or 0)},
            "total_energy": float(sess.get("kwh_charged") or 0),
            "total_time": round(float(sess.get("duration_min") or 0) / 60, 4),
            "last_updated": rec.get("updated_at") or rec.get("issued_at") or _now(),
        })
    _page_headers(response, total=total, offset=offset, limit=limit)
    return _ocpi(data)


async def _upsert_remote(
    collection,
    key: Dict[str, Any],
    body: Dict[str, Any],
    partner: Dict[str, Any],
    *,
    patch: bool,
) -> Dict[str, Any]:
    stored = {
        **body,
        **key,
        "source_partner_id": partner["partner_id"],
        "received_at": _now(),
    }
    if patch:
        await collection.update_one(key, {"$set": stored}, upsert=True)
    else:
        await collection.replace_one(key, stored, upsert=True)
    return stored


@router.put(f"/emsp/{OCPI_VERSION}/locations/{{country_code}}/{{party_id}}/{{location_id}}")
async def emsp_location_put(country_code: str, party_id: str, location_id: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_locations, {"country_code": country_code.upper(), "party_id": party_id.upper(), "id": location_id}, body, partner, patch=False)
    return _ocpi()


@router.patch(f"/emsp/{OCPI_VERSION}/locations/{{country_code}}/{{party_id}}/{{location_id}}")
async def emsp_location_patch(country_code: str, party_id: str, location_id: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_locations, {"country_code": country_code.upper(), "party_id": party_id.upper(), "id": location_id}, body, partner, patch=True)
    return _ocpi()


@router.put(f"/emsp/{OCPI_VERSION}/tariffs/{{country_code}}/{{party_id}}/{{tariff_id}}")
async def emsp_tariff_put(country_code: str, party_id: str, tariff_id: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_tariffs, {"country_code": country_code.upper(), "party_id": party_id.upper(), "id": tariff_id}, body, partner, patch=False)
    return _ocpi()


@router.patch(f"/emsp/{OCPI_VERSION}/tariffs/{{country_code}}/{{party_id}}/{{tariff_id}}")
async def emsp_tariff_patch(country_code: str, party_id: str, tariff_id: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_tariffs, {"country_code": country_code.upper(), "party_id": party_id.upper(), "id": tariff_id}, body, partner, patch=True)
    return _ocpi()


@router.put(f"/emsp/{OCPI_VERSION}/sessions/{{country_code}}/{{party_id}}/{{session_id}}")
async def emsp_session_put(country_code: str, party_id: str, session_id: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_sessions, {"country_code": country_code.upper(), "party_id": party_id.upper(), "id": session_id}, body, partner, patch=False)
    return _ocpi()


@router.patch(f"/emsp/{OCPI_VERSION}/sessions/{{country_code}}/{{party_id}}/{{session_id}}")
async def emsp_session_patch(country_code: str, party_id: str, session_id: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_sessions, {"country_code": country_code.upper(), "party_id": party_id.upper(), "id": session_id}, body, partner, patch=True)
    return _ocpi()


@router.post(f"/emsp/{OCPI_VERSION}/cdrs")
async def emsp_cdr_post(request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    country = str(body.get("country_code") or partner["country_code"]).upper()
    party = str(body.get("party_id") or partner["party_id"]).upper()
    cdr_id = str(body.get("id") or "")
    if not cdr_id:
        return _ocpi(status_code=2001, message="Missing required field: id")
    await _upsert_remote(db.ocpi_remote_cdrs, {"country_code": country, "party_id": party, "id": cdr_id}, body, partner, patch=False)
    return _ocpi({"id": cdr_id})


@router.put(f"/cpo/{OCPI_VERSION}/tokens/{{country_code}}/{{party_id}}/{{token_uid}}")
async def cpo_token_put(country_code: str, party_id: str, token_uid: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_tokens, {"country_code": country_code.upper(), "party_id": party_id.upper(), "uid": token_uid}, body, partner, patch=False)
    return _ocpi()


@router.patch(f"/cpo/{OCPI_VERSION}/tokens/{{country_code}}/{{party_id}}/{{token_uid}}")
async def cpo_token_patch(country_code: str, party_id: str, token_uid: str, request: Request, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    partner = await _functional_partner(request, authorization)
    await _upsert_remote(db.ocpi_remote_tokens, {"country_code": country_code.upper(), "party_id": party_id.upper(), "uid": token_uid}, body, partner, patch=True)
    return _ocpi()


@router.get(f"/emsp/{OCPI_VERSION}/tokens")
async def emsp_tokens(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    total = await db.ocpi_tokens.count_documents({"active": True})
    docs = await db.ocpi_tokens.find({"active": True}, {"_id": 0, "user_id": 0}).skip(offset).limit(limit).to_list(limit)
    _page_headers(response, total=total, offset=offset, limit=limit)
    return _ocpi(docs)


@router.post(f"/emsp/{OCPI_VERSION}/tokens/{{token_uid}}/authorize")
async def emsp_token_authorize(
    token_uid: str,
    request: Request,
    body: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(None),
    type: str = Query("RFID"),
):
    await _functional_partner(request, authorization)
    token = await db.ocpi_tokens.find_one({"uid": token_uid, "type": type, "active": True}, {"_id": 0})
    if not token:
        raise HTTPException(404, "Token not found")
    user_id = token.get("user_id")
    allowed = bool(token.get("valid", True))
    if user_id and allowed:
        allowed = (await get_user_balance(str(user_id))) >= float(token.get("minimum_balance") or 1.0)
    return _ocpi({
        "allowed": "ALLOWED" if allowed else "BLOCKED",
        "token": {k: v for k, v in token.items() if k != "user_id"},
        "authorization_reference": f"BB-{secrets.token_hex(6).upper()}",
        "location": body or None,
    })


class OCPITokenAdminBody(BaseModel):
    uid: str
    user_id: str
    type: str = "APP_USER"
    contract_id: Optional[str] = None
    valid: bool = True
    whitelist: str = "ALLOWED"
    minimum_balance: float = Field(default=1.0, ge=0)


@router.post("/admin/tokens")
async def admin_create_ocpi_token(body: OCPITokenAdminBody, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin" and user.get("is_admin") is not True:
        raise HTTPException(403, "Admin only")
    doc = {
        "country_code": OCPI_COUNTRY_CODE,
        "party_id": OCPI_PARTY_ID,
        "uid": body.uid,
        "type": body.type,
        "contract_id": body.contract_id or str(body.user_id)[:36],
        "visual_number": body.uid,
        "issuer": OCPI_BUSINESS_NAME,
        "group_id": None,
        "valid": body.valid,
        "whitelist": body.whitelist,
        "language": "de",
        "default_profile_type": "GREEN",
        "user_id": body.user_id,
        "minimum_balance": body.minimum_balance,
        "active": True,
        "last_updated": _now(),
    }
    await db.ocpi_tokens.update_one(
        {"uid": body.uid, "type": body.type},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "token": {k: v for k, v in doc.items() if k != "user_id"}}


@router.get("/admin/partners")
async def admin_ocpi_partners(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin" and user.get("is_admin") is not True:
        raise HTTPException(403, "Admin only")
    docs = await db.ocpi_partners.find(
        {},
        {"_id": 0, "remote_token_enc": 0, "incoming_token_enc": 0, "incoming_token_hash": 0},
    ).sort("updated_at", -1).to_list(500)
    return {"partners": docs, "version": OCPI_VERSION}


@router.get("/admin/remote-locations")
async def admin_remote_locations(request: Request, limit: int = 200):
    user = await get_current_user(request)
    if user.get("role") != "admin" and user.get("is_admin") is not True:
        raise HTTPException(403, "Admin only")
    docs = await db.ocpi_remote_locations.find({}, {"_id": 0}).sort("received_at", -1).limit(min(limit, 1000)).to_list(1000)
    return {"locations": docs}
