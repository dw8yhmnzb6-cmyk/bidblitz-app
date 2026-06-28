from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from services.biopay import (
    create_biopay_session,
    create_biopay_terminal,
    get_biopay_summary_for_store,
    get_profiles_for_user,
    get_staff_clock_target,
    handle_biopay_failure,
    is_facepay_enabled,
    public_profile_view,
    public_session_view,
    public_terminal_view,
    resolve_terminal_for_actor,
    revoke_profile,
    template_token_preview,
    touch_terminal,
    upsert_profile_for_user,
    validate_modality,
    verify_principal_token,
)
from services.pos_security import (
    audit_pos_security_event,
    build_customer_public_view,
    create_security_alert,
    evaluate_transaction_limits,
    execute_secure_payment,
    get_actor_context,
    get_effective_limits,
    get_resolution_customer,
    now_iso,
    now_utc,
    request_manager_approval,
    require_permission,
)


router = APIRouter(prefix="/api", tags=["biopay"])


class BioPayEnrollRequest(BaseModel):
    template_token: str
    modality: str = "palm"
    nickname: str = ""


class BioPayVerifySelfRequest(BaseModel):
    template_token: str
    modality: str = "palm"


class BioPayPayRequest(BaseModel):
    store_id: str
    register_id: str
    resolution_id: str | None = None
    customer_user_number: str | None = None
    amount: float = Field(..., gt=0)
    description: str = "PalmPay Zahlung"
    template_token: str
    modality: str = "palm"
    terminal_id: str | None = None
    cart_id: str | None = None


class BioPayTerminalCreateRequest(BaseModel):
    store_id: str
    register_id: str = ""
    label: str
    palm_enabled: bool = True
    face_enabled: bool = False


class BioPayTerminalUpdateRequest(BaseModel):
    label: str | None = None
    status: str | None = None
    palm_enabled: bool | None = None
    face_enabled: bool | None = None


class BioPayStaffClockRequest(BaseModel):
    template_token: str
    event_type: str
    modality: str = "palm"
    terminal_id: str | None = None
    store_id: str = ""
    register_id: str = ""


@router.get("/customer/payment-pin/status")
async def customer_payment_pin_status(request: Request):
    user = await get_current_user(request)
    locked_until = user.get("payment_pin_locked_until")
    retry_after = 0
    if locked_until:
        try:
            from services.pos_security import parse_iso

            parsed = parse_iso(locked_until)
            if parsed and parsed > now_utc():
                retry_after = int((parsed - now_utc()).total_seconds())
        except Exception:
            retry_after = 0
    return {
        "has_pin": bool(user.get("payment_pin_hash")),
        "locked": retry_after > 0,
        "retry_after_sec": retry_after,
        "payment_pin_set_at": user.get("payment_pin_set_at"),
        "payment_pin_last_verified_at": user.get("payment_pin_last_verified_at"),
        "payment_pin_last_failed_at": user.get("payment_pin_last_failed_at"),
    }


@router.get("/biopay/me")
async def biopay_me(request: Request):
    user = await get_current_user(request)
    profiles = await get_profiles_for_user(user)
    recent_sessions = await db.biopay_sessions.find(
        {"principal_id": str(user["_id"])},
        {"_id": 0},
    ).sort("created_at", -1).limit(10).to_list(10)
    return {
        "profiles": [public_profile_view(item) for item in profiles],
        "recent_sessions": [public_session_view(item) for item in recent_sessions],
        "facepay_enabled": await is_facepay_enabled(),
        "biometric_enabled": bool(user.get("biometric_enabled", False)),
        "can_use_staff_biotime": bool(await get_staff_clock_target(user)),
    }


@router.post("/biopay/enroll")
async def biopay_enroll(req: BioPayEnrollRequest, request: Request):
    user = await get_current_user(request)
    profile = await upsert_profile_for_user(user, req.template_token, req.modality, req.nickname)
    await audit_pos_security_event(
        "biopay_enroll",
        request=request,
        user_id=str(user["_id"]),
        email=user.get("email", ""),
        details={"profile_id": profile["profile_id"], "modality": profile["modality"], "token_preview": profile["token_preview"]},
        severity="info",
    )
    return {"ok": True, "profile": public_profile_view(profile)}


