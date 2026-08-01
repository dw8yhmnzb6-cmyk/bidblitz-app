"""
BidBlitz Pay Gateway - Backend API Tests
Tests: payment creation, idempotency, mock confirm, cancel, refund, webhook, audit logs
"""
import requests
import json
import hashlib
import hmac
import time

BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"

# Test credentials from test_credentials.md
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


def test_config_returns_mock_mode():
    """1. GET /api/bidblitz-pay/config should return mock/sandbox mode"""
    print("\n=== Test 1: Config Endpoint ===")
    resp = requests.get(f"{BASE_URL}/api/bidblitz-pay/config")
    assert resp.status_code == 200, f"Config failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    assert data["provider"] == "bidblitz_pay", f"Expected provider=bidblitz_pay, got {data.get('provider')}"
    assert data["mode"] == "mock", f"Expected mode=mock, got {data.get('mode')}"
    assert data["test_mode"] is True, f"Expected test_mode=True, got {data.get('test_mode')}"
    print(f"✓ Config returns mock mode: {data}")
    return True


def test_create_sandbox_payment():
    """2. POST /api/bidblitz-pay/payments should create payment with redirect URLs and pending status"""
    print("\n=== Test 2: Create Sandbox Payment ===")
    payload = {
        "amount": 24.90,
        "currency": "EUR",
        "order_id": f"TEST-SANDBOX-{int(time.time())}",
        "description": "BidBlitz-Pay Sandbox Test",
        "customer_email": "test@example.com",
        "success_url": "/bidblitz-pay/success",
        "cancel_url": "/bidblitz-pay/cancel",
        "webhook_url": "",
        "metadata": {"source": "backend_test"},
        "idempotency_key": f"test-{int(time.time())}"
    }
    resp = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    assert resp.status_code == 200, f"Payment creation failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert "payment" in data, "Expected payment in response"
    payment = data["payment"]
    
    # Verify payment structure
    assert payment["payment_id"].startswith("bbp_"), f"Expected payment_id to start with bbp_, got {payment['payment_id']}"
    assert payment["mode"] == "mock", f"Expected mode=mock, got {payment['mode']}"
    assert payment["test_mode"] is True, f"Expected test_mode=True, got {payment['test_mode']}"
    assert payment["status"] == "pending", f"Expected status=pending, got {payment['status']}"
    assert payment["amount"] == 24.90, f"Expected amount=24.90, got {payment['amount']}"
    assert payment["currency"] == "EUR", f"Expected currency=EUR, got {payment['currency']}"
    assert "redirect_url" in payment, "Expected redirect_url in payment"
    assert "app_redirect_url" in payment, "Expected app_redirect_url in payment"
    assert "wallet_redirect_url" in payment, "Expected wallet_redirect_url in payment"
    
    print(f"✓ Created sandbox payment: {payment['payment_id']}")
    print(f"  - Status: {payment['status']}")
    print(f"  - Redirect URL: {payment['redirect_url']}")
    print(f"  - App Redirect: {payment['app_redirect_url']}")
    print(f"  - Wallet Redirect: {payment['wallet_redirect_url']}")
    return payment["payment_id"]


def test_idempotency_reuses_payment():
    """3. POST /api/bidblitz-pay/payments with same idempotency key should reuse payment"""
    print("\n=== Test 3: Idempotency Key Reuse ===")
    idempotency_key = f"test-idempotent-{int(time.time())}"
    payload = {
        "amount": 15.00,
        "currency": "EUR",
        "order_id": "TEST-IDEMPOTENT",
        "description": "Idempotency Test",
        "idempotency_key": idempotency_key
    }
    
    # First request
    resp1 = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    assert resp1.status_code == 200, f"First request failed: {resp1.status_code} - {resp1.text}"
    data1 = resp1.json()
    assert data1["reused"] is False, "First request should not be reused"
    payment_id_1 = data1["payment"]["payment_id"]
    
    # Second request with same idempotency key
    resp2 = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    assert resp2.status_code == 200, f"Second request failed: {resp2.status_code} - {resp2.text}"
    data2 = resp2.json()
    assert data2["reused"] is True, "Second request should be reused"
    payment_id_2 = data2["payment"]["payment_id"]
    
    assert payment_id_1 == payment_id_2, f"Idempotency should return same payment: {payment_id_1} != {payment_id_2}"
    print(f"✓ Idempotency protection works: {payment_id_1}")
    return True


