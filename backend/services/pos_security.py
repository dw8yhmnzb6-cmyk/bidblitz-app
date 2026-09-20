import re
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, Request

from core.audit import get_client_info, log_audit
from core.database import db
from core.payment_engine import TransactionType, credit_wallet, debit_wallet
from core.security import hash_password, verify_password


LOOKUP_FAILURE_LIMIT = 5
LOOKUP_FAILURE_WINDOW_MINUTES = 10
LOOKUP_EMPLOYEE_LOCK_MINUTES = 15
PIN_FAILURE_LIMIT = 5
PIN_LOCK_MINUTES = 15

ROLE_ALIASES = {
    "merchant_admin": "admin",
    "store_manager": "manager",
    "cashier": "cashier",
    "accountant": "employee",
    "employee": "employee",
}

ALL_PERMISSIONS = [
    "customer.resolve",
    "wallet.topup",
    "payment.collect",
    "payment.high_value",
    "refund.issue",
    "refund.high_value",
    "giftcard.create",
    "manual_wallet_adjustment",
    "customer.account_change",
    "approvals.manage",
    "security.view",
    "reports.view",
    "limits.manage",
    "permissions.manage",
    "company.settings",
]

DEFAULT_ROLE_CONFIGS = {
    "owner": {"role": "owner", "label": "Owner", "permissions": ["*"]},
    "admin": {"role": "admin", "label": "Admin", "permissions": [perm for perm in ALL_PERMISSIONS if perm != "company.settings"]},
    "manager": {
        "role": "manager",
        "label": "Manager",
        "permissions": [
            "customer.resolve",
            "wallet.topup",
            "payment.collect",
            "payment.high_value",
            "refund.issue",
            "refund.high_value",
            "giftcard.create",
            "manual_wallet_adjustment",
            "customer.account_change",
            "approvals.manage",
            "security.view",
            "reports.view",
            "limits.manage",
            "permissions.manage",
        ],
    },
    "cashier": {"role": "cashier", "label": "Cashier", "permissions": ["customer.resolve", "wallet.topup", "payment.collect", "refund.issue"]},
    "employee": {"role": "employee", "label": "Employee", "permissions": ["customer.resolve", "payment.collect"]},
}

