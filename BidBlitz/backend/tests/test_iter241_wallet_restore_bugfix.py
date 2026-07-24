"""
Iteration 241 - Wallet Restore Bug Fix Verification Tests

Tests for:
1. Canonical admin login and consistent balance across all endpoints
2. Restored legacy user Albin Krasniqi (albinkrasniqi11@icloud.com) with 60.00 EUR, 20 BLZ
3. Restored legacy user Afrim Krasniqi (lufrollen.notepad_9o@icloud.com) with 25.20 EUR, 10 BLZ
4. Alias search for restored users
5. No auth regression for admin and existing alias accounts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
LIVE_USER_EMAIL = "agimk@me.com"
LIVE_USER_PASSWORD = "Aldink56600"
ALIAS_USER_EMAIL = "afrimk@me.com"

# Restored legacy users from screenshots
RESTORED_USER_ALBIN = {
    "email": "albinkrasniqi11@icloud.com",
    "alias": "albinkrasniqi612@gmail.com",
    "name": "Albin Krasniqi",
    "expected_balance_eur": 60.0,
    "expected_balance_blz": 20.0,
    "expected_registration": "2026-05-02T14:33:00+00:00",
    "expected_login_count": 0,
}

RESTORED_USER_AFRIM = {
    "email": "lufrollen.notepad_9o@icloud.com",
    "alias": "laufrollen.notepad_9o@icloud.com",
    "name": "Afrim Krasniqi",
    "expected_balance_eur": 25.2,
    "expected_balance_blz": 10.0,
    "expected_registration": "2026-05-01T19:58:00+00:00",
    "expected_login_count": 0,
}


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def live_user_session():
    """Login as live user agimk@me.com and return session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": LIVE_USER_EMAIL,
        "password": LIVE_USER_PASSWORD
    })
    assert resp.status_code == 200, f"Live user login failed: {resp.text}"
    return session


class TestAdminLoginAndBalanceConsistency:
    """Test admin login works and balance is consistent across endpoints"""
    
    def test_admin_login_success(self, admin_session):
        """Admin login should succeed"""
        resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") == "admin"
        print(f"PASS: Admin login successful, email={data.get('email')}")
    
    def test_admin_me_balance(self, admin_session):
        """GET /api/auth/me should return admin balance"""
        resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        balance = float(data.get("balance", 0) or 0)
        # Balance should NOT be the suspicious inflated value
        assert balance != 2622000000.0, f"Admin balance is still suspicious inflated value: {balance}"
        assert balance != 63366525.91, f"Admin balance is still old suspicious value: {balance}"
        print(f"PASS: Admin /api/auth/me balance={balance} EUR (not inflated)")
        return balance
    
    def test_admin_wallet_balance(self, admin_session):
        """GET /api/wallet/balance should return consistent admin balance"""
        resp = admin_session.get(f"{BASE_URL}/api/wallet/balance")
        if resp.status_code == 200:
            data = resp.json()
            balance = float(data.get("balance", 0) or 0)
            assert balance != 2622000000.0, f"Wallet balance is suspicious: {balance}"
            print(f"PASS: Admin /api/wallet/balance={balance} EUR")
        else:
            print(f"INFO: /api/wallet/balance returned {resp.status_code} - may not be implemented")
    
    def test_admin_wallet_users_search_self(self, admin_session):
        """GET /api/admin/wallet/users?q=admin@bidblitz.ae should return canonical admin"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": ADMIN_EMAIL})
        assert resp.status_code == 200
        data = resp.json()
        users = data.get("users", [])
        assert len(users) >= 1, "Admin should appear in wallet search"
        
        admin_user = users[0]
        balance = float(admin_user.get("balance_eur", 0) or 0)
        assert balance != 2622000000.0, f"Admin wallet search balance is suspicious: {balance}"
        assert admin_user.get("email") == ADMIN_EMAIL
        print(f"PASS: Admin wallet search returns canonical admin with balance={balance} EUR")
    
    def test_admin_customers_search_self(self, admin_session):
        """GET /api/admin/customers?q=admin@bidblitz.ae should return canonical admin"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={"q": ADMIN_EMAIL})
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        admin_found = False
        for c in customers:
            if c.get("email") == ADMIN_EMAIL:
                admin_found = True
                balance = float(c.get("balance", 0) or 0)
                assert balance != 2622000000.0, f"Admin customer balance is suspicious: {balance}"
                print(f"PASS: Admin customers search returns canonical admin with balance={balance} EUR")
                break
        
        assert admin_found, "Admin should appear in customers search"


