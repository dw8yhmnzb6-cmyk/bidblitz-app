"""Retry-safe wallet settlement for the legacy /api/ladesaeulen UI."""
import hashlib
import random
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from core.database import db
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
from core.security import get_current_user


def _now():
    return datetime.now(timezone.utc).isoformat()


def _stable_key(prefix: str, user_id: str, session_id: str) -> str:
    return f"{prefix}:{hashlib.sha256(f'{user_id}:{session_id}'.encode()).hexdigest()}"


async def _wallet_user(request: Request):
    user = await get_current_user(request)
    doc = await db.users.find_one({"email": user.get("email", "")})
    if not doc:
        raise HTTPException(404, "User nicht gefunden")
    return user, doc, str(doc["_id"])


async def start_legacy_ev_session(req, request: Request):
    user, user_doc, user_id = await _wallet_user(request)
    email = user.get("email", "")
    station = await db.ev_stations.find_one({"station_id": req.station_id}, {"_id": 0})
    if not station:
        raise HTTPException(404, "Station nicht gefunden")

    # The user document is the serialization point. A retry reuses the active
    # session instead of generating a second wallet debit.
    locked_id = user_doc.get("active_legacy_ev_session_id")
    if locked_id:
        active = await db.ev_sessions.find_one({"session_id": locked_id, "user_email": email})
        if active and active.get("status") in {"starting", "charging"}:
            if active.get("station_id") != req.station_id:
                raise HTTPException(409, "Es läuft bereits ein anderer Ladevorgang")
            active.pop("_id", None)
            return {"ok": True, "session": active, "reserved": 5.0,
                    "wallet_balance": float(user_doc.get("balance", 0)), "idempotent_replay": True}
        if active and active.get("status") == "stopping":
            raise HTTPException(409, "Der aktive Ladevorgang wird gerade beendet")
        # Stale lock from a terminal legacy session can be reclaimed safely.
        await db.users.update_one(
            {"_id": user_doc["_id"], "active_legacy_ev_session_id": locked_id},
            {"$set": {"active_legacy_ev_session_id": None}},
        )

    supplied = (getattr(req, "idempotency_key", "") or request.headers.get("Idempotency-Key") or "").strip()
    candidate = "evs_" + (hashlib.sha256(f"{user_id}:{supplied}".encode()).hexdigest()[:20]
                            if supplied else secrets.token_hex(10))
    claim = await db.users.update_one(
        {"_id": user_doc["_id"], "$or": [
            {"active_legacy_ev_session_id": {"$exists": False}},
            {"active_legacy_ev_session_id": None},
        ]},
        {"$set": {"active_legacy_ev_session_id": candidate}},
    )
    if claim.modified_count != 1:
        fresh = await db.users.find_one({"_id": user_doc["_id"]}, {"active_legacy_ev_session_id": 1}) or {}
        active_id = fresh.get("active_legacy_ev_session_id")
        active = await db.ev_sessions.find_one({"session_id": active_id, "user_email": email}) if active_id else None
        if active and active.get("station_id") == req.station_id and active.get("status") in {"starting", "charging"}:
            active.pop("_id", None)
            return {"ok": True, "session": active, "reserved": 5.0,
                    "wallet_balance": float(user_doc.get("balance", 0)), "idempotent_replay": True}
        raise HTTPException(409, "Ein Ladevorgang wird bereits gestartet")

    session_id = candidate
    reserve_key = _stable_key("ladesaeulen:start", user_id, session_id)
    reserve = await debit_wallet(
        user_id=user_id, amount=5.0, tx_type=TransactionType.EV_CHARGING,
        description=f"Ladesäule Reservierung: {station['name']}", reference=session_id,
        metadata={"station_id": req.station_id, "phase": "reservation"}, idempotency_key=reserve_key,
    )
    if not reserve.success:
        if str(getattr(reserve.status, "value", reserve.status)) not in {"pending", "reconciliation_required"}:
            await db.users.update_one(
                {"_id": user_doc["_id"], "active_legacy_ev_session_id": session_id},
                {"$set": {"active_legacy_ev_session_id": None}},
            )
        code = 409 if str(getattr(reserve.status, "value", reserve.status)) in {"pending", "reconciliation_required"} else 400
        raise HTTPException(code, reserve.error or "Mindestguthaben 5€ erforderlich. Bitte Wallet aufladen.")

    session_doc = {
        "_id": session_id, "session_id": session_id, "station_id": req.station_id,
        "station_name": station["name"], "operator": station["operator"], "connector": req.connector,
        "vehicle": req.vehicle, "user_email": email, "user_id": user_id,
        "user_name": user.get("name", ""), "power_kw": station["power_kw"],
        "price_per_kwh": station["price_per_kwh"], "kwh_charged": 0, "cost": 0,
        "reserved": 5.0, "reserve_transaction_id": reserve.transaction_id,
        "status": "starting", "payment_method": "bidblitz_wallet", "started_at": _now(),
    }
    await db.ev_sessions.update_one({"_id": session_id}, {"$setOnInsert": session_doc}, upsert=True)
    slot = await db.ev_stations.update_one(
        {"station_id": req.station_id, "slots_available": {"$gt": 0}, "active_session_markers": {"$ne": session_id}},
        {"$inc": {"slots_available": -1}, "$addToSet": {"active_session_markers": session_id}},
    )
    if slot.modified_count != 1:
        current = await db.ev_stations.find_one({"station_id": req.station_id}, {"active_session_markers": 1}) or {}
        if session_id not in (current.get("active_session_markers") or []):
            refund = await credit_wallet(
                user_id=user_id, amount=5.0, tx_type=TransactionType.REFUND,
                description=f"Ladesäule Reservierung storniert: {station['name']}", reference=session_id,
                metadata={"station_id": req.station_id, "phase": "reservation_refund"},
                idempotency_key=f"{reserve_key}:refund",
            )
            await db.ev_sessions.update_one({"_id": session_id}, {"$set": {
                "status": "failed", "failure_reason": "no_slot", "refund_transaction_id": refund.transaction_id,
                "failed_at": _now(),
            }})
            if refund.success:
                await db.users.update_one(
                    {"_id": user_doc["_id"], "active_legacy_ev_session_id": session_id},
                    {"$set": {"active_legacy_ev_session_id": None}},
                )
            raise HTTPException(409, "Keine freien Ladepunkte")

    await db.ev_sessions.update_one({"_id": session_id}, {"$set": {"status": "charging"}})
    session = await db.ev_sessions.find_one({"_id": session_id}, {"_id": 0})
    return {"ok": True, "session": session, "reserved": 5.0,
            "wallet_balance": reserve.new_balance, "idempotent_replay": reserve.idempotent_replay}


