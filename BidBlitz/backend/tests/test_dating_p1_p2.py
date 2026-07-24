"""
Dating P1 (Boost/Spotlight) and P2 (AI Helpers) Backend Tests
Tests for:
- Profile creation without race conditions
- Boost activation for premium users
- Discover endpoint with boost prioritization
- AI Bio generation
- AI Profile Coach
- AI Icebreakers
- Matches and chat functionality
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDatingProfileSetup:
    """Test profile creation and seed setup without race conditions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as reviewer account"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user_data = login_response.json()
        yield
        self.session.close()
    
    def test_profile_me_no_500_error(self):
        """Test /api/dating/profile/me returns 200 without backend errors"""
        response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200, f"Profile endpoint failed: {response.text}"
        data = response.json()
        assert "profile" in data
        assert "filters" in data
        assert data["profile"]["profile_id"] is not None
        print(f"SUCCESS: Profile loaded - {data['profile']['profile_id']}")
    
    def test_profile_has_boost_state(self):
        """Test profile includes boost state metadata"""
        response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        data = response.json()
        profile = data["profile"]
        
        assert "boost" in profile, "Profile missing boost state"
        boost = profile["boost"]
        assert "is_active" in boost
        assert "seconds_left" in boost
        assert "cooldown_remaining_seconds" in boost
        assert "duration_minutes" in boost
        assert "cooldown_hours" in boost
        print(f"SUCCESS: Boost state present - is_active={boost['is_active']}")
    
    def test_discover_no_500_error(self):
        """Test /api/dating/discover returns 200 without race errors"""
        response = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200, f"Discover endpoint failed: {response.text}"
        data = response.json()
        assert "profiles" in data
        print(f"SUCCESS: Discover returned {len(data['profiles'])} profiles")


