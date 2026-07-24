"""
BidBlitz EV Charging — OCPP 2.0.1 Central System (CSMS).

Real OCPP-2.0.1 implementation (no fake simulation):
  • Accepts WebSocket connections from manufacturer charge points at
    /api/ev/ocpp/v201/{charge_point_id}  (subprotocol "ocpp2.0.1")
  • JSON-RPC envelope identical to 1.6: [2,id,action,payload] / [3,id,result] /
    [4,id,errorCode,errorDesc,details]
  • Implements the high-traffic 2.0.1 actions:
      Inbound  : BootNotification, Heartbeat, StatusNotification, Authorize,
                 TransactionEvent (Started/Updated/Ended replaces 1.6
                 StartTransaction/MeterValues/StopTransaction), MeterValues,
                 NotifyReport, NotifyEvent, FirmwareStatusNotification,
                 SecurityEventNotification, DataTransfer, LogStatusNotification.
      Outbound : RequestStartTransaction, RequestStopTransaction,
                 ChangeAvailability, Reset, UnlockConnector, GetVariables,
                 SetVariables, TriggerMessage, GetBaseReport.
  • Persists a complete audit trail to MongoDB (`ev_activity_logs`,
    `ev_meter_values`, `ev_charging_sessions`).
  • Settlement is delegated to routes/ev_charging.finalize_session() when a
    transaction Ends → identical wallet flow as 1.6.
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from core.database import db

log = logging.getLogger("ocpp201")

CALL = 2
CALLRESULT = 3
CALLERROR = 4

# OCPP-2.0.1 ConnectorStatusEnumType (subset).
CP_STATUS_201 = {"Available", "Occupied", "Reserved", "Unavailable", "Faulted"}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ──────────────────────────────────────────────────────────────────────────────
# Connection registry (separate from 1.6 registry)
# ──────────────────────────────────────────────────────────────────────────────
class ChargePointSession201:
    """One live OCPP-2.0.1 WebSocket to a physical charge point."""

    def __init__(self, charge_point_id: str, websocket: WebSocket):
        self.charge_point_id = charge_point_id
        self.ws = websocket
        self.pending_calls: Dict[str, asyncio.Future] = {}
        self.connected_at = _utcnow_iso()

    async def send_call(self, action: str, payload: Dict[str, Any], timeout: float = 30.0) -> Dict[str, Any]:
        call_id = secrets.token_hex(6)
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self.pending_calls[call_id] = future
        msg = [CALL, call_id, action, payload]
        await self.ws.send_text(json.dumps(msg))
        await _log_message(self.charge_point_id, "out", action, msg)
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self.pending_calls.pop(call_id, None)
            raise TimeoutError(f"OCPP2.0.1 CALL {action} timeout after {timeout}s")


_REGISTRY: Dict[str, ChargePointSession201] = {}


def get_session(charge_point_id: str) -> Optional[ChargePointSession201]:
    return _REGISTRY.get(charge_point_id)


def is_online(charge_point_id: str) -> bool:
    return charge_point_id in _REGISTRY


def online_count() -> int:
    return len(_REGISTRY)


# ──────────────────────────────────────────────────────────────────────────────
# Audit log (shared collection with v1.6 — separate by protocol field)
# ──────────────────────────────────────────────────────────────────────────────
async def _log_message(charge_point_id: str, direction: str, action: str, raw: Any) -> None:
    try:
        await db.ev_activity_logs.insert_one({
            "charge_point_id": charge_point_id,
            "protocol": "ocpp2.0.1",
            "direction": direction,
            "action": action,
            "payload": raw,
            "ts": _utcnow_iso(),
        })
    except Exception:
        log.exception("ev_activity_logs insert failed")


async def _is_registered(charge_point_id: str) -> bool:
    cp = await db.ev_charge_points.find_one({"charge_point_id": charge_point_id})
    return bool(cp)


async def _touch_heartbeat(charge_point_id: str, status: Optional[str] = None) -> None:
    update = {"last_heartbeat": _utcnow_iso(), "protocol": "ocpp2.0.1"}
    if status:
        update["status"] = status
    await db.ev_charge_points.update_one({"charge_point_id": charge_point_id}, {"$set": update})


# ──────────────────────────────────────────────────────────────────────────────
# Inbound handlers (CP → CSMS)  —  OCPP-2.0.1 spec
# ──────────────────────────────────────────────────────────────────────────────
async def handle_BootNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    2.0.1 payload shape:
      { reason: "PowerUp"|"Triggered"|...,
        chargingStation: {model, vendorName, serialNumber?, firmwareVersion?,
                          modem? {iccid, imsi}} }
    """
    cs = payload.get("chargingStation") or {}
    modem = cs.get("modem") or {}
    await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {
            "vendor": cs.get("vendorName"),
            "model": cs.get("model"),
            "serial_number": cs.get("serialNumber"),
            "firmware_version": cs.get("firmwareVersion"),
            "iccid": modem.get("iccid"),
            "imsi": modem.get("imsi"),
            "boot_at": _utcnow_iso(),
            "boot_reason": payload.get("reason"),
            "protocol": "ocpp2.0.1",
            "status": "Available",
        }},
        upsert=False,
    )
    return {
        "currentTime": _utcnow_iso(),
        "interval": 300,
        "status": "Accepted",
    }


