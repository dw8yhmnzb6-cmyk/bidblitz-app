"""
BidBlitz EV Charging — OCPP 1.6J Central System (CSMS).

Real OCPP-1.6J implementation (no fake simulation):
  • Accepts WebSocket connections from manufacturer charge points at
    /api/ev/ocpp/v16/{charge_point_id}
  • Implements the JSON message wire format with CALL [2,id,action,payload],
    CALLRESULT [3,id,payload] and CALLERROR [4,id,errorCode,errorDesc,details]
  • Routes incoming OCPP actions to handlers and persists everything.
  • Allows the BidBlitz REST API to push commands back to the station
    (RemoteStartTransaction, RemoteStopTransaction, ChangeAvailability, Reset,
    UnlockConnector) by awaiting the matching CALLRESULT future.

This module is transport+protocol only — pricing, wallet authorization and
business logic live in routes/ev_charging.py and core/payment_engine.py.

Future-proofed: switch protocol_version to "ocpp2.0.1" when needed; OCPP 2.0.1
shares the same JSON-RPC envelope.
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import WebSocket, WebSocketDisconnect

from core.database import db

log = logging.getLogger("ocpp")

# ── OCPP message types ────────────────────────────────────────────────────────
CALL = 2
CALLRESULT = 3
CALLERROR = 4

# ── Charge-point status enums (subset, OCPP-1.6 conformant) ───────────────────
CP_STATUS = {
    "Available", "Preparing", "Charging", "SuspendedEVSE", "SuspendedEV",
    "Finishing", "Reserved", "Unavailable", "Faulted",
}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ──────────────────────────────────────────────────────────────────────────────
# Connection registry (in-memory map: charge_point_id → ChargePointSession)
# ──────────────────────────────────────────────────────────────────────────────
class ChargePointSession:
    """One live WebSocket to a physical charge point."""

    def __init__(self, charge_point_id: str, websocket: WebSocket):
        self.charge_point_id = charge_point_id
        self.ws = websocket
        # Open call promises: server-initiated CALL.id → asyncio.Future
        self.pending_calls: Dict[str, asyncio.Future] = {}
        self.connected_at = _utcnow_iso()

    async def send_call(self, action: str, payload: Dict[str, Any], timeout: float = 30.0) -> Dict[str, Any]:
        """Server-initiated OCPP CALL. Awaits CALLRESULT, returns its payload."""
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
            raise TimeoutError(f"OCPP CALL {action} timeout after {timeout}s")


# Module-level registry (lifecycle tied to the FastAPI worker process).
_REGISTRY: Dict[str, ChargePointSession] = {}


def get_session(charge_point_id: str) -> Optional[ChargePointSession]:
    return _REGISTRY.get(charge_point_id)


def is_online(charge_point_id: str) -> bool:
    return charge_point_id in _REGISTRY


def online_count() -> int:
    return len(_REGISTRY)


# ──────────────────────────────────────────────────────────────────────────────
# Audit log (every OCPP message persisted to MongoDB)
# ──────────────────────────────────────────────────────────────────────────────
async def _log_message(charge_point_id: str, direction: str, action: str, raw: Any) -> None:
    try:
        await db.ev_activity_logs.insert_one({
            "charge_point_id": charge_point_id,
            "direction": direction,            # "in" (CP → CSMS) | "out" (CSMS → CP)
            "action": action,
            "payload": raw,
            "ts": _utcnow_iso(),
        })
    except Exception:
        log.exception("ev_activity_logs insert failed")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers — DB lookups for security & validation
# ──────────────────────────────────────────────────────────────────────────────
async def _is_registered(charge_point_id: str) -> bool:
    """Only registered (admin-onboarded) charge points may connect."""
    cp = await db.ev_charge_points.find_one({"charge_point_id": charge_point_id})
    return bool(cp)


async def _touch_heartbeat(charge_point_id: str, status: Optional[str] = None) -> None:
    update = {"last_heartbeat": _utcnow_iso()}
    if status:
        update["status"] = status
    await db.ev_charge_points.update_one({"charge_point_id": charge_point_id}, {"$set": update})


# ──────────────────────────────────────────────────────────────────────────────
# OCPP 1.6 inbound handlers (CP → CSMS)
# ──────────────────────────────────────────────────────────────────────────────
async def handle_BootNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {
            "vendor": payload.get("chargePointVendor"),
            "model": payload.get("chargePointModel"),
            "serial_number": payload.get("chargePointSerialNumber"),
            "firmware_version": payload.get("firmwareVersion"),
            "iccid": payload.get("iccid"),
            "imsi": payload.get("imsi"),
            "boot_at": _utcnow_iso(),
            "status": "Available",
        }},
        upsert=False,
    )
    return {"currentTime": _utcnow_iso(), "interval": 300, "status": "Accepted"}


async def handle_Heartbeat(charge_point_id: str, _payload: Dict[str, Any]) -> Dict[str, Any]:
    await _touch_heartbeat(charge_point_id)
    return {"currentTime": _utcnow_iso()}


async def handle_StatusNotification(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    connector_id = int(payload.get("connectorId", 0))
    status = payload.get("status", "Available")
    error_code = payload.get("errorCode", "NoError")

    await db.ev_connectors.update_one(
        {"charge_point_id": charge_point_id, "connector_id": connector_id},
        {"$set": {
            "status": status,
            "error_code": error_code,
            "info": payload.get("info"),
            "updated_at": _utcnow_iso(),
        }},
        upsert=True,
    )
    if connector_id == 0:
        await _touch_heartbeat(charge_point_id, status=status)
    return {}


async def handle_Authorize(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """An RFID id-tag was presented at the station; ask BidBlitz if it's allowed."""
    id_tag = payload.get("idTag", "")
    auth = await db.ev_authorizations.find_one({"id_tag": id_tag, "active": True})
    if not auth:
        return {"idTagInfo": {"status": "Invalid"}}
    # Optional: check wallet balance / KYC of bound user.
    return {"idTagInfo": {"status": "Accepted"}}


