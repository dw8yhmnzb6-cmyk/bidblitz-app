import ast
import asyncio
import inspect
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError


BACKEND_DIR = Path(__file__).resolve().parent.parent
STRIPE_ROUTE_PATH = BACKEND_DIR / "routes" / "stripe.py"
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))
os.environ["COOKIE_SECURE"] = "false"
os.environ["COOKIE_SAMESITE"] = "lax"
os.environ["DEMO_SEED"] = "false"
os.environ["BIDBLITZ_SYNC_STARTUP"] = "true"

import server  # noqa: E402
from core import canonical_wallet_service as canonical_wallet  # noqa: E402
from routes import bidblitz_pay as bidblitz_pay_routes  # noqa: E402
from routes import payment as payment_routes  # noqa: E402
from schemas.models import TopUpRequest  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as test_client:
        yield test_client


def test_health_and_root_endpoints(client):
    health = client.get("/health")
    assert health.status_code == 200
    health_data = health.json()
    assert health_data["status"] == "healthy"

    root = client.get("/")
    assert root.status_code == 200
    root_data = root.json()
    assert root_data["app"] == "BidBlitz V2 API"


def test_public_commerce_and_payment_endpoints(client):
    overview = client.get("/api/commerce-center/overview")
    assert overview.status_code == 200
    overview_data = overview.json()
    for key in ["stats", "flash_sales", "marketplace", "penny_auctions", "live_auctions"]:
        assert key in overview_data

    invalid_pay = client.get("/api/pay/invalid-token-ci")
    assert invalid_pay.status_code == 404


def test_apple_google_pay_routes_are_registered_in_fastapi_app(client):
    paths = {getattr(route, "path", "") for route in server.app.routes}
    for path in [
        "/api/payments/create-payment-intent",
        "/api/payments/payment-intent/{payment_intent_id}",
        "/api/payments/webhook/stripe-payment",
    ]:
        assert path in paths

    create = client.post("/api/payments/create-payment-intent", json={"amount": 10, "currency": "eur"})
    assert create.status_code in {401, 403, 503}


def test_mining_routes_are_registered_in_fastapi_app(client):
    paths = {getattr(route, "path", "") for route in server.app.routes}
    for path in [
        "/api/mining/capabilities",
        "/api/mining/dashboard",
        "/api/mining/packages",
        "/api/mining/upgrade-costs",
        "/api/mining/marketplace",
        "/api/mining/card",
        "/api/mining/launchpad",
    ]:
        assert path in paths

    capabilities = client.get("/api/mining/capabilities")
    assert capabilities.status_code == 200
    assert "value_actions_enabled" in capabilities.json()

    # Authenticated mining pages may reject anonymous requests, but must never be missing.
    dashboard = client.get("/api/mining/dashboard")
    assert dashboard.status_code in {401, 403}
    marketplace = client.get("/api/mining/marketplace")
    assert marketplace.status_code in {401, 403}


def test_auth_register_and_login_contract(client):
    email = f"ci_smoke_{uuid.uuid4().hex[:8]}@test.com"

    register = client.post(
        "/api/auth/register",
        json={"name": "CI Smoke", "email": email, "password": "password123"},
    )
    if register.status_code == 403:
        detail = str(register.json().get("detail") or "")
        assert "invite" in detail.lower() or "soft launch" in detail.lower()
        return

    assert register.status_code == 200
    register_data = register.json()
    assert register_data["email"] == email
    assert register_data["role"] == "user"
    assert "balance" in register_data

    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert login.status_code == 200
    login_data = login.json()
    assert login_data["email"] == email
    assert login_data["role"] == "user"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["email"] == email

    mining_dashboard = client.get("/api/mining/dashboard")
    assert mining_dashboard.status_code == 200
    mining_data = mining_dashboard.json()
    assert "capabilities" in mining_data
    assert "wallet" in mining_data
    assert "mining" in mining_data
    assert "miners" in mining_data


def test_invalid_login_rejected(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@bidblitz.com", "password": "definitiv-falsch"},
    )
    assert response.status_code == 401


def test_direct_wallet_topup_is_blocked_outside_test_mode(monkeypatch):
    monkeypatch.setenv("TEST_MODE", "false")
    with pytest.raises(ValidationError, match="Direct wallet top-up is disabled outside TEST_MODE"):
        TopUpRequest(amount=10, payment_method="card")


def test_direct_wallet_topup_remains_available_in_test_mode(monkeypatch):
    monkeypatch.setenv("TEST_MODE", "true")
    request = TopUpRequest(amount=10, payment_method="test")
    assert request.amount == 10
    assert request.payment_method == "test"


def test_payment_rejects_unknown_merchant_before_wallet_debit():
    source = inspect.getsource(payment_routes.pay)
    merchant_guard = source.index('raise HTTPException(status_code=404, detail="Merchant not found")')
    wallet_debit = source.index("debit_result = await debit_wallet")
    assert merchant_guard < wallet_debit


def test_payment_updates_merchant_stats_after_successful_wallet_credit():
    source = inspect.getsource(payment_routes.pay)
    merchant_credit = source.index("merchant_credit_result = await credit_wallet")
    merchant_stats = source.index("await db.merchants.update_one")
    assert merchant_credit < merchant_stats


def test_canonical_wallet_nonfresh_idempotency_states_never_execute_again():
    pending = canonical_wallet._existing_idempotency_result(
        "pending",
        {"status": "pending", "response": None},
    )
    failed = canonical_wallet._existing_idempotency_result(
        "failed",
        {"status": "failed", "response": {"transaction_id": "TXN-OLD", "error": "declined"}},
    )
    conflict = canonical_wallet._existing_idempotency_result(
        "conflict",
        {"status": "pending", "response": None},
    )

    assert pending is not None and pending.success is False
    assert pending.status == "pending"
    assert pending.idempotent_replay is True
    assert failed is not None and failed.success is False
    assert failed.status == "failed"
    assert failed.transaction_id == "TXN-OLD"
    assert conflict is not None and conflict.success is False
    assert conflict.status == "failed"


def test_credit_debit_and_transfer_all_use_canonical_idempotency_replay_guard():
    for operation in (
        canonical_wallet.credit_canonical_balance,
        canonical_wallet.debit_canonical_balance,
        canonical_wallet.transfer_canonical_balance,
    ):
        source = inspect.getsource(operation)
        assert "replay = _existing_idempotency_result(claim_state, existing)" in source
        assert "if replay is not None:" in source
        assert "return replay" in source


def test_bidblitz_pay_access_requires_owner_or_admin():
    payment = {
        "customer_email": "customer@example.com",
        "created_by_user_id": "creator-1",
        "created_by_email": "creator@example.com",
    }
    assert bidblitz_pay_routes._payment_access_allowed(payment, {"_id": "admin-1", "email": "x@example.com", "role": "admin"}) is True
    assert bidblitz_pay_routes._payment_access_allowed(payment, {"_id": "customer-1", "email": "CUSTOMER@example.com", "role": "user"}) is True
    assert bidblitz_pay_routes._payment_access_allowed(payment, {"_id": "creator-1", "email": "other@example.com", "role": "user"}) is True
    assert bidblitz_pay_routes._payment_access_allowed(payment, {"_id": "stranger", "email": "stranger@example.com", "role": "user"}) is False
    assert bidblitz_pay_routes._payment_access_allowed({}, {"_id": "stranger", "email": "stranger@example.com", "role": "user"}) is False


def test_bidblitz_pay_webhook_url_requires_trusted_https_target():
    merchant = {"_id": "merchant-1", "email": "merchant@example.com", "role": "merchant"}
    with pytest.raises(HTTPException) as anonymous_error:
        bidblitz_pay_routes._validate_merchant_webhook_url("https://merchant.example/webhook", None)
    assert anonymous_error.value.status_code == 403

    with pytest.raises(HTTPException) as insecure_error:
        bidblitz_pay_routes._validate_merchant_webhook_url("http://merchant.example/webhook", merchant)
    assert insecure_error.value.status_code == 400

    with pytest.raises(HTTPException) as local_error:
        bidblitz_pay_routes._validate_merchant_webhook_url("https://127.0.0.1/webhook", merchant)
    assert local_error.value.status_code == 400

    bidblitz_pay_routes._validate_merchant_webhook_url("https://merchant.example/webhook", merchant)


def test_bidblitz_pay_sensitive_routes_require_auth_and_ownership():
    for operation in (
        bidblitz_pay_routes.get_bidblitz_pay_payment,
        bidblitz_pay_routes.confirm_bidblitz_pay_mock,
        bidblitz_pay_routes.cancel_bidblitz_pay,
        bidblitz_pay_routes.create_bidblitz_pay_refund,
    ):
        source = inspect.getsource(operation)
        assert "await get_current_user(request)" in source
        assert "_require_payment_access(payment, user)" in source


def test_bidblitz_pay_hosted_checkout_separates_mock_and_live_actions():
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BidBlitzPayHostedCheckoutPage.jsx").read_text(encoding="utf-8")

    assert "payment.test_mode ? (" in page
    assert 'data-testid="bidblitz-pay-wallet-approve-button"' in page
    assert 'data-testid="bidblitz-pay-provider-button"' in page
    assert 'data-testid="bidblitz-pay-provider-unavailable"' in page
    assert 'data-testid="bidblitz-pay-cancel-button"' in page
    assert 'Live-Zahlung sicher beim verbundenen Provider fortsetzen.' in page
    assert 'Freigabe, Abbruch und Erstattung werden nur über verifizierte Provider-Aktionen ausgeführt.' in page


def test_bidblitz_pay_live_cancel_and_refund_fail_closed_before_local_mutation():
    cancel_source = inspect.getsource(bidblitz_pay_routes.cancel_bidblitz_pay)
    refund_source = inspect.getsource(bidblitz_pay_routes.create_bidblitz_pay_refund)

    cancel_live_guard = cancel_source.index('if payment.get("mode") == "live":')
    cancel_local_update = cancel_source.index("updated = await _mark_payment_status")
    assert cancel_live_guard < cancel_local_update
    assert "live_cancel_blocked_no_provider_api" in cancel_source
    assert "status_code=501" in cancel_source

    refund_live_guard = refund_source.index('if payment.get("mode") == "live":')
    refund_reservation = refund_source.index("reservation = await _reserve_mock_refund")
    refund_insert = refund_source.index("await db.bidblitz_pay_refunds.insert_one")
    refund_status_sync = refund_source.index("updated = await _sync_mock_refund_status")
    assert refund_live_guard < refund_reservation
    assert refund_live_guard < refund_insert
    assert refund_live_guard < refund_status_sync
    assert "live_refund_blocked_no_provider_api" in refund_source
    assert "status_code=501" in refund_source


def _stripe_source():
    return STRIPE_ROUTE_PATH.read_text(encoding="utf-8")


def test_apple_google_pay_wallet_topup_is_eur_only_and_metadata_safe():
    source = (BACKEND_DIR / "routes" / "apple_google_pay.py").read_text(encoding="utf-8")

    assert 'from core.config import STRIPE_API_KEY' in source
    assert 'stripe.api_key = STRIPE_API_KEY' in source
    assert 'currency: str = Field(default="eur", pattern="^eur$")' in source
    assert 'protected_metadata_keys = {"user_id", "user_email", "kind"}' in source
    assert 'if key not in protected_metadata_keys' in source
    assert '"user_id": user_id' in source
    assert '"user_email": user_email' in source
    assert '"kind": "wallet_topup_pay"' in source
    assert 'currency="eur"' in source
    assert 'if currency != "eur":' in source
    assert 'Unsupported settlement currency for EUR wallet' in source


def test_apple_google_pay_frontend_reports_final_eur_status():
    source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "AppleGooglePayButton.jsx").read_text(encoding="utf-8")

    assert "const currency = 'eur';" in source
    assert "paymentIntent: finalPaymentIntent" in source
    assert "finalPaymentIntent?.status === 'succeeded'" in source
    assert "onSuccess?.(finalPaymentIntent)" in source
    assert "Unerwarteter Zahlungsstatus" in source


def test_stripe_topup_plans_match_checkout_packages():
    source = _stripe_source()
    assert 'for package_id, amount in sorted(TOPUP_PACKAGES.items()' in source
    assert '"package_id": package_id' in source
    for package_id in ["10", "25", "50", "100", "250", "500"]:
        assert f'"{package_id}":' in source
    assert '"200":' not in source.split("TOPUP_PACKAGES = {", 1)[1].split("}", 1)[0]


def test_stripe_registers_only_one_wallet_webhook_route():
    source = _stripe_source()
    assert source.count('@router.post("/webhook")') == 1


def test_stripe_paid_poll_does_not_precomplete_before_wallet_credit():
    source = _stripe_source()
    checkout_block = source.split("async def checkout_status", 1)[1].split("# ── Webhook ──", 1)[0]
    assert 'new_status = "completed" if stripe_status.payment_status == "paid"' not in checkout_block
    assert 'if stripe_status.payment_status != "paid"' in checkout_block
    assert "settle_stripe_wallet_topup(" in checkout_block
    assert '"$inc": {"balance": payment["amount"]}' not in checkout_block


def test_stripe_webhook_processing_failures_return_retryable_error():
    source = _stripe_source()
    assert 'raise HTTPException(status_code=500, detail="Webhook processing failed")' in source


def test_stripe_known_domain_settlements_are_not_silently_acked():
    source = _stripe_source()
    webhook_block = source.split("async def stripe_webhook", 1)[1].split("# ── Get available packages ──", 1)[0]

    assert "payment_tx = await db.payment_transactions.find_one" in webhook_block
    assert "Dating Stripe settlement incomplete" in webhook_block
    assert "Pool ticket Stripe settlement incomplete" in webhook_block
    assert "POS feature Stripe settlement incomplete" in webhook_block
    assert "dating_settled = await handle_dating_premium_webhook(event.session_id)" in webhook_block
    assert "pool_ticket = await handle_pool_ticket_webhook(event.session_id)" in webhook_block
    assert "feature_activated = await activate_feature_after_payment(event.session_id)" in webhook_block


def test_stripe_webhook_isolates_wallet_topups_and_recovers_safely():
    source = _stripe_source()
    webhook_block = source.split("async def stripe_webhook", 1)[1].split("# ── Get available packages ──", 1)[0]
    assert '"type": "wallet_topup"' in webhook_block
    assert "wallet_payment = await db.payment_transactions.find_one" in webhook_block
    assert "await settle_stripe_wallet_topup(event.session_id)" in webhook_block
    assert "WalletSettlementNeedsReview" in webhook_block
    assert '"$inc": {"balance": result["amount"]}' not in webhook_block


def test_quick_topup_compliance_uses_authenticated_user_id():
    source = _stripe_source()
    quick_topup = source.split('async def quick_topup', 1)[1].split('@router.delete("/saved-method")', 1)[0]
    assert 'user_id = str(user["_id"])' in quick_topup
    assert 'run_compliance_check(user_id, "topup", amount)' in quick_topup
    assert 'run_compliance_check(user, "topup", amount)' not in quick_topup


def test_mobile_stripe_never_initializes_with_placeholder_key():
    stripe_config = (BACKEND_DIR.parent / "mobile" / "src" / "config" / "stripe.js").read_text(encoding="utf-8")
    mobile_app = (BACKEND_DIR.parent / "mobile" / "src" / "App.js").read_text(encoding="utf-8")

    assert "pk_live_51QUYF218nRp2RQgs..." not in stripe_config
    assert "STRIPE_NATIVE_ENABLED" in stripe_config
    assert "STRIPE_NATIVE_ENABLED" in mobile_app
    assert "{STRIPE_NATIVE_ENABLED ? (" in mobile_app
    assert "<StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>" in mobile_app


def test_taxi_customer_driver_wallet_flow_stays_unified():
    taxi_source = (BACKEND_DIR / "routes" / "taxi.py").read_text(encoding="utf-8")
    taxi_model_source = (BACKEND_DIR / "models" / "taxi.py").read_text(encoding="utf-8")
    driver_source = (BACKEND_DIR / "routes" / "driver_dashboard.py").read_text(encoding="utf-8")
    taxi_api_source = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "taxiApi.js").read_text(encoding="utf-8")
    taxi_page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "TaxiPage.jsx").read_text(encoding="utf-8")
    driver_page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "DriverDashboardPage.jsx").read_text(encoding="utf-8")

    assert "async def _pending_customer_rides" in driver_source
    assert "requests = await _pending_customer_rides(driver" in driver_source
    assert '"ride_id": request_id' in driver_source
    assert "return await driver_accept_ride(RideActionRequest(ride_id=request_id), request)" in driver_source
    assert '"driver_id": None' in taxi_source
    assert "from routes.taxi import driver_arriving, driver_start_ride, driver_end_ride, cancel_ride" in driver_source
    assert "result = await driver_end_ride(action, request)" in driver_source

    assert 'if not NumberErrorSafe(p_lat, p_lng) or not NumberErrorSafe(d_lat, d_lng):' in taxi_source
    assert 'if not p_lat or not d_lat:' not in taxi_source
    assert 'if NumberErrorSafe(pickup.get("lat"), pickup.get("lng")):' in taxi_source
    assert 'NumberErrorSafe(start_loc.get("lat"), start_loc.get("lng"))' in taxi_source
    assert 'NumberErrorSafe(end_loc.get("lat"), end_loc.get("lng"))' in taxi_source
    assert 'NumberErrorSafe(loc.get("lat"), loc.get("lng"))' in taxi_source
    assert '"payment_status": "reserved"' in taxi_source
    assert '"payment_reserved_amount": round(fare_total, 2)' in taxi_source
    assert 'payment_source = "reserved_at_booking"' in taxi_source
    assert 'pricing_source = "locked_booking_quote"' in taxi_source
    assert "fare_estimate = apply_multi_tariff" in taxi_source
    assert "claim.modified_count != 1" in taxi_source
    assert "idempotency_key: Optional[str]" in taxi_model_source
    assert "amount = round(float(req.tip_amount), 2)" in taxi_source
    assert "transfer_between_wallets(" in taxi_source
    assert "idempotency_key=idem_key" in taxi_source
    assert '"tip_status": "reserved"' in taxi_source
    assert '"tip_status": "completed"' in taxi_source
    assert '{"$inc": {"balance": req.amount, "earnings": req.amount}}' not in taxi_source

    assert "/api/taxi/rides/${rideId}" in taxi_api_source
    assert "/api/taxi/ride/${rideId}" not in taxi_api_source
    assert "Math.max(mapDrivers.length, 1)" not in taxi_page_source
    assert "UberX" not in taxi_page_source
    assert "() => setLocation({ lat: 52.52, lng: 13.405 })" not in driver_page_source


def test_p2p_money_sends_require_kyc_and_idempotency():
    transfer_source = (BACKEND_DIR / "routes" / "p2p_transfer.py").read_text(encoding="utf-8")
    handle_source = (BACKEND_DIR / "routes" / "p2p.py").read_text(encoding="utf-8")
    send_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "SendMoneyPage.jsx").read_text(encoding="utf-8")
    handle_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "P2PPage.jsx").read_text(encoding="utf-8")

    assert "_ensure_wallet_write_allowed(user)" in transfer_source
    assert "_require_idempotency_key(req.idempotency_key, request)" in transfer_source
    assert "idempotency_key=client_idempotency_key" in transfer_source
    assert "Nearby-Empfang ist in Production deaktiviert" in transfer_source
    assert "Nearby-Nutzer sind in Production deaktiviert" in transfer_source

    assert "_ensure_wallet_write_allowed(user)" in handle_source
    assert "_require_idempotency_key(req.idempotency_key, request)" in handle_source
    assert "idempotency_key=idempotency_key" in handle_source

    assert '"Idempotency-Key": idempotencyKey' in send_page
    assert "idempotency_key: idempotencyKey" in send_page
    assert "'Idempotency-Key': idempotencyKey" in handle_page
    assert "idempotency_key: idempotencyKey" in handle_page


def test_pos_payments_fail_closed_and_retry_safely():
    pos_source = (BACKEND_DIR / "routes" / "pos_system.py").read_text(encoding="utf-8")
    legacy_source = (BACKEND_DIR / "routes" / "pos_payments.py").read_text(encoding="utf-8")
    pos_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MerchantPosSimplePage.jsx").read_text(encoding="utf-8")

    assert 'POS_EXTERNAL_CARD_CERTIFIED' in pos_source
    assert 'from core.config import TEST_MODE' in pos_source
    assert 'if not TEST_MODE:' in pos_source
    assert 'Externe Kartenzahlung bleibt in Production deaktiviert' in pos_source
    assert 'Verifizierte Provider-Referenz erforderlich' in pos_source
    assert 'debit_state in {"pending", "reconciliation_required"}' in pos_source
    assert 'credit_state in {"pending", "reconciliation_required"}' in pos_source
    assert 'keine automatische Rückbuchung wird ausgeführt' in pos_source
    assert 'status_code=503 if rollback_state in {"pending", "reconciliation_required"} else 500' in pos_source
    assert 'idempotency_key=f"pos-rollback:{payment[\'payment_id\']}"' in pos_source
    assert 'PAYMENT_STATUS_RECONCILIATION = "reconciliation_required"' in pos_source
    assert "async def _claim_pos_payment_intent" in pos_source
    assert 'intent_id = f"cart:{cart_id}"' in pos_source
    assert "db.pos_payment_intents.insert_one" in pos_source
    assert '{"_id": intent_id, "version": version}' in pos_source
    assert "POS-Zahlungsversuch wird bereits erstellt" in pos_source
    assert "POS-Zahlung benötigt Abstimmung; keine neue Zahlung wird erzeugt." in pos_source
    assert "await _set_pos_payment_intent_status" in pos_source

    assert "def deterministic_payment_reference" in legacy_source
    assert '"reference": reference' in legacy_source
    assert '"$setOnInsert": merchant_tx' in legacy_source
    assert "Aktives Händlerprofil erforderlich" in legacy_source
    assert "Externe Karten-/NFC-Zahlung ist in diesem Endpoint nicht provider-verifiziert" in legacy_source

    assert 'const correctlyWired = !["voucher", "invoice"].includes(key);' in pos_page
    assert 'key !== "tap_to_pay" && (key !== "card" || externalCardCertified)' in pos_page
    assert 'body.card_reference = `CARD-' not in pos_page
    assert 'bidblitz:merchant-pos-cart:' in pos_page
    assert 'window.localStorage.getItem(posCartRecoveryKey)' in pos_page
    assert 'initialCartRecovery?.cart || []' in pos_page
    assert 'initialCartRecovery?.cartSession || null' in pos_page
    assert 'window.localStorage.setItem(' in pos_page
    assert 'window.localStorage.removeItem(posCartRecoveryKey)' in pos_page


def test_customer_and_merchant_barcode_payment_flow_is_canonical():
    pos_source = (BACKEND_DIR / "routes" / "pos_payments.py").read_text(encoding="utf-8")
    api_source = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")
    payment_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "PaymentPage.jsx").read_text(encoding="utf-8")
    barcode_modal = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "BarcodeModal.jsx").read_text(encoding="utf-8")
    terminal_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MerchantTerminalPage.jsx").read_text(encoding="utf-8")

    assert 'getMyBarcode: () => request("/api/payments/my-barcode")' in api_source
    assert 'refreshBarcode: () => request("/api/payments/refresh-barcode"' in api_source
    assert 'barcodeLookup: (barcode) => request("/api/payments/barcode-lookup"' in api_source
    assert 'barcodePayment: (body) => request("/api/payments/barcode-pay"' in api_source

    assert '"seconds_remaining": seconds_remaining' in pos_source
    assert '"expires_in": seconds_remaining' in pos_source
    assert '"rotation_seconds": BARCODE_VALIDITY_SECONDS' in pos_source
    assert '"name": user.get("name", "")' in pos_source
    assert 'round(float(user.get("balance", 0) or 0), 2)' in pos_source

    assert 'setSecondsLeft(res.seconds_remaining ?? res.expires_in ?? 0)' in payment_page
    assert 'const L = paymentCopy[locale] || paymentCopy.de;' in payment_page
    assert 'data-testid="payment-error"' in payment_page
    assert 'Stripe Checkout hat keine Zahlungs-URL zurückgegeben.' in payment_page
    assert 'api.getMyBarcode()' in barcode_modal

    assert 'data-testid="nfc-card-btn"' in terminal_page
    assert 'Provider-Anbindung ausstehend' in terminal_page
    assert 'onClick={() => processNfcPayment("nfc_card")}' not in terminal_page
    assert 'Gebühr laut Händler-Tarif' in terminal_page


def test_merchant_payout_balance_and_state_machine_contracts():
    settlement_source = (BACKEND_DIR / "services" / "merchant_settlement.py").read_text(encoding="utf-8")
    admin_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AdminMerchantSettlementsPage.jsx").read_text(encoding="utf-8")

    assert 'available_minor -= amount_minor' in settlement_source
    assert 'PAYOUT_ACTIVE_STATUSES = {"created", "pending_approval", "processing", "reconciliation_required"}' in settlement_source
    assert '"pending_approval": {"processing", "cancelled"}' in settlement_source
    assert '"processing": {"paid", "failed", "cancelled"}' in settlement_source
    assert '"paid": {"returned"}' in settlement_source
    assert 'existing_return = await db.merchant_balance_entries.find_one' in settlement_source
    assert '"type": "payout_return"' in settlement_source
    assert '"payout_lock": lock_token' in settlement_source
    assert 'status == "paid" and len(clean_provider_reference) < 6' in settlement_source
    assert 'updates["provider_reference"] = clean_provider_reference' in settlement_source

    payout_routes = (BACKEND_DIR / "routes" / "merchant_settlements.py").read_text(encoding="utf-8")
    payout_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MerchantPayoutsPage.jsx").read_text(encoding="utf-8")
    assert "def _merchant_payout_capability" in payout_routes
    assert 'user.get("kyc_status") != "approved"' in payout_routes
    assert 'merchant.get("status") != "approved"' in payout_routes
    assert 'merchant.get("payout_destination_verified")' in payout_routes
    assert 'idempotency_key: str = Field(..., min_length=8' in payout_routes
    assert 'destination_type=capability["destination_type"]' in payout_routes
    assert 'destination_reference_masked=capability["destination_reference_masked"]' in payout_routes

    assert '"DE••••••1234"' not in payout_page
    assert "payoutAttemptKeyRef" in payout_page
    assert "balance.payout_ready" in payout_page
    assert "idempotency_key: payoutAttemptKeyRef.current" in payout_page

    assert 'payout.status === "pending_approval"' in admin_page
    assert 'payout.status === "processing"' in admin_page
    assert 'payout.status === "paid"' in admin_page
    assert "Bank-/Providerreferenz" in admin_page
    assert 'provider_reference: action === "paid"' in admin_page
    assert 'onAction(payout.payout_id, "returned")' in admin_page


