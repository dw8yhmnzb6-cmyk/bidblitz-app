"""BidBlitz OCPI 2.2.1 roaming interface.

Implements the OCPI discovery/credentials handshake plus the core roaming data
modules used by CPO/eMSP integrations.  Partners are fail-closed: functional
modules require an active credentials token, and outbound partner secrets are
encrypted at rest.

No partner is contacted merely by importing or starting this module.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import ipaddress
import os
import secrets
import socket
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from cryptography.fernet import Fernet, InvalidToken
import httpx
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


def _auth_token_candidates(header: Optional[str]) -> List[str]:
    if not header:
        raise HTTPException(401, "Missing OCPI Authorization header")
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "token" or not value.strip():
        raise HTTPException(401, "Invalid OCPI Authorization header")

    raw = value.strip()
    candidates: List[str] = []
    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8").strip()
        if decoded:
            candidates.append(decoded)
    except Exception:
        pass
    # Compatibility for legacy 2.1.1/2.2 peers that did not Base64 encode.
    if raw not in candidates:
        candidates.append(raw)
    return candidates


async def _partner_from_auth(
    authorization: Optional[str],
    *,
    allow_bootstrap: bool = False,
) -> Optional[Dict[str, Any]]:
    candidates = _auth_token_candidates(authorization)
    if allow_bootstrap and OCPI_BOOTSTRAP_TOKEN:
        for token in candidates:
            if secrets.compare_digest(token, OCPI_BOOTSTRAP_TOKEN):
                return None

    for token in candidates:
        partner = await db.ocpi_partners.find_one(
            {"incoming_token_hash": _token_hash(token), "status": "active"},
            {"_id": 0},
        )
        if partner:
            return partner
    raise HTTPException(401, "Unknown or inactive OCPI credentials token")


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
            {"identifier": "commands", "role": "SENDER", "url": f"{base}/ocpi/emsp/{v}/commands"},
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


def _outbound_auth_header(token: str) -> str:
    encoded = base64.b64encode(token.encode("utf-8")).decode("ascii")
    return f"Token {encoded}"


async def _fetch_remote_endpoints(versions_url: str, remote_token: str) -> List[Dict[str, Any]]:
    """Fetch the partner's advertised 2.2.1 endpoints during credentials setup."""
    if not await _public_https_url(versions_url):
        raise HTTPException(400, "OCPI versions URL must be a public HTTPS URL")

    headers = {"Authorization": _outbound_auth_header(remote_token)}
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False, trust_env=False) as client:
            versions_res = await client.get(versions_url, headers=headers)
            versions_res.raise_for_status()
            versions_payload = versions_res.json()
            versions_data = versions_payload.get("data") or []
            selected = next(
                (item for item in versions_data if str(item.get("version")) == OCPI_VERSION),
                None,
            )
            if not selected or not selected.get("url"):
                raise HTTPException(400, f"Partner does not advertise OCPI {OCPI_VERSION}")
            details_url = str(selected["url"])
            if not await _public_https_url(details_url):
                raise HTTPException(400, "OCPI version-details URL must be a public HTTPS URL")

            details_res = await client.get(details_url, headers=headers)
            details_res.raise_for_status()
            details_payload = details_res.json()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Could not fetch partner OCPI endpoints: {str(exc)[:300]}")

    data = details_payload.get("data") or {}
    if str(data.get("version")) != OCPI_VERSION:
        raise HTTPException(400, "Partner returned a different OCPI version")
    endpoints = data.get("endpoints") or []
    if not endpoints:
        raise HTTPException(400, "Partner returned no OCPI endpoints")

    sanitized: List[Dict[str, Any]] = []
    for endpoint in endpoints:
        identifier = str(endpoint.get("identifier") or "")
        role = str(endpoint.get("role") or "")
        url = str(endpoint.get("url") or "")
        if not identifier or role not in ("SENDER", "RECEIVER") or not url:
            continue
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise HTTPException(400, f"Unsafe endpoint URL for module {identifier}")
        sanitized.append({"identifier": identifier, "role": role, "url": url})

    if not any(e["identifier"] == "credentials" for e in sanitized):
        raise HTTPException(400, "Partner did not advertise a credentials endpoint")
    return sanitized


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

    country, party = _partner_identity(body)
    partner_id = f"{country}:{party}"
    existing = await db.ocpi_partners.find_one({"partner_id": partner_id})
    if existing and existing.get("status") == "active":
        raise HTTPException(405, "OCPI partner already registered")

    remote_endpoints = await _fetch_remote_endpoints(remote_url, remote_token)
    our_token = secrets.token_urlsafe(32)
    doc = {
        "partner_id": partner_id,
        "country_code": country,
        "party_id": party,
        "roles": body.get("roles") or [],
        "versions_url": remote_url,
        "remote_endpoints": remote_endpoints,
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

    remote_endpoints = await _fetch_remote_endpoints(remote_url, remote_token)
    rotated = secrets.token_urlsafe(32)
    await db.ocpi_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$set": {
            "roles": body.get("roles") or [],
            "versions_url": remote_url,
            "remote_endpoints": remote_endpoints,
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


def _updated_window_query(
    base: Dict[str, Any],
    fields: List[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> Dict[str, Any]:
    if not date_from and not date_to:
        return dict(base)
    bounds: Dict[str, Any] = {}
    if date_from:
        bounds["$gte"] = date_from
    if date_to:
        bounds["$lt"] = date_to

    clauses: List[Dict[str, Any]] = []
    for index, field in enumerate(fields):
        clause: Dict[str, Any] = {field: dict(bounds)}
        for previous in fields[:index]:
            clause[previous] = {"$exists": False}
        clauses.append(clause)
    window = {"$or": clauses}
    return {"$and": [dict(base), window]} if base else window


def _page_headers(
    request: Request,
    response: Response,
    *,
    total: int,
    offset: int,
    limit: int,
) -> None:
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    next_offset = offset + limit
    if next_offset < total:
        next_url = request.url.include_query_params(offset=next_offset, limit=limit)
        response.headers["Link"] = f'<{next_url}>; rel="next"'


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
        "cdr_token": doc.get("ocpi_token") or {
            "country_code": OCPI_COUNTRY_CODE,
            "party_id": OCPI_PARTY_ID,
            "uid": str(doc.get("id_tag") or doc.get("user_id") or "UNKNOWN")[:36],
            "type": "APP_USER",
            "contract_id": str(doc.get("user_id") or "")[:36],
        },
        "auth_method": "COMMAND",
        "authorization_reference": (
            doc.get("authorization_reference")
            or doc.get("settlement_ref")
            or doc.get("reservation_ref")
        ),
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
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    query = _updated_window_query({"active": True}, ["updated_at", "created_at"], date_from, date_to)
    total = await db.ev_charge_points.count_documents(query)
    docs = await db.ev_charge_points.find(query).sort("created_at", 1).skip(offset).limit(limit).to_list(limit)
    data = [await _local_location(d) for d in docs]
    _page_headers(request, response, total=total, offset=offset, limit=limit)
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
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    query = _updated_window_query({}, ["updated_at", "created_at"], date_from, date_to)
    total = await db.ev_tariffs.count_documents(query)
    docs = await db.ev_tariffs.find(query).sort("created_at", 1).skip(offset).limit(limit).to_list(limit)
    data = [await _local_tariff(d) for d in docs]
    _page_headers(request, response, total=total, offset=offset, limit=limit)
    return _ocpi(data)


@router.get(f"/cpo/{OCPI_VERSION}/sessions")
async def cpo_sessions(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    partner = await _functional_partner(request, authorization)
    base = {
        "ocpi_external": True,
        "ocpi_partner_id": partner["partner_id"],
    }
    query = _updated_window_query(
        base,
        ["settled_at", "last_meter_at", "stopped_at", "started_at", "created_at"],
        date_from,
        date_to,
    )
    total = await db.ev_charging_sessions.count_documents(query)
    docs = await db.ev_charging_sessions.find(query).sort("created_at", 1).skip(offset).limit(limit).to_list(limit)
    _page_headers(request, response, total=total, offset=offset, limit=limit)
    return _ocpi([_local_session(d) for d in docs])


@router.get(f"/cpo/{OCPI_VERSION}/cdrs")
async def cpo_cdrs(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    partner = await _functional_partner(request, authorization)
    base = {
        "roaming": True,
        "ocpi_partner_id": partner["partner_id"],
    }
    query = _updated_window_query(base, ["updated_at", "issued_at"], date_from, date_to)
    total = await db.ev_receipts.count_documents(query)
    receipts = await db.ev_receipts.find(query).sort("issued_at", 1).skip(offset).limit(limit).to_list(limit)
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
            "authorization_reference": sess.get("authorization_reference"),
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
    _page_headers(request, response, total=total, offset=offset, limit=limit)
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


async def _sync_remote_session_to_local(
    partner: Dict[str, Any],
    country_code: str,
    party_id: str,
    remote_session_id: str,
    body: Dict[str, Any],
) -> None:
    authorization_reference = body.get("authorization_reference")
    match: Dict[str, Any] = {
        "ocpi_roaming": True,
        "ocpi_partner_id": partner["partner_id"],
    }
    candidates: List[Dict[str, Any]] = [{"ocpi_remote_session_id": remote_session_id}]
    if authorization_reference:
        candidates.insert(0, {"authorization_reference": authorization_reference})
    match["$or"] = candidates

    local = await db.ev_charging_sessions.find_one(match)
    if not local:
        return

    remote_status = str(body.get("status") or "PENDING").upper()
    if local.get("status") == "completed":
        local_status = "completed"
    else:
        local_status = {
            "PENDING": "starting",
            "ACTIVE": "active",
            "COMPLETED": "roaming_waiting_cdr",
            "INVALID": "failed",
        }.get(remote_status, local.get("status") or "starting")

    total_cost = body.get("total_cost") or {}
    current_cost = (
        total_cost.get("incl_vat")
        if total_cost.get("incl_vat") is not None
        else total_cost.get("excl_vat")
    )
    update: Dict[str, Any] = {
        "ocpi_remote_session_id": remote_session_id,
        "ocpi_remote_session_status": remote_status,
        "ocpi_remote_session_updated_at": body.get("last_updated") or _now(),
        "status": local_status,
        "kwh_charged": float(body.get("kwh") or local.get("kwh_charged") or 0),
    }
    if current_cost is not None:
        update["current_cost"] = round(float(current_cost), 2)
    if body.get("start_date_time"):
        update["started_at"] = body.get("start_date_time")
    if body.get("end_date_time"):
        update["stopped_at"] = body.get("end_date_time")

    await db.ev_charging_sessions.update_one(
        {"session_id": local["session_id"]},
        {"$set": update},
    )

    if remote_status == "INVALID":
        from routes.ev_charging import _refund_ev_reservation, _release_ev_user_session_claim
        refunded = await _refund_ev_reservation(local["session_id"], "ocpi_remote_session_invalid")
        if refunded:
            await _release_ev_user_session_claim(local.get("user_id"), local["session_id"])


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
async def emsp_session_put(
    country_code: str,
    party_id: str,
    session_id: str,
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    country = country_code.upper()
    party = party_id.upper()
    if country != partner["country_code"] or party != partner["party_id"]:
        return _ocpi(status_code=2001, message="Session owner does not match authenticated partner")
    await _upsert_remote(
        db.ocpi_remote_sessions,
        {"country_code": country, "party_id": party, "id": session_id},
        body,
        partner,
        patch=False,
    )
    await _sync_remote_session_to_local(partner, country, party, session_id, body)
    return _ocpi()


@router.patch(f"/emsp/{OCPI_VERSION}/sessions/{{country_code}}/{{party_id}}/{{session_id}}")
async def emsp_session_patch(
    country_code: str,
    party_id: str,
    session_id: str,
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    country = country_code.upper()
    party = party_id.upper()
    if country != partner["country_code"] or party != partner["party_id"]:
        return _ocpi(status_code=2001, message="Session owner does not match authenticated partner")
    stored = await _upsert_remote(
        db.ocpi_remote_sessions,
        {"country_code": country, "party_id": party, "id": session_id},
        body,
        partner,
        patch=True,
    )
    merged = await db.ocpi_remote_sessions.find_one(
        {"country_code": country, "party_id": party, "id": session_id},
        {"_id": 0},
    ) or stored
    await _sync_remote_session_to_local(partner, country, party, session_id, merged)
    return _ocpi()


@router.post(f"/emsp/{OCPI_VERSION}/cdrs")
async def emsp_cdr_post(
    request: Request,
    response: Response,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    country = str(body.get("country_code") or partner["country_code"]).upper()
    party = str(body.get("party_id") or partner["party_id"]).upper()
    cdr_id = str(body.get("id") or "")
    if not cdr_id:
        return _ocpi(status_code=2001, message="Missing required field: id")
    if country != partner["country_code"] or party != partner["party_id"]:
        return _ocpi(status_code=2001, message="CDR owner does not match authenticated partner")
    await _upsert_remote(
        db.ocpi_remote_cdrs,
        {"country_code": country, "party_id": party, "id": cdr_id},
        body,
        partner,
        patch=False,
    )

    local = None
    authorization_reference = body.get("authorization_reference")
    remote_session_id = body.get("session_id")
    if authorization_reference:
        local = await db.ev_charging_sessions.find_one({
            "ocpi_roaming": True,
            "ocpi_partner_id": partner["partner_id"],
            "authorization_reference": authorization_reference,
        })
    if not local and remote_session_id:
        local = await db.ev_charging_sessions.find_one({
            "ocpi_roaming": True,
            "ocpi_partner_id": partner["partner_id"],
            "ocpi_remote_session_id": remote_session_id,
        })
    if local:
        await db.ev_charging_sessions.update_one(
            {"session_id": local["session_id"]},
            {"$set": {
                "ocpi_remote_session_id": remote_session_id or local.get("ocpi_remote_session_id"),
                "ocpi_remote_cdr_id": cdr_id,
                "stopped_at": body.get("end_date_time") or local.get("stopped_at"),
            }},
        )
        from routes.ev_charging import settle_roaming_cdr
        await settle_roaming_cdr(local["session_id"], body)

    response.headers["Location"] = (
        f"{_public_base(request)}/ocpi/emsp/{OCPI_VERSION}/cdrs/"
        f"{country}/{party}/{cdr_id}"
    )
    return _ocpi({"id": cdr_id})


@router.get(f"/emsp/{OCPI_VERSION}/cdrs/{{country_code}}/{{party_id}}/{{cdr_id}}")
async def emsp_cdr_get(
    country_code: str,
    party_id: str,
    cdr_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    country = country_code.upper()
    party = party_id.upper()
    if country != partner["country_code"] or party != partner["party_id"]:
        raise HTTPException(404, "CDR not found")
    cdr = await db.ocpi_remote_cdrs.find_one(
        {"country_code": country, "party_id": party, "id": cdr_id},
        {"_id": 0, "source_partner_id": 0, "received_at": 0},
    )
    if not cdr:
        raise HTTPException(404, "CDR not found")
    return _ocpi(cdr)


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
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(OCPI_DEFAULT_LIMIT, ge=1, le=OCPI_MAX_LIMIT),
):
    await _functional_partner(request, authorization)
    query = _updated_window_query({"active": True}, ["last_updated", "created_at"], date_from, date_to)
    total = await db.ocpi_tokens.count_documents(query)
    docs = await db.ocpi_tokens.find(
        query,
        {"_id": 0, "user_id": 0, "minimum_balance": 0, "active": 0},
    ).sort("last_updated", 1).skip(offset).limit(limit).to_list(limit)
    _page_headers(request, response, total=total, offset=offset, limit=limit)
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


def _partner_endpoint(partner: Dict[str, Any], identifier: str, role: str) -> Optional[str]:
    for endpoint in partner.get("remote_endpoints") or []:
        if endpoint.get("identifier") == identifier and endpoint.get("role") == role:
            return str(endpoint.get("url") or "")
    return None


async def send_remote_command(
    partner: Dict[str, Any],
    command: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Send an OCPI command to a partner CPO and return its direct CommandResponse."""
    endpoint = _partner_endpoint(partner, "commands", "RECEIVER")
    if not endpoint:
        return {"result": "NOT_SUPPORTED", "message": "Partner has no Commands receiver endpoint"}

    target = f"{endpoint.rstrip('/')}/{command}"
    if not await _public_https_url(target):
        return {"result": "REJECTED", "message": "Partner Commands endpoint is not a safe public HTTPS URL"}

    remote_token = _decrypt_token(partner.get("remote_token_enc"))
    if not remote_token:
        return {"result": "REJECTED", "message": "Partner credentials token unavailable"}

    headers = {
        "Authorization": _outbound_auth_header(remote_token),
        "Content-Type": "application/json",
        "OCPI-from-country-code": OCPI_COUNTRY_CODE,
        "OCPI-from-party-id": OCPI_PARTY_ID,
        "OCPI-to-country-code": partner["country_code"],
        "OCPI-to-party-id": partner["party_id"],
    }
    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            res = await client.post(target, json=payload, headers=headers)
        if not (200 <= res.status_code < 300):
            return {"result": "REJECTED", "message": f"Partner HTTP {res.status_code}"}
        envelope = res.json()
        if int(envelope.get("status_code", 0) or 0) != 1000:
            return {
                "result": "REJECTED",
                "message": str(envelope.get("status_message") or "Partner returned OCPI error")[:300],
            }
        data = envelope.get("data") or {}
        result = str(data.get("result") or "REJECTED")
        if result not in {"NOT_SUPPORTED", "REJECTED", "ACCEPTED", "UNKNOWN_SESSION"}:
            result = "REJECTED"
        return {
            "result": result,
            "timeout": int(data.get("timeout") or 30),
            "message": data.get("message"),
        }
    except Exception as exc:
        return {"result": "REJECTED", "message": str(exc)[:300]}


@router.post(f"/emsp/{OCPI_VERSION}/commands/{{command_id}}")
async def receive_remote_command_result(
    command_id: str,
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    command = await db.ocpi_outbound_commands.find_one({
        "command_id": command_id,
        "partner_id": partner["partner_id"],
    })
    if not command:
        raise HTTPException(404, "Unknown OCPI command")

    result = str(body.get("result") or "FAILED")
    valid_results = {
        "ACCEPTED", "CANCELED_RESERVATION", "EVSE_OCCUPIED",
        "EVSE_INOPERATIVE", "FAILED", "NOT_SUPPORTED", "REJECTED",
        "TIMEOUT", "UNKNOWN_RESERVATION",
    }
    if result not in valid_results:
        return _ocpi(status_code=2001, message="Invalid CommandResult.result")

    await db.ocpi_outbound_commands.update_one(
        {"command_id": command_id},
        {"$set": {
            "result": result,
            "result_message": body.get("message"),
            "status": "finished",
            "result_received_at": _now(),
            "updated_at": _now(),
        }},
    )

    local_session_id = command.get("local_session_id")
    if local_session_id:
        if command.get("command") == "START_SESSION":
            if result == "ACCEPTED":
                await db.ev_charging_sessions.update_one(
                    {"session_id": local_session_id},
                    {"$set": {
                        "ocpi_start_result": result,
                        "ocpi_start_result_at": _now(),
                    }},
                )
            else:
                sess = await db.ev_charging_sessions.find_one({"session_id": local_session_id}) or {}
                remote_evidence = bool(sess.get("ocpi_remote_session_id")) or sess.get("status") in {
                    "active", "roaming_waiting_cdr", "completed",
                }
                if remote_evidence:
                    # Session push can race ahead of the asynchronous CommandResult.
                    # Never refund an already-started remote charging session.
                    await db.ev_charging_sessions.update_one(
                        {"session_id": local_session_id},
                        {"$set": {
                            "ocpi_start_result": result,
                            "ocpi_start_result_at": _now(),
                            "ocpi_command_anomaly": (
                                f"CommandResult={result} arrived after remote session became active"
                            ),
                        }},
                    )
                else:
                    await db.ev_charging_sessions.update_one(
                        {"session_id": local_session_id},
                        {"$set": {
                            "status": "failed",
                            "ocpi_start_result": result,
                            "ocpi_start_result_at": _now(),
                            "error": f"Roaming start failed: {result}",
                        }},
                    )
                    # Release a user reservation only when no remote charging
                    # session exists. Import locally to avoid router cycles.
                    from routes.ev_charging import _refund_ev_reservation, _release_ev_user_session_claim
                    refunded = await _refund_ev_reservation(local_session_id, f"ocpi_start_{result.lower()}")
                    if refunded:
                        await _release_ev_user_session_claim(sess.get("user_id"), local_session_id)
        elif command.get("command") == "STOP_SESSION":
            await db.ev_charging_sessions.update_one(
                {"session_id": local_session_id},
                {"$set": {
                    "ocpi_stop_result": result,
                    "ocpi_stop_result_at": _now(),
                }},
            )

    return _ocpi()


def _cp_protocol(cp: Dict[str, Any]) -> str:
    value = str((cp or {}).get("protocol") or "ocpp1.6")
    return "ocpp2.0.1" if value.startswith("ocpp2") else "ocpp1.6"


def _cp_online(cp: Dict[str, Any]) -> bool:
    cp_id = cp.get("charge_point_id")
    if not cp_id:
        return False
    return ocpp_v201.is_online(cp_id) if _cp_protocol(cp) == "ocpp2.0.1" else ocpp_csms.is_online(cp_id)


def _command_response(result: str, timeout: int = 30, message: Optional[str] = None) -> Dict[str, Any]:
    # OCPI 2.2.1 CommandResponseType:
    # NOT_SUPPORTED | REJECTED | ACCEPTED | UNKNOWN_SESSION
    if result not in {"NOT_SUPPORTED", "REJECTED", "ACCEPTED", "UNKNOWN_SESSION"}:
        result = "REJECTED"
    data: Dict[str, Any] = {"result": result, "timeout": timeout}
    if message:
        data["message"] = [{"language": "en", "text": message[:512]}]
    return _ocpi(data)


async def _public_https_url(url: str) -> bool:
    """SSRF guard for partner supplied callback/versions URLs."""
    try:
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            return False
        host = parsed.hostname.lower()
        if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
            return False
        allow = {
            h.strip().lower()
            for h in os.environ.get("OCPI_CALLBACK_HOST_ALLOWLIST", "").split(",")
            if h.strip()
        }
        if host in allow:
            return True
        port = parsed.port or 443
        infos = await asyncio.to_thread(socket.getaddrinfo, host, port, type=socket.SOCK_STREAM)
        ips = {info[4][0] for info in infos}
        if not ips:
            return False
        for value in ips:
            ip = ipaddress.ip_address(value)
            if not ip.is_global:
                return False
        return True
    except Exception:
        return False


async def _post_command_result(
    partner: Dict[str, Any],
    response_url: Optional[str],
    command_id: str,
    result: str,
    message: Optional[str] = None,
) -> None:
    # CommandResultType:
    # ACCEPTED, CANCELED_RESERVATION, EVSE_OCCUPIED, EVSE_INOPERATIVE,
    # FAILED, NOT_SUPPORTED, REJECTED, TIMEOUT, UNKNOWN_RESERVATION.
    allowed = {
        "ACCEPTED", "CANCELED_RESERVATION", "EVSE_OCCUPIED",
        "EVSE_INOPERATIVE", "FAILED", "NOT_SUPPORTED", "REJECTED",
        "TIMEOUT", "UNKNOWN_RESERVATION",
    }
    if result not in allowed:
        result = "FAILED"

    payload: Dict[str, Any] = {"result": result}
    if message:
        payload["message"] = [{"language": "en", "text": message[:512]}]

    if not response_url or not await _public_https_url(response_url):
        await db.ocpi_command_logs.update_one(
            {"command_id": command_id},
            {"$set": {
                "callback_status": "blocked",
                "callback_error": "Missing or unsafe response_url",
                "command_result": result,
                "updated_at": _now(),
            }},
        )
        return

    remote_token = _decrypt_token(partner.get("remote_token_enc"))
    if not remote_token:
        await db.ocpi_command_logs.update_one(
            {"command_id": command_id},
            {"$set": {
                "callback_status": "failed",
                "callback_error": "Partner token unavailable",
                "command_result": result,
                "updated_at": _now(),
            }},
        )
        return

    encoded = base64.b64encode(remote_token.encode("utf-8")).decode("ascii")
    headers = {
        "Authorization": f"Token {encoded}",
        "Content-Type": "application/json",
        "OCPI-from-country-code": OCPI_COUNTRY_CODE,
        "OCPI-from-party-id": OCPI_PARTY_ID,
        "OCPI-to-country-code": partner["country_code"],
        "OCPI-to-party-id": partner["party_id"],
    }
    try:
        async with httpx.AsyncClient(
            timeout=8.0,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            res = await client.post(response_url, json=payload, headers=headers)
        await db.ocpi_command_logs.update_one(
            {"command_id": command_id},
            {"$set": {
                "callback_status": "delivered" if 200 <= res.status_code < 300 else "failed",
                "callback_http_status": res.status_code,
                "command_result": result,
                "updated_at": _now(),
            }},
        )
    except Exception as exc:
        await db.ocpi_command_logs.update_one(
            {"command_id": command_id},
            {"$set": {
                "callback_status": "failed",
                "callback_error": str(exc)[:500],
                "command_result": result,
                "updated_at": _now(),
            }},
        )


async def _find_local_cp(location_id: Optional[str], evse_uid: Optional[str]) -> Optional[Dict[str, Any]]:
    for candidate in (location_id, evse_uid):
        if not candidate:
            continue
        cp = await db.ev_charge_points.find_one({"charge_point_id": str(candidate), "active": True})
        if cp:
            return cp
    return None


def _remote_token_owned_by_partner(token: Dict[str, Any], partner: Dict[str, Any]) -> bool:
    country = str(token.get("country_code") or partner["country_code"]).upper()
    party = str(token.get("party_id") or partner["party_id"]).upper()
    return country == partner["country_code"] and party == partner["party_id"]


async def _run_start_session_command(
    partner: Dict[str, Any],
    command_id: str,
    session_id: str,
    cp: Dict[str, Any],
    connector_id: int,
    id_tag: str,
    response_url: Optional[str],
) -> None:
    try:
        if _cp_protocol(cp) == "ocpp2.0.1":
            result = await ocpp_v201.request_start_transaction(
                cp["charge_point_id"],
                connector_id,
                id_tag,
                remote_start_id=secrets.randbelow(1_000_000) + 1,
            )
        else:
            result = await ocpp_csms.remote_start(cp["charge_point_id"], connector_id, id_tag)
        remote_status = (result or {}).get("status")
        if remote_status == "Accepted":
            command_result, message = "ACCEPTED", None
            await db.ev_charging_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "starting", "ocpi_command_result": command_result}},
            )
        else:
            command_result, message = "REJECTED", f"Charge point returned {remote_status}"
            await db.ev_charging_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "rejected", "error": message}},
            )
            await db.ev_authorizations.update_one({"id_tag": id_tag}, {"$set": {"active": False}})
    except asyncio.TimeoutError:
        command_result, message = "TIMEOUT", "Charge point command timed out"
        await db.ev_charging_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "error": message}},
        )
    except Exception as exc:
        command_result, message = "FAILED", str(exc)[:300]
        await db.ev_charging_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "error": message}},
        )

    await db.ocpi_command_logs.update_one(
        {"command_id": command_id},
        {"$set": {"status": "finished", "command_result": command_result, "updated_at": _now()}},
    )
    await _post_command_result(partner, response_url, command_id, command_result, message)


async def _run_stop_session_command(
    partner: Dict[str, Any],
    command_id: str,
    sess: Dict[str, Any],
    cp: Dict[str, Any],
    response_url: Optional[str],
) -> None:
    transaction_id = sess.get("ocpp_transaction_id")
    try:
        if transaction_id is None:
            command_result, message = "FAILED", "Charging transaction is not active"
        else:
            if _cp_protocol(cp) == "ocpp2.0.1":
                result = await ocpp_v201.request_stop_transaction(cp["charge_point_id"], transaction_id)
            else:
                result = await ocpp_csms.remote_stop(cp["charge_point_id"], transaction_id)
            remote_status = (result or {}).get("status")
            if not remote_status or remote_status in ("Accepted", "Scheduled"):
                command_result, message = "ACCEPTED", None
                await db.ev_charging_sessions.update_one(
                    {"session_id": sess["session_id"]},
                    {"$set": {"status": "stopping", "ocpi_stop_requested_at": _now()}},
                )
            else:
                command_result, message = "REJECTED", f"Charge point returned {remote_status}"
    except asyncio.TimeoutError:
        command_result, message = "TIMEOUT", "Charge point command timed out"
    except Exception as exc:
        command_result, message = "FAILED", str(exc)[:300]

    await db.ocpi_command_logs.update_one(
        {"command_id": command_id},
        {"$set": {"status": "finished", "command_result": command_result, "updated_at": _now()}},
    )
    await _post_command_result(partner, response_url, command_id, command_result, message)


async def _run_unlock_command(
    partner: Dict[str, Any],
    command_id: str,
    cp: Dict[str, Any],
    connector_id: int,
    evse_id: int,
    response_url: Optional[str],
) -> None:
    try:
        if _cp_protocol(cp) == "ocpp2.0.1":
            result = await ocpp_v201.unlock_connector(
                cp["charge_point_id"], evse_id=evse_id, connector_id=connector_id
            )
        else:
            result = await ocpp_csms.unlock_connector(cp["charge_point_id"], connector_id)
        remote_status = (result or {}).get("status")
        command_result = "ACCEPTED" if remote_status in (None, "Unlocked", "Accepted") else "REJECTED"
        message = None if command_result == "ACCEPTED" else f"Charge point returned {remote_status}"
    except asyncio.TimeoutError:
        command_result, message = "TIMEOUT", "Charge point command timed out"
    except Exception as exc:
        command_result, message = "FAILED", str(exc)[:300]

    await db.ocpi_command_logs.update_one(
        {"command_id": command_id},
        {"$set": {"status": "finished", "command_result": command_result, "updated_at": _now()}},
    )
    await _post_command_result(partner, response_url, command_id, command_result, message)


async def _next_ocpp_reservation_id() -> int:
    counter = await db.counters.find_one_and_update(
        {"_id": "ocpp_reservation_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return int((counter or {}).get("seq") or 1)


def _parse_future_expiry(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    if dt <= datetime.now(timezone.utc):
        return None
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


async def _reservation_tariff_snapshot(cp: Dict[str, Any]) -> Dict[str, Any]:
    tariff = None
    if cp.get("tariff_id"):
        tariff = await db.ev_tariffs.find_one({"_id": cp.get("tariff_id")})
        if not tariff:
            try:
                from bson import ObjectId
                tariff = await db.ev_tariffs.find_one({"_id": ObjectId(str(cp.get("tariff_id")))})
            except Exception:
                tariff = None
    return {
        "tariff_id": str(cp.get("tariff_id") or ""),
        "price_per_kwh": float((tariff or {}).get("price_per_kwh") or 0),
        "price_per_minute": float((tariff or {}).get("price_per_minute") or 0),
        "session_fee": float((tariff or {}).get("session_fee") or 0),
        "idle_fee_per_minute": float((tariff or {}).get("idle_fee_per_minute") or 0),
        "minimum_fee": float((tariff or {}).get("minimum_fee") or 0),
        "currency": (tariff or {}).get("currency") or "EUR",
        "vat_rate": float((tariff or {}).get("vat_rate") or 0),
    }


async def _run_reserve_now_command(
    partner: Dict[str, Any],
    command_id: str,
    reservation_key: Dict[str, Any],
    cp: Dict[str, Any],
    id_tag: str,
    expiry_date: str,
    response_url: Optional[str],
) -> None:
    reservation = await db.ocpi_reservations.find_one(reservation_key)
    if not reservation:
        await _post_command_result(partner, response_url, command_id, "FAILED", "Reservation state missing")
        return

    internal_id = int(reservation["ocpp_reservation_id"])
    try:
        if _cp_protocol(cp) == "ocpp2.0.1":
            result = await ocpp_v201.reserve_now(
                cp["charge_point_id"],
                reservation_id=internal_id,
                expiry_date_time=expiry_date,
                id_token=id_tag,
                evse_id=int(reservation.get("evse_id") or 1),
            )
        else:
            result = await ocpp_csms.reserve_now(
                cp["charge_point_id"],
                connector_id=int(reservation.get("connector_id") or 0),
                expiry_date=expiry_date,
                id_tag=id_tag,
                reservation_id=internal_id,
            )
        remote_status = str((result or {}).get("status") or "")
        mapping = {
            "Accepted": "ACCEPTED",
            "Occupied": "EVSE_OCCUPIED",
            "Faulted": "EVSE_INOPERATIVE",
            "Unavailable": "EVSE_INOPERATIVE",
            "Rejected": "REJECTED",
        }
        command_result = mapping.get(remote_status, "FAILED")
        message = None if command_result == "ACCEPTED" else f"Charge point returned {remote_status or 'unknown'}"
    except asyncio.TimeoutError:
        command_result, message = "TIMEOUT", "Charge point reservation timed out"
    except Exception as exc:
        command_result, message = "FAILED", str(exc)[:300]

    update = {
        "status": "reserved" if command_result == "ACCEPTED" else "failed",
        "command_result": command_result,
        "updated_at": _now(),
    }
    if message:
        update["error"] = message
    await db.ocpi_reservations.update_one(reservation_key, {"$set": update})

    session_id = reservation.get("session_id")
    if session_id:
        await db.ev_charging_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "reserved" if command_result == "ACCEPTED" else "rejected",
                "ocpi_command_result": command_result,
                "error": message,
            }},
        )
    if command_result != "ACCEPTED":
        await db.ev_authorizations.update_one(
            {"id_tag": id_tag},
            {"$set": {"active": False, "used_at": _now()}},
        )

    await db.ocpi_command_logs.update_one(
        {"command_id": command_id},
        {"$set": {"status": "finished", "command_result": command_result, "updated_at": _now()}},
    )
    await _post_command_result(partner, response_url, command_id, command_result, message)


async def _run_cancel_reservation_command(
    partner: Dict[str, Any],
    command_id: str,
    reservation_key: Dict[str, Any],
    cp: Dict[str, Any],
    response_url: Optional[str],
) -> None:
    reservation = await db.ocpi_reservations.find_one(reservation_key)
    if not reservation:
        await _post_command_result(partner, response_url, command_id, "UNKNOWN_RESERVATION", "Reservation not found")
        return

    internal_id = int(reservation["ocpp_reservation_id"])
    try:
        if _cp_protocol(cp) == "ocpp2.0.1":
            result = await ocpp_v201.cancel_reservation(cp["charge_point_id"], internal_id)
        else:
            result = await ocpp_csms.cancel_reservation(cp["charge_point_id"], internal_id)
        remote_status = str((result or {}).get("status") or "")
        if remote_status == "Accepted":
            command_result, message = "ACCEPTED", None
        else:
            command_result, message = "REJECTED", f"Charge point returned {remote_status or 'unknown'}"
    except asyncio.TimeoutError:
        command_result, message = "TIMEOUT", "Cancel reservation timed out"
    except Exception as exc:
        command_result, message = "FAILED", str(exc)[:300]

    if command_result == "ACCEPTED":
        await db.ocpi_reservations.update_one(
            reservation_key,
            {"$set": {"status": "cancelled", "cancelled_at": _now(), "updated_at": _now()}},
        )
        if reservation.get("session_id"):
            await db.ev_charging_sessions.update_one(
                {"session_id": reservation["session_id"], "status": {"$in": ["reserved", "reserving"]}},
                {"$set": {"status": "cancelled", "stopped_at": _now()}},
            )
        if reservation.get("id_tag"):
            await db.ev_authorizations.update_one(
                {"id_tag": reservation["id_tag"]},
                {"$set": {"active": False, "used_at": _now()}},
            )

    await db.ocpi_command_logs.update_one(
        {"command_id": command_id},
        {"$set": {"status": "finished", "command_result": command_result, "updated_at": _now()}},
    )
    await _post_command_result(partner, response_url, command_id, command_result, message)


@router.post(f"/cpo/{OCPI_VERSION}/commands/RESERVE_NOW")
async def command_reserve_now(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    response_url = body.get("response_url")
    token = body.get("token") or {}
    reservation_id = str(body.get("reservation_id") or "")
    location_id = str(body.get("location_id") or "")
    expiry_date = _parse_future_expiry(body.get("expiry_date"))
    if not response_url or not token.get("uid") or not reservation_id or not location_id or not expiry_date:
        return _command_response(
            "REJECTED",
            message="response_url, token, expiry_date, reservation_id and location_id are required",
        )
    if len(reservation_id) > 36:
        return _command_response("REJECTED", message="reservation_id exceeds 36 characters")
    if not _remote_token_owned_by_partner(token, partner):
        return _command_response("REJECTED", message="Token is not owned by requesting eMSP")

    cp = await _find_local_cp(location_id, body.get("evse_uid"))
    if not cp:
        return _command_response("REJECTED", message="Unknown location/EVSE")
    if not _cp_online(cp):
        return _command_response("REJECTED", message="Charge point offline")

    reservation_key = {
        "partner_id": partner["partner_id"],
        "external_reservation_id": reservation_id,
    }
    existing = await db.ocpi_reservations.find_one(reservation_key)
    internal_id = int(existing.get("ocpp_reservation_id")) if existing else await _next_ocpp_reservation_id()
    session_id = (existing or {}).get("session_id") or f"ocpir_{secrets.token_hex(7)}"
    token_uid = str(token["uid"])
    token_type = str(token.get("type") or "RFID")
    id_tag = (existing or {}).get("id_tag") or (
        "OCPIR" + hashlib.sha256(
            f"{partner['partner_id']}:{reservation_id}:{token_uid}:{token_type}".encode("utf-8")
        ).hexdigest()[:15].upper()
    )
    tariff_snapshot = await _reservation_tariff_snapshot(cp)

    # For OCPP 1.6, connectorId=0 lets the charge point choose any connector.
    # OCPP 2.0.1 can reserve a specific EVSE when our mapping is known.
    evse_id = 1
    connector_id = 0
    await db.ev_authorizations.update_one(
        {"id_tag": id_tag},
        {"$set": {
            "id_tag": id_tag,
            "user_id": None,
            "active": True,
            "ocpi_partner_id": partner["partner_id"],
            "ocpi_token_uid": token_uid,
            "created_at": (existing or {}).get("created_at") or _now(),
            "expires_at": expiry_date,
        }},
        upsert=True,
    )

    await db.ev_charging_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "session_id": session_id,
            "charge_point_id": cp["charge_point_id"],
            "connector_id": connector_id,
            "user_id": None,
            "id_tag": id_tag,
            "tariff": tariff_snapshot,
            "reserved_amount": 0.0,
            "currency": tariff_snapshot["currency"],
            "kwh_charged": 0.0,
            "current_cost": 0.0,
            "status": "reserving",
            "ocpi_external": True,
            "ocpi_partner_id": partner["partner_id"],
            "ocpi_token": token,
            "authorization_reference": body.get("authorization_reference"),
            "ocpi_reservation_id": reservation_id,
            "ocpp_reservation_id": internal_id,
            "reservation_expiry": expiry_date,
            "created_at": (existing or {}).get("created_at") or _now(),
            "updated_at": _now(),
        }},
        upsert=True,
    )

    await db.ocpi_reservations.update_one(
        reservation_key,
        {"$set": {
            **reservation_key,
            "ocpp_reservation_id": internal_id,
            "session_id": session_id,
            "charge_point_id": cp["charge_point_id"],
            "evse_uid": body.get("evse_uid"),
            "evse_id": evse_id,
            "connector_id": connector_id,
            "id_tag": id_tag,
            "token": token,
            "expiry_date": expiry_date,
            "authorization_reference": body.get("authorization_reference"),
            "status": "reserving",
            "updated_at": _now(),
        }, "$setOnInsert": {"created_at": _now()}},
        upsert=True,
    )

    command_id = f"ocpi_cmd_{secrets.token_hex(8)}"
    await db.ocpi_command_logs.insert_one({
        "command_id": command_id,
        "command": "RESERVE_NOW",
        "partner_id": partner["partner_id"],
        "reservation_id": reservation_id,
        "session_id": session_id,
        "response_url": response_url,
        "status": "accepted",
        "created_at": _now(),
    })
    asyncio.create_task(_run_reserve_now_command(
        partner, command_id, reservation_key, cp, id_tag, expiry_date, response_url
    ))
    return _command_response("ACCEPTED")


@router.post(f"/cpo/{OCPI_VERSION}/commands/CANCEL_RESERVATION")
async def command_cancel_reservation(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    response_url = body.get("response_url")
    reservation_id = str(body.get("reservation_id") or "")
    if not response_url or not reservation_id:
        return _command_response("REJECTED", message="response_url and reservation_id are required")

    reservation_key = {
        "partner_id": partner["partner_id"],
        "external_reservation_id": reservation_id,
    }
    reservation = await db.ocpi_reservations.find_one(reservation_key)
    if not reservation or reservation.get("status") not in {"reserved", "reserving"}:
        return _command_response("REJECTED", message="Reservation not active")

    cp = await db.ev_charge_points.find_one({
        "charge_point_id": reservation.get("charge_point_id"),
        "active": True,
    })
    if not cp or not _cp_online(cp):
        return _command_response("REJECTED", message="Charge point offline or unavailable")

    command_id = f"ocpi_cmd_{secrets.token_hex(8)}"
    await db.ocpi_command_logs.insert_one({
        "command_id": command_id,
        "command": "CANCEL_RESERVATION",
        "partner_id": partner["partner_id"],
        "reservation_id": reservation_id,
        "session_id": reservation.get("session_id"),
        "response_url": response_url,
        "status": "accepted",
        "created_at": _now(),
    })
    asyncio.create_task(_run_cancel_reservation_command(
        partner, command_id, reservation_key, cp, response_url
    ))
    return _command_response("ACCEPTED")


@router.post(f"/cpo/{OCPI_VERSION}/commands/START_SESSION")
async def command_start_session(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    token = body.get("token") or {}
    token_uid = str(token.get("uid") or "")
    token_type = str(token.get("type") or "RFID")
    response_url = body.get("response_url")
    location_id = body.get("location_id")
    if not token_uid or not response_url or not location_id:
        return _command_response("REJECTED", message="response_url, token and location_id are required")
    if not _remote_token_owned_by_partner(token, partner):
        return _command_response("REJECTED", message="Token is not owned by requesting eMSP")

    cp = await _find_local_cp(location_id, body.get("evse_uid"))
    if not cp:
        return _command_response("REJECTED", message="Unknown location/EVSE")
    if not _cp_online(cp):
        return _command_response("REJECTED", message="Charge point offline")

    try:
        connector_id = int(body.get("connector_id") or 1)
    except (TypeError, ValueError):
        return _command_response("REJECTED", message="Invalid connector_id")

    connector = await db.ev_connectors.find_one({
        "charge_point_id": cp["charge_point_id"],
        "connector_id": connector_id,
    })
    if connector and str(connector.get("status") or "").lower() not in ("", "available", "preparing"):
        return _command_response("REJECTED", message="Connector is not available")

    # CPO SHALL NOT validate the Token's validity for START_SESSION: the eMSP
    # already authorized it. Unknown APP_USER/AD_HOC tokens are valid here.
    command_id = f"ocpi_cmd_{secrets.token_hex(8)}"
    session_id = f"ocpi_{secrets.token_hex(8)}"
    id_tag = "OCPI" + hashlib.sha256(
        f"{partner['partner_id']}:{token_uid}:{token_type}:{command_id}".encode("utf-8")
    ).hexdigest()[:16].upper()

    tariff = None
    if cp.get("tariff_id"):
        tariff = await db.ev_tariffs.find_one({"_id": cp.get("tariff_id")})
        if not tariff:
            try:
                from bson import ObjectId
                tariff = await db.ev_tariffs.find_one({"_id": ObjectId(str(cp.get("tariff_id")))})
            except Exception:
                tariff = None
    tariff_snapshot = {
        "tariff_id": str(cp.get("tariff_id") or ""),
        "price_per_kwh": float((tariff or {}).get("price_per_kwh") or 0),
        "price_per_minute": float((tariff or {}).get("price_per_minute") or 0),
        "session_fee": float((tariff or {}).get("session_fee") or 0),
        "idle_fee_per_minute": float((tariff or {}).get("idle_fee_per_minute") or 0),
        "minimum_fee": float((tariff or {}).get("minimum_fee") or 0),
        "currency": (tariff or {}).get("currency") or "EUR",
        "vat_rate": float((tariff or {}).get("vat_rate") or 0),
    }

    await db.ev_authorizations.update_one(
        {"id_tag": id_tag},
        {"$set": {
            "id_tag": id_tag,
            "user_id": None,
            "active": True,
            "ocpi_partner_id": partner["partner_id"],
            "ocpi_token_uid": token_uid,
            "created_at": _now(),
            "expires_at": None,
        }},
        upsert=True,
    )
    await db.ev_charging_sessions.insert_one({
        "session_id": session_id,
        "charge_point_id": cp["charge_point_id"],
        "connector_id": connector_id,
        "user_id": None,
        "id_tag": id_tag,
        "tariff": tariff_snapshot,
        "reserved_amount": 0.0,
        "currency": tariff_snapshot["currency"],
        "kwh_charged": 0.0,
        "current_cost": 0.0,
        "status": "authorized",
        "ocpi_external": True,
        "ocpi_partner_id": partner["partner_id"],
        "ocpi_token": {
            "country_code": token.get("country_code") or partner["country_code"],
            "party_id": token.get("party_id") or partner["party_id"],
            "uid": token_uid,
            "type": token_type,
            "contract_id": token.get("contract_id"),
        },
        "authorization_reference": body.get("authorization_reference"),
        "ocpi_command_id": command_id,
        "created_at": _now(),
    })
    await db.ocpi_command_logs.insert_one({
        "command_id": command_id,
        "command": "START_SESSION",
        "partner_id": partner["partner_id"],
        "session_id": session_id,
        "response_url": response_url,
        "status": "accepted",
        "created_at": _now(),
    })

    asyncio.create_task(_run_start_session_command(
        partner, command_id, session_id, cp, connector_id, id_tag, response_url
    ))
    return _command_response("ACCEPTED")


@router.post(f"/cpo/{OCPI_VERSION}/commands/STOP_SESSION")
async def command_stop_session(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    session_id = str(body.get("session_id") or "")
    response_url = body.get("response_url")
    if not session_id or not response_url:
        return _command_response("REJECTED", message="response_url and session_id are required")

    sess = await db.ev_charging_sessions.find_one({
        "session_id": session_id,
        "ocpi_external": True,
        "ocpi_partner_id": partner["partner_id"],
    })
    if not sess:
        return _command_response("UNKNOWN_SESSION", message="Unknown roaming session")

    cp = await db.ev_charge_points.find_one({"charge_point_id": sess.get("charge_point_id")})
    if not cp:
        return _command_response("REJECTED", message="Charge point not found")
    if sess.get("status") in ("completed", "cancelled", "failed"):
        return _command_response("UNKNOWN_SESSION", message="Session is not active")

    command_id = f"ocpi_cmd_{secrets.token_hex(8)}"
    await db.ocpi_command_logs.insert_one({
        "command_id": command_id,
        "command": "STOP_SESSION",
        "partner_id": partner["partner_id"],
        "session_id": session_id,
        "response_url": response_url,
        "status": "accepted",
        "created_at": _now(),
    })
    asyncio.create_task(_run_stop_session_command(
        partner, command_id, sess, cp, response_url
    ))
    return _command_response("ACCEPTED")


@router.post(f"/cpo/{OCPI_VERSION}/commands/UNLOCK_CONNECTOR")
async def command_unlock_connector(
    request: Request,
    body: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    partner = await _functional_partner(request, authorization)
    response_url = body.get("response_url")
    location_id = body.get("location_id")
    evse_uid = body.get("evse_uid")
    connector_raw = body.get("connector_id")
    if not response_url or not location_id or not evse_uid or connector_raw is None:
        return _command_response(
            "REJECTED",
            message="response_url, location_id, evse_uid and connector_id are required",
        )

    cp = await _find_local_cp(location_id, evse_uid)
    if not cp:
        return _command_response("REJECTED", message="Unknown location/EVSE")
    if not _cp_online(cp):
        return _command_response("REJECTED", message="Charge point offline")
    try:
        connector_id = int(connector_raw)
        evse_id = int(body.get("evse_id") or 1)
    except (TypeError, ValueError):
        return _command_response("REJECTED", message="Invalid EVSE/connector id")

    command_id = f"ocpi_cmd_{secrets.token_hex(8)}"
    await db.ocpi_command_logs.insert_one({
        "command_id": command_id,
        "command": "UNLOCK_CONNECTOR",
        "partner_id": partner["partner_id"],
        "charge_point_id": cp["charge_point_id"],
        "connector_id": connector_id,
        "response_url": response_url,
        "status": "accepted",
        "created_at": _now(),
    })
    asyncio.create_task(_run_unlock_command(
        partner, command_id, cp, connector_id, evse_id, response_url
    ))
    return _command_response("ACCEPTED")


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