def test_get_payment_by_id():
    """4. GET /api/bidblitz-pay/payments/{payment_id} should return status and metadata"""
    print("\n=== Test 4: Get Payment by ID ===")
    # First create a payment
    payload = {
        "amount": 10.00,
        "currency": "EUR",
        "order_id": f"TEST-GET-{int(time.time())}",
        "description": "Get Payment Test"
    }
    create_resp = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    assert create_resp.status_code == 200, f"Create failed: {create_resp.status_code}"
    payment_id = create_resp.json()["payment"]["payment_id"]
    
    # Get the payment
    get_resp = requests.get(f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}")
    assert get_resp.status_code == 200, f"Get failed: {get_resp.status_code} - {get_resp.text}"
    data = get_resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert data["payment"]["payment_id"] == payment_id, f"Expected payment_id={payment_id}"
    assert data["payment"]["amount"] == 10.00, f"Expected amount=10.00"
    assert "refunds" in data, "Expected refunds in response"
    print(f"✓ Get payment works: {payment_id}")
    print(f"  - Status: {data['payment']['status']}")
    print(f"  - Amount: {data['payment']['amount']} {data['payment']['currency']}")
    return True


def test_mock_confirm_requires_auth():
    """5. POST /api/bidblitz-pay/payments/{payment_id}/confirm-mock should require auth"""
    print("\n=== Test 5: Mock Confirm Requires Auth ===")
    # Create a payment first
    payload = {
        "amount": 20.00,
        "currency": "EUR",
        "order_id": f"TEST-AUTH-{int(time.time())}"
    }
    create_resp = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    payment_id = create_resp.json()["payment"]["payment_id"]
    
    # Try to confirm without auth
    resp = requests.post(
        f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
        json={"approval_method": "wallet_release"}
    )
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    print(f"✓ Mock confirm requires authentication (got 401 as expected)")
    return True


def test_mock_confirm_changes_status_to_paid():
    """5b. POST /api/bidblitz-pay/payments/{payment_id}/confirm-mock with auth should set status to paid"""
    print("\n=== Test 5b: Mock Confirm Changes Status to Paid ===")
    # Login as reviewer
    session = requests.Session()
    login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": REVIEWER_EMAIL,
        "password": REVIEWER_PASSWORD
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code} - {login_resp.text}"
    print(f"✓ Logged in as {REVIEWER_EMAIL}")
    
    # Create a payment
    payload = {
        "amount": 25.00,
        "currency": "EUR",
        "order_id": f"TEST-CONFIRM-{int(time.time())}",
        "customer_email": REVIEWER_EMAIL
    }
    create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    assert create_resp.status_code == 200, f"Create failed: {create_resp.status_code}"
    payment_id = create_resp.json()["payment"]["payment_id"]
    print(f"✓ Created payment: {payment_id}")
    
    # Confirm the payment
    confirm_resp = session.post(
        f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
        json={"approval_method": "wallet_release"}
    )
    assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.status_code} - {confirm_resp.text}"
    data = confirm_resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert data["payment"]["status"] == "paid", f"Expected status=paid, got {data['payment']['status']}"
    assert data["payment"]["provider_status"] == "mock_paid", f"Expected provider_status=mock_paid"
    assert data["payment"]["paid_at"] is not None, "Expected paid_at to be set"
    print(f"✓ Mock confirm changes status to paid: {payment_id}")
    print(f"  - Status: {data['payment']['status']}")
    print(f"  - Paid at: {data['payment']['paid_at']}")
    return payment_id


