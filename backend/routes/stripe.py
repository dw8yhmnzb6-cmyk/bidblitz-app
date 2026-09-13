"""
BidBlitz V2 - Stripe Checkout Routes
Handles wallet top-up via Stripe Checkout Sessions.

SUPPORTED PAYMENT METHODS:
- 💳 Credit & Debit Cards (Visa, Mastercard, Amex)
- 🍎 Apple Pay (iPhone, iPad, Apple Watch, Mac)
- 📱 Google Pay (Android Phones, Watches, Tablets)
- 🔗 Link (1-Click Checkout)
- 💰 Crypto/Stablecoins (USDC on supported accounts)

Apple Watch Support: Users can pay directly from their watch,
even with phone in pocket. Works via NFC tap-to-pay.

Uses centralized Payment Engine for atomic transactions.
Supports saved payment methods for 1-click top-up.
"""

import hashlib
import secrets
import stripe
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)
from core.config import STRIPE_API_KEY
from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter, RATE_STRIPE
from core.audit import log_audit, AuditEvent, get_client_info
from core.compliance import run_compliance_check, BLOCKED, FLAGGED
from core.payment_engine import process_stripe_payment, PaymentResult
from core.stripe_wallet_settlement import (
    WalletSettlementNeedsReview,
    settle_stripe_wallet_topup,
)
from core.stripe_bid_credit_settlement import (
    BidCreditSettlementNeedsReview,
    settle_stripe_bid_credits,
)
from routes.promotions import check_applicable_promotion, apply_promotion

router = APIRouter(prefix="/api/stripe", tags=["stripe"])

# Initialize Stripe via emergentintegrations proxy
_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
# This sets stripe.api_base correctly for sk_test_emergent

# Fixed top-up packages — amounts defined server-side only
TOPUP_PACKAGES = {
    "10": 10.0,
    "25": 25.0,
    "50": 50.0,
    "100": 100.0,
    "250": 250.0,
    "500": 500.0,
}


class CheckoutRequest(BaseModel):
    package_id: str = Field(..., description="Top-up package ID (10, 25, 50, 100, 250, 500)")
    origin_url: str = Field(..., description="Frontend origin URL for redirect")


class CheckoutStatusRequest(BaseModel):
    session_id: str


# ── Top-Up Plans ──
TOPUP_PLANS = [
    {"id": "topup_10", "amount": 10.00, "label": "€10", "popular": False},
    {"id": "topup_25", "amount": 25.00, "label": "€25", "popular": False},
    {"id": "topup_50", "amount": 50.00, "label": "€50", "popular": True},
    {"id": "topup_100", "amount": 100.00, "label": "€100", "popular": False},
    {"id": "topup_200", "amount": 200.00, "label": "€200", "popular": False},
]


@router.get("/plans")
async def get_topup_plans():
    """Get available top-up plans."""
    return {"plans": TOPUP_PLANS}


