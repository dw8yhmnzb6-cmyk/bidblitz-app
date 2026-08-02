from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from core.database import db
from core.money import from_minor, to_minor
from core.security import get_current_user
from services.merchant_settlement import (
    apply_reserve_rule,
    build_command_center_summary,
    build_daily_closing_report,
    calculate_settlement_preview,
    create_manual_adjustment,
    create_or_get_settlement,
    create_payout_request,
    export_settlement_csv,
    finalise_daily_closing,
    finalise_settlement,
    get_balance_view,
    get_pos_merchant_for_user,
    get_pos_role_for_user,
    get_settlement_detail,
    list_payouts,
    now_iso,
    recompute_balance_snapshot,
    update_payout_status,
)

router = APIRouter(tags=["merchant-settlements"])

FINANCIAL_ROLES = {"merchant_admin", "store_manager", "accountant"}
OWNER_ROLES = {"merchant_admin"}
MANAGER_OR_OWNER_ROLES = {"merchant_admin", "store_manager"}


class SettlementCalculateRequest(BaseModel):
    period_type: str = Field("daily", pattern="^(daily|weekly|custom)$")
    branch_id: str = ""
    start: Optional[str] = None
    end: Optional[str] = None
    idempotency_key: str = Field(default_factory=lambda: f"set-calc-{now_iso()}")


class SettlementFinaliseRequest(BaseModel):
    idempotency_key: str = Field(default_factory=lambda: f"set-final-{now_iso()}")


class MerchantPayoutRequest(BaseModel):
    amount_minor: Optional[int] = Field(None, ge=1)
    settlement_ids: list[str] = []
    destination_type: str = "bank_account"
    destination_reference_masked: str = "****"
    idempotency_key: str = Field(default_factory=lambda: f"payout-{now_iso()}")


class PayoutActionRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|processing|paid|failed|returned|cancelled)$")
    failure_reason: str = ""


class ReserveRuleRequest(BaseModel):
    merchant_id: str
    percentage_basis_points: int = Field(0, ge=0, le=10000)
    fixed_minor: int = Field(0, ge=0)
    reason: str = Field(..., min_length=3)
    hold_days: int = Field(30, ge=1, le=365)


class ManualAdjustmentRequest(BaseModel):
    merchant_id: str
    amount_minor: int = Field(..., gt=0)
    direction: str = Field(..., pattern="^(credit|debit)$")
    reason: str = Field(..., min_length=3)
    evidence: str = Field(..., min_length=3)
    idempotency_key: str = Field(..., min_length=6)
    adjustment_type: str = Field(..., pattern="^(correction|goodwill|fee_correction|payout_correction|dispute_correction)$")
    second_admin_id: Optional[str] = None


class DailyClosingCreateRequest(BaseModel):
    date: Optional[str] = None
    branch_id: str = ""
    register_id: str = ""
    counted_cash_minor: int = Field(..., ge=0)


async def _require_financial_merchant(request: Request, *, owner_only: bool = False, manager_or_owner: bool = False):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    merchant = await get_pos_merchant_for_user(user_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Kein POS-Händlerprofil gefunden")
    role = await get_pos_role_for_user(user_id, merchant["merchant_id"])
    if user.get("role") in {"admin", "bidblitz_admin"}:
        role = "merchant_admin"
    allowed = OWNER_ROLES if owner_only else (MANAGER_OR_OWNER_ROLES if manager_or_owner else FINANCIAL_ROLES)
    if role not in allowed:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für Finanzdaten")
    return user, merchant, role


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "bidblitz_admin"} and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Nur Admin")
    return user


@router.get("/api/merchant/balance")
async def merchant_balance(request: Request):
    _, merchant, _ = await _require_financial_merchant(request)
    return await get_balance_view(merchant)


@router.get("/api/merchant/command-center")
async def merchant_command_center_summary(request: Request):
    _, merchant, role = await _require_financial_merchant(request, manager_or_owner=True)
    summary = await build_command_center_summary(merchant)
    summary["viewer_role"] = role
    return summary


@router.get("/api/merchant-settlements/overview")
async def merchant_settlement_overview(request: Request):
    _, merchant, _ = await _require_financial_merchant(request)
    balances = await get_balance_view(merchant)
    settlements = await db.merchant_settlements.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    payouts = await db.merchant_payouts.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {"balances": balances, "settlements": settlements, "payouts": payouts}


@router.post("/api/merchant-settlements/calculate")
async def merchant_settlement_calculate(req: SettlementCalculateRequest, request: Request):
    _, merchant, _ = await _require_financial_merchant(request)
    try:
        preview = await calculate_settlement_preview(merchant, period_type=req.period_type, branch_id=req.branch_id or None, start=req.start, end=req.end)
        settlement = await create_or_get_settlement(merchant, preview, req.idempotency_key)
        return {"preview": preview, "settlement": settlement}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/merchant-settlements")
async def merchant_settlement_list(request: Request, status: str = ""):
    _, merchant, _ = await _require_financial_merchant(request)
    q = {"merchant_id": merchant["merchant_id"]}
    if status:
        q["status"] = status
    settlements = await db.merchant_settlements.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"rows": settlements}