def test_cancel_pending_payment():
    """6. POST /api/bidblitz-pay/payments/{payment_id}/cancel should cancel pending payment"""
    print("\n=== Test 6: Cancel Pending Payment ===")
    # Create a payment
    payload = {
        "amount": 30.00,
        "currency": "EUR",
        "order_id": f"TEST-CANCEL-{int(time.time())}"
    }
    create_resp = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    payment_id = create_resp.json()["payment"]["payment_id"]
    
    # Cancel the payment
    cancel_resp = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/cancel")
    assert cancel_resp.status_code == 200, f"Cancel failed: {cancel_resp.status_code} - {cancel_resp.text}"
    data = cancel_resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert data["payment"]["status"] == "cancelled", f"Expected status=cancelled, got {data['payment']['status']}"
    assert data["payment"]["cancelled_at"] is not None, "Expected cancelled_at to be set"
    print(f"✓ Cancel payment works: {payment_id}")
    print(f"  - Status: {data['payment']['status']}")
    print(f"  - Cancelled at: {data['payment']['cancelled_at']}")
    return True


def test_refund_paid_payment():
    """7. POST /api/bidblitz-pay/payments/{payment_id}/refunds should work for paid sandbox payment"""
    print("\n=== Test 7: Refund Paid Payment ===")
    # Login as reviewer
    session = requests.Session()
    login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": REVIEWER_EMAIL,
        "password": REVIEWER_PASSWORD
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code}"
    
    # Create and confirm a payment
    payload = {
        "amount": 50.00,
        "currency": "EUR",
        "order_id": f"TEST-REFUND-{int(time.time())}",
        "customer_email": REVIEWER_EMAIL
    }
    create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    assert create_resp.status_code == 200, f"Create failed: {create_resp.status_code}"
    payment_id = create_resp.json()["payment"]["payment_id"]
    
    # Confirm the payment
    confirm_resp = session.post(
        f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
        json={"approval_method": "wallet_release"}
    )
    assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.status_code}"
    print(f"✓ Created and confirmed payment: {payment_id}")
    
    # Create refund
    refund_resp = session.post(
        f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/refunds",
        json={"reason": "Backend test refund"}
    )
    assert refund_resp.status_code == 200, f"Refund failed: {refund_resp.status_code} - {refund_resp.text}"
    data = refund_resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert "refund" in data, "Expected refund in response"
    assert data["refund"]["refund_id"].startswith("bbr_"), f"Expected refund_id to start with bbr_"
    assert data["refund"]["amount"] == 50.00, f"Expected refund amount=50.00"
    assert data["refund"]["status"] == "succeeded", f"Expected refund status=succeeded (mock mode)"
    assert data["payment"]["status"] == "refunded", f"Expected payment status=refunded"
    print(f"✓ Refund created: {data['refund']['refund_id']}")
    print(f"  - Refund amount: {data['refund']['amount']} {data['refund']['currency']}")
    print(f"  - Refund status: {data['refund']['status']}")
    print(f"  - Payment status: {data['payment']['status']}")
    return True


def test_webhook_with_valid_signature():
    """8. POST /api/bidblitz-pay/webhook should accept valid signature"""
    print("\n=== Test 8: Webhook with Valid Signature ===")
    # Create a payment first
    payload = {
        "amount": 60.00,
        "currency": "EUR",
        "order_id": f"TEST-WEBHOOK-{int(time.time())}"
    }
    create_resp = requests.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
    payment_id = create_resp.json()["payment"]["payment_id"]
    
    # Prepare webhook payload
    webhook_payload = {
        "event": "payment.paid",
        "payment_id": payment_id,
        "status": "paid",
        "paid_at": "2026-08-01T12:00:00Z"
    }
    
    # Sign with mock secret
    secret = "mock-webhook-secret"
    raw = json.dumps(webhook_payload, separators=(",", ":"), sort_keys=True).encode()
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    
    # Send webhook
    webhook_resp = requests.post(
        f"{BASE_URL}/api/bidblitz-pay/webhook",
        json=webhook_payload,
        headers={"X-BidBlitz-Pay-Signature": signature}
    )
    assert webhook_resp.status_code == 200, f"Webhook failed: {webhook_resp.status_code} - {webhook_resp.text}"
    data = webhook_resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert data["event"] == "payment.paid", f"Expected event=payment.paid"
    print(f"✓ Webhook with valid signature accepted: {payment_id}")
    print(f"  - Event: {data['event']}")
    return True


