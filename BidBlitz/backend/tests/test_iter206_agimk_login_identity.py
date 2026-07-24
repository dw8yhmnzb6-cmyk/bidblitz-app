"""
Iteration 206 - agimk@me.com Login Identity Verification Tests

Focus:
1. Login with agimk@me.com / Aldink56600 succeeds
2. After login, returned user must be exactly agimk@me.com (login_email/canonical_email/email)
3. /api/auth/me must return the same identity
4. Must not silently switch to another account
5. Admin login regression test
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
CUSTOMER_EMAIL = "agimk@me.com"
CUSTOMER_PASSWORD = "Aldink56600"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestAgimkLoginIdentity:
    """Test agimk@me.com login and identity consistency"""
    
    def test_agimk_login_success(self):
        """Test that agimk@me.com can login successfully"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify user data is returned
        assert "id" in data, "Response missing 'id'"
        assert "email" in data, "Response missing 'email'"
        
        print(f"Login response: id={data.get('id')}, email={data.get('email')}, login_email={data.get('login_email')}, canonical_email={data.get('canonical_email')}")
        
        # Store session for next test
        self.session = session
        self.user_data = data
    
    def test_agimk_identity_matches_requested_email(self):
        """Verify returned identity matches the requested email exactly"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # CRITICAL: All email fields must match agimk@me.com
        email = data.get("email", "").lower().strip()
        login_email = data.get("login_email", "").lower().strip()
        canonical_email = data.get("canonical_email", "").lower().strip()
        
        expected_email = CUSTOMER_EMAIL.lower().strip()
        
        print(f"Identity check: email={email}, login_email={login_email}, canonical_email={canonical_email}")
        
        # At least one of these must match the requested email
        assert email == expected_email or login_email == expected_email or canonical_email == expected_email, \
            f"Identity mismatch! Expected {expected_email}, got email={email}, login_email={login_email}, canonical_email={canonical_email}"
        
        # Verify email field specifically
        assert email == expected_email, f"Email field mismatch: expected {expected_email}, got {email}"
    
    def test_agimk_me_endpoint_consistency(self):
        """Verify /api/auth/me returns the same identity after login"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        
        # Now call /api/auth/me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, f"/api/auth/me failed: {me_response.text}"
        me_data = me_response.json()
        
        print(f"Login data: id={login_data.get('id')}, email={login_data.get('email')}")
        print(f"Me data: id={me_data.get('id')}, email={me_data.get('email')}")
        
        # CRITICAL: Both must return the same user
        assert login_data.get("id") == me_data.get("id"), \
            f"User ID mismatch! Login returned {login_data.get('id')}, /me returned {me_data.get('id')}"
        
        assert login_data.get("email", "").lower() == me_data.get("email", "").lower(), \
            f"Email mismatch! Login returned {login_data.get('email')}, /me returned {me_data.get('email')}"
    
    def test_agimk_no_account_switch(self):
        """Verify login does not silently switch to another account"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        
        # Get user ID from login
        login_user_id = login_data.get("id")
        login_email = login_data.get("email", "").lower()
        
        # Call /me multiple times to ensure consistency
        for i in range(3):
            me_response = session.get(f"{BASE_URL}/api/auth/me")
            assert me_response.status_code == 200, f"/api/auth/me call {i+1} failed"
            me_data = me_response.json()
            
            assert me_data.get("id") == login_user_id, \
                f"Account switch detected on call {i+1}! Expected {login_user_id}, got {me_data.get('id')}"
            assert me_data.get("email", "").lower() == login_email, \
                f"Email switch detected on call {i+1}! Expected {login_email}, got {me_data.get('email')}"
        
        print(f"No account switch detected after 3 /me calls. User ID: {login_user_id}")


class TestAdminLoginRegression:
    """Admin login regression tests"""
    
    def test_admin_login_success(self):
        """Test admin login still works"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        assert data.get("role") == "admin", f"Expected admin role, got {data.get('role')}"
        assert data.get("email", "").lower() == ADMIN_EMAIL.lower(), \
            f"Admin email mismatch: expected {ADMIN_EMAIL}, got {data.get('email')}"
        
        print(f"Admin login successful: id={data.get('id')}, email={data.get('email')}, role={data.get('role')}")
    
    def test_admin_me_endpoint(self):
        """Test /api/auth/me returns admin correctly"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        
        # Get /me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        
        assert me_data.get("role") == "admin"
        assert me_data.get("email", "").lower() == ADMIN_EMAIL.lower()


class TestStaleSessionHandling:
    """Test stale session handling during login"""
    
    def test_login_clears_previous_session(self):
        """Test that logging in clears any previous session"""
        session = requests.Session()
        
        # First login as admin
        admin_login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert admin_login.status_code == 200
        admin_data = admin_login.json()
        admin_id = admin_data.get("id")
        
        # Verify we're logged in as admin
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        assert me_response.json().get("id") == admin_id
        
        # Now login as agimk@me.com (should clear admin session)
        customer_login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        assert customer_login.status_code == 200
        customer_data = customer_login.json()
        customer_id = customer_data.get("id")
        
        # CRITICAL: Must now be logged in as customer, not admin
        assert customer_id != admin_id, "User ID should be different after switching accounts"
        
        # Verify /me returns customer, not admin
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        
        assert me_data.get("id") == customer_id, \
            f"Session not properly switched! Expected {customer_id}, got {me_data.get('id')}"
        assert me_data.get("email", "").lower() == CUSTOMER_EMAIL.lower(), \
            f"Email not properly switched! Expected {CUSTOMER_EMAIL}, got {me_data.get('email')}"
        
        print(f"Session properly switched from admin ({admin_id}) to customer ({customer_id})")
    
    def test_logout_then_login_different_user(self):
        """Test logout followed by login as different user"""
        session = requests.Session()
        
        # Login as admin
        admin_login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert admin_login.status_code == 200
        admin_id = admin_login.json().get("id")
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        
        # Verify logged out
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 401, "Should be logged out"
        
        # Login as customer
        customer_login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        assert customer_login.status_code == 200
        customer_data = customer_login.json()
        
        # Verify identity
        assert customer_data.get("email", "").lower() == CUSTOMER_EMAIL.lower()
        assert customer_data.get("id") != admin_id
        
        print("Logout then login as different user works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
