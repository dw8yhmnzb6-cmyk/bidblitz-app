"""
Test Admin Identity Canonical Bug Fix - Iteration 204
Verifies that admin@bidblitz.ae is the canonical admin and legacy admin@bidblitz.com
identity/balance values no longer appear.

Key assertions:
1. Login as admin@bidblitz.ae returns canonical admin identity
2. GET /api/auth/me returns canonical admin with correct balances
3. Admin analytics endpoints return canonical admin with correct balances
4. Legacy hardcoded values (63366525.91 / 91.0) must NOT appear
5. admin@bidblitz.com login should fail or not return admin role
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Canonical admin credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Legacy admin email (should be disabled)
LEGACY_ADMIN_EMAIL = "admin@bidblitz.com"

# Canonical admin balance values (from seed_admin in server.py)
CANONICAL_BALANCE_EUR = 2622000000.0
CANONICAL_BALANCE_BLZ = 0.0

# Legacy hardcoded values that should NOT appear
LEGACY_HARDCODED_BALANCE_EUR = 63366525.91
LEGACY_HARDCODED_BALANCE_BLZ = 91.0


class TestAdminIdentityCanonical:
    """Test canonical admin identity and balance enforcement"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
        self.session.close()

    def test_01_admin_login_returns_canonical_identity(self):
        """Login as admin@bidblitz.ae must return canonical admin identity"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Verify canonical email
        assert data.get("email") == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {data.get('email')}"
        assert data.get("canonical_email") == ADMIN_EMAIL, f"Expected canonical_email {ADMIN_EMAIL}, got {data.get('canonical_email')}"
        
        # Verify role
        assert data.get("role") == "admin", f"Expected role admin, got {data.get('role')}"
        
        # Verify canonical balances
        balance = data.get("balance", 0)
        balance_blz = data.get("balance_blz", 0)
        
        assert balance == CANONICAL_BALANCE_EUR, f"Expected balance {CANONICAL_BALANCE_EUR}, got {balance}"
        assert balance_blz == CANONICAL_BALANCE_BLZ, f"Expected balance_blz {CANONICAL_BALANCE_BLZ}, got {balance_blz}"
        
        # Verify legacy hardcoded values do NOT appear
        assert balance != LEGACY_HARDCODED_BALANCE_EUR, f"Legacy hardcoded balance {LEGACY_HARDCODED_BALANCE_EUR} should not appear"
        assert balance_blz != LEGACY_HARDCODED_BALANCE_BLZ, f"Legacy hardcoded balance_blz {LEGACY_HARDCODED_BALANCE_BLZ} should not appear"
        
        print(f"✓ Admin login returns canonical identity: {data.get('email')} with balance €{balance}")

    def test_02_auth_me_returns_canonical_admin(self):
        """GET /api/auth/me after admin login must return canonical admin identity"""
        # First login
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        
        # Get /api/auth/me
        me_resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200, f"GET /api/auth/me failed: {me_resp.text}"
        
        data = me_resp.json()
        
        # Verify canonical email
        assert data.get("email") == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {data.get('email')}"
        assert data.get("canonical_email") == ADMIN_EMAIL, f"Expected canonical_email {ADMIN_EMAIL}, got {data.get('canonical_email')}"
        
        # Verify canonical balances
        balance = data.get("balance", 0)
        balance_blz = data.get("balance_blz", 0)
        
        assert balance == CANONICAL_BALANCE_EUR, f"Expected balance {CANONICAL_BALANCE_EUR}, got {balance}"
        assert balance_blz == CANONICAL_BALANCE_BLZ, f"Expected balance_blz {CANONICAL_BALANCE_BLZ}, got {balance_blz}"
        
        # Verify legacy hardcoded values do NOT appear
        assert balance != LEGACY_HARDCODED_BALANCE_EUR, f"Legacy hardcoded balance should not appear"
        assert balance_blz != LEGACY_HARDCODED_BALANCE_BLZ, f"Legacy hardcoded balance_blz should not appear"
        
        print(f"✓ GET /api/auth/me returns canonical admin: {data.get('email')} with balance €{balance}")

    def test_03_admin_analytics_online_canonical_admin(self):
        """GET /api/admin/analytics/online must show canonical admin with correct balances"""
        # First login as admin
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        
        # Get online users
        online_resp = self.session.get(f"{BASE_URL}/api/admin/analytics/online?minutes=60")
        assert online_resp.status_code == 200, f"GET /api/admin/analytics/online failed: {online_resp.text}"
        
        data = online_resp.json()
        online_users = data.get("online_users", [])
        
        # Find admin in online users
        admin_user = None
        for user in online_users:
            if user.get("email") == ADMIN_EMAIL or user.get("role") == "admin":
                admin_user = user
                break
        
        if admin_user:
            # Verify canonical email
            assert admin_user.get("email") == ADMIN_EMAIL, f"Expected admin email {ADMIN_EMAIL}, got {admin_user.get('email')}"
            
            # Verify canonical balances
            balance_eur = admin_user.get("balance_eur", 0)
            balance_blz = admin_user.get("balance_blz", 0)
            
            assert balance_eur == CANONICAL_BALANCE_EUR, f"Expected balance_eur {CANONICAL_BALANCE_EUR}, got {balance_eur}"
            assert balance_blz == CANONICAL_BALANCE_BLZ, f"Expected balance_blz {CANONICAL_BALANCE_BLZ}, got {balance_blz}"
            
            # Verify legacy hardcoded values do NOT appear
            assert balance_eur != LEGACY_HARDCODED_BALANCE_EUR, f"Legacy hardcoded balance_eur should not appear"
            assert balance_blz != LEGACY_HARDCODED_BALANCE_BLZ, f"Legacy hardcoded balance_blz should not appear"
            
            print(f"✓ Admin analytics/online shows canonical admin: {admin_user.get('email')} with balance €{balance_eur}")
        else:
            print("⚠ Admin not found in online users (may not be active recently)")

    def test_04_admin_analytics_last_seen_canonical_admin(self):
        """GET /api/admin/analytics/last-seen must show canonical admin with correct email"""
        # First login as admin
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        
        # Get last seen users
        last_seen_resp = self.session.get(f"{BASE_URL}/api/admin/analytics/last-seen?limit=100")
        assert last_seen_resp.status_code == 200, f"GET /api/admin/analytics/last-seen failed: {last_seen_resp.text}"
        
        data = last_seen_resp.json()
        users = data.get("users", [])
        
        # Find admin in users
        admin_user = None
        for user in users:
            if user.get("email") == ADMIN_EMAIL or user.get("role") == "admin":
                admin_user = user
                break
        
        if admin_user:
            # Verify canonical email (should be admin@bidblitz.ae, not admin@bidblitz.com)
            assert admin_user.get("email") == ADMIN_EMAIL, f"Expected admin email {ADMIN_EMAIL}, got {admin_user.get('email')}"
            
            # Verify legacy email does NOT appear
            assert admin_user.get("email") != LEGACY_ADMIN_EMAIL, f"Legacy admin email {LEGACY_ADMIN_EMAIL} should not appear"
            
            print(f"✓ Admin analytics/last-seen shows canonical admin: {admin_user.get('email')}")
        else:
            print("⚠ Admin not found in last-seen users")

    def test_05_legacy_admin_login_disabled(self):
        """Login with admin@bidblitz.com should fail or not return admin role"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": LEGACY_ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        # Either login should fail (401/403) or return non-admin role
        if response.status_code == 200:
            data = response.json()
            # If login succeeds, it should NOT be admin role
            role = data.get("role", "")
            assert role != "admin", f"Legacy admin {LEGACY_ADMIN_EMAIL} should not have admin role, got {role}"
            print(f"✓ Legacy admin login returns non-admin role: {role}")
        else:
            # Login failed as expected
            assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
            print(f"✓ Legacy admin login correctly rejected with status {response.status_code}")

    def test_06_no_legacy_hardcoded_values_in_online_users(self):
        """Verify legacy hardcoded values (63366525.91 / 91.0) do not appear in online users"""
        # First login as admin
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        
        # Get online users
        online_resp = self.session.get(f"{BASE_URL}/api/admin/analytics/online?minutes=60")
        assert online_resp.status_code == 200, f"GET /api/admin/analytics/online failed: {online_resp.text}"
        
        data = online_resp.json()
        online_users = data.get("online_users", [])
        
        # Check all users for legacy hardcoded values
        for user in online_users:
            balance_eur = user.get("balance_eur", 0)
            balance_blz = user.get("balance_blz", 0)
            
            # Legacy hardcoded values should NOT appear for any admin user
            if user.get("role") == "admin":
                assert balance_eur != LEGACY_HARDCODED_BALANCE_EUR, f"Legacy hardcoded balance_eur {LEGACY_HARDCODED_BALANCE_EUR} found for {user.get('email')}"
                assert balance_blz != LEGACY_HARDCODED_BALANCE_BLZ, f"Legacy hardcoded balance_blz {LEGACY_HARDCODED_BALANCE_BLZ} found for {user.get('email')}"
        
        print(f"✓ No legacy hardcoded values found in {len(online_users)} online users")

    def test_07_admin_customers_list_canonical_admin(self):
        """GET /api/admin/customers should show canonical admin email"""
        # First login as admin
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        
        # Get customers list with admin filter
        customers_resp = self.session.get(f"{BASE_URL}/api/admin/customers?role=admin&limit=10")
        assert customers_resp.status_code == 200, f"GET /api/admin/customers failed: {customers_resp.text}"
        
        data = customers_resp.json()
        customers = data.get("customers", [])
        
        # Find canonical admin
        canonical_admin_found = False
        for customer in customers:
            if customer.get("email") == ADMIN_EMAIL:
                canonical_admin_found = True
                # Verify balance
                balance = customer.get("balance", 0)
                balance_blz = customer.get("balance_blz", 0)
                
                assert balance == CANONICAL_BALANCE_EUR, f"Expected balance {CANONICAL_BALANCE_EUR}, got {balance}"
                assert balance_blz == CANONICAL_BALANCE_BLZ, f"Expected balance_blz {CANONICAL_BALANCE_BLZ}, got {balance_blz}"
                
                print(f"✓ Admin customers list shows canonical admin: {customer.get('email')} with balance €{balance}")
                break
        
        assert canonical_admin_found, f"Canonical admin {ADMIN_EMAIL} not found in customers list"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