def test_webhook_rejects_invalid_signature():
    """8b. POST /api/bidblitz-pay/webhook should reject invalid signature"""
    print("\n=== Test 8b: Webhook Rejects Invalid Signature ===")
    webhook_payload = {
        "event": "payment.paid",
        "payment_id": "bbp_test123",
        "status": "paid"
    }
    
    webhook_resp = requests.post(
        f"{BASE_URL}/api/bidblitz-pay/webhook",
        json=webhook_payload,
        headers={"X-BidBlitz-Pay-Signature": "invalid_signature"}
    )
    assert webhook_resp.status_code == 401, f"Expected 401, got {webhook_resp.status_code}"
    print(f"✓ Webhook rejects invalid signature (got 401 as expected)")
    return True


def test_admin_can_access_audit_logs():
    """9. GET /api/bidblitz-pay/audit-logs should be accessible for admin"""
    print("\n=== Test 9: Admin Can Access Audit Logs ===")
    # Login as admin
    session = requests.Session()
    login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.status_code} - {login_resp.text}"
    print(f"✓ Logged in as {ADMIN_EMAIL}")
    
    resp = session.get(f"{BASE_URL}/api/bidblitz-pay/audit-logs")
    assert resp.status_code == 200, f"Audit logs failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert data["ok"] is True, "Expected ok=True"
    assert "logs" in data, "Expected logs in response"
    assert "count" in data, "Expected count in response"
    print(f"✓ Admin can access audit logs: {data['count']} entries")
    return True


def test_pay_directory_not_blocked():
    """10. GET /api/pay/directory should not be blocked by invoice catch-all"""
    print("\n=== Test 10: Regression Check - /api/pay/directory ===")
    resp = requests.get(f"{BASE_URL}/api/pay/directory")
    # Should return 200 with directory data, not 404 from invoice catch-all
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
    data = resp.json()
    assert "merchants" in data or "ok" in data, f"Expected valid directory response, got {data}"
    print(f"✓ /api/pay/directory is not blocked by invoice catch-all")
    print(f"  - Status: {resp.status_code}")
    return True


def run_all_tests():
    """Run all BidBlitz-Pay backend tests"""
    print("=" * 80)
    print("BidBlitz-Pay Backend API Test Suite")
    print("=" * 80)
    
    tests = [
        ("Config Endpoint", test_config_returns_mock_mode),
        ("Create Sandbox Payment", test_create_sandbox_payment),
        ("Idempotency Key Reuse", test_idempotency_reuses_payment),
        ("Get Payment by ID", test_get_payment_by_id),
        ("Mock Confirm Requires Auth", test_mock_confirm_requires_auth),
        ("Mock Confirm Changes Status to Paid", test_mock_confirm_changes_status_to_paid),
        ("Cancel Pending Payment", test_cancel_pending_payment),
        ("Refund Paid Payment", test_refund_paid_payment),
        ("Webhook with Valid Signature", test_webhook_with_valid_signature),
        ("Webhook Rejects Invalid Signature", test_webhook_rejects_invalid_signature),
        ("Admin Can Access Audit Logs", test_admin_can_access_audit_logs),
        ("Regression: /api/pay/directory Not Blocked", test_pay_directory_not_blocked),
    ]
    
    passed = 0
    failed = 0
    errors = []
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            failed += 1
            errors.append(f"❌ {name}: {str(e)}")
            print(f"❌ FAILED: {name}")
            print(f"   Error: {str(e)}")
        except Exception as e:
            failed += 1
            errors.append(f"❌ {name}: {type(e).__name__}: {str(e)}")
            print(f"❌ ERROR: {name}")
            print(f"   {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total: {len(tests)} tests")
    print(f"✓ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if errors:
        print("\nFailed Tests:")
        for error in errors:
            print(f"  {error}")
    
    print("=" * 80)
    return passed, failed, errors


if __name__ == "__main__":
    passed, failed, errors = run_all_tests()
    exit(0 if failed == 0 else 1)