# ── Create Checkout Session ──
@router.post("/checkout")
@limiter.limit(RATE_STRIPE)
async def create_checkout(req: CheckoutRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    # Validate package
    if req.package_id not in TOPUP_PACKAGES:
        raise HTTPException(status_code=400, detail=f"Invalid package. Choose from: {', '.join(TOPUP_PACKAGES.keys())}")

    amount = TOPUP_PACKAGES[req.package_id]

    # ── Compliance check ──
    compliance = await run_compliance_check(user_id, "topup", amount)
    if compliance["outcome"] == BLOCKED:
        await log_audit(AuditEvent.TOPUP_FAILED, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "compliance_blocked", "rules": compliance["rules"], "amount": amount},
                        severity="warn")
        raise HTTPException(status_code=403, detail=compliance["reason"])
    if compliance["outcome"] == FLAGGED:
        await log_audit(AuditEvent.SUSPICIOUS_ACTIVITY, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"txn_type": "topup", "rules": compliance["rules"], "amount": amount},
                        severity="warn")

    # Build redirect URLs from frontend origin
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/wallet?stripe_session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/wallet?stripe_cancelled=true"

    # Get or create Stripe customer for payment method saving
    stripe_customer_id = user.get("stripe_customer_id")
    if stripe_customer_id:
        # Verify the customer exists at Stripe
        try:
            stripe.Customer.retrieve(stripe_customer_id)
        except Exception:
            stripe_customer_id = None
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$unset": {"stripe_customer_id": "", "stripe_pm_id": "", "stripe_card_brand": "", "stripe_card_last4": "", "stripe_card_exp_month": "", "stripe_card_exp_year": "", "stripe_pm_saved_at": ""}},
            )
    if not stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=user["email"],
                name=user.get("name", ""),
                metadata={"bidblitz_user_id": user_id},
            )
            stripe_customer_id = customer.id
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"stripe_customer_id": stripe_customer_id}},
            )
        except Exception:
            stripe_customer_id = None

    # Create checkout session (direct Stripe SDK for customer + setup_future_usage)
    # Supports Card + Apple Pay + Google Pay + Crypto (USDC Stablecoins)
    session_params = {
        "mode": "payment",
        "payment_method_types": ["card", "link"],
        "line_items": [{
            "price_data": {
                "currency": "eur",
                "unit_amount": int(amount * 100),
                "product_data": {
                    "name": f"BidBlitz Wallet Aufladung (EUR {amount:.2f})",
                    "description": "Sofortige Wallet-Aufladung für Auktionen und Services"
                },
            },
            "quantity": 1,
        }],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": user_id,
            "user_email": user["email"],
            "package_id": req.package_id,
            "amount": str(amount),
            "type": "wallet_topup",
        },
    }
    if stripe_customer_id:
        session_params["customer"] = stripe_customer_id
        session_params["payment_intent_data"] = {"setup_future_usage": "off_session"}

    session = stripe.checkout.Session.create(**session_params)

    # Record pending transaction in payment_transactions collection
    payment_record = {
        "session_id": session.id,
        "user_id": user_id,
        "user_email": user["email"],
        "amount": amount,
        "currency": "EUR",
        "package_id": req.package_id,
        "type": "wallet_topup",
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(payment_record)
    payment_record.pop("_id", None)

    await log_audit(AuditEvent.TOPUP_INITIATED, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua,
                    details={"session_id": session.id, "amount": amount,
                             "package_id": req.package_id})

    return {
        "checkout_url": session.url,
        "session_id": session.id,
    }


# ── Check Payment Status ──
@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    payment = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user_id, "type": "wallet_topup"},
        {"_id": 0},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment session not found")

    # A terminal legacy row is only trusted when the shared settlement core can
    # prove either the wallet marker or a completed legacy transaction.
    if payment.get("status") in {"credited", "completed", "manual_review_required"} and payment.get("payment_status") == "paid":
        try:
            cached_settlement = await settle_stripe_wallet_topup(
                session_id,
                expected_user_id=user_id,
            )
        except WalletSettlementNeedsReview as exc:
            raise HTTPException(status_code=409, detail=str(exc))
        if cached_settlement.get("credited"):
            return {
                "status": "credited",
                "payment_status": "paid",
                "amount": cached_settlement["amount"],
                "currency": cached_settlement["currency"],
                "credited": True,
            }

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/stripe/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    stripe_status = await stripe_checkout.get_checkout_status(session_id)
    new_payment_status = stripe_status.payment_status

    if stripe_status.payment_status != "paid":
        new_status = stripe_status.status
        await db.payment_transactions.update_one(
            {"session_id": session_id, "user_id": user_id, "type": "wallet_topup"},
            {"$set": {
                "status": new_status,
                "payment_status": new_payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await log_audit(AuditEvent.TOPUP_FAILED, user_id=user_id, email=user.get("email", ""),
                        ip=ip, user_agent=ua,
                        details={"session_id": session_id, "stripe_status": stripe_status.status,
                                 "payment_status": stripe_status.payment_status},
                        severity="warn")
        return {
            "status": new_status,
            "payment_status": new_payment_status,
            "amount": payment["amount"],
            "currency": payment["currency"],
            "credited": False,
        }

    try:
        settlement = await settle_stripe_wallet_topup(
            session_id,
            expected_user_id=user_id,
        )
    except WalletSettlementNeedsReview as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Wallet settlement failed: {exc}")

    if not settlement.get("found"):
        raise HTTPException(status_code=404, detail="Payment session not found")

    topup_promo = None
    if settlement.get("credited_now"):
        await log_audit(AuditEvent.TOPUP_SUCCESS, user_id=user_id, email=user.get("email", ""),
                        ip=ip, user_agent=ua,
                        details={"session_id": session_id, "amount": settlement["amount"],
                                 "reference": settlement["reference"]})

        # Send payment confirmation email once, from the process that applied the
        # atomic wallet increment. Failures here do not change settlement state.
        try:
            from core.email import send_payment_confirmation_email
            send_payment_confirmation_email(
                to=user.get("email", ""),
                amount=settlement["amount"],
                payment_type="topup",
                reference=settlement["reference"],
                user_name=user.get("name", "")
            )
        except Exception:
            pass

        # Save payment method for 1-click top-up.
        try:
            stripe_session = stripe.checkout.Session.retrieve(session_id, expand=["payment_intent.payment_method"])
            pi = stripe_session.get("payment_intent")
            if pi and isinstance(pi, stripe.PaymentIntent):
                pm = pi.get("payment_method")
                cust_id = stripe_session.get("customer") or pi.get("customer")
                if pm and isinstance(pm, stripe.PaymentMethod):
                    card = pm.get("card", {})
                    await db.users.update_one(
                        {"_id": user["_id"]},
                        {"$set": {
                            "stripe_customer_id": str(cust_id) if cust_id else "",
                            "stripe_pm_id": pm.id,
                            "stripe_card_brand": card.get("brand", ""),
                            "stripe_card_last4": card.get("last4", ""),
                            "stripe_card_exp_month": card.get("exp_month", 0),
                            "stripe_card_exp_year": card.get("exp_year", 0),
                            "stripe_pm_saved_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
        except Exception:
            pass

        # Apply a top-up promotion only from the single process that performed the
        # wallet increment, preventing polling/webhook races from duplicating bonus.
        try:
            promo = await check_applicable_promotion(user_id, "topup", settlement["amount"])
            if promo:
                bonus = round(settlement["amount"] * promo["value"] / 100, 2)
                if bonus > 0:
                    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": bonus}})
                    await db.transactions.insert_one({
                        "id": secrets.token_hex(8),
                        "user_id": user_id,
                        "type": "reward",
                        "amount": bonus,
                        "description": f"Top-up bonus: {promo['name']} ({promo['value']}%)",
                        "status": "completed",
                        "reference": f"PROMO-{secrets.token_hex(4).upper()}",
                        "category": "promotion",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    await apply_promotion(user_id, promo["name"], settlement["amount"])
                    topup_promo = {"name": promo["name"], "bonus": bonus, "value": promo["value"]}
        except Exception:
            pass

    resp = {
        "status": "credited",
        "payment_status": "paid",
        "amount": settlement["amount"],
        "currency": settlement["currency"],
        "credited": True,
    }
    if topup_promo:
        resp["promotion"] = topup_promo
    return resp


# ── Webhook ──
@router.post("/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    try:
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/stripe/webhook"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        event = await stripe_checkout.handle_webhook(body, signature)

        if event.payment_status == "paid" and event.session_id:
            try:
                from routes.dating import handle_dating_premium_webhook
                await handle_dating_premium_webhook(event.session_id)
            except Exception:
                pass
            try:
                from routes.pool_management import handle_pool_ticket_webhook
                await handle_pool_ticket_webhook(event.session_id)
            except Exception:
                pass

            # Wallet top-up settlement is shared with checkout polling. The atomic
            # user-document session marker makes polling/webhook races converge on a
            # single wallet increment and a single deterministic transaction row.
            wallet_payment = await db.payment_transactions.find_one({
                "session_id": event.session_id,
                "type": "wallet_topup",
            })
            if wallet_payment:
                try:
                    await settle_stripe_wallet_topup(event.session_id)
                except WalletSettlementNeedsReview as exc:
                    import logging as _logging
                    _logging.getLogger("bidblitz.stripe").error(
                        f"Stripe wallet settlement needs manual review: {exc}",
                        exc_info=True,
                    )
                    raise

            # 2. POS Feature-Purchase (Add-On Buchung)
            try:
                feature_purchase = await db.pos_feature_purchases.find_one({"session_id": event.session_id})
                if feature_purchase and feature_purchase.get("status") != "completed":
                    from routes.pos_features import activate_feature_after_payment
                    await activate_feature_after_payment(event.session_id)
            except Exception:
                pass

            # 3. Auction Bid-Credits Purchase. Settlement is shared and retry-safe:
            # payment_status is not marked credited until the atomic user marker,
            # deterministic transaction row and pending purchase finalization exist.
            meta = (event.metadata or {}) if hasattr(event, "metadata") else {}
            try:
                await settle_stripe_bid_credits(event.session_id, metadata=meta)
            except BidCreditSettlementNeedsReview as exc:
                import logging as _logging
                _logging.getLogger("bidblitz.stripe").error(
                    f"Stripe bid-credit settlement needs manual review: {exc}",
                    exc_info=True,
                )
                raise

        return {"received": True}
    except HTTPException:
        raise
    except Exception as e:
        import logging as _logging
        _logging.getLogger("bidblitz.stripe").error(
            f"Stripe webhook processing failed: {e}", exc_info=True
        )
        # Return non-2xx so Stripe retries transient processing failures.
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# ── Get available packages ──
@router.get("/packages")
async def get_packages():
    return {
        "packages": [
            {"id": k, "amount": v, "currency": "EUR", "label": f"EUR {v:.2f}"}
            for k, v in sorted(TOPUP_PACKAGES.items(), key=lambda x: x[1])
        ]
    }



# ═══════════════════════════════════════════════════
# Saved Payment Method & 1-Click Top-Up
# ═══════════════════════════════════════════════════

@router.get("/saved-method")
async def get_saved_method(request: Request):
    """Return the user's saved card details (brand + last4)."""
    user = await get_current_user(request)
    pm_id = user.get("stripe_pm_id")
    if not pm_id:
        return {"has_saved_method": False}

    return {
        "has_saved_method": True,
        "card_brand": user.get("stripe_card_brand", ""),
        "card_last4": user.get("stripe_card_last4", ""),
        "card_exp_month": user.get("stripe_card_exp_month", 0),
        "card_exp_year": user.get("stripe_card_exp_year", 0),
    }


class QuickTopUpRequest(BaseModel):
    amount: float = Field(..., gt=0, le=500)
    idempotency_key: str = Field(..., min_length=16, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")


@router.post("/quick-topup")
@limiter.limit(RATE_STRIPE)
async def quick_topup(req: QuickTopUpRequest, request: Request):
    """1-click top-up using a saved payment method with retry-safe idempotency."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)
    amount = round(req.amount, 2)

    # Keep the same server-defined packages as regular Stripe Checkout.
    if amount not in TOPUP_PACKAGES.values():
        raise HTTPException(status_code=400, detail="Invalid top-up amount")

    attempt_id = f"quick_topup:{user_id}:{req.idempotency_key}"
    stripe_idempotency_key = f"bb-quick-{hashlib.sha256(attempt_id.encode('utf-8')).hexdigest()}"
    attempt = await db.quick_topup_attempts.find_one({"_id": attempt_id})

    if attempt:
        if round(float(attempt.get("amount", 0) or 0), 2) != amount:
            raise HTTPException(status_code=409, detail="Idempotency key already used for another amount")
        if attempt.get("status") == "credited":
            return {
                "status": "credited",
                "amount": amount,
                "reference": attempt.get("reference", ""),
                "new_balance": attempt.get("new_balance"),
                "idempotent_replay": True,
            }
        if attempt.get("status") in {"failed_card", "failed_no_method"}:
            raise HTTPException(status_code=409, detail="Previous payment attempt failed; start a new payment attempt")

        # Stripe v1 idempotency keys are guaranteed for at least 24h. If an old
        # uncertain attempt never persisted a PaymentIntent id, never create a new
        # charge under the same stale application attempt.
        if attempt.get("status") == "payment_uncertain" and not attempt.get("stripe_pi_id"):
            try:
                created_at = datetime.fromisoformat(str(attempt.get("created_at", "")))
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) - created_at >= timedelta(hours=23):
                    raise HTTPException(
                        status_code=409,
                        detail="Previous payment attempt requires manual verification before retry",
                    )
            except HTTPException:
                raise
            except Exception:
                pass
    else:
        cust_id = user.get("stripe_customer_id")
        pm_id = user.get("stripe_pm_id")
        if not cust_id or not pm_id:
            raise HTTPException(status_code=400, detail="No saved payment method")

        # Compliance is evaluated before the first external charge. Retries of the
        # same attempt continue settlement instead of blocking an already-paid charge.
        compliance = await run_compliance_check(user_id, "topup", amount)
        if compliance["outcome"] == BLOCKED:
            raise HTTPException(status_code=403, detail=compliance["reason"])

        now = datetime.now(timezone.utc).isoformat()
        attempt_doc = {
            "_id": attempt_id,
            "user_id": user_id,
            "amount": amount,
            "currency": "EUR",
            "status": "initiated",
            "stripe_idempotency_key": stripe_idempotency_key,
            "stripe_pi_id": None,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await db.quick_topup_attempts.insert_one(attempt_doc)
            attempt = attempt_doc
        except Exception:
            # Concurrent request: the unique Mongo _id is the application-level claim.
            attempt = await db.quick_topup_attempts.find_one({"_id": attempt_id})
            if not attempt:
                raise HTTPException(status_code=500, detail="Could not initialize payment attempt")
            if round(float(attempt.get("amount", 0) or 0), 2) != amount:
                raise HTTPException(status_code=409, detail="Idempotency key already used for another amount")

    intent = None
    existing_pi_id = attempt.get("stripe_pi_id") if attempt else None

    try:
        if existing_pi_id:
            # Once the PaymentIntent id is durable, retrieve it instead of issuing
            # another create request, even if the browser retries much later.
            intent = stripe.PaymentIntent.retrieve(existing_pi_id)
        else:
            cust_id = user.get("stripe_customer_id")
            pm_id = user.get("stripe_pm_id")
            if not cust_id or not pm_id:
                await db.quick_topup_attempts.update_one(
                    {"_id": attempt_id},
                    {"$set": {
                        "status": "failed_no_method",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                raise HTTPException(status_code=400, detail="No saved payment method")

            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency="eur",
                customer=cust_id,
                payment_method=pm_id,
                off_session=True,
                confirm=True,
                metadata={
                    "user_id": user_id,
                    "type": "quick_topup",
                    "amount": str(amount),
                },
                idempotency_key=stripe_idempotency_key,
            )
            await db.quick_topup_attempts.update_one(
                {"_id": attempt_id},
                {"$set": {
                    "stripe_pi_id": intent.id,
                    "status": f"payment_{intent.status}",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
    except HTTPException:
        raise
    except stripe.error.CardError as e:
        await db.quick_topup_attempts.update_one(
            {"_id": attempt_id},
            {"$set": {
                "status": "failed_card",
                "last_error": "card_declined",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        # Card declined — remove saved method
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$unset": {
                "stripe_pm_id": "",
                "stripe_card_brand": "",
                "stripe_card_last4": "",
                "stripe_card_exp_month": "",
                "stripe_card_exp_year": "",
                "stripe_pm_saved_at": "",
            }},
        )
        raise HTTPException(status_code=402, detail=f"Card declined: {e.user_message}")
    except Exception:
        # A network timeout can happen after Stripe accepted the request. Keep the
        # attempt retryable with the exact same Stripe idempotency key.
        await db.quick_topup_attempts.update_one(
            {"_id": attempt_id},
            {"$set": {
                "status": "payment_uncertain",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=502, detail="Payment verification failed. Please retry safely.")

    if intent.status != "succeeded":
        await db.quick_topup_attempts.update_one(
            {"_id": attempt_id},
            {"$set": {
                "stripe_pi_id": intent.id,
                "status": f"payment_{intent.status}",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=402, detail=f"Payment not completed: {intent.status}")

    await db.quick_topup_attempts.update_one(
        {"_id": attempt_id},
        {"$set": {
            "stripe_pi_id": intent.id,
            "status": "payment_succeeded",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # The balance increment and durable PaymentIntent marker live in the same user
    # document. The marker must never be trimmed: removing an old intent would reopen
    # a replay window for a previously succeeded payment after a partial finalization.
    credit_time = datetime.now(timezone.utc).isoformat()
    wallet_result = await db.users.update_one(
        {
            "_id": user["_id"],
            "quick_topup_credited_intents": {"$ne": intent.id},
        },
        {
            "$inc": {"balance": amount},
            "$addToSet": {"quick_topup_credited_intents": intent.id},
            "$set": {"last_balance_update": credit_time},
        },
    )

    updated_user = await db.users.find_one(
        {"_id": user["_id"]},
        {"balance": 1, "quick_topup_credited_intents": 1},
    )
    if not updated_user:
        raise HTTPException(status_code=500, detail="Wallet credit failed")

    credited_intents = updated_user.get("quick_topup_credited_intents", []) or []
    if wallet_result.modified_count != 1 and intent.id not in credited_intents:
        raise HTTPException(status_code=500, detail="Wallet credit failed")

    credited_now = wallet_result.modified_count == 1
    ref_hash = hashlib.sha256(intent.id.encode("utf-8")).hexdigest().upper()
    ref = f"QUICK-{ref_hash[:12]}"
    transaction_id = f"QTP-{ref_hash[:16]}"
    txn = {
        "_id": f"quick_topup:{intent.id}",
        "id": transaction_id,
        "idempotency_key": attempt_id,
        "user_id": user_id,
        "type": "topup",
        "amount": amount,
        "description": f"1-Click Top-Up (EUR {amount:.2f})",
        "merchant_name": "Stripe",
        "status": "completed",
        "reference": ref,
        "payment_method": "saved_card",
        "category": "topup",
        "stripe_pi_id": intent.id,
        "created_at": credit_time,
    }
    try:
        await db.transactions.insert_one(txn)
    except Exception:
        existing_txn = await db.transactions.find_one(
            {"_id": txn["_id"], "stripe_pi_id": intent.id},
            {"_id": 1},
        )
        if not existing_txn:
            await db.quick_topup_attempts.update_one(
                {"_id": attempt_id},
                {"$set": {
                    "status": "wallet_credited_audit_pending",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(
                status_code=500,
                detail="Wallet credited; transaction finalization pending. Retry safely.",
            )

    new_balance = round(float(updated_user.get("balance", 0) or 0), 2)
    await db.quick_topup_attempts.update_one(
        {"_id": attempt_id},
        {"$set": {
            "status": "credited",
            "reference": ref,
            "transaction_id": transaction_id,
            "new_balance": new_balance,
            "credited_at": credit_time,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    if credited_now:
        await log_audit(AuditEvent.TOPUP_SUCCESS, user_id=user_id, email=user.get("email", ""),
                        ip=ip, user_agent=ua,
                        details={"reference": ref, "amount": amount, "method": "1-click",
                                 "stripe_pi_id": intent.id})

    return {
        "status": "credited",
        "amount": amount,
        "reference": ref,
        "new_balance": new_balance,
        "idempotent_replay": not credited_now,
    }


@router.delete("/saved-method")
async def remove_saved_method(request: Request):
    """Remove saved payment method from user account."""
    user = await get_current_user(request)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$unset": {
            "stripe_pm_id": "",
            "stripe_card_brand": "",
            "stripe_card_last4": "",
            "stripe_card_exp_month": "",
            "stripe_card_exp_year": "",
            "stripe_pm_saved_at": "",
        }},
    )
    return {"ok": True}


@router.post("/save-card")
async def save_card_checkout(request: Request):
    """Create a Stripe Checkout Session in setup mode to save a card for future payments."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get or create Stripe customer
    cust_id = user.get("stripe_customer_id")
    if not cust_id:
        customer = stripe.Customer.create(
            email=user.get("email", ""),
            name=user.get("name", ""),
            metadata={"user_id": user_id, "platform": "bidblitz"},
        )
        cust_id = customer.id
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"stripe_customer_id": cust_id}})
    
    frontend_url = request.headers.get("origin", str(request.base_url).rstrip("/"))
    
    session = stripe.checkout.Session.create(
        customer=cust_id,
        mode="setup",
        payment_method_types=["card"],
        success_url=f"{frontend_url}?card_saved=success",
        cancel_url=f"{frontend_url}?card_saved=cancel",
        metadata={"type": "save_card", "user_id": user_id},
    )
    
    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/save-card-confirm")
async def save_card_confirm(request: Request):
    """After Stripe setup checkout success, retrieve and save the payment method."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    cust_id = user.get("stripe_customer_id")
    if not cust_id:
        raise HTTPException(status_code=400, detail="Kein Stripe-Kunde gefunden")
    
    # Get the latest payment method for this customer
    try:
        pms = stripe.PaymentMethod.list(customer=cust_id, type="card", limit=1)
        if not pms.data:
            raise HTTPException(status_code=400, detail="Keine Karte gefunden")
        
        pm = pms.data[0]
        card = pm.card or {}
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "stripe_customer_id": cust_id,
                "stripe_pm_id": pm.id,
                "stripe_card_brand": card.get("brand", ""),
                "stripe_card_last4": card.get("last4", ""),
                "stripe_card_exp_month": card.get("exp_month", 0),
                "stripe_card_exp_year": card.get("exp_year", 0),
                "stripe_pm_saved_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        
        return {
            "ok": True,
            "card_brand": card.get("brand", ""),
            "card_last4": card.get("last4", ""),
        }
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))