async def stop_legacy_ev_session(req, request: Request):
    user, user_doc, user_id = await _wallet_user(request)
    email = user.get("email", "")
    session = await db.ev_sessions.find_one({"session_id": req.session_id, "user_email": email})
    if not session:
        raise HTTPException(404, "Session nicht gefunden")
    if session.get("status") == "completed" and session.get("receipt"):
        receipt = session["receipt"]
        return {"ok": True, "kwh_charged": receipt["kwh_charged"], "cost": receipt["subtotal"],
                "cashback": receipt["cashback"], "new_balance": float(user_doc.get("balance", 0)),
                "receipt": receipt, "payment_status": session.get("payment_status", "paid"),
                "outstanding": float(session.get("outstanding", 0) or 0), "idempotent_replay": True}
    if session.get("status") not in {"charging", "stopping"}:
        raise HTTPException(409, "Ladevorgang kann in diesem Status nicht beendet werden")

    stop_key = _stable_key("ladesaeulen:stop", user_id, req.session_id)
    if session.get("status") == "charging":
        kwh = round(random.uniform(5, 60), 1)
        cost = round(kwh * session.get("price_per_kwh", 0.45), 2)
        await db.ev_sessions.update_one(
            {"_id": session["_id"], "status": "charging"},
            {"$set": {"status": "stopping", "settlement_kwh": kwh, "settlement_cost": cost,
                      "settlement_started_at": _now()}},
        )
        session = await db.ev_sessions.find_one({"_id": session["_id"]})

    kwh = float(session.get("settlement_kwh", 0) or 0)
    cost = round(float(session.get("settlement_cost", 0) or 0), 2)
    reserved = round(float(session.get("reserved", 5.0) or 0), 2)
    additional_due = max(round(cost - reserved, 2), 0.0)
    additional_paid = 0.0
    if additional_due > 0:
        charge = await debit_wallet(
            user_id=user_id, amount=additional_due, tx_type=TransactionType.EV_CHARGING,
            description=f"Ladevorgang: {session.get('station_name', '')}", reference=req.session_id,
            metadata={"station_id": session.get("station_id"), "phase": "final_charge", "kwh": kwh},
            idempotency_key=f"{stop_key}:charge",
        )
        if charge.success:
            additional_paid = additional_due
        elif str(getattr(charge.status, "value", charge.status)) in {"pending", "reconciliation_required"}:
            raise HTTPException(409, charge.error or "Wallet-Abrechnung wird noch geprüft")
    elif cost < reserved:
        refund = await credit_wallet(
            user_id=user_id, amount=round(reserved - cost, 2), tx_type=TransactionType.REFUND,
            description=f"Restguthaben Ladesäule: {session.get('station_name', '')}", reference=req.session_id,
            metadata={"station_id": session.get("station_id"), "phase": "unused_reservation_refund"},
            idempotency_key=f"{stop_key}:refund",
        )
        if not refund.success:
            raise HTTPException(409, refund.error or "Reservierungs-Erstattung wird noch geprüft")

    paid = min(cost, reserved + additional_paid)
    outstanding = max(round(cost - paid, 2), 0.0)
    cashback = round(paid * 0.03, 2)
    if cashback > 0:
        reward = await credit_wallet(
            user_id=user_id, amount=cashback, tx_type=TransactionType.REWARD,
            description=f"3% Lade-Cashback: {session.get('station_name', '')}", reference=req.session_id,
            metadata={"station_id": session.get("station_id"), "phase": "cashback"},
            idempotency_key=f"{stop_key}:cashback",
        )
        if not reward.success:
            raise HTTPException(409, reward.error or "Cashback-Buchung wird noch geprüft")

    now = _now()
    payment_status = "paid" if outstanding <= 0 else "partial"
    receipt = {
        "receipt_id": "rcpt_" + hashlib.sha256(req.session_id.encode()).hexdigest()[:12],
        "session_id": req.session_id, "station": session.get("station_name", ""),
        "operator": session.get("operator", ""), "connector": session.get("connector", ""),
        "kwh_charged": kwh, "price_per_kwh": session.get("price_per_kwh", 0), "subtotal": cost,
        "cashback": cashback, "total_paid": paid, "outstanding": outstanding,
        "payment_status": payment_status, "payment_method": "BidBlitz Wallet", "date": now,
    }
    await db.ev_stations.update_one(
        {"station_id": session["station_id"], "active_session_markers": req.session_id,
         "completed_session_markers": {"$ne": req.session_id}},
        {"$inc": {"slots_available": 1, "total_sessions": 1}, "$pull": {"active_session_markers": req.session_id},
         "$addToSet": {"completed_session_markers": req.session_id}},
    )
    await db.ev_sessions.update_one({"_id": session["_id"], "status": "stopping"}, {"$set": {
        "status": "completed", "kwh_charged": kwh, "cost": cost, "cashback": cashback, "ended_at": now,
        "payment_status": payment_status, "outstanding": outstanding, "payment_method": "bidblitz_wallet", "receipt": receipt,
    }})
    await db.users.update_one(
        {"_id": user_doc["_id"], "active_legacy_ev_session_id": req.session_id},
        {"$set": {"active_legacy_ev_session_id": None}},
    )
    fresh = await db.users.find_one({"_id": user_doc["_id"]}, {"balance": 1}) or {}
    return {"ok": True, "kwh_charged": kwh, "cost": cost, "cashback": cashback,
            "new_balance": round(float(fresh.get("balance", 0) or 0), 2), "receipt": receipt,
            "payment_status": payment_status, "outstanding": outstanding}
