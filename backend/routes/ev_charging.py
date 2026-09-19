"""
BidBlitz EV Charging — Customer + Operator + Admin REST API.

Production-ready. All money flows go through core.payment_engine. No fake
simulation: charging hardware must connect via OCPP-1.6J at
/api/ev/ocpp/v16/{charge_point_id}.
"""
from __future__ import annotations

import secrets
import hashlib
import base64
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, WebSocket
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.database import db
from core.config import TEST_MODE
from core.money import to_minor, from_minor
from core.security import get_current_user
from core.payment_engine import (
    debit_wallet,
    transfer_between_wallets,
    TransactionType,
)
from services import ocpp_csms
from services import ocpp_v201
from services.ev_receipt import render_receipt

router = APIRouter(prefix="/api/ev", tags=["ev_charging"])


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_admin(user: Dict[str, Any]) -> bool:
    return user.get("role") == "admin" or user.get("is_admin") is True


# Default platform commission applied to operator revenue (override per operator).
DEFAULT_PLATFORM_COMMISSION_PCT = 12.0
DEFAULT_VAT_RATE_PCT = 19.0  # German VAT default; per-tariff override possible


# ══════════════════════════════════════════════════════════════════════════════
# OCPP WebSocket entry point — manufacturer charge points connect here
# ══════════════════════════════════════════════════════════════════════════════
def _hash_ocpp_token(token: str) -> str:
    return hashlib.sha256(f"bidblitz-ocpp:{token}".encode("utf-8")).hexdigest()