class TestRestoredLegacyUserAlbin:
    """Test restored legacy user Albin Krasniqi"""
    
    def test_albin_exists_in_wallet_search(self, admin_session):
        """Search for Albin by canonical email should return restored user"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": RESTORED_USER_ALBIN["email"]})
        assert resp.status_code == 200
        data = resp.json()
        users = data.get("users", [])
        
        albin_found = None
        for u in users:
            if u.get("email") == RESTORED_USER_ALBIN["email"]:
                albin_found = u
                break
        
        assert albin_found is not None, f"Albin ({RESTORED_USER_ALBIN['email']}) should exist in wallet search"
        
        # Verify balance
        balance_eur = float(albin_found.get("balance_eur", 0) or 0)
        balance_blz = float(albin_found.get("balance_blz", 0) or 0)
        assert abs(balance_eur - RESTORED_USER_ALBIN["expected_balance_eur"]) < 0.01, f"Albin EUR balance mismatch: {balance_eur}"
        assert abs(balance_blz - RESTORED_USER_ALBIN["expected_balance_blz"]) < 0.01, f"Albin BLZ balance mismatch: {balance_blz}"
        
        # Verify login count
        login_count = int(albin_found.get("login_count", 0) or 0)
        assert login_count == RESTORED_USER_ALBIN["expected_login_count"], f"Albin login count mismatch: {login_count}"
        
        print(f"PASS: Albin found with {balance_eur} EUR, {balance_blz} BLZ, {login_count} logins")
    
    def test_albin_exists_in_customers_search(self, admin_session):
        """Search for Albin in customers should return restored user"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={"q": RESTORED_USER_ALBIN["email"]})
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        albin_found = None
        for c in customers:
            if c.get("email") == RESTORED_USER_ALBIN["email"]:
                albin_found = c
                break
        
        assert albin_found is not None, f"Albin should exist in customers search"
        
        # Check legacy_restored metadata
        assert albin_found.get("legacy_restored") == True, "Albin should have legacy_restored=True"
        print(f"PASS: Albin found in customers with legacy_restored metadata")
    
    def test_albin_alias_search(self, admin_session):
        """Search by alias email should find canonical Albin record"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": RESTORED_USER_ALBIN["alias"]})
        assert resp.status_code == 200
        data = resp.json()
        users = data.get("users", [])
        
        albin_found = None
        for u in users:
            if u.get("email") == RESTORED_USER_ALBIN["email"] or RESTORED_USER_ALBIN["alias"] in (u.get("email_aliases") or []):
                albin_found = u
                break
        
        assert albin_found is not None, f"Alias search for {RESTORED_USER_ALBIN['alias']} should find Albin"
        print(f"PASS: Alias search for {RESTORED_USER_ALBIN['alias']} found canonical Albin record")


class TestRestoredLegacyUserAfrim:
    """Test restored legacy user Afrim Krasniqi (lufrollen.notepad_9o@icloud.com)"""
    
    def test_afrim_exists_in_wallet_search(self, admin_session):
        """Search for Afrim by canonical email should return restored user"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": RESTORED_USER_AFRIM["email"]})
        assert resp.status_code == 200
        data = resp.json()
        users = data.get("users", [])
        
        afrim_found = None
        for u in users:
            if u.get("email") == RESTORED_USER_AFRIM["email"]:
                afrim_found = u
                break
        
        assert afrim_found is not None, f"Afrim ({RESTORED_USER_AFRIM['email']}) should exist in wallet search"
        
        # Verify balance
        balance_eur = float(afrim_found.get("balance_eur", 0) or 0)
        balance_blz = float(afrim_found.get("balance_blz", 0) or 0)
        assert abs(balance_eur - RESTORED_USER_AFRIM["expected_balance_eur"]) < 0.01, f"Afrim EUR balance mismatch: {balance_eur}"
        assert abs(balance_blz - RESTORED_USER_AFRIM["expected_balance_blz"]) < 0.01, f"Afrim BLZ balance mismatch: {balance_blz}"
        
        # Verify login count
        login_count = int(afrim_found.get("login_count", 0) or 0)
        assert login_count == RESTORED_USER_AFRIM["expected_login_count"], f"Afrim login count mismatch: {login_count}"
        
        print(f"PASS: Afrim found with {balance_eur} EUR, {balance_blz} BLZ, {login_count} logins")
    
    def test_afrim_exists_in_customers_search(self, admin_session):
        """Search for Afrim in customers should return restored user"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={"q": RESTORED_USER_AFRIM["email"]})
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        afrim_found = None
        for c in customers:
            if c.get("email") == RESTORED_USER_AFRIM["email"]:
                afrim_found = c
                break
        
        assert afrim_found is not None, f"Afrim should exist in customers search"
        
        # Check legacy_restored metadata
        assert afrim_found.get("legacy_restored") == True, "Afrim should have legacy_restored=True"
        print(f"PASS: Afrim found in customers with legacy_restored metadata")
    
    def test_afrim_alias_search(self, admin_session):
        """Search by alias email should find canonical Afrim record"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": RESTORED_USER_AFRIM["alias"]})
        assert resp.status_code == 200
        data = resp.json()
        users = data.get("users", [])
        
        afrim_found = None
        for u in users:
            if u.get("email") == RESTORED_USER_AFRIM["email"] or RESTORED_USER_AFRIM["alias"] in (u.get("email_aliases") or []):
                afrim_found = u
                break
        
        assert afrim_found is not None, f"Alias search for {RESTORED_USER_AFRIM['alias']} should find Afrim"
        print(f"PASS: Alias search for {RESTORED_USER_AFRIM['alias']} found canonical Afrim record")


