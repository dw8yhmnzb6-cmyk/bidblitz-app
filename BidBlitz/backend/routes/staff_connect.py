"""
BidBlitz Staff — Stripe Connect Express Onboarding
====================================================
Mitarbeiter onboarden für echte Auszahlungen via Stripe Connect Express.

Flow:
1. Merchant ruft POST /onboard mit staff_id auf → erstellt (oder reused) Connect-Account und gibt account_link.url zurück.
2. Mitarbeiter wird zu Stripe Hosted Onboarding weitergeleitet (KYC + Bank).
3. Stripe redirected nach completion zu return_url → Frontend pollt /status.
4. /status retrieved live account state (charges_enabled, payouts_enabled, requirements.currently_due).

ENV:
  STRIPE_API_KEY  (sk_test_*  oder sk_live_*)

Collections:
  staff_bank_details (extended with stripe_account_id, payouts_enabled, details_submitted)
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/wallet/connect", tags=["staff-wallet-connect"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]
log = logging.getLogger("bidblitz.staff_connect")

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "")


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _staff_session(request: Request) -> dict:
    """Staff-Cookie-Auth wie in staff_wallet.py."""
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht eingeloggt")
    sess = await db.staff_sessions.find_one({"id": sid, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Session abgelaufen")
    member = await db.staff_members.find_one({"id": sess["staff_id"]}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    return member


def _stripe():
    if not STRIPE_API_KEY:
        raise HTTPException(503, "Stripe ist nicht konfiguriert (STRIPE_API_KEY fehlt)")
    try:
        import stripe
        stripe.api_key = STRIPE_API_KEY
        return stripe
    except ImportError:
        raise HTTPException(503, "stripe SDK nicht installiert")


# ─────────── Models ───────────
class OnboardReq(BaseModel):
    staff_id: str
    return_url: str           # https://app/.../wallet/connect/return?staff_id=...
    refresh_url: Optional[str] = None


class SelfOnboardReq(BaseModel):
    return_url: str           # Mitarbeiter klickt selbst in Mobile-App
    refresh_url: Optional[str] = None


# ─────────── Helpers ───────────
async def _get_or_create_account(stripe, member: dict, merchant_id: str) -> str:
    """Returnt eine vorhandene oder erstellt eine neue Stripe Connect Express Account-ID."""
    bank = await db.staff_bank_details.find_one(
        {"merchant_id": merchant_id, "staff_id": member["id"]}, {"_id": 0},
    ) or {}
    acc_id = bank.get("stripe_account_id")
    if acc_id:
        # Verify it still exists (e.g. test-mode key changed)
        try:
            stripe.Account.retrieve(acc_id)
            return acc_id
        except Exception as e:
            log.warning(f"Stale stripe_account_id {acc_id} for staff {member['id']}: {e}")

    # Create new Express account (DE market)
    acc = stripe.Account.create(
        type="express",
        country="DE",
        email=member.get("email") or None,
        capabilities={
            "transfers": {"requested": True},
            "card_payments": {"requested": True},
        },
        business_type="individual",
        metadata={
            "bidblitz_merchant_id": merchant_id,
            "bidblitz_staff_id": member["id"],
            "bidblitz_staff_name": member.get("name", ""),
        },
        settings={"payouts": {"schedule": {"interval": "manual"}}},
    )
    await db.staff_bank_details.update_one(
        {"merchant_id": merchant_id, "staff_id": member["id"]},
        {"$set": {
            "merchant_id": merchant_id, "staff_id": member["id"],
            "stripe_account_id": acc.id,
            "stripe_account_created_at": datetime.now(timezone.utc).isoformat(),
            "details_submitted": False,
            "payouts_enabled": False,
            "charges_enabled": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return acc.id


async def _refresh_account_status(stripe, acc_id: str, merchant_id: str, staff_id: str) -> dict:
    """Holt aktuellen Stripe-Status und speichert ihn in DB."""
    acc = stripe.Account.retrieve(acc_id)
    req = acc.get("requirements") or {}
    snapshot = {
        "details_submitted": bool(acc.get("details_submitted")),
        "payouts_enabled": bool(acc.get("payouts_enabled")),
        "charges_enabled": bool(acc.get("charges_enabled")),
        "requirements_currently_due": list(req.get("currently_due") or []),
        "requirements_disabled_reason": req.get("disabled_reason"),
        "default_currency": acc.get("default_currency"),
        "country": acc.get("country"),
        "stripe_status_updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_bank_details.update_one(
        {"merchant_id": merchant_id, "staff_id": staff_id},
        {"$set": snapshot}, upsert=True,
    )
    snapshot["stripe_account_id"] = acc_id
    return snapshot


# ─────────── Manager-Initiated Onboarding ───────────
@router.post("/onboard")
async def onboard_staff(req: OnboardReq, request: Request):
    """Manager startet Onboarding für einen Mitarbeiter."""
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": req.staff_id, "merchant_id": mid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")

    stripe = _stripe()
    try:
        acc_id = await _get_or_create_account(stripe, member, mid)
        link = stripe.AccountLink.create(
            account=acc_id,
            refresh_url=req.refresh_url or req.return_url,
            return_url=req.return_url,
            type="account_onboarding",
        )
        return {
            "success": True,
            "stripe_account_id": acc_id,
            "onboarding_url": link.url,
            "expires_at": link.expires_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Stripe onboarding failed")
        raise HTTPException(502, f"Stripe-Fehler: {str(e)[:200]}")


# ─────────── Staff-Initiated Onboarding (Mobile App) ───────────
@router.post("/me/onboard")
async def onboard_me(req: SelfOnboardReq, member=Depends(_staff_session)):
    """Mitarbeiter startet Onboarding aus der Mobile App selbst."""
    stripe = _stripe()
    try:
        acc_id = await _get_or_create_account(stripe, member, member["merchant_id"])
        link = stripe.AccountLink.create(
            account=acc_id,
            refresh_url=req.refresh_url or req.return_url,
            return_url=req.return_url,
            type="account_onboarding",
        )
        return {
            "success": True,
            "stripe_account_id": acc_id,
            "onboarding_url": link.url,
            "expires_at": link.expires_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Stripe self-onboarding failed")
        raise HTTPException(502, f"Stripe-Fehler: {str(e)[:200]}")


# ─────────── Status Polling ───────────
@router.get("/status/{staff_id}")
async def get_status(staff_id: str, request: Request, live: bool = True):
    """Manager: Status eines MA-Connect-Accounts. ?live=true ruft Stripe.retrieve, sonst nur DB-Cache."""
    mid = await _merchant_id(request)
    bank = await db.staff_bank_details.find_one(
        {"merchant_id": mid, "staff_id": staff_id}, {"_id": 0},
    )
    if not bank or not bank.get("stripe_account_id"):
        return {"success": True, "connected": False, "stripe_account_id": None}
    acc_id = bank["stripe_account_id"]
    if not live:
        return {"success": True, "connected": True, "stripe_account_id": acc_id, **{
            k: bank.get(k) for k in (
                "details_submitted", "payouts_enabled", "charges_enabled",
                "requirements_currently_due", "requirements_disabled_reason",
                "stripe_status_updated_at",
            )
        }}
    stripe = _stripe()
    try:
        snap = await _refresh_account_status(stripe, acc_id, mid, staff_id)
        return {"success": True, "connected": True, **snap}
    except Exception as e:
        log.exception("Stripe status retrieve failed")
        raise HTTPException(502, f"Stripe-Fehler: {str(e)[:200]}")


@router.get("/me/status")
async def get_my_status(request: Request, live: bool = True, member=Depends(_staff_session)):
    """Mitarbeiter: eigener Connect-Status."""
    bank = await db.staff_bank_details.find_one(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"]}, {"_id": 0},
    )
    if not bank or not bank.get("stripe_account_id"):
        return {"success": True, "connected": False, "stripe_account_id": None}
    acc_id = bank["stripe_account_id"]
    if not live:
        return {"success": True, "connected": True, "stripe_account_id": acc_id, **{
            k: bank.get(k) for k in (
                "details_submitted", "payouts_enabled", "charges_enabled",
                "requirements_currently_due", "requirements_disabled_reason",
                "stripe_status_updated_at",
            )
        }}
    stripe = _stripe()
    try:
        snap = await _refresh_account_status(stripe, acc_id, member["merchant_id"], member["id"])
        return {"success": True, "connected": True, **snap}
    except Exception as e:
        log.exception("Stripe self-status retrieve failed")
        raise HTTPException(502, f"Stripe-Fehler: {str(e)[:200]}")


# ─────────── Login Link (Re-enter dashboard) ───────────
@router.post("/login-link/{staff_id}")
async def stripe_login_link(staff_id: str, request: Request):
    """Erzeugt einen Stripe Express Dashboard Login-Link (für bereits fertig onboarded MA)."""
    mid = await _merchant_id(request)
    bank = await db.staff_bank_details.find_one({"merchant_id": mid, "staff_id": staff_id}, {"_id": 0})
    if not bank or not bank.get("stripe_account_id"):
        raise HTTPException(404, "Kein Connect Account")
    stripe = _stripe()
    try:
        link = stripe.Account.create_login_link(bank["stripe_account_id"])
        return {"success": True, "url": link.url}
    except Exception as e:
        raise HTTPException(502, f"Stripe-Fehler: {str(e)[:200]}")


# ─────────── Disconnect ───────────
@router.delete("/{staff_id}")
async def disconnect_account(staff_id: str, request: Request):
    """Trennt den Connect Account (löscht stripe_account_id aus DB, deauthorized den Account bei Stripe)."""
    mid = await _merchant_id(request)
    bank = await db.staff_bank_details.find_one({"merchant_id": mid, "staff_id": staff_id}, {"_id": 0})
    if not bank or not bank.get("stripe_account_id"):
        raise HTTPException(404, "Kein Connect Account")
    stripe = _stripe()
    acc_id = bank["stripe_account_id"]
    try:
        # Stripe allows deletion only for test accounts or unverified live accounts
        stripe.Account.delete(acc_id)
    except Exception as e:
        log.warning(f"Stripe account delete failed (ignored): {e}")
    await db.staff_bank_details.update_one(
        {"merchant_id": mid, "staff_id": staff_id},
        {"$unset": {
            "stripe_account_id": "",
            "details_submitted": "",
            "payouts_enabled": "",
            "charges_enabled": "",
            "requirements_currently_due": "",
            "requirements_disabled_reason": "",
        }, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "deleted": True}