def _extract_ocpp_token(websocket: WebSocket, charge_point_id: str) -> str:
    direct = (websocket.headers.get("x-ocpp-token") or "").strip()
    if direct:
        return direct
    auth = (websocket.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    if auth.lower().startswith("basic "):
        try:
            raw = base64.b64decode(auth[6:].strip()).decode("utf-8")
            username, password = raw.split(":", 1)
            if username and username != charge_point_id:
                return ""
            return password
        except Exception:
            return ""
    return ""


async def _authorize_ocpp_websocket(websocket: WebSocket, charge_point_id: str) -> bool:
    cp = await db.ev_charge_points.find_one(
        {"charge_point_id": charge_point_id, "active": True},
        {"_id": 0, "ocpp_auth_hash": 1},
    )
    if not cp:
        await websocket.close(code=1008)
        return False
    if TEST_MODE:
        return True
    expected = str(cp.get("ocpp_auth_hash") or "")
    token = _extract_ocpp_token(websocket, charge_point_id)
    if not expected or not token or not secrets.compare_digest(_hash_ocpp_token(token), expected):
        await websocket.close(code=1008)
        return False
    return True

@router.websocket("/ocpp/v16/{charge_point_id}")
async def ocpp_v16(websocket: WebSocket, charge_point_id: str):
    if not await _authorize_ocpp_websocket(websocket, charge_point_id):
        return
    await ocpp_csms.serve(websocket, charge_point_id)


@router.websocket("/ocpp/v201/{charge_point_id}")
async def ocpp_v201_ws(websocket: WebSocket, charge_point_id: str):
    """OCPP-2.0.1 entry point. Subprotocol negotiated as 'ocpp2.0.1'."""
    if not await _authorize_ocpp_websocket(websocket, charge_point_id):
        return
    await ocpp_v201.serve(websocket, charge_point_id)


def _cp_protocol(cp: Dict[str, Any]) -> str:
    """Resolve the OCPP protocol of a charge point ('ocpp1.6' default)."""
    p = (cp or {}).get("protocol") or "ocpp1.6"
    return "ocpp2.0.1" if str(p).startswith("ocpp2") else "ocpp1.6"


def _cp_is_online(charge_point_id: str, protocol: str) -> bool:
    if protocol == "ocpp2.0.1":
        return ocpp_v201.is_online(charge_point_id)
    return ocpp_csms.is_online(charge_point_id)


# ══════════════════════════════════════════════════════════════════════════════
# Public discovery — customer pages (map, station detail)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/stations")
async def list_stations(
    city: Optional[str] = None,
    available_only: bool = False,
    online_only: bool = True,
) -> Dict[str, Any]:
    q: Dict[str, Any] = {"active": True}
    if city:
        q["location.city"] = {"$regex": city, "$options": "i"}
    if online_only:
        q["online"] = True
    docs = await db.ev_charge_points.find(q, {"_id": 0}).to_list(500)
    if available_only:
        ids = [d["charge_point_id"] for d in docs]
        avail = await db.ev_connectors.aggregate([
            {"$match": {"charge_point_id": {"$in": ids}, "status": "Available"}},
            {"$group": {"_id": "$charge_point_id", "count": {"$sum": 1}}},
        ]).to_list(500)
        avail_map = {a["_id"]: a["count"] for a in avail}
        docs = [d for d in docs if avail_map.get(d["charge_point_id"], 0) > 0]
    return {"stations": docs, "total": len(docs)}


@router.get("/station/{charge_point_id}")
async def station_detail(charge_point_id: str) -> Dict[str, Any]:
    cp = await db.ev_charge_points.find_one({"charge_point_id": charge_point_id}, {"_id": 0})
    if not cp:
        raise HTTPException(404, "Station nicht gefunden")
    connectors = await db.ev_connectors.find(
        {"charge_point_id": charge_point_id}, {"_id": 0}
    ).sort("connector_id", 1).to_list(50)
    tariff = await _load_tariff(cp.get("tariff_id"))
    return {
        "station": cp,
        "connectors": connectors,
        "tariff": tariff,
        "online": _cp_is_online(charge_point_id, _cp_protocol(cp)),
        "protocol": _cp_protocol(cp),
    }


async def _load_tariff(tariff_id) -> Optional[Dict[str, Any]]:
    """Tariffs may be referenced by string or ObjectId; tolerate both."""
    if not tariff_id:
        return None
    from bson import ObjectId
    queries: List[Dict[str, Any]] = [{"_id": tariff_id}]
    if isinstance(tariff_id, str):
        try:
            queries.append({"_id": ObjectId(tariff_id)})
        except Exception:
            pass
    for q in queries:
        doc = await db.ev_tariffs.find_one(q)
        if doc:
            doc.pop("_id", None)
            return doc
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Customer flow — Start charging via QR / NFC / deep-link
# ══════════════════════════════════════════════════════════════════════════════
class StartChargingRequest(BaseModel):
    charge_point_id: str
    connector_id: int = 1
    max_amount: float = Field(default=50.0, ge=1.0, le=500.0,
                              description="EUR cap to pre-authorize from wallet")
    idempotency_key: str = Field(..., min_length=8, max_length=200)


@router.post("/start")
async def start_charging(req: StartChargingRequest, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    user_id = str(user["_id"])
    client_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if len(client_key) < 8:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    key_hash = hashlib.sha256(f"{user_id}:{client_key}".encode("utf-8")).hexdigest()[:20]
    session_id = f"evs_{key_hash[:16]}"

    existing = await db.ev_charging_sessions.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0},
    )
    if existing:
        if existing.get("charge_point_id") != req.charge_point_id or int(existing.get("connector_id") or 0) != int(req.connector_id):
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für eine andere Ladesession verwendet")
        return {
            "session_id": session_id,
            "status": existing.get("status"),
            "id_tag": existing.get("id_tag"),
            "replayed": True,
        }

    # Lookups & validation
    cp = await db.ev_charge_points.find_one({"charge_point_id": req.charge_point_id, "active": True})
    if not cp:
        raise HTTPException(404, "Ladestation nicht gefunden")
    protocol = _cp_protocol(cp)
    if not _cp_is_online(req.charge_point_id, protocol):
        raise HTTPException(409, "Ladestation ist offline")

    connector = await db.ev_connectors.find_one(
        {"charge_point_id": req.charge_point_id, "connector_id": req.connector_id}
    )
    if not connector:
        raise HTTPException(404, "Stecker nicht gefunden")
    if connector.get("status") not in (None, "Available", "Preparing"):
        raise HTTPException(409, f"Stecker belegt ({connector.get('status')})")

    # Tariff
    tariff = await _load_tariff(cp.get("tariff_id"))
    if not tariff:
        raise HTTPException(409, "Kein Tarif für diese Station hinterlegt")

    # Pre-existing active session for same user → block
    dup = await db.ev_charging_sessions.find_one({
        "user_id": user_id,
        "status": {"$in": ["authorized", "starting", "active", "stopping"]},
    })
    if dup:
        raise HTTPException(409, "Du hast bereits eine aktive Ladesession")

    # Claim physical connector before RemoteStart so two users cannot race the same plug.
    claim_id = f"{req.charge_point_id}:{req.connector_id}"
    try:
        await db.ev_connector_claims.insert_one({
            "_id": claim_id,
            "charge_point_id": req.charge_point_id,
            "connector_id": req.connector_id,
            "session_id": session_id,
            "user_id": user_id,
            "status": "claimed",
            "claimed_at": _utcnow_iso(),
        })
    except Exception:
        claim_doc = await db.ev_connector_claims.find_one({"_id": claim_id}) or {}
        if claim_doc.get("status") in {"released", "failed"}:
            takeover = await db.ev_connector_claims.update_one(
                {"_id": claim_id, "status": {"$in": ["released", "failed"]}},
                {"$set": {
                    "session_id": session_id,
                    "user_id": user_id,
                    "status": "claimed",
                    "claimed_at": _utcnow_iso(),
                }},
            )
            if takeover.modified_count != 1:
                raise HTTPException(status_code=409, detail="Stecker wurde gerade von einem anderen Nutzer reserviert")
        elif str(claim_doc.get("session_id") or "") != session_id:
            raise HTTPException(status_code=409, detail="Stecker wurde gerade von einem anderen Nutzer reserviert")

    # Wallet balance check (we will deduct after session ends; here only verify)
    balance = float(user.get("balance") or 0)
    if balance < req.max_amount:
        raise HTTPException(402, f"Wallet-Guthaben unzureichend (€{balance:.2f} < €{req.max_amount:.2f})")

    # Create authorization (id_tag = user-specific OCPP token)
    id_tag = f"BB{secrets.token_hex(8).upper()}"
    await db.ev_authorizations.insert_one({
        "id_tag": id_tag,
        "user_id": user_id,
        "user_email": user.get("email"),
        "active": True,
        "created_at": _utcnow_iso(),
        "expires_at": None,
    })

    # Create session in 'authorized' state
    await db.ev_charging_sessions.insert_one({
        "session_id": session_id,
        "charge_point_id": req.charge_point_id,
        "connector_id": req.connector_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "id_tag": id_tag,
        "tariff": {
            "tariff_id": str(cp.get("tariff_id")),
            "price_per_kwh": float(tariff.get("price_per_kwh", 0)),
            "price_per_minute": float(tariff.get("price_per_minute", 0)),
            "session_fee": float(tariff.get("session_fee", 0)),
            "idle_fee_per_minute": float(tariff.get("idle_fee_per_minute", 0)),
            "minimum_fee": float(tariff.get("minimum_fee", 0)),
            "currency": tariff.get("currency", "EUR"),
            "vat_rate": float(tariff.get("vat_rate", DEFAULT_VAT_RATE_PCT)),
        },
        "reserved_amount": req.max_amount,
        "currency": "EUR",
        "kwh_charged": 0.0,
        "current_cost": 0.0,
        "status": "authorized",
        "start_idempotency_key": client_key,
        "created_at": _utcnow_iso(),
    })

    # Send RemoteStart / RequestStartTransaction depending on protocol
    try:
        if protocol == "ocpp2.0.1":
            result = await ocpp_v201.request_start_transaction(
                req.charge_point_id, req.connector_id, id_tag,
                remote_start_id=secrets.randbelow(1_000_000) + 1,
            )
        else:
            result = await ocpp_csms.remote_start(req.charge_point_id, req.connector_id, id_tag)
    except Exception as exc:
        await db.ev_charging_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "error": str(exc)[:200]}},
        )
        await db.ev_connector_claims.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "released_at": _utcnow_iso()}},
        )
        raise HTTPException(502, f"Hardware-Kommunikation fehlgeschlagen: {exc}")

    accepted = (result or {}).get("status") == "Accepted"
    if not accepted:
        await db.ev_charging_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "rejected", "error": "Station rejected RemoteStart"}},
        )
        await db.ev_connector_claims.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "released_at": _utcnow_iso()}},
        )
        raise HTTPException(409, "Ladestation hat den Start abgelehnt")

    await db.ev_charging_sessions.update_one(
        {"session_id": session_id}, {"$set": {"status": "starting"}}
    )
    return {"session_id": session_id, "status": "starting", "id_tag": id_tag, "replayed": False}


@router.get("/session/{session_id}")
async def get_session(session_id: str, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    sess = await db.ev_charging_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(404, "Session nicht gefunden")
    if sess.get("user_id") != str(user["_id"]) and not _is_admin(user):
        raise HTTPException(403, "Nicht berechtigt")
    return sess


@router.post("/stop/{session_id}")
async def stop_charging(session_id: str, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    sess = await db.ev_charging_sessions.find_one({"session_id": session_id})
    if not sess:
        raise HTTPException(404, "Session nicht gefunden")
    if sess.get("user_id") != str(user["_id"]) and not _is_admin(user):
        raise HTTPException(403, "Nicht berechtigt")
    if sess.get("status") not in ("active", "starting"):
        raise HTTPException(409, f"Session-Status erlaubt kein Stop ({sess.get('status')})")

    txn_id = sess.get("ocpp_transaction_id")
    if txn_id is None:
        stopped_at = _utcnow_iso()
        await db.ev_charging_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "cancelled", "stopped_at": stopped_at}},
        )
        await db.ev_connector_claims.update_one(
            {"session_id": session_id},
            {"$set": {"status": "released", "released_at": stopped_at}},
        )
        await db.ev_authorizations.update_one(
            {"id_tag": sess.get("id_tag")},
            {"$set": {"active": False, "cancelled_at": stopped_at}},
        )
        return {"session_id": session_id, "status": "cancelled"}

    try:
        cp = await db.ev_charge_points.find_one({"charge_point_id": sess["charge_point_id"]})
        protocol = _cp_protocol(cp or {})
        if protocol == "ocpp2.0.1":
            await ocpp_v201.request_stop_transaction(sess["charge_point_id"], txn_id)
        else:
            await ocpp_csms.remote_stop(sess["charge_point_id"], txn_id)
    except Exception as exc:
        raise HTTPException(502, f"Stop-Befehl fehlgeschlagen: {exc}")
    return {"session_id": session_id, "status": "stopping"}


