"""
Test suite for 5 NEW Gamification Features:
1. Happy Hour (2x bids during certain hours)
2. Beginner Protection Auctions (for new users)
3. Bidding Streak Bonus (bonus bids for consecutive bids)
4. Enhanced Achievements System (with bid rewards)
5. Telegram Bot for auction alerts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = {
    "email": "kunde@bidblitz.de",
    "password": "Kunde123!"
}

ADMIN_USER = {
    "email": "admin@bidblitz.de",
    "password": "Admin123!"
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def user_token(api_client):
    """Get user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"User authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, user_token):
    """Session with user auth header"""
    api_client.headers.update({"Authorization": f"Bearer {user_token}"})
    return api_client


# ==================== HAPPY HOUR TESTS ====================

class TestHappyHour:
    """Happy Hour feature tests - 2x bids during 18-20 Uhr Berlin"""
    
    def test_happy_hour_status_endpoint(self, api_client):
        """GET /api/gamification/happy-hour returns config and status"""
        response = api_client.get(f"{BASE_URL}/api/gamification/happy-hour")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify config structure
        assert "config" in data, "Response should contain 'config'"
        config = data["config"]
        assert "enabled" in config, "Config should have 'enabled'"
        assert "start_hour" in config, "Config should have 'start_hour'"
        assert "end_hour" in config, "Config should have 'end_hour'"
        assert "multiplier" in config, "Config should have 'multiplier'"
        
        # Verify status structure
        assert "status" in data, "Response should contain 'status'"
        status = data["status"]
        assert "active" in status, "Status should have 'active'"
        
        # Verify values
        assert config["start_hour"] == 18, "Happy Hour should start at 18:00"
        assert config["end_hour"] == 20, "Happy Hour should end at 20:00"
        assert config["multiplier"] == 2.0, "Multiplier should be 2x"
        
        print(f"Happy Hour config: {config}")
        print(f"Happy Hour status: {status}")
    
    def test_happy_hour_shows_next_start_when_inactive(self, api_client):
        """When not active, should show 'starts_in_seconds' or 'next_start'"""
        response = api_client.get(f"{BASE_URL}/api/gamification/happy-hour")
        assert response.status_code == 200
        
        data = response.json()
        status = data["status"]
        
        if not status["active"]:
            # Should have next_start or starts_in_seconds
            has_next_info = "next_start" in status or "starts_in_seconds" in status
            assert has_next_info, "Inactive status should show when Happy Hour starts"
            print(f"Happy Hour starts in: {status.get('starts_in_seconds', 'N/A')} seconds")
        else:
            # Should have remaining_seconds when active
            assert "remaining_seconds" in status, "Active status should show remaining time"
            print(f"Happy Hour active! Ends in: {status.get('remaining_seconds', 'N/A')} seconds")


# ==================== BEGINNER STATUS TESTS ====================