def test_auction_financial_flows_are_idempotent_and_race_safe():
    auctions_source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionsPage.jsx").read_text(encoding="utf-8")
    detail_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "AuctionDetail.jsx").read_text(encoding="utf-8")
    grid_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "AuctionGridCard.jsx").read_text(encoding="utf-8")
    admin_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionAdminPage.jsx").read_text(encoding="utf-8")
    credits_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "BuyCreditsModal.jsx").read_text(encoding="utf-8")

    assert "def _require_auction_idempotency_key" in auctions_source
    assert "async def _grant_bid_credits_once" in auctions_source
    assert "async def _reserve_bid_credit_once" in auctions_source
    assert "async def _refund_reserved_bid_credit" in auctions_source
    assert 'result_field = f"bid_operation_results.{op_hash}"' in auctions_source
    assert '"current_price": snapshot.get("current_price")' in auctions_source
    assert '"$inc": {"total_bids": 1}' in auctions_source
    assert "Gebot konnte wegen gleichzeitiger Gebote nicht sicher gesetzt werden. Credit wurde zurückgegeben." in auctions_source

    assert "idempotency_key=idempotency_key" in auctions_source
    assert "Stripe-Zahlung ist noch nicht verifiziert" in auctions_source
    assert 'payment_status": "credited"' in auctions_source
    assert "auction_first_purchase_bonus_awarded" in auctions_source

    assert "idempotency_key: idempotencyKey" in credits_source
    assert "purchaseAttemptRef" in credits_source
    assert "window.sessionStorage.getItem(attemptStorageKey)" in credits_source
    assert "window.sessionStorage.setItem(attemptStorageKey, purchaseAttemptRef.current.key)" in credits_source
    assert "window.sessionStorage.removeItem(attemptStorageKey)" in credits_source
    assert 'if (payMethod === "wallet" && balance < selectedPkg.price)' in credits_source
    assert "const terminal = [400, 403, 404].includes" in credits_source
    assert "idempotency_key: idempotencyKey" in detail_source
    assert "window.sessionStorage.getItem(bidStorageKey)" in detail_source
    assert "window.sessionStorage.setItem(bidStorageKey, bidAttemptKeyRef.current)" in detail_source
    assert "window.sessionStorage.removeItem(bidStorageKey)" in detail_source
    assert "Auto-Bid konnte nicht beendet werden." in detail_source
    assert "Watchlist konnte nicht geändert werden." in page_source
    assert "handleQuickBid" in page_source
    assert 'window.sessionStorage.setItem(storageKey, idempotencyKey)' in page_source
    assert 'window.sessionStorage.removeItem(storageKey)' in page_source
    assert 'data-testid="auction-premium-hero"' in page_source
    assert 'auction-premium-quick-bid-' in page_source
    assert 'data-testid={`auction-quick-bid-${auction.auction_id}`}' in (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "AuctionGridCard.jsx").read_text(encoding="utf-8")
    assert 'auction_increment = max(0.01' in auctions_source
    assert 'snapshot.get("price_increment") or PRICE_INCREMENT' in auctions_source
    assert "bid_value_eur: Optional[float]" in auctions_source
    assert "revenue_target_eur: Optional[float]" in auctions_source
    assert "product_cost_eur: Optional[float]" in auctions_source
    assert "shipping_cost_eur: Optional[float]" in auctions_source
    assert "other_costs_eur: Optional[float]" in auctions_source
    assert "target_net_profit_eur: Optional[float]" in auctions_source
    assert '"price_increment": round(float(req.price_increment), 2)' in auctions_source
    assert '"bid_value_eur": round(float(req.bid_value_eur), 2)' in auctions_source
    assert '"revenue_target_eur": round(float(req.revenue_target_eur), 2)' in auctions_source
    assert '"product_cost_eur": round(float(req.product_cost_eur), 2)' in auctions_source
    assert '"target_net_profit_eur": round(float(req.target_net_profit_eur), 2)' in auctions_source
    assert 'updates["featured"] = bool(req.featured)' in auctions_source
    assert "PUBLIC_AUCTION_PRIVATE_FIELDS" in auctions_source
    assert "def _public_auction_view(auction: dict) -> dict:" in auctions_source
    for private_field in [
        "revenue_target_eur",
        "product_cost_eur",
        "shipping_cost_eur",
        "other_costs_eur",
        "target_net_profit_eur",
        "real_bid_revenue_eur",
        "bid_operation_results",
    ]:
        assert f'"{private_field}"' in auctions_source
    assert auctions_source.count("auctions = [_public_auction_view(a) for a in auctions]") >= 3
    assert "auction = _public_auction_view(auction)" in auctions_source
    assert "+20s" in detail_source
    assert "+10s" not in detail_source
    assert "def _profit_guard_snapshot" in auctions_source
    assert "PROFIT_GUARD_EXTENSION_SECONDS = 600" in auctions_source
    assert '"real_paid_bids": guard["real_paid_bids"]' in auctions_source
    assert '"profit_guard_status": "target_not_met"' in auctions_source
    assert '"minimum_target_reached": True' in auctions_source
    assert auctions_source.count('"starting_price": 0.01') >= 3
    assert auctions_source.count('"current_price": 0.01') >= 3
    assert '"minimum_target_active"' in auctions_source
    assert "auction-profit-guard-summary" in admin_source
    assert "Nur echte bezahlte Kundengebote zählen." in admin_source
    assert "Noch benötigt" in admin_source
    assert "Mindestziel noch nicht erreicht" in grid_source
    assert "Mindestziel noch nicht erreicht" in detail_source
    assert "def _credit_bucket_cents" in auctions_source
    assert "def _known_credit_bucket_cents" in auctions_source
    assert "def _minimum_paid_credit_value_eur" in auctions_source
    assert "bid_credit_value_buckets.c0" in auctions_source
    assert "cash_value_eur=price" in auctions_source
    assert "def _credit_cash_value_for_operation" in auctions_source
    assert '"v": credit_cash_value' in auctions_source
    assert '"real_bid_revenue_eur": credit_cash_value' in auctions_source
    assert '"real_bid_revenue_eur": 0.0' in auctions_source
    assert "Gratis-/Bonus-Credits zählen als 0,00 €" in admin_source
    assert "günstigstem bezahlten Credit €0,25" in admin_source


def test_auction_credit_checkout_cancel_and_error_states_are_visible():
    auctions_source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionsPage.jsx").read_text(encoding="utf-8")

    assert "except HTTPException:" in auctions_source
    assert "raise" in auctions_source.split("except HTTPException:", 1)[1].split("except Exception as e:", 1)[0]

    assert "if (!purchaseId) return;" in page_source
    assert 'if (status === "cancel") {' in page_source
    assert 'if (status !== "success" || !sessionId) return;' in page_source
    assert "[400, 401, 403, 404, 409, 500, 503].includes(r.status)" in page_source
    assert "Zahlungsstatus konnte nicht bestätigt werden." in page_source


def test_auction_auto_bid_requires_kyc_and_atomic_credit_reservation():
    auctions_source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    detail_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "AuctionDetail.jsx").read_text(encoding="utf-8")

    assert "Bitte verifiziere zuerst deinen Ausweis, um Auto-Bid zu aktivieren." in auctions_source
    assert 'disabled_reason": "kyc_required"' in auctions_source
    assert "credit_state = await _reserve_bid_credit_once" in auctions_source
    assert "processing_until" in auctions_source
    assert "processing_slot" in auctions_source

    assert 'const kycRequired = !isGuest && !KYC_DISABLED' in detail_source
    assert 'if (kycRequired) { onNavigate?.("/profile/kyc"); return; }' in detail_source
    assert 'disabled={bidding}' in detail_source
    assert 'Identität verifizieren' in detail_source
    assert 'Verifizieren für Auto-Bid' in detail_source
    assert 'disabled={kycRequired}' not in detail_source


def test_scooter_rides_subscriptions_and_location_are_financially_safe():
    scooter_source = (BACKEND_DIR / "routes" / "scooter.py").read_text(encoding="utf-8")
    scooter_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ScooterPage.jsx").read_text(encoding="utf-8")

    assert "async def _settle_outstanding_scooter_debts" in scooter_source
    assert '{"user_id": user_id, "settlement_reconciliation_required": True}' in scooter_source
    assert 'idempotency_key=f"scooter-end:{ride_id}"' in scooter_source
    assert '"payment_status": "paid_reconciled"' in scooter_source
    assert '"settlement_reconciliation_required": False' in scooter_source
    assert '"status": "unlocking"' in scooter_source
    assert '"unlock_claim_key": claim_hash' in scooter_source
    assert 'payment_status in {"pending", "reconciliation_required"}' in scooter_source
    assert '"unlock_payment_reconciliation_required": True' in scooter_source
    assert '"unlock_payment_transaction_id": payment_result.transaction_id' in scooter_source
    assert "Scooter-Zahlung ist unklar und muss vor einem neuen Versuch abgestimmt werden." in scooter_source
    assert "idempotency_key=idempotency_key" in scooter_source
    assert 'idempotency_key=f"scooter-end:{ride_id}"' in scooter_source
    assert 'db.scooter_payment_due.update_one' in scooter_source
    assert '"payment_status": "due"' in scooter_source or 'payment_status = "due"' in scooter_source

    assert "async def _get_active_scooter_subscription" in scooter_source
    assert '"free_minutes_remaining_at_start"' in scooter_source
    assert '"subscription_id": (subscription or {}).get("sub_id")' in scooter_source
    assert "TransactionType.SUBSCRIPTION" in scooter_source
    assert 'claimed_sub_id not in (None, "", sub_id)' in scooter_source
    assert 'claimed_subscription = await db.scooter_subscriptions.find_one(' in scooter_source
    assert 'claimed_subscription.get("status") != "active"' in scooter_source
    assert 'str(claimed_subscription.get("expires_at") or "") <= now.isoformat()' in scooter_source
    assert 'if stale_claim:' in scooter_source
    assert 'payment_status in {"pending", "reconciliation_required"}' in scooter_source
    assert "Scooter-Abo-Zahlung benötigt Abstimmung; keine erneute Belastung wird ausgeführt" in scooter_source
    assert '"scooter_subscription_payment_status": "completed"' in scooter_source

    assert "subscriptionAttemptRef" in scooter_page
    assert "readScooterUnlockAttempt" in scooter_page
    assert "persistScooterUnlockAttempt" in scooter_page
    assert "bidblitz:scooter-unlock-attempt:" in scooter_page
    assert "persistScooterUnlockAttempt(unlockAttemptOwnerId, null)" in scooter_page
    assert "window.sessionStorage.getItem(attemptStorageKey)" in scooter_page
    assert "window.sessionStorage.setItem(attemptStorageKey, subscriptionAttemptRef.current.key)" in scooter_page
    assert "window.sessionStorage.removeItem(attemptStorageKey)" in scooter_page
    assert "Netzwerkfehler beim Abo-Abschluss. Der sichere Wiederholungsversuch bleibt erhalten." in scooter_page
    assert "Abo konnte nicht gekündigt werden." in scooter_page
    assert "Netzwerkfehler beim Kündigen des Abos." in scooter_page
    assert "[400, 403, 404].includes(res.status)" in scooter_page
    assert "Math.random() - 0.5" not in scooter_page
    assert "52.52, lng: 13.405" not in scooter_page
    assert "'Idempotency-Key': idempotencyKey" in scooter_page
    assert "data.rentals || data.rides || []" in scooter_page
    assert "activeRental.free_minutes_remaining_at_start" in scooter_page
    assert '{"reservation_id": res["reservation_id"], "user_id": user_id, "status": "active"}' in scooter_source
    assert '"status": "reserved"' in scooter_source
    assert '"reserved_by": user_id' in scooter_source
    assert '{"current_ride_id": {"$exists": False}}' in scooter_source
    assert '"released": released.modified_count == 1' in scooter_source
    assert 'canonical_id = f"ride:{req.ride_id}"' in scooter_source
    assert 'share_id = f"SHR-{hashlib.sha256(req.ride_id.encode(\'utf-8\')).hexdigest()[:16].upper()}"' in scooter_source
    assert '"status": "superseded"' in scooter_source
    assert 'share_fields = {key: value for key, value in share.items() if key != "_id"}' in scooter_source
    assert '{"_id": canonical_id, "status": {"$ne": "active"}}' in scooter_source
    assert "Share-Code konnte nicht atomar erstellt werden" in scooter_source


def test_mobility_payments_refunds_and_payouts_are_exactly_once():
    source = (BACKEND_DIR / "routes" / "mobility_payments.py").read_text(encoding="utf-8")
    database_source = (BACKEND_DIR / "core" / "database.py").read_text(encoding="utf-8")

    assert "async def _credit_platform_revenue_once" in source
    assert '"processed_payment_ids": [payment_id]' in source
    assert '"$addToSet": {"processed_payment_ids": payment_id}' in source
    assert "wallet_idempotency_key" in source
    assert '"status": "processing"' in source
    assert '"status": "completed"' in source

    assert "async def credit_earning" in source
    assert 'marker_field = f"mobility_earning_markers.{digest}"' in source
    assert '"$setOnInsert": earning_record' in source

    assert "await credit_wallet(" in source
    assert 'refund_key = f"mobility-refund:{payment_id}"' in source
    assert "PAYOUT_RESERVED_STATUSES" in source
    assert "mobility_payout_lock" in source
    assert 'if payout.get("status") != "approved"' in source
    assert "Bank-/Provider-Referenz erforderlich" in source

    assert 'db.mobility_payments, "payment_id", unique=True, critical=True' in database_source
    assert 'db.mobility_earnings, "earning_id", unique=True, critical=True' in database_source


def test_kids_wallet_payments_parental_controls_and_sessions_are_safe():
    kids_source = (BACKEND_DIR / "routes" / "kids.py").read_text(encoding="utf-8")
    kids_app_source = (BACKEND_DIR / "routes" / "kids_app.py").read_text(encoding="utf-8")
    gps_source = (BACKEND_DIR / "routes" / "kids_gps.py").read_text(encoding="utf-8")
    legacy_source = (BACKEND_DIR / "routes" / "kids_system.py").read_text(encoding="utf-8")
    database_source = (BACKEND_DIR / "core" / "database.py").read_text(encoding="utf-8")
    child_mode = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ChildModePage.jsx").read_text(encoding="utf-8")
    wallet_modal = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "ChildWalletModal.jsx").read_text(encoding="utf-8")

    assert "def _kids_pin_hash" in kids_source
    assert "hashlib.pbkdf2_hmac" in kids_source
    assert "kids_login_attempts" in kids_source
    assert "async def _wallet_spend_allowed" in kids_source
    assert "async def _process_child_wallet_payment" in kids_source
    assert "payment_lock" in kids_source
    assert "kids-merchant-credit:" in kids_source
    assert "Gültiger Händler erforderlich" in kids_source
    assert "idempotency_key=idempotency_key" in kids_source
    assert 'reward_marker = f"task_reward_markers.{marker_hash}"' in kids_source
    assert '"completion_state": "processing"' in kids_source
    assert '"completion_state": "reconciliation_required"' in kids_source
    assert 'tx_id = f"KTX-TASK-{marker_hash}"' in kids_source
    assert '"$setOnInsert": {' in kids_source
    assert '"replayed": True' in kids_source

    assert "async def _require_child_access" in kids_app_source
    assert "reward_currency" in kids_app_source
    assert "BLZ_POINTS" in kids_app_source
    assert '"$inc": {"balance": reward}' not in kids_app_source

    assert "Kein Zugriff auf dieses Kind" in gps_source
    assert "if not TEST_MODE:" in gps_source
    assert '@router.post("/legacy/child-login")' in legacy_source
    assert '@router.post("/child-login")' not in legacy_source

    assert 'db.kids_transactions, "id", unique=True' in database_source
    assert 'db.kids_subscriptions, "user_id", unique=True' in database_source
    assert 'db.kids_sessions, "token", unique=True' in database_source

    assert "'Idempotency-Key': idempotencyKey" in child_mode
    assert "merchant_id: merchantId" in child_mode
    assert "daily_limit: Number(dailyLimit)" in wallet_modal
    assert "weekly_limit: Number(weeklyLimit)" in wallet_modal
    assert "daily_screen_limit" not in wallet_modal


def test_kids_child_identity_gps_quiz_and_rewards_are_server_enforced():
    kids_source = (BACKEND_DIR / "routes" / "kids.py").read_text(encoding="utf-8")
    app_source = (BACKEND_DIR / "routes" / "kids_app.py").read_text(encoding="utf-8")
    gps_source = (BACKEND_DIR / "routes" / "kids_gps.py").read_text(encoding="utf-8")
    legacy_source = (BACKEND_DIR / "routes" / "kids_system.py").read_text(encoding="utf-8")
    app_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "KidsAppPage.jsx").read_text(encoding="utf-8")

    assert "async def get_child_from_token" in kids_source
    assert "_process_child_wallet_payment" in kids_source
    assert "payment_lock" in kids_source

    assert "linked_child_user_id" in gps_source
    assert "Kein Zugriff auf dieses Kind" in gps_source

    assert "async def _require_child_access" in app_source
    assert "kids_quiz_sessions" in app_source
    assert "answer_map" in app_source
    assert "reward_currency" in app_source
    assert "BLZ_POINTS" in app_source

    assert "X-Child-ID" not in legacy_source
    assert "bidblitz-kids-secret-2026" not in legacy_source
    assert "canonical_child_login" in legacy_source
    assert "get_child_from_token" in legacy_source
    assert 'idempotency_key=f"kids-task-reward:{task_id}"' in legacy_source

    assert "quiz_id: quizId" in app_page
    assert "answers: nextAnswers" in app_page
    assert ".answer ===" not in app_page
    assert "BLZ-Punkte verdient" in app_page


def test_auth_admin_alias_2fa_ws_and_role_changes_are_session_safe():
    auth_source = (BACKEND_DIR / "routes" / "auth.py").read_text(encoding="utf-8")
    admin_source = (BACKEND_DIR / "routes" / "admin.py").read_text(encoding="utf-8")
    admin_management = (BACKEND_DIR / "routes" / "admin_management.py").read_text(encoding="utf-8")

    assert "Never cross-map ordinary user addresses" in auth_source
    assert 'if email == "admin@bidblitz.ae" or canonical == "admin@bidblitz.ae"' in auth_source
    assert '(user.get("role") == "admin") or email == "admin@bidblitz.ae"' not in auth_source

    assert "def _hash_pending_2fa_token" in auth_source
    assert '"token_hash": _hash_pending_2fa_token(pending_token)' in auth_source
    pending_start = auth_source.index("await db.pending_2fa.insert_one")
    pending_end = auth_source.index('if method == "totp":', pending_start)
    pending_insert = auth_source[pending_start:pending_end]
    assert '"token": pending_token' not in pending_insert
    assert '"token_hash": _hash_pending_2fa_token(pending_token)' in pending_insert
    assert '"session_id": session_id' in auth_source
    assert "Sessiongebundenes Login erforderlich" in auth_source

    assert "def _can_manage_privileged_roles" in admin_management
    assert "Nur Hauptadmin/Super-Admin darf Admin-Rollen vergeben oder entziehen" in admin_management
    assert '"$inc": {"auth_version": 1}' in admin_management
    assert "revoke_all_sessions" in admin_management

    assert "Nur Hauptadmin/Super-Admin darf Admin-Rollen vergeben oder entziehen" in admin_source
    assert "revoke_all_sessions" in admin_source


def test_kyc_production_is_fail_closed_and_uploads_are_real_images():
    source = (BACKEND_DIR / "routes" / "kyc.py").read_text(encoding="utf-8")

    assert "def _final_kyc_decision" in source
    assert "KYC_AUTOMATED_PROVIDER_CERTIFIED" in source
    assert 'return "pending"' in source
    assert '"kyc_ai_decision": ai_decision' in source
    assert '"kyc_requires_manual_review"' in source
    assert '"ai_recommendation": ai_decision' in source

    assert "def _validate_saved_image_signature" in source
    assert 'head[:3] == b"\\xff\\xd8\\xff"' in source
    assert 'head.startswith(b"\\x89PNG' in source
    assert 'head[8:12] == b"WEBP"' in source
    assert 'head[4:8] == b"ftyp"' in source


def test_kyc_and_role_verification_fail_closed_in_production():
    kyc_source = (BACKEND_DIR / "routes" / "kyc.py").read_text(encoding="utf-8")
    verification_source = (BACKEND_DIR / "routes" / "verification.py").read_text(encoding="utf-8")

    assert "KYC_AUTOMATED_PROVIDER_CERTIFIED" in kyc_source
    assert "manual_review_required" in kyc_source
    assert "def _validate_saved_image_signature" in kyc_source
    assert "_validate_saved_image_signature(front_path" in kyc_source

    assert "def _valid_image_signature" in verification_source
    assert "File {key} is not a valid image" in verification_source
    assert '"$inc": {"auth_version": 1}' in verification_source
    assert "revoke_all_sessions" in verification_source


def test_csv_exports_neutralize_formulas_and_disable_caching():
    export_source = (BACKEND_DIR / "routes" / "export.py").read_text(encoding="utf-8")

    assert "def _safe_csv_cell" in export_source
    assert 'trimmed.startswith(("=", "+", "-", "@"))' in export_source
    assert '"Cache-Control": "no-store, private"' in export_source
    assert '"X-Content-Type-Options": "nosniff"' in export_source


def test_account_deletion_request_disables_access_and_preserves_retention_review():
    profile_source = (BACKEND_DIR / "routes" / "profile.py").read_text(encoding="utf-8")
    page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "DeleteAccountPage.jsx").read_text(encoding="utf-8")

    assert '@router.post("/deletion-request")' in profile_source
    assert '"login_disabled": True' in profile_source
    assert '"account_closure_status": "requested"' in profile_source
    assert '"retention_review_required": True' in profile_source
    assert '"$inc": {"auth_version": 1}' in profile_source
    assert "revoke_all_sessions" in profile_source
    assert "Aktuelles Passwort ist falsch" in profile_source

    assert "/api/user/deletion-request" in page_source
    assert "delete-account-password" in page_source
    assert "delete-account-confirmation" in page_source
    assert "Konto deaktivieren & Löschung beantragen" in page_source


def test_marketplace_and_flash_sale_checkout_are_atomic_and_retry_safe():
    market_source = (BACKEND_DIR / "routes" / "marketplace.py").read_text(encoding="utf-8")
    commerce_source = (BACKEND_DIR / "routes" / "commerce_center.py").read_text(encoding="utf-8")
    market_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MarketplacePage.jsx").read_text(encoding="utf-8")
    commerce_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "CommerceCenterPage.jsx").read_text(encoding="utf-8")
    api_source = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")

    assert "def _require_marketplace_idempotency_key" in market_source
    assert "async def _marketplace_platform_user_id" in market_source
    assert '"purchase_claim_key": key_hash' in market_source
    assert '"status": "escrow_pending"' in market_source
    assert '"escrow_status": "pending"' in market_source
    assert 'idempotency_key=f"marketplace-escrow:{order_id}"' in market_source
    assert '"escrow_status": "funded"' in market_source
    assert '"awaiting_shipment"' in market_source
    assert '"awaiting_pickup"' in market_source
    assert '@router.post("/orders/{order_id}/ship")' in market_source
    assert '@router.post("/orders/{order_id}/ready-pickup")' in market_source
    assert '@router.post("/orders/{order_id}/confirm-received")' in market_source
    assert '@router.post("/orders/{order_id}/cancel")' in market_source
    assert 'idempotency_key=f"marketplace-order:{order_id}:seller-payout"' in market_source
    assert 'idempotency_key=f"marketplace-order:{order_id}:refund"' in market_source
    assert '"escrow_status": "released"' in market_source
    assert '"escrow_status": "refunded"' in market_source
    assert 'idempotency_key=f"marketplace-seller:{idempotency_key}"' not in market_source
    assert 'idempotency_key=f"marketplace-refund:{idempotency_key}"' not in market_source
    assert "shipping_cost" in market_source and "seller_amount = round(item_price - commission + shipping_cost, 2)" in market_source
    assert 'listing.get("status") not in {"active", "inactive"}' in market_source
    assert 'req.status and req.status in ["active", "inactive"]' in market_source
    assert "Anzeige ist in einem Kauf-/Verkaufsprozess und kann nicht gelöscht werden" in market_source
    assert 'o.get("status") == "completed"' in market_source
    assert 'o.get("escrow_status") in {None, "released"}' in market_source
    assert '"escrow_status": "released"' in market_source
    assert '"escrow_status": {"$exists": False}' in market_source
    assert 'shipping_cost: Optional[float] = Field(default=None, ge=0, le=100000)' in market_source
    assert 'price: Optional[float] = Field(default=None, gt=0, le=100000)' in market_source
    assert '"listing_reactivation_required": True' in market_source
    assert '"post_refund_listing_state_mismatch"' in market_source

    assert "def _require_flash_idempotency_key" in commerce_source
    assert '"reservation_key": key_hash' in commerce_source
    assert 'idempotency_key=f"flash-seller:{idempotency_key}"' in commerce_source
    assert 'idempotency_key=f"flash-refund:{idempotency_key}"' in commerce_source
    assert "reconciliation_required" in commerce_source

    assert "'Idempotency-Key': idempotencyKey" in market_page
    assert "use_shipping: !!useShipping" in market_page
    assert "marketplace-delivery-choice" in market_page
    assert "marketplace-orders-view" in market_page
    assert "fetchMarketplaceOrders" in market_page
    assert '@router.get("/orders/purchases")' in market_source
    assert '@router.get("/orders/sales")' in market_source
    assert '"/api/marketplace/orders/purchases"' in market_page
    assert '"/api/marketplace/orders/sales"' in market_page
    assert "orderActionKeysRef" in market_page
    assert "/confirm-received" in market_page
    assert "/ready-pickup" in market_page
    assert "/ship" in market_page
    assert "/cancel" in market_page
    assert "marketplace-confirm-received-" in market_page
    assert "marketplace-ship-order-" in market_page
    assert "flashPurchaseKeysRef" in commerce_page
    assert '"Idempotency-Key": idempotencyKey' in api_source


def test_two_factor_flows_use_hashed_secrets_and_configured_login_factor():
    auth_source = (BACKEND_DIR / "routes" / "auth.py").read_text(encoding="utf-8")
    factor_source = (BACKEND_DIR / "routes" / "two_factor.py").read_text(encoding="utf-8")
    user_context = (BACKEND_DIR.parent / "frontend" / "src" / "store" / "UserContext.jsx").read_text(encoding="utf-8")
    auth_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuthPage.jsx").read_text(encoding="utf-8")

    assert '"method": method' in auth_source
    assert 'if method == "totp":' in auth_source
    assert "_hash_totp_backup_code" in auth_source
    assert '"two_factor_method": "totp"' in auth_source
    assert '"two_factor_method": "email"' in auth_source

    assert '"code_hash": _hash_otp_code(otp)' in factor_source
    assert '"code": otp' not in factor_source
    assert "totp_backup_code_hashes" in factor_source
    assert 'request.headers.get("X-Child' not in factor_source
    assert factor_source.count('@router.post("/disable")') == 1
    assert factor_source.count('@router.get("/status")') == 1

    assert "twoFAMethod" in user_context
    assert "[6, 8].includes(normalized.length)" in user_context
    assert "Authenticator-App" in auth_page
    assert "maxLength={8}" in auth_page


def test_marketplace_and_flash_sale_money_paths_are_retry_safe():
    marketplace_source = (BACKEND_DIR / "routes" / "marketplace.py").read_text(encoding="utf-8")
    commerce_source = (BACKEND_DIR / "routes" / "commerce_center.py").read_text(encoding="utf-8")
    dashboard_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MarketplaceDashboardPage.jsx").read_text(encoding="utf-8")
    commerce_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "CommerceCenterPage.jsx").read_text(encoding="utf-8")

    assert "def _require_marketplace_kyc" in marketplace_source
    assert '_require_marketplace_kyc(user, action="zu verkaufen")' in marketplace_source
    assert '_require_marketplace_kyc(user, action="zu kaufen")' in marketplace_source
    assert "def _require_marketplace_action_idempotency_key" in marketplace_source
    assert "promotion_operations" in marketplace_source
    assert "marketplace_promo_ids" in marketplace_source
    assert "marketplace-boost-rollback" in marketplace_source
    assert "marketplace-vip-rollback" in marketplace_source

    assert "async def _release_flash_claim" in commerce_source
    assert "post_settlement_inventory_finalization_failed" in commerce_source
    assert 'status": "reconciliation_required"' in commerce_source
    assert "from core.config import TEST_MODE" in commerce_source
    assert "Flash-Sale-Käufe von externen Marketplace-Verkäufern sind in Production" in commerce_source
    assert "Es wird kein Käufergeld abgebucht." in commerce_source
    assert "flash-sale-escrow-pending-" in commerce_page
    assert "Escrow noch nicht live" in commerce_page

    assert "boost_type: boostType" in dashboard_source
    assert "'Idempotency-Key': idempotencyKey" in dashboard_source
    assert "promotionAttemptKeysRef" in dashboard_source


def test_referral_and_promotion_rewards_are_exactly_once():
    referral_source = (BACKEND_DIR / "routes" / "referral_system.py").read_text(encoding="utf-8")
    promotions_source = (BACKEND_DIR / "routes" / "promotions.py").read_text(encoding="utf-8")

    assert 'claim_id = f"daily-bonus:{user_id}:{today}"' in referral_source
    assert '"status": "wallet_credited"' in referral_source
    assert '"status": "completed"' in referral_source
    assert 'idempotency_key=claim_id' in referral_source
    assert 'idempotency_key=f"{reward_scope}:invited"' in referral_source
    assert 'idempotency_key=f"{reward_scope}:inviter"' in referral_source
    assert 'idempotency_key=f"{reward_scope}:level2"' in referral_source
    assert 'idempotency_key=f"{reward_scope}:manager"' in referral_source
    assert 'TransactionType.REWARD' in referral_source

    assert 'usage_id = f"promo:{promo_name}:{user_id}"' in promotions_source
    assert 'claim_query["current_uses"] = {"$lt": max_uses}' in promotions_source
    assert '"$inc": {"current_uses": 1}' in promotions_source
    assert 'await db.promo_usage.delete_one({"_id": usage_id})' in promotions_source


