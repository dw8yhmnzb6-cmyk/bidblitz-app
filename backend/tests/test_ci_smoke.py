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
    taxi_model_source = (BACKEND_DIR / "models" / "taxi.py").read_text(encoding="utf-8")
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
    assert 'if not TEST_MODE and user.get("role") != "admin":' in gps
    assert '@router.post("/simulate/{child_id}")' in gps
    assert "canSimulateLocation" in gps_ui
    assert 'process.env.NODE_ENV !== "production"' in gps_ui

    assert "await require_kids_entitlement(parent_id)" in controls
    assert "await require_kids_entitlement(str(child.get("parent_id") or ""))" in app
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
    assert "canonical_close_ticket" in legacy
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
    backend = (BACKEND_DIR / "routes" / "push_notifications.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "NotificationSettingsPage.jsx").read_text(encoding="utf-8")

    assert '@router.get("/subscription-status")' in backend
    assert '"subscribed": count > 0' in backend
    assert '@router.delete("/unsubscribe")' in backend
    assert '"$setOnInsert": {"created_at": now}' in backend
    assert "subscription.model_dump()" in backend

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
    assert '"routes.stocks", "router"' in registry

    assert "/api/stocks/capabilities" in page
    assert "stocks-broker-unavailable" in page
    assert "capabilities.trading_available" in page
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
    assert "keine Wallet-Guthaben noch Krypto-Bestände bewegt" in page

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
    assert '"routes.crypto", "router"' in registry

    assert "/api/crypto/capabilities" in page
    assert "crypto-provider-unavailable" in page
    assert "capabilities.trading_available" in page
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
    assert 'case "/quests":' in app
    assert 'title="Quests"' in app

    assert "BLZ-Gamification-Rewards sind in Production deaktiviert." in gamification
    assert "BLZ-Achievement-Rewards sind in Production deaktiviert." in gamification
    assert gamification.count("if not TEST_MODE:") >= 4
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

    assert "def _require_retention_value_mode" in retention
    assert retention.count("_require_retention_value_mode()") >= 4
    assert '"value_actions_enabled": bool(TEST_MODE)' in retention
    assert '"buy_rate": RATE_BLZ_PER_EUR_BUY if TEST_MODE else None' in retention
    assert '"sell_rate": RATE_BLZ_PER_EUR_SELL if TEST_MODE else None' in retention

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

    assert "purchaseAttemptKeyRef" in page
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

    assert "def _require_mining_value_mode" in mining
    assert '"live_mining_provider_connected": False' in mining
    assert '"value_actions_enabled": bool(TEST_MODE)' in mining
    assert "if not TEST_MODE:" in mining
    assert "return 0" in mining
    assert "_require_mining_value_mode()" in mining
    assert '"proof_verified_live": False' in mining

    assert "from routes.mining import _require_mining_value_mode" in phase2
    assert '"listings": [], "capabilities": _mining_capabilities()' in phase2
    assert '"has_card": False' in phase2
    assert '"projects": [], "capabilities": _mining_capabilities()' in phase2

    assert "def _require_blitz_mine_value_mode" in blitz
    assert '"value_actions_enabled": bool(TEST_MODE)' in blitz
    assert "_require_blitz_mine_value_mode()" in blitz

    assert "mining-provider-unavailable" in mining_page
    assert "miningValueEnabled" in mining_page
    assert "BlitzMine Preview" in mining_page
    assert "blitzmine-provider-unavailable" in blitz_page
    assert "valueActionsEnabled" in blitz_page


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
 + '{daily_field}", 0]}' in store
    assert '"$inc": {"coins_balance": -cost, daily_field: 1}' in store
    assert store.count('"$inc": {"coins_balance": cost, daily_field: -1}') == 2
    assert 'detail="Einlösung wird bereits verarbeitet"' in store

    rewards = (BACKEND_DIR / "routes" / "rewards.py").read_text(encoding="utf-8")
    rewards_page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "RewardsPage.jsx").read_text(encoding="utf-8")
    app = (BACKEND_DIR.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    assert "def _require_random_value_rewards_test_mode" in rewards
    assert "Zufallsbasierte Rewards mit übertragbarem Wert sind in Production deaktiviert." in rewards
    assert rewards.count("_require_random_value_rewards_test_mode()") >= 3
    assert '"value_random_rewards_enabled": bool(TEST_MODE)' in rewards
    assert '"remaining": remaining' in rewards
    assert "remaining = max(0, limit - spins_today) if TEST_MODE else 0" in rewards
    assert "valueRandomRewardsEnabled = hub?.value_random_rewards_enabled === true" in rewards_page
    assert "reward-value-games-unavailable" in rewards_page
    assert 'title="Reward Plinko"' in app


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

    assert "purchaseAttemptKeyRef" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page


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

    assert "def _require_mining_value_mode" in mining
    assert '"live_mining_provider_connected": False' in mining
    assert '"value_actions_enabled": bool(TEST_MODE)' in mining
    assert "if not TEST_MODE:" in mining
    assert "return 0" in mining
    assert "_require_mining_value_mode()" in mining
    assert '"proof_verified_live": False' in mining

    assert "from routes.mining import _require_mining_value_mode" in phase2
    assert '"listings": [], "capabilities": _mining_capabilities()' in phase2
    assert '"has_card": False' in phase2
    assert '"projects": [], "capabilities": _mining_capabilities()' in phase2

    assert "def _require_blitz_mine_value_mode" in blitz
    assert '"value_actions_enabled": bool(TEST_MODE)' in blitz
    assert "_require_blitz_mine_value_mode()" in blitz

    assert "mining-provider-unavailable" in mining_page
    assert "miningValueEnabled" in mining_page
    assert "BlitzMine Preview" in mining_page
    assert "blitzmine-provider-unavailable" in blitz_page
    assert "valueActionsEnabled" in blitz_page


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
    assert '"$inc": {"balance": -session.bet_amount}' not in source
    assert '"$inc": {"balance": -tier["monthly_price"]}' not in source
    assert '"$inc": {"balance": tier["monthly_price"] * 0.85}' not in source

def test_blitz_mine_preview_value_actions_are_exactly_once_and_retry_safe():
    backend = (BACKEND_DIR / "routes" / "blitz_mine.py").read_text(encoding="utf-8")
    page = (BACKEND_DIR.parent / "frontend" / "src" / "pages" / "BlitzMinePage.jsx").read_text(encoding="utf-8")

    assert "def _require_blitz_idempotency_key" in backend
    assert "async def _mutate_blitz_wallet_once" in backend
    assert "blitz_mine_value_markers" in backend

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

    assert 'createAttemptKeyRef' not in page
    assert "lockupAttemptKeyRef" in page
    assert "quickBonusAttemptKeyRef" in page
    assert "claimAttemptKeyRef" in page
    assert page.count('"Idempotency-Key": idempotencyKey') >= 3

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

