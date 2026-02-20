"""
Test Suite for bidblitz.ae New Features (Iteration 22)
- Challenges API
- Events API  
- Winner Gallery API
- Subscriptions API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://payment-hub-196.preview.emergentagent.com')

# Test credentials
TEST_USER = {"email": "kunde@bidblitz.ae", "password": "Kunde123!"}
ADMIN_USER = {"email": "admin@bidblitz.ae", "password": "Admin123!"}


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
    pytest.skip("User authentication failed")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


class TestSubscriptionsAPI:
    """Subscriptions API tests - 3 plans (starter, pro, vip_plus)"""
    
    def test_get_subscription_plans(self, api_client):
        """GET /api/subscriptions/plans - Should return 3 plans"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) == 3
        
        # Verify plan IDs
        plan_ids = [p["id"] for p in plans]
        assert "starter" in plan_ids
        assert "pro" in plan_ids
        assert "vip_plus" in plan_ids
        
        # Verify starter plan
        starter = next(p for p in plans if p["id"] == "starter")
        assert starter["price"] == 19.99
        assert starter["bids_per_month"] == 50
        
        # Verify pro plan
        pro = next(p for p in plans if p["id"] == "pro")
        assert pro["price"] == 34.99
        assert pro["bids_per_month"] == 100
        
        # Verify vip_plus plan
        vip_plus = next(p for p in plans if p["id"] == "vip_plus")
        assert vip_plus["price"] == 59.99
        assert vip_plus["bids_per_month"] == 200
        assert vip_plus.get("is_premium") == True
    
    def test_get_my_subscription_authenticated(self, api_client, user_token):
        """GET /api/subscriptions/my-subscription - Should return subscription status"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/my-subscription",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "has_subscription" in data
        # User may or may not have subscription
        assert isinstance(data["has_subscription"], bool)
    
    def test_get_my_subscription_unauthenticated(self, api_client):
        """GET /api/subscriptions/my-subscription - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        assert response.status_code == 401
    
    def test_get_vip_plus_status(self, api_client, user_token):
        """GET /api/subscriptions/vip-plus/status - Should return VIP+ status"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/vip-plus/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "is_vip_plus" in data
        assert isinstance(data["is_vip_plus"], bool)


class TestChallengesAPI:
    """Challenges API tests - Weekly challenges with progress"""
    
    def test_get_active_challenges(self, api_client, user_token):
        """GET /api/challenges/active - Should return 3 challenges with progress"""
        response = api_client.get(
            f"{BASE_URL}/api/challenges/active",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "challenges" in data
        assert "week_start" in data
        assert "week_end" in data
        assert "days_remaining" in data
        
        challenges = data["challenges"]
        assert len(challenges) == 3  # 3 challenges per week
        
        # Verify challenge structure
        for challenge in challenges:
            assert "challenge_id" in challenge
            assert "name" in challenge
            assert "description" in challenge
            assert "icon" in challenge
            assert "goal" in challenge
            assert "progress" in challenge
            assert "reward_bids" in challenge
            assert "type" in challenge
            assert "difficulty" in challenge
            assert "completed" in challenge
            assert "claimed" in challenge
            
            # Progress should be >= 0
            assert challenge["progress"] >= 0
            # Goal should be > 0
            assert challenge["goal"] > 0
            # Reward should be > 0
            assert challenge["reward_bids"] > 0
    
    def test_get_active_challenges_unauthenticated(self, api_client):
        """GET /api/challenges/active - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/challenges/active")
        assert response.status_code == 401
    
    def test_claim_challenge_not_completed(self, api_client, user_token):
        """POST /api/challenges/claim/{id} - Should fail if not completed"""
        # First get active challenges
        response = api_client.get(
            f"{BASE_URL}/api/challenges/active",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        challenges = response.json().get("challenges", [])
        
        # Find a challenge that is not completed
        not_completed = [c for c in challenges if not c.get("completed")]
        if not_completed:
            challenge_id = not_completed[0]["challenge_id"]
            response = api_client.post(
                f"{BASE_URL}/api/challenges/claim/{challenge_id}",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            # Should fail because not completed
            assert response.status_code == 400
            assert "nicht abgeschlossen" in response.json().get("detail", "").lower() or "not completed" in response.json().get("detail", "").lower()
    
    def test_claim_invalid_challenge(self, api_client, user_token):
        """POST /api/challenges/claim/{id} - Should fail for invalid challenge"""
        response = api_client.post(
            f"{BASE_URL}/api/challenges/claim/invalid_challenge_id",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 404
    
    def test_get_challenge_history(self, api_client, user_token):
        """GET /api/challenges/history - Should return challenge history"""
        response = api_client.get(
            f"{BASE_URL}/api/challenges/history",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)


class TestEventsAPI:
    """Events API tests - Flash auctions and events"""
    
    def test_get_upcoming_events(self, api_client):
        """GET /api/events/upcoming - Should return upcoming events"""
        response = api_client.get(f"{BASE_URL}/api/events/upcoming")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "count" in data
        assert isinstance(data["events"], list)
        assert isinstance(data["count"], int)
    
    def test_get_active_flash_auctions(self, api_client):
        """GET /api/events/active - Should return active flash auctions"""
        response = api_client.get(f"{BASE_URL}/api/events/active")
        assert response.status_code == 200
        
        data = response.json()
        assert "flash_auctions" in data
        assert isinstance(data["flash_auctions"], list)
    
    def test_subscribe_to_event_unauthenticated(self, api_client):
        """POST /api/events/subscribe/{id} - Should require auth"""
        response = api_client.post(f"{BASE_URL}/api/events/subscribe/test_event_id")
        assert response.status_code == 401
    
    def test_subscribe_to_invalid_event(self, api_client, user_token):
        """POST /api/events/subscribe/{id} - Should fail for invalid event"""
        response = api_client.post(
            f"{BASE_URL}/api/events/subscribe/invalid_event_id",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 404


class TestWinnerGalleryAPI:
    """Winner Gallery API tests - Winner photos and testimonials"""
    
    def test_get_gallery_feed(self, api_client):
        """GET /api/winner-gallery/feed - Should return gallery feed"""
        response = api_client.get(f"{BASE_URL}/api/winner-gallery/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert "has_more" in data
        assert isinstance(data["entries"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["has_more"], bool)
    
    def test_get_gallery_feed_with_params(self, api_client):
        """GET /api/winner-gallery/feed - Should support pagination"""
        response = api_client.get(
            f"{BASE_URL}/api/winner-gallery/feed",
            params={"limit": 5, "offset": 0, "featured_only": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "entries" in data
    
    def test_get_my_submissions_authenticated(self, api_client, user_token):
        """GET /api/winner-gallery/my-submissions - Should return user's submissions"""
        response = api_client.get(
            f"{BASE_URL}/api/winner-gallery/my-submissions",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "submissions" in data
        assert isinstance(data["submissions"], list)
    
    def test_get_my_submissions_unauthenticated(self, api_client):
        """GET /api/winner-gallery/my-submissions - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/winner-gallery/my-submissions")
        assert response.status_code == 401
    
    def test_upload_photo_without_winning(self, api_client, user_token):
        """POST /api/winner-gallery/upload - Should fail if user didn't win auction"""
        response = api_client.post(
            f"{BASE_URL}/api/winner-gallery/upload",
            params={"auction_id": "fake_auction_id"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Should fail because user didn't win this auction
        assert response.status_code == 403
    
    def test_get_invalid_gallery_entry(self, api_client):
        """GET /api/winner-gallery/{id} - Should return 404 for invalid entry"""
        response = api_client.get(f"{BASE_URL}/api/winner-gallery/invalid_gallery_id")
        assert response.status_code == 404
    
    def test_like_gallery_entry_unauthenticated(self, api_client):
        """POST /api/winner-gallery/{id}/like - Should require auth"""
        response = api_client.post(f"{BASE_URL}/api/winner-gallery/test_id/like")
        assert response.status_code == 401


class TestAdminEndpoints:
    """Admin endpoints for new features"""
    
    def test_challenges_admin_stats(self, api_client, admin_token):
        """GET /api/challenges/admin/stats - Should return challenge stats"""
        response = api_client.get(
            f"{BASE_URL}/api/challenges/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "week_start" in data
        assert "active_participants" in data
        assert "challenges_completed" in data
        assert "total_bids_awarded" in data
    
    def test_events_admin_stats(self, api_client, admin_token):
        """GET /api/events/admin/stats - Should return event stats"""
        response = api_client.get(
            f"{BASE_URL}/api/events/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_events" in data
        assert "upcoming_events" in data
        assert "completed_events" in data
        assert "flash_auction_stats" in data
    
    def test_gallery_admin_stats(self, api_client, admin_token):
        """GET /api/winner-gallery/admin/stats - Should return gallery stats"""
        response = api_client.get(
            f"{BASE_URL}/api/winner-gallery/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_submissions" in data
        assert "approved" in data
        assert "pending" in data
        assert "featured" in data
    
    def test_subscriptions_admin_stats(self, api_client, admin_token):
        """GET /api/subscriptions/admin/stats - Should return subscription stats"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "active_subscriptions" in data
        assert "by_plan" in data
        assert "monthly_recurring_revenue" in data
    
    def test_admin_stats_require_admin(self, api_client, user_token):
        """Admin endpoints should require admin role"""
        endpoints = [
            "/api/challenges/admin/stats",
            "/api/events/admin/stats",
            "/api/winner-gallery/admin/stats",
            "/api/subscriptions/admin/stats"
        ]
        
        for endpoint in endpoints:
            response = api_client.get(
                f"{BASE_URL}{endpoint}",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            # Should be 403 Forbidden for non-admin
            assert response.status_code == 403, f"Endpoint {endpoint} should require admin"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
