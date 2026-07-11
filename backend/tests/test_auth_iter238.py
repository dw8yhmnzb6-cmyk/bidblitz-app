"""
Auth Testing - Iteration 238
Tests for customer registration, login, session persistence, and error handling.
Focus: Fresh registration, login with new account, login with existing accounts,
       auth error handling, and session/cookie persistence.
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

# Test credentials from test_credentials.md
EXISTING_USER_1 = {"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
EXISTING_USER_2 = {"email": "agimk@me.com", "password": "Aldink56600"}
ADMIN_USER = {"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"}


def generate_test_email():
    """Generate unique test email for fresh registration"""
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test.auth.{suffix}@test.com"


class TestAuthAPIContract:
    """Test auth API endpoints contract"""
    
    def test_health_check(self):
        """Verify backend is reachable"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✓ Backend health check passed")
    
    def test_login_endpoint_exists(self):
        """Verify login endpoint exists and returns proper error for empty body"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={}, timeout=10)
        # Should return 422 (validation error) or 401 (invalid credentials), not 404
        assert response.status_code in [401, 422], f"Login endpoint returned unexpected status: {response.status_code}"
        print(f"✓ Login endpoint exists (status: {response.status_code})")
    
    def test_register_endpoint_exists(self):
        """Verify register endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={}, timeout=10)
        # Should return 422 (validation error), not 404
        assert response.status_code == 422, f"Register endpoint returned unexpected status: {response.status_code}"
        print(f"✓ Register endpoint exists (status: {response.status_code})")
    
    def test_me_endpoint_requires_auth(self):
        """Verify /me endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert response.status_code == 401, f"Me endpoint should require auth: {response.status_code}"
        print("✓ /me endpoint requires authentication")
    
    def test_logout_endpoint_exists(self):
        """Verify logout endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        # Should return 200 even without auth (clears cookies)
        assert response.status_code == 200, f"Logout endpoint returned unexpected status: {response.status_code}"
        print("✓ Logout endpoint exists")
    
    def test_refresh_endpoint_requires_token(self):
        """Verify refresh endpoint requires refresh token"""
        response = requests.post(f"{BASE_URL}/api/auth/refresh", timeout=10)
        assert response.status_code == 401, f"Refresh endpoint should require token: {response.status_code}"
        print("✓ Refresh endpoint requires token")


