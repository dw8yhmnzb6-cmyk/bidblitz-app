from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from services.biopay import (
    compute_fraud_summary,
    create_biopay_session,
    create_biopay_terminal,
    get_biopay_summary_for_store,
    get_terminal_diagnostics,
    get_profiles_for_user,
    get_profiles_for_staff_member,
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
    upsert_profile_for_staff_member,
    upsert_profile_for_user,
    validate_modality,
    verify_principal_token,
    write_terminal_diagnostic,
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


class BioPayStaffBioTimeEnrollRequest(BaseModel):
    template_token: str
    modality: str = "palm"
    nickname: str = ""


class BioPayStaffBioTimeClockRequest(BaseModel):
    template_token: str
    event_type: str
    modality: str = "palm"
    terminal_id: str | None = None
    store_id: str = ""
    register_id: str = ""


class BioPayDiagnosticRequest(BaseModel):
    store_id: str
    register_id: str = ""
    terminal_id: str
    check_type: str = "manual_check"
    score: float = Field(..., ge=0, le=100)
    flags: list[str] = []
    details: dict = {}


async def _get_staff_member_from_session(request: Request) -> dict:
    session_cookie = request.cookies.get("staff_session")
    if not session_cookie:
        raise HTTPException(status_code=401, detail="Staff-Session erforderlich")
    staff_member = await db.staff_members.find_one(
        {"id": session_cookie, "active": {"$ne": False}},
        {"_id": 0, "password_hash": 0, "pin_hash": 0, "pin": 0},
    )
    if not staff_member:
        raise HTTPException(status_code=401, detail="Staff-Session ungültig")
    return staff_member


def _staff_public_view(staff_member: dict) -> dict:
    return {
        "id": staff_member.get("id", ""),
        "name": staff_member.get("name", ""),
        "email": staff_member.get("email", ""),
        "role": staff_member.get("role", "employee"),
        "merchant_id": staff_member.get("merchant_id", ""),
        "biometric_enabled": bool(staff_member.get("biometric_enabled", False)),
    }


def _biotime_status_from_events(events: list[dict]) -> str:
    status = "off"
    for event in events:
        action = event.get("action") or {"check_in": "clock_in", "check_out": "clock_out", "break_start": "break_start", "break_end": "break_end"}.get(event.get("event_type", ""), "")
        if action == "clock_in":
            status = "working"
        elif action == "clock_out":
            status = "off"
        elif action == "break_start":
            status = "break"
        elif action == "break_end":
            status = "working"
    return status


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


@router.get("/biopay/staff/biotime/status")
async def staff_biotime_status(request: Request):
    staff_member = await _get_staff_member_from_session(request)
    profiles = await get_profiles_for_staff_member(staff_member)
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    recent_events = await db.staff_clock_events.find(
        {"merchant_id": staff_member.get("merchant_id", ""), "staff_id": staff_member.get("id", ""), "timestamp": {"$gte": today_start}},
        {"_id": 0},
    ).sort("timestamp", -1).limit(20).to_list(20)
    recent_sessions = await db.biopay_sessions.find(
        {"principal_id": staff_member.get("id", ""), "principal_type": "staff"},
        {"_id": 0},
    ).sort("created_at", -1).limit(10).to_list(10)
    terminals = await db.biopay_terminals.find(
        {"merchant_id": staff_member.get("merchant_id", ""), "status": "active"},
        {"_id": 0},
    ).sort("created_at", -1).limit(20).to_list(20)
    return {
        "ok": True,
        "staff": _staff_public_view(staff_member),
        "profiles": [public_profile_view(item) for item in profiles],
        "has_palm_profile": any(item.get("modality") == "palm" and item.get("status") == "active" for item in profiles),
        "recent_events": recent_events,
        "recent_sessions": [public_session_view(item) for item in recent_sessions],
        "terminals": [public_terminal_view(item) for item in terminals],
        "status": _biotime_status_from_events(list(reversed(recent_events))),
        "facepay_enabled": await is_facepay_enabled(),
    }


@router.post("/biopay/staff/biotime/enroll")
async def staff_biotime_enroll(req: BioPayStaffBioTimeEnrollRequest, request: Request):
    staff_member = await _get_staff_member_from_session(request)
    profile = await upsert_profile_for_staff_member(staff_member, req.template_token, req.modality, req.nickname)
    await audit_pos_security_event(
        "staff_biotime_enroll",
        request=request,
        user_id=staff_member.get("id", ""),
        email=staff_member.get("email", ""),
        details={"profile_id": profile["profile_id"], "modality": profile["modality"], "token_preview": profile["token_preview"], "merchant_id": staff_member.get("merchant_id", "")},
        severity="info",
    )
    return {"ok": True, "profile": public_profile_view(profile)}


@router.post("/biopay/staff/biotime/clock")
async def staff_biotime_clock(req: BioPayStaffBioTimeClockRequest, request: Request):
    staff_member = await _get_staff_member_from_session(request)
    modality = await validate_modality(req.modality)
    terminal = None
    if req.terminal_id:
        terminal = await db.biopay_terminals.find_one({"terminal_id": req.terminal_id, "merchant_id": staff_member.get("merchant_id", "")}, {"_id": 0})
        if not terminal:
            raise HTTPException(status_code=404, detail="BioPay-Terminal nicht gefunden")
        if terminal.get("status") != "active":
            raise HTTPException(status_code=423, detail="BioPay-Terminal ist deaktiviert")
        if modality == "palm" and not terminal.get("palm_enabled", True):
            raise HTTPException(status_code=403, detail="PalmPay ist auf diesem Terminal deaktiviert")
    profile, matched, score = await verify_principal_token(staff_member.get("id", ""), req.template_token, modality, "staff")
    session = await create_biopay_session(
        {"principal_id": staff_member.get("id", ""), "principal_type": "staff", "principal_user_number": staff_member.get("id", "")},
        modality,
        "staff_biotime",
        "matched" if matched else "no_match",
        score,
        store_id=req.store_id or (terminal or {}).get("store_id", ""),
        register_id=req.register_id or (terminal or {}).get("register_id", ""),
        merchant_id=staff_member.get("merchant_id", ""),
        terminal_id=req.terminal_id or "",
        actor_user_id=staff_member.get("id", ""),
    )
    if not matched or not profile:
        await audit_pos_security_event(
            "staff_biotime_verify_failed",
            request=request,
            user_id=staff_member.get("id", ""),
            email=staff_member.get("email", ""),
            details={"event_type": req.event_type, "terminal_id": req.terminal_id or "", "merchant_id": staff_member.get("merchant_id", "")},
            severity="warning",
        )
        return {"ok": False, "status": "declined", "message": "BioTime verification failed", "session": public_session_view(session)}
    action_map = {"check_in": "clock_in", "check_out": "clock_out", "break_start": "break_start", "break_end": "break_end"}
    action = action_map.get(req.event_type)
    if not action:
        raise HTTPException(status_code=400, detail="Ungültiger BioTime Event")
    event_id = f"BTE-{ObjectId()}"[-18:].upper()
    timestamp = now_iso()
    await db.staff_biotime_events.insert_one(
        {
            "event_id": event_id,
            "staff_id": staff_member.get("id", ""),
            "merchant_id": staff_member.get("merchant_id", ""),
            "event_type": req.event_type,
            "biopay_session_id": session["session_id"],
            "terminal_id": req.terminal_id or "",
            "store_id": req.store_id or (terminal or {}).get("store_id", ""),
            "register_id": req.register_id or (terminal or {}).get("register_id", ""),
            "created_at": timestamp,
        }
    )
    clock_event = {
        "id": event_id,
        "merchant_id": staff_member.get("merchant_id", ""),
        "staff_id": staff_member.get("id", ""),
        "action": action,
        "timestamp": timestamp,
        "source": "biopay",
        "biopay_session_id": session["session_id"],
        "terminal_id": req.terminal_id or "",
        "created_at": timestamp,
    }
    await db.staff_clock_events.insert_one(clock_event)
    clock_event.pop("_id", None)
    if req.terminal_id:
        await touch_terminal(req.terminal_id)
    await audit_pos_security_event(
        "staff_biotime_clock_event",
        request=request,
        user_id=staff_member.get("id", ""),
        email=staff_member.get("email", ""),
        details={"event_type": req.event_type, "terminal_id": req.terminal_id or "", "session_id": session["session_id"], "merchant_id": staff_member.get("merchant_id", "")},
        severity="info",
    )
    return {"ok": True, "status": "recorded", "event": clock_event, "session": public_session_view(session), "event_type": req.event_type}


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


@router.get("/biopay/diagnostics")
async def biopay_diagnostics(store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "security.view")
    diagnostics = await get_terminal_diagnostics(actor["merchant_id"])
    return {"diagnostics": diagnostics}


@router.post("/biopay/diagnostics")
async def biopay_write_diagnostic(req: BioPayDiagnosticRequest, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, req.store_id, req.register_id)
    require_permission(actor, "security.view")
    terminal = await resolve_terminal_for_actor(actor, req.terminal_id, require_active=False)
    diagnostic = await write_terminal_diagnostic(terminal["terminal_id"], req.check_type, req.score, req.flags, req.details)
    await audit_pos_security_event(
        "biopay_terminal_diagnostic_written",
        request=request,
        user_id=actor["user_id"],
        email=user.get("email", ""),
        details={"terminal_id": terminal["terminal_id"], "check_type": req.check_type, "score": req.score, "flags": req.flags},
        severity="info",
    )
    return {"ok": True, "diagnostic": diagnostic}


@router.get("/biopay/fraud-summary")
async def biopay_fraud_summary(store_id: str, request: Request):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "security.view")
    return await compute_fraud_summary(actor["merchant_id"])