def test_notifications_unify_legacy_and_canonical_schemas():
    source = (BACKEND_DIR / "routes" / "notifications.py").read_text(encoding="utf-8")

    assert '@router.get("")' in source
    assert '@router.get("/")' in source
    assert 'def _notification_identity_query' in source
    assert '{"user_id": user_id}' in source
    assert '"user_email": {"$in": list(emails)}' in source
    assert 'def _normalize_notification' in source
    assert 'normalized["body"] = body' in source
    assert 'normalized["message"] = normalized.get("message") or body' in source
    assert 'if not TEST_MODE:' in source
    assert 'return' in source


def test_food_orders_are_server_priced_retry_safe_and_settle_once():
    food_source = (BACKEND_DIR / "routes" / "food.py").read_text(encoding="utf-8")
    tracking_source = (BACKEND_DIR / "routes" / "food_tracking.py").read_text(encoding="utf-8")
    food_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "FoodPage.jsx").read_text(encoding="utf-8")
    checkout = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "food" / "CheckoutView.jsx").read_text(encoding="utf-8")

    assert "def _price_food_line" in food_source
    assert "size_id" in food_source and "extra_ids" in food_source
    assert "idempotency_key=idempotency_key" in food_source
    assert '"status": "payment_pending"' in food_source
    assert "async def _refund_food_order" in food_source
    assert 'idempotency_key=f"food-refund:{order_id}"' in food_source
    assert "async def _settle_food_delivery" in food_source
    assert 'idempotency_key=f"food-settlement:{order_id}:restaurant"' in food_source
    assert 'idempotency_key=f"food-settlement:{order_id}:courier"' in food_source
    assert "random.choice(COURIER_NAMES)" not in food_source
    assert '"$inc": {"balance": restaurant_share}' not in food_source
    assert '"$inc": {"balance": courier_share}' not in food_source
    assert "async def _require_food_restaurant_owner" in food_source
    assert 'review_id = f"FOOD-REVIEW-' in food_source
    assert "db.food_reviews.update_one" in food_source
    assert 'marker_field = f"food_review_markers.{marker_hash}"' in food_source
    assert '"rating_sum": {' in food_source
    assert '"review_count": {"$add":' in food_source
    assert '"status": "reconciliation_required"' in food_source
    assert '"$inc": {"review_count": 1}' not in food_source
    assert '"owner_id": user_id' in food_source
    assert 'body.get("location", {"lat": 52.52, "lng": 13.405})' not in food_source

    assert "from routes.food import _settle_food_delivery" in tracking_source
    assert "transfer_between_wallets" in tracking_source
    assert "Tipping only available for card payments" not in tracking_source

    assert "'Idempotency-Key': idempotencyKey" in food_page
    assert "size_id: i.size_id || null" in food_page
    assert "extra_ids: i.extra_ids || []" in food_page
    assert "promo_code: promoApplied?.code || null" in food_page
    assert "/api/food/promo/validate" in checkout


def test_restaurant_reservations_are_capacity_and_payment_safe():
    source = (BACKEND_DIR / "routes" / "restaurants.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "RestaurantReservationPage.jsx").read_text(encoding="utf-8")

    assert "def _require_reservation_idempotency_key" in source
    assert "def _reservation_slot_id" in source
    assert "async def _claim_reservation_seats" in source
    assert '"remaining_seats": {"$gte": guests}' in source
    assert "async def _release_reservation_seats_once" in source
    assert 'reservation_deposit' in source
    assert 'amount=deposit' in source
    assert 'idempotency_key=idempotency_key' in source
    assert 'idempotency_key=f"restaurant-reservation-refund:{reservation_id}"' in source
    assert '"cashback": 0.0' in source
    assert '"$inc": {"balance": -deposit}' not in source
    assert '"$inc": {"balance": r["deposit"]}' not in source

    assert '"Idempotency-Key": idempotencyKey' in page
    assert "reservationAttemptKeyRef" in page
    assert "Reservierungskaution" in page


def test_unverified_provider_and_client_declared_money_flows_fail_closed():
    crypto_source = (BACKEND_DIR / "routes" / "crypto_wallet.py").read_text(encoding="utf-8")
    flight_source = (BACKEND_DIR / "routes" / "flights.py").read_text(encoding="utf-8")
    gaming_source = (BACKEND_DIR / "routes" / "gaming.py").read_text(encoding="utf-8")

    assert "Crypto-Einzahlungen sind bis zur verifizierten Blockchain-/Custody-Anbindung deaktiviert." in crypto_source
    assert "Crypto-Auszahlungen sind bis zur verifizierten Blockchain-/Custody-Anbindung deaktiviert." in crypto_source
    assert '"$inc": {"balance": req.amount}' not in crypto_source

    assert "Flugbuchungen sind bis zur verifizierten Live-Provider-Anbindung deaktiviert." in flight_source
    assert '"$inc": {"balance": -total}' not in flight_source

    assert "Legacy client-declared winnings are unsafe" in gaming_source
    assert "Cashback wird automatisch aus verifizierten Transaktionen gutgeschrieben." in gaming_source
    assert '"gaming_coins": {"$gte": amount}' in gaming_source


def test_mining_and_gaming_rewards_cannot_be_double_claimed_or_overspent():
    mining_source = (BACKEND_DIR / "routes" / "mining.py").read_text(encoding="utf-8")
    gaming_source = (BACKEND_DIR / "routes" / "gaming.py").read_text(encoding="utf-8")

    assert '"status": "processing"' in mining_source
    assert '"status": "completed"' in mining_source
    assert "async def _settle_daily_mining_reward" in mining_source
    assert 'credit_marker = f"daily_reward_credits.{persisted_claim_id}"' in mining_source
    assert 'ref_marker = f"referral_reward_credits.{persisted_claim_id}"' in mining_source
    assert '{"txn_id": persisted_claim_id}' in mining_source
    assert '{"txn_id": f"{persisted_claim_id}-REF"}' in mining_source
    assert '"status": "reconciliation_required"' in mining_source
    assert '{"user_id": user_id, "date": today, "status": "completed"}' in mining_source
    assert '{"user_id": user_id, "status": "completed"}' in mining_source
    assert 'marker = f"referral_bonus_markers.{user_id}"' in mining_source
    assert '{"_id": operation_id}' in mining_source
    assert '"replayed": not claim_created' in mining_source
    assert '"operation_id": operation_id' in mining_source
    assert '"blz_balance": {"$gte": req.amount}' in mining_source
    assert "await credit_wallet(" in mining_source
    assert '"referred_id": user_id' in mining_source
    assert '"$setOnInsert"' in mining_source

    assert '"gaming_coins": {"$gte": amount}' in gaming_source
    assert '"claimed_points": {"$ne": req.points}' in gaming_source
    assert '"vip_claims": {"$ne": req.perk_type}' in gaming_source
    assert "gaming_reward_markers" in gaming_source


def test_mining_launchpad_and_loyalty_rewards_are_ledger_backed_and_exactly_once():
    mining_source = (BACKEND_DIR / "routes" / "mining_phase2.py").read_text(encoding="utf-8")
    loyalty_source = (BACKEND_DIR / "routes" / "loyalty_system.py").read_text(encoding="utf-8")
    engine_source = (BACKEND_DIR / "core" / "payment_engine.py").read_text(encoding="utf-8")
    database_source = (BACKEND_DIR / "core" / "database.py").read_text(encoding="utf-8")

    assert "TransactionType.MINING_PURCHASE" in mining_source
    assert "mining_launchpad_buys.update_one" in mining_source
    assert 'marker_field = f"purchase_markers.{purchase_hash}"' in mining_source
    assert "mining-launchpad-refund" in mining_source
    assert 'db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -project["price_eur"]}})' not in mining_source

    assert "LOYALTY_CASHBACK" in engine_source
    assert "loyalty_reward_claims" in loyalty_source
    assert "credit_wallet(" in loyalty_source
    assert 'marker_field = f"reward_markers.{claim_hash}"' in loyalty_source
    assert '"$inc": {"balance": cashback_earned}' not in loyalty_source

    assert 'db.mining_launchpad_buys, [("user_id", 1), ("project_id", 1)], unique=True' in database_source
    assert 'db.loyalty_reward_claims, "claim_id", unique=True' in database_source
    assert 'db.user_loyalty, "user_id", unique=True' in database_source


def test_pos_cart_and_external_card_paths_fail_closed():
    pos_source = (BACKEND_DIR / "routes" / "pos_system.py").read_text(encoding="utf-8")
    checkout_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "pos" / "POSCheckoutTab.jsx").read_text(encoding="utf-8")
    simple_pos_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MerchantPosSimplePage.jsx").read_text(encoding="utf-8")

    assert '"store_id": store_id' in pos_source
    assert 'quantity: float = Field(default=1, gt=0' in pos_source
    assert 'price: Optional[float] = Field(default=None, gt=0' in pos_source
    assert 'discount_pct: float = Field(default=0, ge=0, le=100)' in pos_source
    assert 'require_permission(actor, "payment.collect")' in pos_source
    assert 'POS_EXTERNAL_CARD_CERTIFIED' in pos_source
    assert 'req.card_reference.startswith("CARD-")' in pos_source

    # Offline cash sales must be retry-safe and tied to the captured shift.
    assert 'client_sale_id: Optional[str]' in pos_source
    assert 'captured_shift_id: Optional[str]' in pos_source
    assert '"_id": f"offline:{req.client_sale_id}"' in pos_source
    assert '"offline_synced_after_shift_close"' in pos_source
    assert 'expected_total' in pos_source
    assert 'merchant_settlement_target_missing' in pos_source
    assert 'idempotency_key=f"pos-rollback:{payment[\'payment_id\']}"' in pos_source

    assert 'cardRef || `CARD-${Date.now()}`' not in checkout_source
    assert 'providerReference = cardRef.trim()' in checkout_source
    assert 'REACT_APP_POS_EXTERNAL_CARD_CERTIFIED' in checkout_source
    assert 'const EXTERNAL_CARD_CERTIFIED = TEST_MODE &&' in checkout_source
    assert 'if (paymentMethod === "card_external" && !EXTERNAL_CARD_CERTIFIED)' in checkout_source
    assert 'data-testid="pos-card-preview-disabled"' in checkout_source
    assert 'REACT_APP_POS_NFC_CERTIFIED' in checkout_source
    assert '{NFC_CERTIFIED ? (' in checkout_source
    assert 'if (!NFC_CERTIFIED) {' in checkout_source
    assert 'NFC ist noch nicht für Production zertifiziert.' in checkout_source
    assert 'data-testid="pos-nfc-preview-disabled"' in checkout_source
    assert 'import { TEST_MODE } from "../config/testMode";' in simple_pos_source
    assert 'externalCardCertified = TEST_MODE && process.env.REACT_APP_POS_EXTERNAL_CARD_CERTIFIED === "true"' in simple_pos_source
    assert 'offline_sale_id: offlineSaleId' in checkout_source
    assert 'captured_shift_id: q.shift_id' in checkout_source
    assert 'expected_total: q.total' in checkout_source
    assert 'Gutscheine können offline nicht sicher eingelöst werden' in checkout_source
    assert 'import { TEST_MODE } from "../../config/testMode";' in checkout_source
    assert 'if (!TEST_MODE) return toast.error("Gutschein-Zahlung ist in Production bis zum kanonischen Cart-Settlement deaktiviert.");' in checkout_source
    assert 'if (!TEST_MODE && appliedVouchers.length > 0)' in checkout_source
    assert 'data-testid="pos-voucher-preview-disabled"' in checkout_source
    assert 'lineDiscount' in checkout_source


def test_merchant_to_merchant_money_uses_canonical_idempotent_transfer():
    merchant_source = (BACKEND_DIR / "routes" / "merchant_payments.py").read_text(encoding="utf-8")
    engine_source = (BACKEND_DIR / "core" / "payment_engine.py").read_text(encoding="utf-8")
    mobile_source = (BACKEND_DIR.parent / "mobile" / "src" / "screens" / "Merchant" / "MerchantPaymentsScreen.js").read_text(encoding="utf-8")

    assert "transfer_between_wallets" in merchant_source
    assert 'idempotency_key=f"merchant-pay:{idempotency_key}"' in merchant_source
    assert 'status_code = 503 if transfer_result.status.value in {"pending", "reconciliation_required"} else 400' in merchant_source
    assert 'user.get("kyc_status") != "approved"' in merchant_source
    assert 'recipient.get("kyc_status") != "approved"' in merchant_source
    assert "if not transfer_result.idempotent_replay:" in merchant_source
    assert 'direction": "credit"' in merchant_source
    assert "total_sent = sum(abs(float" in merchant_source
    assert '"metadata.recipient_id": 1' in merchant_source
    assert 'meta.get("recipient_id") or meta.get("counterparty_user_id")' in merchant_source
    assert "ObjectId(rid) for rid in recipient_ids if ObjectId.is_valid(rid)" in merchant_source
    assert 'idempotent_replay=getattr(result, "idempotent_replay", False)' in engine_source
    assert "paymentAttemptKeyRef" in mobile_source
    assert "AsyncStorage.getItem(paymentAttemptStorageKey)" in mobile_source
    assert "const storedKey = storedAttempts[scope]" in mobile_source
    assert "JSON.stringify({ ...storedAttempts, [scope]: attempt.key })" in mobile_source
    assert "delete storedAttempts[current.scope]" in mobile_source
    assert "Object.keys(storedAttempts).length > 0" in mobile_source
    assert "AsyncStorage.removeItem(paymentAttemptStorageKey)" in mobile_source
    assert "const idempotencyKey = await loadOrCreatePaymentAttemptKey();" in mobile_source
    assert "idempotency_key: idempotencyKey" in mobile_source
    assert "status > 0 && status < 500 && status !== 429" in mobile_source
    assert "Der Zahlungsstatus ist unklar. Bitte denselben Versuch erneut ausführen." in mobile_source


def test_auction_production_bots_cannot_manipulate_customer_auctions():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    admin_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionAdminPage.jsx").read_text(encoding="utf-8")

    assert 'if not TEST_MODE and not auction.get("bot_only"):' in source
    assert 'bot_query["bot_only"] = True' in source
    assert 'Bots dürfen in Production nur auf klar markierten bot_only' in source
    assert 'Bot-Strategien sind in Production nur für bot_only' in source
    assert 'effective_bot_enabled = bool(req.bot_enabled and TEST_MODE)' in source
    assert source.count('"bot_enabled": effective_bot_enabled') >= 2
    assert '"bot_policy": (' in source
    assert '"test_only"' in source
    assert 'Production-Bots deaktiviert' in admin_page
    assert 'data-testid="auction-admin-engine"' in admin_page
    assert 'data-testid="auction-engine-modal"' in admin_page
    assert 'Gebotsumsatz-Ziel' in admin_page
    assert 'data-testid={`auction-engine-${key}`}' in admin_page
    assert '["Produktkosten", "productCost", 100000]' in admin_page
    assert '["Nettoziel", "targetNetProfit", 100000]' in admin_page
    assert 'data-testid="auction-schedule-net-profit"' in admin_page
    assert 'Nur echte bezahlte Kundengebote zählen.' in admin_page
    assert 'Bot-Gebote zählen nicht als Umsatz' in admin_page
    assert 'product_cost_eur: Number(engineConfig.productCost)' in admin_page
    assert 'target_net_profit_eur: Number(engineConfig.targetNetProfit)' in admin_page
    assert 'config["bot_policy"] = "test_only"' in source
    assert 'config_dict["bot_default_enabled"] = False' in source
    assert 'Production: deaktiviert' in admin_page
    assert 'const botControlsEffective = config?.bot_controls_effective === true;' in admin_page
    assert 'data-testid="auction-bot-production-policy"' in admin_page
    assert 'disabled={!botControlsEffective}' in admin_page
    assert 'Production-Kundenauktionen werden nicht über eine Win-Rate-Steuerung beeinflusst.' in admin_page
    assert 'Production-Kundenauktionen nutzen keine Bot-Aggressivitätssteuerung.' in admin_page
    assert 'bot_last_bidder = str(raw_winner_id or "").startswith("bot_")' in source
    assert '"bot_last_bidder_requires_review"' in source
    assert '"requires_manual_review": needs_review' in source


def test_auction_winners_and_referrals_are_race_safe():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert "async def _finalize_auction_once" in source
    assert 'winner_id = auction.get("last_bidder_id")' in source
    assert 'notification_id = f"auction-win:{auction_id}:{winner_id}"' in source
    assert '"$setOnInsert": {' in source
    assert 'await _finalize_auction_once(auc["auction_id"])' in source
    assert "finalized, _ = await _finalize_auction_once(auction_id)" in source
    assert '"force_ended_by": str(user["_id"])' in source

    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionsPage.jsx").read_text(encoding="utf-8")
    admin_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionAdminPage.jsx").read_text(encoding="utf-8")
    api = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")
    assert 'class AuctionWinnerCheckoutRequest(BaseModel):' in source
    assert '@router.get("/{auction_id}/winner-checkout")' in source
    assert '@router.post("/{auction_id}/winner-checkout/pay")' in source
    assert 'str(auction.get("winner_id") or "") != user_id' in source
    assert 'requested_attempt_hash = hashlib.sha256(client_key.encode("utf-8")).hexdigest()[:20]' in source
    assert 'recoverable_status = current_order.get("status") in {"processing_payment", "reconciliation_required"}' in source
    assert 'current_order.get("payment_attempt_key_hash") or requested_attempt_hash' in source
    assert 'idempotency_key=f"auction-winner-order:{order_id}:payment:{payment_attempt_hash}"' in source
    assert 'transfer_between_wallets(' in source
    assert 'tx_type=TransactionType.AUCTION_WIN' in source
    assert '"shipping_fee": 0.0' in source
    assert '"free_shipping": True' in source
    assert '"status": "paid_pending_fulfillment"' in source
    assert '"fulfillment_status": "pending"' in source
    assert '"winner_payment_status": "paid"' in source
    assert 'status_code=503 if order_status == "reconciliation_required" else 400' in source
    assert 'class AuctionOrderFulfillmentRequest(BaseModel):' in source
    assert '@router.get("/admin/orders")' in source
    assert '@router.post("/admin/orders/{order_id}/fulfillment")' in source
    assert 'Nur bezahlte Bestellungen können versendet werden' in source
    assert 'Echter Versanddienstleister erforderlich' in source
    assert 'Echte Tracking-/Sendungsnummer erforderlich' in source
    assert '"processing": {"pending", "not_started"}' in source
    assert '"shipped": {"processing"}' in source
    assert '"delivered": {"shipped"}' in source
    assert 'notification_id = f"auction-order:{order_id}:{req.status}"' in source
    assert 'tracking_number = (req.tracking_number or "").strip() or None' in source

    assert "getAuctionWinnerCheckout" in api
    assert "payAuctionWinnerCheckout" in api
    assert '"Idempotency-Key": body.idempotency_key' in api
    assert "WinnerCheckoutModal" in page
    assert "winnerCheckoutKeyRef" in page
    assert "window.sessionStorage.getItem(attemptStorageKey)" in page
    assert "window.sessionStorage.setItem(attemptStorageKey, winnerCheckoutKeyRef.current)" in page
    assert "window.sessionStorage.removeItem(attemptStorageKey)" in page
    assert "e?.status === 400" in page
    assert "winnerCheckoutKeyRef.current = null" in page
    assert "winner-checkout-pay" in page
    assert "paid_pending_fulfillment" not in page
    assert "Tracking erst nach echter Übergabe an Versand" in page
    assert "winner-tracking-number" in page
    assert "const paidWins =" in page
    assert "auction-paid-wins" in page
    assert "Meine Bestellungen" in page
    assert "winner_fulfillment_status" in page
    assert "auction-order-win-" in page
    assert "auction-pending-wins" in page
    assert "Gewonnen · Zahlung offen" in page
    assert "winner_payment_status !== \"paid\"" in page
    assert "auction-admin-orders" in admin_page
    assert "updateFulfillment" in admin_page
    assert "Echte Sendungsnummer" in admin_page
    assert 'updateFulfillment(order, "processing")' in admin_page
    assert 'updateFulfillment(order, "shipped")' in admin_page
    assert 'updateFulfillment(order, "delivered")' in admin_page

    assert 'grant_scope = f"auction-referral:{user_id}:{referrer_id}"' in source
    assert 'grant_key=f"{grant_scope}:invitee"' in source
    assert 'grant_key=f"{grant_scope}:referrer"' in source
    assert 'notification_id = f"auction-referral:{user_id}:{referrer_id}"' in source
    assert '"replayed": replayed or not invitee_new or not referrer_new' in source


def test_scooter_live_operations_fail_closed_without_verified_iot():
    source = (BACKEND_DIR / "routes" / "scooter.py").read_text(encoding="utf-8")

    assert 'IOT_PROVIDER_URL = os.environ.get("IOT_PROVIDER_URL", "")' in source
    assert "if TEST_MODE:" in source
    assert 'return DeviceCommandResult(False, "IoT provider not configured")' in source
    assert "_require_iot_device_ingest_auth(request)" in source
    assert 'request.headers.get("X-IoT-Key"' in source
    assert "secrets.compare_digest(provided, expected)" in source

    assert "lat: Optional[float] = None, lng: Optional[float] = None" in source
    assert '"location_required": True' in source
    assert 'user.get("kyc_status") != "approved"' in source
    assert 'raise HTTPException(status_code=503, detail="Scooter hat keine verbundene IoT-Geräte-ID")' in source

    assert '"end_lock_status": "failed"' in source
    assert '"end_lock_status": "confirmed"' in source
    assert "Scooter konnte nicht sicher verriegelt werden" in source


def test_kids_subscription_wallet_gps_and_rewards_fail_safe():
    kids = (BACKEND_DIR / "routes" / "kids.py").read_text(encoding="utf-8")
    gps = (BACKEND_DIR / "routes" / "kids_gps.py").read_text(encoding="utf-8")
    controls = (BACKEND_DIR / "routes" / "kids_controls.py").read_text(encoding="utf-8")
    app = (BACKEND_DIR / "routes" / "kids_app.py").read_text(encoding="utf-8")
    premium = (BACKEND_DIR / "routes" / "kids_premium.py").read_text(encoding="utf-8")
    gps_ui = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "KidsGPSModal.jsx").read_text(encoding="utf-8")

    assert "TRIAL_DAYS = 30" in kids
    assert "async def require_kids_entitlement" in kids
    assert 'sub.get("status") not in {"active", "trial"}' in kids
    assert 'idempotency_key=f"kids-delete-refund:{child_id}"' in kids
    assert '"status": "deleting"' in kids
    assert 'await db.kids_location_history.delete_many' in kids
    assert '"status": "active"' in kids and '"is_frozen": {"$ne": True}' in kids

    assert "await require_kids_entitlement(parent_id)" in gps
    assert "if not TEST_MODE:" in gps
    assert '@router.post("/simulate/{child_id}")' in gps
    assert "canSimulateLocation" in gps_ui
    assert 'process.env.NODE_ENV !== "production"' in gps_ui

    assert "await require_kids_entitlement(parent_id)" in controls
    assert 'await require_kids_entitlement(str(child.get("parent_id") or ""))' in app
    assert "async def _grant_child_blz_once" in premium
    assert "reward_new, grant_ok = await _grant_child_blz_once" in premium
    assert 'raise HTTPException(403, "Keine Berechtigung für diese Aufgabe")' in premium


def test_admin_account_actions_preserve_sessions_ledgers_and_refund_safety():
    source = (BACKEND_DIR / "routes" / "admin_management.py").read_text(encoding="utf-8")

    assert 'target_email == "admin@bidblitz.ae"' in source
    assert 'target_role in {"admin", "super_admin"}' in source
    assert '"login_disabled": bool(req.banned)' in source
    assert 'await revoke_all_sessions(str(target["_id"]))' in source

    assert '"account_closure_status": "admin_closed"' in source
    assert '"retention_review_required": True' in source
    assert '"hard_deleted": False' in source
    assert 'db.users.delete_one({"_id": _oid(user_id)})' not in source

    assert 'refund_key = f"admin-refund:{original_identity}"' in source
    assert 'idempotency_key=refund_key' in source
    assert '"merchant_payment"' in source
    assert '"p2p_send"' in source
    assert "Bitte den modulspezifischen Refund verwenden" in source
    assert '"replayed": result.idempotent_replay' in source