@router.post("/biopay/verify-self")
async def biopay_verify_self(req: BioPayVerifySelfRequest, request: Request):
    user = await get_current_user(request)
    modality = await validate_modality(req.modality)
    profile, matched, score = await verify_principal_token(str(user["_id"]), req.template_token, modality, "customer")
    session = await create_biopay_session(
        {**user, "principal_type": "customer", "principal_user_number": user.get("user_number", "")},
        modality,
        "self_verify",
        "matched" if matched else "no_match",
        score,
        target_id=(profile or {}).get("profile_id", ""),
        actor_user_id=str(user["_id"]),
    )
    return {"ok": matched, "matched": matched, "profile": public_profile_view(profile) if profile else None, "session": public_session_view(session)}


@router.delete("/biopay/profile/{profile_id}")
async def biopay_revoke_profile(profile_id: str, request: Request):
    user = await get_current_user(request)
    profile = await revoke_profile(profile_id, user)
    await audit_pos_security_event(
        "biopay_profile_revoked",
        request=request,
        user_id=str(user["_id"]),
        email=user.get("email", ""),
        details={"profile_id": profile_id, "modality": profile.get("modality", "palm")},
        severity="warning",
    )
    return {"ok": True, "profile": public_profile_view(profile)}


@router.get("/biopay/terminals")
async def list_biopay_terminals(store_id: str, request: Request, register_id: str = ""):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id, register_id)
    require_permission(actor, "security.view")
    terminals = await db.biopay_terminals.find({"merchant_id": actor["merchant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"terminals": [public_terminal_view(item) for item in terminals], "facepay_enabled": await is_facepay_enabled()}


@router.post("/biopay/terminals")
async def create_terminal(req: BioPayTerminalCreateRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "permissions.manage")
    terminal = await create_biopay_terminal(actor, req.label, req.palm_enabled, req.face_enabled, req.register_id)
    await audit_pos_security_event(
        "biopay_terminal_created",
        request=request,
        user_id=actor["user_id"],
        email=user.get("email", ""),
        details={"terminal_id": terminal["terminal_id"], "label": terminal["label"], "store_id": terminal["store_id"]},
        severity="info",
    )
    return {"ok": True, "terminal": public_terminal_view(terminal)}


@router.post("/biopay/terminals/{terminal_id}")
async def update_terminal(terminal_id: str, req: BioPayTerminalUpdateRequest, request: Request):
    user = await get_current_user(request)
    terminal = await db.biopay_terminals.find_one({"terminal_id": terminal_id}, {"_id": 0})
    if not terminal:
        raise HTTPException(status_code=404, detail="BioPay-Terminal nicht gefunden")
    actor = await get_actor_context(user, terminal["store_id"], terminal.get("register_id", ""))
    require_permission(actor, "permissions.manage")
    face_allowed = await is_facepay_enabled()
    update = {"updated_at": now_iso()}
    if req.label is not None:
        update["label"] = req.label
    if req.status is not None:
        update["status"] = req.status
    if req.palm_enabled is not None:
        update["palm_enabled"] = bool(req.palm_enabled)
    if req.face_enabled is not None:
        update["face_enabled"] = bool(req.face_enabled and face_allowed)
    await db.biopay_terminals.update_one({"terminal_id": terminal_id}, {"$set": update})
    terminal.update(update)
    await audit_pos_security_event(
        "biopay_terminal_updated",
        request=request,
        user_id=actor["user_id"],
        email=user.get("email", ""),
        details={"terminal_id": terminal_id, **update},
        severity="info",
    )
    return {"ok": True, "terminal": public_terminal_view(terminal), "facepay_enabled": face_allowed}


@router.get("/biopay/sessions")
async def list_biopay_sessions(store_id: str, request: Request, limit: int = 20):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "security.view")
    sessions = await db.biopay_sessions.find({"merchant_id": actor["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 100))).to_list(limit)
    return {"sessions": [public_session_view(item) for item in sessions]}


@router.get("/biopay/dashboard")
async def biopay_dashboard(store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "security.view")
    return await get_biopay_summary_for_store(actor)


@router.post("/biopay/pay")
async def biopay_pay(req: BioPayPayRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "payment.collect")
    terminal = await resolve_terminal_for_actor(actor, req.terminal_id)
    modality = await validate_modality(req.modality)
    if modality == "palm" and not terminal.get("palm_enabled", True):
        raise HTTPException(status_code=403, detail="PalmPay ist auf diesem Terminal deaktiviert")
    if modality == "face" and not terminal.get("face_enabled", False):
        raise HTTPException(status_code=403, detail="FacePay ist auf diesem Terminal deaktiviert")
    customer = await get_resolution_customer(actor, req.resolution_id, req.customer_user_number)
    profile, matched, score = await verify_principal_token(str(customer["_id"]), req.template_token, modality, "customer")
    session = await create_biopay_session(
        {**customer, "principal_type": "customer", "principal_user_number": customer.get("user_number", "")},
        modality,
        "payment",
        "matched" if matched else "no_match",
        score,
        store_id=actor["store_id"],
        register_id=actor["register_id"],
        merchant_id=actor["merchant_id"],
        terminal_id=terminal["terminal_id"],
        amount=req.amount,
        actor_user_id=actor["user_id"],
    )
    await touch_terminal(terminal["terminal_id"])
    if not matched or not profile:
        await handle_biopay_failure(actor, customer, modality, terminal["terminal_id"], request=request)
        return {"ok": False, "status": "declined", "message": "Payment declined", "session": public_session_view(session)}

    limits = await get_effective_limits(actor["merchant_id"], actor["store_id"], actor["user_id"], actor["role"])
    policy = evaluate_transaction_limits(actor, "payment", req.amount, limits)
    if policy["hard_limit"] and req.amount > policy["hard_limit"]:
        raise HTTPException(status_code=403, detail="Zahlung überschreitet das zulässige Limit")
    if policy["needs_approval"]:
        approval = await request_manager_approval(
            actor,
            "biopay_payment",
            req.amount,
            {"customer_id": str(customer["_id"]), "terminal_id": terminal["terminal_id"], "cart_id": req.cart_id or "", "description": req.description, "biopay_session_id": session["session_id"], "modality": modality},
            "BioPay-Zahlung erfordert Manager-Freigabe",
        )
        return {"ok": True, "status": "approval_required", "approval": approval, "customer": build_customer_public_view(customer), "session": public_session_view(session)}

    payment_id = f"BPAY-{ObjectId()}"[-24:].upper()
    if policy["requires_app_confirmation"]:
        payment_doc = {
            "payment_id": payment_id,
            "merchant_id": actor["merchant_id"],
            "store_id": actor["store_id"],
            "register_id": actor["register_id"],
            "employee_id": actor["user_id"],
            "customer_id": str(customer["_id"]),
            "customer_number": customer.get("user_number", ""),
            "amount": round(float(req.amount), 2),
            "description": req.description,
            "status": "awaiting_app_confirmation",
            "payment_method": "biopay",
            "requires_app_confirmation": True,
            "requires_pin": False,
            "cart_id": req.cart_id or "",
            "biopay_session_id": session["session_id"],
            "created_at": now_iso(),
            "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
        }
        await db.pos_secure_payments.insert_one(payment_doc)
        await db.notifications.insert_one(
            {
                "user_id": str(customer["_id"]),
                "type": "biopay_app_confirmation",
                "title": "BioPay App-Bestätigung erforderlich",
                "message": f"Bitte bestätige deine BioPay-Zahlung über €{float(req.amount):.2f} in der App.",
                "read": False,
                "created_at": now_iso(),
                "data": {"payment_id": payment_id, "biopay": True},
            }
        )
        await audit_pos_security_event(
            "biopay_payment_app_confirmation_required",
            request=request,
            user_id=actor["user_id"],
            email=user.get("email", ""),
            details={"payment_id": payment_id, "customer_number": customer.get("user_number", ""), "amount": req.amount, "terminal_id": terminal["terminal_id"]},
            severity="info",
        )
        return {"ok": True, "status": "awaiting_app_confirmation", "payment_id": payment_id, "session": public_session_view(session), "customer": build_customer_public_view(customer), "message": "App confirmation required"}

    result = await execute_secure_payment(actor, customer, req.amount, req.description, payment_id, request=request, cart_id=req.cart_id or "")
    if not result.get("ok"):
        await create_security_alert(actor["merchant_id"], actor["store_id"], "biopay_declined", "BioPay Zahlung abgelehnt", {"customer_number": customer.get("user_number", ""), "terminal_id": terminal["terminal_id"], "amount": req.amount}, "medium", actor["user_id"], str(customer["_id"]))
        return {"ok": False, "status": "declined", "message": "Payment declined", "session": public_session_view(session)}
    await audit_pos_security_event(
        "biopay_payment_approved",
        request=request,
        user_id=actor["user_id"],
        email=user.get("email", ""),
        details={"payment_id": payment_id, "customer_number": customer.get("user_number", ""), "amount": req.amount, "terminal_id": terminal["terminal_id"], "biopay_session_id": session["session_id"]},
        severity="info",
    )
    return {**result, "biopay_session": public_session_view(session), "customer": build_customer_public_view(customer)}


@router.post("/biopay/staff/clock")
async def biopay_staff_clock(req: BioPayStaffClockRequest, request: Request):
    user = await get_current_user(request)
    modality = await validate_modality(req.modality)
    staff_target = await get_staff_clock_target(user)
    if not staff_target:
        raise HTTPException(status_code=403, detail="Kein Staff-Profil für BioTime gefunden")
    profile, matched, score = await verify_principal_token(str(user["_id"]), req.template_token, modality, "customer")
    session = await create_biopay_session(
        {**user, "principal_type": "staff", "principal_user_number": user.get("user_number", "")},
        modality,
        "staff_clock",
        "matched" if matched else "no_match",
        score,
        store_id=req.store_id,
        register_id=req.register_id,
        merchant_id=staff_target["merchant_id"],
        terminal_id=req.terminal_id or "",
        actor_user_id=str(user["_id"]),
    )
    if not matched or not profile:
        return {"ok": False, "status": "declined", "message": "BioTime verification failed", "session": public_session_view(session)}
    action_map = {"check_in": "clock_in", "check_out": "clock_out", "break_start": "break_start", "break_end": "break_end"}
    action = action_map.get(req.event_type)
    if not action:
        raise HTTPException(status_code=400, detail="Ungültiger BioTime Event")
    await db.staff_biotime_events.insert_one(
        {
            "event_id": f"BTE-{ObjectId()}"[-18:].upper(),
            "user_id": str(user["_id"]),
            "staff_id": staff_target["staff_id"],
            "merchant_id": staff_target["merchant_id"],
            "event_type": req.event_type,
            "biopay_session_id": session["session_id"],
            "terminal_id": req.terminal_id or "",
            "store_id": req.store_id,
            "register_id": req.register_id,
            "created_at": now_iso(),
        }
    )
    await db.staff_clock_events.insert_one(
        {
            "merchant_id": staff_target["merchant_id"],
            "staff_id": staff_target["staff_id"],
            "action": action,
            "timestamp": now_iso(),
            "source": "biopay",
            "biopay_session_id": session["session_id"],
        }
    )
    await audit_pos_security_event(
        "biotime_clock_event",
        request=request,
        user_id=str(user["_id"]),
        email=user.get("email", ""),
        details={"event_type": req.event_type, "terminal_id": req.terminal_id or "", "session_id": session["session_id"]},
        severity="info",
    )
    return {"ok": True, "status": "recorded", "session": public_session_view(session), "event_type": req.event_type}