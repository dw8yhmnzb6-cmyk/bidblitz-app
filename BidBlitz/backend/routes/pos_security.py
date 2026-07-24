from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from services.pos_security import (
    ALL_PERMISSIONS,
    DEFAULT_LIMITS,
    DEFAULT_ROLE_CONFIGS,
    audit_pos_security_event,
    build_customer_public_view,
    create_customer_account_change_request,
    create_manual_wallet_adjustment_request,
    create_resolution_session,
    create_security_alert,
    evaluate_transaction_limits,
    execute_gift_card_action,
    execute_customer_account_change_action,
    execute_manual_wallet_adjustment_action,
    execute_refund_action,
    execute_secure_payment,
    execute_secure_topup,
    get_actor_context,
    get_effective_limits,
    get_resolution_customer,
    get_role_configs,
    now_iso,
    now_utc,
    request_manager_approval,
    require_permission,
    reset_lookup_failures,
    resolve_customer_by_lookup,
    sanitize_audit_value,
    set_customer_payment_pin,
    verify_customer_payment_pin,
    register_failed_lookup,
    record_suspicious_cashier_activity,
)


router = APIRouter(prefix="/api", tags=["pos-security"])


class PosCustomerResolveRequest(BaseModel):
    store_id: str
    register_id: str = ""
    lookup_type: str
    value: str


class PosWalletTopUpRequest(BaseModel):
    store_id: str
    register_id: str
    resolution_id: str | None = None
    customer_user_number: str | None = None
    amount: float = Field(..., gt=0, le=5000)
    payment_method: str = "cash"


class PosPaymentPrepareRequest(BaseModel):
    store_id: str
    register_id: str
    amount: float = Field(..., gt=0)
    description: str = "POS Zahlung"
    resolution_id: str | None = None
    customer_user_number: str | None = None
    cart_id: str | None = None
    payment_method: str = "wallet"
    lookup_type: str | None = None


class PosPaymentConfirmPinRequest(BaseModel):
    payment_id: str
    pin: str


class CustomerPaymentPinSetRequest(BaseModel):
    pin: str
    confirm_pin: str
    current_pin: str | None = None


class CustomerPaymentPinResetRequest(BaseModel):
    current_pin: str | None = None
    new_pin: str
    confirm_pin: str


class CustomerPaymentPinVerifyRequest(BaseModel):
    pin: str


class PosRoleConfigUpdateRequest(BaseModel):
    permissions: list[str]


class PosSecurityLimitUpdateRequest(BaseModel):
    scope_type: str
    scope_id: str
    values: dict


class ApprovalDecisionRequest(BaseModel):
    decision: str
    note: str = ""


class GiftCardApprovalRequest(BaseModel):
    store_id: str
    register_id: str = ""
    amount: float = Field(..., gt=0, le=2000)
    payment_method: str = "cash"
    recipient_email: str | None = None
    message: str | None = None


class ManualWalletAdjustmentRequest(BaseModel):
    store_id: str
    register_id: str = ""
    resolution_id: str | None = None
    customer_user_number: str | None = None
    amount: float
    reason: str = "Manual wallet adjustment"


class CustomerAccountChangeRequest(BaseModel):
    store_id: str
    register_id: str = ""
    resolution_id: str | None = None
    customer_user_number: str | None = None
    change_payload: dict


async def _merchant_store_hint(scope_type: str, scope_id: str) -> str:
    if scope_type == "branch":
        return scope_id
    if scope_type == "merchant":
        first_store = await db.pos_stores.find_one({"merchant_id": scope_id}, {"_id": 0, "store_id": 1})
        return (first_store or {}).get("store_id", "")
    employee_state = await db.pos_employee_security_state.find_one({"user_id": scope_id}, {"_id": 0, "store_id": 1})
    if employee_state:
        return employee_state.get("store_id", "")
    assignment = await db.pos_staff.find_one({"user_id": scope_id, "active": True}, {"_id": 0, "store_id": 1})
    return (assignment or {}).get("store_id", "")


