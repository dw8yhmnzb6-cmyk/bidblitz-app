"""
BidBlitz V2 API Tests - Phase 5 Real Backend
Tests: Health, Auth (register/login/me/logout), Wallet (get/topup), Transactions, Merchant Dashboard
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
TEST_USER_EMAIL = "max@test.com"
TEST_USER_PASSWORD = "test1234"


def random_email():
    """Generate random email for registration tests"""
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"TEST_user_{suffix}@test.com"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_health(self):
        """GET /api returns 200 with status online"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "online", f"Expected status 'online', got {data}"
        assert "BidBlitz" in data.get("message", ""), "Expected BidBlitz in message"
        print(f"✓ Health check passed: {data}")


class TestAuthRegister:
    """Registration endpoint tests"""
    
    def test_register_new_user(self):
        """POST /api/auth/register creates new user with balance 0"""
        email = random_email()
        payload = {
            "email": email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("email") == email.lower(), f"Email mismatch: {data}"
        assert data.get("name") == "Test User", f"Name mismatch: {data}"
        assert data.get("balance") == 0.0, f"Expected balance 0, got {data.get('balance')}"
        assert data.get("role") == "user", f"Expected role 'user', got {data.get('role')}"
        assert "id" in data, "Missing user id in response"
        
        # Check cookies are set
        cookies = response.cookies
        assert "access_token" in cookies or response.headers.get("set-cookie"), "Expected auth cookies"
        print(f"✓ Register passed: {email} with balance {data.get('balance')}")
    
    def test_register_duplicate_email(self):
        """POST /api/auth/register with existing email returns 400"""
        # First register
        email = random_email()
        payload = {"email": email, "password": "TestPass123!", "name": "First User"}
        requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Try duplicate
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print(f"✓ Duplicate email rejected correctly")


class TestAuthLogin:
    """Login endpoint tests"""
    
    def test_login_admin_success(self):
        """POST /api/auth/login with admin credentials returns user with balance >= 1500"""
        payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("email") == ADMIN_EMAIL.lower(), f"Email mismatch: {data}"
        assert data.get("role") == "admin", f"Expected admin role, got {data.get('role')}"
        assert data.get("balance", 0) >= 1500, f"Expected balance >= 1500, got {data.get('balance')}"
        assert "id" in data, "Missing user id"
        print(f"✓ Admin login passed: balance={data.get('balance')}, role={data.get('role')}")
        return response.cookies
    
    def test_login_wrong_password(self):
        """POST /api/auth/login with wrong password returns 401"""
        payload = {"email": ADMIN_EMAIL, "password": "WrongPassword123!"}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Wrong password rejected with 401")
    
    def test_login_nonexistent_user(self):
        """POST /api/auth/login with nonexistent email returns 401"""
        payload = {"email": "nonexistent@test.com", "password": "SomePass123!"}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Nonexistent user rejected with 401")


class TestAuthMe:
    """GET /api/auth/me endpoint tests"""
    
    def test_get_me_with_valid_session(self):
        """GET /api/auth/me with valid session cookie returns user data"""
        # First login to get cookies
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Now get /me
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200, f"Expected 200, got {me_resp.status_code}: {me_resp.text}"
        
        data = me_resp.json()
        assert data.get("email") == ADMIN_EMAIL.lower(), f"Email mismatch: {data}"
        assert "id" in data, "Missing user id"
        assert "balance" in data, "Missing balance"
        print(f"✓ GET /me passed: {data.get('email')}, balance={data.get('balance')}")
    
    def test_get_me_without_session(self):
        """GET /api/auth/me without session returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ GET /me without session rejected with 401")


class TestWallet:
    """Wallet endpoint tests"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_get_wallet(self, auth_session):
        """GET /api/wallet returns balance, card_number, transactions"""
        response = auth_session.get(f"{BASE_URL}/api/wallet")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "balance" in data, "Missing balance"
        assert "card_number" in data, "Missing card_number"
        assert "transactions" in data, "Missing transactions"
        assert isinstance(data["transactions"], list), "transactions should be a list"
        print(f"✓ GET /wallet passed: balance={data['balance']}, card={data['card_number'][:8]}...")
    
    def test_wallet_topup(self, auth_session):
        """POST /api/wallet/topup increases balance"""
        # Get initial balance
        wallet_before = auth_session.get(f"{BASE_URL}/api/wallet").json()
        initial_balance = wallet_before["balance"]
        
        # Top up
        topup_amount = 50
        response = auth_session.post(f"{BASE_URL}/api/wallet/topup", json={
            "amount": topup_amount,
            "payment_method": "apple_pay"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert data.get("new_balance") == initial_balance + topup_amount, \
            f"Expected balance {initial_balance + topup_amount}, got {data.get('new_balance')}"
        assert "transaction" in data, "Missing transaction in response"
        
        # Verify with GET
        wallet_after = auth_session.get(f"{BASE_URL}/api/wallet").json()
        assert wallet_after["balance"] == initial_balance + topup_amount, \
            f"Balance not persisted: expected {initial_balance + topup_amount}, got {wallet_after['balance']}"
        print(f"✓ Topup passed: {initial_balance} + {topup_amount} = {wallet_after['balance']}")
    
    def test_wallet_without_auth(self):
        """GET /api/wallet without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/wallet")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Wallet without auth rejected with 401")


class TestTransactions:
    """Transactions endpoint tests"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_get_transactions(self, auth_session):
        """GET /api/transactions returns list of transactions"""
        response = auth_session.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Missing transactions"
        assert "total" in data, "Missing total count"
        assert isinstance(data["transactions"], list), "transactions should be a list"
        print(f"✓ GET /transactions passed: {len(data['transactions'])} transactions, total={data['total']}")
    
    def test_transactions_without_auth(self):
        """GET /api/transactions without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Transactions without auth rejected with 401")


class TestMerchantDashboard:
    """Merchant dashboard endpoint tests"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_get_merchant_dashboard(self, auth_session):
        """GET /api/merchant/dashboard returns merchant stats"""
        response = auth_session.get(f"{BASE_URL}/api/merchant/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "business_name" in data, "Missing business_name"
        assert "total_earnings" in data, "Missing total_earnings"
        assert "total_transactions" in data, "Missing total_transactions"
        assert "today_earnings" in data, "Missing today_earnings"
        assert "recent_payments" in data, "Missing recent_payments"
        print(f"✓ GET /merchant/dashboard passed: {data['business_name']}, earnings={data['total_earnings']}")
    
    def test_merchant_without_auth(self):
        """GET /api/merchant/dashboard without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/merchant/dashboard")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Merchant dashboard without auth rejected with 401")


class TestAuthLogout:
    """Logout endpoint tests"""
    
    def test_logout(self):
        """POST /api/auth/logout clears session"""
        session = requests.Session()
        # Login first
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        
        # Logout
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200, f"Expected 200, got {logout_resp.status_code}"
        
        # Verify session is cleared - /me should fail
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 401, f"Expected 401 after logout, got {me_resp.status_code}"
        print(f"✓ Logout passed: session cleared")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
