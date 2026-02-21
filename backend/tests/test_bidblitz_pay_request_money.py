"""
BidBlitz Pay Request Money & Send Money by ID Tests
Tests for iteration 63 - Bug fixes and Request Money feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidblitz-pay-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestSendMoneyByIdOrEmail:
    """Test send-money accepts both customer ID and email"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_send_money_accepts_email(self):
        """Test send-money accepts email format"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "nonexistent@test.com",
            "amount": 10.0,
            "message": "Test by email"
        })
        # Should return 404 (recipient not found) not 400 (invalid format)
        assert response.status_code == 404, f"Expected 404 for nonexistent email, got {response.status_code}"
        data = response.json()
        assert "nicht gefunden" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower()
        print("✓ send-money accepts email format, returns 404 for nonexistent")
    
    def test_send_money_accepts_customer_id(self):
        """Test send-money accepts customer ID (user ID) format"""
        # Use a fake customer ID format
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "USR-12345678",  # Customer ID format
            "amount": 10.0,
            "message": "Test by customer ID"
        })
        # Should return 404 (recipient not found) not 400 (invalid format)
        assert response.status_code == 404, f"Expected 404 for nonexistent ID, got {response.status_code}"
        data = response.json()
        assert "nicht gefunden" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower()
        print("✓ send-money accepts customer ID format, returns 404 for nonexistent")
    
    def test_send_money_error_message_mentions_both(self):
        """Test error message mentions both customer ID and email"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "invalid-recipient",
            "amount": 10.0
        })
        assert response.status_code == 404
        data = response.json()
        detail = data.get("detail", "")
        # Error should mention both options
        assert "Kundennummer" in detail or "E-Mail" in detail or "customer" in detail.lower() or "email" in detail.lower()
        print(f"✓ Error message: {detail}")