DEFAULT_LIMITS = {
    "merchant": {
        "topup_hard_limit": 5000.0,
        "topup_approval_limit": 750.0,
        "payment_hard_limit": 10000.0,
        "payment_approval_limit": 1500.0,
        "payment_app_confirmation_limit": 250.0,
        "refund_hard_limit": 3000.0,
        "refund_approval_limit": 300.0,
        "gift_card_approval_limit": 300.0,
        "manual_wallet_adjustment_approval_limit": 150.0,
        "customer_account_change_approval_limit": 1.0,
    },
    "branch": {
        "topup_hard_limit": 2000.0,
        "topup_approval_limit": 500.0,
        "payment_hard_limit": 5000.0,
        "payment_approval_limit": 1000.0,
        "payment_app_confirmation_limit": 250.0,
        "refund_hard_limit": 1500.0,
        "refund_approval_limit": 250.0,
        "gift_card_approval_limit": 250.0,
        "manual_wallet_adjustment_approval_limit": 125.0,
        "customer_account_change_approval_limit": 1.0,
    },
    "employee": {
        "topup_hard_limit": 500.0,
        "topup_approval_limit": 150.0,
        "payment_hard_limit": 2000.0,
        "payment_approval_limit": 500.0,
        "payment_app_confirmation_limit": 250.0,
        "refund_hard_limit": 250.0,
        "refund_approval_limit": 75.0,
        "gift_card_approval_limit": 150.0,
        "manual_wallet_adjustment_approval_limit": 75.0,
        "customer_account_change_approval_limit": 1.0,
    },
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def parse_iso(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def sanitize_audit_value(value: Any):
    if isinstance(value, dict):
        clean = {}
        for key, item in value.items():
            if "pin" in str(key).lower():
                continue
            clean[key] = sanitize_audit_value(item)
        return clean
    if isinstance(value, list):
        return [sanitize_audit_value(item) for item in value]
    return value


def mask_name(raw_name: str) -> str:
    candidate = (raw_name or "Gast").strip()
    parts = [part for part in candidate.split() if part]
    if not parts:
        return "G***"

    def _mask(part: str) -> str:
        if len(part) <= 1:
            return f"{part[0]}*"
        return part[0] + ("*" * max(2, len(part) - 1))

    return " ".join(_mask(part) for part in parts[:2])


def payment_pin_valid(pin: str) -> bool:
    return bool(re.fullmatch(r"\d{4}", pin or ""))


def build_customer_public_view(customer: dict, lookup_type: str | None = None) -> dict:
    return {
        "masked_name": mask_name(customer.get("name") or customer.get("first_name") or customer.get("email", "")),
        "customer_number": customer.get("user_number", ""),
        "verification_status": customer.get("kyc_status", "not_started"),
        "lookup_type": lookup_type or "",
    }


def extract_nfc_token(raw_value: str) -> str | None:
    match = re.search(r"(BPY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})", (raw_value or "").upper())
    return match.group(1) if match else None


async def audit_pos_security_event(event: str, request: Request | None, user_id: str = "", email: str = "", details: dict | None = None, severity: str = "info"):
    ip, user_agent = get_client_info(request) if request else ("", "")
    await log_audit(
        event=event,
        user_id=user_id,
        email=email,
        ip=ip,
        user_agent=user_agent,
        details=sanitize_audit_value(details or {}),
        severity=severity,
    )


async def create_security_alert(
    merchant_id: str,
    store_id: str,
    alert_type: str,
    title: str,
    details: dict | None = None,
    severity: str = "medium",
    employee_id: str = "",
    customer_id: str = "",
):
    doc = {
        "alert_id": f"PSA-{secrets.token_hex(6).upper()}",
        "merchant_id": merchant_id,
        "store_id": store_id,
        "employee_id": employee_id,
        "customer_id": customer_id,
        "type": alert_type,
        "title": title,
        "details": sanitize_audit_value(details or {}),
        "severity": severity,
        "status": "open",
        "created_at": now_iso(),
    }
    await db.pos_security_alerts.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def get_role_configs(merchant_id: str) -> dict:
    stored = await db.pos_security_role_configs.find_one({"merchant_id": merchant_id}, {"_id": 0})
    role_configs = {key: dict(value) for key, value in DEFAULT_ROLE_CONFIGS.items()}
    for item in (stored or {}).get("roles", []):
        role_key = item.get("role")
        if role_key in role_configs:
            role_configs[role_key] = {
                **role_configs[role_key],
                **item,
                "permissions": item.get("permissions") or role_configs[role_key]["permissions"],
            }
    return role_configs


def role_has_permission(role_config: dict, permission: str) -> bool:
    permissions = role_config.get("permissions") or []
    return "*" in permissions or permission in permissions


async def get_actor_context(user: dict, store_id: str, register_id: str | None = None) -> dict:
    uid = str(user["_id"])
    store = await db.pos_stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        staff_store = await db.pos_staff.find_one({"user_id": uid, "active": True}, {"_id": 0, "store_id": 1})
        fallback_store_id = (staff_store or {}).get("store_id")
        if not fallback_store_id:
            merchant_doc = await db.pos_merchants.find_one({"owner_id": uid}, {"_id": 0, "merchant_id": 1})
            if merchant_doc:
                first_store = await db.pos_stores.find_one({"merchant_id": merchant_doc["merchant_id"]}, {"_id": 0})
                store = first_store
            else:
                raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
        else:
            store = await db.pos_stores.find_one({"store_id": fallback_store_id}, {"_id": 0})
        if not store:
            raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    merchant = await db.pos_merchants.find_one({"merchant_id": store["merchant_id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant nicht gefunden")

    if user.get("role") == "admin":
        effective_role = "admin"
    elif merchant.get("owner_id") == uid:
        effective_role = "owner"
    else:
        staff = await db.pos_staff.find_one({"user_id": uid, "store_id": store_id, "active": True}, {"_id": 0, "role": 1, "merchant_id": 1})
        if not staff:
            raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Filiale")
        effective_role = ROLE_ALIASES.get(staff.get("role", "employee"), "employee")

    assignment = await db.pos_security_role_assignments.find_one(
        {"merchant_id": merchant["merchant_id"], "user_id": uid, "active": True},
        {"_id": 0, "role": 1},
    )
    if assignment and assignment.get("role") in DEFAULT_ROLE_CONFIGS:
        effective_role = assignment["role"]

    role_configs = await get_role_configs(merchant["merchant_id"])
    role_config = role_configs.get(effective_role, DEFAULT_ROLE_CONFIGS["employee"])
    employee_state = await db.pos_employee_security_state.find_one(
        {"merchant_id": merchant["merchant_id"], "user_id": uid, "store_id": store_id},
        {"_id": 0},
    )
    locked_until = parse_iso((employee_state or {}).get("locked_until"))
    if locked_until and locked_until > now_utc():
        raise HTTPException(status_code=423, detail="Mitarbeiterzugang ist temporär gesperrt")

    return {
        "user_id": uid,
        "user": user,
        "store": store,
        "merchant": merchant,
        "store_id": store_id,
        "register_id": register_id or "",
        "merchant_id": merchant["merchant_id"],
        "role": effective_role,
        "role_config": role_config,
        "permissions": role_config.get("permissions") or [],
    }


def require_permission(actor: dict, permission: str):
    if not role_has_permission(actor.get("role_config", {}), permission):
        raise HTTPException(status_code=403, detail="Berechtigung fehlt")


async def get_effective_limits(merchant_id: str, store_id: str, employee_id: str, actor_role: str = "employee") -> dict:
    docs = {
        "merchant": await db.pos_security_limits.find_one({"scope_type": "merchant", "scope_id": merchant_id}, {"_id": 0}),
        "branch": await db.pos_security_limits.find_one({"scope_type": "branch", "scope_id": store_id}, {"_id": 0}),
        "employee": await db.pos_security_limits.find_one({"scope_type": "employee", "scope_id": employee_id}, {"_id": 0}),
    }
    merged = {}
    for key in DEFAULT_LIMITS["merchant"]:
        candidates = []
        scope_order = ["merchant", "branch"]
        if actor_role in {"cashier", "employee"}:
            scope_order.append("employee")
        for scope in scope_order:
            stored = docs[scope] or {}
            value = stored.get("values", {}).get(key)
            if value is None:
                value = DEFAULT_LIMITS[scope][key]
            if value:
                candidates.append(float(value))
        merged[key] = min(candidates) if candidates else 0.0
    return merged


def evaluate_transaction_limits(actor: dict, tx_type: str, amount: float, limits: dict) -> dict:
    amount = round(float(amount or 0), 2)
    hard_limit = limits.get(f"{tx_type}_hard_limit", 0)
    approval_limit = limits.get(f"{tx_type}_approval_limit", 0)
    needs_approval = amount >= approval_limit > 0 and actor.get("role") in {"cashier", "employee"}
    return {
        "amount": amount,
        "hard_limit": hard_limit,
        "approval_limit": approval_limit,
        "needs_approval": needs_approval,
        "requires_app_confirmation": tx_type == "payment" and amount >= limits.get("payment_app_confirmation_limit", 0),
    }


async def register_failed_lookup(actor: dict, request: Request, lookup_type: str, value: str):
    now = now_utc()
    state = await db.pos_employee_security_state.find_one({"merchant_id": actor["merchant_id"], "store_id": actor["store_id"], "user_id": actor["user_id"]})
    reset_at = parse_iso((state or {}).get("lookup_window_reset_at"))
    count = int((state or {}).get("failed_lookup_count", 0)) if reset_at and reset_at > now else 0
    count += 1
    update = {
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "user_id": actor["user_id"],
        "failed_lookup_count": count,
        "lookup_window_reset_at": (now + timedelta(minutes=LOOKUP_FAILURE_WINDOW_MINUTES)).isoformat(),
        "last_failed_lookup_at": now.isoformat(),
    }
    if count >= LOOKUP_FAILURE_LIMIT:
        update["locked_until"] = (now + timedelta(minutes=LOOKUP_EMPLOYEE_LOCK_MINUTES)).isoformat()
        await create_security_alert(actor["merchant_id"], actor["store_id"], "failed_customer_lookups", "Mitarbeiter wegen Lookup-Fehlern gesperrt", {"failed_lookup_count": count, "lookup_type": lookup_type}, "high", actor["user_id"])
        await audit_pos_security_event("pos_pin_lock_employee", request=request, user_id=actor["user_id"], email=actor["user"].get("email", ""), details={"lookup_type": lookup_type, "value": value[:8], "failed_lookup_count": count}, severity="warning")
    await db.pos_employee_security_state.update_one({"merchant_id": actor["merchant_id"], "store_id": actor["store_id"], "user_id": actor["user_id"]}, {"$set": update}, upsert=True)


async def reset_lookup_failures(actor: dict):
    await db.pos_employee_security_state.update_one({"merchant_id": actor["merchant_id"], "store_id": actor["store_id"], "user_id": actor["user_id"]}, {"$set": {"failed_lookup_count": 0, "lookup_window_reset_at": now_iso()}, "$unset": {"locked_until": ""}}, upsert=True)


async def resolve_customer_by_lookup(lookup_type: str, value: str) -> dict:
    lookup = (lookup_type or "").strip().lower()
    raw_value = (value or "").strip()
    if not raw_value:
        raise HTTPException(status_code=400, detail="Kein Suchwert übergeben")

    customer = None
    if lookup in {"customer_number", "user_number", "number"}:
        customer = await db.users.find_one({"user_number": raw_value.upper()})
    elif lookup in {"scan", "barcode", "qr"}:
        barcode_doc = await db.payment_barcodes.find_one({"barcode": raw_value, "active": True})
        if not barcode_doc:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        expires_at = parse_iso(barcode_doc.get("expires_at"))
        if expires_at and expires_at < now_utc():
            await db.payment_barcodes.update_one({"_id": barcode_doc["_id"]}, {"$set": {"active": False}})
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        customer = await db.users.find_one({"_id": ObjectId(barcode_doc["user_id"])})
    elif lookup == "nfc":
        token = extract_nfc_token(raw_value)
        if not token:
            raise HTTPException(status_code=400, detail="Kein gültiger NFC-Token erkannt")
        token_doc = await db.nfc_tokens.find_one({"nfc_token": token, "active": True})
        if not token_doc:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        customer = await db.users.find_one({"email": token_doc.get("user_email", "")})
    else:
        raise HTTPException(status_code=400, detail="Unbekannter Lookup-Typ")

    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return customer


async def create_resolution_session(actor: dict, customer: dict, lookup_type: str) -> dict:
    session = {
        "resolution_id": f"PCR-{secrets.token_hex(6).upper()}",
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "register_id": actor.get("register_id", ""),
        "employee_id": actor["user_id"],
        "customer_id": str(customer["_id"]),
        "customer_number": customer.get("user_number", ""),
        "lookup_type": lookup_type,
        "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
        "created_at": now_iso(),
        "status": "active",
    }
    await db.pos_customer_resolutions.insert_one(session)
    session.pop("_id", None)
    return session


async def get_resolution_customer(actor: dict, resolution_id: str | None = None, customer_number: str | None = None) -> dict:
    if resolution_id:
        resolution = await db.pos_customer_resolutions.find_one({"resolution_id": resolution_id, "merchant_id": actor["merchant_id"], "store_id": actor["store_id"], "status": "active"}, {"_id": 0})
        if not resolution:
            raise HTTPException(status_code=404, detail="Kundenauflösung abgelaufen")
        expires_at = parse_iso(resolution.get("expires_at"))
        if expires_at and expires_at < now_utc():
            await db.pos_customer_resolutions.update_one({"resolution_id": resolution_id}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=404, detail="Kundenauflösung abgelaufen")
        customer = await db.users.find_one({"_id": ObjectId(resolution["customer_id"])})
        if not customer:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        return customer
    normalized = (customer_number or "").strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="Kundennummer erforderlich")
    customer = await db.users.find_one({"user_number": normalized})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return customer


async def request_manager_approval(
    actor: dict,
    approval_type: str,
    amount: float,
    payload: dict,
    reason: str,
    idempotency_key: str = "",
) -> dict:
    safe_payload = sanitize_audit_value(payload)
    amount_value = round(float(amount or 0), 2)
    raw_key = str(idempotency_key or "").strip()
    if raw_key:
        approval_hash = hashlib.sha256(
            f"{actor['merchant_id']}:{actor['store_id']}:{actor['user_id']}:{approval_type}:{raw_key}".encode("utf-8")
        ).hexdigest()[:24]
        approval_id = f"APR-{approval_hash.upper()}"
    else:
        approval_id = f"APR-{secrets.token_hex(6).upper()}"

    binding = {
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "register_id": actor.get("register_id", ""),
        "requested_by": actor["user_id"],
        "approval_type": approval_type,
        "amount": amount_value,
        "reason": reason,
        "payload": safe_payload,
    }
    approval = {
        "_id": approval_id,
        "approval_id": approval_id,
        **binding,
        "requester_role": actor["role"],
        "idempotency_key": raw_key or None,
        "status": "pending",
        "created_at": now_iso(),
    }
    inserted = await db.pos_security_approvals.update_one(
        {"_id": approval_id},
        {"$setOnInsert": approval},
        upsert=True,
    )
    saved = await db.pos_security_approvals.find_one({"_id": approval_id}, {"_id": 0}) or {}
    if any(saved.get(key) != value for key, value in binding.items()):
        raise HTTPException(status_code=409, detail="Approval-Idempotency-Key wurde mit anderen Daten verwendet")

    if inserted.upserted_id is not None:
        await audit_pos_security_event(
            "pos_manager_approval_requested",
            request=None,
            user_id=actor["user_id"],
            email=actor["user"].get("email", ""),
            details={"approval_type": approval_type, "amount": amount_value, "reason": reason, "store_id": actor["store_id"]},
            severity="warning",
        )
    saved["replayed"] = inserted.upserted_id is None
    return saved


async def create_manual_wallet_adjustment_request(actor: dict, customer: dict, amount: float, reason: str) -> dict:
    return await request_manager_approval(
        actor,
        "manual_wallet_adjustment",
        amount,
        {"customer_id": str(customer["_id"]), "customer_number": customer.get("user_number", ""), "reason": reason},
        "Manual wallet adjustment requires manager approval",
    )


async def create_customer_account_change_request(actor: dict, customer: dict, change_payload: dict) -> dict:
    return await request_manager_approval(
        actor,
        "customer_account_change",
        1.0,
        {"customer_id": str(customer["_id"]), "customer_number": customer.get("user_number", ""), "change_payload": sanitize_audit_value(change_payload)},
        "Customer account changes require manager approval",
    )


async def execute_manual_wallet_adjustment_action(payload: dict, actor: dict, amount: float, request: Request | None = None, approval_id: str = "") -> dict:
    customer_id = payload.get("customer_id", "")
    if not customer_id or not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Ungültige Kundenreferenz")
    customer = await db.users.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    adjustment_amount = round(float(amount or payload.get("amount") or 0), 2)
    if adjustment_amount == 0:
        raise HTTPException(status_code=400, detail="Adjustment-Betrag darf nicht 0 sein")
    reason = str(payload.get("reason") or "Manual wallet adjustment")[:240]
    reference = f"MWA-{approval_id or secrets.token_hex(5).upper()}"
    metadata = {
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "register_id": actor.get("register_id", ""),
        "employee_id": actor["user_id"],
        "approval_id": approval_id,
        "reason": reason,
    }
    if adjustment_amount > 0:
        result = await credit_wallet(
            user_id=str(customer["_id"]),
            amount=adjustment_amount,
            tx_type=TransactionType.ADMIN_CREDIT,
            description=f"POS Wallet Adjustment {actor['store_id']}",
            reference=reference,
            source="pos_manual_adjustment",
            metadata=metadata,
        )
    else:
        result = await debit_wallet(
            user_id=str(customer["_id"]),
            amount=abs(adjustment_amount),
            tx_type=TransactionType.ADMIN_CREDIT,
            description=f"POS Wallet Adjustment {actor['store_id']}",
            reference=reference,
            merchant_name=actor["merchant"].get("business_name", ""),
            metadata=metadata,
        )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error or "Wallet Adjustment fehlgeschlagen")
    adjustment_doc = {
        "adjustment_id": f"WAD-{secrets.token_hex(5).upper()}",
        "approval_id": approval_id or None,
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "register_id": actor.get("register_id", ""),
        "customer_id": str(customer["_id"]),
        "customer_number": customer.get("user_number", ""),
        "amount": adjustment_amount,
        "reason": reason,
        "transaction_id": result.transaction_id,
        "issued_by": actor["user_id"],
        "created_at": now_iso(),
    }
    await db.pos_manual_wallet_adjustments.insert_one(adjustment_doc)
    adjustment_doc.pop("_id", None)
    await audit_pos_security_event(
        "pos_manager_approval_manual_wallet_adjustment_executed",
        request=request,
        user_id=actor["user_id"],
        email=actor["user"].get("email", ""),
        details={"approval_id": approval_id, "customer_number": customer.get("user_number", ""), "amount": adjustment_amount, "reason": reason},
        severity="info",
    )
    try:
        await db.notifications.insert_one({"user_id": str(customer["_id"]), "type": "wallet_adjustment", "title": "Wallet angepasst", "message": "Dein Wallet wurde nach Manager-Freigabe aktualisiert.", "read": False, "created_at": now_iso(), "data": {"approval_id": approval_id}})
    except Exception:
        pass
    return {"status": "executed", "adjustment": adjustment_doc, "customer": build_customer_public_view(customer)}


async def execute_customer_account_change_action(payload: dict, actor: dict, request: Request | None = None, approval_id: str = "") -> dict:
    customer_id = payload.get("customer_id", "")
    if not customer_id or not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Ungültige Kundenreferenz")
    customer = await db.users.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    raw_changes = sanitize_audit_value(payload.get("change_payload") or {})
    allowed_fields = {
        "account_status",
        "status",
        "kyc_status",
        "kyc_verified",
        "biometric_enabled",
        "notifications_enabled",
        "email_notifications",
        "phone_verified",
        "language",
        "payment_pin_locked_until",
        "payment_pin_failed_attempts",
    }
    update = {key: value for key, value in raw_changes.items() if key in allowed_fields}
    if raw_changes.get("unlock_payment_pin"):
        update["payment_pin_locked_until"] = None
        update["payment_pin_failed_attempts"] = 0
    if not update:
        raise HTTPException(status_code=400, detail="Keine zulässigen Account-Änderungen gefunden")
    update["updated_at"] = now_iso()
    await db.users.update_one({"_id": ObjectId(customer_id)}, {"$set": update})
    change_doc = {
        "change_id": f"CAC-{secrets.token_hex(5).upper()}",
        "approval_id": approval_id or None,
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "customer_id": customer_id,
        "customer_number": customer.get("user_number", ""),
        "changed_fields": sorted([key for key in update.keys() if key != "updated_at"]),
        "changed_by": actor["user_id"],
        "created_at": now_iso(),
    }
    await db.pos_customer_account_changes.insert_one(change_doc)
    change_doc.pop("_id", None)
    await audit_pos_security_event(
        "pos_manager_approval_customer_account_change_executed",
        request=request,
        user_id=actor["user_id"],
        email=actor["user"].get("email", ""),
        details={"approval_id": approval_id, "customer_number": customer.get("user_number", ""), "changed_fields": change_doc["changed_fields"]},
        severity="warning",
    )
    return {"status": "executed", "account_change": change_doc, "customer": build_customer_public_view(customer)}


async def record_suspicious_cashier_activity(actor: dict, alert_type: str, details: dict):
    await create_security_alert(
        actor["merchant_id"],
        actor["store_id"],
        alert_type,
        "Suspicious cashier activity detected",
        details,
        "high",
        actor["user_id"],
    )
    await audit_pos_security_event(
        "pos_suspicious_cashier_activity",
        request=None,
        user_id=actor["user_id"],
        email=actor["user"].get("email", ""),
        details=details,
        severity="warning",
    )


async def set_customer_payment_pin(user: dict, pin: str):
    if not payment_pin_valid(pin):
        raise HTTPException(status_code=400, detail="PIN muss genau 4 Ziffern haben")
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "payment_pin_hash": hash_password(pin),
                "payment_pin_set_at": now_iso(),
                "payment_pin_failed_attempts": 0,
                "payment_pin_locked_until": None,
            }
        },
    )


