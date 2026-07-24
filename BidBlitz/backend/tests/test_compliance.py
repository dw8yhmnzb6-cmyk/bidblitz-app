"""
BidBlitz V2 - Compliance Module Tests
Tests for transaction monitoring, limits, and admin compliance endpoints.

Compliance Limits:
- payment: single_max=2500, daily=5000, monthly=50000
- send: single_max=1000, daily=2000, monthly=20000
- topup: single_max=500, daily=10000, monthly=50000
- payout: single_max=5000, daily=5000, monthly=25000
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"


class TestCompliancePayment:
    """Tests for payment compliance checks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_customer(self):
        """Login as customer and return session"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()
    
    def test_payment_within_single_max_passes(self):
        """POST /api/payment/pay with amount <= 2500 should pass compliance"""
        self.login_as_customer()
        
        # First check balance
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        balance = me_response.json().get("balance", 0)
        
        # Use small amount to avoid balance issues
        test_amount = min(5.0, balance) if balance > 0 else 5.0
        
        if balance < test_amount:
            pytest.skip(f"Insufficient balance ({balance}) for payment test")
        
        response = self.session.post(f"{BASE_URL}/api/payment/pay", json={
            "amount": test_amount,
            "merchant_id": "",
            "description": "TEST_compliance_payment_pass"
        })
        
        # Should succeed (200) or fail for non-compliance reasons (400 insufficient balance)
        # Should NOT be 403 (compliance blocked)
        assert response.status_code != 403, f"Payment blocked by compliance unexpectedly: {response.text}"
        print(f"Payment of {test_amount} EUR: status={response.status_code}")
    
    def test_payment_exceeds_single_max_blocked(self):
        """POST /api/payment/pay with amount > 2500 should return 403 with compliance.single_max"""
        self.login_as_customer()
        
        # Amount exceeds single_max of 2500
        response = self.session.post(f"{BASE_URL}/api/payment/pay", json={
            "amount": 2501.0,
            "merchant_id": "",
            "description": "TEST_compliance_payment_blocked"
        })
        
        assert response.status_code == 403, f"Expected 403 for exceeding single_max, got {response.status_code}: {response.text}"
        
        # Check response contains compliance message
        detail = response.json().get("detail", "")
        assert "compliance.single_max" in detail, f"Expected compliance.single_max in detail, got: {detail}"
        assert "2500" in detail, f"Expected limit value 2500 in detail, got: {detail}"
        print(f"Payment of 2501 EUR correctly blocked: {detail}")


class TestComplianceSend:
    """Tests for send money compliance checks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_customer(self):
        """Login as customer"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()
    
    def test_send_within_single_max_passes(self):
        """POST /api/payment/send with amount <= 1000 should pass compliance"""
        self.login_as_customer()
        
        # Check balance
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        balance = me_response.json().get("balance", 0)
        
        test_amount = min(5.0, balance) if balance > 0 else 5.0
        
        if balance < test_amount + 1:  # +1 for fee
            pytest.skip(f"Insufficient balance ({balance}) for send test")
        
        response = self.session.post(f"{BASE_URL}/api/payment/send", json={
            "amount": test_amount,
            "recipient_email": MERCHANT_EMAIL,
            "description": "TEST_compliance_send_pass"
        })
        
        # Should NOT be 403 (compliance blocked)
        assert response.status_code != 403, f"Send blocked by compliance unexpectedly: {response.text}"
        print(f"Send of {test_amount} EUR: status={response.status_code}")
    
    def test_send_exceeds_single_max_blocked(self):
        """POST /api/payment/send with amount > 1000 should return 403 blocked"""
        self.login_as_customer()
        
        # Amount exceeds single_max of 1000
        response = self.session.post(f"{BASE_URL}/api/payment/send", json={
            "amount": 1001.0,
            "recipient_email": MERCHANT_EMAIL,
            "description": "TEST_compliance_send_blocked"
        })
        
        assert response.status_code == 403, f"Expected 403 for exceeding single_max, got {response.status_code}: {response.text}"
        
        detail = response.json().get("detail", "")
        assert "compliance.single_max" in detail, f"Expected compliance.single_max in detail, got: {detail}"
        assert "1000" in detail, f"Expected limit value 1000 in detail, got: {detail}"
        print(f"Send of 1001 EUR correctly blocked: {detail}")


class TestComplianceStripeCheckout:
    """Tests for Stripe checkout compliance checks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_customer(self):
        """Login as customer"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()
    
    def test_checkout_valid_package_passes(self):
        """POST /api/stripe/checkout with valid package should pass compliance and return checkout_url"""
        self.login_as_customer()
        
        # Package 100 EUR is within topup single_max of 500
        response = self.session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "100",
            "origin_url": BASE_URL
        })
        
        assert response.status_code == 200, f"Checkout failed: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, f"Expected checkout_url in response, got: {data}"
        assert "session_id" in data, f"Expected session_id in response, got: {data}"
        print(f"Checkout for 100 EUR package passed: session_id={data['session_id'][:20]}...")
    
    def test_checkout_max_package_passes(self):
        """POST /api/stripe/checkout with 500 EUR package (equals single_max) should pass"""
        self.login_as_customer()
        
        # Package 500 EUR equals topup single_max of 500 - should pass
        response = self.session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "500",
            "origin_url": BASE_URL
        })
        
        assert response.status_code == 200, f"Checkout for max package failed: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, f"Expected checkout_url in response, got: {data}"
        print(f"Checkout for 500 EUR package (max) passed: session_id={data['session_id'][:20]}...")


class TestCompliancePayout:
    """Tests for payout compliance checks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_merchant(self):
        """Login as merchant"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        })
        assert response.status_code == 200, f"Merchant login failed: {response.text}"
        return response.json()
    
    def test_payout_request_passes_compliance(self):
        """POST /api/payout/request should pass compliance check (payout type)"""
        self.login_as_merchant()
        
        # Check available payout balance
        balance_response = self.session.get(f"{BASE_URL}/api/payout/balance")
        assert balance_response.status_code == 200, f"Balance check failed: {balance_response.text}"
        
        available = balance_response.json().get("available", 0)
        min_payout = balance_response.json().get("min_payout", 10)
        
        if available < min_payout:
            pytest.skip(f"Insufficient available payout ({available}) for payout test, min is {min_payout}")
        
        # Request payout within limits
        test_amount = min(available, 100.0)  # Use smaller of available or 100
        
        response = self.session.post(f"{BASE_URL}/api/payout/request", json={
            "amount": test_amount,
            "notes": "TEST_compliance_payout"
        })
        
        # Should NOT be 403 (compliance blocked) - may be 409 if pending payout exists
        if response.status_code == 409:
            print(f"Payout request: 409 - pending payout already exists (expected behavior)")
        else:
            assert response.status_code != 403, f"Payout blocked by compliance unexpectedly: {response.text}"
            print(f"Payout request of {test_amount} EUR: status={response.status_code}")


class TestAdminComplianceEndpoints:
    """Tests for admin compliance endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_admin(self):
        """Login as admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()
    
    def login_as_customer(self):
        """Login as customer (non-admin)"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()
    
    def test_admin_get_compliance_checks(self):
        """GET /api/admin/compliance-checks → admin can see all compliance check outcomes"""
        self.login_as_admin()
        
        response = self.session.get(f"{BASE_URL}/api/admin/compliance-checks")
        
        assert response.status_code == 200, f"Admin compliance-checks failed: {response.text}"
        
        data = response.json()
        assert "checks" in data, f"Expected 'checks' in response, got: {data}"
        assert "total" in data, f"Expected 'total' in response, got: {data}"
        
        print(f"Admin compliance-checks: {data['total']} total checks")
        
        # Verify structure of checks if any exist
        if data["checks"]:
            check = data["checks"][0]
            assert "user_id" in check, f"Expected user_id in check, got: {check}"
            assert "txn_type" in check, f"Expected txn_type in check, got: {check}"
            assert "amount" in check, f"Expected amount in check, got: {check}"
            assert "outcome" in check, f"Expected outcome in check, got: {check}"
            assert "timestamp" in check, f"Expected timestamp in check, got: {check}"
            print(f"Check structure verified: {check.get('txn_type')} - {check.get('outcome')}")
    
    def test_admin_get_compliance_flags(self):
        """GET /api/admin/compliance-flags → admin can see flagged activities"""
        self.login_as_admin()
        
        response = self.session.get(f"{BASE_URL}/api/admin/compliance-flags")
        
        assert response.status_code == 200, f"Admin compliance-flags failed: {response.text}"
        
        data = response.json()
        assert "flags" in data, f"Expected 'flags' in response, got: {data}"
        assert "total" in data, f"Expected 'total' in response, got: {data}"
        
        print(f"Admin compliance-flags: {data['total']} total flags")
        
        # Verify structure of flags if any exist
        if data["flags"]:
            flag = data["flags"][0]
            assert "user_id" in flag, f"Expected user_id in flag, got: {flag}"
            assert "reason" in flag, f"Expected reason in flag, got: {flag}"
            assert "status" in flag, f"Expected status in flag, got: {flag}"
            print(f"Flag structure verified: {flag.get('reason')} - {flag.get('status')}")
    
    def test_admin_compliance_checks_with_filters(self):
        """GET /api/admin/compliance-checks with filters works correctly"""
        self.login_as_admin()
        
        # Test outcome filter
        response = self.session.get(f"{BASE_URL}/api/admin/compliance-checks?outcome=blocked")
        assert response.status_code == 200, f"Filtered compliance-checks failed: {response.text}"
        
        data = response.json()
        # All returned checks should have outcome=blocked
        for check in data.get("checks", []):
            assert check.get("outcome") == "blocked", f"Filter not working: got {check.get('outcome')}"
        
        print(f"Filtered compliance-checks (blocked): {data['total']} checks")
    
    def test_non_admin_compliance_checks_forbidden(self):
        """GET /api/admin/compliance-checks without admin role → 403 Forbidden"""
        self.login_as_customer()
        
        response = self.session.get(f"{BASE_URL}/api/admin/compliance-checks")
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("Non-admin correctly denied access to compliance-checks")
    
    def test_non_admin_compliance_flags_forbidden(self):
        """GET /api/admin/compliance-flags without admin role → 403 Forbidden"""
        self.login_as_customer()
        
        response = self.session.get(f"{BASE_URL}/api/admin/compliance-flags")
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("Non-admin correctly denied access to compliance-flags")


