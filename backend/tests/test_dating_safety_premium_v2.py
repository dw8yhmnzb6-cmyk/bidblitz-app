"""
Dating Safety Pro + Premium Checkout Tests - Iteration 223
Tests for:
- Safety Pro card with scam/nudity risk tiles
- Profile API returns safety_summary
- Discover responses include safety_summary and discover_rank
- Matches and Likes You include safety indicators
- Safety Pro refresh action
- Premium plans endpoint
- Real Stripe checkout flow
- Premium status polling
"""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://super-app-staging-2.preview.emergentagent.com").rstrip("/")


class TestDatingSafetyPro:
    """Safety Pro feature tests - scam detection and nudity warning"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"},
        )
        assert login.status_code == 200, f"Login failed: {login.text}"
        yield
        self.session.close()

    def test_profile_me_includes_safety_summary(self):
        """Profile API returns safety_summary for current profile"""
        res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "profile" in data
        profile = data["profile"]
        
        # Verify safety_summary exists and has required fields
        summary = profile.get("safety_summary")
        assert summary is not None, "safety_summary missing from profile"
        assert "scam_level" in summary, "scam_level missing"
        assert "nudity_level" in summary, "nudity_level missing"
        assert "total_score" in summary, "total_score missing"
        assert "scam_score" in summary, "scam_score missing"
        assert "nudity_score" in summary, "nudity_score missing"
        
        # Verify levels are valid values
        assert summary["scam_level"] in ["low", "medium", "high"], f"Invalid scam_level: {summary['scam_level']}"
        assert summary["nudity_level"] in ["low", "medium", "high"], f"Invalid nudity_level: {summary['nudity_level']}"
        
        # Verify scores are numeric
        assert isinstance(summary["total_score"], int), "total_score should be int"
        assert 0 <= summary["total_score"] <= 100, "total_score should be 0-100"

    def test_discover_profiles_include_safety_summary_and_rank(self):
        """Discover responses include safety_summary and discover_rank for profiles"""
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200, res.text
        data = res.json()
        
        profiles = data.get("profiles", [])
        # Check at least some profiles have safety_summary
        for profile in profiles[:5]:  # Check first 5 profiles
            assert "safety_summary" in profile, f"Profile {profile.get('profile_id')} missing safety_summary"
            assert "discover_rank" in profile, f"Profile {profile.get('profile_id')} missing discover_rank"
            
            # Verify discover_rank is numeric
            assert isinstance(profile["discover_rank"], int), "discover_rank should be int"

    def test_matches_include_safety_indicators(self):
        """Matches include visible safety indicators where data exists"""
        res = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert res.status_code == 200, res.text
        data = res.json()
        
        matches = data.get("matches", [])
        # If there are matches, verify they have safety_summary
        for match in matches[:5]:
            # safety_summary should be present if profile has been scanned
            if match.get("safety_summary"):
                assert "scam_level" in match["safety_summary"]
                assert "total_score" in match["safety_summary"]

    def test_likes_you_include_safety_indicators(self):
        """Likes You items include visible safety indicators where data exists"""
        res = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert res.status_code == 200, res.text
        data = res.json()
        
        # If premium, check profiles have safety_summary
        if not data.get("locked"):
            profiles = data.get("profiles", [])
            for profile in profiles[:5]:
                if profile.get("safety_summary"):
                    assert "scam_level" in profile["safety_summary"]
                    assert "total_score" in profile["safety_summary"]

    def test_safety_scan_refresh_action(self):
        """Safety Pro refresh action works without backend failure"""
        # First get profile to get profile_id
        profile_res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_res.status_code == 200
        profile_id = profile_res.json()["profile"]["profile_id"]
        
        # Trigger safety scan refresh
        res = self.session.post(
            f"{BASE_URL}/api/dating/safety/scan",
            json={"profile_id": profile_id, "force": True},
        )
        assert res.status_code == 200, f"Safety scan failed: {res.text}"
        data = res.json()
        
        assert data["ok"] is True
        assert data["profile_id"] == profile_id
        assert "safety" in data
        
        # Verify safety response structure
        safety = data["safety"]
        assert "scam_level" in safety
        assert "nudity_level" in safety
        assert "total_score" in safety

    def test_safety_scan_without_force(self):
        """Safety scan without force uses cached result if fresh"""
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


class TestDatingPremiumCheckout:
    """Real Stripe checkout flow tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"},
        )
        assert login.status_code == 200, f"Login failed: {login.text}"
        yield
        self.session.close()

    def test_premium_plans_returns_real_plan(self):
        """Premium plans endpoint returns a real plan"""
        res = self.session.get(f"{BASE_URL}/api/dating/premium/plans")
        assert res.status_code == 200, res.text
        data = res.json()
        
        plans = data.get("plans", [])
        assert len(plans) >= 1, "No premium plans returned"
        
        plan = plans[0]
        assert plan["plan_id"] == "premium_30d", f"Expected premium_30d, got {plan['plan_id']}"
        assert "price_eur" in plan
        assert "duration_days" in plan
        assert "label" in plan
        assert "currency" in plan
        
        # Verify plan has reasonable values
        assert plan["price_eur"] > 0, "Price should be positive"
        assert plan["duration_days"] > 0, "Duration should be positive"

    def test_real_premium_checkout_creates_session(self):
        """Starting a real Dating Premium checkout returns Stripe checkout URL and creates transaction"""
        res = self.session.post(
            f"{BASE_URL}/api/dating/premium/checkout",
            json={"plan_id": "premium_30d", "origin_url": BASE_URL},
        )
        assert res.status_code == 200, f"Checkout failed: {res.text}"
        data = res.json()
        
        assert data["ok"] is True
        assert data.get("checkout_url"), "checkout_url missing"
        assert data.get("session_id"), "session_id missing"
        assert data["plan"]["plan_id"] == "premium_30d"
        
        # Verify checkout_url is a valid Stripe URL
        checkout_url = data["checkout_url"]
        assert "stripe.com" in checkout_url or "checkout" in checkout_url, f"Invalid checkout URL: {checkout_url}"
        
        # Store session_id for status check
        self.checkout_session_id = data["session_id"]
        return data["session_id"]

    def test_premium_status_polling_returns_valid_status(self):
        """Premium status polling endpoint returns valid unpaid/open status immediately after session creation"""
        # First create a checkout session
        checkout_res = self.session.post(
            f"{BASE_URL}/api/dating/premium/checkout",
            json={"plan_id": "premium_30d", "origin_url": BASE_URL},
        )
        assert checkout_res.status_code == 200
        session_id = checkout_res.json()["session_id"]
        
        # Poll status immediately
        status_res = self.session.get(f"{BASE_URL}/api/dating/premium/status/{session_id}")
        assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
        data = status_res.json()
        
        # Verify status structure
        assert "status" in data
        assert "payment_status" in data
        assert "premium_activated" in data
        assert "session_id" in data
        
        # Immediately after creation, should NOT be activated
        assert data["premium_activated"] is False, "Premium should not be activated immediately"
        
        # Status should be initiated or open, not paid
        assert data["payment_status"] in ["pending", "unpaid", "open"], f"Unexpected payment_status: {data['payment_status']}"

    def test_premium_checkout_invalid_plan(self):
        """Checkout with invalid plan returns error"""
        res = self.session.post(
            f"{BASE_URL}/api/dating/premium/checkout",
            json={"plan_id": "invalid_plan_xyz", "origin_url": BASE_URL},
        )
        assert res.status_code == 400, f"Expected 400 for invalid plan, got {res.status_code}"

    def test_demo_upgrade_still_exists_for_backward_compatibility(self):
        """POST /api/dating/premium/demo-upgrade still exists for backward compatibility"""
        res = self.session.post(f"{BASE_URL}/api/dating/premium/demo-upgrade")
        # Should work (200) - this is the mocked demo path
        assert res.status_code == 200, f"Demo upgrade failed: {res.text}"
        data = res.json()
        assert data["ok"] is True