@router.post("/pos/customer/resolve")
async def pos_customer_resolve(req: PosCustomerResolveRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "customer.resolve")
    await audit_pos_security_event("pos_customer_lookup_attempt", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"lookup_type": req.lookup_type, "store_id": req.store_id, "register_id": req.register_id}, severity="info")
    try:
        customer = await resolve_customer_by_lookup(req.lookup_type, req.value)
    except HTTPException:
        await register_failed_lookup(actor, request, req.lookup_type, req.value)
        await audit_pos_security_event("pos_customer_lookup_failed", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"lookup_type": req.lookup_type, "store_id": req.store_id, "register_id": req.register_id}, severity="warning")
        raise
    await reset_lookup_failures(actor)
    resolution = await create_resolution_session(actor, customer, req.lookup_type)
    await audit_pos_security_event("pos_customer_lookup_success", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"lookup_type": req.lookup_type, "customer_number": customer.get("user_number", ""), "resolution_id": resolution["resolution_id"]}, severity="info")
    return {"ok": True, "resolution_id": resolution["resolution_id"], "expires_at": resolution["expires_at"], "customer": build_customer_public_view(customer, req.lookup_type)}


@router.post("/pos/wallet/top-up")
async def secure_wallet_topup(req: PosWalletTopUpRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "wallet.topup")
    customer = await get_resolution_customer(actor, req.resolution_id, req.customer_user_number)
    limits = await get_effective_limits(actor["merchant_id"], actor["store_id"], actor["user_id"], actor["role"])
    policy = evaluate_transaction_limits(actor, "topup", req.amount, limits)
    if policy["hard_limit"] and req.amount > policy["hard_limit"]:
        raise HTTPException(status_code=403, detail="Top-up überschreitet das zulässige Limit")
    await audit_pos_security_event("pos_topup_attempt", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"amount": req.amount, "customer_number": customer.get("user_number", ""), "store_id": req.store_id, "register_id": req.register_id, "payment_method": req.payment_method}, severity="info")
    if policy["needs_approval"]:
        approval = await request_manager_approval(actor, "wallet_topup", req.amount, {"store_id": req.store_id, "register_id": req.register_id, "customer_id": str(customer["_id"]), "payment_method": req.payment_method}, "Large top-up requires manager approval")
        return {"ok": True, "status": "approval_required", "approval": approval, "customer": build_customer_public_view(customer), "message": "Top-up wartet auf Manager-Freigabe"}
    if req.amount >= 300:
        await create_security_alert(actor["merchant_id"], actor["store_id"], "unusual_topup", "Ungewöhnlich hoher POS-Top-up erkannt", {"customer_number": customer.get("user_number", ""), "amount": req.amount}, "medium", actor["user_id"], str(customer["_id"]))
    return await execute_secure_topup(actor, customer, req.amount, req.payment_method, request=request)


@router.post("/pos/payment/prepare")
async def secure_payment_prepare(req: PosPaymentPrepareRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "payment.collect")
    customer = await get_resolution_customer(actor, req.resolution_id, req.customer_user_number)
    limits = await get_effective_limits(actor["merchant_id"], actor["store_id"], actor["user_id"], actor["role"])
    policy = evaluate_transaction_limits(actor, "payment", req.amount, limits)
    if policy["hard_limit"] and req.amount > policy["hard_limit"]:
        raise HTTPException(status_code=403, detail="Zahlung überschreitet das zulässige Limit")
    await audit_pos_security_event("pos_payment_attempt", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"amount": req.amount, "customer_number": customer.get("user_number", ""), "store_id": req.store_id, "register_id": req.register_id, "cart_id": req.cart_id or ""}, severity="info")
    if policy["needs_approval"]:
        approval = await request_manager_approval(actor, "secure_payment", req.amount, {"store_id": req.store_id, "register_id": req.register_id, "customer_id": str(customer["_id"]), "cart_id": req.cart_id or "", "description": req.description}, "Large payment requires manager approval")
        return {"ok": True, "status": "approval_required", "approval": approval, "customer": build_customer_public_view(customer, req.lookup_type), "message": "Zahlung wartet auf Manager-Freigabe"}
    payment_id = f"SPY-{ObjectId()}"[-24:].upper()
    payment_doc = {
        "payment_id": payment_id,
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "register_id": req.register_id,
        "employee_id": actor["user_id"],
        "customer_id": str(customer["_id"]),
        "customer_number": customer.get("user_number", ""),
        "masked_customer": build_customer_public_view(customer, req.lookup_type),
        "amount": round(float(req.amount), 2),
        "description": req.description,
        "status": "awaiting_pin",
        "cart_id": req.cart_id or "",
        "payment_method": req.payment_method,
        "requires_pin": True,
        "requires_app_confirmation": bool(policy["requires_app_confirmation"]),
        "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
        "created_at": now_iso(),
    }
    await db.pos_secure_payments.insert_one(payment_doc)
    payment_doc.pop("_id", None)
    return {"ok": True, "status": "awaiting_pin", "payment": payment_doc, "customer": build_customer_public_view(customer, req.lookup_type)}