class TestComplianceCheckStorage:
    """Tests for compliance check outcome storage"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_admin(self):
        """Login as admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()
    
    def login_as_customer(self):
        """Login as customer"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()
    
    def test_blocked_transaction_creates_compliance_check(self):
        """Compliance check outcomes are stored with correct fields"""
        # First trigger a blocked transaction
        self.login_as_customer()
        
        # This should be blocked (exceeds single_max)
        self.session.post(f"{BASE_URL}/api/payment/pay", json={
            "amount": 3000.0,
            "merchant_id": "",
            "description": "TEST_compliance_storage_check"
        })
        
        # Now login as admin and check compliance_checks
        self.session.cookies.clear()
        self.login_as_admin()
        
        response = self.session.get(f"{BASE_URL}/api/admin/compliance-checks?outcome=blocked&limit=5")
        assert response.status_code == 200, f"Admin compliance-checks failed: {response.text}"
        
        data = response.json()
        assert data["total"] > 0, "Expected at least one blocked compliance check"
        
        # Verify the check has all required fields
        check = data["checks"][0]
        required_fields = ["user_id", "txn_type", "amount", "outcome", "timestamp"]
        for field in required_fields:
            assert field in check, f"Missing required field '{field}' in compliance check: {check}"
        
        # rules_triggered may be present
        if "rules_triggered" in check:
            assert isinstance(check["rules_triggered"], list), f"rules_triggered should be a list: {check}"
        
        print(f"Compliance check storage verified: {check}")


class TestAuthNoRegression:
    """Tests to ensure auth still works (no regression)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_login_works(self):
        """Normal login still works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data, f"Expected user in response: {data}"
        print(f"Login works: {data['user'].get('email')}")
    
    def test_logout_works(self):
        """Normal logout still works"""
        # Login first
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        # Logout
        response = self.session.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200, f"Logout failed: {response.text}"
        print("Logout works")
    
    def test_me_endpoint_works(self):
        """GET /api/auth/me still works"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Me endpoint failed: {response.text}"
        
        data = response.json()
        assert data.get("email") == CUSTOMER_EMAIL, f"Wrong user returned: {data}"
        print(f"Me endpoint works: {data.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
