import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from cryptography.fernet import Fernet
from fastapi import HTTPException, Request

from core.config import JWT_SECRET
from core.database import db
from core.feature_flags import get_flag
from services.pos_security import (
    audit_pos_security_event,
    build_customer_public_view,
    create_security_alert,
    get_actor_context,
    now_iso,
    now_utc,
)


BIOPAY_FACE_FLAG = "biopay_face"


def _biopay_fernet() -> Fernet:
    key_material = hashlib.sha256(f"biopay::{JWT_SECRET}".encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(key_material)
    return Fernet(key)


def encrypt_template_token(template_token: str) -> str:
    return _biopay_fernet().encrypt(template_token.encode("utf-8")).decode("utf-8")


def decrypt_template_token(encrypted_token: str) -> str:
    return _biopay_fernet().decrypt(encrypted_token.encode("utf-8")).decode("utf-8")


def template_token_fingerprint(template_token: str) -> str:
    return hashlib.sha256(f"{JWT_SECRET}::{template_token}".encode("utf-8")).hexdigest()


def template_token_preview(template_token: str) -> str:
    raw = (template_token or "").strip()
    if len(raw) <= 8:
        return f"{raw[:2]}••••"
    return f"{raw[:4]}••••{raw[-4:]}"


def public_profile_view(profile: dict) -> dict:
    return {
        "profile_id": profile.get("profile_id", ""),
        "principal_id": profile.get("principal_id", ""),
        "principal_type": profile.get("principal_type", "customer"),
        "modality": profile.get("modality", "palm"),
        "status": profile.get("status", "inactive"),
        "token_preview": profile.get("token_preview", ""),
        "nickname": profile.get("nickname", ""),
        "enrolled_at": profile.get("enrolled_at"),
        "last_verified_at": profile.get("last_verified_at"),
    }


def public_terminal_view(terminal: dict) -> dict:
    return {
        "terminal_id": terminal.get("terminal_id", ""),
        "merchant_id": terminal.get("merchant_id", ""),
        "store_id": terminal.get("store_id", ""),
        "register_id": terminal.get("register_id", ""),
        "label": terminal.get("label", ""),
        "status": terminal.get("status", "inactive"),
        "palm_enabled": bool(terminal.get("palm_enabled", True)),
        "face_enabled": bool(terminal.get("face_enabled", False)),
        "created_at": terminal.get("created_at"),
        "updated_at": terminal.get("updated_at"),
        "last_seen_at": terminal.get("last_seen_at"),
    }


def public_session_view(session: dict) -> dict:
    return {
        "session_id": session.get("session_id", ""),
        "merchant_id": session.get("merchant_id", ""),
        "store_id": session.get("store_id", ""),
        "register_id": session.get("register_id", ""),
        "terminal_id": session.get("terminal_id", ""),
        "principal_type": session.get("principal_type", "customer"),
        "principal_id": session.get("principal_id", ""),
        "principal_user_number": session.get("principal_user_number", ""),
        "modality": session.get("modality", "palm"),
        "verification_type": session.get("verification_type", "verify"),
        "status": session.get("status", "unknown"),
        "score": session.get("score", 0.0),
        "amount": session.get("amount"),
        "created_at": session.get("created_at"),
        "target_id": session.get("target_id", ""),
    }


async def is_facepay_enabled() -> bool:
    flag = await get_flag(BIOPAY_FACE_FLAG)
    return bool(flag.get("enabled", False))


async def validate_modality(modality: str):
    normalized = (modality or "palm").strip().lower()
    if normalized not in {"palm", "face"}:
        raise HTTPException(status_code=400, detail="Unbekannte BioPay-Methode")
    if normalized == "face" and not await is_facepay_enabled():
        raise HTTPException(status_code=403, detail="FacePay ist aktuell deaktiviert")
    return normalized


async def upsert_profile_for_user(user: dict, template_token: str, modality: str, nickname: str = "") -> dict:
    normalized_modality = await validate_modality(modality)
    clean_token = (template_token or "").strip()
    if len(clean_token) < 8:
        raise HTTPException(status_code=400, detail="Biometrischer Token ist zu kurz")

    existing = await db.biometric_profiles.find_one(
        {"principal_id": str(user["_id"]), "principal_type": "customer", "modality": normalized_modality, "status": {"$ne": "revoked"}},
        {"_id": 0, "profile_id": 1},
    )
    profile_id = (existing or {}).get("profile_id") or f"BIO-{secrets.token_hex(6).upper()}"
    profile_doc = {
        "profile_id": profile_id,
        "principal_id": str(user["_id"]),
        "principal_user_number": user.get("user_number", ""),
        "principal_type": "customer",
        "modality": normalized_modality,
        "token_preview": template_token_preview(clean_token),
        "template_token_encrypted": encrypt_template_token(clean_token),
        "token_fingerprint": template_token_fingerprint(clean_token),
        "nickname": nickname or f"{normalized_modality.title()}Pay",
        "status": "active",
        "enrolled_at": now_iso(),
        "updated_at": now_iso(),
        "last_verified_at": None,
    }
    await db.biometric_profiles.update_one(
        {"profile_id": profile_id},
        {"$set": profile_doc, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"biometric_enabled": True}})
    return profile_doc