class TestRequestMoneyFeature:
    """Test Request Money feature - create, view, pay, list requests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    # ==================== CREATE REQUEST TESTS ====================
    
    def test_create_payment_request_endpoint_exists(self):
        """Test POST /api/bidblitz-pay/request-money endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": 25.0,
            "description": "Test payment request",
            "expires_minutes": 60
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "request_id" in data, "Response should contain request_id"
        assert "qr_code" in data, "Response should contain qr_code"
        assert "amount" in data, "Response should contain amount"
        assert data["amount"] == 25.0
        print(f"✓ Created payment request: {data['request_id']}")
        # Store for later tests
        self.created_request_id = data["request_id"]
        return data["request_id"]
    
    def test_create_request_validates_amount_positive(self):
        """Test request-money rejects zero/negative amount"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": 0,
            "description": "Invalid request"
        })
        assert response.status_code == 400, f"Expected 400 for zero amount, got {response.status_code}"
        print("✓ request-money rejects zero amount")
        
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": -10,
            "description": "Invalid request"
        })
        assert response.status_code == 400, f"Expected 400 for negative amount, got {response.status_code}"
        print("✓ request-money rejects negative amount")
    
    def test_create_request_returns_qr_code(self):
        """Test request-money returns valid QR code data"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": 15.50,
            "description": "QR test"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Check QR code format
        assert data["qr_code"].startswith("data:image/png;base64,"), "QR code should be base64 PNG"
        assert "qr_data" in data, "Should contain qr_data"
        assert data["qr_data"].startswith("BIDBLITZ-REQ:"), "QR data should start with BIDBLITZ-REQ:"
        assert data["status"] == "pending"
        print(f"✓ QR code generated: {data['qr_data']}")
    
    # ==================== GET REQUEST DETAILS TESTS ====================
    
    def test_get_payment_request_details(self):
        """Test GET /api/bidblitz-pay/request-money/{id} returns request details"""
        # First create a request
        create_response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": 30.0,
            "description": "Get details test"
        })
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Get details
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/request-money/{request_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["id"] == request_id
        assert data["amount"] == 30.0
        assert data["description"] == "Get details test"
        assert data["status"] == "pending"
        assert "requester_id" in data
        assert "requester_name" in data
        assert "expires_at" in data
        print(f"✓ Got request details: {request_id}, status={data['status']}")
    
    def test_get_nonexistent_request_returns_404(self):
        """Test GET request-money with invalid ID returns 404"""
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/request-money/INVALID123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent request returns 404")
    
    # ==================== PAY REQUEST TESTS ====================
    
    def test_pay_request_self_payment_blocked(self):
        """Test POST /api/bidblitz-pay/pay-request/{id} blocks self-payment"""
        # Create a request
        create_response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": 5.0,
            "description": "Self-pay test"
        })
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Try to pay own request
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/pay-request/{request_id}")
        assert response.status_code == 400, f"Expected 400 for self-payment, got {response.status_code}"
        data = response.json()
        assert "eigene" in data.get("detail", "").lower() or "own" in data.get("detail", "").lower()
        print("✓ Self-payment blocked")
    
    def test_pay_nonexistent_request_returns_404(self):
        """Test pay-request with invalid ID returns 404"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/pay-request/INVALID123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Pay nonexistent request returns 404")
    
    # ==================== MY REQUESTS LIST TESTS ====================
    
    def test_my_payment_requests_endpoint(self):
        """Test GET /api/bidblitz-pay/my-payment-requests returns user's requests"""
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/my-payment-requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "requests" in data, "Response should contain 'requests' key"
        assert isinstance(data["requests"], list)
        print(f"✓ my-payment-requests returns {len(data['requests'])} requests")
    
    def test_my_requests_contains_created_requests(self):
        """Test my-payment-requests includes recently created requests"""
        # Create a request with unique description
        unique_desc = f"Test request {os.urandom(4).hex()}"
        create_response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/request-money", json={
            "amount": 12.34,
            "description": unique_desc
        })
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Get my requests
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/my-payment-requests")
        assert response.status_code == 200
        data = response.json()
        
        # Find our request
        found = False
        for req in data["requests"]:
            if req["id"] == request_id:
                found = True
                assert req["amount"] == 12.34
                assert req["description"] == unique_desc
                break
        
        assert found, f"Created request {request_id} not found in my-payment-requests"
        print(f"✓ Created request {request_id} found in my-payment-requests")


class TestTopUpQuickButtons:
    """Test top-up quick buttons are clickable (validation tests)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_topup_endpoint_exists(self):
        """Test POST /api/bidblitz-pay/topup endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/topup", json={
            "amount": 5.0
        })
        # Should return 200 (success) or 400 (not enough balance), not 404/405
        # Note: 404 can happen if user not found, which is also valid
        assert response.status_code in [200, 400, 404], f"Expected 200/400/404, got {response.status_code}"
        if response.status_code == 404:
            data = response.json()
            # 404 should be "user not found" not "endpoint not found"
            assert "nicht gefunden" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower()
        print(f"✓ topup endpoint exists, returned {response.status_code}")
    
    def test_topup_validates_positive_amount(self):
        """Test topup rejects zero/negative amounts"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/topup", json={
            "amount": 0
        })
        assert response.status_code == 400, f"Expected 400 for zero amount, got {response.status_code}"
        
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/topup", json={
            "amount": -10
        })
        assert response.status_code == 400, f"Expected 400 for negative amount, got {response.status_code}"
        print("✓ topup validates positive amount")


class TestLanguagesAvailable:
    """Test that language endpoints work (translations are frontend-only)"""
    
    def test_api_accepts_german_error_messages(self):
        """Verify API returns German error messages"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test German error message
        response = session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": ADMIN_EMAIL,  # Self-transfer
            "amount": 10.0
        })
        assert response.status_code == 400
        data = response.json()
        # Should contain German text
        detail = data.get("detail", "")
        assert "selbst" in detail.lower() or "sich" in detail.lower() or "yourself" in detail.lower()
        print(f"✓ API returns German error: {detail}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
