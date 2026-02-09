"""
Test suite for BidBlitz new features:
- Achievements API (GET /api/achievements/all, GET /api/achievements/my-achievements)
- Winner Gallery API (GET /api/winner-gallery/feed)
- Auth API (POST /api/auth/login)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestAuthAPI:
    """Authentication API tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@bidblitz.de"
        assert data["user"]["is_admin"] == True
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 404]
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de"
        })
        assert response.status_code in [400, 422]


class TestAchievementsAPI:
    """Achievements API tests"""
    
    def test_get_all_achievements(self):
        """Test GET /api/achievements/all returns 18 achievements"""
        response = requests.get(f"{BASE_URL}/api/achievements/all?language=de")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "achievements" in data
        assert "by_category" in data
        
        # Verify count - should be 18 achievements
        assert len(data["achievements"]) == 18
        
        # Verify categories
        categories = data["by_category"]
        assert "bidding" in categories
        assert "winning" in categories
        assert "special" in categories
        assert "social" in categories
        assert "loyalty" in categories
        
        # Verify achievement structure
        first_achievement = data["achievements"][0]
        assert "id" in first_achievement
        assert "name" in first_achievement
        assert "description" in first_achievement
        assert "icon" in first_achievement
        assert "category" in first_achievement
        assert "reward_bids" in first_achievement
    
    def test_get_all_achievements_english(self):
        """Test GET /api/achievements/all with English language"""
        response = requests.get(f"{BASE_URL}/api/achievements/all?language=en")
        assert response.status_code == 200
        data = response.json()
        assert len(data["achievements"]) == 18
    
    def test_get_my_achievements_authenticated(self):
        """Test GET /api/achievements/my-achievements with auth"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get my achievements
        response = requests.get(
            f"{BASE_URL}/api/achievements/my-achievements?language=de",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "achievements" in data
        assert "stats" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "earned" in stats
        assert "total" in stats
        assert "progress_percent" in stats
        assert "total_rewards_earned" in stats
        assert stats["total"] == 18
        
        # Verify achievement structure includes earned status
        first_achievement = data["achievements"][0]
        assert "earned" in first_achievement
        assert "earned_at" in first_achievement
    
    def test_get_my_achievements_unauthorized(self):
        """Test GET /api/achievements/my-achievements without auth"""
        response = requests.get(f"{BASE_URL}/api/achievements/my-achievements")
        assert response.status_code in [401, 403]


class TestWinnerGalleryAPI:
    """Winner Gallery API tests"""
    
    def test_get_gallery_feed(self):
        """Test GET /api/winner-gallery/feed returns entries"""
        response = requests.get(f"{BASE_URL}/api/winner-gallery/feed?limit=20&offset=0")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "entries" in data
        assert "total" in data
        assert "has_more" in data
        
        # Entries should be a list
        assert isinstance(data["entries"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["has_more"], bool)
    
    def test_get_gallery_feed_featured_only(self):
        """Test GET /api/winner-gallery/feed with featured_only filter"""
        response = requests.get(f"{BASE_URL}/api/winner-gallery/feed?featured_only=true")
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
    
    def test_get_gallery_feed_pagination(self):
        """Test gallery feed pagination"""
        response = requests.get(f"{BASE_URL}/api/winner-gallery/feed?limit=5&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "has_more" in data


class TestAuctionsAPI:
    """Auctions API tests"""
    
    def test_get_auctions_list(self):
        """Test GET /api/auctions returns auction list"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert "auctions" in data or isinstance(data, list)


class TestUserStatsAPI:
    """User Stats API tests"""
    
    def test_get_user_stats_authenticated(self):
        """Test GET /api/user-stats/my-stats with auth"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get user stats
        response = requests.get(
            f"{BASE_URL}/api/user-stats/my-stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestJackpotAPI:
    """Jackpot/Excitement API tests"""
    
    def test_get_global_jackpot(self):
        """Test GET /api/excitement/global-jackpot"""
        response = requests.get(f"{BASE_URL}/api/excitement/global-jackpot")
        assert response.status_code == 200
        data = response.json()
        assert "jackpot_amount" in data or "amount" in data or "current_jackpot" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
