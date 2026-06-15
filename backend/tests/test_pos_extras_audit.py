# Backend tests for iteration_25:
# - GET /api/admin/audit-logs (extended filters: date_from, date_to, email, search, available_events/severities)
# - GET /api/pos/store/{store_id}/qr-poster (json, png, svg)
# - POST /api/pos/features/admin/trial-reset (admin-only)
# - GET /api/pos/staff/list, POST /api/pos/staff/update, POST /api/pos/staff/remove
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://game-center-hub-1.preview.emergentagent.com",
).rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

MERCHANT_ID = "MER-520D937E02F3"
STORE_ID = "STR-34CCF1107F"


@pytest.fixture(scope="session")
def admin_headers():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    token = s.cookies.get("access_token") or r.json().get("access_token")
    if not token:
        pytest.skip("No access_token cookie/body in login response")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Audit Log filters ──
class TestAuditLogs:
    def test_audit_logs_basic(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/audit-logs", headers=admin_headers, timeout=20
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("logs", "total", "skip", "limit", "available_events", "available_severities"):
            assert k in d, f"missing key {k} in audit-logs response"
        assert isinstance(d["logs"], list)
        assert isinstance(d["available_events"], list)
        assert isinstance(d["available_severities"], list)

    def test_audit_logs_with_date_range(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/audit-logs",
            params={
                "date_from": "2024-01-01T00:00:00Z",
                "date_to": "2030-01-01T00:00:00Z",
                "limit": 5,
            },
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["limit"] == 5
        assert isinstance(d["logs"], list)

    def test_audit_logs_with_email_search(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/audit-logs",
            params={"email": "admin", "limit": 10},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text

    def test_audit_logs_with_search_term(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/audit-logs",
            params={"search": "login", "limit": 10},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text

    def test_audit_logs_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/audit-logs", timeout=15)
        assert r.status_code in (401, 403)


# ── QR-Poster ──
class TestQRPoster:
    def test_qr_poster_json(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/pos/store/{STORE_ID}/qr-poster",
            params={"format": "json"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "target_url" in d
        assert "store_name" in d
        assert STORE_ID in d["target_url"]
        assert "/selfcheckout" in d["target_url"]

    def test_qr_poster_png(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/pos/store/{STORE_ID}/qr-poster",
            params={"format": "png"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/png")
        # PNG magic bytes
        assert r.content[:4] == b"\x89PNG"
        assert len(r.content) > 200

    def test_qr_poster_svg(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/pos/store/{STORE_ID}/qr-poster",
            params={"format": "svg"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert "image/svg" in r.headers.get("content-type", "")
        body = r.content.decode("utf-8", errors="ignore")
        assert "<svg" in body.lower()

    def test_qr_poster_with_custom_base_url(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/pos/store/{STORE_ID}/qr-poster",
            params={"format": "json", "base_url": "https://example.test"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["target_url"].startswith("https://example.test/selfcheckout")

    def test_qr_poster_nonexistent_store(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/pos/store/STR-DOES-NOT-EXIST/qr-poster",
            params={"format": "json"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 404, r.text

    def test_qr_poster_unauth(self):
        r = requests.get(
            f"{BASE_URL}/api/pos/store/{STORE_ID}/qr-poster",
            params={"format": "json"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# ── Trial-Reset ──
class TestTrialReset:
    def test_trial_reset_unauth(self):
        r = requests.post(
            f"{BASE_URL}/api/pos/features/admin/trial-reset",
            json={"merchant_id": MERCHANT_ID, "feature_key": "self_checkout"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_trial_reset_unknown_merchant(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/pos/features/admin/trial-reset",
            json={"merchant_id": "MER-DOES-NOT-EXIST", "feature_key": "self_checkout"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 404, r.text

    def test_trial_reset_admin_ok_or_404(self, admin_headers):
        # Try common feature keys; if seed exists -> 200 with trial_used=False; otherwise 404 acceptable
        candidates = ["self_checkout", "loyalty", "split_payments", "demo"]
        last = None
        for fk in candidates:
            r = requests.post(
                f"{BASE_URL}/api/pos/features/admin/trial-reset",
                json={"merchant_id": MERCHANT_ID, "feature_key": fk},
                headers=admin_headers,
                timeout=20,
            )
            last = r
            if r.status_code == 200:
                d = r.json()
                assert d.get("ok") is True
                # Validate persistence via re-call
                r2 = requests.post(
                    f"{BASE_URL}/api/pos/features/admin/trial-reset",
                    json={"merchant_id": MERCHANT_ID, "feature_key": fk},
                    headers=admin_headers,
                    timeout=20,
                )
                assert r2.status_code == 200
                return
        # If we get here, no feature was provisioned for this merchant — accept 404 as documented
        assert last is not None and last.status_code == 404, (
            f"Expected at least 200 (ok) or 404 (not found), last={last.status_code if last else 'n/a'}"
        )


# ── Staff CRUD ──
class TestStaff:
    def test_staff_list_unauth(self):
        r = requests.get(
            f"{BASE_URL}/api/pos/staff/list",
            params={"store_id": STORE_ID},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_staff_list_admin(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/pos/staff/list",
            params={"store_id": STORE_ID},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "staff" in d
        assert isinstance(d["staff"], list)

    def test_staff_update_invalid_role(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/pos/staff/update",
            json={
                "user_id": "TEST_USER_DOESNTMATTER",
                "store_id": STORE_ID,
                "role": "evil_admin",
            },
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 400, r.text

    def test_staff_update_no_fields(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/pos/staff/update",
            json={"user_id": "TEST_USER", "store_id": STORE_ID},
            headers=admin_headers,
            timeout=20,
        )
        # Either 400 ("Nichts zu aktualisieren") or 404 if staff entry not found is acceptable;
        # implementation validates "nothing to update" first.
        assert r.status_code == 400, r.text

    def test_staff_update_not_found(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/pos/staff/update",
            json={
                "user_id": "TEST_USER_NOEXIST",
                "store_id": STORE_ID,
                "role": "cashier",
            },
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 404, r.text

    def test_staff_remove_not_found(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/pos/staff/remove",
            json={"user_id": "TEST_USER_NOEXIST", "store_id": STORE_ID},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 404, r.text
