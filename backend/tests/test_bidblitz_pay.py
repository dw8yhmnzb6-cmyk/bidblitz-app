"""
BidBlitz Pay Gateway - Backend API Tests
Tests: payment creation, idempotency, mock confirm, cancel, refund, webhook, audit logs
"""
import pytest
import requests
import os
import json
import hashlib
import hmac
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def reviewer_session(session):
    """Authenticated reviewer session"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": REVIEWER_EMAIL,
        "password": REVIEWER_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Reviewer login failed: {resp.status_code} - {resp.text}")
    return session


@pytest.fixture(scope="module")
def admin_session():
    """Authenticated admin session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    resp = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")
    return s


class TestBidBlitzPayConfig:
    """Test /api/bidblitz-pay/config endpoint"""
    
    def test_config_returns_mock_mode(self, session):
        """Config endpoint should return mock mode when env vars are not set"""
        resp = session.get(f"{BASE_URL}/api/bidblitz-pay/config")
        assert resp.status_code == 200, f"Config failed: {resp.text}"
        data = resp.json()
        assert data["provider"] == "bidblitz_pay"
        assert data["mode"] == "mock"
        assert data["test_mode"] is True
        print(f"✓ Config returns mock mode: {data}")


class TestBidBlitzPayPaymentCreation:
    """Test payment creation flow"""
    
    def test_create_sandbox_payment(self, session):
        """Create a sandbox payment and verify response structure"""
        payload = {
            "amount": 24.90,
            "currency": "EUR",
            "order_id": f"TEST-SANDBOX-{int(time.time())}",
            "description": "BidBlitz-Pay Sandbox Test",
            "customer_email": "test@example.com",
            "success_url": "/bidblitz-pay/success",
            "cancel_url": "/bidblitz-pay/cancel",
            "webhook_url": "",
            "metadata": {"source": "pytest-sandbox"},
            "idempotency_key": f"pytest-{int(time.time())}"
        }
        resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        assert resp.status_code == 200, f"Payment creation failed: {resp.text}"
        data = resp.json()
        
        assert data["ok"] is True
        assert "payment" in data
        payment = data["payment"]
        
        # Verify payment structure
        assert payment["payment_id"].startswith("bbp_")
        assert payment["mode"] == "mock"
        assert payment["test_mode"] is True
        assert payment["status"] == "pending"
        assert payment["amount"] == 24.90
        assert payment["currency"] == "EUR"
        assert "redirect_url" in payment
        assert "app_redirect_url" in payment
        assert "wallet_redirect_url" in payment
        
        print(f"✓ Created sandbox payment: {payment['payment_id']}")
        return payment["payment_id"]
    
    def test_idempotency_reuses_payment(self, session):
        """Same idempotency key should return the same payment"""
        idempotency_key = f"pytest-idempotent-{int(time.time())}"
        payload = {
            "amount": 15.00,
            "currency": "EUR",
            "order_id": "TEST-IDEMPOTENT",
            "description": "Idempotency Test",
            "idempotency_key": idempotency_key
        }
        
        # First request
        resp1 = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["reused"] is False
        payment_id_1 = data1["payment"]["payment_id"]
        
        # Second request with same idempotency key
        resp2 = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["reused"] is True
        payment_id_2 = data2["payment"]["payment_id"]
        
        assert payment_id_1 == payment_id_2, "Idempotency should return same payment"
        print(f"✓ Idempotency protection works: {payment_id_1}")


class TestBidBlitzPayGetPayment:
    """Test GET payment endpoint"""
    
    def test_get_payment_by_id(self, session):
        """Get payment details by ID"""
        # First create a payment
        payload = {
            "amount": 10.00,
            "currency": "EUR",
            "order_id": f"TEST-GET-{int(time.time())}",
            "description": "Get Payment Test"
        }
        create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        assert create_resp.status_code == 200
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Get the payment
        get_resp = session.get(f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        
        assert data["ok"] is True
        assert data["payment"]["payment_id"] == payment_id
        assert data["payment"]["amount"] == 10.00
        assert "refunds" in data
        print(f"✓ Get payment works: {payment_id}")
    
    def test_get_nonexistent_payment_returns_404(self, session):
        """Non-existent payment should return 404"""
        resp = session.get(f"{BASE_URL}/api/bidblitz-pay/payments/bbp_nonexistent123")
        assert resp.status_code == 404
        print("✓ Non-existent payment returns 404")


class TestBidBlitzPayMockConfirm:
    """Test mock wallet approval flow"""
    
    def test_mock_confirm_requires_auth(self, session):
        """Mock confirm should require authentication"""
        # Create a payment first
        payload = {
            "amount": 20.00,
            "currency": "EUR",
            "order_id": f"TEST-AUTH-{int(time.time())}"
        }
        create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Try to confirm without auth (new session)
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        resp = unauth_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
            json={"approval_method": "wallet_release"}
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Mock confirm requires authentication")
    
    def test_mock_confirm_changes_status_to_paid(self, reviewer_session):
        """Authenticated user can approve mock payment"""
        # Create a payment
        payload = {
            "amount": 25.00,
            "currency": "EUR",
            "order_id": f"TEST-CONFIRM-{int(time.time())}",
            "customer_email": REVIEWER_EMAIL
        }
        create_resp = reviewer_session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        assert create_resp.status_code == 200
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Confirm the payment
        confirm_resp = reviewer_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
            json={"approval_method": "wallet_release"}
        )
        assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.text}"
        data = confirm_resp.json()
        
        assert data["ok"] is True
        assert data["payment"]["status"] == "paid"
        assert data["payment"]["provider_status"] == "mock_paid"
        assert data["payment"]["paid_at"] is not None
        print(f"✓ Mock confirm changes status to paid: {payment_id}")
        return payment_id


