from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.canonical_wallet_service import admin_adjustment, get_canonical_balance, minor_to_major
from core.database import db
from routes.admin_wallet import _build_reconciliation_rows, _require_admin, _verify_admin_step_up

router = APIRouter(prefix="/api/admin", tags=["admin-wallet-reconciliation"])


class WalletAdjustmentRequest(BaseModel):
    user_id: str
    amount_minor: int
    reason: str = Field(min_length=3)
    evidence: str = Field(min_length=3)
    approved_by: str = Field(min_length=3)
    idempotency_key: str = Field(min_length=8)
    confirm: bool = False
    admin_password: str = Field(min_length=6)
    otp_code: str | None = None


@router.get("/wallet-reconciliation")
async def get_wallet_reconciliation(request: Request, limit: int = 100):
    await _require_admin(request)
    rows, summary = await _build_reconciliation_rows({}, limit)
    normalized_rows = []
    for row in rows:
        ledger_computed = round(float(row.get("transactions_sum", 0) or 0) + float(row.get("wallet_transactions_sum", 0) or 0), 2)
        canonical_balance = round(float(row.get("users_balance", 0) or 0), 2)
        legacy_balance = round(float(row.get("wallets_balance", 0) or 0), 2)
        tx_computed = round(float(row.get("transactions_sum", 0) or 0), 2)
        difference = round(canonical_balance - ledger_computed, 2)
        severity = "critical" if abs(difference) >= 50 or row.get("risk_band") == "red" else "warning" if abs(difference) >= 0.01 else "info"
        normalized_rows.append({
            "user_id": row.get("user_id"),
            "canonical_email": row.get("canonical_email") or row.get("email"),
            "role": row.get("role", "user"),
            "canonical_balance": canonical_balance,
            "legacy_wallets_balance": legacy_balance,
            "ledger_computed_balance": ledger_computed,
            "transaction_computed_balance": tx_computed,
            "difference": difference,
            "severity": severity,
            "recommended_action": row.get("recommended_action") or row.get("recommended_repair") or "review",
            "wallet_count": row.get("wallet_count", 0),
            "legacy_wallet": bool(row.get("legacy_wallet")),
            "pending_reconciliation": bool(row.get("pending_reconciliation")),
            "last_repair_at": row.get("latest_repair_at"),
        })
    return {"summary": summary, "rows": normalized_rows}


@router.post("/wallet-adjustments")
async def create_wallet_adjustment(request: Request, payload: WalletAdjustmentRequest):
    admin = await _require_admin(request)
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Bestätigung erforderlich.")
    await _verify_admin_step_up(admin, payload.admin_password, payload.otp_code)

    before_balance = await get_canonical_balance(payload.user_id)
    result = await admin_adjustment(
        user_id=payload.user_id,
        amount_minor=payload.amount_minor,
        reason=payload.reason,
        evidence=payload.evidence,
        approved_by=payload.approved_by,
        idempotency_key=payload.idempotency_key,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error or "Anpassung fehlgeschlagen")
    after_balance = await get_canonical_balance(payload.user_id)
    action_doc = {
        "repair_id": f"WALLET-ADJ-{payload.idempotency_key}",
        "user_id": payload.user_id,
        "action_type": "manual_adjustment",
        "status": "approved",
        "reason": payload.reason,
        "evidence": payload.evidence,
        "approved_by": payload.approved_by,
        "requested_by": admin.get("email"),
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "before_balance": before_balance,
        "after_balance": after_balance,
        "amount_minor": payload.amount_minor,
        "transaction_id": result.transaction_id,
        "reference": result.reference,
        "idempotency_key": payload.idempotency_key,
    }
    await db.wallet_repair_actions.insert_one(action_doc)
    return {
        "success": True,
        "transaction_id": result.transaction_id,
        "reference": result.reference,
        "before_balance": before_balance,
        "after_balance": after_balance,
        "amount_minor": payload.amount_minor,
        "amount": minor_to_major(payload.amount_minor),
        "status": result.status,
    }