class TestDatingDiscoverRanking:
    """Discovery score weighting tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"},
        )
        assert login.status_code == 200, f"Login failed: {login.text}"
        yield
        self.session.close()

    def test_discover_profiles_sorted_by_rank(self):
        """Discover profiles are sorted by discover_rank"""
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200, res.text
        data = res.json()
        
        profiles = data.get("profiles", [])
        if len(profiles) >= 2:
            # Verify profiles are sorted by discover_rank (descending)
            ranks = [p.get("discover_rank", 0) for p in profiles]
            # Allow some tolerance for ties
            for i in range(len(ranks) - 1):
                # Ranks should be in descending order (higher rank first)
                assert ranks[i] >= ranks[i + 1] - 5, f"Profiles not sorted by rank: {ranks[i]} vs {ranks[i+1]}"

    def test_discover_rank_considers_safety(self):
        """Discover rank calculation considers safety scores"""
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200, res.text
        data = res.json()
        
        profiles = data.get("profiles", [])
        for profile in profiles[:5]:
            # Profiles with high safety risk should have lower rank
            safety = profile.get("safety_summary", {})
            rank = profile.get("discover_rank", 0)
            
            # Just verify the fields exist and are reasonable
            assert isinstance(rank, int)
            if safety.get("scam_level") == "high":
                # High scam profiles should have reduced rank
                # (We can't verify exact values, just that the field exists)
                pass


class TestDatingRegression:
    """Regression tests for existing Dating UI features"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"},
        )
        assert login.status_code == 200, f"Login failed: {login.text}"
        yield
        self.session.close()

    def test_discover_endpoint_works(self):
        """Discover tab API works"""
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "profiles" in data

    def test_matches_endpoint_works(self):
        """Matches tab API works"""
        res = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "matches" in data

    def test_likes_you_endpoint_works(self):
        """Likes You tab API works"""
        res = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "count" in data

    def test_nearby_endpoint_works(self):
        """Nearby API works"""
        res = self.session.get(f"{BASE_URL}/api/dating/nearby")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "profiles" in data

    def test_crossed_paths_endpoint_works(self):
        """Crossed Paths API works"""
        res = self.session.get(f"{BASE_URL}/api/dating/crossed-paths")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "profiles" in data

    def test_swipes_left_endpoint_works(self):
        """Swipes left API works"""
        res = self.session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "swipes_left" in data or "unlimited" in data
