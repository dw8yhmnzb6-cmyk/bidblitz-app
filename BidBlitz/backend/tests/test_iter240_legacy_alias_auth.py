"""
Iteration 240: Legacy User Auth/Data Issue Tests
Tests for:
1. Legacy/alias customer login (agimk@me.com / Aldink56600)
2. Alias login variant (afrimk@me.com / Aldink56600) - same canonical account
3. Admin customer search by alias email
4. Admin wallet search by alias email
5. Admin canonical account stability
6. Searching for non-existent users (Albin) - should not crash
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
LEGACY_CUSTOMER_EMAIL = "agimk@me.com"
LEGACY_CUSTOMER_PASSWORD = "Aldink56600"
ALIAS_EMAIL = "afrimk@me.com"


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")
    return session


@pytest.fixture(scope="module")
def legacy_customer_session():
    """Login as legacy customer (agimk@me.com) and return session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": LEGACY_CUSTOMER_EMAIL,
        "password": LEGACY_CUSTOMER_PASSWORD
    })
    # Return session and response for assertions
    return session, resp


class TestLegacyCustomerLogin:
    """Test that legacy/alias customer can log in successfully."""
    
    def test_legacy_customer_login_success(self, legacy_customer_session):
        """agimk@me.com should login successfully without 403 password reset block."""
        session, resp = legacy_customer_session
        
        # Should NOT return 403 "Passwort-Reset erforderlich"
        assert resp.status_code != 403, f"Login blocked with 403: {resp.text}"
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        # Verify user data returned
        assert "id" in data or "email" in data, "No user data in response"
        print(f"✓ Legacy customer login successful: {data.get('email')}")
    
    def test_legacy_customer_me_endpoint(self, legacy_customer_session):
        """After login, /api/auth/me should return the customer."""
        session, login_resp = legacy_customer_session
        
        if login_resp.status_code != 200:
            pytest.skip("Login failed, skipping /me test")
        
        resp = session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, f"/api/auth/me failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        assert data.get("email") == LEGACY_CUSTOMER_EMAIL or data.get("canonical_email") == LEGACY_CUSTOMER_EMAIL, \
            f"Unexpected email in /me response: {data.get('email')}"
        print(f"✓ /api/auth/me returns correct customer: {data.get('email')}")


class TestAliasLogin:
    """Test that alias email (afrimk@me.com) authenticates the same canonical account."""
    
    def test_alias_login_success(self):
        """afrimk@me.com should login with same password as agimk@me.com."""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ALIAS_EMAIL,
            "password": LEGACY_CUSTOMER_PASSWORD
        })
        
        # Should NOT return 403 "Passwort-Reset erforderlich"
        assert resp.status_code != 403, f"Alias login blocked with 403: {resp.text}"
        assert resp.status_code == 200, f"Alias login failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        print(f"✓ Alias login successful: {data.get('email')}")
        
        # Verify /api/auth/me reflects login_email correctly
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200, f"/api/auth/me failed: {me_resp.status_code}"
        
        me_data = me_resp.json()
        # login_email should be the alias used, canonical_email should be agimk@me.com
        login_email = me_data.get("login_email", "")
        canonical_email = me_data.get("canonical_email") or me_data.get("email")
        
        print(f"  login_email: {login_email}")
        print(f"  canonical_email: {canonical_email}")
        
        # The canonical email should be agimk@me.com
        assert canonical_email == LEGACY_CUSTOMER_EMAIL, \
            f"Expected canonical_email={LEGACY_CUSTOMER_EMAIL}, got {canonical_email}"
        print(f"✓ Alias login correctly maps to canonical account")