async def verify_customer_payment_pin(customer: dict, pin: str, request: Request | None = None, merchant_id: str = "", store_id: str = "", employee_id: str = "") -> dict:
    if not payment_pin_valid(pin):
        return {"ok": False, "locked": False, "reason": "invalid_format"}
    lock_until = parse_iso(customer.get("payment_pin_locked_until"))
    if lock_until and lock_until > now_utc():
        retry_after = int((lock_until - now_utc()).total_seconds())
        return {"ok": False, "locked": True, "retry_after_sec": retry_after, "reason": "locked"}

    pin_hash = customer.get("payment_pin_hash")
    if not pin_hash:
        return {"ok": False, "locked": False, "reason": "not_set"}

    try:
        is_valid = verify_password(pin, pin_hash)
    except Exception:
        is_valid = False

    if not is_valid:
        failed_attempts = int(customer.get("payment_pin_failed_attempts", 0)) + 1
        update = {"payment_pin_failed_attempts": failed_attempts, "payment_pin_last_failed_at": now_iso()}
        locked = False
        if failed_attempts >= PIN_FAILURE_LIMIT:
            update["payment_pin_locked_until"] = (now_utc() + timedelta(minutes=PIN_LOCK_MINUTES)).isoformat()
            locked = True
            if merchant_id and store_id:
                await create_security_alert(merchant_id, store_id, "payment_pin_lock", "Kunden-PIN temporär gesperrt", {"customer_number": customer.get("user_number", "")}, "high", employee_id, str(customer["_id"]))
        await db.users.update_one({"_id": customer["_id"]}, {"$set": update})
        await audit_pos_security_event("pos_wrong_pin", request=request, user_id=str(customer["_id"]), email=customer.get("email", ""), details={"failed_attempts": failed_attempts, "merchant_id": merchant_id, "store_id": store_id, "employee_id": employee_id}, severity="warning")
        if locked:
            await audit_pos_security_event("pos_pin_lock", request=request, user_id=str(customer["_id"]), email=customer.get("email", ""), details={"merchant_id": merchant_id, "store_id": store_id, "employee_id": employee_id, "failed_attempts": failed_attempts}, severity="warning")
        return {"ok": False, "locked": locked, "reason": "invalid_pin", "retry_after_sec": PIN_LOCK_MINUTES * 60 if locked else 0}

    await db.users.update_one({"_id": customer["_id"]}, {"$set": {"payment_pin_failed_attempts": 0, "payment_pin_last_verified_at": now_iso(), "payment_pin_locked_until": None}})
    await audit_pos_security_event("pos_pin_verification_success", request=request, user_id=str(customer["_id"]), email=customer.get("email", ""), details={"merchant_id": merchant_id, "store_id": store_id, "employee_id": employee_id}, severity="info")
    return {"ok": True, "locked": False}