@router.post("/pos/payment/confirm-pin")
async def secure_payment_confirm_pin(req: PosPaymentConfirmPinRequest, request: Request):
    user = await get_current_user(request)
    payment = await db.pos_secure_payments.find_one({"payment_id": req.payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    actor = await get_actor_context(user, payment["store_id"], payment.get("register_id", ""))
    require_permission(actor, "payment.collect")
    if payment.get("status") not in {"awaiting_pin", "awaiting_app_confirmation"}:
        return {"ok": False, "status": payment.get("status", "declined"), "message": "Payment declined"}
    customer = await db.users.find_one({"_id": ObjectId(payment["customer_id"])})
    if not customer:
        return {"ok": False, "status": "declined", "message": "Payment declined"}
    verify_result = await verify_customer_payment_pin(customer, req.pin, request=request, merchant_id=actor["merchant_id"], store_id=actor["store_id"], employee_id=actor["user_id"])
    if not verify_result.get("ok"):
        await db.pos_secure_payments.update_one({"payment_id": req.payment_id}, {"$set": {"status": "declined", "declined_at": now_iso(), "declined_reason": verify_result.get("reason", "pin")}})
        await audit_pos_security_event("pos_payment_declined", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"payment_id": req.payment_id, "reason": verify_result.get("reason", "pin"), "customer_number": customer.get("user_number", "")}, severity="warning")
        return {"ok": False, "status": "declined", "message": "Payment declined", "locked": bool(verify_result.get("locked")), "retry_after_sec": verify_result.get("retry_after_sec", 0)}
    if payment.get("requires_app_confirmation"):
        await db.pos_secure_payments.update_one({"payment_id": req.payment_id}, {"$set": {"status": "awaiting_app_confirmation", "pin_verified_at": now_iso()}})
        await audit_pos_security_event("pos_payment_app_confirmation_required", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"payment_id": req.payment_id, "customer_number": customer.get("user_number", ""), "amount": payment.get("amount", 0)}, severity="info")
        try:
            await db.notifications.insert_one({"user_id": str(customer["_id"]), "type": "pos_app_confirmation", "title": "App-Bestätigung erforderlich", "message": f"Bitte bestätige die POS-Zahlung über €{float(payment.get('amount', 0)):.2f} in deiner App.", "read": False, "created_at": now_iso(), "data": {"payment_id": req.payment_id}})
        except Exception:
            pass
        return {"ok": True, "status": "awaiting_app_confirmation", "message": "App confirmation required"}
    result = await execute_secure_payment(actor, customer, float(payment.get("amount", 0)), payment.get("description", "POS Zahlung"), req.payment_id, request=request, cart_id=payment.get("cart_id", ""))
    if result.get("status") == "declined":
        await db.pos_secure_payments.update_one({"payment_id": req.payment_id}, {"$set": {"status": "declined", "declined_at": now_iso(), "declined_reason": "insufficient_balance"}})
        await audit_pos_security_event("pos_payment_declined", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"payment_id": req.payment_id, "reason": "insufficient_balance", "customer_number": customer.get("user_number", "")}, severity="warning")
        return {"ok": False, "status": "declined", "message": "Payment declined"}
    await db.pos_secure_payments.update_one({"payment_id": req.payment_id}, {"$set": {"status": "approved", "approved_at": now_iso(), "sale_id": result.get("sale", {}).get("sale_id", "")}})
    return result


@router.post("/pos/payment/customer-approve/{payment_id}")
async def customer_approve_high_value_payment(payment_id: str, request: Request):
    customer = await get_current_user(request)
    payment = await db.pos_secure_payments.find_one({"payment_id": payment_id, "customer_id": str(customer["_id"])})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    if payment.get("status") != "awaiting_app_confirmation":
        raise HTTPException(status_code=400, detail="Keine App-Bestätigung erforderlich")
    actor_user = await db.users.find_one({"_id": ObjectId(payment["employee_id"])})
    if not actor_user:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    actor = await get_actor_context(actor_user, payment["store_id"], payment.get("register_id", ""))
    result = await execute_secure_payment(actor, customer, float(payment.get("amount", 0)), payment.get("description", "POS Zahlung"), payment_id, request=request, cart_id=payment.get("cart_id", ""))
    await db.pos_secure_payments.update_one({"payment_id": payment_id}, {"$set": {"status": "approved", "approved_at": now_iso()}})
    return result