class TestDatingBoostFeature:
    """Test P1 Boost/Spotlight mechanism"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as reviewer account"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
        )
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_boost_requires_premium(self):
        """Test boost activation requires premium status"""
        # First check if user is premium
        profile_response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_response.status_code == 200
        profile = profile_response.json()["profile"]
        
        if not profile.get("premium"):
            # Non-premium user should get 403
            boost_response = self.session.post(f"{BASE_URL}/api/dating/boost/activate")
            assert boost_response.status_code == 403, "Non-premium user should not be able to boost"
            print("SUCCESS: Boost correctly blocked for non-premium user")
        else:
            print("INFO: User is already premium, skipping non-premium test")
    
    def test_premium_demo_upgrade(self):
        """Test premium demo upgrade flow"""
        response = self.session.post(f"{BASE_URL}/api/dating/premium/demo-upgrade")
        assert response.status_code == 200, f"Premium upgrade failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        assert data.get("premium") == True
        print("SUCCESS: Premium demo upgrade successful")
    
    def test_boost_activation_after_premium(self):
        """Test boost activation works after premium upgrade"""
        # Ensure premium
        self.session.post(f"{BASE_URL}/api/dating/premium/demo-upgrade")
        
        # Check current boost state
        profile_response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        profile = profile_response.json()["profile"]
        boost_state = profile.get("boost", {})
        
        if boost_state.get("is_active"):
            print("INFO: Boost already active, checking state")
            assert boost_state["seconds_left"] > 0
            print(f"SUCCESS: Boost active with {boost_state['seconds_left']} seconds left")
        elif boost_state.get("cooldown_remaining_seconds", 0) > 0:
            print(f"INFO: Boost in cooldown for {boost_state['cooldown_remaining_seconds']} seconds")
        else:
            # Activate boost
            boost_response = self.session.post(f"{BASE_URL}/api/dating/boost/activate")
            assert boost_response.status_code == 200, f"Boost activation failed: {boost_response.text}"
            data = boost_response.json()
            assert data.get("ok") == True
            assert data.get("boost", {}).get("is_active") == True
            print(f"SUCCESS: Boost activated - {data.get('message')}")
    
    def test_discover_includes_boost_metadata(self):
        """Test discover response includes boost/spotlight metadata"""
        response = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200
        data = response.json()
        
        for profile in data.get("profiles", []):
            assert "boost" in profile, f"Profile {profile['profile_id']} missing boost metadata"
            assert "spotlight" in profile, f"Profile {profile['profile_id']} missing spotlight flag"
            assert "discover_rank" in profile, f"Profile {profile['profile_id']} missing discover_rank"
        
        print(f"SUCCESS: All {len(data['profiles'])} profiles have boost/spotlight metadata")


class TestDatingAIFeatures:
    """Test P2 AI Helper features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as reviewer account"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
        )
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_ai_bio_returns_3_suggestions(self):
        """Test AI Bio endpoint returns 3 suggestions"""
        response = self.session.post(
            f"{BASE_URL}/api/dating/ai/bio",
            json={"prompt": ""}
        )
        assert response.status_code == 200, f"AI Bio failed: {response.text}"
        data = response.json()
        
        assert data.get("ok") == True
        assert "suggestions" in data
        assert len(data["suggestions"]) == 3, f"Expected 3 suggestions, got {len(data['suggestions'])}"
        assert "text" in data
        
        for i, suggestion in enumerate(data["suggestions"]):
            assert len(suggestion) > 10, f"Suggestion {i} too short"
        
        print(f"SUCCESS: AI Bio returned 3 suggestions")
        print(f"  - Suggestion 1: {data['suggestions'][0][:50]}...")
    
    def test_ai_profile_coach_returns_tips(self):
        """Test AI Profile Coach endpoint returns actionable tips"""
        response = self.session.post(
            f"{BASE_URL}/api/dating/ai/profile-coach",
            json={"prompt": ""}
        )
        assert response.status_code == 200, f"AI Coach failed: {response.text}"
        data = response.json()
        
        assert data.get("ok") == True
        assert "tips" in data
        assert len(data["tips"]) >= 3, f"Expected at least 3 tips, got {len(data['tips'])}"
        assert "text" in data
        
        print(f"SUCCESS: AI Coach returned {len(data['tips'])} tips")
        print(f"  - Tip 1: {data['tips'][0][:50]}...")
    
    def test_ai_icebreakers_requires_match_id(self):
        """Test AI Icebreakers endpoint requires match_id"""
        response = self.session.post(
            f"{BASE_URL}/api/dating/ai/icebreakers",
            json={"prompt": ""}
        )
        assert response.status_code == 400, "Should fail without match_id"
        print("SUCCESS: AI Icebreakers correctly requires match_id")
    
    def test_ai_icebreakers_with_valid_match(self):
        """Test AI Icebreakers endpoint with valid match"""
        # First get matches
        matches_response = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert matches_response.status_code == 200
        matches = matches_response.json().get("matches", [])
        
        if not matches:
            # Create a match by liking a seed profile
            like_response = self.session.post(
                f"{BASE_URL}/api/dating/like",
                json={"profile_id": "DAT-SEED-LINA", "super_like": False}
            )
            if like_response.status_code == 200:
                matches_response = self.session.get(f"{BASE_URL}/api/dating/matches")
                matches = matches_response.json().get("matches", [])
        
        if matches:
            match_id = matches[0]["match_id"]
            response = self.session.post(
                f"{BASE_URL}/api/dating/ai/icebreakers",
                json={"match_id": match_id}
            )
            assert response.status_code == 200, f"AI Icebreakers failed: {response.text}"
            data = response.json()
            
            assert data.get("ok") == True
            assert "icebreakers" in data
            assert len(data["icebreakers"]) >= 3, f"Expected at least 3 icebreakers"
            
            print(f"SUCCESS: AI Icebreakers returned {len(data['icebreakers'])} suggestions")
            print(f"  - Icebreaker 1: {data['icebreakers'][0][:50]}...")
        else:
            pytest.skip("No matches available for icebreaker test")


