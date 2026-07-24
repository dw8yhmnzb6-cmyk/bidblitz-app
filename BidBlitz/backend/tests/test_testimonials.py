"""Backend tests for Merchant Testimonials system (iteration 38)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert data.get("role") == "admin", f"Unexpected role: {data.get('role')}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─── Public endpoints ───
class TestPublicTestimonials:
    def test_list_all_seed(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/testimonials")
        assert r.status_code == 200
        d = r.json()
        assert "testimonials" in d and "count" in d
        names = [t["business_name"] for t in d["testimonials"]]
        for expected in ["Pizzeria Da Mario", "Hair & Style Studio",
                         "BioBack Bäckerei", "FitZone Studio"]:
            assert expected in names, f"Missing seed: {expected}"
        assert d["count"] >= 4

    def test_filter_gastro(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/testimonials?industry=gastro")
        assert r.status_code == 200
        d = r.json()
        assert len(d["testimonials"]) >= 1
        for t in d["testimonials"]:
            assert t["industry"] == "gastro"
        assert any(t["business_name"] == "Pizzeria Da Mario"
                   for t in d["testimonials"])

    def test_filter_unknown_industry_empty(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/testimonials?industry=xyz")
        assert r.status_code == 200
        d = r.json()
        assert d["testimonials"] == []
        assert d["count"] == 0

    def test_admin_list_without_auth_denied(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/testimonials/admin/list")
        assert r.status_code in (401, 403)


# ─── Admin endpoints ───
class TestAdminTestimonials:
    def test_admin_list_returns_all(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/testimonials/admin/list")
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 4
        assert len(d["testimonials"]) >= 4

    def test_create_valid(self, admin_session):
        payload = {
            "business_name": "TEST_Cafe Alpha",
            "owner_name": "Test Owner",
            "role": "Owner",
            "industry": "gastro",
            "location": "TestCity",
            "quote": "TEST_Ein ausreichend langes Zitat fuer die Validierung.",
            "rating": 5,
            "active": True,
            "is_pilot": True,
            "sort_order": 500,
        }
        r = admin_session.post(f"{BASE_URL}/api/testimonials/admin/create",
                               json=payload)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d.get("ok") is True
        assert "testimonial" in d
        tid = d["testimonial"]["testimonial_id"]
        assert tid
        # save for later tests
        TestAdminTestimonials._created_id = tid

    def test_create_short_quote_422(self, admin_session):
        payload = {
            "business_name": "TEST_Short",
            "industry": "retail",
            "quote": "zu kurz",
        }
        r = admin_session.post(f"{BASE_URL}/api/testimonials/admin/create",
                               json=payload)
        assert r.status_code == 422

    def test_update_set_inactive_hides_from_public(self, admin_session, anon_session):
        tid = getattr(TestAdminTestimonials, "_created_id", None)
        assert tid, "previous create test must pass"
        r = admin_session.put(f"{BASE_URL}/api/testimonials/admin/{tid}",
                              json={"active": False})
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Public endpoint should not include this inactive testimonial
        r2 = anon_session.get(f"{BASE_URL}/api/testimonials?limit=50")
        assert r2.status_code == 200
        ids = [t.get("testimonial_id") for t in r2.json()["testimonials"]]
        assert tid not in ids, "Inactive testimonial still visible publicly"

    def test_delete_created(self, admin_session):
        tid = getattr(TestAdminTestimonials, "_created_id", None)
        assert tid
        r = admin_session.delete(f"{BASE_URL}/api/testimonials/admin/{tid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # confirm gone
        r2 = admin_session.get(f"{BASE_URL}/api/testimonials/admin/list")
        ids = [t["testimonial_id"] for t in r2.json()["testimonials"]]
        assert tid not in ids

    def test_delete_nonexistent_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/testimonials/admin/doesnotexist123")
        assert r.status_code == 404