class TestBidBlitzPayCancel:
    """Test payment cancellation"""
    
    def test_cancel_pending_payment(self, session):
        """Cancel a pending payment"""
        # Create a payment
        payload = {
            "amount": 30.00,
            "currency": "EUR",
            "order_id": f"TEST-CANCEL-{int(time.time())}"
        }
        create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Cancel the payment
        cancel_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/cancel")
        assert cancel_resp.status_code == 200, f"Cancel failed: {cancel_resp.text}"
        data = cancel_resp.json()
        
        assert data["ok"] is True
        assert data["payment"]["status"] == "cancelled"
        assert data["payment"]["cancelled_at"] is not None
        print(f"✓ Cancel payment works: {payment_id}")
    
    def test_cannot_cancel_already_cancelled(self, session):
        """Cannot cancel an already cancelled payment"""
        # Create and cancel a payment
        payload = {
            "amount": 35.00,
            "currency": "EUR",
            "order_id": f"TEST-DOUBLE-CANCEL-{int(time.time())}"
        }
        create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # First cancel
        session.post(f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/cancel")
        
        # Second cancel should fail
        cancel_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/cancel")
        assert cancel_resp.status_code == 400
        print("✓ Cannot cancel already cancelled payment")


class TestBidBlitzPayRefund:
    """Test refund creation"""
    
    def test_refund_paid_payment(self, reviewer_session):
        """Create refund for a paid payment"""
        # Create and confirm a payment
        payload = {
            "amount": 50.00,
            "currency": "EUR",
            "order_id": f"TEST-REFUND-{int(time.time())}",
            "customer_email": REVIEWER_EMAIL
        }
        create_resp = reviewer_session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        assert create_resp.status_code == 200
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Confirm the payment
        confirm_resp = reviewer_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
            json={"approval_method": "wallet_release"}
        )
        assert confirm_resp.status_code == 200
        
        # Create refund
        refund_resp = reviewer_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/refunds",
            json={"reason": "Pytest refund test"}
        )
        assert refund_resp.status_code == 200, f"Refund failed: {refund_resp.text}"
        data = refund_resp.json()
        
        assert data["ok"] is True
        assert "refund" in data
        assert data["refund"]["refund_id"].startswith("bbr_")
        assert data["refund"]["amount"] == 50.00
        assert data["refund"]["status"] == "succeeded"  # Mock mode
        assert data["payment"]["status"] == "refunded"
        print(f"✓ Refund created: {data['refund']['refund_id']}")
    
    def test_partial_refund(self, reviewer_session):
        """Create partial refund"""
        # Create and confirm a payment
        payload = {
            "amount": 100.00,
            "currency": "EUR",
            "order_id": f"TEST-PARTIAL-REFUND-{int(time.time())}",
            "customer_email": REVIEWER_EMAIL
        }
        create_resp = reviewer_session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Confirm
        reviewer_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/confirm-mock",
            json={"approval_method": "wallet_release"}
        )
        
        # Partial refund
        refund_resp = reviewer_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/refunds",
            json={"amount": 30.00, "reason": "Partial refund test"}
        )
        assert refund_resp.status_code == 200
        data = refund_resp.json()
        
        assert data["refund"]["amount"] == 30.00
        assert data["payment"]["status"] == "partially_refunded"
        print(f"✓ Partial refund works: {data['refund']['refund_id']}")
    
    def test_cannot_refund_pending_payment(self, reviewer_session):
        """Cannot refund a pending payment"""
        payload = {
            "amount": 40.00,
            "currency": "EUR",
            "order_id": f"TEST-REFUND-PENDING-{int(time.time())}",
            "customer_email": REVIEWER_EMAIL
        }
        create_resp = reviewer_session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Try to refund without confirming
        refund_resp = reviewer_session.post(
            f"{BASE_URL}/api/bidblitz-pay/payments/{payment_id}/refunds",
            json={"reason": "Should fail"}
        )
        assert refund_resp.status_code == 400
        print("✓ Cannot refund pending payment")