@router.get("/biopay/facepay-readiness")
async def biopay_facepay_readiness(store_id: str, request: Request, terminal_id: str | None = None):
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id)
    require_permission(actor, "security.view")
    terminals = await db.biopay_terminals.find({"merchant_id": actor["merchant_id"]}, {"_id": 0}).to_list(100)
    face_enabled = await is_facepay_enabled()
    target_terminal = next((item for item in terminals if item.get("terminal_id") == terminal_id), None) if terminal_id else None
    readiness_flags = []
    if not face_enabled:
        readiness_flags.append("feature_flag_disabled")
    if target_terminal and not target_terminal.get("face_enabled", False):
        readiness_flags.append("terminal_face_disabled")
    if target_terminal and target_terminal.get("health_status") not in {"healthy", "warning"}:
        readiness_flags.append("terminal_health_not_ready")
    diagnostics = await get_terminal_diagnostics(actor["merchant_id"])
    return {
        "facepay_enabled": face_enabled,
        "target_terminal": public_terminal_view(target_terminal) if target_terminal else None,
        "readiness_flags": readiness_flags,
        "recommended_next_steps": [
            "FacePay-Flag aktivieren" if not face_enabled else "FacePay-Flag aktiv",
            "Terminal FacePay aktivieren" if target_terminal and not target_terminal.get("face_enabled", False) else "Terminal FacePay bereit",
            "Gesundheitscheck überwachen und Diagnosewert > 85 halten",
            "Vendor/Hardware-Abnahme abschließen bevor produktive Aktivierung erfolgt",
        ],
        "diagnostics": diagnostics[:10],
    }


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