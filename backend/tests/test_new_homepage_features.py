"""
Test suite for new homepage features:
- Winner Gallery (/api/winners)
- Daily Quests (/api/daily/quests)
- VIP Badge/Banner (frontend only - uses user.is_vip)
- Exit Intent Popup (frontend only - no backend)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWinnersAPI:
    """Tests for /api/winners endpoint - Winner Gallery data"""
    
    def test_winners_endpoint_returns_200(self):
        """Winners endpoint should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/winners?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"SUCCESS: /api/winners returned {response.status_code}")
    
    def test_winners_returns_list(self):
        """Winners endpoint should return a list"""
        response = requests.get(f"{BASE_URL}/api/winners?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"SUCCESS: /api/winners returned list with {len(data)} items")
    
    def test_winners_structure_if_data_exists(self):
        """If winners exist, verify data structure"""
        response = requests.get(f"{BASE_URL}/api/winners?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            winner = data[0]
            # Check expected fields
            assert 'winner_name' in winner or 'winner_id' in winner, "Winner should have winner_name or winner_id"
            assert 'final_price' in winner, "Winner should have final_price"
            print(f"SUCCESS: Winner data structure valid - {winner.get('winner_name', 'N/A')}")
        else:
            print("INFO: No winners in database - structure test skipped")


class TestDailyQuestsAPI:
    """Tests for /api/daily/quests endpoint - Daily Quests Widget data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_daily_quests_requires_auth(self):
        """Daily quests endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/daily/quests")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"SUCCESS: /api/daily/quests requires authentication (returned {response.status_code})")
    
    def test_daily_quests_returns_200_with_auth(self, auth_token):
        """Daily quests endpoint should return 200 with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/daily/quests",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"SUCCESS: /api/daily/quests returned 200 with auth")
    
    def test_daily_quests_structure(self, auth_token):
        """Daily quests should return proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/daily/quests",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert 'quests' in data, "Response should have 'quests' field"
        assert isinstance(data['quests'], list), "Quests should be a list"
        print(f"SUCCESS: Daily quests structure valid - {len(data['quests'])} quests")
    
    def test_daily_quests_quest_item_structure(self, auth_token):
        """Each quest should have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/daily/quests",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data.get('quests', [])) > 0:
            quest = data['quests'][0]
            # Check quest structure
            assert 'id' in quest, "Quest should have 'id'"
            assert 'target' in quest, "Quest should have 'target'"
            assert 'progress' in quest, "Quest should have 'progress'"
            assert 'reward_bids' in quest or 'reward_xp' in quest, "Quest should have reward"
            print(f"SUCCESS: Quest item structure valid - {quest.get('name', quest.get('type', 'N/A'))}")
        else:
            print("INFO: No quests returned - structure test skipped")
    
    def test_daily_quests_has_reset_info(self, auth_token):
        """Daily quests should include reset timing info"""
        response = requests.get(
            f"{BASE_URL}/api/daily/quests",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for reset info
        assert 'date' in data or 'seconds_until_reset' in data, "Should have date or reset timing"
        print(f"SUCCESS: Daily quests has reset info - date: {data.get('date', 'N/A')}")


class TestUserVIPStatus:
    """Tests for user VIP status - used by VIP Promo Banner"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_user_has_vip_field(self, auth_token):
        """User profile should include is_vip field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert 'is_vip' in data, "User should have 'is_vip' field"
        assert isinstance(data['is_vip'], bool), "is_vip should be boolean"
        print(f"SUCCESS: User has is_vip field - value: {data['is_vip']}")


class TestHealthAndIntegration:
    """Basic health and integration tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy', f"Expected healthy, got {data.get('status')}"
        print("SUCCESS: Health endpoint returns healthy")
    
    def test_auctions_endpoint(self):
        """Auctions endpoint should work (used by homepage)"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Auctions should return a list"
        print(f"SUCCESS: Auctions endpoint returns {len(data)} auctions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