async def handle_Heartbeat(charge_point_id: str, _payload: Dict[str, Any]) -> Dict[str, Any]:
    await _touch_heartbeat(charge_point_id)
    return {"currentTime": _utcnow_iso()}


async def handle_StatusNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    2.0.1 payload:
      { timestamp, connectorStatus: "Available"|"Occupied"|"Reserved"|
        "Unavailable"|"Faulted",
        evseId, connectorId }
    """
    evse_id = int(payload.get("evseId", 0))
    connector_id = int(payload.get("connectorId", 0))
    status = payload.get("connectorStatus", "Available")

    await db.ev_connectors.update_one(
        {"charge_point_id": charge_point_id, "connector_id": connector_id},
        {"$set": {
            "status": status,
            "evse_id": evse_id,
            "protocol": "ocpp2.0.1",
            "updated_at": payload.get("timestamp") or _utcnow_iso(),
        }},
        upsert=True,
    )
    if connector_id == 0:
        await _touch_heartbeat(charge_point_id, status=status)
    return {}


async def handle_Authorize(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    2.0.1 payload:
      { idToken: {idToken, type: "Central"|"eMAID"|"ISO14443"|"ISO15693"|"KeyCode"|"Local"|"NoAuthorization"},
        certificate?: <PEM>,                                          # ISO-15118 PnC
        iso15118CertificateHashData?: [{hashAlgorithm, issuerNameHash,
                                         issuerKeyHash, serialNumber,
                                         responderURL?}]               # OCSP cert chain
      }
    """
    id_token_obj = payload.get("idToken") or {}
    id_token = id_token_obj.get("idToken", "")
    id_token_type = id_token_obj.get("type", "Central")

    # ── ISO-15118 Plug & Charge (eMAID + cert chain) ────────────────────────
    if id_token_type == "eMAID" or payload.get("certificate") or payload.get("iso15118CertificateHashData"):
        from services.ev_pki import verify_iso15118_authorize
        result = await verify_iso15118_authorize(
            charge_point_id=charge_point_id,
            emaid=id_token,
            certificate=payload.get("certificate"),
            cert_hash_data=payload.get("iso15118CertificateHashData") or [],
        )
        await db.ev_activity_logs.insert_one({
            "charge_point_id": charge_point_id,
            "protocol": "ocpp2.0.1",
            "action": "Authorize.PnC",
            "emaid": id_token,
            "result": result,
            "ts": _utcnow_iso(),
        })
        return result

    # ── Standard token-based auth ───────────────────────────────────────────
    auth = await db.ev_authorizations.find_one({"id_tag": id_token, "active": True})
    if not auth:
        return {"idTokenInfo": {"status": "Invalid"}}
    return {"idTokenInfo": {"status": "Accepted"}}