class TestBeginnerStatus:
    """Beginner Protection feature tests"""
    
    def test_beginner_status_endpoint(self, api_client, user_token):
        """GET /api/gamification/beginner-status returns eligibility"""
        response = api_client.get(
            f"{BASE_URL}/api/gamification/beginner-status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "is_beginner" in data, "Response should have 'is_beginner'"
        assert "wins" in data, "Response should have 'wins'"
        assert "days_since_registration" in data, "Response should have 'days_since_registration'"
        assert "criteria" in data, "Response should have 'criteria'"
        assert "message" in data, "Response should have 'message'"
        
        # Verify criteria
        criteria = data["criteria"]
        assert criteria["max_wins"] == 10, "Max wins for beginner should be 10"
        assert criteria["max_days"] == 7, "Max days for beginner should be 7"
        
        print(f"User is beginner: {data['is_beginner']}")
        print(f"User wins: {data['wins']}")
        print(f"Days since registration: {data['days_since_registration']}")
        print(f"Message: {data['message']}")
    
    def test_beginner_status_requires_auth(self, api_client):
        """Beginner status endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/gamification/beginner-status")
        assert response.status_code == 401, "Should require authentication"
    
    def test_beginner_auctions_endpoint(self, api_client, user_token):
        """GET /api/gamification/auctions/beginner returns beginner auctions"""
        response = api_client.get(
            f"{BASE_URL}/api/gamification/auctions/beginner",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Could be 200 (success) or 403 (not a beginner)
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "auctions" in data, "Response should have 'auctions'"
            assert "count" in data, "Response should have 'count'"
            print(f"Beginner auctions available: {data['count']}")
        else:
            print("User is not eligible for beginner auctions (10+ wins)")


# ==================== ACHIEVEMENTS TESTS ====================

class TestAchievements:
    """Enhanced Achievements System tests"""
    
    def test_achievements_list_endpoint(self, api_client, user_token):
        """GET /api/gamification/achievements returns all achievements and progress"""
        response = api_client.get(
            f"{BASE_URL}/api/gamification/achievements",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "achievements" in data, "Response should have 'achievements'"
        assert "by_category" in data, "Response should have 'by_category'"
        assert "stats" in data, "Response should have 'stats'"
        
        # Verify stats
        stats = data["stats"]
        assert "total" in stats, "Stats should have 'total'"
        assert "earned" in stats, "Stats should have 'earned'"
        assert "progress_percent" in stats, "Stats should have 'progress_percent'"
        
        # Verify achievements structure
        achievements = data["achievements"]
        assert len(achievements) > 0, "Should have at least one achievement"
        
        # Check first achievement structure
        first_ach = achievements[0]
        assert "id" in first_ach, "Achievement should have 'id'"
        assert "name" in first_ach, "Achievement should have 'name'"
        assert "description" in first_ach, "Achievement should have 'description'"
        assert "icon" in first_ach, "Achievement should have 'icon'"
        assert "reward_bids" in first_ach, "Achievement should have 'reward_bids'"
        assert "earned" in first_ach, "Achievement should have 'earned'"
        
        print(f"Total achievements: {stats['total']}")
        print(f"Earned achievements: {stats['earned']}")
        print(f"Progress: {stats['progress_percent']}%")
    
    def test_achievements_check_endpoint(self, api_client, user_token):
        """POST /api/gamification/achievements/check grants new achievements"""
        response = api_client.post(
            f"{BASE_URL}/api/gamification/achievements/check",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "checked" in data, "Response should have 'checked'"
        assert "newly_earned" in data, "Response should have 'newly_earned'"
        assert "message" in data, "Response should have 'message'"
        
        assert data["checked"] == True, "Should confirm check was performed"
        
        print(f"Newly earned achievements: {len(data['newly_earned'])}")
        print(f"Message: {data['message']}")
        
        if data["newly_earned"]:
            for ach in data["newly_earned"]:
                print(f"  - {ach['icon']} {ach['name']}: +{ach['reward_bids']} bids")
    
    def test_achievements_requires_auth(self, api_client):
        """Achievements endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/gamification/achievements")
        assert response.status_code == 401, "Should require authentication"


# ==================== STREAK TESTS ====================

class TestStreak:
    """Bidding Streak Bonus tests"""
    
    def test_streak_endpoint_requires_auth(self, api_client):
        """Streak endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/gamification/streak/test-auction-id")
        assert response.status_code == 401, "Should require authentication"
    
    def test_streak_endpoint_with_invalid_auction(self, api_client, user_token):
        """Streak endpoint returns 404 for invalid auction"""
        response = api_client.get(
            f"{BASE_URL}/api/gamification/streak/invalid-auction-id-12345",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 404, f"Expected 404 for invalid auction, got {response.status_code}"
    
    def test_streak_endpoint_structure(self, api_client, user_token):
        """Test streak endpoint response structure with a real auction"""
        # First get an active auction
        auctions_response = api_client.get(f"{BASE_URL}/api/auctions")
        if auctions_response.status_code != 200:
            pytest.skip("Could not fetch auctions")
        
        auctions = auctions_response.json()
        if not auctions or len(auctions) == 0:
            pytest.skip("No auctions available")
        
        auction_id = auctions[0].get("id")
        if not auction_id:
            pytest.skip("Auction has no ID")
        
        response = api_client.get(
            f"{BASE_URL}/api/gamification/streak/{auction_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "current_streak" in data, "Response should have 'current_streak'"
        assert "next_milestone" in data, "Response should have 'next_milestone'"
        assert "milestones" in data, "Response should have 'milestones'"
        
        # Verify milestones
        milestones = data["milestones"]
        assert 5 in milestones or "5" in milestones, "Should have 5-streak milestone"
        assert 10 in milestones or "10" in milestones, "Should have 10-streak milestone"
        
        print(f"Current streak: {data['current_streak']}")
        print(f"Next milestone: {data['next_milestone']}")


# ==================== TELEGRAM TESTS ====================

class TestTelegram:
    """Telegram Bot integration tests"""
    
    def test_telegram_link_code_endpoint(self, api_client, user_token):
        """GET /api/telegram/link-code generates linking code"""
        response = api_client.get(
            f"{BASE_URL}/api/telegram/link-code",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "code" in data, "Response should have 'code'"
        assert "expires_in" in data, "Response should have 'expires_in'"
        assert "bot_username" in data, "Response should have 'bot_username'"
        
        # Verify code format (8 characters alphanumeric)
        code = data["code"]
        assert len(code) == 8, f"Code should be 8 characters, got {len(code)}"
        assert code.isalnum(), "Code should be alphanumeric"
        
        # Verify expiry
        assert data["expires_in"] <= 600, "Code should expire within 10 minutes"
        
        print(f"Link code: {data['code']}")
        print(f"Expires in: {data['expires_in']} seconds")
        print(f"Bot username: {data['bot_username']}")
        
        if "instructions" in data:
            print("Instructions provided:")
            for instruction in data["instructions"]:
                print(f"  {instruction}")
    
    def test_telegram_status_endpoint(self, api_client, user_token):
        """GET /api/telegram/status returns linking status"""
        response = api_client.get(
            f"{BASE_URL}/api/telegram/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "linked" in data, "Response should have 'linked'"
        
        if data["linked"]:
            assert "preferences" in data, "Linked account should have 'preferences'"
            print(f"Telegram linked: Yes")
            print(f"Preferences: {data.get('preferences')}")
        else:
            print("Telegram linked: No")
    
    def test_telegram_requires_auth(self, api_client):
        """Telegram endpoints require authentication"""
        response = api_client.get(f"{BASE_URL}/api/telegram/link-code")
        assert response.status_code == 401, "link-code should require auth"
        
        response = api_client.get(f"{BASE_URL}/api/telegram/status")
        assert response.status_code == 401, "status should require auth"


# ==================== INTEGRATION TESTS ====================

class TestIntegration:
    """Integration tests for gamification features"""
    
    def test_all_gamification_endpoints_accessible(self, api_client, user_token):
        """Verify all gamification endpoints are accessible"""
        endpoints = [
            ("/api/gamification/happy-hour", "GET", False),
            ("/api/gamification/beginner-status", "GET", True),
            ("/api/gamification/achievements", "GET", True),
            ("/api/gamification/achievements/check", "POST", True),
            ("/api/telegram/link-code", "GET", True),
            ("/api/telegram/status", "GET", True),
        ]
        
        results = []
        for endpoint, method, requires_auth in endpoints:
            headers = {"Authorization": f"Bearer {user_token}"} if requires_auth else {}
            
            if method == "GET":
                response = api_client.get(f"{BASE_URL}{endpoint}", headers=headers)
            else:
                response = api_client.post(f"{BASE_URL}{endpoint}", headers=headers)
            
            success = response.status_code == 200
            results.append({
                "endpoint": endpoint,
                "method": method,
                "status": response.status_code,
                "success": success
            })
            
            print(f"{method} {endpoint}: {response.status_code} {'✓' if success else '✗'}")
        
        # All should return 200
        failed = [r for r in results if not r["success"]]
        assert len(failed) == 0, f"Failed endpoints: {failed}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
