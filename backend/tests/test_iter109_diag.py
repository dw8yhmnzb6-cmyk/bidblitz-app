"""
Backend tests for iter106-109 Diagnostic Infrastructure:
- GET /api/diag/routes  (admin only)
- GET /api/diag/routes/failed (admin only)
- GET /api/diag/health-deep (admin only)
- GET /api/diag/health/probe (PUBLIC, no-auth)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-staging-2.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"
KUNDE_EMAIL = "kunde@bidblitz.com"
KUNDE_PASS = "Kunde2026!"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password},
               timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def kunde_session():
    return _login(KUNDE_EMAIL, KUNDE_PASS)


# ---------- /api/diag/routes ----------

class TestDiagRoutes:
    def test_admin_can_read_routes(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/diag/routes", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for key in ["total_registered", "total_failed", "registered", "failed",
                    "live_paths_count", "live_paths"]:
            assert key in d, f"missing key {key}"
        assert isinstance(d["registered"], list)
        assert isinstance(d["failed"], list)
        assert d["total_registered"] >= 100, f"expected >=100 registered, got {d['total_registered']}"
        assert d["live_paths_count"] >= 1000, f"expected >=1000 live paths, got {d['live_paths_count']}"
        # Spec says 151 registered, 2 failed
        print(f"registered={d['total_registered']} failed={d['total_failed']} live_paths={d['live_paths_count']}")
        # Validate failed entries shape (without traceback by default)
        for f in d["failed"]:
            assert "module" in f and "error_type" in f and "error" in f
            assert "traceback" not in f  # not included unless ?include_traceback=true

    def test_admin_routes_with_traceback(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/diag/routes?include_traceback=true", timeout=30)
        assert r.status_code == 200
        d = r.json()
        if d["total_failed"] > 0:
            assert "traceback" in d["failed"][0]
            assert isinstance(d["failed"][0]["traceback"], str)

    def test_kunde_forbidden(self, kunde_session):
        r = kunde_session.get(f"{BASE_URL}/api/diag/routes", timeout=20)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_guest_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/diag/routes", timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ---------- /api/diag/routes/failed ----------

class TestDiagFailed:
    def test_admin_failed_only(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/diag/routes/failed", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "total_failed" in d
        assert "failed" in d
        assert isinstance(d["failed"], list)
        for f in d["failed"]:
            assert "module" in f
            assert "error_type" in f
            assert "error" in f

    def test_kunde_forbidden(self, kunde_session):
        r = kunde_session.get(f"{BASE_URL}/api/diag/routes/failed", timeout=20)
        assert r.status_code == 403


# ---------- /api/diag/health-deep ----------

class TestHealthDeep:
    def test_admin_health_deep(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/diag/health-deep", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for key in ["status", "checked_at", "elapsed_ms", "critical_issues",
                    "warnings", "components"]:
            assert key in d
        assert d["status"] in ("ok", "degraded", "critical")
        comps = d["components"]
        # mongo block
        assert "mongo" in comps and "ping_ms" in comps["mongo"]
        assert "collections" in comps["mongo"]
        # bot_loop block
        assert "bot_loop" in comps and "status" in comps["bot_loop"]
        # routing block
        assert "routing" in comps
        assert comps["routing"]["registered"] >= 100
        # integrations - all 9 required
        ints = comps["integrations"]
        for name in ["stripe", "emergent_llm", "resend_email", "elevenlabs",
                     "mapbox", "vapid_push", "sabre", "livekit", "sentry"]:
            assert name in ints, f"missing integration: {name}"
        # Stripe must have mode
        assert ints["stripe"]["mode"] in ("test", "live", "unknown")

    def test_no_auth_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/diag/health-deep", timeout=20)
        assert r.status_code in (401, 403)


# ---------- /api/diag/health/probe (public) ----------

class TestHealthProbe:
    def test_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/diag/health/probe", timeout=30)
        # 200 if ok, 503 if degraded/critical
        assert r.status_code in (200, 503), f"got {r.status_code}: {r.text[:200]}"
        d = r.json()
        for key in ["status", "checked_at", "elapsed_ms", "critical_issues",
                    "warnings", "components"]:
            assert key in d
        assert d["status"] in ("ok", "degraded", "critical")
        # Mapping rule
        if d["status"] == "ok":
            assert r.status_code == 200
        else:
            assert r.status_code == 503

    def test_probe_has_no_previews_or_tracebacks(self):
        """Public probe must NOT leak key previews / tracebacks / PII."""
        r = requests.get(f"{BASE_URL}/api/diag/health/probe", timeout=30)
        body = r.text
        # Strings that would indicate leaks
        forbidden_substrings = ["traceback", "Traceback", "preview", "sk_test_",
                                 "sk_live_", "length"]
        for s in forbidden_substrings:
            assert s not in body, f"public probe leaked '{s}': {body[:300]}"
        d = r.json()
        # Components must be flat status strings/ints, not nested key dicts
        comps = d["components"]
        assert isinstance(comps["mongo"], str)
        assert isinstance(comps["bot_loop"], str)
        assert isinstance(comps["routing_registered"], int)
        assert isinstance(comps["routing_failed"], int)
        # No 'integrations' nested block in public mode
        assert "integrations" not in comps
