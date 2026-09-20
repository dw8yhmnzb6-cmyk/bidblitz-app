"""
BidBlitz Staff - Wallet (Bonus & Trinkgeld)
=============================================
- Bonus für Schichten, Pünktlichkeit, Extra-Schichten
- Trinkgeld pro Tag/Schicht/Manager-Verteilung
- Wallet-Saldo pro Mitarbeiter (in BidBlitz Wallet integriert)

Collections:
  staff_bonus_events     (id, merchant_id, staff_id, type, amount_eur, note, ref_shift_id, status)
  staff_tip_pots         (id, merchant_id, date, total_amount_eur, distribution, distributed_at)
  staff_wallet_balances  (computed via aggregation)
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, Literal, List, Dict
from datetime import datetime, timezone
from uuid import uuid4
import hashlib
import os
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import TEST_MODE

router = APIRouter(prefix="/api/staff/wallet", tags=["staff-wallet"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


BONUS_TYPES = {
    "shift_bonus": "Schicht-Bonus",
    "punctuality": "Pünktlichkeit",
    "extra_shift": "Extra-Schicht",
    "performance": "Performance",
    "manual": "Manuell",
}


class BonusCreate(BaseModel):
    staff_id: str
    type: Literal["shift_bonus", "punctuality", "extra_shift", "performance", "manual"]
    amount_eur: float
    note: Optional[str] = None
    ref_shift_id: Optional[str] = None


class TipPotCreate(BaseModel):
    total_amount_eur: float
    date: Optional[str] = None  # ISO date; defaults to today
    note: Optional[str] = None
    distribution: Optional[Literal["equal_hours", "equal_staff", "manual"]] = "equal_hours"
    manual_split: Optional[Dict[str, float]] = None  # staff_id → amount (for manual mode)


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _staff_session(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    member = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0, "pin_hash": 0})
    if not member:
        raise HTTPException(401, "Session ungültig")
    return member


# ───────────────────────────────────────────────────────────────────────
# Bonus
# ───────────────────────────────────────────────────────────────────────
@router.post("/bonus")
async def grant_bonus(req: BonusCreate, request: Request):
    """Merchant vergibt Bonus an Mitarbeiter."""
    mid = await _merchant_id(request)
    if req.amount_eur <= 0:
        raise HTTPException(400, "Betrag muss > 0 sein")
    member = await db.staff_members.find_one({"id": req.staff_id, "merchant_id": mid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")

    doc = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "staff_id": req.staff_id,
        "type": req.type,
        "type_label": BONUS_TYPES[req.type],
        "amount_eur": round(req.amount_eur, 2),
        "note": req.note,
        "ref_shift_id": req.ref_shift_id,
        "status": "credited",  # credited → wallet_pending → wallet_paid
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_bonus_events.insert_one(doc)
    doc.pop("_id", None)

    # Auto-Notification
    try:
        from routes.staff_notifications import create_notification
        await create_notification(
            mid, req.staff_id, "info",
            title=f"Bonus erhalten: {BONUS_TYPES[req.type]}",
            body=f"€{req.amount_eur:.2f} — {req.note or ''}",
            meta={"bonus_id": doc["id"], "amount_eur": req.amount_eur},
        )
    except Exception:
        pass

    return {"success": True, "bonus": doc}


@router.get("/bonus/list")
async def list_bonus(request: Request, staff_id: Optional[str] = None, limit: int = 100):
    mid = await _merchant_id(request)
    q: dict = {"merchant_id": mid}
    if staff_id:
        q["staff_id"] = staff_id
    items = await db.staff_bonus_events.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    total = sum(b.get("amount_eur", 0) for b in items)
    return {"success": True, "rows": items, "total_eur": round(total, 2)}


# ───────────────────────────────────────────────────────────────────────
# Tip Pots
# ───────────────────────────────────────────────────────────────────────
@router.post("/tips/pot")
async def create_tip_pot(req: TipPotCreate, request: Request):
    """Trinkgeld-Pott für einen Tag/Schicht anlegen + automatisch verteilen."""
    mid = await _merchant_id(request)
    if req.total_amount_eur <= 0:
        raise HTTPException(400, "Betrag muss > 0 sein")
    day = req.date or datetime.now(timezone.utc).date().isoformat()

    distribution = []
    if req.distribution == "manual" and req.manual_split:
        for sid, amt in req.manual_split.items():
            if amt <= 0:
                continue
            distribution.append({"staff_id": sid, "amount_eur": round(float(amt), 2)})
    else:
        # Compute hours that day from clock_events
        from datetime import datetime as _dt, timedelta as _td
        start = _dt.fromisoformat(day + "T00:00:00+00:00")
        end = start + _td(days=1)
        events = await db.staff_clock_events.find(
            {"merchant_id": mid, "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
            {"_id": 0},
        ).sort("timestamp", 1).to_list(length=2000)
        minutes_by_staff: dict = {}
        last_in: dict = {}
        for ev in events:
            sid = ev["staff_id"]
            t = _dt.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
            if ev["action"] == "clock_in":
                last_in[sid] = t
            elif ev["action"] == "clock_out" and sid in last_in:
                minutes_by_staff[sid] = minutes_by_staff.get(sid, 0) + int((t - last_in[sid]).total_seconds() / 60)
                last_in.pop(sid, None)

        if req.distribution == "equal_staff":
            workers = list(minutes_by_staff.keys())
            if not workers:
                raise HTTPException(400, "Niemand hat an diesem Tag gearbeitet")
            share = round(req.total_amount_eur / len(workers), 2)
            distribution = [{"staff_id": s, "amount_eur": share} for s in workers]
        else:  # equal_hours
            total_min = sum(minutes_by_staff.values())
            if total_min == 0:
                raise HTTPException(400, "Keine Arbeitszeit am Tag")
            distribution = [
                {"staff_id": s, "amount_eur": round(req.total_amount_eur * (m / total_min), 2),
                 "minutes": m}
                for s, m in minutes_by_staff.items()
            ]

    pot_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    pot = {
        "id": pot_id,
        "merchant_id": mid,
        "date": day,
        "total_amount_eur": round(req.total_amount_eur, 2),
        "distribution_method": req.distribution,
        "distribution": distribution,
        "note": req.note,
        "status": "distributed",
        "created_at": now,
        "distributed_at": now,
    }
    await db.staff_tip_pots.insert_one(pot)
    pot.pop("_id", None)

    # Create bonus_events of type "tip" for each share for unified balance accounting
    for d in distribution:
        await db.staff_bonus_events.insert_one({
            "id": str(uuid4()),
            "merchant_id": mid,
            "staff_id": d["staff_id"],
            "type": "tip",
            "type_label": "Trinkgeld",
            "amount_eur": d["amount_eur"],
            "note": req.note,
            "ref_pot_id": pot_id,
            "status": "credited",
            "created_at": now,
        })

    return {"success": True, "pot": pot, "recipients": len(distribution)}


@router.get("/tips/list")
async def list_tip_pots(request: Request, limit: int = 50):
    mid = await _merchant_id(request)
    pots = await db.staff_tip_pots.find({"merchant_id": mid}, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    return {"success": True, "pots": pots, "count": len(pots)}


# ───────────────────────────────────────────────────────────────────────
# Wallet Balances
# ───────────────────────────────────────────────────────────────────────
@router.get("/balances")
async def balances(request: Request):
    """Alle Mitarbeiter-Salden für Merchant Dashboard."""
    mid = await _merchant_id(request)
    members = await db.staff_members.find({"merchant_id": mid, "active": True}, {"_id": 0, "pin_hash": 0}).to_list(length=300)
    rows = []
    for m in members:
        events = await db.staff_bonus_events.find(
            {"merchant_id": mid, "staff_id": m["id"]}, {"_id": 0, "amount_eur": 1, "type": 1, "status": 1}
        ).to_list(length=500)
        pending = sum(e.get("amount_eur", 0) for e in events if e.get("status") == "credited")
        paid = sum(e.get("amount_eur", 0) for e in events if e.get("status") == "wallet_paid")
        tips_pending = sum(e.get("amount_eur", 0) for e in events if e.get("type") == "tip" and e.get("status") == "credited")
        bonus_pending = pending - tips_pending
        rows.append({
            "staff_id": m["id"], "name": m["name"],
            "balance_eur": round(pending, 2),
            "tips_credited_eur": round(tips_pending, 2),
            "bonus_credited_eur": round(bonus_pending, 2),
            "paid_out_eur": round(paid, 2),
            "wallet_enabled": bool(m.get("wallet_enabled", True)),
        })
    return {"success": True, "rows": rows, "total_balance_eur": round(sum(r["balance_eur"] for r in rows), 2)}


@router.get("/me/balance")
async def my_balance(member=Depends(_staff_session)):
    """Employee sieht seinen Wallet-Stand."""
    events = await db.staff_bonus_events.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)
    # Balance = nur credited (noch nicht ausgezahlt)
    pending = sum(e.get("amount_eur", 0) for e in events if e.get("status") == "credited")
    paid_total = sum(e.get("amount_eur", 0) for e in events if e.get("status") == "wallet_paid")
    return {
        "success": True,
        "balance_eur": round(pending, 2),
        "paid_lifetime_eur": round(paid_total, 2),
        "events": events[:50],
    }


# ───────────────────────────────────────────────────────────────────────
# Real Payout — Stripe Connect Express (mit Fallback auf SEPA-Manual)
# ───────────────────────────────────────────────────────────────────────
class BankDetails(BaseModel):
    iban: str
    account_holder: str
    bic: Optional[str] = None


class PayoutReq(BaseModel):
    staff_id: str
    method: Optional[Literal["stripe_connect", "sepa_manual"]] = "sepa_manual"
    idempotency_key: Optional[str] = None


@router.post("/bank/save")
async def save_bank_details(req: BankDetails, staff_id: str, request: Request):
    """Merchant speichert Bankdaten eines MA (verschlüsselt-at-rest später)."""
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": staff_id, "merchant_id": mid})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    # Masked storage — last 4 only visible in API responses
    iban_clean = req.iban.replace(" ", "").upper()
    if len(iban_clean) < 15:
        raise HTTPException(400, "Ungültige IBAN")
    bank_update = {
        "$set": {
            "merchant_id": mid,
            "staff_id": staff_id,
            "iban_masked": f"{iban_clean[:4]}••••{iban_clean[-4:]}",
            "iban_hash": hashlib.sha256(iban_clean.encode("utf-8")).hexdigest(),
            "account_holder": req.account_holder,
            "bic": req.bic,
            "verified": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    }
    if TEST_MODE:
        bank_update["$set"]["iban_full"] = iban_clean
    else:
        bank_update["$unset"] = {"iban_full": ""}
    await db.staff_bank_details.update_one(
        {"merchant_id": mid, "staff_id": staff_id},
        bank_update,
        upsert=True,
    )
    return {"success": True, "iban_masked": f"{iban_clean[:4]}••••{iban_clean[-4:]}"}


@router.get("/bank/me")
async def get_my_bank_details(member=Depends(_staff_session)):
    """Mitarbeiter sieht eigene Bankdaten (masked)."""
    b = await db.staff_bank_details.find_one(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"]},
        {"_id": 0, "iban_full": 0},
    )
    return {"success": True, "bank": b}


@router.post("/payout")
async def request_payout(req: PayoutReq, request: Request):
    """Reserve staff bonus events exactly once, then create a manual SEPA job or Stripe Connect transfer."""
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": req.staff_id, "merchant_id": mid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")

    key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    if req.method == "sepa_manual" and not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Manuelle SEPA-Auszahlung ist in Production deaktiviert, bis Bankdaten verschlüsselt-at-rest gespeichert und ein verifizierter Auszahlungsprozess angebunden ist.",
        )

    bank = await db.staff_bank_details.find_one(
        {"merchant_id": mid, "staff_id": req.staff_id},
        {"_id": 0},
    ) or {}

    if req.method == "stripe_connect":
        stripe_account_id = str(bank.get("stripe_account_id") or "")
        if not stripe_account_id:
            raise HTTPException(status_code=409, detail="Stripe Connect Onboarding erforderlich")
        if not bool(bank.get("payouts_enabled")):
            raise HTTPException(status_code=409, detail="Stripe Connect Auszahlungen sind noch nicht freigeschaltet")
        if not os.getenv("STRIPE_API_KEY"):
            raise HTTPException(status_code=503, detail="Stripe Connect ist nicht konfiguriert")
    else:
        if not bank.get("iban_full"):
            raise HTTPException(status_code=400, detail="Keine Test-Bankverbindung hinterlegt")

    payload = {
        "merchant_id": mid,
        "staff_id": req.staff_id,
        "method": req.method,
    }
    payout_id = "STFPAY-" + hashlib.sha256(
        f"{mid}:{req.staff_id}:{key}".encode("utf-8")
    ).hexdigest()[:24].upper()
    existing = await db.staff_payouts.find_one({"id": payout_id}, {"_id": 0})
    if existing:
        if existing.get("payload") != payload:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Auszahlungsdaten verwendet")
        if existing.get("status") in {
            "pending", "processing", "completed", "reconciliation_required", "needs_stripe_onboarding"
        }:
            return {"success": True, "payout": existing, "replayed": True}

    now = datetime.now(timezone.utc)
    await db.staff_payouts.update_one(
        {"id": payout_id},
        {"$setOnInsert": {
            "id": payout_id,
            "merchant_id": mid,
            "staff_id": req.staff_id,
            "method": req.method,
            "payload": payload,
            "status": "reserving",
            "reference": f"BB-{payout_id[-8:]}",
            "created_at": now.isoformat(),
            "completed_at": None,
        }},
        upsert=True,
    )

    await db.staff_bonus_events.update_many(
        {
            "merchant_id": mid,
            "staff_id": req.staff_id,
            "status": "credited",
        },
        {"$set": {
            "status": "payout_reserved",
            "payout_id": payout_id,
            "reserved_at": now.isoformat(),
        }},
    )

    reserved_events = await db.staff_bonus_events.find(
        {
            "merchant_id": mid,
            "staff_id": req.staff_id,
            "status": "payout_reserved",
            "payout_id": payout_id,
        },
        {"_id": 0, "amount_eur": 1},
    ).to_list(length=1000)
    total = round(sum(float(e.get("amount_eur") or 0) for e in reserved_events), 2)
    count = len(reserved_events)
    if total <= 0 or count == 0:
        await db.staff_payouts.update_one(
            {"id": payout_id, "status": "reserving"},
            {"$set": {"status": "failed", "error": "Kein auszahlbares Guthaben", "failed_at": now.isoformat()}},
        )
        raise HTTPException(status_code=400, detail="Kein auszahlbares Guthaben")

    payout_patch = {
        "amount_eur": total,
        "event_count": count,
        "iban_masked": bank.get("iban_masked"),
        "account_holder": bank.get("account_holder"),
    }
    if req.method == "sepa_manual":
        payout_patch["status"] = "pending"
        await db.staff_payouts.update_one(
            {"id": payout_id, "status": "reserving"},
            {"$set": payout_patch},
        )
        payout = await db.staff_payouts.find_one({"id": payout_id}, {"_id": 0}) or {}
        return {
            "success": True,
            "payout": payout,
            "replayed": False,
            "next_step": f"SEPA-Überweisung {payout.get('reference')} an {bank.get('iban_masked')} – bitte im Test-Banking-Portal ausführen",
        }

    payout_patch.update({
        "status": "provider_processing",
        "stripe_account_id": bank.get("stripe_account_id"),
        "provider_started_at": now.isoformat(),
    })
    await db.staff_payouts.update_one(
        {"id": payout_id, "status": {"$in": ["reserving", "provider_processing"]}},
        {"$set": payout_patch},
    )

    try:
        import stripe
        stripe.api_key = os.getenv("STRIPE_API_KEY")
        transfer = stripe.Transfer.create(
            amount=int(round(total * 100)),
            currency="eur",
            destination=bank["stripe_account_id"],
            description=f"BidBlitz Wallet-Auszahlung BB-{payout_id[-8:]}",
            metadata={"merchant_id": mid, "staff_id": req.staff_id, "payout_id": payout_id},
            idempotency_key=f"staff-payout:{payout_id}",
        )
    except Exception as e:
        await db.staff_payouts.update_one(
            {"id": payout_id},
            {"$set": {
                "status": "reconciliation_required",
                "error": str(e)[:300],
                "failed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(
            status_code=502,
            detail="Stripe-Auszahlung benötigt Abstimmung; Bonusguthaben bleibt reserviert und wird nicht erneut ausgezahlt.",
        )

    finished_at = datetime.now(timezone.utc).isoformat()
    await db.staff_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": "processing",
            "stripe_transfer_id": transfer.id,
            "provider_completed_at": finished_at,
        }},
    )
    await db.staff_bonus_events.update_many(
        {
            "merchant_id": mid,
            "staff_id": req.staff_id,
            "status": "payout_reserved",
            "payout_id": payout_id,
        },
        {"$set": {"status": "wallet_paid", "paid_at": finished_at}},
    )

    payout = await db.staff_payouts.find_one({"id": payout_id}, {"_id": 0}) or {}
    return {
        "success": True,
        "payout": payout,
        "replayed": False,
        "next_step": "Stripe Transfer wurde an den verifizierten Connect-Account übergeben",
    }


@router.get("/payouts")
async def list_payouts(request: Request, staff_id: Optional[str] = None, limit: int = 50):
    mid = await _merchant_id(request)
    q: dict = {"merchant_id": mid}
    if staff_id: q["staff_id"] = staff_id
    items = await db.staff_payouts.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    return {"success": True, "payouts": items, "count": len(items)}


@router.get("/payouts/me")
async def my_payouts(member=Depends(_staff_session), limit: int = 30):
    items = await db.staff_payouts.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(length=limit)
    return {"success": True, "payouts": items, "count": len(items)}


@router.post("/payouts/{payout_id}/confirm")
async def confirm_payout(payout_id: str, request: Request):
    """Merchant bestätigt eine TEST_MODE-SEPA-Auszahlung genau einmal."""
    mid = await _merchant_id(request)
    if not TEST_MODE:
        raise HTTPException(status_code=503, detail="Manuelle SEPA-Bestätigung ist in Production deaktiviert")
    now = datetime.now(timezone.utc).isoformat()
    res = await db.staff_payouts.update_one(
        {
            "id": payout_id,
            "merchant_id": mid,
            "method": "sepa_manual",
            "status": "pending",
        },
        {"$set": {"status": "completed", "completed_at": now}},
    )
    if res.modified_count == 0:
        existing = await db.staff_payouts.find_one(
            {"id": payout_id, "merchant_id": mid, "method": "sepa_manual"},
            {"_id": 0, "status": 1},
        )
        if existing and existing.get("status") == "completed":
            return {"success": True, "replayed": True}
        raise HTTPException(404, "Payout nicht gefunden oder nicht im pending-Status")
    await db.staff_bonus_events.update_many(
        {
            "merchant_id": mid,
            "status": "payout_reserved",
            "payout_id": payout_id,
        },
        {"$set": {"status": "wallet_paid", "paid_at": now}},
    )
    return {"success": True, "replayed": False}
