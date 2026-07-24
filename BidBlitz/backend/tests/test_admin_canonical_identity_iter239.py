"""
Iteration 239: Admin Canonical Identity Consistency Tests

Tests that for admin@bidblitz.ae:
1. /api/auth/me returns canonical admin identity
2. /api/admin/wallet/users search returns canonical admin identity with correct balance
3. /api/admin/wallet/users/{user_id}/login-history returns canonical admin identity
4. /api/admin/customers search returns canonical admin identity
5. All endpoints return consistent balance, registration date, last login, login count
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return session


class TestAdminCanonicalIdentity:
    """Test canonical admin identity consistency across all endpoints."""
    
    def test_auth_me_returns_canonical_admin(self, admin_session):
        """GET /api/auth/me should return canonical admin identity."""
        resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, f"GET /api/auth/me failed: {resp.text}"
        
        data = resp.json()
        assert data.get("email") == "admin@bidblitz.ae", f"Expected canonical email admin@bidblitz.ae, got {data.get('email')}"
        assert data.get("role") == "admin", f"Expected role admin, got {data.get('role')}"
        assert data.get("name") == "BidBlitz Admin", f"Expected name BidBlitz Admin, got {data.get('name')}"
        
        # Store balance for comparison
        self.__class__.auth_me_balance = float(data.get("balance", 0) or 0)
        self.__class__.auth_me_balance_blz = float(data.get("balance_blz", 0) or 0)
        print(f"✓ /api/auth/me: email={data.get('email')}, balance={self.__class__.auth_me_balance}, balance_blz={self.__class__.auth_me_balance_blz}")
    
    def test_admin_wallet_search_returns_canonical_admin(self, admin_session):
        """GET /api/admin/wallet/users?q=admin@bidblitz.ae should return canonical admin."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?q=admin@bidblitz.ae")
        assert resp.status_code == 200, f"Admin wallet search failed: {resp.text}"
        
        data = resp.json()
        users = data.get("users", [])
        assert len(users) >= 1, "Expected at least 1 admin user in search results"
        
        # Find the admin user
        admin_user = None
        for u in users:
            if u.get("email") == "admin@bidblitz.ae" or u.get("canonical_email") == "admin@bidblitz.ae":
                admin_user = u
                break
        
        assert admin_user is not None, "Admin user not found in search results"
        assert admin_user.get("email") == "admin@bidblitz.ae", f"Expected email admin@bidblitz.ae, got {admin_user.get('email')}"
        assert admin_user.get("canonical_email") == "admin@bidblitz.ae", f"Expected canonical_email admin@bidblitz.ae, got {admin_user.get('canonical_email')}"
        assert admin_user.get("name") == "BidBlitz Admin", f"Expected name BidBlitz Admin, got {admin_user.get('name')}"
        
        # Store for comparison
        self.__class__.wallet_search_balance = float(admin_user.get("balance_eur", 0) or 0)
        self.__class__.wallet_search_balance_blz = float(admin_user.get("balance_blz", 0) or 0)
        self.__class__.wallet_search_registered_at = admin_user.get("registered_at")
        self.__class__.wallet_search_last_login_at = admin_user.get("last_login_at")
        self.__class__.wallet_search_login_count = admin_user.get("login_count")
        self.__class__.admin_user_id = admin_user.get("user_id")
        
        print(f"✓ /api/admin/wallet/users: email={admin_user.get('email')}, balance_eur={self.__class__.wallet_search_balance}, registered_at={self.__class__.wallet_search_registered_at}, last_login_at={self.__class__.wallet_search_last_login_at}, login_count={self.__class__.wallet_search_login_count}")
    
    def test_admin_wallet_login_history_returns_canonical_admin(self, admin_session):
        """GET /api/admin/wallet/users/{user_id}/login-history should return canonical admin identity."""
        user_id = getattr(self.__class__, "admin_user_id", None)
        if not user_id:
            pytest.skip("Admin user_id not found from previous test")
        
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users/{user_id}/login-history?limit=10")
        assert resp.status_code == 200, f"Admin wallet login-history failed: {resp.text}"
        
        data = resp.json()
        user = data.get("user", {})
        
        assert user.get("email") == "admin@bidblitz.ae", f"Expected email admin@bidblitz.ae, got {user.get('email')}"
        assert user.get("canonical_email") == "admin@bidblitz.ae", f"Expected canonical_email admin@bidblitz.ae, got {user.get('canonical_email')}"
        assert user.get("name") == "BidBlitz Admin", f"Expected name BidBlitz Admin, got {user.get('name')}"
        
        # Store for comparison
        self.__class__.login_history_balance = float(user.get("balance_eur", 0) or 0)
        self.__class__.login_history_balance_blz = float(user.get("balance_blz", 0) or 0)
        self.__class__.login_history_registered_at = user.get("registered_at")
        self.__class__.login_history_last_login_at = user.get("last_login_at")
        self.__class__.login_history_login_count = user.get("login_count")
        
        print(f"✓ /api/admin/wallet/users/{user_id}/login-history: email={user.get('email')}, balance_eur={self.__class__.login_history_balance}, registered_at={self.__class__.login_history_registered_at}, last_login_at={self.__class__.login_history_last_login_at}, login_count={self.__class__.login_history_login_count}")
    
    def test_admin_customers_returns_canonical_admin(self, admin_session):
        """GET /api/admin/customers?q=admin@bidblitz.ae should return canonical admin."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q=admin@bidblitz.ae")
        assert resp.status_code == 200, f"Admin customers search failed: {resp.text}"
        
        data = resp.json()
        customers = data.get("customers", [])
        
        # Find the admin customer
        admin_customer = None
        for c in customers:
            if c.get("email") == "admin@bidblitz.ae" or c.get("canonical_email") == "admin@bidblitz.ae":
                admin_customer = c
                break
        
        if admin_customer:
            assert admin_customer.get("email") == "admin@bidblitz.ae", f"Expected email admin@bidblitz.ae, got {admin_customer.get('email')}"
            
            # Store for comparison
            self.__class__.customers_balance = float(admin_customer.get("balance", 0) or 0)
            self.__class__.customers_balance_blz = float(admin_customer.get("balance_blz", 0) or 0)
            
            print(f"✓ /api/admin/customers: email={admin_customer.get('email')}, balance={self.__class__.customers_balance}")
        else:
            print("⚠ Admin not found in /api/admin/customers (may be filtered by role)")
    
    def test_balance_consistency_across_endpoints(self, admin_session):
        """All endpoints should return the same canonical admin balance."""
        auth_me_balance = getattr(self.__class__, "auth_me_balance", None)
        wallet_search_balance = getattr(self.__class__, "wallet_search_balance", None)
        login_history_balance = getattr(self.__class__, "login_history_balance", None)
        
        if auth_me_balance is None or wallet_search_balance is None:
            pytest.skip("Balance data not available from previous tests")
        
        # Compare balances (allow small floating point differences)
        assert abs(auth_me_balance - wallet_search_balance) < 0.01, \
            f"Balance mismatch: /api/auth/me={auth_me_balance}, /api/admin/wallet/users={wallet_search_balance}"
        
        if login_history_balance is not None:
            assert abs(auth_me_balance - login_history_balance) < 0.01, \
                f"Balance mismatch: /api/auth/me={auth_me_balance}, login-history={login_history_balance}"
        
        print(f"✓ Balance consistency: auth_me={auth_me_balance}, wallet_search={wallet_search_balance}, login_history={login_history_balance}")
    
    def test_identity_fields_consistency(self, admin_session):
        """Registration date, last login, and login count should be consistent."""
        wallet_registered = getattr(self.__class__, "wallet_search_registered_at", None)
        history_registered = getattr(self.__class__, "login_history_registered_at", None)
        
        wallet_last_login = getattr(self.__class__, "wallet_search_last_login_at", None)
        history_last_login = getattr(self.__class__, "login_history_last_login_at", None)
        
        wallet_login_count = getattr(self.__class__, "wallet_search_login_count", None)
        history_login_count = getattr(self.__class__, "login_history_login_count", None)
        
        # Check registration date consistency
        if wallet_registered and history_registered:
            assert wallet_registered == history_registered, \
                f"Registration date mismatch: wallet_search={wallet_registered}, login_history={history_registered}"
            print(f"✓ Registration date consistent: {wallet_registered}")
        
        # Check last login consistency
        if wallet_last_login and history_last_login:
            assert wallet_last_login == history_last_login, \
                f"Last login mismatch: wallet_search={wallet_last_login}, login_history={history_last_login}"
            print(f"✓ Last login consistent: {wallet_last_login}")
        
        # Check login count consistency
        if wallet_login_count is not None and history_login_count is not None:
            assert wallet_login_count == history_login_count, \
                f"Login count mismatch: wallet_search={wallet_login_count}, login_history={history_login_count}"
            print(f"✓ Login count consistent: {wallet_login_count}")
    
    def test_no_mixed_legacy_admin_data(self, admin_session):
        """Search should not return mixed/legacy admin alias data."""
        # Search for admin@bidblitz.com (legacy/disabled)
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?q=admin@bidblitz.com")
        assert resp.status_code == 200, f"Admin wallet search failed: {resp.text}"
        
        data = resp.json()
        users = data.get("users", [])
        
        # Should not find admin@bidblitz.com as a separate entry
        for u in users:
            if u.get("email") == "admin@bidblitz.com":
                pytest.fail(f"Found legacy admin@bidblitz.com as separate entry - should be merged/hidden")
        
        print("✓ No legacy admin@bidblitz.com found as separate entry")
    
    def test_admin_wallet_search_shows_single_canonical_record(self, admin_session):
        """Admin search should show single canonical record, not duplicates."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?q=admin")
        assert resp.status_code == 200, f"Admin wallet search failed: {resp.text}"
        
        data = resp.json()
        users = data.get("users", [])
        
        # Count admin users
        admin_users = [u for u in users if u.get("role") == "admin"]
        
        # Should have at most 1 admin user (the canonical one)
        assert len(admin_users) <= 1, f"Found {len(admin_users)} admin users, expected at most 1 canonical admin"
        
        if admin_users:
            admin_user = admin_users[0]
            assert admin_user.get("email") == "admin@bidblitz.ae", \
                f"Admin email should be canonical admin@bidblitz.ae, got {admin_user.get('email')}"
        
        print(f"✓ Single canonical admin record found: {len(admin_users)} admin user(s)")


class TestWalletBalanceEndpoint:
    """Test /api/wallet/balance endpoint for admin."""
    
    def test_wallet_balance_matches_auth_me(self, admin_session):
        """GET /api/wallet/balance should match /api/auth/me balance."""
        # Get balance from /api/wallet/balance
        resp = admin_session.get(f"{BASE_URL}/api/wallet/balance")
        if resp.status_code == 404:
            pytest.skip("/api/wallet/balance endpoint not found")
        
        assert resp.status_code == 200, f"GET /api/wallet/balance failed: {resp.text}"
        wallet_data = resp.json()
        wallet_balance = float(wallet_data.get("balance", 0) or wallet_data.get("balance_eur", 0) or 0)
        
        # Get balance from /api/auth/me
        resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, f"GET /api/auth/me failed: {resp.text}"
        auth_data = resp.json()
        auth_balance = float(auth_data.get("balance", 0) or 0)
        
        # Compare
        assert abs(wallet_balance - auth_balance) < 0.01, \
            f"Balance mismatch: /api/wallet/balance={wallet_balance}, /api/auth/me={auth_balance}"
        
        print(f"✓ Wallet balance consistent: wallet_balance={wallet_balance}, auth_me={auth_balance}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