@router.post("/customer/payment-pin/set")
async def customer_payment_pin_set(req: CustomerPaymentPinSetRequest, request: Request):
    user = await get_current_user(request)
    if req.pin != req.confirm_pin:
        raise HTTPException(status_code=400, detail="PIN-Bestätigung stimmt nicht")
    if user.get("payment_pin_hash") and req.current_pin:
        verify_result = await verify_customer_payment_pin(user, req.current_pin, request=request)
        if not verify_result.get("ok"):
            raise HTTPException(status_code=400, detail="Aktuelle PIN ungültig")
    await set_customer_payment_pin(user, req.pin)
    await audit_pos_security_event("customer_payment_pin_set", request=request, user_id=str(user["_id"]), email=user.get("email", ""), details={}, severity="info")
    return {"ok": True, "message": "Payment PIN gespeichert"}


@router.post("/customer/payment-pin/reset")
async def customer_payment_pin_reset(req: CustomerPaymentPinResetRequest, request: Request):
    user = await get_current_user(request)
    if req.new_pin != req.confirm_pin:
        raise HTTPException(status_code=400, detail="PIN-Bestätigung stimmt nicht")
    if user.get("payment_pin_hash"):
        if not req.current_pin:
            raise HTTPException(status_code=400, detail="Aktuelle PIN erforderlich")
        verify_result = await verify_customer_payment_pin(user, req.current_pin, request=request)
        if not verify_result.get("ok"):
            raise HTTPException(status_code=400, detail="Aktuelle PIN ungültig")
    await set_customer_payment_pin(user, req.new_pin)
    await audit_pos_security_event("customer_payment_pin_reset", request=request, user_id=str(user["_id"]), email=user.get("email", ""), details={}, severity="info")
    return {"ok": True, "message": "Payment PIN zurückgesetzt"}


@router.post("/customer/payment-pin/verify")
async def customer_payment_pin_verify(req: CustomerPaymentPinVerifyRequest, request: Request):
    user = await get_current_user(request)
    result = await verify_customer_payment_pin(user, req.pin, request=request)
    return {"ok": bool(result.get("ok")), "locked": bool(result.get("locked")), "retry_after_sec": result.get("retry_after_sec", 0), "has_pin": bool(user.get("payment_pin_hash"))}


@router.post("/pos/security/gift-cards/request")
async def request_gift_card_creation(req: GiftCardApprovalRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "giftcard.create")
    limits = await get_effective_limits(actor["merchant_id"], actor["store_id"], actor["user_id"], actor["role"])
    if req.amount >= limits.get("gift_card_approval_limit", 0):
        approval = await request_manager_approval(actor, "gift_card_create", req.amount, req.model_dump(), "Gift card creation requires manager approval")
        return {"ok": True, "status": "approval_required", "approval": approval}
    result = await execute_gift_card_action(req.model_dump(), actor, request=request)
    return {"ok": True, "status": "approved", "gift_card": result}


@router.post("/pos/security/manual-wallet-adjustment/request")
async def request_manual_wallet_adjustment(req: ManualWalletAdjustmentRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "manual_wallet_adjustment")
    customer = await get_resolution_customer(actor, req.resolution_id, req.customer_user_number)
    approval = await create_manual_wallet_adjustment_request(actor, customer, req.amount, req.reason)
    return {"ok": True, "status": "approval_required", "approval": approval, "customer": build_customer_public_view(customer)}


@router.post("/pos/security/customer-account-change/request")
async def request_customer_account_change(req: CustomerAccountChangeRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "customer.account_change")
    customer = await get_resolution_customer(actor, req.resolution_id, req.customer_user_number)
    approval = await create_customer_account_change_request(actor, customer, req.change_payload)
    return {"ok": True, "status": "approval_required", "approval": approval, "customer": build_customer_public_view(customer)}