def test_support_ticket_lifecycle_is_canonical_and_closed_tickets_are_immutable():
    support = (BACKEND_DIR / "routes" / "support.py").read_text(encoding="utf-8")
    legacy = (BACKEND_DIR / "routes" / "support_tickets.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "SupportChatPage.jsx").read_text(encoding="utf-8")

    assert '@limiter.limit("10/hour")' in support
    assert '@limiter.limit("60/minute")' in support
    assert 'ticket.get("status") == "closed"' in support
    assert '"status": "closed"' in support
    assert 'ticket["status"] == "resolved" and not is_admin' in support
    assert 'status not in {"open", "in_progress", "resolved", "closed"}' in support
    assert 'await db.support_tickets.update_one(' in legacy
    assert '"status": "closed"' in legacy
    assert 'user.get("role") in ("admin", "super_admin")' in legacy
    assert 'activeTicket.status !== "closed"' in page
    assert 'activeTicket.status !== "resolved" || true' not in page


def test_totp_backup_codes_are_atomic_one_time_factors():
    source = (BACKEND_DIR / "routes" / "two_factor.py").read_text(encoding="utf-8")

    assert "async def _consume_totp_backup_code" in source
    assert '"$pull": {"totp_backup_code_hashes": candidate_hash}' in source
    assert '"totp_backup_codes": legacy_code' in source
    assert "valid = await _consume_totp_backup_code(user_id, req.code)" in source
    assert "is_backup_code = await _consume_totp_backup_code(user_id, otp.code)" in source
    assert "attempts >= 5" in source
    assert '"$inc": {"attempts": 1}' in source
    assert "Zu viele 2FA-Versuche" in source


def test_notification_settings_match_push_backend_contract():
    backend = (BACKEND_DIR / "routes" / "web_push.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "NotificationSettingsPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/subscription-status")' in backend
    assert '"subscribed": count > 0' in backend
    assert '@router.delete("/unsubscribe")' in backend
    assert '{"endpoint": subscription.endpoint}' in backend
    assert '"active": True' in backend

    assert "/api/push/subscription-status" in page
    assert 'method: "DELETE"' in page
    assert "/api/push/unsubscribe" in page


def test_hotel_platform_fees_and_reviews_are_server_enforced():
    source = (BACKEND_DIR / "routes" / "hotels.py").read_text(encoding="utf-8")

    assert "HOTEL_SERVICE_FEE_RATE = 0.10" in source
    assert "service_pct = HOTEL_SERVICE_FEE_RATE" in source
    assert '"service_fee_pct": HOTEL_SERVICE_FEE_RATE' in source
    assert 'user.get("kyc_status") != "approved"' in source

    assert 'b.get("status") != "completed"' in source
    assert 'b.get("settlement_status") != "completed"' in source
    assert 'review_id = f"HTR-' in source
    assert '"$setOnInsert": review' in source
    assert "Diese Buchung wurde bereits bewertet" in source


def test_ev_ocpp_start_and_payout_paths_fail_closed():
    ev = (BACKEND_DIR / "routes" / "ev_charging.py").read_text(encoding="utf-8")
    v16 = (BACKEND_DIR / "services" / "ocpp_csms.py").read_text(encoding="utf-8")
    v201 = (BACKEND_DIR / "services" / "ocpp_v201.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "EVStartChargingPage.jsx").read_text(encoding="utf-8")

    assert "async def _authorize_ocpp_websocket" in ev
    assert '"ocpp_auth_hash": _hash_ocpp_token(ocpp_token)' in ev
    assert "rotate-ocpp-token" in ev
    assert '"ocpp_auth_hash": 0' in ev

    assert "idempotency_key: str = Field(..., min_length=8" in ev
    assert "db.ev_connector_claims.insert_one" in ev
    assert '"status": "released"' in ev
    assert 'idempotency_key=f"ev:preauth:{session_id}"' in ev
    assert '"preauth_status": "held"' in ev
    assert 'from_user_id=escrow_user_id' in ev
    assert 'idempotency_key=f"ev:settlement:{session_id}:refund"' in ev
    assert '"preauth_status": "settled"' in ev
    assert '"label": "Autorisierungslimit"' in ev
    assert "startAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page

    assert "Rejected unmatched StartTransaction" in v16
    assert '"status": "Invalid"' in v16
    assert '"active": False' in v16
    assert "Rejected unmatched OCPP2 Started" in v201
    assert '"active": False' in v201

    assert "idempotency_key=f\"ev:payout:{payout_id}\"" in ev
    assert "tx_type=TransactionType.PAYOUT" in ev
    assert "Externe Auszahlungsreferenz" in ev
    assert '"$inc": {"balance": -payout["amount"]}' not in ev


def test_ev_preauthorization_is_real_escrow_and_hardware_stops_at_cap():
    ev = (BACKEND_DIR / "routes" / "ev_charging.py").read_text(encoding="utf-8")
    v16 = (BACKEND_DIR / "services" / "ocpp_csms.py").read_text(encoding="utf-8")
    v201 = (BACKEND_DIR / "services" / "ocpp_v201.py").read_text(encoding="utf-8")

    assert '"kind": "ev_preauthorization"' in ev
    assert 'idempotency_key=f"ev:preauth:{session_id}"' in ev
    assert '"preauth_status": "held"' in ev
    assert '"preauth_escrow_user_id": escrow_user_id' in ev
    assert 'reason="session_persistence_failed"' in ev
    assert 'reason="cancelled_before_start"' in ev
    assert 'preauthorized = bool(terms.get("preauthorized"))' in ev
    assert 'idempotency_key=f"ev:settlement:{session_id}:refund"' in ev
    assert '"preauth_status": "settled"' in ev

    assert '"auto_stop_reason": "preauthorization_limit"' in v16
    assert "current_cost >= reserved" in v16
    assert "await remote_stop(charge_point_id, transaction_id)" in v16
    assert "price_per_minute" in v16
    assert "minimum_fee" in v16

    assert '"auto_stop_reason": "preauthorization_limit"' in v201
    assert "current_cost >= reserved" in v201
    assert "await request_stop_transaction" in v201
    assert "price_per_minute" in v201
    assert "minimum_fee" in v201


def test_appointment_bookings_are_atomic_retry_safe_and_demo_free_in_production():
    backend = (BACKEND_DIR / "routes" / "bookings.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BookingsPage.jsx").read_text(encoding="utf-8")

    assert "if not TEST_MODE:" in backend
    assert 'q["is_demo"] = {"$ne": True}' in backend
    assert 'pid in {p["id"] for p in SEED_PROVIDERS}' in backend
    assert "async def _claim_appointment_slots" in backend
    assert "db.appointment_slot_claims.insert_one" in backend
    assert "async def _release_appointment_slots" in backend
    assert "Idempotency-Key erforderlich" in backend
    assert 'appointment_id = f"appt_{key_hash}"' in backend
    assert '"$setOnInsert": booking' in backend

    assert "bookingAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page


def test_apartment_bookings_use_real_escrow_availability_and_retry_safety():
    backend = (BACKEND_DIR / "routes" / "apartments.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ApartmentsPage.jsx").read_text(encoding="utf-8")

    assert "async def _claim_apartment_nights" in backend
    assert "db.apartment_night_claims.insert_one" in backend
    assert "Idempotency-Key erforderlich" in backend
    assert '"kind": "apartment_escrow"' in backend
    assert 'to_user_id=escrow_user_id' in backend
    assert '"payment_status": "escrow_held"' in backend
    assert '@router.post("/bookings/{booking_id}/cancel")' in backend
    assert '@router.post("/hosting/bookings/{booking_id}/complete")' in backend
    assert 'idempotency_key=f"apartment:refund:{booking_id}"' in backend
    assert 'idempotency_key=f"apartment:settlement:{booking_id}"' in backend
    assert 'user.get("kyc_status") != "approved"' in backend

    assert "bookingAttemptKeyRef" in page
    assert "'Idempotency-Key': idempotencyKey" in page
    assert "idempotency_key: idempotencyKey" in page


def test_car_rental_money_dates_deposits_and_payouts_are_exactly_once():
    schemas = (BACKEND_DIR / "modules" / "car_rental" / "schemas.py").read_text(encoding="utf-8")
    repo_source = (BACKEND_DIR / "modules" / "car_rental" / "repository.py").read_text(encoding="utf-8")
    services = (BACKEND_DIR / "modules" / "car_rental" / "services.py").read_text(encoding="utf-8")
    routes = (BACKEND_DIR / "modules" / "car_rental" / "routes.py").read_text(encoding="utf-8")
    api = (BACKEND_DIR.parent / "frontend" / "src" / "modules" / "car-rental" / "api" / "index.js").read_text(encoding="utf-8")
    detail = (BACKEND_DIR.parent / "frontend" / "src" / "modules" / "car-rental" / "pages" / "CarDetailPage.jsx").read_text(encoding="utf-8")
    payouts = (BACKEND_DIR.parent / "frontend" / "src" / "modules" / "car-rental" / "pages" / "VendorPayoutsPage.jsx").read_text(encoding="utf-8")

    assert "idempotency_key: str = Field(..., min_length=8" in schemas
    assert "payment_status" in repo_source and "PaymentStatus.PAID.value" in repo_source
    assert '"$setOnInsert": booking' in repo_source

    assert "async def _claim_car_rental_days" in services
    assert "db.car_rental_day_claims.insert_one" in services
    assert 'idempotency_key=f"car-rental:payment:{booking_id}"' in services
    assert "async def _ensure_vendor_pending_payout" in services
    assert "async def _reverse_vendor_pending_payout_once" in services
    assert 'idempotency_key=f"car-rental:reject-refund:{booking_id}"' in services
    assert 'idempotency_key=f"car-rental:cancel-refund:{booking_id}"' in services
    assert 'idempotency_key=f"car-rental:deposit-refund:{booking_id}"' in services
    assert "Aktive Miete kann nicht normal storniert werden" in services
    assert "async def _ensure_vendor_deposit_keep" in services

    assert "reserve_marker = f\"payout_reservations.{key_hash}\"" in services
    assert 'payout_id = f"PO-{key_hash.upper()}"' in services
    assert "Externe Auszahlungsreferenz erforderlich" in services
    assert 'user.get("kyc_status") != "approved"' in routes
    assert '"$setOnInsert": review' in routes
    assert "Diese Buchung wurde bereits bewertet" in routes

    assert '"Idempotency-Key": idempotencyKey' in api
    assert "bookingAttemptKeyRef" in detail
    assert "payoutAttemptKeyRef" in payouts
    assert "idempotency_key: idempotencyKey" in api


def test_credit_bnpl_uses_funded_pool_and_exactly_once_repayments():
    source = (BACKEND_DIR / "routes" / "credit_system.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "CreditScorePage.jsx").read_text(encoding="utf-8")

    assert "CREDIT_LIVE_ENABLED = bool(TEST_MODE)" in source
    assert "No production override until a verified financing provider is integrated" in source
    assert '"live_enabled": bool(CREDIT_LIVE_ENABLED)' in source
    assert '"max_credit": score_info["max_amount"] if CREDIT_LIVE_ENABLED else 0' in source
    assert "CREDIT_POOL_EMAIL" in source
    assert "def _require_credit_live" in source
    assert "async def _credit_pool_user_id" in source
    assert 'user.get("kyc_status") != "approved"' in source

    assert "idempotency_key: str = Field(..., min_length=8" in source
    assert 'credit_id = f"CR-{key_hash.upper()}"' in source
    assert '"status": {"$in": ["pending", "approving", "active", "reconciliation_required"]}' in source

    assert 'idempotency_key=f"credit:disbursement:{credit[\'credit_id\']}:{attempt}"' in source
    assert "transfer_between_wallets(" in source
    assert '"kind": "credit_disbursement"' in source
    assert "async def _reserve_credit_repayment" in source
    assert "async def _rollback_credit_repayment" in source
    assert "async def _complete_credit_repayment_marker" in source
    assert "async def _finalize_credit_if_paid" in source
    assert 'op_key = f"credit:auto-repay:' in source
    assert 'op_key = f"credit:manual-repay:' in source

    assert 'db.users.update_one(\n                        {"_id": user["_id"]},\n                        {"$inc": {"balance": -rate}}' not in source
    assert 'db.users.update_one(\n        {"_id": user["_id"]},\n        {"$inc": {"balance": -payment_amount}}' not in source

    assert "creditAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page


def test_car_rental_money_availability_refunds_and_payouts_are_exactly_once():
    services = (BACKEND_DIR / "modules" / "car_rental" / "services.py").read_text(encoding="utf-8")
    repository = (BACKEND_DIR / "modules" / "car_rental" / "repository.py").read_text(encoding="utf-8")
    schemas = (BACKEND_DIR / "modules" / "car_rental" / "schemas.py").read_text(encoding="utf-8")
    api = (BACKEND_DIR.parent / "frontend" / "src" / "modules" / "car-rental" / "api" / "index.js").read_text(encoding="utf-8")
    detail = (BACKEND_DIR.parent / "frontend" / "src" / "modules" / "car-rental" / "pages" / "CarDetailPage.jsx").read_text(encoding="utf-8")

    assert "idempotency_key: str = Field(..., min_length=8" in schemas
    assert 'booking_id = f"BK-{key_hash.upper()}"' in services
    assert "async def _claim_car_rental_days" in services
    assert 'idempotency_key=f"car-rental:payment:{booking_id}"' in services
    assert "async def _ensure_vendor_pending_payout" in services
    assert "async def _reverse_vendor_pending_payout_once" in services
    assert "async def _ensure_vendor_deposit_keep" in services
    assert "async def _ensure_car_rental_completion_stats" in services
    assert "async def _restore_failed_payout_reservation_once" in services
    assert 'idempotency_key=f"car-rental:reject-refund:{booking_id}"' in services
    assert 'idempotency_key=f"car-rental:cancel-refund:{booking_id}"' in services
    assert 'idempotency_key=f"car-rental:deposit-refund:{booking_id}"' in services

    assert '"payment_status": PaymentStatus.PAID.value' in repository
    assert '"$setOnInsert": booking' in repository
    assert '"Idempotency-Key": idempotencyKey' in api
    assert "bookingAttemptKeyRef" in detail
    assert "idempotency_key: idempotencyKey" in detail


def test_split_bill_participants_and_amounts_are_canonical_and_cent_exact():
    source = (BACKEND_DIR / "routes" / "split_bill.py").read_text(encoding="utf-8")

    assert "async def _resolve_split_identity" in source
    assert "def _allocate_equal_split" in source
    assert "total_custom_cents != total_cents" in source
    assert "Teilnehmer wurde im Custom Split doppelt angegeben" in source
    assert "stored_total_cents != expected_total_cents" in source
    assert 'notification_id = f"split-invite:{split_id}:{p[\'user_id\']}"' in source
    assert 'idempotency_key=f"split_bill:{req.split_id}:{user_id}"' in source


def test_invoice_wallet_and_stripe_settlements_use_canonical_ledger_once():
    source = (BACKEND_DIR / "routes" / "invoicing.py").read_text(encoding="utf-8")

    assert "async def _claim_invoice_payment" in source
    assert "async def _mark_invoice_claim_paid" in source
    assert "async def _mark_invoice_claim_reconciliation" in source
    assert "transfer_between_wallets(" in source
    assert "credit_wallet(" in source
    assert 'idempotency_key=f"invoice:wallet:{invoice_id}:{payer_user_id}"' in source
    assert 'idempotency_key=f"invoice:stripe:{invoice_id}:{session_id}"' in source
    assert '"wallet_transaction_id": credit.transaction_id' in source
    assert "Diese Rechnung wird bereits über einen anderen Zahlungsweg bezahlt" in source

    webhook_block = source.split("async def invoice_payment_webhook", 1)[1]
    assert 'raise HTTPException(status_code=400, detail="Invalid Stripe webhook")' in webhook_block
    assert "Invoice webhook settlement failed" in webhook_block
    assert "from routes.dating import handle_dating_premium_webhook" not in webhook_block
    assert 'return {"received": True, "processed": False}' not in webhook_block

    # Invoice settlement must never bypass the canonical wallet engine.
    assert '"$inc": {"balance": -' not in source
    assert '"$inc": {"balance": amount' not in source
    assert '"balance": {"$gte": amount}' not in source


def test_virtual_cards_fail_closed_without_live_issuer_and_never_list_pan():
    backend = (BACKEND_DIR / "routes" / "virtual_cards.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "VirtualCardsPage.jsx").read_text(encoding="utf-8")

    assert "def _require_virtual_card_test_mode" in backend
    assert "Es werden in Production keine selbst erzeugten PAN/CVV ausgegeben" in backend
    assert '@router.get("/capabilities")' in backend
    assert '"live_issuer_connected": False' in backend
    assert '{"_id": 0, "cvv": 0, "card_number": 0}' in backend
    assert "async def _refund_legacy_card_reservation_once" in backend
    assert "debit_wallet(" in backend
    assert "credit_wallet(" in backend
    assert 'idempotency_key=f"virtual-card-create:{marker}"' in backend
    assert 'idempotency_key=f"virtual-card-refund:{marker}"' in backend
    assert 'creation_payload = {' in backend
    assert 'detail="Idempotency-Key wurde mit anderen Kartendaten verwendet"' in backend
    assert 'idempotency_key=f"virtual-card-create-rollback:{marker}"' in backend
    assert '"create_persist_failed"' in backend
    assert '"create_missing_after_persist"' in backend
    assert 'persisted = await db.virtual_cards.find_one(' in backend
    assert '"replayed": bool(wallet_result.idempotent_replay)' in backend
    assert '"$inc": {"balance": -req.limit, "reserved_balance": req.limit}' not in backend
    assert '"$inc": {"balance": amount, "reserved_balance": -amount}' not in backend
    assert '"routes.cards_lifecycle", "router"' in registry

    assert "/api/cards/capabilities" in page
    assert "/api/cards/my-cards?include_inactive=true" in page
    assert "/api/cards/create" in page
    assert "createAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page
    assert "vcard-live-issuer-unavailable" in page
    assert "card_creation_available" in page
    assert "/api/virtual-cards" not in page


def test_all_card_surfaces_are_waitlist_or_fail_closed_without_live_issuer():
    card = (BACKEND_DIR / "routes" / "card.py").read_text(encoding="utf-8")
    blitz = (BACKEND_DIR / "routes" / "blitzcard.py").read_text(encoding="utf-8")
    card_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "CardPage.jsx").read_text(encoding="utf-8")
    blitz_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BlitzCardPage.jsx").read_text(encoding="utf-8")

    assert "if req.tier == \"virtual_free\" and TEST_MODE" in card
    assert '"status": "waitlist"' in card
    assert '"issuer_live": False' in card
    assert '"is_demo": bool(TEST_MODE)' in card
    assert "production_downgraded_at" in card

    assert '@router.get("/capabilities")' in blitz
    assert '"orders_enabled": bool(TEST_MODE)' in blitz
    assert "BlitzCard-Ausgabe ist deaktiviert" in blitz
    assert "legacy_demo_card_detected" in blitz

    assert "Kartenausgabe ist derzeit" in card_page
    assert "Auf Warteliste eintragen" in card_page
    assert "blitzcard-issuer-unavailable" in blitz_page
    assert "Noch nicht verfügbar" in blitz_page


def test_gift_cards_fail_closed_without_verified_provider_and_ui_matches_backend():
    backend = (BACKEND_DIR / "routes" / "gift_cards.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "GiftCardsPage.jsx").read_text(encoding="utf-8")

    assert 'router = APIRouter(prefix="/api/gift-cards"' in backend
    assert '@router.get("/capabilities")' in backend
    assert '"live_provider_connected": False' in backend
    assert '"purchase_available": bool(TEST_MODE)' in backend
    assert "Es wurde kein Wallet-Guthaben belastet" in backend
    assert 'idempotency_key=f"gift-card:test:{user_id}:{idempotency_key}"' in backend
    assert 'idempotency_key=f"gift-card:test-rollback:{card_id}"' in backend
    assert '"is_demo": True' in backend
    assert '"routes.gift_cards", "router"' in registry
    assert '"routes.tips_gifts", "router"' not in registry

    assert "/api/gift-cards/capabilities" in page
    assert "/api/gift-cards/my" in page
    assert "/api/gift-cards/purchase" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page
    assert "giftcard-provider-unavailable" in page
    assert "capabilities.purchase_available" in page


def test_event_ticket_inventory_and_wallet_settlement_are_exactly_once():
    backend = (BACKEND_DIR / "routes" / "events.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "EventBookingPage.jsx").read_text(encoding="utf-8")

    assert "Idempotency-Key erforderlich" in backend
    assert 'ticket_id = f"EVT-{key_hash.upper()}"' in backend
    assert '"$expr": {' in backend
    assert 'marker_field = f"ticket_reservations.{marker_hash}"' in backend
    assert 'idempotency_key=f"event:payment:{ticket_id}"' in backend
    assert 'idempotency_key=f"event:organizer:{ticket_id}"' in backend
    assert 'idempotency_key=f"event:cashback:{ticket_id}"' in backend
    assert '"$setOnInsert": {' in backend
    assert '"type": "event"' in backend
    assert 'user.get("kyc_status") != "approved"' in backend

    assert "purchaseAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page


def test_legacy_ev_finder_routes_production_users_into_live_ocpp_flow():
    backend = (BACKEND_DIR / "routes" / "ladesaeulen.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "LadesaeulenPage.jsx").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")

    assert "if not TEST_MODE:" in backend
    assert '"mode": "live_ocpp"' in backend
    assert "async def _live_station_doc" in backend
    assert "Legacy-Ladevorgang ist deaktiviert" in backend
    assert "random.uniform(5, 60)" not in backend
    assert 'db.ev_charging_sessions.find(' in backend
    assert '"cost": round(float(session.get("final_cost")' in backend

    assert "station?.live_ocpp" in page
    assert "/ev/start/" in page
    assert 'mode==="live_ocpp"' in page
    assert "Live OCPP · BidBlitz Wallet" in page

    assert 'currentPath.startsWith("/ev/start/")' in app
    assert 'currentPath.startsWith("/ev/session/")' in app
    assert "<EVStartChargingPage" in app
    assert "<EVLiveSessionPage" in app


def test_supercharger_staking_is_fail_closed_without_live_provider():
    backend = (BACKEND_DIR / "routes" / "supercharger.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "SuperchargerPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/capabilities")' in backend
    assert '"live_staking_provider_connected": False' in backend
    assert '"deposit_available": bool(TEST_MODE)' in backend
    assert "Es wurden keine BLZ abgezogen" in backend
    assert '"is_demo": True' in backend
    assert '"legacy_demo_count": legacy_demo_count' in backend

    assert "/api/supercharger/capabilities" in page
    assert "capabilities.deposit_available" in page
    assert "supercharger-provider-unavailable" in page
    assert "Noch nicht verfügbar" in page


def test_stocks_are_live_market_data_only_until_broker_is_connected():
    backend = (BACKEND_DIR / "routes" / "stocks.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "StocksPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/capabilities")' in backend
    assert '"broker_connected": False' in backend
    assert '"trading_available": bool(TEST_MODE)' in backend
    assert "Live-Marktdaten sind momentan nicht verfügbar" in backend
    assert "Echter Aktienhandel ist deaktiviert" in backend
    assert "legacy_demo_holdings" in backend
    assert "legacy_demo_trades" in backend
    assert "debit_wallet(" in backend
    assert "credit_wallet(" in backend
    assert 'idempotency_key=f"stock-trade:{trade_id}:wallet"' in backend
    assert 'idempotency_key=f"stock-trade:{trade_id}:rollback"' in backend
    assert "db.stock_trade_ops.update_one" in backend
    assert '"$inc": {"balance": -total_cost}' not in backend
    assert '"$inc": {"balance": total_cost}' not in backend
    assert '"routes.stocks", "router"' in registry

    assert "/api/stocks/capabilities" in page
    assert "stocks-broker-unavailable" in page
    assert "capabilities.trading_available" in page
    assert "tradeAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page
    assert "Live-Marktdaten · Handel noch nicht aktiviert" in page


def test_unconnected_financial_products_render_fail_closed_provider_page():
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ProviderUnavailablePage.jsx").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")

    assert "ProviderUnavailablePage" in app
    for route in [
        "/bnpl", "/crypto-earn", "/crypto-baskets", "/derivatives", "/predictions",
        "/defi-wallet", "/crypto-loans", "/p2p-lending", "/trading-bot",
    ]:
        assert f'case "{route}"' in app
    assert "Keine Fake-Transaktionen" in page
    assert "weder Wallet-Guthaben noch Krypto-Bestände bewegt" in page

    # Unsafe local financial simulators stay unregistered in production runtime.
    for module in [
        "routes.bnpl", "routes.crypto_earn", "routes.crypto_baskets", "routes.derivatives",
        "routes.predictions", "routes.defi_wallet", "routes.crypto_loans",
        "routes.p2p_lending", "routes.trading_bot",
    ]:
        assert f'("{module}", "router")' not in registry


def test_savings_goals_are_planning_only_and_never_move_wallet_money():
    backend = (BACKEND_DIR / "routes" / "savings.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "SavingsPage.jsx").read_text(encoding="utf-8")

    assert '"planning_only": True' in backend
    assert '"automatic_transfers_enabled": False' in backend
    assert "Idempotency-Key erforderlich" in backend
    assert '"$setOnInsert": goal' in backend
    assert "debit_wallet" not in backend
    assert "credit_wallet" not in backend
    assert "transfer_between_wallets" not in backend
    assert '"routes.savings", "router"' in registry

    assert "/api/savings/capabilities" in page
    assert "goalAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "savings-planning-only" in page


def test_crypto_market_is_read_only_until_custody_and_exchange_are_live():
    backend = (BACKEND_DIR / "routes" / "crypto.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "CryptoWalletPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/capabilities")' in backend
    assert '"custody_connected": False' in backend
    assert '"exchange_connected": False' in backend
    assert '"trading_available": bool(TEST_MODE)' in backend
    assert "Live-Krypto-Marktdaten sind momentan nicht verfügbar" in backend
    assert "Krypto-Handel ist deaktiviert" in backend
    assert "legacy_demo_holdings" in backend
    assert "legacy_demo_transactions" in backend
    assert "debit_wallet(" in backend
    assert "credit_wallet(" in backend
    assert 'idempotency_key=f"crypto-trade:{trade_id}:wallet"' in backend
    assert 'idempotency_key=f"crypto-trade:{trade_id}:rollback"' in backend
    assert "db.crypto_trade_ops.update_one" in backend
    assert '"$inc": {"balance": -req.amount_eur}' not in backend
    assert '"$inc": {"balance": req.amount_eur}' not in backend
    assert '"routes.crypto", "router"' in registry

    assert "/api/crypto/capabilities" in page
    assert "crypto-provider-unavailable" in page
    assert "capabilities.trading_available" in page
    assert "tradeAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page
    assert "Live-Kurse · Handel noch nicht aktiviert" in page


def test_value_based_games_fail_closed_and_rewards_cashback_is_ledger_backed():
    gaming = (BACKEND_DIR / "routes" / "gaming.py").read_text(encoding="utf-8")
    casino = (BACKEND_DIR / "routes" / "casino.py").read_text(encoding="utf-8")
    arcade = (BACKEND_DIR / "routes" / "arcade.py").read_text(encoding="utf-8")
    store = (BACKEND_DIR / "routes" / "rewards_store.py").read_text(encoding="utf-8")
    rewards = (BACKEND_DIR / "routes" / "rewards.py").read_text(encoding="utf-8")
    quests = (BACKEND_DIR / "routes" / "quests.py").read_text(encoding="utf-8")
    gamification = (BACKEND_DIR / "routes" / "gamification.py").read_text(encoding="utf-8")
    rewards_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "RewardsPage.jsx").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")

    assert "Gaming-Coins mit EUR kaufen ist in Production deaktiviert" in gaming
    assert "Gaming-Coins können in Production nicht in EUR umgewandelt werden" in gaming
    assert '"value_actions_enabled": bool(TEST_MODE)' in gaming
    assert "reward_blz = max(10, req.points // 25) if TEST_MODE else 0" in gaming
    assert 'reward_blz = reward["blz"] if TEST_MODE else 0' in gaming
    assert 'reward_inc["balance_blz"] = reward_blz' in gaming

    assert "def _require_value_game_test_mode" in casino
    assert "Wertbasierte Casino-Spiele sind in Production deaktiviert" in casino
    assert '"wagering_enabled": bool(TEST_MODE)' in casino

    assert "BLZ-Einsatzspiele sind in Production deaktiviert" in arcade
    assert "BLZ-Spielbelohnungen sind in Production deaktiviert" in arcade
    assert '"value_game_enabled": bool(TEST_MODE)' in arcade

    assert 'case "/gaming":' in app
    assert 'title="Game Center"' in app
    assert 'case "/arcade":' in app
    assert 'title="Arcade & Casino"' in app
    assert "TEST_MODE_FULL_ACCESS" in app

    assert "def _require_reward_idempotency_key" in store
    assert "credit_wallet(" in store
    assert 'idempotency_key=f"rewards-store:cashback:{redemption_id}"' in store
    assert 'redemption_id = f"RWD-{marker_hash.upper()}"' in store
    assert '"$setOnInsert": history' in store
    assert '"$inc": {"balance": amount}' not in store
    assert 'daily_field = f"daily_redemption_limits.{day_key}.{reward_type}"' in store
    assert '"$expr": {' in store
    assert '{"$ifNull": [f"${daily_field}", 0]}' in store
    assert '"$inc": {"coins_balance": -cost, daily_field: 1}' in store
    assert store.count('"$inc": {"coins_balance": cost, daily_field: -1}') == 2
    assert 'detail="Einlösung wird bereits verarbeitet"' in store

    assert "def _require_random_value_rewards_test_mode" in rewards
    assert "Zufallsbasierte Rewards mit übertragbarem Wert sind in Production deaktiviert." in rewards
    assert rewards.count("_require_random_value_rewards_test_mode()") >= 3
    assert '"value_random_rewards_enabled": bool(TEST_MODE)' in rewards
    assert "remaining = max(0, limit - spins_today) if TEST_MODE else 0" in rewards
    assert "valueRandomRewardsEnabled = hub?.value_random_rewards_enabled === true" in rewards_page
    assert "reward-value-games-unavailable" in rewards_page
    assert 'title="Reward Plinko"' in app
    assert 'case "/spin-wheel":' in app
    assert 'title="Spin Wheel"' in app

    assert "BLZ-Quest-Belohnungen sind in Production deaktiviert." in quests
    assert "if not TEST_MODE:" in quests
    assert "async def _credit_quest_blz_once" in quests
    assert "quest_reward_markers" in quests
    assert '"quests.$.claimed": True' in quests
    assert 'reward_key=f"quest:{uid}:{day}:all-claimed"' in quests
    assert '{"$inc": {"balance_blz": reward}}' not in quests
    assert '{"$inc": {"balance_blz": bonus}}' not in quests
    assert 'case "/quests":' in app
    assert 'title="Quests"' in app

    assert "BLZ-Gamification-Rewards sind in Production deaktiviert." in gamification
    assert "BLZ-Achievement-Rewards sind in Production deaktiviert." in gamification
    assert gamification.count("if not TEST_MODE:") >= 4
    assert "async def _credit_gamification_blz_once" in gamification
    assert "async def _credit_challenge_rewards_once" in gamification
    assert "gamification_reward_markers" in gamification
    assert "credit_wallet(" in gamification
    assert 'idempotency_key=f"{stable}:eur"' in gamification
    assert '{"$inc": {"balance": challenge["reward_eur"]}}' not in gamification
    assert '{"$inc": {"balance_blz": challenge["reward_blz"]}}' not in gamification
    assert 'case "/challenges":' in app
    assert 'title="Challenges"' in app
    assert 'case "/achievements":' in app
    assert 'title="Achievements"' in app

def test_move_earn_value_rewards_require_verified_production_source():
    backend = (BACKEND_DIR / "routes" / "move_earn.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MoveEarnPage.jsx").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in backend
    assert '"value_rewards_enabled": bool(TEST_MODE)' in backend
    assert 'if reward_code != "checkin" and not TEST_MODE:' in backend
    assert "Move-&-Earn-Wert-Rewards sind in Production bis zur verifizierten Schrittquelle deaktiviert." in backend
    assert '"unlocked": bool(TEST_MODE and int(daily.get("accepted_steps", 0) or 0) >= threshold)' in backend
    assert "valueRewardsEnabled = status?.value_rewards_enabled === true" in page
    assert "move-value-rewards-unavailable" in page
    assert "disabled={!valueRewardsEnabled || !card.unlocked || card.claimed}" in page
    assert "disabled={!valueRewardsEnabled || !mission.completed || mission.claimed}" in page


def test_legacy_retention_and_reengage_value_paths_fail_closed():
    retention = (BACKEND_DIR / "routes" / "retention.py").read_text(encoding="utf-8")
    reengage = (BACKEND_DIR / "routes" / "reengage.py").read_text(encoding="utf-8")

    assert "Legacy-Streak-Wertbelohnungen sind deaktiviert" in retention
    assert "Legacy BLZ/EUR Exchange ist deaktiviert" in retention
    assert "Legacy-Geschenkcodes mit Wallet-Guthaben sind deaktiviert" in retention
    assert "Legacy-Geschenkcode-Einlösung ist deaktiviert" in retention
    assert retention.count("status_code=410") >= 4
    assert '"$inc": {"balance": -eur, "balance_blz": blz}' not in retention
    assert '"$inc": {"balance_blz": -blz_needed, "balance": eur}' not in retention
    assert '"$inc": {"balance": -req.amount_eur}' not in retention
    assert '"$inc": {"balance": amount}' not in retention

    assert "from core.config import TEST_MODE" in reengage
    assert "Re-Engagement-Wallet-Gutschriften und E-Mails sind in Production deaktiviert." in reengage
    assert "if req.dry_run:" in reengage
    assert "if not TEST_MODE:" in reengage
    assert "credit_wallet(" in reengage
    assert 'idempotency_key = f"reengage:{uid_str}:{reward_scope}"' in reengage
    assert "wallet_result.idempotent_replay" in reengage
    assert '"$inc": {"balance": REWARD_EUR}' not in reengage


def test_bills_and_esim_test_payments_use_canonical_wallet_and_idempotency():
    backend = (BACKEND_DIR / "routes" / "bills.py").read_text(encoding="utf-8")

    assert "from core.payment_engine import debit_wallet, TransactionType" in backend
    assert "def _require_bills_idempotency_key" in backend
    assert 'prefix="bill-pay"' in backend
    assert 'prefix="esim-purchase"' in backend
    assert "debit_wallet(" in backend
    assert 'idempotency_key=idempotency_key' in backend
    assert 'payment_id = f"BILL-{digest.upper()}"' in backend
    assert 'esim_id = f"ESIM-{digest.upper()}"' in backend
    assert '"$setOnInsert": payment' in backend
    assert '"$setOnInsert": esim' in backend
    assert '"$inc": {"balance": -req.amount}' not in backend
    assert '"$inc": {"balance": -package["price"]}' not in backend


def test_reselling_is_atomic_escrow_and_active_ui_retries_safely():
    backend = (BACKEND_DIR / "routes" / "reselling.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ResellingPage.jsx").read_text(encoding="utf-8")

    assert "Idempotency-Key erforderlich" in backend
    assert '"status": "processing"' in backend
    assert 'purchase_id = f"RSL-{marker.upper()}"' in backend
    assert 'idempotency_key=f"resell:escrow:{purchase_id}"' in backend
    assert 'idempotency_key=f"resell:seller:{purchase_id}"' in backend
    assert '"type": "resell"' in backend
    assert 'user.get("kyc_status") != "approved"' in backend
    assert '"routes.reselling", "router"' in registry
    assert "from core.config import TEST_MODE" in backend
    assert "def _require_resell_purchase_mode" in backend
    assert "Reselling-Käufe sind in Production bis zum vollständigen Escrow-/Versand-/" in backend
    assert '@router.get("/capabilities")' in backend
    assert '"purchase_enabled": bool(TEST_MODE)' in backend
    assert "_require_resell_purchase_mode()" in backend

    assert "purchaseAttemptKeyRef" in page
    assert "/api/resell/capabilities" in page
    assert "capabilities?.purchase_enabled" in page
    assert "Checkout noch nicht live" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page


def test_revenue2_legacy_marketplace_and_lottery_value_paths_are_safe():
    source = (BACKEND_DIR / "routes" / "revenue2.py").read_text(encoding="utf-8")

    assert "Legacy marketplace transfer is permanently disabled" in source
    assert "Dieser Legacy-Marketplace-Transfer ist deaktiviert" in source
    assert 'await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -total}})' not in source
    assert 'await db.users.update_one({"_id": _oid(rid)}, {"$inc": {"balance": net}})' not in source

    assert "class BuyTicketRequest(BaseModel):" in source
    assert "idempotency_key: Optional[str] = None" in source
    assert 'key = _require_revenue2_idempotency_key(req.idempotency_key, request, "lottery-buy")' in source
    assert 'purchase_id = "LOTBUY-" + hashlib.sha256(' in source
    assert "db.lottery_ticket_purchases.update_one" in source
    assert '"status": "processing"' in source
    assert 'idempotency_key=f"lottery:{purchase_id}:debit"' in source
    assert 'idempotency_key=f"lottery:{purchase_id}:refund"' in source
    assert '"status": "failed_refunded"' in source
    assert '"purchase_ids": {"$ne": purchase_id}' in source
    assert '"$addToSet": {"purchase_ids": purchase_id}' in source
    assert '"status": "drawing"' in source
    assert 'idempotency_key=f"lottery-win:{draw[\'draw_date\']}:{t[\'number\']}:{tier_name}"' in source
    assert source.count('"$inc": {"balance_blz":') == 1


def test_revenue2_premium_entitlement_precedes_bonus_credit():
    source = (BACKEND_DIR / "routes" / "revenue2.py").read_text(encoding="utf-8")
    block = source.split("async def purchase_premium", 1)[1].split('@router.post("/premium/cancel")', 1)[0]

    entitlement_pos = block.index("await db.premium_subscriptions.update_one(")
    bonus_pos = block.index('idempotency_key=f"revenue2-premium:{purchase_id}:bonus"')
    assert entitlement_pos < bonus_pos
    assert 'idempotency_key=f"revenue2-premium:{purchase_id}:eur"' in block
    assert 'idempotency_key=f"revenue2-premium:{purchase_id}:blz"' in block


def test_premium_page_uses_canonical_subscription_backend():
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "PremiumPage.jsx").read_text(encoding="utf-8")
    subscription = (BACKEND_DIR / "routes" / "subscription_system.py").read_text(encoding="utf-8")

    assert "/api/subscription/plans" in page
    assert "/api/subscription/my" in page
    assert "/api/subscription/buy" in page
    assert "/api/subscription/cancel" in page
    assert "/api/subscription/toggle-auto-renew" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert 'plan: "premium"' in page
    assert "price_monthly" in page
    assert "price_yearly" in page
    assert "/api/premium/" not in page

    assert "idempotency_key=idempotency_key" in subscription
    assert "subscription_purchase_lock" in subscription
    assert "tx_type=TransactionType.SUBSCRIPTION_RENEWAL" in subscription
    assert 'idempotency_key=f"subscription-renewal:{renewal_key}"' in subscription
    assert '"last_renewal_key": {"$ne": renewal_key}' in subscription
    assert '"$inc": {"renewal_count": 1}' in subscription
    assert 'f"renewal:{sub[\'subscription_id\']}:{renewal_key}"' in subscription
    assert 'subscription-renewed:{sub[\'subscription_id\']}:{renewal_key}' in subscription


def test_unverified_cashback_insurance_roundup_and_lottery_are_not_live_flows():
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")

    for route in ["/cashback", "/insurance", "/roundup", "/lottery"]:
        assert f'case "{route}"' in app
    assert 'title="Cashback"' in app
    assert 'title="Versicherungen"' in app
    assert 'title="Round-up Savings"' in app
    assert 'title="Lotterie"' in app

    for module in ["routes.cashback", "routes.insurance", "routes.roundup"]:
        assert f'("{module}", "router")' not in registry

    insurance = (BACKEND_DIR / "routes" / "insurance.py").read_text(encoding="utf-8")
    insurance_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "InsurancePage.jsx").read_text(encoding="utf-8")
    assert "def _require_insurance_live_provider" in insurance
    assert '"error": "insurance_provider_not_live"' in insurance
    assert "if not TEST_MODE:" in insurance
    assert 'query.update({"is_real": True, "provider_live": True})' in insurance
    assert 'idempotency_key=f"insurance-policy:{policy_id}:premium"' in insurance
    assert 'idempotency_key=f"insurance-policy:{policy_id}:cashback"' in insurance
    assert 'idempotency_key=f"insurance-claim:{claim_id}:payout"' in insurance
    assert '"$inc": {"balance": -price}' not in insurance
    assert '"$inc": {"balance": cashback}' not in insurance
    assert '"$inc": {"balance": req.payout_amount}' not in insurance
    assert '"Idempotency-Key": idempotencyKey' in insurance_page
    assert "insurance_provider_not_live" in insurance_page

    insurance = (BACKEND_DIR / "routes" / "insurance.py").read_text(encoding="utf-8")
    insurance_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "InsurancePage.jsx").read_text(encoding="utf-8")
    assert "def _require_insurance_live_provider" in insurance
    assert '"error": "insurance_provider_not_live"' in insurance
    assert "if not TEST_MODE:" in insurance
    assert 'query.update({"is_real": True, "provider_live": True})' in insurance
    assert 'idempotency_key=f"insurance-policy:{policy_id}:premium"' in insurance
    assert 'idempotency_key=f"insurance-policy:{policy_id}:cashback"' in insurance
    assert 'idempotency_key=f"insurance-claim:{claim_id}:payout"' in insurance
    assert '"$inc": {"balance": -price}' not in insurance
    assert '"$inc": {"balance": cashback}' not in insurance
    assert '"$inc": {"balance": req.payout_amount}' not in insurance
    assert '"Idempotency-Key": idempotencyKey' in insurance_page
    assert "insurance_provider_not_live" in insurance_page


def test_blitzpay_nfc_requires_authenticated_merchant_and_platform_escrow():
    source = (BACKEND_DIR / "routes" / "blitzpay.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")

    assert "Token-only NFC-Debit ist deaktiviert" in source
    assert "KYC-Verifizierung für Händler erforderlich" in source
    assert "def _verify_token_pin" in source
    assert "async def _blitzpay_platform_user_id" in source
    assert 'idempotency_key=f"blitzpay:{tx_id}:escrow"' in source
    assert 'idempotency_key=f"blitzpay:{tx_id}:merchant"' in source
    assert '"type": "blitzpay_nfc"' in source
    assert '"platform_fee": fee' in source
    assert '"routes.blitzpay", "router"' in registry


def test_mining_value_loops_are_preview_only_until_live_provider_exists():
    mining = (BACKEND_DIR / "routes" / "mining.py").read_text(encoding="utf-8")
    phase2 = (BACKEND_DIR / "routes" / "mining_phase2.py").read_text(encoding="utf-8")
    blitz = (BACKEND_DIR / "routes" / "blitz_mine.py").read_text(encoding="utf-8")
    mining_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningPage.jsx").read_text(encoding="utf-8")
    blitz_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BlitzMinePage.jsx").read_text(encoding="utf-8")
    mining_trust_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningTrustPage.jsx").read_text(encoding="utf-8")
    mining_trust_admin_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningTrustAdminPage.jsx").read_text(encoding="utf-8")
    app_source = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    auth_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuthPage.jsx").read_text(encoding="utf-8")
    server_source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")

    assert '"routes.mining", "router"' in registry
    assert '"routes.mining_phase2", "router"' in registry
    assert 'case "/mining":' in app_source
    mining_case = app_source[app_source.index('case "/mining":'):app_source.index('case "/mining-trust":')]
    assert "return isGuest" in mining_case
    assert "(isGuest && !isDemoMode)" not in mining_case
    assert '<AuthPage onBack={() => handleNavigate("/")} initialMode="login" onAuthSuccess={handleAuthSuccess} />' in mining_case
    assert "<MiningPage" in mining_case
    assert 'if (isGuest && ["/scan", "/mining", "/blitz-mine"].includes(path)) {' in app_source
    assert "Bitte anmelden, um Mining zu öffnen." in app_source
    assert 'ref.toUpperCase().startsWith("BLZ-")' in auth_page
    assert '"/api/mining/apply-referral"' in auth_page
    assert '"/api/affiliate/claim-signup-bonus"' in auth_page
    assert 'api(referralEndpoint' in auth_page

    assert "def _safe_mining_float" in mining
    assert "def _normalize_mining_wallet" in mining
    assert 'return _normalize_mining_wallet(wallet, str(user_id))' in mining
    assert 'any(str(claim.get("date") or "") == d for claim in claim_history)' in mining
    assert '{"user_id": user_id, "status": "completed"}' in mining
    assert 'candidate_code = f"BLZ-{hashlib.sha256(user_id.encode(\'utf-8\')).hexdigest()[:12].upper()}"' in mining
    assert "Mining Referral-Code konnte nicht sicher erzeugt werden" in mining
    assert '_safe_mining_float(wallet.get("total_mined"))' in mining
    assert '_safe_mining_float(user.get("balance"))' in mining
    assert 'tx["amount_blz"] = _safe_mining_float(tx.get("amount_blz"))' in mining
    assert 'tx["amount_eur"] = _safe_mining_float(tx.get("amount_eur"))' in mining

    assert "def _require_mining_value_mode" in mining
    assert '"live_mining_provider_connected": False' in mining
    assert '"ordering_enabled": True' in mining
    assert '"provider_activation_enabled": bool(TEST_MODE)' in mining
    assert '"value_actions_enabled": bool(TEST_MODE)' in mining
    assert '"reward_projection_enabled": bool(TEST_MODE)' in mining
    assert '"projection_available": bool(TEST_MODE)' in mining
    assert '"order_available": True' in mining
    assert '@router.post("/order-miner")' in mining
    assert '"status": "paid_pending_activation"' in mining
    assert '"provider_activation_status": "awaiting_verified_provider"' in mining
    assert 'idempotency_key=payment_idempotency_key' in mining
    assert "Bestellung bezahlt. Miner-Aktivierung folgt nach verifizierter Provider-Anbindung." in mining
    assert '"daily_blz": round(daily_blz, 4) if TEST_MODE else None' in mining
    assert '"recent_transactions": recent_txns if TEST_MODE else []' in mining
    assert 'return {"transactions": [], "capabilities": _mining_capabilities()}' in mining
    assert "if not TEST_MODE:" in mining
    assert "return 0" in mining
    assert "_require_mining_value_mode()" in mining
    assert '"proof_verified_live": False' in mining
    assert '"videos_verified_live": False' in mining
    assert '"active_miners": total_miners if TEST_MODE else 0' in mining
    assert '"videos": videos if TEST_MODE else []' in mining
    assert 'user.get("role") not in ("admin", "super_admin")' in mining
    assert mining.count('user.get("role") not in ("admin", "super_admin")') >= 5

    assert "from routes.mining import _require_mining_value_mode" in phase2
    assert '"listings": [], "capabilities": _mining_capabilities()' in phase2
    assert '"has_card": False' in phase2
    assert '"projects": [], "capabilities": _mining_capabilities()' in phase2
    assert '"tiers": CARD_TIERS' in phase2
    assert '"remaining_limit": round(max(0.0, card["daily_limit"] - today_spent), 2)' in phase2
    assert '"recent_transactions": recent_transactions' in phase2
    assert '_safe_mining_float(tx.get("amount_eur"))' in phase2
    assert '_safe_mining_float(tx.get("amount_blz"))' in phase2

    assert "def _require_blitz_mine_value_mode" in blitz
    assert '"value_actions_enabled": bool(TEST_MODE)' in blitz
    assert "_require_blitz_mine_value_mode()" in blitz

    assert "mining-provider-unavailable" in mining_page
    assert "miningValueEnabled" in mining_page
    assert "miningOrderEnabled" in mining_page
    assert '"/api/mining/order-miner"' in mining_page
    assert "Jetzt bestellen" in mining_page
    assert "Wallet aufladen" in mining_page
    assert "Bestellung bezahlt" in mining_page
    assert "Aktivierung folgt nach verifizierter Provider-Anbindung" in mining_page
    assert 'data-testid="mining-menu-grid"' in mining_page
    assert 'data-testid="mining-level-card"' in mining_page
    assert 'data-testid="mining-level-next-threshold"' in mining_page
    assert 'Level-Power' in mining_page
    assert 'data-testid="mining-quick-buy"' in mining_page
    assert "const MINING_TAB_CONFIG = [" in mining_page
    assert "const MINING_LEVELS = [" in mining_page
    assert 'const buyMiner = async (pkgId, billingOverride = billingType)' in mining_page
    assert 'const effectiveBilling = orderingOnly ? "onetime" : (billingOverride || "onetime");' in mining_page
    assert 'buyMiner(pkg.id, "onetime")' in mining_page
    assert 'disabled={Boolean(buying)}' in mining_page
    assert 'import { request as api } from "../services/api";' in mining_page
    assert 'const API = process.env.REACT_APP_BACKEND_URL || "";' not in mining_page
    assert 'import { request as api } from "../services/api";' in blitz_page
    assert 'const API = process.env.REACT_APP_BACKEND_URL || "";' not in blitz_page
    assert 'const API = process.env.REACT_APP_BACKEND_URL || "";' in mining_trust_page
    assert 'const API = process.env.REACT_APP_BACKEND_URL || "";' in mining_trust_admin_page
    assert 'const dash = await api("/api/mining/dashboard");' in mining_page
    assert 'api("/api/mining/transactions").catch(() => ({ transactions: dash.recent_transactions || [] }))' in mining_page
    assert 'recent_transactions: hist.transactions || dash.recent_transactions || []' in mining_page
    assert 'api("/api/mining/dashboard").catch(() => ({}))' not in mining_page
    assert 'data-testid="mining-load-error"' in mining_page
    assert 'data-testid="mining-retry-load"' in mining_page
    assert "Mining konnte nicht geladen werden" in mining_page
    assert "function miningNumber(value, fallback = 0)" in mining_page
    assert "function miningFixed(value, digits = 2, fallback = 0)" in mining_page
    assert "miningFixed(tx.amount_blz, 4)" in mining_page
    assert "miningFixed(tx.amount_eur, 2)" in mining_page
    assert "Mining-Preview: Wertfunktionen werden erst mit verifiziertem Provider aktiviert." in mining_page
    assert "Keine BLZ-/EUR-Ertragsprojektion ohne verifizierten Mining-/Settlement-Provider." in mining_page
    assert 'data-testid="mining-shop-no-projection"' in mining_page
    assert "KEINE ERTRAGSPROJEKTION" in mining_page
    assert 'data-testid="mining-claim-daily-btn"' in mining_page
    assert 'api("/api/mining/claim-daily", { method: "POST" })' in mining_page
    assert "Entdecke die BidBlitz Mining Preview. Code:" in mining_page
    assert 'disabled={buyingListing === ls.listing_id || !miningValueEnabled}' in mining_page
    assert 'disabled={buyingLaunch === p.project_id || remaining <= 0 || !miningValueEnabled}' in mining_page
    assert 'onClick={() => upgradeCard(tier.tier)} disabled={!miningValueEnabled}' in mining_page
    assert "Preview · keine BLZ-Erzeugung in Production" in mining_page
    assert "blitzmine-provider-unavailable" in blitz_page
    assert "async def _mining_auto_reward_loop" in server_source
    assert "if TEST_MODE:" in server_source
    assert "process_auto_rewards" in server_source
    assert "app.state.mining_auto_reward_task = asyncio.create_task(_mining_auto_reward_loop())" in server_source
    assert "valueActionsEnabled" in blitz_page
    assert 'disabled={!valueActionsEnabled}' in blitz_page
    assert 'valueActionsEnabled ? "Bonus holen" : "Preview"' in blitz_page


def test_mining_purchase_upgrade_and_launchpad_are_retry_safe():
    mining = (BACKEND_DIR / "routes" / "mining.py").read_text(encoding="utf-8")
    phase2 = (BACKEND_DIR / "routes" / "mining_phase2.py").read_text(encoding="utf-8")
    mining_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningPage.jsx").read_text(encoding="utf-8")
    database = (BACKEND_DIR / "core" / "database.py").read_text(encoding="utf-8")

    assert mining.count("idempotency_key: Optional[str] = None") >= 2
    assert 'payment_idempotency_key = f"mining-buy:{raw_key}"' in mining
    assert 'payment_status in {"pending", "reconciliation_required"}' in mining
    assert "Mining-Kauf benötigt Wallet-Abstimmung" in mining
    assert '"miner_id": miner_id' in mining
    assert '{"$setOnInsert": miner}' in mining
    assert '{"txn_id": purchase_id}' in mining
    assert 'idempotency_key=payment_idempotency_key' in mining

    assert "db.mining_upgrade_operations.update_one" in mining
    assert 'if operation.get("from_level") is not None:' in mining
    assert 'current_level = int(operation.get("from_level"))' in mining
    assert 'target_level = int(operation.get("to_level"))' in mining
    assert 'cost = float(operation.get("cost"))' in mining
    assert 'applied_marker = f"upgrade_applied.{operation_hash}"' in mining
    assert 'level_key: current_level' in mining
    assert 'idempotency_key=f"mining-upgrade-refund:{operation_id}"' in mining
    assert 'refund_status = "refunded" if refund.success else "reconciliation_required"' in mining
    assert '"payment_status": payment_status' in mining
    assert "Upgrade-Zahlung benötigt Abstimmung" in mining
    assert "Rückgutschrift benötigt finanzielle Abstimmung" in mining

    assert "LaunchpadBuyRequest" in phase2
    assert 'Idempotency-Key erforderlich' in phase2
    assert 'idempotency_key=idempotency_key' in phase2
    assert 'required_vip = str(project.get("min_vip") or "Bronze")' in phase2
    assert 'detail=f"VIP-Level {required_vip} erforderlich"' in phase2
    assert 'purchase.get("status") == "reconciliation_required"' in phase2
    assert 'payment_status == "reconciliation_required"' in phase2
    assert 'payment_status == "pending"' in phase2
    assert '"status": "failed"' in phase2
    assert "Frühere Launchpad-Zahlung fehlgeschlagen; bitte neuen Kaufversuch starten" in phase2
    assert "completed_purchase_missing_miner" in phase2
    assert "fulfillment_completed_purchase_finalize_not_confirmed" in phase2
    assert '"refund_error": refund.error' in phase2
    assert "Rückbuchung benötigt finanzielle Abstimmung" in phase2
    assert "class CardSpendRequest(BaseModel):" in phase2
    assert "class UpgradeCardRequest(BaseModel):" in phase2
    assert phase2.count("idempotency_key: Optional[str] = None") >= 4
    assert "db.mining_card_operations.update_one" in phase2
    assert 'card_spend_debits' in phase2
    assert 'card_spend_markers' in phase2
    assert 'card_upgrade_debits' in phase2
    assert 'card_upgrade_applied' in phase2
    assert 'card_upgrade_refunds' in phase2
    assert 'daily_spend = card.get("daily_spend_eur")' in phase2
    assert 'has_persisted_daily_spend = today in daily_spend' in phase2
    assert '"card_number": str(card.get("card_number") or "TEST •••• 0000")' in phase2
    assert '"is_demo": True' in phase2
    assert 'marketplace_listing_id' in phase2
    assert 'marketplace_listing_price_blz' in phase2
    assert 'ownership_already_applied' in phase2
    assert '"status": "reconciliation_required", "reason": "seller_credit_failed"' in phase2
    assert 'current.get("status") == "sold" and current.get("purchase_id") == purchase_id' in phase2
    assert 'await record_marketplace_transactions(now)' in phase2
    assert '"status": "cancelling"' in phase2
    assert "Listing-Cancel benötigt Abstimmung" in phase2
    assert "class FreezeCardRequest(BaseModel):" in phase2
    assert '"frozen": bool(req.frozen)' in phase2

    assert 'class WithdrawRequest(BaseModel):' in mining
    assert 'class SendBLZRequest(BaseModel):' in mining
    assert mining.count('Idempotency-Key erforderlich') >= 4
    assert 'operation_id = f"MWD-{operation_hash.upper()}"' in mining
    assert 'idempotency_key=f"mining-withdraw:{user_id}:{raw_key}"' in mining
    assert 'db.mining_transfer_operations.update_one' in mining
    assert 'sender_marker = f"transfer_out.{transfer_id}"' in mining
    assert 'recipient_marker = f"transfer_in.{transfer_id}"' in mining
    assert "BLZ-Transferzustand unklar; finanzielle Abstimmung erforderlich" in mining

    assert "minerPurchaseKeysRef" in mining_page
    assert "minerUpgradeKeysRef" in mining_page
    assert "loadMiningAttemptMap" in mining_page
    assert "persistMiningAttemptMap" in mining_page
    assert "window.sessionStorage.setItem" in mining_page
    assert "getOrCreateMiningAttemptKey" in mining_page
    assert "clearMiningAttemptKey" in mining_page
    assert "withdrawAttemptKeysRef" in mining_page
    assert "sendAttemptKeysRef" in mining_page
    assert "launchpadPurchaseKeysRef" in mining_page
    assert "cardUpgradeKeysRef" in mining_page
    assert 'body: JSON.stringify({ frozen: desiredFrozen })' in mining_page
    assert 'c.is_demo ? "Test Card" : "Card"' in mining_page
    assert mining_page.count('"Idempotency-Key": idempotencyKey') >= 7
    assert mining_page.count("idempotency_key: idempotencyKey") >= 7
    assert "shouldKeepAttemptKey" in mining_page

    assert 'db.mining_wallets, "user_id", unique=True, critical=True' in database
    assert 'db.mining_claims, [("user_id", 1), ("date", 1)], unique=True, critical=True' in database
    assert 'db.mining_referrals, "referred_id"' in database
    assert 'db.mining_referrals, "referee_id"' not in database
    assert 'db.mining_transactions, "txn_id", unique=True, critical=True' in database
    assert 'db.mining_upgrade_operations, "operation_id", unique=True, critical=True' in database
    assert 'db.mining_upgrade_operations, [("user_id", 1), ("idempotency_key", 1)], unique=True, critical=True' in database
    assert 'db.mining_transfer_operations, "transfer_id", unique=True, critical=True' in database
    assert 'db.mining_transfer_operations, [("user_id", 1), ("idempotency_key", 1)], unique=True, critical=True' in database


def _load_mobility_pricing_contract():
    source = (BACKEND_DIR / "routes" / "mobility_platform.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    wanted_names = {
        "DEFAULT_TRANSPORT_PRICING",
        "REGIONAL_PRICING_PROFILES",
        "CITY_PRICING_PROFILES",
        "CITY_NAME_ALIASES",
        "BALKAN_COUNTRY_CODES",
        "EUROPE_COUNTRY_CODES",
        "build_option",
        "_normalize_city_key",
        "_regional_profile_key_for_country",
        "_merge_pricing_profile",
        "_merge_pricing_override",
        "_resolve_pricing_context",
        "_option_price",
        "_require_supported_settlement",
    }
    selected = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            names = {target.id for target in node.targets if isinstance(target, ast.Name)}
            if names & wanted_names:
                selected.append(node)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted_names:
            selected.append(node)

    namespace = {"Optional": Optional, "HTTPException": HTTPException}
    module = ast.Module(body=selected, type_ignores=[])
    exec(compile(ast.fix_missing_locations(module), "mobility_pricing_contract", "exec"), namespace)

    async def no_dynamic_pricing_overrides(country_code, city_key):
        return None, None

    namespace["_load_dynamic_pricing_overrides"] = no_dynamic_pricing_overrides
    resolver = namespace.get("_resolve_pricing_context")
    if resolver is not None:
        resolver.__globals__["_load_dynamic_pricing_overrides"] = no_dynamic_pricing_overrides
    return namespace


def test_mobility_kosovo_regional_pricing_matches_local_profile():
    pricing = _load_mobility_pricing_contract()
    profile = pricing["REGIONAL_PRICING_PROFILES"]["XK"]
    build_option = pricing["build_option"]

    taxi = build_option("taxi", 3.4, 8, 1.2, 55, profile)
    scooter = build_option("scooter", 3.4, 8, 1.0, 86, profile)
    bike = build_option("bike", 3.4, 8, 1.0, 94, profile)
    ev = build_option("ev", 3.4, 8, 1.0, 92, profile)

    assert taxi["price_eur"] == 4.04
    assert scooter["price_eur"] == 2.00
    assert bike["price_eur"] == 1.84
    assert ev["price_eur"] == 3.89

    assert taxi["price_range_eur"] == {"low": 3.70, "high": 4.21}
    assert scooter["price_range_eur"] == {"low": 1.70, "high": 2.20}

    for option in (taxi, scooter, bike, ev):
        assert option["pricing_region"] == "Kosovo"
        assert option["pricing_basis"]
        assert option["estimated"] is True


def test_mobility_prishtina_coordinates_resolve_to_city_profile_without_geocoder():
    pricing = _load_mobility_pricing_contract()

    async def unavailable(*args, **kwargs):
        raise RuntimeError("offline")

    resolver = pricing["_resolve_pricing_context"]
    resolver.__globals__["_nominatim_get"] = unavailable
    profile = asyncio.run(resolver(42.6629, 21.1655, "Prishtina"))

    assert profile["profile_key"] == "XK:prishtina"
    assert profile["profile_scope"] == "city"
    assert profile["country_code"] == "XK"
    assert profile["city"] == "Prishtina"
    assert profile["modes"]["taxi"]["per_km"] == 0.65
    assert profile["modes"]["scooter"]["per_min"] == 0.18


def test_mobility_prizren_uses_city_profile_and_peja_falls_back_to_country():
    pricing = _load_mobility_pricing_contract()
    resolver = pricing["_resolve_pricing_context"]

    async def reverse_prizren(*args, **kwargs):
        return {
            "address": {
                "country_code": "xk",
                "country": "Kosovo",
                "city": "Prizren",
            }
        }

    resolver.__globals__["_nominatim_get"] = reverse_prizren
    prizren = asyncio.run(resolver(42.2139, 20.7397, "Prizren"))
    assert prizren["profile_key"] == "XK:prizren"
    assert prizren["profile_scope"] == "city"
    assert prizren["modes"]["taxi"]["base"] == 2.05
    assert prizren["modes"]["taxi"]["per_km"] == 0.49

    async def reverse_peja(*args, **kwargs):
        return {
            "address": {
                "country_code": "xk",
                "country": "Kosovo",
                "city": "Peja",
            }
        }

    resolver.__globals__["_nominatim_get"] = reverse_peja
    peja = asyncio.run(resolver(42.6591, 20.2883, "Peja"))
    assert peja["profile_key"] == "XK"
    assert peja["profile_scope"] == "country"
    assert peja["city"] == "Peja"
    assert peja["modes"]["taxi"]["per_km"] == 0.60


def test_mobility_hamburg_and_vienna_city_tariffs_use_official_structures():
    pricing = _load_mobility_pricing_contract()
    merge_profile = pricing["_merge_pricing_profile"]
    build_option = pricing["build_option"]

    hamburg_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["DE"],
        pricing["CITY_PRICING_PROFILES"]["DE"]["hamburg"],
    )
    hamburg = build_option("taxi", 4.0, 12, 1.0, 55, hamburg_profile)
    assert hamburg["price_eur"] == 15.30
    assert "2,70 €/km bis 9 km" in hamburg["pricing_basis"]

    vienna_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["EU"],
        pricing["CITY_PRICING_PROFILES"]["AT"]["wien"],
    )
    vienna = build_option("taxi", 4.0, 12, 1.0, 55, vienna_profile)
    assert vienna["price_eur"] == 16.56
    assert "0,58 €/min" in vienna["pricing_basis"]


def test_mobility_resolver_selects_hamburg_and_vienna_city_profiles():
    pricing = _load_mobility_pricing_contract()
    resolver = pricing["_resolve_pricing_context"]

    async def reverse_hamburg(*args, **kwargs):
        return {"address": {"country_code": "de", "country": "Deutschland", "city": "Hamburg"}}

    resolver.__globals__["_nominatim_get"] = reverse_hamburg
    hamburg = asyncio.run(resolver(53.5511, 9.9937, "Hamburg"))
    assert hamburg["profile_key"] == "DE:hamburg"
    assert hamburg["profile_scope"] == "city"
    assert hamburg["city"] == "Hamburg"

    async def reverse_vienna(*args, **kwargs):
        return {"address": {"country_code": "at", "country": "Österreich", "city": "Wien"}}

    resolver.__globals__["_nominatim_get"] = reverse_vienna
    vienna = asyncio.run(resolver(48.2082, 16.3738, "Wien"))
    assert vienna["profile_key"] == "AT:wien"
    assert vienna["profile_scope"] == "city"
    assert vienna["region"] == "Österreich"


def test_mobility_address_fallback_selects_hamburg_and_vienna_city_profiles():
    pricing = _load_mobility_pricing_contract()
    resolver = pricing["_resolve_pricing_context"]

    async def unavailable(*args, **kwargs):
        raise RuntimeError("offline")

    resolver.__globals__["_nominatim_get"] = unavailable

    hamburg = asyncio.run(resolver(53.5511, 9.9937, "Hamburg, Deutschland"))
    assert hamburg["profile_key"] == "DE:hamburg"
    assert hamburg["profile_scope"] == "city"
    assert hamburg["city"] == "Hamburg"

    vienna = asyncio.run(resolver(48.2082, 16.3738, "Wien, Österreich"))
    assert vienna["profile_key"] == "AT:wien"
    assert vienna["profile_scope"] == "city"
    assert vienna["city"] == "Wien"


def test_mobility_tirana_and_podgorica_city_profiles_use_local_market_tariffs():
    pricing = _load_mobility_pricing_contract()
    merge_profile = pricing["_merge_pricing_profile"]
    build_option = pricing["build_option"]
    require_settlement = pricing["_require_supported_settlement"]

    tirana_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["BALKANS"],
        pricing["CITY_PRICING_PROFILES"]["AL"]["tirana"],
    )
    assert tirana_profile["strict_modes"] is True
    assert set(tirana_profile["modes"]) == {"taxi"}
    tirana = build_option("taxi", 5.0, 12, 1.0, 55, tirana_profile)
    assert tirana["currency"] == "ALL"
    assert tirana["price_local"] == 600.0
    assert tirana["price_eur"] is None
    assert tirana["booking_supported"] is False
    with pytest.raises(HTTPException) as tirana_error:
        require_settlement(tirana)
    assert tirana_error.value.status_code == 503

    podgorica_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["BALKANS"],
        pricing["CITY_PRICING_PROFILES"]["ME"]["podgorica"],
    )
    podgorica = build_option("taxi", 5.0, 12, 1.0, 55, podgorica_profile)
    assert podgorica["currency"] == "EUR"
    assert podgorica["price_local"] == 4.50
    assert podgorica["price_eur"] == 4.50
    assert podgorica["price_range_eur"] == {"low": 3.50, "high": 6.00}
    assert podgorica["booking_supported"] is True


def test_mobility_tirana_and_podgorica_resolve_from_address_when_geocoder_fails():
    pricing = _load_mobility_pricing_contract()
    resolver = pricing["_resolve_pricing_context"]

    async def unavailable(*args, **kwargs):
        raise RuntimeError("offline")

    resolver.__globals__["_nominatim_get"] = unavailable

    tirana = asyncio.run(resolver(41.3275, 19.8187, "Tirana, Albania"))
    assert tirana["profile_key"] == "AL:tirana"
    assert tirana["profile_scope"] == "city"
    assert tirana["currency"] == "ALL"

    podgorica = asyncio.run(resolver(42.4304, 19.2594, "Podgorica, Montenegro"))
    assert podgorica["profile_key"] == "ME:podgorica"
    assert podgorica["profile_scope"] == "city"
    assert podgorica["currency"] == "EUR"


def test_mobility_paris_2026_regulated_profile_is_eur_bookable():
    pricing = _load_mobility_pricing_contract()
    merge_profile = pricing["_merge_pricing_profile"]
    build_option = pricing["build_option"]

    paris_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["EU"],
        pricing["CITY_PRICING_PROFILES"]["FR"]["paris"],
    )
    paris = build_option("taxi", 4.0, 12, 1.0, 55, paris_profile)
    assert paris["currency"] == "EUR"
    assert paris["price_eur"] == 13.68
    assert paris["booking_supported"] is True
    assert "1,30 €/km" in paris["pricing_basis"]


