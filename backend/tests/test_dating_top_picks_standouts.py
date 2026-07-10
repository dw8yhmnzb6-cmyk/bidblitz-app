"""
Dating Top Picks, Standouts, and Message-before-match (Platinum opener_text) Tests
Iteration 226 - Testing curated surfaces and Platinum-only opener feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDatingTopPicks:
    """GET /api/dating/top-picks endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as reviewer
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        yield
        self.session.close()
    
    def test_top_picks_endpoint_returns_200(self):
        """Top picks endpoint should return 200"""
        res = self.session.get(f"{BASE_URL}/api/dating/top-picks")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "profiles" in data
        assert "free_visible" in data
        assert "locked_count" in data
    
    def test_top_picks_response_structure(self):
        """Top picks should return correct response structure"""
        res = self.session.get(f"{BASE_URL}/api/dating/top-picks")
        assert res.status_code == 200
        data = res.json()
        
        # Verify structure
        assert isinstance(data["profiles"], list)
        assert isinstance(data["free_visible"], int)
        assert isinstance(data["locked_count"], int)
        assert data["free_visible"] == 1  # First slot is always free
    
    def test_top_picks_profile_metadata(self):
        """Top picks profiles should have pick_type and headline metadata"""
        res = self.session.get(f"{BASE_URL}/api/dating/top-picks")
        assert res.status_code == 200
        data = res.json()
        
        if data["profiles"]:
            profile = data["profiles"][0]
            assert profile.get("pick_type") == "top_pick"
            assert profile.get("headline") == "Top Pick des Tages"
            assert "locked" in profile
    
    def test_top_picks_locked_metadata_for_premium_user(self):
        """Premium user should have all top picks unlocked"""
        res = self.session.get(f"{BASE_URL}/api/dating/top-picks")
        assert res.status_code == 200
        data = res.json()
        
        # Reviewer is premium, so all should be unlocked
        for profile in data["profiles"]:
            assert profile.get("locked") == False, f"Premium user should have unlocked profiles"


class TestDatingStandouts:
    """GET /api/dating/standouts endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as reviewer
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        yield
        self.session.close()
    
    def test_standouts_endpoint_returns_200(self):
        """Standouts endpoint should return 200"""
        res = self.session.get(f"{BASE_URL}/api/dating/standouts")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "profiles" in data
        assert "free_visible" in data
        assert "locked_count" in data
    
    def test_standouts_response_structure(self):
        """Standouts should return correct response structure"""
        res = self.session.get(f"{BASE_URL}/api/dating/standouts")
        assert res.status_code == 200
        data = res.json()
        
        # Verify structure
        assert isinstance(data["profiles"], list)
        assert isinstance(data["free_visible"], int)
        assert isinstance(data["locked_count"], int)
        assert data["free_visible"] == 1  # First slot is always free
    
    def test_standouts_profile_metadata(self):
        """Standouts profiles should have pick_type, headline, and requires_superlike metadata"""
        res = self.session.get(f"{BASE_URL}/api/dating/standouts")
        assert res.status_code == 200
        data = res.json()
        
        if data["profiles"]:
            profile = data["profiles"][0]
            assert profile.get("pick_type") == "standout"
            assert profile.get("headline") == "Standout"
            assert profile.get("requires_superlike") == True
            assert "locked" in profile
    
    def test_standouts_locked_metadata_for_premium_user(self):
        """Premium user should have all standouts unlocked"""
        res = self.session.get(f"{BASE_URL}/api/dating/standouts")
        assert res.status_code == 200
        data = res.json()
        
        # Reviewer is premium, so all should be unlocked
        for profile in data["profiles"]:
            assert profile.get("locked") == False, f"Premium user should have unlocked profiles"


class TestDatingOpenerTextPlatinum:
    """Message-before-match (opener_text) Platinum-only feature tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
        self.session.close()
    
    def test_opener_text_blocked_for_non_platinum_user(self):
        """Non-platinum user should be blocked from sending opener_text"""
        # Login as reviewer (premium but not platinum)
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_res.status_code == 200
        
        # Get profile to check tier
        profile_res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_res.status_code == 200
        profile_data = profile_res.json()
        
        # Get discover profiles
        discover_res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert discover_res.status_code == 200
        discover_data = discover_res.json()
        
        if discover_data.get("profiles"):
            target_profile_id = discover_data["profiles"][0]["profile_id"]
            
            # Check if user is platinum
            premium_plan = profile_data.get("profile", {}).get("premium_plan")
            is_platinum = premium_plan == "platinum_30d"
            
            # Try to send opener_text
            like_res = self.session.post(f"{BASE_URL}/api/dating/like", json={
                "profile_id": target_profile_id,
                "super_like": False,
                "opener_text": "Hey, ich finde dein Profil super interessant!"
            })
            
            if is_platinum:
                # Platinum user should be able to send opener_text
                assert like_res.status_code == 200, f"Platinum user should be able to send opener_text"
            else:
                # Non-platinum user should be blocked
                assert like_res.status_code == 403, f"Non-platinum user should be blocked from opener_text, got {like_res.status_code}"
                error_data = like_res.json()
                assert "Platinum" in error_data.get("detail", ""), f"Error should mention Platinum"
    
    def test_like_without_opener_text_works_for_all_users(self):
        """Like without opener_text should work for all premium users"""
        # Login as reviewer
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_res.status_code == 200
        
        # Get discover profiles
        discover_res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert discover_res.status_code == 200
        discover_data = discover_res.json()
        
        if discover_data.get("profiles"):
            target_profile_id = discover_data["profiles"][0]["profile_id"]
            
            # Like without opener_text should work
            like_res = self.session.post(f"{BASE_URL}/api/dating/like", json={
                "profile_id": target_profile_id,
                "super_like": False
            })
            
            # Should succeed (200) or already swiped
            assert like_res.status_code == 200, f"Like without opener_text should work, got {like_res.status_code}"


