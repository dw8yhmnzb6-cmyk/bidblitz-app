import os
import requests
import pytest


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://super-app-staging-2.preview.emergentagent.com").rstrip("/")


class TestDatingSafetyAndPremium:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"},
        )
        assert login.status_code == 200, login.text
        yield
        self.session.close()

    def test_profile_me_includes_safety_summary(self):
        res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert res.status_code == 200, res.text
        data = res.json()
        summary = data["profile"].get("safety_summary")
        assert summary is not None
        assert "scam_level" in summary
        assert "nudity_level" in summary
        assert "total_score" in summary

    def test_discover_profiles_include_safety_summary(self):
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200, res.text
        data = res.json()
        for profile in data.get("profiles", []):
            assert "safety_summary" in profile

    def test_safety_scan_endpoint_returns_summary(self):
        profile_res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_res.status_code == 200
        profile_id = profile_res.json()["profile"]["profile_id"]
        res = self.session.post(
            f"{BASE_URL}/api/dating/safety/scan",
            json={"profile_id": profile_id, "force": False},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["ok"] is True
        assert data["profile_id"] == profile_id
        assert "safety" in data

    def test_premium_plans_endpoint(self):
        res = self.session.get(f"{BASE_URL}/api/dating/premium/plans")
        assert res.status_code == 200, res.text
        data = res.json()
        assert len(data.get("plans", [])) >= 1
        assert data["plans"][0]["plan_id"] == "premium_30d"

    def test_real_premium_checkout_session_created(self):
        res = self.session.post(
            f"{BASE_URL}/api/dating/premium/checkout",
            json={"plan_id": "premium_30d", "origin_url": BASE_URL},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["ok"] is True
        assert data.get("checkout_url")
        assert data.get("session_id")
        assert data["plan"]["plan_id"] == "premium_30d"