@router.get("/history")
async def my_history(request: Request, limit: int = 50) -> Dict[str, Any]:
    user = await get_current_user(request)
    docs = await db.ev_charging_sessions.find(
        {"user_id": str(user["_id"]), "status": {"$in": ["completed", "cancelled", "failed"]}},
        {"_id": 0},
    ).sort("created_at", -1).limit(min(limit, 200)).to_list(200)
    return {"sessions": docs}


# ══════════════════════════════════════════════════════════════════════════════
# Final settlement — called by ocpp_csms after StopTransaction
# ══════════════════════════════════════════════════════════════════════════════
async def _settlement_failed(session_id: str, error: str, status: str = "reconciliation_required") -> None:
    await db.ev_charging_sessions.update_one(
        {"session_id": session_id, "settlement_status": {"$ne": "completed"}},
        {"$set": {
            "status": "settle_failed", "settlement_status": status,
            "settlement_error": error, "settlement_checked_at": _utcnow_iso(),
        }},
    )


async def finalize_session(session_id: str) -> None:
    """Settle a stopped session using persisted terms and canonical recovery."""
    sess = await db.ev_charging_sessions.find_one({"session_id": session_id})
    if not sess or sess.get("status") == "completed" or sess.get("settlement_status") == "completed":
        return
    if sess.get("status") not in {"stopping", "stopped", "settling", "settle_failed"}:
        return

    if sess.get("id_tag"):
        await db.ev_authorizations.update_one(
            {"id_tag": sess["id_tag"]},
            {"$set": {"active": False, "used_at": _utcnow_iso()}},
        )

    terms = sess.get("settlement")
    if not terms:
        # Old multi-step settlements cannot be replayed under a new wallet key.
        # The earlier operatorless canonical debit is the one recoverable case.
        legacy = await db.payment_idempotency.find_one({"idempotency_key": f"ev:settlement:{session_id}"})
        if not legacy and (sess.get("settlement_ref")
                           or await db.ev_receipts.find_one({"session_id": session_id})
                           or await db.transactions.find_one({"metadata.session_id": session_id})):
            await _settlement_failed(session_id, "Legacy settlement requires review before another charge")
            return
        tariff = sess.get("tariff") or {}
        try:
            kwh = float(sess.get("kwh_charged", 0))
            values = [float(tariff.get(k, 0)) for k in
                      ("price_per_kwh", "price_per_minute", "session_fee", "minimum_fee")]
            vat_rate = float(tariff.get("vat_rate", DEFAULT_VAT_RATE_PCT))
            if not all(math.isfinite(v) and v >= 0 for v in [kwh, vat_rate, *values]):
                raise ValueError("Invalid meter or tariff")
            if str(tariff.get("currency", "EUR")).upper() != "EUR":
                raise ValueError("Wallet settlement requires an EUR tariff")
            duration_min = 0.0
            if sess.get("started_at") and sess.get("stopped_at"):
                t0 = datetime.fromisoformat(sess["started_at"].replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(sess["stopped_at"].replace("Z", "+00:00"))
                duration_min = (t1 - t0).total_seconds() / 60.0
                if duration_min < 0:
                    raise ValueError("Stop precedes start")
            elif values[1] > 0:
                raise ValueError("Time tariff requires start and stop timestamps")
            tariff = {**tariff, **dict(zip(
                ("price_per_kwh", "price_per_minute", "session_fee", "minimum_fee"), values))}
            energy_amt, minute_amt = kwh * values[0], duration_min * values[1]
            session_fee, minimum_fee = values[2:]
            gross = from_minor(to_minor(max(energy_amt + minute_amt + session_fee, minimum_fee)))
            net = from_minor(to_minor(gross / (1 + vat_rate / 100.0)))
            vat = from_minor(to_minor(gross) - to_minor(net))
            user_id = str(sess.get("user_id") or "")
            if not user_id:
                raise ValueError("No verified wallet owner for this session")
            cp = await db.ev_charge_points.find_one({"charge_point_id": sess["charge_point_id"]}) or {}
            operator_user_id = str(cp.get("operator_user_id") or cp.get("owner_merchant_id") or "")
            commission_pct = DEFAULT_PLATFORM_COMMISSION_PCT
            if cp.get("commission_pct_override") is not None:
                commission_pct = float(cp["commission_pct_override"])
            elif operator_user_id:
                op = await db.ev_operators.find_one({"user_id": operator_user_id}) or {}
                if op.get("commission_pct") is not None:
                    commission_pct = float(op["commission_pct"])
            if not math.isfinite(commission_pct) or not 0 <= commission_pct <= 100:
                raise ValueError("Invalid commission")
            platform_fee = from_minor(to_minor(gross * commission_pct / 100.0)) if operator_user_id else gross
            operator_share = from_minor(to_minor(gross) - to_minor(platform_fee))
            platform_user_id = await _platform_pool_user_id() if operator_user_id and platform_fee > 0 else None
            if operator_user_id and platform_fee > 0 and not platform_user_id:
                raise ValueError("Platform commission wallet is not configured")
        except (ValueError, TypeError, OverflowError, ArithmeticError) as exc:
            await _settlement_failed(session_id, str(exc))
            return

        recovery = (legacy or {}).get("balance_recovery") or {}
        response = (legacy or {}).get("response") or {}
        txn_ref = recovery.get("reference") or response.get("reference") or f"EV-{session_id}"
        terms = {
            "user_id": user_id, "operator_user_id": operator_user_id,
            "platform_user_id": platform_user_id, "reference": txn_ref,
            "tariff": tariff, "kwh": kwh, "duration_min": duration_min,
            "energy_amt": energy_amt, "minute_amt": minute_amt,
            "session_fee": session_fee, "minimum_fee": minimum_fee,
            "gross": gross, "net": net, "vat": vat, "vat_rate": vat_rate,
            "commission_pct": commission_pct, "platform_fee": platform_fee,
            "operator_share": operator_share,
        }
        await db.ev_charging_sessions.update_one(
            {"_id": sess["_id"], "settlement": {"$exists": False}},
            {"$set": {"settlement": terms, "settlement_status": "pending"}},
        )
        fresh = await db.ev_charging_sessions.find_one({"_id": sess["_id"]})
        terms = (fresh or {}).get("settlement")
        if not terms:
            await _settlement_failed(session_id, "Settlement terms could not be persisted")
            return

    user_id, operator_user_id = terms["user_id"], terms["operator_user_id"]
    platform_user_id, txn_ref = terms["platform_user_id"], terms["reference"]
    tariff, kwh, duration_min = terms["tariff"], terms["kwh"], terms["duration_min"]
    energy_amt, minute_amt = terms["energy_amt"], terms["minute_amt"]
    session_fee, minimum_fee = terms["session_fee"], terms["minimum_fee"]
    gross, net, vat, vat_rate = terms["gross"], terms["net"], terms["vat"], terms["vat_rate"]
    commission_pct = terms["commission_pct"]
    platform_fee, operator_share = terms["platform_fee"], terms["operator_share"]

    if gross > 0:
        kwargs = {
            "amount": gross, "tx_type": TransactionType.EV_CHARGING,
            "description": f"EV-Ladung {sess['charge_point_id']} — {kwh:.2f} kWh",
            "reference": txn_ref, "idempotency_key": f"ev:settlement:{session_id}",
            "metadata": {"session_id": session_id, "charge_point_id": sess["charge_point_id"],
                         "connector_id": sess.get("connector_id"), **terms},
        }
        if operator_user_id:
            result = await transfer_between_wallets(from_user_id=user_id, to_user_id=operator_user_id, **kwargs)
        else:
            result = await debit_wallet(user_id=user_id, **kwargs)
        if not result.success:
            await _settlement_failed(session_id, result.error or "Wallet settlement incomplete", result.status.value)
            return

        if operator_user_id and platform_fee > 0 and platform_user_id != operator_user_id:
            commission = await transfer_between_wallets(
                from_user_id=operator_user_id, to_user_id=platform_user_id,
                amount=platform_fee, tx_type=TransactionType.EV_CHARGING_REVENUE,
                description=f"EV-Plattformprovision {sess['charge_point_id']} ({commission_pct}%)",
                reference=f"{txn_ref}-COM", idempotency_key=f"ev:commission:{session_id}",
                metadata={"session_id": session_id, "settlement_ref": txn_ref},
            )
            if not commission.success:
                await _settlement_failed(session_id, commission.error or "Commission incomplete", commission.status.value)
                return
            await db.ev_operator_commissions.update_one(
                {"_id": f"ev:commission:{session_id}"},
                {"$setOnInsert": {
                    "session_id": session_id, "charge_point_id": sess["charge_point_id"],
                    "operator_user_id": operator_user_id, "gross": gross,
                    "commission_pct": commission_pct, "platform_fee": platform_fee,
                    "operator_share": operator_share, "ref": commission.reference,
                    "success": True, "created_at": _utcnow_iso(),
                }}, upsert=True,
            )

    # A receipt is issued only after every required money operation completed.
    saved_receipt = await db.ev_receipts.find_one({"session_id": session_id})
    receipt_no = saved_receipt["receipt_no"] if saved_receipt else await _next_receipt_no()
    line_items = [
        {"label": "Energie", "calc": f"{kwh:.3f} kWh × €{tariff.get('price_per_kwh', 0):.2f}", "amount": round(energy_amt, 2)},
    ]
    if minute_amt > 0:
        line_items.append({"label": "Zeit", "calc": f"{duration_min:.1f} min × €{tariff.get('price_per_minute', 0):.2f}", "amount": round(minute_amt, 2)})
    if session_fee > 0:
        line_items.append({"label": "Sessiongebühr", "calc": "pauschal", "amount": round(session_fee, 2)})
    if gross == minimum_fee and energy_amt + minute_amt + session_fee < minimum_fee:
        line_items.append({"label": "Mindestbetrag-Aufschlag", "calc": f"€{minimum_fee:.2f} min.", "amount": round(minimum_fee - (energy_amt + minute_amt + session_fee), 2)})

    receipt_doc = {
        "receipt_no": receipt_no,
        "session_id": session_id,
        "user_id": user_id,
        "charge_point_id": sess["charge_point_id"],
        "operator_user_id": str(operator_user_id) if operator_user_id else None,
        "vat_rate": vat_rate,
        "net_amount": net,
        "vat_amount": vat,
        "total_amount": gross,
        "platform_fee": platform_fee,
        "operator_share": operator_share,
        "commission_pct": commission_pct,
        "currency": "EUR",
        "settlement_ref": txn_ref,
        "line_items": line_items,
        "issued_at": _utcnow_iso(),
    }
    receipt_id = saved_receipt["_id"] if saved_receipt else f"ev:receipt:{session_id}"
    await db.ev_receipts.update_one(
        {"_id": receipt_id}, {"$setOnInsert": receipt_doc}, upsert=True,
    )
    saved_receipt = await db.ev_receipts.find_one({"_id": receipt_id})
    await db.ev_charging_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "completed", "settlement_status": "completed",
            "final_cost": gross, "net_amount": net, "vat_amount": vat,
            "platform_fee": platform_fee, "operator_share": operator_share,
            "duration_min": round(duration_min, 1), "settlement_ref": txn_ref,
            "settled_at": _utcnow_iso(), "receipt_no": saved_receipt["receipt_no"],
        }, "$unset": {"settlement_error": ""}},
    )
    await db.ev_connector_claims.update_one(
        {"session_id": session_id},
        {"$set": {"status": "released", "released_at": _utcnow_iso()}},
    )


