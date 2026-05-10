"""
BidBlitz POS — RKSV / österreichische Kassenrichtlinie

Implements the Austrian Registrierkassensicherheitsverordnung (RKSV) for
fiscal compliance. Mirrors the German TSE module but produces:
  • Start-Beleg, Null-Beleg (monatlich), Monats-Beleg, Jahres-Beleg, Schluss-Beleg
  • Continuous receipt signature chain (Datenerfassungsprotokoll DEP)
  • SHA-256 signature with HMAC fallback when no smartcard configured
  • DEP export endpoint for Finanzamt audit
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user
from routes.pos_system import _require_store_access, _audit, short_id, now_iso

router = APIRouter(prefix="/api/pos/rksv", tags=["POS RKSV (AT)"])


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _signing_secret(store_id: str) -> bytes:
    """Per-store HMAC secret (replace with smartcard signing in production)."""
    seed = os.environ.get("RKSV_SECRET", "bidblitz-rksv-default-2026")
    return hashlib.sha256(f"{seed}:{store_id}".encode()).digest()


def _sign_receipt(store_id: str, prev_sig: str, payload: str) -> str:
    """RKSV-style chained signature: SHA-256(prev_signature || receipt_data)."""
    secret = _signing_secret(store_id)
    body = f"{prev_sig}|{payload}".encode()
    sig = hmac.new(secret, body, hashlib.sha256).digest()
    return base64.b64encode(sig).decode()


# ─── Helpers ────────────────────────────────────────────────────────────
async def _get_or_init_state(store_id: str) -> Dict[str, Any]:
    state = await db.pos_rksv_state.find_one({"store_id": store_id})
    if state:
        state.pop("_id", None)
        return state
    initial = {
        "store_id": store_id,
        "kassen_id": short_id("AT-KASSE", 10),
        "umsatzzaehler": 0.0,
        "last_signature": "0",
        "last_receipt_no": 0,
        "active": False,        # Activated after Start-Beleg
        "started_at": None,
        "closed_at": None,
    }
    await db.pos_rksv_state.insert_one(initial)
    return initial


async def _write_dep(store_id: str, beleg_typ: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Append a receipt to the Datenerfassungsprotokoll (DEP)."""
    state = await _get_or_init_state(store_id)
    receipt_no = int(state.get("last_receipt_no", 0)) + 1
    umsatz = float(payload.get("brutto", 0))
    new_umsatz = round(float(state.get("umsatzzaehler", 0)) + umsatz, 2)
    sign_input = (
        f"{receipt_no}|{beleg_typ}|{payload.get('brutto', 0)}|"
        f"{payload.get('netto', 0)}|{new_umsatz}|{_utcnow()}"
    )
    sig = _sign_receipt(store_id, state.get("last_signature", "0"), sign_input)
    record = {
        "store_id": store_id,
        "kassen_id": state["kassen_id"],
        "receipt_no": receipt_no,
        "beleg_typ": beleg_typ,
        "payload": payload,
        "umsatzzaehler_vor": state.get("umsatzzaehler", 0),
        "umsatzzaehler_nach": new_umsatz,
        "previous_signature": state.get("last_signature", "0"),
        "signature": sig,
        "sign_input": sign_input,
        "ts": _utcnow(),
    }
    await db.pos_rksv_dep.insert_one(record)
    await db.pos_rksv_state.update_one(
        {"store_id": store_id},
        {"$set": {
            "umsatzzaehler": new_umsatz,
            "last_signature": sig,
            "last_receipt_no": receipt_no,
        }},
    )
    record.pop("_id", None)
    return record