@router.get("/pos/security/dashboard")
async def pos_security_dashboard(store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "security.view")
    merchant_id = actor["merchant_id"]
    now = now_utc()
    alerts = await db.pos_security_alerts.find({"merchant_id": merchant_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    approvals = await db.pos_security_approvals.find({"merchant_id": merchant_id, "status": "pending"}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    locked_customers_raw = await db.users.find({"payment_pin_locked_until": {"$ne": None}}, {"_id": 0, "user_number": 1, "name": 1, "payment_pin_locked_until": 1, "kyc_status": 1}).to_list(100)
    locked_customers = []
    for item in locked_customers_raw:
        locked_until = item.get("payment_pin_locked_until")
        if locked_until and locked_until > now.isoformat():
            locked_customers.append({"customer_number": item.get("user_number", ""), "masked_name": build_customer_public_view(item).get("masked_name"), "verification_status": item.get("kyc_status", "not_started"), "locked_until": locked_until})
    locked_employees = await db.pos_employee_security_state.find({"merchant_id": merchant_id, "locked_until": {"$gt": now.isoformat()}}, {"_id": 0, "user_id": 1, "store_id": 1, "locked_until": 1, "failed_lookup_count": 1}).to_list(50)
    limits = await get_effective_limits(merchant_id, store_id, actor["user_id"], actor["role"])
    role_configs = await get_role_configs(merchant_id)
    return {"generated_at": now_iso(), "merchant_id": merchant_id, "store_id": actor["store_id"], "alerts": alerts, "fraud_alerts": [item for item in alerts if item.get("type") in {"payment_pin_lock", "failed_customer_lookups", "unusual_topup", "suspicious_cashier_activity", "excessive_refunds", "biopay_failed_verify"}], "locked_customers": locked_customers, "locked_employees": locked_employees, "transaction_limits": limits, "approval_queue": approvals, "role_configs": list(role_configs.values())}


@router.get("/pos/security/reports")
async def pos_security_reports(store_id: str, request: Request, period: str = "daily"):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "reports.view")
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 1)
    since = (now_utc() - timedelta(days=days)).isoformat()
    audit_events = await db.audit_logs.find({"timestamp": {"$gte": since}, "event": {"$regex": "^(pos_|customer_payment_pin_)"}}, {"_id": 0, "event": 1, "timestamp": 1, "details": 1}).to_list(500)
    event_counts = {}
    for item in audit_events:
        event_counts[item["event"]] = event_counts.get(item["event"], 0) + 1
    alerts_count = await db.pos_security_alerts.count_documents({"merchant_id": actor["merchant_id"], "created_at": {"$gte": since}})
    approvals_count = await db.pos_security_approvals.count_documents({"merchant_id": actor["merchant_id"], "created_at": {"$gte": since}})
    return {"period": period, "since": since, "summary": {"events": len(audit_events), "alerts": alerts_count, "approvals": approvals_count, "wrong_pin": event_counts.get("pos_wrong_pin", 0), "payments_declined": event_counts.get("pos_payment_declined", 0), "topups": event_counts.get("pos_topup_success", 0), "payments": event_counts.get("pos_payment_approved", 0), "refunds": event_counts.get("payment.refund", 0) + event_counts.get("pos_manager_approval_refund_executed", 0)}, "event_counts": event_counts, "recent_events": audit_events[-25:]}


@router.get("/pos/security/roles")
async def pos_security_roles(store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "permissions.manage")
    role_configs = await get_role_configs(actor["merchant_id"])
    return {"roles": list(role_configs.values()), "all_permissions": ALL_PERMISSIONS}


@router.post("/pos/security/roles/{role_key}")
async def update_pos_security_role(role_key: str, req: PosRoleConfigUpdateRequest, store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "permissions.manage")
    if role_key not in DEFAULT_ROLE_CONFIGS:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    permissions = [item for item in req.permissions if item in ALL_PERMISSIONS or item == "*"]
    await db.pos_security_role_configs.update_one({"merchant_id": actor["merchant_id"]}, {"$pull": {"roles": {"role": role_key}}}, upsert=True)
    await db.pos_security_role_configs.update_one({"merchant_id": actor["merchant_id"]}, {"$push": {"roles": {"role": role_key, "label": DEFAULT_ROLE_CONFIGS[role_key]["label"], "permissions": permissions}}, "$set": {"updated_at": now_iso()}}, upsert=True)
    await audit_pos_security_event("pos_permission_change", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"role": role_key, "permissions": permissions}, severity="info")
    return {"ok": True, "role": {"role": role_key, "permissions": permissions}}