def test_mobility_paris_resolves_offline_to_city_profile():
    pricing = _load_mobility_pricing_contract()
    resolver = pricing["_resolve_pricing_context"]

    async def unavailable(*args, **kwargs):
        raise RuntimeError("offline")

    resolver.__globals__["_nominatim_get"] = unavailable
    paris = asyncio.run(resolver(48.8566, 2.3522, "Paris, France"))
    assert paris["profile_key"] == "FR:paris"
    assert paris["profile_scope"] == "city"
    assert paris["currency"] == "EUR"


def test_mobility_uae_city_fares_use_local_currency_and_fail_closed_settlement():
    pricing = _load_mobility_pricing_contract()
    merge_profile = pricing["_merge_pricing_profile"]
    build_option = pricing["build_option"]
    require_settlement = pricing["_require_supported_settlement"]

    dubai_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["AE"],
        pricing["CITY_PRICING_PROFILES"]["AE"]["dubai"],
    )
    assert dubai_profile["strict_modes"] is True
    assert set(dubai_profile["modes"]) == {"taxi"}
    dubai = build_option("taxi", 10.0, 20, 1.0, 55, dubai_profile)
    assert dubai["currency"] == "AED"
    assert dubai["price_local"] == 30.90
    assert dubai["price_range_local"] == {"low": 30.40, "high": 37.50}
    assert dubai["price_eur"] is None
    assert dubai["booking_supported"] is False
    with pytest.raises(HTTPException) as dubai_error:
        require_settlement(dubai)
    assert dubai_error.value.status_code == 503

    abu_profile = merge_profile(
        pricing["REGIONAL_PRICING_PROFILES"]["AE"],
        pricing["CITY_PRICING_PROFILES"]["AE"]["abu_dhabi"],
    )
    abu = build_option("taxi", 5.0, 10, 1.0, 55, abu_profile)
    assert abu["currency"] == "AED"
    assert abu["price_local"] == 18.10
    assert abu["price_range_local"] == {"low": 18.10, "high": 19.60}
    assert abu["price_eur"] is None
    assert abu["booking_supported"] is False