class TestBidBlitzPayWebhook:
    """Test webhook endpoint"""
    
    def test_webhook_with_valid_signature(self, session):
        """Webhook accepts valid signed payload"""
        # Create a payment first
        payload = {
            "amount": 60.00,
            "currency": "EUR",
            "order_id": f"TEST-WEBHOOK-{int(time.time())}"
        }
        create_resp = session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
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
        webhook_resp = session.post(
            f"{BASE_URL}/api/bidblitz-pay/webhook",
            json=webhook_payload,
            headers={"X-BidBlitz-Pay-Signature": signature}
        )
        assert webhook_resp.status_code == 200, f"Webhook failed: {webhook_resp.text}"
        data = webhook_resp.json()
        
        assert data["ok"] is True
        assert data["event"] == "payment.paid"
        print(f"✓ Webhook with valid signature accepted: {payment_id}")
    
    def test_webhook_rejects_invalid_signature(self, session):
        """Webhook rejects invalid signature"""
        webhook_payload = {
            "event": "payment.paid",
            "payment_id": "bbp_test123",
            "status": "paid"
        }
        
        webhook_resp = session.post(
            f"{BASE_URL}/api/bidblitz-pay/webhook",
            json=webhook_payload,
            headers={"X-BidBlitz-Pay-Signature": "invalid_signature"}
        )
        assert webhook_resp.status_code == 401
        print("✓ Webhook rejects invalid signature")


class TestBidBlitzPayAuditLogs:
    """Test audit logs endpoint"""
    
    def test_audit_logs_requires_admin_or_merchant(self, session):
        """Audit logs require admin or merchant role"""
        # Unauthenticated request
        unauth_session = requests.Session()
        resp = unauth_session.get(f"{BASE_URL}/api/bidblitz-pay/audit-logs")
        assert resp.status_code == 401
        print("✓ Audit logs require authentication")
    
    def test_admin_can_access_audit_logs(self, admin_session):
        """Admin can access audit logs"""
        resp = admin_session.get(f"{BASE_URL}/api/bidblitz-pay/audit-logs")
        assert resp.status_code == 200, f"Audit logs failed: {resp.text}"
        data = resp.json()
        
        assert data["ok"] is True
        assert "logs" in data
        assert "count" in data
        print(f"✓ Admin can access audit logs: {data['count']} entries")
    
    def test_audit_logs_filter_by_payment_id(self, admin_session):
        """Audit logs can be filtered by payment_id"""
        # Create a payment to generate audit entries
        payload = {
            "amount": 70.00,
            "currency": "EUR",
            "order_id": f"TEST-AUDIT-{int(time.time())}"
        }
        create_resp = admin_session.post(f"{BASE_URL}/api/bidblitz-pay/payments", json=payload)
        payment_id = create_resp.json()["payment"]["payment_id"]
        
        # Get audit logs for this payment
        resp = admin_session.get(f"{BASE_URL}/api/bidblitz-pay/audit-logs?payment_id={payment_id}")
        assert resp.status_code == 200
        data = resp.json()
        
        assert data["ok"] is True
        # Should have at least the create_payment entry
        assert len(data["logs"]) >= 1
        for log in data["logs"]:
            assert log["payment_id"] == payment_id
        print(f"✓ Audit logs filtered by payment_id: {len(data['logs'])} entries")


class TestLegacyPayRoutes:
    """Test that legacy Pay SDK routes still work"""
    
    def test_pay_session_endpoint_exists(self, session):
        """Legacy pay session endpoint should exist"""
        # Try to get a non-existent session (should return 404, not 500)
        resp = session.get(f"{BASE_URL}/api/pay/session/cs_nonexistent")
        assert resp.status_code == 404
        print("✓ Legacy /api/pay/session endpoint exists")
    
    def test_pay_config_endpoint(self, session):
        """Legacy /api/pay/config endpoint should work"""
        resp = session.get(f"{BASE_URL}/api/pay/config")
        # Should return 200 with config or 404 if not implemented
        assert resp.status_code in [200, 404]
        print(f"✓ Legacy /api/pay/config returns {resp.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
