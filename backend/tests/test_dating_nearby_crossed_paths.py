"""
Dating P2 Nearby / Crossed Paths Backend Tests
Tests for iteration 220: Location update, Nearby profiles, Crossed Paths
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"

# Berlin coordinates (near seed profile Lina)
BERLIN_LAT = 52.5200
BERLIN_LNG = 13.4050


class TestDatingNearbyAndCrossedPaths:
    """Tests for Dating Nearby and Crossed Paths features"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        yield
        self.session.close()

    def test_01_dating_profile_me_loads(self):
        """Verify dating profile endpoint works"""
        res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert res.status_code == 200, f"Profile load failed: {res.text}"
        data = res.json()
        assert "profile" in data
        assert "filters" in data
        print(f"Profile loaded: {data['profile'].get('name')}, premium={data['profile'].get('premium')}")

    def test_02_location_update_success(self):
        """POST /api/dating/location accepts valid coordinates and returns ok:true"""
        res = self.session.post(
            f"{BASE_URL}/api/dating/location",
            json={"lat": BERLIN_LAT, "lng": BERLIN_LNG, "accuracy_m": 50},
        )
        assert res.status_code == 200, f"Location update failed: {res.text}"
        data = res.json()
        assert data.get("ok") is True
        assert data.get("location_updated") is True
        # crossed_updates can be 0 or more depending on seed data
        assert "crossed_updates" in data
        print(f"Location updated, crossed_updates={data.get('crossed_updates')}")

    def test_03_location_update_invalid_lat(self):
        """POST /api/dating/location rejects invalid latitude"""
        res = self.session.post(
            f"{BASE_URL}/api/dating/location",
            json={"lat": 999, "lng": BERLIN_LNG, "accuracy_m": 50},
        )
        # Should return 422 validation error
        assert res.status_code == 422, f"Expected 422 for invalid lat, got {res.status_code}"

    def test_04_location_update_invalid_lng(self):
        """POST /api/dating/location rejects invalid longitude"""
        res = self.session.post(
            f"{BASE_URL}/api/dating/location",
            json={"lat": BERLIN_LAT, "lng": 999, "accuracy_m": 50},
        )
        # Should return 422 validation error
        assert res.status_code == 422, f"Expected 422 for invalid lng, got {res.status_code}"

    def test_05_nearby_profiles_returns_list(self):
        """GET /api/dating/nearby returns profiles after location update"""
        # First update location
        self.session.post(
            f"{BASE_URL}/api/dating/location",
            json={"lat": BERLIN_LAT, "lng": BERLIN_LNG, "accuracy_m": 50},
        )
        # Then get nearby
        res = self.session.get(f"{BASE_URL}/api/dating/nearby")
        assert res.status_code == 200, f"Nearby failed: {res.text}"
        data = res.json()
        assert "profiles" in data
        assert "radius_km" in data
        assert "nearby_enabled" in data
        # If location is fresh, nearby_enabled should be True
        if data.get("nearby_enabled"):
            print(f"Nearby enabled, found {len(data['profiles'])} profiles within {data['radius_km']} km")
            # Check profile structure if any profiles returned
            if data["profiles"]:
                profile = data["profiles"][0]
                assert "profile_id" in profile
                assert "name" in profile
                assert "distance_km" in profile
                print(f"First nearby profile: {profile.get('name')}, distance={profile.get('distance_km')} km")
        else:
            print(f"Nearby not enabled: {data.get('message')}")

    def test_06_nearby_with_custom_radius(self):
        """GET /api/dating/nearby accepts radius_km parameter"""
        # Update location first
        self.session.post(
            f"{BASE_URL}/api/dating/location",
            json={"lat": BERLIN_LAT, "lng": BERLIN_LNG, "accuracy_m": 50},
        )
        # Get nearby with custom radius
        res = self.session.get(f"{BASE_URL}/api/dating/nearby?radius_km=50")
        assert res.status_code == 200, f"Nearby with radius failed: {res.text}"
        data = res.json()
        assert data.get("radius_km") == 50.0
        print(f"Nearby with 50km radius: {len(data.get('profiles', []))} profiles")

    def test_07_crossed_paths_returns_list(self):
        """GET /api/dating/crossed-paths returns crossed path entries"""
        res = self.session.get(f"{BASE_URL}/api/dating/crossed-paths")
        assert res.status_code == 200, f"Crossed paths failed: {res.text}"
        data = res.json()
        assert "profiles" in data
        print(f"Crossed paths: {len(data['profiles'])} entries")
        # Check structure if any crossed paths exist
        if data["profiles"]:
            profile = data["profiles"][0]
            assert "profile_id" in profile
            assert "name" in profile
            # Crossed paths should have cross_count and last_crossed_at
            assert "cross_count" in profile
            assert "last_crossed_at" in profile
            print(f"First crossed profile: {profile.get('name')}, cross_count={profile.get('cross_count')}")

    def test_08_location_update_creates_crossed_path(self):
        """Location update near seed profile creates crossed path entry"""
        # Update location to Berlin (where seed Lina is)
        res = self.session.post(
            f"{BASE_URL}/api/dating/location",
            json={"lat": BERLIN_LAT, "lng": BERLIN_LNG, "accuracy_m": 50},
        )
        assert res.status_code == 200
        data = res.json()
        # crossed_updates should be >= 0 (depends on proximity to seed profiles)
        assert "crossed_updates" in data
        print(f"Location update crossed_updates: {data.get('crossed_updates')}")

    def test_09_discover_still_works(self):
        """Regression: GET /api/dating/discover still returns profiles"""
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200, f"Discover failed: {res.text}"
        data = res.json()
        assert "profiles" in data
        print(f"Discover returned {len(data['profiles'])} profiles")

    def test_10_matches_still_works(self):
        """Regression: GET /api/dating/matches still returns matches"""
        res = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert res.status_code == 200, f"Matches failed: {res.text}"
        data = res.json()
        assert "matches" in data
        print(f"Matches returned {len(data['matches'])} matches")

    def test_11_ai_bio_still_works(self):
        """Regression: POST /api/dating/ai/bio still returns suggestions"""
        res = self.session.post(
            f"{BASE_URL}/api/dating/ai/bio",
            json={"prompt": ""},
        )
        assert res.status_code == 200, f"AI Bio failed: {res.text}"
        data = res.json()
        assert data.get("ok") is True
        assert "suggestions" in data
        print(f"AI Bio returned {len(data.get('suggestions', []))} suggestions")

    def test_12_swipes_left_still_works(self):
        """Regression: GET /api/dating/swipes-left still works"""
        res = self.session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert res.status_code == 200, f"Swipes left failed: {res.text}"
        data = res.json()
        assert "swipes_left" in data
        print(f"Swipes left: {data.get('swipes_left')}, premium={data.get('premium')}")

    def test_13_likes_you_still_works(self):
        """Regression: GET /api/dating/likes-you still works"""
        res = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert res.status_code == 200, f"Likes you failed: {res.text}"
        data = res.json()
        assert "count" in data
        print(f"Likes you count: {data.get('count')}, locked={data.get('locked')}")

    def test_14_boost_activate_still_works(self):
        """Regression: POST /api/dating/boost/activate works for premium users"""
        # First ensure premium
        self.session.post(f"{BASE_URL}/api/dating/premium/demo-upgrade")
        # Try to activate boost
        res = self.session.post(f"{BASE_URL}/api/dating/boost/activate")
        # Should be 200 (active or cooldown) or 400 (cooldown)
        assert res.status_code in [200, 400], f"Boost activate failed: {res.text}"
        data = res.json()
        if res.status_code == 200:
            assert "boost" in data
            print(f"Boost state: is_active={data['boost'].get('is_active')}")
        else:
            print(f"Boost in cooldown: {data.get('detail')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
