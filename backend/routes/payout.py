"""
BidBlitz V2 - Payout Routes
Handles merchant payout requests, history, and settlement.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import FEES, calculate_payout_fee
from core.rate_limit import limiter, RATE_PAYOUT
from core.audit import log_audit, AuditEvent, get_client_info
from core.compliance import run_compliance_check, BLOCKED, FLAGGED
import secrets

router = APIRouter(prefix="/api/payout", tags=["payout"])


def _to_amount(value) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


async def _get_merchant_sources(user_id: str):
    merchant = await db.merchants.find_one({"user_id": user_id})
    merchant_profile = await db.merchant_profiles.find_one({"user_id": user_id})
    return merchant, merchant_profile


async def _build_payout_summary(user_id: str, merchant: dict | None = None, merchant_profile: dict | None = None):
    merchant = merchant or await db.merchants.find_one({"user_id": user_id})
    merchant_profile = merchant_profile or await db.merchant_profiles.find_one({"user_id": user_id})

    if not merchant and not merchant_profile:
        return {
            "available": 0.0,
            "pending_payout": 0.0,
            "total_paid_out": 0.0,
            "total_earnings": 0.0,
            "gross_earnings": 0.0,
            "total_fees": 0.0,
        }

    merchant_refs = [user_id]
    if merchant and merchant.get("_id"):
        merchant_refs.append(str(merchant["_id"]))
    if merchant_profile and merchant_profile.get("_id"):
        merchant_refs.append(str(merchant_profile["_id"]))
    merchant_refs = list(dict.fromkeys([ref for ref in merchant_refs if ref]))

    merchant_txns = []
    if merchant_refs:
        merchant_txns = await db.merchant_transactions.find(
            {"merchant_id": {"$in": merchant_refs}, "status": "completed"},
            {"_id": 0, "amount": 1, "fee": 1, "net": 1},
        ).to_list(5000)

    legacy_txns = await db.transactions.find(
        {"user_id": user_id, "type": {"$in": ["merchant_credit", "merchant_earning"]}, "status": "completed"},
        {"_id": 0, "amount": 1, "gross_amount": 1, "fee_amount": 1, "fee_deducted": 1},
    ).to_list(5000)

    tx_gross = round(sum(_to_amount(tx.get("amount")) for tx in merchant_txns), 2)
    tx_fees = round(sum(_to_amount(tx.get("fee")) for tx in merchant_txns), 2)
    tx_net = round(sum(_to_amount(tx.get("net", _to_amount(tx.get("amount")) - _to_amount(tx.get("fee")))) for tx in merchant_txns), 2)

    legacy_gross = round(sum(_to_amount(tx.get("gross_amount", tx.get("amount"))) for tx in legacy_txns), 2)
    legacy_fees = round(sum(_to_amount(tx.get("fee_amount", tx.get("fee_deducted"))) for tx in legacy_txns), 2)
    legacy_net = round(sum(_to_amount(tx.get("amount")) for tx in legacy_txns), 2)

    gross_earnings = round(max(
        _to_amount((merchant or {}).get("gross_earnings")),
        _to_amount((merchant_profile or {}).get("total_revenue")),
        tx_gross,
        legacy_gross,
    ), 2)
    total_fees = round(max(
        _to_amount((merchant or {}).get("total_fees")),
        _to_amount((merchant_profile or {}).get("total_fees")),
        tx_fees,
        legacy_fees,
    ), 2)
    total_earnings = round(max(
        _to_amount((merchant or {}).get("total_earnings")),
        max(_to_amount((merchant_profile or {}).get("total_revenue")) - _to_amount((merchant_profile or {}).get("total_fees")), 0.0),
        tx_net,
        legacy_net,
    ), 2)

    payouts = await db.payouts.find(
        {"user_id": user_id},
        {"_id": 0, "amount": 1, "net_amount": 1, "status": 1},
    ).to_list(2000)

    pending_payout = round(sum(_to_amount(p.get("amount")) for p in payouts if p.get("status") in ("pending", "approved")), 2)
    processed_requested = round(sum(_to_amount(p.get("amount")) for p in payouts if p.get("status") == "processed"), 2)
    total_paid_out = round(sum(_to_amount(p.get("net_amount")) for p in payouts if p.get("status") == "processed"), 2)
    available = round(max(total_earnings - pending_payout - processed_requested, 0.0), 2)

    return {
        "available": available,
        "pending_payout": pending_payout,
        "total_paid_out": total_paid_out,
        "total_earnings": total_earnings,
        "gross_earnings": gross_earnings,
        "total_fees": total_fees,
    }


class PayoutRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Payout amount")
    notes: str = Field("", description="Optional notes")


def payout_ref():
    return f"PO-{secrets.token_hex(4).upper()}"


# ── Request Payout ──
@router.post("/request")
@limiter.limit(RATE_PAYOUT)
async def request_payout(req: PayoutRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    merchant, merchant_profile = await _get_merchant_sources(user_id)
    if not merchant and not merchant_profile:
        raise HTTPException(status_code=404, detail="No merchant profile found")

    payout_summary = await _build_payout_summary(user_id, merchant, merchant_profile)
    available = payout_summary["available"]
    min_payout = FEES["min_payout"]

    if req.amount < min_payout:
        raise HTTPException(status_code=400, detail=f"Minimum payout is EUR {min_payout:.2f}")

    if req.amount > available:
        raise HTTPException(status_code=400, detail=f"Insufficient available balance. Available: EUR {available:.2f}")

    # ── Compliance check ──
    compliance = await run_compliance_check(user_id, "payout", req.amount)
    if compliance["outcome"] == BLOCKED:
        await log_audit(AuditEvent.PAYOUT_CANCELLED, user_id=user_id, email=user.get("email", ""),
                        ip=ip, user_agent=ua,
                        details={"reason": "compliance_blocked", "rules": compliance["rules"], "amount": req.amount},
                        severity="warn")
        raise HTTPException(status_code=403, detail=compliance["reason"])
    if compliance["outcome"] == FLAGGED:
        await log_audit(AuditEvent.SUSPICIOUS_ACTIVITY, user_id=user_id, email=user.get("email", ""),
                        ip=ip, user_agent=ua,
                        details={"txn_type": "payout", "rules": compliance["rules"], "amount": req.amount},
                        severity="warn")

    # Check for existing pending payout (prevent duplicates)
    existing = await db.payouts.find_one({"user_id": user_id, "status": {"$in": ["pending", "approved"]}})
    if existing:
        raise HTTPException(status_code=409, detail="A payout request is already pending. Please wait for it to be processed.")

    # Calculate payout fee
    fee = calculate_payout_fee(req.amount)
    net_payout = round(req.amount - fee, 2)

    now = datetime.now(timezone.utc).isoformat()
    ref = payout_ref()

    payout_doc = {
        "id": ref,
        "merchant_id": str((merchant or merchant_profile).get("_id")),
        "user_id": user_id,
        "merchant_name": (merchant or merchant_profile).get("business_name", user.get("name", "")),
        "amount": req.amount,
        "fee": fee,
        "net_amount": net_payout,
        "currency": "EUR",
        "status": "pending",
        "reference": ref,
        "notes": req.notes,
        "created_at": now,
        "processed_at": None,
    }
    await db.payouts.insert_one(payout_doc)
    payout_doc.pop("_id", None)

    # Deduct from available balance immediately to prevent double-spend
    if merchant:
        await db.merchants.update_one(
            {"_id": merchant["_id"]},
            {"$set": {
                "gross_earnings": payout_summary["gross_earnings"],
                "total_earnings": payout_summary["total_earnings"],
                "total_fees": payout_summary["total_fees"],
                "available_payout": round(max(payout_summary["available"] - req.amount, 0.0), 2),
                "pending_payout": round(payout_summary["pending_payout"] + req.amount, 2),
            }},
        )

    await log_audit(AuditEvent.PAYOUT_REQUESTED, user_id=user_id, email=user.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"reference": ref, "amount": req.amount, "fee": fee,
                             "net_amount": net_payout, "merchant": (merchant or merchant_profile).get("business_name", "")})

    return {
        "success": True,
        "payout": payout_doc,
        "message": f"Payout of EUR {net_payout:.2f} (after EUR {fee:.2f} fee) has been requested.",
    }


# ── Payout History ──
@router.get("/history")
async def payout_history(request: Request, limit: int = 20, skip: int = 0):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant, merchant_profile = await _get_merchant_sources(user_id)
    if not merchant and not merchant_profile:
        return {"payouts": [], "total": 0}

    payouts = await db.payouts.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.payouts.count_documents({"user_id": user_id})

    return {"payouts": payouts, "total": total}


# ── Cancel Payout ──
@router.post("/cancel/{payout_ref}")
async def cancel_payout(payout_ref: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    payout = await db.payouts.find_one({"reference": payout_ref, "user_id": user_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    if payout["status"] not in ("pending",):
        raise HTTPException(status_code=400, detail=f"Cannot cancel payout with status: {payout['status']}")

    now = datetime.now(timezone.utc).isoformat()

    # Cancel and return to available
    await db.payouts.update_one(
        {"reference": payout_ref},
        {"$set": {"status": "cancelled", "processed_at": now}},
    )
    await db.merchants.update_one(
        {"user_id": user_id},
        {"$inc": {"available_payout": payout["amount"], "pending_payout": -payout["amount"]}},
    )

    merchant, merchant_profile = await _get_merchant_sources(user_id)
    summary = await _build_payout_summary(user_id, merchant, merchant_profile)
    if merchant:
        await db.merchants.update_one(
            {"_id": merchant["_id"]},
            {"$set": {
                "gross_earnings": summary["gross_earnings"],
                "total_earnings": summary["total_earnings"],
                "total_fees": summary["total_fees"],
                "available_payout": summary["available"],
                "pending_payout": summary["pending_payout"],
            }},
        )

    await log_audit(AuditEvent.PAYOUT_CANCELLED, user_id=user_id, email=user.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"reference": payout_ref, "amount": payout["amount"]})

    return {"success": True, "message": "Payout cancelled. Funds returned to available balance."}


# ── Merchant Balance Summary ──
@router.get("/balance")
async def payout_balance(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant, merchant_profile = await _get_merchant_sources(user_id)
    if not merchant and not merchant_profile:
        return {
            "available": 0.0,
            "pending_payout": 0.0,
            "total_paid_out": 0.0,
            "total_earnings": 0.0,
            "total_fees": 0.0,
            "min_payout": FEES["min_payout"],
            "payout_flat_fee": FEES["payout_flat"],
        }

    summary = await _build_payout_summary(user_id, merchant, merchant_profile)

    return {
        "available": summary["available"],
        "pending_payout": summary["pending_payout"],
        "total_paid_out": summary["total_paid_out"],
        "total_earnings": summary["total_earnings"],
        "gross_earnings": summary["gross_earnings"],
        "total_fees": summary["total_fees"],
        "min_payout": FEES["min_payout"],
        "payout_flat_fee": FEES["payout_flat"],
    }