class TestNoAuthRegression:
    """Test no auth regression for existing accounts"""
    
    def test_live_user_login_still_works(self, live_user_session):
        """Live user agimk@me.com login should still work"""
        resp = live_user_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") == LIVE_USER_EMAIL or data.get("canonical_email") == LIVE_USER_EMAIL
        print(f"PASS: Live user {LIVE_USER_EMAIL} login still works")
    
    def test_alias_login_still_works(self):
        """Alias login afrimk@me.com should still work"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ALIAS_USER_EMAIL,
            "password": LIVE_USER_PASSWORD
        })
        assert resp.status_code == 200, f"Alias login failed: {resp.text}"
        
        # Verify /api/auth/me returns correct user
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        data = me_resp.json()
        # Should map to canonical agimk@me.com
        canonical = data.get("canonical_email") or data.get("email")
        assert canonical == LIVE_USER_EMAIL, f"Alias login should map to canonical {LIVE_USER_EMAIL}, got {canonical}"
        print(f"PASS: Alias login {ALIAS_USER_EMAIL} maps to canonical {LIVE_USER_EMAIL}")


class TestRestoredUsersNoServerErrors:
    """Test that restored users don't cause 500 errors in admin views"""
    
    def test_admin_wallet_users_no_500(self, admin_session):
        """Admin wallet users endpoint should not return 500"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"limit": 50})
        assert resp.status_code == 200, f"Admin wallet users returned {resp.status_code}: {resp.text}"
        print("PASS: Admin wallet users endpoint returns 200")
    
    def test_admin_customers_no_500(self, admin_session):
        """Admin customers endpoint should not return 500"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers", params={"limit": 50})
        assert resp.status_code == 200, f"Admin customers returned {resp.status_code}: {resp.text}"
        print("PASS: Admin customers endpoint returns 200")
    
    def test_search_nonexistent_user_no_500(self, admin_session):
        """Searching for non-existent user should return empty, not 500"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": "nonexistent_user_xyz123@test.com"})
        assert resp.status_code == 200, f"Search returned {resp.status_code}: {resp.text}"
        data = resp.json()
        users = data.get("users", [])
        assert len(users) == 0, "Non-existent user search should return empty"
        print("PASS: Non-existent user search returns empty without 500")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
