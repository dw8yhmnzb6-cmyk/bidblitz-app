"""
Test suite for new feature batch: Bundles, Last Chance, Friend Battle, Reviews
Tests: Backend APIs for the new features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidstorm-1.preview.emergentagent.com')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.de"
CUSTOMER_PASSWORD = "Kunde123!"
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def customer_token():
    """Get customer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Customer authentication failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


class TestLastChanceAPI:
    """Tests for Last Chance / Ending Soon auctions API"""
    
    def test_ending_soon_returns_brackets(self):
        """GET /api/last-chance/ending-soon returns time brackets"""
        response = requests.get(f"{BASE_URL}/api/last-chance/ending-soon")
        assert response.status_code == 200
        
        data = response.json()
        assert "brackets" in data
        assert "total_ending_soon" in data
        
        # Verify bracket structure
        brackets = data["brackets"]
        assert "under_1_min" in brackets
        assert "under_5_min" in brackets
        assert "under_15_min" in brackets
        assert "under_1_hour" in brackets
    
    def test_ending_soon_auction_structure(self):
        """Verify auction data structure in ending soon response"""
        response = requests.get(f"{BASE_URL}/api/last-chance/ending-soon")
        assert response.status_code == 200
        
        data = response.json()
        # Check if any auctions exist in any bracket
        all_auctions = []
        for bracket in data["brackets"].values():
            all_auctions.extend(bracket)
        
        if all_auctions:
            auction = all_auctions[0]
            assert "id" in auction
            assert "product" in auction
            assert "remaining_seconds" in auction
            assert "current_price" in auction
    
    def test_hot_auctions_endpoint(self):
        """GET /api/last-chance/hot returns hot auctions"""
        response = requests.get(f"{BASE_URL}/api/last-chance/hot")
        assert response.status_code == 200
        
        data = response.json()
        assert "hot_auctions" in data
        assert "count" in data
        assert isinstance(data["hot_auctions"], list)
    
    def test_auctions_with_minutes_param(self):
        """GET /api/last-chance/auctions with minutes parameter"""
        response = requests.get(f"{BASE_URL}/api/last-chance/auctions?minutes=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "auctions" in data
        assert "count" in data
        assert "cutoff_minutes" in data
        assert data["cutoff_minutes"] == 10


class TestFriendBattleAPI:
    """Tests for Friend Battle API"""
    
    def test_battle_types_public(self):
        """GET /api/friend-battle/types returns battle types (public)"""
        response = requests.get(f"{BASE_URL}/api/friend-battle/types")
        assert response.status_code == 200
        
        data = response.json()
        assert "types" in data
        assert len(data["types"]) == 4
        
        # Verify battle type structure
        for battle_type in data["types"]:
            assert "id" in battle_type
            assert "name" in battle_type
            assert "description" in battle_type
            assert "icon" in battle_type
            assert "min_stake" in battle_type
            assert "max_stake" in battle_type
    
    def test_battle_types_include_expected(self):
        """Verify expected battle types exist"""
        response = requests.get(f"{BASE_URL}/api/friend-battle/types")
        data = response.json()
        
        type_ids = [t["id"] for t in data["types"]]
        assert "most_bids" in type_ids
        assert "first_win" in type_ids
        assert "most_savings" in type_ids
        assert "bid_streak" in type_ids
    
    def test_leaderboard_public(self):
        """GET /api/friend-battle/leaderboard returns leaderboard (public)"""
        response = requests.get(f"{BASE_URL}/api/friend-battle/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
    
    def test_my_battles_requires_auth(self, customer_token):
        """GET /api/friend-battle/my-battles requires authentication"""
        # Without auth
        response = requests.get(f"{BASE_URL}/api/friend-battle/my-battles")
        assert response.status_code in [401, 403]
        
        # With auth
        response = requests.get(
            f"{BASE_URL}/api/friend-battle/my-battles",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_received" in data
        assert "pending_sent" in data
        assert "active" in data
        assert "completed" in data
        assert "total_wins" in data
        assert "total_battles" in data
    
    def test_challenge_requires_auth(self, customer_token):
        """POST /api/friend-battle/challenge requires authentication"""
        # Without auth
        response = requests.post(f"{BASE_URL}/api/friend-battle/challenge", json={
            "friend_id": "test-id",
            "challenge_type": "most_bids",
            "duration_hours": 24,
            "stake_bids": 5
        })
        assert response.status_code in [401, 403]


class TestReviewsAPI:
    """Tests for Reviews API (reviews_v2)"""
    
    def test_public_reviews(self):
        """GET /api/reviews/public returns public reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews/public")
        assert response.status_code == 200
        
        data = response.json()
        assert "reviews" in data
        assert "total" in data
        assert "average_rating" in data
        assert isinstance(data["reviews"], list)
    
    def test_public_reviews_with_pagination(self):
        """GET /api/reviews/public supports pagination"""
        response = requests.get(f"{BASE_URL}/api/reviews/public?limit=5&offset=0")
        assert response.status_code == 200
        
        data = response.json()
        assert "reviews" in data
        assert len(data["reviews"]) <= 5
    
    def test_my_pending_requires_auth(self, customer_token):
        """GET /api/reviews/my-pending requires authentication"""
        # Without auth
        response = requests.get(f"{BASE_URL}/api/reviews/my-pending")
        assert response.status_code in [401, 403]
        
        # With auth
        response = requests.get(
            f"{BASE_URL}/api/reviews/my-pending",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "pending" in data
        assert "count" in data
        # bonus_per_review is only returned when there are pending reviews
        if data["count"] > 0:
            assert "bonus_per_review" in data
            assert data["bonus_per_review"] == 2
    
    def test_create_review_requires_auth(self, customer_token):
        """POST /api/reviews/create requires authentication"""
        # Without auth
        response = requests.post(f"{BASE_URL}/api/reviews/create", json={
            "auction_id": "test-id",
            "rating": 5,
            "title": "Test",
            "content": "Test content"
        })
        assert response.status_code in [401, 403]


class TestBundlesAPI:
    """Tests for Bundles API"""
    
    def test_available_bundles_requires_auth(self, customer_token):
        """GET /api/bundles/available requires authentication"""
        # Without auth
        response = requests.get(f"{BASE_URL}/api/bundles/available")
        assert response.status_code in [401, 403]
        
        # With auth
        response = requests.get(
            f"{BASE_URL}/api/bundles/available",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "bundles" in data
        assert len(data["bundles"]) == 4
    
    def test_bundle_structure(self, customer_token):
        """Verify bundle data structure"""
        response = requests.get(
            f"{BASE_URL}/api/bundles/available",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        data = response.json()
        
        for bundle in data["bundles"]:
            assert "id" in bundle
            assert "name" in bundle
            assert "name_de" in bundle
            assert "price" in bundle
            assert "original_price" in bundle
            assert "savings_percent" in bundle
            assert "bids" in bundle
            assert "color" in bundle
            assert "icon" in bundle
    
    def test_bundle_ids_exist(self, customer_token):
        """Verify expected bundle IDs exist"""
        response = requests.get(
            f"{BASE_URL}/api/bundles/available",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        data = response.json()
        
        bundle_ids = [b["id"] for b in data["bundles"]]
        assert "starter" in bundle_ids
        assert "pro" in bundle_ids
        assert "ultimate" in bundle_ids
        assert "vip_yearly" in bundle_ids
    
    def test_purchase_bundle_requires_auth(self, customer_token):
        """POST /api/bundles/purchase/{bundle_id} requires authentication"""
        # Without auth
        response = requests.post(f"{BASE_URL}/api/bundles/purchase/starter")
        assert response.status_code in [401, 403]


class TestLoginSocialButtons:
    """Tests for social login buttons (Google and Apple)"""
    
    def test_google_auth_endpoint_exists(self):
        """POST /api/auth/google endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={})
        # Should return 422 (validation error) not 404
        assert response.status_code == 422
    
    def test_google_auth_requires_session_id(self):
        """POST /api/auth/google requires session_id"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={
            "session_id": "invalid-session"
        })
        # Should return error about invalid session, not 404
        assert response.status_code in [400, 401, 422]


class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_customer_login(self):
        """Customer can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == CUSTOMER_EMAIL
    
    def test_admin_login(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == True