class TestDatingMatchesAndChat:
    """Test matches list and chat functionality regression"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as reviewer account"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
        )
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_matches_list_loads(self):
        """Test matches list endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200, f"Matches endpoint failed: {response.text}"
        data = response.json()
        assert "matches" in data
        print(f"SUCCESS: Matches list loaded with {len(data['matches'])} matches")
    
    def test_matches_include_boost_metadata(self):
        """Test matches include boost/spotlight metadata"""
        response = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200
        matches = response.json().get("matches", [])
        
        for match in matches:
            assert "boost" in match, f"Match {match['match_id']} missing boost metadata"
            assert "spotlight" in match, f"Match {match['match_id']} missing spotlight flag"
        
        print(f"SUCCESS: All {len(matches)} matches have boost/spotlight metadata")
    
    def test_chat_messages_load(self):
        """Test chat messages endpoint works"""
        matches_response = self.session.get(f"{BASE_URL}/api/dating/matches")
        matches = matches_response.json().get("matches", [])
        
        if matches:
            match_id = matches[0]["match_id"]
            response = self.session.get(f"{BASE_URL}/api/dating/matches/{match_id}/messages")
            assert response.status_code == 200, f"Messages endpoint failed: {response.text}"
            data = response.json()
            assert "messages" in data
            assert "match" in data
            print(f"SUCCESS: Chat messages loaded for match {match_id}")
        else:
            pytest.skip("No matches available for chat test")
    
    def test_send_message(self):
        """Test sending a message in chat"""
        matches_response = self.session.get(f"{BASE_URL}/api/dating/matches")
        matches = matches_response.json().get("matches", [])
        
        if matches:
            match_id = matches[0]["match_id"]
            response = self.session.post(
                f"{BASE_URL}/api/dating/matches/{match_id}/messages",
                json={"text": "Test message from automated test"}
            )
            assert response.status_code == 200, f"Send message failed: {response.text}"
            data = response.json()
            assert data.get("ok") == True
            assert "message" in data
            assert data["message"]["text"] == "Test message from automated test"
            print(f"SUCCESS: Message sent in match {match_id}")
        else:
            pytest.skip("No matches available for send message test")


class TestDatingLikesYou:
    """Test Likes You feature (P1)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as reviewer account"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
        )
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_likes_you_endpoint(self):
        """Test likes-you endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200, f"Likes-you endpoint failed: {response.text}"
        data = response.json()
        
        assert "locked" in data
        assert "profiles" in data
        assert "count" in data
        
        if data["locked"]:
            print(f"INFO: Likes You is locked (non-premium), count={data['count']}")
        else:
            print(f"SUCCESS: Likes You unlocked with {len(data['profiles'])} profiles")
            for profile in data["profiles"]:
                assert "boost" in profile
                assert "spotlight" in profile


class TestDatingSwipesAndFilters:
    """Test swipes and filters functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as reviewer account"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"}
        )
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_swipes_left_endpoint(self):
        """Test swipes-left endpoint"""
        response = self.session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert response.status_code == 200, f"Swipes-left failed: {response.text}"
        data = response.json()
        
        assert "swipes_left" in data
        assert "premium" in data
        
        if data["premium"]:
            assert data["swipes_left"] == 999999
            print("SUCCESS: Premium user has unlimited swipes")
        else:
            assert data["swipes_left"] >= 0
            print(f"SUCCESS: Free user has {data['swipes_left']} swipes left")
    
    def test_filters_update(self):
        """Test filters update endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/dating/filters",
            json={
                "age_min": 25,
                "age_max": 35,
                "city": "Berlin",
                "seeking": ["women"],
                "relationship_intent": "serious"
            }
        )
        assert response.status_code == 200, f"Filters update failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        assert data["filters"]["age_min"] == 25
        assert data["filters"]["age_max"] == 35
        print("SUCCESS: Filters updated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