async def execute_secure_topup(
    actor: dict,
    customer: dict,
    amount: float,
    payment_method: str,
    request: Request | None = None,
    approval_id: str = "",
    idempotency_key: str = "",
) -> dict:
    stable_key = str(approval_id or idempotency_key or "").strip()
    if not stable_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    operation_hash = hashlib.sha256(
        f"{actor['merchant_id']}:{actor['store_id']}:{customer['_id']}:{stable_key}".encode("utf-8")
    ).hexdigest()[:24]
    sale_id = f"SALE-TOP-{operation_hash.upper()}"
    reference = f"TOP-{operation_hash[:12].upper()}"

    result = await credit_wallet(
        user_id=str(customer["_id"]),
        amount=amount,
        tx_type=TransactionType.WALLET_TOPUP_POS,
        description=f"Sichere POS-Aufladung ({actor['store_id']})",
        reference=reference,
        metadata={
            "merchant_id": actor["merchant_id"],
            "store_id": actor["store_id"],
            "register_id": actor.get("register_id", ""),
            "employee_id": actor["user_id"],
            "payment_method": payment_method,
            "approval_id": approval_id or None,
            "operation_hash": operation_hash,
        },
        idempotency_key=f"pos-secure-topup:{operation_hash}",
    )
    if not result.success:
        state = str(getattr(result.status, "value", result.status))
        raise HTTPException(
            status_code=409 if state in {"pending", "reconciliation_required"} else 400,
            detail=result.error or "Top-up fehlgeschlagen",
        )

    sale = {
        "sale_id": sale_id,
        "receipt_id": reference,
        "store_id": actor["store_id"],
        "register_id": actor.get("register_id", ""),
        "cashier_user_id": actor["user_id"],
        "customer_user_id": str(customer["_id"]),
        "type": "wallet_topup",
        "subtotal": round(amount, 2),
        "tax_total": 0.0,
        "discount": 0.0,
        "total": round(amount, 2),
        "method": payment_method,
        "status": "completed",
        "approval_id": approval_id or None,
        "wallet_transaction_id": result.transaction_id,
        "idempotency_key": stable_key,
        "created_at": now_iso(),
    }
    await db.pos_sales.update_one(
        {"sale_id": sale_id},
        {"$setOnInsert": sale},
        upsert=True,
    )
    persisted_sale = await db.pos_sales.find_one({"sale_id": sale_id}, {"_id": 0}) or sale

    await audit_pos_security_event(
        "pos_topup_success",
        request=request,
        user_id=actor["user_id"],
        email=actor["user"].get("email", ""),
        details={
            "customer_number": customer.get("user_number", ""),
            "amount": amount,
            "store_id": actor["store_id"],
            "register_id": actor.get("register_id", ""),
            "payment_method": payment_method,
            "approval_id": approval_id,
            "sale_id": sale_id,
        },
        severity="info",
    )
    try:
        await db.notifications.update_one(
            {"_id": f"pos-topup:{sale_id}"},
            {"$setOnInsert": {
                "_id": f"pos-topup:{sale_id}",
                "user_id": str(customer["_id"]),
                "type": "wallet_topup",
                "title": "Wallet aufgeladen",
                "message": f"Dein Wallet wurde am POS um €{amount:.2f} aufgeladen.",
                "read": False,
                "created_at": now_iso(),
                "data": {"sale_id": sale_id},
            }},
            upsert=True,
        )
    except Exception:
        pass

    return {
        "ok": True,
        "status": "approved",
        "customer": build_customer_public_view(customer),
        "sale": persisted_sale,
        "message": f"€{amount:.2f} erfolgreich aufgeladen",
        "replayed": bool(result.idempotent_replay),
    }


