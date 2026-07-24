"""
Iteration 208 - Admin Customer List Canonical Admin & User Identity Tests

Tests:
1. Admin customer list returns canonical admin@bidblitz.ae with correct balances
2. Legacy admin@bidblitz.com does NOT appear as separate active admin row
3. agimk@me.com is findable in admin customer search/list
4. agimk@me.com customer detail returns correct user record (not another user's)
5. Admin customer detail for canonical admin shows canonical balances
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
AGIMK_EMAIL = "agimk@me.com"

# Expected canonical admin balances from main agent context
CANONICAL_ADMIN_BALANCE = 2622000000.00
CANONICAL_ADMIN_BLZ = 0.0


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    login_resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    return session


class TestAdminCustomerListCanonical:
    """Tests for admin customer list canonical admin normalization"""

    def test_admin_customers_endpoint_returns_200(self, admin_session):
        """Basic health check - admin customers endpoint works"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?limit=10")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "customers" in data
        assert "total" in data
        print(f"✓ Admin customers endpoint returns 200 with {data['total']} total customers")

    def test_canonical_admin_appears_with_correct_email(self, admin_session):
        """Canonical admin must appear as admin@bidblitz.ae, not .com"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?role=admin&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        # Find admin rows
        admin_rows = [c for c in customers if c.get("role") == "admin"]
        print(f"Found {len(admin_rows)} admin rows")
        
        # Check that canonical admin@bidblitz.ae exists
        canonical_admin = [c for c in admin_rows if c.get("email") == "admin@bidblitz.ae"]
        assert len(canonical_admin) >= 1, f"Canonical admin@bidblitz.ae not found in admin list. Found: {[c.get('email') for c in admin_rows]}"
        print(f"✓ Canonical admin@bidblitz.ae found in admin list")

    def test_legacy_admin_com_not_separate_active_row(self, admin_session):
        """Legacy admin@bidblitz.com must NOT appear as separate active admin row"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?role=admin&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        # Check that admin@bidblitz.com does NOT appear as separate row
        legacy_admin_rows = [c for c in customers if c.get("email") == "admin@bidblitz.com" and c.get("role") == "admin"]
        assert len(legacy_admin_rows) == 0, f"Legacy admin@bidblitz.com should not appear as separate admin row. Found {len(legacy_admin_rows)} rows"
        print(f"✓ Legacy admin@bidblitz.com does NOT appear as separate active admin row")

    def test_canonical_admin_has_correct_balances(self, admin_session):
        """Canonical admin must show canonical balances (2622000000.00 EUR, 0 BLZ)"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?role=admin&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        canonical_admin = next((c for c in customers if c.get("email") == "admin@bidblitz.ae"), None)
        assert canonical_admin is not None, "Canonical admin not found"
        
        balance = float(canonical_admin.get("balance", 0) or 0)
        balance_blz = float(canonical_admin.get("balance_blz", 0) or 0)
        
        # Allow some tolerance for floating point
        assert abs(balance - CANONICAL_ADMIN_BALANCE) < 1.0, f"Expected balance ~{CANONICAL_ADMIN_BALANCE}, got {balance}"
        assert abs(balance_blz - CANONICAL_ADMIN_BLZ) < 1.0, f"Expected balance_blz ~{CANONICAL_ADMIN_BLZ}, got {balance_blz}"
        print(f"✓ Canonical admin has correct balances: EUR {balance}, BLZ {balance_blz}")


class TestAgimkUserFindability:
    """Tests for agimk@me.com user findability in admin customer list"""

    def test_agimk_findable_in_customer_list(self, admin_session):
        """agimk@me.com must be findable in admin customer search"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q=agimk&limit=50")
        assert resp.status_code == 200, f"Search failed: {resp.text}"
        data = resp.json()
        customers = data.get("customers", [])
        
        agimk_rows = [c for c in customers if AGIMK_EMAIL in (c.get("email") or "")]
        assert len(agimk_rows) >= 1, f"agimk@me.com not found in search results. Found emails: {[c.get('email') for c in customers]}"
        print(f"✓ agimk@me.com found in customer search with {len(agimk_rows)} row(s)")

    def test_agimk_findable_by_exact_email(self, admin_session):
        """agimk@me.com must be findable by exact email search"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q={AGIMK_EMAIL}&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        agimk_rows = [c for c in customers if c.get("email") == AGIMK_EMAIL]
        assert len(agimk_rows) >= 1, f"agimk@me.com not found by exact email search"
        print(f"✓ agimk@me.com found by exact email search")

    def test_agimk_has_own_user_id(self, admin_session):
        """agimk@me.com must have its own unique user_id"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q={AGIMK_EMAIL}&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        agimk = next((c for c in customers if c.get("email") == AGIMK_EMAIL), None)
        assert agimk is not None, "agimk@me.com not found"
        
        user_id = agimk.get("user_id")
        assert user_id, f"agimk@me.com has no user_id"
        assert len(user_id) > 10, f"user_id looks invalid: {user_id}"
        print(f"✓ agimk@me.com has user_id: {user_id}")
        return user_id

    def test_agimk_customer_detail_returns_correct_record(self, admin_session):
        """agimk@me.com customer detail must return its own record, not another user's"""
        # First get the user_id
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q={AGIMK_EMAIL}&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        agimk = next((c for c in customers if c.get("email") == AGIMK_EMAIL), None)
        assert agimk is not None, "agimk@me.com not found in list"
        user_id = agimk.get("user_id")
        
        # Now get customer detail
        detail_resp = admin_session.get(f"{BASE_URL}/api/admin/customers/{user_id}")
        assert detail_resp.status_code == 200, f"Customer detail failed: {detail_resp.text}"
        detail_data = detail_resp.json()
        
        customer = detail_data.get("customer", {})
        assert customer.get("email") == AGIMK_EMAIL, f"Customer detail returned wrong email: {customer.get('email')}"
        assert customer.get("user_id") == user_id, f"Customer detail returned wrong user_id"
        print(f"✓ agimk@me.com customer detail returns correct record with email={customer.get('email')}")

    def test_agimk_not_inheriting_admin_data(self, admin_session):
        """agimk@me.com must not inherit admin balances or role"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q={AGIMK_EMAIL}&limit=50")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        agimk = next((c for c in customers if c.get("email") == AGIMK_EMAIL), None)
        assert agimk is not None
        
        # agimk should NOT have admin role
        assert agimk.get("role") != "admin", f"agimk@me.com should not have admin role"
        
        # agimk should NOT have canonical admin balance
        balance = float(agimk.get("balance", 0) or 0)
        assert balance < 1000000, f"agimk@me.com has suspiciously high balance: {balance}"
        print(f"✓ agimk@me.com has role={agimk.get('role')}, balance={balance} (not inheriting admin data)")


class TestAdminCustomerDetailCanonical:
    """Tests for admin customer detail endpoint canonical admin balances"""

    def test_admin_detail_shows_canonical_balances(self, admin_session):
        """Admin customer detail for canonical admin must show canonical balances"""
        # First get admin user_id
        resp = admin_session.get(f"{BASE_URL}/api/admin/customers?q=admin@bidblitz.ae&role=admin&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        canonical_admin = next((c for c in customers if c.get("email") == "admin@bidblitz.ae"), None)
        assert canonical_admin is not None, "Canonical admin not found in list"
        admin_user_id = canonical_admin.get("user_id")
        
        # Get customer detail
        detail_resp = admin_session.get(f"{BASE_URL}/api/admin/customers/{admin_user_id}")
        assert detail_resp.status_code == 200, f"Admin detail failed: {detail_resp.text}"
        detail_data = detail_resp.json()
        
        customer = detail_data.get("customer", {})
        balance = float(customer.get("balance", 0) or 0)
        balance_blz = float(customer.get("balance_blz", 0) or 0)
        
        assert abs(balance - CANONICAL_ADMIN_BALANCE) < 1.0, f"Admin detail balance mismatch: expected ~{CANONICAL_ADMIN_BALANCE}, got {balance}"
        assert abs(balance_blz - CANONICAL_ADMIN_BLZ) < 1.0, f"Admin detail BLZ mismatch: expected ~{CANONICAL_ADMIN_BLZ}, got {balance_blz}"
        print(f"✓ Admin customer detail shows canonical balances: EUR {balance}, BLZ {balance_blz}")


class TestLiveAnalyticsCanonical:
    """Tests for live analytics endpoints canonical admin normalization"""

    def test_online_users_normalizes_admin(self, admin_session):
        """Online users endpoint should normalize admin email"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/analytics/online?minutes=60")
        assert resp.status_code == 200
        data = resp.json()
        online_users = data.get("online_users", [])
        
        # If admin is online, should show as admin@bidblitz.ae
        admin_online = [u for u in online_users if u.get("role") == "admin"]
        for admin in admin_online:
            assert admin.get("email") != "admin@bidblitz.com", f"Legacy admin email found in online users: {admin.get('email')}"
        print(f"✓ Online users endpoint normalizes admin emails correctly ({len(admin_online)} admin(s) online)")

    def test_last_seen_normalizes_admin(self, admin_session):
        """Last seen endpoint should normalize admin email"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/analytics/last-seen?limit=50")
        assert resp.status_code == 200
        data = resp.json()
        users = data.get("users", [])
        
        # Check no legacy admin@bidblitz.com appears
        admin_users = [u for u in users if u.get("role") == "admin"]
        for admin in admin_users:
            assert admin.get("email") != "admin@bidblitz.com", f"Legacy admin email found in last-seen: {admin.get('email')}"
        print(f"✓ Last-seen endpoint normalizes admin emails correctly ({len(admin_users)} admin(s) in list)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
