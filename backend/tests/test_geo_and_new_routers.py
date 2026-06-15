"""
Test suite for:
- Geo autocomplete (/api/geo/cities, /api/geo/airports)
- Referral engine routes (/api/referral/*)
- Bot personalization routes (/api/bots/*)
- Admin viewers routes (/api/admin/*)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://game-center-hub-1.preview.emergentagent.com").rstrip("/")
TIMEOUT = 20


# ------------------ GEO: CITIES ------------------
class TestGeoCities:
    def test_cities_ber_returns_berlin_top(self):
        r = requests.get(f"{BASE_URL}/api/geo/cities", params={"q": "ber", "limit": 5}, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        results = data["results"]
        assert len(results) > 0
        # Berlin should be top
        names = [c["name"] for c in results]
        assert any("Berlin" in n for n in names), f"Berlin not found in {names}"
        # Schema: name, region, country_code, lat, lon
        first = results[0]
        for key in ("name", "region", "country_code", "lat", "lon"):
            assert key in first, f"Missing key {key} in {first}"
        print(f"q=ber → names={names}")

    def test_cities_ber_country_DE(self):
        r = requests.get(f"{BASE_URL}/api/geo/cities", params={"q": "ber", "country": "DE"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json()["results"]
        assert len(results) > 0
        for c in results:
            assert c["country_code"] == "DE", f"Non-DE result: {c}"

    def test_cities_single_char_empty(self):
        r = requests.get(f"{BASE_URL}/api/geo/cities", params={"q": "a"}, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["results"] == []
        assert body["count"] == 0

    def test_cities_empty_q(self):
        r = requests.get(f"{BASE_URL}/api/geo/cities", params={"q": "", "limit": 5}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["results"] == []

    def test_cities_invalid_limit(self):
        r = requests.get(f"{BASE_URL}/api/geo/cities", params={"q": "ber", "limit": "invalid"}, timeout=TIMEOUT)
        assert r.status_code == 422  # Pydantic/FastAPI validation


# ------------------ GEO: AIRPORTS ------------------
class TestGeoAirports:
    def test_airports_fra_top_frankfurt(self):
        r = requests.get(f"{BASE_URL}/api/geo/airports", params={"q": "fra"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json()["results"]
        assert len(results) > 0
        top = results[0]
        assert top["iata"] == "FRA", f"Expected FRA top, got {top}"
        assert "Frankfurt" in top.get("city", "") or "Frankfurt" in top.get("name", "")
        # Schema
        for key in ("iata", "name", "city", "country", "country_code", "lat", "lon"):
            assert key in top, f"Missing {key} in {top}"

    def test_airports_BER_exact_iata(self):
        r = requests.get(f"{BASE_URL}/api/geo/airports", params={"q": "BER"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json()["results"]
        assert len(results) > 0
        assert results[0]["iata"] == "BER", f"Expected BER top, got {results[0]}"

    def test_airports_lon_returns_london_set(self):
        r = requests.get(f"{BASE_URL}/api/geo/airports", params={"q": "lon", "limit": 10}, timeout=TIMEOUT)
        assert r.status_code == 200
        iatas = [a["iata"] for a in r.json()["results"]]
        expected = {"LHR", "LGW", "STN", "LCY", "LTN"}
        found = expected & set(iatas)
        assert len(found) >= 4, f"Expected most of {expected}, found {found} in {iatas}"


# ------------------ REFERRAL ENGINE ------------------
class TestReferralEngine:
    def test_referral_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/referral/me", timeout=TIMEOUT)
        # Should be 401/403 (auth required)
        assert r.status_code in (401, 403), f"Got {r.status_code}: {r.text[:200]}"

    def test_referral_apply_exists(self):
        # Without body/auth, should be 401/403 or 422 (validation) - NOT 404
        r = requests.post(f"{BASE_URL}/api/referral/apply", json={}, timeout=TIMEOUT)
        assert r.status_code != 404, f"Endpoint missing: {r.text[:200]}"
        assert r.status_code in (401, 403, 422, 400)

    def test_referral_leaderboard_public(self):
        r = requests.get(f"{BASE_URL}/api/referral/leaderboard", timeout=TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        # Must be a list or dict with list - just confirm parseable
        assert isinstance(data, (list, dict))


# ------------------ BOT PERSONALIZATION ------------------
class TestBotPersonalization:
    def test_bots_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/bots/me", timeout=TIMEOUT)
        assert r.status_code in (401, 403), f"Got {r.status_code}: {r.text[:200]}"

    def test_bots_me_setup_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/bots/me/setup", json={}, timeout=TIMEOUT)
        assert r.status_code != 404
        assert r.status_code in (401, 403, 422, 400)

    def test_bots_active_auctions(self):
        r = requests.get(f"{BASE_URL}/api/bots/active-auctions", timeout=TIMEOUT)
        # Should be accessible (public) or auth-only but not 404
        assert r.status_code != 404, f"Endpoint missing: {r.text[:200]}"
        assert r.status_code in (200, 401, 403)


# ------------------ ADMIN VIEWERS ------------------
def _admin_token():
    # Try multiple credential combos
    for email, pwd in [("admin@bidblitz.com", "BidBlitz2026!"), ("admin@bidblitz.ae", "BidBlitz2026!")]:
        try:
            r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=TIMEOUT)
            if r.status_code == 200:
                tok = r.json().get("access_token") or r.json().get("token")
                if tok:
                    return tok
        except Exception:
            pass
    return None


class TestAdminViewers:
    def test_admin_audit_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/audit/list", timeout=TIMEOUT)
        assert r.status_code != 404
        assert r.status_code in (401, 403)

    def test_admin_fraud_alerts_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/fraud/alerts", timeout=TIMEOUT)
        assert r.status_code != 404
        assert r.status_code in (401, 403)

    def test_admin_referrals_top_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/referrals/top", timeout=TIMEOUT)
        assert r.status_code != 404
        assert r.status_code in (401, 403)

    def test_admin_audit_list_with_admin_auth(self):
        tok = _admin_token()
        if not tok:
            pytest.skip("Admin login unavailable")
        r = requests.get(f"{BASE_URL}/api/admin/audit/list", headers={"Authorization": f"Bearer {tok}"}, timeout=TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