def test_mobility_uae_resolver_selects_city_profiles_even_when_geocoder_fails():
    pricing = _load_mobility_pricing_contract()
    resolver = pricing["_resolve_pricing_context"]

    async def unavailable(*args, **kwargs):
        raise RuntimeError("offline")

    resolver.__globals__["_nominatim_get"] = unavailable

    dubai = asyncio.run(resolver(25.2048, 55.2708, "Dubai, UAE"))
    assert dubai["profile_key"] == "AE:dubai"
    assert dubai["profile_scope"] == "city"
    assert dubai["currency"] == "AED"

    abu = asyncio.run(resolver(24.4539, 54.3773, "Abu Dhabi, United Arab Emirates"))
    assert abu["profile_key"] == "AE:abu_dhabi"
    assert abu["profile_scope"] == "city"
    assert abu["currency"] == "AED"


def test_mobility_search_contract_supports_local_first_autocomplete():
    backend_source = (BACKEND_DIR / "routes" / "mobility_platform.py").read_text(encoding="utf-8")
    frontend_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BidBlitzMobilityPlatformPage.jsx").read_text(encoding="utf-8")
    api_source = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "mobilityPlatformApi.js").read_text(encoding="utf-8")

    assert "country_code: Optional[str] = None" in backend_source
    assert 'params["countrycodes"] = str(country_code).lower()[:2]' in backend_source
    assert '"country_code": str(addr.get("country_code") or "").upper()' in backend_source
    assert 'limit: "10"' in api_source
    assert 'qs.set("country_code", String(countryCode).slice(0, 2))' in api_source
    assert "localResults.length < 4" in frontend_source
    assert "globalResults" in frontend_source


def test_mobility_city_tariffs_support_database_admin_overrides():
    backend_source = (BACKEND_DIR / "routes" / "mobility_platform.py").read_text(encoding="utf-8")
    database_source = (BACKEND_DIR / "core" / "database.py").read_text(encoding="utf-8")

    assert 'db.mobility_pricing_profiles.find_one' in backend_source
    assert 'country_override, city_override = await _load_dynamic_pricing_overrides' in backend_source
    assert 'resolved_profile_key = f"db:{country_code}:{city_key}"' in backend_source
    assert 'profile["dynamic_override"] = bool(country_override or city_override)' in backend_source

    assert '@router.get("/admin/pricing/profiles")' in backend_source
    assert '@router.put("/admin/pricing/profile")' in backend_source
    assert '@router.delete("/admin/pricing/profile/{country_code}")' in backend_source
    assert 'not in {"admin", "super_admin"}' in backend_source
    assert 'db.mobility_pricing_audit.insert_one' in backend_source
    assert '"$setOnInsert": {"created_at": now}' in backend_source

    assert "db.mobility_pricing_profiles" in database_source
    assert '[("country_code", 1), ("city_key", 1)]' in database_source
    assert "unique=True" in database_source
    assert "critical=True" in database_source


def test_admin_panel_navigation_contracts_are_consistent():
    sections = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "admin" / "sections.js").read_text(encoding="utf-8")
    loaders = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "admin" / "dataLoaders.js").read_text(encoding="utf-8")
    shell = (BACKEND_DIR.parent / "frontend" / "src" / "app" / "appShellFlags.js").read_text(encoding="utf-8")
    route_map = (BACKEND_DIR.parent / "frontend" / "src" / "app" / "adminRouteMap.js").read_text(encoding="utf-8")
    panel = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AdminPanelFullPage.jsx").read_text(encoding="utf-8")

    assert 'title: "Partner & Händler", color: "#F59E0B", count: 10' in sections
    assert 'title: "Marketing", color: "#F59E0B", count: 8' in sections
    assert 'title: "Lifestyle & Gesundheit", color: "#EC4899", count: 7' in sections

    assert 'nav: "/admin/audi-ticket-system"' in sections
    assert 'nav: "/admin/coupons"' in sections

    assert 'partners: "merchants"' in route_map
    assert 'auctions: "auctions"' in route_map
    assert 'bot: "auctions"' in route_map
    assert 'winners: "auctions"' in route_map
    assert '"product-stats": "analytics"' in route_map
    assert '"user-stats": "analytics"' in route_map
    assert 'discounts: "promos"' in route_map
    assert 'topup: "transactions"' in route_map
    assert 'wise: "payouts"' in route_map
    assert 'logs: "audit"' in route_map
    assert 'maintenance: "settings"' in route_map
    assert 'sustainability: "flags"' in route_map
    assert 'nav: "/real-estate"' not in sections
    assert 'nav: "/freelancer"' not in sections
    assert 'nav: "/elearning"' not in sections

    assert '"admin-immobilien": {' in loaders
    assert 'url: "/api/real-estate/listings"' in loaders
    assert '"admin-freelancer": {' in loaders
    assert 'url: "/api/freelancer/freelancers"' in loaders
    assert '"admin-elearning": {' in loaders
    assert 'url: "/api/elearning/courses"' in loaders
    assert 'const API = process.env.REACT_APP_BACKEND_URL || "";' in loaders

    assert 'function isAdminShellPath(path)' in shell
    assert '&& !isAdminShell' in shell
    assert 'coupons: "promos"' in route_map

    assert 'grid grid-cols-3 gap-2 sm:grid-cols-4' in panel
    assert 'data-testid={`admin-item-${item.key}`}' in panel

def test_admin_mobility_tariff_manager_is_wired_end_to_end():
    backend_source = (BACKEND_DIR / "routes" / "mobility_platform.py").read_text(encoding="utf-8")
    page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AdminMobilityPricingPage.jsx").read_text(encoding="utf-8")
    app_source = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    sections_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "admin" / "sections.js").read_text(encoding="utf-8")

    assert '@router.get("/admin/pricing/profiles")' in backend_source
    assert '@router.put("/admin/pricing/profile")' in backend_source
    assert '@router.delete("/admin/pricing/profile/{country_code}")' in backend_source

    assert 'data-testid="admin-mobility-pricing-page"' in page_source
    assert '/api/mobility-platform/admin/pricing/profiles' in page_source
    assert '/api/mobility-platform/admin/pricing/profile' in page_source
    assert 'method: "PUT"' in page_source
    assert 'method: "DELETE"' in page_source

    assert 'const AdminMobilityPricingPage = lazy(() => import("./pages/AdminMobilityPricingPage"));' in app_source
    assert 'case "/admin/mobility-pricing":' in app_source
    assert '<AdminMobilityPricingPage onBack={() => handleNavigate("/admin")} />' in app_source

    assert 'label: "Mobility Tarife"' in sections_source
    assert 'nav: "/admin/mobility-pricing"' in sections_source


def test_auction_polling_does_not_delete_shared_browser_caches():
    auctions_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionsPage.jsx").read_text(encoding="utf-8")
    api_source = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")
    service_worker = (BACKEND_DIR.parent / "frontend" / "public" / "service-worker.js").read_text(encoding="utf-8")

    assert "caches.delete" not in auctions_page
    assert 'getAuctions: () => request(`/api/auctions?_t=${Date.now()}`)' in api_source
    assert "'/api/auctions'," in service_worker
    assert "NEVER_CACHE_PREFIXES" in service_worker


def test_home_prioritizes_auctions_and_mining():
    home = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "HomePage.jsx").read_text(encoding="utf-8")
    mobile = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "home" / "MobileHomeContent.jsx").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    release = (BACKEND_DIR.parent / "frontend" / "src" / "config" / "release.js").read_text(encoding="utf-8")

    assert 'data-testid="home-priority-modules"' in home
    assert 'data-testid={"home-priority-" + feature.id}' in home
    assert 'id: "auctions"' in home and 'route: "/auctions"' in home
    assert 'id: "mining"' in home and 'route: "/mining"' in home
    assert 'data-testid="auctions-banner"' not in home
    assert 'filterStoreSafeItems([' in home

    assert 'id: "auctions"' in mobile and 'route: "/auctions"' in mobile
    assert 'id: "mining"' in mobile and 'route: "/mining"' in mobile
    assert 'filterStoreSafeItems([' in mobile
    assert "const getTransactionRoute = transaction =>" in mobile
    assert 'return "/mining";' in mobile
    assert 'return "/auctions";' in mobile
    assert 'return "/mobility-center";' in mobile
    assert 'onNavigate(getTransactionRoute(transaction))' in mobile

    assert 'case "/mining":' in app
    assert '<MiningPage onNavigate={handleNavigate} onBack={() => handleNavigate("/")} />' in app
    assert 'case "/auctions":' in app
    assert '{["/", "/more"].includes(routeBase) && <PWAInstallPrompt />}' in app

    assert 'import { Capacitor } from "@capacitor/core";' in release
    assert 'const isNativeRuntime = Capacitor.isNativePlatform();' in release
    assert 'process.env.REACT_APP_STORE_SAFE_MODE === "true"' in release
    assert 'isNativeRuntime;' in release


def test_mobility_map_keeps_map_visible_on_mobile():
    mobility = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BidBlitzMobilityPlatformPage.jsx").read_text(encoding="utf-8")
    center = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MobilityCenterPage.jsx").read_text(encoding="utf-8")
    shell = (BACKEND_DIR.parent / "frontend" / "src" / "app" / "appShellFlags.js").read_text(encoding="utf-8")
    mobility_backend = (BACKEND_DIR / "routes" / "mobility_platform.py").read_text(encoding="utf-8")
    mobility_api = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "mobilityPlatformApi.js").read_text(encoding="utf-8")
    auction_detail = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "AuctionDetail.jsx").read_text(encoding="utf-8")

    assert 'h-[54vh] min-h-[360px] sm:h-[56vh] lg:h-[46vh]' in mobility
    assert 'relative px-3 pt-3 z-[500] pointer-events-none sm:absolute sm:inset-x-0 sm:top-4' in mobility
    assert 'flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar' in mobility
    assert 'grid grid-cols-3 gap-2 mt-2 sm:flex sm:flex-wrap sm:mt-3' in mobility
    assert mobility.count('hidden sm:inline-flex') >= 4
    assert 'mt-3 sm:-mt-6 relative z-20 px-3 sm:px-4' in mobility
    assert 'onNavigate?.("/mobility-center")' in mobility
    assert 'const visibleMarkers = preferredMode' in mobility
    assert '.filter((item) => item.type === preferredMode)' in mobility
    assert '}, [preferredMode]);' in mobility
    assert 'function formatPrice(value, language = "de", currency = "EUR")' in mobility
    assert 'function formatCompactPrice(value, language = "de")' in mobility
    assert 'new Intl.NumberFormat(locale' in mobility
    assert 'notation: "compact"' in mobility
    assert 'formatCompactPrice(paymentOptions.wallet_balance, lang)' in mobility
    assert 'formatPrice(paymentOptions.wallet_balance, lang)' in mobility
    assert 'max-w-[44vw]' in mobility
    assert 'data-testid="mobility-pricing-context"' in mobility
    assert 'mobility-price-range-' in mobility
    assert 'data-testid="mobility-pricing-source"' in mobility
    assert 'option?.booking_supported === false || option?.price_eur == null' in mobility
    assert '"FX-Verbindung fehlt"' in mobility
    assert 'option.price_local ?? option.price_eur' in mobility
    assert 'option.pricing_basis' in mobility
    assert '.slice(0, 8).map((item, idx) =>' in mobility
    assert 'const countryCode = pickup.country_code || undefined;' in mobility
    assert 'countryCode,' in mobility

    assert '"scooter": {"base": 0.20, "per_km": 0.0, "per_min": 0.18' in mobility_backend
    assert '"basis": "ca. 0,15–0,20 €/min + mögliche Entsperrgebühr"' in mobility_backend
    assert '"taxi": {"base": 2.0, "per_km": 0.60, "per_min": 0.0' in mobility_backend
    assert 'async def _resolve_pricing_context' in mobility_backend
    assert 'pricing_context = await _resolve_pricing_context' in mobility_backend
    assert 'country_code: Optional[str] = None' in mobility_backend
    assert '"currency": "AED"' in mobility_backend
    assert '"booking_supported": eur_settlement' in mobility_backend
    assert 'if pricing_context.get("strict_modes"):' in mobility_backend
    assert 'locally_priced_modes = set((pricing_context.get("modes") or {}).keys())' in mobility_backend
    assert '_require_supported_settlement(option)' in mobility_backend
    assert 'qs.set("country_code", String(countryCode).slice(0, 2))' in mobility_api

    assert 'const [showAllBids, setShowAllBids] = useState(false);' in auction_detail
    assert 'const visibleBids = (showAllBids ? bids.slice(0, 30) : bids.slice(0, 5));' in auction_detail
    assert 'data-testid="auction-bid-history-toggle"' in auction_detail

    assert 'route: "/mobility-map?mode=taxi"' in center
    assert 'route: "/taxi"' not in center
    assert 'new Intl.NumberFormat("de-DE"' in center

    assert 'function isImmersiveMobilityMapPath(path)' in shell
    assert 'return path === "/mobility-map";' in shell
    assert 'const path = (currentPath || "/").split("?")[0];' in shell
    assert shell.count('&& !isImmersiveMobilityMap') >= 2


def test_account_deletion_is_idempotent_and_revokes_access_without_hard_delete():
    profile = (BACKEND_DIR / "routes" / "profile.py").read_text(encoding="utf-8")
    sessions = (BACKEND_DIR / "routes" / "sessions.py").read_text(encoding="utf-8")

    assert 'privacy_doc_id = f"account-deletion:{user_id}"' in profile
    assert '"$setOnInsert": privacy_request' in profile
    assert '"account_closure_status": {"$ne": "requested"}' in profile
    assert '"$inc": {"auth_version": 1}' in profile
    assert "await revoke_all_sessions(user_id)" in profile
    assert "login_disabled" in profile
    assert "retention_review_required" in profile
    assert "replayed = closure_update.modified_count == 0" in profile
    assert "delete_one({\"_id\": user[\"_id\"]})" not in profile

    assert '"$inc": {"auth_version": 1}' in sessions
    assert "await revoke_all_sessions(user_id)" in sessions

def test_revenue2_legacy_value_flows_fail_closed_in_production():
    source = (BACKEND_DIR / "routes" / "revenue2.py").read_text(encoding="utf-8")

    assert "Legacy marketplace transfer is permanently disabled" in source
    assert "Dieser Legacy-Marketplace-Transfer ist deaktiviert" in source
    assert 'status_code=410' in source
    assert 'await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -total}})' not in source
    assert 'await db.users.update_one({"_id": _oid(rid)}, {"$inc": {"balance": net}})' not in source

    assert "def _require_revenue2_lottery_test_mode" in source
    assert "Die Legacy-Lotterie ist in Production deaktiviert" in source
    assert source.count("_require_revenue2_lottery_test_mode()") >= 4
    assert 'key = _require_revenue2_idempotency_key(req.idempotency_key, request, "lottery-buy")' in source
    assert 'purchase_id = "LOTBUY-" + hashlib.sha256(' in source
    assert 'idempotency_key=f"lottery:{purchase_id}:debit"' in source
    assert 'idempotency_key=f"lottery:{purchase_id}:refund"' in source
    assert '"status": "drawing"' in source
    assert 'idempotency_key=f"lottery-win:{draw[\'draw_date\']}:{t[\'number\']}:{tier_name}"' in source
    assert source.count('"$inc": {"balance_blz":') == 1

def test_growth_rewards_and_classified_boost_use_verified_retry_safe_value_flows():
    backend = (BACKEND_DIR / "routes" / "growth.py").read_text(encoding="utf-8")
    classifieds = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ClassifiedsPage.jsx").read_text(encoding="utf-8")
    birthday = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "BirthdayBonusBanner.jsx").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in backend
    assert 'canonical_path": "/api/rewards/spin-wheel/status"' in backend
    assert "Legacy-Glücksrad deaktiviert. Verwende /api/rewards/spin-wheel/spin." in backend
    assert '"value_rewards_enabled": False' in backend
    assert 'await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": prize["value"]}})' not in backend
    assert 'await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": prize["value"]}})' not in backend

    assert 'claim_id = f"birthday:{uid}:{now.year}"' in backend
    assert 'user.get("kyc_status") != "approved"' in backend
    assert 'user.get("kyc_extracted_dob")' in backend
    assert "wallet_result = await credit_wallet(" in backend
    assert 'idempotency_key=f"birthday:{uid}:{now.year}:eur"' in backend
    assert 'blz_result = await db.users.update_one(' in backend
    assert '"status": "reconciliation_required"' in backend
    assert '"blz_error": "birthday_blz_credit_failed"' in backend
    assert "EUR wurde gutgeschrieben, BLZ-Gutschrift benötigt Abstimmung" in backend
    assert '"$inc": {"balance": BIRTHDAY_EUR, "balance_blz": BIRTHDAY_BLZ}' not in backend
    assert '"claim_available": bool(is_birthday and dob_verified and not existing)' in backend
    assert "!data.claim_available" in birthday

    assert "idempotency_key: Optional[str]" in backend
    assert "boost_payment_pending" in backend
    assert "last_boost_purchase" in backend
    assert "payment = await debit_wallet(" in backend
    assert "idempotency_key=idem_key" in backend
    assert '{"$inc": {"balance": -tier["eur"]}}' not in backend
    assert "boostAttemptKeysRef" in classifieds
    assert '"Idempotency-Key": idempotencyKey' in classifieds
    assert "idempotency_key: idempotencyKey" in classifieds

def test_live_shopping_uses_livekit_and_legacy_mock_router_is_unregistered():
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    legacy_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "LiveShoppingPage.jsx").read_text(encoding="utf-8")

    assert '("routes.live_shopping", "router")' not in registry
    assert '("routes.livekit_streaming", "router")' in registry
    assert 'case "/live-shopping":' in app
    assert "<LiveKitStreamPage" in app
    assert "window.location.replace('/livekit-stream')" in legacy_page

def test_super_app_legacy_value_routes_are_retired():
    source = (BACKEND_DIR / "routes" / "super_app_features.py").read_text(encoding="utf-8")

    assert '@router.post("/gaming/session")' in source
    assert "Legacy-Gaming-Einsätze sind deaktiviert" in source
    assert '@router.post("/creator/subscribe")' in source
    assert "Legacy-Creator-Abo-Zahlungen sind deaktiviert" in source
    assert '@router.post("/wallet/topup")' in source
    assert "Dieser Legacy-Topup ist deaktiviert" in source
    assert "/api/stripe/checkout" in source
    assert "credit_wallet(" not in source
    assert '"$inc": {"balance": -session.bet_amount}' not in source
    assert '"$inc": {"balance": -tier["monthly_price"]}' not in source
    assert '"$inc": {"balance": tier["monthly_price"] * 0.85}' not in source

def test_blitz_mine_preview_value_actions_are_exactly_once_and_retry_safe():
    backend = (BACKEND_DIR / "routes" / "blitz_mine.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BlitzMinePage.jsx").read_text(encoding="utf-8")
    database = (BACKEND_DIR / "core" / "database.py").read_text(encoding="utf-8")

    assert "def _require_blitz_idempotency_key" in backend
    assert "async def _mutate_blitz_wallet_once" in backend
    assert "blitz_mine_value_markers" in backend
    assert "db.wallets" not in backend
    assert 'selector = {"_id": user_oid, marker_field: {"$exists": False}}' in backend
    assert 'wallet = await db.users.find_one({"_id": user_oid}, {"_id": 0, "balance_blz": 1}) or {}' in backend

    assert '_require_blitz_idempotency_key(None, request, "blitz-session-start")' in backend
    assert '"session_id": session_id' in backend
    assert '"active_slot": user_id' in backend
    assert '"$unset": {"claim_lock_until": "", "active_slot": ""}' in backend
    assert '_require_blitz_idempotency_key(None, request, "blitz-boost-tap")' in backend
    assert 'marker_field = f"boost_tap_markers.{digest}"' in backend
    assert "find_one_and_update" in backend
    assert "ReturnDocument.AFTER" in backend
    assert "claim_lock_until" in backend
    assert 'profile_marker = f"claim_markers.{claim_id}"' in backend
    assert 'idempotency_key=f"blitz-session-claim:{claim_id}:earnings"' in backend
    assert 'idempotency_key=f"blitz-session-claim:{claim_id}:milestone"' in backend
    assert '"claim_state": "reconciliation_required"' in backend
    assert '"claim_result": claim_result' in backend

    assert 'idempotency_key=f"blitz-quick-bonus:{claim_id}"' in backend
    assert '"pending_claim_id": claim_id' in backend
    assert '"claim_state": "processing"' in backend
    assert "Quick Bonus wird bereits verarbeitet." in backend

    assert "idempotency_key: Optional[str] = None" in backend
    assert 'lockup_key = f"BLK-{digest.upper()}"' in backend
    assert 'idempotency_key=f"blitz-lockup-create:{lockup_key}:debit"' in backend
    assert 'idempotency_key=f"blitz-lockup-release:{stable_id}"' in backend
    assert 'item["id"] = item.get("lockup_id") or str(item.get("_id"))' in backend
    assert '"status": "releasing"' in backend
    assert 'if lk.get("status") == "reconciliation_required":' in backend
    assert 'if lk.get("status") != "releasing":' in backend
    assert '"release_error": "payout_applied_finalize_not_confirmed"' in backend
    assert "BLZ wurden genau einmal gutgeschrieben; Lockup-Abschluss benötigt Abstimmung" in backend

    assert 'createAttemptKeyRef' not in page
    assert "tapAttemptKeysRef" in page
    assert "boostAttemptKeysRef" in page
    assert "lockupAttemptKeysRef" in page
    assert "quickBonusAttemptKeysRef" in page
    assert "claimAttemptKeysRef" in page
    assert "loadBlitzAttemptMap" in page
    assert "persistBlitzAttemptMap" in page
    assert "window.sessionStorage.setItem" in page
    assert "getOrCreateBlitzAttemptKey" in page
    assert "clearBlitzAttemptKey" in page
    assert 'data-testid="lockup-preview-disabled"' in page
    assert 'valueActionsEnabled={valueActionsEnabled}' in page
    assert "shouldKeepBlitzAttemptKey" in page
    assert 'BlitzMine Test-Push ist außerhalb TEST_MODE deaktiviert.' in backend
    assert "allowTestPush={valueActionsEnabled}" in page
    assert "allowTestPush && (" in page
    assert page.count('"Idempotency-Key": idempotencyKey') >= 5
    assert 'db.blitz_mine_sessions, "session_id", unique=True, sparse=True, critical=True' in database
    assert 'db.blitz_mine_sessions, "active_slot", unique=True, sparse=True, critical=True' in database

    assert '{"$inc": {"balance_blz": earnings}' not in backend
    assert '{"$inc": {"balance_blz": milestone_bonus}' not in backend
    assert '{"$inc": {"balance_blz": reward}' not in backend
    assert '{"$inc": {"balance_blz": -req.amount}' not in backend
    assert '{"$inc": {"balance_blz": refund}' not in backend

def test_auction_production_activity_is_real_not_synthetic():
    backend = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    server = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionsPage.jsx").read_text(encoding="utf-8")

    assert '"viewer_count": random.randint(8, 35) if TEST_MODE else 0' in backend
    assert '"bot_enabled": bool(TEST_MODE or d.get("bot_only"))' in backend
    assert "Seed demo auctions only in TEST_MODE" in backend
    assert "Demo auto-restart is TEST_MODE-only" in backend
    assert "Synthetic viewer fluctuations are TEST_MODE-only" in backend
    assert "if TEST_MODE:\n                await seed_demo_auctions()" in server

    assert "Math.random()" not in page
    assert "activity.activeAuctions" in page
    assert "aktive Auktionen" in page

def test_mining_marketplace_purchase_is_atomic_and_retry_safe():
    backend = (BACKEND_DIR / "routes" / "mining_phase2.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningPage.jsx").read_text(encoding="utf-8")

    assert "idempotency_key: Optional[str] = None" in backend
    assert 'purchase_id = "MINMKT-" + hashlib.sha256(' in backend
    assert "db.mining_marketplace_purchases.update_one" in backend
    assert '"status": "processing"' in backend
    assert '"purchase_id": purchase_id' in backend
    assert '"blz_balance": {"$gte": price}' in backend
    assert 'buyer_marker = f"marketplace_purchase_markers.{purchase_id}"' in backend
    assert 'seller_marker = f"marketplace_sale_markers.{purchase_id}"' in backend
    assert '"status": "failed_refunded"' in backend
    assert '"status": "reconciliation_required"' in backend
    assert 'txn_id": f"{purchase_id}-{suffix}"' in backend
    assert '"listing_id": req.listing_id, "seller_id": user_id, "status": "active"' in backend

    assert "marketplacePurchaseKeysRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page
    assert 'clearMiningAttemptKey(marketplacePurchaseKeysRef, attemptOwnerId, "marketplace-buy", listingId)' in page
    assert 'loadMiningAttemptMap(attemptOwnerId, "marketplace-buy")' in page

def test_legacy_express_checkout_stripe_charges_are_fail_closed():
    source = (BACKEND_DIR / "routes" / "express_checkout_stripe.py").read_text(encoding="utf-8")

    assert '@router.post("/save-payment-method")' in source
    assert '@router.get("/setup-intent")' in source
    assert "stripe.SetupIntent.create(" in source

    assert '@router.post("/charge")' in source
    assert "Legacy Express-Checkout-Charge deaktiviert" in source
    assert '@router.post("/wallet-payment")' in source
    assert "Legacy Wallet-Payment-Charge deaktiviert" in source
    assert source.count("status_code=410") >= 2

    # No client-provided amount may reach a real Stripe PaymentIntent in these legacy routes.
    assert "amount=int(amount * 100)" not in source
    assert "stripe.PaymentIntent.create(" not in source

def test_seeded_audi_tickets_and_staff_placeholder_checkout_fail_closed_in_production():
    audi = (BACKEND_DIR / "routes" / "audi_tickets.py").read_text(encoding="utf-8")
    audi_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AudiTicketSalesPage.jsx").read_text(encoding="utf-8")
    staff = (BACKEND_DIR / "routes" / "staff_subscription.py").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in audi
    assert "def _require_audi_ticket_test_mode" in audi
    assert "Audi-Ticketverkauf ist in Production deaktiviert" in audi
    assert '"provider_live": False' in audi
    assert '"purchase_enabled": bool(TEST_MODE)' in audi
    assert "_require_audi_ticket_test_mode()" in audi
    assert "if not TEST_MODE:" in audi
    assert "Audi-Ticketprovider ist noch nicht live verbunden." in audi
    assert "audi-ticket-provider-unavailable" in audi_page
    assert "Provider noch nicht live" in audi_page
    assert "Keine Wallet-Belastung" in audi_page

    assert "from core.config import TEST_MODE" in staff
    assert "Staff-Abo-Checkout ist in Production deaktiviert" in staff
    assert "Es wird kein Abo ohne verifizierte Zahlung aktiviert." in staff
    assert "# TEST_MODE only: local subscription simulation" in staff

def test_staff_wallet_payouts_are_idempotent_reserved_and_provider_safe():
    source = (BACKEND_DIR / "routes" / "staff_wallet.py").read_text(encoding="utf-8")

    assert "idempotency_key: Optional[str] = None" in source
    assert 'detail="Idempotency-Key erforderlich"' in source
    assert 'payout_id = "STFPAY-" + hashlib.sha256(' in source
    assert '"status": "payout_reserved"' in source
    assert 'idempotency_key=f"staff-payout:{payout_id}"' in source
    assert '"status": "reconciliation_required"' in source
    assert "Bonusguthaben bleibt reserviert" in source
    assert 'if req.method == "sepa_manual" and not TEST_MODE:' in source
    assert 'bank_update["$unset"] = {"iban_full": ""}' in source
    assert '"iban_hash": hashlib.sha256(iban_clean.encode("utf-8")).hexdigest()' in source
    assert '"status": "wallet_paid"' in source
    assert "Für einen neuen Versuch ist ein neuer Idempotency-Key erforderlich." in source
    assert 'payout_id = str(uuid4())' not in source

def test_unsafe_legacy_cashback_and_subscription_routers_stay_unregistered():
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    legacy_subscriptions = (BACKEND_DIR / "routes" / "subscriptions.py").read_text(encoding="utf-8")
    legacy_cashback = (BACKEND_DIR / "routes" / "cashback.py").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")

    assert '"routes.subscriptions", "router"' not in registry
    assert '"routes.cashback", "router"' not in registry
    assert "db.wallet.find_one" in legacy_subscriptions
    assert '"$inc": {"balance": -plan["price"]}' in legacy_subscriptions
    assert "simulated — in production" in legacy_cashback
    assert '"$inc": {"balance": cashback_amount}' in legacy_cashback
    assert 'case "/cashback":' in app
    assert 'title="Cashback"' in app
    assert "Käufe über verifizierte Affiliate-/Merchant-Events" in app

def test_auth_does_not_issue_or_expose_fake_card_pan_in_production():
    auth = (BACKEND_DIR / "routes" / "auth.py").read_text(encoding="utf-8")
    security = (BACKEND_DIR / "core" / "security.py").read_text(encoding="utf-8")

    assert "from core.config import MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, TEST_MODE" in auth
    assert '"card_number": generate_card_number() if TEST_MODE else None' in auth
    assert '"card_expiry": generate_card_expiry() if TEST_MODE else None' in auth
    assert '"card_number": user.get("card_number", "") if TEST_MODE else ""' in security
    assert '"card_expiry": user.get("card_expiry", "") if TEST_MODE else ""' in security
    assert "secrets.randbelow(10)" in auth
    assert "random.randint(0, 9)" not in auth
    assert 'fresh_user = await db.users.find_one({"_id": result.inserted_id}) or user_doc' in auth
    assert "return serialize_user(fresh_user)" in auth
    assert "amount=WELCOME_EUR" in auth
    assert 'idempotency_key=f"welcome-bonus:{user_id}"' in auth
    assert '"balance": WELCOME_EUR' not in auth
    assert '"balance": 0.0' in auth

def test_nft_value_flows_fail_closed_until_live_provider_exists():
    backend = (BACKEND_DIR / "routes" / "nft_generator.py").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "NFTGeneratorPage.jsx").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in backend
    assert "def _require_nft_value_mode" in backend
    assert "NFT-Erzeugung, Minting und Handel sind in Production deaktiviert" in backend
    assert backend.count("_require_nft_value_mode()") >= 4
    assert '"value_actions_enabled": bool(TEST_MODE)' in backend
    assert '"live_nft_provider_connected": False' in backend
    assert '"prices": NFT_PRICES if TEST_MODE else {}' in backend
    assert '"mining_payment_enabled": False' in backend
    assert "NFT-Zahlung mit Mining-BTC ist deaktiviert" in backend
    assert "debit_wallet(" in backend
    assert "credit_wallet(" in backend
    assert "transfer_between_wallets(" in backend
    assert 'idempotency_key=f"nft-generate:{operation_id}:payment"' in backend
    assert 'idempotency_key=f"nft-generate:{operation_id}:rollback"' in backend
    assert 'idempotency_key=f"nft-buy:{purchase_id}:escrow"' in backend
    assert 'idempotency_key=f"nft-buy:{purchase_id}:seller"' in backend
    assert 'idempotency_key=f"nft-buy:{purchase_id}:refund"' in backend
    assert '"$inc": {"balance": -price_info["eur"]}' not in backend
    assert '"$inc": {"balance": -price}' not in backend
    assert '"$inc": {"balance": seller_amount}' not in backend
    assert "generateAttemptKeyRef" in page
    assert "buyAttemptKeysRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "config?.mining_payment_enabled" in page

    assert 'case "/nft":' in app
    assert 'title="NFT Studio"' in app
    assert "TEST_MODE_FULL_ACCESS" in app
    assert "Mint-/Custody-/Marketplace-Provider" in app

def test_admin_ai_cannot_execute_destructive_account_or_wallet_mutations():
    source = (BACKEND_DIR / "routes" / "admin_ai_assistant.py").read_text(encoding="utf-8")

    assert "BLOCKED_HIGH_RISK_OPERATIONS" in source
    for op in [
        "customer_ban_toggle",
        "customer_delete_by_email",
        "wallet_credit_user",
        "wallet_debit_user",
    ]:
        assert f'"{op}"' in source
        assert f'"{op}",\n' not in source.split("SUPPORTED_OPERATIONS = {", 1)[1].split("}", 1)[0]

    assert "Hochrisiko-Aktion im Admin-KI-Assistenten deaktiviert" in source
    assert "kanonischen Admin-Wallet-/Kontoverwaltungs-Pfad" in source
    assert 'await db.users.delete_one({"_id": user["_id"]})' not in source
    assert 'await db.wallets.delete_many({"user_id": str(user["_id"])})' not in source
    assert '"$inc": {"balance_blz": amount}' not in source
    assert '"$inc": {"balance_blz": -amount}' not in source
    assert 'if op_type == "customer_ban_toggle":' not in source

def test_registration_and_merchant_onboarding_do_not_escalate_normal_users():
    auth = (BACKEND_DIR / "routes" / "auth.py").read_text(encoding="utf-8")
    merchant = (BACKEND_DIR / "routes" / "merchant.py").read_text(encoding="utf-8")
    email_service = (BACKEND_DIR / "routes" / "email_service.py").read_text(encoding="utf-8")

    assert 'if role == "merchant":' in auth
    assert '"merchant_id": secrets.token_hex(8)' in auth
    assert 'business_name": display_name if role == "merchant" else' not in auth
    assert "from core.email import send_welcome_email" not in auth
    assert "notify_welcome(" in auth

    assert 'user.get("role") != "merchant"' in merchant
    assert 'merchant.get("status") != "approved"' in merchant
    assert 'detail="Freigegebenes Händlerkonto erforderlich"' in merchant
    assert "Auto-create merchant profile" not in merchant
    assert "recognized_merchant = bool(" in merchant
    assert 'detail="Händlerkonto erforderlich"' in merchant

    assert "Zahlungen, Mobilität, Marketplace und weitere freigeschaltete Dienste" in email_service
    assert "Tippe täglich auf den BlitzMine-Button" not in email_service

def test_merchant_plan_upgrade_is_idempotent_and_locked():
    source = (BACKEND_DIR / "routes" / "merchant.py").read_text(encoding="utf-8")

    assert 'raw_key = str(body.get("idempotency_key") or request.headers.get("Idempotency-Key") or "").strip()' in source
    assert 'upgrade_id = f"MERCH-UP-{key_hash.upper()}"' in source
    assert "db.merchant_plan_purchases.update_one" in source
    assert '"plan_upgrade_lock": upgrade_id' in source
    assert 'idempotency_key=f"merchant-plan:{upgrade_id}:debit"' in source
    assert '"status": "reconciliation_required"' in source
    assert '"last_plan_upgrade_id": upgrade_id' in source
    assert '"merchant_plan_purchase_ids": {"$ne": upgrade_id}' in source
    assert '"$addToSet": {"merchant_plan_purchase_ids": upgrade_id}' in source
    assert '{"_id": f"merchant-upgrade:{upgrade_id}"}' in source

def test_destructive_admin_demo_cleanup_is_post_superadmin_confirmed_and_audited():
    source = (BACKEND_DIR / "routes" / "admin.py").read_text(encoding="utf-8")

    assert '@router.post("/cleanup-fake-data")' in source
    assert '@router.get("/cleanup-fake-data")' not in source
    assert "@limiter.limit(RATE_ADMIN_ACTION)" in source
    assert 'admin.get("role") != "super_admin"' in source
    assert 'req.confirmation != "DELETE_DEMO_DATA"' in source
    assert '"admin_cleanup_demo_data"' in source

def test_duplicate_legacy_kids_money_router_stays_unmounted():
    registry = (BACKEND_DIR / "core" / "router_registry.py").read_text(encoding="utf-8")
    canonical = (BACKEND_DIR / "routes" / "kids.py").read_text(encoding="utf-8")
    legacy = (BACKEND_DIR / "routes" / "kids_system.py").read_text(encoding="utf-8")
    api = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")

    assert '"routes.kids", "router"' in registry
    assert '"routes.kids_system", "router"' not in registry
    assert '@router.post("/children/{child_id}/transfer")' in canonical
    assert "Idempotency-Key erforderlich" in canonical
    assert "kids-transfer-rollback" in canonical
    assert '@router.post("/transfer")' in legacy
    assert 'transferToChild: (childId, body, idempotencyKey = "")' in api
    assert '/api/kids/children/' in api

def test_pos_retail_cart_and_pick_routes_require_store_access():
    source = (BACKEND_DIR / "routes" / "pos_retail_p1p2.py").read_text(encoding="utf-8")

    assert 'async def apply_bulk_discounts(request: Request, cart_id: str):' in source
    assert 'await _require_store_access(user, cart["store_id"])' in source
    assert 'async def upsell_suggestions(request: Request, cart_id: str):' in source
    assert source.count('await _require_store_access(user, cart["store_id"])') >= 2
    assert 'async def pending_pick_tasks(request: Request, store_id: str):' in source
    assert 'await _require_store_access(user, store_id)' in source

def test_pos_hardware_is_store_scoped_and_production_fail_closed():
    source = (BACKEND_DIR / "routes" / "pos_hardware.py").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in source
    assert "from routes.pos_system import short_id, now_iso, _require_store_access" in source
    assert 'await _require_store_access(user, sale["store_id"])' in source
    assert 'detail="Kein echter Bondrucker für diese Filiale konfiguriert"' in source
    assert 'detail="Datei-Druck ist nur im Testmodus erlaubt"' in source
    assert 'detail="Nicht unterstützter Drucker-Typ"' in source

    assert 'store_id: str' in source
    assert 'await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})' in source
    assert '{"store_id": store_id, "barcode": barcode, "active": True}' in source

    assert 'detail="Keine echte Kassenschubladen-/Drucker-Hardware konfiguriert"' in source
    assert 'await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "cashier"})' in source

    assert 'detail="Kein verifizierter TSE-Provider für diese Filiale konfiguriert"' in source
    assert 'detail="Epson-TSE SDK noch nicht live verbunden"' in source
    assert 'detail="Swissbit-TSE SDK noch nicht live verbunden"' in source
    assert "Using cloud TSE (Fiskaly)" not in source
    assert "EPSON_TSE_PLACEHOLDER" not in source
    assert "SWISSBIT_TSE_PLACEHOLDER" not in source
    assert "response.raise_for_status()" in source

    assert 'await _require_store_access(user, scale["store_id"])' in source
    assert 'await _require_store_access(user, store_id)' in source

def test_pro_feature_preview_fees_use_payment_engine_and_tax_get_never_charges():
    source = (BACKEND_DIR / "routes" / "pro_features.py").read_text(encoding="utf-8")

    assert "from core.payment_engine import debit_wallet, credit_wallet, TransactionType" in source
    assert "def _require_pro_idempotency_key" in source
    assert "express_key = _require_pro_idempotency_key" in source
    assert "payment = await debit_wallet(" in source
    assert 'idempotency_key=f"{express_key}:rollback"' in source
    assert 'idem = _require_pro_idempotency_key(req.idempotency_key, request, "banner")' in source
    assert 'idempotency_key=f"{idem}:rollback"' in source
    assert '"$inc": {"balance": -EXPRESS_FEE}' not in source
    assert '"$inc": {"balance": -price}' not in source
    assert '"$inc": {"balance": -REPORT_FEE}' not in source
    assert "Kostenpflichtiger Steuerbericht ist deaktiviert" in source

def test_live_auctions_fail_closed_until_escrow_and_settlement_exist():
    backend = (BACKEND_DIR / "routes" / "live_auctions.py").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in backend
    assert "def _require_live_auction_test_mode" in backend
    assert "Legacy-Live-Auktionen sind in Production deaktiviert" in backend
    assert '"live_auction_enabled": bool(TEST_MODE)' in backend
    assert '"escrow_connected": False' in backend
    assert '"winner_settlement_connected": False' in backend
    assert backend.count("_require_live_auction_test_mode()") >= 3
    assert 'case "/live-auctions":' in app
    assert 'title="Live Auktionen"' in app
    assert "Escrow, Gewinnerzahlung und Settlement" in app

def test_destructive_demo_cleanup_is_disabled_in_production():
    source = (BACKEND_DIR / "routes" / "admin.py").read_text(encoding="utf-8")

    assert "from core.config import FEES, TEST_MODE" in source
    assert '@router.post("/cleanup-fake-data")' in source
    assert "Demo-Daten-Bereinigung ist in Production deaktiviert." in source
    assert "if not TEST_MODE:" in source

def test_dating_demo_escalations_are_test_mode_only():
    backend = (BACKEND_DIR / "routes" / "dating.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "DatingPage.jsx").read_text(encoding="utf-8")

    assert "from core.config import STRIPE_API_KEY, TEST_MODE" in backend
    assert "def _require_dating_demo_mode" in backend
    assert "Dating-Demoaktionen sind in Production deaktiviert." in backend
    assert backend.count("_require_dating_demo_mode()") >= 2
    assert "if not TEST_MODE:" in backend
    assert "async def maybe_seed_demo_like" in backend
    assert "seed-lina" in backend
    assert 'import { TEST_MODE } from "../config/testMode";' in page
    assert "TEST_MODE && !userProfile.verified" in page
    assert "dating-verify-demo-button" in page

def test_promo_wallet_credits_cannot_be_minted_by_merchants():
    source = (BACKEND_DIR / "routes" / "extras.py").read_text(encoding="utf-8")

    assert 'role not in {"admin", "super_admin", "merchant"}' in source
    assert 'promo_type in {"fixed", "credit"} and role not in {"admin", "super_admin"}' in source
    assert "Nur Admins dürfen Promo-Codes mit Wallet-Gutschrift erstellen." in source
    assert '"wallet_credit_approved": bool(' in source
    assert "Dieser Legacy-Promo-Code ist nicht für Wallet-Gutschriften freigegeben." in source
    assert "creator_role in {\"admin\", \"super_admin\"}" in source
    assert 'creator_email == "admin@bidblitz.ae"' in source
    assert '"$pull": {"used_by": email, "redemption_markers": marker}' in source
    assert "credit_wallet(" in source

def test_payment_engine_has_no_legacy_direct_user_balance_processor():
    source = (BACKEND_DIR / "core" / "payment_engine.py").read_text(encoding="utf-8")
    referral = (BACKEND_DIR / "routes" / "referral.py").read_text(encoding="utf-8")
    referral_system = (BACKEND_DIR / "routes" / "referral_system.py").read_text(encoding="utf-8")

    assert "Legacy central payment processor is disabled. Use canonical wallet operations." in source
    assert 'idempotency_key=f"purchase-streak:{user_id}:{milestone_key}"' in source
    assert "source=\"purchase_streak\"" in source
    assert '"$inc": {"balance": reward["amount"]}' not in source
    assert '@router.get("/my-code")' in referral
    assert '@router.get("/program/my-code")' in referral_system
    assert '@router.get("/my-code")' not in referral_system

def test_influencer_bid_credit_commissions_are_exactly_once():
    source = (BACKEND_DIR / "routes" / "influencer.py").read_text(encoding="utf-8")
    auctions = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert "from pydantic import BaseModel, Field" in source
    assert "ge=0, le=100" in source
    assert "bonus_rate: float = Field(..., ge=0, le=100" in source
    assert 'return {"ok": False, "reason": "invalid_purchase"}' in source
    assert "async def _grant_commission_credits_once" in source
    assert 'commission_id = f"COMM-{marker_hash.upper()}"' in source
    assert 'marker_field = f"influencer_commission_markers.{marker_hash}"' in source
    assert '"$setOnInsert": {' in source
    assert '"status": "pending"' in source
    assert '"status": "reconciliation_required"' in source
    assert '"status": "credited"' in source
    assert 'await _grant_commission_credits_once(' in source
    assert 'asyncio.create_task(process_commission(' in auctions

def test_referral_wallet_reward_config_is_bounded():
    source = (BACKEND_DIR / "routes" / "referral_system.py").read_text(encoding="utf-8")

    assert "new_user_bonus: Optional[float] = Field(default=None, ge=0, le=100" in source
    assert "inviter_bonus: Optional[float] = Field(default=None, ge=0, le=100" in source
    assert "daily_bonus: Optional[float] = Field(default=None, ge=0, le=100" in source
    assert "level1_rate: Optional[float] = Field(default=None, ge=0, le=1" in source
    assert "level2_rate: Optional[float] = Field(default=None, ge=0, le=1" in source

def test_dating_stripe_settlement_is_session_idempotent():
    source = (BACKEND_DIR / "routes" / "dating.py").read_text(encoding="utf-8")

    assert "async def _apply_dating_consumable(user_id: str, item_id: str, session_id: str)" in source
    assert 'marker_field = f"payment_settlement_markers.{marker_hash}"' in source
    assert 'user_marker = f"dating_payment_markers.{marker_hash}"' in source
    assert 'profile_marker = f"payment_settlement_markers.{marker_hash}"' in source
    assert '"settlement_marker": marker_hash' in source
    assert 'tx_id = f"dating-premium:{marker_hash}"' in source
    assert '"$setOnInsert": {' in source
    assert 'credits.boosts": 1, "credits.superlikes": 3' in source
    assert 'credits.boosts": 2, "credits.superlikes": 5' in source

def test_dating_checkout_creation_uses_stable_client_idempotency():
    backend = (BACKEND_DIR / "routes" / "dating.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "DatingPage.jsx").read_text(encoding="utf-8")

    assert "idempotency_key: Optional[str] = Field(default=None, min_length=8, max_length=200)" in backend
    assert "def _dating_checkout_key" in backend
    assert "async def _claim_dating_checkout_intent" in backend
    assert 'intent_id = f"dating-checkout:{checkout_hash}"' in backend
    assert '"status": "creating"' in backend
    assert '"status": "checkout_creation_uncertain"' in backend
    assert "Bitte keinen neuen Zahlungsversuch starten." in backend
    assert "checkout_url" in backend
    assert "client_idempotency_hash" in backend

    assert "getStableCheckoutKey" in page
    assert "window.sessionStorage.getItem" in page
    assert "window.sessionStorage.setItem" in page
    assert '"Idempotency-Key": attempt.key' in page
    assert "idempotency_key: attempt.key" in page
    assert "clearStableCheckoutKey(attempt.storageKey)" in page

def test_duplicate_legacy_pos_voucher_money_routes_are_retired():
    legacy = (BACKEND_DIR / "routes" / "pos_payments.py").read_text(encoding="utf-8")
    canonical = (BACKEND_DIR / "routes" / "pos_vouchers.py").read_text(encoding="utf-8")

    assert "Legacy-Gutschein-Erstellung deaktiviert." in legacy
    assert "Legacy-Gutschein-Einlösung deaktiviert." in legacy
    assert "Legacy-Gutschein-Storno deaktiviert." in legacy
    assert "/api/pos/vouchers/create" in legacy
    assert '@router.post("/redeem")' in canonical
    assert "credit_wallet(" in canonical
    assert 'raise HTTPException(status_code=503, detail="Gutschein-Gutschrift benötigt Abstimmung")' in canonical

def test_saved_card_confirmation_requires_completed_matching_setup_session():
    backend = (BACKEND_DIR / "routes" / "stripe.py").read_text(encoding="utf-8")
    wallet_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "WalletPage.jsx").read_text(encoding="utf-8")
    api = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")

    assert "class SaveCardConfirmRequest(BaseModel):" in backend
    assert 'setup_session_id={{CHECKOUT_SESSION_ID}}' in backend
    assert 'session_mode != "setup"' in backend
    assert 'session_status != "complete"' in backend
    assert "session_customer != str(cust_id)" in backend
    assert 'metadata.get("type") != "save_card"' in backend
    assert '"stripe_setup_session_id": req.session_id' in backend

    assert 'setupSessionId = walletSearchParams?.get("setup_session_id")' in wallet_page
    assert 'body: JSON.stringify({ session_id: setupSessionId })' in wallet_page
    assert 'saveCardConfirm: (sessionId)' in api

def test_stripe_router_is_single_and_not_duplicated():
    source = (BACKEND_DIR / "routes" / "stripe.py").read_text(encoding="utf-8")

    assert source.count('router = APIRouter(prefix="/api/stripe"') == 1
    assert source.count("SUPPORTED PAYMENT METHODS:") == 1
    for route in [
        '@router.get("/plans")',
        '@router.post("/checkout")',
        '@router.get("/checkout/status/{session_id}")',
        '@router.post("/webhook")',
        '@router.get("/packages")',
        '@router.get("/saved-method")',
        '@router.post("/quick-topup")',
        '@router.delete("/saved-method")',
        '@router.post("/save-card")',
        '@router.post("/save-card-confirm")',
    ]:
        assert source.count(route) == 1

def test_food_demo_cleanup_is_disabled_in_production():
    source = (BACKEND_DIR / "routes" / "food.py").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in source
    assert '@router.delete("/admin/cleanup-fake")' in source
    assert "Food-Demo-Daten-Bereinigung ist in Production deaktiviert." in source
    assert "if not TEST_MODE:" in source

def test_admin_test_email_dispatch_is_disabled_in_production():
    source = (BACKEND_DIR / "routes" / "admin.py").read_text(encoding="utf-8")

    assert '@router.post("/test-email")' in source
    assert "Test-E-Mail-Versand ist in Production deaktiviert." in source
    assert "if not TEST_MODE:" in source

def test_p2p_history_route_is_not_duplicated():
    legacy = (BACKEND_DIR / "routes" / "p2p.py").read_text(encoding="utf-8")
    transfer = (BACKEND_DIR / "routes" / "p2p_transfer.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "P2PPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/history")' in legacy
    assert '@router.get("/history")' not in transfer
    assert '@router.get("/transfer-history")' in transfer
    assert "/api/p2p/history" in page
    assert ".items || []" in page

def test_pool_paid_ticket_issuance_is_crash_recoverable():
    source = (BACKEND_DIR / "routes" / "pool_management.py").read_text(encoding="utf-8")

    assert "import hashlib" in source
    assert "from pymongo.errors import DuplicateKeyError" in source
    assert 'ticket_id = f"PTK-{digest[:16].upper()}"' in source
    assert 'ticket_code = f"POOL-{digest[16:26].upper()}"' in source
    assert '{"$setOnInsert": ticket_doc}' in source
    assert '"ticket_issued": True' in source
    issue_pos = source.index('{"$setOnInsert": ticket_doc}')
    issued_pos = source.index('"ticket_issued": True', issue_pos)
    assert issued_pos > issue_pos

def test_legacy_kids_payment_helpers_fail_closed():
    source = (BACKEND_DIR / "core" / "payment_engine.py").read_text(encoding="utf-8")
    kids = (BACKEND_DIR / "routes" / "kids.py").read_text(encoding="utf-8")

    assert "Legacy Kids transfer helper is disabled." in source
    assert "Legacy Kids payment helper is disabled." in source
    assert '@router.post("/children/{child_id}/transfer")' in kids
    assert '@router.post("/children/pay")' in kids

def test_kids_gps_simulation_is_never_available_in_production():
    source = (BACKEND_DIR / "routes" / "kids_gps.py").read_text(encoding="utf-8")

    assert '@router.post("/simulate/{child_id}")' in source
    assert "if not TEST_MODE:" in source
    assert 'if not TEST_MODE and user.get("role") != "admin":' not in source
    assert 'detail="Route nicht verfügbar"' in source

def test_role_request_routes_cannot_manage_privileged_admin_roles():
    source = (BACKEND_DIR / "routes" / "role_requests.py").read_text(encoding="utf-8")

    assert "Privilegierte Admin-Rollen dürfen nur über die kanonische Admin-Kontoverwaltung geändert werden." in source
    assert '"role": {"$nin": ["admin", "super_admin"]}' in source
    assert 'str(target.get("role") or "") in {"admin", "super_admin"}' in source
    assert 'final_role not in VALID_ROLES and final_role != "admin"' not in source
    assert 'req.new_role not in VALID_ROLES and req.new_role != "admin"' not in source

def test_verification_review_cannot_modify_privileged_admin_roles():
    source = (BACKEND_DIR / "routes" / "verification.py").read_text(encoding="utf-8")

    assert "role not in ROLES_REQUIRING_VERIFICATION" in source
    assert 'str(target_user.get("role") or "") in {"admin", "super_admin"}' in source
    assert "Privilegierte Admin-Rollen dürfen durch KYC-Review nicht geändert werden." in source
    assert '"role": {"$nin": ["admin", "super_admin"]}' in source
    assert "Rollenfreigabe konnte nicht atomar abgeschlossen werden" in source

def test_coinbase_confirmed_charge_settlement_is_retry_recoverable():
    source = (BACKEND_DIR / "routes" / "coinbase_commerce.py").read_text(encoding="utf-8")

    assert '"$inc": {"settlement_attempt": 1}' in source
    assert 'idempotency_key=f"coinbase_charge:{charge_id}:attempt:{attempt}"' in source
    assert '"settlement_status": "processing"' in source
    assert '"reconciliation_required"' in source
    assert '"wallet_credited_charge_finalize_failed"' in source
    assert "finalized.modified_count != 1" in source

def test_staff_stripe_settlement_is_atomic_and_recoverable():
    source = (BACKEND_DIR / "routes" / "staff_stripe.py").read_text(encoding="utf-8")

    assert "async def _settle_staff_checkout_once" in source
    assert '"settlement_processing": True' in source
    assert '"settlement_started_at": {"$lte": stale_before}' in source
    assert '"settlement_token": claim_token' in source
    assert 'existing.get("last_checkout_session_id") == session_id' in source
    assert "settled = await _settle_staff_checkout_once(session_id, merchant_id, plan)" in source
    assert 'raise HTTPException(status_code=503, detail="Staff subscription settlement in progress")' in source


def test_pos_feature_stripe_activation_is_exactly_once_and_recoverable():
    source = (BACKEND_DIR / "routes" / "pos_features.py").read_text(encoding="utf-8")

    assert '"status": "activating"' in source
    assert '"activation_lock": activation_token' in source
    assert '"activation_started_at": {"$lte": stale_before}' in source
    assert 'existing.get("last_purchase_session") == session_id' in source
    assert '"last_purchase_session": {"$ne": session_id}' in source
    assert '"status": "reconciliation_required"' in source
    assert '"feature-purchase:{session_id}"' in source

def test_checkout_modules_use_canonical_stripe_webhook_url():
    dating = (BACKEND_DIR / "routes" / "dating.py").read_text(encoding="utf-8")
    pool = (BACKEND_DIR / "routes" / "pool_management.py").read_text(encoding="utf-8")
    pos_features = (BACKEND_DIR / "routes" / "pos_features.py").read_text(encoding="utf-8")

    for source in [dating, pool, pos_features]:
        assert "/api/webhook/stripe" not in source
        assert "/api/stripe/webhook" in source

def test_push_and_support_routes_are_not_cross_registered_twice():
    push = (BACKEND_DIR / "routes" / "push_notifications.py").read_text(encoding="utf-8")
    web_push = (BACKEND_DIR / "routes" / "web_push.py").read_text(encoding="utf-8")
    support = (BACKEND_DIR / "routes" / "support.py").read_text(encoding="utf-8")
    support_legacy = (BACKEND_DIR / "routes" / "support_tickets.py").read_text(encoding="utf-8")

    assert '@router.get("/vapid-public-key")' not in push
    assert '@router.get("/subscription-status")' not in push
    assert '@router.post("/subscribe")' not in push
    assert '@router.delete("/unsubscribe")' not in push
    assert '@router.post("/test")' not in push
    assert '@router.get("/vapid-public-key")' in web_push
    assert '@router.get("/subscription-status")' in web_push
    assert '@router.get("/tickets/{ticket_id}")' in support
    assert '@router.post("/tickets/{ticket_id}/close")' in support
    assert '@router.get("/{ticket_id}")' not in support_legacy
    assert '@router.post("/{ticket_id}/close")' not in support_legacy

def test_admin_transactions_route_is_single_and_supports_both_admin_uis():
    admin = (BACKEND_DIR / "routes" / "admin.py").read_text(encoding="utf-8")
    management = (BACKEND_DIR / "routes" / "admin_management.py").read_text(encoding="utf-8")
    admin_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AdminPage.jsx").read_text(encoding="utf-8")
    management_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AdminManagementPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/transactions")' not in admin
    assert '@router.get("/transactions-basic")' in admin
    assert '@router.get("/transactions")' in management
    assert 'search: str = ""' in management
    assert 'txn_type: Optional[str] = None' in management
    assert 'search_term = (q or search or "").strip()' in management
    assert "effective_type = type or txn_type" in management
    assert "/api/admin/transactions?search=" in admin_page
    assert "/api/admin/transactions?" in management_page
def test_virtual_card_freeze_route_is_not_duplicated():
    virtual = (BACKEND_DIR / "routes" / "virtual_cards.py").read_text(encoding="utf-8")
    lifecycle = (BACKEND_DIR / "routes" / "cards_lifecycle.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "VirtualCardsPage.jsx").read_text(encoding="utf-8")

    assert '@router.post("/{card_id}/freeze")' not in virtual
    assert '@router.post("/{card_id}/legacy-freeze")' in virtual
    assert '@router.post("/api/cards/{card_id}/freeze")' in lifecycle
    assert '/api/cards/${card.card_id}/${action}' in page

def test_admin_wallet_stepup_otp_is_hashed_and_one_time():
    source = (BACKEND_DIR / "routes" / "admin_wallet.py").read_text(encoding="utf-8")

    assert "def _hash_admin_stepup_otp" in source
    assert '"code_hash": _hash_admin_stepup_otp(otp)' in source
    assert '"user_id": str(admin["_id"]), "code": otp' not in source
    assert 'stored_hash = str(otp_doc.get("code_hash") or "")' in source
    assert "hmac.compare_digest(stored_hash, _hash_admin_stepup_otp(str(otp_code)))" in source
    assert 'consumed = await db.otp_codes.delete_one({"_id": otp_doc["_id"]})' in source

def test_admin_financial_fee_settings_are_bounded_and_atomic():
    source = (BACKEND_DIR / "routes" / "admin.py").read_text(encoding="utf-8")

    assert "import math" in source
    assert '"payment": (0.0, 1.0)' in source
    assert '"payout_percent": (0.0, 1.0)' in source
    assert '"settlement_delay_hours": (0.0, 720.0)' in source
    assert "if not math.isfinite(value)" in source
    assert "validated = {}" in source
    assert "FEES.update(validated)" in source
    assert "Unbekannte Gebührenfelder" in source

def test_coinbase_webhook_settles_before_ack_and_recovers_stale_processing():
    source = (BACKEND_DIR / "routes" / "coinbase_commerce.py").read_text(encoding="utf-8")

    assert "BackgroundTasks" not in source
    assert "await _process_event(event_type, charge_id, charge_data)" in source
    assert 'return {"status": "processed", "event": event_type}' in source
    assert "timedelta(minutes=5)" in source
    assert '"settlement_status": "processing"' in source
    assert '"settlement_recovery_count": 1' in source
    assert 'idempotency_key=f"coinbase_charge:{charge_id}:attempt:{attempt}"' in source

def test_pos_barcode_and_nfc_wallet_payments_are_retry_and_race_safe():
    source = (BACKEND_DIR / "routes" / "pos_payments.py").read_text(encoding="utf-8")

    assert '{"_id": bc["_id"], "active": True}' in source
    assert '"payment_state": "processing"' in source
    assert '"payment_reference": reference' in source
    assert "Barcode-Zahlung wird verarbeitet oder benötigt Abstimmung" in source
    assert 'status_code=503, detail="Barcode-Zahlung wird verarbeitet oder benötigt Abstimmung"' in source
    assert "Barcode wurde bereits verwendet" in source
    assert "Händlergutschrift benötigt Abstimmung; keine automatische Rückbuchung ausgelöst." in source
    assert 'status_code=503 if debit_state in {"pending", "reconciliation_required"} else 400' in source
    assert source.count('status_code=503,\n                detail="Händlergutschrift benötigt Abstimmung; keine automatische Rückbuchung ausgelöst."') >= 2
    assert 'status_code=503 if refund_state in {"pending", "reconciliation_required"} else 500' in source

    assert "idempotency_key: Optional[str] = None" in source
    assert 'request.headers.get("Idempotency-Key")' in source
    assert 'idempotency_key=f"pos-nfc:{merchant_uid}:{key_hash}"' in source
    assert '"client_idempotency_hash": key_hash' in source
    assert "db.pos_payment_reconciliation.update_one" in source
    assert 'idempotency_key=f"refund:{customer_debit.transaction_id}"' in source
    assert "replayed = bool(customer_debit.idempotent_replay and merchant_credit_result.idempotent_replay)" in source

def test_registered_router_method_path_pairs_are_unique():
    import ast
    import re

    registry_path = BACKEND_DIR / "core" / "router_registry.py"
    registry_tree = ast.parse(registry_path.read_text(encoding="utf-8"))

    router_refs = []
    for node in ast.walk(registry_tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) or node.name != "register_all_routers":
            continue
        for stmt in node.body:
            if not isinstance(stmt, ast.Assign):
                continue
            if not any(isinstance(target, ast.Name) and target.id == "routers" for target in stmt.targets):
                continue
            if not isinstance(stmt.value, (ast.List, ast.Tuple)):
                continue
            for item in stmt.value.elts:
                if (
                    isinstance(item, ast.Tuple)
                    and len(item.elts) == 2
                    and all(isinstance(part, ast.Constant) and isinstance(part.value, str) for part in item.elts)
                ):
                    router_refs.append((item.elts[0].value, item.elts[1].value))

    assert router_refs, "router_registry.py did not expose any statically registered routers"

    verbs = {"get", "post", "put", "patch", "delete", "options", "head"}
    route_defs = {}
    unresolved = []

    def string_value(expr, constants):
        if isinstance(expr, ast.Constant) and isinstance(expr.value, str):
            return expr.value
        if isinstance(expr, ast.Name):
            return constants.get(expr.id)
        if isinstance(expr, ast.BinOp) and isinstance(expr.op, ast.Add):
            left = string_value(expr.left, constants)
            right = string_value(expr.right, constants)
            if left is not None and right is not None:
                return left + right
        return None

    for module_path, router_attr in router_refs:
        if not module_path.startswith("routes."):
            continue

        route_file = BACKEND_DIR / (module_path.replace(".", "/") + ".py")
        assert route_file.exists(), f"registered router module missing: {module_path}"

        tree = ast.parse(route_file.read_text(encoding="utf-8"))
        constants = {}
        for stmt in tree.body:
            if (
                isinstance(stmt, ast.Assign)
                and len(stmt.targets) == 1
                and isinstance(stmt.targets[0], ast.Name)
            ):
                value = string_value(stmt.value, constants)
                if value is not None:
                    constants[stmt.targets[0].id] = value

        router_prefix = None
        for stmt in tree.body:
            if not isinstance(stmt, ast.Assign):
                continue
            if not any(isinstance(target, ast.Name) and target.id == router_attr for target in stmt.targets):
                continue
            if not isinstance(stmt.value, ast.Call):
                continue
            func = stmt.value.func
            func_name = func.id if isinstance(func, ast.Name) else (func.attr if isinstance(func, ast.Attribute) else "")
            if func_name != "APIRouter":
                continue
            router_prefix = ""
            for keyword in stmt.value.keywords:
                if keyword.arg == "prefix":
                    router_prefix = string_value(keyword.value, constants)
                    break
            break

        if router_prefix is None:
            unresolved.append(f"{module_path}.{router_attr}: APIRouter prefix could not be resolved")
            continue

        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
                    continue
                owner = decorator.func.value
                if not isinstance(owner, ast.Name) or owner.id != router_attr:
                    continue
                method = decorator.func.attr.lower()
                if method not in verbs:
                    continue

                route_path = None
                if decorator.args:
                    route_path = string_value(decorator.args[0], constants)
                if route_path is None:
                    for keyword in decorator.keywords:
                        if keyword.arg in {"path", "route"}:
                            route_path = string_value(keyword.value, constants)
                            break
                if route_path is None:
                    unresolved.append(f"{module_path}.{router_attr}.{node.name}: route path could not be resolved")
                    continue

                full_path = f"{router_prefix}{route_path}"
                normalized_path = re.sub(r"\{[^{}]+\}", "{}", full_path)
                key = (method.upper(), normalized_path)
                route_defs.setdefault(key, []).append(
                    f"{module_path}.{router_attr}.{node.name} -> {method.upper()} {full_path}"
                )

    duplicates = {key: defs for key, defs in route_defs.items() if len(defs) > 1}
    assert not unresolved, "Unresolved registered routes:\n" + "\n".join(unresolved)
    assert not duplicates, "Duplicate registered routes:\n" + "\n".join(
        f"{method} {path}: " + " | ".join(defs)
        for (method, path), defs in sorted(duplicates.items())
    )

def test_birthday_blz_rewards_are_test_only():
    backend = (BACKEND_DIR / "routes" / "growth.py").read_text(encoding="utf-8")
    birthday = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "BirthdayBonusBanner.jsx").read_text(encoding="utf-8")

    assert "birthday_blz = BIRTHDAY_BLZ if TEST_MODE else 0" in backend
    assert "if birthday_blz > 0:" in backend
    assert '"$inc": {"balance_blz": birthday_blz}' in backend
    assert backend.index("if birthday_blz > 0:") < backend.index("blz_result = await db.users.update_one(")
    assert 'legacy_blz_marker = await db.users.find_one(' in backend
    assert '"blz": birthday_blz if dob_verified else 0' in backend
    assert "Number(j.blz || 0) > 0" in birthday

def test_investor_value_flows_fail_closed_without_settlement_provider():
    source = (BACKEND_DIR / "routes" / "investor.py").read_text(encoding="utf-8")

    assert "from core.config import TEST_MODE" in source
    assert "def _require_investor_settlement_mode" in source
    assert "Investor-Settlement ist in Production deaktiviert" in source
    assert source.count("_require_investor_settlement_mode()") >= 4
    assert '@router.post("/apply")' in source
    assert '@router.post("/admin/approve")' in source
    assert '@router.post("/admin/distribute-profits")' in source
    assert '@router.post("/admin/credit-payouts")' in source
    assert "TransactionType.INVESTOR_PROFIT" not in source
    assert "TransactionType.PAYOUT" in source



def test_auction_admin_permissions_include_super_admin():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert source.count('if user.get("role") not in {"admin", "super_admin"}:') >= 20
    assert 'if admin.get("role") not in {"admin", "super_admin"}:' in source
    assert source.count('if not TEST_MODE and user.get("role") not in {"admin", "super_admin"} and user.get("kyc_status") != "approved":') >= 3
    assert 'if user.get("role") != "admin":' not in source
    assert 'if user.get("role") not in ("admin",):' not in source


def test_auction_duration_contract_is_two_to_three_days():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert "duration_seconds: int = Field(default=172800, ge=172800, le=259200)" in source
    assert "default_duration_hours: int = Field(default=48, ge=48, le=72)" in source
    assert "DEFAULT_DURATION_SECONDS = 172800" in source
    assert "MAX_AUCTION_REMAINING_SECONDS = 72 * 3600" in source
    assert source.count("duration_hours: int = Field(default=48, ge=48, le=72)") >= 2
    assert "duration_hours = 48 if int(slot_index or 0) % 2 == 0 else 72" in source
    assert "duration_seconds = duration_hours * 3600" in source
    assert '"bot_final_phase_seconds": 300' in source
    assert '"bot_min_seconds": 300' in source
    assert "604800" not in source
    assert "new_duration_seconds = current_duration_seconds + extension_seconds" in source
    assert "if new_duration_seconds > 259200:" in source
    assert "Auktions-Grunddauer darf maximal 72 Stunden betragen" in source
    assert '"duration_seconds": new_duration_seconds' in source


def test_auction_admin_timer_transitions_are_atomic():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert '"status": "active",' in source
    assert '"ends_at": auction.get("ends_at")' in source
    assert '"current_price": auction.get("current_price")' in source
    assert '"last_bidder_id": auction.get("last_bidder_id")' in source
    assert '"remaining_when_paused": auction.get("remaining_when_paused")' in source
    assert "Resume wurde nicht angewendet." in source
    assert "Verlängerung wurde nicht angewendet." in source
    assert "current_remaining = max(0.0, float(auction.get(" in source
    assert '"remaining_when_paused": new_remaining' in source
    assert "Verlängerung muss zwischen 1 und 1440 Minuten liegen" in source
    assert "new_remaining > MAX_AUCTION_REMAINING_SECONDS" in source
    assert "new_ends > max_ends" in source
    assert "Auktion darf maximal 72 Stunden Restlaufzeit haben" in source


def test_auction_product_identity_freezes_after_real_bid():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    admin_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionAdminPage.jsx").read_text(encoding="utf-8")

    assert "async def _require_auction_product_editable(auction: dict) -> None:" in source
    assert '{"auction_id": auction_id, "is_bot": {"$ne": True}}' in source
    assert "Produktdaten sind nach dem ersten echten Gebot gesperrt" in source
    assert source.count("await _require_auction_product_editable(auction)") >= 2

    assert "const realBidCount = Math.max(" in admin_page
    assert "Produktdaten sind nach dem ersten echten Gebot gesperrt." in admin_page
    assert "Produktdaten nach echtem Gebot gesperrt" in admin_page
    assert "disabled={" in admin_page


def test_auction_delete_is_serialized_against_live_bids():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert '"status": "deleting"' in source
    assert '"delete_claim_id": delete_claim_id' in source
    assert '"current_price": auction.get("current_price")' in source
    assert '"ends_at": auction.get("ends_at")' in source
    assert '"last_bidder_id": auction.get("last_bidder_id")' in source
    assert "Cannot delete: {bid_count} real user bids exist" in source
    assert '"delete_claim_id": delete_claim_id' in source
    assert "await db.auto_bids.delete_many" in source
    assert "await db.watchlist.delete_many" in source


def test_auction_product_edits_lock_against_first_real_bid():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert "def _auction_product_edit_snapshot_filter" in source
    assert '"current_price": auction.get("current_price")' in source
    assert '"ends_at": auction.get("ends_at")' in source
    assert '"last_bidder_id": auction.get("last_bidder_id")' in source
    assert '"total_bids": auction.get("total_bids")' in source
    assert "Produktänderung wurde nicht angewendet." in source
    assert "Bildänderung wurde nicht angewendet." in source
    assert "filepath.unlink(missing_ok=True)" in source


def test_auction_admin_keeps_paused_auctions_resumable():
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "AuctionAdminPage.jsx").read_text(encoding="utf-8")

    assert 'const activeAuctions = auctions.filter(a => ["active", "paused"].includes(a.status));' in page
    assert 'Aktiv/Pausiert' in page
    assert 'auction.status === "paused"' in page
    assert 'onResume(auction.auction_id)' in page


def test_active_auction_list_finalizes_expired_rows():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert '@router.get("/active")' in source
    active_start = source.index('@router.get("/active")')
    active_end = source.index('@router.get("/list")', active_start)
    active = source[active_start:active_end]
    assert '{"status": "active", "ends_at": {"$lte": now_iso}}' in active
    assert 'await _finalize_auction_once(auc["auction_id"])' in active
    assert '{"status": "active", "ends_at": {"$gt": now_iso}}' in active


def test_mining_card_mutations_stay_test_only():
    source = (BACKEND_DIR / "routes" / "mining_phase2.py").read_text(encoding="utf-8")

    freeze_start = source.index('@router.post("/card/freeze")')
    freeze_end = source.index("# ══════════════════════════════════════\n# LAUNCHPAD", freeze_start)
    freeze = source[freeze_start:freeze_end]
    assert "_require_mining_value_mode()" in freeze
    assert "class FreezeCardRequest(BaseModel):" in source
    assert "set_card_freeze" in freeze
    assert '"frozen": bool(req.frozen)' in freeze


def test_mining_marketplace_listing_is_disabled_in_preview():
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningPage.jsx").read_text(encoding="utf-8")

    assert 'data-testid="list-miner-btn"' in page
    assert 'disabled={listing || !listMiner || !listPrice || !miningValueEnabled}' in page
    assert "Mining Marketplace ist in Production nur als Preview verfügbar." in page


def test_mining_legacy_wallet_normalization_is_safe():
    from routes.mining import _normalize_mining_wallet, _safe_mining_float

    normalized = _normalize_mining_wallet(
        {
            "user_id": "legacy-user",
            "blz_balance": "12.5",
            "total_mined": None,
            "total_withdrawn": "bad-value",
        },
        "legacy-user",
    )

    assert normalized["user_id"] == "legacy-user"
    assert normalized["blz_balance"] == 12.5
    assert normalized["total_mined"] == 0.0
    assert normalized["total_withdrawn"] == 0.0
    assert normalized["total_deposited"] == 0.0
    assert _safe_mining_float("7.25") == 7.25
    assert _safe_mining_float("broken", 3.0) == 3.0


def test_mining_uses_central_session_aware_api_client():
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MiningPage.jsx").read_text(encoding="utf-8")
    api = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "api.js").read_text(encoding="utf-8")

    assert 'import { request as api } from "../services/api";' in page
    assert "async function api(path, opts = {})" not in page
    assert "export async function request(path, options = {})" in api
    assert 'if (res.status === 401' in api
    assert '/api/auth/refresh' in api


def test_blitz_mine_requires_real_session_even_in_demo_mode():
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")

    start = app.index('case "/blitz-mine":')
    end = app.index('case "/legal/agb":', start)
    block = app[start:end]
    assert "return isGuest" in block
    assert "(isGuest && !isDemoMode)" not in block
    assert '<AuthPage onBack={() => handleNavigate("/")} initialMode="login" onAuthSuccess={handleAuthSuccess} />' in block


def test_live_verify_checks_mining_backend_consistency():
    source = (BACKEND_DIR.parent / "scripts" / "live_verify.py").read_text(encoding="utf-8")

    assert 'base_url + "/api/system/version"' in source
    assert '"backend belongs to expected commit"' in source
    assert 'base_url + "/api/mining/capabilities"' in source
    assert '"mining capabilities expose provider safety"' in source
    assert 'base_url + "/api/mining/packages"' in source
    assert 'base_url + "/api/mining/dashboard"' in source
    assert 'mining_dashboard["status"] in {401, 403}' in source


def test_auction_credit_purchase_unknown_wallet_state_is_retryable():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert 'payment_state = str(getattr(result.status, "value", result.status))' in source
    assert 'status_code = 503 if payment_state in {"pending", "reconciliation_required"} else 400' in source


def test_biopay_requires_verified_provider_in_production():
    backend = (BACKEND_DIR / "routes" / "biopay.py").read_text(encoding="utf-8")
    service = (BACKEND_DIR / "services" / "biopay.py").read_text(encoding="utf-8")
    panel = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "pos" / "POSBioPayPanel.jsx").read_text(encoding="utf-8")

    assert 'BIOPAY_PROVIDER_VERIFIED' in backend
    assert 'def _biopay_provider_declared()' in backend
    assert 'def _biopay_provider_verified()' in backend
    assert 'return TEST_MODE' in backend
    assert 'def _require_verified_biopay_provider()' in backend
    assert 'serverseitige Hardware-Attestation ist noch nicht verifiziert' in backend
    assert 'BioPay ist in Production ohne verifizierte biometrische Provider-/Hardware-Attestation deaktiviert.' in backend
    assert backend.count('_require_verified_biopay_provider()') >= 7
    assert 'matched = template_token_fingerprint((template_token or "").strip()) == profile.get("token_fingerprint")' in service
    assert 'score = 0.99 if matched else 0.12' in service
    assert '"health_status": "test_healthy" if TEST_MODE else "unverified"' in service
    assert '"diagnostic_score": 100.0 if TEST_MODE else 0.0' in service
    assert '"hardware_verified": False' in service
    assert '"attestation_status": "test_mode" if TEST_MODE else "unverified"' in service

    assert 'REACT_APP_BIOPAY_PROVIDER_VERIFIED' in panel
    assert 'const BIOPAY_PROVIDER_DECLARED' in panel
    assert 'const BIOPAY_PROVIDER_VERIFIED = TEST_MODE;' in panel
    assert 'serverseitige Hardware-Attestation ist noch nicht verifiziert' in panel
    assert 'data-testid="pos-biopay-preview-disabled"' in panel
    assert 'Biometrische Zahlungen sind in Production ohne verifizierte Provider-/Hardware-Attestation deaktiviert.' in panel
