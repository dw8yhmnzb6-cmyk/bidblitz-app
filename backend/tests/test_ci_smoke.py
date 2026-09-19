import inspect
import os
import sys
import uuid
from pathlib import Path

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


def test_auth_register_and_login_contract(client):
    email = f"ci_smoke_{uuid.uuid4().hex[:8]}@test.com"

    register = client.post(
        "/api/auth/register",
        json={"name": "CI Smoke", "email": email, "password": "password123"},
    )
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


def test_taxi_customer_driver_wallet_flow_stays_unified():
    taxi_source = (BACKEND_DIR / "routes" / "taxi.py").read_text(encoding="utf-8")
    driver_source = (BACKEND_DIR / "routes" / "driver_dashboard.py").read_text(encoding="utf-8")
    taxi_api_source = (BACKEND_DIR.parent / "frontend" / "src" / "services" / "taxiApi.js").read_text(encoding="utf-8")
    taxi_page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "TaxiPage.jsx").read_text(encoding="utf-8")
    driver_page_source = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "DriverDashboardPage.jsx").read_text(encoding="utf-8")

    assert "async def _pending_customer_rides" in driver_source
    assert "requests = await _pending_customer_rides(driver" in driver_source
    assert '"ride_id": request_id' in driver_source
    assert '"driver_id": None' in driver_source
    assert "from routes.taxi import driver_arriving, driver_start_ride, driver_end_ride, cancel_ride" in driver_source
    assert "result = await driver_end_ride(action, request)" in driver_source

    assert '"payment_status": "reserved"' in taxi_source
    assert '"payment_reserved_amount": round(fare_total, 2)' in taxi_source
    assert 'payment_source = "reserved_at_booking"' in taxi_source
    assert 'pricing_source = "locked_booking_quote"' in taxi_source
    assert "fare_estimate = apply_multi_tariff" in taxi_source
    assert "claim.modified_count != 1" in taxi_source

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

    assert "_ensure_wallet_write_allowed(user)" in handle_source
    assert "_require_idempotency_key(req.idempotency_key, request)" in handle_source
    assert "idempotency_key=idempotency_key" in handle_source

    assert '"Idempotency-Key": idempotencyKey' in send_page
    assert "idempotency_key: idempotencyKey" in send_page
    assert "'Idempotency-Key': idempotencyKey" in handle_page
    assert "idempotency_key: idempotencyKey" in handle_page
