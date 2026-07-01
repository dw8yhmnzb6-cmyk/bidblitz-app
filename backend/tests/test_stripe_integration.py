"""
BidBlitz V2 - Stripe Integration Tests
Tests: /api/stripe/packages, /api/stripe/checkout, /api/stripe/checkout/status/{session_id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://biometric-checkout-7.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestStripePackages:
    """Test /api/stripe/packages endpoint - returns 6 preset packages"""
    
    def test_get_packages_returns_6_packages(self):
        """GET /api/stripe/packages returns 6 packages (10, 25, 50, 100, 250, 500 EUR)"""
        response = requests.get(f"{BASE_URL}/api/stripe/packages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "packages" in data, "Response should contain 'packages' key"
        
        packages = data["packages"]
        assert len(packages) == 6, f"Expected 6 packages, got {len(packages)}"
        
        # Verify all expected amounts are present
        expected_amounts = [10.0, 25.0, 50.0, 100.0, 250.0, 500.0]
        actual_amounts = [p["amount"] for p in packages]
        assert sorted(actual_amounts) == expected_amounts, f"Expected amounts {expected_amounts}, got {actual_amounts}"
        
        # Verify package structure
        for pkg in packages:
            assert "id" in pkg, "Package should have 'id'"
            assert "amount" in pkg, "Package should have 'amount'"
            assert "currency" in pkg, "Package should have 'currency'"
            assert "label" in pkg, "Package should have 'label'"
            assert pkg["currency"] == "EUR", f"Currency should be EUR, got {pkg['currency']}"
        
        print(f"✓ GET /api/stripe/packages returns 6 packages: {[p['amount'] for p in packages]}")
    
    def test_packages_no_auth_required(self):
        """Packages endpoint should be public (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/stripe/packages")
        assert response.status_code == 200, "Packages endpoint should not require auth"
        print("✓ /api/stripe/packages is public (no auth required)")


class TestStripeCheckout:
    """Test /api/stripe/checkout endpoint - creates Stripe checkout sessions"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_checkout_without_auth_returns_401(self):
        """POST /api/stripe/checkout without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "50",
            "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/stripe/checkout without auth returns 401")
    
    def test_checkout_with_valid_package_returns_checkout_url(self, auth_session):
        """POST /api/stripe/checkout with valid package_id returns checkout_url and session_id"""
        response = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "50",
            "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, "Response should contain 'checkout_url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        
        # Verify checkout_url is a valid Stripe URL
        checkout_url = data["checkout_url"]
        assert "checkout.stripe.com" in checkout_url, f"checkout_url should point to Stripe: {checkout_url}"
        
        # Verify session_id format (Stripe session IDs start with cs_)
        session_id = data["session_id"]
        assert session_id.startswith("cs_"), f"session_id should start with 'cs_': {session_id}"
        
        print(f"✓ POST /api/stripe/checkout returns checkout_url and session_id: {session_id[:20]}...")
    
    def test_checkout_with_invalid_package_returns_400(self, auth_session):
        """POST /api/stripe/checkout with invalid package returns 400 error"""
        response = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "999",  # Invalid package
            "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail'"
        assert "invalid" in data["detail"].lower() or "choose from" in data["detail"].lower(), \
            f"Error should mention invalid package: {data['detail']}"
        
        print(f"✓ POST /api/stripe/checkout with invalid package returns 400: {data['detail']}")
    
    def test_checkout_all_valid_packages(self, auth_session):
        """Test checkout works for all 6 valid package IDs"""
        valid_packages = ["10", "25", "50", "100", "250", "500"]
        
        for pkg_id in valid_packages:
            response = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
                "package_id": pkg_id,
                "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
            })
            assert response.status_code == 200, f"Package {pkg_id} failed: {response.text}"
            data = response.json()
            assert "checkout_url" in data
            assert "session_id" in data
        
        print(f"✓ All 6 packages create valid checkout sessions: {valid_packages}")
    
    def test_checkout_missing_package_id_returns_422(self, auth_session):
        """POST /api/stripe/checkout without package_id returns 422"""
        response = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
        })
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ POST /api/stripe/checkout without package_id returns 422")
    
    def test_checkout_missing_origin_url_returns_422(self, auth_session):
        """POST /api/stripe/checkout without origin_url returns 422"""
        response = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "50"
        })
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ POST /api/stripe/checkout without origin_url returns 422")


class TestStripeCheckoutStatus:
    """Test /api/stripe/checkout/status/{session_id} endpoint"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_status_without_auth_returns_401(self):
        """GET /api/stripe/checkout/status/{session_id} without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/stripe/checkout/status/cs_test_fake_session")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/stripe/checkout/status without auth returns 401")
    
    def test_status_with_invalid_session_returns_404(self, auth_session):
        """GET /api/stripe/checkout/status with non-existent session returns 404"""
        response = auth_session.get(f"{BASE_URL}/api/stripe/checkout/status/cs_nonexistent_session_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ GET /api/stripe/checkout/status with invalid session returns 404")
    
    def test_status_with_valid_session_returns_status(self, auth_session):
        """GET /api/stripe/checkout/status with valid session returns payment status"""
        # First create a checkout session
        checkout_resp = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "25",
            "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
        })
        assert checkout_resp.status_code == 200
        session_id = checkout_resp.json()["session_id"]
        
        # Now check status
        status_resp = auth_session.get(f"{BASE_URL}/api/stripe/checkout/status/{session_id}")
        assert status_resp.status_code == 200, f"Expected 200, got {status_resp.status_code}: {status_resp.text}"
        
        data = status_resp.json()
        assert "status" in data, "Response should contain 'status'"
        assert "payment_status" in data, "Response should contain 'payment_status'"
        assert "amount" in data, "Response should contain 'amount'"
        assert "currency" in data, "Response should contain 'currency'"
        
        # For a new session, status should be pending/open
        assert data["amount"] == 25.0, f"Amount should be 25.0, got {data['amount']}"
        assert data["currency"] == "EUR", f"Currency should be EUR, got {data['currency']}"
        
        print(f"✓ GET /api/stripe/checkout/status returns status: {data['status']}, payment_status: {data['payment_status']}")


class TestStripeIntegrationFlow:
    """End-to-end Stripe integration flow tests"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_full_checkout_flow(self, auth_session):
        """Test complete checkout flow: packages → checkout → status"""
        # Step 1: Get packages
        packages_resp = auth_session.get(f"{BASE_URL}/api/stripe/packages")
        assert packages_resp.status_code == 200
        packages = packages_resp.json()["packages"]
        assert len(packages) == 6
        
        # Step 2: Create checkout session for €100 package
        checkout_resp = auth_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "100",
            "origin_url": "https://biometric-checkout-7.preview.emergentagent.com"
        })
        assert checkout_resp.status_code == 200
        checkout_data = checkout_resp.json()
        assert "checkout_url" in checkout_data
        assert "session_id" in checkout_data
        
        session_id = checkout_data["session_id"]
        
        # Step 3: Check status (should be pending since we can't complete Stripe payment in test)
        status_resp = auth_session.get(f"{BASE_URL}/api/stripe/checkout/status/{session_id}")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["amount"] == 100.0
        assert status_data["currency"] == "EUR"
        
        print(f"✓ Full checkout flow completed: packages → checkout → status")
        print(f"  Session ID: {session_id[:20]}...")
        print(f"  Checkout URL: {checkout_data['checkout_url'][:50]}...")
        print(f"  Status: {status_data['status']}, Payment: {status_data['payment_status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