@router.post("/api/merchant-settlements/{settlement_id}/finalise")
async def merchant_settlement_finalise(settlement_id: str, req: SettlementFinaliseRequest, request: Request):
    user, merchant, _ = await _require_financial_merchant(request, manager_or_owner=True)
    try:
        settlement = await finalise_settlement(merchant, settlement_id, req.idempotency_key, str(user["_id"]))
        return {"settlement": settlement, "balance": await get_balance_view(merchant)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/merchant-settlements/{settlement_id}")
async def merchant_settlement_detail(settlement_id: str, request: Request):
    _, merchant, _ = await _require_financial_merchant(request)
    detail = await get_settlement_detail(merchant["merchant_id"], settlement_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Settlement nicht gefunden")
    return detail


@router.get("/api/merchant-settlements/{settlement_id}/export.csv")
async def merchant_settlement_export_csv(settlement_id: str, request: Request):
    _, merchant, _ = await _require_financial_merchant(request)
    detail = await get_settlement_detail(merchant["merchant_id"], settlement_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Settlement nicht gefunden")
    return PlainTextResponse(await export_settlement_csv(detail), media_type="text/csv")


@router.get("/api/merchant/payouts")
async def merchant_payout_history(request: Request, status: str = "", branch: str = ""):
    _, merchant, _ = await _require_financial_merchant(request, owner_only=True)
    return {"rows": await list_payouts(merchant["merchant_id"], status=status, branch_id=branch)}


@router.post("/api/merchant/payouts")
async def merchant_create_payout(req: MerchantPayoutRequest, request: Request):
    user, merchant, _ = await _require_financial_merchant(request, owner_only=True)
    try:
        payout = await create_payout_request(
            merchant,
            amount_minor=req.amount_minor,
            settlement_ids=req.settlement_ids,
            idempotency_key=req.idempotency_key,
            destination_type=req.destination_type,
            destination_reference_masked=req.destination_reference_masked,
            requested_by=str(user["_id"]),
        )
        return {"payout": payout, "balance": await get_balance_view(merchant)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/merchant/payouts/instant-availability")
async def merchant_instant_payout_unavailable(request: Request):
    await _require_financial_merchant(request, owner_only=True)
    return {"available": False, "message": "Sofortauszahlung ist für dieses Händlerkonto noch nicht verfügbar."}


@router.get("/api/merchant/pos/daily-closing")
async def merchant_daily_closing_preview(request: Request, date: Optional[str] = None, branch_id: str = "", register_id: str = ""):
    _, merchant, _ = await _require_financial_merchant(request, manager_or_owner=True)
    return await build_daily_closing_report(merchant, date=date, branch_id=branch_id, register_id=register_id)


@router.post("/api/merchant/pos/daily-closing")
async def merchant_daily_closing_finalise(req: DailyClosingCreateRequest, request: Request):
    user, merchant, _ = await _require_financial_merchant(request, manager_or_owner=True)
    report = await finalise_daily_closing(merchant, date=req.date, branch_id=req.branch_id, register_id=req.register_id, counted_cash_minor=req.counted_cash_minor, manager_id=str(user["_id"]))
    return {"report": report}


@router.get("/api/admin/merchant-settlements")
async def admin_merchant_settlements(request: Request, merchant_id: str = ""):
    await _require_admin(request)
    q = {"merchant_id": merchant_id} if merchant_id else {}
    settlements = await db.merchant_settlements.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    payouts = await db.merchant_payouts.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000) if merchant_id else await db.merchant_payouts.find({}, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
    balances = await db.merchant_balance_state.find(q, {"_id": 0}).to_list(1000) if merchant_id else await db.merchant_balance_state.find({}, {"_id": 0}).limit(1000).to_list(1000)
    return {"settlements": settlements, "payouts": payouts, "balances": balances}


@router.post("/api/admin/merchant-settlements/payouts/{payout_id}/action")
async def admin_merchant_payout_action(payout_id: str, req: PayoutActionRequest, request: Request):
    user = await _require_admin(request)
    status_map = {"approve": "processing", "processing": "processing", "paid": "paid", "failed": "failed", "returned": "returned", "cancelled": "cancelled"}
    try:
        payout = await update_payout_status(payout_id=payout_id, status=status_map[req.action], actor_id=str(user["_id"]), failure_reason=req.failure_reason)
        return {"payout": payout}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/admin/merchant-settlements/reserves")
async def admin_apply_merchant_reserve(req: ReserveRuleRequest, request: Request):
    user = await _require_admin(request)
    return await apply_reserve_rule(merchant_id=req.merchant_id, percentage_basis_points=req.percentage_basis_points, fixed_minor=req.fixed_minor, reason=req.reason, hold_days=req.hold_days, actor_id=str(user["_id"]))


@router.post("/api/admin/merchant-settlements/adjustments")
async def admin_create_adjustment(req: ManualAdjustmentRequest, request: Request):
    user = await _require_admin(request)
    if abs(req.amount_minor) >= 100000 and not req.second_admin_id:
        raise HTTPException(status_code=400, detail="Zweite Freigabe ab 1.000,00 € erforderlich")
    try:
        adjustment = await create_manual_adjustment(
            merchant_id=req.merchant_id,
            amount_minor=req.amount_minor,
            direction=req.direction,
            reason=req.reason,
            evidence=req.evidence,
            approving_admin=str(user["_id"]),
            idempotency_key=req.idempotency_key,
            adjustment_type=req.adjustment_type,
        )
        return {"adjustment": adjustment}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc