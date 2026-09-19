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
    pending_insert = auth_source[auth_source.index("await db.pending_2fa.insert_one"):auth_source.index("# Send OTP email")]
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