# ──────────────────────────────────────────────────────────────────────────────
# ISO-15118 / Plug & Charge handlers (Part 2 v2.0.1 §K01-K17)
# ──────────────────────────────────────────────────────────────────────────────
async def handle_SignCertificate(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    CP → CSMS:  request CSMS to sign a CSR (PEM PKCS#10).
    payload: { csr: <PEM>, certificateType?: "ChargingStationCertificate"|"V2GCertificate" }
    response: { status: "Accepted"|"Rejected" }
    Real signing is performed by an admin via /api/ev/admin/pki/sign-csr.
    """
    from services.ev_pki import enqueue_csr
    request_id = await enqueue_csr(
        charge_point_id=charge_point_id,
        csr=payload.get("csr", ""),
        certificate_type=payload.get("certificateType", "ChargingStationCertificate"),
    )
    return {"status": "Accepted", "requestId": request_id}


async def handle_Get15118EVCertificate(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    CP → CSMS: forward an EV certificate request (Install or Update) to V2G PKI.
    payload: { iso15118SchemaVersion, action: "Install"|"Update",
               exiRequest: <base64> }
    response: { status: "Accepted"|"Failed", exiResponse: <base64> }
    """
    from services.ev_pki import handle_ev_certificate_request
    return await handle_ev_certificate_request(
        charge_point_id=charge_point_id,
        action=payload.get("action", "Install"),
        schema_version=payload.get("iso15118SchemaVersion", "urn:iso:15118:2:2013:MsgDef"),
        exi_request=payload.get("exiRequest", ""),
    )


async def handle_GetCertificateStatus(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    CP → CSMS: OCSP-style certificate revocation status.
    payload: { ocspRequestData: {hashAlgorithm, issuerNameHash, issuerKeyHash,
                                  serialNumber, responderURL} }
    response: { status: "Accepted"|"Failed", ocspResult?: <DER base64> }
    """
    from services.ev_pki import check_certificate_status
    return await check_certificate_status(
        charge_point_id=charge_point_id,
        ocsp_request=payload.get("ocspRequestData") or {},
    )


async def _persist_meter_values(charge_point_id: str, transaction_id: Optional[str],
                                evse_id: Optional[int], meter_values: list) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Persist meterValue array (2.0.1 shape) and return (latest_wh, latest_w, latest_ts)."""
    latest_wh: Optional[float] = None
    latest_w: Optional[float] = None
    latest_ts: Optional[str] = None
    for sample in meter_values or []:
        ts = sample.get("timestamp") or _utcnow_iso()
        for sv in sample.get("sampledValue", []) or []:
            measurand = sv.get("measurand", "Energy.Active.Import.Register")
            unit_obj = sv.get("unitOfMeasure") or {}
            unit = unit_obj.get("unit", "Wh")
            try:
                value = float(sv.get("value"))
            except (TypeError, ValueError):
                continue
            wh = value * 1000.0 if unit in ("kWh",) else value
            await db.ev_meter_values.insert_one({
                "charge_point_id": charge_point_id,
                "evse_id": evse_id,
                "transaction_id": transaction_id,
                "measurand": measurand,
                "value": value,
                "unit": unit,
                "ts": ts,
                "protocol": "ocpp2.0.1",
            })
            if measurand == "Energy.Active.Import.Register":
                latest_wh = wh
                latest_ts = ts
            if measurand == "Power.Active.Import":
                latest_w = value if unit == "W" else value * 1000.0
    return latest_wh, latest_w, latest_ts


async def _update_session_meters(session_id: str, latest_wh: float, latest_w: Optional[float], ts: Optional[str]) -> None:
    sess = await db.ev_charging_sessions.find_one({"session_id": session_id})
    if not sess:
        return
    kwh = max(0.0, (latest_wh - float(sess.get("meter_start_wh", 0))) / 1000.0)
    tariff = sess.get("tariff") or {}
    price_per_kwh = float(tariff.get("price_per_kwh", 0))
    session_fee = float(tariff.get("session_fee", 0))
    current_cost = round(kwh * price_per_kwh + session_fee, 2)
    update = {
        "kwh_charged": round(kwh, 3),
        "current_cost": current_cost,
        "last_meter_at": ts,
    }
    if latest_w is not None:
        update["current_power_w"] = latest_w
    await db.ev_charging_sessions.update_one({"session_id": session_id}, {"$set": update})


async def handle_TransactionEvent(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Combined replacement for 1.6's StartTransaction / MeterValues / StopTransaction.

    2.0.1 payload (key fields used):
      { eventType: "Started"|"Updated"|"Ended",
        timestamp,
        triggerReason,
        seqNo,
        transactionInfo: { transactionId, chargingState?, stoppedReason? },
        evse: { id, connectorId },
        idToken: { idToken, type } | null,
        meterValue: [...] }
    """
    from routes.ev_charging import finalize_session  # avoid import cycle

    event_type = payload.get("eventType", "Updated")
    txn_info = payload.get("transactionInfo") or {}
    transaction_id = txn_info.get("transactionId")
    evse = payload.get("evse") or {}
    evse_id = int(evse.get("id", 1))
    connector_id = int(evse.get("connectorId", 1))
    id_token_obj = payload.get("idToken") or {}
    id_token = id_token_obj.get("idToken")
    timestamp = payload.get("timestamp") or _utcnow_iso()

    # Always persist meter values regardless of eventType.
    latest_wh, latest_w, latest_ts = await _persist_meter_values(
        charge_point_id, transaction_id, evse_id, payload.get("meterValue") or []
    )

    response: Dict[str, Any] = {}
    if id_token:
        response["idTokenInfo"] = {"status": "Accepted"}

    # ── Started: bind to a pre-existing authorized session or create one
    if event_type == "Started":
        session = await db.ev_charging_sessions.find_one({
            "charge_point_id": charge_point_id,
            "connector_id": connector_id,
            "id_tag": id_token,
            "status": {"$in": ["authorized", "starting"]},
        }, sort=[("created_at", -1)])

        meter_start = latest_wh if latest_wh is not None else 0.0
        if session:
            await db.ev_charging_sessions.update_one(
                {"session_id": session["session_id"]},
                {"$set": {
                    "status": "active",
                    "ocpp_transaction_id": transaction_id,
                    "ocpp_protocol": "ocpp2.0.1",
                    "meter_start_wh": meter_start,
                    "started_at": timestamp,
                    "evse_id": evse_id,
                }},
            )
        else:
            session_id = f"evs_{secrets.token_hex(6)}"
            await db.ev_charging_sessions.insert_one({
                "session_id": session_id,
                "charge_point_id": charge_point_id,
                "evse_id": evse_id,
                "connector_id": connector_id,
                "id_tag": id_token,
                "user_id": None,
                "tariff": None,
                "reserved_amount": 0.0,
                "currency": "EUR",
                "kwh_charged": 0.0,
                "current_cost": 0.0,
                "status": "active",
                "ocpp_transaction_id": transaction_id,
                "ocpp_protocol": "ocpp2.0.1",
                "meter_start_wh": meter_start,
                "started_at": timestamp,
                "created_at": _utcnow_iso(),
            })
        return response

    # ── Updated: live meter sample
    if event_type == "Updated":
        sess = await db.ev_charging_sessions.find_one({
            "charge_point_id": charge_point_id,
            "ocpp_transaction_id": transaction_id,
        })
        if sess and latest_wh is not None:
            await _update_session_meters(sess["session_id"], latest_wh, latest_w, latest_ts)
        return response

    # ── Ended: finalize via shared settlement
    if event_type == "Ended":
        sess = await db.ev_charging_sessions.find_one({
            "charge_point_id": charge_point_id,
            "ocpp_transaction_id": transaction_id,
        })
        if sess:
            update: Dict[str, Any] = {
                "status": "stopping",
                "stop_reason": txn_info.get("stoppedReason", "Local"),
                "stopped_at": timestamp,
            }
            if latest_wh is not None:
                update["meter_stop_wh"] = latest_wh
                # Recompute final kwh delta so finalize_session uses fresh value.
                kwh = max(0.0, (latest_wh - float(sess.get("meter_start_wh", 0))) / 1000.0)
                update["kwh_charged"] = round(kwh, 3)
            else:
                update["meter_stop_wh"] = sess.get("meter_start_wh", 0)
            await db.ev_charging_sessions.update_one(
                {"session_id": sess["session_id"]}, {"$set": update}
            )
            await finalize_session(sess["session_id"])
        return response

    return response


async def handle_MeterValues(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Standalone MeterValues (rare in 2.0.1 — most flow via TransactionEvent)."""
    evse_id = int(payload.get("evseId", 0))
    latest_wh, latest_w, latest_ts = await _persist_meter_values(
        charge_point_id, None, evse_id, payload.get("meterValue") or []
    )
    return {}


async def handle_NotifyReport(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Configuration / variable report from CP. Persist for admin inspection."""
    await db.ev_reports.insert_one({
        "charge_point_id": charge_point_id,
        "request_id": payload.get("requestId"),
        "seq_no": payload.get("seqNo"),
        "report_data": payload.get("reportData"),
        "tbc": payload.get("tbc", False),
        "ts": _utcnow_iso(),
    })
    return {}


async def handle_NotifyEvent(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    await db.ev_events.insert_one({
        "charge_point_id": charge_point_id,
        "generated_at": payload.get("generatedAt"),
        "event_data": payload.get("eventData"),
        "ts": _utcnow_iso(),
    })
    return {}


async def handle_FirmwareStatusNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {"firmware_status": payload.get("status"),
                  "firmware_status_ts": _utcnow_iso()}},
    )
    return {}


async def handle_SecurityEventNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    await db.ev_security_events.insert_one({
        "charge_point_id": charge_point_id,
        "type": payload.get("type"),
        "tech_info": payload.get("techInfo"),
        "timestamp": payload.get("timestamp") or _utcnow_iso(),
        "ts": _utcnow_iso(),
    })
    return {}


async def handle_DataTransfer(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    await db.ev_data_transfer.insert_one({
        "charge_point_id": charge_point_id,
        "vendor_id": payload.get("vendorId"),
        "message_id": payload.get("messageId"),
        "data": payload.get("data"),
        "direction": "in",
        "ts": _utcnow_iso(),
    })
    return {"status": "Accepted"}


async def handle_LogStatusNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {"log_status": payload.get("status"),
                  "log_status_request_id": payload.get("requestId"),
                  "log_status_ts": _utcnow_iso()}},
    )
    return {}


_HANDLERS = {
    "BootNotification": handle_BootNotification,
    "Heartbeat": handle_Heartbeat,
    "StatusNotification": handle_StatusNotification,
    "Authorize": handle_Authorize,
    "TransactionEvent": handle_TransactionEvent,
    "MeterValues": handle_MeterValues,
    "NotifyReport": handle_NotifyReport,
    "NotifyEvent": handle_NotifyEvent,
    "FirmwareStatusNotification": handle_FirmwareStatusNotification,
    "SecurityEventNotification": handle_SecurityEventNotification,
    "DataTransfer": handle_DataTransfer,
    "LogStatusNotification": handle_LogStatusNotification,
    # ISO-15118 / Plug & Charge
    "SignCertificate": handle_SignCertificate,
    "Get15118EVCertificate": handle_Get15118EVCertificate,
    "GetCertificateStatus": handle_GetCertificateStatus,
}


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket lifecycle
# ──────────────────────────────────────────────────────────────────────────────
async def serve(websocket: WebSocket, charge_point_id: str) -> None:
    if not await _is_registered(charge_point_id):
        await websocket.close(code=1008)
        log.warning("OCPP2.0.1 rejected unknown charge_point_id=%s", charge_point_id)
        return

    await websocket.accept(subprotocol="ocpp2.0.1")
    session = ChargePointSession201(charge_point_id, websocket)
    _REGISTRY[charge_point_id] = session
    await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {"online": True, "connected_at": session.connected_at,
                  "protocol": "ocpp2.0.1"}},
    )
    log.info("OCPP2.0.1 CP connected: %s", charge_point_id)

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                log.warning("Invalid JSON from %s: %s", charge_point_id, text[:200])
                continue
            if not isinstance(msg, list) or len(msg) < 3:
                continue

            msg_type = msg[0]
            if msg_type == CALL:
                _, call_id, action, payload = msg[0], msg[1], msg[2], (msg[3] if len(msg) > 3 else {})
                await _log_message(charge_point_id, "in", action, msg)
                handler = _HANDLERS.get(action)
                if not handler:
                    err = [CALLERROR, call_id, "NotImplemented",
                           f"Action '{action}' not supported", {}]
                    await websocket.send_text(json.dumps(err))
                    continue
                try:
                    result = await handler(charge_point_id, payload or {})
                    await websocket.send_text(json.dumps([CALLRESULT, call_id, result]))
                except Exception as exc:
                    log.exception("Handler %s failed", action)
                    await websocket.send_text(json.dumps(
                        [CALLERROR, call_id, "InternalError", str(exc)[:120], {}]
                    ))
            elif msg_type == CALLRESULT:
                _, call_id, result = msg[0], msg[1], (msg[2] if len(msg) > 2 else {})
                fut = session.pending_calls.pop(call_id, None)
                if fut and not fut.done():
                    fut.set_result(result or {})
            elif msg_type == CALLERROR:
                _, call_id = msg[0], msg[1]
                err_code = msg[2] if len(msg) > 2 else "GenericError"
                err_desc = msg[3] if len(msg) > 3 else ""
                fut = session.pending_calls.pop(call_id, None)
                if fut and not fut.done():
                    fut.set_exception(RuntimeError(f"{err_code}: {err_desc}"))

    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("OCPP2.0.1 loop crashed for %s", charge_point_id)
    finally:
        _REGISTRY.pop(charge_point_id, None)
        await db.ev_charge_points.update_one(
            {"charge_point_id": charge_point_id},
            {"$set": {"online": False, "disconnected_at": _utcnow_iso()}},
        )
        log.info("OCPP2.0.1 CP disconnected: %s", charge_point_id)


# ──────────────────────────────────────────────────────────────────────────────
# Server-initiated CALLs (called from REST API)
# ──────────────────────────────────────────────────────────────────────────────
async def request_start_transaction(charge_point_id: str, evse_id: int, id_token: str,
                                    remote_start_id: int) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("RequestStartTransaction", {
        "remoteStartId": remote_start_id,
        "evseId": evse_id,
        "idToken": {"idToken": id_token, "type": "Central"},
    })


async def request_stop_transaction(charge_point_id: str, transaction_id: str) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("RequestStopTransaction", {"transactionId": str(transaction_id)})


async def change_availability(charge_point_id: str, operational: str,
                              evse_id: Optional[int] = None,
                              connector_id: Optional[int] = None) -> Dict[str, Any]:
    """operational: 'Operative' | 'Inoperative'"""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    payload: Dict[str, Any] = {"operationalStatus": operational}
    if evse_id is not None:
        evse: Dict[str, Any] = {"id": int(evse_id)}
        if connector_id is not None:
            evse["connectorId"] = int(connector_id)
        payload["evse"] = evse
    return await sess.send_call("ChangeAvailability", payload)


async def reset(charge_point_id: str, kind: str = "OnIdle",
                evse_id: Optional[int] = None) -> Dict[str, Any]:
    """kind: 'Immediate' | 'OnIdle'"""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    payload: Dict[str, Any] = {"type": kind}
    if evse_id is not None:
        payload["evseId"] = int(evse_id)
    return await sess.send_call("Reset", payload)


async def unlock_connector(charge_point_id: str, evse_id: int, connector_id: int) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("UnlockConnector", {
        "evseId": int(evse_id),
        "connectorId": int(connector_id),
    })


async def get_variables(charge_point_id: str, get_variable_data: list) -> Dict[str, Any]:
    """get_variable_data: list of {component:{name}, variable:{name}, attributeType?}."""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("GetVariables", {"getVariableData": get_variable_data})


async def set_variables(charge_point_id: str, set_variable_data: list) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("SetVariables", {"setVariableData": set_variable_data})


async def trigger_message(charge_point_id: str, requested_message: str,
                          evse_id: Optional[int] = None) -> Dict[str, Any]:
    """requested_message: e.g. 'BootNotification', 'Heartbeat', 'StatusNotification', 'MeterValues'."""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    payload: Dict[str, Any] = {"requestedMessage": requested_message}
    if evse_id is not None:
        payload["evse"] = {"id": int(evse_id)}
    return await sess.send_call("TriggerMessage", payload)


async def get_base_report(charge_point_id: str, request_id: int,
                          report_base: str = "ConfigurationInventory") -> Dict[str, Any]:
    """report_base: 'ConfigurationInventory'|'FullInventory'|'SummaryInventory'."""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("GetBaseReport", {
        "requestId": int(request_id),
        "reportBase": report_base,
    })



# ──────────────────────────────────────────────────────────────────────────────
# ISO-15118 / Plug & Charge — server-initiated CALLs
# ──────────────────────────────────────────────────────────────────────────────
async def certificate_signed(charge_point_id: str, certificate_chain: str,
                             certificate_type: str = "ChargingStationCertificate") -> Dict[str, Any]:
    """
    CSMS → CP: deliver a signed PEM certificate chain (response to SignCertificate).
    certificate_type: 'ChargingStationCertificate' | 'V2GCertificateChain'
    """
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("CertificateSigned", {
        "certificateChain": certificate_chain,
        "certificateType": certificate_type,
    })


async def install_certificate(charge_point_id: str, certificate_type: str,
                              certificate: str) -> Dict[str, Any]:
    """
    CSMS → CP: install a root CA certificate.
    certificate_type: 'V2GRootCertificate' | 'MORootCertificate' |
                       'CSMSRootCertificate' | 'ManufacturerRootCertificate'
    certificate: PEM-encoded.
    """
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("InstallCertificate", {
        "certificateType": certificate_type,
        "certificate": certificate,
    })


async def delete_certificate(charge_point_id: str, certificate_hash_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    CSMS → CP: delete an installed root certificate by hash.
    certificate_hash_data: {hashAlgorithm, issuerNameHash, issuerKeyHash, serialNumber}
    """
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    return await sess.send_call("DeleteCertificate", {
        "certificateHashData": certificate_hash_data,
    })


async def get_installed_certificate_ids(charge_point_id: str,
                                        certificate_type: Optional[list] = None) -> Dict[str, Any]:
    """CSMS → CP: list installed root certificates."""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline (2.0.1)")
    payload: Dict[str, Any] = {}
    if certificate_type:
        payload["certificateType"] = certificate_type
    return await sess.send_call("GetInstalledCertificateIds", payload)