async def handle_StartTransaction(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    CP confirms it actually started charging. We normally pre-create the session
    via RemoteStartTransaction (so a session_id already exists keyed by the
    idTag). Tie the OCPP transactionId back to that session.
    """
    id_tag = payload.get("idTag", "")
    connector_id = int(payload.get("connectorId", 0))
    meter_start = float(payload.get("meterStart", 0))
    timestamp = payload.get("timestamp") or _utcnow_iso()

    transaction_id = secrets.randbelow(2_000_000_000) + 1_000  # stay >0, fit int32

    # Find a pending session matching id_tag + connector + cp (created during
    # RemoteStart). Falls back to creating one if a station-initiated charge.
    session = await db.ev_charging_sessions.find_one({
        "charge_point_id": charge_point_id,
        "connector_id": connector_id,
        "id_tag": id_tag,
        "status": {"$in": ["authorized", "starting"]},
    }, sort=[("created_at", -1)])

    update = {
        "status": "active",
        "ocpp_transaction_id": transaction_id,
        "meter_start_wh": meter_start,
        "started_at": timestamp,
    }

    if session:
        await db.ev_charging_sessions.update_one({"session_id": session["session_id"]}, {"$set": update})
        session_id = session["session_id"]
    else:
        # Station-initiated (e.g. RFID swipe without remote-start).
        session_id = f"evs_{secrets.token_hex(6)}"
        await db.ev_charging_sessions.insert_one({
            "session_id": session_id,
            "charge_point_id": charge_point_id,
            "connector_id": connector_id,
            "id_tag": id_tag,
            "user_id": None,
            "tariff": None,
            "reserved_amount": 0.0,
            "currency": "EUR",
            "kwh_charged": 0.0,
            "current_cost": 0.0,
            "created_at": _utcnow_iso(),
            **update,
        })

    return {"transactionId": transaction_id, "idTagInfo": {"status": "Accepted"}}


async def handle_MeterValues(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Live energy/power readings — persist + recompute live cost."""
    transaction_id = payload.get("transactionId")
    connector_id = int(payload.get("connectorId", 0))
    meter_value_arr = payload.get("meterValue", []) or []

    latest_wh: Optional[float] = None
    latest_w: Optional[float] = None
    latest_ts: Optional[str] = None

    for sample in meter_value_arr:
        ts = sample.get("timestamp") or _utcnow_iso()
        for sv in sample.get("sampledValue", []) or []:
            measurand = sv.get("measurand", "Energy.Active.Import.Register")
            unit = sv.get("unit", "Wh")
            try:
                value = float(sv.get("value"))
            except (TypeError, ValueError):
                continue
            wh = value * 1000.0 if unit in ("kWh",) else value
            await db.ev_meter_values.insert_one({
                "charge_point_id": charge_point_id,
                "connector_id": connector_id,
                "transaction_id": transaction_id,
                "measurand": measurand,
                "value": value,
                "unit": unit,
                "ts": ts,
            })
            if measurand == "Energy.Active.Import.Register":
                latest_wh = wh
                latest_ts = ts
            if measurand == "Power.Active.Import":
                latest_w = value if unit == "W" else value * 1000.0

    if transaction_id is not None and latest_wh is not None:
        sess = await db.ev_charging_sessions.find_one({"ocpp_transaction_id": transaction_id})
        if sess:
            kwh = max(0.0, (latest_wh - float(sess.get("meter_start_wh", 0))) / 1000.0)
            tariff = sess.get("tariff") or {}
            price_per_kwh = float(tariff.get("price_per_kwh", 0))
            session_fee = float(tariff.get("session_fee", 0))
            current_cost = round(kwh * price_per_kwh + session_fee, 2)
            await db.ev_charging_sessions.update_one(
                {"session_id": sess["session_id"]},
                {"$set": {
                    "kwh_charged": round(kwh, 3),
                    "current_cost": current_cost,
                    "current_power_w": latest_w,
                    "last_meter_at": latest_ts,
                }},
            )
    return {}


async def handle_StopTransaction(charge_point_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    CP reports it stopped charging. Final settlement (deduct from user wallet,
    credit operator) is handled in routes/ev_charging.py.finalize_session() —
    here we only set the session to 'stopped'.
    """
    from routes.ev_charging import finalize_session  # local import to avoid cycle

    transaction_id = payload.get("transactionId")
    meter_stop = float(payload.get("meterStop", 0))
    reason = payload.get("reason", "Local")
    timestamp = payload.get("timestamp") or _utcnow_iso()

    sess = await db.ev_charging_sessions.find_one({"ocpp_transaction_id": transaction_id})
    if not sess:
        return {"idTagInfo": {"status": "Accepted"}}

    await db.ev_charging_sessions.update_one(
        {"session_id": sess["session_id"]},
        {"$set": {
            "status": "stopping",
            "meter_stop_wh": meter_stop,
            "stop_reason": reason,
            "stopped_at": timestamp,
        }},
    )
    # Settle now (kwh delta → wallet deduction → operator revenue).
    await finalize_session(sess["session_id"])
    return {"idTagInfo": {"status": "Accepted"}}


# Dispatch table for inbound CALLs.
_HANDLERS = {
    "BootNotification": handle_BootNotification,
    "Heartbeat": handle_Heartbeat,
    "StatusNotification": handle_StatusNotification,
    "Authorize": handle_Authorize,
    "StartTransaction": handle_StartTransaction,
    "MeterValues": handle_MeterValues,
    "StopTransaction": handle_StopTransaction,
}


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket connection lifecycle
# ──────────────────────────────────────────────────────────────────────────────
async def serve(websocket: WebSocket, charge_point_id: str) -> None:
    """Long-lived WebSocket loop for one charge point."""
    if not await _is_registered(charge_point_id):
        # Reject unknown charge points (security requirement).
        await websocket.close(code=1008)  # 1008 = policy violation
        log.warning("OCPP rejected unknown charge_point_id=%s", charge_point_id)
        return

    # OCPP-J subprotocol negotiation (RFC 6455).
    await websocket.accept(subprotocol="ocpp1.6")
    session = ChargePointSession(charge_point_id, websocket)
    _REGISTRY[charge_point_id] = session
    await db.ev_charge_points.update_one(
        {"charge_point_id": charge_point_id},
        {"$set": {"online": True, "connected_at": session.connected_at}},
    )
    log.info("OCPP CP connected: %s", charge_point_id)

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
                _, call_id, action, payload = msg[0], msg[1], msg[2], msg[3] if len(msg) > 3 else {}
                await _log_message(charge_point_id, "in", action, msg)
                handler = _HANDLERS.get(action)
                if not handler:
                    err = [CALLERROR, call_id, "NotImplemented", f"Action '{action}' not supported", {}]
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
                _, call_id, result = msg[0], msg[1], msg[2] if len(msg) > 2 else {}
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
        log.exception("OCPP loop crashed for %s", charge_point_id)
    finally:
        _REGISTRY.pop(charge_point_id, None)
        await db.ev_charge_points.update_one(
            {"charge_point_id": charge_point_id},
            {"$set": {"online": False, "disconnected_at": _utcnow_iso()}},
        )
        log.info("OCPP CP disconnected: %s", charge_point_id)


# ──────────────────────────────────────────────────────────────────────────────
# Server-initiated CALLs (used by REST API)
# ──────────────────────────────────────────────────────────────────────────────
async def remote_start(charge_point_id: str, connector_id: int, id_tag: str,
                       charging_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline")
    payload: Dict[str, Any] = {"connectorId": connector_id, "idTag": id_tag}
    if charging_profile:
        payload["chargingProfile"] = charging_profile
    return await sess.send_call("RemoteStartTransaction", payload)


async def remote_stop(charge_point_id: str, transaction_id: int) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline")
    return await sess.send_call("RemoteStopTransaction", {"transactionId": transaction_id})


async def change_availability(charge_point_id: str, connector_id: int, mode: str) -> Dict[str, Any]:
    """mode: 'Operative' | 'Inoperative'"""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline")
    return await sess.send_call("ChangeAvailability", {"connectorId": connector_id, "type": mode})


async def reset(charge_point_id: str, kind: str = "Soft") -> Dict[str, Any]:
    """kind: 'Soft' | 'Hard'"""
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline")
    return await sess.send_call("Reset", {"type": kind})


async def unlock_connector(charge_point_id: str, connector_id: int) -> Dict[str, Any]:
    sess = get_session(charge_point_id)
    if not sess:
        raise RuntimeError(f"Charge point {charge_point_id} is offline")
    return await sess.send_call("UnlockConnector", {"connectorId": connector_id})