async def _next_receipt_no() -> str:
    """Sequential receipt number per UTC year, format BB-EV-{YYYY}-{seq:06d}."""
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"ev_receipt_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (counter or {}).get("seq", 1)
    return f"BB-EV-{year}-{seq:06d}"


async def _platform_pool_user_id() -> Optional[str]:
    """Resolve the configured commission account; never pick an arbitrary admin."""
    import os
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae")
    pool = await db.users.find_one({"email": email})
    if pool:
        return str(pool["_id"])
    return None



# ══════════════════════════════════════════════════════════════════════════════
# Operator (merchant) endpoints
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/operator/stations")
async def operator_stations(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    docs = await db.ev_charge_points.find(
        {"operator_user_id": str(user["_id"])}, {"_id": 0}
    ).to_list(200)
    for d in docs:
        proto = _cp_protocol(d)
        d["protocol"] = proto
        d["online"] = _cp_is_online(d["charge_point_id"], proto)
    return {"stations": docs}


@router.get("/operator/sessions")
async def operator_sessions(request: Request, limit: int = 100) -> Dict[str, Any]:
    user = await get_current_user(request)
    cps = await db.ev_charge_points.find(
        {"operator_user_id": str(user["_id"])}, {"charge_point_id": 1, "_id": 0}
    ).to_list(500)
    cp_ids = [c["charge_point_id"] for c in cps]
    docs = await db.ev_charging_sessions.find(
        {"charge_point_id": {"$in": cp_ids}}, {"_id": 0}
    ).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    return {"sessions": docs}


@router.get("/operator/revenue")
async def operator_revenue(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    cps = await db.ev_charge_points.find(
        {"operator_user_id": str(user["_id"])}, {"charge_point_id": 1, "_id": 0}
    ).to_list(500)
    cp_ids = [c["charge_point_id"] for c in cps]
    pipe = [
        {"$match": {"charge_point_id": {"$in": cp_ids}, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$final_cost"},
            "total_kwh": {"$sum": "$kwh_charged"},
            "session_count": {"$sum": 1},
        }},
    ]
    agg = await db.ev_charging_sessions.aggregate(pipe).to_list(1)
    summary = agg[0] if agg else {"total_revenue": 0, "total_kwh": 0, "session_count": 0}
    summary.pop("_id", None)
    return {"summary": summary, "stations": len(cp_ids)}


# ══════════════════════════════════════════════════════════════════════════════
# Admin endpoints
# ══════════════════════════════════════════════════════════════════════════════
class HardwareVendorBody(BaseModel):
    name: str
    contact_email: Optional[str] = None
    website: Optional[str] = None
    ocpp_versions: List[str] = ["1.6"]
    notes: Optional[str] = None


@router.post("/admin/hardware-vendors")
async def admin_create_vendor(body: HardwareVendorBody, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    vendor_id = f"vendor_{secrets.token_hex(4)}"
    doc = {"vendor_id": vendor_id, **body.dict(), "created_at": _utcnow_iso()}
    await db.ev_hardware_vendors.insert_one(doc)
    return {"vendor_id": vendor_id, **body.dict()}


@router.get("/admin/hardware-vendors")
async def admin_list_vendors(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return {"vendors": await db.ev_hardware_vendors.find({}, {"_id": 0}).to_list(200)}


class ChargePointBody(BaseModel):
    charge_point_id: str
    hardware_vendor_id: Optional[str] = None
    vendor_id: Optional[str] = None  # alias accepted from UI
    operator_user_id: Optional[str] = None  # merchant/operator who earns revenue
    tariff_id: Optional[str] = None
    name: str
    location: Dict[str, Any]  # {address, city, country, lat, lng}
    connector_count: int = 1
    connectors: Optional[List[Dict[str, Any]]] = None
    protocol: str = "ocpp1.6"  # "ocpp1.6" | "ocpp2.0.1"


@router.post("/admin/charge-points")
async def admin_create_cp(body: ChargePointBody, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    existing = await db.ev_charge_points.find_one({"charge_point_id": body.charge_point_id})
    if existing:
        raise HTTPException(409, "charge_point_id existiert bereits")
    protocol = "ocpp2.0.1" if str(body.protocol or "").startswith("ocpp2") else "ocpp1.6"
    connector_count = len(body.connectors) if body.connectors else max(body.connector_count, 1)
    ocpp_token = secrets.token_urlsafe(32)
    doc = {
        "charge_point_id": body.charge_point_id,
        "hardware_vendor_id": body.hardware_vendor_id or body.vendor_id,
        "operator_user_id": body.operator_user_id or None,
        "tariff_id": body.tariff_id or None,
        "name": body.name,
        "location": body.location,
        "protocol": protocol,
        "ocpp_auth_hash": _hash_ocpp_token(ocpp_token),
        "ocpp_auth_rotated_at": _utcnow_iso(),
        "active": True,
        "online": False,
        "status": "Unavailable",
        "created_at": _utcnow_iso(),
    }
    await db.ev_charge_points.insert_one(doc)
    # Pre-create connector rows (use list if provided, else fall back to count)
    rows = body.connectors or [{"connector_id": i + 1} for i in range(connector_count)]
    for r in rows:
        cid = int(r.get("connector_id") or 1)
        await db.ev_connectors.update_one(
            {"charge_point_id": body.charge_point_id, "connector_id": cid},
            {"$setOnInsert": {
                "charge_point_id": body.charge_point_id,
                "connector_id": cid,
                "type": r.get("type"),
                "max_power_kw": r.get("max_power_kw"),
                "status": "Unavailable",
                "created_at": _utcnow_iso(),
            }},
            upsert=True,
        )
    base = "https://bidblitz.ae/ev/start"
    return {
        "charge_point_id": body.charge_point_id,
        "protocol": protocol,
        "ocpp_token": ocpp_token,
        "ocpp_token_warning": "Nur jetzt sichtbar. Sicher im Charger/MDM speichern.",
        "qr_urls": [
            {"connector_id": int(r.get("connector_id") or i + 1),
             "deep_link": f"bidblitz://ev/start/{body.charge_point_id}/{int(r.get('connector_id') or i + 1)}",
             "web_url": f"{base}/{body.charge_point_id}/{int(r.get('connector_id') or i + 1)}"}
            for i, r in enumerate(rows)
        ],
    }


@router.post("/admin/charge-points/{charge_point_id}/rotate-ocpp-token")
async def admin_rotate_ocpp_token(charge_point_id: str, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    token = secrets.token_urlsafe(32)
    result = await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {
            "ocpp_auth_hash": _hash_ocpp_token(token),
            "ocpp_auth_rotated_at": _utcnow_iso(),
            "online": False,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "CP nicht gefunden")
    return {
        "charge_point_id": charge_point_id,
        "ocpp_token": token,
        "ocpp_token_warning": "Nur jetzt sichtbar. Alter Token ist sofort ungültig.",
    }


@router.get("/admin/charge-points")
async def admin_list_cp(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    docs = await db.ev_charge_points.find({}, {"_id": 0, "ocpp_auth_hash": 0}).to_list(500)
    for d in docs:
        proto = _cp_protocol(d)
        d["protocol"] = proto
        d["online_now"] = _cp_is_online(d["charge_point_id"], proto)
    return {
        "charge_points": docs,
        "online_count": ocpp_csms.online_count() + ocpp_v201.online_count(),
        "online_v16": ocpp_csms.online_count(),
        "online_v201": ocpp_v201.online_count(),
    }


class TariffBody(BaseModel):
    name: str
    price_per_kwh: float = Field(..., ge=0)
    price_per_minute: float = 0.0
    session_fee: float = 0.0
    idle_fee_per_minute: float = 0.0
    minimum_fee: float = 0.0
    currency: str = "EUR"
    vat_rate: float = DEFAULT_VAT_RATE_PCT
    time_rules: Optional[List[Dict[str, Any]]] = None  # [{"hours":[6,18],"price_per_kwh":0.55}]


@router.post("/admin/tariffs")
async def admin_create_tariff(body: TariffBody, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    res = await db.ev_tariffs.insert_one({**body.dict(), "created_at": _utcnow_iso()})
    return {"tariff_id": str(res.inserted_id), **body.dict()}


@router.get("/admin/tariffs")
async def admin_list_tariffs(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    docs = await db.ev_tariffs.find({}).to_list(200)
    for d in docs:
        d["tariff_id"] = str(d.pop("_id"))
    return {"tariffs": docs}


@router.get("/admin/sessions")
async def admin_list_sessions(request: Request, limit: int = 100, status: Optional[str] = None):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    docs = await db.ev_charging_sessions.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    return {"sessions": docs}


@router.get("/admin/overview")
async def admin_overview(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    total_cp = await db.ev_charge_points.count_documents({})
    online_cp = ocpp_csms.online_count() + ocpp_v201.online_count()
    online_v16 = ocpp_csms.online_count()
    online_v201 = ocpp_v201.online_count()
    active_sess = await db.ev_charging_sessions.count_documents({"status": "active"})
    completed_today = await db.ev_charging_sessions.count_documents({
        "status": "completed",
        "settled_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()},
    })
    rev = await db.ev_charging_sessions.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "rev": {"$sum": "$final_cost"}, "kwh": {"$sum": "$kwh_charged"}}},
    ]).to_list(1)
    return {
        "charge_points": total_cp,
        "online": online_cp,
        "online_v16": online_v16,
        "online_v201": online_v201,
        "active_sessions": active_sess,
        "sessions_today": completed_today,
        "lifetime_revenue_eur": round((rev[0]["rev"] if rev else 0), 2),
        "lifetime_kwh": round((rev[0]["kwh"] if rev else 0), 2),
    }


# ── OCPP control commands (admin) ────────────────────────────────────────────
@router.post("/admin/cp/{charge_point_id}/availability")
async def admin_change_availability(charge_point_id: str, request: Request,
                                    connector_id: int = 0, mode: str = "Operative"):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    cp = await db.ev_charge_points.find_one({"charge_point_id": charge_point_id})
    if not cp:
        raise HTTPException(404, "Charge point nicht gefunden")
    if _cp_protocol(cp) == "ocpp2.0.1":
        return await ocpp_v201.change_availability(
            charge_point_id, mode, evse_id=connector_id or None
        )
    return await ocpp_csms.change_availability(charge_point_id, connector_id, mode)


@router.post("/admin/cp/{charge_point_id}/reset")
async def admin_reset(charge_point_id: str, request: Request, kind: str = "Soft"):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    cp = await db.ev_charge_points.find_one({"charge_point_id": charge_point_id})
    if not cp:
        raise HTTPException(404, "Charge point nicht gefunden")
    if _cp_protocol(cp) == "ocpp2.0.1":
        # Translate 1.6 names → 2.0.1 names if needed.
        kind_201 = {"Soft": "OnIdle", "Hard": "Immediate"}.get(kind, kind)
        return await ocpp_v201.reset(charge_point_id, kind_201)
    return await ocpp_csms.reset(charge_point_id, kind)


@router.post("/admin/cp/{charge_point_id}/unlock/{connector_id}")
async def admin_unlock(charge_point_id: str, connector_id: int, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    cp = await db.ev_charge_points.find_one({"charge_point_id": charge_point_id})
    if not cp:
        raise HTTPException(404, "Charge point nicht gefunden")
    if _cp_protocol(cp) == "ocpp2.0.1":
        return await ocpp_v201.unlock_connector(charge_point_id, evse_id=1, connector_id=connector_id)
    return await ocpp_csms.unlock_connector(charge_point_id, connector_id)


# ── OCPP 2.0.1 specific admin commands ──────────────────────────────────────
@router.post("/admin/cp/{charge_point_id}/v201/get-variables")
async def admin_get_variables(charge_point_id: str, request: Request,
                              body: Dict[str, Any]):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return await ocpp_v201.get_variables(
        charge_point_id, body.get("getVariableData") or []
    )


@router.post("/admin/cp/{charge_point_id}/v201/set-variables")
async def admin_set_variables(charge_point_id: str, request: Request,
                              body: Dict[str, Any]):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return await ocpp_v201.set_variables(
        charge_point_id, body.get("setVariableData") or []
    )


@router.post("/admin/cp/{charge_point_id}/v201/trigger")
async def admin_trigger_message(charge_point_id: str, request: Request,
                                body: Dict[str, Any]):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return await ocpp_v201.trigger_message(
        charge_point_id, body.get("requestedMessage", "Heartbeat"),
        evse_id=body.get("evseId"),
    )


@router.post("/admin/cp/{charge_point_id}/v201/get-base-report")
async def admin_get_base_report(charge_point_id: str, request: Request,
                                body: Dict[str, Any]):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return await ocpp_v201.get_base_report(
        charge_point_id,
        request_id=int(body.get("requestId", secrets.randbelow(1_000_000))),
        report_base=body.get("reportBase", "ConfigurationInventory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# ISO-15118 Plug & Charge — admin PKI endpoints (OCPP 2.0.1)
# ══════════════════════════════════════════════════════════════════════════════
from services import ev_pki  # noqa: E402


@router.get("/admin/pki/csrs")
async def admin_list_pending_csrs(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return {"csrs": await ev_pki.list_pending_csrs()}


@router.post("/admin/pki/sign-csr/{request_id}")
async def admin_sign_csr(request_id: str, request: Request, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sign a queued CSR. body: { signed_chain: <PEM>, certificate_type? }
    Pushes the signed chain to the station via OCPP CertificateSigned.
    """
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    signed_chain = body.get("signed_chain") or ""
    if not signed_chain:
        raise HTTPException(400, "signed_chain (PEM) erforderlich")
    rec = await ev_pki.mark_csr_signed(request_id, signed_chain, signed_by=user.get("email", str(user["_id"])))
    if not rec:
        raise HTTPException(404, "CSR nicht gefunden oder bereits signiert")
    cert_type = body.get("certificate_type") or rec.get("certificate_type", "ChargingStationCertificate")
    try:
        push = await ocpp_v201.certificate_signed(
            rec["charge_point_id"], signed_chain, certificate_type=cert_type,
        )
    except Exception as exc:
        return {"signed": True, "delivered": False, "error": str(exc), "csr": rec}
    return {"signed": True, "delivered": True, "result": push, "csr": rec}


@router.post("/admin/pki/trust-anchors")
async def admin_add_trust_anchor(request: Request, body: Dict[str, Any]) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    if not body.get("name") or not body.get("certificate"):
        raise HTTPException(400, "name + certificate erforderlich")
    anchor_id = await ev_pki.add_trust_anchor(
        name=body["name"],
        certificate_type=body.get("certificate_type", "V2GRootCertificate"),
        certificate=body["certificate"],
        added_by=user.get("email", str(user["_id"])),
    )
    return {"anchor_id": anchor_id}


@router.get("/admin/pki/trust-anchors")
async def admin_list_trust_anchors(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return {"anchors": await ev_pki.list_trust_anchors()}


@router.post("/admin/pki/revocations")
async def admin_revoke_cert(request: Request, body: Dict[str, Any]) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    serial = body.get("serial_number")
    if not serial:
        raise HTTPException(400, "serial_number erforderlich")
    await ev_pki.revoke_certificate(serial, body.get("reason", "Unspecified"),
                                    revoked_by=user.get("email", str(user["_id"])))
    return {"revoked": True, "serial_number": serial}


@router.get("/admin/pki/revocations")
async def admin_list_revocations(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return {"revocations": await ev_pki.list_revocations()}


@router.post("/admin/pki/emaid-contracts")
async def admin_upsert_emaid(request: Request, body: Dict[str, Any]) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    emaid = body.get("emaid")
    if not emaid:
        raise HTTPException(400, "emaid erforderlich")
    await ev_pki.upsert_emaid_contract(
        emaid=emaid,
        user_id=body.get("user_id"),
        mobility_operator=body.get("mobility_operator", "BidBlitz"),
        expires_at=body.get("expires_at"),
    )
    return {"upserted": True, "emaid": emaid}


@router.get("/admin/pki/emaid-contracts")
async def admin_list_emaid(request: Request, active_only: bool = True) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return {"contracts": await ev_pki.list_emaid_contracts(active_only=active_only)}


@router.post("/admin/cp/{charge_point_id}/v201/install-certificate")
async def admin_install_certificate(charge_point_id: str, request: Request,
                                    body: Dict[str, Any]):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    if not body.get("certificate") or not body.get("certificate_type"):
        raise HTTPException(400, "certificate + certificate_type erforderlich")
    return await ocpp_v201.install_certificate(
        charge_point_id, body["certificate_type"], body["certificate"],
    )


@router.post("/admin/cp/{charge_point_id}/v201/delete-certificate")
async def admin_delete_certificate(charge_point_id: str, request: Request,
                                   body: Dict[str, Any]):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    if not body.get("certificate_hash_data"):
        raise HTTPException(400, "certificate_hash_data erforderlich")
    return await ocpp_v201.delete_certificate(charge_point_id, body["certificate_hash_data"])


@router.get("/admin/cp/{charge_point_id}/v201/installed-certificates")
async def admin_list_installed_certs(charge_point_id: str, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return await ocpp_v201.get_installed_certificate_ids(charge_point_id)



# ══════════════════════════════════════════════════════════════════════════════
# Receipts (customer + operator + admin)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/receipt/{session_id}")
async def get_receipt(session_id: str, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    rec = await db.ev_receipts.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Quittung nicht gefunden")
    sess = await db.ev_charging_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if (sess or {}).get("user_id") != str(user["_id"]) and not _is_admin(user):
        cp = await db.ev_charge_points.find_one({"charge_point_id": (sess or {}).get("charge_point_id")})
        if not (cp and str(cp.get("operator_user_id")) == str(user["_id"])):
            raise HTTPException(403, "Nicht berechtigt")
    return {"receipt": rec, "session": sess}


@router.get("/receipt/{session_id}/pdf")
async def receipt_pdf(session_id: str, request: Request):
    user = await get_current_user(request)
    rec = await db.ev_receipts.find_one({"session_id": session_id})
    sess = await db.ev_charging_sessions.find_one({"session_id": session_id})
    if not rec or not sess:
        raise HTTPException(404, "Quittung nicht gefunden")
    if str(sess.get("user_id")) != str(user["_id"]) and not _is_admin(user):
        cp = await db.ev_charge_points.find_one({"charge_point_id": sess["charge_point_id"]})
        if not (cp and str(cp.get("operator_user_id")) == str(user["_id"])):
            raise HTTPException(403, "Nicht berechtigt")
    cp = await db.ev_charge_points.find_one({"charge_point_id": sess["charge_point_id"]}) or {}
    cust = await db.users.find_one({"_id": _to_obj(sess.get("user_id"))}) or {}
    pdf = render_receipt(
        receipt={k: v for k, v in rec.items() if k != "_id"},
        session={k: v for k, v in sess.items() if k != "_id"},
        station={k: v for k, v in cp.items() if k != "_id"},
        user={"name": cust.get("name"), "email": cust.get("email"),
              "user_number": cust.get("user_number")},
    )
    fname = f"BB-EV-Receipt-{rec.get('receipt_no')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


def _to_obj(s: Any):
    from bson import ObjectId
    if isinstance(s, ObjectId):
        return s
    try:
        return ObjectId(str(s))
    except Exception:
        return s


# ══════════════════════════════════════════════════════════════════════════════
# Operator registration + payouts + staff
# ══════════════════════════════════════════════════════════════════════════════
class OperatorRegisterBody(BaseModel):
    company_name: str
    legal_name: Optional[str] = None
    contact_email: str
    contact_phone: Optional[str] = None
    vat_id: Optional[str] = None
    iban: Optional[str] = None
    address: Optional[str] = None


@router.post("/operator/register")
async def operator_register(body: OperatorRegisterBody, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    user_id = str(user["_id"])
    existing = await db.ev_operators.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(409, "Du bist bereits als EV-Betreiber registriert")
    op_id = f"evop_{secrets.token_hex(4)}"
    doc = {
        "operator_id": op_id, "user_id": user_id, "user_email": user.get("email"),
        "company_name": body.company_name, "legal_name": body.legal_name,
        "contact_email": body.contact_email, "contact_phone": body.contact_phone,
        "vat_id": body.vat_id, "iban": body.iban, "address": body.address,
        "status": "pending", "commission_pct": None,
        "created_at": _utcnow_iso(),
    }
    await db.ev_operators.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/operator/me")
async def operator_me(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    op = await db.ev_operators.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    if not op:
        raise HTTPException(404, "Kein Betreiber-Profil")
    return op


class PayoutRequestBody(BaseModel):
    amount: float = Field(..., gt=0, le=100000)
    note: Optional[str] = None


@router.post("/operator/payouts/request")
async def operator_payout_request(body: PayoutRequestBody, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    op = await db.ev_operators.find_one({"user_id": str(user["_id"])})
    if not op:
        raise HTTPException(403, "Kein Betreiber-Profil")
    if op.get("status") != "active":
        raise HTTPException(403, f"Betreiber-Status: {op.get('status')}")
    if not op.get("iban"):
        raise HTTPException(400, "IBAN nicht hinterlegt")
    balance = float(user.get("balance") or 0)
    if balance < body.amount:
        raise HTTPException(402, f"Wallet-Saldo unzureichend (€{balance:.2f})")
    payout_id = f"pay_{secrets.token_hex(5)}"
    doc = {
        "payout_id": payout_id, "operator_id": op["operator_id"],
        "user_id": str(user["_id"]), "amount": round(body.amount, 2),
        "currency": "EUR", "iban": op.get("iban"), "note": body.note,
        "status": "requested", "created_at": _utcnow_iso(),
    }
    await db.ev_operator_payouts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/operator/payouts")
async def operator_payouts(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    docs = await db.ev_operator_payouts.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"payouts": docs}


class StaffInvite(BaseModel):
    email: str
    role: str = "viewer"


@router.post("/operator/staff")
async def operator_add_staff(body: StaffInvite, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    op = await db.ev_operators.find_one({"user_id": str(user["_id"])})
    if not op:
        raise HTTPException(403, "Kein Betreiber-Profil")
    target = await db.users.find_one({"email": body.email.lower()})
    if not target:
        raise HTTPException(404, "User mit dieser E-Mail nicht gefunden")
    if body.role not in ("viewer", "manager"):
        raise HTTPException(400, "Ungültige Rolle")
    doc = {
        "operator_id": op["operator_id"], "user_id": str(target["_id"]),
        "email": target.get("email"), "role": body.role, "added_at": _utcnow_iso(),
    }
    await db.ev_operator_staff.update_one(
        {"operator_id": op["operator_id"], "user_id": str(target["_id"])},
        {"$set": doc}, upsert=True,
    )
    return doc


@router.get("/operator/staff")
async def operator_list_staff(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    op = await db.ev_operators.find_one({"user_id": str(user["_id"])})
    if not op:
        raise HTTPException(403, "Kein Betreiber-Profil")
    rows = await db.ev_operator_staff.find(
        {"operator_id": op["operator_id"]}, {"_id": 0}
    ).to_list(100)
    return {"staff": rows}


# ══════════════════════════════════════════════════════════════════════════════
# Admin: operator approval, commission override, payout management
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/admin/operators")
async def admin_list_operators(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    docs = await db.ev_operators.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"operators": docs}


class OperatorStatusBody(BaseModel):
    status: str


@router.post("/admin/operators/{operator_id}/status")
async def admin_set_operator_status(operator_id: str, body: OperatorStatusBody, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    if body.status not in ("active", "suspended", "pending"):
        raise HTTPException(400, "Ungültiger Status")
    res = await db.ev_operators.update_one(
        {"operator_id": operator_id},
        {"$set": {"status": body.status, "status_changed_at": _utcnow_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Betreiber nicht gefunden")
    return {"ok": True, "operator_id": operator_id, "status": body.status}


class CommissionBody(BaseModel):
    commission_pct: float = Field(..., ge=0, le=50)


@router.post("/admin/operators/{operator_id}/commission")
async def admin_set_commission(operator_id: str, body: CommissionBody, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    res = await db.ev_operators.update_one(
        {"operator_id": operator_id}, {"$set": {"commission_pct": body.commission_pct}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Betreiber nicht gefunden")
    return {"ok": True, "commission_pct": body.commission_pct}


class CPCommissionBody(BaseModel):
    commission_pct_override: Optional[float] = Field(default=None, ge=0, le=50)


@router.post("/admin/charge-points/{charge_point_id}/commission")
async def admin_cp_commission(charge_point_id: str, body: CPCommissionBody, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    update = {"commission_pct_override": body.commission_pct_override}
    res = await db.ev_charge_points.update_one({"charge_point_id": charge_point_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "CP nicht gefunden")
    return {"ok": True, **update}


@router.get("/admin/payouts")
async def admin_list_payouts(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    docs = await db.ev_operator_payouts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"payouts": docs}


class PayoutDecisionBody(BaseModel):
    decision: str
    note: Optional[str] = None
    external_ref: Optional[str] = None


@router.post("/admin/payouts/{payout_id}/decision")
async def admin_payout_decision(payout_id: str, body: PayoutDecisionBody, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    if body.decision not in ("approved", "rejected", "paid"):
        raise HTTPException(400, "Ungültige Entscheidung")

    payout = await db.ev_operator_payouts.find_one({"payout_id": payout_id})
    if not payout:
        raise HTTPException(404, "Payout nicht gefunden")

    current_status = str(payout.get("status") or "requested")
    if current_status == "paid":
        if body.decision == "paid":
            return {
                "ok": True,
                "payout_id": payout_id,
                "status": "paid",
                "external_ref": payout.get("external_ref"),
                "replayed": True,
            }
        raise HTTPException(409, "Bereits ausgezahlter Payout kann nicht geändert werden")
    if current_status == "rejected" and body.decision != "rejected":
        raise HTTPException(409, "Abgelehnter Payout kann nicht erneut freigegeben werden")

    now = _utcnow_iso()
    if body.decision in {"approved", "rejected"}:
        result = await db.ev_operator_payouts.update_one(
            {"payout_id": payout_id, "status": current_status},
            {"$set": {
                "status": body.decision,
                "admin_note": body.note,
                "decided_at": now,
                "decided_by": str(user["_id"]),
            }},
        )
        if result.modified_count != 1 and current_status != body.decision:
            raise HTTPException(409, "Payout-Status wurde parallel geändert")
        return {
            "ok": True,
            "payout_id": payout_id,
            "status": body.decision,
            "replayed": current_status == body.decision,
        }

    external_ref = str(body.external_ref or "").strip()
    if len(external_ref) < 4:
        raise HTTPException(400, "Externe Auszahlungsreferenz ist für 'paid' erforderlich")
    if current_status not in {"requested", "approved"}:
        raise HTTPException(409, f"Payout kann aus Status {current_status} nicht bezahlt werden")

    payment = await debit_wallet(
        user_id=str(payout["user_id"]),
        amount=round(float(payout["amount"]), 2),
        tx_type=TransactionType.PAYOUT,
        description=f"EV-Auszahlung {payout_id} → {payout.get('iban', 'IBAN')}",
        reference=payout_id,
        metadata={
            "payout_id": payout_id,
            "operator_id": payout.get("operator_id"),
            "iban": payout.get("iban"),
            "external_ref": external_ref,
            "approved_by": str(user["_id"]),
        },
        idempotency_key=f"ev:payout:{payout_id}",
    )
    if not payment.success:
        status_code = 409 if payment.status.value in {"pending", "reconciliation_required"} else 400
        raise HTTPException(status_code, payment.error or "Payout-Walletabbuchung fehlgeschlagen")

    update = {
        "status": "paid",
        "admin_note": body.note,
        "external_ref": external_ref,
        "decided_at": now,
        "paid_at": now,
        "decided_by": str(user["_id"]),
        "wallet_transaction_id": payment.transaction_id,
    }
    await db.ev_operator_payouts.update_one(
        {"payout_id": payout_id, "status": {"$in": ["requested", "approved", "paid"]}},
        {"$set": update},
    )
    return {
        "ok": True,
        "payout_id": payout_id,
        **update,
        "replayed": bool(payment.idempotent_replay),
    }

# ── Tariff: extend with VAT + time rules ─────────────────────────────────────
@router.put("/admin/tariffs/{tariff_id}")
async def admin_update_tariff(tariff_id: str, body: Dict[str, Any], request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    from bson import ObjectId
    update = {k: v for k, v in body.items()
              if k in ("name", "price_per_kwh", "price_per_minute", "session_fee",
                       "idle_fee_per_minute", "minimum_fee", "currency",
                       "vat_rate", "time_rules")}
    try:
        oid = ObjectId(tariff_id)
    except Exception:
        raise HTTPException(400, "Ungültige Tariff-ID")
    res = await db.ev_tariffs.update_one({"_id": oid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Tarif nicht gefunden")
    return {"ok": True, **update}


# ── Hardware vendor: register station model ──────────────────────────────────
class StationModelBody(BaseModel):
    vendor_id: str
    model_name: str
    ocpp_version: str = "1.6"
    max_power_kw: float
    connector_types: List[str]
    firmware_versions: List[str] = []
    notes: Optional[str] = None


@router.post("/admin/hardware-vendors/models")
async def admin_create_station_model(body: StationModelBody, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    vendor = await db.ev_hardware_vendors.find_one({"vendor_id": body.vendor_id})
    if not vendor:
        raise HTTPException(404, "Vendor nicht gefunden")
    model_id = f"model_{secrets.token_hex(4)}"
    doc = {"model_id": model_id, **body.dict(), "created_at": _utcnow_iso()}
    await db.ev_station_models.insert_one(doc)
    return {**body.dict(), "model_id": model_id}


@router.get("/admin/hardware-vendors/{vendor_id}/models")
async def admin_list_station_models(vendor_id: str, request: Request):
    user = await get_current_user(request)
    if not _is_admin(user):
        raise HTTPException(403, "Admin only")
    return {"models": await db.ev_station_models.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(200)}