@router.get("/pos/security/limits")
async def pos_security_limits(scope_type: str, scope_id: str, request: Request):
    user = await get_current_user(request)
    store_hint = await _merchant_store_hint(scope_type, scope_id)
    actor = await get_actor_context(user, store_hint)
    require_permission(actor, "limits.manage")
    doc = await db.pos_security_limits.find_one({"scope_type": scope_type, "scope_id": scope_id}, {"_id": 0})
    return {"scope_type": scope_type, "scope_id": scope_id, "values": (doc or {}).get("values", DEFAULT_LIMITS.get(scope_type, {}))}


@router.post("/pos/security/limits")
async def update_pos_security_limits(req: PosSecurityLimitUpdateRequest, request: Request):
    user = await get_current_user(request)
    store_hint = await _merchant_store_hint(req.scope_type, req.scope_id)
    actor = await get_actor_context(user, store_hint)
    require_permission(actor, "limits.manage")
    allowed_keys = set(DEFAULT_LIMITS.get(req.scope_type, {}).keys())
    values = {key: float(value) for key, value in req.values.items() if key in allowed_keys}
    await db.pos_security_limits.update_one({"scope_type": req.scope_type, "scope_id": req.scope_id}, {"$set": {"scope_type": req.scope_type, "scope_id": req.scope_id, "values": values, "updated_at": now_iso()}}, upsert=True)
    await audit_pos_security_event("pos_limit_change", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"scope_type": req.scope_type, "scope_id": req.scope_id, "values": values}, severity="info")
    return {"ok": True, "scope_type": req.scope_type, "scope_id": req.scope_id, "values": values}


@router.get("/pos/security/approvals")
async def pos_security_approvals(store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "approvals.manage")
    approvals = await db.pos_security_approvals.find({"merchant_id": actor["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"approvals": approvals}


@router.post("/pos/security/approvals/{approval_id}/decision")
async def pos_security_approval_decision(approval_id: str, req: ApprovalDecisionRequest, request: Request):
    user = await get_current_user(request)
    approval = await db.pos_security_approvals.find_one({"approval_id": approval_id})
    if not approval:
        raise HTTPException(status_code=404, detail="Freigabe nicht gefunden")
    actor = await get_actor_context(user, approval["store_id"], approval.get("register_id", ""))
    require_permission(actor, "approvals.manage")
    if approval.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Freigabe wurde bereits entschieden")
    if req.decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Ungültige Entscheidung")
    result_payload = None
    if req.decision == "approved":
        payload = approval.get("payload") or {}
        if approval.get("approval_type") == "wallet_topup":
            customer = await db.users.find_one({"_id": ObjectId(payload["customer_id"])})
            result_payload = await execute_secure_topup(actor, customer, float(approval.get("amount", 0)), payload.get("payment_method", "cash"), request=request, approval_id=approval_id)
        elif approval.get("approval_type") == "refund":
            result_payload = await execute_refund_action({**payload, "amount": approval.get("amount", 0)}, actor, request=request, approval_id=approval_id)
        elif approval.get("approval_type") == "gift_card_create":
            result_payload = await execute_gift_card_action({**payload, "amount": approval.get("amount", 0)}, actor, request=request, approval_id=approval_id)
        elif approval.get("approval_type") == "manual_wallet_adjustment":
            result_payload = await execute_manual_wallet_adjustment_action(payload, actor, float(approval.get("amount", 0)), request=request, approval_id=approval_id)
        elif approval.get("approval_type") == "customer_account_change":
            result_payload = await execute_customer_account_change_action(payload, actor, request=request, approval_id=approval_id)
        elif approval.get("approval_type") == "biopay_payment":
            result_payload = {"status": "approved", "next_step": "cashier_retry_biopay", "payload": payload}
    await db.pos_security_approvals.update_one({"approval_id": approval_id}, {"$set": {"status": req.decision, "decided_at": now_iso(), "decided_by": actor["user_id"], "decision_note": req.note, "result": sanitize_audit_value(result_payload or {})}})
    await audit_pos_security_event("pos_manager_approval", request=request, user_id=actor["user_id"], email=user.get("email", ""), details={"approval_id": approval_id, "decision": req.decision, "approval_type": approval.get("approval_type")}, severity="info")
    return {"ok": True, "approval_id": approval_id, "decision": req.decision, "result": result_payload}