class TestAdminCustomerSearch:
    """Test admin customer search by alias email."""
    
    def test_admin_search_by_alias_email(self, admin_session):
        """Admin customer search should find canonical agimk account when searching by afrimk@me.com."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={
            "q": ALIAS_EMAIL,
            "limit": 10
        })
        
        assert resp.status_code == 200, f"Admin customer search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        customers = data.get("customers", [])
        
        # Should find at least one customer
        assert len(customers) > 0, f"No customers found when searching by alias {ALIAS_EMAIL}"
        
        # The found customer should be the canonical agimk account
        found_emails = [c.get("email") for c in customers]
        found_canonical = [c.get("canonical_email") for c in customers]
        
        print(f"  Found customers: {found_emails}")
        print(f"  Canonical emails: {found_canonical}")
        
        # Either email or canonical_email should match agimk@me.com
        assert any(
            c.get("email") == LEGACY_CUSTOMER_EMAIL or 
            c.get("canonical_email") == LEGACY_CUSTOMER_EMAIL or
            ALIAS_EMAIL in (c.get("email_aliases") or [])
            for c in customers
        ), f"Canonical account {LEGACY_CUSTOMER_EMAIL} not found in search results"
        
        print(f"✓ Admin customer search by alias returns canonical account")
    
    def test_admin_search_by_canonical_email(self, admin_session):
        """Admin customer search should find account when searching by canonical email."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={
            "q": LEGACY_CUSTOMER_EMAIL,
            "limit": 10
        })
        
        assert resp.status_code == 200, f"Admin customer search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        customers = data.get("customers", [])
        
        assert len(customers) > 0, f"No customers found when searching by {LEGACY_CUSTOMER_EMAIL}"
        print(f"✓ Admin customer search by canonical email works")
    
    def test_admin_search_nonexistent_user_albin(self, admin_session):
        """Searching for Albin should not crash or 500; should return empty result cleanly."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={
            "q": "Albin",
            "limit": 10
        })
        
        # Should NOT return 500
        assert resp.status_code != 500, f"Admin search crashed with 500: {resp.text}"
        assert resp.status_code == 200, f"Admin search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        # Should return valid response structure even if empty
        assert "customers" in data, "Response missing 'customers' field"
        
        customers = data.get("customers", [])
        print(f"  Found {len(customers)} customers for 'Albin' search")
        print(f"✓ Admin search for non-existent user returns cleanly (no crash)")


class TestAdminWalletSearch:
    """Test admin wallet search by alias and canonical email."""
    
    def test_admin_wallet_search_by_alias(self, admin_session):
        """Admin wallet search should find canonical agimk account when searching by afrimk@me.com."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={
            "q": ALIAS_EMAIL
        })
        
        assert resp.status_code == 200, f"Admin wallet search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        users = data.get("users", [])
        
        # Should find at least one user
        assert len(users) > 0, f"No users found in wallet search by alias {ALIAS_EMAIL}"
        
        found_emails = [u.get("email") for u in users]
        print(f"  Found users in wallet search: {found_emails}")
        
        # Should find the canonical account
        assert any(
            u.get("email") == LEGACY_CUSTOMER_EMAIL or 
            u.get("canonical_email") == LEGACY_CUSTOMER_EMAIL
            for u in users
        ), f"Canonical account not found in wallet search by alias"
        
        print(f"✓ Admin wallet search by alias returns canonical account")
    
    def test_admin_wallet_search_by_canonical(self, admin_session):
        """Admin wallet search should find account when searching by canonical email."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={
            "q": LEGACY_CUSTOMER_EMAIL
        })
        
        assert resp.status_code == 200, f"Admin wallet search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        users = data.get("users", [])
        
        assert len(users) > 0, f"No users found in wallet search by {LEGACY_CUSTOMER_EMAIL}"
        print(f"✓ Admin wallet search by canonical email works")


class TestAdminCanonicalAccountStability:
    """Test that admin canonical account remains stable and unaffected."""
    
    def test_admin_login_still_works(self, admin_session):
        """admin@bidblitz.ae login should still work."""
        # admin_session fixture already logged in, verify /me works
        resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        
        assert resp.status_code == 200, f"Admin /me failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        assert data.get("email") == ADMIN_EMAIL, f"Unexpected admin email: {data.get('email')}"
        assert data.get("role") == "admin", f"Unexpected admin role: {data.get('role')}"
        
        print(f"✓ Admin canonical account login works: {data.get('email')}")
    
    def test_admin_wallet_view_canonical(self, admin_session):
        """Admin wallet view should show canonical admin data."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={
            "q": ADMIN_EMAIL
        })
        
        assert resp.status_code == 200, f"Admin wallet search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        users = data.get("users", [])
        
        # Should find admin
        admin_users = [u for u in users if u.get("email") == ADMIN_EMAIL or u.get("role") == "admin"]
        assert len(admin_users) > 0, "Admin not found in wallet search"
        
        admin_user = admin_users[0]
        print(f"  Admin balance: {admin_user.get('balance_eur')} EUR")
        print(f"✓ Admin wallet view shows canonical admin data")
    
    def test_admin_customers_view_canonical(self, admin_session):
        """Admin customers view should show canonical admin data."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={
            "role": "admin",
            "limit": 10
        })
        
        assert resp.status_code == 200, f"Admin customers search failed: {resp.status_code} - {resp.text}"
        
        data = resp.json()
        customers = data.get("customers", [])
        
        # Should find admin
        admin_customers = [c for c in customers if c.get("email") == ADMIN_EMAIL]
        assert len(admin_customers) > 0, "Admin not found in customers list"
        
        print(f"✓ Admin customers view shows canonical admin")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