async def revoke_profile(profile_id: str, user: dict) -> dict:
    profile = await db.biometric_profiles.find_one({"profile_id": profile_id, "principal_id": str(user["_id"]), "status": {"$ne": "revoked"}})
    if not profile:
        raise HTTPException(status_code=404, detail="BioPay-Profil nicht gefunden")
    await db.biometric_profiles.update_one({"profile_id": profile_id}, {"$set": {"status": "revoked", "revoked_at": now_iso(), "updated_at": now_iso()}})
    active_count = await db.biometric_profiles.count_documents({"principal_id": str(user["_id"]), "status": "active"})
    if active_count == 0:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"biometric_enabled": False}})
    profile["status"] = "revoked"
    profile["updated_at"] = now_iso()
    return profile


async def get_profiles_for_user(user: dict) -> list[dict]:
    profiles = await db.biometric_profiles.find(
        {"principal_id": str(user["_id"]), "status": {"$ne": "revoked"}},
        {"_id": 0, "template_token_encrypted": 0, "token_fingerprint": 0},
    ).sort("created_at", -1).to_list(10)
    return profiles


async def get_profile_for_principal(principal_id: str, modality: str = "palm", principal_type: str = "customer") -> dict | None:
    return await db.biometric_profiles.find_one(
        {"principal_id": principal_id, "principal_type": principal_type, "modality": modality, "status": "active"},
        {"_id": 0},
    )


async def verify_principal_token(principal_id: str, template_token: str, modality: str = "palm", principal_type: str = "customer") -> tuple[dict | None, bool, float]:
    normalized_modality = await validate_modality(modality)
    profile = await get_profile_for_principal(principal_id, normalized_modality, principal_type)
    if not profile:
        return None, False, 0.0
    matched = template_token_fingerprint((template_token or "").strip()) == profile.get("token_fingerprint")
    score = 0.99 if matched else 0.12
    if matched:
        await db.biometric_profiles.update_one({"profile_id": profile["profile_id"]}, {"$set": {"last_verified_at": now_iso(), "updated_at": now_iso()}})
        profile["last_verified_at"] = now_iso()
    return profile, matched, score


async def create_biopay_session(
    principal: dict,
    modality: str,
    verification_type: str,
    status: str,
    score: float,
    store_id: str = "",
    register_id: str = "",
    merchant_id: str = "",
    terminal_id: str = "",
    target_id: str = "",
    amount: float | None = None,
    actor_user_id: str = "",
):
    session = {
        "session_id": f"BPS-{secrets.token_hex(6).upper()}",
        "principal_id": str(principal.get("_id") or principal.get("principal_id") or ""),
        "principal_user_number": principal.get("user_number") or principal.get("principal_user_number", ""),
        "principal_type": principal.get("principal_type", "customer"),
        "modality": modality,
        "verification_type": verification_type,
        "status": status,
        "score": round(float(score), 2),
        "store_id": store_id,
        "register_id": register_id,
        "merchant_id": merchant_id,
        "terminal_id": terminal_id,
        "target_id": target_id,
        "amount": round(float(amount), 2) if amount is not None else None,
        "actor_user_id": actor_user_id,
        "created_at": now_iso(),
    }
    await db.biopay_sessions.insert_one(session)
    return session