async def execute_secure_payment(actor: dict, customer: dict, amount: float, description: str, payment_id: str, request: Request | None = None, cart_id: str = "", approval_id: str = ""):
    """Settle a secure wallet payment exactly once."""
    merchant = actor["merchant"]
    customer_id = str(customer["_id"])
    amount = round(float(amount), 2)

    debit_result = await debit_wallet(
        user_id=customer_id,
        amount=amount,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=description or f"POS Zahlung {actor['store_id']}",
        reference=payment_id,
        merchant_name=merchant.get("business_name", ""),
        metadata={"merchant_id": actor["merchant_id"], "store_id": actor["store_id"], "register_id": actor.get("register_id", ""), "employee_id": actor["user_id"], "approval_id": approval_id, "cart_id": cart_id},
        idempotency_key=f"pos-secure-debit:{payment_id}",
    )
    if not debit_result.success:
        return {"ok": False, "status": "declined", "message": debit_result.error or "Payment declined"}

    owner_id = merchant.get("owner_id")
    merchant_credit = None
    if owner_id:
        merchant_credit = await credit_wallet(
            user_id=str(owner_id),
            amount=amount,
            tx_type=TransactionType.MERCHANT_CREDIT,
            description=f"POS Zahlung {actor['store_id']}",
            reference=f"CR-{payment_id}",
            source="pos_security",
            metadata={"payment_id": payment_id, "store_id": actor["store_id"], "employee_id": actor["user_id"]},
            idempotency_key=f"pos-secure-credit:{payment_id}",
        )
        if not merchant_credit.success:
            rollback = await credit_wallet(
                user_id=customer_id,
                amount=amount,
                tx_type=TransactionType.REFUND,
                description=f"POS Rollback {payment_id}",
                reference=f"ROLLBACK-{payment_id}",
                source="pos_security.rollback",
                metadata={"payment_id": payment_id, "reason": "merchant_credit_failed"},
                idempotency_key=f"pos-secure-rollback:{payment_id}",
            )
            if not rollback.success:
                raise HTTPException(status_code=500, detail="Kundenabbuchung und Händlergutschrift benötigen manuelle Abstimmung")
            raise HTTPException(status_code=400, detail="Händlergutschrift fehlgeschlagen. Kundenbetrag wurde zurückgebucht.")

    settlement_marker = f"settlement_markers.{payment_id.replace('.', '_')}"
    if owner_id:
        await db.pos_merchants.update_one(
            {"merchant_id": actor["merchant_id"], settlement_marker: {"$exists": False}},
            {
                "$inc": {"settlement_balance": amount, "lifetime_volume": amount},
                "$set": {settlement_marker: {"amount": amount, "created_at": now_iso()}},
            },
        )

    sale_id = f"SALE-{payment_id}"
    sale = {
        "sale_id": sale_id,
        "receipt_id": f"RCP-{payment_id[-8:].upper()}",
        "payment_id": payment_id,
        "cart_id": cart_id or None,
        "register_id": actor.get("register_id", ""),
        "store_id": actor["store_id"],
        "merchant_id": actor["merchant_id"],
        "cashier_id": actor["user_id"],
        "customer_id": customer_id,
        "subtotal": amount,
        "net_total": amount,
        "tax_total": 0.0,
        "discount": 0.0,
        "total": amount,
        "method": "secure_wallet",
        "fee": 0.0,
        "merchant_received": amount,
        "customer_paid": amount,
        "approval_id": approval_id or None,
        "created_at": now_iso(),
        "status": "completed",
        "type": "secure_customer_payment",
        "customer_debit_transaction_id": debit_result.transaction_id,
        "merchant_credit_transaction_id": merchant_credit.transaction_id if merchant_credit else None,
    }
    await db.pos_sales.update_one(
        {"payment_id": payment_id},
        {"$setOnInsert": sale},
        upsert=True,
    )
    sale = await db.pos_sales.find_one({"payment_id": payment_id}, {"_id": 0}) or sale

    await audit_pos_security_event("pos_payment_approved", request=request, user_id=actor["user_id"], email=actor["user"].get("email", ""), details={"customer_number": customer.get("user_number", ""), "amount": amount, "store_id": actor["store_id"], "register_id": actor.get("register_id", ""), "payment_id": payment_id, "approval_id": approval_id}, severity="info")
    if amount >= 500:
        await create_security_alert(actor["merchant_id"], actor["store_id"], "high_value_payment", "High-Value Payment verarbeitet", {"customer_number": customer.get("user_number", ""), "amount": amount, "payment_id": payment_id}, "medium", actor["user_id"], customer_id)
    return {"ok": True, "status": "approved", "sale": sale, "customer": build_customer_public_view(customer), "message": "Payment approved"}


