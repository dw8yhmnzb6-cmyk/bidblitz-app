"""BidBlitz Pay Directory + my-keys self-service — iteration 40."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PW = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def guest_user():
    """Plain registered user (non-admin, non-merchant role)."""
    s = requests.Session()
    email = f"TEST_guest_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Guest2026!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Guest Tester"}, timeout=15)
    if r.status_code not in (200, 201):
        pytest.skip(f"register failed: {r.status_code} {r.text[:200]}")
    return s, email


class TestDirectoryPublic:
    def test_directory_returns_merchants(self):
        r = requests.get(f"{API}/pay/directory", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "merchants" in d and "count" in d
        assert isinstance(d["merchants"], list)
        # must contain admin (seeded w/ 1 paid session in iter39)
        emails = [m["email"] for m in d["merchants"]]
        assert ADMIN_EMAIL in emails, f"admin missing from directory: {emails}"
        me = next(m for m in d["merchants"] if m["email"] == ADMIN_EMAIL)
        # enriched profile fields must be present
        for k in ("business_name", "industry", "city", "description", "shop_url",
                  "logo_url", "featured", "total_sessions", "total_paid", "since"):
            assert k in me, f"missing field {k}"
        # only total_paid>0 allowed
        for m in d["merchants"]:
            assert m["total_paid"] > 0

    def test_directory_industry_filter_gastro(self):
        r = requests.get(f"{API}/pay/directory?industry=gastro", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for m in d["merchants"]:
            assert m["industry"] == "gastro"

    def test_directory_industry_filter_xyz_empty(self):
        r = requests.get(f"{API}/pay/directory?industry=xyz_nonexistent", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["merchants"] == []
        assert d["count"] == 0


class TestAdminFeatureToggle:
    def test_admin_toggle_feature(self, admin_session):
        r = admin_session.post(f"{API}/pay/admin/feature/{ADMIN_EMAIL}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert "featured" in d
        first = d["featured"]

        # Second toggle flips back
        r2 = admin_session.post(f"{API}/pay/admin/feature/{ADMIN_EMAIL}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["featured"] is (not first)

        # Restore featured=true (as pre-existing state)
        if r2.json()["featured"] is False:
            admin_session.post(f"{API}/pay/admin/feature/{ADMIN_EMAIL}", timeout=15)

    def test_non_admin_forbidden(self, guest_user):
        s, _ = guest_user
        r = s.post(f"{API}/pay/admin/feature/{ADMIN_EMAIL}", timeout=15)
        assert r.status_code == 403

    def test_unknown_email_404(self, admin_session):
        r = admin_session.post(f"{API}/pay/admin/feature/nosuch_{uuid.uuid4().hex[:8]}@x.com", timeout=15)
        assert r.status_code == 404


class TestDirectoryFeaturedSort:
    def test_featured_comes_first(self, admin_session):
        # Ensure admin is featured
        r = requests.get(f"{API}/pay/directory", timeout=15).json()
        admin_entry = next((m for m in r["merchants"] if m["email"] == ADMIN_EMAIL), None)
        if admin_entry and not admin_entry["featured"]:
            admin_session.post(f"{API}/pay/admin/feature/{ADMIN_EMAIL}", timeout=15)
        d = requests.get(f"{API}/pay/directory", timeout=15).json()
        ms = d["merchants"]
        # All featured must come before any non-featured
        seen_non_featured = False
        for m in ms:
            if not m["featured"]:
                seen_non_featured = True
            elif seen_non_featured:
                pytest.fail("featured merchant appeared after non-featured")


class TestMyKeysSelfService:
    def test_admin_create_own_key(self, admin_session):
        r = admin_session.post(f"{API}/pay/my-keys/create",
                               json={"label": "TEST_self_iter40"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        k = d["keys"]
        assert k["public_key"].startswith("pk_live_")
        assert k["secret_key"].startswith("sk_live_")
        assert k["merchant_email"] == ADMIN_EMAIL
        pytest.shared_self_key_id = k["key_id"]

    def test_non_merchant_forbidden(self, guest_user):
        s, _ = guest_user
        r = s.post(f"{API}/pay/my-keys/create", json={"label": "x"}, timeout=15)
        assert r.status_code == 403

    def test_owner_can_revoke(self, admin_session):
        kid = getattr(pytest, "shared_self_key_id", None)
        assert kid, "prior create must succeed"
        r = admin_session.post(f"{API}/pay/my-keys/{kid}/revoke", timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_other_user_cannot_revoke(self, admin_session, guest_user):
        # admin creates a key, guest tries to revoke
        r = admin_session.post(f"{API}/pay/my-keys/create",
                               json={"label": "TEST_revoke_guard"}, timeout=15)
        assert r.status_code == 200
        kid = r.json()["keys"]["key_id"]
        s, _ = guest_user
        r2 = s.post(f"{API}/pay/my-keys/{kid}/revoke", timeout=15)
        assert r2.status_code == 403
        # cleanup
        admin_session.post(f"{API}/pay/my-keys/{kid}/revoke", timeout=15)


class TestMaxKeysLimit:
    def test_max_5_active_keys(self, admin_session):
        # First revoke all existing active keys for admin to start clean
        listing = admin_session.get(f"{API}/pay/my-keys", timeout=15).json()
        active = [k for k in listing["keys"] if not k.get("revoked")]
        for k in active:
            admin_session.post(f"{API}/pay/my-keys/{k['key_id']}/revoke", timeout=15)

        created_ids = []
        try:
            for i in range(5):
                r = admin_session.post(f"{API}/pay/my-keys/create",
                                       json={"label": f"TEST_limit_{i}"}, timeout=15)
                assert r.status_code == 200, f"create #{i+1} failed: {r.text}"
                created_ids.append(r.json()["keys"]["key_id"])
            # 6th must 429
            r6 = admin_session.post(f"{API}/pay/my-keys/create",
                                    json={"label": "TEST_limit_6"}, timeout=15)
            assert r6.status_code == 429, f"expected 429 on 6th, got {r6.status_code}: {r6.text}"
        finally:
            for kid in created_ids:
                admin_session.post(f"{API}/pay/my-keys/{kid}/revoke", timeout=15)
