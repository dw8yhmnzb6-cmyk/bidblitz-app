"""
Test Suite for 10 New Customer-Facing Features:
1. Subscription Plans (GET /api/subscription/plans, GET /api/subscription/my-subscription)
2. Bid Buddy (GET /api/bid-buddy/my-buddies, GET /api/bid-buddy/status/{auction_id})
3. Buy It Now (GET /api/buy-it-now/offers)
4. Achievements (GET /api/achievements/all, GET /api/achievements/my-achievements)
5. Testimonials (GET /api/testimonials/videos)
6. Win Notifications (GET /api/win-notifications/recent)
7. Countdown Alarm (GET /api/countdown-alarm/my-alarms)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidblitz-preview-2.preview.emergentagent.com')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.ae"
CUSTOMER_PASSWORD = "Kunde123!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def customer_token():
    """Get customer authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Customer authentication failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


class TestSubscriptionAPI:
    """Test Subscription Plans API - Monthly bid subscription plans"""
    
    def test_get_subscription_plans_returns_3_plans(self):
        """GET /api/subscription/plans should return 3 plans (basic, pro, elite)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) == 3
        
        # Verify plan IDs
        plan_ids = [p["id"] for p in plans]
        assert "basic" in plan_ids
        assert "pro" in plan_ids
        assert "elite" in plan_ids
    
    def test_subscription_plans_have_correct_structure(self):
        """Each plan should have required fields"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        for plan in data["plans"]:
            assert "id" in plan
            assert "name" in plan
            assert "name_de" in plan
            assert "price" in plan
            assert "bids_per_month" in plan
            assert "bonus_bids" in plan
            assert "total_bids" in plan
            assert "features_de" in plan
            assert "features_en" in plan
    
    def test_basic_plan_details(self):
        """Basic plan should have correct pricing and bids"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        basic = next(p for p in data["plans"] if p["id"] == "basic")
        assert basic["price"] == 19.99
        assert basic["bids_per_month"] == 50
        assert basic["bonus_bids"] == 5
        assert basic["total_bids"] == 55
        assert basic["vip_access"] == False
    
    def test_pro_plan_is_popular(self):
        """Pro plan should be marked as popular"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        pro = next(p for p in data["plans"] if p["id"] == "pro")
        assert pro.get("popular") == True
        assert pro["price"] == 39.99
        assert pro["vip_access"] == True
    
    def test_elite_plan_has_exclusive_auctions(self):
        """Elite plan should have exclusive auctions"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        elite = next(p for p in data["plans"] if p["id"] == "elite")
        assert elite["exclusive_auctions"] == True
        assert elite["price"] == 79.99
        assert elite["total_bids"] == 350
    
    def test_get_my_subscription_requires_auth(self):
        """GET /api/subscription/my-subscription should require authentication"""
        response = requests.get(f"{BASE_URL}/api/subscription/my-subscription")
        assert response.status_code == 401
    
    def test_get_my_subscription_returns_status(self, customer_token):
        """GET /api/subscription/my-subscription should return subscription status"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/my-subscription",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "has_subscription" in data
        assert "subscription" in data