async def execute_refund_action(refund_payload: dict, actor: dict, request: Request | None = None, approval_id: str = "") -> dict:
    """Refund wallet POS payments safely, never exceeding the original amount."""
    payment = await db.pos_payments.find_one({"payment_id": refund_payload["payment_id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")

    original_amount = round(float(payment.get("amount") or 0), 2)
    refunded_before = round(float(payment.get("refunded_total") or 0), 2)
    refund_amount = round(float(refund_payload.get("amount") or (original_amount - refunded_before)), 2)
    remaining = round(max(0.0, original_amount - refunded_before), 2)
    if refund_amount <= 0 or refund_amount > remaining:
        raise HTTPException(status_code=400, detail=f"Refund-Betrag ungültig. Verfügbar: €{remaining:.2f}")

    request_key = (
        approval_id
        or (request.headers.get("Idempotency-Key") if request else "")
        or refund_payload.get("idempotency_key")
        or f"{payment['payment_id']}:{int(round(refunded_before * 100))}:{int(round(refund_amount * 100))}"
    )
    refund_hash = __import__("hashlib").sha256(str(request_key).encode("utf-8")).hexdigest()[:20]
    refund_id = f"RFD-{refund_hash.upper()}"

    existing_refund = await db.pos_refunds.find_one({"refund_id": refund_id}, {"_id": 0})
    if existing_refund:
        return existing_refund

    refunded_filter = (
        {"$or": [{"refunded_total": refunded_before}, {"refunded_total": {"$exists": False}}]}
        if refunded_before == 0
        else {"refunded_total": refunded_before}
    )
    claim_filter = {
        "payment_id": payment["payment_id"],
        "status": {"$in": ["paid", "partial_refund"]},
        **refunded_filter,
    }
    claim = await db.pos_payments.update_one(
        claim_filter,
        {
            "$inc": {"refunded_total": refund_amount},
            "$set": {f"refund_processing.{refund_hash}": {"amount": refund_amount, "started_at": now_iso()}},
        },
    )
    if claim.modified_count != 1:
        existing_refund = await db.pos_refunds.find_one({"refund_id": refund_id}, {"_id": 0})
        if existing_refund:
            return existing_refund
        raise HTTPException(status_code=409, detail="Refund wurde parallel geändert. Bitte neu laden.")

    method = payment.get("method", "")
    merchant = None
    merchant_debit = None
    customer_credit = None

    try:
        if method in {"wallet_qr", "barcode", "secure_wallet", "self_checkout"} and payment.get("customer_id"):
            merchant = await db.pos_merchants.find_one({"merchant_id": payment["merchant_id"]})
            if merchant and merchant.get("owner_id"):
                owner_id = str(merchant["owner_id"])
                merchant_debit = await debit_wallet(
                    user_id=owner_id,
                    amount=refund_amount,
                    tx_type=TransactionType.REFUND,
                    description=f"POS Refund {payment['payment_id']} Merchant Reversal",
                    reference=f"MRFD-{refund_hash.upper()}",
                    merchant_name=merchant.get("business_name", ""),
                    metadata={"approval_id": approval_id or None, "payment_id": payment["payment_id"], "refund_id": refund_id, "audit_metadata": {"route": "pos_security.execute_refund_action", "kind": "merchant_reversal"}},
                    idempotency_key=f"pos-refund-merchant:{refund_id}",
                )
                if not merchant_debit.success:
                    raise RuntimeError(merchant_debit.error or "merchant_reversal_failed")

                merchant_marker = f"refund_markers.{refund_hash}"
                await db.pos_merchants.update_one(
                    {"merchant_id": payment["merchant_id"], merchant_marker: {"$exists": False}},
                    {
                        "$inc": {"settlement_balance": -refund_amount},
                        "$set": {merchant_marker: {"refund_id": refund_id, "amount": refund_amount, "created_at": now_iso()}},
                    },
                )

            customer_credit = await credit_wallet(
                user_id=payment["customer_id"],
                amount=refund_amount,
                tx_type=TransactionType.REFUND,
                description=f"POS Refund {payment['payment_id']}",
                reference=refund_id,
                source="pos_security.refund",
                metadata={"approval_id": approval_id or None, "payment_id": payment["payment_id"], "refund_id": refund_id, "audit_metadata": {"route": "pos_security.execute_refund_action", "kind": "customer_refund"}},
                idempotency_key=f"pos-refund-customer:{refund_id}",
            )
            if not customer_credit.success:
                if merchant and merchant.get("owner_id") and merchant_debit and merchant_debit.success:
                    rollback = await credit_wallet(
                        user_id=str(merchant["owner_id"]),
                        amount=refund_amount,
                        tx_type=TransactionType.REFUND,
                        description=f"POS Refund Rollback {payment['payment_id']}",
                        reference=f"RBR-{refund_hash.upper()}",
                        source="pos_security.refund_rollback",
                        metadata={"payment_id": payment["payment_id"], "refund_id": refund_id},
                        idempotency_key=f"pos-refund-merchant-rollback:{refund_id}",
                    )
                    if rollback.success:
                        merchant_marker = f"refund_markers.{refund_hash}"
                        await db.pos_merchants.update_one(
                            {"merchant_id": payment["merchant_id"], merchant_marker: {"$exists": True}},
                            {
                                "$inc": {"settlement_balance": refund_amount},
                                "$unset": {merchant_marker: ""},
                            },
                        )
                raise RuntimeError(customer_credit.error or "customer_refund_failed")

        new_refunded_total = round(refunded_before + refund_amount, 2)
        new_status = "refunded" if new_refunded_total >= original_amount else "partial_refund"
        refund_doc = {
            "refund_id": refund_id,
            "payment_id": payment["payment_id"],
            "store_id": payment["store_id"],
            "merchant_id": payment["merchant_id"],
            "amount": refund_amount,
            "refunded_total_after": new_refunded_total,
            "method": method,
            "reason": refund_payload.get("reason", ""),
            "issued_by": actor["user_id"],
            "issued_at": now_iso(),
            "approval_id": approval_id or None,
            "merchant_debit_transaction_id": merchant_debit.transaction_id if merchant_debit else None,
            "customer_credit_transaction_id": customer_credit.transaction_id if customer_credit else None,
        }
        await db.pos_refunds.update_one(
            {"refund_id": refund_id},
            {"$setOnInsert": refund_doc},
            upsert=True,
        )
        await db.pos_payments.update_one(
            {"payment_id": payment["payment_id"]},
            {
                "$set": {"status": new_status},
                "$unset": {f"refund_processing.{refund_hash}": ""},
            },
        )
        await audit_pos_security_event("pos_manager_approval_refund_executed", request=request, user_id=actor["user_id"], email=actor["user"].get("email", ""), details={"payment_id": payment["payment_id"], "amount": refund_amount, "approval_id": approval_id, "refund_id": refund_id}, severity="info")
        return refund_doc
    except Exception as exc:
        await db.pos_payments.update_one(
            {"payment_id": payment["payment_id"], f"refund_processing.{refund_hash}": {"$exists": True}},
            {
                "$inc": {"refunded_total": -refund_amount},
                "$unset": {f"refund_processing.{refund_hash}": ""},
                "$set": {"refund_last_error": str(exc)[:500], "refund_last_error_at": now_iso()},
            },
        )
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Refund konnte nicht sicher abgeschlossen werden")


async def execute_gift_card_action(payload: dict, actor: dict, request: Request | None = None, approval_id: str = "") -> dict:
    amount = round(float(payload.get("amount") or 0), 2)
    if amount <= 0 or amount > 2000:
        raise HTTPException(status_code=400, detail="Gutschein-Betrag ungültig")

    stable_id = str(approval_id or "").strip()
    if stable_id:
        existing = await db.pos_vouchers.find_one({"approval_id": stable_id}, {"_id": 0})
        if existing:
            expected_store = payload.get("store_id") or actor["store_id"]
            if (
                round(float(existing.get("amount") or 0), 2) != amount
                or existing.get("sold_at_store") != expected_store
            ):
                raise HTTPException(status_code=409, detail="Approval wurde bereits für einen anderen Gutschein verwendet")
            return {**existing, "replayed": True}

    valid_until = now_utc() + timedelta(days=365)
    voucher_code = (
        f"GS-{hashlib.sha256(stable_id.encode('utf-8')).hexdigest()[:12].upper()}"
        if stable_id
        else f"GS-{secrets.token_hex(6).upper()}"
    )
    voucher = {
        "voucher_code": voucher_code,
        "type": "gift_card",
        "amount": amount,
        "balance": amount,
        "currency": "EUR",
        "status": "active",
        "sold_at": now_iso(),
        "sold_by_user_id": actor["user_id"],
        "sold_at_store": payload.get("store_id") or actor["store_id"],
        "sold_at_register": payload.get("register_id") or actor.get("register_id", ""),
        "payment_method": payload.get("payment_method", "cash"),
        "valid_until": valid_until.isoformat(),
        "recipient_email": payload.get("recipient_email"),
        "message": payload.get("message"),
        "redeemed": False,
        "redeemed_at": None,
        "redeemed_by": None,
        "approval_id": stable_id or None,
        "created_at": now_iso(),
    }
    if stable_id:
        await db.pos_vouchers.update_one(
            {"approval_id": stable_id},
            {"$setOnInsert": voucher},
            upsert=True,
        )
        voucher = await db.pos_vouchers.find_one({"approval_id": stable_id}, {"_id": 0}) or voucher
    else:
        await db.pos_vouchers.insert_one(voucher)
        voucher.pop("_id", None)

    await audit_pos_security_event(
        "pos_manager_approval_giftcard_executed",
        request=request,
        user_id=actor["user_id"],
        email=actor["user"].get("email", ""),
        details={"amount": amount, "approval_id": stable_id, "store_id": actor["store_id"]},
        severity="info",
    )
    return voucher
