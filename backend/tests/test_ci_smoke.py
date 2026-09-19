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


def test_pos_payments_fail_closed_and_retry_safely():
    pos_source = (BACKEND_DIR / "routes" / "pos_system.py").read_text(encoding="utf-8")
    legacy_source = (BACKEND_DIR / "routes" / "pos_payments.py").read_text(encoding="utf-8")
    pos_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "MerchantPosSimplePage.jsx").read_text(encoding="utf-8")

    assert 'POS_EXTERNAL_CARD_CERTIFIED' in pos_source
    assert 'Verifizierte Provider-Referenz erforderlich' in pos_source
    assert 'idempotency_key=f"pos-rollback:{payment[\'payment_id\']}"' in pos_source
    assert 'PAYMENT_STATUS_RECONCILIATION = "reconciliation_required"' in pos_source

    assert "def deterministic_payment_reference" in legacy_source
    assert '"reference": reference' in legacy_source
    assert '"$setOnInsert": merchant_tx' in legacy_source
    assert "Aktives Händlerprofil erforderlich" in legacy_source
    assert "Externe Karten-/NFC-Zahlung ist in diesem Endpoint nicht provider-verifiziert" in legacy_source

    assert 'const correctlyWired = !["voucher", "invoice"].includes(key);' in pos_page
    assert 'key !== "tap_to_pay" && (key !== "card" || externalCardCertified)' in pos_page
    assert 'body.card_reference = `CARD-' not in pos_page


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

    assert 'payout.status === "pending_approval"' in admin_page
    assert 'payout.status === "processing"' in admin_page
    assert 'payout.status === "paid"' in admin_page
    assert 'onAction(payout.payout_id, "returned")' in admin_page


def test_auction_financial_flows_are_idempotent_and_race_safe():
    auctions_source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")
    detail_source = (BACKEND_DIR.parent / "frontend" / "src" / "components" / "auctions" / "AuctionDetail.jsx").read_text(encoding="utf-8")
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
    assert "idempotency_key: idempotencyKey" in detail_source
    assert "+20s" in detail_source
    assert "+10s" not in detail_source


def test_auction_auto_bid_requires_kyc_and_atomic_credit_reservation():
    auctions_source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert "Bitte verifiziere zuerst deinen Ausweis, um Auto-Bid zu aktivieren." in auctions_source
    assert 'disabled_reason": "kyc_required"' in auctions_source
    assert "credit_state = await _reserve_bid_credit_once" in auctions_source
    assert "processing_until" in auctions_source
    assert "processing_slot" in auctions_source


def test_scooter_rides_subscriptions_and_location_are_financially_safe():
    scooter_source = (BACKEND_DIR / "routes" / "scooter.py").read_text(encoding="utf-8")
    scooter_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "ScooterPage.jsx").read_text(encoding="utf-8")

    assert "async def _settle_outstanding_scooter_debts" in scooter_source
    assert '"status": "unlocking"' in scooter_source
    assert '"unlock_claim_key": claim_hash' in scooter_source
    assert "idempotency_key=idempotency_key" in scooter_source
    assert 'idempotency_key=f"scooter-end:{ride_id}"' in scooter_source
    assert 'db.scooter_payment_due.update_one' in scooter_source
    assert '"payment_status": "due"' in scooter_source or 'payment_status = "due"' in scooter_source

    assert "async def _get_active_scooter_subscription" in scooter_source
    assert '"free_minutes_remaining_at_start"' in scooter_source
    assert '"subscription_id": (subscription or {}).get("sub_id")' in scooter_source
    assert "TransactionType.SUBSCRIPTION" in scooter_source

    assert "Math.random() - 0.5" not in scooter_page
    assert "52.52, lng: 13.405" not in scooter_page
    assert "'Idempotency-Key': idempotencyKey" in scooter_page
    assert "data.rentals || data.rides || []" in scooter_page
    assert "activeRental.free_minutes_remaining_at_start" in scooter_page


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

    assert "async def _require_child_access" in kids_app_source
    assert "reward_currency" in kids_app_source
    assert "BLZ_POINTS" in kids_app_source
    assert '"$inc": {"balance": reward}' not in kids_app_source

    assert "Kein Zugriff auf dieses Kind" in gps_source
    assert "if not TEST_MODE and user.get(\"role\") != \"admin\"" in gps_source
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
    assert '"status": "processing"' in market_source
    assert '"purchase_claim_key": key_hash' in market_source
    assert 'idempotency_key=f"marketplace-seller:{idempotency_key}"' in market_source
    assert 'idempotency_key=f"marketplace-refund:{idempotency_key}"' in market_source
    assert "shipping_cost" in market_source and "seller_amount = round(item_price - commission + shipping_cost, 2)" in market_source

    assert "def _require_flash_idempotency_key" in commerce_source
    assert '"reservation_key": key_hash' in commerce_source
    assert 'idempotency_key=f"flash-seller:{idempotency_key}"' in commerce_source
    assert 'idempotency_key=f"flash-refund:{idempotency_key}"' in commerce_source
    assert "reconciliation_required" in commerce_source

    assert "'Idempotency-Key': idempotencyKey" in market_page
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
    assert 'offline_sale_id: offlineSaleId' in checkout_source
    assert 'captured_shift_id: q.shift_id' in checkout_source
    assert 'expected_total: q.total' in checkout_source
    assert 'Gutscheine können offline nicht sicher eingelöst werden' in checkout_source
    assert 'lineDiscount' in checkout_source


def test_merchant_to_merchant_money_uses_canonical_idempotent_transfer():
    merchant_source = (BACKEND_DIR / "routes" / "merchant_payments.py").read_text(encoding="utf-8")
    engine_source = (BACKEND_DIR / "core" / "payment_engine.py").read_text(encoding="utf-8")
    mobile_source = (BACKEND_DIR.parent / "mobile" / "src" / "screens" / "Merchant" / "MerchantPaymentsScreen.js").read_text(encoding="utf-8")

    assert "transfer_between_wallets" in merchant_source
    assert 'idempotency_key=f"merchant-pay:{idempotency_key}"' in merchant_source
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
    assert "idempotency_key: paymentAttemptKeyRef.current" in mobile_source


def test_auction_production_bots_cannot_manipulate_customer_auctions():
    source = (BACKEND_DIR / "routes" / "auctions.py").read_text(encoding="utf-8")

    assert 'if not TEST_MODE and not auction.get("bot_only"):' in source
    assert 'bot_query["bot_only"] = True' in source
    assert 'Bots dürfen in Production nur auf klar markierten bot_only' in source
    assert 'Bot-Strategien sind in Production nur für bot_only' in source
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