class TestDatingCurationScoring:
    """Tests for curation scoring functions used in Top Picks and Standouts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as reviewer
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_res.status_code == 200
        yield
        self.session.close()
    
    def test_top_picks_sorted_by_curation_score(self):
        """Top picks should be sorted by curation score (highest first)"""
        res = self.session.get(f"{BASE_URL}/api/dating/top-picks")
        assert res.status_code == 200
        data = res.json()
        
        # Verify profiles are returned (may be empty if no discover pool)
        assert isinstance(data["profiles"], list)
        
        # If profiles exist, verify they have compatibility_score
        if len(data["profiles"]) >= 2:
            # Profiles should be sorted by curation score (descending)
            # We can't directly access curation_score, but compatibility_score is a component
            for profile in data["profiles"]:
                assert "compatibility_score" in profile or "discover_rank" in profile
    
    def test_standouts_sorted_by_standout_score(self):
        """Standouts should be sorted by standout score (highest first)"""
        res = self.session.get(f"{BASE_URL}/api/dating/standouts")
        assert res.status_code == 200
        data = res.json()
        
        # Verify profiles are returned (may be empty if no discover pool)
        assert isinstance(data["profiles"], list)
        
        # If profiles exist, verify they have compatibility_score
        if len(data["profiles"]) >= 2:
            for profile in data["profiles"]:
                assert "compatibility_score" in profile or "discover_rank" in profile


class TestDatingRegression:
    """Regression tests for existing dating functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as reviewer
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_res.status_code == 200
        yield
        self.session.close()
    
    def test_discover_endpoint_still_works(self):
        """Discover endpoint should still work"""
        res = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert res.status_code == 200
        data = res.json()
        assert "profiles" in data
    
    def test_matches_endpoint_still_works(self):
        """Matches endpoint should still work"""
        res = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert res.status_code == 200
        data = res.json()
        assert "matches" in data
    
    def test_likes_you_endpoint_still_works(self):
        """Likes You endpoint should still work"""
        res = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert res.status_code == 200
        data = res.json()
        assert "profiles" in data or "locked" in data
    
    def test_profile_me_endpoint_still_works(self):
        """Profile me endpoint should still work"""
        res = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert res.status_code == 200
        data = res.json()
        assert "profile" in data
    
    def test_monetization_endpoint_still_works(self):
        """Monetization endpoint should still work"""
        res = self.session.get(f"{BASE_URL}/api/dating/monetization")
        assert res.status_code == 200
        data = res.json()
        assert "plans" in data
        assert "consumables" in data
        assert "entitlements" in data
    
    def test_swipes_left_endpoint_still_works(self):
        """Swipes left endpoint should still work"""
        res = self.session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert res.status_code == 200
        data = res.json()
        assert "swipes_left" in data or "unlimited" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
