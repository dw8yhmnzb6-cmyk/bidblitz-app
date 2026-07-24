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
import os
from motor.motor_asyncio import AsyncIOMotorClient

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
    await db.staff_bank_details.update_one(
        {"merchant_id": mid, "staff_id": staff_id},
        {"$set": {
            "merchant_id": mid, "staff_id": staff_id,
            "iban_full": iban_clean,  # in production: encrypted
            "iban_masked": f"{iban_clean[:4]}••••{iban_clean[-4:]}",
            "account_holder": req.account_holder,
            "bic": req.bic,
            "verified": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
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
    """Echte Auszahlung. SEPA manual: erzeugt Payout-Job, Merchant überweist via Banking-Portal.
    Stripe Connect: TODO — erzeugt Stripe Transfer (benötigt connected account)."""
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": req.staff_id, "merchant_id": mid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")

    # Sum credited (unpaid)
    pipe = [
        {"$match": {"merchant_id": mid, "staff_id": req.staff_id, "status": "credited"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_eur"}, "count": {"$sum": 1}}},
    ]
    agg = await db.staff_bonus_events.aggregate(pipe).to_list(length=1)
    total = float(agg[0]["total"]) if agg else 0.0
    count = int(agg[0]["count"]) if agg else 0
    if total <= 0:
        raise HTTPException(400, "Kein auszahlbares Guthaben")

    bank = await db.staff_bank_details.find_one({"merchant_id": mid, "staff_id": req.staff_id}, {"_id": 0})
    if not bank or not bank.get("iban_full"):
        raise HTTPException(400, "Keine Bankverbindung hinterlegt. Bitte zuerst IBAN speichern.")

    payout_id = str(uuid4())
    now = datetime.now(timezone.utc)
    payout_doc = {
        "id": payout_id,
        "merchant_id": mid,
        "staff_id": req.staff_id,
        "amount_eur": total,
        "event_count": count,
        "method": req.method,
        "status": "pending",
        "iban_masked": bank.get("iban_masked"),
        "account_holder": bank.get("account_holder"),
        "reference": f"BB-{payout_id[:8].upper()}",
        "created_at": now.isoformat(),
        "completed_at": None,
    }

    # Stripe Connect path (uses staff_bank_details.stripe_account_id from /api/staff/wallet/connect/* flow)
    if req.method == "stripe_connect":
        try:
            stripe_account_id = bank.get("stripe_account_id")
            payouts_enabled = bool(bank.get("payouts_enabled"))
            if not stripe_account_id:
                payout_doc["status"] = "needs_stripe_onboarding"
                payout_doc["error"] = "Mitarbeiter hat keinen Stripe Connect Account. Bitte zuerst Onboarding abschließen (/api/staff/wallet/connect/onboard)."
            elif not payouts_enabled:
                payout_doc["status"] = "needs_stripe_onboarding"
                payout_doc["error"] = "Stripe Connect Onboarding nicht abgeschlossen (payouts_enabled=false). Bitte requirements.currently_due erfüllen."
            else:
                import stripe
                stripe.api_key = os.getenv("STRIPE_API_KEY")
                if not stripe.api_key:
                    raise RuntimeError("STRIPE_API_KEY fehlt")
                transfer = stripe.Transfer.create(
                    amount=int(total * 100),
                    currency="eur",
                    destination=stripe_account_id,
                    description=f"BidBlitz Wallet-Auszahlung {payout_doc['reference']}",
                    metadata={"merchant_id": mid, "staff_id": req.staff_id, "payout_id": payout_id},
                )
                payout_doc["status"] = "processing"
                payout_doc["stripe_transfer_id"] = transfer.id
                payout_doc["stripe_account_id"] = stripe_account_id
        except Exception as e:
            payout_doc["status"] = "failed"
            payout_doc["error"] = str(e)[:300]

    await db.staff_payouts.insert_one(payout_doc)

    # Mark bonus events as wallet_paid ONLY if the payout actually went out / is in flight.
    # Failed or pending-onboarding payouts must NOT consume the credited bonuses.
    if payout_doc["status"] in ("pending", "processing"):
        await db.staff_bonus_events.update_many(
            {"merchant_id": mid, "staff_id": req.staff_id, "status": "credited"},
            {"$set": {"status": "wallet_paid", "paid_at": now.isoformat(), "payout_id": payout_id}},
        )

    payout_doc.pop("_id", None)
    return {"success": True, "payout": payout_doc, "next_step":
            ("Stripe Transfer wird in 1-3 Werktagen ausgeführt" if req.method == "stripe_connect"
             else f"SEPA-Überweisung {payout_doc['reference']} an {bank.get('iban_masked')} – bitte im Banking-Portal ausführen")}


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
    """Merchant markiert SEPA-Auszahlung als erfolgt (manuelle Bestätigung)."""
    mid = await _merchant_id(request)
    res = await db.staff_payouts.update_one(
        {"id": payout_id, "merchant_id": mid, "status": "pending"},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Payout nicht gefunden oder nicht im pending-Status")
    return {"success": True}