class TestBidBuddyAPI:
    """Test Bid Buddy API - Automatic bidding system"""
    
    def test_get_my_buddies_requires_auth(self):
        """GET /api/bid-buddy/my-buddies should require authentication"""
        response = requests.get(f"{BASE_URL}/api/bid-buddy/my-buddies")
        assert response.status_code == 401
    
    def test_get_my_buddies_returns_list(self, customer_token):
        """GET /api/bid-buddy/my-buddies should return bid buddies list"""
        response = requests.get(
            f"{BASE_URL}/api/bid-buddy/my-buddies",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "bid_buddies" in data
        assert isinstance(data["bid_buddies"], list)
    
    def test_get_bid_buddy_status_requires_auth(self):
        """GET /api/bid-buddy/status/{auction_id} should require authentication"""
        response = requests.get(f"{BASE_URL}/api/bid-buddy/status/test-auction-123")
        assert response.status_code == 401
    
    def test_get_bid_buddy_status_returns_status(self, customer_token):
        """GET /api/bid-buddy/status/{auction_id} should return status"""
        response = requests.get(
            f"{BASE_URL}/api/bid-buddy/status/test-auction-123",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "active" in data
        assert "bid_buddy" in data


class TestBuyItNowAPI:
    """Test Buy It Now API - Purchase with bid credit"""
    
    def test_get_offers_requires_auth(self):
        """GET /api/buy-it-now/offers should require authentication"""
        response = requests.get(f"{BASE_URL}/api/buy-it-now/offers")
        assert response.status_code == 401
    
    def test_get_offers_returns_list(self, customer_token):
        """GET /api/buy-it-now/offers should return offers list"""
        response = requests.get(
            f"{BASE_URL}/api/buy-it-now/offers",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "offers" in data
        assert isinstance(data["offers"], list)
        assert "message" in data


class TestAchievementsAPI:
    """Test Achievements API - Badges and gamification"""
    
    def test_get_all_achievements_returns_18_plus(self):
        """GET /api/achievements/all should return 18+ achievements"""
        response = requests.get(f"{BASE_URL}/api/achievements/all?language=de")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "achievements" in data
        assert len(data["achievements"]) >= 18
        
        # Verify categories exist
        assert "by_category" in data
        categories = data["by_category"]
        assert "bidding" in categories
        assert "winning" in categories
        assert "special" in categories
        assert "social" in categories
        assert "loyalty" in categories
    
    def test_achievements_have_correct_structure(self):
        """Each achievement should have required fields"""
        response = requests.get(f"{BASE_URL}/api/achievements/all?language=de")
        data = response.json()
        
        for ach in data["achievements"]:
            assert "id" in ach
            assert "name" in ach
            assert "description" in ach
            assert "icon" in ach
            assert "category" in ach
            assert "reward_bids" in ach
    
    def test_achievements_language_support(self):
        """Achievements should support German and English"""
        # German
        response_de = requests.get(f"{BASE_URL}/api/achievements/all?language=de")
        data_de = response_de.json()
        
        # English
        response_en = requests.get(f"{BASE_URL}/api/achievements/all?language=en")
        data_en = response_en.json()
        
        # First achievement should have different names
        first_de = data_de["achievements"][0]["name"]
        first_en = data_en["achievements"][0]["name"]
        
        # German name should be "Erster Schritt", English should be "First Step"
        assert first_de == "Erster Schritt"
        assert first_en == "First Step"
    
    def test_get_my_achievements_requires_auth(self):
        """GET /api/achievements/my-achievements should require authentication"""
        response = requests.get(f"{BASE_URL}/api/achievements/my-achievements")
        assert response.status_code == 401
    
    def test_get_my_achievements_returns_user_progress(self, customer_token):
        """GET /api/achievements/my-achievements should return user's achievements"""
        response = requests.get(
            f"{BASE_URL}/api/achievements/my-achievements?language=de",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "achievements" in data
        assert "stats" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "earned" in stats
        assert "total" in stats
        assert "progress_percent" in stats
        assert "total_rewards_earned" in stats
        
        # Each achievement should have earned status
        for ach in data["achievements"]:
            assert "earned" in ach
            assert "earned_at" in ach


class TestTestimonialsAPI:
    """Test Video Testimonials API"""
    
    def test_get_videos_returns_list(self):
        """GET /api/testimonials/videos should return videos list"""
        response = requests.get(f"{BASE_URL}/api/testimonials/videos")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "videos" in data
        assert isinstance(data["videos"], list)


class TestWinNotificationsAPI:
    """Test Win Notifications API - FOMO notifications"""
    
    def test_get_recent_notifications(self):
        """GET /api/win-notifications/recent should return notifications"""
        response = requests.get(f"{BASE_URL}/api/win-notifications/recent")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications" in data
        assert isinstance(data["notifications"], list)


class TestCountdownAlarmAPI:
    """Test Countdown Alarm API - Auction ending notifications"""
    
    def test_get_my_alarms_requires_auth(self):
        """GET /api/countdown-alarm/my-alarms should require authentication"""
        response = requests.get(f"{BASE_URL}/api/countdown-alarm/my-alarms")
        assert response.status_code == 401
    
    def test_get_my_alarms_returns_list(self, customer_token):
        """GET /api/countdown-alarm/my-alarms should return alarms list"""
        response = requests.get(
            f"{BASE_URL}/api/countdown-alarm/my-alarms",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "alarms" in data
        assert isinstance(data["alarms"], list)


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """API should be healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