async def resolve_terminal_for_actor(actor: dict, terminal_id: str | None = None, require_active: bool = True) -> dict:
    query = {"merchant_id": actor["merchant_id"]}
    if terminal_id:
        query["terminal_id"] = terminal_id
    else:
        query["store_id"] = actor["store_id"]
        if actor.get("register_id"):
            query["register_id"] = actor["register_id"]
    terminal = await db.biopay_terminals.find_one(query, {"_id": 0})
    if not terminal and not terminal_id:
        terminal = await db.biopay_terminals.find_one({"merchant_id": actor["merchant_id"], "store_id": actor["store_id"]}, {"_id": 0})
    if not terminal:
        raise HTTPException(status_code=404, detail="Kein BioPay-Terminal gefunden")
    if require_active and terminal.get("status") != "active":
        raise HTTPException(status_code=423, detail="BioPay-Terminal ist deaktiviert")
    return terminal


async def create_biopay_terminal(actor: dict, label: str, palm_enabled: bool, face_enabled: bool, register_id: str = "") -> dict:
    face_allowed = await is_facepay_enabled()
    if face_enabled and not face_allowed:
        raise HTTPException(status_code=403, detail="FacePay ist aktuell deaktiviert")
    terminal = {
        "terminal_id": f"BIO-{secrets.token_hex(5).upper()}",
        "merchant_id": actor["merchant_id"],
        "store_id": actor["store_id"],
        "register_id": register_id or actor.get("register_id", ""),
        "label": label,
        "palm_enabled": bool(palm_enabled),
        "face_enabled": bool(face_enabled and face_allowed),
        "status": "active",
        "created_by": actor["user_id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "last_seen_at": None,
    }
    await db.biopay_terminals.insert_one(terminal)
    return terminal


async def touch_terminal(terminal_id: str):
    await db.biopay_terminals.update_one({"terminal_id": terminal_id}, {"$set": {"last_seen_at": now_iso(), "updated_at": now_iso()}})


async def get_biopay_summary_for_store(actor: dict) -> dict:
    profiles = await db.biometric_profiles.count_documents({"status": "active"})
    terminals = await db.biopay_terminals.find({"merchant_id": actor["merchant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    sessions = await db.biopay_sessions.find({"merchant_id": actor["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {
        "profiles_total": profiles,
        "terminals": [public_terminal_view(item) for item in terminals],
        "sessions": [public_session_view(item) for item in sessions],
        "facepay_enabled": await is_facepay_enabled(),
    }


async def handle_biopay_failure(actor: dict, customer: dict, modality: str, terminal_id: str, request: Request | None = None):
    await create_security_alert(
        actor["merchant_id"],
        actor["store_id"],
        "biopay_failed_verify",
        "BioPay-Verifikation fehlgeschlagen",
        {"customer_number": customer.get("user_number", ""), "modality": modality, "terminal_id": terminal_id},
        "medium",
        actor["user_id"],
        str(customer["_id"]),
    )
    await audit_pos_security_event(
        "biopay_verify_failed",
        request=request,
        user_id=actor["user_id"],
        email=actor["user"].get("email", ""),
        details={"customer_number": customer.get("user_number", ""), "modality": modality, "terminal_id": terminal_id, "store_id": actor["store_id"]},
        severity="warning",
    )


async def get_staff_clock_target(user: dict) -> dict | None:
    staff_member = await db.staff_members.find_one({"email": user.get("email", ""), "active": True}, {"_id": 0})
    if staff_member:
        return {"source": "staff_members", "staff_id": staff_member["id"], "merchant_id": staff_member["merchant_id"], "name": staff_member.get("name", user.get("name", ""))}
    pos_staff = await db.pos_staff.find_one({"user_id": str(user["_id"]), "active": True}, {"_id": 0})
    if pos_staff:
        return {"source": "pos_staff", "staff_id": str(user["_id"]), "merchant_id": pos_staff["merchant_id"], "name": user.get("name", "")}
    return None