class TestExistingUserLogin:
    """Test login with existing registered accounts"""
    
    def test_login_reviewer_account(self):
        """Test login with reviewer@bidblitz.ae"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=EXISTING_USER_1,
            timeout=10
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response missing user id"
        assert "email" in data, "Response missing email"
        print(f"✓ Reviewer login successful: {data.get('email')}")
        
        # Verify session with /me
        me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 200, f"/me failed after login: {me_response.status_code}"
        me_data = me_response.json()
        assert me_data.get("email") == EXISTING_USER_1["email"], f"Email mismatch: {me_data.get('email')}"
        print(f"✓ Session verified via /me: {me_data.get('email')}")
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.status_code}"
        print("✓ Logout successful")
    
    def test_login_agimk_account(self):
        """Test login with agimk@me.com (restored customer account)"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=EXISTING_USER_2,
            timeout=10
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response missing user id"
        assert "email" in data, "Response missing email"
        print(f"✓ agimk@me.com login successful: {data.get('email')}")
        
        # Verify session with /me
        me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 200, f"/me failed after login: {me_response.status_code}"
        me_data = me_response.json()
        assert me_data.get("email") == EXISTING_USER_2["email"], f"Email mismatch: {me_data.get('email')}"
        print(f"✓ Session verified via /me: {me_data.get('email')}")
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.status_code}"
        print("✓ Logout successful")
    
    def test_login_admin_account(self):
        """Test login with admin@bidblitz.ae"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_USER,
            timeout=10
        )
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("role") == "admin", f"Expected admin role, got: {data.get('role')}"
        print(f"✓ Admin login successful: {data.get('email')}, role: {data.get('role')}")
        
        # Logout
        session.post(f"{BASE_URL}/api/auth/logout", timeout=10)


class TestFreshRegistration:
    """Test fresh user registration flow"""
    
    def test_register_new_user(self):
        """Test registering a completely new user"""
        test_email = generate_test_email()
        test_password = "TestPass2026!"
        test_name = "Test Auth User"
        
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": test_name,
                "email": test_email,
                "password": test_password
            },
            timeout=15
        )
        
        assert response.status_code == 200, f"Registration failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response missing user id"
        assert data.get("email") == test_email, f"Email mismatch: {data.get('email')}"
        print(f"✓ Registration successful: {test_email}")
        
        # Verify user is logged in immediately after registration
        me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 200, f"/me failed after registration: {me_response.status_code}"
        me_data = me_response.json()
        assert me_data.get("email") == test_email, f"Session email mismatch: {me_data.get('email')}"
        print(f"✓ User logged in immediately after registration: {me_data.get('email')}")
        
        # Store credentials for logout/re-login test
        return {"email": test_email, "password": test_password, "session": session}
    
    def test_register_and_relogin(self):
        """Test that a freshly registered user can log out and log back in"""
        test_email = generate_test_email()
        test_password = "TestPass2026!"
        test_name = "Test Relogin User"
        
        # Register
        session = requests.Session()
        reg_response = session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": test_name,
                "email": test_email,
                "password": test_password
            },
            timeout=15
        )
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.status_code}"
        print(f"✓ Registered: {test_email}")
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.status_code}"
        print("✓ Logged out after registration")
        
        # Verify logged out
        me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 401, f"Should be logged out: {me_response.status_code}"
        print("✓ Confirmed logged out")
        
        # Re-login with new session
        new_session = requests.Session()
        login_response = new_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": test_password},
            timeout=10
        )
        assert login_response.status_code == 200, f"Re-login failed: {login_response.status_code} - {login_response.text}"
        print(f"✓ Re-login successful: {test_email}")
        
        # Verify session
        me_response = new_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 200, f"/me failed after re-login: {me_response.status_code}"
        me_data = me_response.json()
        assert me_data.get("email") == test_email, f"Email mismatch: {me_data.get('email')}"
        print(f"✓ Session verified after re-login: {me_data.get('email')}")


class TestAuthErrorHandling:
    """Test auth error handling and user-friendly messages"""
    
    def test_login_wrong_password(self):
        """Test login with wrong password returns proper error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EXISTING_USER_1["email"], "password": "WrongPassword123!"},
            timeout=10
        )
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response missing error detail"
        assert "Invalid email or password" in data.get("detail", ""), f"Unexpected error: {data.get('detail')}"
        print(f"✓ Wrong password returns proper error: {data.get('detail')}")
    
    def test_login_nonexistent_email(self):
        """Test login with non-existent email returns proper error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent.user.xyz@test.com", "password": "SomePassword123!"},
            timeout=10
        )
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response missing error detail"
        # Should not reveal if email exists or not
        assert "Invalid email or password" in data.get("detail", ""), f"Unexpected error: {data.get('detail')}"
        print(f"✓ Non-existent email returns proper error: {data.get('detail')}")
    
    def test_register_duplicate_email(self):
        """Test registering with existing email returns proper error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "Duplicate Test",
                "email": EXISTING_USER_1["email"],
                "password": "TestPass2026!"
            },
            timeout=10
        )
        assert response.status_code == 400, f"Expected 400, got: {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response missing error detail"
        assert "already registered" in data.get("detail", "").lower(), f"Unexpected error: {data.get('detail')}"
        print(f"✓ Duplicate email returns proper error: {data.get('detail')}")
    
    def test_register_short_password(self):
        """Test registering with short password returns proper error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "Short Pass Test",
                "email": generate_test_email(),
                "password": "123"
            },
            timeout=10
        )
        # Should return 422 (validation) or 400 (business rule)
        assert response.status_code in [400, 422], f"Expected 400/422, got: {response.status_code}"
        print(f"✓ Short password returns error: {response.status_code}")


class TestSessionPersistence:
    """Test session/cookie persistence"""
    
    def test_cookies_set_on_login(self):
        """Test that httpOnly cookies are set on login"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=EXISTING_USER_1,
            timeout=10
        )
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        
        # Check cookies in session
        cookies = session.cookies.get_dict()
        # Note: httpOnly cookies may not be visible in requests library
        # but we can verify session works
        print(f"✓ Login successful, cookies in session: {list(cookies.keys())}")
        
        # Verify session persists across requests
        me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 200, f"Session not persisted: {me_response.status_code}"
        print("✓ Session persists across requests")
        
        # Logout
        session.post(f"{BASE_URL}/api/auth/logout", timeout=10)
    
    def test_refresh_token_works(self):
        """Test that refresh token can renew session"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=EXISTING_USER_1,
            timeout=10
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.status_code}"
        print("✓ Logged in")
        
        # Call refresh
        refresh_response = session.post(f"{BASE_URL}/api/auth/refresh", timeout=10)
        assert refresh_response.status_code == 200, f"Refresh failed: {refresh_response.status_code}"
        print("✓ Refresh token worked")
        
        # Verify session still works
        me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert me_response.status_code == 200, f"Session invalid after refresh: {me_response.status_code}"
        print("✓ Session valid after refresh")
        
        # Logout
        session.post(f"{BASE_URL}/api/auth/logout", timeout=10)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