# ─── State / Activation ─────────────────────────────────────────────────
@router.get("/state")
async def rksv_state(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    state = await _get_or_init_state(store_id)
    state.pop("_id", None)
    return state


@router.post("/start-beleg")
async def start_beleg(request: Request, body: Dict[str, Any]):
    """Issue the Start-Beleg (one-time activation per Kassen-ID)."""
    user = await get_current_user(request)
    store_id = body.get("store_id")
    if not store_id:
        raise HTTPException(400, "store_id erforderlich")
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    state = await _get_or_init_state(store_id)
    if state.get("active"):
        raise HTTPException(409, "Kasse bereits aktiviert")
    record = await _write_dep(store_id, "START", {
        "brutto": 0, "netto": 0, "kassen_id": state["kassen_id"],
        "issued_by": user.get("email", str(user["_id"])),
    })
    await db.pos_rksv_state.update_one(
        {"store_id": store_id},
        {"$set": {"active": True, "started_at": _utcnow()}},
    )
    await _audit(user, "pos.rksv.start", {"store_id": store_id})
    return {"ok": True, "beleg": record}


@router.post("/null-beleg")
async def null_beleg(request: Request, body: Dict[str, Any]):
    """Monthly Null-Beleg — €0.00 receipt to attest cash register is alive."""
    user = await get_current_user(request)
    store_id = body.get("store_id")
    if not store_id:
        raise HTTPException(400, "store_id erforderlich")
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    state = await _get_or_init_state(store_id)
    if not state.get("active"):
        raise HTTPException(409, "Kasse nicht aktiv — Start-Beleg fehlt")
    record = await _write_dep(store_id, "NULL", {
        "brutto": 0, "netto": 0,
        "issued_by": user.get("email", str(user["_id"])),
    })
    return {"ok": True, "beleg": record}


@router.post("/monats-beleg")
async def monats_beleg(request: Request, body: Dict[str, Any]):
    """Monatlicher Beleg — Umsatzsumme des laufenden Monats persistieren."""
    user = await get_current_user(request)
    store_id = body.get("store_id")
    if not store_id:
        raise HTTPException(400, "store_id erforderlich")
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    state = await _get_or_init_state(store_id)
    record = await _write_dep(store_id, "MONAT", {
        "brutto": 0, "netto": 0,
        "umsatz_total": state.get("umsatzzaehler", 0),
        "month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "issued_by": user.get("email", str(user["_id"])),
    })
    return {"ok": True, "beleg": record}


@router.post("/jahres-beleg")
async def jahres_beleg(request: Request, body: Dict[str, Any]):
    user = await get_current_user(request)
    store_id = body.get("store_id")
    if not store_id:
        raise HTTPException(400, "store_id erforderlich")
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    state = await _get_or_init_state(store_id)
    record = await _write_dep(store_id, "JAHR", {
        "brutto": 0, "netto": 0,
        "umsatz_total": state.get("umsatzzaehler", 0),
        "year": datetime.now(timezone.utc).year,
        "issued_by": user.get("email", str(user["_id"])),
    })
    return {"ok": True, "beleg": record}


@router.post("/schluss-beleg")
async def schluss_beleg(request: Request, body: Dict[str, Any]):
    user = await get_current_user(request)
    store_id = body.get("store_id")
    if not store_id:
        raise HTTPException(400, "store_id erforderlich")
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    state = await _get_or_init_state(store_id)
    if not state.get("active"):
        raise HTTPException(409, "Kasse nicht aktiv")
    record = await _write_dep(store_id, "SCHLUSS", {
        "brutto": 0, "netto": 0,
        "umsatz_total": state.get("umsatzzaehler", 0),
        "issued_by": user.get("email", str(user["_id"])),
    })
    await db.pos_rksv_state.update_one(
        {"store_id": store_id},
        {"$set": {"active": False, "closed_at": _utcnow()}},
    )
    await _audit(user, "pos.rksv.schluss", {"store_id": store_id})
    return {"ok": True, "beleg": record}


# ─── Receipt signing (for normal sales) ─────────────────────────────────
class SignSale(BaseModel):
    store_id: str
    sale_id: str
    brutto: float
    netto: float
    vat: float


@router.post("/sign-sale")
async def sign_sale(req: SignSale, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager", "cashier"})
    state = await _get_or_init_state(req.store_id)
    if not state.get("active"):
        raise HTTPException(409, "Kasse nicht aktiv — Start-Beleg fehlt")
    record = await _write_dep(req.store_id, "NORMAL", {
        "sale_id": req.sale_id,
        "brutto": req.brutto, "netto": req.netto, "vat": req.vat,
    })
    return {
        "ok": True,
        "signature": record["signature"],
        "receipt_no": record["receipt_no"],
        "kassen_id": state["kassen_id"],
        "umsatzzaehler": record["umsatzzaehler_nach"],
    }


# ─── DEP export ─────────────────────────────────────────────────────────
@router.get("/dep")
async def dep_export(request: Request, store_id: str, limit: int = 1000):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    rows = await db.pos_rksv_dep.find(
        {"store_id": store_id}, {"_id": 0}
    ).sort("receipt_no", 1).to_list(limit)
    return {"store_id": store_id, "dep": rows, "count": len(rows)}


@router.get("/dep/verify")
async def dep_verify(request: Request, store_id: str):
    """Verify the integrity of the entire DEP chain."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    rows = await db.pos_rksv_dep.find(
        {"store_id": store_id}, {"_id": 0}
    ).sort("receipt_no", 1).to_list(10000)
    prev = "0"
    broken_at = None
    for row in rows:
        expected = _sign_receipt(store_id, prev, row["sign_input"])
        if expected != row["signature"]:
            broken_at = row["receipt_no"]
            break
        prev = row["signature"]
    return {
        "store_id": store_id,
        "total_receipts": len(rows),
        "valid": broken_at is None,
        "broken_at": broken_at,
    }
